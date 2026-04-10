const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

export function sanitizeString(str: string, maxLength: number = 500): string {
  return str.slice(0, maxLength).trim();
}
