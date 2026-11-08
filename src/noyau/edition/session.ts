/**
 * LA SESSION D'ÉDITION D'UNE CARTE (#3508), sans hôte : le projet ouvert, l'historique de la scène éditée, l'outil, la
 * couche, le pinceau, la sélection, le geste du pointeur en cours, le tracé d'une volée, le brouillon de l'arête
 * sélectionnée, l'entité copiée, l'enregistrement au dépôt et les calques de référence, et le seul réducteur qui les fait avancer
 * (`editer`) sur une union fermée de gestes. Chaque geste délègue au pointeur (`./pointeur`), à l'historique
 * (`./historique`), aux écrivains de `../sceneEdit` (dont l'écriture bornée du formulaire tiré du schéma), à la volée
 * (`../stairFlight`) et au calque (`./calque`) ; aucun
 * n'écrit de règle de scène. L'éditeur Godot la reçoit par le pont.
 */
import type { FabriqueDId } from '../../engine/fabriqueDId';
import type { ArchitectureBody, ArchitectureStorey, BuildingMass, FacadeFeature, RoofDefaults, Scene, SceneEntity, SceneStationAnchor, WallSecret, WallSeg } from '../monde/scene';
import { apparencesDeLOuverture } from '../monde/facades';
import type { ReliefDefaults, SceneRoofDefaults } from '../../data/schemas/defs-scenes/scene';
import { PARTS_RELIEF } from '../../data/materials.types';
import type { Dir8 } from '../../geometry/dir8';
import type { FireArc } from '../../engine/types';
import type { ParcoursDeCarriere } from '../../engine/pnjDeCarriere';
import type { SeatOccupant } from '../monde/seating';
import { documentDeProjet, parseProject, ProjetRefuse, texteDuDepot, type ProjectDoc } from '../worldMap';
import { refusDeLaPorteDuProjet, type GesteDePorte } from '../persistance/refusDeLaPorte';
import { addArchitectureBody, addArchitecturePart, addBuildingMass, addFacadeFeature, addRoofExclusion, patchBuildingMass, poseToitureDuCorps, rectFrom, removeRoofExclusion, addLayer, patchSceneRoofDefaults, removeSceneFlag, resizeGrid, setNorthDeg, setReliefDefault, setSceneFlags, setSceneLabel, setSceneRest, setSceneScalaires, type ScalairesDeScene, addProjectScene, deleteProjectScene, duplicateProjectScene, renameScene, switchProjectScene, type ProjectScenes, addMember, addStoreyAbove, patchArchitectureBody, patchArchitectureStorey, patchFacadeFeature, patchFacadeSection, removeFacadeFeature, setFacadeSectionZ, assoirALaPlace, deleteSel, dupliquerLEntite, poserUneTroupe, editEntity, editEntry, pasteEntity, patchMember, patchWall, patchZone, propRefPatch, removeLayer, removeMember, renameEffectZone, replaceEffectZone, avecLaValeurDuPorteur, patchTrigger, type EcritureDeValeur, type RefusDeValeur, type Segment, renameEntry, renameTrigger, setPosteCrew, setPosteEngine, setPosteSide, addStation, patchStation, removeStation, setSceneMusic, setStartMessageTexte, type PatchDeZone, type Pt } from '../sceneEdit';
import { entiteDeLaSelection, etageSuivant, poigneeDeLaSelection, segmentDeLaSelection, type Layers, type Sel, type SorteDePorteur, type Tool } from '../sceneEditLecture';
import { applyStairFlight, planStairFlight, type StairFlightPlan } from '../stairFlight';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { nextEntityId } from '../../lib/entityId';
import { makeShowcaseParty } from '../../data/pregens';
import type { LancementDeScenario } from '../lancementDeScenario';
import { facadeFeatureKindSchema, messageIntroductionSchema, roofProfileSchema, sceneSchema, sceneWeatherSchema } from '../../data/schemas/defs-scenes/scene';
import { champsOfferts, choixDuNoeud, elementDuNoeud, type FieldDesc, type ValeurDuChoix } from '../codex/editFields';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { architectureSelectionForWarning, validateScene, type Warning } from '../validateScene';
import { planDefectKey, planFocusAt, planFocusTiles } from '../planDefects';
import { annuler, historiqueDe, poser, reecrire, retablir, type Historique } from './historique';
import { appuyer, glisser, relacher, saisirLaPoignee, type ContexteDuPointeur, type EffetDuPointeur, type GesteEnCours, type PointDeCarte } from './pointeur';
import type { CalibProgress } from './calage';
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
export const ACTIONS_D_ARCHITECTURE = ['select', 'facade', 'exclusion'] as const;
export type ActionDArchitecture = (typeof ACTIONS_D_ARCHITECTURE)[number];

