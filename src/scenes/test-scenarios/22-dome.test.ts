import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './22-dome';
import { applyAttackResult, runEnemyAI, applyCast } from '../../state/combatFlow';
import { findSpellById } from '../../data';
import type { CastResult } from '../../engine/magic';
import { seedBattleRng } from '../../state/battleRng';
import { draineEtLit } from '../../state/cascadeTestKit';
import type { Combatant, Weapon } from '../../engine/types';
import type { AttackResult } from '../../engine/combat';
const scenarioConstruit = scenario.construire();

/**
 * DÔME (`LDB 47 l.410`) : preuve LIVE sur la scène RÉELLE du scénario — le sort du CATALOGUE (ses ops,
 * son Indice en donnée) pose l'aura, et c'est le vrai chemin de touche (`applyAttackResult`) qui décide.
 * Un TIR venu du dehors ouvre la sauvegarde ; le MÊME coup en MÊLÉE n'en ouvre aucune.
 */

const tir = (): AttackResult => ({
  hit: true, attackerRoll: 30, netSL: 3, location: 'corps', damage: 6, woundsLost: 4,
  critical: false, advantageTo: null, defenderDefeated: false, log: '',
});

const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] } as unknown as Weapon;
const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] } as unknown as Weapon;

/** Ouvre le combat du scénario et POSE le Dôme par les ops du sort CURÉ (jamais une aura à la main). */
function startDome(): { sorciere: Combatant; protegee: Combatant; archer: Combatant; orc: Combatant } {
  useGame.setState({ battle: null, party: scenario.construire().party });
  useGame.getState().startScene(scenarioConstruit.scene);
  useGame.getState().startCombat('enc-dome');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const sorciere = b.combatants.find((c) => c.id === 'sorciere')!;
  const protegee = b.combatants.find((c) => c.id === 'protegee')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  // Le Dôme est lancé par le VRAI chemin (`applyCast`) : c'est lui qui résout la ZdE de la ligne
  // « Cible » et la confie aux ops. Rien n'est recopié ici, ni zone ni Indice.
  const dome = findSpellById('dome')!;
  const ok: CastResult = { cast: true, roll: 30, target: 70, sl: 0, isCritical: false, isFumble: false, log: 'ok' };
  applyCast(useGame.getState, useGame.setState, sorciere, sorciere, dome as never, ok, false, false);
  return { sorciere, protegee, archer: enemies[0], orc: enemies[1] };
}

describe('Dôme — la sauvegarde qu’une zone OCTROIE (LDB 47 l.410)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); seedBattleRng(1); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('le sort pose une aura dont l’Indice vient de la DONNÉE, et sa ZdE est un DIAMÈTRE (LDB 47 l.28)', () => {
    const { sorciere } = startDome();
    const aura = (sorciere.activeEffects ?? []).find((e) => e.domeWard)!.domeWard!;
    expect(aura.ward, 'le Trait octroyé voyage avec l’aura').toEqual({ id: 'protection', value: 6 });
    // La ligne « Cible » du sort donne un DIAMÈTRE de (Bonus de FM) mètres : le rayon en vaut la moitié.
    const bfm = Math.floor(sorciere.characteristics['force-mentale'] / 10);
    expect(aura.radiusMeters, 'rayon = diamètre / 2').toBe(bfm / 2);
  });

  it('le TIREUR agit d’abord en TIRANT (sinon la condition « de l’extérieur » ne se produit jamais)', () => {
    const { archer } = startDome();
    expect(archer.weapons?.some((w) => w.type === 'ranged'), 'l’arc vient de la DONNÉE du scénario').toBe(true);
    const b = useGame.getState().battle!;
    const avant = b.log.length;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(archer.id), acted: false, action: null, movementUsed: 0 } });
    runEnemyAI(useGame.getState, useGame.setState, archer.id);
    vi.runOnlyPendingTimers();
    const lignes = useGame.getState().battle!.log.slice(avant);
    expect(lignes.some((l) => l.kind === 'shoot'), `premier acte du tireur : ${lignes.map((l) => l.text).join(' | ')}`).toBe(true);
  });

  it('TIR de l’extérieur sur la protégée : la sauvegarde s’ouvre À LA PORTE et nomme le Trait', () => {
    const { protegee, archer } = startDome();
    const avant = protegee.wounds.current;
    let sauve = false;
    // Le dé peut rater : on rejoue jusqu'à voir la sauvegarde tomber — c'est SA ligne qu'on vient lire.
    for (let i = 0; i < 40 && !sauve; i++) {
      protegee.wounds.current = avant;
      // Depuis #1508 le coup est SUSPENDU sur l'étape de dé : c'est la fenêtre qui jette le 1d10.
      const suspendu = applyAttackResult(useGame.getState, useGame.setState, archer, protegee, arc, tir());
      expect(suspendu, 'le coup doit être suspendu sur sa sauvegarde, jamais résolu en silence').toBe(true);
      sauve = draineEtLit(useGame.getState).some((x) => /sauvegarde 1d10 : \d+ ≥ Protection \(6\+\) du Dôme\./.test(x));
    }
    expect(sauve, 'aucune sauvegarde du Dôme en 40 tirs : elle ne s’ouvre pas').toBe(true);
  });

  it('CHAQUE coup reçu sous le dôme écrit SA sauvegarde — réussie OU ratée, jamais rien', () => {
    // Le défaut vécu : la ratée ne s'écrivait pas, et le joueur voyait ses Blessures tomber sous sa
    // propre protection sans une ligne pour l'expliquer.
    const { protegee, archer } = startDome();
    // Les étapes s'APPENDENT à la séquence de l'arène (doctrine du slot) : ce qu'un tir ajoute se lit
    // donc en DELTA de ce que le joueur a lu, jamais en valeur absolue.
    let vues = 0;
    for (let i = 0; i < 20; i++) {
      protegee.wounds.current = 30;
      applyAttackResult(useGame.getState, useGame.setState, archer, protegee, arc, tir());
      const lignes = draineEtLit(useGame.getState);
      const total = lignes.filter((x) => /sauvegarde 1d10 : \d+ [≥<] Protection \(6\+\) du Dôme\./.test(x)).length;
      expect(
        total - vues,
        `tir ${i + 1} — une ligne de sauvegarde et une seule : ${lignes.join(' | ')}`,
      ).toBe(1);
      vues = total;
    }
  });

  it('MÊLÉE sous la voûte : « magiques ou à distance » — aucune sauvegarde ne répond', () => {
    const { protegee, orc } = startDome();
    const lues: string[] = [];
    for (let i = 0; i < 40; i++) {
      protegee.wounds.current = 20;
      const suspendu = applyAttackResult(useGame.getState, useGame.setState, orc, protegee, epee, tir());
      expect(suspendu, 'aucune étape de sauvegarde ne s’ouvre en mêlée sous la voûte').toBe(false);
      lues.push(...draineEtLit(useGame.getState));
    }
    expect(
      [...useGame.getState().battle!.log.map((l) => l.text), ...lues].some((x) => x.includes('du Dôme')),
      'le dôme ne couvre pas le corps à corps',
    ).toBe(false);
  });
});
