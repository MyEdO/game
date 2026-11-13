/**
 * Schéma de `materials.json` — LE dataset des matières du monde (#1686 lot 2), consommé comme
 * `MaterialEntry[]` (`src/data/materials.types.ts`), en cinq domaines : les matières de décor
 * volumique, celles de toiture (les couvertures et le « plan » vu du dessus, marqué `vueDeDessus`),
 * celles de relief, les palettes de teintes d’objet du domaine `objet` et les couleurs nommées du nuancier
 * (`couleur`).
 *
 * Le champ de charge `domain` porte l'identité : ses valeurs sont celles de `DOMAINES_MATIERE`
 * (`src/data/materials.types.ts`), tenues sous `satisfies` contre les domaines de `MaterialRef` plus
 * `objet` et `couleur`, qui vivent hors du pivot de rendu du sol.
 *
 * UNE SEULE FORME D'ENTRÉE, la disjonction portée par la charge par domaine, que `document()` borne
 * au parse (`refusDeCharge`, `grammaire/collection-cle.ts`) : toutes les clés de charge sont déclarées
 * `.optional()`, et la charge (1) EXIGE par domaine ses clés requises, (2) REFUSE toute clé d'un AUTRE
 * domaine, nommément. Une union de
 * cinq `strictObject` dirait la même chose au parse, mais elle n'a ni `.shape` ni enveloppe :
 * `document()` ne saurait y poser ni sa provenance, ni son `type`, ni ses métas d'édition.
 *
 * CHARGE COMMUNE = ∅ : aucune clé n'est partagée par les cinq domaines — `detail` l'est par
 * `roof` et `relief`, `color` par `prop` et `couleur`, et par eux seuls. `N`/`E`/`S`/`O` (pentes de toit),
 * `face` (relief) et `palette` (teinte d’objet) portent des charges distinctes.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema, detailRecipeSchema, enumNomme, surchargePaletteSchema } from '../grammaire/valeurs';
import { type MaterialDomain } from '../../materials.types';
import { estObjet } from '../../../lib/objet.mjs';

export const file = 'materials.json';
export const famille = 'entite';

/**
 * Libellés FR des DOMAINES — les valeurs du champ discriminant, nommées à UN endroit : cette table EST
 * l'univers du champ (`enumNomme`, plus bas), le Codex en titre ses groupes et le `select` de l'atelier
 * en fait ses options.
 */
const LIBELLES_DE_DOMAINE = {
  prop: 'Décor',
  roof: 'Toiture',
  relief: 'Relief',
  objet: 'Objet',
  couleur: 'Couleur',
} as const satisfies Record<MaterialDomain, string>;

/**
 * Clés de CHARGE par domaine (`espace.chargeParDiscriminant`) — la déclaration dont `document()` tire ses DEUX verdicts
 * au parse (requis manquant, clé étrangère : `refusDeCharge`, `grammaire/collection-cle.ts`) et le type de chaque
 * domaine : une entrée de matière ne porte et n'édite que les champs de SON domaine.
 */
const chargeParDiscriminant = {
  objet: ['palette'],
  couleur: ['color'],
  prop: ['color', 'roughness', 'metalness'],
  roof: [
    'couverture', 'vueDeDessus', 'detail', 'N', 'E', 'S', 'O', 'line',
    'planBody', 'planEdge', 'planInner', 'planText',
    'eaveOverhangM', 'soffite', 'fasciaDropM', 'fasciaThickM', 'fascia', 'ridgeCap',
  ],
  relief: ['built', 'detail', 'face', 'foot', 'slopeTop', 'shadeDark'],
} as const satisfies Record<MaterialDomain, readonly string[]>;

/** Clés EXIGÉES d'un domaine qui n'exige pas toute sa charge (`espace.requisesParDiscriminant`) ; le reste de sa charge
 *  y est optionnel. */
const requisesParDiscriminant = {
  roof: [],
  relief: ['face'],
} as const satisfies { readonly [D in MaterialDomain]?: readonly (typeof chargeParDiscriminant)[D][number][] };

