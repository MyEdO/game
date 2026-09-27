/**
 * FORME d'une arête de mur (#1883) — DÉRIVATION, source UNIQUE : les formes qu'un segment prend, celle
 * qu'il rend, son type d'authoring et l'apparence qu'il porte ; confrontées à l'ADMISSION de
 * l'apparence (`formesAdmises`, `data/formesDArete.ts`). Lue par `validateScene`
 * (`state/compatibiliteArete.ts`), l'Inspecteur (choix proposés, `state/editionArete.ts`) et
 * `gameIso/builders/walls.ts` (branche de rendu).
 *
 * La forme se dérive de la nature d'authoring de la Structure (`structureEdgeKind`) ET de `seg.door`.
 */
import type { FacadeFeature, Scene, WallSeg } from './scene';
import { facadeDeLArete } from './facadeEdges';
import { facadePreset, murDeFacade } from '../data/facadePresets';
import { findStructureById, structureAppearances } from '../data';
import { estBaie, formesAdmises, type BlocsDApparence, type FormeArete } from '../data/formesDArete';
import { isDoorEdgeStructure } from '../engine/structures';

/** Id d'apparence DÉCLARÉ par le segment : l'override visuel, sinon la Structure. `undefined` = aucun
 *  (façade authorée ou mur nu). Précédence lue par `wallApp` (`gameIso/catalog/structures`). */
export function apparenceDeclaree(seg: Pick<WallSeg, 'appearance' | 'structure'>): string | undefined {
  return seg.appearance || seg.structure || undefined;
}

/** Formes que l'arête PREND en jeu : une porte ouvrable prend les deux états, les autres un seul. Une
 *  fenêtre ne se lit que sur un mur (l'Inspecteur ne la propose qu'hors porte). */
export function formesDeLArete(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>): readonly FormeArete[] {
  if (seg.door) return ['porte-fermee', 'porte-ouverte'];
  const s = seg.structure ? findStructureById(seg.structure) : undefined;
  if (s && isDoorEdgeStructure(s)) return ['fermeture-fixe'];
  return [seg.window ? 'mur-fenetre' : 'mur-nu'];
}

/** Forme RENDUE à cet instant (`open` = état runtime de la porte, `doorIsOpen`). */
export function formeRendue(seg: Pick<WallSeg, 'door' | 'window' | 'structure'>, open: boolean): FormeArete {
  return seg.door ? (open ? 'porte-ouverte' : 'porte-fermee') : formesDeLArete(seg)[0];
}

/** Apparence du MUR NU : celle d'une arête qui n'en déclare aucune, hors façade. */
export const APPARENCE_MUR_NU = 'plain';

/** Def d'apparence du catalogue `structureAppearance.json` par id ; `undefined` = absente. */
export const apparenceParId = (id: string) => structureAppearances.find((a) => a.id === id);

/** Apparence de MUR que l'arête porte — la SEULE résolution, que le rendu consomme telle quelle
 *  (`structureAppearance(apparenceDeLArete(scene, seg))`) : l'apparence déclarée, sinon celle du préset
 *  de la façade authorée sur l'arête (`murDeFacade`), sinon le mur nu. `undefined` = la façade n'est pas
 *  un préset : `facadesHorsCompatibilite` le nomme, le rendu peint le repli visible. */
export function apparenceDeLArete(
  scene: Pick<Scene, 'architecture'>,
  seg: Pick<WallSeg, 'x' | 'y' | 'side' | 'z' | 'appearance' | 'structure'>,
): string | undefined {
  const declaree = apparenceDeclaree(seg);
  if (declaree) return declaree;
  const facade = facadeDeLArete(scene, seg);
  return facade ? murDeFacade(facade.appearance) : APPARENCE_MUR_NU;
}

/** Apparence de MUR d'un ornement de façade — la SEULE résolution, que le rendu (`builders/walls.ts`,
 *  `builders/roofs.ts`) consomme : celle de l'ornement, sinon celle que route le préset `presetId`
 *  (`wallFeatures`). `undefined` = aucune : `facadesHorsCompatibilite` le nomme, le rendu peint le repli
 *  visible. */
export function apparenceDOrnement(presetId: string, feature: Pick<FacadeFeature, 'kind' | 'appearance'>): string | undefined {
  return feature.appearance ?? facadePreset(presetId)?.wallFeatures[feature.kind];
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
