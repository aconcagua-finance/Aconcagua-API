#!/usr/bin/env bash
set -e

echo "deploying database"

firebase deploy --only storage:rules

echo "deploy complete!"
