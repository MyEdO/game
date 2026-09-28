import { describe, it, expect } from 'vitest';
import { findStructureById, structures } from '../data';
import { footprintN } from '../state/footprint';
import { peurTerreurFromSize } from './psychology';
import { SIZE_RANGED_MOD, effectiveSize, sizeDamageMultiplier, forceOpposedOutcome } from './size';
import { woundsFromHit } from './woundsCalc';
import { isStructure, isEngin, structureImmune, siegeMultiplier, structureCombatant, ramVsNonDoor, structureEnduranceMult, structureTaille } from './structures';
import { improvisedProfile } from './weaponDamage';
import { bonus } from './characteristics';
import { resolveMeleePassive } from './combat';
import { createHero } from './character';
import type { Weapon, Combatant } from './types';

/**
 * Structures destructibles de siège — modèle de Dégâts (ADE II 8). Tests DÉTERMINISTES via
 * `woundsFromHit` (point d'injection unique) : `totalDamage` est l'entrant déjà calculé par l'appelant,
 * donc on contrôle exactement la valeur et on vérifie le Bonus d'Endurance (BE×10 ⇒ bonus = BE), Siège ×2,
 * et les immunités Résistant/Impénétrable/Bélier. RAW : structures sans PA ⇒ `effectiveArmour` = 0.
 * NB : aucun « easeDifficulty » modélisé — ADE II 8 ne facilite PAS le Test de toucher d'une structure.
 */
const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  label: 'arme',
  type: 'melee',
  damage: { plusBF: false, flat: 0 },
  qualities: [],
  ...over,
});

const epee = mkWeapon({ label: 'Épée', type: 'melee' });
const hache = mkWeapon({ label: 'Hache', type: 'melee' });
const fleche = mkWeapon({ label: 'Flèche', type: 'ranged' });
const canon = mkWeapon({ label: 'Canon', type: 'ranged', qualities: [{ id: 'siege' }] }); // Atout Siège (ADE II 08 l.292)
const belier = mkWeapon({ label: 'Bélier', type: 'melee', qualities: [{ id: 'siege' }, { id: 'belier' }] }); // Siège + portes uniquement (l.249)

const struct = (id: string): Combatant => structureCombatant(findStructureById(id)!);
const creature = { bodyShape: 'humanoide' } as Combatant; // cible NON-structure (référence)

describe('structureCombatant (Combatant à PV calqué sur la coque)', () => {
  it('bâtit une Porte ADE II : BE 2 → E 20, Bl 8, inerte', () => {
    const c = struct('porte');
    expect(c.id).toBe('structure-porte');
    expect(c.label).toBe('Porte');
    expect(c.bodyShape).toBe('structure');
    expect(c.characteristics.endurance).toBe(20); // BE 2 × 10 ⇒ bonus(E) = 2
    expect(c.wounds).toEqual({ current: 8, max: 8, base: 8 });
    expect(c.psychImmune).toBe(true);
    expect(c.movement).toBe(0);
    expect(c.creatureId).toBe('porte');
  });

  it('Mur en pierre : BE 12 → E 120, Bl 40, Atout Impénétrable', () => {
    const c = struct('mur-en-pierre');
    expect(c.characteristics.endurance).toBe(120);
    expect(c.wounds.max).toBe(40);
    expect(c.traits).toEqual([{ id: 'impenetrable-structure' }]);
  });
});

describe('woundsFromHit — structures (ADE II 8)', () => {
  it('Épée (mêlée) vs Porte (Résistant) : SUBIT — total − Bonus d\'Endurance, plancher 0', () => {
    // Porte BE 2, Taille Grande ; attaquant Moyen ⇒ BE compté 2 fois (`AA 10 l.98`) : 10 − 4 = 6.
    expect(woundsFromHit(epee, struct('porte'), 'corps', 10, 0, 1, 'moyenne')).toBe(6);
  });

  it('Mur en pierre vs Flèche → 0 (Impénétrable : imparable par toute arme sans Siège)', () => {
    expect(woundsFromHit(fleche, struct('mur-en-pierre'), 'corps', 30, 0, 1, undefined)).toBe(0);
  });

  it('Mur en bois vs Flèche → 0 (Résistant : imparable à distance sans Siège)…', () => {
    expect(woundsFromHit(fleche, struct('mur-en-bois'), 'corps', 30, 0, 1, undefined)).toBe(0);
  });

  it('…MAIS Mur en bois vs Hache (corps à corps) → SUBIT (Résistant ne bloque que la distance)', () => {
    // Mur en bois BE 6, Taille Grande ; attaquant Moyen ⇒ BE compté 2 fois : 30 − 12 = 18.
    expect(woundsFromHit(hache, struct('mur-en-bois'), 'corps', 30, 0, 1, 'moyenne')).toBe(18);
  });

  it('Canon (Siège) vs Mur en pierre → ×2 (double les Dégâts AVANT le Bonus d\'Endurance)', () => {
    // 2 × 20 = 40 ; Mur en pierre BE 12 ⇒ 40 − 12 = 28.
    expect(woundsFromHit(canon, struct('mur-en-pierre'), 'corps', 20, 0, 1, undefined)).toBe(28);
  });

  it('Bélier vs Porte → ×2 (la porte est sa cible légitime + Atout Siège)', () => {
    // 2 × 10 = 20 ; Porte BE 2 ⇒ 20 − 2 = 18.
    expect(woundsFromHit(belier, struct('porte'), 'corps', 10, 0, 1, undefined)).toBe(18);
  });

  it('Bélier hors-porte = Arme improvisée : endommage un Mur, plus de Siège (ADE II 8 l.249)', () => {
    // Hors-porte, le funnel transforme le Bélier en improvisée (cf. effectiveWeapon/weaponContextOf) ; c'est
    // CE profil qui atteint woundsFromHit — ni immune (≠ 0) ni doublé par Siège.
    // 20 − BE 6 compté 2 fois (Grande contre Moyenne, `AA 10 l.98` — l'improvisée a PERDU l'Atout Siège qui l'en exemptait), sans ×2.
    expect(woundsFromHit(improvisedProfile(belier), struct('mur-en-bois'), 'corps', 20, 0, 1, 'moyenne')).toBe(8);
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-bois'))).toBe(false); // mêlée passe le Résistant
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(true); // improvisée sans Siège vs Impénétrable
  });

  it('Bl → 0 : un coup trop faible ne raye PAS la structure (plancher 0, pas 1 comme un personnage)', () => {
    // Hache (mêlée, non immune) vs Mur en bois BE 6 ; 4 − 6 = −2 → plancher 0 (un personnage aurait 1).
    expect(woundsFromHit(hache, struct('mur-en-bois'), 'corps', 4, 0, 1, undefined)).toBe(0);
  });
});

