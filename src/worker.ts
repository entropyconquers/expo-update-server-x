/**
 * Expo Update Server - Cloudflare Workers Edition
 *
 * A Hono-based server running on Cloudflare Workers with:
 * - D1 SQLite Database for metadata
 * - R2 Object Storage for files
 * - KV for caching
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

// Type definitions for Cloudflare bindings
type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  CACHE: KVNamespace;
  ENVIRONMENT: string;
  PUBLIC_URL: string;
};

type Variables = {
  userId?: string;
};

// Initialize Hono app with proper typing
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// === MIDDLEWARE ===

// CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["*"],
  })
);

// Logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const end = Date.now();
  console.log(
    `${c.req.method} ${c.req.url} - ${c.res.status} (${end - start}ms)`
  );
});

// === UTILITY FUNCTIONS ===

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Create hash using Web Crypto API
 */
async function createHash(
  data: BufferSource,
  algorithm: string = "SHA-256"
): Promise<string> {
  // For MD5, we need to use crypto-js since Web Crypto API doesn't support MD5
  if (algorithm === "MD5") {
    const CryptoJS = (await import("crypto-js")).default;
    const arrayBuffer =
      data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer;
    const uint8Array = new Uint8Array(arrayBuffer);
    const wordArray = CryptoJS.lib.WordArray.create(uint8Array);
    return CryptoJS.MD5(wordArray).toString();
  }

  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert base64 to base64url encoding
 */
function getBase64URLEncoding(base64EncodedString: string): string {
  return base64EncodedString
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Convert SHA256 hash to UUID format
 */
function convertSHA256HashToUUID(value: string): string {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

/**
 * Convert dictionary items to structured headers format
 */
function convertToDictionaryItemsRepresentation(
  obj: any
): Map<string, [string, Map<string, any>]> {
  return new Map(
    Object.entries(obj).map(([k, v]) => [k, [String(v), new Map()]])
  );
}

/**
 * Serialize dictionary for structured headers
 */
function serializeDictionary(
  dict: Map<string, [string, Map<string, any>]>
): string {
  const items = Array.from(dict.entries()).map(([key, [value, params]]) => {
    let item = `${key}="${value}"`;
    if (params.size > 0) {
      const paramStr = Array.from(params.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join(";");
      item += `;${paramStr}`;
    }
    return item;
  });
  return items.join(", ");
}

// === CERTIFICATE UTILITIES ===

/**
 * Clean and validate a PEM certificate
 * Handles proper formatting, encoding, and cleanup
 */
function cleanAndValidateCertificate(certificatePem: string): string {
  if (!certificatePem || typeof certificatePem !== "string") {
    throw new Error("Certificate is required and must be a string");
  }

  // Remove any leading/trailing whitespace
  let cleaned = certificatePem.trim();

  // Normalize line endings (convert \r\n and \r to \n)
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove any extra whitespace between lines
  cleaned = cleaned.replace(/\n\s+/g, "\n");

  // Remove multiple consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Ensure proper PEM format
  if (!cleaned.includes("-----BEGIN CERTIFICATE-----")) {
    throw new Error(
      "Invalid certificate format: missing BEGIN CERTIFICATE header"
    );
  }

  if (!cleaned.includes("-----END CERTIFICATE-----")) {
    throw new Error(
      "Invalid certificate format: missing END CERTIFICATE footer"
    );
  }

  // Extract the certificate content between headers
  const beginMarker = "-----BEGIN CERTIFICATE-----";
  const endMarker = "-----END CERTIFICATE-----";

  const beginIndex = cleaned.indexOf(beginMarker);
  const endIndex = cleaned.indexOf(endMarker);

  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    throw new Error("Invalid certificate format: malformed PEM structure");
  }

  // Extract and clean the base64 content
  const header = cleaned.substring(0, beginIndex + beginMarker.length);
  const footer = cleaned.substring(endIndex);
  const base64Content = cleaned.substring(
    beginIndex + beginMarker.length,
    endIndex
  );

  // Clean the base64 content (remove whitespace, but keep it readable)
  const cleanedBase64 =
    base64Content
      .replace(/\s/g, "") // Remove all whitespace
      .match(/.{1,64}/g) // Split into 64-character lines
      ?.join("\n") || "";

  if (!cleanedBase64) {
    throw new Error(
      "Invalid certificate format: empty or invalid base64 content"
    );
  }

  // Validate base64 content (basic check)
  try {
    atob(cleanedBase64.replace(/\n/g, ""));
  } catch (error) {
    throw new Error("Invalid certificate format: malformed base64 content");
  }

  // Reconstruct the properly formatted certificate
  const formattedCertificate = `${header}\n${cleanedBase64}\n${footer}`;

  return formattedCertificate;
}

/**
 * Clean and validate a PEM private key
 */
function cleanAndValidatePrivateKey(privateKeyPem: string): string {
  if (!privateKeyPem || typeof privateKeyPem !== "string") {
    throw new Error("Private key is required and must be a string");
  }

  // Remove any leading/trailing whitespace
  let cleaned = privateKeyPem.trim();

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove any extra whitespace between lines
  cleaned = cleaned.replace(/\n\s+/g, "\n");

  // Remove multiple consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Check for valid private key headers (support multiple formats)
  const validHeaders = [
    "-----BEGIN PRIVATE KEY-----",
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN EC PRIVATE KEY-----",
  ];

  const validFooters = [
    "-----END PRIVATE KEY-----",
    "-----END RSA PRIVATE KEY-----",
    "-----END EC PRIVATE KEY-----",
  ];

  let beginMarker = "";
  let endMarker = "";

  // Find the matching header/footer pair
  for (let i = 0; i < validHeaders.length; i++) {
    if (
      cleaned.includes(validHeaders[i]) &&
      cleaned.includes(validFooters[i])
    ) {
      beginMarker = validHeaders[i];
      endMarker = validFooters[i];
      break;
    }
  }

  if (!beginMarker || !endMarker) {
    throw new Error(
      "Invalid private key format: missing or mismatched PEM headers"
    );
  }

  // Extract and clean the base64 content
  const beginIndex = cleaned.indexOf(beginMarker);
  const endIndex = cleaned.indexOf(endMarker);

  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    throw new Error("Invalid private key format: malformed PEM structure");
  }

  const header = cleaned.substring(0, beginIndex + beginMarker.length);
  const footer = cleaned.substring(endIndex);
  const base64Content = cleaned.substring(
    beginIndex + beginMarker.length,
    endIndex
  );

  // Clean the base64 content
  const cleanedBase64 =
    base64Content
      .replace(/\s/g, "") // Remove all whitespace
      .match(/.{1,64}/g) // Split into 64-character lines
      ?.join("\n") || "";

  if (!cleanedBase64) {
    throw new Error(
      "Invalid private key format: empty or invalid base64 content"
    );
  }

  // Validate base64 content
  try {
    atob(cleanedBase64.replace(/\n/g, ""));
  } catch (error) {
    throw new Error("Invalid private key format: malformed base64 content");
  }

  // Reconstruct the properly formatted private key
  const formattedPrivateKey = `${header}\n${cleanedBase64}\n${footer}`;

  return formattedPrivateKey;
}

/**
 * Sign manifest using RSA-SHA256 with Web Crypto API
 */
async function signManifest(
  manifestString: string,
  privateKeyPem: string
): Promise<string> {
  try {
    // Detect and handle different private key formats
    let pemHeader: string;
    let pemFooter: string;
    let isPkcs1 = false;

    if (privateKeyPem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
      // PKCS#1 format (RSA PRIVATE KEY)
      isPkcs1 = true;
      pemHeader = "-----BEGIN RSA PRIVATE KEY-----";
      pemFooter = "-----END RSA PRIVATE KEY-----";
    } else if (privateKeyPem.includes("-----BEGIN PRIVATE KEY-----")) {
      // PKCS#8 format (PRIVATE KEY)
      isPkcs1 = false;
      pemHeader = "-----BEGIN PRIVATE KEY-----";
      pemFooter = "-----END PRIVATE KEY-----";
    } else {
      throw new Error(
        "Unsupported private key format. Expected PKCS#1 or PKCS#8 PEM format."
      );
    }

    // Extract the base64 content
    const pemContents = privateKeyPem
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");

    // Validate base64 content
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(pemContents)) {
      throw new Error("Invalid base64 characters in private key");
    }

    // Convert base64 to binary
    const binaryDer = Uint8Array.from(atob(pemContents), (c) =>
      c.charCodeAt(0)
    );

    // For PKCS#1, we need to convert to PKCS#8 first (Web Crypto API limitation)
    if (isPkcs1) {
      throw new Error(
        "PKCS#1 format detected. Please convert your private key to PKCS#8 format using: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in your-key.pem -out your-key-pkcs8.pem"
      );
    }

    // Import the key (PKCS#8 format only)
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    // Sign the manifest
    const encoder = new TextEncoder();
    const data = encoder.encode(manifestString);
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      data
    );

    // Convert to base64
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(
      String.fromCharCode.apply(null, Array.from(signatureArray))
    );

    return signatureBase64;
  } catch (error) {
    console.error("Error signing manifest:", error);
    throw new Error(
      `Failed to sign manifest: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Get signature for manifest if code signing is requested
 */
async function getSignature(
  headers: Record<string, string | undefined>,
  manifest: any,
  privateKey: string | null
): Promise<string | null> {
  const expectSignature = headers["expo-expect-signature"];

  if (!expectSignature) {
    return null;
  }

  if (!privateKey) {
    throw new Error(
      "Code signing requested by client, but no private key configured for this app."
    );
  }

  const manifestString = JSON.stringify(manifest);
  const hashSignature = await signManifest(manifestString, privateKey);

  const dictionary = convertToDictionaryItemsRepresentation({
    sig: hashSignature,
    keyid: "main",
  });

  return serializeDictionary(dictionary);
}

/**
 * Get request parameters for Expo manifest requests
 */
function getRequestParams(c: any) {
  const url = new URL(c.req.url);
  const project =
    url.searchParams.get("project") ?? c.req.header("expo-project");
  const platform =
    url.searchParams.get("platform") ?? c.req.header("expo-platform");
  const runtimeVersion =
    url.searchParams.get("version") ?? c.req.header("expo-runtime-version");
  const releaseChannel =
    url.searchParams.get("channel") ?? c.req.header("expo-channel-name");

  if (!project)
    throw new Error("No expo-project header or project query provided.");
  if (platform !== "ios" && platform !== "android")
    throw new Error("Missing or invalid expo-platform header.");
  if (!runtimeVersion) throw new Error("Missing expo-runtime-version header.");
  if (!releaseChannel) throw new Error("Missing expo-channel-name header.");

  return { project, platform, runtimeVersion, releaseChannel };
}

/**
 * Create R2 key for uploads
 */
function createR2Key(
  type: "upload" | "update" | "asset",
  id: string,
  filename?: string
): string {
  switch (type) {
    case "upload":
      return `uploads/${id}/${filename || "bundle.zip"}`;
    case "update":
      return `updates/${id}/`;
    case "asset":
      return `updates/${id}/${filename}`;
    default:
      throw new Error(`Invalid R2 key type: ${type}`);
  }
}

/**
 * Extract and process uploaded bundle
 */
async function processBundleUpload(
  bucket: R2Bucket,
  uploadId: string,
  bundleFile: File
): Promise<{
  appJson: any;
  dependencies: any;
  metadata: any;
  updateId: string;
}> {
  // Import JSZip dynamically to work in Workers environment
  const JSZip = (await import("jszip")).default;

  // Get the zip file content
  const zipBuffer = await bundleFile.arrayBuffer();

  // Load the zip file
  const zip = new JSZip();
  await zip.loadAsync(zipBuffer);

  // Extract and parse app.json
  const appJsonFile = zip.file("app.json");
  if (!appJsonFile) {
    throw new Error("app.json not found in update bundle");
  }
  const appJsonContent = await appJsonFile.async("text");
  const appJsonData = JSON.parse(appJsonContent);
  const appJson = appJsonData.expo;

  // Extract and parse package.json
  const packageJsonFile = zip.file("package.json");
  if (!packageJsonFile) {
    throw new Error("package.json not found in update bundle");
  }
  const packageJsonContent = await packageJsonFile.async("text");
  const packageJsonData = JSON.parse(packageJsonContent);
  const dependencies = packageJsonData.dependencies;

  // Extract and parse metadata.json
  const metadataJsonFile = zip.file("metadata.json");
  if (!metadataJsonFile) {
    throw new Error("metadata.json not found in update bundle");
  }
  const metadataJsonContent = await metadataJsonFile.async("text");
  const metadata = JSON.parse(metadataJsonContent);

  // Generate update ID from metadata hash (same as local server)
  const metadataBuffer = new TextEncoder().encode(metadataJsonContent);
  const metadataHash = await createHash(metadataBuffer);
  const updateId = convertSHA256HashToUUID(metadataHash);

  // Extract and store all files in R2
  const extractPromises: Promise<void>[] = [];

  zip.forEach((relativePath, file) => {
    if (!file.dir) {
      // Store each file in R2 under the update directory
      const r2Key = createR2Key("asset", updateId, relativePath);
      const extractPromise = file
        .async("arraybuffer")
        .then(async (fileBuffer) => {
          await bucket.put(r2Key, fileBuffer);
          console.log(`Stored asset: ${r2Key}`);
        });
      extractPromises.push(extractPromise);
    }
  });

  // Wait for all files to be extracted and stored
  await Promise.all(extractPromises);

  console.log(`Successfully processed bundle with updateId: ${updateId}`);
  console.log(`Extracted ${extractPromises.length} files to R2`);

  return {
    appJson,
    dependencies,
    metadata,
    updateId,
  };
}

/**
 * Generate asset metadata for manifest (matching expo-helpers.js implementation)
 */
async function generateAssetMetadata(
  bucket: R2Bucket,
  publicUrl: string,
  updateId: string,
  assetPath: string,
  isLaunchAsset: boolean = false,
  ext?: string
): Promise<any> {
  const assetKey = createR2Key("asset", updateId, assetPath);

  // Get the asset from R2 to generate hash and key
  const assetObject = await bucket.get(assetKey);
  if (!assetObject) {
    throw new Error(`Asset not found in R2: ${assetKey}`);
  }

  // Read asset content to generate hash and MD5 key
  const assetBuffer = await assetObject.arrayBuffer();

  // Generate SHA256 hash (base64url encoded) - matches expo-helpers.js
  const sha256HashBuffer = await crypto.subtle.digest("SHA-256", assetBuffer);
  const sha256Base64 = btoa(
    String.fromCharCode(...new Uint8Array(sha256HashBuffer))
  );
  const assetHash = getBase64URLEncoding(sha256Base64);

  // Generate MD5 key - matches expo-helpers.js
  const md5Hash = await createHash(assetBuffer, "MD5");
  const key = md5Hash;

  // Determine content type and file extension
  const keyExtensionSuffix = isLaunchAsset
    ? "bundle"
    : ext || assetPath.split(".").pop() || "";
  const contentType = isLaunchAsset
    ? "application/javascript"
    : "application/octet-stream"; // We could add proper MIME type detection here

  // Generate asset URL pointing to our /assets endpoint
  const url = `${publicUrl}/assets?asset=${encodeURIComponent(
    assetKey
  )}&contentType=${encodeURIComponent(contentType)}`;

  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url,
  };
}

/**
 * Create multipart form response for manifest (Expo format)
 */
function createMultipartResponse(manifest: any, signature?: string): Response {
  const boundary = `----formdata-expo-${Date.now()}`;

  // Create proper multipart response manually to match the working Node.js implementation
  let multipartBody = `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="manifest"\r\n`;
  multipartBody += `Content-Type: application/json; charset=utf-8\r\n`;

  // Add signature header if present - this is the key part that was missing!
  if (signature) {
    multipartBody += `expo-signature: ${signature}\r\n`;
  }

  multipartBody += `\r\n${JSON.stringify(manifest)}\r\n`;
  multipartBody += `--${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="extensions"\r\n`;
  multipartBody += `Content-Type: application/json\r\n`;
  multipartBody += `\r\n{}\r\n`;
  multipartBody += `--${boundary}--\r\n`;

  return new Response(multipartBody, {
    headers: {
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
      "expo-protocol-version": "0",
      "expo-sfv-version": "0",
      "cache-control": "private, max-age=0",
    },
  });
}

// === DATABASE HELPERS ===

/**
 * Find upload by criteria
 */
async function findUpload(
  db: D1Database,
  criteria: {
    project: string;
    version: string;
    releaseChannel: string;
    status: string;
  }
) {
  const { results } = await db
    .prepare(
      `
    SELECT * FROM uploads 
    WHERE project = ? AND version = ? AND release_channel = ? AND status = ?
    ORDER BY created_at DESC
    LIMIT 1
  `
    )
    .bind(
      criteria.project,
      criteria.version,
      criteria.releaseChannel,
      criteria.status
    )
    .all();

  return results[0] || null;
}

/**
 * Find app configuration
 */
async function findApp(db: D1Database, appId: string) {
  const { results } = await db
    .prepare(
      `
    SELECT * FROM apps WHERE id = ?
  `
    )
    .bind(appId)
    .all();

  return results[0] || null;
}

/**
 * Insert new app into database
 */
async function insertApp(
  db: D1Database,
  app: {
    id: string;
    privateKey: string | null;
    certificate: string | null;
    createdAt: string;
    name?: string;
    description?: string;
    ownerEmail?: string;
    autoCleanupEnabled?: boolean;
  }
) {
  try {
    await db
      .prepare(
        `
        INSERT INTO apps (id, private_key, certificate, created_at, updated_at, name, description, owner_email, auto_cleanup_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        app.id,
        app.privateKey,
        app.certificate,
        app.createdAt,
        app.createdAt,
        app.name || null,
        app.description || null,
        app.ownerEmail || null,
        app.autoCleanupEnabled !== false ? 1 : 0 // Default to enabled (1) unless explicitly disabled
      )
      .run();

    console.log(`App created successfully: ${app.id}`);
  } catch (error) {
    console.error("Error inserting app:", error);
    throw new Error("Failed to create app in database");
  }
}

/**
 * Insert new upload record
 */
async function insertUpload(db: D1Database, upload: any) {
  return await db
    .prepare(
      `
    INSERT INTO uploads (
      id, created_at, project, version, release_channel, status, 
      path, update_id, app_json, dependencies, metadata, git_branch, 
      git_commit, original_filename
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      upload.id,
      upload.createdAt,
      upload.project,
      upload.version,
      upload.releaseChannel,
      upload.status,
      upload.path,
      upload.updateId,
      JSON.stringify(upload.appJson),
      JSON.stringify(upload.dependencies),
      upload.metadata, // Already stringified in the upload record
      upload.gitBranch,
      upload.gitCommit,
      upload.originalFilename
    )
    .run();
}

/**
 * Update upload status
 */
async function updateUploadStatus(
  db: D1Database,
  uploadId: string,
  status: string,
  releasedAt?: string
) {
  const sql = releasedAt
    ? `UPDATE uploads SET status = ?, released_at = ? WHERE id = ?`
    : `UPDATE uploads SET status = ? WHERE id = ?`;

  const params = releasedAt
    ? [status, releasedAt, uploadId]
    : [status, uploadId];

  return await db
    .prepare(sql)
    .bind(...params)
    .run();
}

/**
 * Clean up obsolete uploads beyond the retention limit
 * Deletes both database records and R2 objects
 */
async function cleanupObsoleteUploads(
  db: D1Database,
  bucket: R2Bucket,
  project: string,
  releaseChannel: string
): Promise<{ deletedCount: number; freedSpace: number }> {
  // Check if app has auto cleanup enabled
  const app = await findApp(db, project);
  if (!app || app.auto_cleanup_enabled === false) {
    console.log(`Auto cleanup disabled for ${project}, skipping cleanup`);
    return { deletedCount: 0, freedSpace: 0 };
  }

  console.log(
    `Cleaning up obsolete uploads for ${project}:${releaseChannel} (keeping latest 30)`
  );

  // Find obsolete uploads beyond the 30 most recent for this project/channel
  // Keep the 30 most recent obsolete uploads, delete the rest
  const { results: obsoleteUploads } = await db
    .prepare(
      `
      SELECT id, path, update_id, original_filename, created_at
      FROM uploads 
      WHERE project = ? 
        AND release_channel = ? 
        AND status = 'obsolete' 
      ORDER BY created_at DESC
      LIMIT -1 OFFSET 30
    `
    )
    .bind(project, releaseChannel)
    .all();

  if (obsoleteUploads.length === 0) {
    console.log("No obsolete uploads to clean up");
    return { deletedCount: 0, freedSpace: 0 };
  }

  console.log(`Found ${obsoleteUploads.length} obsolete uploads to delete`);

  let totalFreedSpace = 0;
  const r2DeletePromises: Promise<void>[] = [];

  // Delete R2 objects for each obsolete upload
  for (const upload of obsoleteUploads) {
    // Delete upload bundle
    if (upload.path) {
      r2DeletePromises.push(
        bucket
          .head(String(upload.path))
          .then(async (headResult) => {
            if (headResult) {
              totalFreedSpace += headResult.size || 0;
              await bucket.delete(String(upload.path));
              console.log(`Deleted upload bundle: ${upload.path}`);
            }
          })
          .catch((error) => {
            console.warn(
              `Failed to delete upload bundle ${upload.path}:`,
              error
            );
          })
      );
    }

    // Delete update assets (all files under updates/{updateId}/)
    if (upload.update_id) {
      r2DeletePromises.push(
        (async () => {
          try {
            const listResult = await bucket.list({
              prefix: `updates/${upload.update_id}/`,
            });

            for (const object of listResult.objects) {
              totalFreedSpace += object.size || 0;
              await bucket.delete(object.key);
              console.log(`Deleted update asset: ${object.key}`);
            }
          } catch (error) {
            console.warn(
              `Failed to delete update assets for ${upload.update_id}:`,
              error
            );
          }
        })()
      );
    }
  }

  // Wait for all R2 deletions to complete
  await Promise.allSettled(r2DeletePromises);

  // Delete database records
  const uploadIds = obsoleteUploads.map((u) => `'${u.id}'`).join(",");
  await db.prepare(`DELETE FROM uploads WHERE id IN (${uploadIds})`).run();

  console.log(
    `Successfully cleaned up ${
      obsoleteUploads.length
    } obsolete uploads, freed ~${
      Math.round((totalFreedSpace / 1024 / 1024) * 100) / 100
    }MB`
  );

  return {
    deletedCount: obsoleteUploads.length,
    freedSpace: totalFreedSpace,
  };
}

// === ROUTES ===

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    message: "Expo Update Server - Cloudflare Workers Edition",
    version: "2.0.0",
    powered_by: "Hono + Cloudflare Workers + D1 + R2 + KV",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || "development",
  });
});

// POST /register-app - Register a new app
app.post("/register-app", async (c) => {
  try {
    // Get slug from request body
    const body = await c.req.json();
    const { slug, name, description, ownerEmail } = body;

    if (!slug) {
      return c.text("Missing required field: slug", 400);
    }

    // Validate slug format (alphanumeric, hyphens, underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      return c.text(
        "Invalid slug format. Use only alphanumeric characters, hyphens, and underscores.",
        400
      );
    }

    // Validate email if provided
    if (ownerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return c.text("Invalid email format", 400);
    }

    // Check if app already exists
    const existingApp = await findApp(c.env.DB, slug);
    if (existingApp) {
      return c.text("App with this slug already exists", 409);
    }

    console.log(`Registering new app: ${slug}`);

    // Create app record without certificate (user will upload later)
    const appRecord = {
      id: slug,
      privateKey: null, // Will be set when certificate is uploaded
      certificate: null, // Will be set when certificate is uploaded
      createdAt: new Date().toISOString(),
      name: name || null,
      description: description || null,
      ownerEmail: ownerEmail || null,
    };

    // Save to database
    await insertApp(c.env.DB, appRecord);

    // Generate URLs
    const baseUrl = c.env.PUBLIC_URL || `https://${c.req.header("host")}`;
    const updateUrl = `${baseUrl}/manifest?project=${slug}&channel=production`;

    console.log(`App registered successfully: ${slug}`);

    // Return registration response with certificate generation instructions
    return c.json({
      success: true,
      message: "App registered successfully",
      app: {
        slug,
        createdAt: appRecord.createdAt,
        name: appRecord.name,
        description: appRecord.description,
        ownerEmail: appRecord.ownerEmail,
      },
      configuration: {
        updateUrl,
        manifestUrl: updateUrl,
        exampleUrls: {
          production: `${baseUrl}/manifest?project=${slug}&channel=production`,
          staging: `${baseUrl}/manifest?project=${slug}&channel=staging`,
          development: `${baseUrl}/manifest?project=${slug}&channel=development`,
        },
      },
      certificateSetup: {
        status: "required",
        message:
          "You need to generate and upload a certificate for code signing",
        generateInstructions: {
          title: "🔐 Generate Your Certificate",
          method1: {
            title: "Using the provided script (Recommended)",
            steps: [
              "1. Download the certificate generation script:",
              `   curl -o generate-certificate.js https://raw.githubusercontent.com/your-repo/quickpush-x/main/generate-keys.js`,
              "2. Install node-forge dependency:",
              `   npm install node-forge`,
              "3. Generate your certificate:",
              `   node generate-certificate.js ${slug}`,
              "4. This will create two files:",
              `   - ${slug}-private-key.pem (keep this secure!)`,
              `   - ${slug}-certificate.pem (for your Expo app)`,
            ],
          },
          method2: {
            title: "Using OpenSSL (Advanced)",
            steps: [
              "1. Generate a private key:",
              `   openssl genrsa -out ${slug}-private-key.pem 2048`,
              "2. Generate a self-signed certificate:",
              `   openssl req -new -x509 -key ${slug}-private-key.pem -out ${slug}-certificate.pem -days 3650 -subj "/CN=expo-updates-${slug}"`,
            ],
          },
        },
        uploadInstructions: {
          title: "📤 Upload Your Certificate",
          endpoint: `${baseUrl}/apps/${slug}/certificate`,
          method: "PUT",
          body: {
            certificate:
              "-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----",
            privateKey:
              "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----",
          },
          curlExample: `curl -X PUT ${baseUrl}/apps/${slug}/certificate \\
  -H "Content-Type: application/json" \\
  -d '{
    "certificate": "$(cat ${slug}-certificate.pem | sed ':a;N;$!ba;s/\\n/\\\\n/g')",
    "privateKey": "$(cat ${slug}-private-key.pem | sed ':a;N;$!ba;s/\\n/\\\\n/g')"
  }'`,
        },
        expoConfig: {
          title: "⚙️ Configure Your Expo App",
          instructions: `Add this to your app.json or app.config.js:`,
          config: {
            expo: {
              updates: {
                url: updateUrl,
                codeSigningCertificate: `./${slug}-certificate.pem`,
                codeSigningMetadata: {
                  keyid: "main",
                  alg: "rsa-v1_5-sha256",
                },
              },
            },
          },
        },
      },
      nextSteps: [
        "1. Generate your certificate using one of the methods above",
        `2. Upload your certificate using: PUT ${baseUrl}/apps/${slug}/certificate`,
        "3. Add the certificate file to your Expo project root",
        "4. Update your app.json/app.config.js with the provided configuration",
        "5. Upload your first update using the /upload endpoint",
        "6. Release your update using the /release/:id endpoint",
      ],
    });
  } catch (error) {
    console.error("App registration failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`App registration failed: ${message}`, 500);
  }
});

// PUT /apps/:slug/certificate - Upload certificate and private key for an app
app.put("/apps/:slug/certificate", async (c) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const { certificate, privateKey } = body;

    if (!certificate || !privateKey) {
      return c.text("Missing required fields: certificate and privateKey", 400);
    }

    // Find the app
    const app = await findApp(c.env.DB, slug);
    if (!app) {
      return c.text("App not found", 404);
    }

    // Clean and validate the certificate and private key
    let cleanedCertificate: string;
    let cleanedPrivateKey: string;

    try {
      cleanedCertificate = cleanAndValidateCertificate(certificate);
      cleanedPrivateKey = cleanAndValidatePrivateKey(privateKey);
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Validation failed";
      return c.text(`Certificate validation failed: ${message}`, 400);
    }

    // Update the app with the certificate and private key
    await c.env.DB.prepare(
      `
        UPDATE apps 
        SET private_key = ?, certificate = ?, updated_at = ?
        WHERE id = ?
      `
    )
      .bind(
        cleanedPrivateKey,
        cleanedCertificate,
        new Date().toISOString(),
        slug
      )
      .run();

    console.log(`Certificate uploaded successfully for app: ${slug}`);

    // Generate URLs
    const baseUrl = c.env.PUBLIC_URL || `https://${c.req.header("host")}`;

    return c.json({
      success: true,
      message: "Certificate uploaded successfully",
      app: {
        slug,
        certificateStatus: "configured",
        updatedAt: new Date().toISOString(),
      },
      configuration: {
        updateUrl: `${baseUrl}/manifest?project=${slug}&channel=production`,
        exampleUrls: {
          production: `${baseUrl}/manifest?project=${slug}&channel=production`,
          staging: `${baseUrl}/manifest?project=${slug}&channel=staging`,
          development: `${baseUrl}/manifest?project=${slug}&channel=development`,
        },
      },
      nextSteps: [
        `Add the certificate file (${slug}-certificate.pem) to your Expo project root`,
        "Update your app.json/app.config.js with the provided configuration",
        "Upload your first update using the /upload endpoint",
        "Release your update using the /release/:id endpoint",
      ],
    });
  } catch (error) {
    console.error("Certificate upload failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Certificate upload failed: ${message}`, 500);
  }
});

// GET /certificate/:slug - Get certificate as plain text for easy copy-paste
app.get("/certificate/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Find the app
    const app = await findApp(c.env.DB, slug);
    if (!app) {
      return c.text(
        "Certificate not configured for this app. Please upload a certificate first.",
        404
      );
    }

    if (!app.certificate) {
      return c.text(
        "Certificate not configured for this app. Please upload a certificate first.",
        404
      );
    }

    // Return certificate as plain text with proper content type
    return new Response(String(app.certificate), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-certificate.pem"`,
      },
    });
  } catch (error) {
    console.error("Failed to get certificate:", error);
    return c.text("Failed to get certificate", 500);
  }
});

