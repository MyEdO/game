/**
 * Schéma de `presets-de-personnage.json` — les presets de personnage entier (#3086, design D1 et D6(b)),
 * patron `defs/garde-robe.ts` : des ids du jeu seulement, jamais un élément ni un fichier 3D.
 *
 * - Les axes (D3, `AXES` de `src/noyau/apparence/composition.ts`) : `race`, `gabarit`, `sex`, nœuds de la grammaire composés
 *   tels quels ; `build`, la corpulence sur le domaine de `src/lib/corpulence.ts` ; `tete`, `coiffure`, `tenue`, des lignes
 *   de la garde-robe, chacune dans sa sous-liste.
 * - `pieces` : les pièces ajoutées à celles de l'ensemble qui habille la `tenue` (D6(b)).
 * - `objets` : les objets instanciables portés hors des mains, revêtus de leurs pièces (`piecesDeLObjet` : l'ensemble qui
 *   les habille, à défaut les pièces d'armure qui couvrent leurs localisations), sinon à leur `rangement` (`trappings.json`).
 * - `rangementsObjets` : l'emplacement où le personnage range un de ses `objets`, à la place de son `rangement`
 *   (`rangerSesObjets`).
 * - `prises` : les objets instanciables tenus, par main.
 * - `apparencesObjets` : l'apparence d'un objet porté, comme `EntityAppearance.apparencesObjets`.
 * - `couleurs` : la palette du personnage, une couleur du nuancier (`materials.json`, domaine `couleur`) par emplacement
 *   de palette ; chaque surface d'un élément monté prend celle de son emplacement.
 * - `variantesPieces` : l'apparence d'une pièce portée, une de ses variantes de la garde-robe (#3446) ; absente, la pièce
 *   elle-même (`varierSesPieces`).
 * - Rien n'est porté deux fois, ni une pièce ni un objet tenu ; un objet porté peut l'être en plusieurs exemplaires, rangés
 *   chacun à son rang du point (`refuserLesPortesDeuxFois`, #3844).
 *
 * `compositionSchema` est l'entrée sans son enveloppe, règles comprises : la composition
 * (`src/noyau/apparence/composition.ts`).
 *
 * La provenance est la `source` de l'enveloppe, exigée : `page` est le folio imprimé de l'illustration, et
 * `note` nomme l'image et les décisions d'adaptation.
 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { nommerChamps } from '../grammaire/meta';
import { recordDIds, ref, refs } from '../grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../grammaire/sousListes';
import { apparencesDObjetsSchema, couleursSchema, emblemeSchema, mainSchema, sexeSchema } from '../grammaire/valeurs';
import { findEnsembleParHabille, findVarianteById, piecesDeLObjet } from '../../index';
import type { HabilleDEnsemble, TenueId } from './garde-robe';

export const file = 'presets-de-personnage.json';
export const famille = 'entite';

const champs = {
  race: ref('raceAppearance'),
  gabarit: ref('gabarit').optional(),
  sex: sexeSchema,
  build: z.number().min(0).max(1).optional(),
  tete: ref('gardeRobe', undefined, 'tete'),
  coiffure: ref('gardeRobe', undefined, 'coiffure').optional(),
  tenue: ref('gardeRobe', undefined, 'tenue').optional(),
  pieces: refs('gardeRobe', { sousListe: 'piece' }).optional(),
  objets: refs('trapping', { sousListe: INSTANCIABLE_PAR_ID }).optional(),
  rangementsObjets: recordDIds('trapping', ref('gardeRobe', undefined, 'emplacement'), INSTANCIABLE_PAR_ID).optional(),
  variantesPieces: recordDIds('gardeRobe', ref('gardeRobe', undefined, 'variante'), 'piece').optional(),
  prises: z.partialRecord(mainSchema, ref('trapping', undefined, INSTANCIABLE_PAR_ID)).optional(),
  apparencesObjets: apparencesDObjetsSchema.optional(),
  embleme: emblemeSchema.optional(),
  couleurs: couleursSchema.optional(),
};

const metaDesChampsDuPreset = {
  embleme: { label: 'Emblème', hint: 'Emblème posé sur les surfaces qui portent un blason' },
  race: { label: 'Race de rendu', hint: 'Apparence d’espèce du personnage' },
  gabarit: { label: 'Gabarit', hint: 'Carrure du squelette ; absent, celle de la race' },
  sex: { label: 'Sexe' },
  build: { label: 'Corpulence', hint: 'De 0 à 1 ; absente, le corps neutre' },
  tete: { label: 'Tête', hint: 'Tête de la garde-robe' },
  coiffure: { label: 'Coiffure', hint: 'Coiffure de la garde-robe' },
  tenue: { label: 'Tenue', hint: 'Tenue de la garde-robe, revêtue des pièces de son ensemble' },
  pieces: { label: 'Pièces', hint: 'Pièces ajoutées à celles de l’ensemble de la tenue' },
  objets: { label: 'Objets portés', hint: 'Objets hors des mains : revêtus de leurs pièces, sinon à leur emplacement de rangement' },
  rangementsObjets: { label: 'Rangements des objets', hint: 'Emplacement où se range un objet porté ; absent, son rangement' },
  variantesPieces: { label: 'Variantes des pièces', hint: 'Apparence d’une pièce portée ; absente, la pièce elle-même' },
  prises: { label: 'Objets tenus', hint: 'Objet tenu par chaque main' },
  apparencesObjets: { label: 'Apparences des objets', hint: 'Apparence d’un objet porté ; absente, sa forme' },
  couleurs: { label: 'Couleurs', hint: 'Couleur du nuancier par emplacement de palette ; absente, la matière du modèle' },
};

type Chemin = (string | number)[];

/** Aucune chose portée deux fois : aucun objet tenu sur `prises` puis `objets`, un objet porté pouvant revenir dans
 *  `objets` en autant d'exemplaires ; aucune pièce sur l'ensemble de la tenue, les `pieces` puis les pièces de chaque
 *  exemplaire d'objet (`piecesDeLObjet`). L'issue va à l'élément qui la porte la seconde fois. Rend les pièces portées. */
