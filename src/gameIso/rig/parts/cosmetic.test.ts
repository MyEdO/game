import { describe, it, expect } from 'vitest';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { pickView } from './types';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';

const sv = (slot: 'visage' | 'cheveux', sp: string, sex: Sexe, idx: number) =>
  pickView(cosmeticPart(slot, sp, sex, idx), 'front');

describe('cosmeticPart', () => {
  it('renvoie un fragment SVG non vide pour visage et cheveux', () => {
    expect(sv('visage', 'Humain', 'M', 0)).toContain('<');
    expect(sv('cheveux', 'Humain', 'M', 0)).toContain('<');
  });
  it('visage généré : l’index choisit une variante dans le pool de la tête (bouton « Variante »)', () => {
    const a = sv('visage', 'Humain', 'M', 0);
    const b = sv('visage', 'Humain', 'M', 1);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
  it('cheveux : l’index choisit une coiffure dans le pool (0 = défaut espèce)', () => {
    const def = sv('cheveux', 'Humain', 'M', 0);
    const pool1 = sv('cheveux', 'Humain', 'M', 1);
    expect(def.length).toBeGreaterThan(20);
    expect(pool1).not.toBe(def); // l'index sélectionne une autre coiffure
  });
  it('normalise les variantes régionales vers l’espèce de base', () => {
    expect(sv('visage', 'Humains (Reiklander)', 'M', 0)).toBe(sv('visage', 'Humain', 'M', 0));
  });
  it('le Nain mâle a une part cheveux distincte (barbe) du Halfling', () => {
    expect(sv('cheveux', 'Nain', 'M', 0)).not.toBe(sv('cheveux', 'Halfling', 'M', 0));
  });
  it('espèce sans art généré (Gnome) : secours sans planter, non vide', () => {
    expect(sv('visage', 'Gnome', 'M', 0)).toContain('<');
    expect(sv('cheveux', 'Gnome', 'M', 999)).toContain('<');
  });
});

describe('cosmeticPart — vues dos/profil E·7 branchées', () => {
  it('une espèce avec vues générées expose back/profile distincts du front', () => {
    const part = cosmeticPart('visage', 'Nain', 'M', 0); // Nain:M a des vues générées
    expect(typeof part).toBe('object'); // PartArt multi-vues
    const front = pickView(part, 'front');
    expect(front).toContain('<');
    expect(pickView(part, 'back')).not.toBe(front);
    expect(pickView(part, 'profile')).not.toBe(front);
  });
  it('la vue de DOS du visage n’a pas d’yeux', () => {
    expect(pickView(cosmeticPart('visage', 'Nain', 'M', 0), 'back')).not.toMatch(/g_eye/);
  });
  it('les cheveux exposent aussi des vues', () => {
    const part = cosmeticPart('cheveux', 'Haut-Elfe', 'F', 0);
    expect(pickView(part, 'back')).not.toBe(pickView(part, 'front'));
  });
  it('repli: une espèce sans tête générée a quand même un DOS correct (nuque, pas le visage de face)', () => {
    const part = cosmeticPart('visage', 'Gnome', 'M', 0); // pas de tête générée
    const back = pickView(part, 'back');
    expect(back).not.toBe(pickView(part, 'front')); // dos = nuque générique, pas le cercle de face
    expect(back).not.toMatch(/g_eye/); // ni yeux luisants de dos
  });
});

describe('genericPart', () => {
  it('fournit un vêtement fallback pour les slots de corps habillés', () => {
    for (const s of ['torse', 'bras', 'jambes'] as const)
      expect(pickView(genericPart(s), 'front')).toContain('<');
  });
  it('tete (couvre-chef) et arme sont vides par défaut (tête nue / mains nues)', () => {
    expect(pickView(genericPart('tete'), 'front')).toBe('');
    expect(pickView(genericPart('arme'), 'front')).toBe('');
  });
});
