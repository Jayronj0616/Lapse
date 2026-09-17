"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * A credential shown in full, with one click to copy it.
 *
 * Deliberately not hidden behind a "reveal" or a modal. Anything that makes a
 * visitor work to get into a demo loses most of them, and there is nothing to
 * protect here — the account exists to be used by strangers.
 */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused. The value is visible either way.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {copied ? (
          <Check className="size-4 text-status-ok" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
    </div>
  );
}