function refuserLesPortesDeuxFois(v: unknown, ctx: z.RefinementCtx): ReadonlySet<string> {
  const e = v as Pick<PresetDePersonnage, 'tenue' | 'pieces' | 'objets' | 'prises'>;
  const pieces = new Map<string, string>();
  const tenus = new Map<string, string>();
  const deuxFois = (path: Chemin, id: string, deja: string) => ctx.addIssue({ code: 'custom', path, message: `« ${id} » est porté deux fois : déjà par ${deja}.` });
  const porter = (ids: readonly string[], path: Chemin, par: string) => {
    for (const id of ids) {
      const deja = pieces.get(id);
      if (deja === undefined) pieces.set(id, par);
      else deuxFois(path, id, deja);
    }
  };
  const ensemble = (habille: HabilleDEnsemble) => findEnsembleParHabille(habille)?.pieces ?? [];
  if (e.tenue) porter(ensemble({ id: e.tenue.id, type: 'tenue' }), ['tenue'], `l’ensemble de la tenue « ${e.tenue.id} »`);
  (e.pieces ?? []).forEach((id, i) => porter([id], ['pieces', i], `pieces[${i}]`));
  const portes: [Chemin, string, string | undefined][] = [
    ...Object.entries(e.prises ?? {}).map(([main, tenu]): [Chemin, string, string] => [['prises', main], tenu.id, `la prise ${main}`]),
    ...(e.objets ?? []).map((id, i): [Chemin, string, undefined] => [['objets', i], id, undefined]),
  ];
  for (const [path, id, prise] of portes) {
    const deja = tenus.get(id);
    if (deja !== undefined) {
      deuxFois(path, id, deja);
      continue;
    }
    if (prise !== undefined) tenus.set(id, prise);
    porter(piecesDeLObjet(id), path, `l’objet « ${id} »`);
  }
  return new Set(pieces.keys());
}

/** Chaque clé de `rangementsObjets` est un des `objets` : un objet tenu ou absent ne se range pas. */
function rangerSesObjets(v: unknown, ctx: z.RefinementCtx): void {
  const e = v as Pick<PresetDePersonnage, 'objets' | 'rangementsObjets'>;
  const portes = new Set<string>(e.objets ?? []);
  for (const id of Object.keys(e.rangementsObjets ?? {}))
    if (!portes.has(id)) ctx.addIssue({ code: 'custom', path: ['rangementsObjets', id], message: `« ${id} » se range sans être un des objets portés.` });
}

/** Chaque clé de `variantesPieces` est une des pièces `portees`, et sa valeur une variante de cette pièce. */
function varierSesPieces(v: unknown, portees: ReadonlySet<string>, ctx: z.RefinementCtx): void {
  const e = v as Pick<PresetDePersonnage, 'variantesPieces'>;
  for (const [piece, variante] of Object.entries(e.variantesPieces ?? {})) {
    const path = ['variantesPieces', piece];
    if (!portees.has(piece)) ctx.addIssue({ code: 'custom', path, message: `« ${piece} » prend une variante sans être une des pièces portées.` });
    const de = findVarianteById(variante.id)?.piece.id;
    if (de !== undefined && de !== piece) ctx.addIssue({ code: 'custom', path, message: `« ${variante.id} » est une variante de « ${de} », pas de « ${piece} ».` });
  }
}

const affiner = (v: unknown, ctx: z.RefinementCtx): void => {
  varierSesPieces(v, refuserLesPortesDeuxFois(v, ctx), ctx);
  rangerSesObjets(v, ctx);
};

/** L'entrée sans son enveloppe (`CLES_ENVELOPPE`), règles comprises. */
export const compositionSchema = nommerChamps(z.strictObject(champs), metaDesChampsDuPreset).superRefine(affiner);
export const surchargesDEmblemesSchema = z.record(z.string(), emblemeSchema.nullable());

const doc = document(
  'presets-de-personnage',
  famille,
  champs,
  metaDesChampsDuPreset,
  {
    codex: {
      exempt: {
        kind: 'vocabulaire-app-interne',
        raison:
          'presets de personnage entier des éléments 3D (art, pas règle) — aucune catégorie du Codex ne l’expose, aucun écran ne l’écrit : ils s’éditent au fichier `src/data/presets-de-personnage.json`',
      },
    },
    edit: { none: 'presets de personnage entier, édités au fichier `src/data/presets-de-personnage.json` — aucun écran ne l’écrit', dataset: 'presetsDePersonnage' },
  },
  {
    exiges: ['source'],
    affinerEntree: (entree) => entree.superRefine(affiner),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** VUE TS d'une entrée. Le type se dérive par `DatasetDe`/`EntreeDe` (`data/datasets.ts`) ; la vue manuscrite reste parce
 *  que l'id de `tenue` y est resserré à `TenueId`, là où le dérivé rend `string`. */
export type PresetDePersonnage = Omit<EnveloppeDocument, 'type' | 'source'> & {
  type: 'presets-de-personnage';
  source: NonNullable<EnveloppeDocument['source']>;
} & Omit<z.infer<z.ZodObject<typeof champs>>, 'tenue'> & { tenue?: { id: TenueId } };
