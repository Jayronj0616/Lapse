import { z } from "zod";

/**
 * Shared by the forms and the Server Actions. Per CLAUDE.md, a Server Action
 * validates with one of these before a service ever sees the input, so services
 * can assume their arguments are already well-formed.
 */

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "That name is too long."),
  email: z.email("Enter a valid email address."),
  // Supabase's own minimum is 6; 8 is ours. The upper bound is bcrypt's real
  // 72-byte limit — anything past it is silently truncated, which would make a
  // long password quietly weaker than it looks.
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use 72 characters or fewer."),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
