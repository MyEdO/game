/**
 * #1262 V1 lot 5c — POSSESSION des BANDES, SÉQUENCES et étapes de combat (`combatFlow`). Même défaut
 * de fond que les lots précédents, sur les quatre derniers producteurs seat-locaux : la composition
 * lisait l'affordance LOCALE (`humanControlled`/`pilotedByHuman` — « qui a la main devant CET écran »)
 * au lieu de la SURFACE (`surfaceOf`/`jetSurfaced` — « un siège humain QUELCONQUE tient ce porteur »).
 * Conséquences mesurées AVANT ce lot, chez l'hôte, pour le héros d'un invité :
 *  - Surprise : hors de la bande, donc son Test opposé roulé par la voie inline ;
 *  - fin de combat : sa Contraction de maladie / son Exposition à la Corruption jetées EN SILENCE ;
 *  - Peur à l'approche, Psychologie de Round : le Test sauté ou résolu sans lui ;
 *  - Déviation Critique (LDB 63 l.30) : le Critique SUBI sans que le choix soit jamais offert, alors
 *    que la source donne la décision à la VICTIME (« Cela ne se produit que si vous le choisissez […]
 *    vous pouvez choisir de laisser votre armure être endommagée de 1 PA ») — et que les deux chemins
 *    JUMEAUX (Critique opposé, projectile magique) n'ont jamais porté ce filtre.
 *
 * En SOLO les deux prédicats coïncident (`ownsLocally` vrai pour tous) : ces régressions y sont
 * INVISIBLES — d'où le harnais à deux sièges (#1262 B7).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import {
  applySurprise, approachFearTrigger, applyAttackResult, applyOpposedCritical,
  openCombatEndCascade, openRoundStartPsych,
} from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { resetDesFixes } from '../engine/fixedDie';
import { surfaceOf } from './rollSeam';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns, humanControlled, pilotedByHuman, jetSurfaced } from './netOwnership';
import { setCadence, resetCadence } from '../engine/cadence';
import { tickCombatAuto } from './combatAuto';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon, HitLocation, ArmourPoints } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import './combat/triggeredTest';

const NET0 = useGame.getState().net;
const g = useGame.getState;
const etapes = () => g().pendingCascade?.participants ?? [];
const parKind = (k: string) => etapes().find((s) => s.kind === k);

/**
 * Combat RÉEL à deux sièges : le siège 1 (invité) possède les héros d'indice `invites`, l'hôte (siège
 * 0) garde les autres. `vivants` borne les ennemis (une bande à UN porteur ne pose pas la même
 * possession qu'une bande à plusieurs).
 */
