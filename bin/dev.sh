#!/bin/bash
# Use "$@" to pass all additional command line arguments to your script
pnpm exec ts-node --transpile-only app/src/cli.ts "$@"
