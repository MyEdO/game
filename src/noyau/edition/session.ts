/**
 * LA SESSION D'ÉDITION D'UNE CARTE (#3508), sans hôte : l'historique du projet ouvert et de sa scène éditée, l'outil, la
 * couche, le pinceau, la sélection, le geste du pointeur en cours, le tracé d'une volée, le brouillon de l'arête
 * sélectionnée, l'entité copiée, l'enregistrement au dépôt et les calques de référence, et le seul réducteur qui les fait avancer
 * (`editer`) sur une union fermée de gestes. Chaque geste délègue au pointeur (`./pointeur`), à l'historique
 * (`./historique`), aux écrivains de `../sceneEdit` (dont l'écriture bornée du formulaire tiré du schéma), à la volée
 * (`../stairFlight`), au calque (`./calque`) et à la pose d'un navire (`../planDeNavire`) ; aucun n'écrit de règle de
 * scène. Ce qu'elle montre est la vue de la scène éditée, ses navires posés par leurs ponts (`vueDeLaScene`). L'éditeur
 * Godot la reçoit par le pont.
 */
import type { FabriqueDId } from '../../engine/fabriqueDId';
import type {
  ArchitectureBody,
  ArchitectureStorey,
  BuildingMass,
  FacadeFeature,
  RoofDefaults,
  Scene,
  SceneEntity,
  SceneStationAnchor,
  WallSecret,
  WallSeg,
} from '../monde/scene';
import { apparencesDeLOuverture } from '../monde/facades';
import { type ReliefDefaults, type SceneRoofDefaults } from '../../data/schemas/defs-scenes/scene';
import { inventaireApres, type IntentionDObjet } from '../../engine/items';
import { PARTS_RELIEF } from '../../data/materials.types';
import type { Dir4, Dir8 } from '../../geometry/dir8';
import type { FireArc } from '../../engine/types';
import type { ParcoursDeCarriere } from '../../engine/pnjDeCarriere';
import type { SeatOccupant } from '../monde/seating';
import { documentDeProjet, parseProject, ProjetRefuse, texteDuDepot, type ProjectDoc } from '../worldMap';
import { refusDeLaPorteDuProjet, type GesteDePorte } from '../persistance/refusDeLaPorte';
import {
  addArchitectureBody,
  addArchitecturePart,
  addBuildingMass,
  addFacadeFeature,
  addRoofExclusion,
  patchBuildingMass,
  poseToitureDuCorps,
  rectFrom,
  removeRoofExclusion,
  addLayer,
  patchSceneRoofDefaults,
  removeSceneFlag,
  resizeGrid,
  setNorthDeg,
  setReliefDefault,
  setSceneFlags,
  setSceneLabel,
  setSceneRest,
  setSceneScalaires,
  type ScalairesDeScene,
  addProjectScene,
  deleteProjectScene,
  duplicateProjectScene,
  renameScene,
  type ProjectScenes,
  addMember,
  addStoreyAbove,
  patchArchitectureBody,
  patchArchitectureStorey,
  patchFacadeFeature,
  patchFacadeSection,
  removeFacadeFeature,
  setFacadeSectionZ,
  assoirALaPlace,
  deleteSel,
  dupliquerLEntite,
  poserUneTroupe,
  coucheEcrite,
  editEntity,
  editEntry,
  ECRITURES_DES_PORTEURS,
  projetSansLePorteur,
  pasteEntity,
  sansVide,
  patchMember,
  patchWall,
  patchZone,
  propRefPatch,
  removeLayer,
  removeMember,
  renameEffectZone,
  avecLaValeurDuPorteur,
  avecLAdresseRescellee,
  type EcritureDeValeur,
  type RefusDeValeur,
  type Segment,
  renameEntry,
  setPosteCrew,
  setPosteEngine,
  setPosteSide,
  addStation,
  patchStation,
  removeStation,
  setSceneMusic,
  type PatchDeZone,
  type Pt,
} from '../sceneEdit';
import {
  DOCUMENTS,
  FORMULAIRES,
  accesDe,
  cheminOffert,
  entiteDeLaSelection,
  formeDuPorteur,
  porteurDeLaPortee,
  porteurDeLaSel,
  porteurDuProjet,
  selDuPorteur,
  selPos,
  selZ,
  etageSuivant,
  poigneeDeLaSelection,
  segmentDeLaSelection,
  type CadreDuPorteur,
  type DonneeDuPorteur,
  type Layers,
  type ProjetDEdition,
  type Sel,
  type SorteDeDocument,
  type SorteDePorteur,
  type Tool,
  type DocumentDuProjet,
} from '../sceneEditLecture';
import { applyStairFlight, planStairFlight, type StairFlightPlan } from '../stairFlight';
import { poserLesNavires, poserUnNavire } from '../planDeNavire';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { nextEntityId } from '../../lib/entityId';
import { groupeVitrine } from '../../data/pregens';
import { lancementDuProjet, type LancementDeScenario } from '../lancementDeScenario';
import { facadeFeatureKindSchema, roofProfileSchema, sceneSchema, sceneWeatherSchema } from '../../data/schemas/defs-scenes/scene';
import { choixDuNoeud, elementDuNoeud, type ValeurDuChoix } from '../codex/editFields';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { architectureSelectionForWarning, validateScene, type Warning } from '../validateScene';
import { memoByDeps } from '../monde/sceneMemo';
import { versionDesDatasets } from '../../data/versionDataset';
import { planDefectKey, planFocusAt, planFocusTiles } from '../planDefects';
import { annuler, historiqueDe, poser, reecrire, retablir, type Historique } from './historique';
import {
  appuyer,
  appuyerSurLaCarte,
  appuyerSurLePlanDuLieu,
  glisser,
  glisserSurLaCarte,
  glisserSurLePlanDuLieu,
  relacher,
  relacherSurLaCarte,
  saisirLaPoignee,
  type ContexteDuPointeur,
  type EffetDuPointeur,
  type EffetSurLaCarte,
  type EffetSurLePlanDuLieu,
  type GesteEnCours,
  type PointDeCarte,
} from './pointeur';
import { orienterRoute, retirerPoi } from '../worldMapEdit';
import type { MapPlace, WorldMap } from '../worldMap';
import type { CalibProgress } from './calage';
import type { Manifeste } from '../../data/source/chapitres';
import { estGraphieDeChapitre, parseChapitre, type ChapitreParse } from '../../data/source/decoupe';
import { adressesDe, cleDuChapitre } from './adresseDeProse';
import { caler, calqueNeuf, calquesLus, type CalqueDeCouche, type CalquesDuProjet, type ReglageDuCalque } from './calque';

/** Les tailles du pinceau, en cases de côté. */
export const PINCEAUX = [1, 3, 5] as const;

/** Les hauteurs offertes au pinceau de hauteur, en mètres (`relief.ts`) : `plat` remet la surface à 0. */
export const HAUTEURS = [
  { cle: 'plat', metres: 0 },
  { cle: 'estrade', metres: 1 },
  { cle: 'surface', metres: 2 },
  { cle: 'haute', metres: 4 },
  { cle: 'contrebas', metres: -2 },
] as const;

/** Les calques de la carte, tous visibles. */
const TOUS_LES_CALQUES: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, zones: true };

/** Ce que fait le clic de l'outil d'architecture : sélectionner dans le corps actif (`corpsActif`), poser une façade
 *  sur l'arête appuyée, ou tirer une exclusion de toiture du corps actif sur la couche éditée. */
export const ACTIONS_D_ARCHITECTURE = ['selection', 'facade', 'exclusion'] as const;
export type ActionDArchitecture = (typeof ACTIONS_D_ARCHITECTURE)[number];

/** Les outils que l'éditeur offre, dont celui qui pose un navire du type `ref` au cap `cap` (`poserUnNavire`), ceux
 *  du plan de la carte du monde qui posent un lieu et tirent une route (`OUTILS_DE_LA_CARTE`), et celui du plan d'un lieu
 *  qui pose un point d'intérêt (`OUTILS_DU_PLAN_DU_LIEU`). */
export type OutilDeLEditeur =
  | Extract<Tool, { mode: 'selection' | 'terrain' | 'hauteur' | 'arete' | 'escalier' | 'crenelage' | 'entite' | 'emplacement' | 'entree' | 'zone' | 'casesDeZone' | 'gomme' }>
  | { mode: 'architecture'; action: ActionDArchitecture }
  | { mode: 'navire'; ref: string; cap: Dir4 }
  | { mode: 'lieu' }
  | { mode: 'chemin' }
  | { mode: 'epingler' };

/** Ce que bâtit l'outil d'architecture : un corps ou une partie sur la case pointée, l'étage au-dessus du corps actif,
 *  une masse de toiture sur la case pointée. */
export const OUVRAGES = ['corps', 'etage', 'partie', 'masse'] as const;
export type Ouvrage = (typeof OUVRAGES)[number];

/** Ce que l'inspecteur de la scène écrit, sans sélection : ses champs scalaires (`null` retire le champ), sa grille,
 *  son nord (`null` : vers le haut du plan), les matières de son relief, sa toiture par défaut, son repos sur place
 *  (lieux offerts, qualité piètre), ses drapeaux de départ (`null` retire le drapeau) ; une piste de sa musique
 *  (`setSceneMusic` : `id` absent, la piste du contexte ; `null`, le silence) ; ses ancres de bataille, une ajoutée vers la Scène de
 *  Round `ajouter`, celle de rang `rang` patchée, ou celle de rang `retirer` retirée. */
export interface PatchDeScene {
  scalaires?: { [K in keyof ScalairesDeScene]?: ScalairesDeScene[K] | null };
  dimensions?: { w: number; h: number };
  nord?: number | null;
  relief?: Partial<ReliefDefaults>;
  toiture?: Partial<SceneRoofDefaults>;
  repos?: { lieux?: PatchDeZone['lieux']; pietre?: boolean };
  drapeaux?: Record<string, boolean | null>;
  musique?: { piste: keyof NonNullable<Scene['music']>; id?: string | null };
  stations?: { ajouter: string } | { rang: number; sceneId?: string; pos?: SceneStationAnchor['pos'] } | { retirer: number };
}

/** Les groupes que le lieu déclare (`Scene.groups`), chacun sa valeur et son libellé (`choixDuNoeud`). */
export const groupesDuLieu = (): ValeurDuChoix[] => choixDuNoeud(elementDuNoeud(sceneSchema.shape.groups))!;

/** La validation du projet (`validateScene`), datée par la version des datasets qu'elle lit (`versionDesDatasets`), comme
 *  le mémo de schéma de `validateScene.ts`. */
const validationDuProjet = memoByDeps<Warning[]>();

/** Les avertissements de la validation (`validateScene`) qui concernent la scène éditée de la session `s`, ceux de la
 *  carte du monde compris. */
export function avertissementsDeLaSession(s: SessionDEdition): Warning[] {
  const { scenes, worldMap, narratif } = projetEdite(s);
  return validationDuProjet([versionDesDatasets(), ...scenes, worldMap, narratif], () => validateScene(scenes, worldMap, narratif))
    .filter((w) => w.sceneId === idDeLaSceneEditee(s) || w.scope === 'worldMap');
}

