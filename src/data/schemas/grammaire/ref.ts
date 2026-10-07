import { nommerChamps, metasExtra } from './meta';
/**
 * FABRIQUE DE RÉFÉRENCE (#1466) — la seule façon de désigner une entité par son id.
 *
 * `ref(type)` construit ET ENREGISTRE le nœud FINAL : l'id est refiné AU PARSE contre l'INDEX DES
 * IDS `IDS_PAR_ESPACE` (`npm run gen`), si bien qu'une référence morte casse au chargement, en
 * test et à la sauvegarde du Compendium — sans qu'aucune garde nominative n'ait à l'énumérer
 * (clause B absorbée de #1473). La fabrique n'expose aucun nœud extensible : zod 4.4.3 perd le
 * registre et la `.meta()` au `.extend`, la composition se fait donc ICI via `extra`.
 */
import { z } from 'zod';
import './locale-fr';
import { IDS_PAR_ESPACE } from '../_ids.generated';
import { baseDe, cleDesSpecs, cleFiltree, lireCleDEspace, porteLeChampMarqueur } from './cle-d-espace';
import { idsVivants } from './idsVivants';

declare const marqueDeType: unique symbol;
/** Id BRANDÉ par son type — frappé à la porte zod, jamais par un `as` d'appelant. */
export type Id<T extends string> = string & { readonly [marqueDeType]: T };

/** Ce qu'un type d'entité déclare : son espace de noms et le nom de son catalogue. */
export interface DeclarationDeType {
  /** CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`) de l'espace qui fait AUTORITÉ sur les ids de ce type. */
  readonly espace: string;
  /** Le catalogue tel que l'AUTEUR le nomme, au pluriel (« des sorts ») : le refus d'une référence
   *  morte se lit à l'éditeur, au Compendium et à l'import d'un projet, jamais qu'en CI. */
  readonly catalogue: string;
}

/**
 * Types d'entité déclarés à la grammaire. La liste est celle des concepts que les lots L2/L3 du
 * chantier migrent (Compétence, puis Talent/Trait/Objet/Sort/Créature/Véhicule/Structure, +
 * Carrière et Trait NAVAL au L-gram-2 #1463) + la TABLE, cible de `pick({ table })`, + la MATIÈRE du
 * monde (#1686), premier type dont l'espace est DISCRIMINÉ (`idDe('material', 'prop')`), + le
 * TERRAIN et le DÉCOR (#1690 : `layer.tiles` résout un terrain, `terrains › overlayProp` un décor),
 * + l'ESPÈCE (#1520 : `pregens.json › species`).
 * Un type s'ajoute avec le lot qui le migre, jamais « au cas où ».
 */
export const TYPES = {
  skill: { espace: 'skills.json', catalogue: 'compétences' },
  talent: { espace: 'talents.json', catalogue: 'talents' },
  trait: { espace: 'traits.json', catalogue: 'traits' },
  trapping: { espace: 'trappings.json', catalogue: 'objets' },
  spell: { espace: 'spells.json', catalogue: 'sorts' },
  creature: { espace: 'creatures.json', catalogue: 'créatures' },
  vehicle: { espace: 'vehicles.json', catalogue: 'véhicules' },
  structure: { espace: 'structures.json', catalogue: 'structures' },
  career: { espace: 'careers.json', catalogue: 'carrières' },
  species: { espace: 'species.json', catalogue: 'espèces' },
  navalTrait: { espace: 'naval-traits.json', catalogue: 'traits navals' },
  // PORT du catalogue naval : `MapPlace.port.ref` résout AU PARSE, toutes les réfs mortes nommées.
  navalPort: { espace: 'naval-ports.json', catalogue: 'ports' },
  shipStation: { espace: 'ship-stations.json', catalogue: 'postes de navire' },
  crewRole: { espace: 'crew-roles.json', catalogue: 'rôles d’équipage' },
  table: { espace: 'tables.json', catalogue: 'tables' },
  etat: { espace: 'etats.json', catalogue: 'états' },
  maladie: { espace: 'maladies.json', catalogue: 'maladies' },
  symptome: { espace: 'symptoms.json', catalogue: 'symptômes' },
  material: { espace: 'materials.json', catalogue: 'matières' },
  // RÈGLE OPTIONNELLE : cible du terme `{rule}` d'une `Formula` (#1599) — une quantité que le livre ne
  // chiffre pas se lit au registre, l'id résout donc AU PARSE comme toute autre référence.
  regleOptionnelle: { espace: 'reglesOptionnelles.json', catalogue: 'règles optionnelles' },
  terrain: { espace: 'terrains.json', catalogue: 'terrains' },
  // PALIER D'ÉCLAIRAGE (#1716) : la semence d'éclairage d'une scène neuve (`semences-de-scene.json`)
  // nomme un palier — l'id résout AU PARSE, là où `Scene.ambientLight` reste une chaîne libre.
  lightLevel: { espace: 'lightLevels.json', catalogue: 'paliers d’éclairage' },
  prop: { espace: 'props.json', catalogue: 'décors' },
  building: { espace: 'buildings.json', catalogue: 'bâtiments' },
  // AXE de forces/faiblesses (#409) : `activeAxes` d'un projet de scène résout AU PARSE (#1473 R1).
  axe: { espace: 'axes.json', catalogue: 'axes' },
} as const satisfies Record<string, DeclarationDeType>;

