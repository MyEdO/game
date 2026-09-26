/**
 * Builder UNIQUE d'un OBJET INANIMÉ comme `Combatant` — module FEUILLE (n'importe QUE `types` + `items`,
 * zéro `ops`/`combat`/`structures`/`vehicle` → aucun cycle). Source de vérité du squelette npc inerte,
 * partagée par les trois saveurs d'objet inanimé (le modèle « OBJET INANIMÉ généralisé ») :
 *  - **structure** de siège (ADE II 8, porte/mur) — DESTRUCTIBLE : profil à PV {E,B} ;
 *  - **véhicule**-coque (navire/chariot/barge, MDG 12-13) — DESTRUCTIBLE : profil à PV {E,B} ;
 *  - **engin de siège** (affût servi, AA 10 l.136-195) — INERTE NON-DESTRUCTIBLE : aucun profil à PV. Le RAW
 *    ne donne aucune Endurance/Blessures à un engin (c'est une « Arme d'équipe ») → on le neutralise en
 *    tuant son équipage, pas en le détruisant. `hull` ABSENT ⇒ Blessures {0,0,0} (immune via `woundsFromHit`).
 *
 * `structureCombatant` (`engine/structures.ts`) et `vehicleCombatant` (`engine/vehicle.ts`) sont de
 * minces adaptateurs vers ce builder : donnée → `InanimateSpec` → ici.
 */
import type { Combatant, Characteristics, BodyShape } from './types';
import type { TraitList } from './statEntry';
import { emptyArmour } from './items';

const ZERO_CHARS: Characteristics = { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 };

/** Profil à PV d'un objet DESTRUCTIBLE (structure/véhicule). `e` = Endurance PLEINE (la structure passe
 *  `BE × 10` — sa table ADE II donne le Bonus ; le véhicule passe `hull.char.E`). Absent ⇒ objet inerte
 *  non-destructible (engin de siège, RAW-pur). */
export interface HullProfile {
  e: number;
  woundsB: number;
}

export interface InanimateSpec {
  id: string;
  label: string;
  /** Clé de catalogue (id structure/véhicule) → posée sur `creatureId` (lue par `structureKind`, etc.). */
  refId: string;
  bodyShape: BodyShape;
  /** PRÉSENT ⇒ destructible (encaisse les Dégâts) ; ABSENT ⇒ engin inerte (Blessures 0, immune). */
  hull?: HullProfile;
  /** Atouts d'objet (Résistant/Impénétrable d'une structure) — réfs par id. Omis pour un véhicule/engin. */
  traits?: TraitList;
  /** Empreinte de grille (navire). Posé seulement si fourni (la clé reste absente pour structure/engin). */
  footprint?: number;
  /** Pièce SERVIE explicitement inerte (affût d'artillerie) : pas de tour propre, pas de PV. */
  inert?: boolean;
}

/** Construit le `Combatant` transitoire d'un objet inanimé : `kind:'npc'`, caractéristiques nulles sauf
 *  l'Endurance de coque, Blessures = pool de coque (0 si inerte), inerte (`psychImmune`, `movement:0`, pas
 *  d'arme). C'est la SOURCE UNIQUE du squelette — `structureCombatant`/`vehicleCombatant` le paramètrent. */
export function inanimateCombatant(s: InanimateSpec): Combatant {
  const max = s.hull?.woundsB ?? 0;
  const c: Combatant = {
    id: s.id,
    label: s.label,
    kind: 'npc',
    creatureId: s.refId,
    characteristics: { ...ZERO_CHARS, endurance: s.hull?.e ?? 0 },
    wounds: { current: max, max, base: max },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: emptyArmour(),
    skills: [],
    talents: [],
    bodyShape: s.bodyShape,
    psychImmune: true, // un objet inerte ignore la Psychologie
    movement: 0,
  };
  if (s.traits) c.traits = s.traits;
  if (s.footprint != null) c.footprint = s.footprint;
  if (s.inert) c.inert = true;
  return c;
}
