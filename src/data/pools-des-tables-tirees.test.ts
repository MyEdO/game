import { describe, it, expect, afterEach } from 'vitest';
import { resolveStake } from './index';
import { critiqueEntries } from './criticals';
import { rangeesDe } from './rangees';
import { resetData, setDataset } from './overrides';
import miscastRawJson from './miscast.json';
import structureCriticalsJson from './structure-criticals.json';
import artilleryMisfireJson from './artillery-misfire.json';
import crewTestTypesJson from './crew-test-types.json';
import interludeEventsJson from './interludeEvents.json';
import shipCriticalsJson from './ship-criticals.json';
import riverCriticalsJson from './river-criticals.json';
import seaEventsJson from './sea-events.json';
import { DATASET_DE_LA_CATEGORIE } from './schemas/_cles-de-dataset.generated';
import { suivreLeChemin } from './schemas/grammaire/cle-d-espace';
import { file as fichierDesCritiques } from './schemas/defs/criticals';
import { file as fichierDesMiscast } from './schemas/defs/miscast';
import type * as miscastDef from './schemas/defs/miscast';
import { file as fichierDesCritiquesDeStructure } from './schemas/defs/structure-criticals';
import { file as fichierDesIncidentsDeSalve } from './schemas/defs/artillery-misfire';
import { file as fichierDesTestsDEquipage } from './schemas/defs/crew-test-types';
import { file as fichierDesInterludes } from './schemas/defs/interludeEvents';
import { file as fichierDesCritiquesDeNavire } from './schemas/defs/ship-criticals';
import { file as fichierDesCritiquesFluviaux } from './schemas/defs/river-criticals';
import { file as fichierDesEvenementsDeMer } from './schemas/defs/sea-events';

/**
 * POOLS DES TABLES TIRÉES (#3923) — chaque catégorie Codex des fichiers de tables tirées (Blessures
 * critiques, miscast, Critiques de structure, de navire et fluviaux, Incidents de Salve, Tests
 * d'équipage, Interludes) et les deux tables d'événements de `sea-events.json` admet par la porte dynamique (b) de `entryCategoryOf` (`src/data/index.ts`) EXACTEMENT les
 * ids de ses rangées, mesuré sur le chemin réel (`resolveStake` d'un `kind` sans catégorie déclarée).
 */

/** `kind` de la porte (b) : sans `entryCategory` déclarée, la catégorie vient de la clé. */
const KIND_DYNAMIQUE = { dataset: 'combat', kind: 'critique-ligne-test' } as const;

const descend = (category: string, entryId: string): boolean => {
  const rule = resolveStake({ key: { ...KIND_DYNAMIQUE, entryId, entryCategory: category } }).rule;
  return rule?.category === category && rule.id === entryId;
};

/** JSON BRUT des fichiers à chemin simple : leurs rangées se lisent sans la racine vivante. */
const JSON_BRUT: Record<string, unknown> = {
  [fichierDesCritiquesDeStructure]: structureCriticalsJson,
  [fichierDesIncidentsDeSalve]: artilleryMisfireJson,
  [fichierDesTestsDEquipage]: crewTestTypesJson,
  [fichierDesInterludes]: interludeEventsJson,
  [fichierDesCritiquesDeNavire]: shipCriticalsJson,
  [fichierDesCritiquesFluviaux]: riverCriticalsJson,
  [fichierDesEvenementsDeMer]: seaEventsJson,
};

const rangeesDeLaCategorie = (category: string): { id: string }[] => {
  const d = DATASET_DE_LA_CATEGORIE[category];
  if (d.fichier in JSON_BRUT) return suivreLeChemin(JSON_BRUT[d.fichier], d.chemin) as { id: string }[];
  const doc = (d.chemin[0] as { cle: string }).cle;
  return d.fichier === fichierDesCritiques ? critiqueEntries(doc) : rangeesDe<typeof miscastDef>(miscastRawJson, doc);
};

/** `sea-events.json` : seules ses tables d'événements sont des pools (`seaFastVoyage`, `seaManannFactors` n'en sont pas). */
const CATEGORIES = Object.keys(DATASET_DE_LA_CATEGORIE).filter((c) => {
  const { fichier } = DATASET_DE_LA_CATEGORIE[c];
  return fichier === fichierDesEvenementsDeMer
    ? c === 'seaBoardEvents' || c === 'seaPortEvents'
    : [fichierDesCritiques, fichierDesMiscast, ...Object.keys(JSON_BRUT)].includes(fichier);
});

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
    expect(descend('colereDesDieux', ajoutee.id)).toBe(false);
    setDataset('colereDesDieux', [...rangees, ajoutee]);
    expect(descend('colereDesDieux', ajoutee.id)).toBe(true);
  });
});
