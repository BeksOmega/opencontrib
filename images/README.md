# opencontrib Docker Image

A single agent image covering JavaScript, TypeScript, and Python — the languages that make up the vast majority of targeted open source repos. Rust and Go support is deferred until there's demand.

## What's in the image

Base: `ubuntu:24.04`

| Tool | Purpose |
|---|---|
| `git` | Required by the preflight container and for git operations run by the orchestrator |
| `node` / `npm` (LTS) | JS/TS runtime |
| `typescript`, `ts-node` | TypeScript support |
| `jest`, `vitest`, `mocha` | JS/TS test runners |
| `python3`, `pip`, `venv` | Python runtime |
| `uv`, `pytest` | Python package management and testing |
| `@anthropic-ai/claude-code` | The agent CLI run inside each container |

## Building

Run from the `images/` directory:

```bash
./build.sh
```

This copies `../src/security/system-prompt.txt` into the build context and builds the image as `opencontrib-agent-image:latest`.

## Updating digests.json after a rebuild

After building, record the pinned digest:

```bash
docker inspect --format='{{index .RepoDigests 0}}' opencontrib-agent-image:latest
```

Update `digests.json` with the output. The Docker management module reads this file when pulling the image at `init`/`sync` time. Always update after a rebuild.

## System prompt

`system-prompt.txt` is baked into the image at `/opencontrib/system-prompt.txt`. If the system prompt changes, the image must be rebuilt and `digests.json` updated — otherwise running containers will use the old prompt.

## API key handling

The Claude Code CLI inside the container does **not** receive `ANTHROPIC_API_KEY` via environment variable. The key is never injected into agent containers. The delivery mechanism will be finalized in P7/P11 — the current approach under consideration is a volume-mounted config file at `/root/.claude/` (the same volume used for persistent agent memory).
