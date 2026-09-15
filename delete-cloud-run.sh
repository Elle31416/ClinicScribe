#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="YOUR_GCP_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="assemblyai-voice-agent"

gcloud config set project "$PROJECT_ID"
gcloud run services delete "$SERVICE_NAME" \
  --region "$REGION" \
  --quiet

echo "Deleted Cloud Run service: $SERVICE_NAME"