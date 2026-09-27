/**
 * Schéma de `terrains.json` — LE dataset des sols de la grille (#1690), consommé comme
 * `TerrainDef[]` (`src/data/terrains.types.ts`). 25 entrées, UNE forme, aucun discriminant : tous
 * les terrains portent les mêmes clés requises et se distinguent par leurs VALEURS.
 *
 * RÈGLE et RENDU dans la MÊME entrée : `walkable`/`priority`/`opaque`/`built` sont lus par la
 * walkability, le raccord d'arêtes et la Ligne de Vue ; `swatch`/`stops`/`detail`/`overlayProp`/
 * `solidHeightM` par les deux backends de rendu. Les scinder ferait deux catalogues à tenir
 * synchrones pour UN concept.
 *
 * PROVENANCE — `terrains` est déclaré `SANS_LIVRE` (aucun folio n'imprime de catalogue de sols) ET
 * chaque entrée EXIGE son `maison` (`exiges`), comme les 41 règles de `props.json` : l'exemption
 * couvre le DOCUMENT (de l'art), elle ne couvre pas les quatre champs de règle que chaque terrain
 * porte.
 *
 * L'id du `<linearGradient>` SVG n'est PAS une donnée : il se dérive de l'id du terrain
 * (`terrainGradientId`, `src/gameIso/catalog/terrain.ts`) : deux terrains portant des `stops`
 * différents ne peuvent pas partager une rampe.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { GLYPHES_RESERVES, glyphesReservesEnClair } from '../grammaire/carte-ascii';
import { couleurHexSchema, detailRecipeSchema } from '../grammaire/valeurs';
import { idDe } from '../grammaire/ref';

export const file = 'terrains.json';
export const famille = 'entite';

/** Offset d'un arrêt de rampe : un POURCENTAGE entier `0%` à `100%`, tel que `<stop offset>` l'écrit. */
const offset = z
  .string()
  .regex(/^(?:100|[0-9]{1,2})%$/, 'offset d’arrêt : un pourcentage entier de 0% à 100% (ex. « 45% »)');

