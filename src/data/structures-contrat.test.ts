import { afterAll, describe, expect, it } from 'vitest';
import { rendreCible } from '../../scripts/docs/build-all.mjs';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detenteur } from '../detenteur.testkit';
import { tableTotale } from '../lib/tableTotale';
import {
  classerValeur,
  clesPortees,
  entreesPartiellesEmbarquees,
  listerDocuments,
  mesurerEnveloppe,
  scanDuCorpus,
  scannerDonnees,
  scannerRedeclarations,
  type Redeclaration,
} from '../../scripts/docs/lib/structures-scan.mjs';
import { regenerations, sitesHorsStrate } from '../../scripts/guards/lib/horsStrateAudit';
import { HORS_STRATE_RATCHET } from '../../scripts/guards/lib/horsStrateStock.mjs';
import { cleDeSite, ecartDuVolet, SEPARATEUR_DE_REMEDE, sitesEnEntrees } from '../../scripts/guards/lib/stock.mjs';
import { COLLECTIONS_A_COMPTE_PAR_NOM, ecartsDeCollection, occurrencesDe, siteDEnveloppe, siteDeForme } from '../../scripts/guards/lib/occurrencesStock.mjs';
import { corpusDuScan } from '../../scripts/guards/lib/corpusDesComptes.mjs';
import { ecartDeRegeneration, texteEnPlace } from '../../scripts/guards/lib/stockDeSites.mjs';
import {
  ANGLES_MORTS,
  CLES_DE_VALEUR,
  CONCEPTS,
  DATASETS_DES_PROJETS,
  LOTS_CONNUS,
  LOTS_DE_PEUPLEMENT,
  LOT_CLE_RESERVEE,
  lotDeForme,
  CLES_IDENTITE,
  RX_CLE_REFERENCE,
  signature,
} from '../../scripts/docs/lib/structures-lexique.mjs';
import { CLES_ENVELOPPE, document, type Exposition } from './schemas/grammaire/document';
import { CONTENU_A_SOURCER, SANS_LIVRE, SOURCE_EN_PROFONDEUR } from './schemas/grammaire/sans-livre';
import { marquerCollection, marqueDeRecord } from './schemas/grammaire/collection-cle';
import type { SchemaDef } from './schemas/types';
import { TYPES, espaceDe, type TypeEntite } from './schemas/grammaire/ref';

/**
 * Clés que `document()` pose sur TOUT document, sans qu'aucun def ne les demande — DÉRIVÉES de
 * `CLES_ENVELOPPE`, jamais re-tapées.
 *
 * `variants` en est EXCLUE et c'est la seule : la fabrique ne la pose que si le def le DEMANDE
 * (`options.variantes`, `document.ts` — « un document sans `variantes` n'admet aucun `variants` »).
 * Elle reste donc une DÉCLARATION du def, comme n'importe quel champ de `champs` : un def qui
 * l'active sans qu'aucune entrée ne la porte est bien « un schéma plus large que sa donnée », et sa
 * dette se compte.
 */
const CLES_POSEES_INCONDITIONNELLEMENT: readonly string[] = (CLES_ENVELOPPE as readonly string[]).filter((k) => k !== 'variants');
import {
  STRUCTURES_CIBLES,
  STRUCTURES_DEFAUT,
  STRUCTURES_ENVELOPPE,
  STRUCTURES_FORMES,
  STRUCTURES_HOMONYMES,
  STRUCTURES_OPS,
  STRUCTURES_ORPHELINES,
  STRUCTURES_REDECLARATIONS,
} from '../../scripts/guards/lib/structuresStock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — sous quelle FORME chaque concept est-il écrit dans la donnée (dataset, champ porteur mesuré, signature) ? ' +
    'B — le stock NOMINATIF de ce qui reste à migrer, ligne par ligne, avec son compte d’occurrences. ' +
    'C — chaque ligne porte le LOT qui l’éteint (L1a #1466 FK · L1b #1467 enveloppe · L1c #1468 ops · ' +
    'L1d #1469 source · L2 refs de Compétence · L3 Talent/Trait/Objet · L4 Valeurs), et part avec sa migration.',
  primitive:
    '`scannerDonnees` / `scannerRedeclarations` (`scripts/docs/lib/structures-scan.mts`). Ce scan lit la DONNÉE JSON ' +
    'des deux racines (`src/data`, `src/scenes`) et l’AST des `src/data/schemas/defs/*.ts` — il ne passe donc PAS par ' +
    '`readCorpus` (`scripts/guards/lib/sourceCorpus.mjs`), qui ne lit que du CODE.',
  perimetre:
    'Les documents authorés des deux racines `src/data` et `src/scenes`, leurs schémas zod du registre, et les littéraux ' +
    'd’objet zod des defs. La référence est ANCRÉE SUR L’INDEX DES IDS, scopé par dataset : le champ porteur est mesuré ' +
    '(clé du parent), jamais déclaré, et la résolution se mesure par SITE (dataset, champ, clé).',
  angleMort: ANGLES_MORTS,
  baseline: {
    fichier: 'scripts/guards/lib/structuresStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST le dénominateur du chantier #1463 : chaque ligne se solde par une migration vers la forme cible, ' +
      'et part dans le MÊME commit. Une ligne neuve est une dérive, jamais une exception à inscrire.',
  },
  ticket: '#1465',
} as const;

/** `docs/structures-donnees.md` tel que son générateur le rend (`rendreCible`), jamais le fichier du disque. */
const DOC_STRUCTURES = await rendreCible('docs/structures-donnees.md');
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
/** Le DÉCLARÉ couvre les DEUX racines (#1466 L1a) — jointure par BASENAME, comme le scan key.
 *  UN seul scan pour tout le fichier : le test consomme la mesure, il ne relit jamais les JSON. La
 *  composition defs + enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`), et c'est la
 *  MÊME que lisent `build-structures.mts` et `horsStrateAudit.ts`. */
const { defs: DEFS, declares: DECLARES, choix: CHOIX, choixOps: CHOIX_OPS, scan } = scanDuCorpus(ROOT);
const { redeclarations } = scannerRedeclarations(ROOT);
/** Le corpus des COLLECTIONS À COMPTE (`COLLECTIONS_A_COMPTE`, `occurrencesStock.mjs`) : leur mesure se lit là, une fois. */
const CORPUS = corpusDuScan({ scan, defs: DEFS }, redeclarations);
const mesureDe = COLLECTIONS_A_COMPTE_PAR_NOM;

/** Un ensemble de lignes en texte, trié — les diffs de vitest restent lisibles. */
const lignes = (xs: string[]): string[] => [...xs].sort();

/**
 * DATE par DÉFAUT d'une ligne de stock : elle entre dans la clé comparée. Sur les stocks dont la
 * ligne OBSERVÉE ne reprend PAS le pilotage — tous sauf `STRUCTURES_FORMES` —, re-dater une ligne
 * pour la faire passer est impossible : elle se compare, date comprise, à la mesure du jour du lot.
 * Sur `STRUCTURES_FORMES`, `lot`/`motif`/`date` sont du PILOTAGE que `cleFormeObservee` reprend du
 * stock par le SITE : la sonde ne les mesure pas, ils se DÉCIDENT en revue (angle mort déclaré,
 * `ANGLES_MORTS` de `scripts/docs/lib/structures-lexique.mts`).
 */
const DATE_STOCK = '2026-08-23';
/**
 * `lot`, `motif` et `date` ENTRENT dans la clé comparée (#1465 F1) ; le LOT attendu se DÉDUIT du
 * concept quand la ligne n'en déclare pas. Ces trois champs sont du PILOTAGE : ils se DÉCIDENT en
 * revue, la sonde ne les mesure pas — c'est pourquoi la forme observée les reprend du stock
 * (`pilotageDeForme` ci-dessous).
 */
type Trace = { lot?: string; date?: string; motif?: string };
const trace = (x: Trace, lot: string) => ` | ${x.lot ?? lot} | ${x.date ?? DATE_STOCK}`;
/** LOT par défaut d'une divergence d'ENVELOPPE observée (le stock, lui, le porte ligne à ligne) :
 *  une absence sur les ENTRÉES DE RACINE part en `L1d #1469`, une clé divergente en `L1b #1467`. */
const lotEnveloppe = (e: { role: string }) => (e.role === 'source' ? 'L1d #1469' : 'L1b #1467');
const cleForme = (
  f: {
    concept: string;
    dataset: string;
    champ: string;
    signature: string;
    statut: string;
    strate: string;
    occurrences: number;
    cibles?: readonly string[];
  } & Trace,
) =>
  `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.strate}` +
  trace(f, lotDeForme(f.concept, f.signature, f.cibles ?? [])) +
  (f.motif ? ` | ${f.motif}` : '');
/** Le stock des formes, typé pour la lecture de son PILOTAGE (`lot`, `motif`, `date`). */
const FORMES: readonly (Parameters<typeof cleForme>[0])[] = STRUCTURES_FORMES;
/**
 * LOTISSEMENT déclaré d'un site, repris par la forme OBSERVÉE. Le lot déduit de `lotDeForme` lit la
 * colonne `cibles`, qui liste TOUS les datasets atteignables (angle mort des COLLISIONS d'ids) : une
 * ligne dont le concept réel n'est pas celui-là se re-lotit en revue et porte son `motif`. Un site
 * que le stock ne connaît pas garde son lot déduit — une dérive neuve entre avec son heuristique.
 */
const pilotageDeForme = new Map(FORMES.map((f) => [siteDeForme(f), { lot: f.lot, motif: f.motif, date: f.date }]));
const cleFormeObservee = (f: Parameters<typeof cleForme>[0]) => cleForme({ ...f, ...pilotageDeForme.get(siteDeForme(f)) });
const ecartsDeFormes = (mesure: typeof scan) => ecartsDeCollection({
  nom: 'STRUCTURES_FORMES',
  observe: mesureDe.STRUCTURES_FORMES.mesure(corpusDuScan({ scan: mesure, defs: DEFS }, redeclarations)),
  stock: FORMES,
  cle: cleFormeObservee,
  remede: {
    neuve: (cle: string) => `${cle} — Migrer la référence vers la forme CIBLE du lexique (scripts/docs/lib/structures-lexique.mts), sans l’ajouter au stock.`,
    perimee: (cle: string) => `${cle} — Retirer l’entrée périmée de scripts/guards/lib/structuresStock.mjs.`,
  },
});
const cleOrpheline = (o: { dataset: string; champ: string; signature: string; motif: string } & Trace) =>
  `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif}` +
  trace(o, o.motif === 'clé de référence non résolue' ? 'L1a #1466' : '#1553');
/**
 * PILOTAGE (`lot`, `date`) d'une ORPHELINE, repris du stock par SITE — MÊME patron que
 * `pilotageDeForme` ci-dessous : la sonde ne mesure ni le lot ni la date (angle mort déclaré). Sans
 * cette reprise, toute ligne était sommée de porter la date GLOBALE du stock, et une entrée née plus
 * tard ne pouvait être verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés :
 * une ligne du stock que la mesure n'observe plus reste rouge, et le test de MUTATION par champ
 * (ci-dessous) prouve qu'ils entrent toujours dans la clé comparée.
 */
const siteOrpheline = (o: { dataset: string; champ: string; signature: string }) => `${o.dataset} | ${o.champ} | ${o.signature}`;
const pilotageOrpheline = new Map(STRUCTURES_ORPHELINES.map((o) => [siteOrpheline(o), { lot: o.lot, date: o.date }]));
const cleOrphelineObservee = (o: Parameters<typeof cleOrpheline>[0]) => cleOrpheline({ ...o, ...pilotageOrpheline.get(siteOrpheline(o)) });
/**
 * CLIQUET des signatures HORS STRATE (#1465, nominatif depuis #1727 T0d) : chaque signature que le
 * lexique fermé ne classe dans aucune strate est une ENTRÉE de
 * `scripts/guards/lib/horsStrateStock.mjs`, GÉNÉRÉE par
 * `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/horsStrateAudit.ts` depuis la mesure
 * `scan.invisibles` que ce
 * fichier consomme. La traduction en sites est UNIQUE (`horsStrateAudit.ts`), l'écart est jugé par
 * `ecartDuVolet` ci-dessous.
 * Le COMPTE d'occurrences de chaque signature vit dans `docs/structures-donnees.md` (table bornée
 * par `MARQUE_HORS_STRATE`), que `build-structures.mts` rend depuis le disque du jour.
 */
const cleOp = (o: { op: string; signature: string; dataset: string } & Trace) =>
  `${o.op} | ${o.signature} | ${o.dataset}` + trace(o, 'L1c #1468');
const cleHomonyme = (h: { cle: string; classes: readonly string[] } & Trace) =>
  `${h.cle} | ${[...h.classes].sort().join('/')}` + trace(h, LOT_CLE_RESERVEE[h.cle] ?? 'L4 #1463');
/** Identité d'une redéclaration (`def | champ | concept | signature | statut | commun`), sans son compte. */
const siteRedeclaration = (r: { def: string; champ: string; concept: string; signature: string; statut: string; commun: string }) =>
  `${r.def} | ${r.champ} | ${r.concept} | ${r.signature} | ${r.statut} | ${r.commun}`;
const cleRedeclaration = (r: Parameters<typeof siteRedeclaration>[0] & Trace) =>
  siteRedeclaration(r) + trace(r, lotDeForme(r.concept, r.signature));
const cleEnveloppe = (e: { role: string; cle: string; motif: string; detail: string; document: string; chemin: string } & Trace) =>
  siteDEnveloppe(e) + trace(e, lotEnveloppe(e));
/** Toute ligne de collection à compte qui MONTE ou qui BAISSE est nommée avec son remède (`ecartsDeCollection`). */
const sansEcartDeCompte = (ecarts: { accrues: string[]; baisses: string[] }, nom: string) => {
  expect(lignes(ecarts.accrues), `compte(s) en HAUSSE dans ${nom} : appliquer la cible de chaque site nommé.`).toEqual([]);
  expect(lignes(ecarts.baisses), `compte(s) en BAISSE dans ${nom} : écrire la mesure.`).toEqual([]);
};
const ecartsHorsStrate = (
  sites: Parameters<typeof ecartDuVolet>[0]['sites'],
  stock: Parameters<typeof ecartDuVolet>[0]['stock'] = HORS_STRATE_RATCHET,
) => ecartDuVolet({
  sites, stock, ou: '`scripts/guards/lib/horsStrateStock.mjs`',
  remede: {
    neuve: (cle: string) => `${cle} — Forme absente du lexique. Si cette forme est validée par le schéma, déclarer son concept et sa signature CIBLE dans scripts/docs/lib/structures-lexique.mts ; sinon employer la forme CIBLE déjà déclarée du concept. Ne pas ajouter au stock HORS_STRATE.`,
  },
});

