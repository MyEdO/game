/**
 * FORME d'une arête de mur (#1883) et COMPATIBILITÉ apparence × forme — source UNIQUE, lue par
 * `validateScene` (refus), l'Inspecteur (choix proposés) et `gameIso/builders/walls.ts` (branche de rendu).
 *
 * La forme se dérive de la nature d'authoring de la Structure (`structureEdgeKind`) ET de `seg.door` ;
 * la compatibilité se dérive des blocs que l'apparence DÉCLARE (`window`, `door`, `parapet`), jamais
 * d'une liste d'ids ni de l'absence d'un bloc.
 */
import type { FacadeFeature, Scene, WallSeg } from './scene';
import { facadeDeLArete } from './facadeEdges';
import { facadePreset, KINDS_DE_DECOR, murDeFacade } from '../data/facadePresets';
import { findStructureById, premierOffert, structureAppearances, structures } from '../data';
import { facadeFeatureKindSchema } from '../data/schemas/defs-scenes/scene';
import { valeursDe } from '../data/schemas/grammaire/meta';
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

/** Ce qu'une apparence déclare, et que la compatibilité lit. */
export interface BlocsDApparence {
  window?: unknown;
  door?: unknown;
  claireVoie?: unknown;
  parapet?: { corpsDeGarde?: unknown };
}

/**
 * Formes qu'une apparence sait HABILLER, lues sur ses blocs DÉCLARÉS (`gameIso/builders/walls.ts`,
 * `wallFaces`) :
 *  - mur nu → toujours : chaque branche dessine un pan plein depuis les champs de l'apparence (courtine
 *    d'un `parapet`, claire-voie, panneau) ;
 *  - mur fenêtré → bloc `window`, hors `parapet` (la branche de courtine ne dessine pas de croisée) ;
 *  - porte fermée, ouverte, fermeture fixe → sur une courtine (`parapet`), son `corpsDeGarde` ET une
 *    `claireVoie` (la branche de courtine barre le passage fermé de sa claire-voie, sans vantail) ; bloc
 *    `door` sinon.
 */
export function formesAdmises(app: BlocsDApparence): readonly FormeArete[] {
  const baie = app.parapet ? !!app.parapet.corpsDeGarde && !!app.claireVoie : !!app.door;
  return FORMES_ARETE.filter((f) => f === 'mur-nu' || (f === 'mur-fenetre' ? !!app.window && !app.parapet : baie));
}

/** Apparence du MUR NU : celle d'une arête qui n'en déclare aucune, hors façade. */
export const APPARENCE_MUR_NU = 'plain';

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
export function patchVersStructure(scene: Pick<Scene, 'architecture'>, seg: WallSeg, structure: string | undefined): Partial<WallSeg> {
  const app = structureAppearances.find((a) => a.id === apparenceDeLArete(scene, { ...seg, structure }));
  const window = seg.window && app && !formesHorsCompatibilite({ ...seg, structure, window: true }, app).length ? true : undefined;
  return avecApparenceCompatible(seg, { structure, window });
}

const libelles = (formes: readonly FormeArete[]): string => formes.map((f) => `« ${LIBELLE_FORME[f]} »`).join(', ');

const apparenceParId = (id: string) => structureAppearances.find((a) => a.id === id);

/** LIBELLÉ d'affichage d'une arête — `(x,y,side)`, suivi de ` étage z` hors du rez-de-chaussée. Du texte
 *  lu par les messages de validation et les résumés d'effet de l'éditeur : il vit dans l'état, pas dans
 *  `geometry`, qui reste pur. */
export const libelleArete = (e: { x: number; y: number; side: string; z?: number }): string =>
  `(${e.x},${e.y},${e.side})${e.z ? ` étage ${e.z}` : ''}`;

/** Libellé d'un ornement, lu sur l'enum nommé `facadeFeatureKindSchema`. */
const LIBELLE_ORNEMENT = valeursDe(facadeFeatureKindSchema) as Readonly<Record<FacadeFeature['kind'], string>>;

/** Un message nommé par arête dont l'apparence RÉSOLUE (`apparenceDeLArete`) est absente du catalogue
 *  `structureAppearance.json`, ou n'habille pas une des formes que l'arête prend (lu par `validateScene`).
 *  Une arête sous une façade hors préset n'a pas d'apparence : `facadesHorsCompatibilite` dit la faute,
 *  une fois. */
export function aretesHorsCompatibilite(scene: Pick<Scene, 'walls' | 'architecture'>): string[] {
  const out: string[] = [];
  for (const w of scene.walls ?? []) {
    const ou = `Arête ${libelleArete(w)}`;
    const id = apparenceDeLArete(scene, w);
    if (id === undefined) continue;
    const app = apparenceParId(id);
    if (!app) {
      out.push(`${ou} : l’apparence « ${id} » est absente du catalogue des apparences de mur.`);
      continue;
    }
    const hors = formesHorsCompatibilite(w, app);
    if (hors.length)
      out.push(`${ou} : l’apparence « ${app.label} » n’habille pas la forme ${libelles(hors)} — elle admet ${libelles(formesAdmises(app))}. Change l’apparence, ou la nature de l’arête.`);
  }
  return out;
}

/** Un message nommé par section de façade dont l'apparence n'est pas un préset (`FACADE_PRESETS`) ; par
 *  ornement de DÉCOR (`KINDS_DE_DECOR`) sans vignette au préset ; par ornement de MUR sans apparence
 *  (`apparenceDOrnement`) ou d'apparence inconnue ; par bande de fenêtres dont
 *  l'apparence n'habille pas le mur fenêtré (lu par `validateScene`). */
export function facadesHorsCompatibilite(scene: Pick<Scene, 'architecture'>): string[] {
  const out: string[] = [];
  for (const body of scene.architecture ?? [])
    for (const section of body.facades) {
      const preset = facadePreset(section.appearance);
      if (!preset) {
        out.push(`Façade « ${section.id} » (${body.id}) : « ${section.appearance} » n’est pas un préset de façade.`);
        continue;
      }
      for (const feature of section.features ?? []) {
        const libelle = LIBELLE_ORNEMENT[feature.kind];
        const ou = `Façade « ${section.id} » (${body.id}), ornement « ${feature.id} » (${libelle})`;
        if (KINDS_DE_DECOR.has(feature.kind)) {
          if (!preset.features[feature.kind]) out.push(`${ou} : le préset « ${preset.id} » n’a pas de décor « ${libelle} ».`);
          continue;
        }
        const id = apparenceDOrnement(section.appearance, feature);
        const app = id === undefined ? undefined : apparenceParId(id);
        if (id === undefined) out.push(`${ou} : aucune apparence — ni la sienne, ni celle que route le préset « ${preset.id} ».`);
        else if (!app) out.push(`${ou} : l’apparence « ${id} » est absente du catalogue des apparences de mur.`);
        else if (feature.kind === 'window-band' && !formesAdmises(app).includes('mur-fenetre'))
          out.push(`${ou} : l’apparence « ${app.label} » n’habille pas la forme « ${LIBELLE_FORME['mur-fenetre']} ».`);
      }
    }
  return out;
}