/** Le porteur de formulaire du projet de la session `s` que désigne l'avertissement `w` (`porteurDeLaPortee`). */
const porteurDeLAvertissement = (s: SessionDEdition, w: Warning) => porteurDeLaPortee(w.scope, w.refId, projetEdite(s), idDeLaSceneEditee(s));

/** L'avertissement `w` de la session `s` désigne-t-il un fautif que l'éditeur sélectionne : un défaut de plan, un ouvrage
 *  d'architecture, ou un porteur de formulaire de son projet (`porteurDeLAvertissement`) ? Les autres se corrigent
 *  ailleurs. */
export const versLaFautive = (s: SessionDEdition, w: Warning): boolean =>
  !!w.plan || !!architectureSelectionForWarning(w) || porteurDeLAvertissement(s, w) !== undefined;

/** Les cases du défaut de plan que suit la session `s`, tant que la validation le relève ; aucune sinon. */
export function casesDuDefaut(s: SessionDEdition): { x: number; y: number; z: number }[] {
  const at = planFocusAt(avertissementsDeLaSession(s), s.defaut);
  return at ? planFocusTiles(at) : [];
}

/** La session `s` amenée au fautif de l'avertissement `w` de sa scène `scene`, à sa couche : un défaut de plan, suivi,
 *  à l'outil de sélection, sa zone d'effet sélectionnée s'il en vise une ; un ouvrage d'architecture sélectionné à
 *  l'outil d'architecture ; un porteur de formulaire (`porteurDeLAvertissement`), son document ouvert, sélectionné à
 *  l'outil de sélection (`selDuPorteur`), à sa couche s'il est posé sur le plan de la scène (`selPos`, `selZ`). */
function versLAvertissement(s: SessionDEdition, scene: Scene, w: Warning): SessionDEdition {
  const vers = (z: number | undefined, sel: Sel, outil: OutilDeLEditeur, defaut: string | null = null): SessionDEdition => ({
    ...s, z: z !== undefined && coucheVue(scene, z) ? z : s.z, sel, outil, defaut, geste: null, volee: [], brouillon: null,
  });
  if (w.plan) {
    const at = w.plan.at;
    const zone = at.kind === 'zone' ? scene.effectZones?.find((z) => z.id === at.zoneId) : undefined;
    return vers(at.z, zone ? { type: 'effectZone', id: zone.id } : null, { mode: 'selection' }, planDefectKey(w.plan));
  }
  const archi = architectureSelectionForWarning(w);
  if (archi) {
    const corps = scene.architecture?.find((c) => c.id === (archi.type === 'architectureBody' ? archi.id : archi.bodyId));
    const z = archi.type === 'architectureStorey' ? corps?.storeys.find((e) => e.id === archi.id)?.z
      : archi.type === 'architecturePart' ? corps?.storeys.find((e) => e.id === archi.storeyId)?.z
        : archi.type === 'facadeSection' ? corps?.facades.find((f) => f.id === archi.id)?.z
          : archi.type === 'roofSection' ? corps?.masses.find((m) => m.id === archi.id)?.z
            : corps?.storeys[0]?.z;
    return vers(z, archi, { mode: 'architecture', action: 'selection' });
  }
  const porteur = porteurDeLAvertissement(s, w)!;
  const sel = selDuPorteur(porteur.sorte, porteur.id);
  return { ...vers(selPos(scene, sel) ? selZ(scene, sel) : undefined, sel, { mode: 'selection' }), document: accesDe(porteur.sorte).document };
}

/** Les scènes du projet de la session `s` autour de la scène éditée. */
function scenesEnProjet(s: SessionDEdition): ProjectScenes {
  const { scenes } = projetEdite(s);
  const rang = scenes.findIndex((sc) => sc.id === idDeLaSceneEditee(s));
  return { avant: scenes.slice(0, rang), scene: scenes[rang], apres: scenes.slice(rang + 1) };
}

/** Les scènes de chaque cran de l'historique `h` : un identifiant neuf n'en reprend aucun, qu'annuler ou rétablir
 *  ramènerait. */
const scenesDeLHistorique = (h: Historique<CranDEdition>): Scene[] => [...h.passe, h.present, ...h.futur].flatMap((c) => c.projet.scenes);

/** La session `s` montrant une autre scène : à l'outil de sélection, sur la couche 0, sans sélection, geste, volée,
 *  brouillon, case pointée, défaut suivi ni calage. */
const remiseAZero = (s: SessionDEdition): SessionDEdition => ({
  ...s, outil: { mode: 'selection' }, z: 0, sel: null, geste: null, volee: [], brouillon: null, pointee: null, defaut: null, calage: HORS_DU_CALAGE, planDuLieu: null,
});

/** La session `s` qui édite la scène `p.scene` de son projet `p`, sur un cran neuf, remise à zéro (`remiseAZero`).
 *  Telle quelle sans `p`. */
function versLaScene(s: SessionDEdition, p: ProjectScenes | null): SessionDEdition {
  if (!p) return s;
  const projet = { ...projetEdite(s), scenes: [...p.avant, p.scene, ...p.apres] };
  return { ...remiseAZero(s), historique: poser(s.historique, { projet, sceneId: p.scene.id }, true) };
}

/** Le document de sorte `document` du projet édité (`DOCUMENTS`). */
const documentDe = (document: SorteDeDocument) => DOCUMENTS[document] as unknown as DocumentDuProjet<unknown>;

/** La session `s` où le document `document` du projet est ouvert, remise à zéro (`remiseAZero`), sans cran : une
 *  navigation ; absent du projet, il y reçoit celui que son document déclare (`DocumentDuProjet.neuf`), sur un cran.
 *  Telle quelle si `document` est déjà ouvert, ou s'il manque sans document neuf. #3606 */
function ouvrirLeDocument(s: SessionDEdition, document: SorteDeDocument): SessionDEdition {
  if (document === s.document) return s;
  const { lire, ecrire, neuf } = documentDe(document);
  const { projet, sceneId } = s.historique.present;
  const ouvert = { ...remiseAZero(s), document };
  if (lire(projet, sceneId) !== undefined) return ouvert;
  return neuf ? { ...ouvert, historique: poser(s.historique, { projet: ecrire(projet, sceneId, neuf(projet)), sceneId }, true) } : s;
}

/** La session `s` qui montre la scène `id` de son projet, sans cran : une navigation, remise à zéro (`remiseAZero`).
 *  Telle quelle si `id` est la scène montrée ou n'est pas au projet. */
function allerALaScene(s: SessionDEdition, id: string): SessionDEdition {
  const cran = s.historique.present;
  if (id === cran.sceneId || !cran.projet.scenes.some((sc) => sc.id === id)) return s;
  return { ...remiseAZero(s), historique: poser(s.historique, { ...cran, sceneId: id }, false) };
}

/** La session `s` dont la scène éditée `scene` prend l'identifiant `id` (`renameScene`), hors de l'historique : chaque
 *  cran le porte, sa scène montrée comprise, et ses calques le suivent. Telle quelle sous un identifiant vide ou pris
 *  dans un cran. */
function sceneRenommee(s: SessionDEdition, scene: Scene, id: string): SessionDEdition {
  const ancien = idDeLaSceneEditee(s);
  const renommee = renameScene(scene, scenesDeLHistorique(s.historique).filter((sc) => sc.id !== ancien), id);
  if (renommee === scene) return s;
  const renommer = (c: CranDEdition): CranDEdition => ({
    projet: { ...c.projet, scenes: c.projet.scenes.map((sc) => (sc.id === ancien ? { ...sc, id: renommee.id } : sc)) },
    sceneId: c.sceneId === ancien ? renommee.id : c.sceneId,
  });
  const { [ancien]: siens, ...autres } = s.calques;
  return {
    ...s,
    historique: { ...reecrire(s.historique, renommer), present: renommer(s.historique.present) },
    ...(siens ? { calques: { ...autres, [renommee.id]: siens } } : {}),
  };
}

/** La scène `scene` où `patch` s'écrit. */
function scenePatchee(scene: Scene, patch: PatchDeScene): Scene {
  let sc = scene;
  if (patch.scalaires) sc = setSceneScalaires(sc, Object.fromEntries(Object.entries(patch.scalaires).map(([k, v]) => [k, v ?? undefined])));
  if (patch.dimensions) sc = resizeGrid(sc, patch.dimensions.w, patch.dimensions.h);
  if (patch.nord !== undefined) sc = setNorthDeg(sc, patch.nord ?? undefined);
  for (const part of PARTS_RELIEF) {
    const matiere = patch.relief?.[part];
    if (matiere) sc = setReliefDefault(sc, part, matiere);
  }
  if (patch.toiture) sc = patchSceneRoofDefaults(sc, patch.toiture);
  if (patch.repos) sc = setSceneRest(sc, { ...patch.repos.lieux, ...(patch.repos.pietre !== undefined && { quality: patch.repos.pietre ? 'pietre' : undefined }) });
  for (const [cle, valeur] of Object.entries(patch.drapeaux ?? {})) sc = valeur === null ? removeSceneFlag(sc, cle) : setSceneFlags(sc, { [cle]: valeur });
  if (patch.musique) sc = setSceneMusic(sc, patch.musique.piste, patch.musique.id);
  if (patch.stations) sc = stationsPatchees(sc, patch.stations);
  return sc;
}

/** La scène `scene` où `p` s'écrit sur ses ancres de bataille (`PatchDeScene.stations`). */
function stationsPatchees(scene: Scene, p: NonNullable<PatchDeScene['stations']>): Scene {
  if ('ajouter' in p) return addStation(scene, p.ajouter);
  if ('retirer' in p) return removeStation(scene, p.retirer);
  return patchStation(scene, p.rang, { ...(p.sceneId === undefined ? {} : { sceneId: p.sceneId }), ...(p.pos ? { pos: p.pos } : {}) });
}

/** Ce que l'inspecteur écrit sur le corps, l'étage, la façade ou la masse de toiture sélectionnée : le type de bâtiment
 *  du corps (`null` : sans type), un champ de sa toiture (`null` : le champ suit), l'exclusion de toiture qu'il retire ;
 *  les pièces que révèle l'étage ou la façade, l'apparence de la façade ; l'étage de la façade ou de la masse ; un
 *  champ de la masse (`null` : le champ se retire). */
export interface PatchDArchitecture {
  style?: ArchitectureBody['style'] | null;
  toiture?: { [K in keyof RoofDefaults]?: RoofDefaults[K] | null };
  retirerExclusion?: number;
  pieces?: string[];
  apparence?: string;
  z?: number;
  masse?: { levels?: number; profile?: BuildingMass['profile']; pitchDeg?: number; material?: BuildingMass['material']; ridge?: 'x' | 'y' | null; eaveSide?: BuildingMass['eaveSide'] | null };
}

/** Les profils de toit et leur libellé (`roofProfileSchema`). */
export const PROFILS_DE_TOIT = optionsDuNoeud(roofProfileSchema) as [NonNullable<RoofDefaults['profile']>, string][];

/** Les météos d'une scène, chacune son libellé ; ses environnements ; ses ambiances. */
export const METEOS = optionsDuNoeud(sceneWeatherSchema) as [NonNullable<Scene['weather']>, string][];
export const ENVIRONNEMENTS = sceneSchema.shape.environment.unwrap().options;
export const AMBIANCES = sceneSchema.shape.ambiance.unwrap().options;

