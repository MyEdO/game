import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFieldConsumersMd } from '../../scripts/docs/build-field-consumers.mjs';
import { CIBLES_DE_GRAMMAIRE, fieldsOf } from '../../scripts/guards/lib/fieldConsumerTargets.mjs';
import { listProdFiles, scanFieldReads, fieldOwnership, groupByField, libererCache } from '../../scripts/guards/lib/fieldConsumers.mjs';
import { virtualProgram, VIRTUAL_ROOT } from '../../scripts/guards/lib/tsProgram.mjs';
import { ciblesDeCatalogue, mesurerChampsDeSchema } from '../../scripts/guards/lib/schemaFieldConsumers.mjs';
import { z } from 'zod';
import { variantOf } from './schemas/grammaire/valeurs';
import { nommerChamps } from './schemas/grammaire/meta';
import { detenteur } from '../lib/detenteur.testkit';
import { markSchema } from './schemas/defs/progression-schemas-derived';

/**
 * Garde du rapport « consommateurs par champ » (#903 — `scripts/docs/build-field-consumers.mts`,
 * `docs/consommateurs-de-champs.md`), en sept blocs : la MORSURE du diagnostic d'écart (`ecartDoc`,
 * qui nomme la divergence dont vit le bloc DÉTERMINISME) ; le PÉRIMÈTRE des cibles, où aucune cible
 * ne rend zéro champ ; la DÉRIVATION des cibles de catalogue (`ciblesDeCatalogue`), mordue sur
 * fixtures ; le cas FONDATEUR (`TrappingRef.spec`, #903) en CONTRAT POSITIF
 * `fichier:ligne` sur le dépôt RÉEL ; le DÉTERMINISME cross-OS (ordre total de la liste des racines,
 * et `.md` byte-identique sur le corpus inversé) ; le CONTRAT POSITIF des champs dont le détecteur
 * au `TypeChecker` (#1620) a recouvré les lecteurs, chacun nommé avec son site, avec les CLIQUETS
 * NOMINATIFS des « 0 lecteur » et des champs absents du type TS (une entrée apparue comme une entrée
 * disparue est rouge) ; et la MORSURE du détecteur sur des fixtures en mémoire
 * (dernier `describe`), où chaque verdict REFUSÉ est asserté autant que chaque verdict accordé.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Le rapport, régénéré EN PROCESSUS et mémoïsé : un SEUL scan du corpus nourrit toutes les
 *  assertions qui le lisent (cas fondateur, déterminisme, champs recouvrés, cliquet des « 0 lecteur »).
 *  PARESSEUX : payé au 1ᵉʳ `it` qui le demande, jamais à la collecte de vitest (#1801).
 *  Seul le rapport dérivé est retenu, aucun Program. */
const rapport = detenteur(buildFieldConsumersMd);

const STOCK_CHAMPS_DE_SCHEMA: readonly (readonly [string, string])[] = [
  ["talents.json:[].variants", "Lecteur vérifié : src/engine/variants.ts:29-31 via src/engine/magic.ts:365, careerSlots.ts:295 et combatFeatures/dispatch.ts:20/56/61 ; provenance générique non reliée par le scanner."],
];

describe('champs de schéma de dataset — type explicite ou lecteur relié', () => {
  it('les champs sans type ni lecteur sont exactement ceux du stock nominatif motivé', () => {
    const mesure = mesurerChampsDeSchema(ROOT);
    const stock = STOCK_CHAMPS_DE_SCHEMA.map(([champ]) => champ);
    expect(new Set(stock).size, 'chaque chemin du stock doit être unique').toBe(stock.length);
    expect(STOCK_CHAMPS_DE_SCHEMA.every(([, motif]) => motif.trim().length > 0), 'chaque chemin du stock doit porter son motif').toBe(true);
    expect(mesure.datasets.every((d) => d.declares > 0)).toBe(true);
    expect([...mesure.absents].sort(), 'diagnostic nouveau ou disparu : réviser le stock nominatif motivé\n' + mesure.absents.join('\n') + '\nChargements non résolus :\n' + mesure.chargementsNonResolus.join('\n')).toEqual([...stock].sort());
  }, 250_000);

  it('un schéma neuf et une valeur JSON seule ne valent pas lecteur ; les homonymes restent séparés', () => {
    const sources = {
      'src/data/a.json': '{"id":"a","lu":"oui","inactif":"non"}',
      'src/data/b.json': '{"inactif":"autre"}',
      'src/lecteur.ts': `import a from './data/a.json';
import b from './data/b.json';
type Vue = { id: string; typeSeulement?: string };
export const vue = a as Vue;
const alias = a;
export const { lu } = alias;
export const autre = b.inactif;
declare const schema: { safeParse(v: unknown): unknown };
schema.safeParse(a);`,
    };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const schema = z.object({ id: z.string(), lu: z.string(), typeSeulement: z.string().optional(), inactif: z.string(), neuf: z.string().optional() });
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:inactif', 'a.json:neuf']);
    } finally { session.dispose(); }
  });

  it('relie les clés finies d’une boucle sans créditer les clés hors de son domaine', () => {
    const sources = {
      'src/data/a.json': '{"lv":{"1":[{"valeur":1}],"2":[{"valeur":2}],"3":[{"valeur":3}]}}',
      'src/lecteur.ts': "import a from './data/a.json'; for (const n of ['1', '2']) for (const row of a.lv[n]) console.log(row.valeur);",
    };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const row = z.array(z.object({ valeur: z.number() }));
      const schema = z.object({ lv: z.object({ '1': row, '2': row, '3': row }) });
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:lv.3', 'a.json:lv.3[].valeur']);
    } finally { session.dispose(); }
  });

  it('un schéma partagé ne crédite pas un champ absent de son type explicite', () => {
    const sources = {
      'scripts/guards/lib/progressionSchemas.d.mts': 'export interface ProgressionMark { col: string; characteristic: string; teinte?: [number, number, number] }',
    };
    const session = virtualProgram(sources);
    try {
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema: z.array(markSchema) }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:[].x']);
    } finally { session.dispose(); }
  });

  it('une projection de variante ne donne aucun crédit à un champ neuf de son entrée', () => {
    const sources = {
      'src/data/a.json': '{"id":"a","lu":"oui"}',
      'src/vue.ts': `import a from './data/a.json'; export const vue = a as { id: string; lu: string };`,
      'src/data/schemas/grammaire/valeurs.ts': `export type Variant = { when: { rule: string; equals?: boolean } };`,
    };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const base = nommerChamps(z.object({ id: z.string(), lu: z.string(), neuf: z.string().optional() }), { id: { label: 'Identifiant' }, lu: { label: 'Lu' }, neuf: { label: 'Neuf' } });
      const schema = base.extend({ variants: z.array(variantOf(base, ['lu', 'neuf'])).optional() });
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:neuf', 'a.json:variants', 'a.json:variants[].neuf']);
    } finally { session.dispose(); }
  });

  it('refuse un type JSON recyclé, une écriture, un résultat map fabriqué et un accumulateur reduce', () => {
    const sources = {
      'src/data/a.json': '[{"inactif":1}]',
      'src/vue.ts': `import a from './data/a.json';
export const recopie = a as typeof a;
const mapped = a.map(() => ({ inactif: 1 }));
export const fabrique = mapped[0].inactif;
a[0].inactif = 2;
export const accumule = a.reduce((acc) => ({ inactif: acc.inactif + 1 }), { inactif: 0 });`,
    };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const schema = z.array(z.object({ inactif: z.number() }));
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:[].inactif']);
    } finally { session.dispose(); }
  });

  it('une clé dynamique de type string ne crédite aucun champ supplémentaire du schéma', () => {
    const sources = {
      'src/data/a.json': '{"id":"a"}',
      'src/vue.ts': `import a from './data/a.json'; const k = 'id' as string; export const val = a[k];`,
    };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const schema = z.object({ id: z.string(), neuf: z.string().optional() });
      const mesure = mesurerChampsDeSchema(VIRTUAL_ROOT, { definitions: [{ file: 'a.json', schema }], programme: session, fichiers: Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)) });
      expect(mesure.absents).toEqual(['a.json:id', 'a.json:neuf']);
    } finally { session.dispose(); }
  });
});

