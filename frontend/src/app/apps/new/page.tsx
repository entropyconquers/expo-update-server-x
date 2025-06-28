"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/dashboard-layout";
import { api } from "@/lib/api";
import { Package, CheckCircle, Shield, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface FormData {
  slug: string;
  name: string;
  description: string;
  ownerEmail: string;
}

interface FormErrors {
  slug?: string;
  name?: string;
  description?: string;
  ownerEmail?: string;
  submit?: string;
}

export default function NewAppPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    slug: "",
    name: "",
    description: "",
    ownerEmail: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.slug.trim()) {
      newErrors.slug = "App slug is required";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug =
        "Slug can only contain lowercase letters, numbers, and hyphens";
    }

    if (!formData.name.trim()) {
      newErrors.name = "App name is required";
    }

    if (!formData.ownerEmail.trim()) {
      newErrors.ownerEmail = "Owner email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail)) {
      newErrors.ownerEmail = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await api.registerApp(
        formData.slug,
        formData.name,
        formData.description,
        formData.ownerEmail
      );

      setIsSuccess(true);
      toast.success("App registered successfully!", {
        description: `${formData.name} is ready for configuration`,
      });

      // Navigate to the app page after a brief delay
      setTimeout(() => {
        setIsPageLoading(true);
        router.push(`/apps/${formData.slug}`);
      }, 2000);
    } catch (error) {
      console.error("Failed to register app:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to register app";
      toast.error("Failed to register app", {
        description: errorMessage,
      });
      setErrors({
        submit: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isPageLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>

          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (isSuccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50">
            <CardContent className="p-8">
              <div className="text-center space-y-6">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    App Registered Successfully!
                  </h1>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Your app <strong>{formData.slug}</strong> has been
                    registered and is ready for configuration.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Redirecting to app dashboard...</span>
                  </div>

                  <div className="pt-4">
                    <Button
                      asChild
                      variant="outline"
                      className="cursor-pointer"
                    >
                      <Link href={`/apps/${formData.slug}`}>
                        Go to App Dashboard
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Register New App
            </h1>
            <p className="text-muted-foreground">
              Register your Expo application to start managing updates and
              deployments.
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Application Details</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Provide basic information about your Expo application
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">App Slug *</Label>
                  <Input
                    id="slug"
                    type="text"
                    placeholder="my-awesome-app"
                    value={formData.slug}
                    onChange={(e) => handleInputChange("slug", e.target.value)}
                    disabled={isSubmitting}
                    className={`font-mono ${
                      errors.slug ? "border-red-300 focus:border-red-500" : ""
                    }`}
                  />
                  {errors.slug && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.slug}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for your app (lowercase, numbers, and
                    hyphens only)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">App Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="My Awesome App"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={isSubmitting}
                    className={
                      errors.name ? "border-red-300 focus:border-red-500" : ""
                    }
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    placeholder="A brief description of your app"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    disabled={isSubmitting}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.description}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Owner Email *</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.ownerEmail}
                    onChange={(e) =>
                      handleInputChange("ownerEmail", e.target.value)
                    }
                    disabled={isSubmitting}
                    className={`font-mono ${
                      errors.ownerEmail
                        ? "border-red-300 focus:border-red-500"
                        : ""
                    }`}
                  />
                  {errors.ownerEmail && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {errors.ownerEmail}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {errors.submit}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering App...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Register App
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Next Steps Preview */}
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base">Next Steps</CardTitle>
            <p className="text-sm text-muted-foreground">
              After registration, you&apos;ll be able to:
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">
                  Configure code signing certificates
                </span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">
                  Upload and manage app updates
                </span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="text-muted-foreground">
                  Deploy updates to your users
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
