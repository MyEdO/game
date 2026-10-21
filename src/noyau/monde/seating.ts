/**
 * ASSISE — source UNIQUE de la résolution et de la mutation des places assises d'une Scène.
 *
 * Le catalogue de décor (`props.json`) déclare les places d'un TYPE de meuble dans son repère local
 * (`PropSeatSlot`) ; une Scène déclare QUI les occupe (`Scene.seatAssignments`). Ce module fait le
 * pont, et lui seul : la persistance, l'interaction, le rig, l'éditeur et `MapSpec` le CONSOMMENT.
 * PUR — aucune écriture de store, aucun rendu, aucune caméra, aucune dépendance `gameIso`.
 *
 * FORME PERSISTÉE : `propId → slotId → occupant`. Deux niveaux imbriqués (et non une clé composée)
 * pour que « les places de CE meuble » et « ce meuble n'a plus personne » soient des lectures et des
 * suppressions directes.
 *
 * EXCLUSIVITÉ double : un occupant tient au plus UNE place, une place porte au plus UN occupant.
 *
 * APPROCHE — la case d'abord déclarée par le catalogue est un chemin PRÉFÉRÉ, pas une condition
 * d'occupation : une chaise poussée contre un mur ou un comptoir reste une chaise où l'on s'assoit.
 * `seatSlotsOf` rend donc l'approche EFFECTIVE (deux passes décrites à la fonction) : la case
 * déclarée si elle est ATTEIGNABLE DEPUIS LE SIÈGE, sinon un repli voisin du siège, jamais partagé
 * avec l'abord d'une AUTRE place de la SCÈNE. RÈGLE : deux places simultanément occupables n'ont
 * jamais le même abord — la portée en est la SCÈNE, pas le meuble (un repli qui volait l'abord
 * déclaré d'un meuble voisin posait deux corps sur la même case).
 *
 * ATTEIGNABLE, pas seulement marchable : l'abord d'une place est une case d'où l'on s'assoit, donc
 * une case voisine du SIÈGE qu'aucune CLOISON n'en sépare (`abordsDuSiege` — `isWalkable` pour le
 * terrain, l'empreinte des décors solides et les cases effondrées ; `wallBetween` pour les arêtes
 * murées et les portes). Un abord marchable derrière un mur est dans une AUTRE pièce : personne n'y
 * prendra jamais ce siège. Une place dont AUCUNE case voisine du siège n'est atteignable est la
 * seule qui reste inoccupable (`approche-invalide`).
 *
 * DISPONIBILITÉ — un corps mis hors d'action ne tient pas sa chaise : `releaseUnavailableSeats` lève
 * les occupants que l'appelant déclare indisponibles (lui seul connaît le groupe et le combat).
 *
 * POSITION LOGIQUE — le corps assis se TIENT sur sa case d'abord (c'est de là qu'il s'est assis et
 * c'est là qu'il se relève) ; seul le RENDU applique l'ancre fractionnaire. Pour un PNJ authored,
 * `SceneEntity.pos === approche résolue` est un invariant du document, gardé par `validateScene`.
 */
import { findPropById } from '../../data';
import { caseDe, cransDepuisCapIdentite, placesLocalesDuProp } from '../../data/props.types';
import { DIR8_DELTA, DIR8_ORDER, rotateDir8, type Dir8 } from '../../geometry/dir8';
import { PARTY_MAX } from './combatants';
import { heightAt, isWalkable, sceneMetresPerTile, wallBetween, type Scene, type SceneEntity } from './scene';
import { memoByRef } from './sceneMemo';
import type { Pt } from './path';

/**
 * Qui occupe une place : un EMPLACEMENT du groupe, ou un PNJ de la scène (authoré).
 *
 * Côté groupe, l'occupant est un RANG (1..`PARTY_MAX`), jamais un id de héros : le document
 * d'une scène ne peut pas nommer un personnage que le joueur créera plus tard. « Héros 1 » désigne
 * l'emplacement ; le runtime y résout `party[rang - 1]`, et un rang qu'aucun héros n'occupe est
 * simplement élagué au chargement — jamais une erreur de document.
 */
export type SeatOccupant =
  | { kind: 'party'; rang: number }
  | { kind: 'entity'; entityId: string };

/** Emplacement du MENEUR corporel — le seul héros qui ait un corps en exploration aujourd'hui. */
export const RANG_MENEUR = 1;