/** Les sortes d'ouverture d'une façade et leur libellé (`facadeFeatureKindSchema`). */
export const SORTES_D_OUVERTURE = optionsDuNoeud(facadeFeatureKindSchema) as [FacadeFeature['kind'], string][];

/** Ce que l'inspecteur écrit sur une ouverture de la façade sélectionnée : sa sorte, sa position et sa largeur le long
 *  de l'arête, son apparence (`apparencesDeLOuverture`) (`null` : le défaut du rendu). */
export interface PatchDOuverture {
  sorte?: FacadeFeature['kind'];
  position?: number | null;
  largeur?: number | null;
  apparence?: string | null;
}

/** Ce que l'inspecteur écrit sur l'arête sélectionnée (`patchWall`) : chaque champ posé, `null` le retire. */
export type PatchDArete = { [K in Exclude<keyof WallSeg, 'x' | 'y' | 'side' | 'z'>]?: WallSeg[K] | null };

/** Ce que l'inspecteur écrit sur l'entité sélectionnée : son type (décor ou fiche), son cap, sa couche ; la lumière
 *  d'un décor (`null` l'éteint), son assise ; un objet de l'inventaire d'un personnage (`inventaireApres`), son
 *  parcours de carrière ; l'équipage exposé à bord ; les entrées de fiche qu'elle couvre (`null` : aucune). */
export interface PatchDEntite {
  ref?: string;
  facing?: Dir8;
  z?: number;
  light?: NonNullable<SceneEntity['light']> | null;
  assise?: boolean;
  objet?: IntentionDObjet;
  /** Le parcours de carrière entier ; sans carrière, il est retiré. */
  parcours?: ParcoursDeCarriere;
  crewIds?: string[];
  couvre?: string[] | null;
}

/** Le nombre de copies d'une troupe (`{ geste: 'troupe' }`), bornes comprises. */
export const BORNES_DE_LA_TROUPE = { min: 2, max: 30 } as const;

/** Ce que l'inspecteur écrit sur le poste d'un emplacement de siège : son engin, son arc (`null` : omni), ses servants,
 *  le chef de pièce en tête. */
export interface PatchDePoste {
  engin?: string;
  arc?: FireArc | null;
  servants?: string[];
}

/** Ce que l'inspecteur écrit sur l'appartenance du personnage sélectionné à la rencontre `rencontre` (`null` : une
 *  rencontre neuve) : enrôlé ou non, son camp, son pilotage par l'IA s'il est allié. */
export interface PatchDeMembre {
  rencontre: string | null;
  enrole?: boolean;
  camp?: 'ennemi' | 'allie';
  ia?: boolean;
}

/** Ce que l'arête sélectionnée attend de l'auteur avant de s'écrire entière (`wallSegSchema`) : la porte secrète
 *  sans sa difficulté ou sa face, la croisée franchissable sans son allège. La scène reste valide, l'état incomplet
 *  est nommé ici. */
export interface BrouillonDArete {
  secret?: Partial<WallSecret>;
  crossable?: true;
}

/** Un cran de l'historique de l'éditeur : le projet édité et la scène qu'il montre. #3606 */
export interface CranDEdition {
  projet: ProjetDEdition;
  sceneId: string;
}

export interface SessionDEdition {
  /** Le projet ouvert et sa scène éditée : le présent de l'historique (`projetEdite`, `sceneEditee`). */
  historique: Historique<CranDEdition>;
  /** Le document du projet ouvert à l'édition (`DOCUMENTS`) : sans sélection, son porteur singulier s'édite. */
  document: SorteDeDocument;
  outil: OutilDeLEditeur;
  z: number;
  pinceau: (typeof PINCEAUX)[number];
  rectangle: boolean;
  sel: Sel;
  geste: GesteEnCours | null;
  /** Le tracé de la volée de l'outil Volée, sur la couche `z` : les cases que le pointeur a basculées, dans l'ordre. */
  volee: readonly Pt[];
  /** Le brouillon de l'arête sélectionnée ; une autre sélection le lève. */
  brouillon: BrouillonDArete | null;
  /** La dernière case qu'un appui a visée, sur la couche `z` de cet appui. */
  pointee: (Pt & { z: number }) | null;
  /** L'entité copiée, que coller pose sur la case pointée ; `null` avant toute copie. */
  presse: SceneEntity | null;
  /** Le dépôt d'où le projet s'est ouvert : le projet tel qu'il le porte, et celui qu'un enregistrement en cours lui
   *  écrit. `null` : le projet vient du jeu, il ne s'enregistre pas. */
  depot: { enregistre: ProjetDEdition; enCours: ProjetDEdition | null } | null;
  /** Les calques de référence du projet, par scène et par couche, hors de l'historique. */
  calques: CalquesDuProjet;
  /** Le calage du calque de la couche éditée : `idle` hors du calage. */
  calage: CalibProgress;
  /** Le défaut de plan suivi depuis la validation (`planDefectKey`), `null` sans lui. */
  defaut: string | null;
  /** La couche dont l'hôte charge la planche, `null` sans chargement en cours. */
  chargement: { sceneId: string; z: number } | null;
  /** L'index des chapitres du `Source/` que l'hôte sert, `null` s'il ne le sert pas. */
  manifeste: Manifeste | null;
  /** Chaque chapitre que l'hôte a chargé, par `cleDuChapitre` : parsé, ou `null` s'il n'a pas pu se charger. */
  chapitres: Readonly<Record<string, ChapitreParse | null>>;
  /** Le chapitre que l'hôte charge, `null` sans chargement en cours (`avecLeChapitreDemande`). */
  chapitreEnAttente: { book: string; ch: string } | null;
  /** Les calques que l'hôte gardait étaient d'un autre format, retirés à l'ouverture. */
  ecartes: boolean;
  /** Le plan du lieu sélectionné de la carte du monde, ouvert : le pointeur y va (`planDuLieuOuvert`), et `poi` y est le
   *  point d'intérêt désigné, `null` sans lui ; `null` : le pointeur va au plan du document ouvert. Son lieu est la
   *  sélection, `editer` le ferme quand elle n'en désigne plus aucun (`avecSonPlanDuLieu`). */
  planDuLieu: { poi: string | null } | null;
}

/** Un geste de l'éditeur : choisir l'outil, la taille du pinceau, le rectangle du pinceau de terrain, la couche
 *  éditée ; ajouter une couche au-dessus de la plus haute, retirer la couche éditée ; appuyer, glisser, relâcher
 *  sur un point de la carte ; poser la volée tracée, effacer son tracé ; écrire sur l'arête sélectionnée, ou poser
 *  son brouillon ; écrire sur l'entité sélectionnée, le poste de l'emplacement de siège sélectionné, une place du décor
 *  sélectionné ou l'appartenance du personnage sélectionné à une rencontre ; écrire sur la zone sélectionnée, ou sur la scène ;
 *  sélectionner le porteur de formulaire `porteur` (`selDuPorteur`) ; en ajouter un neuf de sorte `sorte`, par la table
 *  d'écriture de sa sorte (`ECRITURES_DES_PORTEURS`, `creer`), depuis la sélection, avec l'identifiant `avec` que sa
 *  table offre (`avecs`), sélectionné ; orienter la route sélectionnée depuis l'une de ses extrémités, ou dans les deux
 *  sens (`null`, `orienterRoute`) ; ouvrir le plan du lieu `lieu` de la carte du monde ouverte, sélectionné, ou le fermer (`null`, `planDuLieu`) ; retirer le point
 *  d'intérêt désigné sur ce plan (`retirerPoi`) ; ouvrir le document `document` du projet (`ouvrirLeDocument`) ; écrire
 *  une valeur au chemin `chemin` du formulaire du porteur `porteur` (`formulaireDe`, `undefined`
 *  retire le champ), ou y resceller l'adresse de prose au chemin `chemin` après relecture (`avecLAdresseRescellee`) ; nommer l'entité, l'entrée, le
 *  déclencheur, le dialogue, la rencontre, la zone d'effet ou le corps sélectionné, ou sans sélection le porteur singulier du
 *  document ouvert qui se nomme (`gestesDuSingulier`, la scène) (`nom` absent : l'entité
 *  reprend le nom de sa fiche ; le déclencheur, le dialogue et la rencontre y prennent leur identifiant, par la table de leur
 *  sorte, `renommer`) ;
 *  changer l'identifiant de la zone d'effet sélectionnée, de l'élément `element` de la sous-collection à clé du porteur
 *  sélectionné (l'action d'un décor, le nœud d'un dialogue, par la table, `renommerElement`), ou sans sélection du
 *  porteur singulier du document ouvert qui s'identifie (`gestesDuSingulier`, la scène) ; éditer une autre scène du projet, en ajouter une vide, dupliquer
 *  ou retirer l'éditée ; changer la couche de l'entrée sélectionnée ; copier l'entité sélectionnée, la coller
 *  sur la case pointée, la dupliquer ; poser une troupe de `nombre` copies du personnage sélectionné (`poserUneTroupe`,
 *  `nombre` entre `BORNES_DE_LA_TROUPE`) ; supprimer la sélection, par la table de sa sorte s'il y a lieu (`projetSansLePorteur`),
 *  sans elle le porteur singulier du document ouvert qui se retire (la carte du monde), la scène redevenant ouverte ; annuler, rétablir ; enregistrer au dépôt, puis l'issue de cette écriture ;
 *  mettre la scène à l'essai, que l'hôte joue (`essaiDeLaScene`), la session telle quelle ;
 *  demander la planche du calque de la couche éditée, puis l'issue de son chargement, l'image lue ou rien ; régler ce
 *  calque, le caler, le retirer ; l'issue du chargement du chapitre attendu, son texte ou rien. */
export type GesteDEdition =
  | { geste: 'outil'; outil: OutilDeLEditeur }
  | { geste: 'pinceau'; taille: (typeof PINCEAUX)[number] }
  | { geste: 'rectangle'; actif: boolean }
  | { geste: 'couche'; z: number }
  | { geste: 'ajouterCouche' }
  | { geste: 'retirerCouche' }
  | { geste: 'appui' | 'glisse' | 'relache'; point: PointDeCarte }
  | { geste: 'poserVolee' }
  | { geste: 'arete'; patch?: PatchDArete; brouillon?: BrouillonDArete | null }
  | { geste: 'entite'; patch: PatchDEntite }
  | { geste: 'poste'; patch: PatchDePoste }
  | { geste: 'place'; place: string; occupant: SeatOccupant | null }
  | { geste: 'membre'; patch: PatchDeMembre }
  | { geste: 'zone'; patch: PatchDeZone }
  | { geste: 'selectionner'; porteur: { sorte: SorteDePorteur; id: string } }
  | { geste: 'ajouter'; sorte: SorteDePorteur; avec?: string }
  | { geste: 'sens'; depuis: string | null }
  | { geste: 'planDuLieu'; lieu: string | null }
  | { geste: 'retirerPoi' }
  | { geste: 'document'; document: SorteDeDocument }
  | { geste: 'valeur'; porteur: { sorte: SorteDePorteur; id: string }; chemin: Segment[]; valeur?: unknown }
  | { geste: 'resceller'; porteur: { sorte: SorteDePorteur; id: string }; chemin: Segment[] }
  | { geste: 'corps'; id: string }
  | { geste: 'batir'; ouvrage: Ouvrage }
  | { geste: 'architecture'; patch: PatchDArchitecture }
  | { geste: 'baie'; id: string | null; patch: PatchDOuverture | null }
  | { geste: 'scene'; patch: PatchDeScene }
  | { geste: 'avertissement'; rang: number }
  | { geste: 'scenes'; quoi: 'aller'; id: string }
  | { geste: 'scenes'; quoi: 'ajouter' | 'dupliquer' | 'retirer' }
  | { geste: 'nommer'; nom?: string }
  | { geste: 'identifier'; id: string; element?: string }
  | { geste: 'entree'; z: number }
  | { geste: 'copier' }
  | { geste: 'coller' }
  | { geste: 'dupliquer' }
  | { geste: 'troupe'; nombre: number }
  | { geste: 'supprimer' }
  | { geste: 'effacerVolee' }
  | { geste: 'annuler' }
  | { geste: 'retablir' }
  | { geste: 'enregistrer' }
  | { geste: 'tester' }
  | { geste: 'enregistrement'; reussi: boolean }
  | { geste: 'planche' }
  | { geste: 'chargement'; image: { largeur: number; hauteur: number } | null }
  | { geste: 'calque'; reglage: ReglageDuCalque }
  | { geste: 'caler'; actif: boolean }
  | { geste: 'retirerCalque' }
  | { geste: 'chapitre'; book: string; ch: string; texte: string | null };