const doc = document(
  'terrains',
  famille,
  {
    walkable: z.boolean(),
    priority: z.number().int().min(0),
    opaque: z.literal(true).optional(),
    built: z.literal(true).optional(),
    absence: z.literal(true).optional(),
    bordDuMonde: z.literal(true).optional(),
    // Message NOMMANT la valeur refusée : le défaut zod (issue `too_big`) dit la BORNE, jamais le
    // glyphe qu'on lisait ni à quoi il sert.
    ascii: z
      .string()
      .length(1, {
        error: (iss) =>
          `glyphe d’authoring « ${String(iss.input)} » : UN SEUL caractère — c'est le char qui pose ce terrain dans une carte ASCII`,
      })
      .optional(),
    swatch: couleurHexSchema,
    // Record `offset → couleur` : un offset ne se répète pas sur une rampe. Au moins deux arrêts —
    // un dégradé d'un seul arrêt est un aplat, que `swatch` dit déjà.
    stops: z.record(offset, couleurHexSchema).refine((r) => Object.keys(r).length >= 2, {
      message: 'une rampe porte au moins DEUX arrêts (un seul est un aplat — c’est `swatch`)',
    }),
    detail: detailRecipeSchema.optional(),
    overlayProp: idDe('prop').optional(),
    solidHeightM: z.number().positive().optional(),
    matiere: idDe('material', 'relief').optional(),
  },
  {
    walkable: { label: 'Franchissable', hint: 'Le terrain se traverse à pied' },
    priority: {
      label: 'Précédence de raccord',
      hint: 'Un terrain de priorité plus haute déborde sur ses voisins de priorité plus basse',
    },
    opaque: { label: 'Bloque la vue', hint: 'Coupe la Ligne de Vue (couvert total, brouillard de vision)' },
    built: {
      label: 'Surface bâtie',
      hint: 'Ouvrage construit qui PORTE l’étage posé dessus — absent : sol nu, un étage posé dessus est signalé par `map:check`',
    },
    absence: {
      label: 'Rôle : absence de tuile',
      hint: 'La non-tuile — ce qu’une couche porte là où rien n’est bâti ; UN SEUL terrain porte ce rôle',
    },
    bordDuMonde: {
      label: 'Rôle : bord du monde',
      hint: 'Ce que la grille rend au-delà de ses bornes ; UN SEUL terrain porte ce rôle',
    },
    ascii: {
      label: 'Glyphe d’authoring',
      hint: 'Le caractère qui pose ce terrain dans une carte ASCII — un seul, jamais un mot de la grammaire du plan (mur, porte, fenêtre, diagonale, jonction, fond)',
    },
    swatch: { label: 'Teinte d’aperçu', hint: 'Couleur `#rrggbb` de la palette de l’éditeur et des faces du monde volumique' },
    stops: {
      label: 'Arrêts du dégradé',
      hint: 'Rampe peinte par le rendu affine : offset en pourcentage → couleur `#rrggbb`',
    },
    detail: { label: 'Recette de détail' },
    overlayProp: {
      label: 'Décor posé sur chaque tuile',
      hint: 'Décor en billboard répété sur chaque case du terrain (ex. l’arbre du sous-bois) — présentation seule',
    },
    solidHeightM: {
      label: 'Hauteur du bloc plein',
      hint: 'Le terrain se rend comme un bloc plein de cette hauteur en mètres ; celle d’un mur vaut la constante de hauteur de mur du rendu (`src/gameIso/iso.ts`)',
    },
    matiere: {
      label: 'Matière des flancs du bloc',
      hint: 'Matière de relief (`materials.json`) peinte sur les faces verticales du bloc plein — à renseigner si et seulement si le terrain porte une hauteur de bloc plein',
    },
  },
  {
    codex: { keys: ['terrains'] },
    edit: { dataset: 'terrains' },
  },
  {
    exiges: ['maison'],
    // Chaque RÔLE que le moteur ADRESSE (#1789) est porté par EXACTEMENT UNE entrée : `absence` (la
    // non-tuile des couches sans bâti) et `bordDuMonde` (ce que la grille rend au-delà de ses bornes).
    // C'est une propriété de la COLLECTION : un refine d'ENTRÉE ne sait pas compter ses voisines.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const entrees = (Array.isArray(v) ? v : []) as readonly Record<string, unknown>[];
        for (const role of ['absence', 'bordDuMonde'] as const) {
          const porteurs = entrees.filter((e) => e[role] === true).map((e) => (typeof e.id === 'string' ? e.id : '?'));
          if (porteurs.length === 1) continue;
          ctx.addIssue({
            code: 'custom',
            path: [role],
            message:
              `rôle « ${role} » : EXACTEMENT UNE entrée de \`terrains.json\` doit le porter — ` +
              `${porteurs.length} mesurée(s)${porteurs.length ? ` : ${porteurs.join(', ')}` : ''}`,
          });
        }
        // Le GLYPHE d'authoring (`ascii`) est une clé de LECTURE : `asciiMap` en dérive la légende de
        // base d'un plan. Deux entrées au même glyphe rendraient la carte dépendante de l'ordre
        // d'écriture ; un glyphe de la GRAMMAIRE (mur, porte, fenêtre, diagonale, jonction, fond)
        // serait lu comme une arête ou le fond, jamais comme ce terrain.
        const parGlyphe = new Map<string, string[]>();
        for (const e of entrees) {
          if (typeof e.ascii !== 'string') continue;
          const id = typeof e.id === 'string' ? e.id : '?';
          parGlyphe.set(e.ascii, [...(parGlyphe.get(e.ascii) ?? []), id]);
          if (GLYPHES_RESERVES.has(e.ascii))
            ctx.addIssue({
              code: 'custom',
              path: ['ascii'],
              message:
                `glyphe « ${e.ascii} » (terrain « ${id} ») : RÉSERVÉ par la grammaire de la carte ASCII ` +
                `(${glyphesReservesEnClair()}) — la lecture du plan y verrait une arête ou le fond`,
            });
        }
        for (const [glyphe, ids] of parGlyphe) {
          if (ids.length < 2) continue;
          ctx.addIssue({
            code: 'custom',
            path: ['ascii'],
            message: `glyphe « ${glyphe} » : déclaré par ${ids.length} terrains (${ids.join(', ')}) — un glyphe d'authoring en désigne UN SEUL`,
          });
        }
      }),
    // Les `<stop>` d'un `<linearGradient>` se lisent DANS L'ORDRE D'ÉMISSION : SVG clampe un offset
    // qui recule sur son prédécesseur, et l'arrêt devient inerte sans un mot. L'ordre est donc une
    // contrainte de la DONNÉE, pas une convention d'écriture — les émetteurs trient en plus
    // (`terrainStopsOrdonnes`, `src/gameIso/catalog/terrain.ts`).
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id?: unknown; stops?: unknown; solidHeightM?: unknown; matiere?: unknown };
        // La MATIÈRE des flancs (#1691) n'existe que là où il y a des flancs : `solidHeightM` ⇔
        // `matiere`. Sans cette équivalence, un bloc muet reviendrait à laisser le builder choisir.
        const nom = typeof e.id === 'string' ? e.id : '?';
        if (e.solidHeightM !== undefined && e.matiere === undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['matiere'],
            message: `terrain « ${nom} » : un terrain à BLOC PLEIN (\`solidHeightM\`) EXIGE la matière de ses flancs (\`matiere\`) — le rendu ne la choisit plus`,
          });
        if (e.solidHeightM === undefined && e.matiere !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['matiere'],
            message: `terrain « ${nom} » : \`matiere\` peint les flancs d'un BLOC PLEIN — sans \`solidHeightM\`, ce terrain n'en a aucun`,
          });
        const offsets = Object.keys((e.stops ?? {}) as object);
        const paliers = offsets.map((o) => Number.parseInt(o, 10));
        if (paliers.every((n, i) => i === 0 || n > paliers[i - 1])) return;
        ctx.addIssue({
          code: 'custom',
          path: ['stops'],
          message:
            `terrain « ${typeof e.id === 'string' ? e.id : '?'} » : les arrêts de la rampe sont écrits ` +
            `${offsets.join(' → ')} — un offset doit être STRICTEMENT plus grand que le précédent`,
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
