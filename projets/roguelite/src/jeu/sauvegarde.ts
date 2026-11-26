/**
 * La sauvegarde dans le navigateur, et la migration d'une sauvegarde des versions 1 à 3.
 */

import { stockageWeb } from '../../../../src/hote/stockageWeb';
import { Etat, Expedition } from './etat';

const CLE = 'grisefosse-v1';
export function sauver(e: Etat): void {
  try { stockageWeb('localStorage')?.setItem(CLE, JSON.stringify(e)); } catch { /* stockage indisponible : la partie vit en mémoire */ }
}

/** Une tombe du Jardin de Morr, que la version 3 retire (MyEdO/game#5032). */
interface TombeV2 { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
/** Une sauvegarde de la version 3 : sans tutoriel. */
interface EtatV3 extends Omit<Etat, 'version' | 'tutoriel'> { version: 3 }
/** Une sauvegarde de la version 2 : le Jardin de Morr parmi les bâtiments, et son registre des morts. */
interface EtatV2 extends Omit<EtatV3, 'version' | 'batiments'> {
  version: 2; batiments: Etat['batiments'] & { memorial: number }; cimetiere: TombeV2[];
}
/** Une sauvegarde de la version 1 : sans forge, `semaine` pour le jour. */
interface EtatV1 extends Omit<EtatV2, 'version' | 'jour' | 'batiments' | 'cimetiere' | 'expedition'> {
  version: 1; semaine: number; batiments: Omit<EtatV2['batiments'], 'forge'>;
  cimetiere: (Omit<TombeV2, 'jour'> & { semaine: number })[]; expedition: Omit<Expedition, 'prieres'> | null;
}
function versLaV2(v1: EtatV1): EtatV2 {
  const { semaine, version: _v, cimetiere, expedition, ...reste } = v1;
  return {
    ...reste, version: 2, jour: semaine, batiments: { ...v1.batiments, forge: 0 },
    cimetiere: cimetiere.map(({ semaine: s, ...t }) => ({ ...t, jour: s })),
    expedition: expedition && { ...expedition, prieres: [] },
  };
}

/** Ce qu'a coûté chaque palier bâti du Jardin de Morr, rendu à la bourse par la version 3. */
const PALIERS_DU_JARDIN: readonly { cout: number; trophees: number }[] = [{ cout: 110, trophees: 0 }, { cout: 300, trophees: 1 }];
function versLaV3(v2: EtatV2): EtatV3 {
  const { version: _v, cimetiere: _c, batiments: { memorial, ...batiments }, ...reste } = v2;
  const bati = PALIERS_DU_JARDIN.slice(0, memorial);
  return {
    ...reste, version: 3, batiments,
    or: reste.or + bati.reduce((s, p) => s + p.cout, 0),
    trophees: reste.trophees + bati.reduce((s, p) => s + p.trophees, 0),
  };
}

/** Une partie de la version 3 est déjà en cours : elle se poursuit sans tutoriel (MyEdO/game#5129). */
const versLaV4 = (v3: EtatV3): Etat => ({ ...v3, version: 4, tutoriel: null });

export function charger(): Etat | null {
  try {
    const brut = stockageWeb('localStorage')?.getItem(CLE);
    const e = brut ? JSON.parse(brut) as Etat | EtatV3 | EtatV2 | EtatV1 : null;
    if (!e || !Array.isArray(e.roster)) return null;
    const v3 = e.version === 3 ? e : e.version === 2 ? versLaV3(e) : e.version === 1 ? versLaV3(versLaV2(e)) : null;
    return e.version === 4 ? e : v3 && versLaV4(v3);
  } catch { return null; }
}
export function effacer(): void {
  try { stockageWeb('localStorage')?.removeItem(CLE); } catch { /* idem */ }
}
