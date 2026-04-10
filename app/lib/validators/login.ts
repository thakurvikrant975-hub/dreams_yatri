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