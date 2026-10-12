# SkyData Knowledge Core 1.0

## Scope shipped
Phases 1–2 add owner-private persistent documents, multipart originals, checkpointed extraction, batched NVIDIA embeddings, an indexed approximate semantic retriever with keyword fallback, document management, and grounded context for existing chat models. The existing chat UI and provider/model selection remain unchanged. Access is through Owner dashboard → Knowledge Core (`/knowledge`). No model weights are trained.

## Existing architecture and integration
- React 19 / Vinext, Cloudflare Worker entrypoint `build/sites-worker.ts`.
- Existing D1 (`DB`) stores relational metadata and float32 vectors; existing R2 (`FILES`) stores original documents. No replacement database or additional external credentials.
- Existing owner/member authorization is preserved. Knowledge management endpoints additionally verify owner identity. Retrieval always filters by the current authenticated user, so members cannot retrieve the owner's documents. All original/download/view endpoints require owner access.
- Existing encrypted NVIDIA key is read server-side. Embeddings use `nvidia/nemotron-3-embed-1b` at NVIDIA's `/v1/embeddings`, passage mode for indexing and query mode for searching. Provider access is checked on the first real indexing request, not assumed. The dashboard surfaces rejected keys and endpoint failures. Embedding calls remain subject to NVIDIA availability, allowance and terms.
- `lib/nvidia.ts` retrieves at most six excerpts / 10,000 characters for an eligible question. Interpreter and debate modes are unchanged. No ready documents means no embedding inference. Search failure does not fail chat; the model is told not to claim it read private sources.

## Persistence / jobs
Schema and immutable migration: `db/schema.ts`, `drizzle/0010_wise_loa.sql`.
Tables cover documents, upload parts, idempotent extraction batches, chunks, vector buckets and token indexes. Foreign keys cascade deletes. Original files are streamed from R2 and support byte ranges. Deletion first disables a document, removes its original, then cascades its index; an interrupted deletion can be retried.

Extraction happens asynchronously in the browser, using PDF.js's real worker for PDF parsing and fflate's async decompression for DOCX. PDF text is read page by page via authenticated range requests. DOCX paragraphs and heading styles are retained; text/code/JSON retain text structure. Non-PDF batches are 40,000 characters; server chunking caps passages at 1,800 characters with overlap for long paragraphs. PDF page numbers are retained in every chunk and citation. There is no OCR in this release: empty pages are counted and displayed. Encrypted or malformed PDFs surface extraction errors.

Checkpointed work continues only while the Knowledge Core page is open (plus the current bounded server batch after it closes). This deployment does not provide an unattended queue worker. Reopening the dashboard resumes indexing automatically; use Resume processing for interrupted extraction. The saved original means extraction resume does not require uploading the file again. Incomplete original uploads can be deleted and uploaded again. No claim of indefinite background processing is made.

Indexing uses leased D1 jobs, eight passages per NVIDIA call, retry backoff and a five-failure stop with manual retry. Vectors and per-chunk indexes are written transactionally. Expired leases recover interrupted jobs. A document is searchable only when all its chunks are indexed and it is enabled.

## Retrieval
D1 is used as a persistent vector store with application-level cosine search, not as native pgvector. Small libraries (up to 600 indexed chunks) use exact cosine ranking. Larger libraries use eight indexed random-projection bucket tables with one-bit multiprobe retrieval (400 candidates), combined with indexed keyword candidates (100), then cosine/lexical reranking. Memory and context are bounded. This approximate index can miss relevant passages at scale; retrieval recall is not yet benchmarked on the user's real library. The schema stores the embedding model per chunk and can be migrated to a dedicated vector service later without changing document IDs or citation URLs.

Uploaded sources are labeled unreviewed by default. Owner reviewed is an explicit personal review label, not factual verification. Document contents are delineated as untrusted reference data. No uploaded content executes commands or changes system instructions. Duplicate extraction submissions use hashes and are idempotent; identical excerpts are deduplicated within search results. Full-document content deduplication is not implemented.

## Limits
- 100 documents / 1 GiB original file storage per owner.
- 100 MiB per file, 5,000 PDF pages, 50,000 chunks per document.
- DOCX: 25 MiB archive, 16 MiB uncompressed main XML.
- UTF-8 text source files; no binary code execution.
- No vector DB subscription or rented GPU required. Existing hosting limits still apply.

## Verification
`scripts/test-knowledge.mjs` runs against real SQLite with all project migrations, deterministic NVIDIA and R2 doubles. It verifies owner isolation, cross-origin rejection, uploads, idempotent/out-of-order extraction, a 1,001-page checkpoint sequence, lease exclusion, retries, retrieval modes, source citations, document exclusion and cascade deletion. It does not validate live NVIDIA access or actual scanned-book OCR. TypeScript and production build are additional gates. Existing Blender regression checks are retained and run because shared owner/auth imports are used.

## Not implemented in this release
Autonomous internet acquisition, scheduled crawling, full source fact-checking, concept graphs, isolated code execution, verified coding experience memory, and coding performance analytics are later phases. Knowledge count is not an intelligence metric. No synthetic scores or fabricated verified solutions are shown.