/** Libellé d'AFFICHAGE d'un emplacement du groupe — un seul, partagé par le champ d'authoring et
 *  par les messages du validateur : l'auteur lit le même mot des deux côtés. */
export const labelEmplacement = (rang: number): string => `Héros ${rang}`;

/** Occupation persistée d'une Scène : `propId → slotId → occupant`. */
export type SeatAssignments = Record<string, Record<string, SeatOccupant>>;

/**
 * Place assise d'un meuble POSÉ : ancre monde du corps, cap du corps assis, case d'abord EFFECTIVE.
 *
 * DEUX HAUTEURS, deux lecteurs. `ground` est le SOL de la case du meuble : c'est là que le corps
 * s'ancre au rendu (un corps assis pose ses pieds par terre, pas sur son siège). `anchor.h` est la
 * hauteur d'ASSISE en monde (sol + assise du catalogue) : elle est la donnée de POSTURE (le bassin
 * s'y descend) et d'ŒIL POV. Confondre les deux hissait le corps entier au-dessus du sol.
 */
export interface ResolvedSeatSlot {
  propId: string;
  slotId: string;
  anchor: { x: number; y: number; h: number };
  /** Sol de la case du meuble (monde) — l'ancre de RENDU du corps. */
  ground: number;
  facing: Dir8;
  approach: Pt;
}

/** Hauteur d'ASSISE au-dessus du sol (m) d'une place résolue — ce que la POSTURE consomme. */
export const seatSitHeight = (s: Pick<ResolvedSeatSlot, 'anchor' | 'ground'>): number => s.anchor.h - s.ground;

/** Une place résolue et son occupant. */
export interface SeatPose extends ResolvedSeatSlot { occupant: SeatOccupant }

export type SeatAssignmentResult =
  | { ok: true; scene: Scene; pose: SeatPose }
  | { ok: false; scene: Scene; reason: 'prop-absent' | 'slot-absent' | 'occupant-absent' | 'occupant-assis' | 'slot-occupe' | 'approche-invalide' };

/** Deux occupants désignent-ils le même corps ? */
function sameOccupant(a: SeatOccupant, b: SeatOccupant): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind === 'party' ? a.rang === (b as { rang: number }).rang : a.entityId === (b as { entityId: string }).entityId;
}

/** Le meuble POSÉ (entité `prop` de la scène) qui porte les places de `propId`. */
const propEntity = (scene: Scene, propId: string): SceneEntity | undefined =>
  scene.entities.find((e) => e.id === propId && e.kind === 'prop');

/** Deux points désignent-ils la MÊME case (étage compris) ? Définition UNIQUE, partagée par
 *  l'interaction d'assise (store) et le clic de meuble (`stage/useStagePointer`). */
export const memeCase = (a: Pt, b: Pt): boolean => a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);

/** Clé de case (étage compris), pour la réservation des abords à l'échelle de la SCÈNE. */
const cleCase = (p: { x: number; y: number }, z: number) => `${p.x},${p.y},${z}`;

/** Une place AVANT arbitrage de son abord : tout ce que la géométrie donne, moins l'approche. */
interface PlacePartielle {
  propId: string;
  slotId: string;
  anchor: { x: number; y: number; h: number };
  /** Sol de la case du meuble (monde). */
  ground: number;
  facing: Dir8;
  z: number;
  /** Abord DÉCLARÉ par le catalogue, tourné au cap de l'instance. */
  declaree: { x: number; y: number };
  /** Case qui porte le SIÈGE — l'origine des candidats de repli. */
  siege: { x: number; y: number };
}

/** Les places de TOUS les meubles posés, avant arbitrage : ordre des entités de la scène, puis ordre
 *  du catalogue — c'est cet ordre qui rend l'arbitrage ci-dessous déterministe. */
