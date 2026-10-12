# SkyData Whisper bridge

This server connects SkyData's web requests to NVIDIA's hosted Whisper Large v3 gRPC service. It does not run Whisper locally and needs no GPU. It must stay running separately from SkyData. It is not deployed by the SkyData Site publish.

Deploy this folder as a Docker web service on a host that provides HTTPS and allows outbound TLS/HTTP2 connections to `grpc.nvcf.nvidia.com:443`. Use an always-on service for consistent voice latency; sleeping services add delay. Choose the host's plan yourself before deployment.

Set these private environment variables in the host's settings:

- `NVIDIA_WHISPER_API_KEY`: your complete NVIDIA key.
- `BRIDGE_ACCESS_TOKEN`: generate with `python -c 'import secrets; print(secrets.token_urlsafe(32))'`. This is a separate password for the bridge.
- `PORT`: supplied by the host, or defaults to 8000.

In SkyData, open **+ → Whisper speech recognition**. Paste the bridge's HTTPS address and its access token. The NVIDIA key stays on the bridge. **Test and connect Whisper** verifies NVIDIA access before saving the connection encrypted. The previous recognizer stays selected until this succeeds. Use **Use previous speech recognition** to switch back.

Voice chat sends mono 16 kHz WAV recordings after a pause. Whisper recognizes speech with automatic language detection. SkyData's selected reply language controls the answer, independently of the input language. The speaking voice is unchanged. This is conversation in turns, not simultaneous, interruptible realtime speech.

The bridge requires authentication for every request, accepts one transcription at a time, limits recordings to 35 seconds and 2.1 MB, uses a timeout, and stores no recordings. Disable body/secret logging on the hosting service. Keep the API key and bridge token out of git and screenshots.

Validation performed before handoff uses mocked NVIDIA responses. A real Whisper recording and its latency must be tested after deploying the bridge with your key. No accuracy or speed improvement is assumed.
