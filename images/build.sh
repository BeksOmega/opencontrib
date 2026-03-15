#!/usr/bin/env bash
set -euo pipefail

# Copy the system prompt into the image context before building
cp ../src/security/system-prompt.txt base/system-prompt.txt

docker build -t opencontrib-agent-image:latest ./base

echo "Built image. Pin it by digest with:"
echo "  docker inspect --format='{{index .RepoDigests 0}}' opencontrib-agent-image:latest"
