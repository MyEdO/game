/**
 * Couche ÉCONOMIQUE des qualités d'OBJET (artisanat, LDB 60 l.9-62). Pure, sans état :
 * renvoie des FACTEURS / déltas que le Marchand (#2) applique aux prix/disponibilités catalogue.
 * N'agit que sur les qualités `subType: 'objet'` (les qualités d'arme/armure n'altèrent pas le prix).
 */
import { resolveQualities, type QualityCarrier } from './dispatch';
import { AVAILABILITIES, type Availability } from '../types';
import type { ClasseDeQualite } from '../../data/schemas/grammaire/reference';

const craftDefs = (c: QualityCarrier | undefined) => resolveQualities(c).filter((r) => r.data?.subType === 'objet');

/** Nombre de prises d'Atouts d'objet, l'Indice d'un Atout indicé compris. LDB 60 l.11 ; LDB 60 l.30-32 */
export function craftAtoutCount(c: QualityCarrier | undefined): number {
  return craftDefs(c).filter((r) => r.data?.polarite === 'atout').reduce((n, r) => n + (r.data?.indice ? (r.indice ?? 1) : 1), 0);
}
/** Nombre de Défauts d'objet. */
export function craftDefautCount(c: QualityCarrier | undefined): number {
  return craftDefs(c).filter((r) => r.data?.polarite === 'defaut').length;
}

/** Facteur multiplicatif du prix : chaque Atout ×2, chaque Défaut ÷2 (LDB 60 l.11/42). */
export function craftPriceFactor(c: QualityCarrier | undefined): number {
  return 2 ** craftAtoutCount(c) * 0.5 ** craftDefautCount(c);
}

/** Délta d'Encombrement dû à l'artisanat (Léger -1 / Volumineux +1, LDB 60 l.18/62). */
export function craftEncDelta(c: QualityCarrier | undefined): number {
  return resolveQualities(c).reduce((s, r) => s + (r.caps?.encDelta ?? 0), 0);
}

/**
 * Disponibilité après modification par l'artisanat : chaque Atout rend +1 cran plus RARE, chaque
 * Défaut +1 cran plus COURANT (LDB 60 l.11/42). Exception : Exotique n'est pas rendu plus courant
 * par un Défaut (l.44). Option Guilde (l.36-38) : les Défauts RÉDUISENT la dispo et le 1er Atout ne
 * la réduit pas.
 */
export function shiftAvailability(base: Availability, c: QualityCarrier | undefined, opts: { guild?: boolean } = {}): Availability {
  const atouts = craftAtoutCount(c);
  const defauts = craftDefautCount(c);
  let idx = AVAILABILITIES.indexOf(base);
  if (idx < 0) return base;
  if (opts.guild) {
    idx += Math.max(0, atouts - 1); // le 1er Atout ne réduit pas la dispo
    idx -= defauts; // les Défauts réduisent la dispo
  } else {
    idx += atouts;
    if (base !== 'exotique') idx -= defauts; // Exotique : non rendu plus courant par un Défaut
  }
  return AVAILABILITIES[Math.max(0, Math.min(AVAILABILITIES.length - 1, idx))];
}

/** Le nombre minimal d'Atouts de Fabrication d'une Possession de la classe `classe` et d'Encombrement `enc`.
 *  LDB 60 l.7 ; LDB 60 l.11 */
export function atoutsMinimaux(classe: 'qualite'): number;
export function atoutsMinimaux(classe: ClasseDeQualite, enc: number): number;
export function atoutsMinimaux(classe: ClasseDeQualite, enc = 0): number {
  return classe === 'haute' ? enc + 1 : 1;
}
