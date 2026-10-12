"""Private HTTP bridge to NVIDIA's hosted Whisper. Never logs audio or secrets."""
import asyncio
import io
import os
import secrets
import wave
from contextlib import asynccontextmanager

import grpc
import riva.client
from fastapi import FastAPI, HTTPException, Request

TOKEN = os.environ.get('BRIDGE_ACCESS_TOKEN', '')
KEY = os.environ.get('NVIDIA_WHISPER_API_KEY', '')
if len(TOKEN) < 32 or not KEY:
    raise RuntimeError('Set BRIDGE_ACCESS_TOKEN and NVIDIA_WHISPER_API_KEY in server settings.')

auth = riva.client.Auth(
    uri='grpc.nvcf.nvidia.com:443', use_ssl=True,
    metadata_args=[['function-id', 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d'],
                   ['authorization', 'Bearer ' + KEY]],
)
service = riva.client.ASRService(auth)
gate = asyncio.Semaphore(1)

@asynccontextmanager
async def lifespan(app):
    yield
    auth.channel.close()

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

def authorize(request):
    if not secrets.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + TOKEN):
        raise HTTPException(401, 'Unauthorized')

async def call(request, operation):
    # Keep the one-owner bridge from building an unbounded queue.
    if gate.locked():
        raise HTTPException(429, 'Whisper is processing another recording')
    async with gate:
        future = operation()
        task = asyncio.create_task(asyncio.to_thread(future.result, timeout=55))
        try:
            while not task.done():
                await asyncio.wait({task}, timeout=.2)
                if await request.is_disconnected():
                    future.cancel()
                    raise HTTPException(499, 'Request canceled')
            return await task
        except (grpc.RpcError, grpc.FutureTimeoutError):
            raise HTTPException(503, 'NVIDIA Whisper is unavailable') from None
        finally:
            future.cancel()
            if not task.done():
                task.cancel()
            else:
                # Retrieve exceptions even when the browser disconnected first.
                if not task.cancelled():
                    task.exception()

@app.post('/verify')
async def verify(request: Request):
    authorize(request)
    await call(request, lambda: service.stub.GetRivaSpeechRecognitionConfig.future(
        riva.client.proto.riva_asr_pb2.RivaSpeechRecognitionConfigRequest(),
        metadata=auth.get_auth_metadata(), timeout=15,
    ))
    return {'verified': True, 'model': 'whisper-large-v3'}

@app.post('/transcribe')
async def transcribe(request: Request):
    authorize(request)
    if request.headers.get('content-type', '').split(';')[0] != 'audio/wav':
        raise HTTPException(415, 'Send WAV audio')
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > 2100000:
            raise HTTPException(413, 'Recording too large')
    try:
        with wave.open(io.BytesIO(data), 'rb') as audio:
            if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or audio.getframerate() != 16000 or audio.getcomptype() != 'NONE':
                raise ValueError()
            if not 0 < audio.getnframes() <= 16000 * 35:
                raise ValueError()
            pcm = audio.readframes(audio.getnframes())
            if len(pcm) != audio.getnframes() * 2:
                raise ValueError()
    except (wave.Error, EOFError, ValueError):
        raise HTTPException(400, 'Invalid mono 16 kHz PCM WAV') from None
    config = riva.client.RecognitionConfig(
        encoding=riva.client.AudioEncoding.LINEAR_PCM, sample_rate_hertz=16000,
        language_code='multi', max_alternatives=1, enable_automatic_punctuation=True,
    )
    result = await call(request, lambda: service.offline_recognize(pcm, config, future=True))
    text = ' '.join(r.alternatives[0].transcript.strip() for r in result.results if r.alternatives).strip()
    return {'text': text[:8000], 'provider': 'whisper'}