/** Le projet édité : le présent de l'historique. */
export const projetEdite = (s: SessionDEdition): ProjetDEdition => s.historique.present.projet;

/** L'id de la scène éditée du projet. */
export const idDeLaSceneEditee = (s: SessionDEdition): string => s.historique.present.sceneId;

/** La scène que montre le cran `c`. */
const sceneDuCran = (c: CranDEdition): Scene => c.projet.scenes.find((sc) => sc.id === c.sceneId)!;

/** La scène éditée : celle qui s'écrit. */
export const sceneEditee = (s: SessionDEdition): Scene => sceneDuCran(s.historique.present);

/** La vue de la scène éditée de la session `s` : ses navires posés par leurs ponts (`poserLesNavires`), comme en jeu.
 *  L'hôte la montre, le pointeur y vise les ponts, ses couches sont celles qu'on édite ; les écritures vont à la scène
 *  éditée, qui ne porte de chaque navire que son entité. */
export const vueDeLaScene = (s: SessionDEdition): Scene => poserLesNavires(sceneEditee(s));

/** La couche `z` est-elle l'une de la vue de `scene` (`poserLesNavires`) ? */
const coucheVue = (scene: Scene, z: number): boolean => poserLesNavires(scene).layers.some((l) => l.z === z);

/** La session qui édite la première scène du projet `projet`, à l'outil de sélection, sur la couche 0 ; `duDepot` :
 *  le projet est celui que le dépôt porte, où il s'enregistre ; `gardes`, s'il est donné, les calques que l'hôte
 *  gardait pour lui (`calquesLus`), retirés s'ils sont d'un autre format ; `manifeste`, l'index des chapitres du
 *  `Source/` que l'hôte sert, sans aucun chapitre chargé. */
export function ouvrirLEdition(projet: ProjetDEdition, duDepot: boolean, gardes?: unknown, manifeste: Manifeste | null = null): SessionDEdition {
  const calques = gardes === undefined ? {} : calquesLus(gardes);
  return {
    historique: historiqueDe({ projet, sceneId: projet.scenes[0].id }), document: 'scene', outil: { mode: 'selection' }, z: 0, pinceau: 1, rectangle: false, sel: null, geste: null, volee: [], brouillon: null, pointee: null, presse: null,
    depot: duDepot ? { enregistre: projet, enCours: null } : null,
    calques: calques ?? {}, calage: { step: 'idle' }, chargement: null, ecartes: calques === null, defaut: null,
    manifeste, chapitres: {}, chapitreEnAttente: null, planDuLieu: null,
  };
}

/** Le calage au repos. */
const HORS_DU_CALAGE: CalibProgress = { step: 'idle' };

/** Le calque de la couche éditée de la session `s`, `undefined` sans lui. */
export const calqueDeLaCouche = (s: SessionDEdition): CalqueDeCouche | undefined => s.calques[idDeLaSceneEditee(s)]?.[String(s.z)];

/** Les calques de la session `s`, celui de la couche `z` de la scène `sceneId` posé à `calque`, retiré s'il est `null`. */
function avecLeCalque(s: SessionDEdition, sceneId: string, z: number, calque: CalqueDeCouche | null): CalquesDuProjet {
  const { [String(z)]: _retire, ...autres } = s.calques[sceneId] ?? {};
  return { ...s.calques, [sceneId]: calque ? { ...autres, [String(z)]: calque } : autres };
}

/** Ce que rend `passer`, qui passe un projet par la porte (`parseProject`), ou le refus de la porte au geste `geste`,
 *  dit à l'auteur (`refusDeLaPorteDuProjet`). */
function aLaPorte<T>(geste: GesteDePorte, passer: () => T): { ok: true; valeur: T } | { ok: false; refus: string } {
  try {
    return { ok: true, valeur: passer() };
  } catch (err) {
    if (!(err instanceof ProjetRefuse)) throw err;
    return { ok: false, refus: refusDeLaPorteDuProjet(err, geste).message };
  }
}

/** Le projet `lu` que sert le dépôt, prose matérialisée, passé par la porte, ou son refus. */
export const projetDuDepot = (lu: unknown) => aLaPorte('ouverture', () => parseProject(lu));

/** Le document du projet édité de la session `s` (`documentDeProjet`). */
function documentEdite(s: SessionDEdition): ProjectDoc {
  const { scenes, worldMap, activeAxes, narratif, ...identite } = projetEdite(s);
  return documentDeProjet(identite, scenes, { worldMap, activeAxes, narratif });
}

/** Le texte que l'enregistrement de la session `s` écrit au dépôt : son projet édité, passé par la porte, en forme
 *  dépôt (`texteDuDepot`) ; ou le refus de la porte. */
export function texteAEnregistrer(s: SessionDEdition) {
  const doc = documentEdite(s);
  return aLaPorte('export', () => (parseProject(doc), texteDuDepot(doc)));
}

/** L'essai de la scène éditée de la session `s` : son projet édité, passé par la porte, et ce qui construit son
 *  lancement, la scène éditée à l'entrée, joué par le groupe vitrine (`groupeVitrine`), à l'ouverture de la partie ;
 *  ou le refus de la porte. */
export function essaiDeLaScene(s: SessionDEdition) {
  const doc = documentEdite(s);
  return aLaPorte('test', (): ((idNeuf: FabriqueDId) => LancementDeScenario) => {
    const projet = parseProject(doc);
    return (idNeuf) => lancementDuProjet(projet, groupeVitrine(idNeuf), idDeLaSceneEditee(s), null);
  });
}

/** Le plan de la volée tracée de la session `s` vers l'étage de son outil, lu sur la vue (`planStairFlight`,
 *  `vueDeLaScene`) : jusqu'au pont d'un navire aussi ; refusé sur une couche que seuls les ponts d'un navire posent, où
 *  la volée ne s'écrirait pas ; `null` hors de l'outil Volée. */
export function planDeLaVolee(s: SessionDEdition): StairFlightPlan | null {
  if (s.outil.mode !== 'escalier') return null;
  if (!sceneEditee(s).layers.some((l) => l.z === s.z)) return { ok: false, reason: `couche z${s.z} des seuls ponts d'un navire : la volée ne s'y écrit pas` };
  return planStairFlight(vueDeLaScene(s), s.volee, s.z, s.outil.toZ);
}

/** Le corps de la sélection d'architecture `sel`, `undefined` hors d'elle. */
const corpsDeLaSelection = (sel: Sel): string | undefined => {
  if (sel?.type === 'architectureBody') return sel.id;
  return sel?.type === 'architectureStorey' || sel?.type === 'architecturePart' || sel?.type === 'facadeSection' || sel?.type === 'roofSection' ? sel.bodyId : undefined;
};

/** Le corps actif de la session `s` : celui de la sélection, sinon le premier de la scène ; `null` sans corps. */
export function corpsActif(s: SessionDEdition): ArchitectureBody | null {
  const corps = sceneEditee(s).architecture ?? [];
  const id = corpsDeLaSelection(s.sel);
  return corps.find((c) => c.id === id) ?? corps[0] ?? null;
}

/** L'étage du corps actif de la session `s` sur sa couche éditée, `null` sans lui. */
export const etageActif = (s: SessionDEdition): ArchitectureStorey | null => corpsActif(s)?.storeys.find((e) => e.z === s.z) ?? null;

/** Le contexte du pointeur de la session sur la scène : l'outil d'architecture y est la sélection, en mode
 *  architecture ; l'outil navire, que l'appui joue sans lui, la sélection, comme ceux de la carte du monde. */
function contexte(s: SessionDEdition): ContexteDuPointeur {
  const outil = s.outil;
  const architecture = outil.mode === 'architecture' ? { z: s.z, action: outil.action === 'facade' ? 'facade' as const : 'selection' as const, bodyId: corpsActif(s)?.id ?? null } : null;
  return { tool: outil.mode === 'architecture' || outil.mode === 'navire' || outil.mode === 'lieu' || outil.mode === 'chemin' || outil.mode === 'epingler' ? { mode: 'selection' } : outil, z: s.z, brush: s.pinceau, encId: '', encRef: '', layers: TOUS_LES_CALQUES, sel: s.sel, terrainRect: s.rectangle, architecture };
}

/** Si le clic de la session `s` tire une exclusion de toiture du corps actif. */
const enExclusion = (s: SessionDEdition): boolean => s.outil.mode === 'architecture' && s.outil.action === 'exclusion' && corpsActif(s) !== null;

/** Pourquoi l'outil d'architecture de la session `s` ne bâtit pas `ouvrage`, `null` s'il le bâtit. */
export function refusDOuvrage(s: SessionDEdition, ouvrage: Ouvrage): 'sansCorps' | 'sansEtage' | 'sansCase' | null {
  if (ouvrage !== 'corps' && !corpsActif(s)) return 'sansCorps';
  if ((ouvrage === 'partie' || ouvrage === 'masse') && !etageActif(s)) return 'sansEtage';
  return ouvrage !== 'etage' && s.pointee?.z !== s.z ? 'sansCase' : null;
}

/** La session `s` où l'outil d'architecture bâtit `ouvrage`, sélectionné ; telle quelle s'il ne le bâtit pas. L'étage
 *  bâti devient la couche éditée. */
