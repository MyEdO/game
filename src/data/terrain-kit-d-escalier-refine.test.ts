/**
 * CONTRAT de la famille du kit d'escalier des terrains (#4471) — `kitDEscalier`, `schemas/defs/terrains.ts` : exigée sur
 * un terrain bâti sans bloc plein, refusée ailleurs (le mur), et d'une énumération propre (`kitDEscalierSchema`), que la
 * famille du kit d'une apparence de mur (`kitSchema`) refuse. Les fautes sont injectées dans une COPIE du dataset réel.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { schema } from './schemas/defs/terrains';
import { kitSchema } from './schemas/defs/structureAppearance';

type Entree = { id: string; built?: true; solidHeightM?: number; kitDEscalier?: string };

const charger = (): Entree[] => JSON.parse(readFileSync(fileURLToPath(new URL('./terrains.json', import.meta.url)), 'utf8'));

/** Les refus du dataset sabotant l'entrée `id` par `saboter`. */
function refus(id: string, saboter: (t: Entree) => void): string[] {
  const dataset = charger();
  saboter(dataset.find((t) => t.id === id)!);
  const r = schema.safeParse(dataset);
  return r.success ? [] : r.error.issues.map((i) => `@${i.path.join('.')} : ${i.message}`);
}

describe('terrains — la famille du kit d’escalier (#4471)', () => {
  it('le dataset committé passe, et chaque terrain bâti sans bloc plein nomme sa famille', () => {
    expect(refus('plancher', () => {})).toEqual([]);
    for (const t of charger()) expect(t.kitDEscalier !== undefined, t.id).toBe(t.built === true && t.solidHeightM === undefined);
  });

  it('un terrain bâti sans bloc plein qui la tait est refusé', () => {
    expect(refus('plancher', (t) => { delete t.kitDEscalier; })).toEqual([
      expect.stringMatching(/kitDEscalier : terrain « plancher » : un terrain BÂTI sans bloc plein porte des marches/),
    ]);
  });

  it('le mur, bloc plein, la refuse, comme un sol nu', () => {
    expect(refus('mur', (t) => { t.kitDEscalier = 'pierre'; })).toEqual([expect.stringMatching(/kitDEscalier : terrain « mur » : `kitDEscalier` habille/)]);
    expect(refus('herbe', (t) => { t.kitDEscalier = 'bois'; })).toEqual([expect.stringMatching(/terrain « herbe »/)]);
  });

  it('une famille hors de l’énumération est refusée, et l’énumération d’escalier n’est pas celle des murs', () => {
    expect(refus('pierre', (t) => { t.kitDEscalier = 'colombage'; })).toHaveLength(1);
    expect(kitSchema.safeParse('bois').success).toBe(false);
    expect(kitSchema.safeParse('pierre').success).toBe(false);
  });
});