/** Les outils que l'éditeur offre. */
export type OutilDeLEditeur =
  | Extract<Tool, { mode: 'select' | 'tile' | 'height' | 'wall' | 'stair' | 'crenellated' | 'entity' | 'emplacement' | 'entry' | 'zone' | 'zoneTiles' | 'erase' }>
  | { mode: 'architecture'; action: ActionDArchitecture };

/** Ce que bâtit l'outil d'architecture : un corps ou une partie sur la case pointée, l'étage au-dessus du corps actif,
 *  une masse de toiture sur la case pointée. */
export const OUVRAGES = ['corps', 'etage', 'partie', 'masse'] as const;
export type Ouvrage = (typeof OUVRAGES)[number];

/** Ce que l'inspecteur de la scène écrit, sans sélection : ses champs scalaires (`null` retire le champ), sa grille,
 *  son nord (`null` : vers le haut du plan), les matières de son relief, sa toiture par défaut, son repos sur place
 *  (lieux offerts, qualité piètre), ses drapeaux de départ (`null` retire le drapeau) ; une piste de sa musique
 *  (`setSceneMusic` : `id` absent, la piste du contexte ; `null`, le silence) ; le texte de son message
 *  d'introduction (`setStartMessageTexte` : vide, il se retire) ; ses ancres de bataille, une ajoutée vers la Scène de
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
  message?: string;
  stations?: { ajouter: string } | { rang: number; sceneId?: string; pos?: SceneStationAnchor['pos'] } | { retirer: number };
}

/** Les groupes que le lieu déclare (`Scene.groups`), chacun sa valeur et son libellé (`choixDuNoeud`). */
export const groupesDuLieu = (): ValeurDuChoix[] => choixDuNoeud(elementDuNoeud(sceneSchema.shape.groups))!;

/** Le champ du texte du message d'introduction, tiré de son schéma (`messageIntroductionSchema`). */
export const champDuMessage = (): FieldDesc => champsOfferts(messageIntroductionSchema, {}).find((f) => f.key === 'texte')!;

/** Les avertissements de la validation (`validateScene`) qui concernent la scène éditée de la session `s`, ceux de la
 *  carte du monde compris. */
export function avertissementsDeLaSession(s: SessionDEdition): Warning[] {
  return validateScene(scenesDeLaSession(s), s.projet.worldMap, s.projet.narratif)
    .filter((w) => w.sceneId === s.sceneId || w.scope === 'worldMap');
}

/** L'avertissement `w` désigne-t-il un fautif de la carte : un défaut de plan, un ouvrage d'architecture, une entité ou
 *  un déclencheur ? Les autres se corrigent hors de la carte. */
export const versLaFautive = (w: Warning): boolean =>
  !!w.plan || !!architectureSelectionForWarning(w) || (!!w.refId && (w.scope === 'entity' || w.scope === 'trigger'));

/** Les cases du défaut de plan que suit la session `s`, tant que la validation le relève ; aucune sinon. */
export function casesDuDefaut(s: SessionDEdition): { x: number; y: number; z: number }[] {
  const at = planFocusAt(avertissementsDeLaSession(s), s.defaut);
  return at ? planFocusTiles(at) : [];
}

/** La session `s` amenée au fautif de l'avertissement `w` de sa scène `scene`, à sa couche : un défaut de plan, suivi,
 *  à l'outil de sélection, sa zone d'effet sélectionnée s'il en vise une ; un ouvrage d'architecture sélectionné à
 *  l'outil d'architecture ; une entité ou un déclencheur sélectionné à l'outil de sélection. */
function versLAvertissement(s: SessionDEdition, scene: Scene, w: Warning): SessionDEdition {
  const vers = (z: number | undefined, sel: Sel, outil: OutilDeLEditeur, defaut: string | null = null): SessionDEdition => ({
    ...s, z: z !== undefined && scene.layers.some((l) => l.z === z) ? z : s.z, sel, outil, defaut, geste: null, volee: [], brouillon: null,
  });
  if (w.plan) {
    const at = w.plan.at;
    const zone = at.kind === 'zone' ? scene.effectZones?.find((z) => z.id === at.zoneId) : undefined;
    return vers(at.z, zone ? { type: 'effectZone', id: zone.id } : null, { mode: 'select' }, planDefectKey(w.plan));
  }
  const archi = architectureSelectionForWarning(w);
  if (archi) {
    const corps = scene.architecture?.find((c) => c.id === (archi.type === 'architectureBody' ? archi.id : archi.bodyId));
    const z = archi.type === 'architectureStorey' ? corps?.storeys.find((e) => e.id === archi.id)?.z
      : archi.type === 'architecturePart' ? corps?.storeys.find((e) => e.id === archi.storeyId)?.z
        : archi.type === 'facadeSection' ? corps?.facades.find((f) => f.id === archi.id)?.z
          : archi.type === 'roofSection' ? corps?.masses.find((m) => m.id === archi.id)?.z
            : corps?.storeys[0]?.z;
    return vers(z, archi, { mode: 'architecture', action: 'select' });
  }
  if (w.scope === 'entity') return vers(scene.entities.find((e) => e.id === w.refId)?.z, { type: 'entity', id: w.refId! }, { mode: 'select' });
  return vers(scene.triggers.find((t) => t.id === w.refId)?.rect.z, { type: 'trigger', id: w.refId! }, { mode: 'select' });
}

