/**
 * FORME d'une arête de mur (#1883) et COMPATIBILITÉ apparence × forme — source UNIQUE, lue par
 * `validateScene` (refus), l'Inspecteur (choix proposés) et `gameIso/builders/walls.ts` (branche de rendu).
 *
 * La forme se dérive de la nature d'authoring de la Structure (`structureEdgeKind`) ET de `seg.door` ;
 * la compatibilité se dérive des blocs que l'apparence DÉCLARE (`window`, `door`, `parapet`), jamais
 * d'une liste d'ids ni de l'absence d'un bloc.
 */
import type { Scene, WallSeg } from './scene';
import { edgeKey, facadeEdges } from './facadeEdges';
import { murDeFacade } from '../data/facadePresets';
import { findStructureById, premierOffert, structureAppearances, structures } from '../data';
import { isDoorEdgeStructure, structureEdgeKind } from '../engine/structures';

/** `fermeture-fixe` : Structure de nature `porte` posée sans `seg.door` — brèchable, jamais ouvrable. */
export type FormeArete = 'mur-nu' | 'mur-fenetre' | 'porte-fermee' | 'porte-ouverte' | 'fermeture-fixe';

export const FORMES_ARETE: readonly FormeArete[] = ['mur-nu', 'mur-fenetre', 'porte-fermee', 'porte-ouverte', 'fermeture-fixe'];

export const LIBELLE_FORME: Record<FormeArete, string> = {
  'mur-nu': 'mur nu',
  'mur-fenetre': 'mur fenêtré',
  'porte-fermee': 'porte fermée',
  'porte-ouverte': 'porte ouverte',
  'fermeture-fixe': 'fermeture fixe',
};

/** Formes où le mur est percé d'une BAIE (porte ouvrable, ouverte ou fermée, ou fermeture fixe). */
const BAIES: readonly FormeArete[] = ['porte-fermee', 'porte-ouverte', 'fermeture-fixe'];

/** La forme perce-t-elle le mur d'une baie (porte ouvrable ou fermeture fixe) ? */
export function estBaie(forme: FormeArete): boolean {
  return BAIES.includes(forme);
}

/** La baie est-elle BOUCHÉE (porte fermée ou fermeture fixe) — seule la porte ouverte laisse le vide ? */
export function estBaieFermee(forme: FormeArete): boolean {
  return forme === 'porte-fermee' || forme === 'fermeture-fixe';
}

/** Id d'apparence DÉCLARÉ par le segment : l'override visuel, sinon la Structure. `undefined` = aucun
 *  (façade authorée ou mur nu). Précédence lue par `wallApp` (`gameIso/catalog/structures`). */
export function apparenceDeclaree(seg: Pick<WallSeg, 'appearance' | 'structure'>): string | undefined {
  return seg.appearance || seg.structure || undefined;
}

/** L'arête porte-t-elle une Structure de nature `porte` (`isDoorEdgeStructure`) ? */
const porteUneFermeture = (seg: Pick<WallSeg, 'structure'>): boolean => {
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  return !!s && isDoorEdgeStructure(s);
};

/** Formes que l'arête PREND en jeu : une porte ouvrable prend les deux états, les autres un seul. Une
 *  fenêtre ne se lit que sur un mur (l'Inspecteur ne la propose qu'hors porte). */
export function formesDeLArete(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>): readonly FormeArete[] {
  if (seg.door) return ['porte-fermee', 'porte-ouverte'];
  if (porteUneFermeture(seg)) return ['fermeture-fixe'];
  return [seg.window ? 'mur-fenetre' : 'mur-nu'];
}

/** Forme RENDUE à cet instant (`open` = état runtime de la porte, `doorIsOpen`). */
export function formeRendue(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>, open: boolean): FormeArete {
  return seg.door ? (open ? 'porte-ouverte' : 'porte-fermee') : formesDeLArete(seg)[0];
}

/** Ce qu'une apparence déclare, et que la compatibilité lit. */
export interface BlocsDApparence {
  window?: unknown;
  door?: unknown;
  parapet?: unknown;
}

/**
 * Formes qu'une apparence sait HABILLER, lues sur ses blocs DÉCLARÉS (`gameIso/builders/walls.ts`,
 * `wallFaces`) :
 *  - mur nu → toujours : chaque branche dessine un pan plein depuis les champs de l'apparence (courtine
 *    d'un `parapet`, claire-voie, panneau) ;
 *  - mur fenêtré → bloc `window`, hors `parapet` (la branche de courtine ne dessine pas de croisée) ;
 *  - porte fermée, ouverte, fermeture fixe → bloc `door`.
 */
export function formesAdmises(app: BlocsDApparence): readonly FormeArete[] {
  return FORMES_ARETE.filter((f) =>
    f === 'mur-nu' || (f === 'mur-fenetre' ? !!app.window && !app.parapet : !!app.door));
}

/** Apparence du MUR NU : celle d'une arête qui n'en déclare aucune, hors façade. */
export const APPARENCE_MUR_NU = 'plain';

/** Apparence de MUR que l'arête porte, telle que le rendu la résout (`edgeAppearance`,
 *  `gameIso/builders/roofs.ts`) : l'apparence déclarée, sinon celle de la façade authorée sur l'arête
 *  (`facadeAppearance`, préset ou apparence de mur — `murDeFacade`), sinon le mur nu. */
export function apparenceDeLArete(seg: Pick<WallSeg, 'appearance' | 'structure'>, facadeAppearance?: string): string {
  return apparenceDeclaree(seg) ?? (facadeAppearance !== undefined ? murDeFacade(facadeAppearance) : APPARENCE_MUR_NU);
}

