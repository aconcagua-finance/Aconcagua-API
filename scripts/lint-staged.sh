#!/usr/bin/env bash
set -e


echo "prettying staged files..."

prettier --write $@

echo "files are now pretty!"


echo "linting staged files..."

eslint --fix --cache --ext ts,tsx,js,jsx $@

echo "lint complete!"
