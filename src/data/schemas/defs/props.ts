/**
 * Schéma de `props.json` — accessoires de scène : couche sémantique (solidité/opacité/couvert/lumière),
 * EMPREINTE de grille, recette VOLUMIQUE locale et places assises. Les sous-schémas sont des exports
 * NOMMÉS de ce module (arbitrage vague mobilier), miroir de l'interface `PropData`
 * (`src/data/props.types.ts`) ; l'ENTRÉE elle-même est rendue par `document()`.
 */
import { z } from 'zod';
import { cell2Schema, dir8Schema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';
import { document } from '../grammaire/document';
import { CAP_IDENTITE_PROP, PROP_CYLINDER_AXES, PROP_CYLINDER_SIDES } from '../../props.types';

export const file = 'props.json';
export const famille = 'entite';

/** `PropPoint3` / `PropSize3` (`src/data/props.types.ts`) — repère LOCAL d'une recette de décor, en
 *  MÈTRES sur les trois axes (#1507) : `xM`/`yM` depuis l'ancre du décor, `hM` depuis le sol de la case.
 *  `z.strictObject` : une recette qui porterait encore `x`/`y`/`h` (cases) n'entre pas — c'est le
 *  verrou d'unité, il n'a PAS d'alias. */
export const propPoint3Schema = z.strictObject({ xM: z.number().finite(), yM: z.number().finite(), hM: z.number().finite() });
export const propSize3Schema = z.strictObject({ xM: z.number().finite(), yM: z.number().finite(), hM: z.number().finite() });

/** FOYER d'un décor qui éclaire (`PropPrimitive.emet`, `src/data/props.types.ts`). `true` SEUL est
 *  admis, comme au type : un `emet: false` dirait l'absence en une seconde graphie. Le CARDINAL (une
 *  primitive émettrice au plus) et sa cohérence avec `light` sont vérifiés par `validatePropCatalog` —
 *  ils portent sur la RECETTE ENTIÈRE, pas sur la primitive que ce schéma valide. */
const emetSchema = z.literal(true).optional();

/** `PropPrimitive` (`src/data/props.types.ts`) — volume élémentaire d'une recette : caisse droite,
 *  cylindre à N faces, prisme en pente. `material` réfère un id de `materials.json` DU DOMAINE `prop` :
 *  la sous-liste discriminée (`idDe('material', 'prop')`) refuse AU PARSE une couverture de toit ou une
 *  matière de relief posée sur un volume de décor. */
export const propPrimitiveSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('box'), center: propPoint3Schema, size: propSize3Schema, material: idDe('material', 'prop'), emet: emetSchema }),
  z.strictObject({
    kind: z.literal('cylinder'), center: propPoint3Schema,
    // AXE REQUIS (#1343 lot C) : les clés de `REPERE_D_AXE` (`PROP_CYLINDER_AXES`) ; `longueurM` se mesure le long de lui.
    axis: z.literal(PROP_CYLINDER_AXES), radiusM: z.number().finite(), longueurM: z.number().finite(),
    // CÔTÉS ADMIS : la même source que le type et le validateur de catalogue (`PROP_CYLINDER_SIDES`,
    // `src/data/props.types.ts`) — une union recopiée ici dériverait de l'union TS au premier ajout.
    sides: z.literal(PROP_CYLINDER_SIDES), material: idDe('material', 'prop'), emet: emetSchema,
  }),
  z.strictObject({ kind: z.literal('prism'), center: propPoint3Schema, size: propSize3Schema, slope: z.enum(['x+', 'x-', 'y+', 'y-']), material: idDe('material', 'prop'), emet: emetSchema }),
]);

/** `PropVolumeRecipe` (`src/data/props.types.ts`) — la recette volumique d'un décor. `capIdentite`
 *  déclare le REPÈRE dans lequel la géométrie est écrite : le cap auquel elle sort telle qu'authorée,
 *  égal au défaut du monde (`CAP_IDENTITE_PROP`, même source que le type et `rotatePropLocal` — une
 *  chaîne recopiée ici dériverait au premier changement de repère). REQUIS : une recette écrite sous un
 *  autre repère ne peut pas entrer en silence (#1680 ligne 16). */
export const propVolumeRecipeSchema = z.strictObject({ capIdentite: z.literal(CAP_IDENTITE_PROP), primitives: z.array(propPrimitiveSchema) });

/** `PropSeatSlot` (`src/data/props.types.ts`) — place assise offerte par un décor : ancre MÉTRIQUE du
 *  corps (`propPoint3Schema`), cap du corps assis (Dir8), et case d'ABORD relative à l'ancre de
 *  l'empreinte (`cell2Schema` : un offset de CASE, pas une longueur). */
export const propSeatSlotSchema = z.strictObject({
  // `place-<rang>` — un id de place ne porte JAMAIS de côté (#1680 ligne 16) : le côté vit dans
  // `anchor`/`facing`/`approach`, qui tournent avec le cap de l'instance quand l'id, lui, ne tourne pas.
  // Verrou par CONSTRUCTION : un `place-nord` ne peut plus entrer.
  id: z.string().regex(/^place-\d+$/, 'id de place : `place-<rang>` attendu (un id de place ne porte pas de côté)'),
  anchor: propPoint3Schema,
  facing: dir8Schema,
  approach: cell2Schema,
});

