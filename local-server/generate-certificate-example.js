#!/usr/bin/env node

const { pki, util, random, md } = require("node-forge");
const fs = require("fs");
const path = require("path");

// This is the project "slug" from your app registration.
// Get it from the command line argument.
const projectSlug = process.argv[2];

if (!projectSlug) {
  console.error(
    "Error: Please provide a project slug as a command line argument."
  );
  console.log("Usage: node generate-certificate-example.js my-app-slug");
  console.log("\nExample:");
  console.log("  node generate-certificate-example.js my-expo-app");
  process.exit(1);
}

// Helper function to ensure the serial number is positive.
const toPositiveHex = (hexString) => {
  let mostSignificantHexAsInt = parseInt(hexString[0], 16);
  if (mostSignificantHexAsInt < 8) {
    return hexString;
  }
  mostSignificantHexAsInt -= 8;
  return mostSignificantHexAsInt.toString(16) + hexString.substring(1);
};

/**
 * Generate a self-signed (root) code-signing certificate valid for use with expo-updates.
 * This creates proper X.509 certificates compatible with rsa-v1_5-sha256.
 */
function generateSelfSignedCodeSigningCertificate({ keyPair, commonName }) {
  const cert = pki.createCertificate();
  cert.publicKey = keyPair.publicKey;
  cert.serialNumber = toPositiveHex(util.bytesToHex(random.getBytesSync(9)));

  const validityNotBefore = new Date();
  const validityNotAfter = new Date();
  validityNotAfter.setFullYear(validityNotBefore.getFullYear() + 10); // Valid for 10 years
  cert.validity.notBefore = validityNotBefore;
  cert.validity.notAfter = validityNotAfter;

  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      codeSigning: true,
    },
    {
      name: "extKeyUsage",
      critical: true,
      codeSigning: true,
    },
  ]);

  cert.sign(keyPair.privateKey, md.sha256.create());
  return cert;
}

// --- Main Execution ---

console.log("🔐 Expo Updates Certificate Generator");
console.log("=====================================");
console.log(`Generating certificate for project: "${projectSlug}"`);
console.log("");

try {
  // 1. Generate an RSA key pair
  console.log("🔑 Generating RSA-2048 key pair...");
  const keyPair = pki.rsa.generateKeyPair({ bits: 2048 });

  // 2. Generate the self-signed certificate
  console.log("📜 Creating self-signed certificate...");
  const certificate = generateSelfSignedCodeSigningCertificate({
    keyPair,
    commonName: `expo-updates-${projectSlug}`,
  });

  // 3. Convert keys to PEM format (PKCS#8 for compatibility with Web Crypto API)
  console.log("💾 Converting to PEM format...");
  const privateKeyInfo = pki.wrapRsaPrivateKey(
    pki.privateKeyToAsn1(keyPair.privateKey)
  );
  const privateKeyPem = pki.privateKeyInfoToPem(privateKeyInfo);
  const certificatePem = pki.certificateToPem(certificate);

  // 4. Save keys to separate files
  const privateKeyFileName = `${projectSlug}-private-key.pem`;
  const certificateFileName = `${projectSlug}-certificate.pem`;

  fs.writeFileSync(privateKeyFileName, privateKeyPem);
  fs.writeFileSync(certificateFileName, certificatePem);

  // 5. Display results
  console.log("");
  console.log("✅ Certificate generation complete!");
  console.log("==================================");
  console.log("📁 Files created:");
  console.log(`   - ${privateKeyFileName} (private key - keep secure!)`);
  console.log(`   - ${certificateFileName} (certificate - for your Expo app)`);
  console.log("");
  console.log("🔧 Certificate Details:");
  console.log(`   - Algorithm: RSA-2048 with SHA-256`);
  console.log(`   - Private Key Format: PKCS#8 (Web Crypto API compatible)`);
  console.log(`   - Compatible with: rsa-v1_5-sha256`);
  console.log(`   - Valid for: 10 years`);
  console.log(`   - Common Name: expo-updates-${projectSlug}`);
  console.log("");
  console.log("📋 Next Steps:");
  console.log("1. 🔒 Keep your private key file secure and private");
  console.log("2. 📤 Upload your certificate to the server:");
  console.log(`   PUT /apps/${projectSlug}/certificate`);
  console.log("3. 📁 Add the certificate file to your Expo project root");
  console.log("4. ⚙️  Update your app.json with the certificate path");
  console.log("");
  console.log("🚀 Your certificate is ready for Expo Updates code signing!");
} catch (error) {
  console.error("");
  console.error("❌ Certificate generation failed:");
  console.error(error.message);
  console.error("");
  console.error("💡 Make sure you have installed node-forge:");
  console.error("   npm install node-forge");
  process.exit(1);
}
