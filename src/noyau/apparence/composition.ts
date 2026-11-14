/**
 * LA COMPOSITION D'UN PERSONNAGE (#3086, D2 et son amendement, D1, D6(b)) : une composition a la forme d'une entrée de
 * `presets-de-personnage.json` (`PresetDePersonnage`). `porteeDeComposition` rend ce qu'elle porte, sans aucun élément 3D :
 * la tête, la coiffure, les pièces, chaque objet à son point, et les facteurs de son gabarit (`gabaritResolu`).
 * `cataloguesDeComposition` rend les choix de chacun de ses champs, tirés des marques du schéma (feuilles `idDe`,
 * `optionsDuNoeud`), et ses axes (`AXES`) ; `lireComposition` la valide, seule validation d'une composition, et
 * `presetDeComposition` rend son entrée JSON, l'enveloppe d'un preset reprise, et les fautes de son schéma.
 */
import {
  choixDeLaFeuilleDId,
  matieresDe,
  findApparenceById,
  findCoiffureById,
  findEnsembleParHabille,
  findGroupeDArmureById,
  findPresetDePersonnageById,
  findTeteById,
  findTrappingById,
  piecesDeLObjet,
  presetsDePersonnage,
  raceAppearance,
  trappingsInstanciables,
  type GabaritId,
  type PresetDePersonnage,
} from '../../data';
import type { HitLocation } from '../../engine/types';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { entityAppearanceSchema, type Couleurs } from '../../data/schemas/grammaire/valeurs';
import { serializeDataset } from '../../data/serialize';
import { candidatsDApparenceDObjet } from '../../data/apparencesObjets';
import { racineDesCandidats } from '../../engine/items';
import type { TenueId } from '../../data/schemas/defs/garde-robe';
import {
  compositionSchema,
  surchargesDEmblemesSchema,
  file as FICHIER_DES_PRESETS,
  meta as metaDesPresets,
  schema as schemaDesPresets,
} from '../../data/schemas/defs/presets-de-personnage';
import { defDe, enfantsDe, ouverts, pasDeDonnee } from '../../data/schemas/grammaire/descente';
import { CLES_ENVELOPPE, type CleEnveloppe } from '../../data/schemas/grammaire/document';
import { optionsDuNoeud } from '../../data/schemas/grammaire/meta';
import { declarationDeFeuilleDId, type FeuilleDId, type Id } from '../../data/schemas/grammaire/ref';
import { noeudDuChamp, validateDocument } from '../../data/schemas/validate';
import { BUILD_NEUTRE } from '../../lib/corpulence';
import { t } from '../../i18n';
import { tableTotale } from '../../lib/tableTotale';
import type { ChampDeCleResolu } from './cleDElement';
import { gabaritResolu, type GabaritResolu, type RaceDuGabarit, type TrouverGabarit } from './gabarit';
import { emplacementDePiece, pieceOuVariante, piecesDEnsemble, emblemeDuPorteur, type EmblemeResolu } from './gardeRobe';

/** `hotes/godot/pont/CONTRAT.md`, « Composition d'un personnage ». */
export function facteursDeComposition(gabarit: GabaritId | undefined, race: RaceDuGabarit, trouver?: TrouverGabarit): GabaritResolu {
  return gabaritResolu({ gabarit, race, legsMult: 1 }, trouver);
}

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

/** Une lecture de `brut` à un schéma : sa valeur, ou ses fautes (`validateDocument`), chacune à son chemin. */
export type LectureAuSchema<T> = { ok: true; valeur: T } | { ok: false; fautes: FauteDePreset[] };

const lireAuSchema = <T>(schema: Parameters<typeof validateDocument>[0], brut: unknown): LectureAuSchema<T> => {
  const fautes = validateDocument(schema, brut);
  return fautes ? { ok: false, fautes: fautes.map(({ chemin, message }) => ({ chemin: [...chemin], message })) } : { ok: true, valeur: brut as T };
};

/** `brut` lu au schéma de la composition (`compositionSchema`, ses règles comprises). */
export const lireComposition = (brut: unknown): LectureAuSchema<Composition> => lireAuSchema(compositionSchema, brut);

/** `brut` lu au schéma de l'apparence d'auteur (`entityAppearanceSchema`). */
export const lireApparenceDAuteur = (brut: unknown): LectureAuSchema<EntityAppearance> => lireAuSchema(entityAppearanceSchema, brut);

