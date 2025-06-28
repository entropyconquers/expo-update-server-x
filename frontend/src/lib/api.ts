const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// === TYPE DEFINITIONS ===

export interface App {
  slug: string;
  createdAt: string;
  updatedAt?: string;
  name?: string;
  description?: string;
  ownerEmail?: string;
  certificateStatus: "configured" | "not_configured";
  hasCodeSigning?: boolean;
  updateUrl: string;
  lastUpdate?: string;
  settings?: {
    autoCleanupEnabled: boolean;
  };
  statistics?: {
    totalUploads: number;
    releasedUploads: number;
    lastUpdate?: string;
    lastRelease?: string;
  };
  urls?: {
    manifest: string;
    certificate?: string | null;
    upload: string;
  };
}

export interface Upload {
  id: string;
  project: string;
  version: string;
  releaseChannel: string;
  status: "ready" | "released" | "obsolete";
  createdAt: string;
  releasedAt?: string;
  updateId: string;
  gitBranch?: string;
  gitCommit?: string;
  originalFilename: string;
}

export interface RegisterAppResponse {
  success: boolean;
  message: string;
  app: {
    slug: string;
    createdAt: string;
  };
  configuration: {
    updateUrl: string;
    manifestUrl: string;
    exampleUrls: {
      production: string;
      staging: string;
      development: string;
    };
  };
  certificateSetup: {
    status: string;
    message: string;
    generateInstructions: Record<string, unknown>;
    uploadInstructions: Record<string, unknown>;
    expoConfig: Record<string, unknown>;
  };
  nextSteps: string[];
}

export interface AppsListResponse {
  metadata: {
    totalApps: number;
    timestamp: string;
    server: string;
  };
  apps: Array<{
    slug: string;
    createdAt: string;
    name?: string;
    description?: string;
    ownerEmail?: string;
    certificateStatus: "configured" | "not_configured";
    hasCodeSigning: boolean;
    updateUrl: string;
  }>;
}

export interface UploadsListResponse {
  metadata: {
    totalUploads: number;
    timestamp: string;
    server: string;
    version: string;
  };
  uploads: Upload[];
}

export interface CertificateUploadResponse {
  success: boolean;
  message: string;
  app: {
    slug: string;
    certificateStatus: string;
    updatedAt: string;
  };
  configuration: {
    updateUrl: string;
    exampleUrls: {
      production: string;
      staging: string;
      development: string;
    };
  };
  nextSteps: string[];
}

export interface ReleaseUploadResponse {
  success: boolean;
  message: string;
  upload: {
    id: string;
    updateId: string;
    releasedAt: string;
    status: string;
  };
  cleanup?: {
    deletedCount: number;
    freedSpaceMB: number;
  } | null;
}

// === ERROR HANDLING ===

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        response.status,
        errorText || `HTTP ${response.status}`
      );
    }

    // Handle plain text responses
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    } else {
      return response.text() as unknown as T;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Handle network errors, CORS issues, etc.
    throw new ApiError(
      0,
      `Network error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

// === API METHODS ===

export const api = {
  // Register a new app
  registerApp: async (
    slug: string,
    name?: string,
    description?: string,
    ownerEmail?: string
  ): Promise<RegisterAppResponse> => {
    return apiRequest<RegisterAppResponse>("/register-app", {
      method: "POST",
      body: JSON.stringify({ slug, name, description, ownerEmail }),
    });
  },

  // Get all apps
  getApps: async (): Promise<App[]> => {
    try {
      const response = await apiRequest<AppsListResponse>("/apps");
      // Transform the response to match our App interface
      return response.apps.map((app) => ({
        slug: app.slug,
        createdAt: app.createdAt,
        name: app.name,
        description: app.description,
        ownerEmail: app.ownerEmail,
        updateUrl: app.updateUrl,
        certificateStatus: app.certificateStatus,
        hasCodeSigning: app.hasCodeSigning,
      }));
    } catch (error) {
      // If the endpoint doesn't exist or server is down, return empty array
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 0)
      ) {
        return [];
      }
      throw error;
    }
  },

  // Get individual app details
  getApp: async (slug: string): Promise<App> => {
    return apiRequest<App>(`/apps/${slug}`);
  },

  // Get all uploads
  getUploads: async (): Promise<Upload[]> => {
    try {
      const response = await apiRequest<UploadsListResponse>("/uploads");
      return response.uploads;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 0)
      ) {
        return [];
      }
      throw error;
    }
  },

  // Get uploads for a specific app
  getAppUploads: async (slug: string): Promise<Upload[]> => {
    try {
      const allUploads = await api.getUploads();
      return allUploads.filter((upload) => upload.project === slug);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 0)
      ) {
        return [];
      }
      throw error;
    }
  },

  // Upload certificate for an app
  uploadCertificate: async (
    slug: string,
    certificate: string,
    privateKey: string
  ): Promise<CertificateUploadResponse> => {
    return apiRequest<CertificateUploadResponse>(`/apps/${slug}/certificate`, {
      method: "PUT",
      body: JSON.stringify({ certificate, privateKey }),
    });
  },

  // Get certificate for an app (as plain text)
  getCertificate: async (slug: string): Promise<string> => {
    return apiRequest<string>(`/certificate/${slug}`);
  },

  // Download certificate file for an app
  downloadCertificate: async (slug: string): Promise<void> => {
    const url = `${API_BASE_URL}/certificate/${slug}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-certificate.pem`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Release an upload
  releaseUpload: async (
    slug: string,
    uploadId: string
  ): Promise<ReleaseUploadResponse> => {
    return apiRequest<ReleaseUploadResponse>(
      `/apps/${slug}/release/${uploadId}`,
      {
        method: "PUT",
      }
    );
  },

  // Upload a new bundle (this would typically be done via CLI, but including for completeness)
  uploadBundle: async (
    file: File,
    project: string,
    version: string,
    releaseChannel: string,
    options?: {
      uploadKey?: string;
      gitBranch?: string;
      gitCommit?: string;
    }
  ): Promise<{ uploadId: string; updateId: string; message: string }> => {
    const formData = new FormData();
    formData.append("uri", file);

    const headers: Record<string, string> = {
      project: project,
      version: version,
      "release-channel": releaseChannel,
    };

    if (options?.uploadKey) {
      headers["upload-key"] = options.uploadKey;
    }
    if (options?.gitBranch) {
      headers["git-branch"] = options.gitBranch;
    }
    if (options?.gitCommit) {
      headers["git-commit"] = options.gitCommit;
    }

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        response.status,
        errorText || `HTTP ${response.status}`
      );
    }

    return response.json();
  },

  // Delete an app permanently
  deleteApp: async (
    slug: string
  ): Promise<{ success: boolean; message: string; deletedAt: string }> => {
    return apiRequest<{ success: boolean; message: string; deletedAt: string }>(
      `/apps/${slug}`,
      {
        method: "DELETE",
      }
    );
  },

  // Update app settings
  updateAppSettings: async (
    slug: string,
    settings: { autoCleanupEnabled: boolean }
  ): Promise<{
    success: boolean;
    message: string;
    settings: { autoCleanupEnabled: boolean };
  }> => {
    return apiRequest<{
      success: boolean;
      message: string;
      settings: { autoCleanupEnabled: boolean };
    }>(`/apps/${slug}/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },
};
