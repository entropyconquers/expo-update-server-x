"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAppStats, useApps, useUploads } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import {
  Package,
  Shield,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { SkeletonStats, Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const {
    data: apps = [],
    isLoading: appsLoading,
    error: appsError,
  } = useApps();
  const {
    data: uploads = [],
    isLoading: uploadsLoading,
    error: uploadsError,
  } = useUploads();
  const stats = useAppStats();

  const isLoading = appsLoading || uploadsLoading;
  const hasError = appsError || uploadsError;

  const recentUploads = uploads
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 4);

  const recentApps = apps
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 4);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your Expo app updates
          </p>
        </div>

        {/* Error State */}
        {hasError && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {appsError instanceof ApiError
                    ? `Failed to load apps: ${appsError.message}`
                    : uploadsError instanceof ApiError
                    ? `Failed to load uploads: ${uploadsError.message}`
                    : "Failed to load data. Please check if the server is running."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid with Loading */}
        {isLoading ? (
          <SkeletonStats count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-sm transition-shadow cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Apps
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.totalApps}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Registered applications
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Updates
                </CardTitle>
                <Upload className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {stats.totalUploads}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.releasedUploads} released • {stats.readyUploads} ready
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Code Signing
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {stats.appsWithCertificates}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apps with certificates
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-sm transition-shadow cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Activity
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {recentUploads.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recent uploads
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Apps */}
          <Card className="hover:shadow-sm transition-shadow pb-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Apps</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Your latest registered applications
                </p>
              </div>
              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer"
                >
                  <Link href="/apps">
                    View all
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-0">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center space-x-4 px-6 py-4 border-b last:border-b-0"
                    >
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentApps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No apps yet
                  </p>
                  <Button size="sm" asChild className="cursor-pointer">
                    <Link href="/apps/new">Register App</Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {recentApps.map((app) => (
                    <Link
                      key={app.slug}
                      href={`/apps/${app.slug}`}
                      className="flex items-center space-x-4 px-6 py-4 hover:bg-muted/30 transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-sm font-semibold border shadow-sm">
                        {(app.name || app.slug).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {app.name || app.slug}
                          </p>
                          {app.name && app.name !== app.slug && (
                            <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {app.slug}
                            </code>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(app.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge
                          variant="outline"
                          className={
                            app.certificateStatus === "configured"
                              ? "text-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "text-xs border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                          }
                        >
                          {app.certificateStatus === "configured" ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                              Signed
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                              Setup
                            </>
                          )}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Updates */}
          <Card className="hover:shadow-sm transition-shadow pb-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Updates</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Latest app updates and releases
                </p>
              </div>
              {!isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer"
                >
                  <Link href="/apps">
                    View all
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-0">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center space-x-4 px-6 py-4 border-b last:border-b-0"
                    >
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recentUploads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No updates yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updates will appear here after you publish them
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentUploads.map((upload) => (
                    <div
                      key={upload.id}
                      className="flex items-center space-x-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border shadow-sm">
                        {upload.status === "released" ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : upload.status === "ready" ? (
                          <Clock className="h-4 w-4 text-amber-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-400 opacity-50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium truncate">
                            {upload.project}
                          </p>
                          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            v{upload.version}
                          </code>
                        </div>
                        <div className="flex items-center space-x-3 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(upload.createdAt), {
                              addSuffix: true,
                            })}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            •
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {upload.releaseChannel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Badge
                          variant="outline"
                          className={
                            upload.status === "released"
                              ? "text-xs border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : upload.status === "ready"
                              ? "text-xs border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                              : "text-xs border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400"
                          }
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              upload.status === "released"
                                ? "bg-emerald-500"
                                : upload.status === "ready"
                                ? "bg-amber-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {upload.status === "released"
                            ? "Released"
                            : upload.status === "ready"
                            ? "Ready"
                            : "Obsolete"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions with Loading */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Common tasks to get you started
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-lg border">
                    <div className="flex flex-col items-center justify-center h-full space-y-2">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="text-center space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  asChild
                  className="h-auto p-4 cursor-pointer"
                >
                  <Link href="/apps">
                    <div className="flex flex-col items-center space-y-2">
                      <Package className="h-5 w-5" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Manage Apps</p>
                        <p className="text-xs text-muted-foreground">
                          View and configure your apps
                        </p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  asChild
                  className="h-auto p-4 cursor-pointer"
                >
                  <Link href="/settings">
                    <div className="flex flex-col items-center space-y-2">
                      <Shield className="h-5 w-5" />
                      <div className="text-center">
                        <p className="text-sm font-medium">Settings</p>
                        <p className="text-xs text-muted-foreground">
                          Configure server settings
                        </p>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
