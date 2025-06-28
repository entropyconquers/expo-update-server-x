"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useApps } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import {
  Package,
  Plus,
  Shield,
  AlertCircle,
  Search,
  MoreHorizontal,
  Settings,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SkeletonStats,
  SkeletonList,
  Skeleton,
} from "@/components/ui/skeleton";

export default function AppsPage() {
  const { data: apps = [], isLoading, error } = useApps();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredApps = apps.filter((app) => {
    const query = searchQuery.toLowerCase();
    return (
      app.slug.toLowerCase().includes(query) ||
      (app.name && app.name.toLowerCase().includes(query)) ||
      (app.description && app.description.toLowerCase().includes(query)) ||
      (app.ownerEmail && app.ownerEmail.toLowerCase().includes(query))
    );
  });

  const signedApps = apps.filter(
    (app) => app.certificateStatus === "configured"
  );
  const unsignedApps = apps.filter(
    (app) => app.certificateStatus === "not_configured"
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Refined Header */}
        <div className="space-y-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
              <p className="text-muted-foreground max-w-2xl">
                Manage and deploy your Expo applications with secure code
                signing.
              </p>
            </div>
            <Button asChild size="default" className="w-fit cursor-pointer">
              <Link href="/apps/new">
                <Plus className="mr-2 h-4 w-4" />
                Register App
              </Link>
            </Button>
          </div>

          {/* Stats with Loading States */}
          {isLoading ? (
            <SkeletonStats count={3} />
          ) : !error && apps.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="hover:shadow-sm transition-shadow cursor-default">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Total Applications
                      </p>
                      <p className="text-2xl font-semibold">{apps.length}</p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow cursor-default">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Code Signed
                      </p>
                      <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                        {signedApps.length}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-sm transition-shadow cursor-default">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Needs Setup
                      </p>
                      <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                        {unsignedApps.length}
                      </p>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-red-900 dark:text-red-100">
                    Failed to load applications
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {error instanceof ApiError
                      ? error.message
                      : "Unable to connect to the server. Please check your connection and try again."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search with Loading State */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Input
                placeholder="Search by name, slug, description, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <SkeletonList count={4} />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredApps.length === 0 && (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              {searchQuery ? (
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No apps found</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      We couldn&apos;t find any applications matching &quot;
                      {searchQuery}&quot;.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="cursor-pointer"
                  >
                    Clear search
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">
                      No applications yet
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Get started by registering your first Expo application.
                    </p>
                  </div>
                  <Button asChild className="cursor-pointer">
                    <Link href="/apps/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Register Your First App
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Apps List - Enhanced Design */}
        {!isLoading && !error && filteredApps.length > 0 && (
          <div className="space-y-4">
            {filteredApps.map((app) => (
              <Card
                key={app.slug}
                className="group hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-transparent hover:border-l-primary/30"
                onClick={() => (window.location.href = `/apps/${app.slug}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.location.href = `/apps/${app.slug}`;
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* App Icon */}
                    <div className="relative flex-shrink-0">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-foreground font-semibold text-lg border shadow-sm">
                        {app.name
                          ? app.name.charAt(0).toUpperCase()
                          : app.slug.charAt(0).toUpperCase()}
                      </div>
                      {app.certificateStatus === "configured" && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center shadow-sm">
                          <Shield className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* App Information */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Header with Name and Status */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-xl font-semibold truncate group-hover:text-primary transition-colors">
                              {app.name || app.slug}
                            </h3>
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
                                  <AlertCircle className="w-3 h-3 mr-1" />
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

                          {/* Description if available */}
                          {app.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl leading-relaxed">
                              {app.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center space-x-2 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="cursor-pointer"
                          >
                            <Link href={`/apps/${app.slug}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>

                          {app.certificateStatus === "not_configured" && (
                            <Button
                              size="sm"
                              asChild
                              className="cursor-pointer"
                            >
                              <Link href={`/apps/${app.slug}?tab=certificates`}>
                                <Shield className="w-4 h-4 mr-1" />
                                Setup
                              </Link>
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 cursor-pointer"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer"
                              >
                                <Link href={`/apps/${app.slug}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                asChild
                                className="cursor-pointer"
                              >
                                <Link href={`/apps/${app.slug}?tab=settings`}>
                                  <Settings className="h-4 w-4 mr-2" />
                                  Settings
                                </Link>
                              </DropdownMenuItem>
                              {app.certificateStatus === "not_configured" && (
                                <DropdownMenuItem
                                  asChild
                                  className="cursor-pointer"
                                >
                                  <Link
                                    href={`/apps/${app.slug}?tab=certificates`}
                                  >
                                    <Shield className="h-4 w-4 mr-2" />
                                    Configure Certificate
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Metadata Row */}
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
                            <span className="font-mono text-xs">
                              {app.ownerEmail}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center space-x-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
                          <span>Update endpoint ready</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