describe('Bonus d’Endurance compté par catégorie de Taille (AA 10 l.98)', () => {
  it('L’EXEMPLE du RAW : mur de château (Énorme, BE 6) à l’épée par un humain Moyen ⇒ BE 18', () => {
    const mur = struct('mur-de-chateau');
    expect(findStructureById('mur-de-chateau')!.taille).toBe('enorme'); // la Taille vient de la DONNÉE, pas du code
    expect(bonus(mur.characteristics.endurance)).toBe(6);
    expect(structureEnduranceMult(epee, mur, 'moyenne')).toBe(3); // 6 × 3 = 18, verbatim RAW
    // 30 Dégâts − 18 = 12 (au lieu de 30 − 6 = 24 sans la règle).
    expect(woundsFromHit(epee, mur, 'corps', 30, 0, 1, 'moyenne')).toBe(12);
  });

  it('Une arme de SIÈGE ignore la restriction : le BE reste compté UNE fois', () => {
    const mur = struct('mur-de-chateau');
    expect(structureEnduranceMult(canon, mur, 'moyenne')).toBe(1);
    // Siège double aussi les Dégâts (ADE II 08 l.292) : 2 × 30 = 60 − 6 = 54.
    expect(woundsFromHit(canon, mur, 'corps', 30, 0, 1, 'moyenne')).toBe(54);
  });

  it('Attaquant de Taille ÉGALE ou SUPÉRIEURE : aucun compte supplémentaire', () => {
    const mur = struct('mur-de-chateau');
    expect(structureEnduranceMult(epee, mur, 'enorme')).toBe(1);
    expect(structureEnduranceMult(epee, mur, 'monstrueuse')).toBe(1);
    expect(woundsFromHit(epee, mur, 'corps', 30, 0, 1, 'enorme')).toBe(24); // 30 − 6
  });

  it('Structure GRANDE contre attaquant Moyen : ×2 (une catégorie d’écart)', () => {
    const porte = struct('porte');
    expect(findStructureById('porte')!.taille).toBe('grande');
    expect(structureEnduranceMult(epee, porte, 'moyenne')).toBe(2);
    expect(structureEnduranceMult(epee, porte, 'petite')).toBe(3); // deux catégories d'écart
  });

  it('Hors Structure, le terme est INERTE (une créature ne voit jamais son BE multiplié)', () => {
    expect(structureEnduranceMult(epee, creature, 'minuscule')).toBe(1);
  });

  it('Le journal du coup DIT le terme — canal existant de la ligne de Dégâts', () => {
    const mur = struct('mur-de-chateau');
    const humain = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Humain', seed: 1 });
    const atk = { roll: 5, target: 100, success: true, sl: 5, isDouble: false };
    expect(resolveMeleePassive(humain, mur, epee, atk).log)
      .toContain('BE 6 × 3 (Taille Énorme contre Moyenne) = 18');
    // Arme de siège de mêlée (sans Bélier, qui hors-porte redeviendrait improvisée) : le terme
    // DISPARAÎT du journal — le BE se compte une fois.
    // `damage` non nul : un profil à +0 est IMPROVISÉ (LDB 62 l.135) et perdrait justement l'Atout Siège.
    const marteauDeSiege = mkWeapon({ label: 'Marteau de siège', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'siege' }] });
    expect(resolveMeleePassive(humain, mur, marteauDeSiege, atk).log).toContain('(BE+PA)');
  });
});

