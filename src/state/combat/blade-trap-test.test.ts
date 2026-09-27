import { fixtureText } from '../../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseQualityInstance } from '../../engine/qualities/normalize';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : enregistre l'applier 'bladeTrap' + installe les hooks (breakBlade…)
import { pushChoice } from '../rollSeam';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { resolveOpposed } from '../../engine/tests';
import { skillBaseValue } from '../../engine/skills';

import { testScene } from '../../scenes/test-fixture';
import type { PendingBladeTrap } from '../pendings';
import type { Weapon } from '../../engine/types';
import { resetCadence, setCadence } from '../../engine/cadence';

/**
 * Piège-lame (LDB 62 l.278-280) en Test opposé CADENCE-AWARE : « Si vous obtenez un Critique en vous
 * défendant contre une arme à lame, vous pouvez choisir de la piéger… effectuez un Test opposé de Force,
 * en ajoutant votre DR obtenu au précédent Test de Corps à corps. Si vous l'emportez, l'adversaire laisse
 * tomber la lame ; Succès Stupéfiant → la lame est BRISÉE sauf Incassable ; échec → l'adversaire libère sa
 * lame. » Le HÉROS défenseur PEUT influencer le Test (Chance/Résilience) — l'étape `triggeredTest` est
 * INFLUENÇABLE ; la conséquence (désarme/bris) est PROCÉDURALE après le Test résolu (op `breakBlade`).
 */
const bladedWeapon = (uid: string, qualities: string[] = []): Weapon => ({ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: qualities.map((s) => parseQualityInstance(s)!), uid });