/** Par emplacement de montage, l'emblème choisi à l'atelier, `null` pour une surface sans emblème. */
export type SurchargesDEmblemes = typeof surchargesDEmblemesSchema._output;

/** `brut` lu au schéma des surcharges d'emblème (`surchargesDEmblemesSchema`). */
export const lireSurchargesDEmblemes = (brut: unknown): LectureAuSchema<SurchargesDEmblemes> => lireAuSchema(surchargesDEmblemesSchema, brut);

/** La clé de l'élément qui monte une chose portée : son champ et son id ; une apparence variante porte aussi sa forme
 *  `racine` (`racineDesCandidats`), dont l'élément la monte à défaut du sien. */
type CleDePortee = { champ: Exclude<ChampDeCleResolu, 'apparence'>; id: string } | { champ: 'apparence'; id: string; racine?: string };

/** Une chose portée : la clé de l'élément qui la monte, son libellé, son point d'accroche (la prise ou le rangement
 *  d'un objet, l'emplacement d'une pièce d'accessoire), ce qui l'apporte (la tenue ou l'objet que son ensemble
 *  habille, l'objet dont elle est la pièce ou l'apparence) et la teinte de l'objet qui l'apporte (`teinteDeLObjet`,
 *  #3456), un id du domaine `objet` de `materials.json`. */
export interface Portee {
  cle: CleDePortee;
  label: string;
  point?: string;
  par?: { type: 'tenue' | 'trapping'; id: string; label: string };
  teinte?: string;
}

/** Ce que porte un corps, et ce corps : son sexe, sa corpulence (absente, le corps neutre) et sa palette. */
export interface PorteeDeComposition extends Pick<Composition, 'sex' | 'build'> {
  couleurs?: Couleurs;
  portees: Portee[];
  embleme?: EmblemeResolu;
  /** Les objets ni tenus ni rangés : ni ensemble, ni prise, ni `rangement` (D1). */
  rapport: string[];
  facteurs: GabaritResolu;
}

/** Les apparences candidates de l'objet `id` porté par `composition` (`candidatsDApparenceDObjet`) : son `apparencesObjets`,
 *  à défaut la forme du trapping, en tête. */
const candidatsDeLObjet = (composition: Pick<Composition, 'apparencesObjets'>, id: string): string[] => candidatsDApparenceDObjet(id, composition.apparencesObjets?.[id]?.id);

/** Ce qui apporte une chose portée : la tenue ou l'objet `habille`, au libellé de son ensemble, à défaut, pour un objet,
 *  de l'objet. */
const par = (habille: { type: 'tenue'; id: TenueId } | { type: 'trapping'; id: string }): NonNullable<Portee['par']> => ({
  ...habille,
  label: findEnsembleParHabille(habille)?.label ?? (habille.type === 'trapping' ? findTrappingById(habille.id)?.label : undefined) ?? habille.id,
});

/** Par pièce portée, la variante que choisit une composition (`variantesPieces`, #3446). */
type VariantesDePieces = Readonly<Partial<Record<string, { id: string }>>> | undefined;

/** Les pièces de `pieces`, chacune sous sa variante de `variantes` (#3446), à défaut elle-même, à l'emplacement de sa pièce
 *  d'accessoire (`emplacementDePiece`), à la `teinte` de l'objet qui les apporte. */
const portees = (pieces: readonly string[], variantes: VariantesDePieces, apport?: Portee['par'], teinte?: string): Portee[] =>
  pieces.map((piece) => {
    const id = variantes?.[piece]?.id ?? piece;
    const point = emplacementDePiece(piece);
    return { cle: { champ: 'piece', id }, label: pieceOuVariante(id)?.label ?? id, ...(point ? { point } : {}), ...(apport ? { par: apport } : {}), ...(teinte ? { teinte } : {}) };
  });

/** Les pièces de l'ensemble qui habille la tenue `tenue`, chacune sous sa variante de `variantes`, apportées par elle. */
export const porteesDeLaTenue = (tenue: TenueId, variantes?: VariantesDePieces): Portee[] =>
  portees(piecesDEnsemble({ id: tenue, type: 'tenue' }), variantes, par({ type: 'tenue', id: tenue }));

