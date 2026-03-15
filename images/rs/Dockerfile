FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates \
    build-essential \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Rust via rustup (non-interactive)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

RUN npm install -g @anthropic-ai/claude-code

RUN mkdir -p /opencontrib
COPY system-prompt.txt /opencontrib/system-prompt.txt

WORKDIR /workspace
