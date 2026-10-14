"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const full = url.startsWith("http") ? url : typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-secondary px-3 py-2 font-mono text-xs">{full}</code>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Copy link"
        onClick={async () => {
          await navigator.clipboard.writeText(full);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </div>
  );
}
