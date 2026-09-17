"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { enterDemoAction } from "@/lib/actions/demo.actions";
import type { FormState } from "@/lib/actions/form-state";
import { Button } from "@/components/ui/button";

/**
 * One click into the demo.
 *
 * A form POST rather than a link: a GET route that creates a session would be
 * followed by link prefetching and by crawlers, minting sessions for anyone
 * who merely passed the page.
 */
export function DemoButton() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enterDemoAction,
    {},
  );

  return (
    <form action={formAction} className="contents">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Opening the demo
          </>
        ) : (
          <>
            Try the demo
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>

      {state.error ? (
        <p
          role="alert"
          className="basis-full text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