export type TypeEntite = keyof typeof TYPES;

/** Clé de l'espace qui fait autorité sur les ids d'un type. */
export function espaceDe(type: TypeEntite): string {
  return TYPES[type].espace;
}

/** Espace FIGÉ du registre généré, en `Set` construit une fois par clé d'espace. */
const figes = new Map<string, ReadonlySet<string>>();
function fige(cle: string): ReadonlySet<string> | undefined {
  const liste = IDS_PAR_ESPACE[cle];
  if (!liste) return undefined;
  let ids = figes.get(cle);
  if (!ids) figes.set(cle, (ids = new Set(liste)));
  return ids;
}

/**
 * SEULE lecture des ids d'un espace, par sa clé : la MÉMOIRE d'abord (`idsVivants`, second régime
 * déclaré par `_ids.generated.ts`) — une entité créée ou renommée à l'atelier est référençable
 * IMMÉDIATEMENT —, sinon l'INDEX DES IDS généré. Hors application (scripts, gardes, `npm run gen`),
 * aucune source n'est posée et le fichier généré fait foi. `undefined` : l'espace n'existe pas.
 */
export function lireLEspace(cle: string): ReadonlySet<string> | undefined {
  return idsVivants(cle) ?? fige(cle);
}

/** SEULE lecture des CLÉS de l'INDEX DES IDS (quels espaces existent). */
const clesDeLIndex = (): readonly string[] => Object.keys(IDS_PAR_ESPACE);

/** Ids d'un espace DÉSIGNÉ : une clé absente LÈVE — un désignateur qui vise un espace que la phase 2
 *  ne mesure pas refuserait tout en silence. */
function idsDesignes(cle: string, site: string): ReadonlySet<string> {
  const ids = lireLEspace(cle);
  if (!ids) throw new Error(`${site} : « ${cle} » n'est aucun espace de l'INDEX DES IDS (\`IDS_PAR_ESPACE\`, \`npm run gen\`).`);
  return ids;
}

/**
 * Clé d'espace de la sous-liste `valeur` d'un type discriminé : le CHAMP discriminant se lit aux clés
 * de l'INDEX DES IDS (`<espace>?<champ>=<valeur>`), où la phase 2 l'écrit depuis le paramètre
 * `espace.discriminant` du def — une seule déclaration, au nœud.
 */
const champsDiscriminants = new Map<string, string>();
function cleDeSousListe(type: TypeEntite, valeur: string, site: string): string {
  const espace = espaceDe(type);
  const connu = champsDiscriminants.get(espace);
  if (connu !== undefined) return cleFiltree(espace, { champ: connu, vaut: valeur });
  const champs = new Set(
    clesDeLIndex().flatMap((cle) => {
      const lue = lireCleDEspace(cle);
      return baseDe(lue) === espace && lue.filtre?.vaut !== undefined ? [lue.filtre.champ] : [];
    }),
  );
  if (champs.size !== 1)
    throw new Error(`${site} : ${espace} ${champs.size ? `a ${champs.size} champs discriminants (${[...champs].join(', ')})` : "n'a aucun champ discriminant (paramètre `espace.discriminant` de son def)"}.`);
  const [champ] = champs;
  champsDiscriminants.set(espace, champ);
  return cleFiltree(espace, { champ, vaut: valeur });
}

