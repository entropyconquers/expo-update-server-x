"use client";

import { useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CertificateManager } from "@/components/certificate-manager";
import {
  useApp,
  useUploads,
  useReleaseUpload,
  useDeleteApp,
  useUpdateAppSettings,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import {
  Shield,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Activity,
  TrendingUp,
  Loader2,
  Copy,
  RefreshCw,
  Trash2,
  Info,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

interface AppPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function AppPage({ params }: AppPageProps) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultTab = searchParams?.get("tab") || "overview";

  const {
    data: app,
    isLoading: appLoading,
    error: appError,
    refetch: refetchApp,
  } = useApp(resolvedParams.slug);
  const {
    data: uploads = [],
    isLoading: uploadsLoading,
    error: uploadsError,
    refetch: refetchUploads,
  } = useUploads();
  const releaseUploadMutation = useReleaseUpload();
  const deleteAppMutation = useDeleteApp();
  const updateSettingsMutation = useUpdateAppSettings();

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [releasingUploadId, setReleasingUploadId] = useState<string | null>(
    null
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const appUploads = uploads.filter(
    (upload) => upload.project === resolvedParams.slug
  );
  const isLoading = appLoading || uploadsLoading;
  const hasError = appError || uploadsError;

  const handleReleaseUpload = async (uploadId: string) => {
    setReleasingUploadId(uploadId);
    try {
      const result = await releaseUploadMutation.mutateAsync({
        slug: resolvedParams.slug,
        uploadId,
      });
      await refetchUploads();

      // Show success message with cleanup info if applicable
      if (result.cleanup && result.cleanup.deletedCount > 0) {
        toast.success("Update released successfully!", {
          description: `The update is now live for your users. Cleaned up ${result.cleanup.deletedCount} obsolete updates (freed ${result.cleanup.freedSpaceMB}MB)`,
          duration: 6000, // Show longer for cleanup info
        });
      } else {
        toast.success("Update released successfully!", {
          description: "The update is now live for your users",
        });
      }
    } catch (error) {
      console.error("Failed to release upload:", error);
      toast.error("Failed to release update", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setReleasingUploadId(null);
    }
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    const success = await copyToClipboard(
      text,
      `${field} copied to clipboard!`
    );
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchApp(), refetchUploads()]);
      toast.success("Data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteApp = async () => {
    if (deleteConfirmText !== resolvedParams.slug) {
      toast.error("Please type the app slug to confirm deletion");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAppMutation.mutateAsync(resolvedParams.slug);

      // Set deletion state to prevent error UI from showing
      setIsDeleted(true);

      toast.success(`App "${resolvedParams.slug}" has been deleted`, {
        description: "Redirecting to apps list...",
      });

      // Close modal immediately
      setShowDeleteModal(false);

      // Redirect immediately using Next.js router
      router.push("/apps");
    } catch (error) {
      console.error("Failed to delete app:", error);
      toast.error("Failed to delete app", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
      setIsDeleting(false);
    }
  };

  const resetDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    setIsDeleting(false);
  };

  const handleToggleAutoCleanup = async (enabled: boolean) => {
    try {
      await updateSettingsMutation.mutateAsync({
        slug: resolvedParams.slug,
        settings: {
          autoCleanupEnabled: enabled,
        },
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
      // Error toast is handled by the mutation
    }
  };

  // Show loading state if app is being deleted
  if (isDeleted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">App Deleted Successfully</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to apps list...
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Loading state for entire page
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col space-y-6 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>

              {/* Description skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-2xl" />
                <Skeleton className="h-4 w-3/4 max-w-xl" />
              </div>

              {/* Metadata skeleton */}
              <div className="flex items-center space-x-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="hover:shadow-sm transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs Skeleton */}
          <div className="space-y-6">
            <div className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4 h-10 bg-muted rounded-md p-1">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-sm" />
              ))}
            </div>

            {/* Tab Content Skeleton */}
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {[...Array(2)].map((_, i) => (
                  <Card key={i} className="hover:shadow-sm transition-shadow">
                    <CardHeader>
                      <Skeleton className="h-5 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        {[...Array(3)].map((_, j) => (
                          <div
                            key={j}
                            className="flex justify-between items-center"
                          >
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state (but not if we're in the middle of deletion)
  if (hasError && !isDeleted) {
    return (
      <DashboardLayout>
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-red-900 dark:text-red-100">
                  Failed to load app data
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {appError instanceof ApiError
                    ? appError.message
                    : uploadsError instanceof ApiError
                    ? uploadsError.message
                    : "Unable to connect to the server. Please check your connection and try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="mt-3 cursor-pointer"
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!app) {
    return (
      <DashboardLayout>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium text-amber-900 dark:text-amber-100">
                  App not found
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The app &quot;{resolvedParams.slug}&quot; could not be found.
                  It may have been removed or the URL is incorrect.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-6 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-foreground font-semibold text-xl border shadow-sm">
                  {(app.name || app.slug).charAt(0).toUpperCase()}
                </div>
                {app.certificateStatus === "configured" && (
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center shadow-sm">
                    <Shield className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {app.name || app.slug}
                  </h1>
                  <Badge
                    variant="outline"
                    className={
                      app.certificateStatus === "configured"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                    }
                  >
                    {app.certificateStatus === "configured" ? (
                      <>
                        <Shield className="w-3 h-3 mr-1" />
                        Production Ready
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Setup Required
                      </>
                    )}
                  </Badge>
                </div>

                {/* Show slug if different from name */}
                {app.name && app.name !== app.slug && (
                  <p className="text-sm text-muted-foreground font-mono">
                    {app.slug}
                  </p>
                )}
              </div>
            </div>

            {/* App Description */}
            {app.description && (
              <p className="text-muted-foreground max-w-2xl leading-relaxed">
                {app.description}
              </p>
            )}

            {/* Metadata */}
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span>
                  Created{" "}
                  {formatDistanceToNow(new Date(app.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {app.ownerEmail && (
                <div className="flex items-center space-x-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  <span className="font-mono">{app.ownerEmail}</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                <span>Update endpoint ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="cursor-pointer"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            {app.certificateStatus === "not_configured" ? (
              <Button
                size="sm"
                onClick={() => setActiveTab("certificates")}
                className="cursor-pointer"
              >
                <Shield className="w-4 h-4 mr-1" />
                Setup Certificate
              </Button>
            ) : (
              <Button size="sm" asChild className="cursor-pointer">
                <a
                  href={app.updateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  View Updates
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-sm transition-shadow cursor-default">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Updates
              </CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {app.statistics?.totalUploads || appUploads.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {app.statistics?.releasedUploads ||
                  appUploads.filter((u) => u.status === "released").length}{" "}
                released
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow cursor-default">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Certificate Status
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {app.certificateStatus === "configured" ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Ready
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Code signing status
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow cursor-default">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Update
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {app.statistics?.lastUpdate
                  ? formatDistanceToNow(new Date(app.statistics.lastUpdate), {
                      addSuffix: true,
                    })
                  : appUploads.length > 0
                  ? formatDistanceToNow(new Date(appUploads[0].createdAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Latest deployment
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow cursor-default">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                App Status
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {app.certificateStatus === "configured" &&
                appUploads.length > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="text-muted-foreground">Setup</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Deployment status
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="overview" className="cursor-pointer">
              Overview
            </TabsTrigger>
            <TabsTrigger value="uploads" className="cursor-pointer">
              Updates
            </TabsTrigger>
            <TabsTrigger value="certificates" className="cursor-pointer">
              Certificates
            </TabsTrigger>
            <TabsTrigger value="settings" className="cursor-pointer">
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* App Information */}
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">App Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Slug
                      </span>
                      <span className="text-sm font-mono">{app.slug}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Created
                      </span>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(app.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Status
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          app.certificateStatus === "configured"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                        }
                      >
                        {app.certificateStatus === "configured"
                          ? "Production Ready"
                          : "Setup Required"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {app.certificateStatus === "not_configured" ? (
                    <Button
                      onClick={() => setActiveTab("certificates")}
                      className="w-full justify-start cursor-pointer"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Setup Code Signing Certificate
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("uploads")}
                      className="w-full justify-start cursor-pointer"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      View Updates
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    asChild
                    className="w-full justify-start cursor-pointer"
                  >
                    <a
                      href={app.updateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Update URL
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Recent Updates */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Updates</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Latest app updates and releases
                  </p>
                </div>
                {appUploads.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("uploads")}
                    className="cursor-pointer"
                  >
                    View All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {appUploads.length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No updates uploaded yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appUploads.slice(0, 3).map((upload) => (
                      <div
                        key={upload.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            {upload.status === "released" ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {upload.version}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(upload.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            upload.status === "released"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : upload.status === "ready"
                              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                              : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
                          }
                        >
                          {upload.status === "released"
                            ? "Released"
                            : upload.status === "ready"
                            ? "Ready"
                            : "Obsolete"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Updates Tab */}
          <TabsContent value="uploads" className="space-y-6">
            {/* Cleanup Info */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Automatic Cleanup
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    When you release a new update, obsolete updates beyond the
                    latest 30 are automatically deleted to save storage space.
                  </p>
                </div>
              </div>
            </div>

            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">App Updates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage and release your app updates
                </p>
              </CardHeader>
              <CardContent>
                {uploadsLoading ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3">
                              <Skeleton className="h-4 w-16" />
                            </th>
                            <th className="pb-3">
                              <Skeleton className="h-4 w-16" />
                            </th>
                            <th className="pb-3">
                              <Skeleton className="h-4 w-16" />
                            </th>
                            <th className="pb-3">
                              <Skeleton className="h-4 w-12" />
                            </th>
                            <th className="pb-3">
                              <Skeleton className="h-4 w-16" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...Array(5)].map((_, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-3">
                                <Skeleton className="h-4 w-20" />
                              </td>
                              <td className="py-3">
                                <Skeleton className="h-4 w-24" />
                              </td>
                              <td className="py-3">
                                <Skeleton className="h-4 w-28" />
                              </td>
                              <td className="py-3">
                                <Skeleton className="h-5 w-16 rounded-full" />
                              </td>
                              <td className="py-3">
                                <Skeleton className="h-8 w-20" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : appUploads.length === 0 ? (
                  <div className="text-center py-12">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No updates yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                      Upload your first update using the Expo CLI or publish
                      script.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg text-left">
                        <p className="text-xs text-muted-foreground mb-2">
                          Example command:
                        </p>
                        <code className="text-sm">
                          eas update --branch production --message &quot;Initial
                          release&quot;
                        </code>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-3 text-sm font-medium text-muted-foreground">
                              Version
                            </th>
                            <th className="pb-3 text-sm font-medium text-muted-foreground">
                              Channel
                            </th>
                            <th className="pb-3 text-sm font-medium text-muted-foreground">
                              Created
                            </th>
                            <th className="pb-3 text-sm font-medium text-muted-foreground">
                              Status
                            </th>
                            <th className="pb-3 text-sm font-medium text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="space-y-2">
                          {appUploads.map((upload) => (
                            <tr
                              key={upload.id}
                              className="border-b last:border-0"
                            >
                              <td className="py-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium">
                                    {upload.version}
                                  </span>
                                  {upload.gitCommit && (
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                      {upload.gitCommit.slice(0, 7)}
                                    </code>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <span className="text-sm">
                                  {upload.releaseChannel}
                                </span>
                              </td>
                              <td className="py-3">
                                <span className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(upload.createdAt),
                                    { addSuffix: true }
                                  )}
                                </span>
                              </td>
                              <td className="py-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    upload.status === "released"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                                      : upload.status === "ready"
                                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                                      : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
                                  }
                                >
                                  {upload.status === "released" ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Released
                                    </>
                                  ) : upload.status === "ready" ? (
                                    <>
                                      <Clock className="w-3 h-3 mr-1" />
                                      Ready
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3 mr-1 opacity-50" />
                                      Obsolete
                                    </>
                                  )}
                                </Badge>
                              </td>
                              <td className="py-3">
                                {upload.status === "ready" && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      handleReleaseUpload(upload.id)
                                    }
                                    disabled={releasingUploadId !== null}
                                    className="cursor-pointer"
                                  >
                                    {releasingUploadId === upload.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Release
                                      </>
                                    )}
                                  </Button>
                                )}
                                {upload.status === "obsolete" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleReleaseUpload(upload.id)
                                    }
                                    disabled={releasingUploadId !== null}
                                    className="cursor-pointer"
                                  >
                                    {releasingUploadId === upload.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="w-4 h-4 mr-1" />
                                        Rollback
                                      </>
                                    )}
                                  </Button>
                                )}
                                {upload.status === "released" && (
                                  <span className="text-xs text-muted-foreground">
                                    Released{" "}
                                    {upload.releasedAt &&
                                      formatDistanceToNow(
                                        new Date(upload.releasedAt),
                                        { addSuffix: true }
                                      )}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates" className="space-y-6">
            <CertificateManager
              appSlug={app.slug}
              certificateStatus={app.certificateStatus}
              onCertificateUploaded={refetchApp}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* URLs */}
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">App URLs</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Important URLs for your application
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Update URL
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={app.updateUrl}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopyToClipboard(app.updateUrl, "Update URL")
                          }
                          className="cursor-pointer"
                        >
                          {copiedField === "updateUrl" ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {app.urls?.manifest && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Manifest URL
                        </Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            value={app.urls.manifest}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleCopyToClipboard(
                                app.urls!.manifest,
                                "Manifest URL"
                              )
                            }
                            className="cursor-pointer"
                          >
                            {copiedField === "manifestUrl" ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* App Details */}
              <Card className="hover:shadow-sm transition-shadow">
                <CardHeader>
                  <CardTitle className="text-base">App Details</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Application information and metadata
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Slug
                      </Label>
                      <p className="text-sm font-mono mt-1">{app.slug}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Created
                      </Label>
                      <p className="text-sm mt-1">
                        {new Date(app.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {app.updatedAt && (
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Last Updated
                        </Label>
                        <p className="text-sm mt-1">
                          {formatDistanceToNow(new Date(app.updatedAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* App Settings */}
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader>
                <CardTitle className="text-base">App Settings</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure app behavior and preferences
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="text-sm font-medium">Auto Cleanup</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically remove obsolete updates beyond the latest 30
                      when releasing new updates
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    {updateSettingsMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                      checked={app.settings?.autoCleanupEnabled ?? true}
                      onCheckedChange={handleToggleAutoCleanup}
                      disabled={updateSettingsMutation.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-200 bg-red-50/30 dark:border-red-800/50 dark:bg-red-950/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-base text-red-900 dark:text-red-100">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span>Danger Zone</span>
                </CardTitle>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Irreversible and destructive actions
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-background p-4 dark:border-red-800/50">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-foreground">
                      Delete this application
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this app, all its updates,
                      certificates, and data. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    className="ml-4 cursor-pointer"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete App
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete App Modal */}
      <Dialog open={showDeleteModal} onOpenChange={resetDeleteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center space-x-2 text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <span>Delete Application</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action cannot be undone. This will permanently delete the
              app, all its updates, certificates, and data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
              <p className="mb-3 text-sm font-medium text-red-800 dark:text-red-200">
                Please type{" "}
                <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs text-red-900 dark:bg-red-900/40 dark:text-red-100">
                  {resolvedParams.slug}
                </code>{" "}
                to confirm:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={resolvedParams.slug}
                className="font-mono border-red-300 focus:border-red-400 focus:ring-red-400 dark:border-red-700 dark:focus:border-red-600 dark:focus:ring-red-600"
                disabled={isDeleting}
              />
            </div>
          </div>

          <DialogFooter className="gap-3 pt-4">
            <Button
              variant="outline"
              onClick={resetDeleteModal}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteApp}
              disabled={isDeleting || deleteConfirmText !== resolvedParams.slug}
              className="flex-1 cursor-pointer"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete App
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
