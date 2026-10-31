/**
 * Schéma de `presets-de-personnage.json` — les presets de personnage entier (#3086, design D1 et D6(b)),
 * patron `defs/garde-robe.ts` : des ids du jeu seulement, jamais un élément ni un fichier 3D.
 *
 * - Les axes (D3, `AXES` de `src/noyau/apparence/composition.ts`) : `race`, `gabarit`, `sex`, nœuds de la grammaire composés
 *   tels quels ; `build`, la corpulence sur le domaine de `src/lib/corpulence.ts` ; `tete`, `coiffure`, `tenue`, des lignes
 *   de la garde-robe, chacune dans sa sous-liste.
 * - `pieces` : les pièces ajoutées à celles de l'ensemble qui habille la `tenue` (D6(b)).
 * - `objets` : les objets instanciables portés hors des mains, revêtus par l'ensemble qui les habille, sinon à leur
 *   `rangement` (`trappings.json`).
 * - `prises` : les objets instanciables tenus, par main.
 * - `apparencesObjets` : l'apparence d'un objet porté, comme `EntityAppearance.apparencesObjets`.
 * - Rien n'est porté deux fois, ni un objet ni une pièce (`refuserLesPortesDeuxFois`).
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
import { ref, refs } from '../grammaire/ref';
import { INSTANCIABLE_PAR_ID } from '../grammaire/sousListes';
import { apparencesDObjetsSchema, mainSchema, sexeSchema } from '../grammaire/valeurs';
import { findEnsembleParHabille } from '../../index';
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
  prises: z.partialRecord(mainSchema, ref('trapping', undefined, INSTANCIABLE_PAR_ID)).optional(),
  apparencesObjets: apparencesDObjetsSchema.optional(),
};

const metaDesChampsDuPreset = {
  race: { label: 'Race de rendu', hint: 'Apparence d’espèce du personnage' },
  gabarit: { label: 'Gabarit', hint: 'Carrure du squelette ; absent, celle de la race' },
  sex: { label: 'Sexe' },
  build: { label: 'Corpulence', hint: 'De 0 à 1 ; absente, le corps neutre' },
  tete: { label: 'Tête', hint: 'Tête de la garde-robe' },
  coiffure: { label: 'Coiffure', hint: 'Coiffure de la garde-robe' },
  tenue: { label: 'Tenue', hint: 'Tenue de la garde-robe, revêtue des pièces de son ensemble' },
  pieces: { label: 'Pièces', hint: 'Pièces ajoutées à celles de l’ensemble de la tenue' },
  objets: { label: 'Objets portés', hint: 'Objets hors des mains : revêtus par leur ensemble, sinon à leur emplacement de rangement' },
  prises: { label: 'Objets tenus', hint: 'Objet tenu par chaque main' },
  apparencesObjets: { label: 'Apparences des objets', hint: 'Apparence d’un objet porté ; absente, sa forme' },
};

type Chemin = (string | number)[];

/** Aucune chose portée deux fois : aucun objet sur `prises` puis `objets` ; aucune pièce sur l'ensemble de la tenue, les
 *  `pieces` puis l'ensemble de chaque objet (`findEnsembleParHabille`). L'issue va à l'élément qui la porte la seconde fois. */
function refuserLesPortesDeuxFois(v: unknown, ctx: z.RefinementCtx): void {
  const e = v as Pick<PresetDePersonnage, 'tenue' | 'pieces' | 'objets' | 'prises'>;
  const pieces = new Map<string, string>();
  const objets = new Map<string, string>();
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
  const portes: [Chemin, string, string][] = [
    ...Object.entries(e.prises ?? {}).map(([main, tenu]): [Chemin, string, string] => [['prises', main], tenu.id, `la prise ${main}`]),
    ...(e.objets ?? []).map((id, i): [Chemin, string, string] => [['objets', i], id, `objets[${i}]`]),
  ];
  for (const [path, id, ou] of portes) {
    const deja = objets.get(id);
    if (deja !== undefined) {
      deuxFois(path, id, deja);
      continue;
    }
    objets.set(id, ou);
    porter(ensemble({ id, type: 'trapping' }), path, `l’ensemble de l’objet « ${id} »`);
  }
}

/** L'entrée sans son enveloppe (`CLES_ENVELOPPE`), règles comprises. */
export const compositionSchema = nommerChamps(z.strictObject(champs), metaDesChampsDuPreset).superRefine(refuserLesPortesDeuxFois);

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
    affinerEntree: (entree) => entree.superRefine(refuserLesPortesDeuxFois),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;

/** VUE TS d'une entrée — le nœud rendu par la fabrique est SCELLÉ (`z.infer` y vaut `unknown`), la vue se recompose donc
 *  depuis l'enveloppe et les champs déclarés (`EnveloppeDocument`) : `type` y est le littéral du document, `source` exigée
 *  (`exiges`), et l'id de `tenue` resserré à `TenueId`. */
export type PresetDePersonnage = Omit<EnveloppeDocument, 'type' | 'source'> & {
  type: 'presets-de-personnage';
  source: NonNullable<EnveloppeDocument['source']>;
} & Omit<z.infer<z.ZodObject<typeof champs>>, 'tenue'> & { tenue?: { id: TenueId } };
