/**
 * Les CHOIX de création d'un héros (`ChoixDeCreation`, `src/engine/character.ts`) en FRAGMENT de schéma :
 * une forme zod et une `MetaChamp` par clé, que compose tout document qui porte des choix de création
 * (`defs/pregens.ts`). Les deux tables couvrent exactement les clés de `ChoixDeCreation` (`satisfies`).
 */
import { z } from 'zod';
import type { ChoixDeCreation } from '../../../engine/character';
import type { MetaChamp } from './meta';
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
  /** Branche retenue d'un `{choice}` (son index), objet ou Atout sinon (id), par adresse (`emplacementsDeDotation`). */
  trappingChoices: parAdresse(z.union([z.number().int().nonnegative(), z.string()])),
  /** Sorts de Magie mineure (`idDe('spell', 'mineure')`), complétés au quota BFM exact (LDB 10 l.714). */
  pettySpells: z.array(idDe('spell', 'mineure')).optional(),
} satisfies { [K in keyof ChoixDeCreation]-?: z.ZodType };

export const metaDesChoix = {
  seed: { label: 'Graine de tirage', hint: 'Graine stable qui rejoue à l’identique tous les tirages de la création' },
  careerTalent: { label: 'Talent de carrière choisi', hint: 'Talent de Niveau choisi ; sans lui, le premier de la liste est pris' },
  specChoices: { label: 'Spécialisations choisies', hint: 'Spécialisation retenue, par emplacement de création' },
  speciesTalentChoices: { label: 'Talents d’espèce « A ou B »', hint: 'Option retenue, par entrée « A ou B » ; sans elle, la première' },
  randomSpecPicks: { label: 'Utilisations des Talents tirés', hint: 'Spécialisation d’un Talent aléatoire tiré, par tirage' },
  talentRerolls: { label: 'Relances des Talents tirés', hint: 'Nombre de relances d’un Talent tiré déjà possédé, par tirage ; sans elle, le tirage est gardé' },
  talentsRolled: { label: 'Talents aléatoires découverts', hint: 'Faux tant que les Talents aléatoires ne sont pas tirés ; absent, ils le sont' },
  skillAdvances: { label: 'Augmentations de carrière', hint: 'Répartition des 40 Augmentations, par Compétence ; sans elle, la répartition égale' },
  speciesSkillAdvances: { label: 'Compétences d’espèce', hint: 'Compétences d’espèce à +5 et à +3 ; sans elles, les trois premières et les trois suivantes' },
  trappingChoices: { label: 'Choix d’équipement', hint: 'Objet ou branche retenu, par emplacement d’équipement de départ' },
  pettySpells: { label: 'Sorts de Magie mineure', hint: 'Sorts mineurs choisis, complétés au quota par le générateur' },
} satisfies { [K in keyof ChoixDeCreation]-?: MetaChamp };
