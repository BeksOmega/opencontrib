FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    python3 python3-pip python3-venv \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir uv pytest

RUN npm install -g @anthropic-ai/claude-code

RUN mkdir -p /opencontrib
COPY system-prompt.txt /opencontrib/system-prompt.txt

WORKDIR /workspace