/** Sous-liste MARQUÉE : l'espace d'un type PRIVÉ des entrées qui portent l'un de ses marqueurs
 *  (paramètre `espace.marqueurs` du def) — `INSTANCIABLE_PAR_ID` (`grammaire/sousListes.ts`). */
type SousListeMarquee = { readonly horsMarqueurs: readonly string[] };

/**
 * SOUS-LISTE qu'une feuille `idDe` retient de l'espace de son type : une chaîne, la sous-liste
 * DISCRIMINÉE de cette valeur (`idDe('material', 'prop')`) ; une `SousListeMarquee`, l'espace PRIVÉ des
 * sous-listes MARQUÉES qu'elle nomme (celles que lit `porteLeMarqueur`) — `idDe('trapping', INSTANCIABLE_PAR_ID)`.
 */
type SousListe = string | SousListeMarquee;

/** Clé de la sous-liste marquée `marqueur` de l'espace d'un type (paramètre `espace.marqueurs` du def). */
const cleDuMarqueur = (type: TypeEntite, marqueur: string): string => cleFiltree(espaceDe(type), { champ: marqueur });

/** Refus d'une référence à l'entrée `id` qui porte le marqueur `marqueur`, ou `null` sans marqueur. */
const refusDeMarqueur = (type: TypeEntite, id: string, marqueur: string | undefined): string | null =>
  marqueur === undefined
    ? null
    : `« ${id} » porte le marqueur « ${marqueur} » : cette référence l'exclut du catalogue des ${TYPES[type].catalogue} (${espaceDe(type)}).`;

/** Le refus d'un id PRÉSENT dans l'espace de son type par une sous-liste marquée — `null` s'il est ADMIS. */
function refusDuMarqueur(type: TypeEntite, sousListe: SousListeMarquee, site: string, id: string): string | null {
  return refusDeMarqueur(type, id, sousListe.horsMarqueurs.find((m) => idsDesignes(cleDuMarqueur(type, m), site).has(id)));
}

/** Le premier marqueur de la sous-liste que porte l'ENTRÉE (`porteLeChampMarqueur`), `undefined` sinon. */
const marqueurDeLEntree = (sousListe: SousListeMarquee, entree: object): string | undefined =>
  sousListe.horsMarqueurs.find((m) => porteLeChampMarqueur(entree as Readonly<Record<string, unknown>>, m));

/** Le refus d'un id par une sous-liste DISCRIMINÉE — `null` s'il est ADMIS. */
const refusDeLaDiscriminee = (type: TypeEntite, sousListe: string, site: string, id: string): string | null =>
  idsDesignes(cleDeSousListe(type, sousListe, site), site).has(id)
    ? null
    : `« ${id} » est hors de la sous-liste « ${sousListe} » du catalogue des ${TYPES[type].catalogue} (${espaceDe(type)}).`;

/** Le refus d'une sous-liste, jugé sur l'ENTRÉE résolue (objet du catalogue ou de la campagne) — la
 *  marquée sur ses champs (`marqueurDeLEntree`), la discriminée sur son id —, lu par le sélecteur qui
 *  résout une saisie hors du registre (`ui/compendium/RefField.tsx`). */
export function refusDeLEntree(type: TypeEntite, sousListe: SousListe, entree: { readonly id: string }): string | null {
  return typeof sousListe === 'string'
    ? refusDeLaDiscriminee(type, sousListe, `refusDeLEntree('${type}')`, entree.id)
    : refusDeMarqueur(type, entree.id, marqueurDeLEntree(sousListe, entree));
}

/** Le refus d'un id par une feuille `idDe(type, sousListe?)` — `null` s'il est ADMIS —, lu à chaque validation. */
function refusDe(type: TypeEntite, sousListe: SousListe | undefined, site: string, id: string): string | null {
  if (typeof sousListe === 'string') return refusDeLaDiscriminee(type, sousListe, site, id);
  if (!idsDesignes(espaceDe(type), site).has(id)) return refMorte(type, id);
  return sousListe === undefined ? null : refusDuMarqueur(type, sousListe, site, id);
}

