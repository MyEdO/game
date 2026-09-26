import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  champsJoints,
  champsSansSlot,
  couplesDeReference,
  occurrencesInatteignables,
  occurrencesTouchees,
  registreDesSlots,
  slotsDuParse,
  type Slot,
} from '../../scripts/docs/lib/slots-registre.mjs';
import { scanDuCorpus, scannerDonnees } from '../../scripts/docs/lib/structures-scan.mjs';
import { ANGLES_MORTS_SLOTS, MANDAT_SLOTS } from '../../scripts/docs/lib/structures-lexique.mjs';
import { SLOTS_INATTEIGNABLES, SLOTS_SANS_DECLARATION } from '../../scripts/guards/lib/slotsStock.mjs';
import { champsAveugles, ecartsDeStock, lignesMalQualifiees } from '../../scripts/guards/lib/stock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — quelles cases des documents des DEUX racines le PARSE valide-t-il par `idDe` (les slots), à quel path ? ' +
    'B — quels couples observés ces slots ATTEIGNENT-ils, par occurrence ? ' +
    'C — quels couples portent des références OBSERVÉES dont une occurrence au moins n’est pas ATTEINTE (la dette d’adoption) ?',
  primitive:
    '`reperesDuParse` (`src/data/schemas/grammaire/ref.ts`) pour le DÉCLARÉ, `scannerDonnees` ' +
    '(`scripts/docs/lib/structures-scan.mts`) pour l’OBSERVÉ, joints par OCCURRENCE par `scripts/docs/lib/slots-registre.mts`.',
  /** Le MANDAT ne se reformule pas : il se LIT à sa source unique. */
  mandat: MANDAT_SLOTS,
  perimetre:
    'Les documents authorés des deux racines `src/data` et `src/scenes` et leurs schémas zod des registres ' +
    '`SCHEMA_DEFS` / `SCHEMA_DEFS_SCENES`, joints par BASENAME (`nomDeDocument`).',
  angleMort: ANGLES_MORTS_SLOTS,
  baseline: {
    fichier: 'scripts/guards/lib/slotsStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST la dette d’ADOPTION du registre : une ligne se solde en faisant ADOPTER la fabrique de ' +
      'référence par le schéma du champ (L2/L3, #1473), et part dans le MÊME commit que l’adoption.',
  },
  ticket: '#1466',
} as const;

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** La composition defs → familles/enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`) : la
 *  MÊME que lisent `structures-contrat.test.ts`, `build-structures.mts` et `horsStrateAudit.ts`. */
const { defs: DEFS, scan } = scanDuCorpus(ROOT);
const SLOTS = slotsDuParse(scan, DEFS);

/** Clé de la dette d'ADOPTION : le couple (dataset, champ) ET son compte d'occurrences — une
 *  occurrence de plus est une entrée neuve, pas une ligne qui bouge. */
const CLE_DETTE = (c: { dataset: string; champ: string; occurrences: number }) =>
  `${c.dataset} | ${c.champ} | ${c.occurrences}`;

/** Plafond du cliquet de `SLOTS_SANS_DECLARATION` — #1473. */
const DETTE_ADOPTION_MAX = 269;

/** Plafond du cliquet de `SLOTS_INATTEIGNABLES` — #1473. */
const INATTEIGNABLES_MAX = 4;

/** Couples ENTIÈREMENT joints qui doivent le rester. */
const JOINTURES_PLANCHER = [
  'activities.json | factor',
  'arene-projet.json | material',
  'arene-projet.json | tiles',
  'barge-du-sel-projet.json | tiles',
  'buildings.json | roofMaterial',
  'defauts-de-compilation.json | cheminDeRonde',
  'defauts-de-compilation.json | masse',
  'defauts-de-compilation.json | pont',
  'diligence-projet.json | ref',
  'diligence-projet.json | style',
  'diligence-projet.json | tiles',
  'loup-et-saumure-projet.json | skill',
  'loup-et-saumure-projet.json | tiles',
  'maladies.json | ops',
  'maladies.json | otherwise',
  'maneuvers.json | skill',
  'merchants.json | curated',
  'qualities.json | skill',
  'river-criticals.json | stations',
  'semences-de-scene.json | terrain',
  'ship-criticals.json | stations',
  'tables.json | of',
  'terrains.json | matiere',
  'terrains.json | overlayProp',
];

const couple = (dataset: string, champ: string) => couplesDeReference(scan, SLOTS).find((c) => c.dataset === dataset && c.champ === champ);
const slotsAuPath = (dataset: string, path: string) => SLOTS.filter((s) => s.dataset === dataset && s.path === path);
const couplesTouches = (slots: readonly Slot[]) => [...new Set([...occurrencesTouchees(scan, slots)].map((o) => `${o.dataset} | ${o.champ}`))].sort();

describe('registre des SLOTS — déclaré × observé (#1466 L1a, volet A)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('reperesDuParse');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS_SLOTS`), jamais recopiés.').toBe(ANGLES_MORTS_SLOTS);
    expect(
      GARDE.angleMort.length,
      'deux angles morts déclarés au 2026-09-23 (#1473 R1) : occurrence sans case qui porte une chaîne, référence portée par une clé de record.',
    ).toBeGreaterThanOrEqual(2);
    expect(GARDE.mandat, 'le mandat se lit dans UNE source (`MANDAT_SLOTS`), jamais reformulé.').toBe(MANDAT_SLOTS);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/slotsStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1466');
  });

  it('le doc ÉMET le MANDAT et les ANGLES MORTS de leur source unique, le lexique', () => {
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !doc.includes(a)),
      'le §6.3 de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS_SLOTS`.',
    ).toEqual([]);
    expect(doc.includes(MANDAT_SLOTS), 'le MANDAT du volet n’est plus émis au §6 du doc.').toBe(true);
  });

  it('la JOINTURE déclaré × observé est NON VIDE (sans elle, ce volet serait un no-op à faux vert)', () => {
    expect(
      champsJoints(scan, SLOTS),
      'aucun couple porteur de références OBSERVÉES n’est atteint par un slot DÉCLARÉ — la jointure par occurrence est cassée, et tout le volet rendrait vert sans rien mesurer.',
    ).toContain('merchants.json | curated');
    expect(SLOTS.length, 'aucun slot : le parse de mesure ne rend aucun repère.').toBeGreaterThan(0);
  });

  it('l’unité de la jointure est celle des FORMES : chaque couple compte autant d’occurrences que la strate `Référence` du scan', () => {
    const parFormes = new Map<string, number>();
    for (const f of scan.formes)
      if (f.strate === 'Référence') parFormes.set(`${f.dataset} | ${f.champ}`, (parFormes.get(`${f.dataset} | ${f.champ}`) ?? 0) + f.occurrences);
    const parCouples = new Map(couplesDeReference(scan, SLOTS).map((c) => [`${c.dataset} | ${c.champ}`, c.occurrences]));
    expect(parCouples, 'une branche de classement de la strate `Référence` compte sans inscrire son occurrence (`inscrireReference`).').toEqual(parFormes);
  });

  it('les couples de `JOINTURES_PLANCHER` sont tous joints', () => {
    const joints = champsJoints(scan, SLOTS);
    expect(JOINTURES_PLANCHER.filter((k) => !joints.includes(k)), 'jointure perdue.').toEqual([]);
  });

  it('une occurrence n’est ATTEINTE que si TOUTES ses cases le sont (`miscast.json › ops` : `unlessCondition` touché, `id` sans slot)', () => {
    const touchees = occurrencesTouchees(scan, slotsAuPath('miscast.json', '[].entries[].test.onFailHard.ops[].unlessCondition'));
    expect([...touchees].some((o) => o.dataset === 'miscast.json' && o.champ === 'ops'), 'le témoin a disparu : aucune op de `miscast.json` n’a sa case `unlessCondition` touchée.').toBe(true);
    expect(couple('miscast.json', 'ops')).toMatchObject({ occurrences: 39, atteintes: 0 });
  });

  it('branche OBJET qui résout (`creatures.json › [].skills[].id`) : toutes les occurrences atteintes, au champ porteur', () => {
    expect([...occurrencesTouchees(scan, slotsAuPath('creatures.json', '[].skills[].id'))].every((o) => o.champ === 'skills')).toBe(true);
    const c = couple('creatures.json', 'skills')!;
    expect(c.occurrences).toBeGreaterThan(0);
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('branche CHAMP SCALAIRE d’un document (`buildings.json › [].roofMaterial`) : jointe, au champ de la clé', () => {
    expect(couplesTouches(slotsAuPath('buildings.json', '[].roofMaterial'))).toEqual(['buildings.json | roofMaterial']);
    expect(couple('buildings.json', 'roofMaterial')).toMatchObject({ occurrences: 7, atteintes: 7 });
  });

  it('branche LISTE d’ids nus (`arene-projet.json › tiles`) : chaque liste est UNE occurrence, atteinte par ses éléments', () => {
    expect(couplesTouches(slotsAuPath('arene-projet.json', 'scenes[].layers[].tiles[]'))).toContain('arene-projet.json | tiles');
    const c = couple('arene-projet.json', 'tiles')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('cas canonique `merchants.json › [].curated[]` : 3 occurrences sur 3 atteintes, 19 valeurs', () => {
    const curated = slotsAuPath('merchants.json', '[].curated[]');
    expect(curated).toHaveLength(19);
    expect(curated.every((s) => s.type === 'trapping')).toBe(true);
    expect(couplesTouches(curated)).toEqual(['merchants.json | curated']);
    expect(couple('merchants.json', 'curated')).toMatchObject({ occurrences: 3, atteintes: 3 });
  });

  it('un couple ATTEINT EN PARTIE reste au stock à son compte OBSERVÉ total', () => {
    const c = couple('arene-projet.json', 'ref')!;
    expect(c.atteintes).toBeGreaterThan(0);
    expect(c.atteintes).toBeLessThan(c.occurrences);
    expect(SLOTS_SANS_DECLARATION.find((l) => l.dataset === 'arene-projet.json' && l.champ === 'ref')?.occurrences).toBe(c.occurrences);
  });

  it('RÉCURSION : un `test.skill` sous un flux de dialogue est un slot (`loup-et-saumure-projet.json › skill`, joint)', () => {
    expect(couplesTouches(slotsAuPath('loup-et-saumure-projet.json', 'scenes[].dialogues[].nodes[].choices[].flow.steps[].effect.skill.id'))).toEqual([
      'loup-et-saumure-projet.json | skill',
    ]);
    expect(couple('loup-et-saumure-projet.json', 'skill')).toMatchObject({ occurrences: 3, atteintes: 3 });
  });

  it('PAYLOAD D’OP : une référence validée par le `superRefine` de `gameOpSchema` est un slot (`tables.json › of`, joint)', () => {
    expect(slotsAuPath('tables.json', '[].rows[].ops[].montant.brass.times.of.rule').map((s) => s.type)).toEqual(['regleOptionnelle']);
    expect(couple('tables.json', 'of')).toMatchObject({ occurrences: 1, atteintes: 1 });
  });

  it('RÉF DE DÉCOR : la branche `prop` de `sceneEntitySchema` porte `idDe(\'prop\')` (`diligence-projet.json › ref`, joint)', () => {
    expect(new Set(slotsAuPath('diligence-projet.json', 'scenes[].entities[].ref').map((s) => s.type))).toEqual(new Set(['prop']));
    expect(couple('diligence-projet.json', 'ref')).toMatchObject({ occurrences: 20, atteintes: 20 });
  });

  it('fixture : ENTRÉE DE RACINE `(racine)` jointe, et une référence portée par une CLÉ de record rend « — » au doc', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'slots-racine-'));
    try {
      mkdirSync(join(dossier, 'src/data'), { recursive: true });
      mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
      cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
      writeFileSync(join(dossier, 'src/data/skills.json'), JSON.stringify([{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }]));
      writeFileSync(join(dossier, 'src/data/grille.json'), JSON.stringify([[{ skillId: 'alpha' }, { skillId: 'beta' }], [{ skillId: 'beta' }]]));
      const fixture = scannerDonnees(dossier);
      const grille = fixture.brutParNom.get('grille.json') as { skillId: string }[][];
      const slots: Slot[] = grille.flat().map((porteur) => ({
        dataset: 'grille.json',
        path: '[][].skillId',
        type: 'skill',
        porteur,
        cle: 'skillId',
        parCle: false,
      }));
      expect(couplesDeReference(fixture, slots)).toEqual([{ dataset: 'grille.json', champ: '(racine)', occurrences: 3, atteintes: 3 }]);
      expect(champsJoints(fixture, slots)).toEqual(['grille.json | (racine)']);
      expect(champsJoints(fixture, slots.slice(1)), 'une case sans slot : l’occurrence n’est pas atteinte.').toEqual([]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
    const cles = registreDesSlots(scan, SLOTS).filter((l) => l.path === 'tablesDeChute[].bandes[].hauteurs{}');
    expect(cles).toEqual([{ dataset: 'ship-criticals.json', path: 'tablesDeChute[].bandes[].hauteurs{}', type: 'shipStation', valeurs: 6, couples: [] }]);
    expect(readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8')).toContain(
      '| `ship-criticals.json` | `tablesDeChute[].bandes[].hauteurs{}` | `shipStation` | 6 | — |',
    );
  });

  it('COUVERTURE : les champs porteurs de réfs OBSERVÉES sans slot déclaré == stock, et ne CROISSENT pas', () => {
    const ecarts = ecartsDeStock({ observe: champsSansSlot(scan, SLOTS), stock: SLOTS_SANS_DECLARATION, cle: CLE_DETTE });
    expect(
      ecarts.neuves,
      'champ(s) en trop côté OBSERVÉ : une référence neuve qui n’a pas adopté la fabrique — elle s’adopte, elle ne s’inscrit pas au stock.',
    ).toEqual([]);
    expect(
      ecarts.perimees,
      'champ(s) en trop côté STOCK : entrée périmée — elle se retire dans le commit de l’adoption.',
    ).toEqual([]);
    expect(
      ecarts.taille,
      'clé(s) DUPLIQUÉE(S) au stock : la comparaison travaille sur des clés DISTINCTES, un doublon inscrit y passerait invisible.',
    ).toBe(SLOTS_SANS_DECLARATION.length);
    expect(ecarts.taille, 'la dette d’adoption du registre des slots a GONFLÉ.').toBeLessThanOrEqual(DETTE_ADOPTION_MAX);
  });

  it('INATTEIGNABLES : les occurrences sans case qui porte une chaîne == stock, et ne CROISSENT pas', () => {
    const ecarts = ecartsDeStock({ observe: occurrencesInatteignables(scan), stock: SLOTS_INATTEIGNABLES, cle: CLE_DETTE });
    expect(ecarts.neuves, 'occurrence(s) INATTEIGNABLE(S) neuve(s) : sa référence se pose en chaîne, elle ne s’inscrit pas au stock.').toEqual([]);
    expect(ecarts.perimees, 'entrée périmée de `SLOTS_INATTEIGNABLES` : elle se retire dans le commit qui rend la case atteignable.').toEqual([]);
    expect(ecarts.taille, 'clé(s) DUPLIQUÉE(S) à `SLOTS_INATTEIGNABLES`.').toBe(SLOTS_INATTEIGNABLES.length);
    expect(ecarts.taille, 'le stock des occurrences INATTEIGNABLES a GONFLÉ.').toBeLessThanOrEqual(INATTEIGNABLES_MAX);
    expect(lignesMalQualifiees(SLOTS_INATTEIGNABLES.map((c) => [`${c.dataset} | ${c.champ}`, c])), 'ligne sans lot ni date.').toEqual([]);
  });

  it('chaque ligne du stock porte sa DATE et son LOT de mort', () => {
    expect(
      lignesMalQualifiees(SLOTS_SANS_DECLARATION.map((c) => [`${c.dataset} | ${c.champ}`, c])),
      'une ligne sans lot de mort ni date est un régime, pas un cliquet.',
    ).toEqual([]);
  });

  it('MUTATION par champ : chaque champ du stock entre dans la clé comparée', () => {
    expect(
      champsAveugles(SLOTS_SANS_DECLARATION, CLE_DETTE, ['dataset', 'champ', 'occurrences']),
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte.',
    ).toEqual([]);
  });

  it('le volet est ÉMIS dans `docs/structures-donnees.md` (le doc et la garde lisent la MÊME mesure)', () => {
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(doc, 'le §6 du doc a disparu : le volet SLOTS n’aurait plus de face lisible.').toContain(
      '## 6. Slots DÉCLARÉS × réfs OBSERVÉES',
    );
    expect(doc).toContain(`**${SLOTS_SANS_DECLARATION.length}** couples (dataset, champ) sans slot déclaré.`);
    expect(doc).toContain(`Slots déclarés : **${SLOTS.length}**`);
  });
});
