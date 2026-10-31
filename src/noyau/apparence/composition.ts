/**
 * LA COMPOSITION D'UN PERSONNAGE (#3086, D2 et son amendement, D1, D6(b)) : une composition a la forme d'une entrée de
 * `presets-de-personnage.json` (`PresetDePersonnage`). `porteeDeComposition` rend ce qu'elle porte, sans aucun élément 3D :
 * la tête, la coiffure, les pièces, chaque objet à son point, et les facteurs de son gabarit (`gabaritResolu`).
 * `cataloguesDeComposition` rend les choix de chacun de ses champs, tirés des marques du schéma (feuilles `idDe`,
 * `optionsDuNoeud`), et ses axes (`AXES`) ; `lireComposition` la valide, seule validation d'une composition, et
 * `presetDeComposition` rend son entrée JSON, l'enveloppe d'un preset reprise, et les fautes de son schéma.
 */
import { choixDeLaFeuilleDId, findApparenceById, findCoiffureById, findEnsembleParHabille, findPieceById, findPresetDePersonnageById, findTeteById, findTrappingById, presetsDePersonnage, raceAppearance, type GabaritId } from '../../data';
import { serializeDataset } from '../../data/serialize';
import type { TenueId } from '../../data/schemas/defs/garde-robe';
import { compositionSchema, file as FICHIER_DES_PRESETS, meta as metaDesPresets, schema as schemaDesPresets, type PresetDePersonnage } from '../../data/schemas/defs/presets-de-personnage';
import { defDe, enfantsDe, ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { CLES_ENVELOPPE, type CleEnveloppe } from '../../data/schemas/grammaire/document';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { declarationDeFeuilleDId, type FeuilleDId } from '../../data/schemas/grammaire/ref';
import { noeudDuChamp, validateDocument } from '../../data/schemas/validate';
import { BUILD_NEUTRE } from '../../lib/corpulence';
import { t } from '../../i18n';
import { tableTotale } from '../../lib/tableTotale';
import type { ChampDeCleResolu } from './cleDElement';
import { gabaritResolu, type GabaritResolu } from './gabarit';
import { emplacementDePiece, piecesDEnsemble } from './gardeRobe';

/** Une composition : les champs d'un preset, sans son enveloppe (`CLES_ENVELOPPE`). */
export type Composition = Omit<PresetDePersonnage, CleEnveloppe>;

/** Une faute du schéma : son chemin et son message. */
export interface FauteDePreset {
  chemin: (string | number)[];
  message: string;
}

const estCleDEnveloppe = (cle: string): cle is CleEnveloppe => (CLES_ENVELOPPE as readonly string[]).includes(cle);

/** Les clés de `p` qui sont de son enveloppe (`CLES_ENVELOPPE`) si `enveloppe`, les autres sinon. */
const partDuPreset = (p: PresetDePersonnage, enveloppe: boolean): Record<string, unknown> =>
  Object.fromEntries(Object.entries(p).filter(([cle]) => estCleDEnveloppe(cle) === enveloppe));

/** `p` sans son enveloppe (`CLES_ENVELOPPE`). */
export function compositionDuPreset(p: PresetDePersonnage): Composition {
  return partDuPreset(p, false) as Composition;
}

/** `brut` lu au schéma de la composition (`compositionSchema`, ses règles comprises) : la composition, ou ses fautes
 *  (`validateDocument`), chacune à son chemin. */
export function lireComposition(brut: unknown): { ok: true; composition: Composition } | { ok: false; fautes: FauteDePreset[] } {
  const fautes = validateDocument(compositionSchema, brut);
  return fautes ? { ok: false, fautes: fautes.map(({ chemin, message }) => ({ chemin: [...chemin], message })) } : { ok: true, composition: brut as Composition };
}

/** Une chose portée : la clé de l'élément qui la monte, son libellé, son point d'accroche (la prise ou le rangement
 *  d'un objet, l'emplacement d'une pièce d'accessoire) et ce qui l'apporte (la tenue ou l'objet que son ensemble
 *  habille, l'objet dont elle est l'apparence). */
export interface Portee {
  cle: { champ: ChampDeCleResolu; id: string };
  label: string;
  point?: string;
  par?: { type: 'tenue' | 'trapping'; id: string; label: string };
}

export interface PorteeDeComposition {
  portees: Portee[];
  /** Les objets ni tenus ni rangés : ni ensemble, ni prise, ni `rangement` (D1). */
  rapport: string[];
  facteurs: GabaritResolu;
}

const labelDePiece = (id: string): string => findPieceById(id)?.label ?? id;

/** Ce qui apporte une chose portée : la tenue ou l'objet `habille`, au libellé de son ensemble, à défaut, pour un objet,
 *  de l'objet. */
const par = (habille: { type: 'tenue'; id: TenueId } | { type: 'trapping'; id: string }): NonNullable<Portee['par']> => ({
  ...habille,
  label: findEnsembleParHabille(habille)?.label ?? (habille.type === 'trapping' ? findTrappingById(habille.id)?.label : undefined) ?? habille.id,
});

/** Les pièces de `pieces`, chacune à l'emplacement de sa pièce d'accessoire (`emplacementDePiece`). */
const portees = (pieces: readonly string[], apport?: Portee['par']): Portee[] =>
  pieces.map((id) => ({ cle: { champ: 'piece', id }, label: labelDePiece(id), ...(emplacementDePiece(id) ? { point: emplacementDePiece(id) } : {}), ...(apport ? { par: apport } : {}) }));

/** Ce que porte `composition` : sa tête, sa coiffure, les pièces de l'ensemble de sa tenue puis ses `pieces` (D6(b)), puis
 *  chaque objet, tenu puis porté : les pièces de l'ensemble qui l'habille, sinon son apparence (`apparencesObjets`, à
 *  défaut sa forme) à sa prise s'il est tenu, sinon à son `rangement` (D1) ; et les facteurs de son gabarit. */
export function porteeDeComposition(composition: Composition): PorteeDeComposition {
  const race = raceAppearance.find((r) => r.id === composition.race.id);
  if (!race) throw new Error(`porteeDeComposition : « ${composition.race.id} » n'est aucune race de \`raceAppearance.json\`.`);
  const liste: Portee[] = [{ cle: { champ: 'tete', id: composition.tete.id }, label: findTeteById(composition.tete.id)?.label ?? composition.tete.id }];
  if (composition.coiffure) liste.push({ cle: { champ: 'coiffure', id: composition.coiffure.id }, label: findCoiffureById(composition.coiffure.id)?.label ?? composition.coiffure.id });
  if (composition.tenue) liste.push(...portees(piecesDEnsemble({ id: composition.tenue.id, type: 'tenue' }), par({ type: 'tenue', id: composition.tenue.id })));
  liste.push(...portees(composition.pieces ?? []));
  const rapport: string[] = [];
  const objets: [string, string | undefined][] = [
    ...Object.entries(composition.prises ?? {}).map(([main, tenu]): [string, string] => [tenu.id, main]),
    ...(composition.objets ?? []).map((id): [string, undefined] => [id, undefined]),
  ];
  for (const [id, prise] of objets) {
    const habille = { type: 'trapping' as const, id };
    const habits = piecesDEnsemble(habille);
    if (habits.length) {
      liste.push(...portees(habits, par(habille)));
      continue;
    }
    const trapping = findTrappingById(id);
    const apparence = composition.apparencesObjets?.[id]?.id ?? trapping?.shape?.id;
    const point = prise ?? trapping?.rangement?.id;
    if (apparence === undefined || point === undefined) {
      rapport.push(t(apparence === undefined ? 'compo.objetSansApparence' : 'compo.objetSansPoint', { objet: id }));
      continue;
    }
    liste.push({ cle: { champ: 'apparence', id: apparence }, label: findApparenceById(apparence)?.label ?? apparence, point, par: par(habille) });
  }
  return { portees: liste, rapport, facteurs: gabaritResolu({ gabarit: composition.gabarit?.id as GabaritId | undefined, race, legsMult: 1 }) };
}

/** Un choix d'un catalogue : l'id stocké, le libellé affiché. */
export interface Choix {
  id: string;
  label: string;
}

/** Les champs d'une composition qui portent un catalogue. */
const CHAMPS_CATALOGUES = ['race', 'gabarit', 'sex', 'tete', 'coiffure', 'tenue', 'pieces', 'objets', 'prises'] as const;

type ChampCatalogue = (typeof CHAMPS_CATALOGUES)[number];
const estChampCatalogue = (champ: string): champ is ChampCatalogue => (CHAMPS_CATALOGUES as readonly string[]).includes(champ);

/** Les axes d'une composition (#3086, D3), dans leur ordre ; `build` a pour neutre le corps neutre de la base. */
const AXES = ['race', 'gabarit', 'sex', 'build', 'tete', 'coiffure', 'tenue'] as const satisfies readonly (keyof Composition)[];
const NEUTRES: Partial<Record<(typeof AXES)[number], number>> = { build: BUILD_NEUTRE };

/** Un axe : son champ, le libellé de sa méta au schéma, et sa forme : `ref` (le champ porte `{ id }`) ou `valeur` (l'id
 *  nu), dont les choix sont la `liste` de ce nom des catalogues ; `plage`, un nombre sur [`min` ; `max`] qui vaut `neutre`
 *  absent (`NEUTRES`). */
export type Axe = { champ: (typeof AXES)[number]; label: string } & (
  | { forme: 'ref' | 'valeur'; liste: ChampCatalogue }
  | { forme: 'plage'; min: number; max: number; neutre: number }
);

export type CataloguesDeComposition = Record<ChampCatalogue, Choix[]> & { axes: Axe[]; presets: (Choix & { composition: Composition })[] };

/** La première feuille `idDe` atteinte sous `noeud`, largeur d'abord, hors des clés de record. */
function feuilleDe(noeud: unknown): FeuilleDId | undefined {
  const file = [noeud];
  for (let i = 0; i < file.length; i++) {
    const declaration = declarationDeFeuilleDId(file[i]);
    if (declaration) return declaration;
    file.push(...enfantsDe(file[i]).filter((e) => e.segment !== '{clé}').map((e) => e.noeud));
  }
  return undefined;
}

/** Les choix du champ `champ` : les valeurs nommées de son enum, ou de la clé de son record (`optionsDuNoeud`), sinon
 *  ceux de sa feuille `idDe`. */
function choixDuChamp(champ: string): Choix[] {
  const noeud = noeudDuChamp(FICHIER_DES_PRESETS, champ);
  const enum_ = [noeud, ...ouverts([noeud]).flatMap((n) => enfantsDe(n).filter((e) => e.segment === '{clé}').map((e) => e.noeud))]
    .map(optionsDuNoeud)
    .find((o) => o.length);
  if (enum_) return enum_.map(([id, label]) => ({ id, label }));
  const feuille = feuilleDe(noeud);
  if (!feuille) throw new Error(`cataloguesDeComposition : le champ ${champ} ne porte ni enum nommé ni feuille \`idDe\`.`);
  return choixDeLaFeuilleDId(feuille);
}

/** L'axe `champ`, lu à son nœud au schéma du preset : `ref` si son `id` est une feuille `idDe`, `valeur` s'il est un
 *  enum nommé, `plage` s'il est un nombre borné, ses bornes celles du nœud et son neutre celui de `NEUTRES`, exigé. */
function axeDuChamp(champ: (typeof AXES)[number]): Axe {
  const noeuds = ouverts([noeudDuChamp(FICHIER_DES_PRESETS, champ)]);
  const label = metaDesPresets[champ].label;
  const choix = ouverts(pasDeDonnee(noeuds, 'id')).some((n) => declarationDeFeuilleDId(n))
    ? 'ref'
    : noeuds.some((n) => optionsDuNoeud(n).length)
      ? 'valeur'
      : undefined;
  if (choix) {
    if (!estChampCatalogue(champ)) throw new Error(`cataloguesDeComposition : l'axe ${champ} n'a aucun catalogue.`);
    return { champ, label, forme: choix, liste: champ };
  }
  const nombre = noeuds.find((n) => defDe(n)?.type === 'number') as { minValue: number | null; maxValue: number | null } | undefined;
  if (nombre?.minValue == null || nombre.maxValue == null) throw new Error(`cataloguesDeComposition : l'axe ${champ} n'est ni une référence, ni un enum nommé, ni un nombre borné.`);
  const neutre = NEUTRES[champ];
  if (neutre === undefined) throw new Error(`cataloguesDeComposition : l'axe ${champ}, un nombre borné, n'a aucun neutre dans NEUTRES.`);
  return { champ, label, forme: 'plage', min: nombre.minValue, max: nombre.maxValue, neutre };
}

/** Les catalogues d'une composition : par champ, ses choix ; `prises` nomme les mains, dont l'objet se choisit dans
 *  `objets` ; `axes`, ses axes (`axeDuChamp`) ; `presets`, les presets de `presets-de-personnage.json`, chacun avec sa
 *  composition, l'entrée sans son enveloppe. */
export function cataloguesDeComposition(): CataloguesDeComposition {
  return {
    ...tableTotale(CHAMPS_CATALOGUES, choixDuChamp),
    axes: AXES.map(axeDuChamp),
    presets: presetsDePersonnage.map((p) => ({ id: p.id, label: p.label, composition: compositionDuPreset(p) })),
  };
}

/** Le `type` d'une entrée de `presets-de-personnage.json`, le littéral de son nœud au schéma. */
function typeDuPreset(): PresetDePersonnage['type'] {
  const [type] = (defDe(noeudDuChamp(FICHIER_DES_PRESETS, 'type'))?.values ?? []) as PresetDePersonnage['type'][];
  if (type === undefined) throw new Error(`presetDeComposition : le champ type de ${FICHIER_DES_PRESETS} n'est aucun littéral.`);
  return type;
}

/** L'entrée de preset de `composition` : son `type` (`typeDuPreset`), l'enveloppe entière (`CLES_ENVELOPPE`) du preset
 *  `preset` s'il est nommé, puis la composition ; en JSON (`serializeDataset`, les clés dans l'ordre du schéma quand elle est valide), avec
 *  les fautes du schéma de `presets-de-personnage.json` (`validateDocument`), vide si elle est valide. Un `preset` qu'aucune
 *  entrée ne porte est refusé, avec les ids des presets. */
export function presetDeComposition(
  composition: Composition,
  preset?: string,
): { ok: true; entree: string; verdict: FauteDePreset[] } | { ok: false; presets: string[] } {
  const enveloppe = preset === undefined ? undefined : findPresetDePersonnageById(preset);
  if (preset !== undefined && !enveloppe) return { ok: false, presets: presetsDePersonnage.map((p) => p.id) };
  const { type: _type, ...enveloppeHorsType } = enveloppe ? partDuPreset(enveloppe, true) : {};
  const entree = { type: typeDuPreset(), ...enveloppeHorsType, ...composition };
  const lu = schemaDesPresets.safeParse([entree]);
  if (lu.success) return { ok: true, entree: serializeDataset((lu.data as unknown[])[0]), verdict: [] };
  const fautes = validateDocument(schemaDesPresets, [entree]) ?? [];
  return { ok: true, entree: serializeDataset(entree), verdict: fautes.map(({ chemin, message }) => ({ chemin: chemin.slice(1), message })) };
}
