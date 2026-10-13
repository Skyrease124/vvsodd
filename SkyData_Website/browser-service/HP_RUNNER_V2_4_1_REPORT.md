# HP browser startup patch — runner 2.4.1

The HP report shows Chrome exited before its debugging port was ready with SIGTRAP; cleanup succeeded. This does not identify the underlying Chrome error.

The read-only browser image previously inherited a home directory outside writable tmpfs and did not configure XDG paths. This patch sets HOME, XDG_CONFIG_HOME and XDG_CACHE_HOME beneath the existing disposable /tmp, creates those directories as uid 1000, and leaves isolation and network policy unchanged. Stagehand 4.2.1 discards Chrome stderr; a fixed wrapper now captures it within the container. A bounded, credential-redacted excerpt is returned in browser-selftest-report.txt on failure, along with cleanup phases.

No automatic retries, new paid services, provider changes or ZIP/REA execution changes. Rebuilding the browser image invalidates the existing image-bound self-test stamp. Run Prepare_Browser.cmd in a freshly extracted 2.4.1 folder. Existing pairing remains in the user profile.

Local validation: syntax checks, six existing browser-service tests plus diagnostic regression test, mocked HP browser contract and existing runner contract. Site production build. Real Chrome/Docker and Windows HP self-test are pending; the original HP self-test failed. This is a targeted likely startup correction, not a claim of confirmed root cause or operational browser execution.
