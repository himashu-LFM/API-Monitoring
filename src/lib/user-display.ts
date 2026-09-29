/** Derive up-to-2-letter initials from a display name, falling back to email. */
export function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]).join("");
  return (letters || source[0] || "?").toUpperCase();
}
