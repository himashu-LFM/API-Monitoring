import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { isAdmin } from "@/lib/admins";

/**
 * Full node-side auth. Imported by the route handler and server components — NOT
 * the edge middleware (that uses `auth.config.ts` only).
 *
 * JWT-only, no database: users are never persisted. Each session is a signed
 * cookie. (The earlier Prisma/Postgres persistence was removed — login stays,
 * user storage doesn't.)
 *
 * A user is ADMIN if their email is in EITHER source:
 *   - the code-level allowlist in `lib/admins.ts` (edit + redeploy), or
 *   - the ADMIN_EMAILS env var (comma-separated — lets a deploy add an admin
 *     without a code change).
 * Any other verified @listenfirstmedia.com account signs in as MEMBER and only
 * sees the Welcome page.
 */

// Extra admins from the environment, on top of the `lib/admins.ts` allowlist.
const envAdminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function hasAdminRole(email: string | null | undefined): boolean {
  if (!email) return false;
  return isAdmin(email) || envAdminEmails.includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // `user` is only present at sign-in.
      if (user) token.uid = user.id ?? token.sub;
      // Recompute the role on every call so allowlist edits take effect on the
      // next request — no re-login needed.
      const email = (user?.email ?? token.email) as string | undefined;
      token.role = hasAdminRole(email) ? "ADMIN" : "MEMBER";
      return token;
    },
  },
});
