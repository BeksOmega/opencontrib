#!/usr/bin/env bash
set -euo pipefail

# Copy the system prompt into each image context before building
cp ../src/security/system-prompt.txt js/system-prompt.txt
cp ../src/security/system-prompt.txt py/system-prompt.txt
cp ../src/security/system-prompt.txt rs/system-prompt.txt
cp ../src/security/system-prompt.txt go/system-prompt.txt

docker build -t opencontrib-js-image:latest ./js
docker build -t opencontrib-py-image:latest ./py
docker build -t opencontrib-rs-image:latest ./rs
docker build -t opencontrib-go-image:latest ./go

echo "Built all images. Pin them by digest with:"
echo "  docker inspect --format='{{index .RepoDigests 0}}' opencontrib-js-image:latest"