/** La teinte d'un objet : la sienne, à défaut celle du Groupe d'armure de son type `subType` (#3456). */
export const teinteDeLObjet = (o: { teinte?: string; subType?: string | null }): string | undefined => o.teinte ?? findGroupeDArmureById(o.subType)?.teinte?.id;

/** Un objet porté : ce qui le nomme au rapport, son trapping, ses apparences candidates (`apparencesCandidates`, `candidatsDApparenceDObjet` :
 *  la racine en dernière entrée ; vide, aucune), sa prise s'il est tenu, le rangement que sa composition choisit
 *  (`rangementsObjets`), les localisations qu'il couvre, à défaut celles de son trapping, et sa teinte
 *  (`teinteDeLObjet`). */
export interface ObjetPorte {
  nom: string;
  trappingId?: string;
  candidats: readonly string[];
  prise?: string;
  rangement?: string;
  locs?: readonly HitLocation[];
  teinte?: string;
}

/** Ce que porte `objet`, à sa teinte : ses pièces (`piecesDeLObjet`), chacune sous sa variante de `variantes`, sinon
 *  son premier candidat, avec sa racine s'il en est une variante, à sa prise s'il est tenu, sinon à son `rangement`, à
 *  défaut celui de son trapping (D1) ; sans candidat ou sans point, sa ligne de rapport. */
function porteesDeLObjet({ nom, trappingId, candidats, prise, rangement, locs, teinte }: ObjetPorte, variantes: VariantesDePieces): { portees: Portee[] } | { rapport: string } {
  const habille = trappingId === undefined ? undefined : { type: 'trapping' as const, id: trappingId };
  const habits = piecesDeLObjet(trappingId, locs);
  if (habits.length) return { portees: portees(habits, variantes, habille && par(habille), teinte) };
  const point = prise ?? rangement ?? findTrappingById(trappingId)?.rangement?.id;
  const [apparence] = candidats;
  if (apparence === undefined || point === undefined) return { rapport: t(apparence === undefined ? 'compo.objetSansApparence' : 'compo.objetSansPoint', { objet: nom }) };
  const racine = racineDesCandidats(candidats)!;
  return { portees: [{ cle: { champ: 'apparence', id: apparence, ...(racine === apparence ? {} : { racine }) }, label: findApparenceById(apparence)?.label ?? apparence, point, ...(habille ? { par: par(habille) } : {}), ...(teinte ? { teinte } : {}) }] };
}

/** Ce que portent `objets`, chacun par `porteesDeLObjet` sous les `variantes` de pièces, dans leur ordre. */
export function porteesDesObjets(objets: readonly ObjetPorte[], variantes?: VariantesDePieces): Pick<PorteeDeComposition, 'portees' | 'rapport'> {
  const lu = objets.map((o) => porteesDeLObjet(o, variantes));
  return { portees: lu.flatMap((o) => ('portees' in o ? o.portees : [])), rapport: lu.flatMap((o) => ('rapport' in o ? [o.rapport] : [])) };
}

/** Ce que porte `composition` : sa tête, sa coiffure, les pièces de l'ensemble de sa tenue puis ses `pieces` (D6(b)), puis
 *  chaque objet, tenu puis porté (`porteesDesObjets`), son apparence choisie (`apparencesObjets`), à défaut sa forme, à son
 *  rangement choisi (`rangementsObjets`) s'il n'est pas tenu ; les pièces sous leurs variantes (`variantesPieces`) ; les
 *  facteurs de son gabarit, et le corps qu'elle habille. */
