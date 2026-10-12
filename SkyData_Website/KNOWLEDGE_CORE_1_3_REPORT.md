# SkyData Knowledge Core 1.3 — implementation and test report

Implemented an owner-only, explicitly triggered Decisions evidence test bench. Chat responses are never automatically rewritten or blocked by this reviewer. No NVIDIA model or default configuration changed. No database migration, document deletion, reindex, or embedding regeneration was performed. Rollback target: deployed version 79, commit 692163f4f60f74271281e335238f44b0f22a8698.

## Existing integration
The direct OpenAI connection uses POST https://api.openai.com/v1/decisions, model gpt-6-luna. Authentication reuses readKey(env, 'OPENAI_API_KEY'), which reads server environment or AES-GCM encrypted D1 storage. The separate OpenRouter debate integration is unchanged. Decisions supports fixed-choice answers; the reviewer uses those three labels, not generated explanations or an invented tool capability.

## Changes
- lib/knowledge-ranking.ts: query concepts, exact terminology, semantic/lexical reciprocal rank fusion, introductory versus advanced relevance, deduplication, bounded context and multiple-concept coverage.
- lib/knowledge.ts: ranking integration, owner-scoped query embedding cache, fresh source lookup, citation navigation 404 for missing excerpts, private test route.
- lib/knowledge-decision-review.ts: bounded batch evaluation, independent owner/document/page metadata checks, strict response validation, three evidence labels, real usage/latency measurements, private R2 run reports, six requests/minute protection. Missing source records are not sent to OpenAI. Metadata validity does not prove passage support. Existing PDF text matching remains a separate check.
- app/knowledge/evidence-tests.tsx and page.tsx: small dashboard test panel using existing styles. Paste a cited Markdown answer to extract paragraph/citation pairs, or enter one claim and source chunk. Expected labels are user supplied; unlabeled runs have no accuracy score. One explicit click invokes one paid batch. Last report can be loaded without inference.
- lib/secret-store.ts: optional retrieval threshold configuration; secrets unchanged.
- lib/stream-reply.ts: accepts asynchronous finalizers; current chat behavior preserved.
- lib/knowledge-evidence.ts: experimental offline evaluator, not wired to production chat.
- scripts: real-text fixture preparation, ranking/evidence regression tests, Decisions contract tests and existing model request contract tests.

## Root cause and evidence
Previous retrieval relied on broad overlap and similarity without sufficient query intent or passage role ranking. Definition questions could rank examples or advanced pointer usages above introductory definitions. Correct PDF destinations alone did not establish claim support. The new ranker selects PDF 252 for pointer definitions, namespace evidence around PDF 230, and PDF 592 for pointers to abstract classes. PDF 384 remains legitimate for returning pointers. Titles alone are not used to reject passages.

## Actual tests
TypeScript compilation passed. SQLite integration tests passed for all existing migrations, owner isolation, origin protection, uploads, indexing, retries, deletion, metadata backups, exact chunk navigation and actual-text retrieval. The chat test confirms one generation request and zero inline evidence-review calls. Five available model request contracts passed using provider stubs; live provider availability is not asserted.

Regression tests use 14 recovered pages from the supplied C++ PDF (physical pages 15, 28, 30, 229–231, 251–254, 326, 384, 592–593). Pointer, namespace, comparison, abstract-class, dereference, unsupported-topic and unrelated-real-page checks passed. Citation destinations were checked against fixture chunk/document/page records, not by clicking a production browser.

Decisions contract tests passed for correct/incorrect/contradictory/unsupported claim fixtures, missing source, malformed answers, timeout, missing key and false-approval accounting. The five model labels were deterministic stubs. These successes establish application behavior, not OpenAI verification accuracy.

## Calls, costs and metrics
Actual live OpenAI/NVIDIA calls for these tests: **0**. The authenticated owner's saved runtime key is not accessible in this checkout, and no owner session was impersonated. Therefore live accuracy, false approval/rejection rates, provider latency and actual billing remain unmeasured. The dashboard records real results when the owner starts tests. API errors/refusals remain unassessed, never counted as correct. Private report storage failures return an error and may occur after a paid call; avoid automatic retry.

Decisions base pricing from official documentation is $0.10 per million input tokens; the application estimates cost only when actual input token usage is returned. For illustration, 1,000 input tokens cost $0.0001 at that base rate. Regional/long-context premiums and authoritative billing can differ. No output charge is assumed for this endpoint. Documentation: https://developers.openai.com/api/docs/guides/decisions

## Remaining limits and next validation
Run owner-triggered tests with independently labeled claims from actual stored excerpts. Include separate claims for definitions, namespace scope, abstract classes, contradicted statements, unrelated pages and missing IDs. Review the source text yourself; model approval is not proof. Paragraph extraction is conservative and can contain multiple assertions; complex answers should be tested as individual claims. Inline chat review remains disabled until representative live tests establish acceptable false approval/rejection behavior.

The supplied PDF copy has malformed object-stream warnings; target passages were recovered, but full-book extraction correctness is not certified. No production PDF click/mobile browser check or live NVIDIA model availability test was performed. Existing chat layout, model list, default model, PDF links, documents and database configuration remain unchanged in source. Existing production records were not mutated during development.
