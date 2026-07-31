// lib/validators/login.ts

import { z } from 'zod/v4';

// ─── Country Code Rules ───────────────────────────────────────────────────────

const PHONE_RULES = {
  '+91':  { length: 10, label: 'India',        pattern: /^[6-9]\d{9}$/        },
  '+1':   { length: 10, label: 'USA/Canada',   pattern: /^[2-9]\d{9}$/        },
  '+44':  { length: 10, label: 'UK',           pattern: /^7\d{9}$/            },
  '+61':  { length: 9,  label: 'Australia',    pattern: /^4\d{8}$/            },
  '+971': { length: 9,  label: 'UAE',          pattern: /^5\d{8}$/            },
  '+65':  { length: 8,  label: 'Singapore',    pattern: /^[89]\d{7}$/         },
  '+60':  { length: 10, label: 'Malaysia',     pattern: /^1\d{8,9}$/          },
} as const;

export const COUNTRY_CODES = Object.keys(PHONE_RULES) as (keyof typeof PHONE_RULES)[];

/**
 * Split a stored E.164-ish phone ("+919876543210") into a countryCode/phone
 * pair the login modal's prefill accepts.
 *
 * A generic `/^(\+\d{1,4})(\d+)$/` looks reasonable but isn't: `\d{1,4}` is
 * greedy, so on "+919876543210" it grabs 4 digits for the "code" — "+9198" —
 * leaving "76543210" as the phone (the leading 9 lost) and a countryCode that
 * matches none of our enum values. `phoneLoginSchema` then rejects it with an
 * error on `errors.countryCode`, which the OTP-entry screen never renders (it
 * only shows `errors.otp`) — so verifying looked like the button did nothing.
 * Matching against our own known prefixes (longest first, so "+971" isn't
 * shadowed by a shorter false match) removes the ambiguity entirely.
 */
export function splitPrefillPhone(raw: string | null | undefined): { countryCode: CountryCode; phone: string } | null {
  if (!raw) return null;
  const byLength = [...COUNTRY_CODES].sort((a, b) => b.length - a.length);
  for (const code of byLength) {
    if (raw.startsWith(code)) {
      const phone = raw.slice(code.length);
      if (/^\d+$/.test(phone) && phone.length > 0) return { countryCode: code, phone };
    }
  }
  return null;
}

// ─── Phone Schema ─────────────────────────────────────────────────────────────

export const phoneLoginSchema = z
  .object({
    countryCode: z.enum(COUNTRY_CODES as [string, ...string[]], {
      error: 'Select a valid country code',
    }),
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .regex(/^\d+$/, 'Only digits allowed'),
  })
  .superRefine(({ countryCode, phone }, ctx) => {
    const rule = PHONE_RULES[countryCode as keyof typeof PHONE_RULES];
    if (!rule) return;

    if (!rule.pattern.test(phone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: `Enter a valid ${rule.label} number (${rule.length} digits)`,
      });
    }
  });

// ─── Email Schema ─────────────────────────────────────────────────────────────

export const emailLoginSchema = z.object({
  email: z.email('Enter a valid email address'),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhoneLoginData = z.infer<typeof phoneLoginSchema>;
export type EmailLoginData = z.infer<typeof emailLoginSchema>;
export type CountryCode = keyof typeof PHONE_RULES;
export { PHONE_RULES };