function batir(s: SessionDEdition, ouvrage: Ouvrage): SessionDEdition {
  if (refusDOuvrage(s, ouvrage)) return s;
  const scene = sceneEditee(s);
  const corps = corpsActif(s);
  const etage = etageActif(s);
  const caseSeule = s.pointee && { x: s.pointee.x, y: s.pointee.y, w: 1, h: 1 };
  if (ouvrage === 'corps') {
    const out = addArchitectureBody(scene, undefined, caseSeule!);
    return ecrire(s, out.scene, { type: 'architectureBody', id: out.id });
  }
  if (ouvrage === 'etage') {
    const out = addStoreyAbove(scene, corps!.id)!;
    return { ...ecrire(s, out.scene, { type: 'architectureStorey', bodyId: corps!.id, id: out.id }), z: out.z };
  }
  if (ouvrage === 'partie') {
    const out = addArchitecturePart(scene, corps!.id, etage!.id, caseSeule!)!;
    return ecrire(s, out.scene, { type: 'architecturePart', bodyId: corps!.id, storeyId: etage!.id, id: out.id });
  }
  const out = addBuildingMass(scene, corps!.id, caseSeule!, s.z)!;
  return ecrire(s, out.scene, { type: 'roofSection', bodyId: corps!.id, id: out.id });
}

/** La scène `scene` où `patch` s'écrit sur le corps ou l'étage sélectionné par `sel` ; telle quelle hors d'eux. */
function architecturePatchee(scene: Scene, sel: Sel, patch: PatchDArchitecture): Scene {
  if (sel?.type === 'architectureBody') {
    const type = patch.style === undefined ? scene : patchArchitectureBody(scene, sel.id, { style: patch.style ?? undefined });
    const toiture = Object.entries(patch.toiture ?? {}).reduce((sc, [champ, v]) => poseToitureDuCorps(sc, sel.id, champ as keyof RoofDefaults, v ?? undefined), type);
    return patch.retirerExclusion === undefined ? toiture : removeRoofExclusion(toiture, sel.id, patch.retirerExclusion);
  }
  if (sel?.type === 'roofSection') {
    const champs = { ...patch.masse, ...(patch.z !== undefined ? { z: patch.z } : {}) };
    return patchBuildingMass(scene, sel.bodyId, sel.id, Object.fromEntries(Object.entries(champs).map(([k, v]) => [k, v ?? undefined])));
  }
  if (sel?.type === 'architectureStorey' && patch.pieces) return patchArchitectureStorey(scene, sel.bodyId, sel.id, { roomZoneIds: patch.pieces });
  if (sel?.type !== 'facadeSection') return scene;
  const avecLesPieces = patch.pieces || patch.apparence
    ? patchFacadeSection(scene, sel.bodyId, sel.id, { ...(patch.pieces ? { roomZoneIds: patch.pieces } : {}), ...(patch.apparence ? { appearance: patch.apparence } : {}) })
    : scene;
  return patch.z === undefined ? avecLesPieces : setFacadeSectionZ(avecLesPieces, sel.bodyId, sel.id, patch.z);
}

/** La scène `scene` où la façade sélectionnée par `sel` gagne une ouverture (`id` nul), la perd (`patch` nul) ou voit
 *  l'ouverture `id` patchée ; telle quelle hors d'une façade. */
function ouverturePosee(scene: Scene, sel: Sel, id: string | null, patch: PatchDOuverture | null): Scene {
  if (sel?.type !== 'facadeSection') return scene;
  if (id === null) return addFacadeFeature(scene, sel.bodyId, sel.id)?.scene ?? scene;
  if (patch === null) return removeFacadeFeature(scene, sel.bodyId, sel.id, id);
  const actuelle = scene.architecture?.find((b) => b.id === sel.bodyId)?.facades.find((f) => f.id === sel.id)?.features?.find((f) => f.id === id);
  // Une autre sorte garde l'apparence que son catalogue (`apparencesDeLOuverture`) nomme, sinon la retire.
  const apparence = patch.apparence !== undefined ? patch.apparence ?? undefined
    : patch.sorte && actuelle?.appearance !== undefined && !apparencesDeLOuverture(patch.sorte).some((a) => a.id === actuelle.appearance) ? undefined
    : actuelle?.appearance;
  return patchFacadeFeature(scene, sel.bodyId, sel.id, id, {
    ...(patch.sorte ? { kind: patch.sorte } : {}),
    ...(patch.position !== undefined ? { offset: patch.position ?? undefined } : {}),
    ...(patch.largeur !== undefined ? { width: patch.largeur ?? undefined } : {}),
    ...(apparence !== actuelle?.appearance ? { appearance: apparence } : {}),
  });
}

/** Le tracé `volee` où la case `p` bascule : retirée si elle y est, ajoutée au bout sinon. */
const basculer = (volee: readonly Pt[], p: Pt): readonly Pt[] =>
  volee.some((c) => c.x === p.x && c.y === p.y) ? volee.filter((c) => c.x !== p.x || c.y !== p.y) : [...volee, { x: p.x, y: p.y }];

/** L'effet d'un pas du pointeur porté à la session ; une sélection désignée lève le brouillon. */
function porter(s: SessionDEdition, effet: EffetDuPointeur): SessionDEdition {
  return {
    ...s,
    ...(effet.architectureFinie && s.outil.mode === 'architecture' ? { outil: { mode: 'architecture', action: 'selection' } } : {}),
    ...(effet.sel !== undefined ? { brouillon: null } : {}),
    geste: effet.geste,
    ...(effet.volee ? { volee: basculer(s.volee, effet.volee) } : {}),
    ...(effet.scene ? { historique: avecLaScene(s, effet.scene, effet.cran === true) } : {}),
    ...(effet.sel !== undefined ? { sel: effet.sel } : {}),
  };
}

/** L'effet d'un pas du pointeur sur le plan de la carte du monde porté à la session ; une sélection désignée lève le
 *  brouillon. */
function porterSurLaCarte(s: SessionDEdition, effet: EffetSurLaCarte): SessionDEdition {
  const { projet, sceneId } = s.historique.present;
  return {
    ...s,
    geste: effet.geste,
    ...(effet.sel !== undefined ? { sel: effet.sel, brouillon: null } : {}),
    ...(effet.carte ? { historique: poser(s.historique, { projet: DOCUMENTS.carte.ecrire(projet, sceneId, effet.carte), sceneId }, effet.cran === true) } : {}),
  };
}

/** La carte du monde éditée de la session `s`, ouverte : `ouvrirLeDocument` la pose au projet. */
const carteEditee = (s: SessionDEdition): WorldMap => projetEdite(s).worldMap!;

/** L'appui, le glissé et le relâché du pointeur sur le plan d'un document de la session. */
type PointeurDuDocument = { readonly [G in 'appui' | 'glisse' | 'relache']: (s: SessionDEdition, point: PointDeCarte) => SessionDEdition };

/** Le pointeur sur la scène : pendant le calage, l'appui cale le calque et le reste n'ouvre aucun geste ; l'appui de
 *  l'outil navire pose le navire à la case pointée, celui de l'exclusion de toiture ouvre son rectangle, celui de la
 *  sélection sur la poignée de la sélection la saisit ; le relâché de l'exclusion la pose ; sinon le pointeur de la
 *  scène (`appuyer`, `glisser`, `relacher`). */
const pointeurDeLaScene = (): PointeurDuDocument => ({
  appui: (s, point) => {
    const scene = sceneEditee(s);
    const calque = calqueDeLaCouche(s);
    if (s.calage.step !== 'idle' && calque) {
      const pas = caler(s.calage, calque, point.f);
      return { ...s, calage: pas.progress, ...(pas.transform ? { calques: avecLeCalque(s, idDeLaSceneEditee(s), s.z, { ...calque, calage: pas.transform }) } : {}) };
    }
    const pointee = { ...point.case, z: s.z };
    if (s.outil.mode === 'navire') {
      const pose = poserUnNavire(scene, s.outil.ref, point.case, s.z, s.outil.cap);
      return pose ? { ...ecrire(s, pose.scene, { type: 'entity', id: pose.id }), pointee } : { ...s, pointee };
    }
    if (enExclusion(s)) return { ...s, geste: { sorte: 'rectangle', depart: point.case, rect: rectFrom(point.case, point.case) }, pointee };
    const poignee = s.outil.mode === 'selection' || (s.outil.mode === 'architecture' && s.outil.action === 'selection') ? poigneeDeLaSelection(scene, s.sel, s.z) : null;
    const saisie = poignee?.x === point.case.x && poignee.y === point.case.y;
    return { ...(saisie ? { ...s, geste: saisirLaPoignee(contexte(s)) } : porter(s, appuyer(scene, contexte(s), point))), pointee };
  },
  glisse: (s, point) => (s.calage.step !== 'idle' ? s : porter(s, glisser(sceneEditee(s), contexte(s), s.geste, point))),
  relache: (s, point) => {
    if (s.calage.step !== 'idle') return s;
    const scene = sceneEditee(s);
    const corps = corpsActif(s);
    if (enExclusion(s) && s.geste?.sorte === 'rectangle' && corps) {
      const exclue = addRoofExclusion(scene, corps.id, s.z, rectFrom(s.geste.depart, point.case));
      return { ...ecrire(s, exclue, { type: 'architectureBody', id: corps.id }), geste: null, outil: { mode: 'architecture', action: 'selection' } };
    }
    return porter(s, relacher(scene, contexte(s), s.geste, point));
  },
});

/** Le pointeur sur le plan de la carte du monde (`appuyerSurLaCarte`, `glisserSurLaCarte`, `relacherSurLaCarte`), les
 *  lieux neufs liés à la première scène du projet. */
const pointeurDeLaCarte = (): PointeurDuDocument => ({
  appui: (s, point) => porterSurLaCarte(s, appuyerSurLaCarte(carteEditee(s), projetEdite(s).scenes, s.outil.mode, point)),
  glisse: (s, point) => porterSurLaCarte(s, glisserSurLaCarte(carteEditee(s), s.geste, point)),
  relache: (s, point) => porterSurLaCarte(s, relacherSurLaCarte(carteEditee(s), s.geste, point)),
});

/** Le plan du lieu ouvert de la session `s` (`SessionDEdition.planDuLieu`) : son lieu, la sélection, au projet, et son
 *  point d'intérêt désigné, s'il est à ce lieu ; `undefined` s'il n'est pas ouvert ou que la sélection ne désigne aucun
 *  lieu de la carte. */
export function planDuLieuOuvert(s: SessionDEdition): { lieu: MapPlace; poi: string | null } | undefined {
  const { planDuLieu: plan, sel } = s;
  const lieu = plan && sel && 'id' in sel && sel.type === FORMULAIRES.lieu.sel ? projetEdite(s).worldMap?.places.find((p) => p.id === sel.id) : undefined;
  return lieu ? { lieu, poi: lieu.poi?.some((x) => x.id === plan!.poi) ? plan!.poi : null } : undefined;
}

/** La session `s`, son plan du lieu fermé si la sélection n'en désigne plus le lieu (`planDuLieuOuvert`). */
const avecSonPlanDuLieu = (s: SessionDEdition): SessionDEdition => (s.planDuLieu && !planDuLieuOuvert(s) ? { ...s, planDuLieu: null } : s);

/** L'effet d'un pas du pointeur sur le plan du lieu ouvert porté à la session : la carte écrite comme sur son plan
 *  (`porterSurLaCarte`), le point d'intérêt désigné. */
function porterSurLePlanDuLieu(s: SessionDEdition, effet: EffetSurLePlanDuLieu): SessionDEdition {
  const portee = porterSurLaCarte(s, effet);
  return effet.poi === undefined ? portee : { ...portee, planDuLieu: { poi: effet.poi } };
}

/** Le pointeur sur le plan du lieu ouvert (`appuyerSurLePlanDuLieu`, `glisserSurLePlanDuLieu`), les points neufs menant
 *  à la première scène du projet ; le relâché finit le geste. */
