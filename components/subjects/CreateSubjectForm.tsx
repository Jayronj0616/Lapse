"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { createSubjectAction } from "@/lib/actions/subject.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SELECT_CLASSES =
  "border-input bg-transparent dark:bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function CreateSubjectForm({ orgSlug }: { orgSlug: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createSubjectAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // The action stays on the page rather than redirecting, so the fields have
  // to be cleared by hand — otherwise adding a second vehicle starts with the
  // first one's details still in the form.
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />

      <div className="space-y-2">
        <Label htmlFor="kind">Type</Label>
        <select id="kind" name="kind" className={SELECT_CLASSES} defaultValue="vehicle">
          <option value="vehicle">Vehicle</option>
          <option value="person">Person</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="label">Name</Label>
        <Input
          id="label"
          name="label"
          placeholder="Truck ABC-1234"
          required
          aria-invalid={Boolean(state.fieldErrors?.label)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="identifier">
          Plate or licence number{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="identifier" name="identifier" placeholder="ABC-1234" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Add
      </Button>

      {state.fieldErrors?.label ? (
        <p className="text-sm text-destructive sm:col-span-4">
          {state.fieldErrors.label[0]}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
