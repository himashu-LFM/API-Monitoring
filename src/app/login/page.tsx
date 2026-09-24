"use client";

import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Activity, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Activity className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">API Monitor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to access your workspace
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-crit/30 bg-crit/10 p-3 text-sm text-crit">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Access denied. You must sign in with a{" "}
            <strong>@listenfirstmedia.com</strong> Google account.
          </span>
        </div>
      )}

      <Button
        className="w-full gap-2"
        variant="outline"
        size="lg"
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Only <strong>@listenfirstmedia.com</strong> accounts are allowed.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </main>
  );
}
