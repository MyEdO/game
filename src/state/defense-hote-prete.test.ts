import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { scenario } from '../scenes/test-scenarios/entrainement';
import { maybeOpenDefense } from './combatFlow';
import { spawnEnemy } from './spawn';
import { pickActiveModalKey } from './modalArbiter';
import { avanceEtapeCascade } from './cascadeTestKit';
import { seedBattleRng } from './battleRng';
import { parseQualityInstance } from '../engine/qualities/normalize';
import { combatAdvanceBlocked } from './combatGate';
import type { Weapon } from '../engine/types';

/**
 * UNE ÉTAPE HÔTE N'EST PRÊTE QU'UNE FOIS SA DONNÉE RENDUE (#1765) — la fenêtre de défense du 2ᵉ maillon
 * d'un balayage, posée DERRIÈRE les Tests de la Déstabilisante (LDB 62), ne se franchit ni par un
 * « Suivant » de trop ni par « Tout lancer » : le défenseur la joue (LDB 85 l.41-43). Une `pendingDefense`
 * vivante gèle l'avancée du combat.
 */
const g = () => useGame.getState();

function setup(seed: number) {
  vi.clearAllTimers();
  seedBattleRng(seed);
  const built = scenario.construire();
  useGame.setState({ battle: null, party: built.party });
  g().startScene(built.scene);
  g().startCombat('enc-entrainement', undefined, { noSurprise: true });
  vi.clearAllTimers();
  for (let i = 0; i < 20 && (g().pendingRoundStart || g().pendingCascade); i++) {
    if (g().pendingRoundStart) g().confirmRoundStart(); else avanceEtapeCascade(g);
    vi.clearAllTimers();
  }
  const b = g().battle!;
  const tireur = b.combatants.find((c) => c.id === 'tr-tireur')!;
  const autre = b.combatants.find((c) => c.id === 'pregen-101')!;
  let far = 0;
  for (const c of b.combatants) if (c !== tireur && c !== autre) { c.pos = { x: 12 + (far % 12), y: 2 * Math.floor(far / 12) }; far++; }
  tireur.pos = { x: 3, y: 8 }; autre.pos = { x: 3, y: 10 };
  const ours = spawnEnemy({ ref: 'ours' }, 'spawn-ours', { x: 4, y: 8 });
  const destab = parseQualityInstance('Déstabilisante');
  if (!destab) throw new Error('qualité Déstabilisante introuvable');
  ours.weapons = ours.weapons.map((w: Weapon, i: number) => (i === 0 ? { ...w, qualities: [...(w.qualities ?? []), destab] } : w));
  ours.advantage = 3;
  const order = [...b.order, ours.id];
  useGame.setState({ battle: { ...b, combatants: [...b.combatants, ours], order, turn: order.indexOf(ours.id), acted: false, movementUsed: 0, movedPreAction: false, action: null, aiTurnPlayed: undefined } });
  return { tireur, ours: g().battle!.combatants.find((c) => c.id === 'spawn-ours')! };
}

/** Le coup de l'ours touche le Tireur et balaie : la défense du maillon suivant attend derrière les
 *  Tests de la Déstabilisante. Rend `false` pour une graine qui ne produit pas cette situation. */
function jusquALaChaineDestabilisee(seed: number): boolean {
  const { tireur, ours } = setup(seed);
  if (!maybeOpenDefense(g, useGame.setState, ours, tireur, undefined, undefined, ours.chargedThisTurn)) return false;
  g().defenseRoll();
  if (!g().pendingDefense?.result?.hit) return false;
  g().defenseConfirm();
  const s = g();
  if (s.pendingDefense?.suite.mode !== 'machine' || s.pendingDefense.suite.coup.enchainement?.mode !== 'chaine') return false;
  return (s.pendingCascade?.participants ?? []).some((p) => p.kind === 'triggeredTest');
}

const etapeCourante = () => { const c = g().pendingCascade; return c?.participants[c.cursor]; };

/** Avance les Tests de la Déstabilisante jusqu'à l'étape de défense du maillon. */
function jusquALaDefense(): void {
  for (let i = 0; i < 20 && etapeCourante() && etapeCourante()!.jet !== 'defense'; i++) avanceEtapeCascade(g);
}

describe('#1765 — une étape hôte de défense n’est prête que sa défense validée', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('un « Suivant » de trop sur l’étape de défense ne la franchit pas : sa fenêtre reste élue', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquALaChaineDestabilisee(seed)) continue;
      mesures++;
      jusquALaDefense();
      expect(etapeCourante()?.jet, `graine ${seed}`).toBe('defense');
      const pd = g().pendingDefense;
      g().cascadeNext();
      expect(g().pendingDefense, `graine ${seed} : la défense du maillon vit`).toBe(pd);
      expect(etapeCourante()?.jet, `graine ${seed} : le curseur reste sur la défense`).toBe('defense');
      expect(pickActiveModalKey(g()), `graine ${seed}`).toBe('cascade');
    }
    expect(mesures, 'aucune graine ne mesure la chaîne déstabilisée').toBeGreaterThan(0);
  });

  it('« Tout lancer » des Tests de la Déstabilisante s’arrête sur la défense du maillon', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquALaChaineDestabilisee(seed)) continue;
      mesures++;
      g().cascadeResolveAll();
      expect(etapeCourante()?.jet, `graine ${seed} : le curseur s’arrête sur la défense`).toBe('defense');
      expect(etapeCourante()?.committed, `graine ${seed}`).toBeFalsy();
      expect(g().pendingDefense?.result, `graine ${seed} : la défense reste à jouer`).toBeNull();
    }
    expect(mesures, 'aucune graine ne mesure la chaîne déstabilisée').toBeGreaterThan(0);
  });

  it('« Appliquer » hors de l’étape de défense est refusé : la fenêtre ne se ferme que depuis son étape', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquALaChaineDestabilisee(seed)) continue;
      const avant = etapeCourante();
      if (avant?.jet === 'defense') continue;
      g().defenseRoll();
      const pd = g().pendingDefense;
      if (!pd?.result) continue;
      mesures++;
      g().defenseConfirm();
      expect(g().pendingDefense, `graine ${seed} : la défense du maillon vit encore`).toBe(pd);
      expect(etapeCourante(), `graine ${seed} : le curseur n’a pas bougé`).toBe(avant);
      const c = g().pendingCascade!;
      expect(c.participants.slice(c.cursor).find((p) => p.jet === 'defense')?.committed, `graine ${seed} : l’étape du maillon reste à valider`).toBeFalsy();
    }
    expect(mesures, 'aucune graine ne mesure une défense résolue hors de son étape').toBeGreaterThan(0);
  });

  it('une `pendingDefense` vivante bloque l’avancée du combat, même sans séquence ouverte', () => {
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquALaChaineDestabilisee(seed)) continue;
      expect(combatAdvanceBlocked({ ...g(), pendingCascade: null })).toBe(true);
      return;
    }
    throw new Error('aucune graine ne mesure la chaîne déstabilisée');
  });
});
