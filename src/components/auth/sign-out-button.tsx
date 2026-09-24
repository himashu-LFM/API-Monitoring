"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="outline" className="gap-2" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}