/**
 * L'ÉCART entre DEUX rendus du rapport, en une phrase — vide = identiques. Trois cas NOMMÉS, mordus
 * ci-dessous sur des textes forgés : première ligne qui DIVERGE (cherchée sur le PRÉFIXE COMMUN seul
 * — un `findIndex` sur tout le régénéré rendrait « committé : undefined » dès qu'un texte est plus
 * court que l'autre) ; et, quand un texte est le préfixe de l'autre, la première ligne en SURPLUS
 * avec son côté. Les deux textes sont produits EN MÉMOIRE par l'unique appelant (le bloc
 * DÉTERMINISME) : aucun n'est lu du disque, aucun ne peut manquer.
 */
export function ecartDoc(regenere: string, committe: string): string {
  const attendues = regenere.split('\n');
  const lues = committe.split('\n');
  const commun = Math.min(attendues.length, lues.length);
  for (let k = 0; k < commun; k++) {
    if (attendues[k] !== lues[k]) {
      return `ligne ${k + 1} — committé : ${JSON.stringify(lues[k])} / régénéré : ${JSON.stringify(attendues[k])}`;
    }
  }
  if (attendues.length === lues.length) return '';
  return attendues.length > lues.length
    ? `ligne ${lues.length + 1} MANQUE au committé : ${JSON.stringify(attendues[lues.length])}`
    : `ligne ${attendues.length + 1} EN TROP au committé : ${JSON.stringify(lues[attendues.length])}`;
}

describe('MORSURE du diagnostic d’écart — chaque écart se dit en clair', () => {
  const A = 'a\nb\nc';
  it('textes IDENTIQUES : aucun écart', () => {
    expect(ecartDoc(A, A)).toBe('');
  });
  it('ligne qui DIVERGE : la première, des deux côtés', () => {
    expect(ecartDoc(A, 'a\nX\nc')).toBe('ligne 2 — committé : "X" / régénéré : "b"');
  });
  it('committé PRÉFIXE du régénéré : la première ligne MANQUANTE, jamais « undefined »', () => {
    expect(ecartDoc(A, 'a\nb')).toBe('ligne 3 MANQUE au committé : "c"');
  });
  it('régénéré PRÉFIXE du committé : la première ligne EN TROP, jamais « ligne 0 »', () => {
    expect(ecartDoc('a\nb', A)).toBe('ligne 3 EN TROP au committé : "c"');
  });
});

/**
 * CONTRAT POSITIF sur le PÉRIMÈTRE lui-même. `fieldsOf` rend `[]` — sans lever — pour un nœud qui
 * n'expose ni `.shape` ni `.options` : un export de schéma renommé/supprimé laisse la cible pointer
 * `undefined`, le rapport perd le type EN SILENCE et le test de fraîcheur reste VERT (le doc régénéré
 * et le doc committé s'accordent sur la même table vide). Le cas d'école de la dérivation : les champs
 * de l'entrée de `trappings.json` qu'aucune cible écrite à la main ne portait.
 */
describe('périmètre des cibles — aucune cible ne rend zéro champ', () => {
  it('chaque cible expose au moins un champ (une cible muette = un type perdu du rapport)', () => {
    const muettes = rapport().cibles.filter((t) => t.champs.length === 0).map((t) => t.type);
    expect(
      muettes,
      'cible(s) sans champ : le schéma visé a disparu ou changé de forme',
    ).toEqual([]);
  }, 240_000);

  it('la garde n’est pas vacante — une cible au schéma disparu est DÉTECTÉE (contre-épreuve)', () => {
    expect(fieldsOf(undefined)).toEqual([]);
  });

  it('l’entrée de `trappings.json` est DÉRIVÉE : `TrappingData` porte les champs de son schéma', () => {
    const trappings = rapport().cibles.find((c) => c.type === 'TrappingData');
    expect(trappings, 'TrappingData absent des cibles dérivées').toMatchObject({ home: 'src/data/index.ts', catalogues: ['trappings.json'] });
    expect(trappings!.champs).toEqual(expect.arrayContaining(['service', 'formChoices', 'prosthesisTraining']));
  }, 240_000);
});

