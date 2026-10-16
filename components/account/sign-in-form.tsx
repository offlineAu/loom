"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Caption } from "@/components/loom/typography";

interface SignInFormProps {
  onSignIn: (email: string) => Promise<void>;
}

/**
 * Passwordless (magic link / OTP) sign-in — no password to store or leak,
 * appropriate for a public-first app where an account is a pure
 * enhancement, not a requirement. See docs/LOOM-PHASE-1C-SUPABASE-AUTH-RLS.md
 * ("Authentication") for why this method was chosen over a password form.
 */
export function SignInForm({ onSignIn }: SignInFormProps) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onSignIn(trimmed);
      setSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't send the sign-in link.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Check your email</p>
        <Caption>We sent a sign-in link to {email}. Open it on this device to finish signing in.</Caption>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>Email</Label>
        <Input
          id={inputId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      {errorMessage ? <Caption className="text-destructive">{errorMessage}</Caption> : null}
      <Button type="submit" className="w-full" disabled={!email.trim() || submitting}>
        {submitting ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
