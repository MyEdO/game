import { describe, expect, it } from 'vitest';
import { rendreCible } from '../../scripts/docs/build-all.mjs';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  champsJoints,
  champsSansSlot,
  couplesDeReference,
  occurrencesTouchees,
  registreDesSlots,
  slotsDuParse,
  type Slot,
} from '../../scripts/docs/lib/slots-registre.mjs';
import { scanDuCorpus, scannerDonnees } from '../../scripts/docs/lib/structures-scan.mjs';
import { ANGLES_MORTS_SLOTS, MANDAT_SLOTS } from '../../scripts/docs/lib/structures-lexique.mjs';

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
    fichier: 'scripts/guards/lib/inventaireDeDette.mts',
    decroissant: false,
    raison:
      'La dette d’ADOPTION du registre est INVENTORIÉE (`SLOTS_SANS_DECLARATION`), hors de la porte et sans stock (#3021) : ' +
      'elle se solde en faisant ADOPTER la fabrique de référence par le schéma du champ (L2/L3, #1473).',
  },
  ticket: '#1466',
} as const;

/** `docs/structures-donnees.md` tel que son générateur le rend (`rendreCible`), jamais le fichier du disque. */
const DOC_STRUCTURES = await rendreCible('docs/structures-donnees.md');
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** La composition defs → familles/enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`) : la
 *  MÊME que lisent `structures-contrat.test.ts`, `build-structures.mts` et `inventaireDeDette.mts`. */
const { defs: DEFS, scan } = scanDuCorpus(ROOT);
const SLOTS = slotsDuParse(scan, DEFS);
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
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/inventaireDeDette.mts', decroissant: false });
    expect(GARDE.ticket).toBe('#1466');
  });

  it('le doc ÉMET le MANDAT et les ANGLES MORTS de leur source unique, le lexique', () => {
    const doc = DOC_STRUCTURES;
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !doc.includes(a)),
      'le §6.3 de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS_SLOTS`.',
    ).toEqual([]);
    expect(doc.includes(MANDAT_SLOTS), 'le MANDAT du volet n’est plus émis au §6 du doc.').toBe(true);
  });

  it('la JOINTURE déclaré × observé est NON VIDE (sans elle, ce volet serait un no-op à faux vert)', () => {
    expect(
      champsJoints(scan, SLOTS).length,
      'aucun couple porteur de références OBSERVÉES n’est atteint par un slot DÉCLARÉ — la jointure par occurrence est cassée, et tout le volet rendrait vert sans rien mesurer.',
    ).toBeGreaterThan(0);
    expect(SLOTS.length, 'aucun slot : le parse de mesure ne rend aucun repère.').toBeGreaterThan(0);
  });

  it('l’unité de la jointure est celle des FORMES : la strate `Référence` compte chaque occurrence inscrite, un couple ses occurrences à CASE, et une case porte une chaîne', () => {
    const cle = (o: { dataset: string; champ: string }) => `${o.dataset} | ${o.champ}`;
    const parFormes = new Map<string, number>();
    for (const f of scan.formes) if (f.strate === 'Référence') parFormes.set(cle(f), (parFormes.get(cle(f)) ?? 0) + f.occurrences);
    const avecCase = new Set([...scan.referencesParPorteur.values()].flatMap((cases) => [...cases.values()]));
    const compter = (garde: (o: (typeof scan.occurrencesDeReference)[number]) => boolean) => {
      const n = new Map<string, number>();
      for (const o of scan.occurrencesDeReference) if (garde(o)) n.set(cle(o), (n.get(cle(o)) ?? 0) + 1);
      return n;
    };
    expect(compter(() => true), 'une branche de classement de la strate `Référence` compte sans inscrire son occurrence (`inscrireReference`).').toEqual(parFormes);
    expect(new Map(couplesDeReference(scan, SLOTS).map((c) => [cle(c), c.occurrences])), 'un couple compte une occurrence sans case.').toEqual(compter((o) => avecCase.has(o)));
    expect(
      [...scan.referencesParPorteur].flatMap(([porteur, cases]) => [...cases.keys()].filter((k) => typeof (porteur as Record<string | number, unknown>)[k] !== 'string')),
      'une case qui ne porte pas de chaîne : aucun slot ne peut la valider.',
    ).toEqual([]);
  });

  it('une occurrence n’est ATTEINTE que si TOUTES ses cases le sont (`miscast.json › ops` : `unlessCondition` touché, `id` sans slot)', () => {
    const touchees = occurrencesTouchees(scan, slotsAuPath('miscast.json', '[].entries[].test.onFailHard.ops[].unlessCondition'));
    expect([...touchees].some((o) => o.dataset === 'miscast.json' && o.champ === 'ops'), 'le témoin a disparu : aucune op de `miscast.json` n’a sa case `unlessCondition` touchée.').toBe(true);
    const temoins = new Set([...touchees].filter((o) => o.dataset === 'miscast.json' && o.champ === 'ops'));
    const cases = [...scan.referencesParPorteur].flatMap(([porteur, cs]) => [...cs].filter(([, o]) => temoins.has(o)).map(([cle]) => ({ porteur, cle })));
    const manquantes = cases.filter((c) => !SLOTS.some((s) => s.porteur === c.porteur && s.cle === c.cle));
    expect(manquantes.map((c) => c.cle), 'le témoin n’a plus de case sans slot : il ne prouve plus la règle « toutes les cases ».').toContain('id');
    const atteintes = (slots: readonly Slot[]) => couplesDeReference(scan, slots).find((c) => c.dataset === 'miscast.json' && c.champ === 'ops')!.atteintes;
    const completes = [...SLOTS, ...manquantes.map((c) => ({ ...SLOTS[0], ...c }))];
    expect(atteintes(completes) - atteintes(SLOTS), 'chaque témoin, une case sans slot, ne doit compter ATTEINT qu’une fois TOUTES ses cases slots.').toBe(temoins.size);
  });

  it('branche OBJET qui résout (`creatures.json › [].skills[].id`) : toutes les occurrences atteintes, au champ porteur', () => {
    expect([...occurrencesTouchees(scan, slotsAuPath('creatures.json', '[].skills[].id'))].every((o) => o.champ === 'skills')).toBe(true);
    const c = couple('creatures.json', 'skills')!;
    expect(c.occurrences).toBeGreaterThan(0);
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('branche CHAMP SCALAIRE d’un document (`buildings.json › [].roofMaterial`) : jointe, au champ de la clé', () => {
    expect(couplesTouches(slotsAuPath('buildings.json', '[].roofMaterial'))).toEqual(['buildings.json | roofMaterial']);
    const c = couple('buildings.json', 'roofMaterial')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('branche LISTE d’ids nus (`arene-projet.json › tiles`) : chaque liste est UNE occurrence, atteinte par ses éléments', () => {
    expect(couplesTouches(slotsAuPath('arene-projet.json', 'scenes[].layers[].tiles[]'))).toContain('arene-projet.json | tiles');
    const c = couple('arene-projet.json', 'tiles')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('cas canonique `merchants.json › [].curated[]` : chaque occurrence atteinte, chaque valeur un slot de trapping', () => {
    const curated = slotsAuPath('merchants.json', '[].curated[]');
    expect(curated.length).toBeGreaterThan(0);
    expect(curated.every((s) => s.type === 'trapping')).toBe(true);
    expect(couplesTouches(curated)).toEqual(['merchants.json | curated']);
    const c = couple('merchants.json', 'curated')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('un couple ATTEINT EN PARTIE reste à la couverture, à son compte OBSERVÉ total', () => {
    const c = couple('arene-projet.json', 'ref')!;
    expect(c.atteintes).toBeGreaterThan(0);
    expect(c.atteintes).toBeLessThan(c.occurrences);
    expect(champsSansSlot(scan, SLOTS)).toContainEqual(c);
  });

  it('RÉCURSION : un `test.skill` sous un flux de dialogue est un slot (`loup-et-saumure-projet.json › skill`, joint)', () => {
    expect(couplesTouches(slotsAuPath('loup-et-saumure-projet.json', 'scenes[].dialogues[].nodes[].choices[].flow.steps[].effect.skill.id'))).toEqual([
      'loup-et-saumure-projet.json | skill',
    ]);
    const c = couple('loup-et-saumure-projet.json', 'skill')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('PAYLOAD D’OP : une référence validée par le `superRefine` de `gameOpSchema` est un slot (`tables.json › of`, joint)', () => {
    expect(new Set(slotsAuPath('tables.json', '[].rows[].ops[].montant.brass.times.of.rule').map((s) => s.type))).toEqual(new Set(['regleOptionnelle']));
    const c = couple('tables.json', 'of')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('RÉF DE DÉCOR : la branche `prop` de `sceneEntitySchema` porte `idDe(\'prop\')` (`diligence-projet.json › ref`, joint)', () => {
    expect(new Set(slotsAuPath('diligence-projet.json', 'scenes[].entities[].ref').map((s) => s.type))).toEqual(new Set(['prop']));
    const c = couple('diligence-projet.json', 'ref')!;
    expect(c.atteintes).toBe(c.occurrences);
  });

  it('fixture : une Spécialisation homonyme d’un id n’ouvre aucune référence (`CLES_DE_SPECIALISATION`, #1904)', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'slots-spec-'));
    try {
      mkdirSync(join(dossier, 'src/data'), { recursive: true });
      mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
      cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
      writeFileSync(join(dossier, 'src/data/skills.json'), JSON.stringify([{ id: 'savoir', label: 'Savoir' }, { id: 'art', label: 'Art' }]));
      writeFileSync(join(dossier, 'src/data/marins.json'), JSON.stringify([{ id: 'm1', skills: [{ id: 'savoir', spec: 'art' }] }, { id: 'm2', skills: [{ skillId: 'art' }] }]));
      const fixture = scannerDonnees(dossier, []);
      expect(couplesDeReference(fixture, []).filter((c) => c.dataset === 'marins.json'), 'le témoin `skillId` se compte, la Spécialisation `art` non.').toEqual([{ dataset: 'marins.json', champ: 'skills', occurrences: 1, atteintes: 0 }]);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it('fixture : ENTRÉE DE RACINE `(racine)` jointe, et une référence portée par une CLÉ de record rend « — » au doc', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'slots-racine-'));
    try {
      mkdirSync(join(dossier, 'src/data'), { recursive: true });
      mkdirSync(join(dossier, 'src/scenes'), { recursive: true });
      cpSync(join(ROOT, 'src/data/schemas/grammaire'), join(dossier, 'src/data/schemas/grammaire'), { recursive: true });
      writeFileSync(join(dossier, 'src/data/skills.json'), JSON.stringify([{ id: 'alpha', label: 'Alpha' }, { id: 'beta', label: 'Beta' }]));
      writeFileSync(join(dossier, 'src/data/grille.json'), JSON.stringify([[{ skillId: 'alpha' }, { skillId: 'beta' }], [{ skillId: 'beta' }]]));
      const fixture = scannerDonnees(dossier, []);
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
    const cles = registreDesSlots(scan, SLOTS).filter((l) => l.path.endsWith('{}'));
    expect(cles.length, 'aucun slot porté par une clé de record : le témoin ne dirait rien.').toBeGreaterThan(0);
    for (const l of cles) {
      expect(l.couples, `${l.dataset} › ${l.path} : une clé de record n’est jamais une case du scan.`).toEqual([]);
      expect(DOC_STRUCTURES).toContain(`| \`${l.dataset}\` | \`${l.path}\` | \`${l.type}\` | ${l.valeurs} | — |`);
    }
  });

  it('le volet est ÉMIS dans `docs/structures-donnees.md` (le doc et la garde lisent la MÊME mesure)', () => {
    const doc = DOC_STRUCTURES;
    expect(doc, 'le §6 du doc a disparu : le volet SLOTS n’aurait plus de face lisible.').toContain(
      '## 6. Slots DÉCLARÉS × réfs OBSERVÉES',
    );
    expect(doc).toContain(`**${champsSansSlot(scan, SLOTS).length}** couples (dataset, champ) sans slot déclaré.`);
    expect(doc).toContain(`Slots déclarés : **${SLOTS.length}**`);
  });
});
