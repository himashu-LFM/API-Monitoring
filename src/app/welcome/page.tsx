import { auth } from "@/auth";
import { CheckCircle2, Clock } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function WelcomePage() {
  const session = await auth();
  const name = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-ok/10 text-ok">
          <CheckCircle2 className="size-7" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground">
          Welcome, {name} 👋
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re signed in to API Monitor.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-left">
          <Clock className="mt-0.5 size-5 shrink-0 text-warn" />
          <div>
            <p className="text-sm font-medium text-foreground">Access pending</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your account doesn&apos;t have dashboard access yet. An admin needs
              to grant you access before you can view the monitoring dashboard.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
