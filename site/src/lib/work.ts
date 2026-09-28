/**
 * Helpers for reading the work archive. Every page gets projects from here
 * so ordering, URLs and labels stay consistent.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { disciplines, type DisciplineKey } from '../data/site';

export type Project = CollectionEntry<'projects'>;
export type LabEntry = CollectionEntry<'lab'>;

/** All projects, newest archive number first. */
export async function getProjects(): Promise<Project[]> {
  const all = await getCollection('projects');
  return all.sort((a, b) => Number(b.data.no) - Number(a.data.no));
}

/** Projects shown on the home ring, in their chosen order. */
export async function getFeatured(): Promise<Project[]> {
  const all = await getCollection('projects', (p) => p.data.featured);
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getLab(): Promise<LabEntry[]> {
  const all = await getCollection('lab');
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const projectUrl = (p: Project) => `/work/${p.id}/`;

/** Shared-element name so a project's image morphs between pages. */
export const plateName = (p: Project) => `plate-${p.id}`;

export const disciplineLabel = (key: DisciplineKey) => disciplines.find((d) => d.key === key)?.label ?? key;

export const disciplineList = (p: Project) => p.data.disciplines.map(disciplineLabel).join(', ');
