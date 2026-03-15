# opencontrib Docker Base Images

Four language-specific Docker images that serve as the execution environment for agent containers and preflight containers.

## Images

| Image | Tag | Contents |
|---|---|---|
| `opencontrib-js-image` | `js` | Node.js LTS, npm, jest, vitest, mocha, ts-node, typescript, @anthropic-ai/claude-code |
| `opencontrib-py-image` | `py` | Python 3, pip, uv, pytest, Node.js, @anthropic-ai/claude-code |
| `opencontrib-rs-image` | `rs` | Rust (via rustup), cargo, build-essential, Node.js, @anthropic-ai/claude-code |
| `opencontrib-go-image` | `go` | Go 1.22, Node.js, @anthropic-ai/claude-code |

All images are based on `ubuntu:24.04` and include `git`, `curl`, and `ca-certificates`.

## Building

Run from the `images/` directory:

```bash
./build.sh
```

This copies the system prompt from `../src/security/system-prompt.txt` into each image context, then builds all four images.

## Updating digests.json after a rebuild

After building, record the pinned digest for each image:

```bash
docker inspect --format='{{index .RepoDigests 0}}' opencontrib-js-image:latest
docker inspect --format='{{index .RepoDigests 0}}' opencontrib-py-image:latest
docker inspect --format='{{index .RepoDigests 0}}' opencontrib-rs-image:latest
docker inspect --format='{{index .RepoDigests 0}}' opencontrib-go-image:latest
```

Update `digests.json` with the output. The Docker management module reads this file when pulling images at `init`/`sync` time. Always update digests after a rebuild.

## System prompt

`system-prompt.txt` is baked into each image at `/opencontrib/system-prompt.txt`. If the system prompt changes, all images must be rebuilt and `digests.json` updated — otherwise running containers will use the old prompt.

## API key handling

The Claude Code CLI inside the container does **not** receive `ANTHROPIC_API_KEY` via environment variable. The key is never injected into agent containers. The mechanism for delivering the key to the CLI will be finalized in P7/P11 — the current approach under consideration is a volume-mounted config file at `/root/.claude/` (the same volume used for persistent agent memory).
