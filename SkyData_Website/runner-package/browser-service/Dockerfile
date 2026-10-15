FROM node:24.19.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/browser
COPY browser-service/package.json browser-service/package-lock.json ./
RUN npm ci --ignore-scripts
# Stagehand gives Chrome start-up plus loading its extension a fixed 60 s, which a slow HP did not meet (Chrome was up
# after 7 s; the extension handshake had not finished at 60 s). Allow 150 s; the build fails if the patch does not apply.
RUN sed -i 's/const STAGEHAND_INIT_TIMEOUT_MS = 6e4;/const STAGEHAND_INIT_TIMEOUT_MS = 15e4;/' node_modules/@browserbasehq/stagehand/dist/index.mjs \
 && grep -q 'const STAGEHAND_INIT_TIMEOUT_MS = 15e4;' node_modules/@browserbasehq/stagehand/dist/index.mjs
COPY browser-service/*.mjs ./
COPY browser-service/chromium-launch.sh ./
RUN chmod 755 /opt/browser/chromium-launch.sh
LABEL org.skydata.stagehand.version="4.2.1" org.skydata.browser.adapter="2" org.skydata.stagehand.init-timeout="150"
USER 1000:1000
ENV NODE_OPTIONS=--use-env-proxy \
    HOME=/tmp/chromium-home \
    XDG_CONFIG_HOME=/tmp/chromium-config \
    XDG_CACHE_HOME=/tmp/chromium-cache
ENTRYPOINT ["node","worker.mjs"]
