# Build only on the separate execution host. Pin the resulting image digest before testing.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends g++ python3 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY inside.py /opt/skydata/inside.py
USER 65532:65532
WORKDIR /work
ENTRYPOINT ["/usr/bin/python3","-I","/opt/skydata/inside.py"]
