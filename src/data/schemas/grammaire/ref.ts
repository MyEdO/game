/**
 * FABRIQUE DE RÉFÉRENCE (#1466) — la seule façon de désigner une entité par son id.
 *
 * `ref(type)` construit ET ENREGISTRE le nœud FINAL : l'id est refiné AU PARSE contre le registre
 * généré `IDS_PAR_DATASET` (`npm run gen`), si bien qu'une référence morte casse au chargement, en
 * test et à la sauvegarde du Compendium — sans qu'aucune garde nominative n'ait à l'énumérer
 * (clause B absorbée de #1473). La fabrique n'expose aucun nœud extensible : zod 4.4.3 perd le
 * registre et la `.meta()` au `.extend`, la composition se fait donc ICI via `extra`.
 */
import { z } from 'zod';
import './locale-fr';
import { IDS_PAR_DATASET, IDS_PAR_DISCRIMINANT, IDS_PAR_MARQUEUR, SPECS_PAR_DATASET } from '../_ids.generated';
import { idsVivants, idsVivantsDuDiscriminant, idsVivantsDuMarqueur, specsVivantesDe } from './idsVivants';
import type { MarqueDeCollection } from './collection-cle';

declare const marqueDeType: unique symbol;
/** Id BRANDÉ par son type — frappé à la porte zod, jamais par un `as` d'appelant. */
export type Id<T extends string> = string & { readonly [marqueDeType]: T };

/** Ce qu'un type d'entité déclare : son dataset cible et le nom de son catalogue. */
export interface CibleDeType {
  /** Nom de fichier du dataset qui fait AUTORITÉ sur les ids de ce type. */
  readonly dataset: string;
  /** Le catalogue tel que l'AUTEUR le nomme, au pluriel (« des sorts ») : le refus d'une référence
   *  morte se lit à l'éditeur, au Compendium et à l'import d'un projet, jamais qu'en CI. */
  readonly catalogue: string;
}

/**
 * Types d'entité déclarés à la grammaire. La liste est celle des concepts que les lots L2/L3 du
 * chantier migrent (Compétence, puis Talent/Trait/Objet/Sort/Créature/Véhicule/Structure, +
 * Carrière et Trait NAVAL au L-gram-2 #1463) + la TABLE, cible de `pick({ table })`, + la MATIÈRE du
 * monde (#1686), premier type dont le dataset est DISCRIMINÉ (`idDe('material', 'prop')`), + le
 * TERRAIN et le DÉCOR (#1690 : `layer.tiles` résout un terrain, `terrains › overlayProp` un décor),
 * + l'ESPÈCE (#1520 : `pregens.json › species`).
 * Un type s'ajoute avec le lot qui le migre, jamais « au cas où ».
 */
export const TYPES = {
  skill: { dataset: 'skills.json', catalogue: 'compétences' },
  talent: { dataset: 'talents.json', catalogue: 'talents' },
  trait: { dataset: 'traits.json', catalogue: 'traits' },
  trapping: { dataset: 'trappings.json', catalogue: 'objets' },
  spell: { dataset: 'spells.json', catalogue: 'sorts' },
  creature: { dataset: 'creatures.json', catalogue: 'créatures' },
  vehicle: { dataset: 'vehicles.json', catalogue: 'véhicules' },
  structure: { dataset: 'structures.json', catalogue: 'structures' },
  career: { dataset: 'careers.json', catalogue: 'carrières' },
  species: { dataset: 'species.json', catalogue: 'espèces' },
  navalTrait: { dataset: 'naval-traits.json', catalogue: 'traits navals' },
  // PORT du catalogue naval : `MapPlace.port.ref` résout AU PARSE, toutes les réfs mortes nommées.
  navalPort: { dataset: 'naval-ports.json', catalogue: 'ports' },
  shipStation: { dataset: 'ship-stations.json', catalogue: 'postes de navire' },
  crewRole: { dataset: 'crew-roles.json', catalogue: 'rôles d’équipage' },
  table: { dataset: 'tables.json', catalogue: 'tables' },
  etat: { dataset: 'etats.json', catalogue: 'états' },
  maladie: { dataset: 'maladies.json', catalogue: 'maladies' },
  symptome: { dataset: 'symptoms.json', catalogue: 'symptômes' },
  material: { dataset: 'materials.json', catalogue: 'matières' },
  // RÈGLE OPTIONNELLE : cible du terme `{rule}` d'une `Formula` (#1599) — une quantité que le livre ne
  // chiffre pas se lit au registre, l'id résout donc AU PARSE comme toute autre référence.
  regleOptionnelle: { dataset: 'reglesOptionnelles.json', catalogue: 'règles optionnelles' },
  terrain: { dataset: 'terrains.json', catalogue: 'terrains' },
  // PALIER D'ÉCLAIRAGE (#1716) : la semence d'éclairage d'une scène neuve (`semences-de-scene.json`)
  // nomme un palier — l'id résout AU PARSE, là où `Scene.ambientLight` reste une chaîne libre.
  lightLevel: { dataset: 'lightLevels.json', catalogue: 'paliers d’éclairage' },
  prop: { dataset: 'props.json', catalogue: 'décors' },
  building: { dataset: 'buildings.json', catalogue: 'bâtiments' },
  // AXE de forces/faiblesses (#409) : `activeAxes` d'un projet de scène résout AU PARSE (#1473 R1).
  axe: { dataset: 'axes.json', catalogue: 'axes' },
} as const satisfies Record<string, CibleDeType>;

