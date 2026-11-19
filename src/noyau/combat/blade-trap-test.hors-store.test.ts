import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { parseQualityInstance } from '../../data/refFormatLivre';
import { isUnarmed } from '../../engine/items';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { proposerLePiegeALame } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { resolveOpposed } from '../../engine/tests';
import { jete } from '../../engine/tests.testkit';
import { skillBaseValue } from '../../engine/skills';

import { testScene } from '../../scenes/test-fixture';
import type { PendingBladeTrap } from '../pendings';
import type { Combatant, Weapon } from '../../engine/types';
import { setCadence } from '../../engine/cadence';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Piège-lame (LDB 62 l.278-280) en Test opposé CADENCE-AWARE : « Si vous obtenez un Critique en vous
 * défendant contre une arme à lame, vous pouvez choisir de la piéger… effectuez un Test opposé de Force,
 * en ajoutant votre DR obtenu au précédent Test de Corps à corps. Si vous l'emportez, l'adversaire laisse
 * tomber la lame ; Succès Stupéfiant → la lame est BRISÉE sauf Incassable ; échec → l'adversaire libère sa
 * lame. » Le HÉROS défenseur PEUT influencer le Test (Chance/Résilience) — l'étape `testDeclenche` est
 * INFLUENÇABLE ; la conséquence (désarme/bris) est PROCÉDURALE après le Test résolu (op `breakBlade`).
 */
const bladedWeapon = (uid: string, qualities: string[] = []): Weapon => ({ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: qualities.map((s) => parseQualityInstance(s)!), uid });

