#!/usr/bin/env bash
set -e

echo "deploying database"

firebase deploy --only firestore:rules

echo "deploy complete!"