function placesPartielles(scene: Scene): PlacePartielle[] {
  const out: PlacePartielle[] = [];
  // L'ÉCHELLE de la scène, passée à la règle des places : l'ancre d'une place est MÉTRIQUE au
  // catalogue, le plan de la scène est en CASES — la division vit avec la règle
  // (`data/props.types.ts`, site déclaré par `state/echelle-de-scene.test.ts`).
  const mpt = sceneMetresPerTile(scene);
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const prop = findPropById(ent.ref);
    const facing = ent.facing ?? 'S';
    const crans = cransDepuisCapIdentite(facing);
    const z = ent.z ?? 0;
    // ALTITUDE : le PIED du décor, à sa case `ent.pos` — la même que `gameIso/builders/props.ts`
    // pose sous la recette (`solM`). C'est ce qui colle l'assise au tabouret DESSINÉ : la lire à la
    // case du siège l'en décollerait dès qu'une marche traverse l'empreinte. Le PLAN, lui, part de
    // l'ancre du décor — les deux ne répondent pas à la même question.
    const sol = heightAt(scene, ent.pos.x, ent.pos.y, z);
    // PLAN : ancre, siège et abord viennent de la règle UNIQUE `placesLocalesDuProp`
    // (`data/props.types.ts`), en offsets depuis `ent.pos`, et le validateur de catalogue lit la
    // MÊME. Elle part de l'ancre du DÉCOR (`decorAncre`/`offsetAncre`), celle de la géométrie et du
    // foyer d'une lampe, jamais du coin NO : au-delà d'un meuble 1×1, une place ancrée sur le coin
    // se décale d'une demi-case par axe étendu et le corps assis quitte sa chaise dessinée.
    for (const place of placesLocalesDuProp(prop, facing, mpt)) {
      out.push({
        propId: ent.id,
        slotId: place.slot.id,
        anchor: { x: ent.pos.x + place.ancre.x, y: ent.pos.y + place.ancre.y, h: sol + place.slot.anchor.hM },
        ground: sol,
        facing: rotateDir8(place.slot.facing, crans),
        z,
        declaree: { x: ent.pos.x + place.abord.x, y: ent.pos.y + place.abord.y },
        siege: { x: ent.pos.x + place.siege.x, y: ent.pos.y + place.siege.y },
      });
    }
  }
  return out;
}

/**
 * Une CLOISON sépare-t-elle la case du siège de sa candidate d'abord ? Lecture d'arête déléguée à
 * `wallBetween` (`noyau/monde/scene`, SOURCE UNIQUE : mur plein, porte selon son état, structure tant
 * qu'elle tient) — aucune règle de mur n'est relue ici. En DIAGONALE, où il n'existe pas d'arête
 * canonique, la même lecture s'applique aux DEUX chemins en L, comme le pas du joueur l'exige
 * (`path.neighborsOf`) : la cloison passe entre les deux cases dès que l'un des L est muré.
 */
function cloisonEntre(scene: Scene, a: { x: number; y: number }, b: { x: number; y: number }, z: number): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 || dy === 0) return wallBetween(scene, a.x, a.y, b.x, b.y, z);
  return wallBetween(scene, a.x, a.y, a.x + dx, a.y, z) || wallBetween(scene, a.x + dx, a.y, b.x, b.y, z)
    || wallBetween(scene, a.x, a.y, a.x, a.y + dy, z) || wallBetween(scene, a.x, a.y + dy, b.x, b.y, z);
}

/**
 * PRÉDICAT UNIQUE D'ATTEIGNABILITÉ — les cases d'où l'on peut s'asseoir sur le siège porté par la
 * case `siege`, à l'étage `z` : les huit voisines (plus la case du siège elle-même quand elle est
 * marchable — banc à même le sol) qui soient MARCHABLES et qu'aucune CLOISON ne sépare du siège.
 *
 * La règle de MUR est celle du pas, au segment près (`cloisonEntre` : les deux chemins en L en
 * diagonale, comme `path.neighborsOf`) — jamais plus permissive que lui. Ce qui tombe ici est sa
 * garde de FLANC (`path.neighborsOf` exige en plus que les deux cases latérales soient MARCHABLES,
 * pour qu'un corps ne se glisse pas entre deux obstacles) : l'abord n'est pas un PAS, le corps ne
 * traverse jamais le siège, il se tient à côté et s'assoit — une chaise poussée dans l'angle d'un
 * comptoir reste une chaise où l'on s'assoit. Ce qui sépare vraiment, et que ce prédicat refuse,
 * c'est la CLOISON : un abord marchable de l'autre côté d'un mur est dans une autre pièce.
 *
 * L'usage est un ENSEMBLE de clés de case : les deux passes de `placesResolues` et
 * `seatIsOccupiable` y testent une appartenance.
 */