describe('Piège-lame — Test opposé de Force CADENCE-AWARE (op breakBlade, désarme/bris procédural)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!; // le héros piégeur (défenseur)
    const A = b.combatants.find((c) => c.kind === 'enemy')!; // l'attaquant dont la lame est visée
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, A };
  }

  /** Pousse l'étape de CHOIX « piège-lame » (créée en production au Critique défensif) puis tranche `trap`
   *  et avance → l'applier route le Test opposé cadence-aware (héros manuel → étape `triggeredTest`). */
  function openTrapChoice(H: { id: string }, A: { id: string }, weapon: Weapon, defSL: number) {
    const pbt: PendingBladeTrap = { defenderId: H.id, attackerId: A.id, weapon, parryWeaponUid: 'parry-uid', defSL, roll: 33 };
    pushChoice(useGame.setState, {
      id: 'cons-bladetrap', kind: 'bladeTrap', actorId: H.id, icon: 'item/weapon', label: fixtureText('Parade — piéger la lame ?'),
      options: [{ key: 'trap', label: fixtureText('Piéger la lame') }, { key: 'crit', label: fixtureText('Coup Critique') }],
      defaultChoice: 'crit', bladeTrap: pbt,
    });
    useGame.getState().cascadeChoose('cons-bladetrap', 'trap');
    useGame.getState().cascadeNext(); // commit du choix → l'applier append l'étape `triggeredTest`
  }

  /** Résout l'étape `triggeredTest` du Piège-lame (jet + validation) et RENVOIE l'`outcome` de l'étape
   *  d'AFFICHAGE `bladeTrapResult` empilée par la conséquence — la note « lame brisée/arrachée » du paradigme
   *  cascade (une étape propre, comme un Coup Critique, qui garde la cascade ouverte jusqu'à acquittement). */
  function resolveTestOutcome(stepId: string): import('../recapLine').RecapLine[] {
    useGame.getState().cascadeRoll(stepId);
    useGame.getState().cascadeNext(); // valide le Test → applier → empile l'étape `bladeTrapResult`
    const res = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'bladeTrapResult');
    return res?.outcome ?? [];
  }

  it('héros MANUEL : « Piéger » ouvre un Test opposé de Force INFLUENÇABLE (attaquant figé + bonus defSL)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 2);

    const casc = useGame.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    const step = casc.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);          // le DÉFENSEUR jette
    expect(step.result).toBeFalsy();          // pas encore lancé → Chance/Résilience possibles
    expect(step.rollLabel).toBe('Force');     // Test de Force opposée
    // L'attaquant est PRÉ-JETÉ et FIGÉ + le bonus de DR de la défense voyage dans le meta (sérialisable, coop).
    expect(step.meta?.opposed).toBeTruthy();
    expect(step.meta?.opposed?.bonusSL).toBe(2);
    expect(typeof step.meta?.opposed?.aT.sl).toBe('number');
    // Contexte de la conséquence : la lame visée + le DR figé de l'attaquant.
    expect(step.meta?.bladeTrap?.attackerId).toBe(A.id);
    expect(step.meta?.bladeTrap?.weaponUid).toBe('atk-blade');
    expect(step.meta?.bladeTrap?.attackerSL).toBe(step.meta?.opposed?.aT.sl); // pas de re-jet de l'attaquant
  });

  it('héros gagne (Force écrasante) : l’adversaire est désarmé ; BRISÉE ssi marge nette ≥ 6 (Stupéfiant)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;  // Force écrasante → le défenseur l’emporte
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 0); // pas de bonus de défense → seule la marge du jet décide du Stupéfiant
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    const o = resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false });
    expect(o.winner).not.toBe('attacker'); // le défenseur l’emporte (Force écrasante)
    useGame.getState().cascadeNext();
    const outcome = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'bladeTrapResult')?.outcome ?? [];

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé dans tous les cas de victoire
    // Bris SSI Succès Stupéfiant (marge nette ≥ 6) — preuve que la conséquence lit la marge nette (LDB 62 l.280).
    expect(weapon.destroyed === true).toBe(o.netSL >= 6);
    // La conséquence est EMPILÉE comme étape d'affichage propre (paradigme cascade : « l'un sous l'autre »).
    const rx = o.netSL >= 6 ? /BRISÉE/ : /arrachée/;
    expect(outcome.some((l) => rx.test(l.text))).toBe(true);
  });

  it('Succès Stupéfiant (marge nette ≥ 6 via gros bonus defSL) : la lame est BRISÉE', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8); // +8 DR de défense → marge nette ≥ 6 garantie sur une victoire
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;
    const outcome = resolveTestOutcome(step.id);

    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    const net = rolled.sl + 8 - aT.sl; // marge nette recomposée comme la conséquence
    expect(net).toBeGreaterThanOrEqual(6);

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // retirée du loadout
    expect(weapon.destroyed).toBe(true); // BRISÉE (Succès Stupéfiant)
    expect(outcome.some((l) => /BRISÉE/.test(l.text))).toBe(true); // note empilée sous le jet
  });

  it('Succès Stupéfiant sur une lame INCASSABLE : NON brisée (arrachée seulement)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;
    const weapon = bladedWeapon('atk-blade', ['incassable']);
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const outcome = resolveTestOutcome(step.id);

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // arrachée des mains
    expect(weapon.destroyed).toBeFalsy(); // Incassable → pas brisée (LDB 62 l.280)
    expect(outcome.some((l) => /résiste à la casse/.test(l.text))).toBe(true); // note empilée
  });

  /**
   * ÉGALITÉ PARFAITE (même DR ET même valeur NUE) — `LDB 12 l.160` : « Dans le cas improbable où il y ait
   * une égalité, le MJ choisit l'une de ces deux solutions : 1) statu quo, rien ne se passe ; 2) les deux
   * groupes refont le Test ». Le jeu retient la première (arbitrage `opposedBranchSuccess`). Ici « vous »
   * (LDB 62 l.280 « Si vous l'emportez ») est le PIÉGEUR, qui JETTE ce Test : une égalité n'est pas une
   * victoire — la lame n'est PAS arrachée. Elle n'est pas « libérée » non plus (l.280 attache cela à
   * l'ÉCHEC) : rien ne se passe, l'état courant persiste, et aucune conséquence n'est empilée.
   */
  it('ÉGALITÉ parfaite : STATU QUO — la lame n’est NI arrachée NI brisée, et le Test n’est pas un échec', () => {
    const { H, A } = setup();
    // Mêmes valeurs NUES des deux camps → le départage à DR égal (LDB 12 l.160) ne tranche pas non plus.
    A.characteristics.force = 50;
    const fNue = skillBaseValue(A, undefined, undefined, 'force');
    H.characteristics.force += fNue - skillBaseValue(H, undefined, undefined, 'force');
    expect(skillBaseValue(H, undefined, undefined, 'force')).toBe(fNue);
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    // seed POSÉ après le spawn : 1ʳᵉ consommation = pré-jet de l'ATTAQUANT, 2ᵉ = jet du piégeur. `defSL: 0`
    // (un bonus de défense romprait l'égalité avant l'opposition).
    seedBattleRng(7);
    openTrapChoice(H, A, weapon, 0);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;
    // Le camp que le RAW nomme « vous » est DÉCLARÉ sur l'opposition figée, il ne se devine pas au kind.
    expect(step.meta?.opposed?.defenderMustWin, 'Piège-lame : le jeteur doit REMPORTER').toBe(true);

    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false, base: step.base }).winner).toBe('tie');
    expect(rolled.success, 'égalité ≠ victoire du piégeur : la branche `breakBlade` n’est pas prise').toBe(false);
    expect(rolled.statuQuo, 'statu quo étampé : ce n’est pas un Test raté (aucun `onOwnTestFailed`)').toBe(true);
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade'), 'la lame reste en main').toBeTruthy();
    expect(weapon.destroyed).toBeFalsy();
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'bladeTrapResult'), 'rien ne se passe : aucune conséquence empilée').not.toBe(true);
  });

  it('héros perd (Force minime) : RIEN (l’adversaire garde sa lame)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 1; // Force minime → le défenseur perd
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];
    A.characteristics.force = 80;

    openTrapChoice(H, A, weapon, 0);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const aT = step.meta!.opposed!.aT;
    useGame.getState().cascadeRoll(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result!;
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner).toBe('attacker');
    useGame.getState().cascadeNext();

    const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeTruthy(); // garde sa lame
    expect(weapon.destroyed).toBeFalsy();
  });

  it('héros en cadence AUTO : Test opposé résolu INLINE (jet non influençable), désarme si le défenseur l’emporte', () => {
    setCadence('auto');
    try {
      seedBattleRng(7);
      const { H, A } = setup();
      H.characteristics.force = 90;
      const weapon = bladedWeapon('atk-blade');
      A.weapons = [weapon];

      openTrapChoice(H, A, weapon, 0);
      // Cadence auto : le Test opposé est résolu INLINE (aucune étape `triggeredTest` influençable).
      const casc = useGame.getState().pendingCascade;
      expect(casc?.participants.some((s) => s.kind === 'triggeredTest')).not.toBe(true);
      const a = useGame.getState().battle!.combatants.find((x) => x.id === A.id)!;
      expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé inline
      // La ligne d'opposition part dans la file différée ; la conséquence est l'étape d'affichage empilée.
      expect(useGame.getState().pendingLogQueue.some((q) => /Force/.test(q.line))).toBe(true);
      const result = casc?.participants.find((s) => s.kind === 'bladeTrapResult');
      expect(result?.outcome?.some((l) => /BRISÉE|arrachée/.test(l.text))).toBe(true);
    } finally {
      resetCadence();
    }
  });
});
