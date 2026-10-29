import { describe, it, expect, vi } from 'vitest';
import { resetDiagOnce } from '../devDiag';
import { hairIndexById, cosmeticPart, coiffureRetombee, COIFFURE_HORS_POOL } from './cosmetic';
import { coiffuresDuPool, hairstylesForSex } from './hairstyles';
import { resolveRig } from '../composeRig';
import { asRigSpeciesId } from '../appearance';
import type { Appearance } from '../../../engine/authoringAppearance';
import type { Sexe } from '../../../data/schemas/grammaire/valeurs';
import { equipDe } from '../../../noyau/equipementDessine';

/**
 * Coiffure imposée par sa référence (#637, #3113) — `appearance.hairstyle = { id }`, id d'une ligne
 * `coiffure` de `garde-robe.json`, jamais un index ni un libellé.
 */
describe('coiffure imposée par id (#637)', () => {
  const anId = hairstylesForSex('M')[0].coiffure;

  it('hairIndexById résout un id vers l’entrée EXACTE du pool (pas un index arbitraire)', () => {
    const idx = hairIndexById('Humain', 'M', anId)!;
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(coiffuresDuPool('Humain', 'M')[idx].coiffure).toBe(anId);
  });

  it('deux ids DIFFÉRENTS imposent des coiffures DIFFÉRENTES (l’id sélectionne bien l’art)', () => {
    const ms = hairstylesForSex('M');
    expect(ms.length).toBeGreaterThanOrEqual(2);
    const a = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[0].coiffure)!);
    const b = cosmeticPart('cheveux', 'Humain', 'M', hairIndexById('Humain', 'M', ms[1].coiffure)!);
    expect(a).not.toEqual(b);
    expect(a).toBeTruthy();
  });

  it('un id hors du pool ne résout AUCUN index : jamais l’art d’une autre coiffure', () => {
    expect(hairIndexById('Humain', 'M', 'coiffure-qui-nexiste-pas-xyz')).toBeUndefined();
    expect(hairIndexById('Humain', 'F', anId)).toBeUndefined();
  });

  it('la chevelure d’une tête ouvre le pool de sa race, et seulement le sien', () => {
    expect(coiffuresDuPool('Nain', 'M')[0].coiffure).toBe('chevelure-nain');
    expect(hairIndexById('Nain', 'M', 'chevelure-nain')).toBe(0);
    expect(hairIndexById('Humain', 'M', 'chevelure-nain')).toBeUndefined();
    expect(coiffuresDuPool('Ogre', 'M').map((h) => h.coiffure)).toEqual(hairstylesForSex('M').map((h) => h.coiffure));
  });
});

/** Donnée d'AUTEUR hors du pool espèce×sexe (verdict 5805847379 de #1897, section E) : le rendu ne lève
 *  pas, il montre la chevelure d'ERREUR (#223) à la place de la part `cheveux`. */
describe('coiffure imposée hors du pool : chevelure d’erreur visible, aucune levée', () => {
  const coiffureM = hairstylesForSex('M')[0].coiffure;
  const apparence = (sex: Sexe, id = coiffureM, espece = 'humain'): Appearance => ({ species: asRigSpeciesId(espece), sex, build: 0.5, seed: 1, hairstyle: { id } });
  const svgDuRig = (a: Appearance) => resolveRig(a, equipDe([], []), {}, 'nu', 'front').flatMap((b) => b.parts.map((p) => p.svg)).join('');

  it('coiffure M sur un rig F : le rig se compose et porte la chevelure d’erreur', () => {
    expect(hairstylesForSex('F').some((h) => h.coiffure === coiffureM), 'la coiffure est hors du pool F').toBe(false);
    resetDiagOnce();
    const dit = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(svgDuRig(apparence('F'))).toContain(COIFFURE_HORS_POOL);
    expect(dit.mock.calls.map((c) => String(c[0])).some((m) => m.includes(`« ${coiffureM} » hors du pool`)), 'le diagnostic nomme la coiffure').toBe(true);
    dit.mockRestore();
  });

  it('coiffure M sur un rig M : la coiffure imposée, pas l’erreur', () => {
    expect(svgDuRig(apparence('M'))).not.toContain(COIFFURE_HORS_POOL);
  });

  it('chevelure d’une autre race : chevelure d’erreur ; sur sa race, son art', () => {
    const dit = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(svgDuRig(apparence('M', 'chevelure-nain'))).toContain(COIFFURE_HORS_POOL);
    dit.mockRestore();
    expect(svgDuRig(apparence('M', 'chevelure-nain', 'nain'))).not.toContain(COIFFURE_HORS_POOL);
  });
});

/** Patron `propRefPatch` (`ui/editor/propDefaults.ts`) : un geste d'édition ne crée pas la faute. */
describe('coiffureRetombee — la coiffure sans art pour le sexe posé retombe dans le même patch', () => {
  const coiffureM = { id: hairstylesForSex('M')[0].coiffure };

  it('sexe passé à F : la coiffure M est retirée, le reste de l’apparence est gardé', () => {
    expect(coiffureRetombee({ sex: 'F' as const, hairstyle: coiffureM, build: 0.3 })).toEqual({ sex: 'F', build: 0.3 });
  });

  it('coiffure dessinée pour le sexe posé : l’apparence est rendue telle quelle', () => {
    const a = { sex: 'M' as const, hairstyle: coiffureM };
    expect(coiffureRetombee(a)).toBe(a);
    const deuxSexes = { sex: 'F' as const, hairstyle: { id: 'cheveux-boucles-volumineux-mi-longs' } };
    expect(coiffureRetombee(deuxSexes)).toBe(deuxSexes);
  });

  it('sexe non posé : rien à juger, la coiffure reste', () => {
    const a = { hairstyle: coiffureM };
    expect(coiffureRetombee(a)).toBe(a);
  });

  it('coiffure inconnue : elle reste, le schéma la nomme', () => {
    const a = { sex: 'F' as const, hairstyle: { id: 'zzz' } };
    expect(coiffureRetombee(a)).toBe(a);
  });
});
