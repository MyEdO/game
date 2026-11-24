/**
 * Procédures de création : le brouillon porte sa clé (`CreatorDraft.procedure`), choisie par clé comme `bodyShape`
 * choisit sa table de localisation (`hitLocationByShape`) et le héros son modèle de progression
 * (`MODELES_DE_PROGRESSION`) ; chaque procédure porte en DONNÉE ce qui diverge, chaque lecteur du brouillon garde un
 * seul corps. LDB 04-05 ; CRB 005-016
 */
import type { CleDeProgression } from '../../engine/modeleDeProgression';
import type { StatusTier } from '../../engine/money';
import type { Combatant } from '../../engine/types';
import { BAREME_DE_CARRIERE_LDB, QUOTAS_D_ESPECE_LDB, type BaremeDeCarriere, type QuotasDEspece } from '../../engine/character';
import {
  BORNES_DES_POINTS_LDB,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
  XP_SPECIES_ACCEPTED,
  type BornesDesPoints,
} from '../../engine/creation';

/** Méthode des Caractéristiques que le joueur choisit. LDB 05 l.337-341 ; CRB 014 l.5-17 */
export type CharMode = 'tire' | 'reassigne' | 'repartition';
/** Méthode des Caractéristiques au regard de ses gains : les jets gardés, réassignés, ou toute autre (relance, points). */
export type MethodeTenue = 'tire' | 'reassigne' | 'autre';

/** Ce que rapporte un tirage accepté : PX, Fortune, dotations du Niveau suivant, points à répartir sur les
 *  Caractéristiques de carrière. */
export interface Gain { px?: number; fortune?: number; dotations?: number; bonusDeCarriere?: number }

/** D'où viennent les espèces : `species.json` (celles que `speciesAllowed` ouvre), ou les entrées de
 *  `especesCrb.json`, chacune surchargeant l'espèce de même id, ses langues à `pointsDesLangues`. */
export type EspecesDeLaProcedure = { type: 'ldb' } | { type: 'crb'; pointsDesLangues: number };

export interface ProcedureDeCreation {
  /** Modèle de progression du héros créé (`Combatant.progression`). */
  progression?: Combatant['progression'];
  especes: EspecesDeLaProcedure;
  /** Gain du premier tirage d'espèce gardé. */
  especeAcceptee: Gain;
  /** Gain du premier jet de carrière gardé, puis d'une carrière choisie parmi les trois premiers jets. */
  carriere: { premier: Gain; troisJets: Gain };
  caracteristiques: {
    /** Gain de chaque méthode tenue. */
    methodes: Readonly<Record<MethodeTenue, Gain>>;
    /** Augmentations gratuites à répartir sur les Caractéristiques de carrière, quelle que soit la méthode. */
    augmentationsDeCarriere: number;
    /** Où va la répartition sur les Caractéristiques de carrière : les Augmentations, ou la valeur de base. */
    repartitionVers: 'augmentations' | 'base';
    /** La répartition doit-elle atteindre son quota, ou au plus ? */
    quotaExact: boolean;
    /** Bornes des 100 Points. */
    points: BornesDesPoints;
  };
  /** L'étape du signe astral existe-t-elle (sous sa règle `creation-signes-astraux`) ? */
  signeAstral: boolean;
  competencesDEspece: QuotasDEspece;
  /** Barème des Augmentations de carrière ; `plafondAvecLEspece` : le plafond se lit sur le total espèce + carrière. */
  competencesDeCarriere: BaremeDeCarriere & { plafondAvecLEspece: boolean };
  /** Destin gagné quand l'espèce, la carrière et les Caractéristiques gardent leur premier tirage, ces dernières par
   *  l'une des `methodes`. */
  ohFickleFate: { destin: number; methodes: readonly MethodeTenue[] };
  /** Pièces fixes de la richesse de départ, par Échelon. */
  richesse: Readonly<Record<StatusTier, number>>;
}

/** Augmentations gratuites sur les Caractéristiques de carrière. LDB 05 l.459 */
export const CAREER_CHAR_ADVANCES = 5;

export const PROCEDURES_DE_CREATION: Readonly<Record<CleDeProgression, ProcedureDeCreation>> = {
  '4e': {
    especes: { type: 'ldb' },
    especeAcceptee: { px: XP_SPECIES_ACCEPTED }, // LDB 04 l.91
    carriere: { premier: { px: XP_CAREER_FIRST }, troisJets: { px: XP_CAREER_TOP3 } }, // LDB 05 l.210-211
    caracteristiques: {
      methodes: { tire: { px: XP_CHARS_KEPT }, reassigne: { px: XP_CHARS_REASSIGNED }, autre: {} }, // LDB 05 l.337-341
      augmentationsDeCarriere: CAREER_CHAR_ADVANCES,
      repartitionVers: 'augmentations', // LDB 05 l.463
      quotaExact: true,
      points: BORNES_DES_POINTS_LDB,
    },
    signeAstral: true, // ADE II 03 l.30
    competencesDEspece: QUOTAS_D_ESPECE_LDB,
    competencesDeCarriere: { ...BAREME_DE_CARRIERE_LDB, plafondAvecLEspece: false }, // LDB 05 l.535
    ohFickleFate: { destin: 0, methodes: [] },
    richesse: { bronze: 0, argent: 0, or: 0 }, // LDB 05 l.578
  },
  '5e': {
    progression: '5e',
    especes: { type: 'crb', pointsDesLangues: 30 }, // CRB 006 l.5 ; CRB 008 l.55
    especeAcceptee: { fortune: 1 }, // CRB 006 l.7
    carriere: { premier: { dotations: 2 }, troisJets: { dotations: 1 } }, // CRB 013 l.11-13
    caracteristiques: {
      methodes: { tire: { bonusDeCarriere: 6 }, reassigne: { bonusDeCarriere: 3 }, autre: {} }, // CRB 014 l.11, l.15, l.17
      augmentationsDeCarriere: 0,
      repartitionVers: 'base', // CRB 014 l.11, l.21
      quotaExact: false, // CRB 014 l.11
      points: { min: 4, max: 16 }, // CRB 014 l.17
    },
    signeAstral: false, // CRB 005 l.11-18
    competencesDEspece: { plus5: 5, plus3: 0 }, // CRB 008 l.59
    competencesDeCarriere: { quota: 40, plafond: 15, pas: 5, plafondAvecLEspece: true }, // CRB 015 l.7, l.12, l.29
    ohFickleFate: { destin: 1, methodes: ['tire'] }, // CRB 016 l.69 ; CRB 014 l.5
    richesse: { bronze: 20, argent: 10, or: 2 }, // CRB 016 l.15-21
  },
};

/** La procédure du brouillon `d`. */
export const procedureDe = (d: { procedure: CleDeProgression }): ProcedureDeCreation => PROCEDURES_DE_CREATION[d.procedure];
