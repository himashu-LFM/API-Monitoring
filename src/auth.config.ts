import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no database imports). Shared by the middleware and by
 * the full node-side config in `auth.ts`. Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
 * and AUTH_SECRET from the environment automatically.
 */

// Only company Google Workspace accounts may sign in.
export const ALLOWED_DOMAIN = "listenfirstmedia.com";

export default {
  // NextAuth auto-trusts the host only on Vercel. On Netlify it doesn't, and
  // without this every sign-in fails with UntrustedHost. AUTH_URL still pins the
  // canonical URL used to build the OAuth callback.
  trustHost: true,
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // Hard block: must be a verified Google account on the company domain.
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = profile?.email?.toLowerCase();
      const verified = profile?.email_verified === true;
      return !!email && verified && email.endsWith("@" + ALLOWED_DOMAIN);
    },
    // Copy role + id from the JWT onto the session (edge-safe: token only).
    async session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as "MEMBER" | "ADMIN") ?? "MEMBER";
        session.user.id = (token.uid as string) ?? session.user.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
