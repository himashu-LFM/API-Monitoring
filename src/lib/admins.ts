/**
 * Admin allowlist — the single source of truth for who gets full dashboard
 * access. Everyone else who signs in (any @listenfirstmedia.com account) is a
 * MEMBER and only sees the Welcome page.
 *
 * To add/remove an admin: edit this list and redeploy. No database involved.
 */
export const ADMIN_EMAILS = [
  "khushi@listenfirstmedia.com",
  "sudhanshu@listenfirstmedia.com",
  
];

const ADMIN_SET = new Set(ADMIN_EMAILS.map((e) => e.trim().toLowerCase()));

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_SET.has(email.toLowerCase());
}