export function porteeDeComposition(composition: Composition): PorteeDeComposition {
  const race = raceAppearance.find((r) => r.id === composition.race.id);
  if (!race) throw new Error(`porteeDeComposition : « ${composition.race.id} » n'est aucune race de \`raceAppearance.json\`.`);
  const liste: Portee[] = [{ cle: { champ: 'tete', id: composition.tete.id }, label: findTeteById(composition.tete.id)?.label ?? composition.tete.id }];
  if (composition.coiffure) liste.push({ cle: { champ: 'coiffure', id: composition.coiffure.id }, label: findCoiffureById(composition.coiffure.id)?.label ?? composition.coiffure.id });
  const { variantesPieces } = composition;
  if (composition.tenue) liste.push(...porteesDeLaTenue(composition.tenue.id, variantesPieces));
  liste.push(...portees(composition.pieces ?? [], variantesPieces));
  const objet = (id: Id<'trapping'>, prise?: string): ObjetPorte => {
    const rangement = composition.rangementsObjets?.[id]?.id;
    const teinte = teinteDeLObjet({ subType: findTrappingById(id)?.subType?.id });
    return { nom: id, trappingId: id, candidats: candidatsDeLObjet(composition, id), ...(prise ? { prise } : {}), ...(rangement ? { rangement } : {}), ...(teinte ? { teinte } : {}) };
  };
  const objets = porteesDesObjets(
    [...Object.entries(composition.prises ?? {}).map(([main, tenu]) => objet(tenu.id, main)), ...(composition.objets ?? []).map((id) => objet(id))],
    variantesPieces,
  );
  const { sex, build, couleurs } = composition;
  return {
    portees: [...liste, ...objets.portees],
    rapport: objets.rapport,
    embleme: emblemeDuPorteur(composition.embleme),
    facteurs: facteursDeComposition(composition.gabarit?.id as GabaritId | undefined, race),
    sex,
    ...(build === undefined ? {} : { build }),
    ...(couleurs ? { couleurs } : {}),
  };
}

/** Les emplacements où se range un objet de forme `apparence` : le `rangement` de chaque trapping instanciable de cette
 *  forme (D1), puis chaque emplacement où un preset range un de ses objets portés de cette apparence, choisie
 *  (`apparencesObjets`) ou de sa forme, à son rangement choisi (`rangementsObjets`), à défaut à celui de son trapping,
 *  sans doublon, dans cet ordre. */
export const emplacementsDeRangement = (apparence: string): string[] => [
  ...new Set([
    ...trappingsInstanciables().flatMap((t) => (t.shape?.id === apparence && t.rangement ? [t.rangement.id] : [])),
    ...presetsDePersonnage.flatMap((p) =>
      (p.objets ?? []).flatMap((id) => {
        const ou = p.rangementsObjets?.[id]?.id ?? findTrappingById(id)?.rangement?.id;
        return ou !== undefined && candidatsDeLObjet(p, id)[0] === apparence ? [ou] : [];
      }),
    ),
  ]),
];

/** Un choix d'un catalogue : l'id stocké, le libellé affiché. */
export interface Choix {
  id: string;
  label: string;
}

/** Les champs d'une composition qui portent un catalogue. */
const CHAMPS_CATALOGUES = ['race', 'gabarit', 'sex', 'tete', 'coiffure', 'tenue', 'pieces', 'objets', 'prises', 'couleurs'] as const;

type ChampCatalogue = (typeof CHAMPS_CATALOGUES)[number];
const estChampCatalogue = (champ: string): champ is ChampCatalogue => (CHAMPS_CATALOGUES as readonly string[]).includes(champ);

/** Les axes d'une composition (#3086, D3), dans leur ordre ; `build` a pour neutre le corps neutre de la base. */
const AXES = ['race', 'gabarit', 'sex', 'build', 'tete', 'coiffure', 'tenue'] as const satisfies readonly (keyof Composition)[];
const NEUTRES: Partial<Record<(typeof AXES)[number], number>> = { build: BUILD_NEUTRE };

/**
 * @contrat Composition d'un personnage
 * `catalogues` rend
 * `{ race, gabarit, sex, tete, coiffure, tenue, pieces, objets, prises, couleurs, axes, presets, nuancier }`, chacun
 * hors `axes`, `presets` et `nuancier` une liste `{ id, label }` : l'id se stocke, le libellé s'affiche. Chaque champ
 * se tire de son nœud au schéma du preset (`noeudDuChamp`) : un enum nommé, ou celui de la clé d'un record, par
 * `optionsDuNoeud` (`sex` ; `prises`, les mains, dont l'objet se choisit dans `objets` ; `couleurs`, les emplacements
 * de palette, dont la couleur se choisit dans `nuancier`) ; sinon sa feuille `idDe`, dont les entrées admises par sa
 * sous-liste viennent du dataset de son espace, dans l'ordre de la donnée. `nuancier` liste les couleurs nommées de
 * `materials.json` (domaine `couleur`), dans l'ordre de la donnée, en `{ id, label, couleur }`, `couleur` valant
 * `#rrggbb`. `presets` liste les entrées de `presets-de-personnage.json` en `{ id, label, composition }` :
 * `composition` est l'entrée sans son enveloppe, la forme que `composer` prend. `axes` liste les axes d'une
 * composition, dans leur ordre (race, gabarit, sexe, corpulence, tête, coiffure, tenue), une seule déclaration au
 * noyau (`AXES`, `composition.ts`) :
 */