// GET /apps - List all registered apps (for admin)
app.get("/apps", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `
      SELECT id, created_at, private_key, certificate, name, description, owner_email, auto_cleanup_enabled
      FROM apps 
      ORDER BY created_at DESC
    `
    ).all();

    const baseUrl = c.env.PUBLIC_URL || `https://${c.req.header("host")}`;

    const appsData = {
      metadata: {
        totalApps: results.length,
        timestamp: new Date().toISOString(),
        server: "Expo Update Server - Cloudflare Workers Edition",
      },
      apps: results.map((app: any) => {
        const hasCodeSigning = !!(app.certificate && app.private_key);
        const certificateStatus = hasCodeSigning
          ? "configured"
          : "not_configured";

        return {
          slug: app.id,
          createdAt: app.created_at,
          name: app.name || app.id,
          description: app.description,
          ownerEmail: app.owner_email,
          certificateStatus,
          hasCodeSigning,
          updateUrl: `${baseUrl}/manifest?project=${app.id}&channel=production`,
          settings: {
            autoCleanupEnabled: app.auto_cleanup_enabled !== 0, // Convert 1/0 to boolean, default true if null
          },
        };
      }),
    };

    return c.json(appsData);
  } catch (error) {
    console.error("Apps endpoint failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Apps endpoint failed: ${message}`, 500);
  }
});

