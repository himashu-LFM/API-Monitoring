import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { isAdmin } from "@/lib/admins";

/**
 * Auth with NO database. Sessions are JWT-only (stored in a cookie), and a
 * user's role is derived from the code-level admin allowlist in `lib/admins.ts`.
 * Any verified @listenfirstmedia.com account may sign in; admins get the full
 * dashboard, everyone else gets the Welcome page.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      // Recompute role from the allowlist on every call so edits to the list
      // take effect on the next request — no re-login needed.
      const email = (user?.email ?? token.email) as string | undefined;
      token.role = isAdmin(email) ? "ADMIN" : "MEMBER";
      return token;
    },
  },
});
