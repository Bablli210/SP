/**
 * Services: which projects prove each discipline.
 *
 * Every discipline shows up to `max` projects that include it, newest first.
 * When a discipline has more candidates than slots, projects not yet shown in
 * an earlier row win, so the page shows as much of the archive as it can
 * instead of repeating the same three covers down the list.
 */
import { disciplines, type DisciplineKey } from '../../data/site';
import type { Project } from '../../lib/work';

export interface DisciplineRow {
  key: DisciplineKey;
  /** Two-digit position, "01" to "06". */
  no: string;
  label: string;
  line: string;
  /** Every project in the archive that includes this discipline. */
  total: number;
  projects: Project[];
}

/** `projects` must already be in display order (getProjects: newest first). */
export function disciplineRows(projects: Project[], max = 3): DisciplineRow[] {
  const shown = new Map<string, number>();

  return disciplines.map((d, i) => {
    const all = projects.filter((p) => p.data.disciplines.includes(d.key));
    const picked = all
      .map((p, rank) => ({ p, rank, seen: shown.get(p.id) ?? 0 }))
      .sort((a, b) => a.seen - b.seen || a.rank - b.rank)
      .slice(0, max)
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.p);

    for (const p of picked) shown.set(p.id, (shown.get(p.id) ?? 0) + 1);

    return {
      key: d.key,
      no: String(i + 1).padStart(2, '0'),
      label: d.label,
      line: d.line,
      total: all.length,
      projects: picked,
    };
  });
}
