/**
 * La sauvegarde dans le navigateur, et la migration d'une sauvegarde des versions 1 à 4.
 */

import { stockageWeb } from '../../../../src/hote/stockageWeb';
import { Etat, Expedition } from './etat';

const CLE = 'grisefosse-v1';
export function sauver(e: Etat): void {
  try { stockageWeb('localStorage')?.setItem(CLE, JSON.stringify(e)); } catch { /* stockage indisponible : la partie vit en mémoire */ }
}

/** Une sauvegarde de la version 4 : le Péage du pont parmi les bâtiments. */
interface EtatV4 extends Omit<Etat, 'version' | 'batiments'> { version: 4; batiments: Etat['batiments'] & { peage: number } }
/** Une tombe du Jardin de Morr, que la version 3 retire (MyEdO/game#5032). */
interface TombeV2 { nom: string; carriere: string; expeditions: number; ou: string; jour: number }
/** Une sauvegarde de la version 3 : sans tutoriel. */
interface EtatV3 extends Omit<EtatV4, 'version' | 'tutoriel'> { version: 3 }
/** Une sauvegarde de la version 2 : le Jardin de Morr parmi les bâtiments, et son registre des morts. */
interface EtatV2 extends Omit<EtatV3, 'version' | 'batiments'> {
  version: 2; batiments: EtatV3['batiments'] & { memorial: number }; cimetiere: TombeV2[];
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

interface Palier { cout: number; trophees: number }
/** L'état `e`, remboursé des paliers `bati` d'un bâtiment que la migration retire. */
const rembourser = <T extends { or: number; trophees: number }>(e: T, bati: readonly Palier[]): T => ({
  ...e, or: e.or + bati.reduce((s, p) => s + p.cout, 0), trophees: e.trophees + bati.reduce((s, p) => s + p.trophees, 0),
});

/** Ce qu'a coûté chaque palier bâti du Jardin de Morr, rendu à la bourse par la version 3. */
const PALIERS_DU_JARDIN: readonly Palier[] = [{ cout: 110, trophees: 0 }, { cout: 300, trophees: 1 }];
function versLaV3(v2: EtatV2): EtatV3 {
  const { version: _v, cimetiere: _c, batiments: { memorial, ...batiments }, ...reste } = v2;
  return rembourser({ ...reste, version: 3, batiments }, PALIERS_DU_JARDIN.slice(0, memorial));
}

/** Une partie de la version 3 est déjà en cours : elle se poursuit sans tutoriel (MyEdO/game#5129). */
const versLaV4 = (v3: EtatV3): EtatV4 => ({ ...v3, version: 4, tutoriel: null });

/** Ce qu'a coûté chaque palier bâti du Péage du pont, rendu à la bourse par la version 5 (MyEdO/game#5130). */
const PALIERS_DU_PEAGE: readonly Palier[] = [{ cout: 90, trophees: 0 }, { cout: 240, trophees: 1 }, { cout: 480, trophees: 2 }];
function versLaV5(v4: EtatV4): Etat {
  const { version: _v, batiments: { peage, ...batiments }, ...reste } = v4;
  return rembourser({ ...reste, version: 5, batiments }, PALIERS_DU_PEAGE.slice(0, peage));
}

export function charger(): Etat | null {
  try {
    const brut = stockageWeb('localStorage')?.getItem(CLE);
    const e = brut ? JSON.parse(brut) as Etat | EtatV4 | EtatV3 | EtatV2 | EtatV1 : null;
    if (!e || !Array.isArray(e.roster)) return null;
    if (e.version === 5) return e;
    const v3 = e.version === 3 ? e : e.version === 2 ? versLaV3(e) : e.version === 1 ? versLaV3(versLaV2(e)) : null;
    const v4 = e.version === 4 ? e : v3 && versLaV4(v3);
    return v4 && versLaV5(v4);
  } catch { return null; }
}
export function effacer(): void {
  try { stockageWeb('localStorage')?.removeItem(CLE); } catch { /* idem */ }
}
