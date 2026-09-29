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

/** The brief as plain text, one line ending (`eol`) throughout. */
export function briefText(b: Brief, eol = '\n'): string {
  const lines = [`Name: ${b.name}`, `Email: ${b.email}`];
  if (b.needs.length) lines.push(`What we need: ${b.needs.join(', ')}`);
  // the textarea gives bare LF; match whatever the rest uses
  if (b.message) lines.push('', b.message.replace(/\r?\n/g, eol));
  return lines.join(eol);
}

/** mailto: link to the studio with the brief in the subject and body. */
export function mailtoHref(to: string, b: Brief): string {
  const subject = b.name ? `Project brief from ${b.name}` : 'Project brief';
  // CRLF, as mail bodies expect; encodeURIComponent keeps it as %0D%0A.
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(briefText(b, '\r\n'))}`;
  return `mailto:${to}?${q}`;
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
