/**
 * Couche ÉCONOMIQUE des qualités d'OBJET (artisanat, LDB 60 l.9-62). Pure, sans état :
 * renvoie des FACTEURS / déltas que le Marchand (#2) applique aux prix/disponibilités catalogue.
 * N'agit que sur les qualités `subType: 'objet'` (les qualités d'arme/armure n'altèrent pas le prix).
 */
import { resolveQualities, type QualityCarrier } from './dispatch';
import { AVAILABILITIES, type Availability } from '../types';
import { t, type MsgKey } from '../../i18n';

const craftDefs = (c: QualityCarrier | undefined) => resolveQualities(c).filter((r) => r.data?.subType === 'objet');

/** Nombre d'Atouts d'objet (multiplicité = répétition dans la liste). */
export function craftAtoutCount(c: QualityCarrier | undefined): number {
  return craftDefs(c).filter((r) => r.data?.polarite === 'atout').length;
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

/** Classe de qualité, en id STABLE (LDB 60 l.7/11/42) — l'affichage vit au catalogue
 *  (`QUALITY_CLASS_KEY`/`qualityClassLabel`). */
export type QualityClass = 'haute' | 'qualite' | 'defectueuse' | 'standard';

/** Clé d'affichage de chaque classe (résolue à l'APPEL, jamais gelée au chargement du module). */
export const QUALITY_CLASS_KEY: Record<QualityClass, MsgKey> = {
  haute: 'craft.classHaute',
  qualite: 'craft.classQualite',
  defectueuse: 'craft.classDefectueuse',
  standard: 'craft.classStandard',
};

/** Libellé JOUEUR d'une classe de qualité (LDB 60 l.7/11/42). */
export function qualityClassLabel(k: QualityClass): string {
  return t(QUALITY_CLASS_KEY[k]);
}

/**
 * Classe de qualité (LDB 60 l.7/11/42) : **Haute Qualité** = aucun Défaut ET plus d'Atouts que
 * l'Encombrement ; **Qualité** = plus d'Atouts que de Défauts ; **Défectueuse** = l'inverse ;
 * sinon **Standard**. `enc` = Encombrement de base de l'objet.
 */
export function qualityClass(c: QualityCarrier | undefined, enc: number): QualityClass {
  const a = craftAtoutCount(c);
  const d = craftDefautCount(c);
  if (d === 0 && a > enc) return 'haute';
  if (a > d) return 'qualite';
  if (d > a) return 'defectueuse';
  return 'standard';
}