/**
 * DÉRIVATION des cibles de catalogue (`ciblesDeCatalogue`) sur des sources EN MÉMOIRE : un def chargé
 * sous un type nommé ENTRE sans qu'aucune liste change, le même def sans chargement typé SORT avec sa
 * raison, et chaque forme de type non nommé dit SA raison.
 */
describe('DÉRIVATION des cibles de catalogue — entrée par la jointure, sortie par raison émise', () => {
  const schema = z.array(z.object({ id: z.string(), poids: z.number() }));
  const deriver = (lecteur: string, definitions: { file: string; schema: unknown }[] = [{ file: 'a.json', schema }]) => {
    const sources = { 'src/data/a.json': '[{"id":"a","poids":1}]', 'src/data/types.ts': 'export interface AData { id: string; poids: number }', 'src/lecteur.ts': lecteur };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      return ciblesDeCatalogue(VIRTUAL_ROOT, session, Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)), definitions);
    } finally { session.dispose(); }
  };

  it('un chargement TYPÉ fait entrer le type de l’entrée, domicilié à sa déclaration, aux clés du schéma', () => {
    expect(deriver(`import a from './data/a.json'; import type { AData } from './data/types'; export const tout = a as AData[];`)).toEqual({
      cibles: [{ type: 'AData', home: 'src/data/types.ts', cles: ['id', 'poids'], files: ['a.json'] }],
      sorties: [],
    });
  });

  it('le MÊME def sans chargement typé SORT, avec la raison mesurée', () => {
    expect(deriver(`import a from './data/a.json'; export const n = a.length;`)).toEqual({
      cibles: [],
      sorties: [{ file: 'a.json', raison: 'aucun chargement typé (cast, annotation ou porte `datasetDe`/`rangeesDe`)' }],
    });
  });

  it('un littéral inline, une intersection et `unknown` disent chacun leur raison', () => {
    const raison = (lecteur: string) => deriver(`import a from './data/a.json'; import type { AData } from './data/types'; ${lecteur}`).sorties.map((x) => x.raison);
    expect(raison('export const v = a as { id: string; poids: number }[];')).toEqual(['littéral anonyme `{…}` au chargement src/lecteur.ts:1']);
    expect(raison('export const v = a as (AData & { x?: 1 })[];')).toEqual(['intersection anonyme au chargement src/lecteur.ts:1']);
    expect(raison('export const v = a as unknown[];')).toEqual(['type `unknown` au chargement src/lecteur.ts:1']);
  });

  it('une vue de sous-chemin seule ne nomme pas l’entrée : sortie, chemin et site nommés', () => {
    const objet = z.object({ table: z.array(z.object({ id: z.string() })) });
    const sources = `import a from './data/a.json'; export const t = a.table as { id: string }[];`;
    expect(deriver(sources, [{ file: 'a.json', schema: objet }]).sorties).toEqual([
      { file: 'a.json', raison: "aucune vue typée de l'entrée — vues de sous-chemins seulement : `table` (src/lecteur.ts:1)" },
    ]);
  });

  it('CLIQUETS : un catalogue neuf aux seules clés d’enveloppe ne les bouge pas, un champ hors enveloppe jamais lu les bouge', () => {
    const sources = {
      'src/data/a.json': '[]',
      'src/data/types.ts': 'export interface AData { id: string; poids: number; neuf?: string }',
      'src/lecteur.ts': `import a from './data/a.json'; import type { AData } from './data/types';
export const tout = a as AData[]; export const poids = (x: AData) => x.poids;`,
    };
    const fichiers = Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p));
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      const cliquets = (entree: z.ZodRawShape) => {
        const r = buildFieldConsumersMd(fichiers, { racine: VIRTUAL_ROOT, programme: session, definitions: [{ file: 'a.json', schema: z.array(z.object(entree)) }], grammaire: [] });
        return { cibles: r.cibles.map((c) => c.type), zeros: r.zeros, absents: r.absents };
      };
      // `id` jamais lu, `type`/`label`/`source` absents de `AData` : toutes clés d'ENVELOPPE.
      const enveloppe = { id: z.string(), type: z.string(), label: z.string(), source: z.string(), poids: z.number() };
      expect(cliquets(enveloppe)).toEqual({ cibles: ['AData'], zeros: [], absents: [] });
      expect(cliquets({ ...enveloppe, neuf: z.string(), extra: z.string() })).toEqual({ cibles: ['AData'], zeros: ['AData.neuf'], absents: ['AData.extra'] });
    } finally { session.dispose(); }
  });

  it('un type atteint par DEUX defs est UNE cible, à l’union de leurs clés', () => {
    const b = z.array(z.object({ id: z.string(), teinte: z.string() }));
    const lecteur = `import a from './data/a.json'; import b from './data/b.json'; import type { AData } from './data/types';
export const x = a as AData[]; export const y = b as unknown as AData[];`;
    const sources = { 'src/data/a.json': '[]', 'src/data/b.json': '[]', 'src/data/types.ts': 'export interface AData { id: string; poids: number }', 'src/lecteur.ts': lecteur };
    const session = virtualProgram(sources, { resolveJsonModule: true, allowSyntheticDefaultImports: true });
    try {
      expect(ciblesDeCatalogue(VIRTUAL_ROOT, session, Object.keys(sources).map((p) => join(VIRTUAL_ROOT, p)), [{ file: 'a.json', schema }, { file: 'b.json', schema: b }]).cibles).toEqual([
        { type: 'AData', home: 'src/data/types.ts', cles: ['id', 'poids', 'teinte'], files: ['a.json', 'b.json'] },
      ]);
    } finally { session.dispose(); }
  });
});

