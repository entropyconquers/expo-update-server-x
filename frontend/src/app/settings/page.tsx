"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Settings as SettingsIcon,
  Server,
  Shield,
  Globe,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Copy,
  RefreshCw,
  Loader2,
  Save,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { copyToClipboard } from "@/lib/utils";
import { toast } from "sonner";

interface ServerInfo {
  version: string;
  status: "online" | "offline";
  uptime: string;
  environment: "development" | "production";
  database: {
    status: "connected" | "disconnected";
    tables: number;
    lastBackup?: string;
  };
  features: {
    codeSigning: boolean;
    autoUpdates: boolean;
    analytics: boolean;
  };
}

export default function SettingsPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    autoUpdates: true,
    analytics: false,
    notifications: true,
    debugMode: false,
  });

  useEffect(() => {
    const fetchServerInfo = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Simulate API call - replace with actual endpoint
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const mockServerInfo: ServerInfo = {
          version: "1.0.0",
          status: "online",
          uptime: "2 days, 14 hours",
          environment: "development",
          database: {
            status: "connected",
            tables: 3,
            lastBackup: new Date(
              Date.now() - 24 * 60 * 60 * 1000
            ).toISOString(),
          },
          features: {
            codeSigning: true,
            autoUpdates: true,
            analytics: false,
          },
        };

        setServerInfo(mockServerInfo);
        setSettings({
          autoUpdates: mockServerInfo.features.autoUpdates,
          analytics: mockServerInfo.features.analytics,
          notifications: true,
          debugMode: mockServerInfo.environment === "development",
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load server information"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchServerInfo();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate refresh
      await new Promise((resolve) => setTimeout(resolve, 500));
      // In real app, refetch server info here
      toast.success("Settings refreshed");
    } catch {
      toast.error("Failed to refresh settings");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Simulate save operation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In real app, save settings to server here
      toast.success("Settings saved successfully!", {
        description: "Your preferences have been updated",
      });
    } catch {
      toast.error("Failed to save settings", {
        description: "Please try again",
      });
    } finally {
      setIsSaving(false);
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

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Server Status Skeleton */}
          <div className="grid gap-6 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Settings Sections Skeleton */}
          <div className="grid gap-6 lg:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6" />
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
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
                  Failed to load settings
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure your Expo update server and manage system preferences
            </p>
          </div>
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
        </div>

        {/* Server Status */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Server className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Server Status</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    System health and uptime
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.status === "online"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                    }
                  >
                    {serverInfo?.status === "online" ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Online
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Offline
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <span className="text-sm font-mono">
                    {serverInfo?.version}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Uptime</span>
                  <span className="text-sm">{serverInfo?.uptime}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Environment
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.environment === "production"
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-400"
                    }
                  >
                    {serverInfo?.environment}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Database</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Storage and data management
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.database.status === "connected"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                    }
                  >
                    {serverInfo?.database.status === "connected" ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Disconnected
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Tables</span>
                  <span className="text-sm">{serverInfo?.database.tables}</span>
                </div>
                {serverInfo?.database.lastBackup && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Last Backup
                    </span>
                    <span className="text-sm">
                      {new Date(
                        serverInfo.database.lastBackup
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-base">Features</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Available capabilities
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Code Signing
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.features.codeSigning
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                    }
                  >
                    {serverInfo?.features.codeSigning ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Auto Updates
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.features.autoUpdates
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                    }
                  >
                    {serverInfo?.features.autoUpdates ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Analytics
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      serverInfo?.features.analytics
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400"
                        : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
                    }
                  >
                    {serverInfo?.features.analytics ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Server Configuration */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Server Configuration
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Network and endpoint settings
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">
                  API Endpoint
                </Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={apiUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyToClipboard(apiUrl, "API URL")}
                    className="cursor-pointer"
                  >
                    {copiedField === "apiUrl" ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Auto Updates</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically process uploaded updates
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoUpdates}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, autoUpdates: checked }))
                    }
                    className="cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Debug Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable detailed logging and debug information
                    </p>
                  </div>
                  <Switch
                    checked={settings.debugMode}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, debugMode: checked }))
                    }
                    className="cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Security</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Authentication and security preferences
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Require Code Signing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enforce certificate validation for all updates
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Audit Logging</Label>
                    <p className="text-xs text-muted-foreground">
                      Log all administrative actions
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Rate Limiting</Label>
                    <p className="text-xs text-muted-foreground">
                      Protect against excessive API requests
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics & Monitoring */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">
                    Analytics & Monitoring
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Usage tracking and performance monitoring
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Analytics</Label>
                    <p className="text-xs text-muted-foreground">
                      Collect usage statistics and metrics
                    </p>
                  </div>
                  <Switch
                    checked={settings.analytics}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({ ...prev, analytics: checked }))
                    }
                    className="cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Performance Monitoring
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Track server performance and response times
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Error Reporting
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically report errors and issues
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Notifications</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure alert and notification preferences
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      System Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive alerts about system events
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications}
                    onCheckedChange={(checked) =>
                      setSettings((prev) => ({
                        ...prev,
                        notifications: checked,
                      }))
                    }
                    className="cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">
                      Update Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified when new updates are uploaded
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Error Alerts</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive alerts when errors occur
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    className="cursor-not-allowed"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Settings */}
        <div className="flex justify-end">
          <Button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