/** `PropData` (`src/data/props.types.ts`) — type de décor app-owned : vérité UNIQUE de l'empreinte,
 *  de la physique, de la recette volumique et des places assises. Entrée de `props.json`, et contrat
 *  partagé par `src/state` (walkability, LdV, lumière) et `src/gameIso` (rendu).
 *  Le `label` de l'enveloppe est le MIROIR du `label` de la def d'ART du même id
 *  (`src/gameIso/catalog/decor/defs/<id>.ts`) — parité gardée par `src/data/props-label-parite.test.ts`. */
const doc = document(
  'props',
  famille,
  {
    solid: z.boolean().optional(),
    opaque: z.boolean().optional(),
    cover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    // `tone` (#1245, L4) = APPARENCE seule (`lightTones.json` : couleur/intensité/vacillement),
    // résolue au bord du rendu ; le RAYON reste la seule chose que le moteur lise d'une source.
    light: z.strictObject({ radiusM: z.number(), tone: z.string().optional() }).optional(),
    foot: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }).optional(),
    volume: propVolumeRecipeSchema.optional(),
    seatSlots: z.array(propSeatSlotSchema).optional(),
  },
  {
    solid: { label: 'Bloque le passage', hint: 'Empêche de marcher sur la case (combat et exploration)' },
    opaque: { label: 'Bloque la vue', hint: 'Coupe la ligne de vue (LdV)' },
    cover: { label: 'Couvert', hint: 'Degré de couvert offert (imparfaite/moyenne/totale)' },
    light: { label: 'Source lumineuse', hint: 'Rayon éclairé (en mètres) et ton optionnel de la source' },
    foot: { label: 'Empreinte au sol', hint: 'Largeur × profondeur en cases occupées par le décor' },
    volume: { label: 'Recette volumique', hint: 'Primitives (caisse/cylindre/prisme) composant le rendu volumique du décor — cotes en mètres' },
    seatSlots: { label: 'Places assises', hint: 'Ancres, orientation et case d’abord des places offertes par le décor' },
  },
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'catalogue des placeables de décor (art, pas règle) — aucune catégorie du Codex ne l’expose ; il s’édite à la palette de l’éditeur de carte',
      },
    },
    edit: { none: 'édité à la PALETTE de décor de l’éditeur de carte, jamais par une catégorie du Codex' },
  },
  {
    /**
     * PROVENANCE PAR CHAMP (#1680 ligne 5). Le DATASET est exempté de provenance (`SANS_LIVRE`) parce
     * que ce qu'il décrit est de l'art : un volume, un libellé, une empreinte, la solidité physique de
     * l'objet — rien de tout cela n'a de table à citer. Trois de ses champs ne sont PAS de l'art : ils
     * portent des concepts que le canon chiffre — l'ÉCLAIRAGE (`light`, LDB 74 l.43/56/58) et le
     * COUVERT (`cover`/`opaque`, LDB 14 l.72/81/86). Une entrée qui en porte un doit donc dire d'OÙ
     * vient sa valeur : `source` quand un folio la donne, `maison` quand elle est extrapolée d'un
     * étalon — jamais rien. C'est l'exemption du dataset qui rendait ces trois champs muets ; le
     * refine la referme à l'ENTRÉE, là où la valeur est écrite.
     */
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; light?: unknown; cover?: unknown; opaque?: unknown; source?: unknown; maison?: unknown; foot?: unknown; volume?: unknown; seatSlots?: unknown };
        const regles = (['light', 'cover', 'opaque'] as const).filter((k) => e[k] !== undefined);
        if (regles.length && e.source === undefined && (typeof e.maison !== 'string' || !e.maison))
          ctx.addIssue({
            code: 'custom',
            path: ['maison'],
            message: `${e.id} : ${regles.join('/')} sans provenance — un champ de RÈGLE porte \`source\` (le folio) ou \`maison\` (l’étalon dont il est extrapolé)`,
          });
        // `foot` est la vérité d'un BILLBOARD, et de lui seul (#1509) : les cases d'un décor à RECETTE
        // se dérivent de son corps tourné (`empreinteDeriveeDuProp`). Un `foot` posé à côté d'une
        // recette n'est lu par personne et ment au premier cap E/O — le `foot` ne tourne pas, l'empreinte si.
        if (e.volume !== undefined && e.foot !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['foot'],
            message: `${e.id} : \`foot\` sur une recette volumique — les cases d’un décor à recette viennent de son CORPS tourné, pas d’une empreinte déclarée`,
          });
        // PLACES SANS RECETTE : `data/props.types.ts`, CAP D'IDENTITÉ.
        if (e.seatSlots !== undefined && e.volume === undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['seatSlots'],
            message: `${e.id} : places assises sans recette volumique — les \`seatSlots\` d’un décor s’écrivent dans le repère de sa recette (\`volume\`), un billboard n’en porte pas`,
          });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
/** Clés top-level de l'ENTRÉE (enveloppe + champs), relevées AVANT le sceau — le nœud rendu par la
 *  fabrique n'a plus de `.shape`. Consommée par `scripts/guards/lib/fieldConsumerTargets.mjs`, qui
 *  dégraderait SILENCIEUSEMENT à zéro champ sur un nœud scellé. */
export const cles = doc.cles;
