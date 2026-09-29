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
  /** Discipline labels, one per discipline (display, where each is kept whole). */
  discs: string[];
  url: string;
  plate: string;
  /** Shown inside links whose caption names the project, so without alt text. */
  cover: ImageMetadata;
}

export interface Chip {
  value: string;
  label: string;
  count: number;
}
