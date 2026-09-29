/**
 * Helpers for reading the work archive. Every page gets projects from here
 * so ordering, URLs and labels stay consistent.
 *
 * Placeholder entries: while PLACEHOLDER_CONTENT is on, the whole site is a
 * marked preview and every entry shows. Once it is off, entries still marked
 * `placeholder: true` are left out everywhere at once (ring, index, case pages,
 * next-project links, lab, sitemap), and the build says which ones.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { disciplines, PLACEHOLDER_CONTENT, type DisciplineKey } from '../data/site';

export type Project = CollectionEntry<'projects'>;
export type LabEntry = CollectionEntry<'lab'>;

const warned = new Set<string>();

/** Drop entries still marked as placeholders once the site is live. */
function live<T extends Project | LabEntry>(collection: 'projects' | 'lab', entries: T[]): T[] {
  if (PLACEHOLDER_CONTENT) return entries;
  const kept = entries.filter((e) => !e.data.placeholder);
  const dropped = entries.filter((e) => e.data.placeholder).map((e) => e.id);
  if (dropped.length && !warned.has(collection)) {
    warned.add(collection);
    console.warn(
      `[work] PLACEHOLDER_CONTENT is off: leaving out ${collection} still marked placeholder: ${dropped.join(', ')}`,
    );
  }
  if (collection === 'projects' && entries.length && !kept.length) {
    throw new Error(
      '[work] PLACEHOLDER_CONTENT is off but every project is still marked placeholder: true. ' +
        'Replace at least one project (and remove its placeholder line) before launch.',
    );
  }
  return kept;
}

/** All projects, newest archive number first. */
export async function getProjects(): Promise<Project[]> {
  const all = live('projects', await getCollection('projects'));
  return all.sort((a, b) => Number(b.data.no) - Number(a.data.no));
}

/** Projects shown on the home ring, in their chosen order. */
export async function getFeatured(): Promise<Project[]> {
  const all = live('projects', await getCollection('projects')).filter((p) => p.data.featured);
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getLab(): Promise<LabEntry[]> {
  const all = live('lab', await getCollection('lab'));
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const projectUrl = (p: Project) => `/work/${p.id}/`;

/** Shared-element name so a project's image morphs between pages. */
export const plateName = (p: Project) => `plate-${p.id}`;

export const disciplineLabel = (key: DisciplineKey) => disciplines.find((d) => d.key === key)?.label ?? key;

export const disciplineList = (p: Project) => p.data.disciplines.map(disciplineLabel).join(', ');
