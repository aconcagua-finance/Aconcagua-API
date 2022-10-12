#!/usr/bin/env bash
set -e

echo "testing..."

jest $@ --expand --setupFiles dotenv/config

echo "test complete!"

