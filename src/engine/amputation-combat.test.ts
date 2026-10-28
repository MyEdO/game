/**
 * Pénalité d'amputation (LDB 18, « Traumatisme ») = modificateur CONTEXTUEL À L'ARME, pas un charMod
 * CC/CT global (#101). RAW : « −5 à tous les Tests qui IMPLIQUENT cette main par doigt perdu » (Doigts,
 * l.251) / « −20 à tous les Tests qui UTILISENT cette main » (Main, l.263) — quelle que soit la latéralité ;
 * clause l.263 : si la MAIN PRINCIPALE est perdue, −20 additionnel aux Tests d'Arme de la main SECONDAIRE.
 * Une arme n'implique une main que si elle la TIENT (`weaponUsesHand`) : 2 mains → les deux ; 1 main → la
 * main de tenue. Donc une amputation à GAUCHE ne pénalise PAS une arme à 1 main tenue à DROITE (contra le
 * charMod global, qui pénalisait tout ou rien selon la seule dominance).
 */
import { describe, it, expect } from 'vitest';
import { amputationCombatPenalty, weaponUsesHand, fingersLost, maxFingersLostForWeapon } from './trauma';
import { attackModifiers } from './combat';
import { ligneDe } from './modLine.testkit';
import { RULE_REF } from './ruleRefs';
import type { Combatant, Weapon, Trauma } from './types';

const w1main = { name: 'Épée', type: 'melee', hands: 1, hand: 'main', qualities: [] } as unknown as Weapon; // 1 main, DROITE (principale)
const w1off = { name: 'Dague', type: 'melee', hands: 1, hand: 'off', qualities: [] } as unknown as Weapon;   // 1 main, GAUCHE (secondaire)
const w2 = { name: 'Espadon', type: 'melee', hands: 2, qualities: [] } as unknown as Weapon;                 // 2 mains

const withTraumas = (traumas: Trauma[]): Combatant => ({ traumas } as unknown as Combatant);
const fingers = (loc: 'brasG' | 'brasD', count: number): Trauma => ({ label: '', traumaId: 'doigt-ampute', location: loc, count });
const handLost = (loc: 'brasG' | 'brasD'): Trauma => ({ label: '', traumaId: 'main-bras-ampute', location: loc });

describe('weaponUsesHand (LDB 18)', () => {
  it('arme à 2 mains implique les DEUX mains', () => {
    expect(weaponUsesHand(w2, 'left')).toBe(true);
    expect(weaponUsesHand(w2, 'right')).toBe(true);
  });
  it('arme à 1 main : SEULEMENT la main de tenue (off = gauche, sinon droite)', () => {
    expect(weaponUsesHand(w1main, 'right')).toBe(true);
    expect(weaponUsesHand(w1main, 'left')).toBe(false);
    expect(weaponUsesHand(w1off, 'left')).toBe(true);
    expect(weaponUsesHand(w1off, 'right')).toBe(false);
  });
});

describe('amputationCombatPenalty (LDB 18 l.251/263) — contextuel à l\'arme', () => {
  it('doigts GAUCHES perdus : pénalisent une arme à 2 mains (−5/doigt)', () => {
    expect(amputationCombatPenalty(withTraumas([fingers('brasG', 2)]), w2)).toBe(-10);
  });
  it('doigts GAUCHES : N\'affectent PAS une arme à 1 main DROITE (elle n\'implique pas la main gauche)', () => {
    expect(amputationCombatPenalty(withTraumas([fingers('brasG', 2)]), w1main)).toBe(0);
  });
  it('doigts GAUCHES : affectent une arme à 1 main GAUCHE', () => {
    expect(amputationCombatPenalty(withTraumas([fingers('brasG', 2)]), w1off)).toBe(-10);
  });
  it('doigts DROITS : pénalisent l\'arme à 1 main droite (−5/doigt — le cas déjà couvert avant #101)', () => {
    expect(amputationCombatPenalty(withTraumas([fingers('brasD', 1)]), w1main)).toBe(-5);
  });
  it('MAIN gauche perdue : −20 sur une arme à 2 mains (elle utilise la main gauche)', () => {
    expect(amputationCombatPenalty(withTraumas([handLost('brasG')]), w2)).toBe(-20);
  });
  it('MAIN PRINCIPALE (droite) perdue : −20 aux Tests d\'Arme de la main SECONDAIRE (gauche) — clause l.263', () => {
    expect(amputationCombatPenalty(withTraumas([handLost('brasD')]), w1off)).toBe(-20);
  });
  it('aucune amputation → 0', () => {
    expect(amputationCombatPenalty(withTraumas([]), w1main)).toBe(0);
  });
});

describe('fingersLost / maxFingersLostForWeapon (#144 — source unique, réutilisée par l\'escalade de Maladresse)', () => {
  it('fingersLost compte les doigts perdus À la Localisation demandée', () => {
    expect(fingersLost(withTraumas([fingers('brasD', 3)]), 'brasD')).toBe(3);
    expect(fingersLost(withTraumas([fingers('brasD', 3)]), 'brasG')).toBe(0);
    expect(fingersLost(withTraumas([]), 'brasD')).toBe(0);
  });
  it('maxFingersLostForWeapon : main GAUCHE non impliquée par une arme à 1 main DROITE → 0', () => {
    expect(maxFingersLostForWeapon(withTraumas([fingers('brasG', 2)]), w1main)).toBe(0);
  });
  it('maxFingersLostForWeapon : main DROITE impliquée par w1main → le compte de cette main', () => {
    expect(maxFingersLostForWeapon(withTraumas([fingers('brasD', 2)]), w1main)).toBe(2);
  });
  it('maxFingersLostForWeapon : arme à 2 mains → le MAX entre les deux mains impliquées', () => {
    expect(maxFingersLostForWeapon(withTraumas([fingers('brasG', 1), fingers('brasD', 3)]), w2)).toBe(3);
  });
});

describe('câblage : attackModifiers surface la ligne « Amputation » (effet de combat visible)', () => {
  const attacker = (traumas: Trauma[]): Combatant => ({ advantage: 0, conditions: [], skills: [], traumas } as unknown as Combatant);
  it('doigts gauches + arme à 2 mains → ligne Amputation −10', () => {
    const mods = attackModifiers(attacker([fingers('brasG', 2)]), null, w2, { kind: 'melee' });
    expect(ligneDe(mods, RULE_REF.amputation)?.value).toBe(-10);
  });
  it('doigts gauches + arme à 1 main DROITE → AUCUNE ligne Amputation (l’arme n’implique pas la main gauche)', () => {
    const mods = attackModifiers(attacker([fingers('brasG', 2)]), null, w1main, { kind: 'melee' });
    expect(ligneDe(mods, RULE_REF.amputation)).toBeUndefined();
  });
});