/** Les scènes du projet de la session `s` autour de la scène éditée. */
function scenesEnProjet(s: SessionDEdition): ProjectScenes {
  const scenes = scenesDeLaSession(s);
  const rang = scenes.findIndex((sc) => sc.id === s.sceneId);
  return { avant: scenes.slice(0, rang), scene: scenes[rang], apres: scenes.slice(rang + 1) };
}

/** La session `s` qui édite la scène `p.scene` de son projet `p`, à l'outil de sélection, sur la couche 0, son
 *  historique neuf ; les calques d'une scène retirée retirés. Telle quelle sans `p`. */
function versLaScene(s: SessionDEdition, p: ProjectScenes | null): SessionDEdition {
  if (!p) return s;
  const scenes = [...p.avant, p.scene, ...p.apres];
  const calques = Object.fromEntries(Object.entries(s.calques).filter(([id]) => scenes.some((sc) => sc.id === id)));
  return {
    ...s, projet: { ...s.projet, scenes }, sceneId: p.scene.id, historique: historiqueDe(p.scene), outil: { mode: 'select' }, z: 0,
    sel: null, geste: null, volee: [], brouillon: null, pointee: null, defaut: null, calage: HORS_DU_CALAGE,
    ...(Object.keys(calques).length === Object.keys(s.calques).length ? {} : { calques }),
  };
}

/** La session `s` dont la scène éditée `scene` prend l'identifiant `id` (`renameScene`), hors de l'historique : chaque
 *  cran le porte, et ses calques le suivent. Telle quelle sous un identifiant vide ou déjà pris. */
