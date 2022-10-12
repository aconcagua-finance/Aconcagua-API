#!/usr/bin/env bash
set -e

echo "linting..."

npm run prettier
eslint . --fix --cache --ext ts,tsx,js,jsx

# tslint -p tsconfig.json

echo "lint complete!"
