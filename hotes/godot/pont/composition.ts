/**
 * LA COMPOSITION D'UN PERSONNAGE SUR UNE BASE (#3086, D2 et son amendement ; `CONTRAT.md`, section « Composition d'un
 * personnage ») : ce que porte un corps (`PorteeDeComposition`, d'une composition ou d'un combattant, surface du noyau),
 * résolu en éléments de la base sur ses lignes et ses points (`modelesDeLAtelier`), avec la pose de son gabarit (`poseDuGabarit`), les poids de ses
 * silhouettes (`poidsDeSilhouettes`), ses matériaux par sexe (`parSexe` des surfaces de la base, #3188) et sa palette
 * résolue au nuancier (`findCouleurById`), chaque élément monté à la palette de sa teinte (`findTeinteById`, #3456).
 */
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import { poidsDeSilhouettes, poseDuGabarit, type PoseDuGabarit } from '../asset/gabarit';
import { ligneAuRang } from '../asset/attache';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence';
import { findCouleurById, findTeinteById, pieceRacine, emblemeDuPorteur, type EmblemeResolu, type Portee, type PorteeDeComposition, type SurchargesDEmblemes } from '../../../src/noyau/index';
import { emblemeMonte, cleDe, type BaseDeLAtelier, type LigneDePiece } from './atelier';

/**
 * @contrat Composition d'un personnage
 * Une composition est une entrée de `src/data/presets-de-personnage.json` sans son enveloppe, les clés de
 * `CLES_ENVELOPPE` (`src/data/schemas/grammaire/document.ts`) : `race`, `gabarit?`, `sex`, `build?`, `tete`,
 * `coiffure?`, `tenue?`, `pieces?`, `objets?`, `rangementsObjets?`, `variantesPieces?`, `prises?`,
 * `apparencesObjets?`, `embleme?` (`compositionSchema`, `schemas/defs/presets-de-personnage.ts`). Une seule fonction
 * du noyau la valide, `lireComposition` (`src/noyau/apparence/composition.ts`), au schéma du preset et à ses règles,
 * dont « rien n'est porté deux fois » : `composer` et `presetDeComposition` la lisent ; une composition refusée, ou
 * absente, est une erreur `validation` qui nomme le chemin de chaque faute. Ce qu'elle porte vient du noyau
 * (`porteeDeComposition`, `src/noyau/apparence/composition.ts`), dans cet ordre : la tête, la coiffure, les pièces de
 * l'ensemble de la tenue, les `pieces`, chaque pièce sous sa variante (`variantesPieces`, une clé par pièce portée,
 * la valeur une variante de cette pièce, #3446), puis chaque objet, tenu (`prises`) puis porté (`objets`). Un objet
 * apporte ses pièces (`piecesDeLObjet`, `src/data/index.ts`, #3456) : celles de l'ensemble de la garde-robe qui
 * habille son trapping, à défaut les pièces d'armure dont une `localisations` est une des siennes (celles du
 * trapping, `loc`) ; sans pièce, il porte son apparence (`apparencesObjets`, à défaut sa forme `shape`), avec sa
 * racine si elle en est une variante (`candidatsDApparenceDObjet`, `cle.racine` de sa `Portee`), à sa prise s'il est
 * tenu, sinon à son rangement : celui que la composition lui choisit (`rangementsObjets`, une clé par objet de
 * `objets`), à défaut le `rangement` du trapping (`trappings.json`) ; sans l'un ni l'autre, il va à `rapport`, sans
 * point. Chaque objet porte sa teinte (`teinteDeLObjet`, `Portee.teinte`) : celle de son Groupe d'armure (`teinte` de
 * `weaponGroups.json`) s'il en est un. Cette portée (`PorteeDeComposition`) porte aussi le corps qu'elle habille,
 * `sex`, `build?` et `couleurs?`, que `composerSurLaBase` lit sans relire la composition ; `porteeDuCombattant`
 * (`src/noyau/apparence/combattant.ts`) en est le second producteur, par le même assembleur d'objet
 * (`porteesDesObjets`).
 */