function sceneRenommee(s: SessionDEdition, scene: Scene, id: string): SessionDEdition {
  const renommee = renameScene(scene, s.projet.scenes.filter((sc) => sc.id !== s.sceneId), id);
  if (renommee === scene) return s;
  const { [s.sceneId]: siens, ...autres } = s.calques;
  return {
    ...s, sceneId: renommee.id,
    projet: { ...s.projet, scenes: s.projet.scenes.map((sc) => (sc.id === s.sceneId ? { ...sc, id: renommee.id } : sc)) },
    historique: { ...reecrire(s.historique, (sc) => ({ ...sc, id: renommee.id })), present: renommee },
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
  if (patch.message !== undefined) sc = setStartMessageTexte(sc, patch.message);
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
 *  d'un décor (`null` l'éteint), son assise ; l'embuscade, l'inventaire, le parcours de carrière, le tirage des
 *  Caractéristiques et les sorts choisis d'un personnage ; l'équipage exposé à bord. */
export interface PatchDEntite {
  ref?: string;
  facing?: Dir8;
  z?: number;
  light?: NonNullable<SceneEntity['light']> | null;
  assise?: boolean;
  embusque?: boolean;
  inventaire?: NonNullable<SceneEntity['inventaire']>;
  /** Le parcours de carrière entier ; sans carrière, il est retiré. */
  parcours?: ParcoursDeCarriere;
  /** Caractéristiques tirées au hasard au spawn (`combat.randomChars`, LDB 77 l.108). */
  aleatoire?: boolean;
  /** Les sorts choisis entiers (`combat.spells`, `sortsDuPnj`) ; vides, ils sont retirés. */
  sorts?: string[];
  crewIds?: string[];
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
  camp?: 'enemy' | 'ally';
  ia?: boolean;
}

/** Ce que l'arête sélectionnée attend de l'auteur avant de s'écrire entière (`wallSegSchema`) : la porte secrète
 *  sans sa difficulté ou sa face, la croisée franchissable sans son allège. La scène reste valide, l'état incomplet
 *  est nommé ici. */
export interface BrouillonDArete {
  secret?: Partial<WallSecret>;
  crossable?: true;
}

export interface SessionDEdition {
  /** Le projet ouvert : son document, la scène éditée tenue par `historique` (`scenesDeLaSession`). */
  projet: Omit<ProjectDoc, 'schema'>;
  /** L'id de la scène éditée du projet. */
  sceneId: string;
  historique: Historique;
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
  /** Le dépôt d'où le projet s'est ouvert : les scènes du projet telles qu'il les porte, et celles qu'un
   *  enregistrement en cours lui écrit. `null` : le projet vient du jeu, il ne s'enregistre pas. */
  depot: { enregistrees: readonly Scene[]; enCours: readonly Scene[] | null } | null;
  /** Les calques de référence du projet, par scène et par couche, hors de l'historique. */
  calques: CalquesDuProjet;
  /** Le calage du calque de la couche éditée : `idle` hors du calage. */
  calage: CalibProgress;
  /** Le défaut de plan suivi depuis la validation (`planDefectKey`), `null` sans lui. */
  defaut: string | null;
  /** La couche dont l'hôte charge la planche, `null` sans chargement en cours. */
  chargement: { sceneId: string; z: number } | null;
  /** Les calques que l'hôte gardait étaient d'un autre format, retirés à l'ouverture. */
  ecartes: boolean;
}

/** Un geste de l'éditeur : choisir l'outil, la taille du pinceau, le rectangle du pinceau de terrain, la couche
 *  éditée ; ajouter une couche au-dessus de la plus haute, retirer la couche éditée ; appuyer, glisser, relâcher
 *  sur un point de la carte ; poser la volée tracée, effacer son tracé ; écrire sur l'arête sélectionnée, ou poser
 *  son brouillon ; écrire sur l'entité sélectionnée, le poste de l'emplacement de siège sélectionné, une place du décor
 *  sélectionné ou l'appartenance du personnage sélectionné à une rencontre ; écrire sur la zone sélectionnée, ou sur la scène ; écrire
 *  une valeur au chemin `chemin` du formulaire de la zone d'effet ou du déclencheur `porteur` (`formulaireDe`, `undefined`
 *  retire le champ) ; nommer l'entité, l'entrée, le
 *  déclencheur, la zone d'effet ou le corps sélectionné, ou la scène sans sélection (`nom` absent : l'entité reprend le nom de sa fiche) ; changer l'identifiant de la zone
 *  d'effet sélectionnée, ou de la scène sans sélection ; éditer une autre scène du projet, en ajouter une vide, dupliquer
 *  ou retirer l'éditée ; changer la couche de l'entrée sélectionnée ; copier l'entité sélectionnée, la coller
 *  sur la case pointée, la dupliquer ; poser une troupe de `nombre` copies du personnage sélectionné (`poserUneTroupe`,
 *  `nombre` entre `BORNES_DE_LA_TROUPE`) ; supprimer la sélection ; annuler, rétablir ; enregistrer au dépôt, puis l'issue de cette écriture ;
 *  mettre la scène à l'essai, que l'hôte joue (`essaiDeLaScene`), la session telle quelle ;
 *  demander la planche du calque de la couche éditée, puis l'issue de son chargement, l'image lue ou rien ; régler ce
 *  calque, le caler, le retirer. */
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
  | { geste: 'valeur'; porteur: { sorte: SorteDePorteur; id: string }; chemin: Segment[]; valeur?: unknown }
  | { geste: 'corps'; id: string }
  | { geste: 'batir'; ouvrage: Ouvrage }
  | { geste: 'architecture'; patch: PatchDArchitecture }
  | { geste: 'baie'; id: string | null; patch: PatchDOuverture | null }
  | { geste: 'scene'; patch: PatchDeScene }
  | { geste: 'avertissement'; rang: number }
  | { geste: 'scenes'; quoi: 'aller'; id: string }
  | { geste: 'scenes'; quoi: 'ajouter' | 'dupliquer' | 'retirer' }
  | { geste: 'nommer'; nom?: string }
  | { geste: 'identifier'; id: string }
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
  | { geste: 'retirerCalque' };

/** La scène éditée. */
export const sceneEditee = (s: SessionDEdition): Scene => s.historique.present;

/** Les scènes du projet de la session `s`, dans l'ordre du document, la scène éditée à jour. */
export const scenesDeLaSession = (s: SessionDEdition): Scene[] => s.projet.scenes.map((sc) => (sc.id === s.sceneId ? sceneEditee(s) : sc));

/** La session qui édite la première scène du projet `projet`, à l'outil de sélection, sur la couche 0 ; `duDepot` :
 *  le projet est celui que le dépôt porte, où il s'enregistre ; `gardes`, s'il est donné, les calques que l'hôte
 *  gardait pour lui (`calquesLus`), retirés s'ils sont d'un autre format. */
export function ouvrirLEdition(projet: Omit<ProjectDoc, 'schema'>, duDepot: boolean, gardes?: unknown): SessionDEdition {
  const scene = projet.scenes[0];
  const calques = gardes === undefined ? {} : calquesLus(gardes);
  return {
    projet, sceneId: scene.id, historique: historiqueDe(scene), outil: { mode: 'select' }, z: 0, pinceau: 1, rectangle: false, sel: null, geste: null, volee: [], brouillon: null, pointee: null, presse: null,
    depot: duDepot ? { enregistrees: projet.scenes, enCours: null } : null,
    calques: calques ?? {}, calage: { step: 'idle' }, chargement: null, ecartes: calques === null, defaut: null,
  };
}

/** Le calage au repos. */
const HORS_DU_CALAGE: CalibProgress = { step: 'idle' };

/** Le calque de la couche éditée de la session `s`, `undefined` sans lui. */
export const calqueDeLaCouche = (s: SessionDEdition): CalqueDeCouche | undefined => s.calques[s.sceneId]?.[String(s.z)];

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

/** Le texte que l'enregistrement de la session `s` écrit au dépôt : son projet, ses scènes à jour, passé par la porte,
 *  en forme dépôt (`texteDuDepot`) ; ou le refus de la porte. */
export function texteAEnregistrer(s: SessionDEdition) {
  const { scenes: _scenes, worldMap, activeAxes, narratif, ...identite } = s.projet;
  const doc = documentDeProjet(identite, scenesDeLaSession(s), { worldMap, activeAxes, narratif });
  return aLaPorte('export', () => (parseProject(doc), texteDuDepot(doc)));
}

/** L'essai de la scène éditée de la session `s` : le projet, ses scènes à jour, passé par la porte, et ce qui construit
 *  son lancement, la scène éditée à l'entrée, joué par le groupe vitrine (`makeShowcaseParty`), à l'ouverture de la
 *  partie ; ou le refus de la porte. */
export function essaiDeLaScene(s: SessionDEdition) {
  const { scenes: _scenes, worldMap, activeAxes, narratif, ...identite } = s.projet;
  const doc = documentDeProjet(identite, scenesDeLaSession(s), { worldMap, activeAxes, narratif });
  return aLaPorte('test', (): ((idNeuf: FabriqueDId) => LancementDeScenario) => {
    const projet = parseProject(doc);
    return (idNeuf) => ({
      party: makeShowcaseParty(idNeuf), scene: projet.scenes.find((sc) => sc.id === s.sceneId)!, extraScenes: projet.scenes.filter((sc) => sc.id !== s.sceneId),
      ...(projet.worldMap ? { worldMap: projet.worldMap } : {}), narratif: projet.narratif,
    });
  });
}

/** Le plan de la volée tracée de la session `s` vers l'étage de son outil (`planStairFlight`), `null` hors de l'outil
 *  Volée. */
export function planDeLaVolee(s: SessionDEdition): StairFlightPlan | null {
  return s.outil.mode === 'stair' ? planStairFlight(sceneEditee(s), s.volee, s.z, s.outil.toZ) : null;
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

/** Le contexte du pointeur de la session : l'outil d'architecture y est la sélection, en mode architecture. */
function contexte(s: SessionDEdition): ContexteDuPointeur {
  const outil = s.outil;
  const architecture = outil.mode === 'architecture' ? { z: s.z, action: outil.action === 'facade' ? 'facade' as const : 'select' as const, bodyId: corpsActif(s)?.id ?? null } : null;
  return { tool: outil.mode === 'architecture' ? { mode: 'select' } : outil, z: s.z, brush: s.pinceau, encId: '', encRef: '', layers: TOUS_LES_CALQUES, sel: s.sel, terrainRect: s.rectangle, architecture };
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
    ...(effet.architectureFinie && s.outil.mode === 'architecture' ? { outil: { mode: 'architecture', action: 'select' } } : {}),
    ...(effet.sel !== undefined ? { brouillon: null } : {}),
    geste: effet.geste,
    ...(effet.volee ? { volee: basculer(s.volee, effet.volee) } : {}),
    ...(effet.scene ? { historique: poser(s.historique, effet.scene, effet.cran === true) } : {}),
    ...(effet.sel !== undefined ? { sel: effet.sel } : {}),
  };
}

/** La scène `scene` écrite sur un cran neuf, la sélection et son brouillon levés, ou `sel` sélectionnée. */
const ecrire = (s: SessionDEdition, scene: Scene, sel: Sel = null): SessionDEdition => ({ ...s, historique: poser(s.historique, scene, true), sel, brouillon: null });

/** Les zones de la scène `sc` : ses déclencheurs, ses zones de repos et d'effet. */
const zonesDe = (sc: Scene) => [sc.triggers, sc.restZones, sc.effectZones];

/** La session `s` où la scène `scene` s'écrit sur un cran neuf si ce que `lire` y lit de la sélection change : sinon,
 *  `s` telle quelle. La sélection reste. */
function ecrireSurLaSelection<T>(s: SessionDEdition, scene: Scene, lire: (sc: Scene) => T): SessionDEdition {
  return jsonCanonique(lire(scene)) === jsonCanonique(lire(sceneEditee(s))) ? s : { ...s, historique: poser(s.historique, scene, true) };
}

/** Le patch `patch` de l'inspecteur en patch d'entité pour `ent` : le type d'un décor avec ses défauts de pose
 *  (`propRefPatch`), la couche 0 comme son absence, un inventaire, un parcours sans carrière, des sorts ou un équipage
 *  vides comme leur absence. */
function enPatchDEntite(ent: SceneEntity, patch: PatchDEntite): Partial<SceneEntity> {
  const { ref, z, light, assise, embusque, inventaire, parcours, aleatoire, sorts, crewIds, ...reste } = patch;
  const avecCarrieres = parcours && Object.keys(parcours.carrieres).length ? parcours : undefined;
  const usable = { ...ent.usable, assise: assise || undefined };
  return {
    ...reste,
    ...(ref === undefined ? {} : ent.kind === 'prop' ? propRefPatch(ref, ent) : { ref }),
    ...(z === undefined ? {} : { z: z || undefined }),
    ...(light === undefined ? {} : { light: light ?? undefined }),
    ...(assise === undefined ? {} : { usable: usable.assise || usable.actions?.length ? usable : undefined }),
    ...(embusque === undefined && aleatoire === undefined && sorts === undefined ? {} : { combat: {
      ...ent.combat,
      ...(embusque === undefined ? {} : { hiddenUntilCombat: embusque || undefined }),
      ...(aleatoire === undefined ? {} : { randomChars: aleatoire || undefined }),
      ...(sorts === undefined ? {} : { spells: sorts.length ? sorts : undefined }),
    } }),
    ...(parcours === undefined ? {} : {
      carrieres: avecCarrieres?.carrieres,
      talentsDeCarriere: avecCarrieres?.talentsDeCarriere,
      competencesDeCarriere: avecCarrieres?.competencesDeCarriere,
      dotationsDeCarriere: avecCarrieres?.dotationsDeCarriere,
    }),
    ...(inventaire === undefined ? {} : { inventaire: Object.keys(inventaire).length ? inventaire : undefined }),
    ...(crewIds === undefined ? {} : { crewIds: crewIds.length ? crewIds : undefined }),
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
  const allie = patch.camp === undefined ? m.side === 'ally' : patch.camp === 'ally';
  const ia = allie && (patch.ia ?? m.ai);
  return patch.camp === undefined && patch.ia === undefined ? enrole.scene : patchMember(enrole.scene, enrole.encId, id, { side: allie ? 'ally' : undefined, ai: ia || undefined });
}

/** Le patch `patch` de l'inspecteur en patch de segment : chaque `null` retire son champ. */
const enPatchDeSegment = (patch: PatchDArete): Partial<WallSeg> =>
  Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v ?? undefined]));

