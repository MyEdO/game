/**
 * Schéma de `materials.json` — LE dataset des matières du monde (#1686 lot 2), consommé comme
 * `MaterialEntry[]` (`src/data/materials.types.ts`), en trois domaines : les matières de décor
 * volumique, celles de toiture (les couvertures et le « plan » vu du dessus, marqué `vueDeDessus`),
 * celles de relief.
 *
 * Le champ de charge `domain` porte l'identité : ses valeurs sont celles de `MaterialRef.domain`
 * (`src/gameIso/builders/types.ts`), servies par `DOMAINES_MATIERE`, qui les tient sous `satisfies`.
 *
 * UNE SEULE FORME D'ENTRÉE, la disjonction portée par un REFINE ⟺ (`affinerEntree`, patron
 * `defs/oups.ts`) : toutes les clés de charge sont déclarées `.optional()`, et le refine (1) EXIGE
 * par domaine ses clés requises, (2) REFUSE toute clé d'un AUTRE domaine, nommément. Une union de
 * trois `strictObject` dirait la même chose au parse, mais elle n'a ni `.shape` ni enveloppe :
 * `document()` ne saurait y poser ni sa provenance, ni son `type`, ni ses métas d'édition.
 *
 * CHARGE COMMUNE = ∅ (mesuré) : aucune clé n'est partagée par les trois domaines — `detail` l'est par
 * `roof` et `relief`, et par eux seuls. Aucun renommage : `color` (décor), `N`/`E`/`S`/`O` (pentes de
 * toit) et `face` (relief) ne sont pas la même forme (`src/gameIso/backends/webgl/faceColors.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { couleurHexSchema, detailRecipeSchema, enumNomme } from '../grammaire/valeurs';
import { type MaterialDomain } from '../../materials.types';

export const file = 'materials.json';
export const famille = 'entite';

/**
 * CHAMP DISCRIMINANT du document : celui dont la valeur PARTITIONNE ses entrées (ici l'enum
 * `DOMAINES_MATIERE` du champ `domain`, déclaré juste dessous). Le def POSSÈDE son discriminant — la
 * fabrique de référence n'en connaît aucun cas particulier. `npm run gen` en dérive la table
 * `IDS_PAR_DISCRIMINANT` (`schemas/_ids.generated.ts`), contre laquelle `idDe('material', 'prop')`
 * refine AU PARSE : un id du BON dataset mais du MAUVAIS domaine est refusé, nommément.
 */
export const discriminant = 'domain';

/**
 * Libellés FR des DOMAINES — les valeurs du champ discriminant, nommées à UN endroit : cette table EST
 * l'univers du champ (`enumNomme`, plus bas), le Codex en titre ses groupes et le `select` de l'atelier
 * en fait ses options.
 */
const LIBELLES_DE_DOMAINE = {
  prop: 'Décor',
  roof: 'Toiture',
  relief: 'Relief',
} as const satisfies Record<MaterialDomain, string>;

/**
 * Clés de CHARGE par domaine — la déclaration dont le refine tire ses DEUX verdicts (requis manquant,
 * clé étrangère). `requises` ⊆ `cles` ; ce qui n'est pas requis est optionnel dans ce domaine.
 */
const CHARGE_PAR_DOMAINE = {
  prop: { cles: ['color', 'roughness', 'metalness'], requises: ['color', 'roughness', 'metalness'] },
  roof: {
    cles: [
      'couverture', 'vueDeDessus', 'detail', 'N', 'E', 'S', 'O', 'line',
      'planBody', 'planEdge', 'planInner', 'planText',
      'eaveOverhangM', 'soffite', 'fasciaDropM', 'fasciaThickM', 'fascia', 'ridgeCap',
    ],
    requises: [],
  },
  relief: { cles: ['built', 'detail', 'face', 'foot', 'slopeTop', 'shadeDark'], requises: ['face'] },
} as const satisfies Record<MaterialDomain, { cles: readonly string[]; requises: readonly string[] }>;

/**
 * CHARGE par valeur du DISCRIMINANT, telle que la lit l'atelier (`SchemaDef.chargeParDiscriminant`,
 * émise par `npm run gen`) : une entrée de matière n'édite que les champs de SON domaine, jamais
 * l'union des trois. Dérivée de la table ci-dessus — le refine et le formulaire lisent la MÊME
 * déclaration.
 */
export const chargeParDiscriminant: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(CHARGE_PAR_DOMAINE).map(([domaine, charge]) => [domaine, charge.cles as readonly string[]]),
);

/** Toutes les clés de charge du document, dérivées de la table ci-dessus. */
const CLES_DE_CHARGE = new Set(Object.values(CHARGE_PAR_DOMAINE).flatMap((d) => d.cles as readonly string[]));

const doc = document(
  'materials',
  famille,
  {
    domain: enumNomme(LIBELLES_DE_DOMAINE),
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
      hint: 'Ce que la matière peint : décor volumique, toiture, relief — les clés admises en dépendent',
    },
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
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as Record<string, unknown>;
        const domaine = e.domain as keyof typeof CHARGE_PAR_DOMAINE;
        const charge = CHARGE_PAR_DOMAINE[domaine];
        if (!charge) return;
        const admises = new Set<string>(charge.cles);
        for (const cle of charge.requises as readonly string[]) {
          if (e[cle] === undefined) {
            ctx.addIssue({
              code: 'custom',
              path: [cle],
              message: `materials : le domaine « ${domaine} » EXIGE la clé « ${cle} » (${String(e.id)}).`,
            });
          }
        }
        for (const cle of Object.keys(e)) {
          if (!CLES_DE_CHARGE.has(cle) || admises.has(cle) || e[cle] === undefined) continue;
          ctx.addIssue({
            code: 'custom',
            path: [cle],
            message: `materials : la clé « ${cle} » n’appartient pas au domaine « ${domaine} » (${String(e.id)}).`,
          });
        }
        // Une matière de toiture COUVRE un pan, ou elle EST le plan vu du dessus (#1691) — jamais les
        // deux : le plan n'a ni pente ni égout, la couverture n'est pas une convention de plan.
        if (e.couverture !== undefined && e.vueDeDessus !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['vueDeDessus'],
            message: `materials : « ${String(e.id)} » ne peut pas être à la fois une couverture de pan et le plan vu du dessus.`,
          });
      }),
    // Le PLAN vu du dessus est une entrée NOMMÉE par sa donnée, pas par un id littéral au call-site
    // (`gameIso/authoring/roofsSvg.ts` la lit via `matierePlan()`) : le dataset en porte EXACTEMENT une.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const plans = (v as { id: string; vueDeDessus?: true }[]).filter((e) => e.vueDeDessus);
        if (plans.length === 1) return;
        ctx.addIssue({
          code: 'custom',
          path: ['vueDeDessus'],
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
