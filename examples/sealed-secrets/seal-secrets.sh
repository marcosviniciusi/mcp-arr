#!/usr/bin/env bash
# ============================================================================
# midia-mcp — Seal Secrets (example copy)
# ============================================================================
# This is a convenience copy of scripts/seal-secrets.sh.
# The canonical version lives at the project root: scripts/seal-secrets.sh
#
# Usage:
#   # From the project root:
#   ./scripts/seal-secrets.sh --config examples/sealed-secrets/tokens-dev.yaml
#   ./scripts/seal-secrets.sh --config examples/sealed-secrets/tokens-production.yaml
#
# See scripts/seal-secrets.sh for full documentation and options.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec "$PROJECT_ROOT/scripts/seal-secrets.sh" "$@"