export type TypeEntite = keyof typeof TYPES;

/** Dataset qui fait autorité sur les ids d'un type. */
export function cibleDe(type: TypeEntite): string {
  return TYPES[type].dataset;
}

/** Liste FIGÉE du registre généré, en `Set` construit une fois par liste. */
const figes = new Map<readonly string[], ReadonlySet<string>>();
const VIDE: readonly string[] = [];
function fige(liste: readonly string[] | undefined): ReadonlySet<string> {
  const l = liste ?? VIDE;
  let ids = figes.get(l);
  if (!ids) figes.set(l, (ids = new Set(l)));
  return ids;
}

function idsDe(type: TypeEntite): ReadonlySet<string> {
  const dataset = cibleDe(type);
  // La MÉMOIRE d'abord (`idsVivants`, second régime déclaré par `_ids.generated.ts`) : une entité
  // créée ou renommée à l'atelier est référençable IMMÉDIATEMENT. Hors application (scripts, gardes,
  // `npm run gen`), aucune source n'est posée et le fichier généré fait foi.
  return idsVivants(dataset) ?? fige(IDS_PAR_DATASET[dataset]);
}

/**
 * Ids d'une SOUS-LISTE du dataset d'un type : ceux dont le champ DISCRIMINANT du document vaut
 * `valeur` — lus en MÉMOIRE quand une source vivante est posée (`idsVivants.ts`), sinon au registre
 * généré `IDS_PAR_DISCRIMINANT` (`npm run gen` — le def déclare son `discriminant`).
 * FAIL-FAST à la CONSTRUCTION du schéma : un type non discriminé, ou une valeur qu'aucune entrée ne
 * porte, ferait un nœud qui refuse TOUT en silence.
 */
function idsSousListe(type: TypeEntite, valeur: string): ReadonlySet<string> {
  const dataset = cibleDe(type);
  const table = IDS_PAR_DISCRIMINANT[dataset];
  if (!table) {
    throw new Error(
      `idDe('${type}', '${valeur}') : ${dataset} ne déclare aucun champ discriminant — poser \`export const discriminant\` sur son def, ou référer le type sans valeur.`,
    );
  }
  // EXISTENCE de la valeur : le registre GÉNÉRÉ en fait foi (fail-fast à la construction) — une valeur
  // discriminante est un univers FERMÉ (enum du def), que la mémoire ne peut pas élargir. Le CONTENU de
  // la sous-liste, lui, se lit vivant : une matière créée à l'atelier est référençable aussitôt.
  if (!table[valeur]) {
    throw new Error(
      `idDe('${type}', '${valeur}') : « ${valeur} » n'est aucune des valeurs discriminantes de ${dataset} (${Object.keys(table).join(', ')}).`,
    );
  }
  return idsVivantsDuDiscriminant(dataset, valeur) ?? fige(table[valeur]);
}

/**
 * Appartenance à la SOUS-LISTE MARQUÉE du dataset d'un type : les entrées qui PORTENT le champ
 * `marqueur` (le def le déclare : `export const marqueurs`, cf. `defs/props.ts`). Lue en MÉMOIRE quand
 * une source vivante est posée, sinon au registre généré `IDS_PAR_MARQUEUR`. SŒUR d'`idDe` et non
 * `idDe` lui-même : `idDe` REFUSE un id hors liste, alors qu'une entrée sans marqueur est une référence
 * valide — l'appartenance CONDITIONNE une autre règle (`defs-scenes/scene.ts`, cap d'un décor), elle
 * ne valide rien. FAIL-FAST à la CONSTRUCTION : un marqueur non déclaré ferait un prédicat toujours faux.
 */