function abordsDuSiege(scene: Scene, siege: { x: number; y: number }, z: number): Set<string> {
  const out = new Set<string>();
  if (isWalkable(scene, siege.x, siege.y, z)) out.add(cleCase(siege, z));
  for (const dir of DIR8_ORDER) {
    const { gx, gy } = DIR8_DELTA[dir];
    const candidate = { x: siege.x + gx, y: siege.y + gy };
    if (isWalkable(scene, candidate.x, candidate.y, z) && !cloisonEntre(scene, siege, candidate, z))
      out.add(cleCase(candidate, z));
  }
  return out;
}

/**
 * Toutes les places de la SCÈNE, abord EFFECTIF arbitré, indexées par meuble.
 *
 * ARBITRAGE en DEUX PASSES sur la population ENTIÈRE — la portée est la scène, pas le meuble : les
 * abords se réservent entre meubles voisins comme entre places d'une même table.
 *  1. les abords DÉCLARÉS ATTEIGNABLES depuis leur siège sont retenus et RÉSERVÉS, premier arrivé
 *     premier servi ;
 *  2. les autres se replient sur la première case voisine du SIÈGE (ordre `DIR8_ORDER` :
 *     N, NE, E, SE, S, SO, O, NO) qui soit ATTEIGNABLE depuis lui ET non encore réservée.
 * Aucune candidate → l'abord déclaré est rendu tel quel, et `assignSeat` refuse `approche-invalide`.
 */
function placesResolues(scene: Scene): Map<string, ResolvedSeatSlot[]> {
  const partiels = placesPartielles(scene);
  const joignables = partiels.map((p) => abordsDuSiege(scene, p.siege, p.z));
  const reservees = new Set<string>();
  const declareeGagnee = new Set<number>();
  partiels.forEach((p, i) => {
    const cle = cleCase(p.declaree, p.z);
    if (!joignables[i].has(cle) || reservees.has(cle)) return;
    reservees.add(cle);
    declareeGagnee.add(i);
  });
  const out = new Map<string, ResolvedSeatSlot[]>();
  partiels.forEach(({ propId, slotId, anchor, ground, facing, z, declaree, siege }, i) => {
    const enCase = (p: { x: number; y: number }): Pt => (z ? { x: p.x, y: p.y, z } : { x: p.x, y: p.y });
    let approach = enCase(declaree);
    if (!declareeGagnee.has(i)) {
      for (const dir of DIR8_ORDER) {
        const { gx, gy } = DIR8_DELTA[dir];
        const voisine = { x: siege.x + gx, y: siege.y + gy };
        const cle = cleCase(voisine, z);
        if (!joignables[i].has(cle) || reservees.has(cle)) continue;
        reservees.add(cle);
        approach = enCase(voisine);
        break;
      }
    }
    const liste = out.get(propId) ?? [];
    liste.push({ propId, slotId, anchor, ground, facing, approach });
    out.set(propId, liste);
  });
  return out;
}

/** Arbitrage de la scène, MÉMOÏSÉ par référence (patron canonique `noyau/monde/sceneMemo`) : il porte sur la
 *  scène ENTIÈRE, et `interactHalos`/`placesOccupees` l'interrogent meuble par meuble — sans mémo, une
 *  frame de halos re-résolvait toute la salle une fois par décor. Aucune invalidation manuelle : toute
 *  mutation de scène rend une référence neuve. */
const placesResoluesMemo = memoByRef(placesResolues);

/**
 * Les places du meuble `propId`, résolues dans le monde : ancre tournée au cap de l'instance
 * (`facing ?? 'S'`, le défaut canonique de la scène), cap du corps assis tourné du même nombre de
 * crans, case d'abord EFFECTIVE (arbitrée à l'échelle de la SCÈNE, cf. `placesResolues`). ORDRE DU
 * CATALOGUE conservé. `[]` si le meuble ou son type est absent, ou si le type n'offre aucune place.
 */
export function seatSlotsOf(scene: Scene, propId: string): ResolvedSeatSlot[] {
  return placesResoluesMemo(scene).get(propId) ?? [];
}