/** Formes que l'arête prend et que l'apparence n'admet pas — vide = compatible. */
export function formesHorsCompatibilite(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>, app: BlocsDApparence): FormeArete[] {
  const admises = formesAdmises(app);
  return formesDeLArete(seg).filter((f) => !admises.includes(f));
}

/** L'arête peut-elle recevoir une fenêtre : elle deviendrait `mur-fenetre` (ni porte ni fermeture fixe)
 *  et son apparence habille cette forme ? Lu par l'Inspecteur (case « Fenêtre décorative »). */
export function fenetrePosable(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>, app: BlocsDApparence): boolean {
  const avecFenetre = { ...seg, window: true };
  return formesDeLArete(avecFenetre)[0] === 'mur-fenetre' && formesHorsCompatibilite(avecFenetre, app).length === 0;
}

/** TYPE d'arête que l'auteur choisit (Inspecteur) : un REGROUPEMENT des formes que l'arête peut prendre
 *  — une cloison prend le mur nu ou fenêtré, une porte ouvrable ses deux états, une fermeture fixe elle
 *  seule. */
export type TypeDArete = 'cloison' | 'porte' | 'fermeture-fixe';

export const FORMES_DU_TYPE: Record<TypeDArete, readonly FormeArete[]> = {
  cloison: ['mur-nu', 'mur-fenetre'],
  porte: ['porte-fermee', 'porte-ouverte'],
  'fermeture-fixe': ['fermeture-fixe'],
};

const TYPES: readonly TypeDArete[] = ['cloison', 'porte', 'fermeture-fixe'];

export function typeDArete(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>): TypeDArete {
  const forme = formesDeLArete(seg)[0];
  return TYPES.find((t) => FORMES_DU_TYPE[t].includes(forme))!;
}

/** Nature d'authoring (`structureEdgeKind`) des Structures posables pour ce type : une baie est portée
 *  par une Structure de nature `porte`, un mur par une de nature `mur`. */
export function natureDuType(type: TypeDArete): 'mur' | 'porte' {
  return FORMES_DU_TYPE[type].some(estBaie) ? 'porte' : 'mur';
}

/** Retire l'apparence DÉCLARÉE en override si elle n'habille plus les formes de l'arête patchée. */
function avecApparenceCompatible(seg: WallSeg, patch: Partial<WallSeg>): Partial<WallSeg> {
  const app = seg.appearance ? structureAppearances.find((a) => a.id === seg.appearance) : undefined;
  const garderApparence = !app || formesHorsCompatibilite({ ...seg, ...patch }, app).length === 0;
  return { ...patch, appearance: garderApparence ? seg.appearance : undefined };
}

/**
 * Patch qui fait passer l'arête au type `type` en restant COHÉRENTE : `door`/`closed` n'existent que sur
 * une porte ouvrable, `window` que sur une cloison ; la Structure est gardée si sa nature convient, sinon
 * retirée — sauf la fermeture fixe, qui EXIGE une Structure de nature `porte` et prend la première du
 * catalogue (`premierOffert`) ; l'apparence déclarée est retirée si elle n'habille plus les formes de
 * l'arête.
 */
export function patchVersType(seg: WallSeg, type: TypeDArete): Partial<WallSeg> {
  const nature = natureDuType(type);
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  const garde = s && structureEdgeKind(s) === nature ? seg.structure : undefined;
  const structure = garde ?? (type === 'fermeture-fixe'
    ? premierOffert(structures.filter(isDoorEdgeStructure), 'Fermeture fixe')
    : undefined);
  return avecApparenceCompatible(seg, {
    door: type === 'porte' ? true : undefined,
    closed: type === 'porte' ? seg.closed : undefined,
    window: type === 'cloison' ? seg.window : undefined,
    structure,
  });
}

/** Patch qui pose la Structure `structure` sur l'arête en restant COHÉRENTE : la fenêtre part si la
 *  nouvelle apparence ne l'habille pas, l'override d'apparence part s'il n'habille plus l'arête. */
export function patchVersStructure(seg: WallSeg, structure: string | undefined, facadeAppearance?: string): Partial<WallSeg> {
  const app = structureAppearances.find((a) => a.id === apparenceDeLArete({ ...seg, structure }, facadeAppearance));
  const window = seg.window && app && !formesHorsCompatibilite({ ...seg, structure, window: true }, app).length ? true : undefined;
  return avecApparenceCompatible(seg, { structure, window });
}

const libelles = (formes: readonly FormeArete[]): string => formes.map((f) => `« ${LIBELLE_FORME[f]} »`).join(', ');

/** Un message nommé par arête dont l'apparence RÉSOLUE (`apparenceDeLArete` : déclarée, de façade ou
 *  mur nu, lue au catalogue `structureAppearance.json`) n'habille pas une des formes que l'arête prend
 *  (lu par `validateScene`). */
export function aretesHorsCompatibilite(scene: Pick<Scene, 'walls' | 'architecture'>): string[] {
  const facades = facadeEdges(scene);
  const out: string[] = [];
  for (const w of scene.walls ?? []) {
    const id = apparenceDeLArete(w, facades.get(edgeKey(w))?.appearance);
    const app = structureAppearances.find((a) => a.id === id);
    if (!app) continue;
    const hors = formesHorsCompatibilite(w, app);
    if (hors.length)
      out.push(`Arête (${w.x},${w.y}) ${w.side}${w.z ? ` étage ${w.z}` : ''} : l’apparence « ${app.label} » n’habille pas la forme ${libelles(hors)} — elle admet ${libelles(formesAdmises(app))}. Change l’apparence, ou la nature de l’arête.`);
  }
  return out;
}