export function porteLeMarqueur(type: TypeEntite, marqueur: string): (id: string) => boolean {
  const dataset = cibleDe(type);
  const table = IDS_PAR_MARQUEUR[dataset];
  if (!table?.[marqueur]) {
    throw new Error(
      `porteLeMarqueur('${type}', '${marqueur}') : ${dataset} ne déclare pas le marqueur « ${marqueur} » — l'ajouter à \`export const marqueurs\` de son def.`,
    );
  }
  const figee = fige(table[marqueur]);
  return (id) => (idsVivantsDuMarqueur(dataset, marqueur) ?? figee).has(id);
}

/** Catalogue de spécialisations d'UNE entrée (vide = l'entrée n'en déclare aucune) — lu en MÉMOIRE
 *  quand une source vivante est posée (`specsVivantesDe`), sinon au registre généré `SPECS_PAR_DATASET`. */
function catalogueSpecs(type: TypeEntite, id: string): readonly string[] {
  const dataset = cibleDe(type);
  return specsVivantesDe(dataset, id) ?? SPECS_PAR_DATASET[dataset]?.[id] ?? [];
}

/** Prédicat « entrée ouverte » par type, construit une fois. */
const ouvertes = new Map<TypeEntite, (id: string) => boolean>();

/**
 * L'entrée `id` de `type` admet-elle une spécialisation en TEXTE LIBRE hors de son catalogue ? La
 * DONNÉE le dit, entrée par entrée : le marqueur `specsOpen` (`export const marqueurs` du def,
 * `LDB 09 l.40`). Un type dont le def ne déclare pas ce marqueur n'a que des entrées FERMÉES.
 */
export function entreeOuverte(type: TypeEntite, id: string): boolean {
  let porte = ouvertes.get(type);
  if (!porte) {
    porte = IDS_PAR_MARQUEUR[cibleDe(type)]?.specsOpen ? porteLeMarqueur(type, 'specsOpen') : () => false;
    ouvertes.set(type, porte);
  }
  return porte(id);
}

/**
 * L'entrée porte-t-elle des Spécialisations ? La DONNÉE le dit, par un catalogue NON VIDE — `specs[]`
 * inline ou pool dérivé d'une `specsSource` (registre `SPECS_PAR_DATASET`, `npm run gen`). Sans
 * catalogue, ni `spec` ni `choix` n'ont de sens : la réf est un `ref(type)` nu. Pour les Compétences,
 * ce catalogue est celui des Compétences Groupées (`LDB 09 l.36`) ; pour les autres types, c'est une
 * déclaration du catalogue app-owned, sans équivalent au livre.
 */
export function estSpecialisable(type: TypeEntite, id: string): boolean {
  return catalogueSpecs(type, id).length > 0;
}

/** Refus d'un id qu'aucune entrée du catalogue de `type` ne porte. */
function refMorte(type: TypeEntite, id: string): string {
  return `« ${id} » est absent du catalogue des ${TYPES[type].catalogue} (${cibleDe(type)}).`;
}

/**
 * Clé du repère dans les `params` d'une issue : privée au module, donc infalsifiable par un autre
 * émetteur. Le repère porte le type d'entité validé.
 */
const REPERE: unique symbol = Symbol('repère de parse de mesure');

/** Clé du repère de NŒUD D'OP : même régime que `REPERE`, émis par `marquerOpAtteinte`. */
const REPERE_OP: unique symbol = Symbol('repère de nœud d’op');

/** Clé du repère de COLLECTION À CLÉ : même régime que `REPERE`, émis par `marquerCollectionAtteinte`. */
const REPERE_COLLECTION: unique symbol = Symbol('repère de collection à clé');

/**
 * MODE d'un parse de mesure : `slots` relève les feuilles `idDe` et les nœuds d'op ; `espaces` relève
 * les collections à clé (`grammaire/collection-cle.ts`). Un mode ne relève QUE ses repères : un repère
 * fait avorter le `pipe` qui le porte, si bien qu'un repère de l'autre mode masquerait les siens.
 */
export type ModeDeMesure = 'slots' | 'espaces';

