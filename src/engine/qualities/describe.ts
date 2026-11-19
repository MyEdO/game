/**
 * Vue d'AFFICHAGE d'une qualité d'objet (fiche, marchand, infobulles) : `QualityInstance` → clé,
 * polarité, Indice, libellé, description. Tout est lu PAR ID dans la donnée app-owned
 * (`qualities.json`, chaque entrée taguée à sa `source`) — aucun texte ni aucune table ici.
 */
import type { QualityInstance } from '../types';
import { findQualityById } from '../../data';

export interface QualityInfo {
  /** Clé canonique du registre (ex. 'Solide'). */
  key: string;
  /** POLARITÉ : Atout (bénéfique) / Défaut (handicap) — id du registre ; undefined si non classée. */
  polarite?: 'atout' | 'defaut';
  /** Indice numérique éventuel (« Solide 3 » → 3, « Recharge 1 » → 1). */
  indice?: number;
  /** Libellé d'affichage (clé + Indice, ex. « Solide 3 »). */
  label: string;
  /** Description courte canonique (LDB), si connue. */
  desc?: string;
}

/** Décrit une `QualityInstance` runtime (`{id, value?}`) pour l'affichage : clé, type, Indice, desc.
 *  null si la qualité est inconnue du registre. Lecture PAR ID (plus de parse de chaîne). */
export function describeQuality(q: QualityInstance): QualityInfo | null {
  const data = findQualityById(q.id);
  if (!data) return null;
  const key = data.label; // clé canonique = libellé FR du registre
  return {
    key,
    polarite: data.polarite === 'atout' || data.polarite === 'defaut' ? data.polarite : undefined,
    indice: q.value,
    label: q.majoration != null ? `${key} +${q.majoration}` : q.value != null ? `${key} ${q.value}` : key,
    desc: data.desc,
  };
}
