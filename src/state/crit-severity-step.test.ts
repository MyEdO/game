import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult, resolveCritSeverity, critSeverityDecl, critSeverityInSeam, CRIT_TABLE_IDS } from './combatFlow';
import { setRule, resetRule } from '../engine/policy';
import { stepInteraction, rollTableStep, tableStepDef } from './cascade';
import { draineCascade } from './cascadeTestKit';
import { seedBattleRng, battleRng } from './battleRng';
import { makeRNG, d100 } from '../engine/dice';
import { resolveCritique, critTableRows, critSeverityReduction } from '../engine/critical';
import { critiqueTable, critTableKeyFor } from '../data/criticals';
import { findTableEntry } from '../engine/tables';
import { createHero } from '../engine/character';
import { setDesFixes, resetDesFixes, desFixes } from '../engine/fixedDie';
import { testScene } from '../scenes/test-fixture';
import { snapshotSave } from './saves';
import { netSnapshot } from './netFlow';
import { hasCondition } from '../engine/conditions';
import type { Weapon, Combatant, HitLocation, ArmourPoints } from '../engine/types';

/** Dernière Blessure critique SUBIE (id d'entrée) — l'historique d'occurrence (LDB 18 l.71). */
const lastCrit = (c: Combatant): string | undefined => (c.critEntriesSuffered ?? [])[(c.critEntriesSuffered ?? []).length - 1];
const SANS_PA: ArmourPoints = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
import type { AttackResult } from '../engine/combat';

/**
 * SÉVÉRITÉ d'une Blessure critique en SEAM (#942 L4) — le d100 du Tableau des Critiques (LDB 18) est
 * une étape à TABLE de la séquence : tiré par le résolveur unique `rollTableStep`, injecté au moteur
 * en `forcedRoll` (dé NATUREL — `resolveCritique` applique LUI-MÊME la réduction d'overkill, LDB 18 l.17
 * verbatim « vous ôtez -20 à votre résultat sur le Tableau des Critiques avec un résultat minimum de
 * 01 »), et POSABLE (option « Dés fixés » + siège qui contrôle la victime) avant que le coup ne soit
 * résolu. Sans l'option, le chemin reste bit-à-bit celui d'avant (sonde différentielle ci-dessous).
 */

const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] };

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

/** Combat de fixture : un héros (victime, sans PA — aucune offre de Déviation) et un ennemi attaquant. */
function startFight(seed = 7) {
  useGame.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(structuredClone(testScene));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  H.armour = { ...SANS_PA }; // aucune PA → la Déviation Critique (LDB 63) ne s'offre pas : on isole la fenêtre de sévérité
  return { H, E };
}

/** Coup Critique dont la localisation du Critique est FIGÉE (pas de re-tirage) → table déterministe. */
const critHit = (loc: HitLocation, woundsLost = 2): AttackResult => ({
  hit: true, attackerRoll: 44, netSL: 4, location: loc, critLocation: loc, damage: 6, woundsLost,
  critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche',
});