/**
 * L'ENTRÉE résolue appartient-elle à la sous-liste marquée ? Le runtime juge l'entrée elle-même (objet
 * du catalogue OU de la campagne, `state/campaignData.ts`) par `porteLeChampMarqueur`, le prédicat
 * qui bâtit les clés `<espace>?<marqueur>` que `refusDuMarqueur` lit au schéma.
 */
export function dansLaSousListe(sousListe: SousListeMarquee, entree: object): boolean {
  return marqueurDeLEntree(sousListe, entree) === undefined;
}

/** Les ids ADMIS par `idDe(type, sousListe)`, dans l'ordre de la donnée, lus au registre (régime
 *  vivant compris, `lireLEspace`) — les options d'un sélecteur et les producteurs qui énumèrent la
 *  sous-liste. */
export function idsDeLaSousListe(type: TypeEntite, sousListe: SousListe): readonly string[] {
  const site = `idsDeLaSousListe('${type}')`;
  if (typeof sousListe === 'string') return [...idsDesignes(cleDeSousListe(type, sousListe, site), site)];
  return [...idsDesignes(espaceDe(type), site)].filter((id) => refusDuMarqueur(type, sousListe, site, id) === null);
}

/** Ids admis de `type` — l'ensemble que juge `idDe(type)`. */
export function idsDe(type: TypeEntite): ReadonlySet<string> {
  return idsDesignes(espaceDe(type), `idsDe('${type}')`);
}

/**
 * Appartenance à la SOUS-LISTE MARQUÉE de l'espace d'un type : les entrées qui PORTENT le champ
 * `marqueur` (paramètre `espace.marqueurs` du def, cf. `defs/props.ts`), clé `<espace>?<marqueur>`.
 * SŒUR d'`idDe` et non `idDe` lui-même : `idDe` REFUSE un id hors liste, alors qu'une entrée sans
 * marqueur est une référence valide — l'appartenance CONDITIONNE une autre règle
 * (`defs-scenes/scene.ts`, cap d'un décor), elle ne valide rien. Un marqueur que la phase 2 ne mesure
 * pas LÈVE à l'appel.
 */
export function porteLeMarqueur(type: TypeEntite, marqueur: string): (id: string) => boolean {
  const cle = cleDuMarqueur(type, marqueur);
  const site = `porteLeMarqueur('${type}', '${marqueur}')`;
  DESIGNATIONS.add(cle);
  return (id) => idsDesignes(cle, site).has(id);
}

/** Catalogue de spécialisations d'UNE entrée (vide = l'entrée n'en déclare aucune) : l'espace de ses
 *  `specs` (`<espace>#[<id>].specs`), l'univers de sa `specsSource` compris (`lectureDeLEspace`). */
function catalogueSpecs(type: TypeEntite, id: string): readonly string[] {
  return [...(lireLEspace(cleDesSpecs(espaceDe(type), id)) ?? [])];
}

/**
 * L'entrée `id` de `type` admet-elle une spécialisation en TEXTE LIBRE hors de son catalogue ? La
 * DONNÉE le dit, entrée par entrée : le marqueur `specsOpen` (paramètre `espace.marqueurs` du def,
 * `LDB 09 l.40`). Un type dont l'espace n'a pas ce marqueur n'a que des entrées FERMÉES.
 */
export function entreeOuverte(type: TypeEntite, id: string): boolean {
  return lireLEspace(cleFiltree(espaceDe(type), { champ: 'specsOpen' }))?.has(id) ?? false;
}

/**
 * L'entrée porte-t-elle des Spécialisations ? La DONNÉE le dit, par un catalogue NON VIDE — `specs[]`
 * inline ou univers d'une `specsSource` (INDEX DES IDS, `npm run gen`). Sans
 * catalogue, ni `spec` ni `choix` n'ont de sens : la réf est un `ref(type)` nu. Pour les Compétences,
 * ce catalogue est celui des Compétences Groupées (`LDB 09 l.36`) ; pour les autres types, c'est une
 * déclaration du catalogue app-owned, sans équivalent au livre.
 */
export function estSpecialisable(type: TypeEntite, id: string): boolean {
  return catalogueSpecs(type, id).length > 0;
}

/** Refus d'un id qu'aucune entrée du catalogue de `type` ne porte. */
function refMorte(type: TypeEntite, id: string): string {
  return `« ${id} » est absent du catalogue des ${TYPES[type].catalogue} (${espaceDe(type)}).`;
}

