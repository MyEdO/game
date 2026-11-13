/**
 * Schéma de `garde-robe.json` — LA garde-robe des éléments 3D (#2972 v4, #3114, #3113) : les clés des
 * éléments portés sur le corps (têtes, coiffures, tenues, pièces), collection à discriminant `kind`, la NATURE d'une ligne (doctrine
 * `user-direction-fusion-json-par-type`), patron `defs/materials.ts`.
 *
 * - `tete` : la tête d'une race de rendu, dont l'`id` est celui de cette race (`raceAppearance.json`, #3113) ;
 *   aucune autre ligne ne porte un id de race.
 * - `coiffure` : une coiffure, non sexuée (#3113).
 * - `tenue` : une tenue portée sur le corps, que revêt l'ensemble qui l'habille (#3116), et les `carrieres` dont elle est
 *   la tenue (#3456), une carrière dans une tenue au plus.
 * - `emplacement` : un point d'accroche d'accessoire.
 * - `piece` : une pièce d'habit (`categorie`) ; une pièce d'`accessoire` nomme son `emplacement`,
 *   toute autre n'en porte aucun ; une pièce d'`armure` peut nommer les `localisations` qu'elle couvre (LDB 13
 *   l.140-145), qu'une armure portée qui les couvre revêt (#3456).
 * - `variante` (#3446) : une autre apparence de la `piece` qu'elle nomme, sans en recopier la catégorie ni
 *   l'emplacement ; un élément 3D de variante porte la clé `{ piece: <id de variante> }`.
 * - `ensemble` : ce qu'`habille` (référence typée `{ id, type }` : un objet ou une tenue de cette garde-robe) revêt, la liste ordonnée de ses `pieces` ; un même `habille` ne figure qu'une fois.
 * - `embleme` (#3111) : un dessin posé au montage sur les surfaces `blason` d'un élément (`hotes/godot/pont/CONTRAT.md`,
 *   « Atelier 3D ») ; `svg` est un document SVG complet, couleurs comprises, à `viewBox` carré.
 *
 * Les références internes (`emplacement` `{ id }`, `pieces`) résolvent au parse contre les sous-listes
 * discriminées de l'espace `garde-robe.json` (`ref`/`refs` à `sousListe`) ; l'`id` de chaque ligne, contre
 * `raceAppearance.json` (`idsDe('raceAppearance')`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { idsDe, ref, refMorte, refs, refTypee } from '../grammaire/ref';
import { enumNomme, hitLocationSchema } from '../grammaire/valeurs';
import type { IdsParEspace } from '../_ids.generated';
import { estObjet } from '../../../lib/objet.mjs';

export const file = 'garde-robe.json';
export const famille = 'entite';

/** Valeurs du discriminant `kind`. */
const LIBELLES_DE_KIND = {
  tete: 'Tête',
  coiffure: 'Coiffure',
  tenue: 'Tenue',
  emplacement: 'Emplacement',
  piece: 'Pièce',
  variante: 'Variante',
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
 * Clés de CHARGE par `kind` (`espace.chargeParDiscriminant`) — la déclaration dont `refusDeCharge`
 * (`grammaire/collection-cle.ts`) tire ses DEUX verdicts au parse (requis manquant, clé étrangère), et
 * `document()` le type de chaque `kind`.
 */
const chargeParDiscriminant = {
  tete: [],
  coiffure: [],
  tenue: ['carrieres'],
  emplacement: [],
  piece: ['categorie', 'emplacement', 'localisations'],
  variante: ['piece'],
  ensemble: ['habille', 'pieces'],
  embleme: ['svg'],
} as const satisfies Record<Kind, readonly string[]>;

/** Clés EXIGÉES d'un `kind` qui n'exige pas toute sa charge (`espace.requisesParDiscriminant`) ; le reste de sa charge
 *  y est optionnel. */
const requisesParDiscriminant = {
  tenue: [],
  piece: ['categorie'],
} as const satisfies { readonly [K in keyof typeof chargeParDiscriminant]?: readonly (typeof chargeParDiscriminant)[K][number][] };

/** Une nature de ligne. */
type Kind = keyof typeof LIBELLES_DE_KIND;

/** Une ligne d'une autre nature qu'une pièce. */
type HorsPiece = { kind: Exclude<Kind, 'piece'> };

/** L'id d'une ligne lue, pour un message. */
const idLu = (ligne: unknown): string => String(estObjet(ligne) ? ligne.id : ligne);

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

/** Ce qu'un ensemble habille : un objet, ou une tenue de la sous-liste `tenue` de cette garde-robe (#3116, #3456). */
const habilleSchema = refTypee(enumNomme({ trapping: 'Objet', tenue: 'Tenue' }), { tenue: { type: 'gardeRobe', sousListe: 'tenue' } });

/** Clé d'unicité d'un `habille` : le couple `{ type, id }` (garde de doublon, index `findEnsembleParHabille` de `src/data/index.ts`). */
export function cleDHabille(h: HabilleDEnsemble): string {
  return JSON.stringify([h.type, h.id]);
}

const doc = document(
  'garde-robe',
  famille,
  {
    kind: enumNomme(LIBELLES_DE_KIND),
    categorie: enumNomme(LIBELLES_DE_CATEGORIE).optional(),
    emplacement: ref('gardeRobe', undefined, 'emplacement').optional(),
    piece: ref('gardeRobe', undefined, 'piece').optional(),
    localisations: z.array(hitLocationSchema).min(1).optional(),
    carrieres: refs('career', { min: 1 }).optional(),
    habille: habilleSchema.optional(),
    pieces: refs('gardeRobe', { min: 1, sousListe: 'piece' }).optional(),
    svg: z.string().optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Tête, coiffure, tenue, emplacement d’accessoire, pièce d’habit, variante de pièce, ensemble ou emblème — les clés admises en dépendent' },
    categorie: { label: 'Catégorie', hint: 'Vêtement, armure ou accessoire' },
    emplacement: { label: 'Emplacement', hint: 'Point d’accroche d’une pièce d’accessoire' },
    piece: { label: 'Pièce', hint: 'La pièce dont la variante est une autre apparence' },
    localisations: { label: 'Localisations', hint: 'Localisations que couvre une pièce d’armure, revêtue par l’armure portée qui les couvre' },
    carrieres: { label: 'Carrières', hint: 'Carrières dont c’est la tenue' },
    habille: { label: 'Habille', hint: 'L’objet ou la tenue que l’ensemble revêt' },
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
      entree
        .refine((e): e is HorsPiece | { localisations?: undefined } | { categorie: 'armure' } => e.kind !== 'piece' || !Array.isArray(e.localisations) || !e.localisations.length || e.categorie === 'armure', {
          path: ['localisations'],
          error: (iss) => `garde-robe : la pièce « ${idLu(iss.input)} » n’est pas une armure — elle ne couvre aucune localisation.`,
        })
        .refine(
          (e): e is HorsPiece | { categorie: 'accessoire'; emplacement: object } | { categorie: Exclude<CategorieDePiece, 'accessoire'>; emplacement?: undefined } =>
            e.kind !== 'piece' || (e.categorie === 'accessoire') === (e.emplacement !== undefined),
          {
            path: ['emplacement'],
            error: (iss) =>
              estObjet(iss.input) && iss.input.categorie === 'accessoire'
                ? `garde-robe : la pièce d’accessoire « ${idLu(iss.input)} » EXIGE son emplacement.`
                : `garde-robe : la pièce « ${idLu(iss.input)} » n’est pas un accessoire — elle ne porte aucun emplacement.`,
          },
        )
        .superRefine((v, ctx) => {
          const e = v as Record<string, unknown> & { id: string; kind: Kind };
          if (e.kind === 'piece') {
            const localisations = (e.localisations ?? []) as readonly string[];
            const repetees = localisations.filter((l, i) => localisations.indexOf(l) !== i);
            if (repetees.length) ctx.addIssue({ code: 'custom', path: ['localisations'], message: `garde-robe : la pièce « ${e.id} » répète ${repetees.join(', ')}.` });
          }
          if ((e.kind === 'tete') !== idsDe('raceAppearance').has(e.id))
            ctx.addIssue({
              code: 'custom',
              path: ['id'],
              message:
                e.kind === 'tete'
                  ? `garde-robe : la tête « ${e.id} » porte l’id de sa race de rendu — ${refMorte('raceAppearance', e.id)}`
                  : `garde-robe : « ${e.id} » (kind « ${e.kind} ») porte l’id d’une race de rendu (raceAppearance.json), que seule une tête porte.`,
            });
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
        const tenues = new Map<string, string>();
        (v as readonly { id: string; kind: string; carrieres?: readonly string[] }[]).forEach((e, i) =>
          (e.carrieres ?? []).forEach((carriere, j) => {
            const premiere = tenues.get(carriere);
            if (premiere === undefined) tenues.set(carriere, e.id);
            else ctx.addIssue({ code: 'custom', path: [i, 'carrieres', j], message: `garde-robe : la carrière « ${carriere} » est la tenue de « ${premiere} » et de « ${e.id} ».` });
          }),
        );
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

/** Id d'une tenue : la sous-liste `kind=tenue` de l'espace `garde-robe.json` (`npm run gen`). */
export type TenueId = IdsParEspace['garde-robe.json?kind=tenue'];

/** Id d'une pièce : la sous-liste `kind=piece` de l'espace `garde-robe.json` (`npm run gen`). */
export type PieceId = IdsParEspace['garde-robe.json?kind=piece'];

/** Id d'un emplacement : la sous-liste `kind=emplacement` de l'espace `garde-robe.json` (`npm run gen`). */
export type EmplacementId = IdsParEspace['garde-robe.json?kind=emplacement'];

/** Ce qu'un ensemble habille : un objet ou une tenue. */
export type HabilleDEnsemble = z.output<typeof habilleSchema>;
