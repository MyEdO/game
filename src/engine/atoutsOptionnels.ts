import { findTrappingById, qualityInstance } from '../data';
import type { QualityInstance, Weapon } from './types';

/** AA 08 l.69-77 */
export function atoutsOptionnelsDe(arme: Pick<Weapon, 'trappingId'>): QualityInstance[] {
  const profil = findTrappingById(arme.trappingId);
  if (!profil?.qualitesAuChoix) return [];
  return profil.qualitesAuChoix.flatMap((id) => {
    const qualite = profil.qualities.find((q) => q.id === id);
    return qualite ? [qualityInstance(qualite)] : [];
  });
}

/** AA 08 l.69-77 */
export function appliquerAtoutOptionnel(arme: Weapon, choix?: string): Weapon {
  if (arme.atoutOptionnel !== undefined) return arme;
  const options = atoutsOptionnelsDe(arme);
  if (!options.length) return arme;
  const indices = options.map((atout) => arme.qualities.findIndex((q) =>
    q.id === atout.id && q.value === atout.value && q.majoration === atout.majoration));
  if (indices.includes(-1)) return arme;
  const rang = options.findIndex((atout) => atout.id === choix);
  const retenu = rang < 0 ? 0 : rang;
  const ecartees = new Set(indices.filter((_, i) => i !== retenu));
  return {
    ...arme,
    atoutOptionnel: options[retenu].id,
    qualities: arme.qualities.filter((_, i) => !ecartees.has(i)),
  };
}
