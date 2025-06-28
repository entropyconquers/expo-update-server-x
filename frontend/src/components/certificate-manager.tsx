"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Shield,
  Upload,
  Download,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  FileText,
  Zap,
  FileDown,
  Smartphone,
  Info,
} from "lucide-react";
import {
  generateCertificate,
  type GeneratedCertificate,
} from "@/lib/certificate";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";

interface CertificateManagerProps {
  appSlug: string;
  certificateStatus: "configured" | "not_configured";
  onCertificateUploaded: () => void;
}

type GenerationState =
  | "idle"
  | "generating"
  | "uploading"
  | "success"
  | "error";

export function CertificateManager({
  appSlug,
  certificateStatus,
  onCertificateUploaded,
}: CertificateManagerProps) {
  // Generation workflow
  const [generationState, setGenerationState] =
    useState<GenerationState>("idle");
  const [generatedCert, setGeneratedCert] =
    useState<GeneratedCertificate | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Upload workflow
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // UI state
  const [showManagement, setShowManagement] = useState(false);
  const [activeMode, setActiveMode] = useState<"generate" | "upload">(
    "generate"
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastGenerationTime, setLastGenerationTime] = useState<number>(0);
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);

  const handleGenerateAndUpload = async () => {
    // Throttling: prevent generation if less than 5 seconds since last attempt
    const now = Date.now();
    if (now - lastGenerationTime < 5000) {
      toast.error("Please wait before generating another certificate");
      return;
    }

    setLastGenerationTime(now);
    setGenerationState("generating");
    setGenerationError(null);

    try {
      // Generate certificate
      const certificate = await generateCertificate(appSlug);
      setGeneratedCert(certificate);

      // Auto-upload to server
      setGenerationState("uploading");
      await api.uploadCertificate(
        appSlug,
        certificate.certificate,
        certificate.privateKey
      );

      setGenerationState("success");

      // Single success toast
      toast.success("Certificate generated successfully!", {
        description: "Ready for secure code signing",
      });

      // Update the app status and show management panel
      onCertificateUploaded();
      setActiveMode("generate");

      // Automatically open the detailed steps modal
      setShowDetailedSteps(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Setup failed";
      setGenerationError(errorMessage);
      setGenerationState("error");
      toast.error("Certificate setup failed", {
        description: errorMessage,
      });
    }
  };

  const handleUploadFiles = async () => {
    if (!certificateFile || !privateKeyFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const certificateText = await certificateFile.text();
      const privateKeyText = await privateKeyFile.text();

      await api.uploadCertificate(appSlug, certificateText, privateKeyText);

      onCertificateUploaded();
      setShowManagement(false);
      setCertificateFile(null);
      setPrivateKeyFile(null);

      toast.success("Certificate uploaded successfully!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      setUploadError(errorMessage);
      toast.error("Upload failed", {
        description: errorMessage,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadCertificate = async () => {
    setIsDownloading(true);
    try {
      await api.downloadCertificate(appSlug);
      toast.success("Certificate downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setIsDownloading(false);
    }
  };

  const copyConfigToClipboard = async (text: string) => {
    await copyToClipboard(text, "Configuration copied to clipboard!");
  };

  const resetGeneration = () => {
    setGenerationState("idle");
    setGeneratedCert(null);
    setGenerationError(null);
  };

  const resetUpload = () => {
    setCertificateFile(null);
    setPrivateKeyFile(null);
    setUploadError(null);
  };

  const closeManagement = () => {
    setShowManagement(false);
    resetGeneration();
    resetUpload();
  };

  // CONFIGURED STATE - Simple management interface
  if (certificateStatus === "configured") {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Code Signing Certificate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mr-3" />
              <div>
                <h3 className="font-medium text-emerald-900 dark:text-emerald-100">
                  Certificate Configured
                </h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Your app is ready for secure over-the-air updates
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps Info */}
          <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200/50 dark:bg-blue-950/30 dark:border-blue-800/50">
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    1
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Download your certificate
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Save the certificate.pem file to your project
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    2
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Configure your Expo app
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Add the certificate path to your app.json or
                    app.config.js/ts
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    3
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Publish updates
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Your updates will now be cryptographically signed
                  </p>
                </div>
              </div>

              {/* View Detailed Steps Button */}
              <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                <Dialog
                  open={showDetailedSteps}
                  onOpenChange={setShowDetailedSteps}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                    >
                      <Info className="mr-2 h-3 w-3" />
                      <span className="text-xs">View Detailed Steps</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>
                        Setup Guide: Configure Your Expo App
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4 overflow-y-auto flex-1 pr-2">
                      {/* Step 1: Download */}
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400 mr-3">
                            1
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Download Certificate
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Add to your project
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadCertificate}
                          disabled={isDownloading}
                          className="cursor-pointer"
                        >
                          {isDownloading ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <FileDown className="mr-1 h-3 w-3" />
                          )}
                          Download
                        </Button>
                      </div>

                      {/* Step 2: Configure */}
                      <div className="p-3 rounded-lg border bg-background">
                        <div className="flex items-center mb-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-400 mr-3">
                            2
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Update app.json
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Add certificate configuration
                            </div>
                          </div>
                        </div>

                        <div className="ml-9 mt-2">
                          <div className="relative">
                            <pre className="p-3 bg-muted rounded text-xs overflow-x-auto">
                              {`{
  "expo": {
    "updates": {
      "url": "https://your-server.com/manifest?project=${appSlug}",
      "codeSigningCertificate": "./${appSlug}-certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    }
  }
}`}
                            </pre>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                copyConfigToClipboard(`{
  "expo": {
    "updates": {
      "url": "https://your-server.com/manifest?project=${appSlug}",
      "codeSigningCertificate": "./${appSlug}-certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    }
  }
}`)
                              }
                              className="absolute top-2 right-2 cursor-pointer"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Done */}
                      <div className="flex items-center p-3 rounded-lg border bg-background">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-xs font-medium text-emerald-600 dark:text-emerald-400 mr-3">
                          ✓
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            Build & Deploy
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Your app is ready for secure updates
                          </div>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadCertificate}
              disabled={isDownloading}
              className="cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                toast.info("Generating new certificate...", {
                  description:
                    "We'll create and automatically upload a secure certificate",
                });
                handleGenerateAndUpload();
              }}
              className="cursor-pointer"
            >
              <Key className="mr-2 h-4 w-4" />
              Generate New
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setActiveMode("upload");
                setShowManagement(true);
              }}
              className="cursor-pointer"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Different
            </Button>
          </div>

          {/* Management Panel */}
          {showManagement && (
            <div className="mt-6 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">
                  {activeMode === "generate"
                    ? "Generate New Certificate"
                    : "Upload Different Certificate"}
                </h4>
                <Button variant="ghost" size="sm" onClick={closeManagement}>
                  Cancel
                </Button>
              </div>

              {activeMode === "generate" ? (
                <GenerateSection
                  state={generationState}
                  generatedCert={generatedCert}
                  error={generationError}
                  onGenerate={handleGenerateAndUpload}
                  onReset={resetGeneration}
                />
              ) : (
                <UploadSection
                  certificateFile={certificateFile}
                  privateKeyFile={privateKeyFile}
                  isUploading={isUploading}
                  error={uploadError}
                  onCertificateFileChange={setCertificateFile}
                  onPrivateKeyFileChange={setPrivateKeyFile}
                  onUpload={handleUploadFiles}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // NOT CONFIGURED STATE - Setup workflow
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Code Signing Certificate
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Setup secure code signing for your updates
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning */}
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3" />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-100">
                Certificate Required
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Generate or upload a certificate to enable secure code signing
              </p>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant={activeMode === "generate" ? "default" : "outline"}
            onClick={() => {
              setActiveMode("generate");
              // Reset generation state when switching to generate mode
              resetGeneration();
            }}
            className="h-auto p-4 cursor-pointer"
          >
            <div className="text-center">
              <Zap className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">Generate New</div>
              <div className="text-xs opacity-80">Recommended</div>
            </div>
          </Button>

          <Button
            variant={activeMode === "upload" ? "default" : "outline"}
            onClick={() => setActiveMode("upload")}
            className="h-auto p-4 cursor-pointer"
          >
            <div className="text-center">
              <Upload className="w-6 h-6 mx-auto mb-2" />
              <div className="font-medium">Upload Existing</div>
              <div className="text-xs opacity-80">Have your own</div>
            </div>
          </Button>
        </div>

        {/* Active Mode Content */}
        <div className="min-h-[200px]">
          {activeMode === "generate" ? (
            <GenerateSection
              state={generationState}
              generatedCert={generatedCert}
              error={generationError}
              onGenerate={handleGenerateAndUpload}
              onReset={resetGeneration}
            />
          ) : (
            <UploadSection
              certificateFile={certificateFile}
              privateKeyFile={privateKeyFile}
              isUploading={isUploading}
              error={uploadError}
              onCertificateFileChange={setCertificateFile}
              onPrivateKeyFileChange={setPrivateKeyFile}
              onUpload={handleUploadFiles}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Generate Certificate Section
interface GenerateSectionProps {
  state: GenerationState;
  generatedCert: GeneratedCertificate | null;
  error: string | null;
  onGenerate: () => void;
  onReset: () => void;
}

function GenerateSection({
  state,
  generatedCert,
  error,
  onGenerate,
  onReset,
}: GenerateSectionProps) {
  if (state === "idle") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/50 dark:border-blue-800">
          <div className="flex items-center">
            <Key className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Generate RSA-2048 Certificate
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We&apos;ll create and automatically upload a secure certificate
              </p>
            </div>
          </div>
        </div>

        <Button onClick={onGenerate} className="w-full cursor-pointer">
          <Key className="mr-2 h-4 w-4" />
          Generate & Setup Certificate
        </Button>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    );
  }

  if (state === "generating") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/50 dark:border-blue-800">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 animate-spin" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Generating Certificate...
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Creating RSA-2048 key pair with SHA-256 signing
              </p>
            </div>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/3"></div>
        </div>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/50 dark:border-blue-800">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 animate-spin" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Uploading to Server...
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Configuring your app for secure code signing
              </p>
            </div>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full animate-pulse w-2/3"></div>
        </div>
      </div>
    );
  }

  if (state === "success" && generatedCert) {
    // Success is handled by toast and automatic modal opening
    // No need to show any UI here
    return null;
  }

  if (state === "error") {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950/50 dark:border-red-800">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h4 className="font-medium text-red-900 dark:text-red-100">
                Generation Failed
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error || "Unknown error occurred"}
              </p>
            </div>
          </div>
        </div>

        <Button onClick={onReset} variant="outline" className="cursor-pointer">
          Try Again
        </Button>
      </div>
    );
  }

  return null;
}

