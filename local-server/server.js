const express = require("express");
const multer = require("multer");
const cors = require("cors");
const compression = require("compression");
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

const app = express();
const PORT = 3001;
const DB_PATH = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const UPDATES_DIR = path.join(__dirname, "updates");

// --- Middleware ---
app.use(
  compression({
    level: 9, // Maximum compression ratio
    threshold: 1024, // Only compress files larger than 1KB
    filter: (req, res) => {
      // Skip compression if explicitly disabled
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
app.use(cors());
app.use(express.json());

// --- Database Helpers ---
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
const writeDb = (data) =>
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// --- Multer Setup for File Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});
const upload = multer({ storage });

// === ROUTES ===

// 1. POST /upload - Receives a new update bundle from the publish script
app.post("/upload", upload.single("uri"), async (req, res) => {
  try {
    // --- Validation ---
    if (!req.file) return res.status(400).send("No file uploaded.");
    const {
      project,
      version,
      "release-channel": releaseChannel,
      "upload-key": uploadKey,
    } = req.headers;
    // In a real app, you'd validate the uploadKey
    if (!project || !version || !releaseChannel) {
      return res
        .status(400)
        .send("Missing required headers: project, version, release-channel");
    }

    // --- Process the Upload ---
    const uploadId = uuidv4();
    const extractPath = path.join(UPDATES_DIR, uploadId);
    fs.mkdirSync(extractPath, { recursive: true });

    // Unzip the file
    await fs
      .createReadStream(req.file.path)
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
      gitBranch: req.headers["git-branch"] || "Unknown",
      gitCommit: req.headers["git-commit"] || "Unknown",
      originalFilename: req.file.originalname,
    };
    db.uploads.push(newUpload);
    writeDb(db);

    // --- Cleanup and Respond ---
    fs.unlinkSync(req.file.path); // Delete the temporary zip file
    res.status(200).json({
      message: "Upload successful. Ready to be released.",
      uploadId: uploadId,
    });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).send(`Upload failed: ${error.message}`);
  }
});

// 2. PUT /release/:id - Marks an upload as "released" for clients
app.put("/release/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();

  const targetUpload = db.uploads.find((u) => u._id === id);
  if (!targetUpload) {
    return res.status(404).send("Upload not found.");
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
  res.status(200).send(`Successfully released update ${targetUpload.updateId}`);
});

// 3. GET /manifest - The endpoint called by the Expo app (compressed by default)
app.get("/manifest", async (req, res) => {
  try {
    const { project, runtimeVersion, releaseChannel } = getRequestParams(req);
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
      return res.status(404).send("No update available for this channel.");
    }

    // Find the app's config (for private key, etc.)
    const appConfig = db.apps.find((a) => a._id === project);
    if (!appConfig) {
      // You can still serve updates without code signing if the app doesn't have an entry
      console.warn(
        `No app config found for project "${project}". Serving unsigned update.`
      );
    }

    // Generate standard Expo manifest (automatically compressed by Express middleware)
    const manifest = await createManifest(update, appConfig, req);

    // Set standard Expo headers - compression handled by Express middleware
    res.set("expo-protocol-version", 0);
    res.set("expo-sfv-version", 0);
    res.set("cache-control", "private, max-age=0");
    res.set("content-type", `multipart/mixed; boundary=${manifest.boundary}`);
    res.send(manifest.body);
  } catch (error) {
    console.error("Manifest request failed:", error);
    res.status(400).send(error.message);
  }
});

// 4. GET /assets - Serves the individual files (compressed by default)
app.get("/assets", (req, res) => {
  const { asset } = req.query;

  if (!asset) {
    console.log("❌ Missing asset parameter");
    return res.status(400).send("Missing asset query parameter.");
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
    return res.status(403).send("Forbidden");
  }

  if (fs.existsSync(fullPath)) {
    // Add caching headers for assets
    res.set("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
    res.sendFile(fullPath);
  } else {
    console.log("❌ Asset not found:", fullPath);
    res.status(404).send("Asset not found.");
  }
});

// === COMPRESSION TEST ENDPOINTS FOR REAL EXPO DATA ===

// 5. GET /uploads - List all uploads (compressed by default)
app.get("/uploads", (req, res) => {
  try {
    const db = readDb();

    const uploadsData = {
      metadata: {
        totalUploads: db.uploads.length,
        timestamp: new Date().toISOString(),
        server: "QuickPush-X Expo Update Server (Compression Enabled)",
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

    res.set("Content-Type", "application/json");
    res.send(uploadsData);
  } catch (error) {
    console.error("Uploads endpoint failed:", error);
    res.status(500).send(`Uploads endpoint failed: ${error.message}`);
  }
});

// Assets are automatically compressed by the Express compression middleware
// when served through the /assets endpoint. No pre-compression needed!

// --- Server Start ---
app.listen(PORT, () => {
  console.log(
    `Minimal Expo Update Server listening on http://localhost:${PORT}`
  );
  // Ensure directories exist
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(UPDATES_DIR)) fs.mkdirSync(UPDATES_DIR);
});
