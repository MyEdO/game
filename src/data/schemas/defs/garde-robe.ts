/**
 * Schéma de `garde-robe.json` — LA garde-robe des éléments 3D (#2972 v4, #3114, #3113) : les clés des
 * éléments portés sur le corps (têtes, coiffures, tenues, pièces), collection à discriminant `kind`, la NATURE d'une ligne (doctrine
 * `user-direction-fusion-json-par-type`), patron `defs/materials.ts`.
 *
 * - `tete` : la tête d'une espèce jouable (`species.json`), qui nomme sa `race` de rendu
 *   (`raceAppearance.json`, #3113) et dont l'`id` vaut celui de sa `race` ; têtes monstrueuses : #3123.
 * - `coiffure` : une coiffure, non sexuée (#3113).
 * - `tenue` : une tenue portée sur le corps, que revêt l'ensemble qui l'habille (#3116).
 * - `emplacement` : un point d'accroche d'accessoire.
 * - `piece` : une pièce d'habit (`categorie`) ; une pièce d'`accessoire` nomme son `emplacement`,
 *   toute autre n'en porte aucun.
 * - `ensemble` : ce qu'`habille` (référence typée `{ id, type }` : un objet, une apparence ou une tenue de
 *   cette garde-robe) revêt, la liste ordonnée de ses `pieces` ; un même `habille` ne figure qu'une fois.
 * - `embleme` (#3111) : un dessin posé au montage sur les surfaces `blason` d'un élément (`hotes/godot/pont/CONTRAT.md`,
 *   « Atelier 3D ») ; `svg` est un document SVG complet, couleurs comprises, à `viewBox` carré.
 *
 * Les références internes (`emplacement` `{ id }`, `pieces`) résolvent au parse contre les sous-listes
 * discriminées de l'espace `garde-robe.json` (`ref`/`refs` à `sousListe`) ; la `race` d'une tête, contre
 * `raceAppearance.json`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { ref, refs, refTypee, type RefTypee } from '../grammaire/ref';
import { enumNomme } from '../grammaire/valeurs';
import type { IdsParEspace } from '../_ids.generated';

export const file = 'garde-robe.json';
export const famille = 'entite';

/** Valeurs du discriminant `kind`. */
const LIBELLES_DE_KIND = {
  tete: 'Tête',
  coiffure: 'Coiffure',
  tenue: 'Tenue',
  emplacement: 'Emplacement',
  piece: 'Pièce',
  ensemble: 'Ensemble',
  embleme: 'Emblème',
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
  tete: { cles: ['race'], requises: ['race'] },
  coiffure: { cles: [], requises: [] },
  tenue: { cles: [], requises: [] },
  emplacement: { cles: [], requises: [] },
  piece: { cles: ['categorie', 'emplacement'], requises: ['categorie'] },
  ensemble: { cles: ['habille', 'pieces'], requises: ['habille', 'pieces'] },
  embleme: { cles: ['svg'], requises: ['svg'] },
} as const satisfies Record<keyof typeof LIBELLES_DE_KIND, { cles: readonly string[]; requises: readonly string[] }>;

/** CHARGE par valeur du DISCRIMINANT (`espace.chargeParDiscriminant`), dérivée de la table ci-dessus. */
const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_KIND).map(([kind, charge]) => [kind, charge.cles as readonly string[]]),
);

/** Clés EXIGÉES par valeur du discriminant (`espace.requisesParDiscriminant`), dérivées de la table ci-dessus. */
const requisesParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_KIND).map(([kind, charge]) => [kind, charge.requises as readonly string[]]),
);