export interface CompositionSurLaBase {
  /** une entrée par chose portée, dans l'ordre ci-dessus. `ligne` est la clé d'emplacement du panneau (section «
   *  Écran publié »), tirée d'une seule fonction (`cleDuPanneau`, `composition.ts`) : `"ligne/tete"`,
   *  `"ligne/coiffure"`, `"ligne/piece/<id>"` d'un vêtement ou d'une armure, `<id>` la pièce d'une variante (#3446),
   *  `"ligne/emplacement/<id>"` d'une pièce d'accessoire, rigide comprise, ou l'id du point d'un objet tenu ou rangé,
    *  `"<point>#<rang>"` pour le rang-ième objet rangé au même point à partir du deuxième.
   *  `element` est l'élément de cet emplacement, parmi ceux que `modeles` y sert, dont la `cle` désigne la chose
   *  (`cle.tete`, `cle.coiffure`, `cle.piece`, `cle.apparence`) ; une apparence variante (`forme`
   *  d'`apparences.json`) prend l'élément qui la désigne, à défaut celui de sa racine. `null` : aucun. `embleme`,
   *  l’id résolu de la surcharge de cette ligne ou du défaut de la composition, n’est porté que si l’élément déclare
   *  une surface `blason: true` et qu’un emblème est retenu ; son dessin reste au catalogue. `palette`, porté par une
   *  entrée à élément dont la chose a une teinte (`Portee.teinte`, un id du domaine `objet` de `materials.json`,
   *  #3456), est la palette de cette teinte (`findTeinteById`, surface du noyau), en `#rrggbb` par emplacement de
   *  palette. */
  montes: Monte[];
  /** les entrées de `montes` sans élément, ce qu'il reste à produire : la clé (`champ`, `id`, l'apparence demandée
   *  pour une variante, pas sa racine), le libellé de la garde-robe ou de l'apparence, et `par`, la tenue ou l'objet
   *  qui apporte la chose (son ensemble, l'objet dont elle est une pièce ou l'apparence), avec `label`, le libellé de
   *  son ensemble, à défaut celui de l'objet ; une pièce de l'armure de statbloc n'a pas de `par`. */
  manquants: Manquant[];
  /** les objets ni tenus ni rangés (`PorteeDeComposition.rapport`). */
  rapport: string[];
  /** absent sur une base sans table de gabarit (`ManifesteDeBase.gabarit`, #2991) ; sinon `poseDuGabarit` (section «
   *  Gabarit d'une base ») sur les facteurs de `gabaritResolu` de la composition (son `gabarit`, à défaut celui de sa
   *  race et sa surcharge, `raceAppearance.json`). */
  gabarit?: PoseDuGabarit;
  /** vide sur une base sans table de gabarit ; sinon `poidsDeSilhouettes` sur `sex`, `build` (absent :
   *  `BUILD_NEUTRE`) et le `st` de ces facteurs. */
  morphes: Record<string, number>;
  /** par surface de la base dont `parSexe` nomme un matériau pour `sex` (`asset/surfaces.ts`, #3188), le nom de son
   *  matériau du GLB vers le nom de ce matériau ; vide sinon. Le pont choisit le matériau ; Godot le prend au GLB par
   *  son nom, sans lire ni `sex` ni `parSexe`. */
  materiaux: Record<string, string>;
  /** la couleur `#rrggbb` de chaque emplacement de palette que la composition colore (`couleurs`), résolue au
   *  nuancier (`findCouleurById`, surface du noyau), vide sans `couleurs`. La composition ne porte que des ids
   *  (#2966) ; Godot ne lit aucun catalogue pour colorer. */
  palette: Record<string, string>;
}

/**
 * @contrat Composition d'un personnage
 * Une entrée de `montes`.
 */
export interface Monte {
  /** l'emplacement de montage de la chose portée (`"<point>"`, `"<point>#<rang>"` du rang-ième objet au même point à
   *  partir du deuxième, ou la clé de sa ligne, `cleDuPanneau`). */
  ligne: string;
  /** l'élément de la base qui la monte, `null` s'il n'y en a aucun. */
  element: string | null;
  /** l'emblème retenu, porté si l'élément déclare une surface `blason: true`. */
  embleme?: EmblemeResolu;
  /** monté, la palette de sa teinte (`Portee.teinte`). */
  palette?: Record<string, string>;
}