/** La session revenue à l'état `historique` d'annuler ou de rétablir : la couche éditée reste, sauf disparue avec lui,
 *  où le rez la remplace. */
function revenir(s: SessionDEdition, historique: Historique): SessionDEdition {
  const z = historique.present.layers.some((l) => l.z === s.z) ? s.z : 0;
  return { ...s, historique, z, sel: null, geste: null, brouillon: null };
}

/** La scène `scene` où le geste `g` écrit sa valeur au formulaire de son porteur (`avecLaValeurDuPorteur`) : la zone
 *  d'effet remplacée, la condition d'entrée du déclencheur patchée (`patchTrigger`) ; ou son refus, un porteur absent
 *  n'offrant aucun chemin. */
function sceneAvecLaValeur(scene: Scene, g: Extract<GesteDEdition, { geste: 'valeur' }>): EcritureDeValeur<Scene> {
  if (g.porteur.sorte === 'zone') {
    const zone = (scene.effectZones ?? []).find((z) => z.id === g.porteur.id);
    const ecrite = zone ? avecLaValeurDuPorteur('zone', zone, g.chemin, g.valeur) : { ok: false as const, refus: 'nonOffert' as const };
    return ecrite.ok ? { ok: true, valeur: replaceEffectZone(scene, zone!.id, ecrite.valeur) } : ecrite;
  }
  const declencheur = scene.triggers.find((t) => t.id === g.porteur.id);
  const ecrit = declencheur ? avecLaValeurDuPorteur('declencheur', declencheur, g.chemin, g.valeur) : { ok: false as const, refus: 'nonOffert' as const };
  return ecrit.ok ? { ok: true, valeur: patchTrigger(scene, ecrit.valeur.id, { when: ecrit.valeur.when }) } : ecrit;
}