const doc = document(
  'materials',
  famille,
  {
    domain: enumNomme(LIBELLES_DE_DOMAINE),
    palette: surchargePaletteSchema.optional(),
    // ── domaine `prop`
    color: couleurHexSchema.optional(),
    roughness: z.number().min(0).max(1).optional(),
    metalness: z.number().min(0).max(1).optional(),
    // ── domaine `roof`
    couverture: z.literal(true).optional(),
    vueDeDessus: z.literal(true).optional(),
    N: z.string().optional(),
    E: z.string().optional(),
    S: z.string().optional(),
    O: z.string().optional(),
    line: z.string().optional(),
    planBody: z.string().optional(),
    planEdge: z.string().optional(),
    planInner: z.string().optional(),
    planText: z.string().optional(),
    eaveOverhangM: z.number().optional(),
    soffite: z.string().optional(),
    fasciaDropM: z.number().optional(),
    fasciaThickM: z.number().optional(),
    fascia: z.string().optional(),
    ridgeCap: z.string().optional(),
    // ── domaine `relief`
    built: z.boolean().optional(),
    face: z.string().optional(),
    foot: z.string().optional(),
    slopeTop: z.string().optional(),
    shadeDark: z.number().optional(),
    // ── `roof` ET `relief`
    detail: detailRecipeSchema.optional(),
  },
  {
    domain: {
      label: 'Domaine',
      hint: 'Ce que la matière peint : décor volumique, toiture, relief, objet — les clés admises en dépendent',
    },
    palette: { label: 'Palette' },
    color: { label: 'Couleur', hint: 'Teinte hexadécimale `#rrggbb` du matériau' },
    roughness: { label: 'Rugosité', hint: 'Réponse mate/brillante à la lumière' },
    metalness: { label: 'Métallicité', hint: 'Part de réponse métallique à la lumière' },
    couverture: {
      label: 'Couvre un pan',
      hint: 'Matériau POSABLE sur une masse de toit — absent : entrée de rendu qui ne couvre rien (vue de dessus)',
    },
    vueDeDessus: {
      label: 'Plan vu du dessus',
      hint: 'Entrée de rendu du PLAN vu du dessus (vue carrée) — elle ne couvre aucun pan ; le dataset en porte exactement une',
    },
    N: { label: 'Couleur face nord' },
    E: { label: 'Couleur face est' },
    S: { label: 'Couleur face sud' },
    O: { label: 'Couleur face ouest' },
    line: { label: 'Couleur de liseré de structure', hint: 'Liseré de structure : faîte, arêtiers et égouts' },
    planBody: { label: 'Couleur du plan (corps)', hint: 'Vue de dessus, toit en plan' },
    planEdge: { label: 'Couleur du plan (bord)', hint: 'Vue de dessus : liseré du contour' },
    planInner: { label: 'Couleur du plan (intérieur)', hint: 'Vue de dessus : cadre intérieur' },
    planText: { label: 'Couleur du plan (texte)', hint: 'Vue de dessus : texte du nom' },
    eaveOverhangM: {
      label: 'Débord d’avant-toit',
      hint: 'Débord du soffite au-delà de l’égout, en CASES (le suffixe M du nom ne dit pas l’unité) — absent, aucun débord',
    },
    soffite: { label: 'Couleur de soffite', hint: 'Sous-face de l’avant-toit' },
    fasciaDropM: { label: 'Hauteur de planche de rive', hint: 'En mètres' },
    fasciaThickM: { label: 'Épaisseur de planche de rive', hint: 'En mètres' },
    fascia: { label: 'Couleur de planche de rive' },
    ridgeCap: { label: 'Couleur de faîtière' },
    built: { label: 'Relief bâti', hint: 'Ouvrage maçonné (vs relief naturel type talus)' },
    face: { label: 'Couleur de face', hint: 'Teinte de la face principale du relief' },
    foot: { label: 'Couleur de pied', hint: 'Falaise : ombre de pied' },
    slopeTop: { label: 'Couleur de nez de pente', hint: 'Rampe : arête haute éclairée de la pente (le pied est dérivé par ombrage)' },
    shadeDark: { label: 'Assombrissement', hint: 'Facteur d’assombrissement de la face sombre' },
    detail: { label: 'Recette de détail' },
  },
  {
    codex: { keys: ['materials'] },
    edit: { dataset: 'materials' },
  },
  {
    espace: { discriminant: 'domain', chargeParDiscriminant, requisesParDiscriminant },
    // Une matière de toiture COUVRE un pan, ou elle EST le plan vu du dessus (#1691) — jamais les deux : le plan n'a ni
    // pente ni égout, la couverture n'est pas une convention de plan.
    affinerEntree: (entree) =>
      entree.refine((e): e is { couverture?: undefined } | { vueDeDessus?: undefined } => e.couverture === undefined || e.vueDeDessus === undefined, {
        path: ['vueDeDessus'],
        error: (iss) => `materials : « ${String(estObjet(iss.input) ? iss.input.id : iss.input)} » ne peut pas être à la fois une couverture de pan et le plan vu du dessus.`,
      }),
    // Le PLAN vu du dessus est une entrée NOMMÉE par sa donnée, pas par un id littéral au call-site
    // (lue via `matierePlan()`) : le dataset en porte EXACTEMENT une.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const plans = (v as { id: string; vueDeDessus?: true }[]).filter((e) => e.vueDeDessus);
        if (plans.length === 1) return;
        ctx.addIssue({
          code: 'custom',
          path: [],
          message:
            `materials.json : ${plans.length} entrée(s) marquée(s) « plan vu du dessus » ` +
            `(${plans.map((e) => e.id).join(', ') || 'aucune'}) — il en faut EXACTEMENT une, celle que le rendu du plan résout.`,
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