/**
 * Clé du repère dans les `params` d'une issue : privée au module, donc infalsifiable par un autre
 * émetteur. Le repère porte le type d'entité validé.
 */
const REPERE: unique symbol = Symbol('repère de parse de mesure');

/** Clé du repère de NŒUD D'OP : même régime que `REPERE`, émis par `marquerOpAtteinte`. */
const REPERE_OP: unique symbol = Symbol('repère de nœud d’op');

/** Un `mesureDuParse` est-il en cours ? Le temps SYNCHRONE de l'appel, qui seul l'écrit, et jamais ailleurs : aucun export n'expose l'état. */
let parseDeMesure = false;

/** Ce qu'une feuille `idDe` déclare : le type référencé, sa sous-liste, et `ouverte` (un id absent de
 *  l'espace est admis sans être une référence du type). */
export interface FeuilleDId {
  readonly type: TypeEntite;
  readonly sousListe?: SousListe;
  readonly ouverte: boolean;
}

/** Les feuilles construites par `idDe`, avec leur déclaration — ce que la garde du masquage
 *  (`parse-de-mesure.test.ts`) instrumente et ce que lit un sélecteur (`declarationDeFeuilleDId`). */
const FEUILLES_D_ID = new WeakMap<object, FeuilleDId>();

/** La déclaration (`FeuilleDId`) d'une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const declarationDeFeuilleDId = (noeud: unknown): FeuilleDId | undefined =>
  typeof noeud === 'object' && noeud !== null ? FEUILLES_D_ID.get(noeud) : undefined;

/** Le type référencé par une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const typeDeFeuilleDId = (noeud: unknown): TypeEntite | undefined => declarationDeFeuilleDId(noeud)?.type;

/** Les espaces que les feuilles `idDe` et les `porteLeMarqueur` construits désignent : une clé d'espace
 *  (sous-liste marquée comprise), ou `<espace>\0<valeur>` pour une sous-liste discriminée — la cible que
 *  `espaces-contrat.test.ts` exige à l'INDEX DES IDS. */
const DESIGNATIONS = new Set<string>();

/** Chaque désignation construite, en clé d'espace (la valeur discriminée résolue par `cleDeSousListe`). */
export function espacesDesignes(): string[] {
  return [...DESIGNATIONS].map((d) => {
    const [espace, valeur] = d.split('\u0000');
    if (valeur === undefined) return espace;
    const type = (Object.keys(TYPES) as TypeEntite[]).find((t) => espaceDe(t) === espace)!;
    return cleDeSousListe(type, valeur, `idDe('${type}', '${valeur}')`);
  });
}

/** Le nœud est-il une feuille construite par `idDe` ? */
export const estFeuilleDId = (noeud: unknown): boolean => typeDeFeuilleDId(noeud) !== undefined;

/**
 * Schéma d'un id NU de `type` : refiné contre le registre, brandé `Id<type>` à la sortie. C'est la
 * FEUILLE porteuse de la référence, et la SEULE vérification d'un id contre le registre sous
 * `src/data/schemas` : au parse de mesure (`mesureDuParse`), chaque validation réussie y émet un
 * REPÈRE, que le volet SLOTS de `docs/structures-donnees.md` lit comme le côté DÉCLARÉ.
 *
 * La liste admise se LIT À CHAQUE VALIDATION, parce que le registre a deux régimes déclarés
 * (`_ids.generated.ts`) : le fichier généré figé au commit, et le RECALCUL sur les racines vivantes,
 * refait par version du dataset à toute écriture du seam (`src/data/overrides.ts`). Les schémas, eux, se
 * construisent UNE fois au chargement du module : une lecture faite à la construction rendrait une
 * entité créée au Compendium invalide pour toute donnée qui la référence. La construction ne lit pas
 * la table (`idsVivants.ts`, en-tête) : un espace désigné et absent LÈVE au parse, et
 * `espaces-contrat.test.ts` exige la cible de chaque désignation (`espacesDesignes`).
 *
 * `ouverte` : le porteur admet aussi un id ABSENT de l'espace, que son runtime résout ailleurs (Effet
 * `giveTrapping` : objets de la campagne, `state/campaignData.ts`, sinon objet `custom`) ; un id
 * PRÉSENT reste jugé par la sous-liste. Un id absent n'émet aucun repère : il n'est pas une référence
 * du type.
 */