describe('cas fondateur #903 — qui lit TrappingRef.spec ?', () => {
  /**
   * `TrappingRef.spec` a DEUX lecteurs directs, un par ROLE : `resoudre`
   * (`src/engine/trappingChoices.ts`) qui reconduit la spec en résolvant un emplacement
   * `qualityChoice`, et `itemFromTrappingRef` (`src/engine/items.ts`) qui la MATÉRIALISE sur
   * l'`ItemInstance` — sans quoi la spécialisation se perd entre la dotation et le sac (#1463
   * L-ref-1). Le RENDU, lui, n'en est pas un : « base (spec) » passe par `refLabel`
   * (`src/data/index.ts`), SOURCE UNIQUE partagée par toute référence, son paramètre est un `RefDesignee` —
   * un lecteur mesuré dans `data/index.ts` signalerait une SECONDE définition du rendu, et c'est ce
   * que cette garde refuse. La preuve d'AFFICHAGE vit sur la donnée réelle
   * (`src/data/dotations-catalogue.test.ts`, `src/engine/integration-creation.test.ts`).
   */
  it('`TrappingRef.spec` : DEUX lecteurs, résolution et matérialisation — aucun dans le rendu', () => {
    const target = CIBLES_DE_GRAMMAIRE.find((t) => t.type === 'TrappingRef');
    expect(target, 'TrappingRef absent de CIBLES_DE_GRAMMAIRE — le cas fondateur a perdu sa surface').toBeTruthy();
    const byField = rapport().byType.get('TrappingRef');
    expect(byField, 'TrappingRef absent du rapport mesuré').toBeTruthy();
    // `fichier @symbole` (ancre de `Hit`, `scripts/docs/build-field-consumers.mts`) : le fichier seul
    // resterait vert si le lecteur déménageait dans une AUTRE fonction du même module, la ligne rougirait
    // au premier ajout en amont. Le nombre de SITES distincts tient « un seul site par lecteur ».
    const hits: { file: string; line: number; symbole: string }[] = byField!.get('spec') ?? [];
    const specSites = new Set(hits.map((h) => `${h.file}:${h.line}`));
    const specLecteurs = [...new Set(hits.map((h) => `${h.file} @${h.symbole}`))].sort();
    expect(
      specLecteurs,
      'TrappingRef.spec devrait avoir EXACTEMENT 2 lecteurs : la résolution de choix et la matérialisation',
    ).toEqual(['src/engine/items.ts @gabaritDeLaRef', 'src/engine/trappingChoices.ts @spec']);
    expect(specSites.size, `un site lecteur par symbole — sites : ${[...specSites].join(', ')}`).toBe(2);
    expect(
      hits.some((h) => h.file.includes('data/index.ts')),
      'un lecteur de spec dans `data/index.ts` = une seconde définition du rendu « base (spec) », qui appartient à `refLabel`',
    ).toBe(false);
  }, 240_000);
});

/**
 * DÉTERMINISME du rapport à travers les MACHINES : il est committé depuis un poste Windows (NTFS,
 * `readdirSync` trie sans tenir compte de la casse) et rejoué par la CI sous Linux (ext4 rend l'ordre
 * d'un hash). Tout ce que le rapport publie doit donc naître d'un ORDRE TOTAL calculé, jamais de
 * l'ordre du système de fichiers : la liste des racines (`listProdFiles`) et les sites d'un champ
 * (`scanFieldReads`, triés par fichier puis ligne). Les deux `it` prennent les deux bouts : la
 * PROPRIÉTÉ (la liste est triée) et l'EFFET (le même `.md`, corpus à l'envers).
 */
describe('DÉTERMINISME cross-OS — le rapport ne dépend pas du système de fichiers', () => {
  const corpus = () => listProdFiles(join(ROOT, 'src')).map((p: string) => p.replace(/\\/g, '/'));

  it('`listProdFiles` rend un ORDRE TOTAL, chemins strictement croissants en unités de code', () => {
    const fichiers = corpus();
    expect(fichiers.length, 'corpus vide : la sonde ne mesurerait rien').toBeGreaterThan(1000);
    expect(
      fichiers.filter((p, i) => i > 0 && !(fichiers[i - 1] < p)),
      'chemins non strictement croissants — l’ordre du système de fichiers a fui dans la liste',
    ).toEqual([]);
  });

  it('le `.md` bâti sur le corpus en ordre INVERSÉ est BYTE-IDENTIQUE', () => {
    const inverse = [...listProdFiles(join(ROOT, 'src'))].reverse();
    const ecart = ecartDoc(buildFieldConsumersMd(inverse).md, rapport().md);
    if (ecart !== '') expect.fail(`l'ordre des racines a fui dans le rendu — ${ecart}`);
  }, 300_000);
});

/**
 * CONTRAT POSITIF des champs RECOUVRÉS par le détecteur au `TypeChecker` (#1620) : chacun est nommé
 * avec le `fichier @symbole` de son lecteur. Un « 0/16 faux négatifs » ne prouverait rien (une mesure
 * qui rend zéro partout le satisfait) ; ici, chaque ligne exige une lecture RÉELLE à un site précis,
 * et la disparition du site est rouge sous le nom du champ. `TraitInstance.hidden` y figure parce que
 * `hiddenGroupsOf` ANNOTE `TraitInstance[]` : c'est cette annotation qui rend sa lecture mesurable.
 *
 * L'ancre est le SYMBOLE englobant, jamais le numéro de ligne d'un fichier VIVANT.
 */
const RECOUVRES: readonly (readonly [string, string, string])[] = [
  ['DetailRecipe', 'tintVar', 'src/noyau/monde/volume/matieres.ts @tv'],
  ['EntityAppearance', 'armurePortee', 'src/ui/editor/codex/CodexEdit.tsx @AppearanceField'],
  ['CritEscalation', 'onRepeat', 'src/engine/critical.ts @repeat'],
  ['Amputation', 'timing', 'src/engine/critical.ts @resolveCritique, src/noyau/codex/registry.ts @meta'],
  ['FlowTest', 'opposed', 'src/noyau/combat/triggeredTest.ts @opp'],
  ['CountSpec', 'fixed', 'src/data/index.ts @count'],
  ['CountSpec', 'roll', 'src/data/index.ts @count'],
  ['TrappingRef', 'label', 'src/engine/possessionGrants.ts @possessionGrantsFromRefs'],
  ['FlowTest', 'argDifficulty', 'src/noyau/triggeredEffects.ts @visit'],
  ['TravelTableEntry', 'stageOutcome', 'src/noyau/travelPostes.ts @etapeRencontre'],
  ['TraitInstance', 'hidden', 'src/engine/groups.ts @hiddenGroupsOf'],
];

