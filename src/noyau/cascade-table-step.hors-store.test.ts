import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { makeRNG } from '../engine/dice';
import { startCascade, rollTableStep, runCascadeImmediate, stepInteraction, stepReady, tableStepDef, tableStepIds, tableSpec, tableStepNaturalRange, naturalRollForTableRow, type TableStepDef } from './cascade';
import { spyApplier } from './cascade.testkit';
import { STRUCTURE_CRIT_TABLE } from './combatFlow';
import { tableDesCritiquesDeStructure } from '../engine/structureCritical';
import { stripBookMarker, hasBookMarker } from '../data/bookMarker';
import { combatStakeRef, resolveStake } from '../data';
import { findTableEntry, deDeLaTableTiree } from '../engine/tables';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { intentAllowedFor } from './netOwnership';
import { setDataset, datasetArray } from '../data/overrides';
import { type MutationTable } from '../data/mutations';
import type { CascadeStep, CascadeTableDecl } from './pendings';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * ÉTAPE À TABLE (#942 L2) — le TIRAGE SUR TABLEAU est une interaction d'étape de cascade, résolue en UN
 * site (`rollTableStep` : dé, `mod` appliqué avant le lookup, `findTableEntry`, id de ligne STABLE),
 * exercée par les VRAIES coutures du noyau (`jetLancer('cascadeTirage')`/`jetValider('cascade')`/`jetLancer('cascade')`) et par
 * le pilote immédiat. La table est résolue par le registre (`tableStepDef`), peuplé par les modules de
 * domaine (le cœur générique ne nomme aucune table).
 */
describe('Étape à TABLE — le tirage sur tableau, résolu en un site', () => {
  /** Table SYNTHÉTIQUE (le générique se prouve sans domaine) : deux fourchettes, lignes dérivées de l'id. */
  const SYNTH = 'test-table-synthetique';
  const applied: { id: string; roll: number; die: number }[] = [];

  beforeEach(() => {
    applied.length = 0;
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({ tablesTirables: { ...tablesDuJeu().tablesTirables, [SYNTH]: {
      label: 'Table synthétique',
      die: deDeLaTableTiree({ die: 'd100' }),
      rows: [{ min: 1, max: 50, id: 'basse' }, { min: 51, max: 100, id: 'haute' }],
      lines: (die) => [`ligne ${die <= 50 ? 'basse' : 'haute'} (dé ${die})`, 'note de la ligne'],
    } }, appliers: { ...tablesDuJeu().appliers, tableSpy: spyApplier(applied, (step) => ({
      id: step.table!.result!.id, roll: step.table!.result!.roll, die: step.table!.result!.die,
    })) } });
  });

  const tableStep = (id: string, decl: Partial<CascadeStep['table']> = {}): CascadeStep =>
    ({ id, kind: cleDeFixture('tableSpy'), label: fixtureText('Tirage'), icon: 'navigation/des', table: { tableId: SYNTH, ...decl }});

  it("l'interaction est inférée du champ `table` : sans résultat = à tirer, avec résultat = affichage prêt", () => {
    const st = tableStep('t1');
    expect(stepInteraction(st)).toBe('table');
    expect(stepReady(st, banc.getState())).toBe(false);
    const tiree: CascadeStep = { ...st, table: { ...st.table!, result: { roll: 12, die: 12, id: 'basse', lines: ['x'] } } };
    expect(stepInteraction(tiree)).toBe('affichage');
    expect(stepReady(tiree, banc.getState())).toBe(true);
  });

  it('tirage NATUREL par les vraies coutures : le dé tombe dans SA fourchette, la ligne est affichée puis APPLIQUÉE', () => {
    banc.getState().ensemencerLeTirage(4);
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1')] });
    banc.getState().jetValider('cascade'); // pas encore tiré → no-op (la modale force d'abord le dé)
    expect(applied).toHaveLength(0);
    banc.getState().jetLancer('cascadeTirage', 't1');
    const res = banc.getState().pendingCascade!.participants[0].table!.result!;
    expect(res.roll).toBeGreaterThanOrEqual(1);
    expect(res.roll).toBeLessThanOrEqual(100);
    expect(res.die).toBe(res.roll); // aucun `mod`
    expect(res.id).toBe(res.die <= 50 ? 'basse' : 'haute'); // la fourchette qui contient le dé
    expect(res.lines[0]).toBe(`ligne ${res.id} (dé ${res.die})`);
    banc.getState().jetValider('cascade'); // valide → la conséquence lit l'id de ligne
    expect(applied).toEqual([{ id: res.id, roll: res.roll, die: res.die }]);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('dé INJECTÉ (`forcedRoll`) : la ligne correspondante, aucun dé consommé', () => {
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 97 })] });
    banc.getState().jetLancer('cascadeTirage', 't1');
    const res = banc.getState().pendingCascade!.participants[0].table!.result!;
    expect(res).toMatchObject({ roll: 97, die: 97, id: 'haute' });
  });

  it('`mod` appliqué au dé AVANT le lookup (convention `rollTable`) : 48 + 10 = 58 → la ligne haute', () => {
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 48, mod: 10 })] });
    banc.getState().jetLancer('cascadeTirage', 't1');
    const res = banc.getState().pendingCascade!.participants[0].table!.result!;
    expect(res.roll).toBe(48); // le dé NATUREL reste lisible
    expect(res.die).toBe(58); // le dé EFFECTIF a servi au lookup
    expect(res.id).toBe('haute');
    expect(res.lines[0]).toBe('ligne haute (dé 58)');
  });

  it('un dé déjà tiré ne se relance pas en douce (`jetLancer(\'cascadeTirage\')` idempotent sur l’étape résolue)', () => {
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1', { tableId: SYNTH, forcedRoll: 7 })] });
    banc.getState().jetLancer('cascadeTirage', 't1');
    banc.getState().jetLancer('cascadeTirage', 't1');
    expect(banc.getState().pendingCascade!.participants[0].table!.result).toMatchObject({ roll: 7, id: 'basse' });
  });

  it('les pilotes AUTOMATIQUES tirent la table par le même résolveur (« Tout lancer » et résolution immédiate)', () => {
    banc.getState().ensemencerLeTirage(11);
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [tableStep('t1'), tableStep('t2')] });
    banc.getState().jetLancer('cascade');
    expect(applied).toHaveLength(2);
    for (const a of applied) expect(a.id).toBe(a.die <= 50 ? 'basse' : 'haute');
    banc.getState().fenetreFermer('cascade');
    applied.length = 0;
    const out = runCascadeImmediate(banc.getState, banc.setState, [tableStep('t3', { tableId: SYNTH, forcedRoll: 51 })])!;
    expect(out[0].table!.result).toMatchObject({ roll: 51, die: 51, id: 'haute' });
    expect(applied).toEqual([{ id: 'haute', roll: 51, die: 51 }]);
  });

  it('table non déclarée : fail-fast (un `tableId` fautif ne se résout jamais en silence)', () => {
    // Le refus NOMME l'id ET ses deux causes possibles (jamais déclarée, ou table retirée de la
    // donnée — cf. le cas de reprise ci-dessous) : un `tableId` fautif ne se résout jamais en silence.
    expect(() => rollTableStep({ tableId: 'table-inexistante' }, makeRNG(1)))
      .toThrow(/« table-inexistante ».*jamais déclarée.*retirée de la donnée/);
  });

  it('dé effectif HORS PLAGE : fail-fast, jamais le repli silencieux sur la ligne extrême', () => {
    // `findTableEntry` replie sur la DERNIÈRE ligne : sans borne, un mod trop HAUT et un mod trop BAS
    // rendraient tous deux 'haute' — le pire résultat, en silence, dans les deux sens.
    expect(() => rollTableStep({ tableId: SYNTH, forcedRoll: 100, mod: 20 }, makeRNG(1)))
      .toThrow(/dé effectif 120 hors de la plage \[1, 100\].*test-table-synthetique.*naturel 100, mod 20/s);
    expect(() => rollTableStep({ tableId: SYNTH, forcedRoll: 1, mod: -20 }, makeRNG(1)))
      .toThrow(/dé effectif -19 hors de la plage \[1, 100\]/);
    // Les bornes EXACTES restent résolubles (la garde borne, elle ne rétrécit pas la table).
    expect(rollTableStep({ tableId: SYNTH, forcedRoll: 1 }, makeRNG(1)).id).toBe('basse');
    expect(rollTableStep({ tableId: SYNTH, forcedRoll: 100 }, makeRNG(1)).id).toBe('haute');
  });

  it("registre : la table de Critiques de Structure est déclarée par son module de domaine, fourchettes = la DONNÉE", () => {
    expect(tableStepDef(STRUCTURE_CRIT_TABLE)).toBeDefined();
    expect(tableStepDef(STRUCTURE_CRIT_TABLE)!.rows).toBe(tableDesCritiquesDeStructure());
    // Le résolveur GÉNÉRIQUE trouve la même ligne que le lookup partagé sur la donnée verbatim.
    for (const die of [10, 40, 85, 98, 130]) {
      expect(rollTableStep({ tableId: STRUCTURE_CRIT_TABLE, forcedRoll: die }, makeRNG(1)).id)
        .toBe(findTableEntry(tableDesCritiquesDeStructure(), die).id);
    }
  });

  it('charte UI : AUCUN libellé de table d’étape ne porte de référence de LIVRE (c’est une surface JOUEUR)', () => {
    // Le `label` d'une table enregistrée est rendu par `CascadeModal` (rangée de tirage) : il tombe donc
    // sous `docs/charte-ui.md` — « JAMAIS de référence au livre dans un texte joueur ». Les libellés
    // d'AUTHORING qui portent leur provenance (`mutationTables.json` : « Physique — Khorne (EDOC) ») se
    // PROJETTENT avant d'entrer au registre. L'invariant est écrit avec CETTE projection (`stripBookMarker`,
    // `src/data/bookMarker.ts`) — un critère maison (tokenisation, liste de sigles) divergerait d'elle.
    // Couvre TOUTES les tables déclarées (les modules de domaine sont chargés par le noyau).
    const fautifs = tableStepIds()
      .map((id) => [id, tableStepDef(id)!] as const)
      .filter(([, def]) => def.label !== stripBookMarker(def.label))
      .map(([id, def]) => `${id} : « ${def.label} » → « ${stripBookMarker(def.label)} »`);
    expect(fautifs, `Référence de livre dans un libellé de table rendu au joueur :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('la projection de la garde reconnaît les sigles NON tokenisables et épargne les sigles-décor', () => {
    // Trou d'un critère par tokens (`split`) : un sigle à ESPACE n'en est jamais un seul.
    for (const l of ['Table — Nains (ADE I)', 'Table — Ogres (ADE II)']) {
      expect(hasBookMarker(l), `provenance NON détectée : « ${l} »`).toBe(true);
    }
    // Faux positifs d'un critère par tokens : « Lustria »/« Salzemund » SONT des `abbr` de `books.json`,
    // et aussi des noms du décor — en clair dans un libellé, ce n'est pas une référence de livre.
    for (const l of ['Rencontres de Lustria', 'Ruelles de Salzemund']) {
      expect(hasBookMarker(l), `faux positif : « ${l} »`).toBe(false);
    }
  });

  it('une table RETIRÉE de la donnée : la cascade PERSISTÉE sur son id est refusée NOMMÉMENT', () => {
    // Le registre SUIT la donnée (#1692) : une table retirée de la donnée rend irrésoluble toute
    // cascade persistée qui la tirait — refus nommé sur l'id, jamais un repli sur une autre table,
    // aucune migration de sauvegarde (`.claude/memory/user-arbitrage-saves-reset-pas-migration.md`).
    const livrees = [...(datasetArray('mutationTables') as MutationTable[])];
    const retiree = livrees[0];
    expect(tableStepDef(retiree.id), 'la table doit exister AVANT le retrait').toBeDefined();
    startCascade(banc.getState, banc.setState, {
      title: 'Reprise', purpose: 'test',
      steps: [{ ...tableStep('t1'), table: { tableId: retiree.id } }],
    });
    try {
      setDataset('mutationTables', livrees.filter((t) => t.id !== retiree.id));
      expect(() => banc.getState().jetLancer('cascadeTirage', 't1'))
        .toThrowError(new RegExp(`« ${retiree.id} ».*retirée de la donnée`));
    } finally {
      setDataset('mutationTables', livrees);
    }
    expect(tableStepDef(retiree.id), 'le dataset livré est restauré').toBeDefined();
  });
});

/**
 * MODE TABLE (#942 L3) — côté ÉTAT : les deux affordances de la modale (champ « Fixer le dé », clic
 * sur une ligne) POSENT LE DÉ par UN seul délégué (`jetImposerLeResultat('cascadeTirage')`), gaté par l'option de
 * confort « Dés fixés » + le siège qui contrôle l'étape (`canFixDie`). Le dé posé est le dé NATUREL :
 * le `mod` de la déclaration s'applique APRÈS (résolveur unique) — d'où le calcul `min − mod` de la
 * ligne visée, et les lignes qu'aucun dé n'atteint sous ce `mod`.
 */
describe('MODE TABLE — poser le dé d’une étape à table (option « Dés fixés »)', () => {
  const T = 'test-table-mode';
  const applied: { id: string; roll: number; die: number }[] = [];

  /** Étape à table sur `T`, avec le `mod` voulu (le `mod` est ce qui rend le calcul du naturel visible). */
  const step = (mod?: number): CascadeStep =>
    ({ id: 'tm', kind: cleDeFixture('tableModeSpy'), label: fixtureText('Tirage'), icon: 'navigation/des', table: { tableId: T, ...(mod != null ? { mod } : {}) }});

  const open = (mod?: number) =>
    startCascade(banc.getState, banc.setState, { title: 'Tirage', purpose: 'test', steps: [step(mod)] });
  const curStep = () => banc.getState().pendingCascade!.participants[0];

  beforeEach(() => {
    applied.length = 0;
    setDesFixes(true);
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({ tablesTirables: { ...tablesDuJeu().tablesTirables, [T]: {
      label: 'Table du mode',
      die: deDeLaTableTiree({ die: 'd100' }),
      rows: [{ min: 1, max: 50, id: 'basse', label: 'Ligne basse' }, { min: 51, max: 100, id: 'haute', label: 'Ligne haute' }],
      lines: (die) => [`ligne ${die <= 50 ? 'basse' : 'haute'} (dé ${die})`],
    } }, appliers: { ...tablesDuJeu().appliers, tableModeSpy: spyApplier(applied, (s) => ({ id: s.table!.result!.id, roll: s.table!.result!.roll, die: s.table!.result!.die })) } });
  });

  it('le dé d’une LIGNE est son `min − mod` (le lookup se fait sur le dé EFFECTIF), pas sa borne brute', () => {
    const decl = { tableId: T, mod: -10 };
    // Poser la borne BRUTE (51) donnerait un dé effectif de 41 → la ligne BASSE : la ligne cliquée glisse.
    expect(naturalRollForTableRow(decl, tableStepDef(T)!.rows[1])).toBe(61);
    expect(naturalRollForTableRow(decl, tableStepDef(T)!.rows[0])).toBe(11);
    expect(naturalRollForTableRow({ tableId: T, mod: 10 }, tableStepDef(T)!.rows[1])).toBe(41);
  });

  it('le dé d’une étape à table n’a qu’UN porteur, sa table : la déclaration n’en porte aucun (#1667)', () => {
    expect(tableSpec({ tableId: T })).toBe(tableStepDef(T)!.die);
    expect(tableStepNaturalRange({ tableId: T })).toEqual({ min: 1, max: 100 });
    // @ts-expect-error — une déclaration de tirage sur table ne porte pas de dé.
    const declADe: CascadeTableDecl = { tableId: T, spec: { n: 1, sides: 10 } };
    expect(tableSpec(declADe), 'un dé glissé dans la déclaration n’est pas lu').toEqual({ n: 1, sides: 100 });
    // @ts-expect-error — une table tirable sans le dé de sa donnée ne compile pas.
    const sansDe: TableStepDef = { label: 'x', rows: [], lines: () => [] };
    // @ts-expect-error — ni avec un nombre de faces : seul `deDeLaTableTiree` forge le dé d'une table.
    const deNu: TableStepDef = { label: 'x', die: 100, rows: [], lines: () => [] };
    expect([sansDe.die, deNu.die]).toEqual([undefined, 100]);
  });

  it('ligne HORS D’ATTEINTE sous le `mod` : aucun dé naturel n’y tombe → `null` (jamais un dé qui glisse)', () => {
    expect(naturalRollForTableRow({ tableId: T, mod: 60 }, tableStepDef(T)!.rows[0])).toBeNull(); // 1-50 : max 100-60 → -10
    expect(naturalRollForTableRow({ tableId: T, mod: 60 }, tableStepDef(T)!.rows[1])).toBe(1);
    expect(naturalRollForTableRow({ tableId: T, mod: -60 }, tableStepDef(T)!.rows[1])).toBeNull(); // 51-100 : min 111 > d100
  });

  it('POSER le dé d’une ligne (mod −10) : la ligne CLIQUÉE sort, le dé naturel est celui qui l’atteint', () => {
    open(-10);
    const nat = naturalRollForTableRow(curStep().table!, tableStepDef(T)!.rows[1])!;
    banc.getState().jetImposerLeResultat('cascadeTirage', nat, 'tm');
    expect(curStep().table!.result).toMatchObject({ roll: 61, die: 51, id: 'haute' });
    banc.getState().jetValider('cascade'); // la conséquence lit l'id de ligne, comme un tirage naturel
    expect(applied).toEqual([{ id: 'haute', roll: 61, die: 51 }]);
  });

  it('POSER un dé SAISI (le champ) : le naturel est le dé, `mod` appliqué après ; l’étape porte la provenance', () => {
    open(10);
    banc.getState().jetImposerLeResultat('cascadeTirage', 48, 'tm');
    expect(curStep().table!.result).toMatchObject({ roll: 48, die: 58, id: 'haute' });
    expect(curStep().fixed, 'la provenance « dé fixé » vit sur l’étape (rangée + journal)').toBe(true);
    // JOURNAL : la mention suit le jet tant que le slot est ouvert (couture unique `fixedDieMark`).
    banc.getState().ecrireAuJournal('Conséquence du tirage');
    const journal = banc.getState().journal;
    expect(journal[journal.length - 1]).toContain('(dé fixé)');
  });

  it('une SAISIE que la table ne peut pas résoudre est ramenée à ses faces utiles (jamais une levée en pleine modale)', () => {
    open(20);
    expect(() => banc.getState().jetImposerLeResultat('cascadeTirage', 100, 'tm')).not.toThrow();
    expect(curStep().table!.result).toMatchObject({ roll: 80, die: 100, id: 'haute' });
  });

  it('SONDE COOP : le geste d’un INVITÉ sur SON héros passe, même option ÉTEINTE chez l’hôte', () => {
    // L'option « Dés fixés » est CLIENT-SIDE : elle arme l'affordance chez celui qui clique. L'hôte
    // n'a QUE l'autorisation de siège à vérifier (`intentAllowedFor`) — re-juger son état local ferait
    // tomber en silence un geste légitime (le mode d'échec verbatim de `opSetForcedRoll`).
    resetDesFixes(); // option éteinte CHEZ L'HÔTE
    const hero = combattantDeTest({ id: 'h1', label: 'Aldo', kind: 'heros' });
    banc.setState({
      party: [hero],
      net: { mode: 'hote', mySeat: 0, roomCode: 'ABCD', seatNames: {}, presence: {}, ownership: { h1: 1 }, gmSeat: null } as never,
    });
    startCascade(banc.getState, banc.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...step(), actorId: 'h1' }],
    });
    expect(intentAllowedFor(banc.getState(), 1, 'jetImposerLeResultat', ['cascadeTirage', 97, 'tm'])).toBe(true);
    banc.getState().jetImposerLeResultat('cascadeTirage', 97, 'tm');
    expect(curStep().table!.result, 'geste légitime d’un invité tombé en silence').toMatchObject({ roll: 97, id: 'haute' });
  });

  it('le dé se RE-POSE tant que l’étape est courante (parité avec la saisie post-jet d’un slot de flux)', () => {
    open();
    banc.getState().jetImposerLeResultat('cascadeTirage', 7, 'tm');
    expect(curStep().table!.result).toMatchObject({ roll: 7, id: 'basse' });
    banc.getState().jetImposerLeResultat('cascadeTirage', 99, 'tm'); // frappe suivante : 7 → 99
    expect(curStep().table!.result).toMatchObject({ roll: 99, id: 'haute' });
    banc.getState().jetValider('cascade'); // l'étape est validée : la fenêtre se referme
    expect(applied).toEqual([{ id: 'haute', roll: 99, die: 99 }]);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  /** Séquence de DEUX étapes à table : le curseur avance, donc l'étape 1 sort de sa fenêtre de pose. */
  const openTwo = () =>
    startCascade(banc.getState, banc.setState, {
      title: 'Tirage', purpose: 'test',
      steps: [{ ...step(), id: 's1', label: fixtureText('E1')}, { ...step(), id: 's2', label: fixtureText('E2')}],
    });
  const stepById = (id: string) => banc.getState().pendingCascade!.participants.find((x) => x.id === id)!;

  it('étape COMMITTÉE (conséquence appliquée, curseur avancé) : la re-pose est REFUSÉE — on ne réécrit pas l’histoire', () => {
    openTwo();
    banc.getState().jetImposerLeResultat('cascadeTirage', 9, 's1');
    const avant = stepById('s1').table!.result;
    banc.getState().jetValider('cascade'); // COMMIT de s1 : l'applier a joué, le curseur est sur s2
    expect(applied).toEqual([{ id: 'basse', roll: 9, die: 9 }]);
    expect(stepById('s1').committed).toBe(true);
    banc.getState().jetImposerLeResultat('cascadeTirage', 88, 's1'); // tentative de réécriture
    expect(stepById('s1').table!.result, 'un dé re-posé APRÈS la conséquence rejouerait une issue déjà subie').toEqual(avant);
    expect(applied).toHaveLength(1); // aucune conséquence rejouée
  });

  it('BILAN (« Tout lancer ») : plus aucune fenêtre de pose — les deux étapes sont figées', () => {
    openTwo();
    banc.getState().jetLancer('cascade');
    const p = banc.getState().pendingCascade!;
    expect(p.cursor).toBe(p.participants.length); // curseur EN FIN = bilan
    expect(applied).toHaveLength(2); // les conséquences des deux étapes sont déjà appliquées
    const avant = p.participants.map((x) => x.table!.result!.roll);
    banc.getState().jetImposerLeResultat('cascadeTirage', 88, 's1');
    banc.getState().jetImposerLeResultat('cascadeTirage', 88, 's2');
    expect(banc.getState().pendingCascade!.participants.map((x) => x.table!.result!.roll)).toEqual(avant);
    expect(applied).toHaveLength(2);
  });
});

/**
 * RE-POSE POST-TIRAGE de l'ENJEU (#1117 L2 vague 4b) — une étape à table énonce son enjeu AVANT le
 * dé, donc au niveau du `kind` ; la LIGNE jouée n'existe qu'APRÈS. Le contrat mesuré ici : les
 * QUATRE pilotes de tirage font descendre le renvoi à l'entrée Codex de la ligne tirée, en versant
 * la catégorie DÉCLARÉE PAR LA TABLE — et une table qui n'en déclare aucune laisse l'enjeu intact
 * (repli déclaré, jamais un renvoi fabriqué).
 *
 * Mesuré sur le CHEMIN RÉEL : vraies coutures du noyau, vraie table de domaine
 * (`structure-criticals`, catégorie `structureCriticals`), vrai résolveur `resolveStake`.
 */
describe('Étape à TABLE — l’enjeu DESCEND à la ligne jouée (#1117)', () => {
  const NEUTRE = 'test-table-sans-categorie';
  beforeEach(() => {
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
    avecLesTables({ tablesTirables: { ...tablesDuJeu().tablesTirables, [NEUTRE]: {
      label: 'Table sans catégorie',
      die: deDeLaTableTiree({ die: 'd100' }),
      rows: [{ min: 1, max: 100, id: 'unique' }],
      lines: () => ['x'],
    } }, appliers: { ...tablesDuJeu().appliers, stakeSpy: spyApplier([], () => undefined) } });
  });

  /** Étape sur la VRAIE table de Critiques de Structure, portant l'enjeu de son `kind`. */
  const structureStep = (id: string, forcedRoll?: number): CascadeStep => ({
    id, kind: cleDeFixture('stakeSpy'), label: fixtureText('Critique de Structure'), icon: 'navigation/des',
    table: { tableId: STRUCTURE_CRIT_TABLE, ...(forcedRoll ? { forcedRoll } : {}) },
    stake: combatStakeRef('structure-critique'),
  });

  const ruleOf = (st: CascadeStep) => resolveStake(st.stake!).rule;

  it('AVANT le dé, l’enjeu reste au `kind` (aucune ligne n’a encore été jouée)', () => {
    const st = structureStep('s0');
    expect(st.stake!.key!.entryId).toBeUndefined();
    expect(ruleOf(st)).toBeUndefined(); // l'entrée `structure-critique` n'a que sa catégorie d'entrées
  });

  it('pilote MODALE (`jetLancer(\'cascadeTirage\')`) : le renvoi vise la ligne RÉELLEMENT tirée', () => {
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [structureStep('s1', 40)] });
    banc.getState().jetLancer('cascadeTirage', 's1');
    const st = banc.getState().pendingCascade!.participants[0];
    expect(st.table!.result!.id).toBe(findTableEntry(tableDesCritiquesDeStructure(), 40).id);
    expect(ruleOf(st)).toEqual({ category: 'structureCriticals', id: st.table!.result!.id });
  });

  it('pilote DÉ POSÉ (`jetImposerLeResultat(\'cascadeTirage\')`) : même descente, et un dé RE-posé re-descend', () => {
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [structureStep('s1')] });
    banc.getState().jetImposerLeResultat('cascadeTirage', 10, 's1');
    const bas = banc.getState().pendingCascade!.participants[0];
    expect(ruleOf(bas)).toEqual({ category: 'structureCriticals', id: findTableEntry(tableDesCritiquesDeStructure(), 10).id });
    banc.getState().jetImposerLeResultat('cascadeTirage', 98, 's1');
    const haut = banc.getState().pendingCascade!.participants[0];
    expect(ruleOf(haut)).toEqual({ category: 'structureCriticals', id: findTableEntry(tableDesCritiquesDeStructure(), 98).id });
    expect(ruleOf(haut)).not.toEqual(ruleOf(bas)); // la re-pose SUIT le dé, elle ne se fige pas au premier
  });

  it('pilotes AUTOMATIQUES (« Tout lancer » et résolution immédiate) descendent aussi', () => {
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [structureStep('s1', 85)] });
    banc.getState().jetLancer('cascade');
    const st = banc.getState().pendingCascade!.participants[0];
    expect(ruleOf(st)).toEqual({ category: 'structureCriticals', id: findTableEntry(tableDesCritiquesDeStructure(), 85).id });
    banc.getState().fenetreFermer('cascade');
    const out = runCascadeImmediate(banc.getState, banc.setState, [structureStep('s2', 20)])!;
    expect(ruleOf(out[0])).toEqual({ category: 'structureCriticals', id: findTableEntry(tableDesCritiquesDeStructure(), 20).id });
  });

  it('table SANS catégorie d’entrées : l’enjeu est rendu TEL QUEL (repli déclaré)', () => {
    const st: CascadeStep = {
      id: 'n1', kind: cleDeFixture('stakeSpy'), label: fixtureText('Neutre'), icon: 'navigation/des',
      table: { tableId: NEUTRE, forcedRoll: 50 }, stake: combatStakeRef('structure-critique'),
    };
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [st] });
    banc.getState().jetLancer('cascadeTirage', 'n1');
    const apres = banc.getState().pendingCascade!.participants[0];
    expect(apres.stake!.key!.entryId).toBeUndefined();
    expect(apres.stake).toEqual(st.stake);
  });

  it('étape SANS enjeu : le tirage n’en fabrique aucun', () => {
    const st: CascadeStep = {
      id: 'm1', kind: cleDeFixture('stakeSpy'), label: fixtureText('Muette'), icon: 'navigation/des',
      table: { tableId: STRUCTURE_CRIT_TABLE, forcedRoll: 40 },
    };
    startCascade(banc.getState, banc.setState, { title: 'T', purpose: 'test', steps: [st] });
    banc.getState().jetLancer('cascadeTirage', 'm1');
    expect(banc.getState().pendingCascade!.participants[0].stake).toBeUndefined();
  });
});
