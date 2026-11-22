/**
 * GARDE — le catalogue BRUT des trappings se lit dans ses modules de référence (#1988) : tout producteur
 * d'ids d'objet lit la vue `trappingsInstanciables` (`data/index.ts`), la sous-liste de schéma
 * `INSTANCIABLE_PAR_ID` n'est jamais redéclarée par un filtre. Construction réservée
 * `lectureBruteDeCollection` (`scripts/guards/lib/canonUnique.mjs`), domaine = code de PRODUCTION de
 * `src/` et `scripts/` ; tests hors domaine.
 */
import { describe, it, expect } from 'vitest';
import {
  constructionsReserveesDuCorpus, lectureBruteDeCollection, scanConstructionsReservees,
} from '../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';

/** Où la collection brute est légitime : la déclaration des vues, le seam, la racine générée, et le
 *  Codex (qui montre tout le catalogue), son atelier et sa session (qui le lisent et l'écrivent entier). */
const FOYER = [
  'src/data/index.ts',
  'src/data/apparencesObjets.ts',
  'src/data/atelierDuCodex.ts',
  'src/data/overrides.ts',
  'src/data/schemas/_racines-vivantes.generated.ts',
  'src/noyau/codex/registry.ts',
  'src/noyau/codex/relations.ts',
  'src/noyau/codex/session.ts',
];

const PARAMETRES = {
  nom: 'LECTURE_BRUTE_DES_TRAPPINGS',
  liaisons: [
    { module: 'src/data/index.ts', exporte: 'trappings' },
    { module: 'src/data/apparencesObjets.ts', exporte: 'trappings' },
    { module: 'src/data/schemas/_racines-vivantes.generated.ts', exporte: 'RACINES_VIVANTES' },
  ],
  json: 'trappings.json',
  seam: { module: 'src/data/overrides.ts', fonctions: ['datasetArray', 'entreesDuDataset', 'collectionDuDataset', 'datasetSerializeRoot'] },
  dataset: 'trappings',
} as const;
const domaine = (rel: string) => !estFichierVitest(rel) && !estKitDeTest(rel);
const GARDE = { ...lectureBruteDeCollection(PARAMETRES), foyer: FOYER, domaine };

function lignes(text: string, rel = 'src/engine/temoin.ts'): number[] {
  return scanConstructionsReservees({ rel, text }, [GARDE]).map((t) => t.line);
}

describe('lecture brute des trappings hors de la vue', () => {
  /** La frontière de la garde est une DONNÉE : chaque forme, son verdict (`[2]` vue, `[]` non vue). */
  const FORMES: readonly (readonly [string, string, string, number[]])[] = [
    ['vue', 'import nommé', 'const x = 1;', "import { trappings } from '../data';"],
    ['vue', 'catalogue partagé avec le parse', 'const x = 1;', "import { trappings } from '../data/apparencesObjets';"],
    ['vue', 'import nommé renommé', 'const x = 1;', "import { trappings as tout } from '../data/index';"],
    ['vue', 'espace de noms', "import * as D from '../data';", 'D.trappings.length;'],
    ['vue', 'réexportation', "const x = 1;", "export { trappings } from '../data';"],
    ['vue', 'import du JSON', "const x = 1;", "import brut from '../data/trappings.json';"],
    ['vue', 'appel au seam, littéral du dataset', "import { datasetArray } from '../data/overrides';", "datasetArray('trappings');"],
    ['vue', 'appel au seam, argument non littéral', "import { datasetArray } from '../data/overrides';", 'datasetArray(cle);'],
    ['vue', 'racines vivantes', "const x = 1;", "import { RACINES_VIVANTES } from '../data/schemas/_racines-vivantes.generated';"],
    ['vue', 'collection du dataset', "import { collectionDuDataset } from '../data/overrides';", "collectionDuDataset('trappings');"],
    ['vue', 'racine sérialisée, non littéral', "import { datasetSerializeRoot } from '../data/overrides';", 'datasetSerializeRoot(cle);'],
    ['non vue', 'la vue', "import { trappingsInstanciables } from '../data';", 'trappingsInstanciables();'],
    ['non vue', 'un autre dataset au seam', "import { datasetArray } from '../data/overrides';", "datasetArray('skills');"],
    ['non vue', 'homonyme d’un autre module', "import { trappings } from './metier';", 'trappings.length;'],
    ['non vue', 'membre d’un objet non importé', 'const carriere = { trappings: [] };', 'carriere.trappings.length;'],
    ['non vue', 'texte d’un littéral', 'const t = 1;', "const f = `import { trappings } from '../data';`;"],
  ].map(([verdict, forme, tete, corps]) => [verdict, forme, `${tete}\n${corps}`, verdict === 'vue' ? [2] : []] as const);

  it.each(FORMES)('frontière — %s : %s', (_verdict, _forme, texte, attendu) => {
    expect(lignes(texte)).toEqual(attendu);
  });

  it('le FOYER seul est hors de la garde : son texte, sous un autre chemin, est vu', () => {
    const [foyer] = corpusDesGardes().filter(({ rel }) => rel === 'src/data/overrides.ts');
    expect(foyer, 'le foyer existe').toBeTruthy();
    expect(lignes(foyer.text, 'src/data/overrides.ts')).toEqual([]);
    expect(lignes(foyer.text, 'src/data/copie.ts').length).toBeGreaterThan(0);
  });

  it('aucune lecture brute sous `src/` ni `scripts/`', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [GARDE])).toEqual([]);
  });
});
