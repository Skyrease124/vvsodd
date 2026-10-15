# SkyData REA adapter image 1: rea-agents 6.5.0, dependencies pinned by package-lock integrity hashes.
# REA 6.5.0 requires a procps-compatible `ps` to own its analyzer process; it is copied (with its
# licence notice) from the digest-pinned Debian bookworm Node image instead of using apt at build time.
FROM node:24-bookworm@sha256:3d27e5c11e5786e309ec3e03f93ae536eb36e6e5eb3714d5eb3300a36157add0 AS procps
FROM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
COPY --from=procps /usr/bin/ps /usr/bin/ps
COPY --from=procps /lib/x86_64-linux-gnu/libproc2.so.0 /lib/x86_64-linux-gnu/libproc2.so.0
COPY --from=procps /usr/share/doc/procps/copyright /usr/share/doc/procps/copyright
WORKDIR /opt/rea
COPY package.json package-lock.json adapter.mjs ./
# Optional build secret `ca` only for networks that intercept TLS; tarballs are still checked against lockfile integrity.
RUN --mount=type=secret,id=ca,required=false if [ -f /run/secrets/ca ]; then export npm_config_cafile=/run/secrets/ca; fi \
 && npm ci --ignore-scripts --omit=dev --no-audit --no-fund && npm cache clean --force \
 && mkdir -p /opt/rea/licenses && cp node_modules/rea-agents/LICENSE /opt/rea/licenses/rea-agents-LICENSE && cp node_modules/rea-agents/third_party/evmole/LICENSE /opt/rea/licenses/evmole-LICENSE && cp node_modules/rea-agents/third_party/pwndbg/LICENSE.md /opt/rea/licenses/pwndbg-LICENSE.md && cp node_modules/rea-agents/licenses/nativeaot-parser-MIT.txt /opt/rea/licenses/ \
 && ps --version && test "$(node node_modules/rea-agents/scripts/rea.mjs --version)" = "6.5.0"
# request-deadline=1: the adapter accepts a bounded per-request time limit (60-330 s); without one it keeps 150 s.
# output-flush=1: the adapter exits only after its result is fully written (larger results were cut off at 64 KB).
LABEL org.skydata.rea.version="6.5.0" org.skydata.adapter.version="1" org.skydata.rea.request-deadline="1" org.skydata.rea.output-flush="1"
USER 1000:1000
ENTRYPOINT ["node","/opt/rea/adapter.mjs"]
