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
            const text        = await navigator.clipboard.readText();
            let   cleaned     = text.replace(/[\s\-().]/g, "");
            const withoutPlus = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

            const matchedCountry = [...COUNTRY_CODES]
                .sort((a, b) => b.dial.length - a.dial.length)
                .find(c => withoutPlus.startsWith(c.dial.replace("+", "")));

            if (matchedCountry) {
                cleaned = withoutPlus.slice(matchedCountry.dial.replace("+", "").length);
                setCountryCode(matchedCountry.code);
            } else {
                cleaned = withoutPlus;
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
                className="
                    h-9 w-[90px] shrink-0 rounded-md border border-input
                    bg-background px-2 text-xs font-medium
                    cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring
                    disabled:opacity-50 disabled:cursor-not-allowed
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
                onChange={e => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
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
                className="shrink-0 h-9 w-9"
                onClick={handlePaste}
                disabled={disabled}
                title="Paste number from clipboard"
            >
                <ClipboardPaste className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}