/** Le mode du `mesureDuParse` en cours, le temps SYNCHRONE de l'appel, qui seul l'écrit, et jamais ailleurs : aucun export n'expose l'état. */
let parseDeMesure: ModeDeMesure | undefined;

/** Les feuilles construites par `idDe`, avec le type qu'elles référencent — ce que la garde du masquage
 *  (`parse-de-mesure.test.ts`) instrumente. */
const FEUILLES_D_ID = new WeakMap<object, TypeEntite>();

/** Le type référencé par une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const typeDeFeuilleDId = (noeud: unknown): TypeEntite | undefined =>
  typeof noeud === 'object' && noeud !== null ? FEUILLES_D_ID.get(noeud) : undefined;

/** Le nœud est-il une feuille construite par `idDe` ? */
export const estFeuilleDId = (noeud: unknown): boolean => typeDeFeuilleDId(noeud) !== undefined;

/**
 * Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. C'est la
 * FEUILLE porteuse de la référence, et la SEULE vérification d'un id contre le registre sous
 * `src/data/schemas` : au parse de mesure en mode `slots` (`mesureDuParse`), chaque validation réussie y émet un
 * REPÈRE, que le volet SLOTS de `docs/structures-donnees.md` lit comme le côté DÉCLARÉ.
 *
 * La liste admise se LIT À CHAQUE VALIDATION, parce que le registre a deux régimes déclarés
 * (`_ids.generated.ts`) : le fichier généré figé au commit, et le RECALCUL en mémoire de l'éditeur
 * (`CodexEdit.save` → `validateDataset`), qui remplace l'entrée du dataset. Les schémas, eux, se
 * construisent UNE fois au chargement du module : une lecture faite à la construction rendrait une
 * entité créée au Compendium invalide pour toute donnée qui la référence. La construction ne fait
 * qu'un contrôle FAIL-FAST de la sous-liste demandée.
 */
export function idDe<T extends TypeEntite>(type: T, valeur?: string): z.ZodType<Id<T>, string> {
  const dataset = cibleDe(type);
  if (valeur !== undefined) idsSousListe(type, valeur);
  const admis = (): ReadonlySet<string> => (valeur === undefined ? idsDe(type) : idsSousListe(type, valeur));
  const site = valeur === undefined ? `idDe('${type}')` : `idDe('${type}', '${valeur}')`;
  const feuille = z
    .string()
    .superRefine((v, ctx) => {
      if (admis().has(v)) {
        if (parseDeMesure === 'slots') ctx.addIssue({ code: 'custom', message: `repère de ${site}`, params: { [REPERE]: type }, continue: true });
        return;
      }
      ctx.addIssue({
        code: 'custom',
        message:
          valeur === undefined
            ? refMorte(type, v)
            : `« ${v} » est hors de la sous-liste « ${valeur} » du catalogue des ${TYPES[type].catalogue} (${dataset}).`,
      });
    })
    .transform((v) => v as Id<T>);
  FEUILLES_D_ID.set(feuille, type);
  return feuille;
}

/**
 * Marque le nœud en cours de validation comme un NŒUD D'OP ATTEINT par le parse (`gameOpSchema`,
 * `grammaire/mecanique.ts`), AVANT tout jugement de son payload : « atteint » ne dit pas « jugé » (une
 * op de `OPS_NON_TYPEES` est atteinte et son payload n'est jugé par aucune feuille `idDe`). Hors du
 * parse de mesure, l'appel ne fait rien : le parse normal n'y gagne aucun chemin.
 */
export function marquerOpAtteinte(ctx: z.RefinementCtx): void {
  if (parseDeMesure === 'slots') ctx.addIssue({ code: 'custom', message: 'repère de nœud d’op', params: { [REPERE_OP]: true }, continue: true });
}

/**
 * Marque la valeur en cours de validation comme une COLLECTION À CLÉ atteinte par le parse
 * (`marquerCollection`, `grammaire/collection-cle.ts`). Hors du parse de mesure en mode `espaces`,
 * l'appel ne fait rien.
 */
export function marquerCollectionAtteinte(ctx: z.RefinementCtx, marque: MarqueDeCollection): void {
  if (parseDeMesure === 'espaces')
    ctx.addIssue({ code: 'custom', message: 'repère de collection à clé', params: { [REPERE_COLLECTION]: marque }, continue: true });
}

