/**
 * Schéma de `speciesRace.json` — règles ORDONNÉES espèce (slug/libellé) → race-id du rig
 * (carrure/palette/features/posture), consommé
 * par `src/gameIso/rig/skeletons.ts` (`baseSpeciesOf`, type `SpeciesRule`). Une règle porte
 * EXACTEMENT un des 3 opérateurs : `prefix` (l'espèce COMMENCE par un des tokens), `includes` (elle
 * en CONTIENT un), `all`+`any` (elle contient TOUS les `all` ET un des `any`). Règles évaluées dans
 * l'ORDRE, première qui matche gagne ; aucune ne matche → `default`. L'espèce entrante est déjà en
 * minuscules. Ajouter un mapping = une ligne de `rules`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'speciesRace.json';
export const famille = 'config';

const speciesRuleSchema = z.strictObject({
  prefix: z.array(z.string()).optional(),
  includes: z.array(z.string()).optional(),
  all: z.array(z.string()).optional(),
  any: z.array(z.string()).optional(),
  race: z.string(),
});

const doc = document(
  'speciesRace',
  famille,
  {
    default: z.string(),
    rules: z.array(speciesRuleSchema),
  },
  {
    default: { label: 'Race par défaut', hint: 'Race d’apparence retenue quand aucune règle ne correspond' },
    rules: { label: 'Règles de correspondance', hint: 'Règles ordonnées qui font correspondre une espèce à une race d’apparence' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison: "table de résolution race→défauts d'authoring (`default`/`rules`), pas une fiche de contenu.",
      },
    },
    edit: { none: 'aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
