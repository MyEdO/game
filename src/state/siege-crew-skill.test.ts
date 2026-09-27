import { describe, it, expect } from 'vitest';
import { applyShipPostes, servingCrewPresent, servablePostes } from './shipPostes';
import { firedWeapon } from './combatFlow';
import { crewedFireWeapon, simpleSoloFireWeapon } from '../engine/crewedWeapon';
import { combatValue } from '../engine/combat';
import { mannedPosteWeapon, itemFromTrappingById } from '../engine/items';
import type { Combatant, ShipPoste, SkillInstance, Weapon } from '../engine/types';

/**
 * ARME D'ÉQUIPE — VALIDATION DE COMPÉTENCE D'ÉQUIPAGE & TIR EN SOLO (Aux Armes p.122-124).
 *
 * RAW vérifié (`Source/WH - V4 - Aux Armes/01 - WH - V4 - Aux Armes.md`) :
 *  - l.3900 : « Tous les membres de cette équipe doivent posséder la Compétence Projectiles APPROPRIÉE. »
 *    Groupe requis = en-tête de la table des armes de siège (l.3848-3863) : Baliste = Arbalète ;
 *    Catapultes = Catapulte ; Batterie tonnerre / Canons à répétition = Ingénierie ; Canons / Mortier = Poudre noire.
 *  - l.3816 : Projectiles (Ingénierie) qualifie pour TOUTE arme à Poudre noire (qualifiant universel).
 *  - l.3921 (Exemple 1) : baliste (groupe Arbalète) servie par Arbalète 38 + Arc 55 → l'Arc ne compte PAS
 *    → équipe incomplète (recharge ×2), tir à 38 (le seul servant valide).
 *  - l.3818 : une baliste « relativement simple » tirée par un servant SEUL perd TOUS ses Atouts (garde ses Défauts).
 *
 * Décision produit (NE PAS casser) : « tout le monde peut SERVIR une pièce » — l'action de service reste
 * kind/compétence-agnostique (`servablePostes`). La compétence ne pèse QUE sur le DÉCOMPTE d'équipage effectif.
 */

const CHARS = (CT = 30) => ({ 'capacite-de-combat': 30, 'capacite-de-tir': CT, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });
const proj = (spec: string, advances = 0): SkillInstance => ({ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances });

const mkGunner = (id: string, pos: { x: number; y: number }, skills: SkillInstance[] = [], CT = 30): Combatant =>
  ({ id, name: id, kind: 'hero', characteristics: CHARS(CT), wounds: { current: 12, max: 12 }, advantage: 0,
    conditions: [], skills, talents: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, pos, loaded: true }) as unknown as Combatant;

const mkCrew = (id: string, skills: SkillInstance[] = [], alive = true): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills, talents: [], characteristics: CHARS(30) as never,
    dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), endurance: 30 }, wounds: { current: 60, max: 60 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

const mkEmplacement = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût', kind: 'enemy', pos, conditions: [], weapons: [], wounds: { current: 30, max: 30 },
    advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[]): ShipPoste => ({ item: itemFromTrappingById(engineId)!, crewIds });
