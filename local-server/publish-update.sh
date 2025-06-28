#!/bin/bash

# This script publishes an update to a multi-app Expo update server.
# It automatically detects the app slug from app.json and handles the complete workflow.

# --- Configuration ---
# Set these environment variables in your CI/CD environment or export them locally.
RELEASECHANNEL="${RELEASECHANNEL:-production}"
APISERVER="${APISERVER:-https://expo-update-server.expo-quickpush.workers.dev}"
UPLOADKEY="${UPLOADKEY:-1234567890}"
PROJECTPATH="${PROJECTPATH:-.}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    printf "${BLUE}ℹ️  $1${NC}\n"
}

log_success() {
    printf "${GREEN}✅ $1${NC}\n"
}

log_warning() {
    printf "${YELLOW}⚠️  $1${NC}\n"
}

log_error() {
    printf "${RED}❌ $1${NC}\n"
}

###############################################################################
# 1. Check that all the required parameters are present.
###############################################################################

log_info "Checking configuration..."

# Checking Release Channel
if [ -z "$RELEASECHANNEL" ]; then
    log_error "Missing RELEASECHANNEL variable for release channel."
    exit 1
fi

# Checking API Server URL
if [ -z "$APISERVER" ]; then
    log_error "Missing APISERVER variable."
    exit 1
fi

# Checking Upload Key
if [ -z "$UPLOADKEY" ]; then
    log_warning "Missing UPLOADKEY variable. Continuing without an upload key."
fi

# Navigate to project directory
cd "$PROJECTPATH" || {
    log_error "Failed to navigate to project path: $PROJECTPATH"
    exit 1
}

log_success "Configuration validated"

###############################################################################
# 2. Prepare the project and extract app information.
###############################################################################

log_info "Preparing project and extracting app information..."

# Optional: Generate app.json from app.config.ts/js
if [ -f "app.config.ts" ] || [ -f "app.config.js" ]; then
    log_info "Generating app.json from app.config..."
    npx expo config --json > app.json || {
        log_error "Failed to generate app.json from app.config"
        exit 1
    }
    GENERATED_APP_JSON=true
else
    GENERATED_APP_JSON=false
fi

# Ensure app.json exists
if [ ! -f "app.json" ]; then
    log_error "app.json not found in $(pwd)"
    log_error "Make sure you have either app.json or app.config.ts/js in your project"
    exit 1
fi

# Extract app information from app.json using more robust parsing
SLUG=$(node -pe "JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.slug" 2>/dev/null)
RUNTIMEVERSION=$(node -pe "JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.runtimeVersion || JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.sdkVersion || '1.0.0'" 2>/dev/null)

# Fallback to grep if node parsing fails
if [ -z "$SLUG" ]; then
    SLUG=$(grep -o '"slug": "[^"]*' app.json | grep -o '[^"]*$' | tail -1)
fi

if [ -z "$RUNTIMEVERSION" ]; then
    RUNTIMEVERSION=$(grep -o '"runtimeVersion": "[^"]*' app.json | grep -o '[^"]*$' | tail -1)
    if [ -z "$RUNTIMEVERSION" ]; then
        RUNTIMEVERSION=$(grep -o '"sdkVersion": "[^"]*' app.json | grep -o '[^"]*$' | tail -1)
    fi
fi

# Validate extracted information
if [ -z "$SLUG" ]; then
    log_error "Could not extract 'slug' from app.json"
    log_error "Make sure your app.json has expo.slug defined"
    exit 1
fi

if [ -z "$RUNTIMEVERSION" ]; then
    log_warning "Could not extract runtimeVersion from app.json, using default: 1.0.0"
    RUNTIMEVERSION="1.0.0"
fi

# Set PROJECT to SLUG for the multi-app server
PROJECT=$SLUG

log_success "App information extracted:"
log_info "  Project/Slug: $PROJECT"
log_info "  Runtime Version: $RUNTIMEVERSION"
log_info "  Release Channel: $RELEASECHANNEL"
log_info "  API Server: $APISERVER"

###############################################################################
# 3. Check if app is registered on server.
###############################################################################

log_info "Checking if app is registered on server..."

# Check if app exists and has certificate configured
APPS_RESPONSE=$(curl -s "$APISERVER/apps" 2>/dev/null)

# Try to use jq for robust JSON parsing, fallback to grep
if command -v jq >/dev/null 2>&1; then
    # Use jq for reliable JSON parsing
    APP_EXISTS=$(echo "$APPS_RESPONSE" | jq -r --arg slug "$PROJECT" '.apps[]? | select(.slug == $slug) | .slug' 2>/dev/null)
    if [ "$APP_EXISTS" = "$PROJECT" ]; then
        APP_REGISTERED=true
    else
        APP_REGISTERED=false
    fi
else
    # Fallback to grep with flexible whitespace matching
    if echo "$APPS_RESPONSE" | grep -q "\"slug\"[[:space:]]*:[[:space:]]*\"$PROJECT\""; then
        APP_REGISTERED=true
    else
        APP_REGISTERED=false
    fi
fi

if [ "$APP_REGISTERED" = true ]; then
    log_success "App '$PROJECT' is registered on server"
    
    # Check if certificate is configured
    CERT_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$APISERVER/certificate/$PROJECT")
    if [ "$CERT_CHECK" = "200" ]; then
        log_success "Certificate is configured for app '$PROJECT'"
    else
        log_warning "Certificate not configured for app '$PROJECT'"
        log_warning "You may need to upload a certificate for code signing"
        log_info "Run: curl -X PUT $APISERVER/apps/$PROJECT/certificate -H 'Content-Type: application/json' -d '{\"certificate\": \"...\", \"privateKey\": \"...\"}'"
    fi
