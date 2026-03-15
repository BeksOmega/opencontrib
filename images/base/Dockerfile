FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Node.js (LTS via NodeSource)
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python tooling
RUN pip3 install --no-cache-dir uv pytest

# JS/TS tooling + Claude Code CLI
RUN npm install -g \
    @anthropic-ai/claude-code \
    jest \
    vitest \
    mocha \
    ts-node \
    typescript

# System prompt location
RUN mkdir -p /opencontrib
COPY system-prompt.txt /opencontrib/system-prompt.txt

WORKDIR /workspace
