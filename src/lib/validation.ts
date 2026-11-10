/**
 * Zod validation schemas shared by server actions.
 * All user-supplied input passes through these before touching the DB.
 */
import { z } from "zod";

export const AGE_RANGES = ["Under 18", "18–25", "26–35", "36–45", "46–55", "56+"] as const;

export const saveProfileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(80),
  age_range: z.enum(AGE_RANGES).or(z.literal("")).optional().default(""),
  preferred_language: z.string().trim().max(40).optional().default(""),
  timezone: z.string().trim().min(1).max(80),
  /** Onboarding wizard fields (typicalDay, occupation, sleep, …) — strings/bools only. */
  context: z.record(z.string(), z.union([z.string().max(2000), z.boolean()])).optional().default({}),
  consent: z
    .object({
      accepted: z.boolean(),
      at: z.string().max(60).optional(),
      understood_not_medical: z.boolean(),
      understood_storage: z.boolean(),
    })
    .optional()
    .default({ accepted: false, understood_not_medical: false, understood_storage: false }),
});

export type SaveProfileInput = z.infer<typeof saveProfileSchema>;

export const journalEntrySchema = z.object({
  id: z.string().trim().min(6).max(64).optional(),
  day: z.coerce.number().int().min(1).max(7).nullable().optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().trim().min(1, "Write something first").max(20000),
});

export const certificateRowSchema = z.object({
  id: z.string().regex(/^MT7-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  journey_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().min(1).max(80),
  storage_path: z.string().trim().min(1).max(512),
  file_size: z.coerce.number().int().positive().max(5242880),
});
