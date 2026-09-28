/**
 * The brief form's pure logic: reading the fields, checking them, and
 * writing the email fallback. Nothing here touches the page.
 */

export interface Brief {
  name: string;
  email: string;
  needs: string[];
  message: string;
}

export type FieldKey = 'name' | 'email';

export function readBrief(data: FormData): Brief {
  const text = (k: string) => String(data.get(k) ?? '').trim();
  return {
    name: text('name'),
    email: text('email'),
    needs: data.getAll('needs').map((v) => String(v)),
    message: text('message'),
  };
}

/** A realistic address: something@something.tld, no spaces. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The message for a required field, or '' when it is fine. */
export function problem(key: FieldKey, value: string): string {
  const v = value.trim();
  if (key === 'name') return v ? '' : 'Add your name.';
  if (!v) return 'Add your email.';
  return EMAIL.test(v) ? '' : 'Check the email address.';
}

/** mailto: link to the studio with the brief in the subject and body. */
export function mailtoHref(to: string, b: Brief): string {
  const subject = b.name ? `Project brief from ${b.name}` : 'Project brief';
  const lines = [`Name: ${b.name}`, `Email: ${b.email}`];
  if (b.needs.length) lines.push(`What we need: ${b.needs.join(', ')}`);
  // one line ending throughout: the textarea gives bare LF, the rest is CRLF
  if (b.message) lines.push('', b.message.replace(/\r?\n/g, '\r\n'));
  // encodeURIComponent keeps line breaks as %0A, which mail apps expect.
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\r\n'))}`;
  return `mailto:${to}?${q}`;
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
