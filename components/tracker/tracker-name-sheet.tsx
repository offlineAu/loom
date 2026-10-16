"use client";

import { useId, useState } from "react";
import { BottomSheet } from "@/components/loom/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrackerNameSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName: string;
  onSubmit: (name: string) => Promise<void>;
}

/** Shared name-entry form, used both to create a tracker and to rename one. */
export function TrackerNameSheet({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName,
  onSubmit,
}: TrackerNameSheetProps) {
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>Name</Label>
          <Input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={initialName}
            autoFocus
            maxLength={100}
          />
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim() || submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </form>
    </BottomSheet>
  );
}
