import { describe, it, expect } from 'vitest';
import { previewResourceDelta } from '../noyau/combatFlow';

/**
 * `previewResourceDelta` (retour « clignotant » des gouttières de l'arche) lit le coût/gain de
 * l'aperçu de clic SANS aucune valeur en dur (anti-duplication — demande utilisateur 2026-06-11,
 * « Action comme Mouvement comme Avantage ») : Mouvement sur `preview.cost` (le coût que le commit
 * consomme), Avantage sur `preview.adv` (source UNIQUE `chargeAdvantage`), Action dérivée de la
 * présence d'un `targetId` (l'attaque consomme l'unique Action). Changer une de ces sources → le
 * clignotant suit, sans toucher ici.
 */
const d = (preview: unknown) => previewResourceDelta({ preview } as never);

describe('previewResourceDelta — coût/gain de l’aperçu, zéro valeur en dur', () => {
  it('aucun aperçu → tout à 0', () => {
    expect(previewResourceDelta(null)).toEqual({ action: 0, move: 0, adv: 0 });
    expect(d(null)).toEqual({ action: 0, move: 0, adv: 0 });
  });
  it('Marche → Mouvement lu sur preview.cost sans Action ; COURSE → + l’Action (LDB 15 l.41)', () => {
    expect(d({ kind: 'move', cost: 3 })).toEqual({ action: 0, move: 3, adv: 0 });
    expect(d({ kind: 'run', cost: 5 })).toEqual({ action: 1, move: 5, adv: 0 });
  });
  it('Attaque → 1 Action (cible visée), rien d’autre prévisualisé', () => {
    expect(d({ kind: 'attack', targetId: 'e' })).toEqual({ action: 1, move: 0, adv: 0 });
  });
  it('Charge → 1 Action + Avantage lu sur preview.adv + Mouvement PLEIN (manœuvre pleine)', () => {
    const base = { kind: 'charge', targetId: 'e', dest: { x: 1, y: 1 }, path: [] };
    expect(d({ ...base, adv: 1 })).toEqual({ action: 1, move: 0, adv: 1 }); // battle mince sans actif → MV inconnu = 0
    expect(d({ ...base, adv: 0 }).adv).toBe(0); // si chargeAdvantage renvoie 0, le clignotant suit
    // Avec un combat complet, la Charge montre TOUT le Mouvement consommé (mountMovement).
    const battle = { preview: { ...base, adv: 1 }, combatants: [{ id: 'h', kind: 'hero', movement: 4, conditions: [], wounds: { current: 9, max: 9 }, characteristics: { force: 30, endurance: 30, agilite: 30 }, weapons: [], armour: {}, skills: [], talents: [] }], order: ['h'], turn: 0 } as never;
    expect(previewResourceDelta(battle).move).toBe(4);
  });
  it('Déplacer-puis-attaquer → 1 Action + Mouvement lu sur preview.cost', () => {
    expect(d({ kind: 'moveAttack', targetId: 'e', dest: { x: 1, y: 1 }, path: [], cost: 4 })).toEqual({ action: 1, move: 4, adv: 0 });
  });
});