/** Une référence validée par `idDe` au parse de mesure : son path de DONNÉE et son type. `parCle` :
 *  la valeur validée est la CLÉ d'un record (dernier segment du path), pas la valeur qu'elle pose. */
export interface RepereDeMesure {
  readonly path: readonly PropertyKey[];
  readonly type: TypeEntite;
  readonly parCle: boolean;
}

/** Une issue zod telle que `mesureDuParse` la lit. */
type IssueLue = {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly params?: { readonly [REPERE]?: TypeEntite; readonly [REPERE_OP]?: true; readonly [REPERE_COLLECTION]?: MarqueDeCollection };
  readonly errors?: readonly (readonly IssueLue[])[];
  readonly issues?: readonly IssueLue[];
};

const typeDuRepere = (issue: IssueLue): TypeEntite | undefined => issue.params?.[REPERE];
const estRepereDOp = (issue: IssueLue): boolean => issue.params?.[REPERE_OP] === true;
const marqueDuRepere = (issue: IssueLue): MarqueDeCollection | undefined => issue.params?.[REPERE_COLLECTION];

/** La FAMILLE du repère que portent les `params` d'une issue — `reference` (`idDe`) ou `op`
 *  (`marquerOpAtteinte`) —, `undefined` hors repère. Seule lecture des clés de repère hors de ce module :
 *  la garde du masquage (`parse-de-mesure.test.ts`) instrumente les deux familles. */
export function familleDuRepere(params: unknown): 'reference' | 'op' | undefined {
  const issue = { code: 'custom', path: [], message: '', params } as IssueLue;
  if (params === undefined || params === null) return undefined;
  if (typeDuRepere(issue) !== undefined) return 'reference';
  return estRepereDOp(issue) ? 'op' : undefined;
}

/** L'issue n'est-elle faite QUE de repères (union dont une branche l'est, clé/élément dont toutes les issues le sont) ? */
const estPropre = (issue: IssueLue): boolean =>
  typeDuRepere(issue) !== undefined ||
  estRepereDOp(issue) ||
  marqueDuRepere(issue) !== undefined ||
  (issue.code === 'invalid_union' && (issue.errors ?? []).some((b) => b.length > 0 && b.every(estPropre))) ||
  ((issue.code === 'invalid_key' || issue.code === 'invalid_element') && (issue.issues ?? []).length > 0 && issue.issues!.every(estPropre));

/** Une collection à clé atteinte par le parse de mesure : son path de DONNÉE et sa marque. */
export interface CollectionDeMesure {
  readonly path: readonly PropertyKey[];
  readonly marque: MarqueDeCollection;
}

/** Ce que rend le parse de mesure, selon son mode : en `slots`, les références validées par `idDe` et
 *  le path de DONNÉE de chaque nœud d'op que `gameOpSchema` a validé (`marquerOpAtteinte`) ; en
 *  `espaces`, les collections à clé (`marquerCollectionAtteinte`). */
export interface MesureDuParse {
  readonly reperes: readonly RepereDeMesure[];
  readonly ops: readonly (readonly PropertyKey[])[];
  readonly collections: readonly CollectionDeMesure[];
}

type Recueil = { reperes: RepereDeMesure[]; ops: (readonly PropertyKey[])[]; collections: CollectionDeMesure[] };

function recueillir(issues: readonly IssueLue[], prefixe: readonly PropertyKey[], parCle: boolean, out: Recueil): void {
  for (const issue of issues) {
    const path = [...prefixe, ...issue.path];
    const type = typeDuRepere(issue);
    if (type !== undefined) {
      out.reperes.push({ path, type, parCle });
      continue;
    }
    if (estRepereDOp(issue)) {
      out.ops.push(path);
      continue;
    }
    const marque = marqueDuRepere(issue);
    if (marque !== undefined) {
      out.collections.push({ path, marque });
      continue;
    }
    // La PREMIÈRE branche propre est celle que le parse normal choisit : la première sans issue.
    const branche = issue.code === 'invalid_union' ? issue.errors?.find((b) => b.length > 0 && b.every(estPropre)) : undefined;
    if (branche) recueillir(branche, path, parCle, out);
    else if (issue.code === 'invalid_key' && estPropre(issue)) recueillir(issue.issues!, path, true, out);
    else if (issue.code === 'invalid_element' && estPropre(issue)) recueillir(issue.issues!, path, parCle, out);
    else
      throw new Error(
        `parse de mesure : issue « ${issue.code} » à « ${path.map(String).join('.') || '(racine)'} » (${issue.message}) — ni repère, ni union, clé ou élément fait de repères : le document est invalide au parse normal.`,
      );
  }
}

