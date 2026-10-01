/**
 * GARDE — le catalogue BRUT des trappings ne se lit qu'à des sites nommés (#1988) : tout producteur
 * d'ids d'objet lit la vue `trappingsInstanciables` (`data/index.ts`), la sous-liste de schéma
 * `INSTANCIABLE_PAR_ID` n'est jamais redéclarée par un filtre. Construction réservée
 * `lectureBruteDeCollection` (`scripts/guards/lib/canonUnique.mjs`), domaine = code de PRODUCTION de
 * `src/` et `scripts/` ; tests hors domaine.
 */
import { describe, it, expect } from 'vitest';
import {
  constructionsReserveesDuCorpus, lectureBruteDeCollection, scanConstructionsReservees, type SiteAdmis,
} from '../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/** Où la collection brute est légitime : la déclaration des vues, le seam, la racine générée, et le
 *  Codex (qui montre tout le catalogue). */
const FOYER = [
  'src/data/index.ts',
  'src/data/overrides.ts',
  'src/data/schemas/_racines-vivantes.generated.ts',
  'src/ui/compendium/registry.ts',
  'src/ui/compendium/relations.ts',
];

/** Sites où un appel au seam est ADMIS, chacun avec sa raison. */
const SITES_ADMIS: readonly (SiteAdmis & { readonly raison: string })[] = [
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'validateEntry', appele: 'datasetArray', raison: 'existence d’une référence dans le dataset de SON champ (`REF_LIST_DATASET`, `NESTED_REF_FIELDS`) : comparaison, rien n’est instancié' },
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'editableEntries', appele: 'datasetArray', raison: 'les entrées ÉDITÉES au Codex, qui montre tout le catalogue' },
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'CodexEdit › save', appele: 'datasetArray', raison: 'l’écriture au seam du dataset édité' },
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'CodexEdit › save', appele: 'datasetSerializeRoot', raison: 'l’écriture au seam du dataset édité' },
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'RefDatalist', appele: 'datasetArray', raison: 'libellés d’un dataset, proposés à une saisie libre' },
  { rel: 'src/ui/compendium/CodexEdit.tsx', englobante: 'ProsthesisField', appele: 'datasetArray', raison: 'champ de COMPARAISON (`traumas.prosthesis`, `engine/trauma.ts › prosthesisCancels` compare aux objets portés, n’instancie rien), #1463' },
  { rel: 'src/ui/compendium/RefField.tsx', englobante: 'useUnivers', appele: 'datasetArray', raison: 'univers d’un sélecteur générique : ses options et sa saisie se jugent sur la sous-liste du nœud du champ (`refusDuNoeud`)' },
  { rel: 'src/ui/compendium/RefField.tsx', englobante: 'VocabField', appele: 'datasetArray', raison: 'vocabulaire des valeurs d’un champ, jamais des ids' },
];

const PARAMETRES = {
  nom: 'LECTURE_BRUTE_DES_TRAPPINGS',
  liaisons: [
    { module: 'src/data/index.ts', exporte: 'trappings' },
    { module: 'src/data/schemas/_racines-vivantes.generated.ts', exporte: 'RACINES_VIVANTES' },
  ],
  json: 'trappings.json',
  seam: { module: 'src/data/overrides.ts', fonctions: ['datasetArray', 'collectionDuDataset', 'datasetSerializeRoot'] },
  dataset: 'trappings',
} as const;
const domaine = (rel: string) => !estFichierVitest(rel);
const GARDE = { ...lectureBruteDeCollection({ ...PARAMETRES, sitesAdmis: SITES_ADMIS }), foyer: FOYER, domaine };
const SANS_SITES = { ...lectureBruteDeCollection(PARAMETRES), foyer: FOYER, domaine };

const lignes = (text: string, rel = 'src/engine/temoin.ts') => scanConstructionsReservees({ rel, text }, [GARDE]).map((t) => t.line);

describe('lecture brute des trappings hors de la vue', () => {
  /** La frontière de la garde est une DONNÉE : chaque forme, son verdict (`[2]` vue, `[]` non vue). */
  const FORMES: readonly (readonly [string, string, string, number[]])[] = [
    ['vue', 'import nommé', 'const x = 1;', "import { trappings } from '../data';"],
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

  it('un site admis ne l’est qu’à SA déclaration englobante, jamais au fichier', () => {
    const texte = "import { datasetArray } from '../../data/overrides';\nfunction ProsthesisField() { return datasetArray('trappings'); }\nfunction Autre() { return datasetArray('trappings'); }";
    expect(lignes(texte, 'src/ui/compendium/CodexEdit.tsx')).toEqual([3]);
  });

  it('le FOYER seul est hors de la garde : son texte, sous un autre chemin, est vu', () => {
    const [foyer] = corpusDesGardes().filter(({ rel }) => rel === 'src/data/overrides.ts');
    expect(foyer, 'le foyer existe').toBeTruthy();
    expect(lignes(foyer.text, 'src/data/overrides.ts')).toEqual([]);
    expect(lignes(foyer.text, 'src/data/copie.ts').length).toBeGreaterThan(0);
  });

  it('chaque site admis existe : une admission sans site est morte', () => {
    const vues = constructionsReserveesDuCorpus(corpusDesGardes(), [SANS_SITES]);
    for (const s of SITES_ADMIS) {
      expect(vues.some((t) => t.rel === s.rel && t.detail.includes(`\`${s.appele}`) && t.detail.endsWith(`dans \`${s.englobante}\``)), `${s.rel} › ${s.englobante} › ${s.appele}`).toBe(true);
    }
  });

  it('aucune lecture brute sous `src/` ni `scripts/`', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [GARDE])).toEqual([]);
  });
});