else
    log_warning "App '$PROJECT' is not registered on server"
    log_info "To register your app, run:"
    log_info "  curl -X POST $APISERVER/register-app -H 'Content-Type: application/json' -d '{\"slug\": \"$PROJECT\"}'"
    log_info ""
    log_info "Continuing with upload anyway..."
fi

###############################################################################
# 4. Build and prepare the update bundle.
###############################################################################

log_info "Building update bundle..."

# Define build paths
BUILDFOLDER="temp_build_dir"
ZIPFILE_NAME="$SLUG-$RUNTIMEVERSION-$RELEASECHANNEL.zip"
ZIPFILE_PATH="$(pwd)/$ZIPFILE_NAME"

# Idempotent cleanup of previous runs
rm -rf "$BUILDFOLDER"
rm -f "$ZIPFILE_NAME"

# Build the update using `expo export`
log_info "Exporting update with expo export..."
if ! npx expo export --platform all --output-dir "$BUILDFOLDER" --experimental-bundle; then
    log_error "Failed to export Expo update"
    exit 1
fi

# Ensure package.json exists for dependencies
if [ ! -f "package.json" ]; then
    log_error "package.json not found in project root"
    exit 1
fi

# Add app.json & package.json to the build for the server to parse
cp app.json "$BUILDFOLDER/" || {
    log_error "Failed to copy app.json to build folder"
    exit 1
}

cp package.json "$BUILDFOLDER/" || {
    log_error "Failed to copy package.json to build folder"
    exit 1
}

# Compress the entire build folder into a zip file
log_info "Compressing update bundle..."
cd "$BUILDFOLDER" || {
    log_error "Failed to navigate to build folder"
    exit 1
}

if ! zip -q -r "$ZIPFILE_PATH" .; then
    log_error "Failed to create zip file"
    cd - > /dev/null
    exit 1
fi

cd - > /dev/null

log_success "Update bundle prepared: $ZIPFILE_NAME"

###############################################################################
# 5. Upload the bundle to the server.
###############################################################################

log_info "Uploading update to $APISERVER/upload..."

# Prepare headers
HEADERS=(
    --header "project: $PROJECT"
    --header "version: $RUNTIMEVERSION"
    --header "release-channel: $RELEASECHANNEL"
)

# Add upload key if provided
if [ -n "$UPLOADKEY" ]; then
    HEADERS+=(--header "upload-key: $UPLOADKEY")
fi

# Add git information if available
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    GIT_COMMIT=$(git log --oneline -n 1 2>/dev/null || echo "unknown")
    HEADERS+=(--header "git-branch: $GIT_BRANCH")
    HEADERS+=(--header "git-commit: $GIT_COMMIT")
fi

# Upload the file
UPLOAD_RESPONSE=$(curl --silent --location --request POST "$APISERVER/upload" \
    --form "uri=@$ZIPFILE_PATH" \
    "${HEADERS[@]}")

# Parse response with improved logic
if echo "$UPLOAD_RESPONSE" | grep -q '"uploadId"'; then
    # Try jq first for robust parsing
    if command -v jq >/dev/null 2>&1; then
        UPLOAD_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.uploadId' 2>/dev/null)
        UPDATE_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.updateId' 2>/dev/null)
    else
        # Fallback to grep
        UPLOAD_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"uploadId"[[:space:]]*:[[:space:]]*"[^"]*' | grep -o '[^"]*$')
        UPDATE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"updateId"[[:space:]]*:[[:space:]]*"[^"]*' | grep -o '[^"]*$')
    fi
    
    if [ -n "$UPLOAD_ID" ] && [ -n "$UPDATE_ID" ]; then
        log_success "Upload successful!"
        log_info "  Upload ID: $UPLOAD_ID"
        log_info "  Update ID: $UPDATE_ID"
        
        # Show release command
        log_info ""
        log_info "To release this update, run:"
        log_info "  curl -X PUT $APISERVER/release/$UPLOAD_ID"
        log_info ""
        log_info "Or use this one-liner to release immediately:"
        log_info "  curl -X PUT $APISERVER/release/$UPLOAD_ID && echo 'Update released!'"
    else
        log_warning "Upload response detected but couldn't parse IDs"
        log_warning "Upload ID: '$UPLOAD_ID', Update ID: '$UPDATE_ID'"
        log_warning "Raw response: $UPLOAD_RESPONSE"
    fi
    
else
    log_error "Upload failed!"
    log_error "Server response: $UPLOAD_RESPONSE"
fi

###############################################################################
# 6. Cleanup temporary files.
###############################################################################

log_info "Cleaning up temporary files..."

# Remove build folder and zip file
rm -rf "$BUILDFOLDER"
rm -f "$ZIPFILE_PATH"

# Optional: remove the generated app.json
if [ "$GENERATED_APP_JSON" = true ]; then
    rm -f app.json
    log_info "Removed generated app.json"
fi

log_success "Cleanup complete"

###############################################################################
# 7. Summary and next steps.
###############################################################################

echo ""
log_success "Publish script finished!"
echo ""
log_info "📋 Summary:"
log_info "  App: $PROJECT"
log_info "  Version: $RUNTIMEVERSION"
log_info "  Channel: $RELEASECHANNEL"
log_info "  Server: $APISERVER"
echo ""

if [ -n "$UPLOAD_ID" ]; then
    log_info "🚀 Next steps:"
    log_info "  1. Release the update: curl -X PUT $APISERVER/release/$UPLOAD_ID"
    log_info "  2. Test the manifest: curl '$APISERVER/manifest?project=$PROJECT&channel=$RELEASECHANNEL&version=$RUNTIMEVERSION&platform=ios'"
    log_info "  3. Check updates list: curl '$APISERVER/uploads'"
else
    log_warning "Upload may have failed. Check the server response above."
fi

echo "" 