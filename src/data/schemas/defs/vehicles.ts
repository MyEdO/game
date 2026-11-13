import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `vehicles.json` — véhicules/embarcations à coque (chariots, barges, navires), 3 facettes
 * indépendantes (achat/voyage/coque+navire), dont `VehicleData` (`src/engine/types.ts`) est le type dérivé ;
 * relevé sur le contenu RÉEL (25 entrées, script d'inventaire : `hull` 22/25, `ship` 20/25, `travel` 3/25). `icon` est une clé d'ENVELOPPE, posée par la fabrique.
 */
import { z } from 'zod';
import { availabilitySchema, enumNomme, moneySchema, profilDePropulsionSchema, profilDeVoileSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { navalTraitRefSchema } from '../grammaire/reference';
import { defautsDesPonts } from '../grammaire/carte-ascii';

export const file = 'vehicles.json';
export const famille = 'entite';

/** Gréement d'une coque, dérivé de sa propulsion par `rigDuNavire` (MDG 13) — libellés de la fiche et du
 *  dossier de navire. */
export const rigSchema = enumNomme({ avirons: 'Avirons', voile: 'Voile', mixte: 'Mixte (voile et avirons)' });

/** BORD du pont où siège un poste d'équipage (MDG 12) — affiché par la fiche de navire. */
export const posteSideSchema = enumNomme({ proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord' });

const vehicleTravelClassSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  brassPerKm: z.number(),
}), { id: { label: "identifiant" }, label: { label: "nom" }, brassPerKm: { label: "sous par kilomètre" } });

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
    purchase: nommerChamps(z.strictObject({
      price: moneySchema,
      availability: availabilitySchema.optional(),
    }), { price: { label: "prix" }, availability: { label: "disponibilité" } }).optional(),
    /** Facette VOYAGE (passage payant, LDB 51 l.178-189). `medium` : milieu du TRAJET PAYÉ (un véhicule
     *  peut être bi-milieu — ex. la Barge navigue le fleuve LDB 70 l.10 tout en figurant à la table
     *  navale MDG 12 avec `hull.propulsion:'maritime'` — les deux facettes sont INDÉPENDANTES,
     *  jamais l'une dérivée de l'autre) ; absent = terrestre implicite (défaut historique). */
    travel: nommerChamps(z.strictObject({
      movement: z.number(),
      medium: z.enum(['terrestre', 'fluvial', 'maritime']).optional(),
      draft: nommerChamps(z.strictObject({ montureId: z.string(), count: z.number() }), { montureId: { label: "monture" }, count: { label: "nombre" } }).optional(),
      classes: z.array(vehicleTravelClassSchema),
    }), { movement: { label: "Mouvement" }, medium: { label: "milieu" }, draft: { label: "attelage" }, classes: { label: "classes" } }).optional(),
    /** Facette COQUE (entité à PV, `bodyShape` toujours `'vehicule'` dans les 22 entrées observées). */
    hull: nommerChamps(z.strictObject({
      char: nommerChamps(z.strictObject({ endurance: z.number(), B: z.number() }), { endurance: { label: "Endurance" }, B: { label: "Blessures" } }),
      bodyShape: z.literal('vehicule'),
      propulsion: z.enum(['terrestre', 'fluvial', 'maritime']),
      /** Table de Localisation des coups (`shipHitLocation`, `src/engine/combat.ts`) — vocabulaire
       *  FERMÉ : une coquille d'authoring résoudrait sinon la coque fluviale sur la table maritime.
       *  Absent/`null` = `navire` (MDG 13) ; `navire-fluvial` = MSRC 7. */
      locationTable: z.union([z.enum(['navire', 'navire-fluvial']), z.null()]).optional(),
      /** Jeu de tables de Critiques (`shipCritSet`, `src/data/shipCriticals.ts`) — MÊME vocabulaire
       *  FERMÉ que `locationTable`, et pour la même raison : les deux jeux chargés sont
       *  `ship-criticals` (MDG 13) et `river-criticals` (MSRC 5). Absent/`null` = `ship-criticals`. */
      criticalTable: z.union([z.enum(['ship-criticals', 'river-criticals']), z.null()]).optional(),
    }), { char: { label: "caractéristiques" }, bodyShape: { label: "forme" }, propulsion: { label: "propulsion" }, locationTable: { label: "table de Localisation" }, criticalTable: { label: "table de Critiques" } }).optional(),
    /** Facette NAVIRE (profil naval MDG 12). */
    ship: nommerChamps(z.strictObject({
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
      sail: profilDeVoileSchema.optional(),
      oars: profilDePropulsionSchema.optional(),
      traits: z.array(navalTraitRefSchema),
    }), { crew: { label: "équipage" }, manoeuvre: { label: "manœuvre" }, lengthM: { label: "longueur en mètres" }, footprint: { label: "emprise" }, capacity: { label: "capacité" }, sail: { label: "voile" }, oars: { label: "avirons" }, traits: { label: "Traits" } }).optional(),
    /** PONTS d'un navire qu'on visite (#3686), une paire : une carte box-drawing par pont, du plus bas au plus haut, en cases du
     *  plan des scènes (`sceneMetresPerTile`), la proue à gauche, tribord en haut (`MOTS_DES_PONTS`,
     *  `grammaire/carte-ascii.ts`). La seule source de la forme des ponts : le plan de jeu
     *  (`noyau/pontsDeLaFiche.ts`) et le modèle 3D (`scripts/personnage-3d/vehicule/`) la lisent. Puis la hauteur en
     *  mètres au-dessus de la flottaison de chaque glyphe de case : une paire, pour que les cartes n'aillent jamais sans
     *  leurs hauteurs (`defautsDesPonts`). Valeurs d'adaptation (#3686) relevées sur la planche du navire : ses plans
     *  des ponts (cases, cloisons, trappes), son profil (hauteurs). */
    ponts: z
      .tuple([z.array(z.string()), z.record(z.string(), z.number())])
      .superRefine(([cartes, hauteurs], ctx) => {
        for (const defaut of defautsDesPonts(cartes, hauteurs)) ctx.addIssue({ code: 'custom', path: [0], message: defaut });
      })
      .optional(),
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
    ponts: { label: 'Ponts', hint: 'Les cartes box-drawing des ponts, du plus bas au plus haut, puis la hauteur au-dessus de la flottaison de chaque glyphe de case' },
  },
  {
    codex: { keys: ['vehicles'] },
    edit: { dataset: 'vehicles' },
  },
  {
    /** MDG 12 l.131, l.195-199, l.311 */
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const navire = (v as { ship?: { sail?: unknown; oars?: unknown } }).ship;
        if (navire && !navire.sail && !navire.oars) {
          ctx.addIssue({ code: 'custom', path: ['ship', 'sail'], message: `${(v as { id: string }).id} : navire sans propulsion — Voiles ou Avirons requis` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
