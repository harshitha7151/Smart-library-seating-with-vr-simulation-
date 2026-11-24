import { z } from "zod";

// RVCE student email format (verified): firstname.lastname.branchYY@rvce.edu.in
// e.g. john.doe.cs26@rvce.edu.in  or  jane.mca23@rvce.edu.in
// All student self-registration accounts must use an official @rvce.edu.in address.
export const rvceEmailSchema = z
  .string()
  .trim()
  .email({ message: "Enter a valid email address." })
  .max(254)
  .refine((email) => email.toLowerCase().endsWith("@rvce.edu.in"), {
    message: "Student accounts require an RVCE email address ending in @rvce.edu.in",
  })
  .transform((email) => email.toLowerCase());

export const usnSchema = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^1RV\d{2}[A-Z]{2}\d{3}$/, "Enter a USN like 1RV24IS045."));

export const loginIdentifierSchema = z.string().trim().min(1).max(254)
  .transform((value) => value.includes("@") ? value.toLowerCase() : value.toUpperCase())
  .refine((value) => value.includes("@")
    ? z.string().email().safeParse(value).success
    : usnSchema.safeParse(value).success,
  "Enter your 10-character USN or RVCE email address.");

const loginEmailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
export const loginRequestSchema = z.object({
  loginId: loginIdentifierSchema.optional(),
  // Kept for Unity and any client still sending the original API shape.
  email: loginEmailSchema.optional(),
  password: z.string().min(1).max(128),
}).refine((input) => Boolean(input.loginId || input.email), {
  message: "Enter your USN or RVCE email address.",
  path: ["loginId"],
}).transform((input) => ({ ...input, loginId: input.loginId || input.email }));

export const bookingSchema = z.object({
  seatId: z.string().regex(/^T(?:1[0-9]|2[0-4]|[1-9])-S(?:[1-9]|1[0-4])$/),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
});

export function bookingWindowError(startAt, endAt, now = Date.now()) {
  // Allow up to 60 seconds in the past to account for clock skew and network
  // delay — so a student who picks exactly "5:30" can still book at 5:30:05.
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt.getTime() < now - 60_000) {
    return "Bookings must start in the future.";
  }
  if (endAt <= startAt) return "The end time must be after the start time.";
  if (endAt.getTime() - startAt.getTime() > 4 * 60 * 60 * 1000) return "Bookings cannot be longer than four hours.";
  if (startAt.getTime() > now + 30 * 24 * 60 * 60 * 1000) return "Bookings must be within the next 30 days.";
  return null;
}