/**
 * CLIQUET des « 0 lecteur » : les champs PROPRES sans aucun lecteur, HORS clés d'enveloppe de
 * `document()` (`CLES_ENVELOPPE`, classe structurelle que le rapport émet à part), écrits NOMINATIVEMENT
 * par type et comparés à l'identique. Une ligne sort quand le champ disparaît ou retrouve un lecteur ; un zéro
 * NOUVEAU (champ dont le dernier lecteur disparaît, champ de schéma neuf jamais lu) est rouge sous son
 * nom, jamais avalé par un plafond. Ne sont ici ni les champs HÉRITÉS (leur « 0 » est tautologique)
 * ni les champs ABSENTS du type TS, qui ont leur cliquet (`ABSENTS`). Un zéro dont la lecture passe
 * hors du type de l'entrée le dit par sa raison (`RAISONS_DES_ZEROS`) ; il reste au rapport.
 */
const ZEROS: Readonly<Record<string, readonly string[]>> = {
  ActivityDef: ['rounds', 'stake', 'stakeForm', 'unavailableIfExtenue'],
  BookData: ['dir', 'language', 'niveauDeSection', 'pdf', 'teneur'],
  CritDoc: ['die'],
  DomainData: ['grantGroups'],
  EntreeDeGardeRobe: ['svg'],
  EtatData: ['severity'],
  GodData: ['grantGroups'],
  LocationData: ['prefix', 'suffix'],
  ManeuverDef: ['stakeForm'],
  MaterialEntry: ['E', 'built', 'palette', 'planInner'],
  MiscastTableDef: ['die'],
  PlanDEspece: ['corps', 'echelle', 'famille', 'omis'],
  PsychologyData: ['stakeForm'],
  QualityData: ['aspect'],
  ReseauRoutierData: [
    'effectifMax', 'effectifMin', 'effectifRouteReculeeMax', 'effectifRouteReculeeMin', 'espacementKm',
    'espacementKmMax', 'espacementKmMin', 'etapeChevalJours', 'etapeDiligenceJours', 'etapePiedJours',
    'facteurGrandsTroublesMax', 'facteurGrandsTroublesMin', 'facteurZoneDangereuse', 'kind', 'largeurMaxM',
    'largeurMinM', 'prixSurcotePct', 'tarifBrassMax', 'tarifBrassMin',
  ],
  SeaPerilsData: ['tourbillonSwim'],
  SeaWeatherData: ['encalmine'],
  SkillData: ['specsOpen'],
  StakeEntry: ['entryFromSource', 'form'],
  StarData: ['classique'],
  StructureData: ['enc', 'encLimit'],
  TalentData: ['codexOnly', 'grantSpecGroups', 'specsOpen'],
  TraitData: ['difficulte', 'grantSpecGroups', 'specsOpen'],
  TrappingData: [
    'bladed', 'consumableDuration', 'container', 'indirect', 'minRangeBand', 'onHitEffects',
    'organicProjectile', 'requiresMastery', 'service', 'sizeFor', 'soloSimple',
  ],
  WeaponGroupData: ['combat', 'poudre', 'siege'],
};

/** Raison d'un zéro LU hors du type de l'entrée, mesurée par la jointure (lecture reliée au dataset sous
 *  une autre vue) ou par clé dynamique. Les clés d'ENVELOPPE sans lecteur, elles, sont classées par le
 *  rapport (`CLES_ENVELOPPE`). */
const RAISONS_DES_ZEROS: Readonly<Record<string, string>> = {
  'BookData.dir': 'lu sous la vue `EntreeDeLivre` par `estLivreExtrait` (`src/data/source/livre-extrait.ts`) et `scripts/raw/_lib.mjs`',
  'BookData.language': 'lu par `scripts/docs/build-ajouter-donnee.mjs`, sur le registre JSON',
  'BookData.niveauDeSection': 'lu sous la vue `EntreeDeLivre` par `scripts/raw/_lib.mjs#niveauxDeSectionDe`',
  'BookData.pdf': 'lu sous la vue `EntreeDeLivre` par `scripts/raw/_lib.mjs#pdfDe`',
  'BookData.teneur': 'lu sous la vue `EntreeDeLivre` par `scripts/raw/_lib.mjs#teneursDe`',
  'CritDoc.die': 'lu par la porte `deDeTirageDe` (`src/data/rangees.ts`), qui lit `die` à la racine JSON du document',
  'EntreeDeGardeRobe.svg': 'lu par l’hôte Godot, hors du corpus `src/` : l’emblème offert à l’atelier (`hotes/godot/pont/atelier.ts`)',
  'MaterialEntry.E': 'lu par clé dynamique : `sh[part]`, pente de toit à son orientation (`panFill`, `src/gameIso/authoring/roofsSvg.ts`)',
  'MaterialEntry.palette': 'lu par l’hôte Godot, hors du corpus `src/` : `findTeinteById(…)?.palette` (`hotes/godot/pont/atelier.ts`, `hotes/godot/pont/composition.ts`)',
  'MiscastTableDef.die': 'lu par la porte `deDeTirageDe` (`src/data/rangees.ts`), qui lit `die` à la racine JSON du document',
  'PlanDEspece.echelle': 'lu par `jugerDeclaration` (`scripts/personnage-3d/base/declaration.mjs`), qui juge l’échelle d’art du porteur d’une base',
  'TrappingData.service': 'lu par clé dynamique : marqueur de la sous-liste `INSTANCIABLE_PAR_ID` (`grammaire/sousListes.ts`)',
  'WeaponGroupData.combat': 'lu par clé dynamique : discriminant de l’espace `weaponGroups.json?combat=…` (`grammaire/sourcesDeSpecs.ts`), filtré par `grammaire/cle-d-espace.ts`',
  'WeaponGroupData.poudre': 'lu par clé dynamique : marqueur `poudre` (`porteLeMarqueur`, `marqueAPoudre`, `src/engine/weaponGroup.ts`)',
  'WeaponGroupData.siege': 'lu par clé dynamique : marqueur `siege` (`porteLeMarqueur`, `marqueDeSiege`, `src/data/index.ts`)',
};

