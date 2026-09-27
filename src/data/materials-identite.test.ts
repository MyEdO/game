import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { materials, matieresDe, structureAppearances } from './index';
import { DOMAINES_MATIERE, type MaterialEntry } from './materials.types';
import { propMaterial } from '../gameIso/catalog/propMaterials';
import { roofMaterial } from '../gameIso/catalog/roofs';
import { reliefMaterial } from '../gameIso/catalog/relief';
import { terrains } from './index';

/**
 * IDENTITÉ D'UNE MATIÈRE DU MONDE (#1686) — l'identité est le couple (DOMAINE, id), et l'id est
 * UNIQUE dans TOUT le document `materials.json`, dont le périmètre est `prop`, `roof`, `relief`.
 * `MaterialRef.domain` en déclare CINQ (`src/gameIso/builders/types.ts:34` : terrain, relief,
 * structure, roof, prop) ; les deux autres portent chacun SON dataset — `terrain` a le sien
 * (`terrains.json`, #1690 : règle et rendu dans la même entrée), `structure` un dataset d'apparence
 * (`structureAppearance.json`), un composite qui RÉFÉRENCE des matières. Leurs collisions d'id VIVANTES sont mesurées et tenues au cliquet en fin de fichier,
 * jamais tues.
 * Un homonyme se COMPOSE (`prop-ardoise` / `toit-ardoise`), il ne se distingue pas par le domaine du
 * lecteur : depuis le lot 2 les trois catalogues sont UN document, donc UN espace de noms, et deux
 * entrées de même id n'y seraient plus séparables du tout.
 *
 * Le contrat est DÉRIVÉ du dataset (aucune liste d'ids récitée ici) et il porte le TIE-BREAK : les
 * trois vues résolvent par `catalogEntry` sur un balayage VIF du document construit à l'identique
 * (`matieresDe(domaine).find`), donc un id en double y ferait gagner la PREMIÈRE déclaration en
 * silence. L'unicité, refusée au parse (collection à clé, `schemas/grammaire/collection-cle.ts`), rend
 * ce départage sans objet, et laisse UN seul chemin de résolution.
 */
const VUES: { domaine: string; entrees: readonly MaterialEntry[]; resout: (id: string) => { id: string } }[] = [
  { domaine: 'prop', entrees: matieresDe('prop'), resout: propMaterial },
  { domaine: 'roof', entrees: matieresDe('roof'), resout: roofMaterial },
  { domaine: 'relief', entrees: matieresDe('relief'), resout: reliefMaterial },
];

describe('identité des matières du monde — (domaine, id), id unique sur tout le document', () => {
  it('les vues par domaine PARTITIONNENT le document, sans reste, et le périmètre est celui déclaré', () => {
    expect(VUES.map((v) => v.domaine)).toEqual([...DOMAINES_MATIERE]);
    for (const v of VUES) expect(v.entrees.length, v.domaine).toBeGreaterThan(0);
    expect(
      VUES.reduce((n, v) => n + v.entrees.length, 0),
      'une entrée porte un domaine hors du périmètre déclaré : elle échapperait à toutes les gardes ci-dessous',
    ).toBe(materials.length);
  });

  it.each(VUES.map((v) => [v.domaine, v] as const))(
    'domaine %s : chaque id se résout par SON accesseur vers SON entrée (chemin unique `catalogEntry`)',
    (domaine, v) => {
      for (const e of v.entrees) expect(v.resout(e.id), `${domaine} : ${e.id}`).toBe(e);
    },
  );

  /**
   * RÉGRESSION que le lot INTERDIT : le retour aux ids NUS. `ardoise` porté à la fois par une matière
   * de toiture et par une matière de décor est exactement l'état d'avant la migration
   * `2026-09-05-1686-ardoise-ids-composes.mjs` — il doit être ROUGE ici, sous son nom.
   */
  it('un retour aux ids NUS (`ardoise` en `roof` ET en `prop`) est REFUSÉ, nominativement', () => {
    const nu = (domaine: string, entrees: readonly { id: string }[], compose: string) =>
      entrees.map((e) => ({ domaine, id: e.id === compose ? 'ardoise' : e.id }));
    const regresse = [
      ...nu('roof', matieresDe('roof'), 'toit-ardoise'),
      ...nu('prop', matieresDe('prop'), 'prop-ardoise'),
      ...matieresDe('relief').map((e) => ({ domaine: 'relief', id: e.id })),
    ];
    const parId = new Map<string, string[]>();
    for (const e of regresse) parId.set(e.id, [...(parId.get(e.id) ?? []), e.domaine]);
    const partages = [...parId].filter(([, d]) => d.length > 1).map(([id]) => id);
    expect(partages, 'la fixture de régression ne reproduit plus l’homonyme — la garde ne mesure rien').toEqual([
      'ardoise',
    ]);
    // Et la MÊME logique, jouée sur le dépôt, ne rend rien : c'est ce que les ids composés achètent.
    expect(matieresDe('roof').map((e) => e.id)).toContain('toit-ardoise');
    expect(matieresDe('prop').map((e) => e.id)).toContain('prop-ardoise');
    expect(materials.map((e) => e.id)).not.toContain('ardoise');
  });
});

