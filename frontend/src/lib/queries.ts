import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  App,
  RegisterAppResponse,
  CertificateUploadResponse,
} from "./api";
import { toast } from "sonner";

// === QUERY KEYS ===

export const queryKeys = {
  apps: ["apps"] as const,
  app: (slug: string) => ["apps", slug] as const,
  uploads: ["uploads"] as const,
  appUploads: (slug: string) => ["uploads", "app", slug] as const,
  certificate: (slug: string) => ["certificate", slug] as const,
};

// === QUERY HOOKS ===

/**
 * Get all registered apps
 */
export const useApps = () => {
  return useQuery({
    queryKey: queryKeys.apps,
    queryFn: api.getApps,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Get a specific app by slug
 */
export const useApp = (slug: string) => {
  return useQuery({
    queryKey: queryKeys.app(slug),
    queryFn: () => api.getApp(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Get all uploads across all apps
 */
export const useUploads = () => {
  return useQuery({
    queryKey: queryKeys.uploads,
    queryFn: api.getUploads,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Get uploads for a specific app
 */
export const useAppUploads = (slug: string) => {
  return useQuery({
    queryKey: queryKeys.appUploads(slug),
    queryFn: () => api.getAppUploads(slug),
    enabled: !!slug,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Get certificate for an app
 */
export const useCertificate = (slug: string) => {
  return useQuery({
    queryKey: queryKeys.certificate(slug),
    queryFn: () => api.getCertificate(slug),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: false, // Don't retry if certificate doesn't exist
  });
};

// === MUTATION HOOKS ===

/**
 * Register a new app
 */
export const useRegisterApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => api.registerApp(slug),
    onSuccess: (data: RegisterAppResponse) => {
      // Invalidate and refetch apps list
      queryClient.invalidateQueries({ queryKey: queryKeys.apps });

      // Optionally add the new app to the cache optimistically
      queryClient.setQueryData(queryKeys.apps, (old: App[] | undefined) => {
        if (!old) return old;

        const newApp: App = {
          slug: data.app.slug,
          createdAt: data.app.createdAt,
          updateUrl: data.configuration.updateUrl,
          certificateStatus: "not_configured",
        };

        return [newApp, ...old];
      });
    },
  });
};

/**
 * Upload certificate for an app
 */
export const useUploadCertificate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slug,
      certificate,
      privateKey,
    }: {
      slug: string;
      certificate: string;
      privateKey: string;
    }) => api.uploadCertificate(slug, certificate, privateKey),
    onSuccess: (data: CertificateUploadResponse, variables) => {
      // Invalidate certificate query for this app
      queryClient.invalidateQueries({
        queryKey: queryKeys.certificate(variables.slug),
      });

      // Update apps list to reflect certificate status
      queryClient.setQueryData(queryKeys.apps, (old: App[] | undefined) => {
        if (!old) return old;

        return old.map((app) =>
          app.slug === variables.slug
            ? { ...app, certificateStatus: "configured" as const }
            : app
        );
      });
    },
  });
};

/**
 * Release an upload
 */
export const useReleaseUpload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, uploadId }: { slug: string; uploadId: string }) =>
      api.releaseUpload(slug, uploadId),
    onSuccess: (data, { slug }) => {
      // Invalidate uploads queries
      queryClient.invalidateQueries({ queryKey: queryKeys.uploads });

      // Invalidate app-specific uploads
      queryClient.invalidateQueries({
        queryKey: queryKeys.appUploads(slug),
      });

      // Invalidate the specific app query to update its statistics
      queryClient.invalidateQueries({
        queryKey: queryKeys.app(slug),
      });

      // Return cleanup info for UI feedback
      return data;
    },
  });
};

/**
 * Upload a new bundle
 */
export const useUploadBundle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      project,
      version,
      releaseChannel,
      options,
    }: {
      file: File;
      project: string;
      version: string;
      releaseChannel: string;
      options?: {
        uploadKey?: string;
        gitBranch?: string;
        gitCommit?: string;
      };
    }) => api.uploadBundle(file, project, version, releaseChannel, options),
    onSuccess: (_, variables) => {
      // Invalidate uploads queries
      queryClient.invalidateQueries({ queryKey: queryKeys.uploads });
      queryClient.invalidateQueries({
        queryKey: queryKeys.appUploads(variables.project),
      });
    },
  });
};

/**
 * Delete an app permanently
 */
export const useDeleteApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slug: string) => api.deleteApp(slug),
    onSuccess: (_, slug) => {
      // Invalidate and refetch apps list
      queryClient.invalidateQueries({ queryKey: queryKeys.apps });

      // Remove the deleted app from the cache
      queryClient.setQueryData(queryKeys.apps, (old: App[] | undefined) => {
        if (!old) return old;
        return old.filter((app) => app.slug !== slug);
      });

      // Remove app-specific queries from cache
      queryClient.removeQueries({ queryKey: queryKeys.app(slug) });
      queryClient.removeQueries({ queryKey: queryKeys.appUploads(slug) });
      queryClient.removeQueries({ queryKey: queryKeys.certificate(slug) });
    },
  });
};

// === DERIVED DATA HOOKS ===

/**
 * Get app statistics
 */
export const useAppStats = () => {
  const { data: apps = [] } = useApps();
  const { data: uploads = [] } = useUploads();

  return {
    totalApps: apps.length,
    totalUploads: uploads.length,
    appsWithCertificates: apps.filter(
      (app) => app.certificateStatus === "configured"
    ).length,
    releasedUploads: uploads.filter((upload) => upload.status === "released")
      .length,
    readyUploads: uploads.filter((upload) => upload.status === "ready").length,
  };
};

/**
 * Get app with its uploads combined
 */
export const useAppWithUploads = (slug: string) => {
  const { data: apps = [] } = useApps();
  const uploadsQuery = useAppUploads(slug);
  const { data: uploads = [] } = uploadsQuery;

  const app = apps.find((a) => a.slug === slug);

  return {
    app,
    uploads,
    ...uploadsQuery,
  };
};

/**
 * Update app settings
 */
export const useUpdateAppSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      slug,
      settings,
    }: {
      slug: string;
      settings: { autoCleanupEnabled: boolean };
    }) => api.updateAppSettings(slug, settings),
    onSuccess: (result, { slug, settings }) => {
      // Invalidate app queries to refresh the settings
      queryClient.invalidateQueries({ queryKey: queryKeys.app(slug) });
      queryClient.invalidateQueries({ queryKey: queryKeys.apps });

      toast.success("Settings updated successfully", {
        description: `Auto cleanup ${
          settings.autoCleanupEnabled ? "enabled" : "disabled"
        }`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to update settings", {
        description: error.message,
      });
    },
  });
};
