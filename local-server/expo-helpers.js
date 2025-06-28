const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mime = require("mime");
const FormData = require("form-data");
const { serializeDictionary } = require("structured-headers");

// --- Configuration ---
// In a real app, use environment variables: process.env.PUBLIC_URL
const PUBLIC_URL = "http://192.168.0.104:3001";

// --- Hashing and Formatting ---

function createHash(file, hashingAlgorithm, encoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding);
}

function getBase64URLEncoding(base64EncodedString) {
  return base64EncodedString
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function convertToDictionaryItemsRepresentation(obj) {
  return new Map(Object.entries(obj).map(([k, v]) => [k, [v, new Map()]]));
}

function signRSASHA256(data, privateKey) {
  const sign = crypto.createSign("sha256");
  sign.update(data, "utf8");
  sign.end();
  return sign.sign(privateKey, "base64");
}

const convertSHA256HashToUUID = (value) => {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(
    12,
    16
  )}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
};

// --- Request Parsing ---

function getRequestParams({ query, headers }) {
  const project = query.project ?? headers["expo-project"];
  if (!project)
    throw new Error("No expo-project header or project query provided.");

  const platform = query.platform ?? headers["expo-platform"];
  if (platform !== "ios" && platform !== "android")
    throw new Error("Missing or invalid expo-platform header.");

  const runtimeVersion = query.version ?? headers["expo-runtime-version"];
  if (!runtimeVersion) throw new Error("Missing expo-runtime-version header.");

  const releaseChannel = query.channel ?? headers["expo-channel-name"];
  if (!releaseChannel) throw new Error("Missing expo-channel-name header.");

  return { project, platform, runtimeVersion, releaseChannel };
}

// --- Metadata and Asset Handling ---

function getJSONInfo({ path: paramPath }) {
  const appJsonPath = path.resolve(`${paramPath}/app.json`);
  const pkgJsonPath = path.resolve(`${paramPath}/package.json`);
  if (!fs.existsSync(appJsonPath))
    throw new Error("Error: app.json not found in update.");
  if (!fs.existsSync(pkgJsonPath))
    throw new Error("Error: package.json not found in update.");

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  return { appJson: appJson.expo, dependencies: pkgJson.dependencies };
}

function getUpdateId(pathToUpdate) {
  const metadataPath = `${pathToUpdate}/metadata.json`;
  const updateMetadataBuffer = fs.readFileSync(
    path.resolve(metadataPath),
    null
  );
  const id = createHash(updateMetadataBuffer, "sha256", "hex");
  return convertSHA256HashToUUID(id);
}

// --- Manifest Generation ---

async function getSignature({ headers, manifest, privateKey }) {
  if (!headers["expo-expect-signature"]) return {};
  if (!privateKey)
    throw new Error(
      "Code signing requested by client, but no private key configured for this app."
    );

  const manifestString = JSON.stringify(manifest);
  const hashSignature = signRSASHA256(manifestString, privateKey);
  const dictionary = convertToDictionaryItemsRepresentation({
    sig: hashSignature,
    keyid: "main",
  });

  return { "expo-signature": serializeDictionary(dictionary) };
}

function getAssetMetadataSync({
  update,
  filePath,
  ext,
  isLaunchAsset,
  platform,
}) {
  const assetFilePath = `${update.path}/${filePath}`;
  const asset = fs.readFileSync(path.resolve(assetFilePath), null);
  const assetHash = getBase64URLEncoding(createHash(asset, "sha256", "base64"));
  const key = createHash(asset, "md5", "hex");
  const keyExtensionSuffix = isLaunchAsset ? "bundle" : ext;
  const contentType = isLaunchAsset
    ? "application/javascript"
    : mime.getType(ext);

  // IMPORTANT: The URL must point to your /assets endpoint
  // Use the full path for the asset parameter so the server can resolve it
  const url = `${PUBLIC_URL}/assets?asset=${encodeURIComponent(
    assetFilePath
  )}&contentType=${encodeURIComponent(contentType)}`;
  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url,
  };
}

function getMetadataSync(update) {
  const metadataPath = `${update.path}/metadata.json`;
  const updateMetadataBuffer = fs.readFileSync(
    path.resolve(metadataPath),
    null
  );
  const metadataJson = JSON.parse(updateMetadataBuffer.toString("utf-8"));
  const id = createHash(updateMetadataBuffer, "sha256", "hex");

  return {
    metadataJson,
    createdAt: new Date(update.releasedAt).toISOString(),
    id,
  };
}

async function createManifest(update, app, req) {
  const { metadataJson, createdAt, id } = getMetadataSync(update);
  const platform = getRequestParams(req).platform;
  const platformSpecificMetadata = metadataJson.fileMetadata[platform];

  const manifest = {
    id: convertSHA256HashToUUID(id),
    createdAt,
    runtimeVersion: update.version,
    assets: platformSpecificMetadata.assets.map((asset) =>
      getAssetMetadataSync({
        update,
        filePath: asset.path,
        ext: asset.ext,
        isLaunchAsset: false,
        platform,
      })
    ),
    launchAsset: getAssetMetadataSync({
      update,
      filePath: platformSpecificMetadata.bundle,
      isLaunchAsset: true,
      platform,
      ext: null,
    }),
  };

  const form = new FormData();
  form.append("manifest", JSON.stringify(manifest), {
    contentType: "application/json",
    header: {
      "content-type": "application/json; charset=utf-8",
      ...(await getSignature({
        headers: req.headers,
        manifest,
        privateKey: app ? app.privateKey : null,
      })),
    },
  });

  form.append("extensions", JSON.stringify({}), {
    contentType: "application/json",
  });

  return {
    body: form.getBuffer(),
    boundary: form.getBoundary(),
  };
}

module.exports = {
  createManifest,
  getRequestParams,
  getJSONInfo,
  getUpdateId,
};