/** CLIQUET des champs du SCHÉMA ABSENTS du type TS de leur cible (divergence schéma↔type), hors clés
 *  d'enveloppe et nominatif par type comme `ZEROS`. Une vue étroite y porte tout ce qu'elle ne déclare pas. */
const ABSENTS: Readonly<Record<string, readonly string[]>> = {};

const aplatir = (parType: Readonly<Record<string, readonly string[]>>) =>
  Object.entries(parType).flatMap(([type, champs]) => champs.map((c) => `${type}.${c}`)).sort();

describe('contrat POSITIF des champs recouvrés + cliquet des « 0 lecteur »', () => {
  it('chaque champ recouvré a son lecteur MESURÉ au site nommé', () => {
    const mesure = (type: string, champ: string) =>
      [...new Set((rapport().byType.get(type)?.get(champ) ?? []).map((h: { file: string; symbole: string }) => `${h.file} @${h.symbole}`))];
    const constate = RECOUVRES.map(([type, champ, site]) => {
      const sites = mesure(type, champ);
      const attendus = site.split(', ');
      const tenus = attendus.every((s) => sites.includes(s));
      return `${type}.${champ} → ${tenus ? site : sites.join(', ') || 'AUCUN LECTEUR'}`;
    });
    expect(
      constate,
      'un champ recouvré a perdu son lecteur au symbole nommé (disparition = régression du détecteur ; renommage du symbole = mettre à jour l’ancre)',
    ).toEqual(RECOUVRES.map(([type, champ, site]) => `${type}.${champ} → ${site}`));
  }, 150_000);

  it('les « 0 lecteur » sont EXACTEMENT ceux de la liste — cliquet nominatif', () => {
    expect(
      [...rapport().zeros].sort(),
      'zéro apparu (régression : un champ a perdu son dernier lecteur) ou zéro disparu (retirer sa ligne de ZEROS)',
    ).toEqual(aplatir(ZEROS));
    expect(Object.keys(RAISONS_DES_ZEROS).filter((c) => !rapport().zeros.includes(c)), 'raison d’un zéro qui n’en est plus un').toEqual([]);
    // RECOUPEMENT : le cardinal RENDU dans la Synthèse — ce qu'un humain lit — contre la liste
    // nommée. (`totalUnread` et `zeros` sont incrémentés côte à côte dans le générateur : les
    // comparer l'un à l'autre ne mesurerait rien.)
    const rendu = /\*\*(\d+) « 0 lecteur »\*\* et \*\*(\d+) absents\*\* sont sous CLIQUET/.exec(rapport().md);
    expect(
      rendu?.slice(1),
      'la Synthèse du rapport ne publie plus ses cardinaux sous cliquet sous la forme attendue',
    ).toEqual([String(aplatir(ZEROS).length), String(aplatir(ABSENTS).length)]);
  }, 150_000);

  it('les champs ABSENTS du type TS sont EXACTEMENT ceux de la liste — cliquet nominatif', () => {
    expect(
      [...rapport().absents].sort(),
      'divergence schéma↔type apparue (déclarer le champ sur le type) ou disparue (retirer sa ligne d’ABSENTS)',
    ).toEqual(aplatir(ABSENTS));
  }, 150_000);
});

/**
 * MORSURE du détecteur, sur des sources EN MÉMOIRE (`virtualProgram`, `scripts/guards/lib/
 * tsProgram.mjs` — le patron de la garde #841). Le rapport du dépôt ne PROUVE rien tout seul : il
 * dit ce que le code contient aujourd'hui, jamais ce que le détecteur REFUSE. Ici, chaque site est
 * écrit pour un verdict, et le verdict est asserté.
 *
 * `virtualProgram` ne sert que ses propres sources plus le répertoire `lib` de TypeScript : `zod`
 * n'y est pas résoluble : un `import { z } from 'zod'` y rend le diagnostic
 * « Cannot find module 'zod' or its corresponding type declarations », le porteur se résout à
 * `z.infer<any>` et la propriété lue n'a AUCUN symbole. Le triplet zod est donc reproduit par un module
 * `src/z.ts` qui porte le SEUL trait qui compte pour le détecteur : un alias
 * `type X = Infer<typeof S>` dont les propriétés pointent les `PropertyAssignment` du shape. Le cas
 * zod RÉEL est couvert par la mesure du dépôt (`SourceRef` ← `sourceRefSchema`, `docs/
 * consommateurs-de-champs.md`).
 */