export type Axe =
  /** un axe à choisir dans le catalogue `liste` */
  | { champ: (typeof AXES)[number]; label: string; forme: 'ref' | 'valeur'; liste: ChampCatalogue }
  /** un axe à régler entre `min` et `max`, `neutre` valant le champ absent */
  | { champ: (typeof AXES)[number]; label: string; forme: 'plage'; min: number; max: number; neutre: number };

export type CataloguesDeComposition = Record<ChampCatalogue, Choix[]> & {
  axes: Axe[];
  presets: (Choix & { composition: Composition })[];
  /** Les couleurs du nuancier (`materials.json`, domaine `couleur`), chacune avec sa valeur `#rrggbb`. */
  nuancier: (Choix & { couleur: string })[];
};

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

/**
 * @contrat Composition d'un personnage
 * `label` est le libellé de la méta du champ au schéma du preset (`meta`, `schemas/defs/presets-de-personnage.ts`).
 * `forme` se lit au nœud du champ : `ref` quand son `id` est une feuille `idDe` (le champ porte `{ id }`), `valeur`
 * pour un enum nommé (le champ porte l'id nu), `plage` pour un nombre borné ; `liste` est la clé de `catalogues` qui
 * donne ses choix, `min` et `max` les bornes du nœud, `neutre` la valeur que vaut le champ absent (`build` :
 * `BUILD_NEUTRE`, `src/lib/corpulence.ts`), que porte toute `plage` : un nombre borné sans neutre dans `NEUTRES`
 * (`composition.ts`) fait échouer `catalogues`. Godot tient la composition courante : appliquer un preset la
 * remplace, changer un axe ou une couleur la modifie, et l'une ou l'autre se recompose par `composer` ;
 * `presetDeComposition` sérialise cette même forme, l'enveloppe ajoutée par le noyau.
 */
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
 *  `objets` ; `couleurs` nomme les emplacements de palette, dont la couleur se choisit dans `nuancier` ; `axes`, ses axes
 *  (`axeDuChamp`) ; `presets`, les presets de `presets-de-personnage.json`, chacun avec sa composition, l'entrée sans son
 *  enveloppe. */
export function cataloguesDeComposition(): CataloguesDeComposition {
  return {
    ...tableTotale(CHAMPS_CATALOGUES, choixDuChamp),
    axes: AXES.map(axeDuChamp),
    presets: presetsDePersonnage.map((p) => ({ id: p.id, label: p.label, composition: compositionDuPreset(p) })),
    nuancier: matieresDe('couleur').map((c) => ({ id: c.id, label: c.label, couleur: c.color })),
  };
}

/** Le `type` d'une entrée de `presets-de-personnage.json`, le littéral de son nœud au schéma. */
function typeDuPreset(): PresetDePersonnage['type'] {
  const [type] = (defDe(noeudDuChamp(FICHIER_DES_PRESETS, 'type'))?.values ?? []) as PresetDePersonnage['type'][];
  if (type === undefined) throw new Error(`presetDeComposition : le champ type de ${FICHIER_DES_PRESETS} n'est aucun littéral.`);
  return type;
}

/**
 * @contrat Composition d'un personnage
 * `presetDeComposition` rend `{ entree: string, verdict: { chemin: (string | number)[]; message: string }[] }` :
 * `entree` est l'entrée au format du fichier (`serializeDataset`), clés dans l'ordre du schéma quand elle est
 * valide : le `type` de la collection, lu au schéma, l'enveloppe entière du preset `preset` s'il est donné (ses clés
 * de `CLES_ENVELOPPE`, hors `type`), puis la composition. `verdict` porte les fautes du schéma de la collection
 * (`validateDocument`), chemin dans l'entrée, vide si elle est valide : sa composition étant validée d'abord, ce sont
 * celles de l'enveloppe, `id`, `label` et `source` sans `preset`. Seule une entrée au verdict vide se copie dans le
 * fichier.
 *
 * Un `preset` qu'aucune entrée ne porte est refusé, avec les ids des presets.
 */
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
