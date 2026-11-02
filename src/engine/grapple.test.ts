import { describe, it, expect } from 'vitest';
import { areGrappling, setGrapple, clearGrapple, grappleTierMod, grappleEnvMod, peutEtreEmpoigne } from './grapple';
import { combineMods } from './combat';
import { applyOps } from './ops';
import { GRAPPLE } from '../data';
import type { Combatant, ModLine } from './types';
import { desDuTest } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

// Empoignade (Issue #42.1, LDB 14 l.159/161/169).
//  l.159 : « Si vous remportez le Test opposé, vous ET votre adversaire êtes Empoignés, et votre
//           adversaire gagne l'État *Empêtré*. »
//  l.161 : « BF + DR Dégâts […] en IGNORANT tous les PA. »
//  l.169 : « +20 pour toucher le Personnage Empoigné avec le plus FAIBLE Avantage, et +10 pour celui
//           qui a l'Avantage le plus IMPORTANT. »

const C = (id: string, p?: Partial<Combatant>): Combatant => (blessuresSurLeProfil({
  id, name: id, kind: 'hero',
  characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
}) as unknown as Combatant);

describe('areGrappling / setGrapple / clearGrapple — relation symétrique + purge (LDB 14 l.159)', () => {
  it('areGrappling est SYMÉTRIQUE après setGrapple (posé par paire)', () => {
    const a = C('a'), b = C('b');
    expect(areGrappling(a, b)).toBe(false);
    setGrapple(a, b);
    expect(areGrappling(a, b)).toBe(true);
    expect(areGrappling(b, a)).toBe(true);
    expect(a.grapplingWith).toEqual(['b']);
    expect(b.grapplingWith).toEqual(['a']);
    setGrapple(a, b); // idempotent
    expect(a.grapplingWith).toEqual(['b']);
  });
  it('clearGrapple retire des DEUX côtés', () => {
    const a = C('a'), b = C('b');
    setGrapple(a, b);
    clearGrapple(a, b);
    expect(areGrappling(a, b)).toBe(false);
    expect(a.grapplingWith).toEqual([]);
    expect(b.grapplingWith).toEqual([]);
  });
});

describe('grappleTierMod — bonus de tiers +20 / +10 (LDB 14 l.169)', () => {
  it('attaquant hors-Empoignade, cible au PLUS FAIBLE Avantage → +20', () => {
    const att = C('att');
    const lowAdv = C('low', { advantage: 1 });
    const partner = C('high', { advantage: 3 });
    setGrapple(lowAdv, partner);
    const m = grappleTierMod(att, lowAdv, partner);
    expect(m).not.toBeNull();
    expect(m!.value).toBe(20);
  });
  it('cible au PLUS FORT Avantage → +10', () => {
    const att = C('att');
    const lowAdv = C('low', { advantage: 1 });
    const partner = C('high', { advantage: 3 });
    setGrapple(lowAdv, partner);
    const m = grappleTierMod(att, partner, lowAdv);
    expect(m!.value).toBe(10);
  });
  it('attaquant PARTIE à l’Empoignade → AUCUN bonus', () => {
    const a = C('a', { advantage: 2 }), b = C('b', { advantage: 0 });
    setGrapple(a, b);
    expect(grappleTierMod(a, b, a)).toBeNull(); // a est partie prenante (Empoigné avec b)
  });
  it('cible NON Empoignée → null', () => {
    const att = C('att'), target = C('t'), other = C('o');
    expect(grappleTierMod(att, target, other)).toBeNull();
  });
  /** Le bonus naît de l'immobilisation de l'ADVERSAIRE : SITUATIONNEL, donc plafonné avec les autres
   *  circonstances (`LDB 14 l.48`, `l.95`, #1218). En famille `jet`, le +20 s'ajoutait hors plafond. */
  it('est une CIRCONSTANCE : sous des circonstances saturées, le +20 est absorbé (#1218)', () => {
    const att = C('att');
    const low = C('low', { advantage: 1 });
    const high = C('high', { advantage: 3 });
    setGrapple(low, high);
    const m = grappleTierMod(att, low, high)!;
    expect(m.famille).toBe('circonstance');
    // Les plafonds jouent PAR SENS : un bonus se sature contre +60 (`LDB 14 l.95`). Surnombre 3 c.1
    // (+40, `l.56`) + cible À Terre (+20, `l.64`) y sont DÉJÀ.
    const satures: ModLine[] = [
      { label: 'Surnombre (3 c.1)', value: 40, famille: 'circonstance' },
      { label: 'À Terre', value: 20, famille: 'circonstance' },
    ];
    expect(combineMods(satures)).toBe(60);
    expect(combineMods([...satures, m]), 'absorbé : +60 (en famille `jet` : +80)').toBe(60);
    // Hors saturation, le classement ne déplace aucun chiffre.
    expect(combineMods([m])).toBe(20);
  });
  it('grappleEnvMod résout le partenaire dans la liste de combat', () => {
    const att = C('att');
    const low = C('low', { advantage: 0 });
    const high = C('high', { advantage: 4 });
    setGrapple(low, high);
    const m = grappleEnvMod(att, low, [att, low, high]);
    expect(m!.value).toBe(20); // low a l'Avantage le plus faible
    expect(grappleEnvMod(low, high, [att, low, high])).toBeNull(); // low EST partie à l'Empoignade
  });
});

