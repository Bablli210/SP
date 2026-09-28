import type { ImageMetadata } from 'astro';

/** One project, flattened for the index views. */
export interface Entry {
  id: string;
  no: string;
  title: string;
  client: string;
  sector: string;
  year: number;
  /** Discipline keys, space separated (filter data). */
  d: string;
  /** Discipline labels, comma separated (display). */
  disc: string;
  url: string;
  plate: string;
  cover: ImageMetadata;
  coverAlt: string;
}

export interface Chip {
  value: string;
  label: string;
  count: number;
}
