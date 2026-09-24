import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

// Routes only ADMINs may see. Everything under these prefixes is admin-gated.
const ADMIN_PREFIXES = ["/dashboard", "/apis", "/alerts", "/renewals", "/settings"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const isLoggedIn = !!session;
  const role = session?.user?.role;
  const path = nextUrl.pathname;

  const isLoginPage = path === "/login";
  const isWelcome = path === "/welcome";
  const isAdminArea = ADMIN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));

  // Not signed in → only the login page is allowed.
  if (!isLoggedIn) {
    if (isLoginPage) return;
    const url = new URL("/login", nextUrl);
    return Response.redirect(url);
  }

  // Signed in. Decide where "home" is for this role.
  const home = role === "ADMIN" ? "/dashboard" : "/welcome";

  // Already signed in but on /login or root → send to their home.
  if (isLoginPage || path === "/") {
    return Response.redirect(new URL(home, nextUrl));
  }

  // Non-admin trying to reach an admin area → bounce to welcome.
  if (isAdminArea && role !== "ADMIN") {
    return Response.redirect(new URL("/welcome", nextUrl));
  }

  // Admins don't need the welcome page → send them to the dashboard.
  if (isWelcome && role === "ADMIN") {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  return;
});

// Run on everything except Next internals, static files, the auth API, and
// routes called by external services with no browser session — the usage-
// alert cron (GitHub Actions) and the Decodo webhook. Those are protected by
// their own secret token (CRON_SECRET / DECODO_WEBHOOK_TOKEN), not login.
export const config = {
  matcher: ["/((?!api/auth|api/cron|api/webhooks|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
