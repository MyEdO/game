import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `species.json` — dérivé du contenu RÉEL (script d'inventaire) et de
 * `SpeciesData` (`src/data/index.ts`). `skills`/`talents` = emplacements d'avancement
 * (`grammaire/avancement.ts`), `baseChar` = une valeur par `CharKey`. Mêmes petites formes
 * partagées que `careerLevels.ts`, PROMUES dans `grammaire/avancement.ts`, `grammaire/reference.ts`
 * (Ref/TraitPose) et `grammaire/valeurs.ts` (CharKey). `mutationBodyMax` est ABSENT sur une partie des
 * entrées : optionnel, conforme à l'interface.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { charKeySchema, raceKeySchema } from '../grammaire/valeurs';
import { traitInstanceSchema } from '../grammaire/reference';
import { idDe, ref, refs } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';
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
    /** LDB 04 l.93 ; LDB 05 l.701-768 */
    refChar: raceKeySchema,
    /** LDB 05 l.214 */
    refCareer: idDe('carrieresAleatoires', 'colonne'),
    movement: z.number(),
    fate: nommerChamps(z.strictObject({ fate: z.number(), resilience: z.number(), extra: z.number() }), {
      fate: { label: 'Destin' },
      resilience: { label: 'Résilience' },
      extra: { label: 'Points supplémentaires' },
    }),
    baseChar: z.record(charKeySchema, z.number()),
    /** Compétences d'espèce (positionnel +5/+3 — lu via `advancementLabel`). */
    skills: z.array(avancement('skill')),
    /** Talents d'espèce : réf, choix « A ou B » (`pick`), « Au choix » (`choix`), tirage (`random`). */
    talents: z.array(avancement('talent')),
    /** LDB 21 */
    grantGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }),
    /** LDB 77 l.7 */
    profilStandard: ref('creature').optional(),
    /** LDB 19 l.78-81 */
    mutationBodyMax: z.number().optional(),
    /** Trait RACIAL de l'espèce (#572) — MÊME `TraitPose` que le bestiaire (Ogre `{id:'ogre'}`,
     *  encombrance/consommation ×2 ; la Taille est portée par le TALENT Massif/Petit, pas ici).
     *  Absent (26/27 observées) = aucun trait racial mécanique. */
    traits: z.array(traitInstanceSchema).optional(),
    /** VDM 02 l.190 ; LDB 46 l.177 */
    arcaneDomainsBonusOf: charKeySchema.optional(),
    /** NADJ 14 l.5 ; ADE II 02 l.110 */
    gatedByRule: ref('regleOptionnelle').optional(),
  },
  {
    family: { label: 'Famille', hint: 'Race regroupant l’espèce, pour l’affichage' },
    variant: { label: 'Variante', hint: 'Variante régionale/sous-espèce' },
    refChar: {
      label: 'Colonne d’apparence',
      hint: 'Race de l’espèce : sa rangée du Tableau des Races aléatoires et sa colonne des tables Âge/Taille/Yeux/Cheveux',
    },
    refCareer: { label: 'Colonne du Tableau des Carrières' },
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
  { exiges: ['source'], espace: { discriminant: 'refChar' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
