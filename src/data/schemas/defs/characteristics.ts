import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `characteristics.json` — l'EXEMPLAIRE de la convention des defs de schéma (Lot 1 du
 * contrat de donnée). Dérivé du contenu RÉEL du JSON (10 caracs à jet + Blessure/Destin/Chance/
 * Résilience/Détermination/Extra Points/Mouvement/Corruption/Péché) et de son seul consommateur typé,
 * `src/ui/compendium/registry.ts` (`{ label, abr?, nature?, desc?, source? }`, `c.nature === 'roll'`).
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { sourceRefSchema, charKeySchema } from '../grammaire/valeurs';

export const file = 'characteristics.json';
export const famille = 'entite';

/** id STABLE — `CharKey` du moteur pour les 10 caracs à jet (« CC »…), slug dédié pour les 9 autres
 *  entrées (Blessure/Destin/Chance/Résilience/Détermination/Extra Points/Mouvement/Corruption/Péché)
 *  qui ne sont pas des `CharKey`. Catalogue FERMÉ (19 entrées) — union énumérée, pas `z.string()`.
 *  Passé à `options.idDocument` : sans lui, l'adoption de la fabrique remplacerait ce verrou par
 *  `z.string().min(1)` EN SILENCE. */
const characteristicIdSchema = z.union([
  charKeySchema,
  z.enum(['blessure', 'destin', 'chance', 'resilience', 'determination', 'extra-points', 'mouvement', 'corruption', 'peche']),
]);

const champs = {
  /** `abr` reste un champ d'AFFICHAGE (abréviation FR rendue sur la fiche perso), jamais une clé de logique. */
  abr: z.string(),
  /** NATURE de la ligne de registre, mesurée sur les 19 entrées : 'roll' (10 caracs à jet), 'wounds' (B),
   *  'extra' (Destin/Résilience), 'mv' (Mouvement), 'points' (Extra Points), 'compteur' (Chance,
   *  Détermination, Corruption, Péché). La chaîne VIDE, qui ne discriminait rien, est MORTE du schéma. */
  nature: z.enum(['roll', 'wounds', 'extra', 'mv', 'points', 'compteur']),
  /** DÉPENSES offertes par une ressource (Résilience : « Je ne faillirai pas ! » / « Je te renie ! » ;
   *  demain le Destin et ses deux sauvetages) — amendement A de #1117 : la règle vit sur l'ENTITÉ qui
   *  la porte, `regles.json` ne garde que les règles de CADRE. `desc` est un VERBATIM (règle 5).
   *  Rendue en SECTION de la fiche par `registry.ts` (patron `symptoms.onTick`). */
  options: z
    .array(
      nommerChamps(z.strictObject({
        id: z.string(),
        label: z.string(),
        desc: z.string(),
        source: sourceRefSchema,
      }), {
        id: { label: 'identifiant' },
        label: { label: 'libellé' },
        desc: { label: 'texte' },
        source: { label: 'source' },
      }),
    )
    .optional(),
};

const doc = document(
  'characteristics',
  famille,
  champs,
  {
    abr: { label: 'Abréviation', hint: 'Abréviation affichée sur la fiche personnage' },
    nature: {
      label: 'Genre',
      hint: 'jet, Blessures, ressource à sauvetage, Mouvement, points, jauge (Chance/Détermination), compteur (Corruption/Péché)',
    },
    options: { label: 'Dépenses de la ressource', hint: 'Usages qu’offre la ressource (ex. Résilience : « Je ne faillirai pas ! »)' },
  },
  {
    codex: { keys: ['characteristics'] },
    edit: { dataset: 'characteristics' },
  },
  { idDocument: characteristicIdSchema, exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
/** VUE TS du dataset — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`), la vue
 *  se recompose donc depuis l'enveloppe et les champs déclarés, sans rouvrir aucun nœud. L'`id` y est
 *  RESSERRÉ au catalogue fermé, que `EnveloppeDocument` élargit à `string`. */
export type CharacteristicsData = (Omit<EnveloppeDocument, 'id'> & { id: z.infer<typeof characteristicIdSchema> } & z.infer<
    z.ZodObject<typeof champs>
  >)[];
