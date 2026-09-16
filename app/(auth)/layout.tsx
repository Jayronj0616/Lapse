import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="size-7" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Lapse</h1>
          <p className="text-sm text-muted-foreground">
            Know before it expires.
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
