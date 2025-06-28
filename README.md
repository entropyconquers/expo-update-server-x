# Expo Update Server - Cloudflare Workers Edition

A fast, scalable Expo update server built on **Cloudflare Workers** with **Hono**, **D1 Database**, **R2 Storage**, and **KV Cache**. This server provides a complete self-hosted solution for Expo updates with global edge distribution and automatic scaling.

## 🌟 Features

- **🚀 Global Edge Distribution**: Deployed on Cloudflare's global network for ultra-low latency
- **📦 POST /upload**: Receives zipped update bundles with automatic extraction to R2
- **🔄 PUT /release/:id**: Marks uploaded bundles as "released" for client consumption
- **📱 GET /manifest**: Endpoint your Expo app calls to check for updates (with caching)
- **🗂️ GET /assets**: Serves individual asset files directly from R2 storage
- **🔐 Code Signing**: Full support for signed updates using RSA certificates
- **⚡ Auto Scaling**: Handles traffic spikes automatically with zero configuration
- **💾 Persistent Storage**: D1 SQLite database + R2 object storage + KV cache

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Expo Client   │───▶│ Cloudflare Edge  │───▶│  Your Worker    │
│   (Your App)    │    │   (Global CDN)   │    │ (Hono + TypeScript) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                              ┌──────────────────────────┼──────────────────────────┐
                              │                          │                          │
                              ▼                          ▼                          ▼
                    ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
                    │   D1 Database   │      │   R2 Storage    │      │   KV Cache      │
                    │ (SQLite/Metadata) │      │ (Files/Assets)  │      │ (Manifests)     │
                    └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## 🚀 Quick Start

### 1. **Prerequisites**

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Node.js 18+ and npm
- Git

### 2. **Installation**

```bash
# Clone the repository
git clone <your-repo-url>
cd expo-update-server

# Install dependencies
npm install

# Authenticate with Cloudflare
npx wrangler login
```

### 3. **Cloudflare Setup**

```bash
# Create D1 database
npm run cf:d1:create

# Create R2 bucket
npm run cf:r2:create

# Create KV namespace
npm run cf:kv:create

# Run database migrations
npm run cf:d1:migrate
```

### 4. **Deploy to Cloudflare Workers**

```bash
# Deploy to production
npm run deploy

# Or start local development
npm run dev
```

### 5. **Configure Your Expo App**

Update your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "updates": {
      "url": "https://your-worker.your-subdomain.workers.dev/manifest"
    }
  }
}
```

## 📚 API Endpoints

### POST /upload

Upload a new update bundle from your publish script.

**Headers Required:**

- `project`: Your app's project slug
- `version`: Runtime version
- `release-channel`: Release channel name
- `upload-key`: Authentication key (optional, not validated in current version)

**Body:** Multipart form data with `uri` field containing the zip file

**Response:**

```json
{
  "message": "Upload successful. Ready to be released.",
  "uploadId": "uuid-here",
  "updateId": "uuid-here"
}
```

### PUT /release/:id

Mark an upload as "released" for client consumption.

**Parameters:**

- `id`: The upload ID returned from POST /upload

**Response:**

```
Successfully released update {updateId}
```

### GET /manifest

Called by your Expo app to check for updates. Returns a multipart response with manifest and signature.

**Headers/Query Parameters:**

- `expo-project` or `project`: Project slug
- `expo-platform` or `platform`: `ios` or `android`
- `expo-runtime-version` or `version`: Runtime version
- `expo-channel-name` or `channel`: Release channel
- `expo-expect-signature`: Set to `true` for signed updates

**Response:** Multipart form data containing the update manifest and extensions

### GET /assets

Serves individual asset files (bundles, images, fonts, etc.) directly from R2.

**Query Parameters:**

- `asset`: Path to the asset file in R2
- `contentType`: MIME type of the asset

### GET /uploads

Admin endpoint to list all uploads with their status and metadata.

**Response:**

```json
{
  "metadata": {
    "totalUploads": 42,
    "timestamp": "2025-06-25T21:00:00.000Z",
    "server": "Expo Update Server - Cloudflare Workers Edition",
    "version": "2.0.0"
  },
  "uploads": [...]
}
```

## 🔐 Code Signing Setup

Enable signed updates for security with our streamlined certificate workflow:

### 1. **Register Your App**

```bash
curl -X POST https://your-worker.workers.dev/register-app \
  -H "Content-Type: application/json" \
  -d '{"slug": "your-app-slug"}'
```

This returns complete setup instructions including certificate generation methods.

### 2. **Generate Certificate (Recommended Method)**

Download the certificate generation script and create your keys:

```bash
# Download the script (or use the one in local-server/)
curl -o generate-certificate.js https://raw.githubusercontent.com/your-repo/quickpush-x/main/generate-keys.js

# Install dependencies
npm install node-forge

