import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from '../noyau/monde/spawn';
import { attackModifiers } from '../engine/combat';
import { ligneDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import type { Weapon } from '../engine/types';

// LDB « Point d'Impact des Créatures » p.312 / 76 l.39 : contre une créature de Taille ≥ 2 catégories
// supérieure, on CHOISIT gratuitement la zone (la plus proche / en Ligne de Vue) — pas le −20 « Difficile » (LDB 14 l.73).
const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };

describe('Localisation visée vs créature ≥ 2 catégories plus grande (LDB 76 l.39)', () => {
  const atk = statblockToCombatant({ type: 'statblock', label: 'A', char: {} }, 'a', { x: 0, y: 0 }); // Moyenne

  it('cible de Taille normale : viser une zone coûte −20 (Difficile, LDB 14 l.73)', () => {
    const t = statblockToCombatant({ type: 'statblock', label: 'T', char: {}, traits: [{ id: 'taille', arg: 'Moyenne' }] }, 't', { x: 1, y: 0 });
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(ligneDe(m, refDeRegle('viser-une-localisation'))?.value).toBe(-20);
  });

  it('cible ≥ 2 catégories plus grande : choix de zone GRATUIT (aucune pénalité)', () => {
    const t = statblockToCombatant({ type: 'statblock', label: 'Géant', char: {}, traits: [{ id: 'taille', arg: 'Énorme' }] }, 't', { x: 1, y: 0 }); // Énorme vs Moyenne = +2
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(ligneDe(m, refDeRegle('viser-une-localisation'))).toBeUndefined();
  });

  it('cible +1 catégorie seulement : viser coûte encore −20', () => {
    const t = statblockToCombatant({ type: 'statblock', label: 'Ogre', char: {}, traits: [{ id: 'taille', arg: 'Grande' }] }, 't', { x: 1, y: 0 }); // Grande vs Moyenne = +1
    const m = attackModifiers(atk, t, sword, { kind: 'melee', location: 'tete' });
    expect(ligneDe(m, refDeRegle('viser-une-localisation'))?.value).toBe(-20);
  });
});
