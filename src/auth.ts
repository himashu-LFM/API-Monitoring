import NextAuth from "next-auth";
import authConfig from "./auth.config";

/**
 * Full node-side auth. Imported by the route handler and server components — NOT
 * the edge middleware (that uses `auth.config.ts` only).
 *
 * JWT-only, no database: users are never persisted. Each session is a signed
 * cookie; the role is derived from ADMIN_EMAILS on every sign-in. (The earlier
 * Prisma/Postgres persistence was removed — login stays, user storage doesn't.)
 */

// Emails treated as ADMIN on sign-in; everyone else is MEMBER (welcome page only).
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // `user` is only present at sign-in; compute the role once, then reuse the
      // baked-in token on every subsequent (edge) request.
      if (user?.email) {
        token.role = adminEmails.includes(user.email.toLowerCase()) ? "ADMIN" : "MEMBER";
        token.uid = user.id ?? token.sub;
      }
      return token;
    },
  },
});
