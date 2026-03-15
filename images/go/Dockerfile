FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Go (latest stable)
RUN curl -fsSL https://go.dev/dl/go1.22.linux-amd64.tar.gz | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:${PATH}"

RUN npm install -g @anthropic-ai/claude-code

RUN mkdir -p /opencontrib
COPY system-prompt.txt /opencontrib/system-prompt.txt

WORKDIR /workspace
