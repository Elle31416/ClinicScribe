SERVICE_NAME="assemblyai-voice-agent"
REGION="us-central1"

gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --update-env-vars="GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com,ALLOWED_GOOGLE_EMAILS=you@example.com"