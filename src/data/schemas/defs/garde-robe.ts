/**
 * Schéma de `garde-robe.json` — LA garde-robe des éléments 3D (#2972 v4, #3114) : collection à
 * discriminant `kind` (doctrine `user-direction-fusion-json-par-type`), patron `defs/materials.ts`.
 *
 * - `emplacement` : un point d'accroche d'accessoire.
 * - `piece` : une pièce d'habit (`categorie`) ; une pièce d'`accessoire` nomme son `emplacement`,
 *   toute autre n'en porte aucun.
 * - `ensemble` : ce qu'`habille` (référence typée `{ id, type }` : un objet ou une apparence)
 *   revêt, la liste ordonnée de ses `pieces`. Son `id` vaut `<type>-<id>` : l'unicité des ids tient
 *   « un même `habille` ne figure qu'une fois ».
 *
 * Les références internes (`emplacement` `{ id }`, `pieces`) résolvent au parse contre les sous-listes
 * discriminées de l'espace `garde-robe.json` (`ref`/`refs` à `sousListe`).
 */
import { document } from '../grammaire/document';
import { ref, refs, refTypee, type RefTypee } from '../grammaire/ref';
import { enumNomme } from '../grammaire/valeurs';
import type { IdsParEspace } from '../_ids.generated';

export const file = 'garde-robe.json';
export const famille = 'entite';

/** Valeurs du discriminant `kind`. */
const LIBELLES_DE_KIND = {
  emplacement: 'Emplacement',
  piece: 'Pièce',
  ensemble: 'Ensemble',
} as const;

/** Catégories d'une pièce. */
const LIBELLES_DE_CATEGORIE = {
  vetement: 'Vêtement',
  armure: 'Armure',
  accessoire: 'Accessoire',
} as const;

/** Catégorie d'une pièce de garde-robe. */
export type CategorieDePiece = keyof typeof LIBELLES_DE_CATEGORIE;

/**
 * Clés de CHARGE par `kind` — la déclaration dont `refusDeCharge` (`grammaire/collection-cle.ts`) tire
 * ses DEUX verdicts (requis manquant, clé étrangère). `requises` ⊆ `cles` ; ce qui n'est pas requis est
 * optionnel dans ce `kind`.
 */
const CHARGE_PAR_KIND = {
  emplacement: { cles: [], requises: [] },
  piece: { cles: ['categorie', 'emplacement'], requises: ['categorie'] },
  ensemble: { cles: ['habille', 'pieces'], requises: ['habille', 'pieces'] },
} as const satisfies Record<keyof typeof LIBELLES_DE_KIND, { cles: readonly string[]; requises: readonly string[] }>;

/** CHARGE par valeur du DISCRIMINANT (`espace.chargeParDiscriminant`), dérivée de la table ci-dessus. */
const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_KIND).map(([kind, charge]) => [kind, charge.cles as readonly string[]]),
);

/** Clés EXIGÉES par valeur du discriminant (`espace.requisesParDiscriminant`), dérivées de la table ci-dessus. */
const requisesParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_KIND).map(([kind, charge]) => [kind, charge.requises as readonly string[]]),
);

/** Ce qu'un ensemble habille : un objet ou une apparence. */
const habilleSchema = refTypee(enumNomme({ trapping: 'Objet', apparence: 'Apparence' }));

const doc = document(
  'garde-robe',
  famille,
  {
    kind: enumNomme(LIBELLES_DE_KIND),
    categorie: enumNomme(LIBELLES_DE_CATEGORIE).optional(),
    emplacement: ref('gardeRobe', undefined, 'emplacement').optional(),
    habille: habilleSchema.optional(),
    pieces: refs('gardeRobe', { min: 1, sousListe: 'piece' }).optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Emplacement d’accessoire, pièce d’habit ou ensemble — les clés admises en dépendent' },
    categorie: { label: 'Catégorie', hint: 'Vêtement, armure ou accessoire' },
    emplacement: { label: 'Emplacement', hint: 'Point d’accroche d’une pièce d’accessoire' },
    habille: { label: 'Habille', hint: 'L’objet ou l’apparence que l’ensemble revêt' },
    pieces: { label: 'Pièces', hint: 'Pièces de l’ensemble, dans l’ordre' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'garde-robe des éléments 3D (art, pas règle) — aucune catégorie du Codex ne l’expose, aucun écran ne l’écrit : elle s’édite au fichier `src/data/garde-robe.json`',
      },
    },
    edit: { none: 'vocabulaire d’art, édité au fichier `src/data/garde-robe.json` — aucun écran ne l’écrit', dataset: 'gardeRobe' },
  },
  {
    espace: { discriminant: 'kind', chargeParDiscriminant, requisesParDiscriminant },
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as Record<string, unknown> & { id: string; kind: keyof typeof CHARGE_PAR_KIND };
        if (e.kind === 'piece') {
          if ((e.categorie === 'accessoire') !== (e.emplacement !== undefined))
            ctx.addIssue({
              code: 'custom',
              path: ['emplacement'],
              message:
                e.categorie === 'accessoire'
                  ? `garde-robe : la pièce d’accessoire « ${e.id} » EXIGE son emplacement.`
                  : `garde-robe : la pièce « ${e.id} » n’est pas un accessoire — elle ne porte aucun emplacement.`,
            });
        }
        if (e.kind === 'ensemble') {
          const habille = e.habille as RefTypee | undefined;
          if (habille !== undefined && e.id !== `${habille.type}-${habille.id}`)
            ctx.addIssue({ code: 'custom', path: ['id'], message: `garde-robe : l’ensemble « ${e.id} » doit s’appeler « ${habille.type}-${habille.id} ».` });
          const pieces = (e.pieces ?? []) as readonly string[];
          const doublons = pieces.filter((p, i) => pieces.indexOf(p) !== i);
          if (doublons.length)
            ctx.addIssue({ code: 'custom', path: ['pieces'], message: `garde-robe : l’ensemble « ${e.id} » répète ${doublons.join(', ')}.` });
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** Id d'une pièce : la sous-liste `kind=piece` de l'espace `garde-robe.json` (`npm run gen`). */
export type PieceId = IdsParEspace['garde-robe.json?kind=piece'];

/** Id d'un emplacement : la sous-liste `kind=emplacement` de l'espace `garde-robe.json` (`npm run gen`). */
export type EmplacementId = IdsParEspace['garde-robe.json?kind=emplacement'];

/** VUE TS d'une ligne `piece` — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`). */
export interface PieceDef {
  id: PieceId;
  type: 'garde-robe';
  kind: 'piece';
  label: string;
  categorie: CategorieDePiece;
  emplacement?: { id: EmplacementId };
}

/** VUE TS d'une ligne de la garde-robe. */
export type GardeRobeEntree =
  | { id: string; type: 'garde-robe'; kind: 'emplacement'; label: string }
  | PieceDef
  | { id: string; type: 'garde-robe'; kind: 'ensemble'; label: string; habille: RefTypee<'trapping' | 'apparence'>; pieces: PieceId[] };