/**
 * @contrat Composition d'un personnage
 * Une entrée de `manquants` : une chose portée sans élément de la base.
 */
export interface Manquant {
  /** son emplacement de montage. */
  ligne: string;
  /** le champ de la clé qui la désigne. */
  champ: Portee['cle']['champ'];
  /** l'id de la clé qui la désigne. */
  id: string;
  /** son libellé. */
  label: string;
  /** ce qui l'apporte. */
  par?: Portee['par'];
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

/**
 * @contrat Atelier 3D
 * La composition accepte aussi `embleme?: { id }`, validé par le même schéma que l’apparence d’auteur. `composer`
 * reçoit une table optionnelle `emblemes`, par ligne de montage : une référence surcharge le défaut de la
 * composition, `null` demande explicitement une surface sans emblème, une ligne absente conserve le défaut. Chaque
 * entrée de `montes` porte `embleme?: { id }` pour un élément dont une surface déclare `blason: true` ; son SVG se
 * lit dans le catalogue `emblemes` de `modeles`.
 */

/** `portee` sur la base `base` des modèles de l'atelier : `manifestes` (id de modèle → manifeste) lit la base et la
 *  `cle` de ses éléments. Chaque chose portée se monte à l'élément de son emplacement dont la clé la désigne, un objet
 *  rangé ou tenu au point d'un objet précédent sur la ligne `<point>#<rang>`, une
 *  apparence variante à défaut à celui de sa `racine`. */
export function composerSurLaBase(base: BaseDeLAtelier, manifestes: Readonly<Record<string, unknown>>, portee: PorteeDeComposition, surcharges: SurchargesDEmblemes = {}): CompositionSurLaBase {
  const elementsDe = new Map<string, string[]>([
    ...base.points.map((p): [string, string[]] => [p.id, p.elements]),
    ...base.lignes.map((l): [string, string[]] => [cleDeLigne(l), elementsDeLigne(l)]),
  ]);
  const montes: Monte[] = [];
  const manquants: Manquant[] = [];
  const rangsAuPoint = new Map<string, number>();
  for (const p of portee.portees) {
    const emplacement = ouMonter(p);
    const rang = p.cle.champ === 'apparence' ? (rangsAuPoint.get(emplacement) ?? 0) + 1 : 1;
    rangsAuPoint.set(emplacement, rang);
    const ligne = ligneAuRang(emplacement, rang);
    const ids = p.cle.champ === 'apparence' && p.cle.racine !== undefined ? [p.cle.id, p.cle.racine] : [p.cle.id];
    const elements = elementsDe.get(emplacement) ?? [];
    const element = ids.map((id) => elements.find((e) => cleDe(manifestes[e])[p.cle.champ] === id)).find((e) => e !== undefined);
    const embleme = Object.prototype.hasOwnProperty.call(surcharges, ligne) ? emblemeDuPorteur(surcharges[ligne]) : portee.embleme;
    const teinte = element === undefined ? undefined : findTeinteById(p.teinte);
    montes.push({ ligne, element: element ?? null, ...emblemeMonte(embleme, element === undefined ? undefined : manifestes[element]), ...(teinte ? { palette: { ...teinte.palette } } : {}) });
    if (element === undefined) manquants.push({ ligne, champ: p.cle.champ, id: p.cle.id, label: p.label, ...(p.par ? { par: p.par } : {}) });
  }
  const { gabarit, appuis, clips, clipsDeuxMains, surfaces = [] } = manifestes[base.id] as ManifesteDeBase;
  const morphes = gabarit ? poidsDeSilhouettes({ sex: portee.sex, build: portee.build ?? BUILD_NEUTRE, st: portee.facteurs.st }, gabarit) : {};
  return {
    montes,
    manquants,
    rapport: portee.rapport,
    ...(gabarit ? { gabarit: poseDuGabarit({ gabarit, appuis, clips, clipsDeuxMains }, portee.facteurs, morphes) } : {}),
    morphes,
    materiaux: Object.fromEntries(surfaces.flatMap(({ nom, parSexe }) => (parSexe?.[portee.sex] ? [[nom, parSexe[portee.sex]!]] : []))),
    palette: paletteDesCouleurs(portee.couleurs),
  };
}