/**
 * Les places JOUABLES du meuble `propId` — la MÊME géométrie que `seatSlotsOf`, GATÉE par
 * l'ACTIVATION de l'instance (`SceneEntity.usable`, #1687). SOURCE UNIQUE des lecteurs
 * d'INTERACTION : halo de place libre (`gameIso/builders/interactHalos`), clic de meuble
 * (`gameIso/stage/useStagePointer`), assise au clic (`store.interactEntity`).
 *
 * La GÉOMÉTRIE ne dépend d'aucune activation : `seatSlotsOf` reste inchangé et sert l'éditeur, le
 * placement d'un PNJ authoré assis, la validation de document et le rig — un tabouret non activé
 * porte toujours ses places, et un PNJ authoré peut y être assis.
 *
 * L'assise est la SEULE capacité qui vive sur le TYPE (`PropData.seatSlots`), donc la seule qu'un
 * opt-in d'instance ait à ouvrir (verbatim utilisateur 2026-09-09 : « on doit pouvoir s'assoire sur
 * une chaise si dans l'éditeur on l'active »).
 */
export function placesJouables(scene: Scene, propId: string): ResolvedSeatSlot[] {
  return propEntity(scene, propId)?.usable?.assise ? seatSlotsOf(scene, propId) : [];
}

/** Parcours DÉTERMINISTE de l'occupation : entités de la scène dans leur ordre, puis places du
 *  catalogue dans leur ordre. Base commune de `seatPoseOf` et de `pruneSeatAssignments`. */
function* placesOccupees(scene: Scene): Generator<{ slot: ResolvedSeatSlot; occupant: SeatOccupant }> {
  const assignments = scene.seatAssignments;
  if (!assignments) return;
  for (const ent of scene.entities) {
    const parMeuble = ent.kind === 'prop' ? assignments[ent.id] : undefined;
    if (!parMeuble) continue;
    for (const slot of seatSlotsOf(scene, ent.id)) {
      const occupant = parMeuble[slot.slotId];
      if (occupant) yield { slot, occupant };
    }
  }
}

/** La place que tient cet occupant, résolue dans le monde — `null` s'il est debout. */
export function seatPoseOf(scene: Scene, occupant: SeatOccupant): SeatPose | null {
  for (const { slot, occupant: assis } of placesOccupees(scene)) {
    if (sameOccupant(assis, occupant)) return { ...slot, occupant: assis };
  }
  return null;
}

/**
 * PRÉDICAT UNIQUE D'OCCUPABILITÉ — « ce siège se tient-il ? ». Une place n'est occupable que si son
 * abord EFFECTIF est ATTEIGNABLE DEPUIS SON SIÈGE (`abordsDuSiege`) : un abord marchable mais séparé
 * du siège par une arête murée est une place où personne ne s'assied jamais. Quand `placesResolues` n'a trouvé AUCUNE candidate (siège cerné), elle rend
 * l'abord déclaré tel quel — c'est ici, et ici seulement, que ce cas se traduit en refus.
 *
 * `assignSeat` (le GESTE), `seatAssignmentDefects` (le DOCUMENT) et `normaliseAssises`
 * (les mutations d'éditeur) l'appellent tous les trois : ce qu'un geste refuse, le validateur et le
 * compilateur le refusent aussi, et la règle N+1 s'écrit ICI, une fois.
 */
export function seatIsOccupiable(scene: Scene, slot: ResolvedSeatSlot): boolean {
  const z = propEntity(scene, slot.propId)?.z ?? 0;
  const siege = caseDe(slot.anchor.x, slot.anchor.y);
  return abordsDuSiege(scene, siege, z).has(cleCase(slot.approach, z));
}

/** L'emplacement de groupe est-il un rang DÉCLARABLE ? Borne d'AUTHORING : elle ne dit pas qu'un
 *  héros y est assis aujourd'hui, elle dit que « Héros N » existe comme emplacement. */
export const rangDeGroupeValide = (rang: number): boolean =>
  Number.isInteger(rang) && rang >= 1 && rang <= PARTY_MAX;

/** L'occupant désigne-t-il un corps RÉELLEMENT présent ? `partySize` = taille du groupe COURANT
 *  (0 hors partie, à l'éditeur) : un emplacement au-delà ne tient personne. */
function occupantExiste(scene: Scene, occupant: SeatOccupant, partySize: number): boolean {
  return occupant.kind === 'party'
    ? rangDeGroupeValide(occupant.rang) && occupant.rang <= partySize
    : scene.entities.some((e) => e.id === occupant.entityId && e.kind === 'personnage');
}

/**
 * Assoit `occupant` à la place `slotId` du meuble `propId`. Revalide TOUT au moment de l'écriture
 * (meuble, place, corps, exclusivités, approche) et rend une raison stable en cas de refus — la
 * scène retournée est alors l'entrée, inchangée.
 */