export function idDe<T extends TypeEntite>(type: T, sousListe?: SousListe, options?: { readonly ouverte?: boolean }): z.ZodType<Id<T>, string> {
  const ouverte = options?.ouverte === true;
  const site =
    (sousListe === undefined
      ? `idDe('${type}'`
      : typeof sousListe === 'string'
        ? `idDe('${type}', '${sousListe}'`
        : `idDe('${type}', { horsMarqueurs: [${sousListe.horsMarqueurs.map((m) => `'${m}'`).join(', ')}] }`) + (ouverte ? ', { ouverte: true })' : ')');
  const feuille = z
    .string()
    .superRefine((v, ctx) => {
      if (ouverte && !idsDesignes(espaceDe(type), site).has(v)) return;
      const refus = refusDe(type, sousListe, site, v);
      if (refus === null) {
        if (parseDeMesure) ctx.addIssue({ code: 'custom', message: `repère de ${site}`, params: { [REPERE]: type }, continue: true });
        return;
      }
      ctx.addIssue({ code: 'custom', message: refus });
    })
    .transform((v) => v as Id<T>);
  FEUILLES_D_ID.set(feuille, sousListe === undefined ? { type, ouverte } : { type, sousListe, ouverte });
  if (typeof sousListe === 'string') DESIGNATIONS.add(`${espaceDe(type)}\u0000${sousListe}`);
  else {
    DESIGNATIONS.add(espaceDe(type));
    for (const m of sousListe?.horsMarqueurs ?? []) DESIGNATIONS.add(cleDuMarqueur(type, m));
  }
  return feuille;
}

/**
 * Marque le nœud en cours de validation comme un NŒUD D'OP ATTEINT par le parse (`gameOpSchema`,
 * `grammaire/mecanique.ts`), AVANT tout jugement de son payload : « atteint » ne dit pas « jugé » (une
 * op de `OPS_NON_TYPEES` est atteinte et son payload n'est jugé par aucune feuille `idDe`). Hors du
 * parse de mesure, l'appel ne fait rien : le parse normal n'y gagne aucun chemin.
 */
export function marquerOpAtteinte(ctx: z.RefinementCtx): void {
  if (parseDeMesure) ctx.addIssue({ code: 'custom', message: 'repère de nœud d’op', params: { [REPERE_OP]: true }, continue: true });
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
  readonly params?: { readonly [REPERE]?: TypeEntite; readonly [REPERE_OP]?: true };
  readonly errors?: readonly (readonly IssueLue[])[];
  readonly issues?: readonly IssueLue[];
};

const typeDuRepere = (issue: IssueLue): TypeEntite | undefined => issue.params?.[REPERE];
const estRepereDOp = (issue: IssueLue): boolean => issue.params?.[REPERE_OP] === true;

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
  (issue.code === 'invalid_union' && (issue.errors ?? []).some((b) => b.length > 0 && b.every(estPropre))) ||
  ((issue.code === 'invalid_key' || issue.code === 'invalid_element') && (issue.issues ?? []).length > 0 && issue.issues!.every(estPropre));

/** Ce que rend le parse de mesure : les références validées par `idDe` et le path de DONNÉE de chaque
 *  nœud d'op que `gameOpSchema` a validé (`marquerOpAtteinte`). */
export interface MesureDuParse {
  readonly reperes: readonly RepereDeMesure[];
  readonly ops: readonly (readonly PropertyKey[])[];
}

type Recueil = { reperes: RepereDeMesure[]; ops: (readonly PropertyKey[])[] };

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
 * PARSE DE MESURE d'une donnée par son schéma RÉEL : les références que `idDe` y valide et les nœuds
 * d'op que `gameOpSchema` y valide, chacun à son path de DONNÉE. La fenêtre est bornée par construction : `parseDeMesure`
 * n'est posé que pendant l'appel SYNCHRONE à `safeParse` (zod lève sur tout nœud async), et le
 * `finally` le rend à sa valeur précédente, y compris quand le recueil lève. Les seuls parses exécutés
 * dans cette fenêtre sont ceux que ce `safeParse` imbrique (payload d'une op,
 * `grammaire/mecanique.ts › gameOpSchema`).
 * La donnée doit être VALIDE au parse normal, et c'est ce parse, exécuté HORS de la fenêtre de mesure,
 * qui en juge : dans la fenêtre, un repère fait avorter le `pipe` qui le porte, et un raffinement posé
 * EN SORTIE (`.transform`, `.pipe`) ne s'y exécute pas. Un échec du parse normal LÈVE en nommant sa
 * première issue ; dans la fenêtre, une issue qui n'est pas un repère LÈVE aussi.
 */
