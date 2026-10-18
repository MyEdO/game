/**
 * ANCRAGE de l'atelier Codex sur la voie TABLEAU (#1472 — ancrage par ID).
 *
 * CONTRAT POSITIF : tout item d'une catégorie Codex ÉDITABLE ouvre une entrée TROUVÉE et NON VIDE.
 * `CodexEdit` résout l'entrée par `arr.findIndex((e) => String(e.id ?? '') === id)` (`CodexEdit.tsx`, mémo
 * `src`), où `id` est l'identité STABLE de l'item du navigateur : un item que cette résolution rate
 * ouvre un formulaire VIDE en silence, et l'enregistrement APPEND un doublon au dataset. Le `label`
 * est de l'AFFICHAGE, jamais ce qu'on compare (doctrine utilisateur 2026-07-09).
 *
 * Le test rejoue CETTE résolution, sans DOM, sur TOUTES les catégories de dataset-liste éditables —
 * le périmètre est MESURÉ (`editableDataset` sur `CODEX`), jamais une liste de noms : une catégorie
 * neuve y entre sans qu'on l'inscrive.
 *
 * CARDINALITÉ : le contrat est la RÉSOLUTION TOTALE (items ⊆ documents par id), PAS l'égalité de
 * population — une catégorie peut ne projeter qu'une PARTIE de son dataset par filtre déclaré au
 * build (`landCargo`, `seaCargo` : échangeables) sans qu'aucun item n'y perde son ancrage.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { editableDataset, editableObjectDataset } from '../editor/codex/CodexEdit';
import { datasetArray } from '../../data/overrides';

/** Catégories projetées sur un dataset-TABLEAU éditable (mesurées, pas déclarées ici). */
const LISTES = CODEX.filter((c) => !editableObjectDataset(c.key) && editableDataset(c.key));

const docsDe = (cle: string) => datasetArray(editableDataset(cle)!) as unknown as Record<string, unknown>[];

/** Ce que le Codex TAIT, DÉCLARÉ : par catégorie, le nombre de documents du dataset que le build ne
 *  projette PAS, et la cause (le filtre, au site). Table FERMÉE et cliquet DÉCROISSANT : une
 *  catégorie qui tait sans entrée, une entrée dont l'écart ne vaut plus ce qui est écrit (disparu,
 *  augmenté, réduit) = ROUGE nominatif. */
const FILTRES_DE_BUILD: Record<string, { tus: number; cause: string }> = {
  landCargo: { tus: 2, cause: "registry.ts build `.filter(isEchangeable)` — marqueurs `echangeable:false` : commerce, subsistance" },
  seaCargo: { tus: 2, cause: "registry.ts build `.filter(isEchangeable)` — marqueurs `echangeable:false` : commerce, minimum-vital" },
};

/** Borne du TU total : le Codex ne peut pas taire davantage sans décision explicite. */
const TUS_MAX = 4;

describe('atelier Codex — voie TABLEAU : chaque item s’ancre PAR ID sur une entrée du dataset', () => {
  it('le périmètre est peuplé (sinon ce contrat ne garde rien)', () => {
    expect(LISTES.length).toBeGreaterThan(50);
    expect(LISTES.map((c) => c.key)).toContain('names');
  });

  it('aucun item n’ouvre un formulaire VIDE — la résolution par `id` retrouve chaque entrée', () => {
    const vides: string[] = [];
    for (const cat of LISTES) {
      const arr = docsDe(cat.key);
      for (const item of cat.items) {
        const i = arr.findIndex((e) => String(e.id ?? '') === item.id);
        const trouvee = i >= 0 && !!arr[i] && Object.keys(arr[i]).length > 0;
        if (!trouvee) vides.push(`${cat.key}[${JSON.stringify(item.id)}] (« ${item.label} ») n’est ancré sur aucune entrée de ${editableDataset(cat.key)}`);
      }
    }
    expect(vides, vides.join('\n')).toEqual([]);
  });

  it('l’identité des documents est NON AMBIGUË : un `id` par entrée, aucun doublon', () => {
    const fautes: string[] = [];
    for (const cat of LISTES) {
      const arr = docsDe(cat.key);
      const compte = new Map<string, number>();
      for (const e of arr) {
        if (e.id === undefined) { fautes.push(`${editableDataset(cat.key)} : une entrée sans \`id\` — inatteignable par l’atelier`); continue; }
        const k = String(e.id);
        compte.set(k, (compte.get(k) ?? 0) + 1);
      }
      for (const [k, n] of compte) if (n > 1) fautes.push(`${editableDataset(cat.key)}[${k}] apparaît ${n} fois — l’atelier éditerait le 1er homonyme`);
    }
    expect([...new Set(fautes)], fautes.join('\n')).toEqual([]);
  });

  it('ce que le Codex TAIT est DÉCLARÉ (table fermée, cliquet décroissant)', () => {
    const fautes: string[] = [];
    let totalTus = 0;
    for (const cat of LISTES) {
      const ecart = docsDe(cat.key).length - cat.items.length;
      const declare = FILTRES_DE_BUILD[cat.key];
      if (ecart > 0) totalTus += ecart;
      if (!declare) {
        if (ecart !== 0) fautes.push(`${cat.key} : ${ecart > 0 ? `${ecart} document(s) TU(S)` : `${-ecart} item(s) SANS document`} (${cat.items.length} items pour ${docsDe(cat.key).length} entrées de ${editableDataset(cat.key)}) — aucune entrée dans FILTRES_DE_BUILD : déclarer la cause ou supprimer le filtre`);
        continue;
      }
      if (ecart !== declare.tus) {
        fautes.push(`${cat.key} : FILTRES_DE_BUILD déclare ${declare.tus} tu(s) (${declare.cause}), l'écart MESURÉ vaut ${ecart} — ${ecart === 0 ? 'entrée PÉRIMÉE, à retirer' : ecart > declare.tus ? 'le Codex tait DAVANTAGE : cliquet décroissant violé' : 'déclaration à recaler sur la mesure'}`);
      }
    }
    for (const key of Object.keys(FILTRES_DE_BUILD)) {
      if (!LISTES.some((c) => c.key === key)) fautes.push(`FILTRES_DE_BUILD[${key}] : catégorie absente du périmètre mesuré — entrée périmée`);
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
    expect(totalTus, `le Codex tait ${totalTus} documents (borne ${TUS_MAX})`).toBeLessThanOrEqual(TUS_MAX);
  });
});
