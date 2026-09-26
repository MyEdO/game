/**
 * Schéma de `vehicles.json` — véhicules/embarcations à coque (chariots, barges, navires), 3 facettes
 * indépendantes (achat/voyage/coque+navire+pont). Dérivé de l'interface `VehicleData` EXISTANTE
 * (`src/engine/types.ts`, + `NavalTraitRef`/`ShipDeck`/`DeckPosteSlot`/`Propulsion`/
 * `VehicleTravelClass` co-localisées) et du contenu RÉEL (25 entrées, script d'inventaire : `hull`
 * 22/25, `ship` 20/25, `travel` 3/25, `deck` 1/25). `icon` est une clé d'ENVELOPPE, posée par la fabrique.
 */
import { z } from 'zod';
import { availabilitySchema, cell2Schema, enumNomme, moneySchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'vehicles.json';
export const famille = 'entite';

/** Gréement d'une coque (MDG 12) — affiché par la fiche et le dossier de navire. */
export const rigSchema = enumNomme({ avirons: 'Avirons', voile: 'Voile', mixte: 'Mixte (voile et avirons)' });

/** BORD du pont où siège un poste d'équipage (MDG 12) — affiché par la fiche de navire. */
export const posteSideSchema = enumNomme({ proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord' });

/** `NavalTraitRef` (`src/data/index.ts`) — Trait INTÉGRÉ à la construction du type de navire
 *  (MDG 12), + Indice éventuel. Le foyer des ids est `naval-traits.json`, JAMAIS `traits.json` :
 *  les 19 références de `ship.traits` y résolvent toutes, aucune n'existe au bestiaire (mesuré
 *  2026-09-01) — composer `traitInstanceSchema` ouvrirait les Traits de créature aux navires. */
const navalTraitRefSchema = ref('navalTrait', { value: z.number().optional() });

const deckPosteSlotSchema = z.strictObject({
  pos: cell2Schema,
  side: posteSideSchema,
  cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
});

const shipDeckSchema = z.strictObject({
  ascii: z.array(z.string()),
  postes: z.array(deckPosteSlotSchema).optional(),
});

const vehicleTravelClassSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  brassPerKm: z.number(),
});

const doc = document(
  'vehicles',
  famille,
  {
    /** Encombrement de l'objet véhicule (LDB 61) — `null` = ne se porte pas (généralement, diligence…). */
    enc: z.union([z.number(), z.null()]).optional(),
    /** Chargement (EDOC 07 l.231-243) — Points d'Enc que la section bagages contient, véhicules terrestres
     *  uniquement. Champ parallèle à `ship.capacity` (même concept, facette `ship` inadaptée : ses autres
     *  champs — crew/manoeuvre/lengthM naval — n'ont pas d'équivalent EDOC pour un attelage terrestre). */
    chargement: z.number().optional(),
    /** Facette ACHAT — `availability` absent pour les navires (MDG ne donne pas de Disponibilité). */
    purchase: z.strictObject({
      price: moneySchema,
      availability: availabilitySchema.optional(),
    }).optional(),
    /** Facette VOYAGE (passage payant, LDB 51 l.178-189). `medium` : milieu du TRAJET PAYÉ (un véhicule
     *  peut être bi-milieu — ex. la Barge navigue le fleuve LDB 70 l.10 tout en figurant à la table
     *  navale MDG 12 avec `hull.propulsion:'maritime'` — les deux facettes sont INDÉPENDANTES,
     *  jamais l'une dérivée de l'autre) ; absent = terrestre implicite (défaut historique). */
    travel: z.strictObject({
      movement: z.number(),
      medium: z.enum(['terrestre', 'fluvial', 'maritime']).optional(),
      draft: z.strictObject({ montureId: z.string(), count: z.number() }).optional(),
      classes: z.array(vehicleTravelClassSchema),
    }).optional(),
    /** Facette COQUE (entité à PV, `bodyShape` toujours `'vehicule'` dans les 22 entrées observées). */
    hull: z.strictObject({
      char: z.strictObject({ endurance: z.number(), B: z.number() }),
      bodyShape: z.literal('vehicule'),
      propulsion: z.enum(['terrestre', 'fluvial', 'maritime']),
      rig: rigSchema.optional(),
      /** Table de Localisation des coups (`shipHitLocation`, `src/engine/combat.ts`) — vocabulaire
       *  FERMÉ : une coquille d'authoring résoudrait sinon la coque fluviale sur la table maritime.
       *  Absent/`null` = `navire` (MDG 13) ; `navire-fluvial` = MSRC 7. */
      locationTable: z.union([z.enum(['navire', 'navire-fluvial']), z.null()]).optional(),
      /** Jeu de tables de Critiques (`shipCritSet`, `src/data/shipCriticals.ts`) — MÊME vocabulaire
       *  FERMÉ que `locationTable`, et pour la même raison : les deux jeux chargés sont
       *  `ship-criticals` (MDG 13) et `river-criticals` (MSRC 5). Absent/`null` = `ship-criticals`. */
      criticalTable: z.union([z.enum(['ship-criticals', 'river-criticals']), z.null()]).optional(),
    }).optional(),
    /** Facette NAVIRE (profil naval MDG 12). */
    ship: z.strictObject({
      crew: z.number(),
      manoeuvre: z.number(),
      /** Longueur de coque en mètres. ENTIER ≥ 1 : c'est le domaine de la colonne « Taille » du
       *  tableau standard (MDG 12 l.122-129, bandes d'entiers contiguës depuis 1 m), que
       *  `shipSizeOfLength` (`src/engine/shipBuild.ts`) lit — une longueur hors domaine n'a pas de
       *  Taille, et le refus se pose ICI plutôt qu'au tirage. Mesuré 2026-09-02 : les 20 navires de
       *  `vehicles.json` sont entiers, de 3 à 130 m. */
      lengthM: z.number().int().min(1),
      footprint: z.number().optional(),
      capacity: z.number(),
      sail: z.strictObject({ m: z.number(), crew: z.number() }).optional(),
      oars: z.strictObject({ m: z.number(), crew: z.number() }).optional(),
      traits: z.array(navalTraitRefSchema),
    }).optional(),
    /** Facette PONT (plan person-scale, authoré par TYPE). */
    deck: shipDeckSchema.optional(),
  },
  {
    enc: { label: 'Encombrement (objet)', hint: 'Encombrement de l’objet véhicule — vide = ne se porte pas' },
    chargement: {
      label: 'Chargement',
      hint: 'Points d’Encombrement que la section bagages contient (véhicules terrestres)',
    },
    purchase: { label: 'Facette Achat', hint: 'Prix, et Disponibilité quand le livre en imprime une' },
    travel: { label: 'Facette Voyage', hint: 'Passage payant : vitesse et milieu du trajet, classes de passage' },
    hull: {
      label: 'Facette Coque',
      hint: 'Profil à PV de la coque : Endurance et Blessures, propulsion/gréement et Traits',
    },
    ship: { label: 'Facette Navire', hint: 'Équipage, manœuvrabilité, longueur et capacité du profil naval' },
    deck: { label: 'Facette Pont', hint: 'Plan du pont à l’échelle du combat, authoré par type de véhicule' },
  },
  {
    codex: { keys: ['vehicles'] },
    edit: { dataset: 'vehicles' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
