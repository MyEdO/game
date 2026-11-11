import { describe, it, expect, afterEach } from 'vitest';
import { resolveStake } from './index';
import { critiqueEntries } from './criticals';
import { rangeesDe } from './rangees';
import { resetData, setDataset } from './overrides';
import miscastRawJson from './miscast.json';
import { DATASET_DE_LA_CATEGORIE } from './schemas/_cles-de-dataset.generated';
import { file as fichierDesCritiques } from './schemas/defs/criticals';
import { file as fichierDesMiscast } from './schemas/defs/miscast';
import type * as miscastDef from './schemas/defs/miscast';

/**
 * POOLS DES TABLES TIRÉES (#3923) — chaque catégorie Codex des fichiers de Blessures critiques et de
 * miscast admet par la porte dynamique (b) de `entryCategoryOf` (`src/data/index.ts`) EXACTEMENT les
 * ids de ses rangées, mesuré sur le chemin réel (`resolveStake` d'un `kind` sans catégorie déclarée).
 */

/** `kind` de la porte (b) : sans `entryCategory` déclarée, la catégorie vient de la clé. */
const KIND_DYNAMIQUE = { dataset: 'combat', kind: 'critique-ligne-test' } as const;

const descend = (category: string, entryId: string): boolean => {
  const rule = resolveStake({ key: { ...KIND_DYNAMIQUE, entryId, entryCategory: category } }).rule;
  return rule?.category === category && rule.id === entryId;
};

const rangeesDeLaCategorie = (category: string): { id: string }[] => {
  const d = DATASET_DE_LA_CATEGORIE[category];
  const doc = (d.chemin[0] as { cle: string }).cle;
  return d.fichier === fichierDesCritiques ? critiqueEntries(doc) : rangeesDe<typeof miscastDef>(miscastRawJson, doc);
};

const CATEGORIES = Object.keys(DATASET_DE_LA_CATEGORIE)
  .filter((c) => [fichierDesCritiques, fichierDesMiscast].includes(DATASET_DE_LA_CATEGORIE[c].fichier as never));

afterEach(() => resetData());

describe('pools des tables tirées — porte (b) de `entryCategoryOf`', () => {
  it('chaque catégorie admet ses rangées et refuse celles des autres tables', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
    const ids = new Map(CATEGORIES.map((c) => [c, new Set(rangeesDeLaCategorie(c).map((r) => r.id))]));
    const tous = new Set([...ids.values()].flatMap((s) => [...s]));
    const ecarts: string[] = [];
    for (const [c, propres] of ids) {
      for (const id of tous) if (descend(c, id) !== propres.has(id)) ecarts.push(`${c}:${id} ${propres.has(id) ? 'refusé' : 'admis'}`);
    }
    expect(ecarts, `${CATEGORIES.length} catégories, ${tous.size} ids`).toEqual([]);
  });

  it('une rangée ajoutée au Codex entre au pool de sa catégorie', () => {
    const rangees = rangeesDe<typeof miscastDef>(miscastRawJson, 'miscast-colere');
    const ajoutee = { ...rangees[0], id: 'colere-ajoutee-au-codex' };
    expect(descend('miscastWrath', ajoutee.id)).toBe(false);
    setDataset('miscastWrath', [...rangees, ajoutee]);
    expect(descend('miscastWrath', ajoutee.id)).toBe(true);
  });
});