/**
 * PARSE DE MESURE d'une donnée par son schéma RÉEL, au `mode` donné : en `slots`, les références que
 * `idDe` y valide et les nœuds d'op que `gameOpSchema` y valide ; en `espaces`, les collections à clé
 * qu'il y atteint — chacun à son path de DONNÉE. Le mode est borné par construction : `parseDeMesure`
 * n'est posé que pendant l'appel SYNCHRONE à `safeParse` (zod lève sur tout nœud async), et le
 * `finally` le rend à sa valeur précédente, y compris quand le recueil lève. Les seuls parses exécutés
 * dans cette fenêtre sont ceux que ce `safeParse` imbrique (payload d'une op,
 * `grammaire/mecanique.ts › gameOpSchema`).
 * La donnée doit être VALIDE au parse normal, et c'est ce parse, exécuté HORS de la fenêtre de mesure,
 * qui en juge : dans la fenêtre, un repère fait avorter le `pipe` qui le porte, et un raffinement posé
 * EN SORTIE (`.transform`, `.pipe`) ne s'y exécute pas. Un échec du parse normal LÈVE en nommant sa
 * première issue ; dans la fenêtre, une issue qui n'est pas un repère LÈVE aussi.
 */
export function mesureDuParse(schema: z.ZodType, donnee: unknown, mode: ModeDeMesure = 'slots'): MesureDuParse {
  const normal = schema.safeParse(donnee);
  if (!normal.success) {
    const [premiere] = normal.error.issues;
    throw new Error(
      `parse de mesure : la donnée est invalide au parse normal — issue « ${premiere.code} » à « ${premiere.path.map(String).join('.') || '(racine)'} » (${premiere.message}).`,
    );
  }
  const precedent = parseDeMesure;
  parseDeMesure = mode;
  try {
    const resultat = schema.safeParse(donnee);
    const out: Recueil = { reperes: [], ops: [], collections: [] };
    if (!resultat.success) recueillir(resultat.error.issues as unknown as readonly IssueLue[], [], false, out);
    return out;
  } finally {
    parseDeMesure = precedent;
  }
}

/** Les seules références de `mesureDuParse`. */
export function reperesDuParse(schema: z.ZodType, donnee: unknown): readonly RepereDeMesure[] {
  return mesureDuParse(schema, donnee).reperes;
}

/**
 * Liste d'ids nus de `type` — SEULE graphie de « liste de références » de la grammaire (un
 * `z.array(idDe(...))` écrit au site en serait une seconde, sur le ticket même qui chasse les
 * divergences de forme). `min` borne la liste quand le porteur EXIGE au moins une référence :
 * `ShipCrewHit.crewTarget.stations` vise au moins une présence, une liste vide ne désignant
 * personne. Le retour n'est PAS érasé en `z.ZodType` — sinon `.min()` ne survivrait pas à l'appel,
 * et le site le réécrirait à la main.
 */
