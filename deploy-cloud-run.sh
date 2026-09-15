#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="YOUR_GCP_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="assemblyai-voice-agent"
SECRET_NAME="assemblyai-api-key"

gcloud auth login
gcloud config set project "$PROJECT_ID"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

# Create the secret once. Input is hidden and is not saved in shell history.
if ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  read -rsp "AssemblyAI API key: " ASSEMBLYAI_KEY
  echo
  printf '%s' "$ASSEMBLYAI_KEY" |
    gcloud secrets create "$SECRET_NAME" \
      --replication-policy="automatic" \
      --data-file=-
  unset ASSEMBLYAI_KEY
fi

# Cloud Run's runtime identity needs permission to read the secret.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" \
  --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Build from the Dockerfile and deploy publicly.
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="ASSEMBLYAI_API_KEY=${SECRET_NAME}:latest" \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=40 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format='value(status.url)')"

printf '\nDeployed: %s\nHealth: %s/health\n' \
  "$SERVICE_URL" "$SERVICE_URL"