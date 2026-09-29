/**
 * Studio-wide facts. Edit here; every page reads from this file.
 *
 * Anything in [square brackets] is a placeholder waiting on the studio.
 * PLACEHOLDER_CONTENT shows a small notice on every page until real work
 * and copy are in; set it to false at launch.
 */
export const PLACEHOLDER_CONTENT = true;

export const studio = {
  name: 'Serious Play',
  legalName: 'Serious Play Studio',
  // The studio's own line, from seriousplaystudio.com
  thesis: 'We create brands rooted by serious research and driven by playful imagination.',
  short: 'Serious research. Playful imagination.',
  url: 'https://seriousplaystudio.com',
  email: 'info@seriousplaystudio.com',
  instagram: { handle: '@seriousplaystudio', url: 'https://www.instagram.com/seriousplaystudio/' },
  // Set city and timeZone (IANA) to show local time on the contact page.
  city: null as string | null,
  timeZone: null as string | null,
  founded: null as number | null,
};

/**
 * The default social card (public/og.jpg). Case pages use their cover, cropped
 * to the same size, so every card is this size.
 */
export const socialCard = {
  src: '/og.jpg',
  width: 1200,
  height: 630,
  alt: 'Serious Play wordmark, with the line “Serious research. Playful imagination.”',
} as const;

export const nav = [
  { href: '/work/', label: 'Work' },
  { href: '/studio/', label: 'Studio' },
  { href: '/services/', label: 'Services' },
  { href: '/lab/', label: 'Lab' },
  { href: '/contact/', label: 'Contact' },
] as const;

/** Disciplines double as work filters and the Services page. Keys must match project `disciplines`. */
export const disciplines = [
  { key: 'research', label: 'Research & Strategy', line: 'Audits, interviews, positioning and brand platforms.' },
  { key: 'identity', label: 'Brand Identity', line: 'Marks, systems, typography, colour and guidelines.' },
  { key: 'naming', label: 'Naming & Voice', line: 'Names, taglines, tone of voice and messaging.' },
  { key: 'packaging', label: 'Packaging', line: 'Structure, surface and presence on the shelf.' },
  { key: 'digital', label: 'Digital', line: 'Websites, social systems and product interfaces.' },
  { key: 'campaign', label: 'Campaigns & Motion', line: 'Launch concepts, content and animation.' },
] as const;

export type DisciplineKey = (typeof disciplines)[number]['key'];

export const sectors = ['Food & Beverage', 'Craft & Retail', 'Hospitality', 'Culture', 'Music', 'Wellness', 'Gifting', 'Technology'] as const;

/** The method, shown on the Studio page as five process images. */
export const method = [
  { step: 'Observe', line: 'Field research, audits, interviews.', image: 'studio/method-1.jpg' },
  { step: 'Question', line: 'The brief, rewritten around one tension.', image: 'studio/method-2.jpg' },
  { step: 'Play', line: 'Fifty wrong routes, made quickly.', image: 'studio/method-3.jpg' },
  { step: 'Test', line: 'Prototypes in real hands.', image: 'studio/method-4.jpg' },
  { step: 'Launch', line: 'Systems, guidelines and rollout.', image: 'studio/method-5.jpg' },
] as const;

export const people = [
  { name: '[Founder name]', role: 'Founder · Creative director', image: 'studio/person-1.jpg' },
  { name: '[Co-founder name]', role: 'Co-founder · [Role]', image: 'studio/person-2.jpg' },
  { name: '[Name]', role: '[Role]', image: 'studio/person-3.jpg' },
] as const;

export const clients = ['[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]', '[Client]'];

export const press = [
  { outlet: '[Publication]', year: '[Year]', url: null as string | null },
  { outlet: '[Award]', year: '[Year]', url: null as string | null },
  { outlet: '[Publication]', year: '[Year]', url: null as string | null },
];

export const careers = { open: false, note: 'No open roles right now. Send a portfolio anyway.' };
