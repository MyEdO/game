/**
 * DÉCOUPE LOCALE PAR OCCLUSION (#1176) — LE VERDICT. Qui est caché, où tombe son trou à l'écran, et à
 * quelle cadence la question se repose. Le CANAL (attribut, chunks, uniformes) vit ailleurs
 * (`backends/webgl/percageLocal.ts`) ; ici, rien ne connaît le shader au-delà des quatre `Vector4`
 * qu'il lit.
 *
 * LE VERDICT NE SE RÉINVENTE PAS. « Cette masse cache-t-elle ce héros à l'écran ? » a déjà SA loi dans
 * ce dépôt : `occludesActor` (`geometry/iso.ts`), consommée par `lidCutaway`
 * (`stage/architectureVisibility.ts`) sur la géométrie projetée des nappes et les capsules d'acteurs.
 * La découpe locale pose EXACTEMENT la même question et prend la MÊME réponse — seule la RIPOSTE
 * change : `lidCutaway` lève la masse entière, `percage` n'ôte qu'un disque. Deux occlusions qui
 * divergeraient donneraient un trou là où rien n'est caché, ou une masse levée sans trou.
 *
 * CADENCE ÉVÉNEMENTIELLE, jamais un Hz : le verdict ne se rejoue qu'à la CLÉ (`clePercage`) — pas
 * franchi, cran/lacet de caméra, étage. Ce qui vit à la frame, c'est le seul rayon (`avancer`) : un
 * flottant par héros.
 */
import * as THREE from 'three';
import { occludesActor, type ActorCapsule } from '../../geometry/iso';
import type { Lid } from './architectureVisibility';
import {
  PERCAGE_FONDU_MS,
  PERCAGE_MAX_HEROS,
  PERCAGE_RAYON_PX,
  cadrePercage,
  trousPercage,
} from '../backends/webgl/percageLocal';

/** Un héros candidat au trou : sa capsule écran (`stage/actorCapsule.ts`), son niveau, et sa position
 *  MONDE dans la scène 3D — le centre du trou en descend par projection. */
export interface ActeurPerce {
  capsule: ActorCapsule;
  z: number;
  monde: THREE.Vector3;
}

/** Qui est CACHÉ, un booléen par acteur. La garde de niveau est celle de `lidCutaway` : une nappe
 *  SOUS les pieds du héros ne le cache pas, elle le porte. */
export function verdictPercage(lids: readonly Lid[], acteurs: readonly ActeurPerce[]): boolean[] {
  return acteurs.map((a) => lids.some((lid) => lid.z >= a.z && occludesActor(lid.occluder, a.capsule)));
}

/** CLÉ DISCRÈTE du verdict — la même discipline que le stage (`IsoStage`, `tilesKey`) : les tuiles des
 *  alliés (identité + case), le cran et le lacet de la caméra, l'étage actif. Tant qu'elle ne bouge
 *  pas, aucun pas n'a été franchi et rien n'a tourné : le verdict d'avant tient. */
export function clePercage(vue: {
  tuiles: readonly { id: string; x: number; y: number; z: number }[];
  rot: number;
  view: string;
  activeZ: number;
}): string {
  return `${vue.tuiles.map((t) => `${t.id}:${t.x},${t.y},${t.z}`).join('|')}#${vue.rot}/${vue.view}/${vue.activeZ}`;
}

/** CENTRE ÉCRAN d'un trou : la position monde du héros projetée par la caméra de jeu — `x`/`y` en
 *  pixels de viewport, `z` en profondeur écran `[0,1]`, la grandeur que le fragment compare. */
export function centrePercage(
  camera: THREE.Camera,
  monde: THREE.Vector3,
  largeurPx: number,
  hauteurPx: number,
): THREE.Vector3 {
  const ndc = monde.clone().project(camera);
  return new THREE.Vector3((ndc.x * 0.5 + 0.5) * largeurPx, (ndc.y * 0.5 + 0.5) * hauteurPx, ndc.z * 0.5 + 0.5);
}

/** Le rayon d'un trou vers sa cible, à vitesse CONSTANTE : le trou s'ouvre en grand en exactement
 *  `PERCAGE_FONDU_MS`, et se referme dans le même temps. Aucun ressort, aucune exponentielle — une
 *  ouverture qui traîne indéfiniment se lit comme un bug de rémanence. */
export function avancerRayon(actuel: number, cible: number, dtMs: number): number {
  const pas = (PERCAGE_RAYON_PX / PERCAGE_FONDU_MS) * Math.max(0, dtMs);
  if (cible > actuel) return Math.min(cible, actuel + pas);
  return Math.max(cible, actuel - pas);
}

