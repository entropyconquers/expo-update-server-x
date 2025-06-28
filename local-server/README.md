# Local Expo Update Server

This directory contains the local Node.js/Express version of the Expo Update Server for reference and local development.

## Files

- `server.js` - Original Express.js server implementation
- `server-hono.js` - Hono.js version (stepping stone to Workers)
- `db.json` - JSON database file with uploads and apps data
- `expo-helpers.js` - Helper functions for Expo manifest generation
- `generate-certificate-example.js` - Certificate generation script using node-forge
- `upload-certificate.js` - Certificate upload utility script
- `publish-update.sh` - Complete build and upload workflow script
- `test-complete-workflow.sh` - End-to-end workflow test script

## Certificate-Based App Registration

The Cloudflare Workers version now includes a streamlined app registration and certificate management system:

1. **Manual certificate generation** using proper cryptographic libraries (node-forge)
2. **Certificate upload and validation** with format normalization
3. **Database entries** for apps with certificate storage
4. **Complete configuration instructions** including URLs and Expo setup
5. **PKCS#8 format support** for Web Crypto API compatibility

### Quick Certificate Generation and App Setup

Test the certificate generation and app setup with the included scripts:

```bash
# Generate a certificate for your app
node generate-certificate-example.js my-test-app

# Upload the certificate to your server
node upload-certificate.js my-test-app-certificate.pem my-test-app-private-key.pem https://your-worker.workers.dev my-test-app

# Test the complete end-to-end workflow
./test-complete-workflow.sh
```

### Example Registration Response

```json
{
  "success": true,
  "app": {
    "slug": "my-app-slug",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "configuration": {
    "updateUrl": "https://your-worker.workers.dev/manifest?project=my-app-slug&channel=production",
    "exampleUrls": {
      "production": "https://your-worker.workers.dev/manifest?project=my-app-slug&channel=production",
      "staging": "https://your-worker.workers.dev/manifest?project=my-app-slug&channel=staging",
      "development": "https://your-worker.workers.dev/manifest?project=my-app-slug&channel=development"
    }
  },
  "certificate": {
    "pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "instructions": {
      "step1": "Save the certificate content to a file named 'certificate.pem' in your Expo project root",
      "step2": "Add the following to your app.json or app.config.js:",
      "expoConfig": {
        "expo": {
          "updates": {
            "url": "https://your-worker.workers.dev/manifest?project=my-app-slug&channel=production",
            "codeSigningCertificate": "./certificate.pem"
          }
        }
      }
    }
  },
  "nextSteps": [
    "Save the certificate.pem file to your Expo project",
    "Update your app.json/app.config.js with the provided configuration",
    "Upload your first update using the /upload endpoint",
    "Release your update using the /release/:id endpoint"
  ]
}
```

## Migration Status

✅ **Express to Hono**: Successfully migrated from Express.js to Hono.js
✅ **App Registration**: New automated registration endpoint implemented
✅ **Certificate Generation**: Automatic RSA certificate creation
✅ **Database Schema**: D1 migrations created and tested
✅ **Testing Scripts**: Comprehensive test scripts for validation

## Running the Local Server

For reference and local development:

```bash
# Install dependencies (if not already done)
npm install

# Run the Hono version (recommended)
node server-hono.js

# Or run the original Express version
node server.js
```

The server will start on `http://localhost:3000` and serve:

- Health check: `GET /`
- Upload endpoint: `POST /upload`
- Release endpoint: `PUT /release/:id`
- Manifest endpoint: `GET /manifest`
- Assets endpoint: `GET /assets`
- Uploads list: `GET /uploads`

## Key Differences: Local vs Cloudflare Workers

| Feature           | Local Server          | Cloudflare Workers            |
| ----------------- | --------------------- | ----------------------------- |
| **Registration**  | Manual key generation | Automatic app registration    |
| **Database**      | JSON file (`db.json`) | D1 SQLite database            |
| **Storage**       | Local filesystem      | R2 object storage             |
| **Caching**       | In-memory             | KV store                      |
| **Certificates**  | Manual via scripts    | Manual upload with validation |
| **Scaling**       | Single instance       | Global edge deployment        |
| **Configuration** | Manual app setup      | Complete automated setup      |

## Testing the Registration Flow

The test script (`test-complete-workflow.sh`) performs a complete end-to-end test:

1. **Registers a new app** with the `/register-app` endpoint
2. **Saves the certificate** to a `.pem` file
3. **Creates example app.json** with proper configuration
4. **Tests the manifest endpoint** (expects 404 for new apps)
5. **Verifies app listing** in the `/apps` endpoint
6. **Provides next steps** for full update flow testing

### Prerequisites for Testing

- `curl` command available
- `jq` command for JSON parsing (`brew install jq` on macOS)
- Running Cloudflare Workers dev server (`wrangler dev`)

This simplified workflow makes it incredibly easy to get started with Expo updates - just run one command to register your app and get everything you need!
