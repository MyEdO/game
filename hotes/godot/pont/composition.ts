/**
 * LA COMPOSITION D'UN PERSONNAGE SUR UNE BASE (#3086, D2 et son amendement ; `CONTRAT.md`, section « Composition d'un
 * personnage ») : ce que porte un corps (`PorteeDeComposition`, d'une composition ou d'un combattant, surface du noyau),
 * résolu en éléments de la base sur ses lignes et ses points (`modelesDeLAtelier`), avec la pose de son gabarit (`poseDuGabarit`), les poids de ses
 * silhouettes (`poidsDeSilhouettes`), ses matériaux par sexe (`parSexe` des surfaces de la base, #3188) et sa palette
 * résolue au nuancier (`findCouleurById`), chaque élément monté à la palette de sa teinte (`findTeinteById`, #3456).
 */
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import { poidsDeSilhouettes, poseDuGabarit, type PoseDuGabarit } from '../asset/gabarit';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence';
import { findCouleurById, findTeinteById, pieceRacine, emblemeDuPorteur, type EmblemeResolu, type Portee, type PorteeDeComposition, type SurchargesDEmblemes } from '../../../src/noyau/index';
import { emblemeMonte, cleDe, type BaseDeLAtelier, type LigneDePiece } from './atelier';

/** Un emplacement de montage d'une chose portée (`"<point>"` ou la clé de sa ligne, `cleDuPanneau`), l'élément de
 *  la base qui la monte, `null` s'il n'y en a aucun, et, monté, la palette de sa teinte (`Portee.teinte`). */
export interface Monte {
  ligne: string;
  element: string | null;
  embleme?: EmblemeResolu;
  palette?: Record<string, string>;
}

/** Une chose portée sans élément de la base : son emplacement de montage, la clé qui la désigne, son libellé et ce
 *  qui l'apporte. */
export interface Manquant {
  ligne: string;
  champ: Portee['cle']['champ'];
  id: string;
  label: string;
  par?: Portee['par'];
}

export interface CompositionSurLaBase {
  montes: Monte[];
  manquants: Manquant[];
  /** Les objets ni tenus ni rangés (`PorteeDeComposition.rapport`). */
  rapport: string[];
  /** Absente sur un corps sans table de gabarit (`ManifesteDeBase.gabarit`). */
  gabarit?: PoseDuGabarit;
  /** Vide sur un corps sans table de gabarit. */
  morphes: Record<string, number>;
  /** Par matériau du GLB de la base qu'une surface remplace pour le sexe du corps (`Surface.parSexe`), le nom du
   *  matériau du GLB qui le remplace. */
  materiaux: Record<string, string>;
  /** La couleur `#rrggbb` de chaque emplacement de palette que la composition colore (`couleurs`). */
  palette: Record<string, string>;
}

/** La clé d'emplacement d'une ligne au panneau de l'atelier (`CONTRAT.md`, « Écran publié ») : `ligne/<sorte>` d'un
 *  sélecteur (`tete`, `coiffure`), `ligne/<sorte>/<id>` d'une `piece` ou d'un `emplacement`. */
const cleDuPanneau = (sorte: LigneDePiece['sorte'], id?: string): string => (id === undefined ? `ligne/${sorte}` : `ligne/${sorte}/${id}`);
const cleDeLigne = (l: LigneDePiece): string => ('choix' in l ? cleDuPanneau(l.sorte) : cleDuPanneau(l.sorte, l.id));
const elementsDeLigne = (l: LigneDePiece): string[] => ('choix' in l ? l.choix.flatMap((c) => c.elements) : l.elements);

/** L'emplacement de montage d'une chose portée : la ligne de sa tête, de sa coiffure ou de sa pièce de vêtement ou
 *  d'armure, celle de sa pièce pour une variante (#3446) ; la ligne de l'emplacement d'une pièce d'accessoire, rigide
 *  comprise ; le point d'un objet. */
function ouMonter({ cle, point }: Portee): string {
  if (cle.champ === 'tete' || cle.champ === 'coiffure') return cleDuPanneau(cle.champ);
  if (cle.champ === 'apparence') return point!;
  return point === undefined ? cleDuPanneau('piece', pieceRacine(cle.id)?.id ?? cle.id) : cleDuPanneau('emplacement', point);
}

/** La couleur `#rrggbb` de chaque emplacement de palette que `couleurs` colore, résolue au nuancier (`findCouleurById`). */
export const paletteDesCouleurs = (couleurs: PorteeDeComposition['couleurs']): Record<string, string> =>
  Object.fromEntries(Object.entries(couleurs ?? {}).map(([slot, { id }]) => [slot, findCouleurById(id)!.color]));

/** `portee` sur la base `base` des modèles de l'atelier : `manifestes` (id de modèle → manifeste) lit la base et la
 *  `cle` de ses éléments. Chaque chose portée se monte à l'élément de son emplacement dont la clé la désigne, une
 *  apparence variante à défaut à celui de sa `racine`. */
export function composerSurLaBase(base: BaseDeLAtelier, manifestes: Readonly<Record<string, unknown>>, portee: PorteeDeComposition, surcharges: SurchargesDEmblemes = {}): CompositionSurLaBase {
  const elementsDe = new Map<string, string[]>([
    ...base.points.map((p): [string, string[]] => [p.id, p.elements]),
    ...base.lignes.map((l): [string, string[]] => [cleDeLigne(l), elementsDeLigne(l)]),
  ]);
  const montes: Monte[] = [];
  const manquants: Manquant[] = [];
  for (const p of portee.portees) {
    const ligne = ouMonter(p);
    const ids = p.cle.champ === 'apparence' && p.cle.racine !== undefined ? [p.cle.id, p.cle.racine] : [p.cle.id];
    const elements = elementsDe.get(ligne) ?? [];
    const element = ids.map((id) => elements.find((e) => cleDe(manifestes[e])[p.cle.champ] === id)).find((e) => e !== undefined);
    const embleme = Object.prototype.hasOwnProperty.call(surcharges, ligne) ? emblemeDuPorteur(surcharges[ligne]) : portee.embleme;
    const teinte = element === undefined ? undefined : findTeinteById(p.teinte);
    montes.push({ ligne, element: element ?? null, ...emblemeMonte(embleme, element === undefined ? undefined : manifestes[element]), ...(teinte ? { palette: { ...teinte.palette } } : {}) });
    if (element === undefined) manquants.push({ ligne, champ: p.cle.champ, id: p.cle.id, label: p.label, ...(p.par ? { par: p.par } : {}) });
  }
  const { gabarit, appuis, surfaces = [] } = manifestes[base.id] as ManifesteDeBase;
  return {
    montes,
    manquants,
    rapport: portee.rapport,
    ...(gabarit ? { gabarit: poseDuGabarit({ gabarit, appuis }, portee.facteurs) } : {}),
    morphes: gabarit ? poidsDeSilhouettes({ sex: portee.sex, build: portee.build ?? BUILD_NEUTRE, st: portee.facteurs.st }, gabarit) : {},
    materiaux: Object.fromEntries(surfaces.flatMap(({ nom, parSexe }) => (parSexe?.[portee.sex] ? [[nom, parSexe[portee.sex]!]] : []))),
    palette: paletteDesCouleurs(portee.couleurs),
  };
}