export function assignSeat(
  scene: Scene,
  propId: string,
  slotId: string,
  occupant: SeatOccupant,
  partySize: number,
): SeatAssignmentResult {
  if (!propEntity(scene, propId)) return { ok: false, scene, reason: 'prop-absent' };
  const slot = seatSlotsOf(scene, propId).find((s) => s.slotId === slotId);
  if (!slot) return { ok: false, scene, reason: 'slot-absent' };
  if (!occupantExiste(scene, occupant, partySize)) return { ok: false, scene, reason: 'occupant-absent' };
  if (seatPoseOf(scene, occupant)) return { ok: false, scene, reason: 'occupant-assis' };
  if (scene.seatAssignments?.[propId]?.[slotId]) return { ok: false, scene, reason: 'slot-occupe' };
  if (!seatIsOccupiable(scene, slot)) return { ok: false, scene, reason: 'approche-invalide' };
  const seatAssignments: SeatAssignments = { ...scene.seatAssignments };
  seatAssignments[propId] = { ...seatAssignments[propId], [slotId]: occupant };
  return { ok: true, scene: { ...scene, seatAssignments }, pose: { ...slot, occupant } };
}

/** Lève `occupant` de sa place — les meubles qui se vident perdent leur objet. Scène INCHANGÉE
 *  (même référence) s'il était déjà debout. */
export function releaseSeat(scene: Scene, occupant: SeatOccupant): Scene {
  const assignments = scene.seatAssignments;
  if (!assignments) return scene;
  let touche = false;
  const seatAssignments: SeatAssignments = {};
  for (const [propId, parMeuble] of Object.entries(assignments)) {
    const restant: Record<string, SeatOccupant> = {};
    for (const [slotId, assis] of Object.entries(parMeuble)) {
      if (sameOccupant(assis, occupant)) { touche = true; continue; }
      restant[slotId] = assis;
    }
    if (Object.keys(restant).length) seatAssignments[propId] = restant;
  }
  return touche ? { ...scene, seatAssignments } : scene;
}

/**
 * Lève de leur place les corps que l'appelant déclare INDISPONIBLES — un mort, un Inconscient, un
 * corps mis hors d'action ne tient pas sa chaise. PURE : l'oracle `disponible` vient de l'appelant,
 * seul à connaître le groupe et le combat en cours (ce module ne lit que la Scène).
 * Rend la scène d'entrée, MÊME RÉFÉRENCE, si tout le monde tient encore sa place.
 */
export function releaseUnavailableSeats(scene: Scene, disponible: (occupant: SeatOccupant) => boolean): Scene {
  const assignments = scene.seatAssignments;
  if (!assignments) return scene;
  let scèneCourante = scene;
  for (const parMeuble of Object.values(assignments))
    for (const occupant of Object.values(parMeuble))
      if (!disponible(occupant)) scèneCourante = releaseSeat(scèneCourante, occupant);
  return scèneCourante;
}

/**
 * OCCUPATION AU RUNTIME — la chaise appartient au CORPS qui l'occupe. Compare, pour chaque
 * emplacement ASSIS, le corps présent AVANT et APRÈS une recomposition du groupe (permutation,
 * retrait avec glissement des rangs suivants, remplacement, écriture en bloc) : l'emplacement dont
 * le corps a changé d'id, ou dont le corps a disparu, est LEVÉ. Une chaise ne change jamais de
 * propriétaire en silence, et un emplacement dont le corps n'a pas bougé garde la sienne.
 *
 * Un emplacement que PERSONNE n'occupait encore (`avant[rang - 1]` absent) est une RÉSERVATION
 * d'authoring : le héros qui arrive à ce rang la prend, sans quoi « commencer la scène avec des PJs
 * déjà assis » n'aurait aucun sens. Les rangs que le groupe n'atteint pas sont, eux, élagués au
 * chargement (`pruneSeatAssignments`).
 *
 * PURE. Rend la scène d'entrée, MÊME RÉFÉRENCE, si aucun emplacement n'a changé de corps.
 */
export function releaseRecomposedRanks(
  scene: Scene,
  avant: readonly { id: string }[],
  apres: readonly { id: string }[],
): Scene {
  if (!scene.seatAssignments) return scene;
  return releaseUnavailableSeats(scene, (occupant) => {
    if (occupant.kind !== 'party') return true;
    const corpsAvant = avant[occupant.rang - 1]?.id;
    return corpsAvant === undefined || corpsAvant === apres[occupant.rang - 1]?.id;
  });
}

