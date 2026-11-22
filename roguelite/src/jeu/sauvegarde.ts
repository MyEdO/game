/**
 * La sauvegarde dans le navigateur, et la migration d'une sauvegarde de la version 1.
 */

import { Etat, Expedition, Tombe } from './etat';

const CLE = 'grisefosse-v1';
export function sauver(e: Etat): void {
  try { localStorage.setItem(CLE, JSON.stringify(e)); } catch { /* stockage indisponible : la partie vit en mémoire */ }
}

/** Une sauvegarde de la version 1 (sans forge, `semaine` pour le jour), portée à la version 2. */
interface EtatV1 extends Omit<Etat, 'version' | 'jour' | 'batiments' | 'cimetiere' | 'expedition'> {
  version: 1; semaine: number; batiments: Omit<Etat['batiments'], 'forge'>;
  cimetiere: (Omit<Tombe, 'jour'> & { semaine: number })[]; expedition: Omit<Expedition, 'prieres'> | null;
}
function migrer(v1: EtatV1): Etat {
  const { semaine, version: _v, cimetiere, expedition, ...reste } = v1;
  return {
    ...reste, version: 2, jour: semaine, batiments: { ...v1.batiments, forge: 0 },
    cimetiere: cimetiere.map(({ semaine: s, ...t }) => ({ ...t, jour: s })),
    expedition: expedition && { ...expedition, prieres: [] },
  };
}

export function charger(): Etat | null {
  try {
    const brut = localStorage.getItem(CLE);
    const e = brut ? JSON.parse(brut) as Etat | EtatV1 : null;
    if (!e || !Array.isArray(e.roster)) return null;
    return e.version === 2 ? e : e.version === 1 ? migrer(e) : null;
  } catch { return null; }
}
export function effacer(): void {
  try { localStorage.removeItem(CLE); } catch { /* idem */ }
}
