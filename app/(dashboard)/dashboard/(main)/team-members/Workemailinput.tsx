"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { checkEmailAvailability } from "./actions";

interface WorkEmailInputProps {
  value: string;                          // full email e.g. "mayank.sharma@dreamsyatri.com"
  onChange: (fullEmail: string) => void;  // always emits full email
  disabled?: boolean;
  excludeId?: string;                     // pass member.id when editing to skip self-check
}

const DOMAIN  = "@dreamsyatri.com";
const DEBOUNCE = 500; // ms

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

function getPrefix(full: string) {
  return full.endsWith(DOMAIN) ? full.slice(0, -DOMAIN.length) : full;
}

export function WorkEmailInput({ value, onChange, disabled, excludeId }: WorkEmailInputProps) {
  const [prefix, setPrefix]   = useState(getPrefix(value));
  const [status, setStatus]   = useState<Status>("idle");
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef             = useRef<string>("");   // track latest query to ignore stale responses

  // Keep prefix in sync if parent resets the value
  useEffect(() => {
    const incoming = getPrefix(value);
    if (incoming !== prefix) setPrefix(incoming);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (raw: string) => {
    // Strip spaces, @, and the domain if pasted accidentally
    const cleaned = raw.replace(/\s/g, "").replace(/@.*$/, "").toLowerCase();
    setPrefix(cleaned);
    onChange(cleaned ? `${cleaned}${DOMAIN}` : "");

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!cleaned) { setStatus("idle"); return; }

    // Basic local format check before hitting the server
    const localValid = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(cleaned);
    if (!localValid) { setStatus("invalid"); return; }

    setStatus("checking");
    latestRef.current = cleaned;

    timerRef.current = setTimeout(async () => {
      const query = cleaned;
      try {
        const result = await checkEmailAvailability(`${query}${DOMAIN}`, excludeId);
        // Ignore if the user has already typed something different
        if (latestRef.current !== query) return;
        setStatus(result.available ? "available" : "taken");
      } catch {
        if (latestRef.current === query) setStatus("idle");
      }
    }, DEBOUNCE);
  };

  // Colours & icons per status
  const borderClass =
    status === "available" ? "border-green-500 focus-visible:ring-green-400/30" :
    status === "taken"     ? "border-red-500   focus-visible:ring-red-400/30"   :
    status === "invalid"   ? "border-orange-400 focus-visible:ring-orange-400/30" : "";

  return (
    <div className="grid gap-1.5">
      <Label className="text-sm font-medium text-dashboard-base-content">
        Work email <span className="text-dashboard-error ml-0.5">*</span>
      </Label>

      {/* Input + suffix badge */}
      <div className={`flex items-stretch rounded-md border bg-background ring-offset-background transition-colors
        
        ${borderClass || "border-input"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {/* Prefix */}
        <input
          type="text"
          value={prefix}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder="mayank.sharma"
          spellCheck={false}
          autoCapitalize="none"
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {/* Status icon */}
        <div className="flex items-center px-2 shrink-0">
          {status === "checking"  && <Loader2     className="h-4 w-4 animate-spin text-muted-foreground" />}
          {status === "available" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          {status === "taken"     && <XCircle      className="h-4 w-4 text-red-500" />}
        </div>

        {/* Domain suffix */}
        <div className="flex items-center rounded-r-md border-l bg-muted/60 px-3 text-sm text-muted-foreground font-medium select-none shrink-0">
          {DOMAIN}
        </div>
      </div>

      {/* Status message */}
      <div className="min-h-[16px]">
        {status === "available" && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> This email is available
          </p>
        )}
        {status === "taken" && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Already registered — choose a different prefix
          </p>
        )}
        {status === "invalid" && (
          <p className="text-xs text-orange-500 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Only letters, numbers, dots, hyphens and underscores allowed
          </p>
        )}
        {status === "checking" && (
          <p className="text-xs text-muted-foreground">Checking availability…</p>
        )}
      </div>
    </div>
  );
}