// PUT /apps/:slug/settings - Update app settings
app.put("/apps/:slug/settings", async (c) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const { autoCleanupEnabled } = body;

    // Find the app
    const app = await findApp(c.env.DB, slug);
    if (!app) {
      return c.text("App not found", 404);
    }

    // Update the app settings
    await c.env.DB.prepare(
      `
        UPDATE apps 
        SET auto_cleanup_enabled = ?, updated_at = ?
        WHERE id = ?
      `
    )
      .bind(autoCleanupEnabled ? 1 : 0, new Date().toISOString(), slug)
      .run();

    console.log(
      `Updated auto cleanup setting for app: ${slug} to ${autoCleanupEnabled}`
    );

    return c.json({
      success: true,
      message: "App settings updated successfully",
      settings: {
        autoCleanupEnabled,
      },
    });
  } catch (error) {
    console.error("App settings update failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`App settings update failed: ${message}`, 500);
  }
});

// GET /apps/:slug - Get individual app details
app.get("/apps/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Find the app
    const app = await findApp(c.env.DB, slug);
    if (!app) {
      return c.text("App not found", 404);
    }

    // Get upload statistics for this app
    const { results: uploads } = await c.env.DB.prepare(
      `
      SELECT status, created_at, released_at
      FROM uploads 
      WHERE project = ?
      ORDER BY created_at DESC
    `
    )
      .bind(slug)
      .all();

    // Calculate statistics
    const totalUploads = uploads.length;
    const releasedUploads = uploads.filter(
      (u: any) => u.status === "released"
    ).length;
    const lastUpload = uploads.length > 0 ? uploads[0] : null;
    const lastRelease = uploads.find((u: any) => u.status === "released");

    // Check certificate status
    const hasCodeSigning = !!(app.certificate && app.private_key);
    const certificateStatus = hasCodeSigning ? "configured" : "not_configured";

    const baseUrl = c.env.PUBLIC_URL || `https://${c.req.header("host")}`;

    const appData = {
      slug: app.id,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      name: app.name || app.id,
      description: app.description,
      ownerEmail: app.owner_email,
      certificateStatus,
      hasCodeSigning,
      updateUrl: `${baseUrl}/manifest?project=${app.id}&channel=production`,
      settings: {
        autoCleanupEnabled: app.auto_cleanup_enabled !== 0, // Convert 1/0 to boolean, default true if null
      },
      statistics: {
        totalUploads,
        releasedUploads,
        lastUpdate: lastUpload?.created_at,
        lastRelease: lastRelease?.released_at,
      },
      urls: {
        manifest: `${baseUrl}/manifest?project=${app.id}&channel=production`,
        certificate: hasCodeSigning ? `${baseUrl}/certificate/${app.id}` : null,
        upload: `${baseUrl}/upload`,
      },
    };

    return c.json(appData);
  } catch (error) {
    console.error("App details endpoint failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`App details failed: ${message}`, 500);
  }
});