function setupCoop(opts: { heros?: number; invites?: number[]; vivants?: number } = {}): { H: Combatant[]; E: Combatant[] } {
  const n = opts.heros ?? 1;
  const party = Array.from({ length: n }, (_, i) =>
    createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i + 1 }));
  useGame.setState({ party });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.filter((c) => c.kind === 'hero');
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(opts.vivants ?? 1).forEach((e) => (e.dead = true));
  const E = enemies.slice(0, opts.vivants ?? 1);
  H.forEach((h, i) => (h.pos = { x: 10, y: 10 + i }));
  E.forEach((e, i) => (e.pos = { x: 11 + i, y: 10 }));
  const ownership: Record<string, number> = {};
  for (const i of opts.invites ?? [0]) ownership[H[i].id] = 1;
  useGame.setState({ battle: { ...b }, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] } as never);
  useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership } } as never);
  return { H, E };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllTimers();
  seedBattleRng(4);
  resetDesFixes();
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] } as never);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  resetDesFixes();
  useGame.setState({ net: NET0, battle: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('#1262 lot 5c — la BANDE se compose sur la SURFACE, pas sur l’écran de l’hôte', () => {
  it('Surprise (LDB 13 l.77) : DEUX guetteurs de sièges DIFFÉRENTS → une seule fenêtre, partagée', () => {
    const { H } = setupCoop({ heros: 2, invites: [1] }); // H[0] à l'hôte, H[1] à l'invité
    expect(humanControlled(g(), H[1]), 'chez l’hôte, il ne pilote pas le héros de l’invité…').toBe(false);
    expect(surfaceOf(g, H[1].id), '…mais un siège humain le tient').toBe(true);

    applySurprise(g, useGame.setState, 'party'); // les ennemis embusquent : les héros sont les guetteurs

    const step = parKind('triggeredBatchTest');
    expect(step, 'la bande des guetteurs existe').toBeTruthy();
    expect(step!.participants!.map((p) => p.id).sort()).toEqual([H[0].id, H[1].id].sort());
    const rangee = step!.participants!.find((p) => p.id === H[1].id)!;
    expect(rangee.interactive, 'la rangée de l’invité est À JOUER').toBe(true);
    expect(rangee.result, 'et rien n’a été roulé à sa place').toBeNull();
    expect(step!.groupOwner, 'deux porteurs de sièges différents : la fenêtre est partagée').toBe(true);
    expect(modalOwnerOf(g()), 'owner « * » — chaque siège voit la fenêtre où se tient SA rangée').toBe('*');
  });

  it('Peur à l’approche (LDB 21 l.27) : le craintif de l’invité a SA rangée au lieu d’un jet inline', () => {
    const { H, E } = setupCoop({ heros: 1, invites: [0] });
    H[0].psychState = [{ type: 'peur', sourceId: E[0].id, indice: 2, calmeDR: 0 }] as Combatant['psychState'];
    E[0].pos = { x: 12, y: 10 };

    approachFearTrigger(g, useGame.setState, E[0], { x: 30, y: 30 }); // la source a fini PLUS PRÈS

    const step = parKind('triggeredBatchTest');
    expect(step, 'le craintif de l’invité est dans la bande').toBeTruthy();
    expect(step!.participants!.map((p) => p.id)).toEqual([H[0].id]);
    expect(step!.participants![0].result, 'rien n’a été roulé : la rangée est à jouer').toBeNull();
    expect(step!.actorId, 'une bande d’un seul porteur EST son porteur').toBe(H[0].id);
    expect(modalOwnerOf(g())).toBe(H[0].id);
    expect(seatOwns(g(), 1, H[0].id), 'la fenêtre est au siège 1, qui possède le craintif').toBe(true);
    expect(seatOwns(g(), 0, H[0].id), 'et plus à l’hôte').toBe(false);
  });

  it('Psychologie de Round (LDB 21 l.9) : la bande du porteur de l’invité porte SA possession', () => {
    const { H, E } = setupCoop({ heros: 1, invites: [0] });
    E[0].size = 'enorme'; // gap de Taille ≥ 2 → Terreur

    openRoundStartPsych(g, useGame.setState);

    const step = parKind('combatPsych');
    expect(step, 'la bande de Terreur existe pour le porteur de l’invité').toBeTruthy();
    expect(step!.participants!.map((p) => p.id)).toEqual([H[0].id]);
    expect(step!.actorId, 'un seul porteur : la bande EST la sienne').toBe(H[0].id);
    expect(step!.groupOwner).toBeUndefined();
    expect(step!.combatPsych?.sourceId, 'la déclaration de règle traverse le socle intacte').toBe(E[0].id);
    expect(step!.aggregate, 'rangées INDÉPENDANTES').toBe('none');
    expect(modalOwnerOf(g())).toBe(H[0].id);
    expect(seatOwns(g(), 1, H[0].id)).toBe(true);
  });
});

describe('#1262 lot 5c — la fin de combat ne contracte plus en silence', () => {
  it('Contraction (LDB 20 l.90) : le héros de l’invité reçoit SON étape au lieu d’un jet muet', () => {
    seedBattleRng(4); // ce seed fait ÉCHOUER le Test (+60) : sans fenêtre, la maladie était contractée
    const { H } = setupCoop({ heros: 1, invites: [0] });
    const c = g().battle!.combatants.find((x) => x.id === H[0].id)!;
    c.characteristics.endurance = 30;
    c.tookCriticalThisFight = true;

    openCombatEndCascade(g, useGame.setState);

    const step = parKind('combatEndDisease');
    expect(step, 'la bande influençable existe').toBeTruthy();
    expect(step!.actorId, 'une bande d’un seul porteur EST son porteur').toBe(H[0].id);
    const row = step!.participants!.find((r) => r.id === H[0].id)!;
    expect(row, 'le porteur de l’invité a SA rangée').toBeTruthy();
    expect(row.result, 'c’est la fenêtre de l’invité qui jette').toBeFalsy();
    expect(row.target, 'la cible est calculée — la rangée n’est pas un affichage validé d’office').toBeGreaterThan(0);
    expect(row.menace, 'Résistance (Menace : Maladie) offerte, LDB 10').toBe('maladie');
    expect(c.diseases ?? [], 'rien n’a été contracté en silence chez l’hôte').toHaveLength(0);
    expect(modalOwnerOf(g())).toBe(H[0].id);
    expect(seatOwns(g(), 1, H[0].id), 'la fenêtre est au siège 1, qui possède le porteur').toBe(true);
  });

  /** CONTRAT figé (#1265) : `isOutOfAction` est le critère MÉTIER de CE site — un porteur hors d'action
   *  y tombe dans la voie INLINE (son Test est jeté), là où la fin de Round le SAUTE. Cette divergence
   *  est mesurée, elle ne s'harmonise pas au passage d'une migration de possession. */
  it('porteur INCONSCIENT d’un autre siège : voie inline PRÉSERVÉE (aucune harmonisation)', () => {
    seedBattleRng(4);
    const { H } = setupCoop({ heros: 1, invites: [0] });
    const c = g().battle!.combatants.find((x) => x.id === H[0].id)!;
    c.characteristics.endurance = 30;
    c.tookCriticalThisFight = true;
    c.wounds.current = 0;
    c.conditions = [{ id: 'inconscient', value: 1 }] as Combatant['conditions'];

    openCombatEndCascade(g, useGame.setState);

    expect(parKind('combatEndDisease'), 'hors d’action : aucune fenêtre à ce site').toBeUndefined();
    expect(c.tookCriticalThisFight, 'le marqueur a bien été consommé par la voie inline').toBe(false);
  });
});

describe('#1262 lot 5c — la Déviation Critique appartient à la VICTIME (LDB 63 l.30)', () => {
  const PA = (pa: number): ArmourPoints => ({ tete: pa, corps: pa, brasG: pa, brasD: pa, jambeG: pa, jambeD: pa });
  const hache = { label: 'Hache', name: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], uid: 'hache-1' } as unknown as Weapon;
  const critHit = (loc: HitLocation): AttackResult => ({
    hit: true, attackerRoll: 44, netSL: 4, location: loc, critLocation: loc, damage: 6, woundsLost: 2,
    critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche',
  } as unknown as AttackResult);

  function blinde(c: Combatant): void {
    c.armour = PA(3);
    c.wounds = { current: 40, max: 40, base: 40 } as never;
  }

  it('héros de l’HÔTE : le choix Dévier/Subir est offert (témoin de contrôle)', () => {
    const { H, E } = setupCoop({ heros: 2, invites: [1] });
    const cible = g().battle!.combatants.find((c) => c.id === H[0].id)!;
    blinde(cible);
    seedBattleRng(5);

    const suspendu = applyAttackResult(g, useGame.setState, E[0], cible, hache, critHit('corps'));

    expect(suspendu, 'la résolution est suspendue sur le choix').toBe(true);
    expect(parKind('deviation')).toBeTruthy();
  });

  it('héros de l’INVITÉ : le choix existe AUSSI — il ne subit plus le Critique sans être consulté', () => {
    const { H, E } = setupCoop({ heros: 2, invites: [1] });
    const cible = g().battle!.combatants.find((c) => c.id === H[1].id)!;
    blinde(cible);
    expect(pilotedByHuman(g(), cible), 'chez l’hôte, l’ancien prédicat disait NON…').toBe(false);
    seedBattleRng(5);

    const suspendu = applyAttackResult(g, useGame.setState, E[0], cible, hache, critHit('corps'));

    expect(suspendu, 'la résolution est suspendue sur SON choix').toBe(true);
    const dev = parKind('deviation');
    expect(dev, 'l’offre de Déviation existe pour la victime d’un autre siège').toBeTruthy();
    expect(dev!.actorId).toBe(cible.id);
    expect(dev!.options!.map((o) => o.key)).toEqual(['devier', 'subir']);
    // UNE fenêtre (#1426) : le d100 de sévérité se lance ICI, puis le Critique tiré s'affiche sous la
    // ligne de dé — c'est ce qui rend le choix éclairé, dans la MÊME étape.
    expect(dev!.table, 'la sévérité se tire dans cette fenêtre').toBeTruthy();
    g().cascadeTableRoll(dev!.id);
    expect(parKind('deviation')!.reveal, 'le Critique tiré est montré : le choix est éclairé').toBeTruthy();
    const apres = g().battle!.combatants.find((c) => c.id === cible.id)!;
    expect(apres.wounds.current, 'aucune Blessure appliquée avant la décision').toBe(40);
    expect(apres.criticalWounds ?? 0, 'et aucun Critique subi en silence').toBe(0);
    expect(modalOwnerOf(g())).toBe(cible.id);
    expect(seatOwns(g(), 1, cible.id), 'la décision est au siège qui tient la victime').toBe(true);
  });

  it('JUMEAU `applyOpposedCritical` (LDB 14 l.3) : même offre, même possession — les deux chemins s’alignent', () => {
    const { H, E } = setupCoop({ heros: 2, invites: [1] });
    const cible = g().battle!.combatants.find((c) => c.id === H[1].id)!;
    blinde(cible);
    seedBattleRng(5);

    applyOpposedCritical(g, useGame.setState, cible, 33, { attackerId: E[0].id, weapon: 'Hache' }, []);

    const dev = parKind('deviation');
    expect(dev, 'le jumeau n’a jamais porté le filtre d’affordance locale').toBeTruthy();
    expect(dev!.actorId).toBe(cible.id);
    expect(modalOwnerOf(g())).toBe(cible.id);
  });

  /**
   * LA sonde qui INTERDIT la régression vers `surfaceOf` à ce site. En cadence AUTO les deux prédicats
   * DIVERGENT (`surfaceOf` tombe, `jetSurfaced` tient) : bâtir l'offre sur `surfaceOf` supprimerait
   * l'étape en Rapide/Auto, donc ferait SUBIR le Critique là où le RAW la donne (LDB 63 l.30) et où la
   * cadence se contente de la trancher au défaut. C'est un changement de RÈGLE, pas une migration de
   * possession — d'où le prédicat cadence-AGNOSTIQUE, comme les deux chemins jumeaux.
   */
  describe('le prédicat reste CADENCE-AGNOSTIQUE (interdit la régression vers `surfaceOf`)', () => {
    afterEach(() => resetCadence());

    it('en AUTO les deux prédicats DIVERGENT : `surfaceOf` tombe, `jetSurfaced` tient', () => {
      const { H } = setupCoop({ heros: 1, invites: [] }); // solo : la cadence est la SEULE variable
      const cible = g().battle!.combatants.find((c) => c.id === H[0].id)!;
      setCadence('auto');
      expect(pilotedByHuman(g(), cible), 'ancien prédicat : cadence-agnostique').toBe(true);
      expect(jetSurfaced(g(), cible), 'nouveau prédicat : cadence-agnostique lui aussi').toBe(true);
      expect(surfaceOf(g, cible.id), 'surfaceOf TOMBE en auto — il aurait supprimé l’étape').toBe(false);
    });

    it('en AUTO l’étape se pose quand même et se tranche à `devier` (−1 PA, aucun Critique subi)', () => {
      const { H, E } = setupCoop({ heros: 1, invites: [] });
      const cible = g().battle!.combatants.find((c) => c.id === H[0].id)!;
      blinde(cible);
      setCadence('auto');
      seedBattleRng(5);

      const suspendu = applyAttackResult(g, useGame.setState, E[0], cible, hache, critHit('corps'));

      expect(suspendu, 'suspendu sur le choix, même en auto').toBe(true);
      const dev = parKind('deviation');
      expect(dev, 'l’étape de Déviation EXISTE en cadence auto').toBeTruthy();
      expect(dev!.defaultChoice, 'c’est elle que la cadence retiendra').toBe('devier');
      const avantPA = g().battle!.combatants.find((c) => c.id === cible.id)!.armour.corps;

      tickCombatAuto(g, useGame.setState);

      const apres = g().battle!.combatants.find((c) => c.id === cible.id)!;
      expect(apres.armour.corps, 'du PA a été sacrifié : le défaut « Dévier » a bien été consommé').toBeLessThan(avantPA);
      expect(apres.criticalWounds ?? null, 'et aucun Critique subi').toBeFalsy();
    });
  });
});