describe('Sévérité d’un Critique — la table LDB en étape (#942 L4)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetDesFixes(); useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetDesFixes(); });

  it('SENTINELLE : le fichier démarre option « Dés fixés » ÉTEINTE (aucune fuite d’un autre fichier)', () => {
    // Singleton de module partagé sous `isolate:false` : une option laissée allumée ailleurs ouvrirait
    // ICI des fenêtres de pose, suspendrait les attaques et ferait disparaître les Blessures. Le socle
    // (`src/test-setup.ts`) la remet à zéro à chaque test — l'ordre d'exécution ne décide de rien.
    expect(desFixes()).toBe(false);
  });

  it('registre : une table déclarée par TABLE de rattachement, lignes = la DONNÉE `criticals.json` (par référence)', () => {
    for (const key of ['tete', 'bras', 'corps', 'jambe'] as const) {
      const def = tableStepDef(CRIT_TABLE_IDS[key])!;
      expect(def, `table « ${key} » non enregistrée`).toBeDefined();
      expect(def.rows).toBe(critTableRows('ldb', key)); // par RÉFÉRENCE : zéro duplication de fourchettes
      expect(def.die).toBe(100);
    }
    // La projection Localisation → table est celle du moteur (repli Bras compris) : un seul chemin.
    for (const loc of LOCS) expect(critTableRows('ldb', critTableKeyFor(loc))).toBe(critiqueTable('ldb', loc));
    // La ligne d'affichage est le libellé de l'entrée atteinte par le dé EFFECTIF.
    expect(rollTableStep({ tableId: CRIT_TABLE_IDS.corps, forcedRoll: 46 }, makeRNG(1)).lines[0])
      .toBe(findTableEntry(critiqueTable('ldb', 'corps'), 46).label);
  });

  it('déclaration : la réduction d’overkill est un `mod` NÉGATIF, et la table BORNE à 01 (LDB 18 l.17)', () => {
    const { H } = startFight();
    expect(critSeverityReduction(H, 0)).toBe(0);
    const gros = 99; // dépassement très supérieur au Bonus d'Endurance → réduction
    expect(critSeverityReduction(H, gros)).toBe(20);
    const decl = critSeverityDecl(H, 'corps', gros);
    expect(decl).toMatchObject({ tableId: CRIT_TABLE_IDS.corps, spec: { n: 1, sides: 100 }, mod: -20, clamp: true });
    // Dé naturel 7 sous −20 : le dé effectif est BORNÉ à 01 (jamais une levée hors plage), même ligne
    // que le lookup moteur (qui fait son propre `Math.max(1, …)`).
    const rolled = rollTableStep({ ...decl, forcedRoll: 7 }, makeRNG(1));
    expect(rolled).toMatchObject({ roll: 7, die: 1 });
    expect(rolled.id).toBe(findTableEntry(critiqueTable('ldb', 'corps'), 1).id);
    seedBattleRng(3);
    expect(resolveCritique('ldb', H, 'corps', battleRng(), { overkill: gros, forcedRoll: 7 }).roll).toBe(1);
  });

  it('SONDE DIFFÉRENTIELLE (option ÉTEINTE) : même ligne ET même flux RNG que le tirage moteur d’avant', () => {
    const { H } = startFight();
    for (let seed = 1; seed <= 25; seed++) {
      // Référence = le chemin d'avant : le moteur tire LUI-MÊME son d100 de sévérité.
      seedBattleRng(seed);
      const avant = resolveCritique('ldb', H, 'corps', battleRng());
      const apresRef = d100(battleRng()); // dé SUIVANT → mesure la consommation exacte du flux
      // Seam : le dé passe par l'étape à table, le moteur reçoit le naturel.
      seedBattleRng(seed);
      const seam = resolveCritSeverity(H, 'corps', 0);
      const apresSeam = d100(battleRng());
      expect(seam.crit.roll, `seed ${seed} : dé de sévérité décalé`).toBe(avant.roll);
      expect(seam.crit.entryId, `seed ${seed} : ligne de Blessure différente`).toBe(avant.entryId);
      expect(apresSeam, `seed ${seed} : le flux RNG a été décalé`).toBe(apresRef);
      // La déclaration résolue rend le MÊME dé/ligne que le moteur (les deux lookups concordent).
      expect(seam.table!.result).toMatchObject({ roll: avant.roll, die: avant.roll, id: avant.entryId });
    }
  });

  it('option « Dés fixés » ÉTEINTE : la MÊME étape existe et se joue — le dé tombe dans la fenêtre, la ligne tirée EST celle appliquée', () => {
    // #1426 : plus aucune gate de possession sur la poussée. La table est déclarée pour TOUT porteur ;
    // l'option « Dés fixés » n'ajoute que la POSE du dé, jamais l'existence de l'étape.
    const { H, E } = startFight();
    const suspended = applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    expect(suspended).toBe(true);
    const etapes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(etapes).toHaveLength(1);
    expect(etapes[0].table!.tableId).toBe(CRIT_TABLE_IDS.corps);
    expect(stepInteraction(etapes[0])).toBe('table');
    // Le dé tombe DANS la fenêtre (kit = ce que la fenêtre offre) : la ligne tirée par l'étape est
    // celle que le moteur applique, et la révélation riche la RAPPORTE.
    useGame.getState().cascadeTableRoll(etapes[0].id);
    const ligne = useGame.getState().pendingCascade!.participants[0].table!.result!.id;
    draineCascade(useGame.getState);
    const victime = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(victime.criticalWounds).toBe(1);
    expect(lastCrit(victime), 'la ligne tirée dans la fenêtre n’est pas celle appliquée').toBe(ligne);
  });

  it('l’étape de sévérité est poussée NON RÉSOLUE, l’attaque est SUSPENDUE, la victime INTACTE', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    const avant = { pb: H.wounds.current, crits: H.criticalWounds ?? 0 };
    const suspended = applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    expect(suspended).toBe(true);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('deviation');
    expect(stepInteraction(step)).toBe('table'); // dé À POSER → les deux affordances de la modale
    expect(step.table).toMatchObject({ tableId: CRIT_TABLE_IDS.corps, spec: { n: 1, sides: 100 } });
    expect(step.table!.result).toBeUndefined();
    // Aucune mutation de la victime tant que le dé n'est pas posé (parité avec l'offre de Déviation).
    expect(H.wounds.current).toBe(avant.pb);
    expect(H.criticalWounds ?? 0).toBe(avant.crits);
  });

  it('POSER le dé applique la VRAIE ligne de Blessure (ops/États de l’entrée), et l’étape porte sa provenance', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    // Ligne CHOISIE dans la donnée : une entrée à État (op `condition`), ni létale ni amputante.
    const entry = critiqueTable('ldb', 'corps').find((e) => !e.lethal && !e.amputation && (e.ops ?? []).some((o) => o.op === 'condition'))!;
    const cond = (entry.ops ?? []).find((o) => o.op === 'condition') as { op: 'condition'; id: string };
    applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('deviation');
    useGame.getState().cascadeTableSetForcedRoll(step.id, entry.min);
    const posee = useGame.getState().pendingCascade!.participants[0];
    expect(posee.table!.result).toMatchObject({ roll: entry.min, die: entry.min, id: entry.id });
    expect(posee.fixed, 'la provenance « dé fixé » vit sur l’étape').toBe(true);
    useGame.getState().cascadeNext(); // COMMIT : le Critique de CETTE ligne est résolu et appliqué
    const victime = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(lastCrit(victime), 'la ligne posée n’est pas celle appliquée').toBe(entry.id);
    expect(victime.criticalWounds).toBe(1);
    expect(hasCondition(victime, cond.id), `État « ${cond.id} » de la ligne non appliqué`).toBe(true);
    // Le rendu RICHE du résultat reste l'étape de révélation (CriticalBody), appendée après la pose.
    const reveal = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'critical')!;
    expect(reveal.reveal!.dice).toBe(entry.min);
  });

  /**
   * PLI POST-DÉ IMPUR (#1426) — `resolveCritique` consomme du RNG même sous dé posé (amputation, relances) :
   * sans mémo, explorer les poses (76 → 20 → 76) rendrait TROIS Critiques différents pour DEUX valeurs,
   * et la fenêtre mentirait sur son propre dé. Contrat mesuré : pour une étape donnée, un dé posé rend
   * TOUJOURS la même conséquence, et une valeur DÉJÀ VUE ne re-consomme aucun dé.
   */
  it('PLI IMPUR : re-poser un dé DÉJÀ VU rend LE MÊME Critique, sans re-consommer d’aléa (76 → 20 → 76)', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.kind).toBe('deviation');
    /** Pose le dé et rend { critique dérivé, dés consommés par le pli }. */
    const pose = (nat: number) => {
      const rng = battleRng();
      const brut = rng.int.bind(rng);
      let n = 0;
      (rng as { int: typeof brut }).int = (a: number, b: number) => { n++; return brut(a, b); };
      try { useGame.getState().cascadeTableSetForcedRoll(step.id, nat); } finally { (rng as { int: typeof brut }).int = brut; }
      const apres = useGame.getState().pendingCascade!.participants[0];
      return { crit: apres.deviation!.crit, ligne: apres.table!.result!.id, des: n };
    };
    const a = pose(76);
    const b = pose(20);
    const c = pose(76);
    expect(a.crit, 'le pli n’a rien dérivé').toBeTruthy();
    expect(a.des, 'une valeur JAMAIS VUE fait tourner le pli — s’il ne consomme rien, la sonde ne mord pas')
      .toBeGreaterThan(0);
    expect(b.ligne, '20 et 76 doivent tomber sur des lignes DIFFÉRENTES, sinon la sonde ne prouve rien')
      .not.toBe(a.ligne);
    expect(c.ligne).toBe(a.ligne);
    expect(c.crit, 'MÊME dé, MÊME étape → MÊME conséquence').toEqual(a.crit);
    expect(c.des, 'une valeur DÉJÀ VUE se re-sert du mémo : aucun dé de plus').toBe(0);
  });

  it('victime qu’AUCUN siège ne tient (ennemi sans siège MJ) : l’étape EXISTE, sa table est résolue D’OFFICE et franchie', () => {
    // Arbitrage 2026-08-23 : un porteur qu'aucun siège ne tient ne fait pas disparaître l'étape — le
    // socle la résout au rang du curseur (`cascade.poserLeCurseur`) et le bilan la montre. C'est le
    // MÊME code que pour une table de monde (Météo, événement de bord).
    const { H, E } = startFight();
    setDesFixes(true);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, H, E, hache, critHit('corps', 99));
    expect(suspended).toBe(true);
    const etapes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(etapes).toHaveLength(1);
    expect(etapes[0].table!.result, 'aucun siège ne la tient → le socle a tiré au rang du curseur').toBeTruthy();
    expect(stepInteraction(etapes[0]), 'plus rien à jouer : l’étape se franchit').toBe('affichage');
    const ligne = etapes[0].table!.result!.id;
    draineCascade(useGame.getState);
    const victime = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(lastCrit(victime), 'la ligne résolue d’office n’est pas celle appliquée').toBe(ligne);
  });

  it('variante AUX ARMES : aucune fenêtre ni déclaration LDB — la sévérité reste au résolveur AA (#974)', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    setRule('combat-aa-blessures', 'aa');
    try {
      // Le prédicat de seam est celui de la bifurcation moteur : AA seul hors Sauvagerie.
      expect(critSeverityInSeam(false)).toBe(false);
      expect(critSeverityInSeam(true)).toBe(true); // Sauvagerie → tables LDB (l'Atout ne coexiste pas avec AA)
      // Défense en profondeur : fabriquer une déclaration LDB sous AA promettrait une ligne que
      // le résolveur AA n'appliquerait pas → levée, jamais un dé posé silencieusement ignoré.
      expect(() => critSeverityDecl(H, 'corps', 0, false)).toThrow(/combat-aa-blessures/);
      const suspended = applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
      expect(suspended, 'fenêtre LDB ouverte sous la variante AA').toBe(false);
      expect(useGame.getState().pendingCascade!.participants.some((s) => s.table?.tableId === CRIT_TABLE_IDS.corps && s.kind === 'deviation')).toBe(false);
      // Le Critique appliqué vient bien des tables AA (id absent des tables LDB de la localisation).
      const victime = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
      expect(critiqueTable('ldb', 'corps').some((e) => e.id === lastCrit(victime))).toBe(false);
    } finally {
      resetRule('combat-aa-blessures');
    }
  });

  it('SAUVAGERIE, dé tiré : DEUX lancers consommés à l’étape, le dé retenu est celui qui s’affiche', () => {
    const { H } = startFight();
    // LDB 41 l.170 confie le tri au porteur béni ; le choix n'étant pas surfacé (attaquant IA/cadence
    // auto), la POLITIQUE appliquée est le plus élevé — et elle vit sur la DÉCLARATION (`keepHighest`).
    for (let seed = 1; seed <= 15; seed++) {
      const ref = makeRNG(seed);
      const a = ref.int(1, 100);
      const b = ref.int(1, 100);
      const troisieme = ref.int(1, 100); // le dé SUIVANT du flux si exactement DEUX sont consommés
      const decl = critSeverityDecl(H, 'corps', 0, true);
      expect(decl.keepHighest, 'la déclaration ne porte pas les deux lancers').toBe(2);
      seedBattleRng(seed);
      const rolled = rollTableStep(decl, battleRng());
      expect(rolled.roll, `seed ${seed} : ce n’est pas le dé retenu des deux lancers`).toBe(Math.max(a, b));
      expect(d100(battleRng()), `seed ${seed} : nombre de lancers consommés ≠ 2`).toBe(troisieme);
      // Le seam complet rend le MÊME dé : celui qui s'affiche est celui qui résout la ligne.
      seedBattleRng(seed);
      const { crit, table } = resolveCritSeverity(H, 'corps', 0, true);
      expect(table!.result!.roll).toBe(Math.max(a, b));
      expect(crit.roll).toBe(Math.max(a, b));
      expect(crit.entryId).toBe(findTableEntry(critiqueTable('ldb', 'corps'), Math.max(a, b)).id);
    }
  });

  it('SAUVAGERIE, dé POSÉ : un seul dé — le posé (arbitrage 2026-07-31 : poser un dé EST le choix)', () => {
    const { H } = startFight();
    const decl = critSeverityDecl(H, 'corps', 0, true);
    const premier = makeRNG(5).int(1, 100); // le flux est INTACT : rien n'est tiré pour la sévérité
    seedBattleRng(5);
    const rolled = rollTableStep({ ...decl, forcedRoll: 42 }, battleRng());
    expect(rolled).toMatchObject({ roll: 42, die: 42 });
    expect(d100(battleRng()), 'un dé a été consommé malgré le dé posé').toBe(premier);
    seedBattleRng(5);
    const { crit } = resolveCritSeverity(H, 'corps', 0, true, 42);
    expect(crit.roll, 'le dé posé a été écrasé par le multiplicateur de lancers').toBe(42);
    expect(crit.entryId).toBe(findTableEntry(critiqueTable('ldb', 'corps'), 42).id);
  });

  /**
   * UNE INSTANCE = UN ID (#1426) : deux Critiques sur la MÊME cible à la MÊME localisation dans la
   * MÊME séquence (Balayage, deux frappes du Maniement de deux armes) portaient un id d'étape
   * IDENTIQUE — les seams keyés par id (`liveMerge` de `commitStep`, la pose du dé
   * `cascadeTableSetForcedRoll`) ne les distinguaient plus. L'index d'append les sépare.
   */
  it('deux Critiques MÊME cible / MÊME localisation dans une séquence = DEUX ids d’étape', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    const etapes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(etapes, 'les deux Critiques doivent porter DEUX étapes').toHaveLength(2);
    expect(new Set(etapes.map((s) => s.id)).size, `id partagé : ${etapes[0].id}`).toBe(2);
    // Et la pose n'agit que sur l'étape SOUS LE CURSEUR : le dé de la seconde ne suit pas celui de la
    // première (avec un id partagé, elles répondaient au même geste).
    const entry = critiqueTable('ldb', 'corps').find((e) => !e.lethal && !e.amputation)!;
    useGame.getState().cascadeTableSetForcedRoll(etapes[0].id, entry.min);
    const apres = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(apres[0].table!.result!.id).toBe(entry.id);
    expect(apres[1].table!.result, 'la SECONDE étape a été résolue par le geste de la première').toBeUndefined();
  });

  /**
   * SECRET DES POSES (#1426) — un dé exploré puis ABANDONNÉ n'appartient qu'au siège qui pose : sa
   * conséquence dérivée (`CascadeStep.foldMemo`, mémo du pli impur) ne quitte jamais ce siège. Les
   * deux surfaces sérialisées passent par la MÊME couture (`saves.snapshotSave`, dont
   * `netFlow.netSnapshot`), et le mémo est purgé au COMMIT de l'étape.
   */
  it('le dé exploré puis ABANDONNÉ ne voyage pas : ni sauvegarde, ni snapshot coop, ni étape committée', () => {
    const { H, E } = startFight();
    setDesFixes(true);
    applyAttackResult(useGame.getState, useGame.setState, E, H, hache, critHit('corps'));
    const step = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeTableSetForcedRoll(step.id, 76); // exploré…
    useGame.getState().cascadeTableSetForcedRoll(step.id, 20); // …puis ABANDONNÉ
    const courante = useGame.getState().pendingCascade!.participants[0];
    expect(Object.keys(courante.foldMemo ?? {}), 'sonde : le mémo doit bien porter les DEUX poses')
      .toEqual(expect.arrayContaining(['76', '20']));

    const brut = (o: unknown) => JSON.stringify(o);
    const save = snapshotSave(
      useGame.getState() as unknown as Record<string, unknown>,
      useGame.getInitialState() as unknown as Record<string, unknown>,
      'test',
    );
    expect(brut(save.data), 'le secret de pose part dans la SAUVEGARDE').not.toMatch(/foldMemo/);
    expect(brut(netSnapshot(useGame.getState)), 'le secret de pose part dans le SNAPSHOT diffusé').not.toMatch(/foldMemo/);
    // …et l'état lui-même s'en défait au COMMIT (le mémo ne sert que tant que l'étape est courante).
    useGame.getState().cascadeNext();
    const committee = useGame.getState().pendingCascade!.participants[0];
    expect(committee.committed).toBe(true);
    expect(committee.foldMemo, 'mémo survivant au commit').toBeUndefined();
  });
});
