#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Get arguments
const slug = process.argv[2];
const serverUrl =
  process.argv[3] || "https://expo-update-server.expo-quickpush.workers.dev";

if (!slug) {
  console.error("Usage: node upload-certificate.js <app-slug> [server-url]");
  console.error("Example: node upload-certificate.js my-app");
  process.exit(1);
}

const certificateFile = `${slug}-certificate.pem`;
const privateKeyFile = `${slug}-private-key.pem`;

// Check if files exist
if (!fs.existsSync(certificateFile)) {
  console.error(`❌ Certificate file not found: ${certificateFile}`);
  console.error(
    `Generate it first with: node generate-certificate-example.js ${slug}`
  );
  process.exit(1);
}

if (!fs.existsSync(privateKeyFile)) {
  console.error(`❌ Private key file not found: ${privateKeyFile}`);
  console.error(
    `Generate it first with: node generate-certificate-example.js ${slug}`
  );
  process.exit(1);
}

console.log("📤 Uploading Certificate to Expo Update Server");
console.log("==============================================");
console.log(`App: ${slug}`);
console.log(`Server: ${serverUrl}`);
console.log("");

async function uploadCertificate() {
  try {
    // Read the files
    console.log("📖 Reading certificate files...");
    const certificate = fs.readFileSync(certificateFile, "utf8");
    const privateKey = fs.readFileSync(privateKeyFile, "utf8");

    // Prepare the request payload
    const payload = {
      certificate: certificate,
      privateKey: privateKey,
    };

    console.log("🚀 Uploading to server...");

    // Make the request
    const response = await fetch(`${serverUrl}/apps/${slug}/certificate`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (response.ok) {
      console.log("✅ Certificate uploaded successfully!");

      try {
        const result = JSON.parse(responseText);
        console.log("");
        console.log("📋 Server Response:");
        console.log(
          `   Status: ${result.app?.certificateStatus || "configured"}`
        );
        console.log(
          `   Update URL: ${result.configuration?.updateUrl || "N/A"}`
        );
        console.log("");
        console.log("🎉 Next Steps:");
        if (result.nextSteps) {
          result.nextSteps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step}`);
          });
        }
      } catch (parseError) {
        console.log("✅ Upload successful (raw response):");
        console.log(responseText);
      }
    } else {
      console.error("❌ Upload failed:");
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${responseText}`);
    }
  } catch (error) {
    console.error("❌ Upload failed:");
    console.error(`   Error: ${error.message}`);
  }
}

// Run the upload
uploadCertificate();
