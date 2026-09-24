import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "./auth.config";

/**
 * Full node-side auth. Imported by the route handler and server components — NOT
 * the edge middleware (that uses `auth.config.ts` only).
 *
 * DB is optional: if DATABASE_URL is set we persist users via the Prisma adapter
 * and store roles in the DB. If it's NOT set (e.g. before RDS is wired up), auth
 * still works fully in JWT-only mode — roles are derived from ADMIN_EMAILS. Add
 * DATABASE_URL later and persistence turns on automatically, no code changes.
 */

const useDb = !!process.env.DATABASE_URL;

// Emails auto-promoted to ADMIN on sign-in (bootstrap the first admins).
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...(useDb ? { adapter: PrismaAdapter(prisma) } : {}),
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // `user` is only present at sign-in; compute role once, then reuse the
      // baked-in token on every subsequent (edge) request.
      if (user?.email) {
        const isAdmin = adminEmails.includes(user.email.toLowerCase());
        let role: "MEMBER" | "ADMIN" = isAdmin ? "ADMIN" : user.role ?? "MEMBER";

        // Persist the admin promotion only when a DB is configured.
        if (useDb && isAdmin && user.role !== "ADMIN") {
          await prisma.user.update({
            where: { email: user.email },
            data: { role: "ADMIN" },
          });
          role = "ADMIN";
        }

        token.role = role;
        token.uid = user.id ?? token.sub;
      }
      return token;
    },
  },
});
