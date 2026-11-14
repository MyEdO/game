/**
 * Les CHOIX de création d'un héros (`ChoixDeCreation`, `src/engine/character.ts`) en FRAGMENT de schéma :
 * une forme zod par clé, que compose tout document qui porte des choix de création (`defs-scenes/scene.ts`).
 * La table couvre exactement les clés de `ChoixDeCreation` (`satisfies`).
 */
import { z } from 'zod';
import type { ChoixDeCreation } from '../../../engine/character';
import { idDe, refOuSpec } from './ref';
import { avancement } from './avancement';
import { marquerCollection, marqueDeRecord } from './collection-cle';
import { adresseLue } from '../../../engine/adresseDeCreation';

/** Choix par adresse d'emplacement : chaque clé est lue par la grammaire de `adresseDeCreation` (`adresseLue`). */
const parAdresse = <T extends z.ZodType>(valeur: T) =>
  marquerCollection(
    z.record(z.string(), valeur).superRefine((choix, ctx) => {
      for (const cle of Object.keys(choix)) {
        if (adresseLue(cle) === undefined) ctx.addIssue({ code: 'custom', path: [cle], message: `« ${cle} » n’est pas une adresse d’emplacement de création (adresseDeCreation)` });
      }
    }),
    marqueDeRecord(),
  ).optional();

export const champsDeChoix = {
  seed: z.number().int(),
  /** Talent de carrière CHOISI (`refOuSpec('talent')`) — sans lui, `createHero` prend la 1ʳᵉ entrée du Niveau. */
  careerTalent: refOuSpec('talent').optional(),
  specChoices: parAdresse(z.string()),
  /** Option retenue d'une entrée « A ou B » : une option de `of`, même forme que les Talents d'espèce (`avancement`). */
  speciesTalentChoices: parAdresse(avancement('talent')),
  randomSpecPicks: parAdresse(z.string()),
  talentRerolls: parAdresse(z.number().int().nonnegative()),
  talentsRolled: z.boolean().optional(),
  skillAdvances: z.record(z.string(), z.number().int().nonnegative()).optional(),
  speciesSkillAdvances: z.strictObject({ plus5: z.array(refOuSpec('skill')), plus3: z.array(refOuSpec('skill')) }).optional(),
  /** Branche retenue d'un `{pick, of}` (son index), objet ou Atout sinon (id), par adresse (`emplacementsDeDotation`). */
  trappingChoices: parAdresse(z.union([z.number().int().nonnegative(), z.string()])),
  /** Sorts de Magie mineure (`idDe('spell', 'mineure')`), complétés au quota BFM exact (LDB 10 l.714). */
  pettySpells: z.array(idDe('spell', 'mineure')).optional(),
} satisfies { [K in keyof ChoixDeCreation]-?: z.ZodType };