/** Un défaut d'assise du DOCUMENT : le message français à afficher, et l'entité à blâmer (pour que
 *  l'éditeur y emmène au clic). */
export interface SeatAssignmentDefect { at: string; message: string }

/**
 * VALIDATEUR STRICT COMMUN de `Scene.seatAssignments` — source unique des règles du document,
 * partagée par `validateScene` (qui en fait des avertissements cliquables) et par le compilateur
 * d'authoring `mapSpec.buildScene` (qui échoue fail-fast dessus).
 *
 * Chaque place occupée doit désigner un meuble POSÉ, une place que son type déclare, et un corps
 * présent ; la place doit être OCCUPABLE au sens du prédicat unique `seatIsOccupiable` (le même que
 * le geste applique) ; et la `pos` d'un PNJ assis est EXACTEMENT la case d'abord résolue de sa place
 * (sa position LOGIQUE : c'est de là qu'il s'est assis et là qu'il se relève ; l'ancre fractionnaire
 * n'est que du rendu). Le groupe n'appartient pas au document : une place `kind:'party'` ne se
 * vérifie que jusqu'au meuble, au slot et à l'occupabilité.
 */
export function seatAssignmentDefects(scene: Scene): SeatAssignmentDefect[] {
  const out: SeatAssignmentDefect[] = [];
  for (const [propId, parMeuble] of Object.entries(scene.seatAssignments ?? {})) {
    const places = seatSlotsOf(scene, propId);
    const propPose = !!propEntity(scene, propId);
    for (const [slotId, occupant] of Object.entries(parMeuble)) {
      const occupantId = occupant.kind === 'party' ? labelEmplacement(occupant.rang) : occupant.entityId;
      if (!propPose) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : aucun décor « ${propId} » dans la scène` }); continue; }
      const place = places.find((p) => p.slotId === slotId);
      if (!place) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : le décor « ${propId} » n'offre pas de place « ${slotId} »` }); continue; }
      if (!seatIsOccupiable(scene, place)) {
        const { x: rx, y: ry } = place.approach;
        out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : aucun abord praticable ne dessert cette place (abord résolu en (${rx},${ry}), infranchissable)` });
        continue;
      }
      if (occupant.kind === 'party') {
        // Le GROUPE n'appartient pas au document : seul le RANG se vérifie. Un emplacement que
        // personne n'occupe encore n'est pas un défaut — il s'élague au chargement.
        if (!rangDeGroupeValide(occupant.rang))
          out.push({ at: propId, message: `Assise « ${propId}/${slotId} » : l'emplacement « ${labelEmplacement(occupant.rang)} » est hors du groupe (« ${labelEmplacement(1)} » à « ${labelEmplacement(PARTY_MAX)} »)` });
        continue;
      }
      const pnj = scene.entities.find((e) => e.id === occupant.entityId && e.kind === 'personnage');
      if (!pnj) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » : aucun personnage « ${occupantId} » dans la scène` }); continue; }
      const { x: ax, y: ay } = place.approach;
      if (pnj.pos.x !== ax || pnj.pos.y !== ay)
        out.push({ at: occupant.entityId, message: `Assise « ${propId}/${slotId} » : « ${occupantId} » est posé en (${pnj.pos.x},${pnj.pos.y}) alors que l’abord de sa place est en (${ax},${ay})` });
    }
  }
  return out;
}

/**
 * Occupation NORMALISÉE de la scène : ne survivent que les places dont le meuble est posé, dont la
 * place est déclarée par le catalogue et dont le corps est disponible (emplacement tenu par un
 * héros PRÉSENT à ce rang dans le groupe fourni). Parcours déterministe (entités, puis places déclarées) ; un occupant apparu
 * deux fois garde son PREMIER siège. Rend toujours une valeur — `{}` = plus personne d'assis.
 */
export function pruneSeatAssignments(scene: Scene, partySize: number): SeatAssignments {
  const out: SeatAssignments = {};
  const vus: SeatOccupant[] = [];
  for (const { slot, occupant } of placesOccupees(scene)) {
    if (!occupantExiste(scene, occupant, partySize)) continue;
    if (vus.some((v) => sameOccupant(v, occupant))) continue;
    vus.push(occupant);
    (out[slot.propId] ??= {})[slot.slotId] = occupant;
  }
  return out;
}
