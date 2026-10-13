FROM node:24.19.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/browser
COPY browser-service/package.json browser-service/package-lock.json ./
RUN npm ci --ignore-scripts
COPY browser-service/*.mjs ./
COPY browser-service/chromium-launch.sh ./
RUN chmod 755 /opt/browser/chromium-launch.sh
LABEL org.skydata.stagehand.version="4.2.1" org.skydata.browser.adapter="2"
USER 1000:1000
ENV NODE_OPTIONS=--use-env-proxy \
    HOME=/tmp/chromium-home \
    XDG_CONFIG_HOME=/tmp/chromium-config \
    XDG_CACHE_HOME=/tmp/chromium-cache
ENTRYPOINT ["node","worker.mjs"]