// Upload Certificate Section
interface UploadSectionProps {
  certificateFile: File | null;
  privateKeyFile: File | null;
  isUploading: boolean;
  error: string | null;
  onCertificateFileChange: (file: File | null) => void;
  onPrivateKeyFileChange: (file: File | null) => void;
  onUpload: () => void;
}

function UploadSection({
  certificateFile,
  privateKeyFile,
  isUploading,
  error,
  onCertificateFileChange,
  onPrivateKeyFileChange,
  onUpload,
}: UploadSectionProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-950/50 dark:border-gray-700">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">
              Upload Your Certificate
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Upload certificate and private key files
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="certificate">Certificate File</Label>
          <Input
            id="certificate"
            type="file"
            accept=".pem,.crt,.cer"
            onChange={(e) =>
              onCertificateFileChange(e.target.files?.[0] || null)
            }
            disabled={isUploading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="privateKey">Private Key File</Label>
          <Input
            id="privateKey"
            type="file"
            accept=".pem,.key"
            onChange={(e) =>
              onPrivateKeyFileChange(e.target.files?.[0] || null)
            }
            disabled={isUploading}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Button
        onClick={onUpload}
        disabled={!certificateFile || !privateKeyFile || isUploading}
        className="w-full cursor-pointer"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload Certificate
          </>
        )}
      </Button>

      {certificateFile && privateKeyFile && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/50 dark:border-blue-800">
          <div className="flex items-center">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Remember to add the certificate to your Expo project after
              uploading
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