/** Ce qui peut précéder la racine d'un document SVG : prologue XML, commentaire, doctype (sous-ensemble interne compris). */
const PROLOGUE_SVG = /^(?:\s+|<\?xml\b[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE\b[^>[]*(?:\[[\s\S]*?\])?\s*>)*/;

/** La valeur de l'attribut `nom` de la balise ouvrante `ouverture`, entre guillemets ou apostrophes, `null` s'il manque. */
const attribut = (ouverture: string, nom: string): string | null => {
  const trouve = new RegExp(`\\s${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(ouverture);
  return trouve ? (trouve[1] ?? trouve[2]) : null;
};

/** Une longueur SVG lue en nombre et unité, `px` valant l'absence d'unité ; `null` si elle n'en est pas une. */
const longueur = (valeur: string): string | null => {
  const lue = /^\s*([+]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex|%)?\s*$/i.exec(valeur);
  return lue && Number(lue[1]) > 0 ? `${Number(lue[1])}${(lue[2] ?? 'px').toLowerCase()}` : null;
};

/** Le refus d'un `svg` d'emblème qui n'est pas un document `<svg …>…</svg>` à `viewBox` carré, ou dont la taille
 *  intrinsèque n'est pas carrée, `null` sinon : `width` et `height`, chacun remplacé à défaut par le côté du `viewBox`,
 *  la taille que l'hôte Godot rastérise (`hotes/godot/pont/CONTRAT.md`, « Atelier 3D »). */
function refusDeSvg(svg: string): string | null {
  const corps = svg.replace(PROLOGUE_SVG, '').trimEnd();
  const ouverture = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/.exec(corps);
  if (!ouverture || !corps.endsWith('</svg>')) return 'n’est pas un document « <svg …>…</svg> »';
  const valeur = attribut(ouverture[0], 'viewBox');
  if (valeur === null) return 'n’a pas de viewBox, carré attendu';
  const nombres = valeur.trim().split(/[\s,]+/).map(Number);
  if (nombres.length !== 4 || !nombres.every(Number.isFinite)) return `porte le viewBox « ${valeur} », quatre nombres attendus`;
  const [, , largeur, hauteur] = nombres;
  if (!(largeur > 0) || largeur !== hauteur) return `porte le viewBox « ${valeur} », carré attendu`;
  const cote = String(largeur);
  const [w, h] = [attribut(ouverture[0], 'width') ?? cote, attribut(ouverture[0], 'height') ?? cote];
  const [lw, lh] = [longueur(w), longueur(h)];
  if (lw === null || lw !== lh) return `a pour taille intrinsèque « ${w} × ${h} » (width et height, côté du viewBox à défaut), carrée attendue`;
  return null;
}

/** Ce qu'un ensemble habille : un objet, une apparence, ou une tenue de la sous-liste `tenue` de cette garde-robe (#3116). */
const habilleSchema = refTypee(enumNomme({ trapping: 'Objet', apparence: 'Apparence', tenue: 'Tenue' }), { tenue: { type: 'gardeRobe', sousListe: 'tenue' } });

/** Clé d'unicité d'un `habille` : le couple `{ type, id }` (garde de doublon, index `findEnsembleParHabille` de `src/data/index.ts`). */
export function cleDHabille(h: HabilleDEnsemble): string {
  return JSON.stringify([h.type, h.id]);
}

const doc = document(
  'garde-robe',
  famille,
  {
    kind: enumNomme(LIBELLES_DE_KIND),
    race: ref('raceAppearance').optional(),
    categorie: enumNomme(LIBELLES_DE_CATEGORIE).optional(),
    emplacement: ref('gardeRobe', undefined, 'emplacement').optional(),
    habille: habilleSchema.optional(),
    pieces: refs('gardeRobe', { min: 1, sousListe: 'piece' }).optional(),
    svg: z.string().optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Tête, coiffure, tenue, emplacement d’accessoire, pièce d’habit, ensemble ou emblème — les clés admises en dépendent' },
    race: { label: 'Race de rendu', hint: 'Apparence d’espèce que la tête habille' },
    categorie: { label: 'Catégorie', hint: 'Vêtement, armure ou accessoire' },
    emplacement: { label: 'Emplacement', hint: 'Point d’accroche d’une pièce d’accessoire' },
    habille: { label: 'Habille', hint: 'L’objet, l’apparence ou la tenue que l’ensemble revêt' },
    pieces: { label: 'Pièces', hint: 'Pièces de l’ensemble, dans l’ordre' },
    svg: { label: 'Dessin', hint: 'Document SVG de l’emblème, à viewBox carré, fond transparent' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'garde-robe des éléments 3D, clés des têtes, coiffures, tenues, pièces portées et emblèmes (art, pas règle) — aucune catégorie du Codex ne l’expose, aucun écran ne l’écrit : elle s’édite au fichier `src/data/garde-robe.json`',
      },
    },
    edit: { none: 'vocabulaire d’art (têtes, coiffures, tenues, pièces portées, emblèmes), édité au fichier `src/data/garde-robe.json` — aucun écran ne l’écrit', dataset: 'gardeRobe' },
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
        if (e.kind === 'tete') {
          const race = e.race as { id: string } | undefined;
          if (race !== undefined && e.id !== race.id)
            ctx.addIssue({ code: 'custom', path: ['id'], message: `garde-robe : la tête « ${e.id} » doit s’appeler « ${race.id} », l’id de sa race.` });
        }
        if (e.kind === 'embleme' && typeof e.svg === 'string') {
          const refus = refusDeSvg(e.svg);
          if (refus) ctx.addIssue({ code: 'custom', path: ['svg'], message: `garde-robe : l’emblème « ${e.id} » ${refus}.` });
        }
        if (e.kind === 'ensemble') {
          const pieces = (e.pieces ?? []) as readonly string[];
          const doublons = pieces.filter((p, i) => pieces.indexOf(p) !== i);
          if (doublons.length)
            ctx.addIssue({ code: 'custom', path: ['pieces'], message: `garde-robe : l’ensemble « ${e.id} » répète ${doublons.join(', ')}.` });
        }
      }),
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const vus = new Map<string, string>();
        (v as readonly { id: string; kind: string; habille?: HabilleDEnsemble }[]).forEach((e, i) => {
          if (e.kind !== 'ensemble' || e.habille === undefined) return;
          const cle = cleDHabille(e.habille);
          const premier = vus.get(cle);
          if (premier === undefined) vus.set(cle, e.id);
          else ctx.addIssue({ code: 'custom', path: [i, 'habille'], message: `garde-robe : les ensembles « ${premier} » et « ${e.id} » habillent tous deux { id: « ${e.habille.id} », type: « ${e.habille.type} » }.` });
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** Id d'une tête : la sous-liste `kind=tete` de l'espace `garde-robe.json` (`npm run gen`). */
export type TeteId = IdsParEspace['garde-robe.json?kind=tete'];

/** Id d'une coiffure : la sous-liste `kind=coiffure` de l'espace `garde-robe.json` (`npm run gen`). */
export type CoiffureId = IdsParEspace['garde-robe.json?kind=coiffure'];

/** Id d'une tenue : la sous-liste `kind=tenue` de l'espace `garde-robe.json` (`npm run gen`). */
export type TenueId = IdsParEspace['garde-robe.json?kind=tenue'];

/** Id d'une pièce : la sous-liste `kind=piece` de l'espace `garde-robe.json` (`npm run gen`). */
export type PieceId = IdsParEspace['garde-robe.json?kind=piece'];

/** Id d'un emplacement : la sous-liste `kind=emplacement` de l'espace `garde-robe.json` (`npm run gen`). */
export type EmplacementId = IdsParEspace['garde-robe.json?kind=emplacement'];

/** VUE TS du tronc commun d'une ligne de nature `K`. */
interface LigneDeNature<K extends string, Id extends string> {
  id: Id;
  type: 'garde-robe';
  kind: K;
  label: string;
}

/** VUE TS d'une ligne `piece` — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`). */
export interface PieceDef extends LigneDeNature<'piece', PieceId> {
  categorie: CategorieDePiece;
  emplacement?: { id: EmplacementId };
}

/** VUE TS d'une ligne `tete`. */
export interface TeteDef extends LigneDeNature<'tete', TeteId> {
  race: { id: IdsParEspace['raceAppearance.json'] };
}

/** VUE TS d'une ligne `coiffure`. */
export type CoiffureDef = LigneDeNature<'coiffure', CoiffureId>;

/** VUE TS d'une ligne `tenue`. */
export type TenueDeGardeRobe = LigneDeNature<'tenue', TenueId>;

/** Ce qu'un ensemble habille : un objet, une apparence ou une tenue. */
export type HabilleDEnsemble = RefTypee<'trapping' | 'apparence'> | { readonly id: TenueId; readonly type: 'tenue' };

/** VUE TS d'une ligne `ensemble`. */
export interface EnsembleDef extends LigneDeNature<'ensemble', string> {
  habille: HabilleDEnsemble;
  pieces: PieceId[];
}

/** VUE TS d'une ligne `embleme`. */
export interface EmblemeDef extends LigneDeNature<'embleme', string> {
  svg: string;
}

/** VUE TS d'une ligne de la garde-robe. */
export type GardeRobeEntree =
  | TeteDef
  | CoiffureDef
  | TenueDeGardeRobe
  | LigneDeNature<'emplacement', string>
  | PieceDef
  | EnsembleDef
  | EmblemeDef;
