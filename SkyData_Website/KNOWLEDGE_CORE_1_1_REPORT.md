# SkyData Knowledge Core 1.1 implementation report

## Confirmed root causes

The PDF extractor already used physical one-based PDF pages (`getPage(n)`). The response generator was allowed to write unchecked citation IDs and page numbers. Rank-based K1/K2 identities changed between requests, all retrieved sources were displayed whether cited or not, and the original-PDF link had no page fragment.

The actual uploaded textbook sample establishes:

| PDF file page | Printed book page | Content |
|---|---|---|
| 229 | 208 | Namespace example namesp1.cpp |
| 231 | 210 | Using declarations/directives |
| 252 | 231 | Pointer definition: address and type |
| 15 | xiv | Contents listing namespaces at printed page 208 |

The screenshot's pointer reference `[K1, p.231]` conflicted with the K1 button's PDF page 252. Its K4 reference confused a contents listing with the namespace passage. This is evidence of mixed page conventions and unchecked generated labels, not evidence that every stored chunk page was wrong.

## Changes

- `lib/knowledge-citations.ts`: stable chunk-derived IDs; allowlist validation; backend-generated labels/links; rejection of unknown references and forged document links; only actually cited source buttons.
- `lib/knowledge.ts`: explicit source boundaries and physical-page terminology; hybrid semantic/keyword ranking; boilerplate query terms removed; stronger evidence threshold; contents-only passages excluded; invalid PDF locations excluded; owner-only read-only integrity audit and exact-text location verification.
- `lib/knowledge-upload.ts`: preserve PDF page labels separately; original-PDF verification in bounded page batches.
- `lib/nvidia.ts`, `lib/stream-reply.ts`: validate completed document-grounded output before displaying it. Ordinary chat still streams. No NVIDIA model IDs, selected/default model, provider endpoint, or API credential configuration changed.
- `app/knowledge/page.tsx`: existing source viewer retains its layout; explicit PDF-page labels and per-passage original-PDF page links; owner-triggered page verification.
- `db/schema.ts`, `drizzle/0011_curvy_kulan_gath.sql`, migration journal/snapshot: additive location columns only.
- `scripts/test-knowledge.mjs`, `scripts/test-knowledge-citations.mjs`, `scripts/test-knowledge-stream.mjs`: retrieval, location, backups, citations and streaming regression tests.

## Database preservation and repair

The migration adds nullable zero-based `page_index`, one-based `page_end`, `page_label`, `printed_page`, and location status (legacy by default). Existing documents, text, vectors and IDs are retained; no embeddings are regenerated. New PDF extraction verifies checkpoint number against physical page. Each chunk remains within one page, so page end equals its start.

Printed page remains unknown unless reliably established; a PDF page label is not automatically treated as a printed book number.

“Verify PDF page locations” reads the existing original PDF. The server compares exact chunk-text hashes at the same recorded physical page, stores prior location fields in a private R2 repair snapshot before updating metadata, and marks matching records `text-matched`. Backup failure prevents updates. Unmatched or ambiguous records are reported and never forcibly moved. This operation is idempotent in location outcome but creates a fresh backup on each successful check. It requires keeping the page open and can be resumed by rerunning.

## Tests and evidence

Passed locally:

- All SQLite migrations, private access, origin restrictions, upload checkpoints, 1,001-page simulated extraction, indexing retries/leases, semantic and keyword retrieval, exclusions, cascading deletion.
- Five requested retrieval scenarios on **eight actual extracted textbook pages**: pointers, namespaces, comparison with separate passages, namesp1.cpp code example, absent invented topic. Tests inspect actual supporting text, physical page metadata and exact-chunk destination. Keyword retrieval used for these real-text cases; NVIDIA embeddings are mocked for indexing.
- Citation tests: stable identity under rank changes, incorrect prose page replacement, unknown IDs rejected, unused sources omitted, multiple same-document citations, chunk-link identity.
- Location checks: page label kept separate from printed number; backup before update; backup failure prevents change; mismatch does not overwrite physical page; owner-only audit.
- Streaming: document output withheld until validation; ordinary replies still stream; selected model preserved.
- TypeScript check and production build (see deployment result).

No failed local regression assertions remained at publication.

## Limits and checks not claimed

Production owner-authenticated knowledge records and live NVIDIA generation were not accessible in the execution session. The live database integrity audit and owner-triggered verification must run under the owner's normal login. No production document records were read or repaired in this session.

The materialized textbook copy has a malformed/zero-filled region reported by PDF readers; pypdf recovered the eight early source pages used above. Full-book extraction, every PDF page, original R2 byte integrity and full-book no-evidence behavior are not certified by this sample.

Citation identity/location validation establishes that a reference came from retrieved metadata. It does **not** prove arbitrary model claims are semantically entailed. The tests verify selected concrete statements; there is no universal claim verifier or invented accuracy score.

The server logs measured search latency, candidate/hit counts and citation validation outcomes, without document text or owner identifiers. Processing failures remain in existing document error records. Metrics are logs/read-only audit, not a fabricated dashboard percentage.

PDF `#page=` navigation depends on the browser's PDF viewer; some iPhone viewers ignore it. The authenticated source viewer still opens the exact chunk and supporting excerpt. No native mobile device/browser navigation test was available. Passage highlighting inside a native PDF viewer is not implemented.

Source filtering remains owner/enabled/ready/model/location based. This release does not introduce a paid reranker, new embedding service, full-document reindex, OCR, automated printed-page inference, or automatic relocation of ambiguous records. Old saved chat text is retained; newly generated citations use the new validator.
