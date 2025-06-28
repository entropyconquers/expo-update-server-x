import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe clipboard function that handles browser compatibility and shows toast
export async function copyToClipboard(
  text: string,
  successMessage?: string
): Promise<boolean> {
  try {
    // Check if clipboard API is available
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage || "Copied to clipboard!");
      return true;
    }

    // Fallback for older browsers or unsecure contexts
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      toast.success(successMessage || "Copied to clipboard!");
      return true;
    } else {
      throw new Error("Copy command failed");
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    toast.error("Failed to copy to clipboard");
    return false;
  }
}