/** LE PILOTE de la découpe : il tient la clé du dernier verdict, les cibles de rayon et les centres, et
 *  écrit les quatre trous partagés. Un pilote par écran ; l'appelant le crée avec sa scène. */
export interface Percage {
  /** Repose le verdict SI la clé a bougé. Rend `true` quand il a réellement été rejoué. */
  majVerdict(entree: {
    cle: string;
    lids: readonly Lid[];
    acteurs: readonly ActeurPerce[];
    camera: THREE.Camera;
    largeurPx: number;
    hauteurPx: number;
  }): boolean;
  /** Fait vivre le fondu, et pousse l'état aux uniformes. À appeler à la frame. */
  avancer(dtMs: number): void;
  /** Rayons courants (px) — ce que le shader lit, en lecture pour les bancs. */
  rayons(): number[];
  /** Nombre de verdicts RÉELLEMENT rejoués depuis la création : la mesure de la cadence. */
  verdictsJoues(): number;
  /** La pompe demande-t-elle des frames en ce moment ? En lecture pour les bancs. */
  pompeEnVol(): boolean;
  /** Coupe la pompe : l'écran se démonte. */
  arreter(): void;
}

/**
 * LA POMPE DE FRAMES. Le fondu suppose une horloge, et l'hôte volumique n'en a pas : son rendu est
 * ÉVÉNEMENTIEL (il ne dessine qu'aux invalidations — rendu React, battement de marche, averse,
 * flamme). Scène immobile, personne ne marche : le verdict s'ouvre, puis plus une seule frame ne
 * vient, et le rayon reste où le dernier dessin l'a laissé (mesuré : 0,672 px, figé).
 *
 * Le pilote est le SEUL à savoir qu'il n'est pas convergé — c'est donc lui qui redemande la frame,
 * par la fonction de dessin que l'hôte lui donne. UNE boucle, jamais deux : même patron que le lacet
 * continu (`state/stageYaw.ts`), armée tant qu'un rayon court après sa cible et éteinte à l'instant
 * où tous l'ont rejointe. Sans fonction de dessin (bancs du verdict, hors navigateur), rien ne bat.
 */
export function creerPercage(dessiner?: () => void): Percage {
  let cle: string | null = null;
  let verdicts = 0;
  let enVol = false;
  const cibles = new Array<number>(PERCAGE_MAX_HEROS).fill(0);
  const rayons = new Array<number>(PERCAGE_MAX_HEROS).fill(0);
  const centres = Array.from({ length: PERCAGE_MAX_HEROS }, () => new THREE.Vector3());
  const converge = (): boolean => rayons.every((r, i) => r === cibles[i]);
  const battre = (): void => {
    if (!enVol) return;
    dessiner!();
    if (!enVol) return; // le dessin a fait avancer le fondu jusqu'à sa cible : la pompe s'éteint ici
    requestAnimationFrame(battre);
  };
  const armer = (): void => {
    if (enVol || !dessiner || typeof requestAnimationFrame !== 'function') return;
    enVol = true;
    requestAnimationFrame(battre);
  };
  return {
    majVerdict({ cle: nouvelle, lids, acteurs, camera, largeurPx, hauteurPx }) {
      if (nouvelle === cle) return false;
      cle = nouvelle;
      verdicts++;
      cadrePercage(camera, largeurPx, hauteurPx);
      const occlus = verdictPercage(lids, acteurs);
      for (let i = 0; i < PERCAGE_MAX_HEROS; i++) {
        const acteur = i < acteurs.length ? acteurs[i] : null;
        cibles[i] = acteur && occlus[i] ? PERCAGE_RAYON_PX : 0;
        if (acteur) centres[i].copy(centrePercage(camera, acteur.monde, largeurPx, hauteurPx));
      }
      if (!converge()) armer();
      return true;
    },
    avancer(dtMs) {
      const trous = trousPercage();
      for (let i = 0; i < PERCAGE_MAX_HEROS; i++) {
        rayons[i] = avancerRayon(rayons[i], cibles[i], dtMs);
        trous[i].set(centres[i].x, centres[i].y, centres[i].z, rayons[i]);
      }
      if (converge()) enVol = false;
      else armer();
    },
    rayons: () => [...rayons],
    verdictsJoues: () => verdicts,
    pompeEnVol: () => enVol,
    arreter() { enVol = false; },
  };
}
