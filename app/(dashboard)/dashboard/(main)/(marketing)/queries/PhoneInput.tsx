"use client";

import { useState, useRef, useEffect } from "react";
import { ClipboardPaste } from "lucide-react";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { COUNTRY_CODES, DEFAULT_COUNTRY } from "@/app/lib/assets/country-codes";
import { toast } from "sonner";

type Props = {
    name:          string;
    defaultValue?: string;
    placeholder?:  string;
    className?:    string;
    disabled?:     boolean;
    /** Fires with the current full value (dial code + number, no spaces)
     * whenever either changes — lets a parent react live (e.g. checking for
     * an existing query on that number) without making this a controlled
     * input. */
    onChange?:     (fullValue: string) => void;
};

function parsePhone(value?: string): { countryCode: string; number: string } {
    if (!value) return { countryCode: DEFAULT_COUNTRY.code, number: "" };

    const match = [...COUNTRY_CODES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find(c => value.startsWith(c.dial));

    if (match) {
        return { countryCode: match.code, number: value.slice(match.dial.length).trim() };
    }
    return { countryCode: DEFAULT_COUNTRY.code, number: value };
}

export function PhoneInput({ name, defaultValue, placeholder = "98765 43210", className, disabled, onChange }: Props) {
    const parsed                        = parsePhone(defaultValue);
    const [countryCode, setCountryCode] = useState(parsed.countryCode);
    const [number, setNumber]           = useState(parsed.number);
    const inputRef                      = useRef<HTMLInputElement>(null);

    const selected = COUNTRY_CODES.find(c => c.code === countryCode) ?? DEFAULT_COUNTRY;
    // No space between the dial code and the number, and none within the
    // number itself — the digit-group spacing in the input is purely for
    // readability while typing, it should never end up in the stored value.
    const fullValue = `${selected.dial}${number.replace(/\s+/g, "")}`;

    useEffect(() => {
        onChange?.(fullValue);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fullValue]);

    async function handlePaste() {
        try {
            const text    = await navigator.clipboard.readText();
            let   cleaned = text.replace(/[\s\-().]/g, "");

            // Only treat this as "dial code + number" when the text was
            // actually copied with a leading "+" — a plain local number like
            // "8219979481" happens to start with "82" (South Korea)'s dial
            // code, and blindly matching against it silently rewrote the
            // country and truncated the number.
            if (cleaned.startsWith("+")) {
                const withoutPlus = cleaned.slice(1);
                const matchedCountry = [...COUNTRY_CODES]
                    .sort((a, b) => b.dial.length - a.dial.length)
                    .find(c => withoutPlus.startsWith(c.dial.replace("+", "")));

                if (matchedCountry) {
                    cleaned = withoutPlus.slice(matchedCountry.dial.replace("+", "").length);
                    setCountryCode(matchedCountry.code);
                } else {
                    cleaned = withoutPlus;
                }
            } else {
                cleaned = cleaned.replace(/\D/g, "");
            }

            setNumber(cleaned);
            inputRef.current?.focus();
            toast.success("Number pasted");
        } catch {
            toast.error("Could not read clipboard — paste manually");
        }
    }

    return (
        <div className={`flex gap-1.5 items-center${className ? ` ${className}` : ""}`}>
            <input type="hidden" name={name} value={fullValue} />

            {/* Native select — no overlay, option text shows flag + dial */}
            <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                disabled={disabled}
                /* Matches the Input beside it exactly — height, radius, border
                   and focus ring. They are one control to the eye. */
                className="
                    h-10 w-[90px] shrink-0 rounded-lg text-xs font-medium px-2
                    bg-dashboard-base-100 border border-dashboard-base-content/85
                    text-dashboard-base-content cursor-pointer outline-none transition-colors
                    focus-visible:border-dashboard-primary focus-visible:ring-1 focus-visible:ring-dashboard-primary/30
                    disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-dashboard-base-200 disabled:opacity-50
                "
            >
                {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>
                        {c.flag} {c.dial}
                    </option>
                ))}
            </select>

            {/* Number input */}
            <Input
                ref={inputRef}
                value={number}
                onChange={e => setNumber(e.target.value.replace(/\D/g, ""))}
                placeholder={placeholder}
                disabled={disabled}
                className="flex-1 min-w-0"
                inputMode="numeric"
            />

            {/* Paste button */}
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10 rounded-lg"
                onClick={handlePaste}
                disabled={disabled}
                title="Paste number from clipboard"
            >
                <ClipboardPaste className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}