describe('MORSURE du détecteur — fixtures en mémoire', () => {
  const FIXTURES: Record<string, string> = {
    'src/types.ts': `export interface Ref { id: string; spec?: string }
export type TrappingRef = Ref & { qty?: number };
export type U = Ref & { x?: number };
`,
    'src/lecteurs.ts': `import type { Ref, TrappingRef, U } from './types';
// OUI l.3 — porteur ANNOTÉ du type cible
export const direct = (r: TrappingRef) => r.spec;
// OUI l.5 — variable au type INFÉRÉ depuis un porteur du type cible
export function parVariable(r: TrappingRef) { const s = r; return s.spec; }
// NON l.7 — \`U\` compose \`Ref\` comme \`TrappingRef\`, sans être \`TrappingRef\`
export const surU = (u: U) => u.spec;
// NON l.9 — porteur déclaré \`Ref\` : la lecture compte sous le DÉCLARANT
export const surRef = (r: Ref) => r.spec;
// OUI l.11 — opérateur de type appliqué à la cible (l'alias est PERDU, l'annotation le nomme)
export const parExtract = (r: Extract<TrappingRef, { id: string }>) => r.spec;
// OUI l.13 — élément inféré d'un tableau annoté du type cible
export const parTableau = (rs: TrappingRef[]) => rs.map((r) => r.spec);
// OUI l.15 — déstructuration directe
export const parDestructuration = ({ spec }: TrappingRef) => spec;
`,
    'src/autre.ts': `// Homonyme STRICT : même nom \`Ref\`, autre module, autre DÉCLARATION.
export interface Ref { id: string; spec?: string }
export const surAutreRef = (r: Ref) => r.spec;
`,
    'src/z.ts': `export interface Schema<T> { readonly _sortie: T }
export declare function objet<T extends object>(shape: T): Schema<T>;
export declare function texte(): string;
export type Infer<S> = S extends Schema<infer T> ? T : never;
`,
    'src/a.ts': `import { objet, texte } from './z';
export const boxSchema = objet({ note: texte(), taille: texte() });
`,
    'src/c.ts': `import type { Infer } from './z';
import { boxSchema } from './a';
export type Carton = Infer<typeof boxSchema>;
export const surCarton = (c: Carton) => c.note;
`,
    'src/d.ts': `import type { Carton } from './c';
export interface Box extends Carton {}
export const surBoxPure = (b: Box) => b.note;
`,
    'src/anon.ts': `import type { Ref } from './types';
// NON l.3 — type ANONYME de MÊME FORME que \`Ref\` : il porte SES propres déclarations
export const surAnonyme = (r: { id: string; spec?: string }) => r.spec;
// OUI l.5 — témoin : le MÊME fichier crédite bien quand le porteur est annoté \`Ref\`
export const surRefIci = (r: Ref) => r.spec;
`,
  };
  const FICHIERS = Object.keys(FIXTURES).map((rel) => join(VIRTUAL_ROOT, rel));

  /** Sites mesurés d'un champ sur une cible, sur le programme des fixtures. */
  const sites = (type: string, home: string, champ: string): string[] => {
    const programme = virtualProgram(FIXTURES);
    try {
      const hits = scanFieldReads({ type, home }, [champ], FICHIERS, VIRTUAL_ROOT, new Map(), programme);
      return [...new Set(groupByField([champ], hits).get(champ)!.map((h) => `${h.file}:${h.line}`))];

    } finally { programme.dispose(); }
  };

  it('CONJONCTION (1)∧(2) — le porteur doit être du type, la propriété doit être la sienne', () => {
    expect(sites('TrappingRef', 'src/types.ts', 'spec')).toEqual([
      'src/lecteurs.ts:3',
      'src/lecteurs.ts:5',
      'src/lecteurs.ts:11',
      'src/lecteurs.ts:13',
      'src/lecteurs.ts:15',
    ]);
  });

  it('le DÉCLARANT compte toutes les lectures de la propriété qu’il déclare (c’est son renommage qui les casse)', () => {
    expect(sites('Ref', 'src/types.ts', 'spec')).toEqual([
      'src/anon.ts:5',
      'src/lecteurs.ts:3',
      'src/lecteurs.ts:5',
      'src/lecteurs.ts:7',
      'src/lecteurs.ts:9',
      'src/lecteurs.ts:11',
      'src/lecteurs.ts:13',
      'src/lecteurs.ts:15',
    ]);
  });

  it('FORME identique, DÉCLARATIONS distinctes : un type ANONYME ne crédite RIEN (pas de faux positif structurel)', () => {
    // `src/anon.ts` porte les deux versants dans le MÊME fichier : le paramètre annoté d'un littéral
    // de même forme que `Ref` (l.3) et un porteur annoté `Ref` (l.5). Le second est crédité — donc le
    // fichier EST scanné et l'absence du premier n'est pas une non-mesure.
    const declarant = sites('Ref', 'src/types.ts', 'spec');
    expect(declarant).toContain('src/anon.ts:5');
    expect(declarant).not.toContain('src/anon.ts:3');
    expect(sites('TrappingRef', 'src/types.ts', 'spec')).not.toContain('src/anon.ts:3');
  });

  it('un `home` qui ne DÉCLARE pas le type est une ERREUR nommée, jamais une table muette', () => {
    // `src/autre.ts` déclare son propre `Ref`, jamais `TrappingRef` : une cible mal domiciliée
    // rendrait zéro lecteur EN SILENCE, et le rapport publierait une absence fabriquée.
    expect(() => sites('TrappingRef', 'src/autre.ts', 'spec')).toThrowError(
      'fieldConsumers : type `TrappingRef` introuvable dans src/autre.ts — cible non résoluble',
    );
  });

  it('un même `cache` porté par DEUX Programs rend DEUX contextes — le premier ne se rejoue pas', () => {
    // Le contexte (Program, index des accès) est clé par SON Program : sans cela, le second appel
    // relirait l'index du premier corpus et rendrait ses sites sous le nom du second.
    const AUTRE: Record<string, string> = {
      'src/types.ts': FIXTURES['src/types.ts'],
      'src/second.ts': `import type { Ref } from './types';
export const ici = (r: Ref) => r.spec;
`,
    };
    const partage = new Map();
    const mesure = (fixtures: Record<string, string>) => {
      const fichiers = Object.keys(fixtures).map((rel) => join(VIRTUAL_ROOT, rel));
      const session = virtualProgram(fixtures);
      try {
        const hits = scanFieldReads({ type: 'Ref', home: 'src/types.ts' }, ['spec'], fichiers, VIRTUAL_ROOT, partage, session);
        return [...new Set(hits.map((h) => `${h.file}:${h.line}`))];
      } finally { session.dispose(); }
    };
    expect(mesure(FIXTURES)).toContain('src/lecteurs.ts:3');
    expect(mesure(AUTRE)).toEqual(['src/second.ts:2']);
  });

  it('HOMONYMIE : deux `Ref` de modules différents ne se croisent jamais', () => {
    expect(sites('Ref', 'src/types.ts', 'spec')).not.toContain('src/autre.ts:3');
    expect(sites('Ref', 'src/autre.ts', 'spec')).toEqual(['src/autre.ts:3']);
  });

  it('la fermeture tente tous les propriétaires après une erreur et préserve les sessions empruntées', () => {
    const premier = virtualProgram({ 'a.ts': 'export const a = 1' });
    const second = virtualProgram({ 'b.ts': 'export const b = 2' });
    const emprunt = virtualProgram({ 'c.ts': 'export const c = 3' });
    const erreur = new Error('fermeture interrompue');
    let fermeturesDuSecond = 0;
    const cache = new Map<unknown, unknown>([
      ['premier', { sessionPropre: { ...premier, dispose: () => { premier.dispose(); throw erreur; } } }],
      ['second', { sessionPropre: { ...second, dispose: () => { second.dispose(); fermeturesDuSecond++; } } }],
      ['emprunt', { sessionPropre: null, program: emprunt.program }],
    ]);
    try {
      expect(() => libererCache(cache)).toThrow(erreur);
      expect(fermeturesDuSecond).toBe(1);
      expect(cache.size).toBe(0);
      const sf = emprunt.program.getSourceFile(join(VIRTUAL_ROOT, 'c.ts'))!;
      expect(emprunt.checker.getTypeAtLocation(sf)).toBeDefined();
    } finally { premier.dispose(); second.dispose(); emprunt.dispose(); }
  });

  it('Partial, Pick et mapping gardent les déclarations de la cible, les homonymes gardent les leurs', () => {
    const fixtures = {
      'src/types.ts': 'export interface Ref { spec: string }',
      'src/autre.ts': 'export interface Ref { spec: string }',
      'src/lecteurs.ts': `import type { Ref } from './types';
import type { Ref as Autre } from './autre';
type Champs<T> = { [K in keyof T]?: T[K] };
export const partiel = (r: Partial<Ref>) => r.spec;
export const choisi = (r: Pick<Ref, 'spec'>) => r.spec;
export const mappe = (r: Champs<Ref>) => r.spec;
export const etranger = (r: Pick<Autre, 'spec'>) => r.spec;
`,
    };
    const session = virtualProgram(fixtures);
    const cache = new Map();
    const fichiers = Object.keys(fixtures).map((rel) => join(VIRTUAL_ROOT, rel));
    try {
      expect(scanFieldReads({ type: 'Ref', home: 'src/types.ts' }, ['spec'], fichiers, VIRTUAL_ROOT, cache, session)
        .map((h) => `${h.file}:${h.line}`)).toEqual(['src/lecteurs.ts:4', 'src/lecteurs.ts:5', 'src/lecteurs.ts:6']);
      expect(scanFieldReads({ type: 'Ref', home: 'src/autre.ts' }, ['spec'], fichiers, VIRTUAL_ROOT, cache, session)
        .map((h) => `${h.file}:${h.line}`)).toEqual(['src/lecteurs.ts:7']);
      libererCache(cache);
      expect(cache.size).toBe(0);
      expect(session.program.getSourceFile(join(VIRTUAL_ROOT, 'src/types.ts'))).toBeDefined();
    } finally { session.dispose(); }
  });

  it('shape → type inféré : le DÉCLARANT est reconnu par SYMBOLE du schéma, pas par son nom', () => {
    // `Carton` DÉCLARE `note` (par le shape de `boxSchema`, dont son `typeof` donne le symbole) :
    // ses deux lectures lui reviennent. Un lien par NOM fabriqué (`boxSchema` → « Box ») ne le
    // reconnaîtrait PAS et lui retirerait la lecture faite sur un porteur `Box`.
    expect(sites('Carton', 'src/c.ts', 'note')).toEqual(['src/c.ts:4', 'src/d.ts:3']);
  });

  it('shape → type inféré : un type qui COMPOSE le corps inféré ne capte pas les lecteurs du déclarant', () => {
    // `Box` compose `Carton` sans rien déclarer : il ne compte QUE ses propres porteurs. Un lien par
    // NOM (`boxSchema` → « Box » = la cible) lui attribuerait `src/c.ts:4`, dont le porteur est un
    // `Carton` — l'exacte confusion `Ref`/`TrappingRef` que la condition (2) interdit.
    expect(sites('Box', 'src/d.ts', 'note')).toEqual(['src/d.ts:3']);
    expect(sites('Box', 'src/d.ts', 'note')).not.toContain('src/c.ts:4');
  });

  it('ÉTATS d’un champ : propre / hérité / absent du type TS', () => {
    const programme = virtualProgram(FIXTURES);
    try {
      const etats = fieldOwnership(
        { type: 'TrappingRef', home: 'src/types.ts' },
        ['spec', 'qty', 'fantome'],
        FICHIERS,
        VIRTUAL_ROOT,
        new Map(),
        programme,
      );
      expect(etats.get('spec')).toEqual({ etat: 'herite', declarant: 'Ref' });
      expect(etats.get('qty')?.etat).toBe('propre');
      expect(etats.get('fantome')).toEqual({ etat: 'absent' });

    } finally { programme.dispose(); }
  });

  it('DÉCLARANT d’un champ à DEUX déclarations : le premier en (fichier, position), quel que soit l’ordre du type', () => {
    // `Zeta` est le PREMIER constituant de l'union, `Alpha` le premier en ordre de fichier : le déclarant
    // imprimé suit l'ordre total (`premiereDeclaration`), jamais l'ordre que le `TypeChecker` rend.
    const fixtures = {
      'src/a-alpha.ts': 'export interface Alpha { note?: string }',
      'src/b-zeta.ts': 'export interface Zeta { note?: string }',
      'src/u.ts': `import type { Alpha } from './a-alpha';
import type { Zeta } from './b-zeta';
export type Les2 = Zeta | Alpha;
export type Les2Inverse = Alpha | Zeta;
`,
    };
    const programme = virtualProgram(fixtures);
    const fichiers = Object.keys(fixtures).map((rel) => join(VIRTUAL_ROOT, rel));
    try {
      for (const type of ['Les2', 'Les2Inverse']) {
        expect(fieldOwnership({ type, home: 'src/u.ts' }, ['note'], fichiers, VIRTUAL_ROOT, new Map(), programme).get('note')).toEqual({ etat: 'herite', declarant: 'Alpha' });
      }
    } finally { programme.dispose(); }
  });

  it('la CASSE du `home` n’est pas repliée : un chemin de casse divergente est une cible non résoluble', () => {
    // Les deux côtés de la comparaison viennent du MÊME Program : une casse divergente est une erreur
    // d'écriture de la cible, levée, jamais un fichier trouvé par repli sur un système insensible.
    expect(() => sites('TrappingRef', 'src/Types.ts', 'spec')).toThrowError(
      'fieldConsumers : type `TrappingRef` introuvable dans src/Types.ts — cible non résoluble',
    );
  });
});