const engineWeapon = (engineId: string): Weapon => mannedPosteWeapon(mkGunner('x', { x: 0, y: 0 }), mkPoste(engineId, ['x']))!;

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (a) GATE DE COMPÉTENCE — seul un servant à la BONNE Projectiles compte ; l'Arc ne sert pas une baliste.
//     Reproduit l'Exemple 1 (l.3921) : Arbalète 38 + Arc 55 → équipe incomplète (recharge ×2), tir à 38.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(a) Gate de compétence — Exemple 1 (l.3921) : un servant à Arc ne compte pas pour une baliste', () => {
  it('Arbalète (compte) + Arc (ne compte pas) → effectif valide 1 (sous-effectif)', () => {
    const chefArb = mkGunner('chefArb', { x: 5, y: 6 }, [proj('arbalete', 8)]); // CT 30 + 8 = 38
    const sArc = mkCrew('sArc', [proj('arc', 25)]); // 55, mais Arc ≠ groupe baliste → exclu
    const poste = mkPoste('baliste', ['chefArb', 'sArc']);
    const all = [mkEmplacement(poste), chefArb, sArc];
    applyShipPostes(all); // pose mannedPoste sur le chef (crewIds[0])

    expect(servingCrewPresent(chefArb, all)).toBe(1); // seul l'Arbalète compte
  });

  it('le tir de cette baliste sous-effective double sa Recharge et tire à la valeur du seul servant valide (38)', () => {
    const chefArb = mkGunner('chefArb', { x: 5, y: 6 }, [proj('arbalete', 8)]);
    const sArc = mkCrew('sArc', [proj('arc', 25)]);
    const poste = mkPoste('baliste', ['chefArb', 'sArc']);
    const target = mkEnemy('cible', 9, 6);
    const all = [mkEmplacement(poste), chefArb, sArc, target];
    applyShipPostes(all);

    const w = firedWeapon(chefArb, target, poste.item.uid, all);
    expect(w.reload).toBe(6); // Recharge 3 ×2 (sous-effectif : 1 < Indice 2)
    expect(combatValue(chefArb, 'ranged', w)).toBe(38); // tir à la Projectiles (Arbalète) du chef, pas 55
    expect(w.qualities.some((q) => q.id === 'pointue')).toBe(false); // 1 servant valide → solo → perd ses Atouts (l.3818)
  });

  it('DEUX servants à la bonne Projectiles → équipe complète (recharge normale, Atout conservé)', () => {
    const chefArb = mkGunner('chefArb', { x: 5, y: 6 }, [proj('arbalete', 8)]);
    const s2 = mkCrew('s2', [proj('arbalete')]);
    const poste = mkPoste('baliste', ['chefArb', 's2']);
    const target = mkEnemy('cible', 9, 6);
    const all = [mkEmplacement(poste), chefArb, s2, target];
    applyShipPostes(all);

    expect(servingCrewPresent(chefArb, all)).toBe(2);
    const w = firedWeapon(chefArb, target, poste.item.uid, all);
    expect(w.reload).toBe(3); // effectif complet → pas de ×2
    expect(w.qualities.some((q) => q.id === 'pointue')).toBe(true); // équipe complète → Pointue conservée
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (b) POUDRE NOIRE — Projectiles (Ingénierie) qualifie pour un canon (l.3816) ; un servant à Arbalète non.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(b) Poudre noire — Ingénierie qualifie pour un canon (l.3816)', () => {
  it('Poudre noire + Ingénierie → comptent tous deux ; un servant à Arbalète ne compte pas', () => {
    const chef = mkGunner('chef', { x: 5, y: 6 }, [proj('poudre-noire')]); // canon-petit = groupe Poudre noire
    const sIng = mkCrew('sIng', [proj('ingenierie')]); // qualifiant universel Poudre noire (l.3816)
    const sArb = mkCrew('sArb', [proj('arbalete')]); // mauvais groupe → exclu
    const poste = mkPoste('canon-petit', ['chef', 'sIng', 'sArb']); // Indice 2, Recharge 4
    const all = [mkEmplacement(poste), chef, sIng, sArb];
    applyShipPostes(all);

    expect(servingCrewPresent(chef, all)).toBe(2); // chef (Poudre noire) + sIng (Ingénierie) ; sArb exclu
    const w = firedWeapon(chef, mkEnemy('cible', 9, 6), poste.item.uid, all);
    expect(w.reload).toBe(4); // effectif complet (2 ≥ Indice 2) → Recharge normale
  });

  it('un servant à Ingénierie tire le canon à sa valeur de Projectiles (Ingénierie)', () => {
    const w = engineWeapon('canon-petit');
    const chef = mkGunner('chef', { x: 0, y: 0 }, [proj('ingenierie', 22)]);
    expect(combatValue(chef, 'ranged', w)).toBe(52); // CT 30 + 22
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (c) BALISTE SOLO — l'arme « relativement simple » (l.3818) perd ses Atouts, garde ses Défauts.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(c) Baliste solo — perd ses Atouts, conserve ses Défauts (l.3818)', () => {
  it('`simpleSoloFireWeapon` retire les Atouts (Pointue) et conserve TOUS les Défauts (Recharge, Arme d’équipe)', () => {
    const w = simpleSoloFireWeapon(engineWeapon('baliste'));
    expect(w.qualities.some((q) => q.id === 'pointue')).toBe(false); // Atout retiré
    expect(w.qualities.some((q) => q.id === 'recharge')).toBe(true); // Défaut conservé
    expect(w.qualities.some((q) => q.id === 'arme-d-equipe')).toBe(true); // Défaut conservé
  });

  it('via `crewedFireWeapon(baliste, 1)` : Pointue retirée, Recharge ×2 conservée (composé avec le sous-effectif)', () => {
    const w = crewedFireWeapon(engineWeapon('baliste'), 1); // 1 servant valide
    expect(w.qualities.some((q) => q.id === 'pointue')).toBe(false); // perd ses Atouts
    expect(w.reload).toBe(6); // Recharge 3 ×2 (Défaut, conservé/aggravé)
  });

  it('un canon « non simple » manié seul GARDE ses Atouts (le strip ne vise QUE les pièces flaggées soloSimple)', () => {
    const w = crewedFireWeapon(engineWeapon('batterie-tonnerre-de-feu'), 1); // a l'Atout Explosion/Salve, pas soloSimple
    expect(w.qualities.some((q) => q.id === 'salve')).toBe(true); // Atout conservé (pas une baliste)
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (d) NON-RÉGRESSION — « Servir cette pièce » reste offerte à TOUT combattant adjacent, SANS compétence.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(d) Non-régression — l’action « Servir » ignore la compétence (kind/skill-agnostique)', () => {
  it('un combattant SANS aucune Projectiles, adjacent à un emplacement non servi → action disponible', () => {
    const poste = mkPoste('baliste', []);
    const noob = mkGunner('noob', { x: 5, y: 6 }, []); // aucune compétence Projectiles
    expect(servablePostes(noob, [mkEmplacement(poste), noob])).toHaveLength(1);
  });
});