const pointeurDuPlanDuLieu = (): PointeurDuDocument => ({
  appui: (s, point) => porterSurLePlanDuLieu(s, appuyerSurLePlanDuLieu(carteEditee(s), planDuLieuOuvert(s)!.lieu.id, projetEdite(s).scenes, s.outil.mode, point)),
  glisse: (s, point) => porterSurLePlanDuLieu(s, glisserSurLePlanDuLieu(carteEditee(s), planDuLieuOuvert(s)!.lieu.id, s.geste, point)),
  relache: (s) => ({ ...s, geste: null }),
});

/** Le pointeur de la session `s` : celui du plan du lieu ouvert (`planDuLieuOuvert`, `pointeurDuPlanDuLieu`), sinon
 *  celui du plan de son document ouvert, par document (la scène, `pointeurDeLaScene` ; la carte du monde,
 *  `pointeurDeLaCarte`), aucun sans plan. Chaque pointeur s'appelle par son nom dans la table : la fermeture d'appels
 *  de la garde #841 le suit depuis `editer`. */
const pointeurDeLaSession = (s: SessionDEdition): PointeurDuDocument | undefined => {
  if (planDuLieuOuvert(s)) return pointeurDuPlanDuLieu();
  const pointeurs: { readonly [K in SorteDeDocument]?: () => PointeurDuDocument } = { scene: () => pointeurDeLaScene(), carte: () => pointeurDeLaCarte() };
  return pointeurs[s.document]?.();
};

/** Les gestes du porteur singulier du document ouvert de la session `s`, par sorte, quand il les fait, sans eux s'il
 *  n'en a pas : se nommer `nom` (non vide), prendre l'identifiant `id`. La scène se nomme (`setSceneLabel`) et
 *  s'identifie (`sceneRenommee`) ; la carte du monde se nomme à son formulaire (`label`). La table vit dans la fonction :
 *  la fermeture d'appels de la garde #841 suit ses gestes depuis `editer`. */
const gestesDuSingulier = (s: SessionDEdition) => {
  const gestes: { readonly [S in SorteDePorteur]?: { nommer: (nom: string) => SessionDEdition; identifier: (id: string) => SessionDEdition } } = {
    scene: {
      nommer: (nom) => ecrire(s, setSceneLabel(sceneEditee(s), nom)),
      identifier: (id) => sceneRenommee(s, sceneEditee(s), id),
    },
  };
  const singulier = porteurDeLaSel(null, s.document, idDeLaSceneEditee(s));
  return singulier && gestes[singulier.sorte];
};

/** La session `s` telle quelle si son document ouvert est au projet de son présent ; sinon, remise à zéro
 *  (`remiseAZero`) sur la scène, que tout projet porte. */
const avecSonDocument = (s: SessionDEdition): SessionDEdition =>
  (documentDe(s.document).lire(projetEdite(s), idDeLaSceneEditee(s)) === undefined ? { ...remiseAZero(s), document: 'scene' } : s);

/** L'historique de la session `s` où la scène éditée devient `scene`, à sa place dans le projet (`DOCUMENTS`, `scene`),
 *  sur un cran neuf (`cran`) ou à la place du présent : les autres scènes, la carte du monde et le narratif gardent leur
 *  identité. */
function avecLaScene(s: SessionDEdition, scene: Scene, cran: boolean): Historique<CranDEdition> {
  const { projet, sceneId } = s.historique.present;
  return poser(s.historique, { projet: DOCUMENTS.scene.ecrire(projet, sceneId, scene), sceneId }, cran);
}

/** Le projet `projet` écrit sur un cran neuf, sa scène montrée gardée, la sélection et son brouillon levés, ou `sel`
 *  sélectionnée. */
const ecrireLeProjet = (s: SessionDEdition, projet: ProjetDEdition, sel: Sel = null): SessionDEdition =>
  ({ ...s, historique: poser(s.historique, { projet, sceneId: idDeLaSceneEditee(s) }, true), sel, brouillon: null });

/** La scène `scene` écrite sur un cran neuf, la sélection et son brouillon levés, ou `sel` sélectionnée. */
const ecrire = (s: SessionDEdition, scene: Scene, sel: Sel = null): SessionDEdition => ({ ...s, historique: avecLaScene(s, scene, true), sel, brouillon: null });

/** Les zones de la scène `sc` : ses déclencheurs, ses zones de repos et d'effet. */
const zonesDe = (sc: Scene) => [sc.triggers, sc.restZones, sc.effectZones];

/** La session `s` où la scène `scene` s'écrit sur un cran neuf si ce que `lire` y lit de la sélection change : sinon,
 *  `s` telle quelle. La sélection reste. */
function ecrireSurLaSelection<T>(s: SessionDEdition, scene: Scene, lire: (sc: Scene) => T): SessionDEdition {
  return jsonCanonique(lire(scene)) === jsonCanonique(lire(sceneEditee(s))) ? s : { ...s, historique: avecLaScene(s, scene, true) };
}

/** Le patch `patch` de l'inspecteur en patch d'entité pour `ent`, chaque absence posée par `champs` (`editEntity`) : le
 *  type d'un décor avec ses défauts de pose (`propRefPatch`), la couche au sol (`coucheEcrite`), la lumière éteinte, l'assise
 *  sans action, un parcours sans carrière, et un inventaire, un équipage ou des entrées couvertes vides (`sansVide`) ;
 *  l'inventaire après l'intention sur un objet (`inventaireApres`). */
function enPatchDEntite(ent: SceneEntity, patch: PatchDEntite): Partial<SceneEntity> {
  const { ref, z, light, assise, objet, parcours, crewIds, couvre, ...reste } = patch;
  const avecCarrieres = parcours && Object.keys(parcours.carrieres).length ? parcours : undefined;
  const usable = { ...ent.usable, assise: assise || undefined };
  return {
    ...reste,
    ...(ref === undefined ? {} : ent.kind === 'prop' ? propRefPatch(ref, ent) : { creature: { id: ref } }),
    ...(z === undefined ? {} : { z: coucheEcrite(z) }),
    ...(light === undefined ? {} : { light: light ?? undefined }),
    ...(assise === undefined ? {} : { usable: usable.assise || usable.actions?.length ? usable : undefined }),
    ...(parcours === undefined ? {} : {
      carrieres: avecCarrieres?.carrieres,
      talentsDeCarriere: avecCarrieres?.talentsDeCarriere,
      competencesDeCarriere: avecCarrieres?.competencesDeCarriere,
      dotationsDeCarriere: avecCarrieres?.dotationsDeCarriere,
    }),
    ...(objet === undefined ? {} : { inventaire: sansVide(inventaireApres(ent.inventaire ?? {}, objet)) }),
    ...(crewIds === undefined ? {} : { crewIds: sansVide(crewIds) }),
    ...(couvre === undefined ? {} : { couvre: sansVide(couvre) }),
  };
}

/** Le poste de l'emplacement `id` de `scene` patché de `patch` : l'engin, l'arc, les servants. */
function posteePatche(scene: Scene, id: string, patch: PatchDePoste): Scene {
  const engin = patch.engin === undefined ? scene : setPosteEngine(scene, id, patch.engin);
  const arc = patch.arc === undefined ? engin : setPosteSide(engin, id, patch.arc ?? undefined);
  return patch.servants === undefined ? arc : setPosteCrew(arc, id, patch.servants);
}

/** L'appartenance du personnage `id` de `scene` patchée de `patch` : enrôlé dans la rencontre (neuve si `null`) ou
 *  retiré ; allié, avec son pilotage par l'IA, ou ennemi. */
function membrePatche(scene: Scene, id: string, patch: PatchDeMembre): Scene {
  if (patch.enrole === false) return patch.rencontre === null ? scene : removeMember(scene, patch.rencontre, id);
  const enrole = patch.enrole ? addMember(scene, patch.rencontre ?? '', id) : { scene, encId: patch.rencontre };
  if (enrole.encId === null) return scene;
  const m = enrole.scene.encounters.find((e) => e.id === enrole.encId)?.members?.find((mm) => mm.entityId === id);
  if (!m) return scene;
  const allie = patch.camp === undefined ? m.side === 'allie' : patch.camp === 'allie';
  const ia = allie && (patch.ia ?? m.ai);
  return patch.camp === undefined && patch.ia === undefined ? enrole.scene : patchMember(enrole.scene, enrole.encId, id, { side: allie ? 'allie' : undefined, ai: ia || undefined });
}

/** Le patch `patch` de l'inspecteur en patch de segment : chaque `null` retire son champ. */
const enPatchDeSegment = (patch: PatchDArete): Partial<WallSeg> =>
  Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? undefined]));

/** La session `s` revenue au cran visé par annuler ou rétablir (`sens`), qui montre sa scène. Le cran quitté prend
 *  d'abord la scène du cran visé quand chacune existe des deux côtés : seule une navigation les sépare, et rétablir ou
 *  annuler encore montrera la scène où l'écriture a eu lieu. Une autre scène montrée remet la session à zéro
 *  (`remiseAZero`), comme un document ouvert absent du cran visé, qui rend la scène ouverte ; sinon la couche éditée
 *  reste, sauf disparue de sa vue (`coucheVue`), où le rez la remplace, et la sélection tombe, sauf celle du lieu dont le
 *  plan est ouvert (`planDuLieuOuvert`) quand ce lieu est au cran visé. */
function revenir(s: SessionDEdition, sens: 'annuler' | 'retablir'): SessionDEdition {
  const h = s.historique;
  const crans = sens === 'annuler' ? h.passe : h.futur;
  const vise = crans[crans.length - 1] as CranDEdition | undefined;
  const { projet, sceneId } = h.present;
  const navigue = vise !== undefined && vise.sceneId !== sceneId && projet.scenes.some((sc) => sc.id === vise.sceneId) && vise.projet.scenes.some((sc) => sc.id === sceneId);
  const historique = (sens === 'annuler' ? annuler : retablir)(navigue ? poser(h, { projet, sceneId: vise.sceneId }, false) : h);
  const revenue = avecSonDocument({ ...s, historique });
  if (revenue.document !== s.document || historique.present.sceneId !== sceneId) return { ...remiseAZero(s), historique, document: revenue.document };
  const z = coucheVue(sceneDuCran(historique.present), s.z) ? s.z : 0;
  const plan = planDuLieuOuvert(s) && planDuLieuOuvert({ ...s, historique });
  return { ...s, historique, z, sel: plan ? s.sel : null, geste: null, brouillon: null };
}

/** Le cadre où vit un porteur de formulaire de la session `s` : sa scène éditée, son projet et le `Source/` que l'hôte
 *  sert. */
export const cadreDeLaSession = (s: SessionDEdition): CadreDuPorteur => ({ scene: sceneEditee(s), projet: projetEdite(s), source: { manifeste: s.manifeste, chapitres: s.chapitres } });

/** Ce qu'un geste écrit au formulaire d'un porteur, dans le cadre `cadre` : sa donnée écrite, ou son refus. */
type EcritureDuPorteur = <S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], cadre: CadreDuPorteur) => EcritureDeValeur<DonneeDuPorteur[S]>;

