#!/usr/bin/env bash
# ============================================================================
# midia-mcp — Seal Secrets Script
# ============================================================================
# Generates SealedSecrets from a config.yaml file for safe GitOps storage.
#
# Prerequisites:
#   - kubeseal CLI installed (https://github.com/bitnami-labs/sealed-secrets)
#   - Access to the K8s cluster (or a local certificate)
#
# Usage:
#   ./scripts/seal-secrets.sh --config <config.yaml>
#
# Options:
#   --config <path>              Path to the config.yaml with secrets (REQUIRED)
#   --cert <path>                Path to local sealed-secrets certificate
#   --fetch-cert                 Fetch certificate from the cluster controller
#   --controller-name <name>     Sealed Secrets controller name (default: sealed-secrets)
#   --controller-namespace <ns>  Sealed Secrets controller namespace (default: kube-system)
#   --namespace <ns>             Target K8s namespace (default: ia-mcp)
#   --output-dir <path>          Output directory for sealed secrets (default: deploy/)
#
# Example:
#   ./scripts/seal-secrets.sh --config examples/sealed-secrets/tokens-production.yaml
#   ./scripts/seal-secrets.sh --config tokens.yaml --fetch-cert
#   ./scripts/seal-secrets.sh --config tokens.yaml --cert ./sealed-secrets-cert.pem
# ============================================================================

set -euo pipefail

# Defaults
CONFIG_FILE=""
CERT_FILE=""
FETCH_CERT=false
CONTROLLER_NAME="sealed-secrets"
CONTROLLER_NAMESPACE="kube-system"
NAMESPACE="mcp-arr"
OUTPUT_DIR="deploy"
SECRET_NAME="midia-mcp-config"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)        CONFIG_FILE="$2"; shift 2 ;;
    --cert)          CERT_FILE="$2"; shift 2 ;;
    --fetch-cert)    FETCH_CERT=true; shift ;;
    --controller-name)      CONTROLLER_NAME="$2"; shift 2 ;;
    --controller-namespace) CONTROLLER_NAMESPACE="$2"; shift 2 ;;
    --namespace)     NAMESPACE="$2"; shift 2 ;;
    --output-dir)    OUTPUT_DIR="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Validate
if [[ -z "$CONFIG_FILE" ]]; then
  echo "ERROR: --config is required."
  echo "Usage: $0 --config <path-to-config.yaml>"
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config file not found: $CONFIG_FILE"
  exit 1
fi

if ! command -v kubeseal &>/dev/null; then
  echo "ERROR: kubeseal is not installed."
  echo "Install: https://github.com/bitnami-labs/sealed-secrets#kubeseal"
  exit 1
fi

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "ERROR: Output directory not found: $OUTPUT_DIR"
  exit 1
fi

# Fetch certificate if requested
if [[ "$FETCH_CERT" == "true" ]]; then
  echo "Fetching certificate from sealed-secrets controller..."
  CERT_FILE=$(mktemp)
  kubeseal --fetch-cert \
    --controller-name="$CONTROLLER_NAME" \
    --controller-namespace="$CONTROLLER_NAMESPACE" \
    > "$CERT_FILE"
  echo "Certificate saved to: $CERT_FILE"
fi

# Build kubeseal args
SEAL_ARGS=()
if [[ -n "$CERT_FILE" ]]; then
  SEAL_ARGS+=(--cert "$CERT_FILE")
else
  SEAL_ARGS+=(--controller-name "$CONTROLLER_NAME")
  SEAL_ARGS+=(--controller-namespace "$CONTROLLER_NAMESPACE")
fi

echo ""
echo "============================================"
echo "  midia-mcp — Seal Secrets"
echo "============================================"
echo "  Config:    $CONFIG_FILE"
echo "  Namespace: $NAMESPACE"
echo "  Output:    $OUTPUT_DIR/"
echo "============================================"
echo ""

# Create K8s Secret from config.yaml, then seal it
echo "Sealing config.yaml → ${OUTPUT_DIR}/sealedsecret-config.yaml"

kubectl create secret generic "$SECRET_NAME" \
  --namespace="$NAMESPACE" \
  --from-file=config.yaml="$CONFIG_FILE" \
  --dry-run=client -o yaml \
  | kubeseal "${SEAL_ARGS[@]}" \
    --format yaml \
    --namespace="$NAMESPACE" \
  > "${OUTPUT_DIR}/sealedsecret-config.yaml"

echo ""
echo "SealedSecret generated successfully!"
echo ""
echo "  ${OUTPUT_DIR}/sealedsecret-config.yaml"
echo ""
echo "Next steps:"
echo "  1. kubectl apply -f ${OUTPUT_DIR}/sealedsecret-config.yaml"
echo "  2. The sealed-secrets controller will decrypt it into a Secret"
echo "  3. The deployment mounts it at /etc/midia-mcp/config.yaml"
echo ""
echo "You can safely commit the SealedSecret to git."

# Cleanup temp cert if fetched
if [[ "$FETCH_CERT" == "true" && -n "$CERT_FILE" ]]; then
  rm -f "$CERT_FILE"
fi
