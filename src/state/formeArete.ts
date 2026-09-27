/**
 * FORME d'une arête de mur (#1883) et COMPATIBILITÉ apparence × forme — source UNIQUE, lue par
 * `validateScene` (refus), l'Inspecteur (choix proposés) et `gameIso/builders/walls.ts` (branche de rendu).
 *
 * La forme se dérive de la nature d'authoring de la Structure (`structureEdgeKind`) ET de `seg.door` ;
 * la compatibilité se dérive des blocs que l'apparence PORTE (`door`, `claireVoie`, `parapet`), jamais
 * d'une liste d'ids.
 */
import type { WallSeg } from './scene';
import { findStructureById, structureAppearances, structures } from '../data';
import { structureEdgeKind } from '../engine/structures';

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

/** La forme est-elle une fermeture (porte ouvrable ou fixe) ? */
export function estFermeture(forme: FormeArete): boolean {
  return forme === 'porte-fermee' || forme === 'porte-ouverte' || forme === 'fermeture-fixe';
}

/** Id d'apparence DÉCLARÉ par le segment : l'override visuel, sinon la Structure. `undefined` = aucun
 *  (façade authorée ou mur nu). Précédence lue par `wallApp` (`gameIso/catalog/structures`). */
export function apparenceDeclaree(seg: Pick<WallSeg, 'appearance' | 'structure'>): string | undefined {
  return seg.appearance || seg.structure || undefined;
}

/** L'arête porte-t-elle une Structure de nature `porte` (`structureEdgeKind`) ? */
function structureFermeture(seg: Pick<WallSeg, 'structure'>): boolean {
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  return !!s && structureEdgeKind(s) === 'porte';
}

/** Formes que l'arête PREND en jeu : une porte ouvrable prend les deux états, les autres un seul. Une
 *  fenêtre ne se lit que sur un mur (l'Inspecteur ne la propose qu'hors porte). */
export function formesDeLArete(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>): readonly FormeArete[] {
  if (seg.door) return ['porte-fermee', 'porte-ouverte'];
  if (structureFermeture(seg)) return ['fermeture-fixe'];
  return [seg.window ? 'mur-fenetre' : 'mur-nu'];
}

/** Forme RENDUE à cet instant (`open` = état runtime de la porte, `doorIsOpen`). */
export function formeRendue(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>, open: boolean): FormeArete {
  return seg.door ? (open ? 'porte-ouverte' : 'porte-fermee') : formesDeLArete(seg)[0];
}

/** Ce qu'une apparence porte, et que la compatibilité lit. */
export interface BlocsDApparence {
  door?: unknown;
  claireVoie?: unknown;
  parapet?: unknown;
}

/**
 * Formes qu'une apparence sait HABILLER :
 *  - bloc `door` → les trois fermetures (porte fermée, ouverte, fixe) ;
 *  - `claireVoie` ou `parapet` sans `door` → mur nu seulement (la claire-voie n'a pas de face à percer,
 *    la courtine crénelée ne dessine ni croisée ni ouverture) ;
 *  - sinon (mur ordinaire) → les cinq : la croisée et le vantail absents se rendent par leurs replis
 *    (`defaultWindow`, `DOOR_FRAC`).
 */
export function formesAdmises(app: BlocsDApparence): readonly FormeArete[] {
  if (app.door) return ['porte-fermee', 'porte-ouverte', 'fermeture-fixe'];
  if (app.claireVoie || app.parapet) return ['mur-nu'];
  return FORMES_ARETE;
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

/** TYPE d'arête que l'auteur choisit (Inspecteur) — la partition de `formesDeLArete` : une cloison prend
 *  le mur nu ou fenêtré, une porte ouvrable ses deux états, une fermeture fixe elle seule. */
export type TypeDArete = 'cloison' | 'porte' | 'fermeture-fixe';

export function typeDArete(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>): TypeDArete {
  const forme = formesDeLArete(seg)[0];
  return forme === 'fermeture-fixe' ? 'fermeture-fixe' : estFermeture(forme) ? 'porte' : 'cloison';
}

/** Nature d'authoring (`structureEdgeKind`) des Structures posables pour ce type d'arête. */
export function natureDuType(type: TypeDArete): 'mur' | 'porte' {
  return type === 'cloison' ? 'mur' : 'porte';
}

/**
 * Patch qui fait passer l'arête au type `type` en restant COHÉRENTE : `door`/`closed` n'existent que sur
 * une porte ouvrable, `window` que sur une cloison ; la Structure est gardée si sa nature convient, sinon
 * retirée — sauf la fermeture fixe, qui EXIGE une Structure de nature `porte` et prend la première du
 * catalogue ; l'apparence déclarée est retirée si elle n'habille plus les formes de l'arête.
 */
export function patchVersType(seg: WallSeg, type: TypeDArete): Partial<WallSeg> {
  const nature = natureDuType(type);
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  const garde = s && structureEdgeKind(s) === nature ? seg.structure : undefined;
  const structure = garde ?? (type === 'fermeture-fixe'
    ? structures.find((c) => structureEdgeKind(c) === 'porte')?.id
    : undefined);
  const patch: Partial<WallSeg> = {
    door: type === 'porte' ? true : undefined,
    closed: type === 'porte' ? seg.closed : undefined,
    window: type === 'cloison' ? seg.window : undefined,
    structure,
  };
  const app = seg.appearance ? structureAppearances.find((a) => a.id === seg.appearance) : undefined;
  const garderApparence = !app || formesHorsCompatibilite({ ...seg, ...patch }, app).length === 0;
  return { ...patch, appearance: garderApparence ? seg.appearance : undefined };
}

const libelles = (formes: readonly FormeArete[]): string => formes.map((f) => `« ${LIBELLE_FORME[f]} »`).join(', ');

/** Un message nommé par arête dont l'apparence DÉCLARÉE (`apparenceDeclaree`, lue au catalogue
 *  `structureAppearance.json`) n'habille pas une des formes que l'arête prend (lu par `validateScene`). */
export function aretesHorsCompatibilite(walls: readonly WallSeg[]): string[] {
  const out: string[] = [];
  for (const w of walls) {
    const id = apparenceDeclaree(w);
    const app = id ? structureAppearances.find((a) => a.id === id) : undefined;
    if (!app) continue;
    const hors = formesHorsCompatibilite(w, app);
    if (hors.length)
      out.push(`Arête (${w.x},${w.y}) ${w.side}${w.z ? ` étage ${w.z}` : ''} : l’apparence « ${app.label} » n’habille pas la forme ${libelles(hors)} — elle admet ${libelles(formesAdmises(app))}. Change l’apparence, ou la nature de l’arête.`);
  }
  return out;
}
