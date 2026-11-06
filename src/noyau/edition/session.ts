/**
 * LA SESSION D'ÉDITION D'UNE CARTE (#3508), sans hôte : le projet ouvert, l'historique de la scène éditée, l'outil, la
 * couche, le pinceau, la sélection, le geste du pointeur en cours et l'enregistrement au dépôt, et le seul réducteur
 * qui les fait avancer (`editer`) sur une union fermée de gestes. Chaque geste délègue au pointeur (`./pointeur`), à l'historique
 * (`./historique`) et aux écrivains de `../sceneEdit` ; aucun n'écrit de règle de scène. L'éditeur Godot la reçoit
 * par le pont.
 */
import type { Scene } from '../monde/scene';
import { documentDeProjet, parseProject, ProjetRefuse, texteDuDepot, type ProjectDoc } from '../worldMap';
import { refusDeLaPorteDuProjet, type GesteDePorte } from '../persistance/refusDeLaPorte';
import { addLayer, removeLayer, type Pt } from '../sceneEdit';
import { etageSuivant, type Layers, type Sel, type Tool } from '../sceneEditLecture';
import { annuler, historiqueDe, poser, retablir, type Historique } from './historique';
import { appuyer, glisser, relacher, type ContexteDuPointeur, type EffetDuPointeur, type GesteEnCours, type PointDeCarte } from './pointeur';

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

/** Les outils que l'éditeur offre. */
export type OutilDeLEditeur = Extract<Tool, { mode: 'select' | 'tile' | 'height' | 'wall' }>;

export interface SessionDEdition {
  /** Le projet ouvert : son document, la scène éditée tenue par `historique`. */
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
  /** La dernière case qu'un appui a visée, sur la couche `z` de cet appui. */
  pointee: (Pt & { z: number }) | null;
  /** Le dépôt d'où le projet s'est ouvert : la scène éditée telle qu'il la porte, et celle qu'un enregistrement en
   *  cours lui écrit. `null` : le projet vient du jeu, il ne s'enregistre pas. */
  depot: { enregistree: Scene; enCours: Scene | null } | null;
}

/** Un geste de l'éditeur : choisir l'outil, la taille du pinceau, le rectangle du pinceau de terrain, la couche
 *  éditée ; ajouter une couche au-dessus de la plus haute, retirer la couche éditée ; appuyer, glisser, relâcher
 *  sur un point de la carte ; annuler, rétablir ; enregistrer au dépôt, puis l'issue de cette écriture. */
export type GesteDEdition =
  | { geste: 'outil'; outil: OutilDeLEditeur }
  | { geste: 'pinceau'; taille: (typeof PINCEAUX)[number] }
  | { geste: 'rectangle'; actif: boolean }
  | { geste: 'couche'; z: number }
  | { geste: 'ajouterCouche' }
  | { geste: 'retirerCouche' }
  | { geste: 'appui' | 'glisse' | 'relache'; point: PointDeCarte }
  | { geste: 'annuler' }
  | { geste: 'retablir' }
  | { geste: 'enregistrer' }
  | { geste: 'enregistrement'; reussi: boolean };

/** La scène éditée. */
export const sceneEditee = (s: SessionDEdition): Scene => s.historique.present;

/** La session qui édite la première scène du projet `projet`, à l'outil de sélection, sur la couche 0 ; `duDepot` :
 *  le projet est celui que le dépôt porte, où il s'enregistre. */
export function ouvrirLEdition(projet: Omit<ProjectDoc, 'schema'>, duDepot: boolean): SessionDEdition {
  const scene = projet.scenes[0];
  return {
    projet, sceneId: scene.id, historique: historiqueDe(scene), outil: { mode: 'select' }, z: 0, pinceau: 1, rectangle: false, sel: null, geste: null, pointee: null,
    depot: duDepot ? { enregistree: scene, enCours: null } : null,
  };
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

/** Le texte que l'enregistrement de la session `s` écrit au dépôt : son projet, la scène éditée à jour, passé par la
 *  porte, en forme dépôt (`texteDuDepot`) ; ou le refus de la porte. */
export function texteAEnregistrer(s: SessionDEdition) {
  const { scenes, worldMap, activeAxes, narratif, ...identite } = s.projet;
  const doc = documentDeProjet(identite, scenes.map((sc) => (sc.id === s.sceneId ? sceneEditee(s) : sc)), { worldMap, activeAxes, narratif });
  return aLaPorte('export', () => (parseProject(doc), texteDuDepot(doc)));
}

/** Le contexte du pointeur de la session. */
function contexte(s: SessionDEdition): ContexteDuPointeur {
  return { tool: s.outil, z: s.z, brush: s.pinceau, encId: '', encRef: '', layers: TOUS_LES_CALQUES, sel: s.sel, terrainRect: s.rectangle, architecture: null };
}

/** L'effet d'un pas du pointeur porté à la session. */
function porter(s: SessionDEdition, effet: EffetDuPointeur): SessionDEdition {
  return {
    ...s,
    geste: effet.geste,
    ...(effet.scene ? { historique: poser(s.historique, effet.scene, effet.cran === true) } : {}),
    ...(effet.sel !== undefined ? { sel: effet.sel } : {}),
  };
}

/** La scène `scene` écrite sur un cran neuf, la sélection levée. */
const ecrire = (s: SessionDEdition, scene: Scene): SessionDEdition => ({ ...s, historique: poser(s.historique, scene, true), sel: null });

/** La session revenue à l'état `historique` d'annuler ou de rétablir : la couche éditée reste, sauf disparue avec lui,
 *  où le rez la remplace. */
function revenir(s: SessionDEdition, historique: Historique): SessionDEdition {
  const z = historique.present.layers.some((l) => l.z === s.z) ? s.z : 0;
  return { ...s, historique, z, sel: null, geste: null };
}

/** La session après le geste `g`. Un geste sans objet (retirer la couche 0, une couche absente, enregistrer hors du
 *  dépôt, l'issue d'un enregistrement qui n'est pas en cours) la rend telle quelle. */
export function editer(s: SessionDEdition, g: GesteDEdition): SessionDEdition {
  const scene = sceneEditee(s);
  switch (g.geste) {
    case 'outil':
      return { ...s, outil: g.outil, geste: null };
    case 'pinceau':
      return { ...s, pinceau: g.taille, rectangle: false };
    case 'rectangle':
      return { ...s, rectangle: g.actif };
    case 'couche':
      return scene.layers.some((l) => l.z === g.z) ? { ...s, z: g.z, sel: null, geste: null } : s;
    case 'ajouterCouche': {
      const z = etageSuivant(scene);
      return { ...ecrire(s, addLayer(scene, z)), z };
    }
    case 'retirerCouche':
      return s.z === 0 ? s : { ...ecrire(s, removeLayer(scene, s.z)), z: 0 };
    case 'appui':
      return { ...porter(s, appuyer(scene, contexte(s), g.point)), pointee: { ...g.point.case, z: s.z } };
    case 'glisse':
      return porter(s, glisser(scene, contexte(s), s.geste, g.point));
    case 'relache':
      return porter(s, relacher(scene, contexte(s), s.geste, g.point));
    case 'annuler':
      return revenir(s, annuler(s.historique));
    case 'retablir':
      return revenir(s, retablir(s.historique));
    case 'enregistrer':
      return s.depot ? { ...s, depot: { ...s.depot, enCours: scene } } : s;
    case 'enregistrement':
      return s.depot?.enCours ? { ...s, depot: { enregistree: g.reussi ? s.depot.enCours : s.depot.enregistree, enCours: null } } : s;
  }
}