describe('Piège-lame — Test opposé de Force CADENCE-AWARE (op breakBlade, désarme/bris procédural)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!; // le héros piégeur (défenseur)
    const A = b.combatants.find((c) => c.kind === 'ennemi')!; // l'attaquant dont la lame est visée
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, A };
  }

  /** Pousse l'étape de CHOIX « piège-lame » (créée en production au Critique défensif) puis tranche `trap`
   *  et avance → l'applier route le Test opposé cadence-aware (héros manuel → étape `testDeclenche`). */
  function openTrapChoice(H: Combatant, A: Combatant, weapon: Weapon, defSL: number) {
    const parade = bladedWeapon('parry-uid');
    const pbt: PendingBladeTrap = { defenderId: H.id, attackerId: A.id, weapon, parryWeaponUid: parade.uid!, defSL, roll: 33 };
    proposerLePiegeALame(banc.setState, pbt, H, A, parade);
    banc.getState().jetRegler('cascade', 'choix', 'piege', `cons-piege-a-lame-${H.id}`);
    banc.getState().jetValider('cascade'); // commit du choix → l'applier append l'étape `testDeclenche`
  }

  /** Résout l'étape `testDeclenche` du Piège-lame (jet + validation) et RENVOIE l'`outcome` de l'étape
   *  d'AFFICHAGE `issueDuPiegeALame` empilée par la conséquence — la note « lame brisée/arrachée » du paradigme
   *  cascade (une étape propre, comme un Coup Critique, qui garde la cascade ouverte jusqu'à acquittement). */
  function resolveTestOutcome(stepId: string): import('../recapLine').RecapLine[] {
    banc.getState().jetLancer('cascade', stepId);
    banc.getState().jetValider('cascade'); // valide le Test → applier → empile l'étape `issueDuPiegeALame`
    const res = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'issueDuPiegeALame');
    return res?.outcome ?? [];
  }

  it('héros MANUEL : « Piéger » ouvre un Test opposé de Force INFLUENÇABLE (attaquant figé + bonus defSL)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 2);

    const casc = banc.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    const step = casc.participants.find((s) => s.kind === 'testDeclenche')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);          // le DÉFENSEUR jette
    expect(step.result).toBeFalsy();          // pas encore lancé → Chance/Résilience possibles
    expect(step.rollLabel).toBe('Force');     // Test de Force opposée
    // L'attaquant est PRÉ-JETÉ et FIGÉ + le bonus de DR de la défense voyage dans le meta (sérialisable, coop).
    expect(step.meta?.opposed).toBeTruthy();
    expect(step.meta?.opposed?.bonusSL).toBe(2);
    expect(typeof step.meta?.opposed?.aT.sl).toBe('number');
    // Contexte de la conséquence : la lame visée + le DR figé de l'attaquant.
    expect(step.meta?.piegeALame?.attackerId).toBe(A.id);
    expect(step.meta?.piegeALame?.weaponUid).toBe('atk-blade');
    expect(step.meta?.piegeALame?.attackerSL).toBe(step.meta?.opposed?.aT.sl); // pas de re-jet de l'attaquant
  });

  it('héros gagne (Force écrasante) : l’adversaire est désarmé ; BRISÉE ssi marge nette ≥ 6 (Stupéfiant)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;  // Force écrasante → le défenseur l’emporte
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 0); // pas de bonus de défense → seule la marge du jet décide du Stupéfiant
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const aT = step.meta!.opposed!.aT;

    banc.getState().jetLancer('cascade', step.id);
    const rolled = jete(banc.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result);
    const o = resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false });
    expect(o.winner).not.toBe('attaquant'); // le défenseur l’emporte (Force écrasante)
    banc.getState().jetValider('cascade');
    const outcome = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'issueDuPiegeALame')?.outcome ?? [];

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé dans tous les cas de victoire
    expect(a.weapons.map(isUnarmed), 'arrachée ou brisée, la lame a quitté les mains : les Mains nues la remplacent').toEqual([true]);
    // Bris SSI Succès Stupéfiant (marge nette ≥ 6) — preuve que la conséquence lit la marge nette (LDB 62 l.280).
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
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const aT = step.meta!.opposed!.aT;
    const outcome = resolveTestOutcome(step.id);

    const rolled = jete(banc.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result);
    const net = rolled.sl + 8 - aT.sl; // marge nette recomposée comme la conséquence
    expect(net).toBeGreaterThanOrEqual(6);

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // retirée du loadout
    expect(a.weapons.map(isUnarmed), 'BRISÉE : les Mains nues la remplacent').toEqual([true]);
    expect(outcome.some((l) => /BRISÉE/.test(l.text))).toBe(true); // note empilée sous le jet
  });

  it('Succès Stupéfiant sur une lame INCASSABLE : NON brisée (arrachée seulement)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;
    const weapon = bladedWeapon('atk-blade', ['incassable']);
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8);
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const outcome = resolveTestOutcome(step.id);

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // arrachée des mains
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
    const fNue = skillBaseValue(A, { characteristic: 'force' });
    H.characteristics.force += fNue - skillBaseValue(H, { characteristic: 'force' });
    expect(skillBaseValue(H, { characteristic: 'force' })).toBe(fNue);
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    // seed POSÉ après le spawn : 1ʳᵉ consommation = pré-jet de l'ATTAQUANT, 2ᵉ = jet du piégeur. `defSL: 0`
    // (un bonus de défense romprait l'égalité avant l'opposition).
    seedBattleRng(7);
    openTrapChoice(H, A, weapon, 0);
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const aT = step.meta!.opposed!.aT;
    // Le camp que le RAW nomme « vous » est DÉCLARÉ sur l'opposition figée, il ne se devine pas au kind.
    expect(step.meta?.opposed?.defenderMustWin, 'Piège-lame : le jeteur doit REMPORTER').toBe(true);

    banc.getState().jetLancer('cascade', step.id);
    const rolled = jete(banc.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result);
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false, base: step.base }).winner).toBe('egalite');
    expect(rolled.success, 'égalité ≠ victoire du piégeur : la branche `breakBlade` n’est pas prise').toBe(false);
    expect(rolled.statuQuo, 'statu quo étampé : ce n’est pas un Test raté (aucun `onOwnTestFailed`)').toBe(true);
    banc.getState().jetValider('cascade');

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade'), 'la lame reste en main').toBeTruthy();
    expect(banc.getState().pendingCascade?.participants.some((s) => s.kind === 'issueDuPiegeALame'), 'rien ne se passe : aucune conséquence empilée').not.toBe(true);
  });

  it('héros perd (Force minime) : RIEN (l’adversaire garde sa lame)', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 1; // Force minime → le défenseur perd
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];
    A.characteristics.force = 80;

    openTrapChoice(H, A, weapon, 0);
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    const aT = step.meta!.opposed!.aT;
    banc.getState().jetLancer('cascade', step.id);
    const rolled = jete(banc.getState().pendingCascade!.participants.find((s) => s.id === step.id)!.result);
    expect(resolveOpposed(aT, { roll: rolled.roll, target: rolled.target, success: rolled.success, sl: rolled.sl, isDouble: false }).winner).toBe('attaquant');
    banc.getState().jetValider('cascade');

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeTruthy(); // garde sa lame
  });

  it('#2689 — lame Solide : la Sauvegarde part à la porte, la suite confiée garde le PIÉGEUR pour cible, et la lame ne se brise qu’une fois', () => {
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;
    const weapon: Weapon = { ...bladedWeapon('atk-blade'), qualities: [{ id: 'solide', value: 1 }] };
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 8);
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    // Le dé de l'attaquant (sans siège) est tiré d'office dans le même geste : la suite confiée s'OBSERVE
    // sur l'état du banc pendant qu'il attend.
    const suites: unknown[] = [];
    const desabonne = banc.subscribe((st) => {
      for (const p of st.pendingCascade?.participants ?? []) {
        if (!p.committed && p.meta?.apresSuite?.length) suites.push({ porteur: p.actorId, suite: p.meta.apresSuite.map((c) => (c.verbe === 'reprendreFlowDeCombat' ? { cible: c.cibleId, lanceur: c.ctx.casterId } : c.verbe)) });
      }
    });
    banc.getState().jetLancer('cascade', step.id);
    banc.getState().jetValider('cascade');
    desabonne();
    expect(suites[0], 'le dé de Sauvegarde de l’attaquant porte la suite, qui garde le PIÉGEUR pour cible')
      .toEqual({ porteur: A.id, suite: [{ cible: H.id, lanceur: A.id }] });

    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined();
    expect(banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'issueDuPiegeALame')).toHaveLength(1);
  });

  it('héros en cadence AUTO : Test opposé résolu INLINE (jet non influençable), désarme si le défenseur l’emporte', () => {
    setCadence('auto');
    seedBattleRng(7);
    const { H, A } = setup();
    H.characteristics.force = 90;
    const weapon = bladedWeapon('atk-blade');
    A.weapons = [weapon];

    openTrapChoice(H, A, weapon, 0);
    // Cadence auto : le Test opposé est résolu INLINE (aucune étape `testDeclenche` influençable).
    const casc = banc.getState().pendingCascade;
    expect(casc?.participants.some((s) => s.kind === 'testDeclenche')).not.toBe(true);
    const a = banc.getState().battle!.combatants.find((x) => x.id === A.id)!;
    expect(a.weapons.find((w) => w.uid === 'atk-blade')).toBeUndefined(); // désarmé inline
    // La ligne d'opposition part dans la file différée ; la conséquence est l'étape d'affichage empilée.
    expect(banc.getState().pendingLogQueue.some((q) => /Force/.test(q.line))).toBe(true);
    const result = casc?.participants.find((s) => s.kind === 'issueDuPiegeALame');
    expect(result?.outcome?.some((l) => /BRISÉE|arrachée/.test(l.text))).toBe(true);
  });
});
