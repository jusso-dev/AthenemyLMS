"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingPortalButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Billing portal is unavailable.");
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing portal is unavailable.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={openPortal}
      >
        <CreditCard className="h-4 w-4" />
        {pending ? "Opening..." : "Open billing portal"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