/** Le projet édité de la session `s` où `ecriture` écrit au formulaire du porteur `porteur`, dans son cadre
 *  (`cadreDeLaSession`), par la table d'écriture de sa sorte (`ECRITURES_DES_PORTEURS`) ; ou son refus, un porteur absent
 *  du projet (`porteurDuProjet`) n'offrant aucun chemin. */
function projetAvecLaDonnee<S extends SorteDePorteur>(s: SessionDEdition, porteur: { sorte: S; id: string }, ecriture: EcritureDuPorteur): EcritureDeValeur<ProjetDEdition> {
  const projet = projetEdite(s);
  const sceneId = idDeLaSceneEditee(s);
  const avant = porteurDuProjet(accesDe(porteur.sorte), projet, sceneId, porteur.id)?.donnee;
  if (!avant) return { ok: false, refus: 'nonOffert' };
  const ecrite = ecriture(porteur.sorte, avant, cadreDeLaSession(s));
  const table: { ecrire: (projet: ProjetDEdition, sceneId: string, avant: DonneeDuPorteur[S], apres: DonneeDuPorteur[S]) => EcritureDeValeur<ProjetDEdition> } = ECRITURES_DES_PORTEURS[porteur.sorte];
  return ecrite.ok ? table.ecrire(projet, sceneId, avant, ecrite.valeur) : ecrite;
}

/** La session `s` où le projet `projet`, qu'une écriture au porteur de sorte `sorte` rend, s'écrit sur un cran neuf si
 *  le document de ce porteur (`accesDe`, `DOCUMENTS`), là où la scène montrée l'est, y change : sinon, `s` telle quelle.
 *  La sélection reste. */
function ecrireSurLesPorteurs(s: SessionDEdition, sorte: SorteDePorteur, projet: ProjetDEdition): SessionDEdition {
  const document = (p: ProjetDEdition) => jsonCanonique(documentDe(accesDe(sorte).document).lire(p, idDeLaSceneEditee(s)) ?? null);
  return document(projet) === document(projetEdite(s)) ? s : ecrireLeProjet(s, projet, s.sel);
}

/** Le projet édité de la session `s` où le geste `g` écrit sa valeur au formulaire de son porteur
 *  (`avecLaValeurDuPorteur`, `projetAvecLaDonnee`), ou son refus. */
const projetAvecLaValeur = (s: SessionDEdition, g: Extract<GesteDEdition, { geste: 'valeur' }>): EcritureDeValeur<ProjetDEdition> =>
  projetAvecLaDonnee(s, g.porteur, (sorte, donnee, cadre) => avecLaValeurDuPorteur(sorte, donnee, g.chemin, g.valeur, cadre));

/** Pourquoi la session `s` n'écrit pas la valeur du geste `g` (`RefusDeValeur`) ; `null` si elle l'écrit. */
export function refusDeLaValeur(s: SessionDEdition, g: Extract<GesteDEdition, { geste: 'valeur' }>): RefusDeValeur | null {
  const ecrite = projetAvecLaValeur(s, g);
  return ecrite.ok ? null : ecrite.refus;
}

/** Pourquoi la session `s` ne supprime pas sa sélection : le refus du retrait de son porteur par la table de sa sorte
 *  (`projetSansLePorteur`), dit à l'auteur ; `null` si elle la supprime. #3606 */
export function refusDeRetrait(s: SessionDEdition): string | null {
  const porteur = porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));
  const retrait = porteur && projetSansLePorteur(projetEdite(s), idDeLaSceneEditee(s), porteur);
  return retrait && !retrait.ok ? retrait.regle : null;
}

/** La session après le geste `g`, sur la couche éditée, l'une de la vue (`vueDeLaScene`) : les ponts d'un navire en sont.
 *  Changer de couche efface le tracé de la volée, qui est celui de sa couche. L'appui de l'outil navire y pose le
 *  navire à la case pointée, sélectionné. Écrire sur l'arête sélectionnée la garde sélectionnée, sans cran quand l'arête n'en change pas. Pendant
 *  le calage, l'appui cale le calque et le glissé n'ouvre aucun geste ; demander une planche l'abandonne, cacher le
 *  calque aussi. Écrire sur l'entité, l'entrée, la zone sélectionnée la garde sélectionnée, l'entrée et le déclencheur sous
 *  leur nouveau nom, le dialogue aussi ;
 *  ajouter un porteur le sélectionne, sur un cran ; coller ou dupliquer sélectionne l'entité posée ; poser une troupe garde l'original sélectionné, ses copies sur un seul
 *  cran. Un geste sans objet (retirer la couche 0 ou une couche que seuls les ponts d'un navire posent, une couche
 *  absente, poser un navire dans une scène qui n'est pas à l'échelle de son plan, poser
 *  une volée que son plan refuse, écrire sans arête, entité ou entrée sélectionnée, écrire une valeur que refuse
 *  `refusDeLaValeur`, sélectionner un porteur absent du projet, ajouter un porteur d'une sorte qui ne se crée pas
 *  par la table, renommer une entrée, un déclencheur, un dialogue ou une rencontre, ou réidentifier une zone d'effet ou un
 *  élément d'un porteur, d'un nom vide ou déjà pris, supprimer un porteur dont le retrait est refusé (`refusDeRetrait`), copier sans entité sélectionnée, coller sans copie ou sans case pointée sur la couche éditée,
 *  dupliquer sans entité sélectionnée, poser une troupe sans personnage sélectionné ou sans case où en poser une copie, supprimer sans sélection, enregistrer hors du dépôt, l'issue d'un enregistrement ou
 *  d'un chargement qui n'est pas en cours, d'un chapitre qui n'est pas celui qu'elle attend, demander une planche pendant un chargement, régler ou retirer un calque
 *  absent, ouvrir le plan d'un lieu absent de la carte ouverte ou celui déjà ouvert, retirer un point d'intérêt sans point
 *  désigné) la rend telle quelle. Le plan d'un lieu ouvert reçoit le pointeur (`pointeurDeLaSession`), ses outils remis
 *  à la sélection. */
