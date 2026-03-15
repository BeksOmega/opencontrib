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

## Authentication

The Claude Code CLI authenticates via OAuth (subscription), not API key. Credentials live in `~/.claude/` on the host after `claude login` and must reach the container without bind-mounting the host filesystem.

**Agreed approach (to be implemented in P4):** a dedicated shared named volume (`opencontrib-credentials`) is populated at `init` time from the host's `~/.claude/` credentials and mounted into every container at `/root/.claude/`. Per-repo agent memory (CLAUDE.md notes, etc.) lives in a separate per-repo volume mounted at a subpath (e.g. `/root/.claude/projects/<owner>/<repo>/`). OAuth tokens refresh in-place inside the shared volume so all containers stay current.

`ANTHROPIC_API_KEY` is never injected into agent containers.