describe('Empoignade — option Dégâts en DONNÉE (GRAPPLE.win.damage) : BF + DR, tous les PA IGNORÉS (LDB 14 l.161)', () => {
  it('Dégâts = BF + DR (ctx.sl), le Bonus d’Endurance est déduit, les PA sont ignorés', () => {
    const actor = C('actor', { characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 50, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Combatant['characteristics'] });
    const target = C('target', { characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Combatant['characteristics'] });
    const before = target.wounds.current;
    applyOps(target, GRAPPLE.win.damage, { rng: desDuTest, caster: actor, sl: 3 }); // BF(5) + DR(3) = 8, − BE(3) = 5
    expect(before - target.wounds.current).toBe(5);
  });
  it('une cible BLINDÉE subit AUTANT qu’une cible nue (PA ignorés)', () => {
    const actor = C('actor', { characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 50, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Combatant['characteristics'] });
    const naked = C('naked', { characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Combatant['characteristics'] });
    const armoured = C('armoured', {
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as Combatant['characteristics'],
      armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 },
    });
    const dn = naked.wounds.current; applyOps(naked, GRAPPLE.win.damage, { rng: desDuTest, caster: actor, sl: 3 });
    const da = armoured.wounds.current; applyOps(armoured, GRAPPLE.win.damage, { rng: desDuTest, caster: actor, sl: 3 });
    expect(dn - naked.wounds.current).toBe(da - armoured.wounds.current); // PA ignorés → même perte
    expect(da - armoured.wounds.current).toBe(5);
  });
});

// LDB 14 l.159 ; AA 10 l.96 ; MDG 13 l.612 ; EDOC 07 l.314 ; #1595 c.6230022636.
describe('peutEtreEmpoigne', () => {
  it.each([
    ['une Structure', { bodyShape: 'structure' }],
    ['un véhicule', { bodyShape: 'vehicule' }],
    ['une pièce inerte', { inert: true }],
  ] as const)('refuse %s', (_nom, p) => {
    expect(peutEtreEmpoigne(C('cible', p as Partial<Combatant>))).toBe(false);
  });
  it.each([
    ['un humanoïde', { bodyShape: 'humanoide' }],
    ['une Nuée', { bodyShape: 'humanoide', traits: [{ id: 'nuee' }] }],
    ['un Éthéré', { bodyShape: 'humanoide', traits: [{ id: 'ethere' }] }],
  ] as const)('accepte %s', (_nom, p) => {
    expect(peutEtreEmpoigne(C('cible', p as unknown as Partial<Combatant>))).toBe(true);
  });
  it('GRAPPLE.init contre une Structure ne pose ni Empoignade ni Empêtré', () => {
    const lutteur = C('lutteur');
    const mur = C('mur', { bodyShape: 'structure' } as Partial<Combatant>);
    applyOps(mur, GRAPPLE.init, { rng: desDuTest, caster: lutteur });
    expect(areGrappling(lutteur, mur)).toBe(false);
    expect(mur.conditions).toEqual([]);
  });
  it('GRAPPLE.init contre un humanoïde pose Empoignade et Empêtré', () => {
    const lutteur = C('lutteur');
    const proie = C('proie', { bodyShape: 'humanoide' } as Partial<Combatant>);
    applyOps(proie, GRAPPLE.init, { rng: desDuTest, caster: lutteur });
    expect(areGrappling(lutteur, proie)).toBe(true);
    expect(proie.conditions.map((c) => c.id)).toContain('empetre');
  });
});
