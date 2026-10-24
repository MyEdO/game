/**
 * Schéma de `apparences.json` — LE catalogue des apparences d'objet (#2948), collection à
 * discriminant (patron `miscastRoot`/`miscastEntries`, `src/data/overrides.ts` ; doctrine
 * `user-direction-fusion-json-par-type`).
 *
 * Une entrée SANS `forme` est une RACINE : une forme, et sa propre apparence par défaut — « une seule
 * apparence par défaut par forme » tient par construction. Une racine ne porte que `id` et `label` :
 * aucun fait de règle (type, Groupe, bouclier : `categorie`, `subType`, `shield` de `trappings.json`).
 * Une entrée AVEC `forme` est une VARIANTE de cette racine, avec ses étiquettes de naissance.
 *
 * Le marqueur `forme` (paramètre `espace.marqueurs`) ouvre la sous-liste des variantes : les RACINES
 * sont l'espace privé de ce marqueur, `RACINE_D_APPARENCE` (`grammaire/sousListes.ts`), que visent
 * `forme` ici et `shape`/`formChoices` de `trappings.json`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idDe, ref } from '../grammaire/ref';
import { RACINE_D_APPARENCE } from '../grammaire/sousListes';

export const file = 'apparences.json';
export const famille = 'entite';

/** LDB 60 l.24,52 */
const QUALITES_DE_NAISSANCE = ['raffine', 'laid'] as const;

/** Clés d'une VARIANTE : une racine n'en porte aucune. */
const CLES_DE_VARIANTE = ['especes', 'classes', 'qualites'] as const;

const doc = document(
  'apparences',
  famille,
  {
    forme: ref('apparence', undefined, RACINE_D_APPARENCE).optional(),
    especes: z.array(idDe('species')).optional(),
    classes: z.array(idDe('classe')).optional(),
    qualites: z.array(idDe('quality')).optional(),
  },
  {
    forme: { label: 'Forme', hint: 'Racine dont cette entrée est une variante — absente, l’entrée EST une forme et son apparence par défaut' },
    especes: { label: 'Espèces', hint: 'Espèces dont un objet de cette forme naît avec cette apparence' },
    classes: { label: 'Classes de carrière', hint: 'Classes de carrière dont un objet de cette forme naît avec cette apparence' },
    qualites: { label: 'Qualités', hint: 'Qualité d’objet (Raffiné, Laid) qui fait naître l’objet avec cette apparence' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'catalogue des apparences d’objet (art, pas règle) — aucune catégorie du Codex ne l’expose, aucun écran ne l’écrit : il s’édite au fichier `src/data/apparences.json`',
      },
    },
    edit: { none: 'catalogue d’art, édité au fichier `src/data/apparences.json` — aucun écran ne l’écrit', dataset: 'apparences' },
  },
  {
    espace: { marqueurs: ['forme'] },
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; forme?: unknown; qualites?: readonly string[] } & Record<string, unknown>;
        if (e.forme === undefined)
          for (const cle of CLES_DE_VARIANTE)
            if (e[cle] !== undefined)
              ctx.addIssue({
                code: 'custom',
                path: [cle],
                message: `apparences : « ${e.id} » est une racine (sans \`forme\`) — l’étiquette « ${cle} » n’appartient qu’à une variante.`,
              });
        for (const q of e.qualites ?? [])
          if (!(QUALITES_DE_NAISSANCE as readonly string[]).includes(q))
            ctx.addIssue({
              code: 'custom',
              path: ['qualites'],
              message: `apparences : « ${q} » (${e.id}) n’est pas une qualité de naissance — admises : ${QUALITES_DE_NAISSANCE.join(', ')}.`,
            });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** VUE TS d'une entrée — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`). */
export interface ApparenceData {
  id: string;
  type: 'apparences';
  label: string;
  forme?: { id: string };
  especes?: string[];
  classes?: string[];
  qualites?: string[];
}
