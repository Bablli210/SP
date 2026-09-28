import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const disciplineKey = z.enum(['research', 'identity', 'naming', 'packaging', 'digital', 'campaign']);

/**
 * A project is one case study. Add a folder of images under
 * src/assets/work/<slug>/ and a Markdown file here with the same slug.
 * The Markdown body is optional (show, don't tell): use it only for a short note.
 */
const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      no: z.string().regex(/^\d{3}$/, 'Three-digit archive number, e.g. "014"'),
      client: z.string(),
      sector: z.string(),
      year: z.number().int(),
      disciplines: z.array(disciplineKey).min(1),
      /** One-sentence insight that unlocked the work. The only prose on the page. */
      finding: z.string(),
      /** Short line used in cards and meta descriptions. */
      summary: z.string(),
      cover: image(),
      coverAlt: z.string(),
      /** The project's one accent colour (moodboard rule: one colour at a time). */
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2b3bf2'),
      /** Shown on the home ring. Order is `order`, ascending. */
      featured: z.boolean().default(true),
      order: z.number().default(100),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string(),
            /** full = edge to edge; wide = 16:10 across the grid; half = one of a pair; offset = narrow, pushed right */
            layout: z.enum(['full', 'wide', 'half', 'offset']).default('half'),
            caption: z.string().optional(),
          }),
        )
        .default([]),
      film: z
        .object({
          src: z.string(),
          poster: image(),
          caption: z.string().optional(),
        })
        .optional(),
      credits: z.array(z.object({ role: z.string(), name: z.string() })).default([]),
      result: z.string().optional(),
      placeholder: z.boolean().default(false),
    }),
});

/** Lab: experiments, type and motion studies, and the yearly Recap. */
const lab = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/lab' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      kind: z.enum(['type', 'motion', '3d', 'recap']),
      tool: z.string().optional(),
      image: image(),
      alt: z.string(),
      /** Optional looping video (muted mp4/webm) that plays on hover. */
      loop: z.string().optional(),
      placeholder: z.boolean().default(false),
    }),
});

export const collections = { projects, lab };
