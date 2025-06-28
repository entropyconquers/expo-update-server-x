const { Hono } = require("hono");
const { serve } = require("@hono/node-server");
const { cors } = require("hono/cors");
const { compress } = require("hono/compress");
const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { v4: uuidv4 } = require("uuid");
const {
  createManifest,
  getRequestParams,
  getJSONInfo,
  getUpdateId,
} = require("./expo-helpers");

const app = new Hono();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const UPDATES_DIR = path.join(__dirname, "updates");

// --- Middleware ---
app.use(
  "*",
  compress({
    level: 9, // Maximum compression ratio
    threshold: 1024, // Only compress files larger than 1KB
  })
);

app.use("*", cors());

// --- Database Helpers ---
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
const writeDb = (data) =>
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- File Upload Helper for Hono ---
async function handleFileUpload(c) {
  const formData = await c.req.formData();
  const file = formData.get("uri");

  if (!file || typeof file === "string") {
    throw new Error("No file uploaded or invalid file type");
  }

  // Generate unique filename
  const uploadId = uuidv4();
  const originalName = file.name || "bundle.zip";
  const filename = `${uploadId}-${originalName}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  // Convert File to Buffer and save
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);

  return {
    path: filePath,
    originalname: originalName,
    filename: filename,
  };
}

// === ROUTES ===

// 1. POST /upload - Receives a new update bundle from the publish script
app.post("/upload", async (c) => {
  try {
    // --- Handle File Upload ---
    const uploadedFile = await handleFileUpload(c);

    // --- Validation ---
    const headers = Object.fromEntries(
      Object.entries(c.req.header()).map(([k, v]) => [k.toLowerCase(), v])
    );

    const {
      project,
      version,
      "release-channel": releaseChannel,
      "upload-key": uploadKey,
    } = headers;

    // In a real app, you'd validate the uploadKey
    if (!project || !version || !releaseChannel) {
      return c.text(
        "Missing required headers: project, version, release-channel",
        400
      );
    }

    // --- Process the Upload ---
    const uploadId = uuidv4();
    const extractPath = path.join(UPDATES_DIR, uploadId);
    fs.mkdirSync(extractPath, { recursive: true });

    // Unzip the file
    await fs
      .createReadStream(uploadedFile.path)
      .pipe(unzipper.Extract({ path: extractPath }))
      .promise();

    // Get metadata from the bundle
    const { appJson, dependencies } = getJSONInfo({ path: extractPath });
    const updateId = getUpdateId(extractPath);

    // --- Save to DB ---
    const db = readDb();
    const newUpload = {
      _id: uploadId,
      createdAt: new Date().toISOString(),
      project,
      version,
      releaseChannel,
      status: "ready", // 'ready', 'released', 'obsolete'
      path: extractPath,
      updateId,
      appJson,
      dependencies,
      // from headers
      gitBranch: headers["git-branch"] || "Unknown",
      gitCommit: headers["git-commit"] || "Unknown",
      originalFilename: uploadedFile.originalname,
    };
    db.uploads.push(newUpload);
    writeDb(db);

    // --- Cleanup and Respond ---
    fs.unlinkSync(uploadedFile.path); // Delete the temporary zip file
    return c.json({
      message: "Upload successful. Ready to be released.",
      uploadId: uploadId,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    return c.text(`Upload failed: ${error.message}`, 500);
  }
});

// 2. PUT /release/:id - Marks an upload as "released" for clients
app.put("/release/:id", (c) => {
  const id = c.req.param("id");
  const db = readDb();

  const targetUpload = db.uploads.find((u) => u._id === id);
  if (!targetUpload) {
    return c.text("Upload not found.", 404);
  }

  // Mark other releases for the same channel as obsolete
  db.uploads.forEach((upload) => {
    if (
      upload.status === "released" &&
      upload.project === targetUpload.project &&
      upload.version === targetUpload.version &&
      upload.releaseChannel === targetUpload.releaseChannel
    ) {
      upload.status = "obsolete";
    }
  });

  // Release the new one
  targetUpload.status = "released";
  targetUpload.releasedAt = new Date().toISOString();

  writeDb(db);
  return c.text(`Successfully released update ${targetUpload.updateId}`);
});

// 3. GET /manifest - The endpoint called by the Expo app (compressed by default)
app.get("/manifest", async (c) => {
  try {
    const { project, runtimeVersion, releaseChannel } = getRequestParams({
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      headers: c.req.header(),
    });
    const db = readDb();

    // Find the correct released update
    const update = db.uploads.find(
      (u) =>
        u.project === project &&
        u.version === runtimeVersion &&
        u.releaseChannel === releaseChannel &&
        u.status === "released"
    );

    if (!update) {
      return c.text("No update available for this channel.", 404);
    }

    // Find the app's config (for private key, etc.)
    const appConfig = db.apps.find((a) => a._id === project);
    if (!appConfig) {
      // You can still serve updates without code signing if the app doesn't have an entry
      console.warn(
        `No app config found for project "${project}". Serving unsigned update.`
      );
    }

    // Generate standard Expo manifest (automatically compressed by Hono middleware)
    const manifest = await createManifest(update, appConfig, {
      query: Object.fromEntries(new URL(c.req.url).searchParams),
      headers: c.req.header(),
    });

    // Set standard Expo headers - compression handled by Hono middleware
    c.header("expo-protocol-version", "0");
    c.header("expo-sfv-version", "0");
    c.header("cache-control", "private, max-age=0");
    c.header("content-type", `multipart/mixed; boundary=${manifest.boundary}`);

    return c.body(manifest.body);
  } catch (error) {
    console.error("Manifest request failed:", error);
    return c.text(error.message, 400);
  }
});

// 4. GET /assets - Serves the individual files (compressed by default)
app.get("/assets", (c) => {
  const asset = c.req.query("asset");

  if (!asset) {
    console.log("❌ Missing asset parameter");
    return c.text("Missing asset query parameter.", 400);
  }

  let fullPath;

  // Check if the asset path is already absolute and within our updates directory
  if (path.isAbsolute(asset)) {
    fullPath = path.normalize(asset);
  } else {
    // SECURITY: Prevent directory traversal for relative paths
    const safeAssetPath = path.normalize(asset).replace(/^(\.\.[\/\\])+/, "");
    fullPath = path.resolve(UPDATES_DIR, safeAssetPath);
  }

  // Security check: ensure the final path is within our updates directory
  const updatesDir = path.resolve(UPDATES_DIR);
  if (!fullPath.startsWith(updatesDir)) {
    console.log("❌ Security check failed:", fullPath);
    return c.text("Forbidden", 403);
  }

  if (fs.existsSync(fullPath)) {
    // Add caching headers for assets
    c.header("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

    // Read file and return as response
    const fileBuffer = fs.readFileSync(fullPath);
    const contentType =
      c.req.query("contentType") || "application/octet-stream";
    c.header("Content-Type", contentType);
    return c.body(fileBuffer);
  } else {
    console.log("❌ Asset not found:", fullPath);
    return c.text("Asset not found.", 404);
  }
});

// === COMPRESSION TEST ENDPOINTS FOR REAL EXPO DATA ===

// 5. GET /uploads - List all uploads (compressed by default)
app.get("/uploads", (c) => {
  try {
    const db = readDb();

    const uploadsData = {
      metadata: {
        totalUploads: db.uploads.length,
        timestamp: new Date().toISOString(),
        server: "QuickPush-X Expo Update Server (Hono + Compression Enabled)",
      },
      uploads: db.uploads.map((upload) => ({
        id: upload._id,
        project: upload.project,
        version: upload.version,
        releaseChannel: upload.releaseChannel,
        status: upload.status,
        createdAt: upload.createdAt,
        releasedAt: upload.releasedAt,
        updateId: upload.updateId,
        gitBranch: upload.gitBranch,
        gitCommit: upload.gitCommit,
        originalFilename: upload.originalFilename,
        dependencyCount: Object.keys(upload.dependencies || {}).length,
      })),
    };

    return c.json(uploadsData);
  } catch (error) {
    console.error("Uploads endpoint failed:", error);
    return c.text(`Uploads endpoint failed: ${error.message}`, 500);
  }
});

// --- Server Start ---
console.log(
  `Minimal Expo Update Server (Hono) listening on http://localhost:${PORT}`
);

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(UPDATES_DIR)) fs.mkdirSync(UPDATES_DIR);

serve({
  fetch: app.fetch,
  port: PORT,
});