function editerLaCouche(s: SessionDEdition, g: GesteDEdition): SessionDEdition {
  const scene = sceneEditee(s);
  switch (g.geste) {
    case 'outil':
      return { ...s, outil: g.outil, geste: null };
    case 'pinceau':
      return { ...s, pinceau: g.taille, rectangle: false };
    case 'rectangle':
      return { ...s, rectangle: g.actif };
    case 'couche':
      return coucheVue(scene, g.z) ? { ...s, z: g.z, sel: null, geste: null, volee: [], brouillon: null } : s;
    case 'ajouterCouche': {
      const z = etageSuivant(vueDeLaScene(s));
      return { ...ecrire(s, addLayer(scene, z)), z };
    }
    case 'retirerCouche':
      return s.z === 0 || !scene.layers.some((l) => l.z === s.z) ? s : { ...ecrire(s, removeLayer(scene, s.z)), z: 0 };
    case 'appui':
    case 'glisse':
    case 'relache': {
      const pointeur = pointeurDeLaSession(s);
      return pointeur ? pointeur[g.geste](s, g.point) : s;
    }
    case 'poserVolee': {
      const plan = planDeLaVolee(s);
      return plan?.ok ? { ...ecrire(s, applyStairFlight(scene, plan.steps, s.z)), volee: [] } : s;
    }
    case 'effacerVolee':
      return { ...s, volee: [] };
    case 'arete': {
      const seg = segmentDeLaSelection(scene, s.sel);
      if (!seg) return s;
      const patchee = g.patch ? patchWall(scene, seg.x, seg.y, seg.side, seg.z ?? 0, enPatchDeSegment(g.patch)) : scene;
      const ecrite = ecrireSurLaSelection(s, patchee, (sc) => segmentDeLaSelection(sc, s.sel));
      return g.brouillon === undefined ? ecrite : { ...ecrite, brouillon: g.brouillon };
    }
    case 'entite': {
      const ent = entiteDeLaSelection(scene, s.sel);
      return ent ? ecrireSurLaSelection(s, editEntity(scene, ent.id, enPatchDEntite(ent, g.patch)), (sc) => entiteDeLaSelection(sc, s.sel)) : s;
    }
    case 'poste': {
      const ent = entiteDeLaSelection(scene, s.sel);
      return ent?.postes?.length ? ecrireSurLaSelection(s, posteePatche(scene, ent.id, g.patch), (sc) => entiteDeLaSelection(sc, s.sel)) : s;
    }
    case 'place': {
      const ent = entiteDeLaSelection(scene, s.sel);
      const res = ent?.kind === 'prop' ? assoirALaPlace(scene, ent.id, g.place, g.occupant) : null;
      return res?.ok ? ecrireSurLaSelection(s, res.scene, (sc) => [sc.seatAssignments, sc.entities.map((e) => e.pos)]) : s;
    }
    case 'membre': {
      const ent = entiteDeLaSelection(scene, s.sel);
      return ent?.kind === 'personnage' ? ecrireSurLaSelection(s, membrePatche(scene, ent.id, g.patch), (sc) => sc.encounters) : s;
    }
    case 'zone':
      return ecrireSurLaSelection(s, patchZone(scene, s.sel, g.patch), zonesDe);
    case 'valeur': {
      const ecrite = projetAvecLaValeur(s, g);
      return ecrite.ok ? ecrireSurLesPorteurs(s, g.porteur.sorte, ecrite.valeur) : s;
    }
    case 'resceller': {
      const ecrite = projetAvecLaDonnee(s, g.porteur, (sorte, donnee, cadre) => avecLAdresseRescellee(sorte, donnee, g.chemin, cadre));
      return ecrite.ok ? ecrireSurLesPorteurs(s, g.porteur.sorte, ecrite.valeur) : s;
    }
    case 'nommer': {
      const ent = entiteDeLaSelection(scene, s.sel);
      if (ent) return ecrireSurLaSelection(s, editEntity(scene, ent.id, { label: g.nom || undefined }), (sc) => entiteDeLaSelection(sc, s.sel));
      if (s.sel?.type === 'effectZone') return g.nom ? ecrireSurLaSelection(s, patchZone(scene, s.sel, { nom: g.nom }), zonesDe) : s;
      if (s.sel?.type === 'architectureBody') return ecrireSurLaSelection(s, patchArchitectureBody(scene, s.sel.id, { label: g.nom?.trim() || undefined }), (sc) => sc.architecture);
      if (s.sel === null) {
        const singulier = gestesDuSingulier(s);
        return singulier && g.nom?.trim() ? singulier.nommer(g.nom.trim()) : s;
      }
      if (g.nom === undefined) return s;
      if (s.sel.type === 'entry') {
        const renommee = renameEntry(scene, s.sel.id, g.nom);
        return renommee === scene ? s : ecrire(s, renommee, { type: 'entry', id: g.nom.trim() });
      }
      const porteur = porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));
      const renommer = porteur && ECRITURES_DES_PORTEURS[porteur.sorte].renommer;
      if (!porteur || !renommer) return s;
      const renomme = renommer(projetEdite(s), idDeLaSceneEditee(s), porteur.id, g.nom);
      return renomme === projetEdite(s) ? s : ecrireLeProjet(s, renomme, selDuPorteur(porteur.sorte, g.nom.trim()));
    }
    case 'selectionner': {
      const { sorte, id } = g.porteur;
      return porteurDuProjet(accesDe(sorte), projetEdite(s), idDeLaSceneEditee(s), id) ? { ...s, sel: selDuPorteur(sorte, id), geste: null, brouillon: null } : s;
    }
    case 'ajouter': {
      const cree = ECRITURES_DES_PORTEURS[g.sorte].creer?.(projetEdite(s), idDeLaSceneEditee(s), s.sel, g.avec);
      return cree ? ecrireLeProjet(s, cree.projet, selDuPorteur(g.sorte, cree.id)) : s;
    }
    case 'document':
      return ouvrirLeDocument(s, g.document);
    case 'planDuLieu': {
      if ((planDuLieuOuvert(s)?.lieu.id ?? null) === g.lieu) return s;
      if (g.lieu === null) return { ...s, planDuLieu: null, geste: null, outil: { mode: 'selection' } };
      const ouvert = accesDe('lieu').document === s.document && porteurDuProjet(accesDe('lieu'), projetEdite(s), idDeLaSceneEditee(s), g.lieu);
      return ouvert ? { ...s, planDuLieu: { poi: null }, sel: selDuPorteur('lieu', g.lieu), geste: null, brouillon: null, outil: { mode: 'selection' } } : s;
    }
    case 'retirerPoi': {
      const plan = planDuLieuOuvert(s);
      if (!plan?.poi) return s;
      const carte = carteEditee(s);
      return { ...ecrireLeProjet(s, DOCUMENTS.carte.ecrire(projetEdite(s), idDeLaSceneEditee(s), retirerPoi(carte, plan.lieu.id, plan.poi)), s.sel), planDuLieu: { poi: null } };
    }
    case 'sens': {
      const carte = projetEdite(s).worldMap;
      const route = s.sel && 'id' in s.sel && s.sel.type === FORMULAIRES.route.sel ? s.sel.id : undefined;
      const orientee = route !== undefined && carte ? orienterRoute(carte, route, g.depuis) : carte;
      return orientee === carte ? s : ecrireLeProjet(s, DOCUMENTS.carte.ecrire(projetEdite(s), idDeLaSceneEditee(s), orientee!), s.sel);
    }
    case 'corps': {
      const corps = scene.architecture?.find((c) => c.id === g.id);
      if (!corps) return s;
      const z = corps.storeys.map((e) => e.z).find((ze) => scene.layers.some((l) => l.z === ze)) ?? s.z;
      return { ...s, sel: { type: 'architectureBody', id: corps.id }, z, geste: null, volee: [], brouillon: null };
    }
    case 'batir':
      return batir(s, g.ouvrage);
    case 'architecture':
      return ecrireSurLaSelection(s, architecturePatchee(scene, s.sel, g.patch), (sc) => sc.architecture);
    case 'baie':
      return ecrireSurLaSelection(s, ouverturePosee(scene, s.sel, g.id, g.patch), (sc) => sc.architecture);
    case 'scenes':
      return g.quoi === 'aller' ? allerALaScene(s, g.id)
        : g.quoi === 'retirer' ? versLaScene(s, deleteProjectScene(scenesEnProjet(s)))
          : versLaScene(s, (g.quoi === 'ajouter' ? addProjectScene : duplicateProjectScene)(scenesEnProjet(s), nextEntityId('scene', scenesDeLHistorique(s.historique).map((sc) => sc.id))));
    case 'avertissement': {
      const w = avertissementsDeLaSession(s)[g.rang];
      return w && versLaFautive(s, w) ? versLAvertissement(s, scene, w) : s;
    }
    case 'scene': {
      const patchee = scenePatchee(scene, g.patch);
      return patchee === scene ? s : ecrire(s, patchee, s.sel);
    }
    case 'identifier': {
      if (g.element !== undefined) {
        const porteur = porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));
        const renommer = porteur && ECRITURES_DES_PORTEURS[porteur.sorte].renommerElement;
        const renomme = porteur && renommer ? renommer(projetEdite(s), idDeLaSceneEditee(s), porteur.id, g.element, g.id) : projetEdite(s);
        return renomme === projetEdite(s) ? s : ecrireLeProjet(s, renomme, s.sel);
      }
      if (s.sel === null) return gestesDuSingulier(s)?.identifier(g.id) ?? s;
      if (s.sel?.type !== 'effectZone') return s;
      const renommee = renameEffectZone(scene, s.sel.id, g.id);
      return renommee === scene ? s : ecrire(s, renommee, { type: 'effectZone', id: g.id.trim() });
    }
    case 'entree': {
      const sel = s.sel;
      return sel?.type === 'entry' ? ecrireSurLaSelection(s, editEntry(scene, sel.id, { z: g.z }), (sc) => sc.entryPoints?.[sel.id]) : s;
    }
    case 'copier': {
      const ent = entiteDeLaSelection(scene, s.sel);
      return ent ? { ...s, presse: ent } : s;
    }
    case 'coller': {
      if (!s.presse || s.pointee?.z !== s.z) return s;
      const out = pasteEntity(scene, s.presse, s.pointee, s.z);
      return ecrire(s, out.scene, { type: 'entity', id: out.id });
    }
    case 'dupliquer': {
      const ent = entiteDeLaSelection(scene, s.sel);
      if (!ent) return s;
      const out = dupliquerLEntite(scene, ent);
      return ecrire(s, out.scene, { type: 'entity', id: out.id });
    }
    case 'troupe': {
      const ent = entiteDeLaSelection(scene, s.sel);
      const out = ent?.kind === 'personnage' ? poserUneTroupe(scene, ent, g.nombre) : null;
      return out?.ids.length ? ecrire(s, out.scene, s.sel) : s;
    }
    case 'supprimer': {
      const porteur = porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));
      const retrait = porteur && projetSansLePorteur(projetEdite(s), idDeLaSceneEditee(s), porteur);
      if (retrait) return retrait.ok ? avecSonDocument(ecrireLeProjet(s, retrait.valeur)) : s;
      return s.sel ? ecrire(s, deleteSel(scene, s.sel)) : s;
    }
    case 'annuler':
    case 'retablir':
      return revenir(s, g.geste);
    case 'enregistrer':
      return s.depot ? { ...s, depot: { ...s.depot, enCours: projetEdite(s) } } : s;
    case 'tester':
      return s;
    case 'enregistrement':
      if (!s.depot?.enCours) return s;
      return g.reussi
        ? { ...s, depot: { enregistre: s.depot.enCours, enCours: null }, ...calquesElagues(s) }
        : { ...s, depot: { ...s.depot, enCours: null } };
    case 'planche':
      return s.chargement ? s : { ...s, chargement: { sceneId: idDeLaSceneEditee(s), z: s.z }, calage: HORS_DU_CALAGE };
    case 'chargement': {
      const c = s.chargement;
      if (!c) return s;
      return { ...s, chargement: null, ...(g.image ? { calques: avecLeCalque(s, c.sceneId, c.z, calqueNeuf(scene, g.image.largeur, g.image.hauteur)) } : {}) };
    }
    case 'calque': {
      const calque = calqueDeLaCouche(s);
      if (!calque) return s;
      const regle = { ...calque, ...g.reglage };
      return { ...s, calques: avecLeCalque(s, idDeLaSceneEditee(s), s.z, regle), ...(regle.visible ? {} : { calage: HORS_DU_CALAGE }) };
    }
    case 'caler':
      return { ...s, calage: g.actif && calqueDeLaCouche(s)?.visible ? { step: 'image1' } : HORS_DU_CALAGE };
    case 'retirerCalque':
      return calqueDeLaCouche(s) ? { ...s, calques: avecLeCalque(s, idDeLaSceneEditee(s), s.z, null), calage: HORS_DU_CALAGE } : s;
    case 'chapitre': {
      const attendu = s.chapitreEnAttente;
      if (attendu?.book !== g.book || attendu.ch !== g.ch) return s;
      return { ...s, chapitreEnAttente: null, chapitres: { ...s.chapitres, [cleDuChapitre(g.book, g.ch)]: g.texte === null ? null : parseChapitre(g.texte) } };
    }
  }
}

/** Les calques de la session `s` sans ceux des scènes absentes de son projet édité, à l'enregistrement réussi ; rien
 *  s'il n'en retire aucun. Une annulation peut ressusciter une scène retirée jusque-là. */
function calquesElagues(s: SessionDEdition): { calques?: CalquesDuProjet } {
  const { scenes } = projetEdite(s);
  const calques = Object.fromEntries(Object.entries(s.calques).filter(([id]) => scenes.some((sc) => sc.id === id)));
  return Object.keys(calques).length === Object.keys(s.calques).length ? {} : { calques };
}

/** Le porteur de formulaire de la sélection de la session `s` (`porteurDeLaSel`) : le schéma de sa sorte
 *  (`FORMULAIRES`), sa donnée dans le projet (`porteurDuProjet`) et les champs qu'elle offre dans son cadre
 *  (`formeDuPorteur`) ; `undefined` sans lui ou sans sa donnée. */
function porteurDeLaSelection(s: SessionDEdition): { schema: unknown; donnee: unknown; champs: ReturnType<typeof formeDuPorteur>['champs'] } | undefined {
  const porteur = porteurDeLaSel(s.sel, s.document, idDeLaSceneEditee(s));
  const donnee = porteur && porteurDuProjet(accesDe(porteur.sorte), projetEdite(s), idDeLaSceneEditee(s), porteur.id)?.donnee;
  return porteur && donnee && { schema: FORMULAIRES[porteur.sorte].schema, donnee, champs: formeDuPorteur(porteur.sorte, donnee, cadreDeLaSession(s)).champs };
}

/** La session `s`, le chapitre qu'elle attend posé si elle n'en attend aucun et que l'hôte sert le `Source/` : celui de
 *  la première adresse de prose du porteur sélectionné (`porteurDeLaSelection`, `adressesDe`), sous un champ qu'il
 *  offre (`cheminOffert`), dont le chapitre est choisi et absent des chapitres reçus. Il se demande donc à la sélection d'un porteur dont une adresse a déjà un
 *  chapitre, et au choix d'un chapitre. */
function avecLeChapitreDemande(s: SessionDEdition): SessionDEdition {
  const porteur = porteurDeLaSelection(s);
  if (s.chapitreEnAttente || !s.manifeste || !porteur) return s;
  const manquante = adressesDe(porteur.schema, porteur.donnee)
    .filter(({ chemin }) => cheminOffert(porteur.champs, chemin))
    .map(({ adresse }) => adresse)
    .find((a) => estGraphieDeChapitre(a.ch) && !(cleDuChapitre(a.book, a.ch) in s.chapitres));
  return manquante ? { ...s, chapitreEnAttente: { book: manquante.book, ch: manquante.ch } } : s;
}

/** La session après le geste `g` (`editerLaCouche`), son plan du lieu fermé sans son lieu sélectionné (`avecSonPlanDuLieu`),
 *  le chapitre qu'elle attend demandé (`avecLeChapitreDemande`) ; le
 *  calage est celui de la couche éditée, changer de couche l'abandonne. */
export function editer(s: SessionDEdition, g: GesteDEdition): SessionDEdition {
  const suite = avecLeChapitreDemande(avecSonPlanDuLieu(editerLaCouche(s, g)));
  return suite.z === s.z ? suite : { ...suite, calage: HORS_DU_CALAGE };
}