# Generate your certificate
node generate-certificate.js your-app-slug
```

This creates:

- `your-app-slug-private-key.pem` (keep secure!)
- `your-app-slug-certificate.pem` (for your Expo app)

### 3. **Upload Certificate to Server**

```bash
curl -X PUT https://your-worker.workers.dev/apps/your-app-slug/certificate \
  -H "Content-Type: application/json" \
  -d '{
    "certificate": "$(cat your-app-slug-certificate.pem)",
    "privateKey": "$(cat your-app-slug-private-key.pem)"
  }'
```

Or use the provided upload script:

```bash
node local-server/upload-certificate.js your-app-slug
```

### 4. **Configure Your Expo App**

Add the certificate to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "updates": {
      "url": "https://your-worker.workers.dev/manifest?project=your-app-slug&channel=production",
      "codeSigningCertificate": "./your-app-slug-certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    }
  }
}
```

### 5. **Alternative: OpenSSL Method**

For advanced users, you can also generate certificates using OpenSSL:

```bash
# Generate private key
openssl genrsa -out your-app-slug-private-key.pem 2048

# Generate self-signed certificate
openssl req -new -x509 -key your-app-slug-private-key.pem \
  -out your-app-slug-certificate.pem -days 3650 \
  -subj "/CN=expo-updates-your-app-slug"
```

### New API Endpoints

#### POST /register-app

Register a new app and get certificate setup instructions.

#### PUT /apps/:slug/certificate

Upload certificate and private key with automatic validation and formatting.

#### GET /certificate/:slug

Download the certificate file for an app (after upload).

#### GET /apps

List all registered apps with their certificate status.

## 🗄️ Database Schema

### uploads table

```sql
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  project TEXT NOT NULL,
  version TEXT NOT NULL,
  release_channel TEXT NOT NULL,
  status TEXT NOT NULL, -- 'ready', 'released', 'obsolete'
  path TEXT NOT NULL,   -- R2 path to zip file
  update_id TEXT NOT NULL,
  app_json TEXT NOT NULL,
  dependencies TEXT NOT NULL,
  metadata TEXT,        -- Extracted bundle metadata
  git_branch TEXT,
  git_commit TEXT,
  original_filename TEXT NOT NULL,
  released_at TEXT
);
```

### apps table

```sql
CREATE TABLE apps (
  id TEXT PRIMARY KEY,        -- App slug
  private_key TEXT,           -- RSA private key for signing
  certificate TEXT,           -- Public certificate
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## ⚙️ Configuration

The server is configured via `wrangler.toml`:

```toml
name = "expo-update-server"
main = "src/worker.ts"
compatibility_date = "2024-06-20"

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "expo-updates-db"

[[env.production.r2_buckets]]
binding = "BUCKET"
bucket_name = "expo-updates-storage"

[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[env.production.vars]
ENVIRONMENT = "production"
PUBLIC_URL = "https://your-worker.your-subdomain.workers.dev"
```

## 🚀 Deployment

### Development

```bash
npm run dev              # Start local development server
npm run type-check       # Check TypeScript types
```

### Production

```bash
npm run deploy           # Deploy to Cloudflare Workers
```

### Custom Domain (Optional)

1. Add your domain to Cloudflare
2. Set up a Worker route: `your-domain.com/*` → `expo-update-server`
3. Update `PUBLIC_URL` in `wrangler.toml`

## 📊 Performance & Scaling

- **Global Edge**: Your updates are served from 300+ Cloudflare locations worldwide
- **Auto Scaling**: Handles 0 to millions of requests automatically
- **Cold Start**: ~5ms typical cold start time
- **Caching**: Manifests cached in KV for 5 minutes, assets cached at edge for 1 year
- **Concurrent Uploads**: No limits on simultaneous uploads/releases

## 🔒 Security Considerations

- **Code Signing**: Use RSA certificates for update integrity verification
- **Upload Authentication**: Add `UPLOAD_SECRET_KEY` environment variable for upload protection
- **CORS**: Configured for Expo client compatibility
- **Asset Security**: R2 paths are validated to prevent directory traversal
- **Rate Limiting**: Cloudflare provides DDoS protection and rate limiting

## 🆚 Migration from Node.js

This server replaces the previous Node.js/Express implementation with significant improvements.

> **📁 Local Server Reference**: The original Node.js server files are preserved in the `local-server/` directory for reference and local development. See [`local-server/README.md`](local-server/README.md) for details.

| Feature         | Node.js Version     | Cloudflare Workers           |
| --------------- | ------------------- | ---------------------------- |
| **Hosting**     | VPS/Server required | Serverless, global edge      |
| **Scaling**     | Manual              | Automatic                    |
| **Database**    | JSON file           | D1 SQLite                    |
| **Storage**     | Local filesystem    | R2 object storage            |
| **Caching**     | In-memory           | KV store                     |
| **Performance** | Single region       | Global, ~5ms cold start      |
| **Cost**        | Server + bandwidth  | Pay-per-request (often free) |

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Built with ❤️ using [Hono](https://hono.dev/) and [Cloudflare Workers](https://workers.cloudflare.com/)**
