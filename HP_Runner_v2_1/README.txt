SKYDATA RUNNER v2.1 - DOCKER STARTUP WAIT REPAIR

Stop old Start_Runner with Ctrl+C. Extract this ZIP to a NEW folder.
Keep Docker Desktop running. Double-click Self_Test in this new folder.
Docker readiness and image checks allow 60 seconds each, cleanup 30 seconds.
Actual code execution still has a 10-second limit.
Self_Test now also checks a two-file project import inside Docker.
If all four checks pass, open Start_Runner and retry the sample project.
Your existing pairing stays in your Windows profile; do not pair again.
If a check fails, the window now identifies the command and error.

SKYDATA HP RUNNER - PROJECT TESTS (VERSION 2)

UPDATE YOUR EXISTING RUNNER
1. In the old black runner window, press Ctrl+C.
2. Extract this ZIP into a new folder. Do not launch it inside the ZIP.
3. Double-click Start_Runner.cmd in the extracted folder.
Your existing pairing stays in your Windows user profile. You do not need
Pair_Runner unless the connection has expired or been disconnected.
Keep Docker Desktop running with Linux containers and node:24-alpine cached.

PROJECT TESTS
1. Open https://skydata-ai.skyrease123.chatgpt.site/engineering/runner
2. Upload a project ZIP or choose a saved ZIP. Select Project files.
3. Review the available complete files and choose the JavaScript test entry.
4. Check the authorization box and click Send test to HP.
5. Switch to the black runner window, review ALL displayed files, type yes,
   and press Enter within 10 minutes. The website shows the reported result.

You can also upload ZIPs directly in Engineering Mode for AI analysis.
Analysis uses selected source excerpts and cannot execute tests or edit files.
No project access is inferred from your chat; you must upload/select it.

PROJECT LIMITS
100 selected files / 400 KB of complete source. A single JavaScript test
entry runs using node --test with relative imports into selected files.
Select all required source and JSON files. Missing packages/imports cause
real test failures; there is no package installation or package-script run.
Incomplete indexed files, assets, dependency directories, unsupported paths
and filenames identified as credentials are excluded. Inspect source for
secrets before authorizing. This is not a whole-project build service.

Original ZIPs and HP folders remain unchanged. Source copies exist only in
an isolated container tmpfs; no host folders are mounted. No provider keys
are supplied and containers have no network. Limits remain 256 MB RAM,
one CPU, 64 processes, read-only root, non-root user, dropped capabilities,
60 KB output and a 10-second execution timeout (internal test runner 8 sec).
Containers are removed after the request. Pairing expires after seven days.
Docker isolation is not a guarantee against every possible container escape.

Self_Test.cmd checks passing/failing snippets and a timeout. Stop polling
with Ctrl+C. Disconnect HP on the website revokes the connection token.
Keep the connection file in your user profile private; never share it.

This version has authoring checks for project payloads, imports, real Node
fixtures, owner/R2 access and server integration. Its live Docker project
test still needs to be verified on your HP after the website update.
