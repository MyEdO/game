import { describe, it, expect, vi } from 'vitest';
import { resetDiagOnce } from '../devDiag';
import { hairPool, hairIndexById, cosmeticPart, coiffureRetombee, coiffureChoisie, COIFFURE_HORS_POOL } from './cosmetic';
import { hairstylesForSex } from './hairstyles';
import { resolveRig } from '../composeRig';
import { asRigSpeciesId, type Appearance } from '../appearance';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';

/**
 * Imposer une coiffure par ID stable (#637) — `appearance.hairstyle`. On MANIPULE des ids : forcer une
 * coiffure = référencer son id, jamais son index (fragile) ni son label (affichage multilangue).
 * « pas de fallback… corriger, pas contourner » (directive user 2026-07-20, commit d4f5ec5ef).
 */
describe('coiffure imposée par id (#637)', () => {
  const anId = hairstylesForSex('M')[0].id; // une coiffure NOMMÉE réelle (id = slug du nom de fichier)

  it('hairIndexById résout un id vers l’entrée EXACTE du pool (pas un index arbitraire)', () => {
    const pool = hairPool('Humain', 'M');
    const idx = hairIndexById('Humain', 'M', anId)!;
    expect(idx).toBeGreaterThanOrEqual(0);
    expect((pool[idx] as { id?: string }).id).toBe(anId);
  });

  it('deux ids DIFFÉRENTS imposent des coiffures DIFFÉRENTES (l’id sélectionne bien l’art)', () => {
    const ms = hairstylesForSex('M');
    expect(ms.length).toBeGreaterThanOrEqual(2);
    const a = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[0].id)!);
    const b = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[1].id)!);
    expect(a).not.toEqual(b); // l’art rendu diffère selon l’id imposé
    expect(a).toBeTruthy();
  });

  it('un id hors du pool ne résout AUCUN index : jamais l’art d’une autre coiffure', () => {
    expect(hairIndexById('Humain', 'M', 'coiffure-qui-nexiste-pas-xyz')).toBeUndefined();
    expect(hairIndexById('Humain', 'F', anId)).toBeUndefined();
  });
});

/** Donnée d'AUTEUR hors du pool espèce×sexe (verdict 5805847379 de #1897, section E) : le rendu ne lève
 *  pas, il montre la chevelure d'ERREUR (#223) à la place de la part `cheveux`. */
describe('coiffure imposée hors du pool : chevelure d’erreur visible, aucune levée', () => {
  const coiffureM = hairstylesForSex('M')[0].id;
  const apparence = (sex: Sexe): Appearance => ({ species: asRigSpeciesId('humain'), sex, build: 0.5, seed: 1, hairstyle: coiffureM });
  const svgDuRig = (a: Appearance) => resolveRig(a, { weapons: [], armour: [] }, {}, 'nu', 'front').flatMap((b) => b.parts.map((p) => p.svg)).join('');

  it('coiffure M sur un rig F : le rig se compose et porte la chevelure d’erreur', () => {
    expect(hairstylesForSex('F').some((h) => h.id === coiffureM), 'la coiffure est hors du pool F').toBe(false);
    resetDiagOnce();
    const dit = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(svgDuRig(apparence('F'))).toContain(COIFFURE_HORS_POOL);
    expect(dit.mock.calls.map((c) => String(c[0])).some((m) => m.includes(`« ${coiffureM} » hors du pool`)), 'le diagnostic nomme la coiffure').toBe(true);
    dit.mockRestore();
  });

  it('coiffure M sur un rig M : la coiffure imposée, pas l’erreur', () => {
    expect(svgDuRig(apparence('M'))).not.toContain(COIFFURE_HORS_POOL);
  });
});

/** Patron `propRefPatch` (`ui/editor/propDefaults.ts`) : un geste d'édition ne crée pas la faute. */
describe('coiffureRetombee — la coiffure sortie du pool retombe dans le même patch', () => {
  const coiffureM = hairstylesForSex('M')[0].id;

  it('sexe passé à F : la coiffure M est retirée, le reste de l’apparence est gardé', () => {
    expect(coiffureRetombee({ sex: 'F' as const, hairstyle: coiffureM, build: 0.3 })).toEqual({ sex: 'F', build: 0.3 });
  });

  it('coiffure du pool : l’apparence est rendue telle quelle', () => {
    const a = { sex: 'M' as const, hairstyle: coiffureM };
    expect(coiffureRetombee(a)).toBe(a);
  });

  it('sexe non posé : rien à juger, la coiffure reste', () => {
    const a = { hairstyle: coiffureM };
    expect(coiffureRetombee(a)).toBe(a);
  });

  it('coiffure inconnue : elle reste, le schéma la nomme', () => {
    const a = { sex: 'F' as const, hairstyle: 'zzz' };
    expect(coiffureRetombee(a)).toBe(a);
  });
});

describe('coiffureChoisie — choisir une coiffure pose son sexe', () => {
  it('coiffure F choisie : le patch porte la coiffure ET le sexe F', () => {
    const coiffureF = hairstylesForSex('F')[0].id;
    expect(coiffureChoisie(coiffureF)).toEqual({ hairstyle: coiffureF, sex: 'F' });
  });

  it('aucune coiffure : le patch retire la coiffure sans toucher au sexe', () => {
    expect(coiffureChoisie(undefined)).toEqual({ hairstyle: undefined });
  });
});