describe('structures de la donnée — stock nominatif décroissant (#1463 L0)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('structures-scan.mts');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS`), jamais recopiés.').toBe(ANGLES_MORTS);
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(10);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/structuresStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1465');
  });

  it('signatures CIBLES : lexique == `STRUCTURES_CIBLES` (une cible ne se décrète pas dans le lexique)', () => {
    const auLexique = CONCEPTS.flatMap((c) =>
      c.signatures.filter((s) => s.statut === 'cible').map((s) => `${c.id} | ${s.sig}`),
    );
    expect(
      lignes(auLexique),
      'le lexique déclare des signatures `cible` que `STRUCTURES_CIBLES` ne connaît pas (ou l’inverse) — faire passer une graphie en cible la sort du dénominateur : ça se décide au STOCK, pas d’un mot du lexique.',
    ).toEqual(lignes(STRUCTURES_CIBLES.map((c) => `${c.concept} | ${c.signature}`)));
  });

  it('formes à éteindre : observé == stock (présence, statut, strate ET occurrences)', () => {
    const ecarts = ecartsDeFormes(scan);
    expect(lignes(ecarts.neuves), 'forme(s) observée(s) en écart : appliquer le remède de chaque site nommé.').toEqual([]);
    expect(lignes(ecarts.perimees), 'forme(s) déclarée(s) en écart : appliquer le remède de chaque site nommé.').toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_FORMES');
    expect(ecarts.taille, 'clé(s) dupliquée(s) dans STRUCTURES_FORMES').toBe(FORMES.length);
  });

  it('signatures ORPHELINES (hors strate) : observé == stock', () => {
    const ecarts = ecartsDeCollection({
      nom: 'STRUCTURES_ORPHELINES',
      observe: mesureDe.STRUCTURES_ORPHELINES.mesure(CORPUS),
      stock: STRUCTURES_ORPHELINES,
      cle: cleOrphelineObservee,
    });
    expect(
      lignes([...ecarts.neuves, ...ecarts.perimees]),
      'écart entre les signatures ORPHELINES observées et `STRUCTURES_ORPHELINES` — un objet qui annonce une référence et ne résout vers rien se compte, il ne se tait pas.',
    ).toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_ORPHELINES');
    expect(ecarts.taille, 'clé(s) dupliquée(s) dans STRUCTURES_ORPHELINES').toBe(STRUCTURES_ORPHELINES.length);
  });

  it('signatures HORS STRATE : observé == stock nominatif, les neuves ET les périmées sont NOMMÉES', () => {
    const { neuves, perimees } = ecartsHorsStrate(sitesHorsStrate(scan.invisibles, scan.documents));
    expect(
      lignes(neuves),
      'signature(s) HORS STRATE NEUVE(s) : appliquer le remède de chaque site nommé.',
    ).toEqual([]);
    expect(
      lignes(perimees),
      'entrée(s) SOLDÉE(s) au stock hors strate : régénérer par ' +
        '`npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/horsStrateAudit.ts` — un stock qui garde une ligne morte fait ' +
        'passer une dette éteinte pour vivante.',
    ).toEqual([]);
  });

  it('HORS STRATE : remède applicable à une forme valide absente du lexique, sans modifier sa clé', () => {
    const sites = [{ file: 'src/scenes/fixture.json', ref: 'flow — effect,kind' }];
    const { neuves, perimees } = ecartsHorsStrate(sites, []);
    const cle = cleDeSite(sitesEnEntrees(sites)[0]);
    expect(neuves).toEqual([cle + SEPARATEUR_DE_REMEDE + 'Forme absente du lexique. Si cette forme est validée par le schéma, déclarer son concept et sa signature CIBLE dans scripts/docs/lib/structures-lexique.mts ; sinon employer la forme CIBLE déjà déclarée du concept. Ne pas ajouter au stock HORS_STRATE.']);
    expect(neuves[0]).not.toContain('CLIQUET:');
    expect(perimees).toEqual([]);
  });

  it('le stock hors strate committé est un point fixe de sa régénération', () => {
    for (const r of regenerations(scan)) expect(ecartDeRegeneration(r, texteEnPlace(r.chemin))).toBeNull();
  });

  it('signatures d’OPS : observé == stock (dénominateur du lot L1c #1468)', () => {
    const ecarts = ecartsDeCollection({
      nom: 'STRUCTURES_OPS',
      observe: mesureDe.STRUCTURES_OPS.mesure(CORPUS),
      stock: STRUCTURES_OPS,
      cle: cleOp,
      remede: {
        neuve: (cle: string) => `${cle} — signature d’op NEUVE : vérifier le site contre \`gameOpSchema\` (src/data/schemas/grammaire/mecanique.ts) et l’écrire à la forme CIBLE du lexique (scripts/docs/lib/structures-lexique.mts), sans l’ajouter au stock.`,
        perimee: (cle: string) => `${cle} — signature soldée : retirer l’entrée de scripts/guards/lib/structuresStock.mjs.`,
      },
    });
    expect(lignes([...ecarts.neuves, ...ecarts.perimees]), 'écart entre les signatures d’op OBSERVÉES et `STRUCTURES_OPS` : appliquer le remède de chaque site nommé.').toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_OPS');
    expect(ecarts.taille, 'clé(s) dupliquée(s) dans STRUCTURES_OPS').toBe(STRUCTURES_OPS.length);
  });

  it('homonymes nominatifs : observé == stock', () => {
    const ecarts = ecartsDeCollection({
      nom: 'STRUCTURES_HOMONYMES',
      observe: mesureDe.STRUCTURES_HOMONYMES.mesure(CORPUS),
      stock: STRUCTURES_HOMONYMES,
      cle: cleHomonyme,
    });
    expect(
      lignes([...ecarts.neuves, ...ecarts.perimees]),
      'écart entre les homonymes OBSERVÉS et `STRUCTURES_HOMONYMES` — un nom de concept est RÉSERVÉ à son type (#1463 S2).',
    ).toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_HOMONYMES');
  });

  it('divergences d’enveloppe (racine ET documents embarqués) : observé == stock', () => {
    const ecarts = ecartsDeCollection({
      nom: 'STRUCTURES_ENVELOPPE',
      observe: mesureDe.STRUCTURES_ENVELOPPE.mesure(CORPUS),
      stock: STRUCTURES_ENVELOPPE,
      cle: cleEnveloppe,
    });
    expect(
      lignes([...ecarts.neuves, ...ecarts.perimees]),
      'écart entre les divergences d’ENVELOPPE observées et `STRUCTURES_ENVELOPPE` — absences sur les ENTRÉES DE RACINE (`L1d #1469`), clés divergentes partout (`L1b #1467`), y compris sur les documents EMBARQUÉS.',
    ).toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_ENVELOPPE');
    expect(ecarts.taille, 'clé(s) dupliquée(s) dans STRUCTURES_ENVELOPPE').toBe(STRUCTURES_ENVELOPPE.length);
  });

  it('redéclarations locales dans les defs : observé == stock (keyé par def | champ | concept | signature)', () => {
    // PILOTAGE (`lot`, `date`) repris du stock par SITE — MÊME patron que `pilotageDeForme` et
    // `pilotageOrpheline` : la sonde ne mesure ni le lot ni la date. Sans cette reprise, toute ligne
    // était sommée de porter la date GLOBALE du stock, et une ligne née plus tard ne pouvait être
    // verte qu'en MENTANT sur sa date de naissance. Les deux champs restent gardés : une ligne du
    // stock que l'AST n'observe plus reste rouge, et le test de MUTATION par champ (ci-dessous)
    // prouve qu'ils entrent toujours dans la clé comparée.
    const pilotage = new Map(STRUCTURES_REDECLARATIONS.map((r) => [siteRedeclaration(r), { lot: r.lot, date: r.date }]));
    const ecarts = ecartsDeCollection({
      nom: 'STRUCTURES_REDECLARATIONS',
      observe: mesureDe.STRUCTURES_REDECLARATIONS.mesure(CORPUS),
      stock: STRUCTURES_REDECLARATIONS,
      cle: (r) => cleRedeclaration({ ...r, ...pilotage.get(siteRedeclaration(r)) }),
    });
    expect(
      lignes([...ecarts.neuves, ...ecarts.perimees]),
      'écart entre les redéclarations OBSERVÉES (AST des `src/data/schemas/defs/*.ts`) et `STRUCTURES_REDECLARATIONS` — une forme partagée se déclare UNE fois dans la grammaire (`src/data/schemas/grammaire/`). Le CHAMP entre dans la clé : sans lui, des littéraux de champs différents s’agrègent en une ligne.',
    ).toEqual([]);
    sansEcartDeCompte(ecarts, 'STRUCTURES_REDECLARATIONS');
  });

  it('redéclarations : un littéral réduit à ses étiquettes s’apparie par leurs VALEURS, un littéral à forme par sa signature', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'structures-etiquette-'));
    try {
      mkdirSync(join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
      mkdirSync(join(dossier, 'src/data/schemas/defs'), { recursive: true });
      writeFileSync(
        join(dossier, 'src/data/schemas/grammaire/fixture.ts'),
        [
          'export const conditionSchema = z.lazy(() => z.union([',
          "  z.strictObject({ kind: z.literal('always') }),",
          "  z.strictObject({ kind: z.literal('woundsDealt'), op: compareOpSchema, value: z.number() }),",
          ']));',
          'export const crewTargetSchema = z.union([z.strictObject({ poste: z.literal(true) }), z.strictObject({ role: z.string() })]);',
        ].join('\n'),
      );
      writeFileSync(
        join(dossier, 'src/data/schemas/defs/fixture.ts'),
        [
          "const doc = document('fixture', famille, { kind: enumNomme(KINDS) }, {}, {});",
          "const portee = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('self') })]);",
          "const seuil = z.strictObject({ kind: z.literal('woundsDealt'), op: z.string(), value: z.number() });",
          'const equipage = z.strictObject({ poste: z.literal(true) });',
          'const toujours = z.strictObject({ kind: z.literal(`always`) });',
        ].join('\n'),
      );
      expect(
        scannerRedeclarations(dossier).redeclarations.map((r) => `${r.def}:${r.ligne} | ${r.signature} | ${r.commun}`),
        '`{ kind: self }` n’est pas `{ kind: always }` ; `kind,op,value`, `{ poste: true }` et `{ kind: always }` retapés redéclarent leur schéma commun.',
      ).toEqual(['fixture.ts:3 | kind,op,value | conditionSchema', 'fixture.ts:4 | poste | crewTargetSchema', 'fixture.ts:5 | kind | conditionSchema']);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  /**
   * Le concept `reference` est SOLDÉ au stock des redéclarations (#1463 L-gram-2) : plus AUCUN def
   * ne re-tape `{id, spec?}`/`{id, value?}` — les six sites qui le faisaient composent les fabriques
   * de `grammaire/ref.ts` ou importent `qualityRefSchema`. Affirmation POSITIVE et bidirectionnelle :
   * elle rougit à la première réintroduction d'un littéral de référence dans un def, avant même que
   * la ligne de stock ne renaisse.
   */
  it('le concept `reference` ne pèse plus AUCUNE ligne, ni à l’OBSERVÉ ni au stock (#1463 L-gram-2)', () => {
    // L'OBSERVÉ d'abord (AST des defs) : c'est lui qui rougit à la réintroduction d'un littéral,
    // sans attendre qu'une ligne de stock renaisse.
    expect(
      redeclarations.filter((r) => r.concept === 'reference').map((r) => `${r.def} | ${r.champ} | ${r.signature}`),
      'un def re-déclare une RÉFÉRENCE : la désignation d’une entité par son id a UNE fabrique (`ref`/`specRef`/`refOuSpec`, `grammaire/ref.ts`), et la vue commune des Atouts est `qualityRefSchema`.',
    ).toEqual([]);
    expect(
      STRUCTURES_REDECLARATIONS.filter((r) => r.concept === 'reference').map((r) => `${r.def} | ${r.champ} | ${r.signature}`),
      'une ligne `reference` PÉRIMÉE traîne au stock : le concept est soldé côté defs.',
    ).toEqual([]);
    // Sans concept encore peuplé, les deux assertions seraient vacueuses : la mesure porte toujours.
    expect(redeclarations.length, 'l’AST n’observe plus AUCUNE redéclaration : le volet ne mesure rien.').toBeGreaterThan(0);
  });

  /**
   * CONTRAT du côté DÉCLARÉ : un document SCELLÉ par la fabrique `document()` — `pipe` à la racine —
   * rend ses clés. La SORTIE d'un tel pipe est un `transform`, qui n'en porte AUCUNE : un relevé qui
   * la prend pour entrée rend 0 clé sur TOUTE la famille config/record, et les deux volets qui
   * comparent déclaré × observé (clés jamais observées, forme déclarée jamais posée) se taisent au
   * lieu de mordre. La lecture se fait donc sur le nœud PORTEUR du pipe.
   */
  it('un document SCELLÉ par `document()` déclare ses clés — jamais zéro', () => {
    const scelles = DECLARES.filter((d) => d.racine.startsWith('pipe<'));
    expect(scelles.length, 'aucun document scellé au registre : le contrat ci-dessous ne mesurerait rien.').toBeGreaterThan(40);
    // Les SEULS documents scellés sans clé à rendre sont les deux records de valeur SCALAIRE :
    // `decorPalette.ts:18,31` et `teintesJeu.ts:140` déclarent `{}` champs et une `valeurRecord`
    // chaîne (palettes hex). La liste est NOMINATIVE, pas un filtre : un muet de plus sort par son
    // nom — c'est ainsi que se voit un relevé qui lirait la SORTIE du pipe (un `transform` sans clé)
    // au lieu de son nœud PORTEUR.
    expect(
      scelles.filter((d) => Object.keys(d.cles).length === 0).map((d) => `${d.file} (${d.note})`).sort(),
      'document(s) scellé(s) rendant ZÉRO clé déclarée — `introspecterDefs` (`scripts/docs/lib/zod-introspect.mts`) doit lire le nœud PORTEUR du pipe.',
    ).toEqual(['decorPalette.json (non-objet(string))', 'teintesJeu.json (non-objet(string))']);
    // Nominatif : un `config` (`crew-morale.ts:18-48`) et un `record` enveloppé rendent LEURS clés,
    // pas seulement celles que la fabrique pose d'office.
    expect(Object.keys(DECLARES.find((d) => d.file === 'crew-morale.json')!.cles).sort()).toEqual(
      expect.arrayContaining(['base', 'bands', 'factors']),
    );
    expect(Object.keys(DECLARES.find((d) => d.file === 'sizes.json')!.cles).length).toBeGreaterThan(0);
  });

  it('formes DÉCLARÉES jamais observées, sans lot de peuplement : observé == stock', () => {
    const cle = (x: { dataset: string; cle: string; date?: string }) => `${x.dataset} | ${x.cle} | ${x.date ?? DATE_STOCK}`;
    const observees: string[] = [];
    const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
    for (const d of scan.documents) {
      const dec = parFichier.get(d.nom);
      if (!dec) continue;
      const vues = scan.clesPortees.get(d.nom)!;
      // Les clés posées INCONDITIONNELLEMENT par la fabrique (`document.ts`) sortent de la question
      // posée ici (un SCHÉMA plus large que sa donnée) : un `labelF` ou un `icon` qu'un dataset
      // n'emploie pas ne se « solde » pas — il n'y a rien à retirer d'un def qui ne l'a pas écrit.
      // Sans ce filtre, la restauration de couverture du sceau `pipe` (`zod-introspect.mts`, même
      // lot) en aurait versé 298 au stock, tous inertes.
      for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !CLES_POSEES_INCONDITIONNELLEMENT.includes(k)))
        observees.push(cle({ dataset: d.nom, cle: c, date: STRUCTURES_DEFAUT.find((s) => s.dataset === d.nom && s.cle === c)?.date }));
    }
    expect(
      lignes(observees),
      'écart entre les clés DÉCLARÉES JAMAIS OBSERVÉES et `STRUCTURES_DEFAUT` — un schéma plus large que la donnée se solde en retirant le champ ou en écrivant la donnée. Un déclaré-avant-posé ASSUMÉ ne se stocke PAS ici : il porte un lot de peuplement et s’ÉMET (`LOTS_DE_PEUPLEMENT`, doc §2.4 table B).',
    ).toEqual(lignes(STRUCTURES_DEFAUT.map(cle)));
  });

  /**
   * Ce que l'exclusion COÛTE, MESURÉ (#1467 L1b V-FLIP-ENTITE-b) — pas déclaré en prose. Une clé
   * ajoutée à `CLES_POSEES_INCONDITIONNELLEMENT` fait TAIRE toutes les dettes qu'elle porte : le
   * filtre se relit donc ici clé par clé, sur la mesure.
   *
   * `variants` est le cas qui a MORDU : rangée d'abord parmi les clés d'office, elle escamotait
   * `traits.json › variants` — une dette réelle, l'option étant DEMANDÉE par le def et portée par
   * 0 des 131 entrées. Le test ci-dessous gèle les deux comptes : sans `variants` dans l'exclusion
   * (l'état courant) le relevé en a UNE de plus, et cette une-là est nommée.
   */
  it('l’exclusion des clés d’office ne cache AUCUNE dette d’option — son coût est mesuré, clé par clé', () => {
    const releve = (exclues: readonly string[]) => {
      const out: string[] = [];
      const parFichier = new Map(DECLARES.map((d) => [d.file, d]));
      for (const d of scan.documents) {
        const dec = parFichier.get(d.nom);
        if (!dec) continue;
        const vues = scan.clesPortees.get(d.nom)!;
        for (const c of Object.keys(dec.cles).filter((k) => !vues.has(k) && !exclues.includes(k))) out.push(`${d.nom} | ${c}`);
      }
      return out.sort();
    };
    const courant = releve(CLES_POSEES_INCONDITIONNELLEMENT);
    const avecVariants = releve(CLES_ENVELOPPE as readonly string[]);
    expect(
      courant.filter((l) => !avecVariants.includes(l)),
      'exclure `variants` ne doit escamoter QUE la dette d’option de `traits.json` — une seconde ligne signalerait une clé d’office mal rangée.',
    ).toEqual(['traits.json | variants']);
    expect(CLES_POSEES_INCONDITIONNELLEMENT).not.toContain('variants');
    expect(courant.length - avecVariants.length, 'le delta d’exclusion vaut EXACTEMENT une ligne').toBe(1);
  });

  it('`cible-declaree` ne se STOCKE nulle part : c’est une ÉMISSION du doc, pas un dénominateur', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    expect(
      /statut:\s*["']cible-declaree["']/.test(stock),
      'une ligne `cible-declaree` est entrée au stock : elle CROÎTRAIT (une forme se déclare avant d’être posée), et rendrait menteurs `GARDE.baseline.decroissant` et les stocks nominatifs.',
    ).toBe(false);
    expect(Object.keys(LOTS_DE_PEUPLEMENT).length, 'aucun lot de peuplement déclaré : la table B du doc serait vide de sens.').toBeGreaterThan(0);
  });

  it('chaque ligne du stock porte sa DATE et son LOT d’extinction', () => {
    const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const sansDate = [
      ...STRUCTURES_CIBLES.filter((c) => !dateOk(c.date)).map((c) => `cible ${c.concept} ${c.signature}`),
      ...STRUCTURES_FORMES.filter((f) => !dateOk(f.date)).map(cleForme),
      ...STRUCTURES_DEFAUT.filter((d) => !dateOk(d.date)).map((d) => `défaut ${d.dataset} ${d.cle}`),
      ...STRUCTURES_HOMONYMES.filter((h) => !dateOk(h.date)).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !dateOk(e.date)).map((e) => `${e.role} | ${e.cle} | ${e.document}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !dateOk(r.date)).map((r) => r.def),
      ...STRUCTURES_ORPHELINES.filter((o) => !dateOk(o.date)).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !dateOk(o.date)).map(cleOp),
    ];
    expect(sansDate, 'ligne(s) de stock sans date au format AAAA-MM-JJ').toEqual([]);
    const sansLot = [
      ...STRUCTURES_FORMES.filter((f) => !f.lot?.trim()).map(cleForme),
      ...STRUCTURES_HOMONYMES.filter((h) => !h.lot?.trim()).map((h) => h.cle),
      ...STRUCTURES_ENVELOPPE.filter((e) => !e.lot?.trim()).map((e) => `${e.role} | ${e.cle} | ${e.document} › ${e.chemin}`),
      ...STRUCTURES_REDECLARATIONS.filter((r) => !r.lot?.trim()).map((r) => `${r.def} | ${r.signature}`),
      ...STRUCTURES_ORPHELINES.filter((o) => !o.lot?.trim()).map(cleOrpheline),
      ...STRUCTURES_OPS.filter((o) => !o.lot?.trim()).map(cleOp),
    ];
    expect(
      sansLot,
      'ligne(s) de stock sans LOT d’extinction — un dénominateur sans propriétaire ne se solde jamais (#1465 F3).',
    ).toEqual([]);
  });

  it('chaque ligne porte un LOT CONNU', () => {
    const toutes = [
      ...STRUCTURES_FORMES,
      ...STRUCTURES_HOMONYMES,
      ...STRUCTURES_REDECLARATIONS,
      ...STRUCTURES_ENVELOPPE,
      ...STRUCTURES_ORPHELINES,
      ...STRUCTURES_OPS,
    ];
    expect(
      [...new Set(toutes.map((l) => l.lot))].filter((l) => !(LOTS_CONNUS as readonly string[]).includes(l)).sort(),
      `lot(s) inconnu(s) : un dénominateur ne se range que dans l’un des ${LOTS_CONNUS.length} lots d’extinction (\`LOTS_CONNUS\`).`,
    ).toEqual([]);
  });

  /**
   * Le lot d'une ligne se DÉDUIT du concept (`lotDeForme`), et cette déduction lit la colonne
   * `cibles` — qui liste TOUS les datasets atteignables, COLLISIONS d'ids comprises (angle mort
   * déclaré). Une ligne dont le concept réel n'est pas celui que la déduction lui prête se re-lotit
   * en revue ; ce test rend cette divergence NOMMÉE et BIDIRECTIONNELLE : pas de re-lotissement
   * muet, pas de `motif` sur une ligne que rien ne fait diverger.
   */
  it('un LOT qui DIVERGE de la déduction porte son MOTIF — et un MOTIF suppose une divergence', () => {
    const deduit = new Map(scan.formes.map((f) => [siteDeForme(f), lotDeForme(f.concept, f.signature, f.cibles ?? [])]));
    const diverge = (f: { concept: string; dataset: string; champ: string; signature: string } & Trace) =>
      deduit.has(siteDeForme(f)) && f.lot !== deduit.get(siteDeForme(f));
    expect(
      FORMES.filter((f) => diverge(f) && !f.motif?.trim()).map(cleForme),
      'ligne(s) re-loties SANS motif — un lot qui contredit la déduction NOMME le concept réel de la ligne, sinon le lotissement du chantier n’est plus relisible.',
    ).toEqual([]);
    expect(
      FORMES.filter((f) => f.motif?.trim() && !diverge(f)).map(cleForme),
      'ligne(s) portant un `motif` que rien ne fait diverger — un motif justifie une décision de revue, il ne décore pas une ligne que la déduction range déjà là.',
    ).toEqual([]);
  });

  it('les ANGLES MORTS ont UNE source : le lexique, recopié nulle part (test, stock, doc)', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/structuresStock.mjs'), 'utf8');
    const doc = DOC_STRUCTURES;
    // Les deux copies se LISENT, elles ne se cherchent pas : l'inclusion seule est unidirectionnelle
    // (lexique ⊆ copie) et laisserait passer une ligne SURNUMÉRAIRE — un angle mort que le lexique ne
    // porte pas est un angle mort que personne n'a décidé.
    const listeStock = stock
      .split('ANGLES MORTS — SOURCE UNIQUE')[1]
      .split('\n//\n')[0]
      .split('\n')
      .filter((l) => l.startsWith('//   - '))
      .map((l) => l.slice('//   - '.length));
    const listeDoc = doc
      .split('## Périmètre mesuré et angles morts')[1]
      .split('\n## ')[0]
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2));
    expect(
      lignes(listeStock),
      'l’en-tête de `structuresStock.mjs` a divergé de `ANGLES_MORTS` — une ligne en trop y est un angle mort que le lexique ne déclare pas, une ligne en moins une copie amputée.',
    ).toEqual(lignes([...ANGLES_MORTS]));
    expect(
      lignes(listeDoc),
      'le § « Périmètre mesuré et angles morts » de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS` (le doc est GÉNÉRÉ : le régénérer, ou corriger le lexique).',
    ).toEqual(lignes([...ANGLES_MORTS]));
  });

  it('MUTATION par champ : chaque champ de chaque stock entre dans la comparaison (clé, et compte hors clé)', () => {
    const mute = (v: unknown) => (typeof v === 'number' ? v + 999 : Array.isArray(v) ? [...v, 'ZZZ'] : `${v}~MUTE`);
    // Une collection à compte se compare par sa clé ET son compte (`ecartsDeCollection`) : l'empreinte
    // mutée est la même paire.
    const avecCompte = <E,>(cle: (e: E) => string) => (e: E & { occurrences: number }) => `${cle(e)} | ${occurrencesDe(e)}`;
    const stocks: Array<[string, readonly Record<string, unknown>[], (x: never) => string, string[]]> = [
      ['STRUCTURES_CIBLES', STRUCTURES_CIBLES, ((c: { concept: string; signature: string; date: string }) => `${c.concept} | ${c.signature} | ${c.date}`) as never, ['concept', 'signature', 'date']],
      ['STRUCTURES_FORMES', STRUCTURES_FORMES, avecCompte(cleForme) as never, ['concept', 'dataset', 'champ', 'signature', 'statut', 'strate', 'occurrences', 'lot', 'motif', 'date']],
      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT, ((d: { dataset: string; cle: string; date: string }) => `${d.dataset} | ${d.cle} | ${d.date}`) as never, ['dataset', 'cle', 'date']],
      ['STRUCTURES_HOMONYMES', STRUCTURES_HOMONYMES, avecCompte(cleHomonyme) as never, ['cle', 'classes', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_REDECLARATIONS', STRUCTURES_REDECLARATIONS, avecCompte(cleRedeclaration) as never, ['def', 'champ', 'concept', 'signature', 'statut', 'commun', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_ENVELOPPE', STRUCTURES_ENVELOPPE, avecCompte(cleEnveloppe) as never, ['role', 'cle', 'motif', 'detail', 'document', 'chemin', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_ORPHELINES', STRUCTURES_ORPHELINES, avecCompte(cleOrpheline) as never, ['dataset', 'champ', 'signature', 'motif', 'occurrences', 'lot', 'date']],
      ['STRUCTURES_OPS', STRUCTURES_OPS, avecCompte(cleOp) as never, ['op', 'signature', 'dataset', 'occurrences', 'lot', 'date']],
    ];
    const aveugles: string[] = [];
    for (const [nom, arr, cle, champs] of stocks) {
      const base = lignes(arr.map(cle as (x: unknown) => string)).join('\n');
      for (const champ of champs) {
        const i = arr.findIndex((x) => x[champ] !== undefined && x[champ] !== '' && x[champ] !== null);
        // Champ qu'AUCUNE ligne ne porte encore (`STRUCTURES_ENVELOPPE.detail` depuis l'extinction du
        // dernier `type divergent`, #1467) : le scan le produit toujours
        // (`structures-scan.mts:967`), il doit donc entrer dans la clé LE JOUR où une ligne le
        // portera — on l'INJECTE sur la première ligne, la cécité de la clé restant mesurée pareil.
        const cible = i < 0 ? 0 : i;
        const valeur = i < 0 ? 'PORTE' : mute(arr[cible][champ]);
        const copie = arr.map((x, j) => (j === cible ? { ...x, [champ]: valeur } : x));
        if (lignes(copie.map(cle as (x: unknown) => string)).join('\n') === base) aveugles.push(`${nom}.${champ}`);
      }
    }
    expect(
      aveugles,
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte — le pilotage du chantier reposerait sur un champ non gardé (#1465 F1).',
    ).toEqual([]);
  });

  it('les deux racines de documents sont scannées', () => {
    const racines = new Set(scan.documents.map((d) => d.racine));
    expect([...racines].sort()).toEqual(['src/data', 'src/scenes']);
    expect(scan.documents.filter((d) => d.racine === 'src/scenes').length).toBeGreaterThan(0);
  });
});

describe('la référence est ANCRÉE sur l’index des ids (contrats positifs)', () => {
  const occurrence = (dataset: string, champ: string, sig: string) =>
    scan.formes.find((f) => f.concept === 'reference' && f.dataset === dataset && f.champ === champ && f.signature === sig);

  it.each([
    ['creatures.json', 'skills', 'id,value', 'skills.json'],
    ['careerLevels.json', 'skills', 'id,spec', 'skills.json'],
    ['careerLevels.json', 'skills', 'choix,id', 'skills.json'],
    ['criticals.json', 'ops', 'id,value+…', 'etats.json'],
    ['arene-projet.json', 'members', 'entityId', 'arene-projet.json'],
    ['maladies.json', 'symptoms', 'symptomId', 'symptoms.json'],
    ['activities.json', 'ops', 'tableId+…', 'tables.json'],
  ])('%s › %s {%s} est une occurrence de référence dont la cible résout vers %s', (dataset, champ, sig, cible) => {
    const f = occurrence(dataset, champ, sig);
    expect(f, `aucune occurrence de référence mesurée sous \`${dataset} › ${champ} {${sig}}\` — le champ porteur est MESURÉ, pas déclaré.`).toBeTruthy();
    expect(f!.occurrences).toBeGreaterThan(0);
    expect(f!.cibles, 'la référence ne résout vers aucun document : l’index des ids ne la porte pas.').toContain(cible);
  });

  it('un `{id,label}` de spécialisation n’est JAMAIS un champ de référence (anti-circularité)', () => {
    expect(
      scan.champsDeReference,
      '`specs` est devenu un champ porteur de références : le contre-exemple canonique du lexique (`{id,label}` = un DOCUMENT embarqué) a basculé — c’est la circularité que la passe 4 supprime.',
    ).not.toContain('specs');
    for (const champ of ['skills', 'ops', 'members', 'symptoms'])
      expect(scan.champsDeReference, `le champ \`${champ}\` porte des références mesurées et devrait être vu.`).toContain(champ);
    expect(
      CONCEPTS.filter((c) => 'vocabulaire' in c || 'marqueurs' in c || 'champsPorteurs' in c || 'seuil' in c).map((c) => c.id),
      'un concept redéclare un VOCABULAIRE ou une liste de champs porteurs : c’est le mécanisme circulaire que la passe 4 supprime — un champ porteur se MESURE.',
    ).toEqual([]);
  });

  it('les 452 refs à plat dans les ops sont VUES : aucune n’est orpheline sous un `op`', () => {
    const refsDansOps = scan.formes.filter((f) => f.concept === 'reference' && (f.champ === 'ops' || f.champ === 'onFail'));
    expect(refsDansOps.reduce((a, f) => a + f.occurrences, 0)).toBeGreaterThan(400);
    expect(
      refsDansOps.every((f) => f.statut === 'divergente' || f.statut === 'historique'),
      'une ref à plat dans une op est une DIVERGENCE : la cible L1c est une ref EMBOÎTÉE (`{op, skill: {id}}`).',
    ).toBe(true);
  });

  it('une ENTRÉE DE RACINE n’est jamais orpheline (les 90 faux orphelins de `props.json` sont morts)', () => {
    expect(scan.orphelines.filter((o) => o.champ === '(racine)')).toEqual([]);
  });

  it('une référence TYPÉE `{id,type}` résout vers le SEUL espace que son type nomme — jamais ambiguë (#2820)', () => {
    const typees = scan.formes.filter((f) => f.concept === 'reference' && f.signature === 'id,type');
    expect(typees.length, 'aucune référence typée mesurée : le contrat ne dirait rien').toBeGreaterThan(0);
    const espaces = new Set((Object.keys(TYPES) as TypeEntite[]).map(espaceDe));
    const hors = typees.flatMap((f) => f.cibles.filter((c) => !espaces.has(c)).map((c) => `${f.dataset} › ${f.champ} → ${c}`));
    expect(hors, 'une référence typée résout hors de l’espace de son type').toEqual([]);
    const sites = new Set(typees.map((f) => `${f.dataset}|${f.champ}`));
    const ambigues = scan.ambigues.filter((a) => a.cle === 'id' && sites.has(`${a.dataset}|${a.champ}`)).map((a) => `${a.dataset} › ${a.champ} : ${a.valeur}`);
    expect(ambigues, 'un id de référence typée compté AMBIGU : son type nomme pourtant son espace').toEqual([]);
  });

  it('la clé d’identité d’un document n’est pas comptée comme une référence à lui-même', () => {
    const auto = scan.formes.filter((f) => f.concept === 'reference' && f.champ === 'id' && f.signature === 'id-nu');
    expect(auto, 'un document se référencerait lui-même par sa propre clé d’identité.').toEqual([]);
  });
});

describe('les concepts de VALEUR sont reconnus à leur noyau (contrats positifs)', () => {
  const sig = (o: object) => signature(Object.keys(o));
  const classement = (o: object, champ = '', dataset = '') => classerValeur(sig(o), Object.keys(o), { dataset, champ });

  it('un montant PARTIEL est une monnaie à la forme cible, comme le montant complet', () => {
    // `moneyPartialSchema` (3 dénominations optionnelles) + `toMoney` : un coût authoré n'écrit que ce
    // qu'il chiffre — les 6 sous-signatures non vides sont CIBLES (#1463 L-monnaie-3).
    expect(classement({ gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ brass: 1, gold: 1, silver: 2 })).toMatchObject({ concept: 'monnaie', statut: 'cible' });
    expect(classement({ book: 'ldb', page: 12 })).toMatchObject({ concept: 'source', statut: 'cible' });
  });

  it('les deux branches de `weaponDamageSpecSchema` sont des Dégâts d’arme CIBLES, et `plusBF` étalé sur un op n’en est pas', () => {
    expect(classement({ plusBF: true, flat: 4 }, 'damage')).toMatchObject({ concept: 'degats-arme', statut: 'cible' });
    expect(classement({ plusBF: true, flat: 0, bare: true }, 'damage')).toMatchObject({ concept: 'degats-arme', statut: 'cible' });
    expect(classement({ literal: '2d10' }, 'damage')).toMatchObject({ concept: 'degats-arme', statut: 'cible' });
    expect(classement({ op: 'grantNaturalWeapon', label: 'x', damage: 1, plusBF: true, bare: true, qualities: [] }, 'passive')).toBeNull();
    expect(classement({ sign: 1, flat: 2, d10: 1 }, 'effect')).toBeNull();
  });

  it('un coefficient saisonnier sous `price` est un PRIX déclaré, jamais une monnaie à éteindre', () => {
    expect(classement({ printemps: 1, ete: 0.5, automne: 0.25, hiver: 0.5 }, 'price')).toMatchObject({
      concept: 'prix',
      statut: 'declaree',
    });
    expect(
      STRUCTURES_FORMES.filter((f) => f.concept === 'monnaie' && /automne|dice/.test(f.signature)),
      'un multiplicateur saisonnier (ou un prix TIRÉ) était stocké comme « monnaie à éteindre » : ce lot d’extinction est insoldable — une saison ne devient pas une bourse.',
    ).toEqual([]);
  });

  it('`{min,max}` n’est une plage que comme ÉLÉMENT DE TABLEAU à bornes numériques', () => {
    const cles = ['min', 'max'];
    expect(classerValeur('max,min', cles, { dataset: '', champ: 'params', candidats: ['plage'] })).toMatchObject({ concept: 'plage', statut: 'cible' });
    expect(classerValeur('max,min', cles, { dataset: '', champ: 'params' })).toBeNull();
    expect(classerValeur('manannD10,max,min', ['min', 'max', 'manannD10'], { dataset: '', champ: 'impressed' })).toBeNull();
  });

  it('la forme d’un état n’est revendiquée qu’au SITE des projets, à ses clés réelles', () => {
    const projet = DATASETS_DES_PROJETS.find((d) => d === 'diligence-projet.json')!;
    expect(classement({ kind: 'heros' }, 'forme', projet)).toMatchObject({ concept: 'forme-d-etat', signature: 'kind', statut: 'cible' });
    expect(classement({ kind: 'enum', valeurs: [] }, 'forme', projet)).toMatchObject({ concept: 'forme-d-etat', signature: 'kind,valeurs', statut: 'cible' });
    expect(classement({ couleur: 'x', taille: 1 }, 'forme', 'creatures.json')).toBeNull();
  });

  it('un `prix` hors des projets n’est pas un billet de route', () => {
    expect(classement({ prix: { exterieur: 1 } }, 'diligence', 'diligence-projet.json')).toMatchObject({ concept: 'billet-de-route', statut: 'cible' });
    expect(classerValeur('label,prix', ['label', 'prix'], { dataset: 'merchants.json', champ: 'offres' })?.concept).not.toBe('billet-de-route');
  });

  it('une clé RÉSERVÉE encore homonyme ne force aucun concept (`count`, `cost`, `skill`)', () => {
    expect(classement({ count: 2, id: 'x' }, 'trappings')).toBeNull();
    expect(classement({ cost: 3, weightEnc: 1 }, 'install')).toBeNull();
  });

  /**
   * PRÉMISSE du discriminant `horsDesignation` (`structures-lexique.mts`, concept `test`), prouvée par
   * une marche BRUTE des deux racines — méthode INDÉPENDANTE du scan : elle ne partage ni son
   * parcours, ni sa notion de document, ni son classement ordonné, et ne consulte le lexique que pour
   * les deux prédicats de DÉSIGNATION. Deux sondes du même angle ne se confirment pas.
   * Aucun cardinal n'est écrit ici : les trois assertions sont DÉRIVÉES de la marche.
   */
  it('les porteurs de `difficulty` se PARTITIONNENT en plage / identité / référence / aucune, et « aucune » EST le concept `test`', () => {
    const ID = new Set(CLES_IDENTITE as readonly string[]);
    const porteurs: { site: string; famille: string }[] = [];
    const intersections: Record<string, number> = { 'plage∩identité': 0, 'plage∩référence': 0, 'identité∩référence': 0 };
    const marche = (v: unknown, dataset: string, champ: string): void => {
      if (Array.isArray(v)) { for (const e of v) marche(e, dataset, champ); return; }
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      const cles = Object.keys(o);
      if (cles.includes('difficulty')) {
        const borne = (b: unknown) => typeof b === 'number' || b === null;
        const plage = borne(o.min) && borne(o.max) && (typeof o.min === 'number' || typeof o.max === 'number');
        const identite = cles.some((k) => ID.has(k));
        const reference = cles.some((k) => RX_CLE_REFERENCE.test(k));
        if (plage && identite) intersections['plage∩identité'] += 1;
        if (plage && reference) intersections['plage∩référence'] += 1;
        if (identite && reference) intersections['identité∩référence'] += 1;
        porteurs.push({
          site: dataset + ' › ' + (champ || '(racine)'),
          famille: plage ? 'plage' : identite ? 'identité' : reference ? 'référence' : 'aucune',
        });
      }
      for (const [k, e] of Object.entries(o)) marche(e, dataset, k);
    };
    const jsons = (d: string): string[] =>
      listerArbre(d, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => join(d, rel));
    for (const f of ['src/data', 'src/scenes'].flatMap((r) => jsons(join(ROOT, r)))) {
      let doc: unknown;
      try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
      marche(doc, f.split(/[\\/]/).pop()!, ''); // les deux séparateurs : `join` rend des antislashs sur Windows
    }

    // (a) les trois familles qui DISQUALIFIENT ne se recouvrent pas — sans quoi l'ordre du classement
    //     déciderait à la place du discriminant, et le lexique le tairait.
    expect(
      Object.entries(intersections).filter(([, n]) => n > 0).map(([k, n]) => k + ' ' + n),
      'deux familles de disqualification se RECOUVRENT : le non-recouvrement écrit au lexique est faux.',
    ).toEqual([]);

    // (b) la partition est TOTALE : les quatre familles somment aux porteurs mesurés.
    const parFamille = new Map<string, number>();
    for (const p of porteurs) parFamille.set(p.famille, (parFamille.get(p.famille) ?? 0) + 1);
    expect([...parFamille.values()].reduce((a, b) => a + b, 0), 'la partition PERD des porteurs.').toBe(porteurs.length);
    expect(porteurs.length, 'aucun porteur de `difficulty` : la sonde ne mesure rien.').toBeGreaterThan(0);

    // (c) le bucket « aucune » EST le concept `test` du scan, site par site et compte par compte.
    const parSite = (xs: [string, number][]) => lignes(xs.map(([site, n]) => site + ' | ' + n));
    const brute = new Map<string, number>();
    for (const p of porteurs) if (p.famille === 'aucune') brute.set(p.site, (brute.get(p.site) ?? 0) + 1);
    const mesure = new Map<string, number>();
    for (const f of scan.formes.filter((f) => f.concept === 'test'))
      mesure.set(f.dataset + ' › ' + f.champ, (mesure.get(f.dataset + ' › ' + f.champ) ?? 0) + f.occurrences);
    expect(
      parSite([...brute]),
      'la marche BRUTE et le SCAN ne voient pas le même concept `test` : la prémisse du discriminant (un jet = un porteur de `difficulty` qui ne désigne rien et n’est pas une rangée à bornes) ne tient plus.',
    ).toEqual(parSite([...mesure]));
  });
});

/**
 * Strate DOCUMENT (#1633) — les concepts d'ENVELOPPE. Le DoD interdit le « débordement global
 * silencieux » : ces trois sondes le mesurent au lieu de le supposer.
 */
describe('les concepts d’ENVELOPPE (strate `Document`) se reconnaissent au NOYAU, jamais au CHAMP', () => {
  const documents = CONCEPTS.filter((c) => c.strate === 'Document');

  // #2001
  it('prose nommée : le texte et sa provenance locale forment une enveloppe', () => {
    const classement = (o: object) => classerValeur(signature(Object.keys(o)), Object.keys(o));
    for (const o of [
      { texte: 'Maison' },
      { texte: 'Copie', source: { book: 'ldb', page: 12 } },
      { texte: 'Adaptation', adapteDe: { book: 'ldb', page: 12 } },
    ]) expect(classement(o)).toMatchObject({ concept: 'prose-nommee', strate: 'Document', statut: 'cible' });
    expect(classement({ source: { book: 'ldb', page: 12 } })).toBeNull();
    expect(classement({ book: 'ldb', page: 12 })).toMatchObject({ concept: 'source' });
    expect(classement({ book: 'ldb', ch: '12', parts: [] })).toMatchObject({ concept: 'adresse' });
    expect(classement({ id: 'x' })).toBeNull();
  });

  // #2001
  it('les porteurs bruts de texte du corpus scanné sont des proses sans concept concurrent', () => {
    const porteurs: { site: string; objet: Record<string, unknown> }[] = [];
    const marche = (v: unknown, site: string): void => {
      if (Array.isArray(v)) { v.forEach((e, i) => marche(e, `${site}[${i}]`)); return; }
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(o, 'texte')) porteurs.push({ site, objet: o });
      for (const [k, e] of Object.entries(o)) marche(e, `${site}.${k}`);
    };
    for (const d of listerDocuments(ROOT)) marche(JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')), d.chemin);
    expect(porteurs).toHaveLength(25);
    for (const { site, objet } of porteurs) {
      expect(typeof objet.texte, site).toBe('string');
      expect(Object.keys(objet).filter((k) => !['texte', 'source', 'adapteDe'].includes(k)), site).toEqual([]);
      expect(classerValeur(signature(Object.keys(objet)), Object.keys(objet)), site).toMatchObject({
        concept: 'prose-nommee', strate: 'Document', statut: 'cible',
      });
    }
  });

  it('A — aucun concept d’enveloppe n’est keyé par CHAMP : un concept champ-keyé est AVEUGLE à la forme', () => {
    // La preuve tient dans le seul concept champ-keyé du lexique : `prix` revendique TOUTE forme
    // posée sous `price`, jusqu'à la chaîne d'une règle optionnelle qui n'a rien d'un prix.
    expect(
      classerValeur('rule', ['rule'], { dataset: 'talents.json', champ: 'price' }),
      'un concept keyé par CHAMP classe par le NOM du porteur : il rendrait un verdict sur une forme qu’il n’a jamais vue.',
    ).toMatchObject({ concept: 'prix', statut: 'divergente' });
    expect(
      documents.filter((c) => c.champs?.length).map((c) => c.id),
      'un concept d’ENVELOPPE keyé par champ volerait toute forme posée sous ce nom (`talents.json › when {rule}`, une RÉFÉRENCE, tomberait sous `condition`) — le noyau de clés REQUISES est la seule reconnaissance admise.',
    ).toEqual([]);
    expect(documents.every((c) => (c.noyau?.length ?? 0) > 0), 'un concept d’enveloppe sans noyau ne reconnaît rien.').toBe(true);
  });

  it('B — les noyaux d’enveloppe ne DÉBORDENT pas : les sites classés sont exactement ceux-ci', () => {
    const sites = scan.formes
      .filter((f) => f.strate === 'Document')
      .map((f) => `${f.concept} | ${f.dataset} › ${f.champ} | ${f.signature}`);
    expect(
      lignes(sites),
      'un noyau d’enveloppe a mordu ailleurs que sur sa porte (ou l’a lâchée) — un concept qui déborde est le débordement global que le DoD interdit, et il se NOMME ici avant de se déclarer.',
    ).toEqual(
      lignes([
        'prose-nommee | arene-projet.json › startMessage | texte',
        'prose-nommee | barge-du-sel-projet.json › refus | texte',
        'prose-nommee | barge-du-sel-projet.json › sousTitre | texte',
        'prose-nommee | diligence-projet.json › refus | texte+…',
        'prose-nommee | diligence-projet.json › sousTitre | texte+…',
        'narratif | arene-projet.json › narratif | affaires,documents,etats,indices,objets,presetsPnj',
        'narratif | loup-et-saumure-projet.json › narratif | affaires,documents,etats,indices,objets,presetsPnj',
        'narratif | barge-du-sel-projet.json › narratif | affaires,documents,etats,indices,objets,presetsPnj+…',
        'narratif | diligence-projet.json › narratif | affaires,documents,etats,indices,objets,presetsPnj+…',
        'effet-d-etat | diligence-projet.json › effect | etat,invite,type+…',
        'effet-narratif | arene-projet.json › effect | documentId,type',
        'effet-narratif | diligence-projet.json › effect | documentId,type',
        'effet-narratif | diligence-projet.json › effect | indiceId,stade,type',
        'effet-narratif | loup-et-saumure-projet.json › effect | documentId,type',
        'ouverture | barge-du-sel-projet.json › ouverture | pitch,titre+…',
        'ouverture | diligence-projet.json › ouverture | pitch,titre+…',
        'cloture | barge-du-sel-projet.json › cloture | titre,when+…',
        'cloture | diligence-projet.json › cloture | titre,when+…',
        'condition | arene-projet.json › when | expr,kind',
        'condition | barge-du-sel-projet.json › when | expr,kind',
        'condition | diligence-projet.json › when | expr,kind',
        'condition | loup-et-saumure-projet.json › when | expr,kind',
        // SEUL débordement, et il est LÉGITIME : une Condition posée sous `cond` reste une Condition
        // — c'est le noyau qui la reconnaît, pas le nom du champ (cf. sonde A).
        'condition | loup-et-saumure-projet.json › cond | expr,kind',
      ]),
    );
    expect(
      scan.formes.filter((f) => f.strate === 'Document' && f.statut !== 'cible').map((f) => `${f.dataset} › ${f.champ} | ${f.signature}`),
      'une enveloppe classée hors de sa forme CIBLE : sa porte zod déclare ces clés, le lexique doit dire laquelle.',
    ).toEqual([]);
  });

  it('C — `CLES_DE_VALEUR` ignore les noyaux d’ENVELOPPE (sinon `tellsDeDocument` perd ses tells)', () => {
    // `tellsDeDocument` (`structures-scan.mts`) compte les clés de CHARGE UTILE d'un objet, hors
    // graphie de référence, hors `CLES_DE_VALEUR`, hors enveloppe : ≥ 2 = document embarqué. Verser
    // les noyaux d'enveloppe dans ce vocabulaire y retire des clés aussi courantes que `kind`.
    // MESURÉ (sonde jetable, 2026-09-01, sur les 2 racines) : 44 objets changent alors de TELL, tous
    // de la même forme — les PIONS de scène `{id, kind, label, pos, ref}`, dont `kind` cesse de
    // compter comme charge utile. Aucun compte mesuré ne bouge aujourd'hui (le tell ne tranche que
    // face à `siteDeReference`) : cette séparation est un verrou PAR CONSTRUCTION, et c'est
    // précisément pourquoi elle a besoin de cette sonde-ci — aucune égalité de stock ne la couvre.
    const noyauxEnveloppe = [...new Set(CONCEPTS.filter((c) => c.strate === 'Document').flatMap((c) => c.noyau ?? []))];
    expect(noyauxEnveloppe.length, 'la strate `Document` ne déclare plus de noyau : la sonde ne mesure rien.').toBeGreaterThan(0);
    expect(
      noyauxEnveloppe.filter((k) => CLES_DE_VALEUR.has(k)),
      '`CLES_DE_VALEUR` dérive de la STRATE (`Valeur`), jamais du filtre de résolution : une clé d’enveloppe qui y entre est retirée de la charge utile de `tellsDeDocument`.',
    ).toEqual([]);
  });

  /**
   * PILOTE du scan AMPUTÉ, exécuté dans un PROCESSUS SÉPARÉ. `CONCEPTS_CLASSABLES`
   * (`scripts/docs/lib/structures-scan.mts:198`) est dérivé À L’ÉVALUATION du module : retirer un
   * concept après coup n’atteint pas le scan déjà chargé, et le mock de module est INTERDIT tant que
   * la suite partage son graphe (`src/vi-mock-isolate-guard.test.ts`, `isolate: false`). Le
   * sous-processus est donc la seule amputation qui ne laisse RIEN derrière elle : il meurt avec sa
   * mutation. La QUERY sur le second import donne au scan une identité de module neuve — il se
   * ré-évalue et relit `CONCEPTS` amputé.
   */
  const PILOTE_DIFF_STRATE = [
    "import { pathToFileURL } from 'node:url';",
    "import { join } from 'node:path';",
    'const R = process.cwd();',
    "const url = (p) => pathToFileURL(join(R, p)).href;",
    "const SCAN = url('scripts/docs/lib/structures-scan.mjs');",
    "const lexique = await import(url('scripts/docs/lib/structures-lexique.mjs'));",
    'const avec = (await import(SCAN)).scanDuCorpus(R).scan;',
    "const retires = lexique.CONCEPTS.filter((c) => c.strate === 'Document');",
    'for (const c of retires) lexique.CONCEPTS.splice(lexique.CONCEPTS.indexOf(c), 1);',
    "const sans = (await import(SCAN + '?sansDocument')).scanDuCorpus(R).scan;",
    "const site = (x) => x.dataset + ' › ' + x.champ;",
    "const kf = (f) => f.concept + ' | ' + site(f) + ' | ' + f.signature + ' | ' + f.occurrences;",
    "const ki = (i) => site(i) + ' | ' + i.signature + ' | ' + i.occurrences;",
    "const ko = (o) => site(o) + ' | ' + o.signature + ' | ' + o.motif + ' | ' + o.occurrences;",
    'const seuls = (a, b, k) => a.filter((x) => !b.some((y) => k(y) === k(x))).map(k).sort();',
    "process.stdout.write('<<<DIFF>>>' + JSON.stringify({",
    '  retires: retires.map((c) => c.id).sort(),',
    '  comptes: { formes: avec.formes.length, invisibles: avec.invisibles.length, orphelines: avec.orphelines.length },',
    '  formesGagnees: seuls(avec.formes, sans.formes, kf),',
    '  formesVolees: seuls(sans.formes, avec.formes, kf),',
    '  invisiblesEteintes: seuls(sans.invisibles, avec.invisibles, ki),',
    '  invisiblesNees: seuls(avec.invisibles, sans.invisibles, ki),',
    '  orphelinesEteintes: seuls(sans.orphelines, avec.orphelines, ko),',
    '  orphelinesNees: seuls(avec.orphelines, sans.orphelines, ko),',
    "}));",
  ].join('\n');

  /**
   * D — le non-débordement se prouve par DIFF, pas par liste. La sonde B verrouille les sites
   * classés `Document` ; elle ne dit RIEN de ce que ces noyaux auraient PRIS aux strates
   * `Valeur`/`Référence` — une forme volée disparaîtrait de son concept d’origine sans qu’aucune
   * égalité de stock ne bouge (les lignes volées seraient simplement absentes des deux côtés).
   * Ici on mesure les DEUX scans et on exige : ce que la strate `Document` gagne, elle le prend à ce
   * qui n’était CLASSÉ PAR PERSONNE (invisibles + orphelines), jamais à un concept existant.
   */
  it('D — DIFF avec/sans la strate `Document` : ce qu’elle gagne vient du NON-CLASSÉ, zéro forme VOLÉE', { timeout: 60_000 }, () => {
    const dossier = mkdtempSync(join(tmpdir(), 'structures-strate-'));
    try {
      const pilote = join(dossier, 'diff-strate-document.mjs');
      writeFileSync(pilote, PILOTE_DIFF_STRATE, 'utf8');
      const sortie = execFileSync(process.execPath, ['--import', 'tsx', pilote], { cwd: ROOT, encoding: 'utf8' }).split('<<<DIFF>>>');
      const diff = JSON.parse(sortie[sortie.length - 1]) as {
        retires: string[];
        comptes: { formes: number; invisibles: number; orphelines: number };
        formesGagnees: string[];
        formesVolees: string[];
        invisiblesEteintes: string[];
        invisiblesNees: string[];
        orphelinesEteintes: string[];
        orphelinesNees: string[];
      };

      // Le pilote a bien amputé CE QUE le lexique déclare aujourd'hui, et il a mesuré LE MÊME arbre
      // que le scan en mémoire — sans ces deux ancrages, le diff comparerait deux inconnues.
      expect(diff.retires, 'le pilote n’a pas retiré les concepts d’ENVELOPPE que le lexique déclare.').toEqual(
        lignes(documents.map((c) => c.id)),
      );
      expect(
        diff.comptes,
        'le scan du sous-processus ne mesure pas le même arbre que celui du fichier : le diff ne prouverait rien.',
      ).toEqual({ formes: scan.formes.length, invisibles: scan.invisibles.length, orphelines: scan.orphelines.length });

      expect(
        diff.formesVolees,
        'une forme classée SANS la strate `Document` disparaît AVEC elle : un noyau d’enveloppe a VOLÉ des objets à un concept de `Valeur`/`Référence` — c’est le débordement global que le DoD interdit.',
      ).toEqual([]);
      expect(
        diff.formesGagnees,
        'les formes que la strate `Document` ajoute ne sont pas exactement celles que le scan lui compte.',
      ).toEqual(lignes(scan.formes.filter((f) => f.strate === 'Document').map((f) => `${f.concept} | ${f.dataset} › ${f.champ} | ${f.signature} | ${f.occurrences}`)));

      // La CONTREPARTIE : chaque gain sort du NON-CLASSÉ. 12 lignes d'invisibles s'éteignent (les
      // objets qu'aucun concept ne reconnaissait) et 1 orpheline (`diligence-projet.json › ouverture`,
      // dont la clé `source` déclenchait le motif `clé réservée`) — la projection réunit les deux
      // buckets qu'un optionnel peuplé séparait. Somme = les gains, à l'unité près.
      expect(diff.invisiblesNees, 'la strate `Document` rend un objet INVISIBLE : elle en perd un au lieu d’en classer.').toEqual([]);
      expect(diff.orphelinesNees, 'la strate `Document` fabrique une ORPHELINE : elle en perd une au lieu d’en classer.').toEqual([]);
      expect(
        diff.orphelinesEteintes,
        'l’orpheline soldée par la strate `Document` n’est plus celle que le stock nomme (`structuresStock.mjs`, en-tête des concepts d’enveloppe).',
      ).toEqual(['diligence-projet.json › ouverture | ambiance,chapitre,pitch,source,sousTitre,surtitre,titre | clé réservée | 1']);
      expect(
        diff.invisiblesEteintes.length + diff.orphelinesEteintes.length,
        'le compte ne se referme plus : un gain de la strate `Document` ne vient ni d’un invisible ni d’une orpheline — il vient donc d’ailleurs.',
      ).toBe(diff.formesGagnees.length);
      const sitesDocument = new Set(scan.formes.filter((f) => f.strate === 'Document').map((f) => `${f.dataset} › ${f.champ}`));
      expect(
        lignes(diff.invisiblesEteintes.filter((l) => !sitesDocument.has(l.split(' | ')[0]))),
        'un invisible s’est éteint sur un SITE que la strate `Document` ne classe pas : l’extinction déborde des portes.',
      ).toEqual([]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe('l’enveloppe : ce qu’un document doit porter (contrats positifs)', () => {
  const cle = (c: string, classe: string, n: number) => ({ cle: c, n, parClasse: [{ classe, n }] });

  it('une ENTRÉE DE RACINE sans `id`/`type`/`label`/`source` sort en divergences ; conforme, elle sort vide', () => {
    const neuf = mesurerEnveloppe([
      { document: 'neuf.json', chemin: '(entrées)', portee: 'racine', famille: 'entité', nbEntrees: 3, cles: [cle('code', 'string', 3), cle('nom', 'string', 3)] },
    ]);
    expect(neuf.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | id | clé absente',
      'identité | nom | clé divergente',
      'libellé | label | clé absente',
      'libellé | nom | clé divergente',
      'source | source | clé absente',
      'type de document | type | clé absente',
    ]);
    const conforme = mesurerEnveloppe([
      {
        document: 'ok.json',
        chemin: '(entrées)',
        portee: 'racine',
        famille: 'entité',
        nbEntrees: 3,
        cles: [cle('id', 'string', 3), cle('type', 'string', 3), cle('label', 'string', 3), cle('desc', 'string', 3), cle('source', 'object', 3)],
      },
    ]);
    expect(conforme).toEqual([]);
  });

  /**
   * La PROVENANCE est une ALTERNATIVE dans la grammaire — `source` OU `maison`, jamais ni l'un ni
   * l'autre (`src/data/schemas/grammaire/document.ts:402-413`). Le lexique la mesure comme telle :
   * un document maison est CONFORME, un document qui ne dit RIEN reste au dénominateur.
   */
  it('le rôle `source` est satisfait par son ALTERNATIVE `maison` — mais rien ne remplace les deux', () => {
    const groupe = (doc: string, provenance: ReturnType<typeof cle>[]) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité', nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('type', 'string', 2), cle('label', 'string', 2), ...provenance],
    });
    const provenance = (doc: string, cles: ReturnType<typeof cle>[]) =>
      mesurerEnveloppe([groupe(doc, cles)]).map((e) => `${e.role} | ${e.cle} | ${e.motif}`);

    expect(provenance('folio.json', [cle('source', 'object', 2)]), 'la CIBLE satisfait le rôle.').toEqual([]);
    expect(provenance('maison.json', [cle('maison', 'string', 2)]), 'l’ALTERNATIVE le satisfait aussi.').toEqual([]);
    expect(provenance('muet.json', []), 'ni folio ni arbitrage : le document reste au dénominateur.').toEqual([
      'source | source | clé absente',
    ]);
  });

  /**
   * Le rôle `source` se mesure selon `provenanceMesuree` (`src/data/schemas/grammaire/sans-livre.ts`) :
   * un type cité EN PROFONDEUR ou définitivement SANS LIVRE n'est pas compté ; le CONTENU dont le
   * sourçage reste dû (L1d #1469) l'est, bien que la fabrique l'exempte.
   */
  it('le rôle `source` compte l’absence selon le régime mesuré du type', () => {
    const muet = (type: string | undefined) =>
      mesurerEnveloppe([
        {
          document: `${type ?? 'anonyme'}.json`, chemin: '(entrées)', portee: 'racine', famille: 'entité', nbEntrees: 2, type,
          cles: [cle('id', 'string', 2), cle('type', 'string', 2), cle('label', 'string', 2)],
        },
      ]).map((e) => `${e.role} | ${e.cle} | ${e.motif}`);
    const absente = ['source | source | clé absente'];
    const [enProfondeur] = Object.keys(SOURCE_EN_PROFONDEUR);
    const definitif = Object.keys(SANS_LIVRE).find((t) => !(t in CONTENU_A_SOURCER));
    const [aSourcer] = Object.keys(CONTENU_A_SOURCER);
    expect(muet(enProfondeur), 'EN PROFONDEUR : la racine ne porte jamais de source.').toEqual([]);
    expect(muet(definitif), 'SANS LIVRE définitif : rien d’exigible.').toEqual([]);
    expect(muet(aSourcer), 'contenu à sourcer : la dette L1d reste au dénominateur.').toEqual(absente);
    expect(muet('hors-regime'), 'hors régime : l’absence reste au dénominateur.').toEqual(absente);
    expect(muet(undefined), 'sans type : aucun régime ne s’applique.').toEqual(absente);
  });

  /**
   * Le rôle `type de document` est `entiere` : c'est ce qui le rend mesurable SOUS l'entrée de
   * racine. Un document embarqué qui s'annonce (`type: 'scene'`, `type: 'statblock'`) l'annonce sur
   * TOUTES ses entrées — une seule qui ne le porte pas est nommée, portée embarquée comprise.
   */
  it('le `type` d’un document se porte ENTIER : une portée qui l’annonce à moitié est nommée', () => {
    const scenes = (porteuses: number, n: number) => [
      { document: 'projet.json', chemin: 'scenes', portee: 'embarqué' as const, famille: 'entité', nbEntrees: n, cles: [cle('id', 'string', n), cle('label', 'string', n), cle('type', 'string', porteuses)] },
    ];
    expect(
      mesurerEnveloppe(scenes(18, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}`),
      'les 18 scènes s’annoncent : rien à mesurer.',
    ).toEqual([]);
    expect(
      mesurerEnveloppe(scenes(17, 18)).map((e) => `${e.role} | ${e.cle} | ${e.motif}:${e.detail} | ${e.entrees}`),
      'une scène qui ne s’annonce plus est NOMMÉE, avec le compte des portées manquantes.',
    ).toEqual(['type de document | type | cible partielle:17/18 | 1']);
    expect(
      mesurerEnveloppe([{ document: 'flow.json', chemin: 'steps', portee: 'embarqué', famille: 'entité', nbEntrees: 4, cles: [cle('id', 'string', 4)] }]),
      'un document embarqué qui n’annonce AUCUN type n’est sommé de rien : `entiere` mesure ce qui est là.',
    ).toEqual([]);
  });

  it('un document EMBARQUÉ n’est sommé de rien : seules ses clés DIVERGENTES comptent', () => {
    const embarque = mesurerEnveloppe([
      { document: 'flow.json', chemin: 'steps[].effect', portee: 'embarqué', famille: 'entité', nbEntrees: 5, cles: [cle('text', 'string', 5), cle('nom', 'string', 5), cle('title', 'string', 5), cle('type', 'string', 5)] },
    ]);
    // `title` est la forme CIBLE de son rôle (sous-titre) : il ne compte pas — seules `text` et `nom`,
    // graphies divergentes de la prose et du libellé, sont relevées.
    expect(embarque.map((e) => `${e.role} | ${e.cle} | ${e.motif}`).sort()).toEqual([
      'identité | nom | clé divergente',
      'libellé | nom | clé divergente',
      'prose | text | clé divergente',
    ]);
  });

  it('le rôle PROSE ne voit que ses divergentes DÉCLARÉES — une graphie hors lexique lui échappe', () => {
    const groupe = (doc: string, c: string) => ({
      document: doc, chemin: '(entrées)', portee: 'racine' as const, famille: 'entité' as const, nbEntrees: 2,
      cles: [cle('id', 'string', 2), cle('label', 'string', 2), cle('source', 'object', 2), cle(c, 'string', 2)],
    });
    const prose = (doc: string, c: string) =>
      mesurerEnveloppe([groupe(doc, c)]).filter((e) => e.role === 'prose').map((e) => `${e.cle} | ${e.motif}`);

    expect(prose('divergente.json', 'text'), 'une divergente DÉCLARÉE est mesurée.').toEqual(['text | clé divergente']);
    expect(prose('cible.json', 'desc'), 'la CIBLE du rôle n’est pas une divergence.').toEqual([]);
    // La mesure ne voit que ses divergentes déclarées — une graphie hors lexique lui échappe.
    // La clé sonde est FORGÉE pour n'entrer JAMAIS au lexique : une graphie plausible (`texte`) ferait
    // rougir cette assertion le jour où elle y entrerait, et l'angle mort disparaîtrait de la mesure.
    expect(prose('inconnue.json', 'proseInconnueSonde')).toEqual([]);
  });

  it('l’enveloppe descend sous l’entrée : un document EMBARQUÉ est mesuré sous son chemin', () => {
    const embarques = scan.groupesEnveloppe.filter((g) => g.portee === 'embarqué');
    expect(embarques.length, 'aucun document embarqué mesuré — la borne de profondeur est revenue.').toBeGreaterThan(0);
    expect(
      scan.groupesEnveloppe.filter((g) => g.portee === 'racine').length,
      'les entrées de racine et les documents embarqués se comptent SÉPARÉMENT.',
    ).toBe(scan.documents.length);
  });

  it('§5 : les Conditions retirées du compte d’ops sont celles qui PORTAIENT un `op`', () => {
    let objetsAOp = 0;
    const marche = (v: unknown): void => {
      if (Array.isArray(v)) { v.forEach(marche); return; }
      if (!v || typeof v !== 'object') return;
      if (typeof (v as { op?: unknown }).op === 'string') objetsAOp += 1;
      Object.values(v).forEach(marche);
    };
    for (const d of listerDocuments(ROOT)) marche(JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')));
    expect(objetsAOp, 'la marche brute ne voit aucun `op` : l’égalité ci-dessous ne mesurerait rien.').toBeGreaterThan(0);
    expect(
      scan.totalConditionsAvecOp + scan.totalOps,
      'ops de jeu + Conditions à `op` = objets portant un `op` chaîne (marche brute des documents du scan) : une Condition sans `op` comptée en op, ou un `op` qui échappe aux deux, rompt l’égalité.',
    ).toBe(objetsAOp);
  });
});

describe('`{text}` : la forme DÉCLARÉE ne couvre que l’irréductible narratif (#1463 L0, #624)', () => {
  const forme = (source: typeof scan, signature: string) =>
    source.formes.find(
      (f) => f.concept === 'reference' && f.dataset === 'careerLevels.json' && f.champ === 'trappings' && f.signature === signature,
    );

  it('un `{text}` qui nomme une POSSESSION est `text (résolvable)` ; « Sa Honte » et « Assistant » restent `text` declaree (#1463 L-ref-0)', { timeout: 30_000 }, () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-text-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS);
      expect(temoin.formes.length, 'la COPIE non mutée ne mesure pas comme l’arbre.').toBe(scan.formes.length);
      expect(forme(temoin, 'text'), 'la forme `text` déclarée a disparu du témoin.').toMatchObject({ statut: 'declaree' });
      expect(
        forme(temoin, 'text (résolvable)'),
        'aucune dotation de `careerLevels` ne doit être résolvable AU REPOS : les 49 qui nommaient une possession sont liées (L-ref-1).',
      ).toBeUndefined();

      const chemin = join(copie, 'src/data/careerLevels.json');
      const niveaux = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      // « Dague » EST le `label` du trapping `dague` — la cible MAJORITAIRE du site. « Sa Honte »
      // n’est le libellé d’aucune entité. « Assistant » est le `label` d’un NIVEAU DE CARRIÈRE
      // (`careerLevels.json`) et de RIEN dans `trappings.json` : ce n’est pas une possession, et
      // c’est le contrôle NÉGATIF de la résolution scopée au site (avant #1463 L-ref-0, il comptait
      // résolvable — la mesure acceptait n’importe quel dataset).
      niveaux[0].trappings = [
        ...(niveaux[0].trappings as unknown[]),
        { text: 'Dague' },
        { text: 'Sa Honte' },
        { text: 'Assistant' },
      ];
      writeFileSync(chemin, JSON.stringify(niveaux), 'utf8');
      const apres = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS);

      expect(
        forme(apres, 'text (résolvable)')?.occurrences,
        '`{text:"Dague"}` sous `trappings` doit être classé `text (résolvable)` : un texte qui résout vers le `label` d’une POSSESSION est une référence à migrer en `{id}` (#624), pas du narratif déclaré.',
      ).toBe(1);
      expect(
        forme(apres, 'text')!.occurrences - forme(temoin, 'text')!.occurrences,
        '`{text:"Sa Honte"}` et `{text:"Assistant"}` doivent rester la forme `text` DECLARÉE : l’irréductible narratif ne se migre pas, et un homonyme d’un AUTRE dataset n’est pas une dotation.',
      ).toBe(2);
      expect(
        forme(apres, 'text (résolvable)')!.cibles,
        'la forme résolvable doit IMPRIMER le dataset où le libellé a été trouvé.',
      ).toEqual(['trappings.json']);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

describe('contrôle POSITIF côté DONNÉE : le détecteur MORD (#1465 F21)', () => {
  it('un lieu et un déclencheur supplémentaires donnent un écart nominatif avec son producteur', () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-croissance-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const relatif = listerProjetsLivres(copie).find((p) =>
        JSON.parse(readFileSync(join(copie, 'src/scenes', p), 'utf8')).id === 'la-diligence',
      )!;
      const chemin = join(copie, 'src/scenes', relatif);
      const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
      const scene = paquet.scenes.find((s: { id: string }) => s.id === 'la-diligence');
      paquet.worldMap.places.push({ id: 'lieu-croissance-2337', label: 'Lieu de contrôle', pos: { x: 20, y: 20 }, scene: scene.id, icon: 'scenario/hamlet' });
      scene.triggers.push({
        id: 'declencheur-croissance-2337', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true,
        flow: { kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: 'croissance-2337' } }] },
      });
      writeFileSync(chemin, JSON.stringify(paquet), 'utf8');
      const apres = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS);
      const ecarts = ecartsDeFormes(apres);
      const site = (f: { dataset: string; champ: string; signature: string }) =>
        f.dataset === 'diligence-projet.json' && f.champ === 'scene' && f.signature === 'id-nu';
      expect(apres.formes.find(site)!.occurrences).toBe(scan.formes.find(site)!.occurrences + 1);
      const hausse = ecarts.accrues.filter((ligne) => ligne.includes('reference | diligence-projet.json | scene | id-nu'));
      expect(hausse, 'la hausse d’un site connu sort en `accrues`, jamais en ligne neuve ou périmée.').toHaveLength(1);
      expect(hausse[0]).toContain('HAUSSE');
      expect(hausse[0], 'le seul remède d’une hausse est la migration vers la CIBLE du site.').toContain('Migrer ce site vers une forme CIBLE du lexique (`id`');
      expect([...ecarts.neuves, ...ecarts.perimees, ...ecarts.accrues].filter((l) => l.includes('--write')), 'aucun remède n’écrit une hausse.').toEqual([]);
      expect([...ecarts.neuves, ...ecarts.perimees].filter((l) => l.includes('diligence-projet.json | scene | id-nu'))).toEqual([]);
      expect(apres.ops.map(cleOp)).toEqual(scan.ops.map(cleOp));
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });

  it('trois dérives injectées dans une COPIE de l’arbre sont VUES : forme neuve, orpheline neuve, op neuve', { timeout: 60_000 }, () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-contrat-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      const temoin = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS);
      const cleF = (f: { concept: string; dataset: string; champ: string; signature: string; statut: string; occurrences: number }) =>
        `${f.concept} | ${f.dataset} | ${f.champ} | ${f.signature} | ${f.statut} | ${f.occurrences}`;
      const cleO = (o: { dataset: string; champ: string; signature: string; motif: string }) =>
        `${o.dataset} | ${o.champ} | ${o.signature} | ${o.motif}`;
      const cleOpSonde = (o: { op: string; signature: string; dataset: string }) => `${o.op} | ${o.signature} | ${o.dataset}`;
      expect(
        temoin.formes.length,
        'la COPIE non mutée ne mesure pas comme l’arbre : le contrôle positif ne prouverait rien.',
      ).toBe(scan.formes.length);

      const chemin = join(copie, 'src/data/axes.json');
      const axes = JSON.parse(readFileSync(chemin, 'utf8')) as Array<Record<string, unknown>>;
      axes[0].sondes = [{ skillIdent: 'athletisme', poids: 3 }]; // graphie de référence NEUVE
      axes[0].opsSonde = [{ op: 'sondeJuge', talentId: 'affable', valeur: 1 }]; // op NEUVE à ref à plat
      axes[0].casses = [{ machinId: 'ceci-n-existe-pas' }]; // FK morte : clé …Id qui ne résout vers rien
      writeFileSync(chemin, JSON.stringify(axes), 'utf8');

      const apres = scannerDonnees(copie, DEFS, CHOIX, CHOIX_OPS);
      const formesNeuves = apres.formes.filter((f) => !temoin.formes.some((g) => cleF(g) === cleF(f))).map(cleF);
      const orphelinesNeuves = apres.orphelines.filter((o) => !temoin.orphelines.some((q) => cleO(q) === cleO(o))).map(cleO);
      const opsNeuves = apres.ops.filter((o) => !temoin.ops.some((q) => cleOpSonde(q) === cleOpSonde(o))).map(cleOpSonde);

      expect(formesNeuves, 'une GRAPHIE de référence neuve (`skillIdent`) n’est pas vue : le stock ne mordrait pas.').toContain(
        'reference | axes.json | sondes | skillIdent+… | divergente | 1',
      );
      expect(orphelinesNeuves, 'une FK morte (`machinId`) n’est pas vue : le motif `clé de référence non résolue` serait inatteignable.').toContain(
        'axes.json | casses | machinId | clé de référence non résolue',
      );
      expect(opsNeuves, 'une op NEUVE à ref à plat n’est pas vue : le dénominateur de la strate Ops serait aveugle.').toContain(
        'sondeJuge | op,talentId,valeur | axes.json',
      );
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

/**
 * MORSURE du régime `valeurs` sur un record ENVELOPPÉ (#1467 L1b V-FLIP-RECORD). Un record porte
 * son enveloppe (`id`/`type`/`label`) et sa carte sous `entries` : le scan doit DESCENDRE
 * dans `entries` pour indexer les vraies clés. Sans cette descente, l'index reçoit `id`/`type`/`label`/
 * `entries` — les clés du record disparaîtraient de l'index des ids, en silence.
 */
describe('régime `valeurs` : le scan descend dans `entries` d’un record ENVELOPPÉ', () => {
  const expositionDeSonde: Exposition = { codex: { keys: ['sondes'] }, edit: { dataset: 'sonde.json' } };
  it('une clé d’`entries` entre à l’index (collision avec `teintesJeu.json`) ; l’enveloppe n’y entre pas', { timeout: 60_000 }, () => {
    const copie = mkdtempSync(join(tmpdir(), 'structures-record-'));
    try {
      for (const racine of ['src/data', 'src/scenes']) cpSync(join(ROOT, racine), join(copie, racine), { recursive: true });
      // Record ENVELOPPÉ sonde : sa seule clé de charge est celle d'une teinte réelle — le scan doit
      // donc voir une COLLISION d'id entre les deux documents.
      writeFileSync(
        join(copie, 'src/data/sonde-record.json'),
        JSON.stringify({ id: 'sonde-record', type: 'sondeRecord', label: 'Sonde record', entries: { 'zone-marche': '#123456' } }),
        'utf8',
      );
      const sonde = document('sondeRecord', 'record', {}, {}, expositionDeSonde, { valeurRecord: z.string() });
      const apres = scannerDonnees(copie, [...DEFS, { file: 'sonde-record.json', root: 'src/data', famille: 'record', schema: sonde.schema }], CHOIX, CHOIX_OPS);
      const collision = apres.index.collisions.find((c) => c.id === 'zone-marche');
      expect(collision?.datasets, 'la clé d’`entries` n’est pas indexée : le régime `valeurs` n’est pas descendu sous l’enveloppe.').toEqual([
        'sonde-record.json',
        'teintesJeu.json',
      ]);
      expect(
        apres.index.collisions.filter((c) => ['entries', 'label', 'type'].includes(c.id)).map((c) => c.id),
        'les clés d’ENVELOPPE sont entrées à l’index comme des ids de record.',
      ).toEqual([]);
    } finally {
      rmSync(copie, { recursive: true, force: true });
    }
  });
});

/**
 * COLLECTION À CLÉ DÉCLARÉE (#1897) : une carte de record que le schéma MARQUE (`marquerCollection`)
 * n'est jamais hors strate — ni invisible, ni orpheline — et le classement valeur/référence la lit
 * comme tout objet (`TERMES_COLLECTION_A_CLE`, `scripts/docs/lib/structures-lexique.mts`).
 */
describe('collection à clé déclarée : la carte d’un record MARQUÉ n’est jamais hors strate', () => {
  const expositionDeSonde: Exposition = { codex: { keys: ['sondes'] }, edit: { dataset: 'sonde.json' } };
  const carte = <S extends z.ZodType>(s: S) => marquerCollection(s, marqueDeRecord());
  const cotes = z.strictObject({ a: z.number(), b: z.number() });
  const renvois = z.strictObject({ a: z.string(), b: z.string() });
  const x = document(
    'x',
    'config',
    { t: carte(cotes), tNue: cotes, r: carte(renvois), u: carte(z.strictObject({ fooId: z.string() })) },
    { t: { label: 'T' }, tNue: { label: 'T nue' }, r: { label: 'R' }, u: { label: 'U' } },
    expositionDeSonde,
  );
  const alpha = document('alpha', 'entite', {}, {}, expositionDeSonde);
  const DEFS_FIXTURE: SchemaDef[] = [
    { file: 'x.json', root: 'src/data', famille: 'config', schema: x.schema },
    { file: 'alpha.json', root: 'src/data', famille: 'entite', schema: alpha.schema },
  ];
  const dossier = mkdtempSync(join(tmpdir(), 'structures-collection-'));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  mkdirSync(join(dossier, 'src/data'), { recursive: true });
  mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
  cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
  writeFileSync(join(dossier, 'src/data/alpha.json'), JSON.stringify([{ id: 'renvoi-un', maison: 'sonde' }, { id: 'renvoi-deux', maison: 'sonde' }]));
  writeFileSync(
    join(dossier, 'src/data/x.json'),
    JSON.stringify({
      id: 'x',
      maison: 'sonde',
      t: { a: 1, b: 2 },
      tNue: { a: 3, b: 4 },
      r: { a: 'renvoi-un', b: 'renvoi-deux' },
      u: { fooId: 'renvoi-absent' },
    }),
  );
  const fixture = scannerDonnees(dossier, DEFS_FIXTURE);
  const brut = fixture.brutParNom.get('x.json') as Record<string, object>;
  const invisible = (champ: string) => fixture.invisibles.filter((i) => i.dataset === 'x.json' && i.champ === champ).map((i) => i.signature);

  it('la carte marquée est une collection relevée et n’est pas invisible ; sa jumelle NON marquée l’est', () => {
    expect(invisible('t'), 'la carte `t`, déclarée collection à clé, est comptée hors strate.').toEqual([]);
    expect(fixture.collections.filter((c) => c.dataset === 'x.json').map((c) => c.cle)).toEqual(['x.json#t', 'x.json#r', 'x.json#u']);
    expect(invisible('tNue'), 'contrôle : la même forme SANS marque reste hors strate.').toEqual(['a,b']);
    expect(fixture.objets.collectionsACle).toBe(3);
  });

  it('une carte marquée dont les valeurs RÉSOLVENT reste PORTEUR de références, case par case', () => {
    expect([...(fixture.referencesParPorteur.get(brut.r)?.keys() ?? [])].sort(), 'le classement a sauté la carte marquée.').toEqual(['a', 'b']);
  });

  it('une carte marquée dont une clé `…Id` ne résout pas n’est pas orpheline', () => {
    expect(fixture.orphelines.filter((o) => o.dataset === 'x.json').map((o) => `${o.champ} | ${o.signature}`)).toEqual([]);
    expect(invisible('u')).toEqual([]);
  });
});

/**
 * CLÉS PORTÉES (`clesPortees`) : une clé déclarée d'un document A que seule porte une ENTRÉE PARTIELLE
 * de A embarquée dans un document B est PORTÉE par la donnée — c'est le schéma de A qui la valide
 * (volet « formes DÉCLARÉES jamais observées » ci-dessus).
 */
describe('clés portées : l’entrée PARTIELLE embarquée d’un document porte ses clés', () => {
  const expositionDeSonde: Exposition = { codex: { keys: ['sondes'] }, edit: { dataset: 'sonde.json' } };
  const a = document(
    'a',
    'entite',
    { cible: z.number().optional(), autre: z.string().optional(), sous: z.strictObject({ cible: z.number() }).optional() },
    { cible: { label: 'Cible' }, autre: { label: 'Autre' }, sous: { label: 'Sous' } },
    expositionDeSonde,
  );
  const b = z.strictObject({
    pnjs: z.array(z.strictObject({ id: z.string(), profil: a.entreePartielle.optional() })).optional(),
    leurre: z.strictObject({ cible: z.number() }).optional(),
    union: z.union([a.entreePartielle, z.strictObject({ cible: z.number(), etranger: z.string() })]).optional(),
  });
  const defs = [
    { file: 'a.json', schema: a.schema },
    { file: 'b.json', schema: b },
  ];
  const documents = [
    { nom: 'a.json', clesNiveau1: [{ cle: 'id' }] },
    { nom: 'b.json', clesNiveau1: [{ cle: 'pnjs' }] },
  ];
  const portees = (brutB: unknown) =>
    clesPortees(documents, entreesPartiellesEmbarquees(new Map<string, unknown>([['a.json', [{ id: 'x' }]], ['b.json', brutB]]), defs));

  it('une clé de A portée SEULEMENT par l’entrée partielle de A embarquée dans B est portée pour A', () => {
    const p = portees({ pnjs: [{ id: 'p', profil: { cible: 3 } }] });
    expect([...p.get('a.json')!].sort()).toEqual(['cible', 'id']);
    expect([...p.get('b.json')!]).toEqual(['pnjs']);
  });

  it('opposé : la même clé ABSENTE de l’entrée partielle n’est pas portée', () => {
    expect([...portees({ pnjs: [{ id: 'p', profil: { autre: 'z' } }] }).get('a.json')!].sort()).toEqual(['autre', 'id']);
  });

  it('opposé : une clé de même nom portée par un objet de B qui n’est PAS l’entrée partielle de A n’est pas portée pour A', () => {
    expect([...portees({ leurre: { cible: 1 }, pnjs: [{ id: 'p' }] }).get('a.json')!]).toEqual(['id']);
  });

  it('opposé : une clé portée par un DESCENDANT de l’entrée partielle n’est pas une clé de niveau 1 de A', () => {
    expect([...portees({ pnjs: [{ id: 'p', profil: { sous: { cible: 1 } } }] }).get('a.json')!].sort()).toEqual(['id', 'sous']);
  });

  it('union simple : la valeur qui prend l’AUTRE branche ne porte rien pour A ; celle qui est une entrée partielle de A, si', () => {
    expect([...portees({ union: { cible: 1, etranger: 'x' } }).get('a.json')!]).toEqual(['id']);
    expect([...portees({ union: { cible: 1 } }).get('a.json')!].sort()).toEqual(['cible', 'id']);
  });
});

/**
 * FORMES d'une entrée PARTIELLE embarquée (`entreesPartiellesEmbarquees`) : l'objet repéré est une
 * ENTRÉE du document D qu'il complète — ses enfants sont mesurés sur les sites de D, jamais sur ceux de
 * l'hôte, et il n'entre pas dans la mesure d'enveloppe de D (un patch n'est sommé de rien).
 */
describe('formes : l’entrée PARTIELLE embarquée est mesurée comme une entrée de son document', () => {
  const expositionDeSonde: Exposition = { codex: { keys: ['sondes'] }, edit: { dataset: 'sonde.json' } };
  const lien = z.strictObject({ cibleId: z.string() });
  const alpha = document('alpha', 'entite', {}, {}, expositionDeSonde);
  const a = document('a', 'entite', { liens: z.array(lien).optional() }, { liens: { label: 'Liens' } }, expositionDeSonde);
  const b = z.strictObject({
    pnjs: z.array(z.strictObject({ id: z.string(), profil: a.entreePartielle.optional() })),
    leurre: z.strictObject({ liens: z.array(lien) }),
  });
  const DEFS_FIXTURE: SchemaDef[] = [
    { file: 'alpha.json', root: 'src/data', famille: 'entite', schema: alpha.schema },
    { file: 'a.json', root: 'src/data', famille: 'entite', schema: a.schema },
    { file: 'b.json', root: 'src/data', famille: 'config', schema: b },
  ];
  const dossier = mkdtempSync(join(tmpdir(), 'structures-partielle-'));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  mkdirSync(join(dossier, 'src/data'), { recursive: true });
  mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
  cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
  writeFileSync(join(dossier, 'src/data/alpha.json'), JSON.stringify([{ id: 'renvoi-un', maison: 'sonde' }]));
  writeFileSync(join(dossier, 'src/data/a.json'), JSON.stringify([{ id: 'a1', type: 'a', label: 'A1', maison: 'sonde' }]));
  writeFileSync(
    join(dossier, 'src/data/b.json'),
    JSON.stringify({ pnjs: [{ id: 'p', profil: { liens: [{ cibleId: 'renvoi-un' }] } }], leurre: { liens: [{ cibleId: 'renvoi-un' }] } }),
  );
  const fixture = scannerDonnees(dossier, DEFS_FIXTURE);
  const formesDesLiens = () =>
    fixture.formes.filter((f) => f.champ === 'liens').map((f) => `${f.concept} | ${f.dataset} | ${f.signature} | ${f.occurrences}`);

  it('l’enfant de l’entrée partielle est compté sous son document ; le même enfant hors entrée partielle reste à l’hôte', () => {
    expect(formesDesLiens()).toEqual(['reference | a.json | cibleId | 1', 'reference | b.json | cibleId | 1']);
  });

  it('l’entrée partielle n’est ni orpheline, ni invisible, ni document embarqué de l’hôte', () => {
    expect(fixture.orphelines.filter((o) => o.champ === 'profil')).toEqual([]);
    expect(fixture.invisibles.filter((i) => i.champ === 'profil')).toEqual([]);
    expect(fixture.groupesEnveloppe.filter((g) => g.chemin.includes('profil'))).toEqual([]);
  });

  it('l’entrée partielle n’entre pas dans la mesure d’enveloppe de son document (un patch n’est sommé de rien)', () => {
    expect(fixture.enveloppe.filter((e) => e.document === 'a.json')).toEqual([]);
    expect(fixture.groupesEnveloppe.find((g) => g.document === 'a.json' && g.portee === 'racine')?.nbEntrees).toBe(1);
  });
});

/**
 * SIGNATURE PROJETÉE d'un objet de référence (`signatureProjetee`) : une clé dont la valeur est une
 * réf canonique `{ id }` qui résout compte comme une clé qui résout. Migrer UNE clé scalaire d'un
 * objet vers `ref(…)` ne change donc pas l'identité de son site ; un objet dont toutes les réfs sont
 * canoniques n'est plus un site de forme (#2972).
 */
describe('signature projetée : une réf `{ id }` imbriquée qui résout reste une clé de la signature', () => {
  const expositionDeSonde: Exposition = { codex: { keys: ['sondes'] }, edit: { dataset: 'sonde.json' } };
  const alpha = document('alpha', 'entite', {}, {}, expositionDeSonde);
  const x = document(
    'x',
    'config',
    { a: z.array(z.unknown()), b: z.array(z.unknown()), c: z.array(z.unknown()) },
    { a: { label: 'A' }, b: { label: 'B' }, c: { label: 'C' } },
    expositionDeSonde,
  );
  const DEFS_FIXTURE: SchemaDef[] = [
    { file: 'alpha.json', root: 'src/data', famille: 'entite', schema: alpha.schema },
    { file: 'x.json', root: 'src/data', famille: 'config', schema: x.schema },
  ];
  const dossier = mkdtempSync(join(tmpdir(), 'structures-signature-'));
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));
  mkdirSync(join(dossier, 'src/data'), { recursive: true });
  mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
  cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
  writeFileSync(join(dossier, 'src/data/alpha.json'), JSON.stringify([{ id: 'espece-un', maison: 'sonde' }, { id: 'tenue-un', maison: 'sonde' }]));
  const deuxScalaires = { species: 'espece-un', tenue: 'tenue-un' };
  writeFileSync(
    join(dossier, 'src/data/x.json'),
    JSON.stringify({
      id: 'x',
      maison: 'sonde',
      a: [deuxScalaires],
      b: [deuxScalaires, { species: 'espece-un', tenue: { id: 'tenue-un' } }],
      c: [{ species: { id: 'espece-un' }, tenue: { id: 'tenue-un' } }],
    }),
  );
  const fixture = scannerDonnees(dossier, DEFS_FIXTURE);
  const sitesDe = (champ: string) =>
    fixture.formes.filter((f) => f.dataset === 'x.json' && f.champ === champ).map((f) => `${f.signature} | ${f.occurrences}`);

  it('deux scalaires qui résolvent : signature `species,tenue`', () => {
    expect(sitesDe('a')).toEqual(['species,tenue | 1']);
  });

  it('une des deux clés migrée en `{ id }` : même signature, donc même site que le tout-scalaire', () => {
    expect(sitesDe('b'), 'la clé `tenue: { id }` est repliée en `+…` : la migration d’une clé change l’identité du site.').toEqual([
      'species,tenue | 2',
    ]);
  });

  it('toutes les réfs canoniques : le porteur n’est plus une référence, il se classe comme tout objet (ici hors strate)', () => {
    expect(sitesDe('c')).toEqual([]);
    expect(fixture.orphelines.filter((o) => o.dataset === 'x.json' && o.champ === 'c')).toEqual([]);
    expect(
      fixture.invisibles.filter((i) => i.dataset === 'x.json' && i.champ === 'c').map((i) => `${i.signature} | ${i.occurrences}`),
      'un porteur de réfs canoniques garde sa structure propre : le scan ne s’aveugle pas sur lui.',
    ).toEqual(['species,tenue | 1']);
  });
});

/**
 * LES TROIS CONTREFACTUELS DE REDÉCLARATION — une copie `avant`, trois verdicts (#1654,
 * #1463 L-gram-3).
 *
 * Ce qui se BATCHE : la racine `avant` est la même copie des defs + de la grammaire pour les trois,
 * scannée une fois. Ce qui reste TROIS contrats : les `apres` sont des mutations DISTINCTES (une def
 * de sonde injectée ; `avail` re-tapé ; `price` re-tapé), chacune sur SA racine — `avant` reste
 * intacte —, et chaque `it` lit SON verdict. Le scan tourne dans le processus de la suite : il ne
 * tient aucun état entre deux racines (`structures-scan.mts`, `sourceDe`).
 */
type VerdictRedecl = {
  avant: number; apres: number; litterauxAvant: number; litterauxApres: number; nees: string[]; perdues: string[];
};

/** Le littéral INJECTÉ : une re-déclaration des deux bornes, que `plageSchema` possède déjà. */
const SONDE_DEF = [
  "import { z } from 'zod';",
  'export const sondeMutationSchema = z.strictObject({ min: z.number(), max: z.number() });',
].join('\n');

/** Le littéral à quatre saisons, tel que les deux defs l'écrivaient avant `parSaison`. */
const SAISONS = (valeur: string) =>
  `z.strictObject({ printemps: ${valeur}, ete: ${valeur}, automne: ${valeur}, hiver: ${valeur} })`;

/** Une contrefaçon RE-TAPÉE dans les deux defs de commerce d'une racine (`defs` = son dossier). */
const reTape = (remplace: (source: string) => string) => (defs: string) => {
  for (const def of ['sea-cargo.ts', 'land-cargo.ts']) {
    const chemin = join(defs, def);
    writeFileSync(chemin, remplace(readFileSync(chemin, 'utf8')), 'utf8');
  }
};

/** Les trois mutations, chacune posée sur SA racine `apres`. La clé nomme le verdict. */
const MUTATIONS: Record<string, (defs: string) => void> = {
  sonde: (defs) => writeFileSync(join(defs, 'sonde-mutation.ts'), SONDE_DEF, 'utf8'),
  cfAvail: reTape((source) => source.replace('avail: dispoSaisonniereSchema,', `avail: ${SAISONS('plageSchema')},`)),
  cfPrix: reTape((source) =>
    source.replace(
      'price: z.union([prixSaisonnierSchema, prixTireSchema]),',
      `price: z.union([${SAISONS('z.number()')}, z.strictObject({ dice: diceSpecSchema })]),`,
    ),
  ),
};

/** Clé d'une redéclaration : ce que la comparaison `avant`/`apres` tient pour identique. */
const cleRedecl = (r: Redeclaration) =>
  `${r.def} | ${r.champ || '(racine)'} | ${r.signature} | ${r.concept} | ${r.statut} | ${r.commun}`;

/** Les verdicts des trois mutations, mesurés au premier appel sur des copies retirées aussitôt. */
const verdictsRedecl = detenteur((): Record<string, VerdictRedecl> => {
  const dossier = mkdtempSync(join(tmpdir(), 'structures-redecl-'));
  try {
    for (const racine of ['avant', ...Object.keys(MUTATIONS)]) {
      for (const sous of ['defs', 'grammaire']) {
        cpSync(join(ROOT, 'src/data/schemas', sous), join(dossier, racine, 'src/data/schemas', sous), { recursive: true });
      }
    }
    for (const [cle, muter] of Object.entries(MUTATIONS)) muter(join(dossier, cle, 'src/data/schemas/defs'));
    const avant = scannerRedeclarations(join(dossier, 'avant'));
    const clesAvant = avant.redeclarations.map(cleRedecl);
    return tableTotale(Object.keys(MUTATIONS), (cle) => {
      const apres = scannerRedeclarations(join(dossier, cle));
      const clesApres = apres.redeclarations.map(cleRedecl);
      return {
        avant: avant.redeclarations.length,
        apres: apres.redeclarations.length,
        litterauxAvant: avant.totalLitteraux,
        litterauxApres: apres.totalLitteraux,
        nees: clesApres.filter((k) => !clesAvant.includes(k)).sort(),
        perdues: clesAvant.filter((k) => !clesApres.includes(k)).sort(),
      };
    });
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

/** Le verdict d'UNE mutation. */
const verdictRedecl = (nom: string): VerdictRedecl => verdictsRedecl()[nom]!;

/**
 * CONTRÔLE POSITIF du scan AST des redéclarations (#1654) — le détecteur MORD.
 *
 * Le stock `STRUCTURES_REDECLARATIONS` est un dénominateur DÉCROISSANT : à zéro, plus rien ne
 * distinguerait « aucune redéclaration » de « le scanner ne voit plus rien ». Cette sonde INJECTE une
 * redéclaration dans une COPIE de `src/data/schemas/` et exige que le compte passe N → N+1 avec une
 * ligne NOMINATIVE.
 */
describe('scannerRedeclarations — contrôle POSITIF du détecteur (#1654)', () => {
  it('une redéclaration INJECTÉE dans une copie des defs est VUE — N → N+1, ligne nominative', { timeout: 120_000 }, () => {
    const diff = verdictRedecl('sonde');
    // La copie mesure le MÊME arbre que le scan du fichier : sans cet ancrage, le +1 ne prouverait rien.
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.litterauxApres - diff.litterauxAvant, 'le littéral injecté n’a pas été LU par le scan.').toBe(1);
    expect(diff.apres - diff.avant, 'la redéclaration injectée n’est pas COMPTÉE : le détecteur ne mord plus.').toBe(1);
    expect(diff.nees, 'la ligne née n’est pas celle de la sonde, nominative.').toEqual([
      'sonde-mutation.ts | (racine) | max,min | plage | cible | plageSchema',
    ]);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la mutation n’est pas isolée.').toEqual([]);
  });
});


/**
 * CONTREFACTUEL du lot #1463 L-gram-3 — `parSaison` n'est pas un contournement de mesure.
 *
 * La décrue d'un stock de redéclarations est toujours suspecte : un nœud de grammaire inventé pour
 * UN porteur ferait DISPARAÎTRE la ligne sans que la structure change (le scan ne résout ni une
 * fabrique ni un spread). Ici c'est l'INVERSE qu'on prouve : si les deux defs de commerce RE-TAPAIENT
 * ce que la grammaire déclare — la colonne à quatre saisons (CF1) ou l'union de prix (CF2) —, le
 * scanner le VERRAIT, nominativement. Le lot a donc rendu 3 lignes parce que les littéraux ont
 * disparu, pas parce que la mesure s'est éteinte.
 */
describe('scannerRedeclarations — CONTREFACTUEL `parSaison` / `prix` (#1463 L-gram-3)', () => {
  it('CF1 — `avail` re-tapé à la place de `parSaison` : DEUX lignes naissent, nominatives', () => {
    const diff = verdictRedecl('cfAvail');
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la contrefaçon n’est pas isolée.').toEqual([]);
    expect(diff.nees, 'un `avail` re-tapé n’est PAS vu : `parSaison` masquerait la mesure au lieu de la solder.').toEqual([
      'land-cargo.ts | avail | automne,ete,hiver,printemps |  | hors lexique | parSaison',
      'sea-cargo.ts | avail | automne,ete,hiver,printemps |  | hors lexique | parSaison',
    ]);
  });

  it('CF2 — l’union de `price` re-tapée à la place des deux nœuds de grammaire : les lignes du concept `prix` renaissent', () => {
    const diff = verdictRedecl('cfPrix');
    expect(diff.avant, 'la copie NON MUTÉE ne mesure pas le même arbre que `scannerRedeclarations(ROOT)`.').toBe(redeclarations.length);
    expect(diff.perdues, 'la copie a PERDU des redéclarations : la contrefaçon n’est pas isolée.').toEqual([]);
    expect(diff.nees, 'un `price` re-tapé n’est PAS vu : les deux nœuds `prix` masqueraient la mesure.').toEqual([
      'land-cargo.ts | price | automne,ete,hiver,printemps | prix | declaree | parSaison',
      'land-cargo.ts | price | dice | prix | declaree | prixTireSchema',
      'sea-cargo.ts | price | automne,ete,hiver,printemps | prix | declaree | parSaison',
      'sea-cargo.ts | price | dice | prix | declaree | prixTireSchema',
    ]);
  });
});