export function mesureDuParse(schema: z.ZodType, donnee: unknown): MesureDuParse {
  const precedent = parseDeMesure;
  try {
    const normal = schema.safeParse(donnee);
    if (!normal.success) {
      const [premiere] = normal.error.issues;
      throw new Error(
        `parse de mesure : la donnée est invalide au parse normal — issue « ${premiere.code} » à « ${premiere.path.map(String).join('.') || '(racine)'} » (${premiere.message}).`,
      );
    }
    parseDeMesure = true;
    const resultat = schema.safeParse(donnee);
    const out: Recueil = { reperes: [], ops: [] };
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
 * personne. `sousListe` restreint chaque référence comme `idDe` (`merchants.json › curated` lit
 * `INSTANCIABLE_PAR_ID`). Le retour n'est PAS érasé en `z.ZodType` — sinon `.min()` ne survivrait pas à
 * l'appel, et le site le réécrirait à la main.
 */
export function refs<T extends TypeEntite>(type: T, opts?: { min?: number; sousListe?: SousListe }): z.ZodArray<z.ZodType<Id<T>, string>> {
  const liste = z.array(idDe(type, opts?.sousListe));
  return opts?.min === undefined ? liste : liste.min(opts.min);
}

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`). */
export function ref<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<string, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return nommerChamps(z.strictObject({ id: idDe(type), ...((extra ?? {}) as Record<string, z.ZodType>) }), { id: { label: "identifiant", texte: { regime: 'technique', usage: 'ids stables du registre de références' } }, ...metasExtra(extra) });
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
 * Le littéral que le livre imprime à la place d'une spécialisation — Compétence : `LDB 09 l.40` ;
 * Talent : `LDB 10 l.17`. Ce n'est pas une
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
  const espace = espaceDe(type);
  const catalogue = TYPES[type].catalogue;
  const unRegime = (id: unknown): string =>
    `« ${String(id)} » : une spécialisation se désigne par « spec » OU par « choix », exactement un des deux (catalogue des ${catalogue}).`;
  return nommerChamps(z
    .strictObject({
      id: idDe(type),
      spec: z.string().min(1).optional(),
      choix: z.union([z.literal(true), z.array(z.string().min(1))]).optional(),
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
          message: `« ${String(v.id)} » : ce champ DÉSIGNE une spécialisation — « choix » (emplacement non désigné) n'y est pas admis, seul « spec » l'est (catalogue des ${catalogue}, ${espace}).`,
        });
        return;
      }
      if (!estSpecialisable(type, String(v.id))) {
        ctx.addIssue({
          code: 'custom',
          message: `« ${String(v.id)} » ne déclare aucune spécialisation au catalogue des ${catalogue} (${espace}) — « spec » et « choix » ne s'y appliquent pas.`,
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
              ? `« ${c} » n'est pas une spécialisation mais un EMPLACEMENT non désigné de « ${String(v.id)} » (catalogue des ${catalogue}, ${espace}) — s'écrit « choix ».`
              : `« ${c} » est absente des spécialisations de « ${String(v.id)} » au catalogue des ${catalogue} (${espace}).`,
        });
      }
    }), { id: { label: "identifiant", texte: { regime: 'technique', usage: 'ids stables du registre de références' } }, spec: { label: "spécialisation", texte: { regime: 'designation' } }, choix: { label: "choix", texte: { regime: 'designation' } }, ...metasExtra(extra) });
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
    nommerChamps(z.strictObject({ pick: n, of: z.array(option).min(1) }), { pick: { label: "sélection" }, of: { label: "contenu" } }),
    nommerChamps(z.strictObject({ pick: n, table: ref('table') }), { pick: { label: "sélection" }, table: { label: "table" } }),
  ]);
  return noeud;
}

