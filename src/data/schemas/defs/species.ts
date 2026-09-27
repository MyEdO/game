/**
 * Schéma de `species.json` — dérivé du contenu RÉEL (27 entrées, script d'inventaire) et de
 * `SpeciesData` (`src/data/index.ts`). `skills`/`talents` = emplacements d'avancement
 * (`grammaire/avancement.ts`), `baseChar` = `Partial<Record<CharKey, number>>`. Mêmes petites formes
 * partagées que `careerLevels.ts`, PROMUES dans `grammaire/avancement.ts`, `grammaire/reference.ts`
 * (Ref/TraitInstance) et `grammaire/valeurs.ts` (CharKey). `mutationBodyMax` est ABSENT sur une partie des
 * entrées (18/27) : optionnel, conforme à l'interface ; `grantGroups` est porté par les 27.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { charKeySchema, raceKeySchema, refCareerIdSchema } from '../grammaire/valeurs';
import { traitInstanceSchema } from '../grammaire/reference';
import { ref } from '../grammaire/ref';
import { avancement } from '../grammaire/avancement';

export const file = 'species.json';
export const famille = 'entite';

const doc = document(
  'species',
  famille,
  {
    /** Race (famille d'espèces) pour le groupage d'affichage — DONNÉE requise. */
    family: z.string(),
    /** Variante régionale/sous-espèce — absente pour l'espèce nominale. */
    variant: z.string().optional(),
    /** id STABLE — colonne d'espèce des tables Âge/Taille/Yeux/Cheveux (`raceKeySchema`, #313). */
    refChar: raceKeySchema,
    /** id STABLE — colonne du Tableau des Classes et Carrières aléatoires (`refCareerIdSchema`, #313). */
    refCareer: refCareerIdSchema,
    rand: z.number(),
    movement: z.number(),
    fate: z.strictObject({ fate: z.number(), resilience: z.number(), extra: z.number() }),
    baseChar: z.record(charKeySchema, z.number()),
    /** Compétences d'espèce (positionnel +5/+3 — lu via `advancementLabel`). */
    skills: z.array(avancement('skill')),
    /** Talents d'espèce : réf, choix « A ou B » (`pick`), « Au choix » (`choix`), tirage (`random`). */
    talents: z.array(avancement('talent')),
    /** Ids de `groups.json` de l'espèce (Traits psy ciblés, LDB 21) — racial, plus la sous-espèce
     *  quand elle a son propre Groupe (« Humains (Tiléens) » → `humain` + `tileen`). DONNÉE requise
     *  (27/27) : `groupsFor` les lit, il ne dérive plus rien du `label`. */
    grantGroups: z.array(z.string()),
    /** Profil standard du PNJ de l'espèce (`LDB 77 l.7`) — réf à `creatures.json`, posée PAR ESPÈCE,
     *  jamais dérivée de `family`. Absent = l'espèce n'a pas de profil standard (`gnomes`). */
    profilStandard: ref('creature').optional(),
    /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.78-81). Absent = défaut Humain (50). */
    mutationBodyMax: z.number().optional(),
    /** Habillage de l'APERÇU (créateur, carte de race #431) — id de carrière ICONIQUE et COMMUNE à
     *  l'espèce (jamais un choix de RÈGLE, pur flavor de vitrine) : la tuile de famille montre un
     *  personnage vêtu plutôt qu'une tunique nue. Absent = pas de tenue (repli existant). */
    previewCareer: ref('career').optional(),
    /** Trait RACIAL de l'espèce (#572) — MÊME `TraitInstance` que le bestiaire (Ogre `{id:'ogre'}`,
     *  encombrance/consommation ×2 ; la Taille est portée par le TALENT Massif/Petit, pas ici).
     *  Absent (26/27 observées) = aucun trait racial mécanique. */
    traits: z.array(traitInstanceSchema).optional(),
    /** `VDM 02 l.190` / `LDB 46 l.177` (`careerSlots.arcaneDomainCap`). Absent = plafond 1 (défaut RAW hors elfe).
     *  Portée ici sur les deux entrées « Hauts elfes »/« Elfes sylvains ». */
    arcaneDomainsBonusOf: charKeySchema.optional(),
    /** id d'`OptionalRule` (`reglesOptionnelles.json`) qui OUVRE l'espèce au joueur — absent = ouverte.
     *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
    gatedByRule: z.string().optional(),
  },
  {
    family: { label: 'Famille', hint: 'Race regroupant l’espèce, pour l’affichage' },
    variant: { label: 'Variante', hint: 'Variante régionale/sous-espèce' },
    refChar: {
      label: 'Colonne d’apparence',
      hint: 'Détermine la colonne des tables Âge/Taille/Yeux/Cheveux consultées à la création',
    },
    refCareer: { label: 'Colonne du Tableau des Carrières' },
    rand: { label: 'Seuil aléatoire (d100)' },
    movement: { label: 'Mouvement' },
    fate: { label: 'Destin / Résilience' },
    baseChar: { label: 'Caractéristiques de base' },
    skills: { label: 'Compétences d’espèce' },
    talents: { label: 'Talents d’espèce' },
    grantGroups: { label: 'Groupes accordés' },
    profilStandard: {
      label: 'Profil standard',
      hint: 'LDB 77 l.7 — fiche du bestiaire d’un PNJ ordinaire de l’espèce',
    },
    mutationBodyMax: { label: 'Seuil de mutation physique' },
    previewCareer: {
      label: 'Aperçu (carrière type)',
      hint: 'Carrière emblématique servant l’aperçu de vitrine (pur habillage)',
    },
    traits: { label: 'Traits raciaux' },
    arcaneDomainsBonusOf: { label: 'Bonus de Domaines arcaniques', hint: 'Relève le plafond de Domaines tenus' },
    gatedByRule: {
      label: 'Règle optionnelle requise',
      hint: 'Règle optionnelle dont l’activation ouvre l’espèce au joueur',
    },
  },
  {
    codex: { keys: ['races'] },
    edit: { dataset: 'species' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