// DELETE /apps/:slug - Delete an app and all its data
app.delete("/apps/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Find the app first to verify it exists
    const app = await findApp(c.env.DB, slug);
    if (!app) {
      return c.text("App not found", 404);
    }

    console.log(`Starting deletion of app: ${slug}`);

    // Start a transaction to ensure data consistency
    // Note: D1 doesn't support transactions yet, so we'll do our best to clean up

    // 1. Get all upload records to clean up R2 objects (before deleting them)
    const { results: uploads } = await c.env.DB.prepare(
      `SELECT path, update_id FROM uploads WHERE project = ?`
    )
      .bind(slug)
      .all();

    // 2. Delete all R2 objects for this app

    // Clean up R2 objects for uploads
    const r2DeletePromises: Promise<void>[] = [];

    for (const upload of uploads) {
      // Delete upload bundle
      if (upload.path) {
        r2DeletePromises.push(
          c.env.BUCKET.delete(String(upload.path)).catch((error) => {
            console.warn(`Failed to delete R2 object ${upload.path}:`, error);
          })
        );
      }

      // Delete update assets (all files under updates/{updateId}/)
      if (upload.update_id) {
        try {
          const listResult = await c.env.BUCKET.list({
            prefix: `updates/${upload.update_id}/`,
          });

          for (const object of listResult.objects) {
            r2DeletePromises.push(
              c.env.BUCKET.delete(object.key).catch((error) => {
                console.warn(
                  `Failed to delete R2 object ${object.key}:`,
                  error
                );
              })
            );
          }
        } catch (error) {
          console.warn(
            `Failed to list R2 objects for update ${upload.update_id}:`,
            error
          );
        }
      }
    }

    // Wait for all R2 deletions to complete (best effort)
    await Promise.allSettled(r2DeletePromises);

    // 3. Clear cache entries for this app
    const cacheKeys = [
      `manifest:${slug}:*`, // This is a pattern, actual implementation would need to list and delete
    ];

    // Clear known cache patterns (D1 doesn't support pattern deletion, so we'll do specific ones)
    const platforms = ["ios", "android"];
    const channels = ["production", "staging", "development"];

    for (const platform of platforms) {
      for (const channel of channels) {
        const cacheKey = `manifest:${slug}:*:${channel}:${platform}`;
        await c.env.CACHE.delete(cacheKey).catch((error) => {
          console.warn(`Failed to delete cache key ${cacheKey}:`, error);
        });
      }
    }

    // 4. Delete all uploads for this app from database
    await c.env.DB.prepare(`DELETE FROM uploads WHERE project = ?`)
      .bind(slug)
      .run();

    // 5. Finally, delete the app record
    await c.env.DB.prepare(`DELETE FROM apps WHERE id = ?`).bind(slug).run();

    console.log(`Successfully deleted app: ${slug}`);

    return c.json({
      success: true,
      message: `App "${slug}" has been permanently deleted`,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("App deletion failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`App deletion failed: ${message}`, 500);
  }
});

// POST /upload - Receives a new update bundle
app.post("/upload", async (c) => {
  try {
    // Get headers
    const project = c.req.header("project");
    const version = c.req.header("version");
    const releaseChannel = c.req.header("release-channel");
    const uploadKey = c.req.header("upload-key");
    const gitBranch = c.req.header("git-branch") || "Unknown";
    const gitCommit = c.req.header("git-commit") || "Unknown";

    // Validate required headers
    if (!project || !version || !releaseChannel) {
      return c.text(
        "Missing required headers: project, version, release-channel",
        400
      );
    }

    // Note: Upload key validation can be added by setting UPLOAD_SECRET_KEY environment variable
    // and uncommenting the validation below:
    // if (c.env.UPLOAD_SECRET_KEY && (!uploadKey || uploadKey !== c.env.UPLOAD_SECRET_KEY)) {
    //   return c.text('Invalid upload key', 401);
    // }

    // Get uploaded file
    const formData = await c.req.formData();
    const file = formData.get("uri") as File;

    if (!file) {
      return c.text("No file uploaded", 400);
    }

    // Generate upload ID
    const uploadId = generateUUID();

    // Store file in R2
    const r2Key = createR2Key("upload", uploadId, file.name);
    await c.env.BUCKET.put(r2Key, file);

    // Process bundle and extract metadata
    const { appJson, dependencies, metadata, updateId } =
      await processBundleUpload(c.env.BUCKET, uploadId, file);

    // Store metadata in database
    const uploadRecord = {
      id: uploadId,
      createdAt: new Date().toISOString(),
      project,
      version,
      releaseChannel,
      status: "ready",
      path: r2Key,
      updateId,
      appJson,
      dependencies,
      metadata: JSON.stringify(metadata), // Store metadata for manifest generation
      gitBranch,
      gitCommit,
      originalFilename: file.name,
    };

    // Save to D1
    await insertUpload(c.env.DB, uploadRecord);

    console.log(`Upload successful: ${uploadId}, updateId: ${updateId}`);

    return c.json({
      message: "Upload successful. Ready to be released.",
      uploadId: uploadId,
      updateId: updateId,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Upload failed: ${message}`, 500);
  }
});

// PUT /release/:id - Marks an upload as "released" for clients
app.put("/release/:id", async (c) => {
  try {
    const uploadId = c.req.param("id");

    // Find the upload
    const { results } = await c.env.DB.prepare(
      `
      SELECT * FROM uploads WHERE id = ?
    `
    )
      .bind(uploadId)
      .all();

    const targetUpload = results[0];
    if (!targetUpload) {
      return c.text("Upload not found.", 404);
    }

    // Mark ALL other uploads for the same project/channel based on timeline
    // Older uploads become obsolete, newer uploads become ready (in case of rollback)
    await c.env.DB.prepare(
      `
      UPDATE uploads 
      SET status = CASE 
        WHEN created_at < (SELECT created_at FROM uploads WHERE id = ?) THEN 'obsolete'
        WHEN created_at > (SELECT created_at FROM uploads WHERE id = ?) THEN 'ready'
        ELSE status
      END
      WHERE project = ? 
        AND release_channel = ?
        AND id != ?
    `
    )
      .bind(
        uploadId,
        uploadId,
        targetUpload.project,
        targetUpload.release_channel,
        uploadId
      )
      .run();

    // Release the new one
    const releasedAt = new Date().toISOString();
    await updateUploadStatus(c.env.DB, uploadId, "released", releasedAt);

    // Clean up obsolete uploads beyond retention limit
    const cleanupResult = await cleanupObsoleteUploads(
      c.env.DB,
      c.env.BUCKET,
      String(targetUpload.project),
      String(targetUpload.release_channel)
    );

    // Clear relevant cache entries
    const cachePattern = `manifest:${targetUpload.project}:${targetUpload.version}:${targetUpload.release_channel}`;
    // Clear both platform-specific caches
    await c.env.CACHE.delete(`${cachePattern}:ios`);
    await c.env.CACHE.delete(`${cachePattern}:android`);

    console.log(`Successfully released update ${targetUpload.update_id}`);

    const responseMessage =
      cleanupResult.deletedCount > 0
        ? `Successfully released update ${targetUpload.update_id}. Cleaned up ${
            cleanupResult.deletedCount
          } obsolete updates (freed ${
            Math.round((cleanupResult.freedSpace / 1024 / 1024) * 100) / 100
          }MB).`
        : `Successfully released update ${targetUpload.update_id}`;

    return c.text(responseMessage);
  } catch (error) {
    console.error("Release failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Release failed: ${message}`, 500);
  }
});

// PUT /apps/:slug/release/:uploadId - Alternative release endpoint with app slug
app.put("/apps/:slug/release/:uploadId", async (c) => {
  try {
    const slug = c.req.param("slug");
    const uploadId = c.req.param("uploadId");

    // Find the upload and verify it belongs to the app
    const { results } = await c.env.DB.prepare(
      `
      SELECT * FROM uploads WHERE id = ? AND project = ?
    `
    )
      .bind(uploadId, slug)
      .all();

    const targetUpload = results[0];
    if (!targetUpload) {
      return c.text("Upload not found for this app.", 404);
    }

    // Mark ALL other uploads for the same project/channel based on timeline
    // Older uploads become obsolete, newer uploads become ready (in case of rollback)
    await c.env.DB.prepare(
      `
      UPDATE uploads 
      SET status = CASE 
        WHEN created_at < (SELECT created_at FROM uploads WHERE id = ?) THEN 'obsolete'
        WHEN created_at > (SELECT created_at FROM uploads WHERE id = ?) THEN 'ready'
        ELSE status
      END
      WHERE project = ? 
        AND release_channel = ?
        AND id != ?
    `
    )
      .bind(
        uploadId,
        uploadId,
        targetUpload.project,
        targetUpload.release_channel,
        uploadId
      )
      .run();

    // Release the new one
    const releasedAt = new Date().toISOString();
    await updateUploadStatus(c.env.DB, uploadId, "released", releasedAt);

    // Clean up obsolete uploads beyond retention limit
    const cleanupResult = await cleanupObsoleteUploads(
      c.env.DB,
      c.env.BUCKET,
      String(targetUpload.project),
      String(targetUpload.release_channel)
    );

    // Clear relevant cache entries
    const cachePattern = `manifest:${targetUpload.project}:${targetUpload.version}:${targetUpload.release_channel}`;
    // Clear both platform-specific caches
    await c.env.CACHE.delete(`${cachePattern}:ios`);
    await c.env.CACHE.delete(`${cachePattern}:android`);

    console.log(
      `Successfully released update ${targetUpload.update_id} for app ${slug}`
    );

    const baseMessage = `Successfully released update ${targetUpload.update_id}`;
    const cleanupMessage =
      cleanupResult.deletedCount > 0
        ? ` Cleaned up ${cleanupResult.deletedCount} obsolete updates (freed ${
            Math.round((cleanupResult.freedSpace / 1024 / 1024) * 100) / 100
          }MB).`
        : "";

    return c.json({
      success: true,
      message: baseMessage + cleanupMessage,
      upload: {
        id: uploadId,
        updateId: targetUpload.update_id,
        releasedAt,
        status: "released",
      },
      cleanup:
        cleanupResult.deletedCount > 0
          ? {
              deletedCount: cleanupResult.deletedCount,
              freedSpaceMB:
                Math.round((cleanupResult.freedSpace / 1024 / 1024) * 100) /
                100,
            }
          : null,
    });
  } catch (error) {
    console.error("Release failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Release failed: ${message}`, 500);
  }
});

// GET /manifest - The endpoint called by the Expo app
app.get("/manifest", async (c) => {
  try {
    // Get request parameters with proper error handling
    let project: string,
      platform: string,
      runtimeVersion: string,
      releaseChannel: string;
    try {
      const params = getRequestParams(c);
      project = params.project;
      platform = params.platform;
      runtimeVersion = params.runtimeVersion;
      releaseChannel = params.releaseChannel;
    } catch (paramError) {
      console.error("Invalid request parameters:", paramError);
      const message =
        paramError instanceof Error
          ? paramError.message
          : "Invalid request parameters";
      return c.text(`Bad request: ${message}`, 400);
    }

    // Check cache first
    const cacheKey = `manifest:${project}:${runtimeVersion}:${releaseChannel}:${platform}`;
    const cachedData = await c.env.CACHE.get(cacheKey);

    if (cachedData) {
      console.log("Cache hit for manifest:", cacheKey);
      const { manifest, signature } = JSON.parse(cachedData);
      return createMultipartResponse(manifest, signature);
    }

    // Find the correct released update
    const update = await findUpload(c.env.DB, {
      project,
      version: runtimeVersion,
      releaseChannel,
      status: "released",
    });

    if (!update) {
      return c.text("No update available for this channel.", 404);
    }

    // Find the app's config (for private key, etc.)
    const appConfig = await findApp(c.env.DB, project);

    // Parse stored metadata
    const metadata = JSON.parse(String(update.metadata));
    const platformSpecificMetadata = metadata.fileMetadata[platform];

    if (!platformSpecificMetadata) {
      return c.text(`No update available for platform: ${platform}`, 404);
    }

    // Generate asset metadata for all assets
    const assetPromises = platformSpecificMetadata.assets.map((asset: any) =>
      generateAssetMetadata(
        c.env.BUCKET,
        c.env.PUBLIC_URL,
        String(update.update_id),
        asset.path,
        false,
        asset.ext
      )
    );

    // Generate launch asset metadata
    const launchAssetPromise = generateAssetMetadata(
      c.env.BUCKET,
      c.env.PUBLIC_URL,
      String(update.update_id),
      platformSpecificMetadata.bundle,
      true
    );

    // Wait for all asset metadata to be generated
    const [assets, launchAsset] = await Promise.all([
      Promise.all(assetPromises),
      launchAssetPromise,
    ]);

    // Generate proper Expo manifest
    const manifest = {
      id: String(update.update_id),
      createdAt: String(update.created_at),
      runtimeVersion: String(update.version),
      assets,
      launchAsset,
    };

    // Generate signature if code signing is requested
    let signature: string | null = null;
    try {
      // Convert Hono headers to a plain object
      const headers: Record<string, string | undefined> = {};
      const headerNames = ["expo-expect-signature"];
      headerNames.forEach((name) => {
        headers[name] = c.req.header(name);
      });

      signature = await getSignature(
        headers,
        manifest,
        appConfig ? String(appConfig.private_key) : null
      );
    } catch (error) {
      console.error("Code signing error:", error);
      const message =
        error instanceof Error ? error.message : "Code signing failed";
      return c.text(`Code signing error: ${message}`, 500);
    }

    // Cache the manifest data and signature
    await c.env.CACHE.put(cacheKey, JSON.stringify({ manifest, signature }), {
      expirationTtl: 300,
    }); // 5 minutes

    console.log(
      `Served manifest for ${project}:${runtimeVersion}:${releaseChannel}:${platform}`
    );

    // Create and return multipart response with signature
    return createMultipartResponse(manifest, signature || undefined);
  } catch (error) {
    console.error("Manifest request failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Manifest error: ${message}`, 500);
  }
});

// GET /assets - Serves individual files from R2
app.get("/assets", async (c) => {
  try {
    const asset = c.req.query("asset");
    const contentType =
      c.req.query("contentType") || "application/octet-stream";

    if (!asset) {
      return c.text("Missing asset query parameter.", 400);
    }

    // Security: Basic path validation
    if (asset.includes("..") || asset.startsWith("/")) {
      return c.text("Invalid asset path.", 403);
    }

    console.log(`Serving asset: ${asset}`);

    // Get file from R2
    const object = await c.env.BUCKET.get(asset);

    if (!object) {
      console.warn(`Asset not found: ${asset}`);
      return c.text("Asset not found.", 404);
    }

    // Set caching headers
    c.header("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
    c.header("Content-Type", contentType);

    return new Response(object.body as ReadableStream, {
      headers: {
        "Cache-Control": "public, max-age=31536000",
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Asset request failed:", error);
    return c.text("Asset request failed.", 500);
  }
});

// GET /uploads - List all uploads (for admin)
app.get("/uploads", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `
      SELECT 
        id, project, version, release_channel, status, 
        created_at, released_at, update_id, git_branch, 
        git_commit, original_filename
      FROM uploads 
      ORDER BY created_at DESC
    `
    ).all();

    const uploadsData = {
      metadata: {
        totalUploads: results.length,
        timestamp: new Date().toISOString(),
        server: "Expo Update Server - Cloudflare Workers Edition",
        version: "1.0.0",
      },
      uploads: results.map((upload: any) => ({
        id: upload.id,
        project: upload.project,
        version: upload.version,
        releaseChannel: upload.release_channel,
        status: upload.status,
        createdAt: upload.created_at,
        releasedAt: upload.released_at,
        updateId: upload.update_id,
        gitBranch: upload.git_branch,
        gitCommit: upload.git_commit,
        originalFilename: upload.original_filename,
        isReleased: upload.status === "released",
        platform: "universal", // Could be enhanced to track platform-specific uploads
        runtimeVersion: upload.version,
      })),
    };

    return c.json(uploadsData);
  } catch (error) {
    console.error("Uploads endpoint failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.text(`Uploads endpoint failed: ${message}`, 500);
  }
});

// Export the app as the default Worker handler
export default app;