export function refs<T extends TypeEntite>(type: T, opts?: { min?: number }): z.ZodArray<z.ZodType<Id<T>, string>> {
  const liste = z.array(idDe(type));
  return opts?.min === undefined ? liste : liste.min(opts.min);
}

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`). */
export function ref<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return z.strictObject({ id: idDe(type), ...((extra ?? {}) as Record<string, z.ZodType>) });
}

/** FORME de sortie d'un nœud de référence à spécialisation — DÉCLARÉE (et non inferée) : les `extra`
 *  du porteur n'y figurent pas, un site qui les lit redéclare son type (patron `AxesData`,
 *  `schemas/defs/axes.ts`). Sans cette déclaration, tout schéma RÉCURSIF annoté qui compose une réf
 *  (`flowSchema: ZodType<Flow<EffectOp>>`) perdrait sa forme et cesserait de typer son arbre.
 *  `RefDesignee` : la forme d'un porteur qui DÉSIGNE (régime `specSeule`) ; `RefASpecialisation` :
 *  celle d'un porteur d'EMPLACEMENT, qui admet aussi `choix`. */
export interface RefDesignee { id: string; spec?: string }
export interface RefASpecialisation extends RefDesignee { choix?: true | string[] }

/**
 * Le littéral que le livre imprime à la place d'une spécialisation — `LDB 08 l.140` ; Compétence
 * Groupée : `LDB 09 l.40`. Ce n'est pas une
 * spécialisation, c'est un EMPLACEMENT non désigné — la grammaire l'écrit `choix`. Refusé AU SCHÉMA
 * (et non par un seul contrat de dataset) : le verrou couvre du même geste `src/data` et `src/scenes`,
 * y compris les entrées OUVERTES (`entreeOuverte`) que le catalogue ne filtre pas.
 */
const SENTINELLE_DE_SPEC = /^au[\s-]+choix$/i;

/**
 * La spécialisation `spec` de l'entrée `id` de `type` est-elle ADMISE, et sinon pourquoi — prédicat
 * UNIQUE, lu par le nœud à spécialisation ci-dessous et par la couverture d'un emplacement
 * (`slotCovers`, `engine/careerSlots.ts`) : `nonSpecialisable` (aucun catalogue), `sentinelle` (un
 * emplacement non désigné), `horsCatalogue` (entrée FERMÉE, spec absente de son catalogue), ou
 * `null` (admise).
 */
export function refusDeSpec(type: TypeEntite, id: string, spec: string): 'nonSpecialisable' | 'sentinelle' | 'horsCatalogue' | null {
  if (!estSpecialisable(type, id)) return 'nonSpecialisable';
  if (SENTINELLE_DE_SPEC.test(spec)) return 'sentinelle';
  if (entreeOuverte(type, id)) return null;
  return catalogueSpecs(type, id).includes(spec) ? null : 'horsCatalogue';
}

/**
 * RÉGIME d'une référence à spécialisation — ce que le PORTEUR admet :
 *  - `specOuChoix` : exactement un de `spec` / `choix` (`specRef`, option d'un `pick`) ;
 *  - `specSeule` : `{ id }` ou `{ id, spec }` — un porteur qui DÉSIGNE ; `choix` refusé (défaut de
 *    `refOuSpec`) ;
 *  - `specOuChoixFacultatifs` : `{ id }`, `{ id, spec }` ou `{ id, choix }` — un porteur d'EMPLACEMENT.
 */
export type RegimeDeSpec = 'specOuChoix' | 'specSeule' | 'specOuChoixFacultatifs';

/** Régime qu'un PORTEUR déclare pour une référence dont la spécialisation est facultative (`refOuSpec`). */
export type RegimeDePorteur = Exclude<RegimeDeSpec, 'specOuChoix'>;

/** Nœud `{ id, spec?, choix?, …extra }` + validation de la spécialisation, au `regime` du porteur. */
function noeudASpecialisation<T extends TypeEntite>(
  type: T,
  extra: Record<string, z.ZodType> | undefined,
  regime: RegimeDeSpec,
): z.ZodType<RefASpecialisation> {
  const dataset = cibleDe(type);
  const catalogue = TYPES[type].catalogue;
  const unRegime = (id: unknown): string =>
    `« ${String(id)} » : une spécialisation se désigne par « spec » OU par « choix », exactement un des deux (catalogue des ${catalogue}).`;
  return z
    .strictObject({
      id: idDe(type),
      spec: z.string().min(1).optional(),
      choix: z.union([z.literal(true), z.array(z.string().min(1)).min(1)]).optional(),
      ...((extra ?? {}) as Record<string, z.ZodType>),
    })
    .superRefine((v, ctx) => {
      const aSpec = v.spec != null;
      const aChoix = v.choix != null;
      if (!aSpec && !aChoix) {
        if (regime !== 'specOuChoix') return;
        ctx.addIssue({ code: 'custom', message: unRegime(v.id) });
        return;
      }
      if (aChoix && regime === 'specSeule') {
        ctx.addIssue({
          code: 'custom',
          path: ['choix'],
          message: `« ${String(v.id)} » : ce champ DÉSIGNE une spécialisation — « choix » (emplacement non désigné) n'y est pas admis, seul « spec » l'est (catalogue des ${catalogue}, ${dataset}).`,
        });
        return;
      }
      if (!estSpecialisable(type, String(v.id))) {
        ctx.addIssue({
          code: 'custom',
          message: `« ${String(v.id)} » ne déclare aucune spécialisation au catalogue des ${catalogue} (${dataset}) — « spec » et « choix » ne s'y appliquent pas.`,
        });
        return;
      }
      if (aSpec && aChoix) {
        ctx.addIssue({ code: 'custom', message: unRegime(v.id) });
        return;
      }
      const candidats = aSpec ? [v.spec as string] : Array.isArray(v.choix) ? (v.choix as string[]) : [];
      const refus = candidats.map((c) => [c, refusDeSpec(type, String(v.id), c)] as const);
      // Une sentinelle masque le reste : l'auteur a écrit un emplacement là où il désignait.
      const motif = refus.some(([, r]) => r === 'sentinelle') ? 'sentinelle' : 'horsCatalogue';
      for (const [c, r] of refus) {
        if (r !== motif) continue;
        ctx.addIssue({
          code: 'custom',
          path: [aSpec ? 'spec' : 'choix'],
          message:
            r === 'sentinelle'
              ? `« ${c} » n'est pas une spécialisation mais un EMPLACEMENT non désigné de « ${String(v.id)} » (catalogue des ${catalogue}, ${dataset}) — s'écrit « choix ».`
              : `« ${c} » est absente des spécialisations de « ${String(v.id)} » au catalogue des ${catalogue} (${dataset}).`,
        });
      }
    });
}