/**
 * CLIQUET DÉCROISSANT des collisions HORS du dataset des matières — dérivé des CINQ domaines de
 * `MaterialRef.domain`, pas des trois que `materials.json` porte. Ces homonymes vivent : aucun
 * lecteur ne s'y trompe aujourd'hui, parce que chacun résout dans le domaine de la FACE qu'il peint
 * (`src/gameIso/backends/webgl/faceColors.ts:47` et `src/gameIso/authoring/floorsSvg.ts:61,72` pour
 * une face de relief, `src/gameIso/backends/webgl/faceRelief.ts:35` pour une face de structure).
 * Le jour où ces deux catalogues rejoignent le document unique, ils cessent d'être séparables : le
 * stock ci-dessous ne peut donc que DÉCROÎTRE, et une collision de plus est rouge sous son nom.
 */
const COLLISIONS_HORS_PERIMETRE = [
  'pierre : relief + terrain',
  'porte : structure + terrain',
  'terre : relief + terrain',
];

describe('collisions d’id sur les CINQ domaines — cliquet décroissant', () => {
  const DOMAINES: Record<string, readonly string[]> = {
    prop: matieresDe('prop').map((e) => e.id),
    relief: matieresDe('relief').map((e) => e.id),
    roof: matieresDe('roof').map((e) => e.id),
    structure: structureAppearances.map((e) => e.id),
    terrain: terrains.map((e) => e.id),
  };

  it('les domaines mesurés sont EXACTEMENT ceux que `MaterialRef.domain` déclare', () => {
    const source = readFileSync('src/gameIso/builders/types.ts', 'utf8');
    const union = /domain:\s*((?:'[a-z]+'\s*\|\s*)*'[a-z]+')/.exec(source);
    expect(union, '`MaterialRef.domain` ne se lit plus comme une union de littéraux').not.toBeNull();
    const declares = [...union![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(declares).toEqual(Object.keys(DOMAINES).sort());
    // Et le périmètre du DATASET est un SOUS-ENSEMBLE de ces domaines — il n'en invente aucun.
    expect(declares).toEqual(expect.arrayContaining([...DOMAINES_MATIERE]));
  });

  it('le stock nominatif des collisions vivantes est EXACT — une de plus est rouge, une résolue le fait baisser', () => {
    const parId = new Map<string, string[]>();
    for (const [domaine, ids] of Object.entries(DOMAINES))
      for (const id of ids) parId.set(id, [...(parId.get(id) ?? []), domaine]);
    const mesure = [...parId]
      .filter(([, d]) => d.length > 1)
      .map(([id, d]) => `${id} : ${[...d].sort().join(' + ')}`)
      .sort();
    expect(
      mesure,
      'collision NOUVELLE → composer l’id (patron `toit-ardoise`/`prop-ardoise`) ; collision RÉSOLUE → ' +
        'retirer sa ligne de COLLISIONS_HORS_PERIMETRE, le stock ne remonte jamais',
    ).toEqual(COLLISIONS_HORS_PERIMETRE);
  });
});
