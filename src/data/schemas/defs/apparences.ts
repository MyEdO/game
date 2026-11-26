/**
 * Schéma de `apparences.json` — registre des racines d'identité et des variantes d'apparence (#2948, #4649), collection à
 * discriminant (patron des documents de `miscast.json`, `rangeesDe`, `src/data/schemas/rangees.ts` ; doctrine
 * `user-direction-fusion-json-par-type`).
 *
 * Une entrée SANS `forme` est une RACINE : elle identifie la forme et fournit son apparence par défaut.
 * Elle peut définir le `maniement` et fixer la forme à la naissance. Le profil et les Atouts de l'objet
 * sont définis dans `trappings.json`. Une entrée AVEC `forme` est une VARIANTE de cette racine avec ses
 * étiquettes de naissance. Ses `qualites` sont des Qualités d'ASPECT (`aspect`, `qualities.json`).
 *
 * Le marqueur `forme` (paramètre `espace.marqueurs`) ouvre la sous-liste des variantes : les RACINES
 * sont l'espace privé de ce marqueur, `RACINE_D_APPARENCE` (`grammaire/sousListes.ts`), que visent
 * `forme` ici et `shape`/`formChoices` de `trappings.json`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { affinerAvecCatalogues, ref, refs } from '../grammaire/ref';
import { RACINE_D_APPARENCE } from '../grammaire/sousListes';
import { maniementSchema } from '../grammaire/valeurs';

export const file = 'apparences.json';
export const famille = 'entite';

/** Clés d'une VARIANTE : une racine n'en porte aucune. */
const CLES_DE_VARIANTE = ['especes', 'classes', 'qualites'] as const;

/** Clés d'une RACINE : une variante suit celles de sa forme. */
const CLES_DE_RACINE = ['maniement', 'formeFixeeALaNaissance'] as const;

const doc = document(
  'apparences',
  famille,
  {
    forme: ref('apparence', undefined, RACINE_D_APPARENCE).optional(),
    especes: refs('species').optional(),
    classes: refs('classe').optional(),
    qualites: refs('quality').optional(),
    maniement: maniementSchema.optional(),
    formeFixeeALaNaissance: z.literal(true).optional(),
  },
  {
    forme: { label: 'Forme', hint: 'Racine dont cette entrée est une variante — absente, l’entrée EST une forme et son apparence par défaut' },
    especes: { label: 'Espèces', hint: 'Espèces dont un objet de cette forme naît avec cette apparence' },
    classes: { label: 'Classes de carrière', hint: 'Classes de carrière dont un objet de cette forme naît avec cette apparence' },
    qualites: { label: 'Qualités', hint: 'Qualité d’aspect qui fait naître l’objet avec cette apparence' },
    maniement: { label: 'Maniement', hint: 'Animation d’une arme de cette forme — absent, celle de son Groupe' },
    formeFixeeALaNaissance: {
      label: 'Forme fixée à la naissance',
      hint: 'Après la création de l’objet, son apparence peut changer au sein de la même forme racine',
    },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'registre des racines d’identité et des variantes d’apparence des objets, édité dans `src/data/apparences.json`',
      },
    },
    edit: { none: 'registre des formes et apparences d’objet, édité dans `src/data/apparences.json`', dataset: 'apparences' },
  },
  {
    espace: { marqueurs: ['forme'] },
    affinerEntree: (entree) =>
      affinerAvecCatalogues(entree, (lire) => {
        const estDAspect = lire.catalogue('quality').porteLeMarqueur('aspect');
        return (v, ctx) => {
          const e = v as { id: string; forme?: unknown; qualites?: readonly string[] } & Record<string, unknown>;
          if (e.forme === undefined)
            for (const cle of CLES_DE_VARIANTE)
              if (e[cle] !== undefined)
                ctx.addIssue({
                  code: 'custom',
                  path: [cle],
                  message: `apparences : « ${e.id} » est une racine (sans \`forme\`) — l’étiquette « ${cle} » n’appartient qu’à une variante.`,
                });
          if (e.forme !== undefined)
            for (const cle of CLES_DE_RACINE)
              if (e[cle] !== undefined)
                ctx.addIssue({
                  code: 'custom',
                  path: [cle],
                  message: `apparences : « ${e.id} » est une variante — « ${cle} » n’appartient qu’à sa racine.`,
                });
          for (const q of e.qualites ?? [])
            if (!estDAspect(q))
              ctx.addIssue({
                code: 'custom',
                path: ['qualites'],
                message: `apparences : « ${q} » (${e.id}) n’est pas une Qualité d’aspect (\`aspect\`, \`qualities.json\`).`,
              });
        };
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

