#!/usr/bin/env bash
set -e

echo "preparing for commit..."

npm run build
npm run test

git add -A

lint-staged


echo "preparing for commit complete!"