describe('La Taille d’une Structure ne compte QUE son Bonus d’Endurance (AA 10 l.98)', () => {
  it('aucun `Combatant` bâti par `structureCombatant` ne porte `size` — les 24 entrées du catalogue', () => {
    expect(structures.length).toBeGreaterThan(0);
    const porteurs = structures.filter((s) => structureCombatant(s).size !== undefined).map((s) => s.id);
    expect(porteurs).toEqual([]);
    // Toutes portent pourtant leur Taille en DONNÉE : c'est bien la lecture par le catalogue qui la sert.
    expect(structures.filter((s) => !s.taille).map((s) => s.id)).toEqual([]);
  });

  it('le terme du BE se lit au CATALOGUE : mur de château Énorme ⇒ ×3 contre un attaquant Moyen', () => {
    expect(structureEnduranceMult(epee, struct('mur-de-chateau'), 'moyenne')).toBe(3);
    expect(structureTaille(struct('mur-de-chateau'))).toBe('enorme');
    expect(structureTaille(creature)).toBeUndefined();
  });

  it('les CINQ lecteurs du Trait Taille (LDB 85 l.344) restent aveugles à une Structure', () => {
    const mur = struct('mur-de-chateau'); // Énorme en donnée — le pire cas mesuré
    const porte = struct('porte');
    expect(mur.size).toBeUndefined();
    expect(SIZE_RANGED_MOD[effectiveSize(mur.size)]).toBe(SIZE_RANGED_MOD.moyenne); // mod à-toucher au Tir
    expect(footprintN(mur)).toBe(1); // empreinte de grille (`state/footprint.ts` : l'empreinte est DÉCOUPLÉE)
    expect(footprintN(porte)).toBe(1);
    expect(sizeDamageMultiplier('monstrueuse', mur.size)).toBe(3); // écart contre Moyenne, pas contre Énorme (×1)
    expect(forceOpposedOutcome('moyenne', mur.size)).toBe('normal'); // jamais `needCrit`
    expect(peurTerreurFromSize(mur.size, 'moyenne')).toBeNull(); // ni Peur ni Terreur émanant d'un mur
  });
});

describe('structureImmune (unitaire)', () => {
  it('Résistant : flèche (distance) imparable, hache (mêlée) passe', () => {
    expect(structureImmune(fleche, struct('mur-en-bois'))).toBe(true);
    expect(structureImmune(hache, struct('mur-en-bois'))).toBe(false);
    expect(structureImmune(epee, struct('porte'))).toBe(false);
  });

  it('Impénétrable : toute arme sans Siège est imparable (même la mêlée)', () => {
    expect(structureImmune(fleche, struct('mur-en-pierre'))).toBe(true);
    expect(structureImmune(hache, struct('mur-en-pierre'))).toBe(true);
    expect(structureImmune(canon, struct('mur-en-pierre'))).toBe(false); // Siège outrepasse
  });

  it('Bélier hors-porte n\'est PAS une immunité — c\'est une Arme improvisée (ADE II 8 l.249)', () => {
    expect(ramVsNonDoor(belier, struct('mur-en-bois'))).toBe(true);
    expect(ramVsNonDoor(belier, struct('mur-en-pierre'))).toBe(true);
    expect(ramVsNonDoor(belier, struct('porte'))).toBe(false); // porte = cible légitime
    expect(ramVsNonDoor(belier, struct('porte-de-ville'))).toBe(false);
    expect(ramVsNonDoor(hache, struct('mur-en-bois'))).toBe(false); // pas un Bélier
    // structureImmune ne traite plus le Bélier : une fois transformé en improvisée, seules Impénétrable/Résistant jouent.
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(true); // improvisée sans Siège vs Impénétrable
    expect(structureImmune(improvisedProfile(belier), struct('mur-en-bois'))).toBe(false); // mêlée passe le Résistant
  });
});

describe('siegeMultiplier (unitaire)', () => {
  it('×2 pour une arme à Atout Siège ; le Bélier hors-porte (devenu improvisé) ne double plus', () => {
    expect(siegeMultiplier(canon, struct('mur-en-pierre'))).toBe(2);
    expect(siegeMultiplier(belier, struct('porte'))).toBe(2); // porte = cible légitime (Bélier + Siège)
    expect(siegeMultiplier(improvisedProfile(belier), struct('mur-en-pierre'))).toBe(1); // hors-porte : improvisé, plus de Siège
    expect(siegeMultiplier(epee, struct('porte'))).toBe(1); // pas de Siège
    expect(siegeMultiplier(canon, creature)).toBe(1); // cible non-structure
  });
});

describe('isStructure', () => {
  it('vrai pour une structure, faux pour une créature', () => {
    expect(isStructure(struct('porte'))).toBe(true);
    expect(isStructure(creature)).toBe(false);
  });
});

describe('isEngin', () => {
  it('vrai pour un emplacement de siège (engin), faux pour mur/porte et créature', () => {
    expect(isEngin({ bodyShape: 'engin' })).toBe(true);
    expect(isEngin(struct('porte'))).toBe(false); // structure = mur/porte, PAS un affût
    expect(isEngin(creature)).toBe(false);
  });
});
