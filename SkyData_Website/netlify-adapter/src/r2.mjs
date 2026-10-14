// A Cloudflare R2-compatible bucket backed by Netlify Blobs, so SkyData's `env.FILES.get/put/list/delete`
// and multipart uploads run unchanged. Multipart parts stay as separate blobs; the finished object is a
// small manifest that reads stream the parts back in order, so completing never loads the file into memory.

const strip = (etag) => String(etag ?? '').replace(/^W\//, '').replace(/^"|"$/g, '');

async function toBytes(value) {
  if (value === null || value === undefined) return new Uint8Array(0);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof Blob !== 'undefined' && value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (value && typeof value.getReader === 'function') return new Uint8Array(await new Response(value).arrayBuffer());
  throw new TypeError('Unsupported R2 put() value');
}

function parseRange(range, size) {
  if (!range) return null;
  if (typeof Headers !== 'undefined' && range instanceof Headers) {
    const h = range.get('range');
    const m = h && /^bytes=(\d*)-(\d*)$/.exec(h.trim());
    if (!m) return null;
    if (m[1] === '') return { offset: Math.max(0, size - Number(m[2])), length: Math.min(size, Number(m[2])) };
    const offset = Number(m[1]);
    const end = m[2] === '' ? size - 1 : Math.min(size - 1, Number(m[2]));
    return { offset, length: Math.max(0, end - offset + 1) };
  }
  if ('suffix' in range) return { offset: Math.max(0, size - range.suffix), length: Math.min(size, range.suffix) };
  const offset = range.offset ?? 0;
  const length = range.length ?? size - offset;
  return { offset, length: Math.max(0, Math.min(length, size - offset)) };
}

function objectInfo(key, meta, etag) {
  const httpMetadata = meta.httpMetadata ?? {};
  const e = meta.etag ?? strip(etag);
  return {
    key,
    version: e,
    size: meta.size ?? 0,
    etag: e,
    httpEtag: `"${e}"`,
    uploaded: new Date(meta.uploaded ?? 0),
    httpMetadata,
    customMetadata: meta.customMetadata ?? {},
    checksums: {},
    storageClass: 'Standard',
    writeHttpMetadata(headers) {
      for (const [k, h] of [['contentType', 'content-type'], ['contentLanguage', 'content-language'], ['contentDisposition', 'content-disposition'], ['contentEncoding', 'content-encoding'], ['cacheControl', 'cache-control']]) {
        if (httpMetadata[k]) headers.set(h, httpMetadata[k]);
      }
    },
  };
}

export class R2OnBlobs {
  /** @param files Blobs store for objects; @param parts Blobs store for multipart parts */
  constructor(files, parts) {
    this.files = files;
    this.parts = parts;
  }

  async _meta(key) {
    const r = await this.files.getMetadata(key, { consistency: 'strong' });
    return r ? { meta: r.metadata ?? {}, etag: r.etag } : null;
  }

  async head(key) {
    const m = await this._meta(key);
    return m ? objectInfo(key, m.meta, m.etag) : null;
  }

  async get(key, options = {}) {
    const m = await this._meta(key);
    if (!m) return null;
    const info = objectInfo(key, m.meta, m.etag);
    const only = options.onlyIf;
    if (only && !(only instanceof Headers)) {
      if (only.etagMatches && strip(only.etagMatches) !== info.etag) return info;
      if (only.etagDoesNotMatch && strip(only.etagDoesNotMatch) === info.etag) return info;
    }
    const range = parseRange(options.range, info.size);
    const load = async () => {
      let bytes;
      if (m.meta.multipart) {
        const chunks = [];
        for (const p of m.meta.multipart.parts) chunks.push(new Uint8Array(await this.parts.get(p.blob, { type: 'arrayBuffer', consistency: 'strong' })));
        bytes = new Uint8Array(info.size);
        let at = 0;
        for (const c of chunks) {
          bytes.set(c, at);
          at += c.byteLength;
        }
      } else {
        bytes = new Uint8Array((await this.files.get(key, { type: 'arrayBuffer', consistency: 'strong' })) ?? new ArrayBuffer(0));
      }
      return range ? bytes.slice(range.offset, range.offset + range.length) : bytes;
    };
    let cached;
    const bytes = () => (cached ??= load());
    let used = false;
    const body = new ReadableStream({
      async pull(controller) {
        controller.enqueue(await bytes());
        controller.close();
      },
    });
    return {
      ...info,
      range: range ?? undefined,
      get body() {
        used = true;
        return body;
      },
      get bodyUsed() {
        return used;
      },
      async arrayBuffer() {
        used = true;
        const b = await bytes();
        return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      },
      async bytes() {
        used = true;
        return bytes();
      },
      async text() {
        used = true;
        return new TextDecoder().decode(await bytes());
      },
      async json() {
        return JSON.parse(await this.text());
      },
      async blob() {
        used = true;
        return new Blob([await bytes()], { type: info.httpMetadata.contentType ?? '' });
      },
    };
  }

  async put(key, value, options = {}) {
    const bytes = await toBytes(value);
    return this._write(key, bytes, options, {});
  }

  async _write(key, bytes, options, extra) {
    const only = options.onlyIf && !(options.onlyIf instanceof Headers) ? options.onlyIf : null;
    let current = null;
    if (only?.etagMatches || only?.etagDoesNotMatch) current = await this._meta(key);
    if (only?.etagMatches && (!current || strip(current.meta.etag ?? current.etag) !== strip(only.etagMatches))) return null;
    if (only?.etagDoesNotMatch && current && strip(current.meta.etag ?? current.etag) === strip(only.etagDoesNotMatch)) return null;
    const httpMetadata = options.httpMetadata instanceof Headers ? { contentType: options.httpMetadata.get('content-type') ?? undefined } : options.httpMetadata ?? {};
    const meta = {
      size: extra.size ?? bytes.byteLength,
      uploaded: Date.now(),
      etag: crypto.randomUUID().replace(/-/g, ''),
      httpMetadata,
      customMetadata: options.customMetadata ?? {},
      ...(extra.multipart ? { multipart: extra.multipart } : {}),
    };
    const previous = current ?? (await this._meta(key));
    const setOptions = { metadata: meta };
    // Blobs conditional writes keep a concurrent etag-guarded update from overwriting a newer one.
    if (only?.etagMatches && current?.etag) setOptions.onlyIfMatch = current.etag;
    const res = await this.files.set(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), setOptions);
    if (res && res.modified === false) return null;
    if (previous?.meta?.multipart && previous.meta.multipart.uploadId !== extra.multipart?.uploadId) await this._dropParts(previous.meta.multipart);
    return objectInfo(key, meta);
  }

  async _dropParts(multipart) {
    for (const p of multipart.parts ?? []) await this.parts.delete(p.blob).catch(() => {});
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const m = await this._meta(key);
      if (m?.meta?.multipart) await this._dropParts(m.meta.multipart);
      await this.files.delete(key);
    }
  }

  async list(options = {}) {
    const prefix = options.prefix ?? '';
    const limit = Math.min(options.limit ?? 1000, 1000);
    const { blobs } = await this.files.list({ prefix });
    const keys = blobs.map((b) => b.key).sort();
    const start = options.cursor ? Number(options.cursor) : 0;
    const page = keys.slice(start, start + limit);
    const objects = [];
    for (const key of page) {
      const m = await this._meta(key);
      if (m) objects.push(objectInfo(key, m.meta, m.etag));
    }
    const truncated = start + limit < keys.length;
    return { objects, truncated, cursor: truncated ? String(start + limit) : undefined, delimitedPrefixes: [] };
  }

  createMultipartUpload(key, options = {}) {
    const uploadId = crypto.randomUUID();
    return Promise.resolve(this._upload(key, uploadId, options));
  }

  resumeMultipartUpload(key, uploadId) {
    return this._upload(key, uploadId, {});
  }

  _upload(key, uploadId, options) {
    const partKey = (n) => `${encodeURIComponent(key)}/${uploadId}/${n}`;
    const bucket = this;
    return {
      key,
      uploadId,
      async uploadPart(partNumber, value) {
        const bytes = await toBytes(value);
        const etag = crypto.randomUUID().replace(/-/g, '');
        await bucket.parts.set(partKey(partNumber), bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { metadata: { etag, size: bytes.byteLength, httpMetadata: options.httpMetadata ?? {} } });
        return { partNumber, etag };
      },
      async complete(uploaded) {
        const parts = [];
        let size = 0;
        let httpMetadata = options.httpMetadata;
        for (const p of [...uploaded].sort((a, b) => a.partNumber - b.partNumber)) {
          const m = await bucket.parts.getMetadata(partKey(p.partNumber), { consistency: 'strong' });
          if (!m || strip(m.metadata?.etag) !== strip(p.etag)) throw new Error(`Part ${p.partNumber} is missing or its etag does not match.`);
          parts.push({ blob: partKey(p.partNumber), size: m.metadata.size });
          size += m.metadata.size;
          httpMetadata ??= m.metadata.httpMetadata;
        }
        return bucket._write(key, new Uint8Array(0), { httpMetadata: httpMetadata ?? {} }, { size, multipart: { uploadId, parts } });
      },
      async abort() {
        const { blobs } = await bucket.parts.list({ prefix: `${encodeURIComponent(key)}/${uploadId}/` });
        for (const b of blobs) await bucket.parts.delete(b.key);
      },
    };
  }
}