/**
 * Référence À SPÉCIALISATION : `{ id, spec }` XOR `{ id, choix: true | [ids] }` — exactement UN des
 * deux régimes (une réf sans spécialisation est un `ref(type)` nu, ou un `refOuSpec(type)` quand le
 * site accepte les deux). L'entrée VISÉE doit d'abord être spécialisable, c'est-à-dire déclarer un
 * catalogue de specs (`estSpecialisable`) ; `spec`/`choix` sont ensuite validés contre ce catalogue
 * quand l'entrée est FERMÉE (`entreeOuverte`).
 */
export function specRef<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return noeudASpecialisation(type, extra, 'specOuChoix');
}

/**
 * Référence dont la spécialisation est FACULTATIVE : `{ id }` (aucune spécialisation visée) OU
 * `{ id, spec }` — et `{ id, choix }` pour un porteur d'EMPLACEMENT, qui ouvre le régime
 * `specOuChoixFacultatifs`. MÊME nœud que `specRef`, seul le régime change — donc UN
 * seul nœud par site (jamais une union de deux graphies du même emplacement) : c'est la forme à
 * écrire dès qu'une donnée désigne une entrée « toute spécialisation comprise » aussi bien qu'une spécialisation précise.
 */
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<RefDesignee>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra: E | undefined,
  regime: 'specOuChoixFacultatifs',
): z.ZodType<RefASpecialisation>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra: E | undefined,
  regime: RegimeDePorteur,
): z.ZodType<RefASpecialisation>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
  regime: RegimeDePorteur = 'specSeule',
): z.ZodType<RefASpecialisation> {
  return noeudASpecialisation(type, extra, regime);
}

/**
 * Choix « n parmi » : `{ pick, of: [...] }` (liste énumérée) ou `{ pick, table }` (tirage sur une
 * table d100). Remplace les graphies `choice[]` et `random` des lots L2/L3.
 *
 * Une entrée de `of` est l'UNION des trois façons de désigner une option : référence nue `ref(type)`,
 * référence à spécialisation `specRef(type)` (`{id, spec}` XOR `{id, choix}`, validée contre le pool
 * de l'entrée À TRAVERS l'`of`), ou un `pick` IMBRIQUÉ (un « n parmi » dont une option est elle-même
 * un choix, y compris un tirage sur table). La récursion se referme sur le nœud LUI-MÊME (`noeud`).
 *
 * `optionsDuPorteur` ouvre l'`of` aux formes que le PORTEUR admet en plus des trois ci-dessus —
 * même composition FERMÉE que l'`extra` de `ref()`/`specRef()` : le porteur déclare ce qu'il
 * accepte, la fabrique ne connaît aucun cas particulier (cf. `avancement.ts`, `{random}`).
 */
export function pick<T extends TypeEntite>(type: T, optionsDuPorteur: readonly z.ZodType<unknown>[] = []): z.ZodType<unknown> {
  const n = z.number().int().positive();
  const option: z.ZodType<unknown> = z.lazy(() => z.union([ref(type), specRef(type), noeud, ...optionsDuPorteur]));
  const noeud: z.ZodType<unknown> = z.union([
    z.strictObject({ pick: n, of: z.array(option).min(1) }),
    z.strictObject({ pick: n, table: ref('table') }),
  ]);
  return noeud;
}

