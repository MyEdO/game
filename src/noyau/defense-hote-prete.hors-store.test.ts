import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { scenario } from '../scenes/test-scenarios/entrainement';
import { maybeOpenDefense } from './combatFlow';
import { spawnEnemy } from './monde/spawn';
import { pickActiveModalKey } from './modalArbiter';
import { avanceEtapeCascade } from './cascade.testkit';
import { seedBattleRng } from './battleRng';
import { parseQualityInstance } from '../data/refFormatLivre';
import { combatAdvanceBlocked } from './combatGate';
import type { Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * UNE ÉTAPE HÔTE N'EST PRÊTE QU'UNE FOIS SA DONNÉE RENDUE (#1765) — la fenêtre de défense du 2ᵉ maillon
 * d'un balayage, posée DERRIÈRE les Tests de la Déstabilisante (LDB 62), ne se franchit ni par un
 * « Suivant » de trop ni par « Tout lancer » : le défenseur la joue (LDB 85 l.41-43). Une `pendingDefense`
 * vivante gèle l'avancée du combat.
 */
const g = () => banc.getState();

function setup(seed: number, { destabilisante = true } = {}) {
  seedBattleRng(seed);
  const built = scenario.construire(idsDeTest);
  banc.setState({ battle: null, party: built.party });
  g().lancerLaScene(built.scene);
  g().lancerLeCombat('enc-entrainement', undefined, { noSurprise: true });
  for (let i = 0; i < 20 && (g().pendingRoundStart || g().pendingCascade); i++) {
    if (g().pendingRoundStart) g().fenetreValider('debutDuRound'); else avanceEtapeCascade(g);
  }
  const b = g().battle!;
  const tireur = b.combatants.find((c) => c.id === 'tr-tireur')!;
  const autre = b.combatants.find((c) => c.id === 'soldat-de-test')!;
  let far = 0;
  for (const c of b.combatants) if (c !== tireur && c !== autre) { c.pos = { x: 12 + (far % 12), y: 2 * Math.floor(far / 12) }; far++; }
  tireur.pos = { x: 3, y: 8 }; autre.pos = { x: 3, y: 10 };
  const ours = spawnEnemy({ ref: 'ours' }, 'spawn-ours', { x: 4, y: 8 });
  if (destabilisante) {
    const destab = parseQualityInstance('Déstabilisante');
    if (!destab) throw new Error('qualité Déstabilisante introuvable');
    ours.weapons = ours.weapons.map((w: Weapon, i: number) => (i === 0 ? { ...w, qualities: [...(w.qualities ?? []), destab] } : w));
  }
  ours.advantage = 3;
  const order = [...b.order, ours.id];
  banc.setState({ battle: { ...b, combatants: [...b.combatants, ours], order, turn: order.indexOf(ours.id), acted: false, movementUsed: 0, movedPreAction: false, action: null, tourEnCours: undefined } });
  return { tireur, ours: g().battle!.combatants.find((c) => c.id === 'spawn-ours')! };
}

/** Le coup de l'ours touche le Tireur : les Tests de la Déstabilisante tiennent la main, aucune défense n'est posée
 *  avant eux (#4011). Rend `false` pour une graine qui ne produit pas cette situation. */
function jusquAuxTestsDeLaDestabilisante(seed: number): boolean {
  const { tireur, ours } = setup(seed);
  if (!maybeOpenDefense(g, banc.setState, ours, tireur, undefined, undefined, ours.chargedThisTurn)) return false;
  g().jetLancer('defense');
  if (!g().pendingDefense?.result?.hit) return false;
  g().jetValider('defense');
  return (g().pendingCascade?.participants ?? []).some((p) => p.kind === 'testDeclenche' && !p.committed);
}

const etapeCourante = () => { const c = g().pendingCascade; return c?.participants[c.cursor]; };

/** La défense posée est celle du maillon suivant du balayage. */
const defenseDuMaillon = () => { const suite = g().pendingDefense?.suite; return suite?.mode === 'machine' && suite.coup.enchainement?.mode === 'chaine'; };

/** Avance les Tests de la Déstabilisante jusqu'à l'étape de défense du maillon. */
function jusquALaDefense(): void {
  for (let i = 0; i < 20 && etapeCourante() && etapeCourante()!.jet !== 'defense'; i++) avanceEtapeCascade(g);
}

describe('#1765 — une étape hôte de défense n’est prête que sa défense validée', () => {
  it('tant qu’un Test de la Déstabilisante est au curseur, la défense du maillon n’est pas posée (#4011) ; elle l’est après eux', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquAuxTestsDeLaDestabilisante(seed)) continue;
      expect(etapeCourante()?.kind, `graine ${seed}`).toBe('testDeclenche');
      expect(g().pendingDefense, `graine ${seed} : aucune défense devant le Test`).toBeNull();
      jusquALaDefense();
      if (!defenseDuMaillon()) continue;
      mesures++;
      expect(etapeCourante()?.jet, `graine ${seed}`).toBe('defense');
      expect(g().pendingCascade!.participants.filter((p) => p.kind === 'testDeclenche').every((p) => p.committed), `graine ${seed}`).toBe(true);
    }
    expect(mesures, 'aucune graine ne mesure la chaîne déstabilisée').toBeGreaterThan(0);
  });

  it('un « Suivant » de trop sur l’étape de défense ne la franchit pas : sa fenêtre reste élue', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquAuxTestsDeLaDestabilisante(seed)) continue;
      jusquALaDefense();
      if (!defenseDuMaillon()) continue;
      mesures++;
      expect(etapeCourante()?.jet, `graine ${seed}`).toBe('defense');
      const pd = g().pendingDefense;
      g().jetValider('cascade');
      expect(g().pendingDefense, `graine ${seed} : la défense du maillon vit`).toBe(pd);
      expect(etapeCourante()?.jet, `graine ${seed} : le curseur reste sur la défense`).toBe('defense');
      expect(pickActiveModalKey(g()), `graine ${seed}`).toBe('cascade');
    }
    expect(mesures, 'aucune graine ne mesure la chaîne déstabilisée').toBeGreaterThan(0);
  });

  it('« Tout lancer » des Tests de la Déstabilisante s’arrête sur la défense du maillon', () => {
    let mesures = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquAuxTestsDeLaDestabilisante(seed)) continue;
      g().jetLancer('cascade');
      if (!defenseDuMaillon()) continue;
      mesures++;
      expect(etapeCourante()?.jet, `graine ${seed} : le curseur s’arrête sur la défense`).toBe('defense');
      expect(etapeCourante()?.committed, `graine ${seed}`).toBeFalsy();
      expect(g().pendingDefense?.result, `graine ${seed} : la défense reste à jouer`).toBeNull();
    }
    expect(mesures, 'aucune graine ne mesure la chaîne déstabilisée').toBeGreaterThan(0);
  });

  it('une `pendingDefense` vivante bloque l’avancée du combat, même sans séquence ouverte', () => {
    for (let seed = 1; seed <= 6; seed++) {
      if (!jusquAuxTestsDeLaDestabilisante(seed)) continue;
      jusquALaDefense();
      if (!defenseDuMaillon()) continue;
      expect(combatAdvanceBlocked({ ...g(), pendingCascade: null })).toBe(true);
      return;
    }
    throw new Error('aucune graine ne mesure la chaîne déstabilisée');
  });

  it('« Appliquer » hors de l’étape de défense est refusé : la fenêtre ne se ferme que depuis son étape', () => {
    // Graine 2, arme sans Déstabilisante : le coup touche, la Déviation se valide, et la défense du maillon
    // suivant est posée quand le curseur est sur l'étape `critique`.
    const { tireur, ours } = setup(2, { destabilisante: false });
    expect(maybeOpenDefense(g, banc.setState, ours, tireur, undefined, undefined, ours.chargedThisTurn)).toBe(true);
    g().jetLancer('defense');
    expect(g().pendingDefense?.result?.hit).toBe(true);
    g().jetValider('defense');
    expect(etapeCourante()?.kind).toBe('deviation');
    avanceEtapeCascade(g);
    const avant = etapeCourante();
    expect(avant?.kind).toBe('critique');
    expect(defenseDuMaillon()).toBe(true);
    g().jetLancer('defense');
    const pd = g().pendingDefense;
    expect(pd?.result).toBeTruthy();
    g().jetValider('defense');
    expect(g().pendingDefense, 'la défense du maillon vit encore').toBe(pd);
    expect(etapeCourante(), 'le curseur n’a pas bougé').toBe(avant);
  });
});