/** Pourquoi la session `s` n'écrit pas la valeur du geste `g` (`RefusDeValeur`) ; `null` si elle l'écrit. */
export function refusDeLaValeur(s: SessionDEdition, g: Extract<GesteDEdition, { geste: 'valeur' }>): RefusDeValeur | null {
  const ecrite = sceneAvecLaValeur(sceneEditee(s), g);
  return ecrite.ok ? null : ecrite.refus;
}

/** La session après le geste `g`, sur la couche éditée. Changer de couche efface le tracé de la volée, qui est celui de
 *  sa couche. Écrire sur l'arête sélectionnée la garde sélectionnée, sans cran quand l'arête n'en change pas. Pendant
 *  le calage, l'appui cale le calque et le glissé n'ouvre aucun geste ; demander une planche l'abandonne, cacher le
 *  calque aussi. Écrire sur l'entité, l'entrée, la zone sélectionnée la garde sélectionnée, l'entrée et le déclencheur sous
 *  leur nouveau nom ;
 *  coller ou dupliquer sélectionne l'entité posée ; poser une troupe garde l'original sélectionné, ses copies sur un seul
 *  cran. Un geste sans objet (retirer la couche 0, une couche absente, poser
 *  une volée que son plan refuse, écrire sans arête, entité ou entrée sélectionnée, écrire une valeur que refuse
 *  `refusDeLaValeur`, renommer une entrée ou un déclencheur, ou
 *  réidentifier une zone d'effet, d'un nom vide ou déjà pris, copier sans entité sélectionnée, coller sans copie ou sans case pointée sur la couche éditée,
 *  dupliquer sans entité sélectionnée, poser une troupe sans personnage sélectionné ou sans case où en poser une copie, supprimer sans sélection, enregistrer hors du dépôt, l'issue d'un enregistrement ou
 *  d'un chargement qui n'est pas en cours, demander une planche pendant un chargement, régler ou retirer un calque
 *  absent) la rend telle quelle. */
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
      return scene.layers.some((l) => l.z === g.z) ? { ...s, z: g.z, sel: null, geste: null, volee: [], brouillon: null } : s;
    case 'ajouterCouche': {
      const z = etageSuivant(scene);
      return { ...ecrire(s, addLayer(scene, z)), z };
    }
    case 'retirerCouche':
      return s.z === 0 ? s : { ...ecrire(s, removeLayer(scene, s.z)), z: 0 };
    case 'appui': {
      const calque = calqueDeLaCouche(s);
      if (s.calage.step !== 'idle' && calque) {
        const pas = caler(s.calage, calque, g.point.f);
        return { ...s, calage: pas.progress, ...(pas.transform ? { calques: avecLeCalque(s, s.sceneId, s.z, { ...calque, calage: pas.transform }) } : {}) };
      }
      const pointee = { ...g.point.case, z: s.z };
      if (enExclusion(s)) return { ...s, geste: { sorte: 'rectangle', depart: g.point.case, rect: rectFrom(g.point.case, g.point.case) }, pointee };
      const poignee = s.outil.mode === 'select' || (s.outil.mode === 'architecture' && s.outil.action === 'select') ? poigneeDeLaSelection(scene, s.sel, s.z) : null;
      const saisie = poignee?.x === g.point.case.x && poignee.y === g.point.case.y;
      return { ...(saisie ? { ...s, geste: saisirLaPoignee(contexte(s)) } : porter(s, appuyer(scene, contexte(s), g.point))), pointee };
    }
    case 'glisse':
      return s.calage.step !== 'idle' ? s : porter(s, glisser(scene, contexte(s), s.geste, g.point));
    case 'relache': {
      if (s.calage.step !== 'idle') return s;
      const corps = corpsActif(s);
      if (enExclusion(s) && s.geste?.sorte === 'rectangle' && corps) {
        const exclue = addRoofExclusion(scene, corps.id, s.z, rectFrom(s.geste.depart, g.point.case));
        return { ...ecrire(s, exclue, { type: 'architectureBody', id: corps.id }), geste: null, outil: { mode: 'architecture', action: 'select' } };
      }
      return porter(s, relacher(scene, contexte(s), s.geste, g.point));
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
      const ecrite = sceneAvecLaValeur(scene, g);
      return ecrite.ok ? ecrireSurLaSelection(s, ecrite.valeur, (sc) => [sc.effectZones, sc.triggers]) : s;
    }
    case 'nommer': {
      const ent = entiteDeLaSelection(scene, s.sel);
      if (ent) return ecrireSurLaSelection(s, editEntity(scene, ent.id, { label: g.nom || undefined }), (sc) => entiteDeLaSelection(sc, s.sel));
      if (s.sel?.type === 'effectZone') return g.nom ? ecrireSurLaSelection(s, patchZone(scene, s.sel, { nom: g.nom }), zonesDe) : s;
      if (s.sel?.type === 'architectureBody') return ecrireSurLaSelection(s, patchArchitectureBody(scene, s.sel.id, { label: g.nom?.trim() || undefined }), (sc) => sc.architecture);
      if (s.sel === null) return g.nom?.trim() ? ecrire(s, setSceneLabel(scene, g.nom.trim())) : s;
      const sel = s.sel;
      if ((sel?.type !== 'entry' && sel?.type !== 'trigger') || g.nom === undefined) return s;
      const renommee = (sel.type === 'entry' ? renameEntry : renameTrigger)(scene, sel.id, g.nom);
      return renommee === scene ? s : ecrire(s, renommee, { type: sel.type, id: g.nom.trim() });
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
      return g.quoi === 'aller' ? versLaScene(s, switchProjectScene(scenesEnProjet(s), g.id))
        : g.quoi === 'retirer' ? versLaScene(s, deleteProjectScene(scenesEnProjet(s)))
          : versLaScene(s, (g.quoi === 'ajouter' ? addProjectScene : duplicateProjectScene)(scenesEnProjet(s), nextEntityId('scene', s.projet.scenes.map((sc) => sc.id))));
    case 'avertissement': {
      const w = avertissementsDeLaSession(s)[g.rang];
      return w && versLaFautive(w) ? versLAvertissement(s, scene, w) : s;
    }
    case 'scene': {
      const patchee = scenePatchee(scene, g.patch);
      return patchee === scene ? s : ecrire(s, patchee, s.sel);
    }
    case 'identifier': {
      if (s.sel === null) return sceneRenommee(s, scene, g.id);
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
    case 'supprimer':
      return s.sel ? ecrire(s, deleteSel(scene, s.sel)) : s;
    case 'annuler':
      return revenir(s, annuler(s.historique));
    case 'retablir':
      return revenir(s, retablir(s.historique));
    case 'enregistrer':
      return s.depot ? { ...s, depot: { ...s.depot, enCours: scenesDeLaSession(s) } } : s;
    case 'tester':
      return s;
    case 'enregistrement':
      return s.depot?.enCours ? { ...s, depot: { enregistrees: g.reussi ? s.depot.enCours : s.depot.enregistrees, enCours: null } } : s;
    case 'planche':
      return s.chargement ? s : { ...s, chargement: { sceneId: s.sceneId, z: s.z }, calage: HORS_DU_CALAGE };
    case 'chargement': {
      const c = s.chargement;
      if (!c) return s;
      return { ...s, chargement: null, ...(g.image ? { calques: avecLeCalque(s, c.sceneId, c.z, calqueNeuf(scene, g.image.largeur, g.image.hauteur)) } : {}) };
    }
    case 'calque': {
      const calque = calqueDeLaCouche(s);
      if (!calque) return s;
      const regle = { ...calque, ...g.reglage };
      return { ...s, calques: avecLeCalque(s, s.sceneId, s.z, regle), ...(regle.visible ? {} : { calage: HORS_DU_CALAGE }) };
    }
    case 'caler':
      return { ...s, calage: g.actif && calqueDeLaCouche(s)?.visible ? { step: 'image1' } : HORS_DU_CALAGE };
    case 'retirerCalque':
      return calqueDeLaCouche(s) ? { ...s, calques: avecLeCalque(s, s.sceneId, s.z, null), calage: HORS_DU_CALAGE } : s;
  }
}

/** La session après le geste `g` (`editerLaCouche`) ; le calage est celui de la couche éditée, changer de couche
 *  l'abandonne. */
export function editer(s: SessionDEdition, g: GesteDEdition): SessionDEdition {
  const suite = editerLaCouche(s, g);
  return suite.z === s.z ? suite : { ...suite, calage: HORS_DU_CALAGE };
}
