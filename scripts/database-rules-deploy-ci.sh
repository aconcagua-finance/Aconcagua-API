#!/usr/bin/env bash
set -e

echo "deploying database"

firebase deploy --only firestore:rules --project $FIREB_PROJECT_ID --token "$FIREBASE_TOKEN"

echo "deploy complete!"
