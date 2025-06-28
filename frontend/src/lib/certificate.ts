import { pki, util, random, md } from "node-forge";

// Helper function to ensure the serial number is positive
const toPositiveHex = (hexString: string): string => {
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
function generateSelfSignedCodeSigningCertificate({
  keyPair,
  commonName,
}: {
  keyPair: pki.rsa.KeyPair;
  commonName: string;
}): pki.Certificate {
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

export interface GeneratedCertificate {
  privateKey: string;
  certificate: string;
  details: {
    algorithm: string;
    keyFormat: string;
    compatibility: string;
    validFor: string;
    commonName: string;
  };
}

/**
 * Generate RSA certificate and private key for Expo Updates code signing
 */
export async function generateCertificate(
  projectSlug: string
): Promise<GeneratedCertificate> {
  return new Promise((resolve, reject) => {
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

      console.log("✅ Certificate generation complete!");

      resolve({
        privateKey: privateKeyPem,
        certificate: certificatePem,
        details: {
          algorithm: "RSA-2048 with SHA-256",
          keyFormat: "PKCS#8 (Web Crypto API compatible)",
          compatibility: "rsa-v1_5-sha256",
          validFor: "10 years",
          commonName: `expo-updates-${projectSlug}`,
        },
      });
    } catch (error) {
      console.error("Certificate generation failed:", error);
      reject(
        new Error(
          `Certificate generation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      );
    }
  });
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(
  content: string,
  filename: string,
  contentType: string = "text/plain"
): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Download certificate file (only the certificate, not the private key)
 * The private key stays on the server for security
 */
export function downloadCertificateFiles(
  certificate: GeneratedCertificate,
  projectSlug: string
): void {
  downloadFile(
    certificate.certificate,
    `${projectSlug}-certificate.pem`,
    "application/x-pem-file"
  );
}

/**
 * Download both certificate and private key files (for backup purposes)
 */
export function downloadAllCertificateFiles(
  certificate: GeneratedCertificate,
  projectSlug: string
): void {
  downloadFile(
    certificate.privateKey,
    `${projectSlug}-private-key.pem`,
    "application/x-pem-file"
  );

  downloadFile(
    certificate.certificate,
    `${projectSlug}-certificate.pem`,
    "application/x-pem-file"
  );
}
