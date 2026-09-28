import { describe, it, expect } from 'vitest';
import { WEAPON_FORMS, SHIELD_FORMS } from './weaponForms';
import { weaponFamily, shieldPart } from './equipment';
import { declaredView } from '../viewArt';
import { trappings } from '../../../data';
import type { Weapon } from '../../../engine/types';

/** Arme minimale routée PAR SHAPE (id stable) — plus aucun routage par libellé. */
const byShape = (shape: string | undefined, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ label: 'x', type, damage: { plusBF: false, flat: 4 }, qualities: [], shape } as Weapon);

/** Sous-types NON tenus en main → hors contrat de silhouette : engins de siège servis par un équipage
 *  et munitions/projectiles. Le rig ne dessine pas d'arme portée pour eux. */
const NON_PORTEE = new Set(['armes-de-siege', 'munitions']); // ids de Groupe

const WEAPON_SLUGS = new Set(WEAPON_FORMS.map((f) => f.slug));
const SHIELD_SLUGS = new Set(SHIELD_FORMS.map((f) => f.slug));
const isWeaponShape = (s: string) => WEAPON_SLUGS.has(s);

describe('weaponForms — shape catalogué sur les armes tenues en main', () => {
  it('chaque arme melee/ranged de la donnée (hors siège & munitions) porte un shape = slug réel', () => {
    const bad = (trappings as { id: string; label: string; categorie: string; subType?: string; shape?: string }[])
      .filter((t) => (t.categorie === 'melee' || t.categorie === 'ranged') && !NON_PORTEE.has(t.subType ?? ''))
      .filter((t) => t.id !== 'mains-nues') // Mains nues : aucune silhouette tenue (pas de shape) — par design
      .filter((t) => !(t.shape && (isWeaponShape(t.shape) || SHIELD_SLUGS.has(t.shape))))
      .map((t) => `${t.label} → shape=${t.shape ?? '∅'}`);
    expect(bad).toEqual([]);
  });

  it('chaque formChoices d’un trapping est un shape d’arme résolvable (∈ WEAPON_SLUGS)', () => {
    const bad = (trappings as { id: string; label: string; formChoices?: string[] }[])
      .filter((t) => t.formChoices?.length)
      .flatMap((t) => (t.formChoices ?? []).filter((s) => !isWeaponShape(s)).map((s) => `${t.label} → ${s}`));
    expect(bad).toEqual([]);
  });

  it('Mains nues n’a pas de shape (aucune arme dessinée)', () => {
    const mn = (trappings as { id: string; shape?: string }[]).find((t) => t.id === 'mains-nues');
    expect(mn?.shape).toBeUndefined();
  });

  it('slugs uniques et non vides', () => {
    const slugs = WEAPON_FORMS.map((f) => f.slug);
    expect(slugs.every((s) => /^[a-z0-9_]+$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('90 armes-arts + 4 boucliers', () => {
    expect(WEAPON_FORMS).toHaveLength(90);
    expect(SHIELD_FORMS).toHaveLength(4);
  });
});

describe('routage de l’art PAR ID (shape) — plus aucun libellé', () => {
  it('chaque forme d’arme catalogue résout vers son propre slug via shape', () => {
    const bad = WEAPON_FORMS.filter((f) => weaponFamily(byShape(f.slug, f.type)) !== f.slug)
      .map((f) => `${f.slug} → ${weaponFamily(byShape(f.slug, f.type))}`);
    expect(bad).toEqual([]);
  });

  it('formes de base de l’« Arme simple » (épée/hache/masse) routées par shape vers leur propre forme', () => {
    expect(weaponFamily(byShape('epee'))).toBe('epee'); // épée générique = def du registre
    expect(weaponFamily(byShape('hache'))).toBe('hache');
    expect(weaponFamily(byShape('masse'))).toBe('masse');
  });

  it('une attaque naturelle (natural:true) → aucune arme tenue', () => {
    expect(weaponFamily({ label: 'Morsure', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [], natural: true } as Weapon)).toBe('');
  });

  it('un shape inconnu retombe sur le Groupe (pas de crash, pas de routage par nom)', () => {
    expect(weaponFamily(byShape('forme_inexistante', 'melee'))).not.toBe('forme_inexistante');
    expect(weaponFamily(byShape(undefined, 'ranged'))).toBe('arc'); // défaut distance
  });
});

describe('boucliers (registre data-driven shields/defs) — routés par shape', () => {
  const front = (a: ReturnType<typeof shieldPart>) => declaredView(a, 'front');
  it('chaque bouclier du catalogue a SA silhouette (toutes distinctes) routée par shape', () => {
    const arts = SHIELD_FORMS.map((f) => front(shieldPart(byShape(f.slug))));
    expect(new Set(arts).size).toBe(SHIELD_FORMS.length);
    expect(SHIELD_FORMS.length).toBeGreaterThanOrEqual(4); // rondache / grand écu / targe / pavois
  });
  it('un bouclier sans shape (inconnu) retombe sur la rondache (fallback)', () => {
    expect(front(shieldPart(byShape(undefined)))).toBe(front(shieldPart(byShape('rond'))));
  });
});
