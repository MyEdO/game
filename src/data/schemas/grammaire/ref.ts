import { nommerChamps, metasExtra, valeursDe, type MetaChamp, type MetaDesChamps } from './meta';
/**
 * FABRIQUE DE RÉFÉRENCE (#1466) — la seule façon de désigner une entité par son id.
 *
 * `ref(type)` construit ET ENREGISTRE le nœud FINAL : l'id est refiné AU PARSE contre l'INDEX DES
 * IDS `IDS_PAR_ESPACE` (`npm run gen`), si bien qu'une référence morte casse au chargement, en
 * test et à la sauvegarde du Compendium — sans qu'aucune garde nominative n'ait à l'énumérer. La
 * fabrique n'expose aucun nœud extensible : zod 4.4.3 perd le registre et la `.meta()` au `.extend`,
 * la composition se fait donc ICI via `extra`.
 *
 * PORTÉE LOCALE (#2968 P-local) : `ref(portee)` désigne une entrée d'une collection du MÊME document, même
 * graphie `{ id }`, et `refs(portee)` une liste de ses ids. L'objet qui porte cette collection OUVRE la
 * portée (`ouvrirPortees`, `grammaire/collection-cle.ts`) : la racine d'un document, ou tout objet de son
 * arbre. Il juge chaque référence de son arbre contre les ids de sa collection (`jugerRefLocale`). Un id
 * local n'entre dans aucun espace de l'INDEX DES IDS.
 */
import { z } from 'zod';
import '../../../lib/zodEnFrancais';
import { IDS_PAR_ESPACE, type IdsParEspace } from '../_ids.generated';
import type { CategorieCodexDuFichier } from '../_cles-de-dataset.generated';
import { baseDe, cleDesLibelles, cleDesSpecs, cleFiltree, lireCleDEspace, marqueurPorte, vocabulaireDuFichier, type FiltreDEspace, type SousListeMarquee } from './cle-d-espace';
import { REGISTRE_DU_VOCABULAIRE_D_ART } from '../_vocabulaires-d-art.generated';
import { norm } from '../../../lib/normalize';
import { idsVivants } from './idsVivants';
import { marquerProduit, produitDe } from './interne/produits';
import { declarationDeFeuilleDId as declarationLue, declarerFeuilleDId, estFeuilleDId as feuilleLue, typeDeFeuilleDId as typeLu } from './interne/feuilles';
import { enfantsDe } from './descente';

declare const marqueDeType: unique symbol;
/** Id BRANDÉ par son type — frappé à la porte zod, jamais par un `as` d'appelant. */
export type Id<T extends string> = string & { readonly [marqueDeType]: T };

/** Ce qu'un type d'entité déclare : son espace de noms et le nom de son catalogue. */
export interface DeclarationDeType {
  /** CLÉ D'ESPACE (`grammaire/cle-d-espace.ts`) de l'espace qui fait AUTORITÉ sur les ids de ce type : une
   *  collection de document, ou un VOCABULAIRE (`grammaire/vocabulaires.ts`), registre TS d'art compris
   *  (#2968 P-art). */
  readonly espace: string;
  /** Le catalogue tel que l'AUTEUR le nomme, au pluriel (« des sorts ») : le refus d'une référence
   *  morte se lit à l'éditeur, au Compendium et à l'import d'un projet, jamais qu'en CI. */
  readonly catalogue: string;
}

/** Types d'entité référencés par les schémas, avec leur espace d'ids et leur catalogue. */
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
  // LDB 05 l.214 : `species.json › refCareer` nomme sa colonne du Tableau des Classes et Carrières aléatoires.
  carrieresAleatoires: { espace: 'carrieres-aleatoires.json', catalogue: 'colonnes du Tableau des Classes et Carrières aléatoires' },
  navalTrait: { espace: 'naval-traits.json', catalogue: 'traits navals' },
  // PORT du catalogue naval : `MapPlace.port.ref` résout AU PARSE, toutes les réfs mortes nommées.
  navalPort: { espace: 'naval-ports.json', catalogue: 'ports' },
  shipStation: { espace: 'ship-stations.json', catalogue: 'postes de navire' },
  crewRole: { espace: 'crew-roles.json', catalogue: 'rôles d’équipage' },
  crewTestType: { espace: 'crew-test-types.json#types', catalogue: 'types de Test d’équipage' },
  table: { espace: 'tables.json', catalogue: 'tables' },
  mutationTable: { espace: 'mutationTables.json', catalogue: 'tables de mutation' },
  etat: { espace: 'etats.json', catalogue: 'états' },
  maladie: { espace: 'maladies.json', catalogue: 'maladies' },
  symptome: { espace: 'symptoms.json', catalogue: 'symptômes' },
  material: { espace: 'materials.json', catalogue: 'matières' },
  // RÈGLE OPTIONNELLE : cible du terme `{rule}` d'une `Formula` (#1599) — une quantité que le livre ne
  // chiffre pas se lit au registre, l'id résout donc AU PARSE comme toute autre référence.
  regleOptionnelle: { espace: 'reglesOptionnelles.json', catalogue: 'règles optionnelles' },
  terrain: { espace: 'terrains.json', catalogue: 'terrains' },
  // PALIER D'ÉCLAIRAGE (#1716) : la semence d'éclairage d'une scène neuve (`semences-de-scene.json`) et
  // `Scene.ambientLight` nomment un palier — l'id résout AU PARSE.
  lightLevel: { espace: 'lightLevels.json', catalogue: 'paliers d’éclairage' },
  prop: { espace: 'props.json', catalogue: 'décors' },
  building: { espace: 'buildings.json', catalogue: 'bâtiments' },
  // AXE de forces/faiblesses (#409) : `activeAxes` d'un projet de scène résout AU PARSE.
  axe: { espace: 'axes.json', catalogue: 'axes' },
  weaponGroup: { espace: 'weaponGroups.json', catalogue: 'groupes d’armes' },
  maneuver: { espace: 'maneuvers.json', catalogue: 'manœuvres' },
  // JEU DE TAVERNE (#1921) : `SceneEntity.tavernGame.id` résout AU PARSE.
  tavernGame: { espace: 'tavernGames.json', catalogue: 'jeux de taverne' },
  // PSYCHOLOGIE (#1595) : `traits.json › capabilities.psychType` résout AU PARSE.
  psychology: { espace: 'psychology.json', catalogue: 'psychologies' },
  regle: { espace: 'regles.json', catalogue: 'règles' },
  quality: { espace: 'qualities.json', catalogue: 'qualités' },
  characteristic: { espace: 'characteristics.json', catalogue: 'caractéristiques' },
  steamBreakdown: { espace: 'steam-breakdown.json#entries', catalogue: 'pannes de navire à vapeur' },
  // MDG 13 l.475-499, l.514-537 : le péril d'une op `perilDeMer` et l'évitement d'une op `navireMod` résolvent AU PARSE.
  seaHazard: { espace: 'sea-perils.json#hazards', catalogue: 'périls en mer' },
  tourbillon: { espace: 'sea-perils.json#tourbillons', catalogue: 'tourbillons' },
  // APPARENCE d'objet (#2948) : `trappings.json › shape`/`formChoices` résolvent AU PARSE contre les
  // racines du catalogue, une variante nomme sa racine et ses étiquettes de naissance.
  apparence: { espace: 'apparences.json', catalogue: 'apparences' },
  classe: { espace: 'classes.json', catalogue: 'classes de carrière' },
  // GABARIT (#2972) : `raceAppearance.json › gabarit` résout AU PARSE.
  gabarit: { espace: 'gabarits.json', catalogue: 'gabarits' },
  // RACE DE RENDU (#3113) : `presets-de-personnage.json › race` et l'id d'une tête de `garde-robe.json` résolvent AU PARSE.
  raceAppearance: { espace: 'raceAppearance.json', catalogue: 'races de rendu' },
  // PLAN DE BESTIAIRE (#2993) : une espèce d'apparence (`especeDApparenceSchema`) résout AU PARSE.
  planDeBestiaire: { espace: 'planDeBestiaire.json', catalogue: 'espèces du plan de bestiaire' },
  // GARDE-ROBE des éléments 3D (#3114) : un type, trois sous-listes discriminées par `kind`
  // (`idDe('gardeRobe', 'piece')`, patron `material`).
  gardeRobe: { espace: 'garde-robe.json', catalogue: 'garde-robe' },
  // EDOC 12 l.217, l.241 ; LDB 85 l.120, l.164
  groupe: { espace: 'groups.json', catalogue: 'groupes' },
  // EDOC 13 l.237 ; LDB 85 l.322
  breathType: { espace: 'breath-types.json', catalogue: 'types de Souffle' },
  // LDB 85 l.174
  damageType: { espace: 'damage-types.json', catalogue: 'types de Dégâts' },
  // VDM 13 l.61 ; ZI 08 l.28
  domain: { espace: 'domains.json', catalogue: 'domaines' },
  book: { espace: 'books.json', catalogue: 'livres' },
  trauma: { espace: 'traumas.json', catalogue: 'séquelles' },
  lightTone: { espace: 'lightTones.json', catalogue: 'tons de lumière' },
  // Effets visuels et sonores (#3771) : un Groupe d'arme, un objet, un Domaine désignent leur rendu.
  rendu: { espace: 'rendus.json', catalogue: 'rendus' },
  // #3771 : registre `src/data/sons/defs`.
  son: { espace: 'vocabulaire:sons', catalogue: 'sons' },
  // Catalogue des cargaisons (#1684) : sous-listes `mer`/`terre` par le discriminant `voie` de son def.
  cargo: { espace: 'cargoes.json', catalogue: 'cargaisons' },
  merchant: { espace: 'merchants.json', catalogue: 'archétypes de marchand' },
  colonneDuMarchand: { espace: 'vocabulaire:colonnesDuMarchand', catalogue: 'colonnes de stats du marchand' },
  action: { espace: 'actions.json', catalogue: 'actions' },
  location: { espace: 'locations.json', catalogue: 'lieux' },
  serviceDeLieu: { espace: 'lieux-services.json', catalogue: 'services de lieu' },
  // #2968 P-art : registre `src/data/fonds/defs`.
  fond: { espace: 'vocabulaire:fonds', catalogue: 'bandes d’ambiance' },
} as const satisfies Record<string, DeclarationDeType>;

export type TypeEntite = keyof typeof TYPES;

/** PORTÉE LOCALE : la collection `collection` de l'objet qui l'ouvre, et son `catalogue` tel que l'auteur le
 *  nomme, comme `DeclarationDeType` ; `retient` : les filtres (`retenuParFiltre`) que chaque entrée admise passe tous,
 *  toute la collection sans eux. Une référence la désigne par IDENTITÉ. */
export interface PorteeLocale {
  readonly collection: string;
  readonly catalogue: string;
  readonly retient?: readonly FiltreDEspace[];
}

/** Ce que désigne une référence validée : un type de `TYPES`, ou la portée locale `local:<collection>`. */
export type CibleDeReference = TypeEntite | `local:${string}`;

const cibleLocale = (portee: PorteeLocale): CibleDeReference => `local:${portee.collection}`;

/** Les feuilles construites par `ref(portee)`, avec leur portée. */
const FEUILLES_LOCALES = new WeakMap<object, PorteeLocale>();

/** La portée d'une feuille construite par `ref(portee)`, `undefined` si le nœud n'en est pas une. */
export const porteeDeLaFeuille = (noeud: unknown): PorteeLocale | undefined =>
  typeof noeud === 'object' && noeud !== null ? FEUILLES_LOCALES.get(noeud) : undefined;

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
 * Clé d'espace de la sous-liste `valeur` d'un type discriminé : le CHAMP discriminant qui porte cette
 * valeur se lit aux clés de l'INDEX DES IDS (`<espace>?<champ>=<valeur>`), où la phase 2 l'écrit depuis le
 * paramètre `espace.discriminant` du def — une seule déclaration, au nœud. Un espace à plusieurs champs
 * discriminants (`weaponGroups.json` : `combat`, `kind`) désigne une sous-liste par une valeur qu'UN SEUL
 * de ses champs porte.
 */
const champDeLaValeur = new Map<string, string>();
function cleDeSousListe(type: TypeEntite, valeur: string, site: string): string {
  const espace = espaceDe(type);
  const memo = `${espace}\u0000${valeur}`;
  const connu = champDeLaValeur.get(memo);
  if (connu !== undefined) return cleFiltree(espace, { champ: connu, vaut: valeur });
  const champs = new Set(
    clesDeLIndex().flatMap((cle) => {
      const lue = lireCleDEspace(cle);
      return baseDe(lue) === espace && lue.filtre?.vaut === valeur ? [lue.filtre.champ] : [];
    }),
  );
  if (champs.size !== 1)
    throw new Error(
      `${site} : ${espace} ${champs.size ? `porte la valeur « ${valeur} » sous ${champs.size} champs discriminants (${[...champs].join(', ')})` : `n'a aucune sous-liste discriminée « ${valeur} » (paramètre \`espace.discriminant\` de son def)`}.`,
    );
  const [champ] = champs;
  champDeLaValeur.set(memo, champ);
  return cleFiltree(espace, { champ, vaut: valeur });
}

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

/** Le refus d'un id par une sous-liste DISCRIMINÉE — `null` s'il est ADMIS. */
const refusDeLaDiscriminee = (type: TypeEntite, sousListe: string, site: string, id: string): string | null =>
  idsDesignes(cleDeSousListe(type, sousListe, site), site).has(id)
    ? null
    : `« ${id} » est hors de la sous-liste « ${sousListe} » du catalogue des ${TYPES[type].catalogue} (${espaceDe(type)}).`;

/** Le refus d'une sous-liste, jugé sur l'ENTRÉE résolue (objet du catalogue ou de la campagne) — la
 *  marquée sur ses champs (`marqueurPorte`), la discriminée sur son id —, lu par le sélecteur qui
 *  résout une saisie hors du registre. */
export function refusDeLEntree(type: TypeEntite, sousListe: SousListe, entree: { readonly id: string }): string | null {
  return typeof sousListe === 'string'
    ? refusDeLaDiscriminee(type, sousListe, `refusDeLEntree('${type}')`, entree.id)
    : refusDeMarqueur(type, entree.id, marqueurPorte(sousListe, entree));
}

/** Le refus d'un id par `idDe(type, sousListe?)` — `null` s'il est ADMIS —, pour un id que nulle feuille ne
 *  porte (`defs/cargaisons-aleatoires.ts`). */
export function refusDeLId(type: TypeEntite, id: string, sousListe?: SousListe): string | null {
  return refusDe(type, sousListe, `refusDeLId('${type}')`, id);
}

/** Le refus d'un id par une feuille `idDe(type, sousListe?)` — `null` s'il est ADMIS —, lu à chaque validation. */
function refusDe(type: TypeEntite, sousListe: SousListe | undefined, site: string, id: string): string | null {
  if (typeof sousListe === 'string') return refusDeLaDiscriminee(type, sousListe, site, id);
  if (!idsDesignes(espaceDe(type), site).has(id)) return refMorte(type, id);
  return sousListe === undefined ? null : refusDuMarqueur(type, sousListe, site, id);
}

/**
 * L'ENTRÉE résolue appartient-elle à la sous-liste marquée ? Le runtime juge l'entrée elle-même (objet
 * du catalogue OU de la campagne, `noyau/monde/resolveursDuNarratif.ts`) par `marqueurPorte`, le prédicat
 * qui bâtit les clés `<espace>?!<marqueur>,…` que `refusDuMarqueur` lit au schéma.
 */
export function dansLaSousListe(sousListe: SousListeMarquee, entree: object): boolean {
  return marqueurPorte(sousListe, entree) === undefined;
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
export function catalogueSpecs(type: TypeEntite, id: string): readonly string[] {
  return [...(lireLEspace(cleDesSpecs(espaceDe(type), id)) ?? [])];
}

/** La spécialisation `spec` DÉSIGNE-t-elle une entrée du catalogue de l'entrée `id` de `type`
 *  (`catalogueSpecs`) ? Appartenance seule — la résolution d'un id en libellé, le parse inverse d'un
 *  libellé, une garde « la spéc imprimée est au catalogue » ; l'ADMISSION se juge par `refusDeSpec`,
 *  qui la lit. */
export function specAuCatalogue(type: TypeEntite, id: string, spec: string): boolean {
  return catalogueSpecs(type, id).includes(spec);
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
 * inline ou univers d'une `specsSource` (INDEX DES IDS, `npm run gen`) —, ou par le marqueur `specsOpen`
 * d'une entrée OUVERTE, dont la spécialisation peut être un texte libre sans catalogue (l'Aspect d'un
 * Trait, `LDB 85 l.81-83`). Sinon, ni `spec` ni `choix` n'ont de sens : la réf est un `ref(type)` nu.
 * Pour les Compétences, ce catalogue est celui des Compétences Groupées (`LDB 09 l.36`) ; pour les
 * autres types, c'est une déclaration du catalogue app-owned, sans équivalent au livre.
 */
export function estSpecialisable(type: TypeEntite, id: string): boolean {
  return catalogueSpecs(type, id).length > 0 || entreeOuverte(type, id);
}

/**
 * Ce que la valeur d'un champ que la def d'une entrée DÉCLARE par un marqueur (paramètre `espace.marqueurs`
 * du def) a pour FORME : un Indice s'écrit en `value`, une Portée en `range` (`LDB 85 l.94`, `l.209`).
 */
const FORMES_DE_MARQUEUR = [
  { marqueur: 'indice', forme: /^\+?\d+\+?$/, nature: 'un Indice', champ: 'value' },
  { marqueur: 'range', forme: /^\d+(?:[.,]\d+)?\s*(?:m|mètres?)$/i, nature: 'une Portée', champ: 'range' },
] as const;

/** Une forme de marqueur. */
export type FormeDeMarqueur = (typeof FORMES_DE_MARQUEUR)[number];

/** La forme de marqueur que `valeur` porte quand l'entrée `id` de `type` DÉCLARE ce marqueur, `undefined`
 *  sinon — un espace sans ce marqueur n'en déclare aucun. */
export function marqueurDeLaForme(type: TypeEntite, id: string, valeur: string): FormeDeMarqueur | undefined {
  return FORMES_DE_MARQUEUR.find((f) => f.forme.test(valeur.trim()) && (lireLEspace(cleDuMarqueur(type, f.marqueur))?.has(id) ?? false));
}

/** Refus d'un id qu'aucune entrée du catalogue de `type` ne porte : l'espace, et le registre d'un
 *  vocabulaire d'art (`REGISTRE_DU_VOCABULAIRE_D_ART`). */
export function refMorte(type: TypeEntite, id: string): string {
  const espace = espaceDe(type);
  const art = vocabulaireDuFichier(espace);
  const registre = art === undefined ? undefined : REGISTRE_DU_VOCABULAIRE_D_ART[art];
  return `« ${id} » est absent du catalogue des ${TYPES[type].catalogue} (${registre === undefined ? espace : `${espace}, registre ${registre}`}).`;
}

/** Refus d'un id qu'aucune entrée de la collection d'une portée locale ne porte. */
export const refMorteLocale = (portee: PorteeLocale, id: string): string =>
  `« ${id} » est absent du catalogue des ${portee.catalogue} (collection « ${portee.collection} » du document).`;

/**
 * Clé du repère dans les `params` d'une issue : privée au module, donc infalsifiable par un autre
 * émetteur. Le repère porte le type d'entité validé.
 */
const REPERE: unique symbol = Symbol('repère de parse de mesure');

/** Clé du repère de NŒUD D'OP : même régime que `REPERE`, émis par `marquerOpAtteinte`. */
const REPERE_OP: unique symbol = Symbol('repère de nœud d’op');

/** Un `mesureDuParse` est-il en cours ? Le temps SYNCHRONE de l'appel, qui seul l'écrit, et jamais ailleurs : aucun export n'expose l'état. */
let parseDeMesure = false;

/** Ce qu'une feuille `idDe` déclare : le type référencé, sa sous-liste, `ouverte` (un id absent de
 *  l'espace est admis sans être une référence du type), et `repereDuPorteur` (la feuille n'émet pas son
 *  repère au parse de mesure : son porteur l'émet, `recordDIds`). */
export interface FeuilleDId {
  readonly type: TypeEntite;
  readonly sousListe?: SousListe;
  readonly ouverte: boolean;
  readonly repereDuPorteur?: true;
}

/** La déclaration (`FeuilleDId`) d'une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une :
 *  la porte du registre des feuilles (`interne/feuilles.ts`), que lit la garde du masquage (`parse-de-mesure.test.ts`). */
export const declarationDeFeuilleDId = (noeud: unknown): FeuilleDId | undefined => declarationLue(noeud);

/** Le nœud est-il une référence emboîtée `{ id }` (`objetDeRef`) ? */
export const estRefEmboitee = (noeud: unknown): boolean => produitDe(noeud)?.fabrique === 'objetDeRef';

/** Le type référencé par une feuille construite par `idDe`, `undefined` si le nœud n'en est pas une. */
export const typeDeFeuilleDId = (noeud: unknown): TypeEntite | undefined => typeLu(noeud);

/** Le nœud est-il une feuille construite par `idDe` ? */
export const estFeuilleDId = (noeud: unknown): boolean => feuilleLue(noeud);

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
 * `giveTrapping` : objets de la campagne, `noyau/monde/resolveursDuNarratif.ts`, sinon objet `custom`) ; un id
 * PRÉSENT reste jugé par la sous-liste. Un id absent n'émet aucun repère : il n'est pas une référence
 * du type.
 *
 * `nue` : la sortie reste un `string` sans marque — la réf que le moteur et ses appelants construisent
 * nue partout (`SourceRef.book`, `grammaire/valeurs.ts`). Le jugement au parse est le même.
 */
export function idDe<T extends TypeEntite>(type: T, sousListe: SousListe | undefined, options: { readonly ouverte?: boolean; readonly nue: true }): z.ZodType<string, string>;
export function idDe<T extends TypeEntite>(type: T, sousListe?: SousListe, options?: { readonly ouverte?: boolean }): z.ZodType<Id<T>, string>;
export function idDe<T extends TypeEntite>(type: T, sousListe?: SousListe, options?: { readonly ouverte?: boolean; readonly nue?: true }): z.ZodType<Id<T>, string> {
  return feuilleDId(type, sousListe, options?.ouverte === true, true);
}

/** Le corps de `idDe`. `avecRepere` : la feuille émet son repère au parse de mesure ; sans repère, le
 *  porteur l'émet lui-même (`recordDIds`, dont la clé ne doit porter aucune issue pour que zod en parse
 *  la valeur). */
function feuilleDId<T extends TypeEntite>(type: T, sousListe: SousListe | undefined, ouverte: boolean, avecRepere: boolean): z.ZodType<Id<T>, string> {
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
        if (parseDeMesure && avecRepere) ctx.addIssue({ code: 'custom', message: `repère de ${site}`, params: { [REPERE]: type }, continue: true });
        return;
      }
      ctx.addIssue({ code: 'custom', message: refus });
    })
    .transform((v) => v as Id<T>);
  const declaration: FeuilleDId = sousListe === undefined ? { type, ouverte } : { type, sousListe, ouverte };
  declarerFeuilleDId(feuille, avecRepere ? declaration : { ...declaration, repereDuPorteur: true });
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

/**
 * Jugement d'une référence LOCALE `id`, au `path` de sa feuille sous l'objet qui ouvre sa portée
 * (`ouvrirPortees`) : `admis`, l'id est celui d'une entrée de la collection. Un id refusé porte
 * `refMorteLocale` ; au parse de mesure, un id admis émet son repère.
 */
export function jugerRefLocale(ctx: z.RefinementCtx, path: readonly (string | number)[], portee: PorteeLocale, id: string, admis: boolean): void {
  if (!admis) ctx.addIssue({ code: 'custom', path: [...path], message: refMorteLocale(portee, id) });
  else if (parseDeMesure) ctx.addIssue({ code: 'custom', path: [...path], message: `repère de ref(${cibleLocale(portee)})`, params: { [REPERE]: cibleLocale(portee) }, continue: true });
}

/** Une référence validée au parse de mesure, par `idDe` ou par l'objet qui ouvre sa portée locale : son
 *  path de DONNÉE et sa cible. `parCle` : la valeur validée est la CLÉ d'un record (dernier segment du path),
 *  pas la valeur qu'elle pose. */
export interface RepereDeMesure {
  readonly path: readonly PropertyKey[];
  readonly type: CibleDeReference;
  readonly parCle: boolean;
}

/** Une issue zod telle que `mesureDuParse` la lit. */
type IssueLue = {
  readonly code: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  readonly params?: { readonly [REPERE]?: CibleDeReference; readonly [REPERE_OP]?: true };
  readonly errors?: readonly (readonly IssueLue[])[];
  readonly issues?: readonly IssueLue[];
};

const typeDuRepere = (issue: IssueLue): CibleDeReference | undefined => issue.params?.[REPERE];
const estRepereDOp = (issue: IssueLue): boolean => issue.params?.[REPERE_OP] === true;

/** La FAMILLE du repère que portent les `params` d'une issue — `reference` (`idDe`, `jugerRefLocale`) ou `op`
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
 * l'appel, et le site le réécrirait à la main. Sur une PORTÉE LOCALE, des ids d'entrées de sa collection.
 */
export function refs(portee: PorteeLocale): z.ZodArray<z.ZodString>;
export function refs<T extends TypeEntite>(type: T, opts?: { min?: number; sousListe?: SousListe }): z.ZodArray<z.ZodType<Id<T>, string>>;
export function refs(cible: TypeEntite | PorteeLocale, opts?: { min?: number; sousListe?: SousListe }) {
  const liste = z.array(typeof cible === 'string' ? idDe(cible, opts?.sousListe) : feuilleLocale(cible));
  return opts?.min === undefined ? liste : liste.min(opts.min);
}

/** Record keyé par les ids de `type` : une clé refusée porte le message de sa feuille `idDe`, qui nomme le
 *  catalogue, jamais la « clé invalide » générique de zod. `sousListe` restreint chaque clé comme `idDe`.
 *  Au parse de mesure, la clé n'émet pas son repère (zod ne parserait plus la valeur) : le record le pose
 *  sur chaque clé, en `invalid_key`, après le parse de la valeur. */
export function recordDIds<T extends TypeEntite, V extends z.ZodType>(type: T, valeur: V, sousListe?: SousListe) {
  return z
    .record(feuilleDId(type, sousListe, false, false), valeur, { error: (iss) => (iss as { issues?: readonly { message: string }[] }).issues?.[0]?.message })
    .superRefine((v, ctx) => {
      if (!parseDeMesure) return;
      for (const cle of Object.keys(v)) {
        const repere: z.core.$ZodIssueCustom = { code: 'custom', path: [], message: `repère de recordDIds('${type}')`, params: { [REPERE]: type } };
        ctx.addIssue({ code: 'invalid_key', origin: 'record', path: [cle], input: cle, issues: [repere], continue: true });
      }
    });
}

/** Méta du champ `id` de toute référence construite ici. */
const META_ID = { label: "identifiant", texte: { regime: 'technique', usage: 'ids stables du registre de références' } } as const;

/** L'objet CONCRET d'une référence `{ id, …extra }` dont `feuille` porte l'`id`, nommé par `metas` : le
 *  corps unique de `ref` et des branches de `refTypee`, qui composent son nœud sans l'éraser.
 *  `extraDuPorteur` : la part d'`extra` que l'appelant a passée, sans les clés que la fabrique pose elle-même. */
function objetDeRef<F extends z.ZodType, E extends Record<string, z.ZodType>>(
  feuille: F,
  extra: E,
  metas: Readonly<Record<string, MetaChamp>>,
  role: 'ref' | 'refTypee',
  extraDuPorteur: Readonly<Record<string, z.ZodType>>,
) {
  return marquerProduit(nommerChamps(z.strictObject({ id: feuille, ...extra }), { id: META_ID, ...metas } as MetaDesChamps<{ id: z.ZodType } & E>), 'objetDeRef', role, extraDuPorteur);
}

/** La feuille d'une référence LOCALE : une chaîne, que juge l'objet qui ouvre sa portée (`ouvrirPortees`). */
function feuilleLocale(portee: PorteeLocale): z.ZodString {
  const feuille = z.string();
  FEUILLES_LOCALES.set(feuille, portee);
  return feuille;
}

/** Feuille `idDe(type)` qui admet en plus des valeurs réservées (`ouReserve`, `grammaire/valeurs.ts`). */
type FeuilleOuReservee<T extends TypeEntite> = z.ZodUnion<readonly [z.ZodType<Id<T>, string>, z.ZodLiteral<string> | z.ZodEnum<Readonly<Record<string, string>>>]>;

/** Référence `{ id }` de `type`, composée FERMÉE avec les champs propres au porteur (`extra`) ; sans
 *  `extra`, la sous-liste se nomme seule (`ref('material', undefined, 'objet')`) et la sortie reste `{ id }`.
 *  Sur une PORTÉE LOCALE, `{ id }` d'une entrée de sa collection. Sur une feuille `ouReserve(idDe(type), …)`,
 *  `{ id }` d'une entrée du catalogue ou d'une valeur réservée. */
export function ref(portee: PorteeLocale): ReturnType<typeof objetDeRef<z.ZodString, Record<never, never>>>;
export function ref<T extends TypeEntite>(feuille: FeuilleOuReservee<T>): ReturnType<typeof objetDeRef<FeuilleOuReservee<T>, Record<never, never>>>;
export function ref<T extends TypeEntite>(type: T, extra?: undefined, sousListe?: SousListe): ReturnType<typeof objetDeRef<z.ZodType<Id<T>, string>, Record<never, never>>>;
export function ref<T extends TypeEntite, E extends Record<string, z.ZodType>>(type: T, extra: E, sousListe?: SousListe): ReturnType<typeof objetDeRef<z.ZodType<Id<T>, string>, E>>;
export function ref(cible: TypeEntite | PorteeLocale | FeuilleOuReservee<TypeEntite>, extra?: Record<string, z.ZodType>, sousListe?: SousListe) {
  const extraDuPorteur = extra ?? {};
  const feuille = typeof cible === 'string' ? idDe(cible, sousListe) : '_zod' in cible ? cible : feuilleLocale(cible);
  return objetDeRef(feuille, extraDuPorteur, metasExtra(extra), 'ref', extraDuPorteur);
}

/** FORME de sortie d'une référence TYPÉE (`refTypee`) : l'id, et la valeur de `type` qui nomme l'espace où il résout. */
export interface RefTypee<T extends string = TypeEntite> {
  readonly id: string;
  readonly type: T;
}

/** `RefTypee` et les champs que le porteur lui ajoute (`extra`) ; sans `extra`, `RefTypee` seul. */
export type RefTypeeAvec<V extends string, E extends Record<string, z.ZodType>> = [keyof E] extends [never] ? RefTypee<V> : RefTypee<V> & z.output<z.ZodObject<E>>;

/** L'espace que NOMME une valeur de `type` hors de `TYPES` : un type et la sous-liste de son espace
 *  (`idDe(type, sousListe)`, patron `material`). */
export interface SousListeNommee {
  readonly type: TypeEntite;
  readonly sousListe: SousListe;
}

/** Ce que NOMME une valeur de `type` d'un nœud `refTypee` : la déclaration de la feuille `idDe` de sa
 *  branche (type et sous-liste), et cette feuille, que lit un sélecteur (`refusDuNoeud`). */
export interface BrancheDeRefTypee extends FeuilleDId {
  readonly feuille: z.ZodType;
}

/** Ce qu'un nœud `refTypee` déclare : les valeurs de `type` qu'il admet, dans l'ordre du vocabulaire, le
 *  nom d'auteur de chacune (`valeursDe` du vocabulaire), et la branche que chacune nomme. */
export interface DeclarationDeRefTypee {
  readonly types: readonly string[];
  readonly libelles: Readonly<Record<string, string>>;
  readonly branches: Readonly<Record<string, BrancheDeRefTypee>>;
}

/** Les nœuds construits par `refTypee`, avec leur déclaration — ce que lit un sélecteur
 *  (`declarationDeRefTypee`), patron du registre des feuilles `idDe` (`interne/feuilles.ts`). */
const REFS_TYPEES = new WeakMap<object, DeclarationDeRefTypee>();

/** La déclaration d'un nœud construit par `refTypee`, `undefined` si le nœud n'en est pas un. */
export const declarationDeRefTypee = (noeud: unknown): DeclarationDeRefTypee | undefined =>
  typeof noeud === 'object' && noeud !== null ? REFS_TYPEES.get(noeud) : undefined;

/**
 * Référence POLYMORPHE `{ id, type }` : `type` NOMME l'espace où l'id résout, parmi les valeurs du
 * vocabulaire `types` (un `enumNomme`). Une valeur qui est un `TypeEntite` nomme son espace ; toute autre
 * nomme la sous-liste d'un espace que `sousListes` lui associe (`SousListeNommee`). UNION DISCRIMINÉE fermée
 * des `{ id: idDe(type, sousListe), type: valeur }` — chaque branche est l'objet de `ref` —, patron `sceneEntitySchema`
 * (`defs-scenes/scene.ts`) : le littéral DISCRIMINE la branche, `types` en NOMME la valeur. Le type ne
 * se déduit jamais de l'id : un même id vit dans plusieurs espaces. `extra` : les champs propres au
 * porteur, composés dans chaque branche comme ceux de `ref`.
 */
export function refTypee<V extends string, E extends Record<string, z.ZodType> = Record<never, never>>(
  types: z.ZodEnum<{ [K in V]: K }>,
  ...reste: [Exclude<V, TypeEntite>] extends [never]
    ? [sousListes?: Record<never, never>, extra?: E]
    : [sousListes: { readonly [K in Exclude<V, TypeEntite>]: SousListeNommee }, extra?: E]
): z.ZodType<RefTypeeAvec<V, E>> {
  const admis = types.options as readonly V[];
  const nommees: Readonly<Record<string, SousListeNommee>> = reste[0] ?? {};
  const extra: Readonly<Record<string, z.ZodType>> = reste[1] ?? {};
  const inconnues = Object.keys(nommees).filter((v) => !(admis as readonly string[]).includes(v) || Object.prototype.hasOwnProperty.call(TYPES, v));
  if (inconnues.length) throw new Error(`refTypee : la sous-liste nommée ${inconnues.map((v) => `« ${v} »`).join(', ')} n'est pas une valeur du vocabulaire hors des types.`);
  const cibleDe = (v: V): { readonly type: TypeEntite; readonly sousListe?: SousListe } => {
    if (Object.prototype.hasOwnProperty.call(nommees, v)) return nommees[v];
    if (Object.prototype.hasOwnProperty.call(TYPES, v)) return { type: v as TypeEntite };
    throw new Error(`refTypee : « ${v} » n'est ni un type de la grammaire (\`TYPES\`) ni une sous-liste nommée.`);
  };
  const branches = admis.map((v) => {
    const cible = cibleDe(v);
    const objet = objetDeRef(idDe(cible.type, cible.sousListe), { ...extra, type: z.literal(v).pipe(types) }, { ...metasExtra(extra), type: { label: 'type de la référence' } }, 'refTypee', extra);
    return { v, cible, objet };
  });
  const [premiere, ...autres] = branches.map((b) => b.objet);
  const nomDe = ({ type, sousListe }: { readonly type: TypeEntite; readonly sousListe?: SousListe }) =>
    typeof sousListe === 'string' ? `${TYPES[type].catalogue}, sous-liste « ${sousListe} »` : TYPES[type].catalogue;
  const refus = `type de référence absent ou inconnu — admis : ${branches.map((b) => `« ${b.v} » (${nomDe(b.cible)})`).join(', ')}.`;
  const noeud = z.discriminatedUnion('type', [premiere, ...autres], { error: (iss) => (iss.code === 'invalid_union' ? refus : undefined) }) as unknown as z.ZodType<RefTypeeAvec<V, E>>;
  REFS_TYPEES.set(noeud, {
    types: admis,
    libelles: valeursDe(types) ?? {},
    branches: Object.fromEntries(branches.map((b) => [b.v, { ...b.cible, ouverte: false, feuille: b.objet.shape.id }])),
  });
  return noeud;
}

/** Un texte que le joueur écrit (un nom, une motivation) : jamais un id, que `DESIGNATIONS` (`src/noyau/designations.ts`)
 *  désigne. */
export type TexteLibre = string;

/** FORME de sortie d'un nœud de référence à spécialisation — DÉCLARÉE (et non inferée) : les `extra`
 *  du porteur n'y figurent pas, un site qui les lit redéclare son type (patron `AxesData`,
 *  `schemas/defs/axes.ts`). Sans cette déclaration, tout schéma RÉCURSIF annoté qui compose une réf
 *  (`flowSchema: ZodType<Flow<EffectOp>>`) perdrait sa forme et cesserait de typer son arbre.
 *  `RefDesignee` : la forme d'un porteur qui DÉSIGNE (régime `specSeule`) ; `RefASpecialisation` :
 *  celle d'un porteur d'EMPLACEMENT, qui admet aussi `choix`. */
export interface RefDesignee<I extends string = string> {
  id: I;
  /** Un id du catalogue de l'entrée, ou, pour une entrée ouverte, un texte libre (`entreeOuverte`, LDB 09 l.40). */
  spec?: TexteLibre;
}
export interface RefASpecialisation extends RefDesignee { choix?: true | string[] }

/** La référence `ref` couvre-t-elle l'entrée `cible` du même id ? Sans `spec`, toutes ses
 *  Spécialisations ; avec `spec`, la sienne seule. LDB 09 l.44. PUR. */
export function refCouvre(ref: { readonly id: string; readonly spec?: string | undefined }, cible: { readonly id?: string | undefined; readonly spec?: string | undefined }): boolean {
  return ref.id === cible.id && (ref.spec == null || ref.spec === cible.spec);
}

/** Deux Spécialisations désignent-elles la MÊME instance d'une entrée ? Absente et vide se confondent.
 *  LDB 09 l.44 ; LDB 10 l.17. PUR. */
export function memeSpecialisation(a: string | undefined, b: string | undefined): boolean {
  return (a ?? '') === (b ?? '');
}

/**
 * Le littéral que le livre imprime à la place d'une spécialisation — Compétence : `LDB 09 l.40` ;
 * Talent : `LDB 10 l.17`. Ce n'est pas une
 * spécialisation, c'est un EMPLACEMENT non désigné — la grammaire l'écrit `choix`. Refusé AU SCHÉMA
 * (et non par un seul contrat de dataset) : le verrou couvre du même geste `src/data` et `src/scenes`,
 * y compris les entrées OUVERTES (`entreeOuverte`) que le catalogue ne filtre pas.
 */
const SENTINELLE_DE_SPEC = /^au[\s-]+choix$/i;

/** Pourquoi une spécialisation est refusée (`refusDeSpec`). */
export type RefusDeSpec = 'nonSpecialisable' | 'sentinelle' | 'marqueur' | 'horsCatalogue' | 'libelle';

/**
 * La spécialisation `spec` de l'entrée `id` de `type` est-elle ADMISE, et sinon pourquoi — prédicat
 * UNIQUE de la validité d'une spécialisation, lu par le nœud à spécialisation ci-dessous, par `specDe`,
 * par la couverture d'un emplacement (`slotCovers`, `engine/careerSlots.ts`) et par la référence de
 * Talent (`talentRefSchema`, `grammaire/reference.ts`). `LDB 09 l.40`, `LDB 08 l.140`.
 * `nonSpecialisable` (ni catalogue ni entrée ouverte),
 * `sentinelle` (un emplacement non désigné), `marqueur` (la forme d'un champ que l'entrée déclare par
 * un marqueur, `marqueurDeLaForme`), `horsCatalogue` (entrée FERMÉE, spec absente de son catalogue),
 * `libelle` (entrée OUVERTE, spec égale — aux marques, à la casse et aux blancs de bord près, `norm`, `src/lib/normalize.ts` —
 * au LIBELLÉ d'une spécialisation de son catalogue, qui se désigne par son id), ou `null` (admise).
 */
export function refusDeSpec(type: TypeEntite, id: string, spec: string): RefusDeSpec | null {
  if (!estSpecialisable(type, id)) return 'nonSpecialisable';
  if (SENTINELLE_DE_SPEC.test(spec)) return 'sentinelle';
  if (marqueurDeLaForme(type, id, spec)) return 'marqueur';
  if (specAuCatalogue(type, id, spec)) return null;
  if (!entreeOuverte(type, id)) return 'horsCatalogue';
  if (catalogueSpecs(type, id).length === 0) return null;
  const saisie = norm(spec);
  return [...idsDesignes(cleDesLibelles(cleDesSpecs(espaceDe(type), id)), `refusDeSpec('${type}')`)].some((l) => norm(l) === saisie) ? 'libelle' : null;
}

/** Message UNIQUE d'un refus de `refusDeSpec` : le nœud à spécialisation, `specDe` et `talentRefSchema`
 *  le lisent. `admetChoix` : le porteur admet l'emplacement `choix`, que le refus `sentinelle` désigne alors. */
export function messageDeRefusDeSpec(type: TypeEntite, id: string, spec: string, refus: RefusDeSpec, admetChoix: boolean): string {
  const catalogue = TYPES[type].catalogue;
  const espace = espaceDe(type);
  switch (refus) {
    case 'nonSpecialisable':
      return `« ${id} » ne déclare aucune spécialisation au catalogue des ${catalogue} (${espace}) — « spec » et « choix » ne s'y appliquent pas.`;
    case 'sentinelle':
      return `« ${spec} » n'est pas une spécialisation mais un EMPLACEMENT non désigné de « ${id} » (catalogue des ${catalogue}, ${espace}) — ${admetChoix ? "s'écrit « choix »" : 'ce champ DÉSIGNE une spécialisation'}.`;
    case 'marqueur': {
      const forme = marqueurDeLaForme(type, id, spec);
      return `« ${spec} » est ${forme?.nature} de « ${id} » (catalogue des ${catalogue}, ${espace}) — il s'écrit en « ${forme?.champ} », jamais en spécialisation.`;
    }
    case 'horsCatalogue':
      return `« ${spec} » est absente des spécialisations de « ${id} » au catalogue des ${catalogue} (${espace}).`;
    case 'libelle':
      return `« ${spec} » est le LIBELLÉ d'une spécialisation de « ${id} » (catalogue des ${catalogue}, ${espace}) — une spécialisation se désigne par son id.`;
  }
}

/**
 * Spécialisation NUE de l'entrée `id` de `type`, que le porteur fixe par sa règle (`id` CONSTANT,
 * la donnée ne porte que la Spécialisation) : validée par `refusDeSpec`, ses trois refus nommés.
 */
export function specDe(type: TypeEntite, id: string): z.ZodType<string> {
  return z.string().min(1).superRefine((spec, ctx) => {
    const refus = refusDeSpec(type, id, spec);
    if (refus) ctx.addIssue({ code: 'custom', message: messageDeRefusDeSpec(type, id, spec, refus, false) });
  });
}

/** Union GÉNÉRÉE des spécialisations de l'entrée `I` de `T` : l'espace `<espace>#[<id>].specs`
 *  (`cleDesSpecs`) de l'INDEX DES IDS. */
export type SpecId<T extends TypeEntite, I extends string> = IdsParEspace[`${(typeof TYPES)[T]['espace']}#[${I}].specs` & keyof IdsParEspace];

/** Fichier dont la catégorie Codex a un espace d'ids à l'INDEX DES IDS. */
type FichierAEspace = keyof CategorieCodexDuFichier & keyof IdsParEspace;

/** RENVOI Codex écrit en littéral de code : pour chaque fichier de `CATEGORIE_CODEX_DU_FICHIER` qui a un
 *  espace, sa catégorie et un id de l'union générée de cet espace — un id hors catalogue ne compile pas. */
export type RenvoiCodex = { [F in FichierAEspace]: { readonly category: CategorieCodexDuFichier[F]; readonly id: IdsParEspace[F] } }[FichierAEspace];

/** Renvoi vers une catégorie Codex SANS espace d'ids : son id n'est pas une union générée. */
export type RenvoiCodexSansEspace = { readonly category: Exclude<CategorieCodexDuFichier[keyof CategorieCodexDuFichier], RenvoiCodex['category']>; readonly id: string };

/**
 * Spécialisation NUE d'une entrée FERMÉE, que le porteur fixe par sa règle : `specDe`, plus le refus
 * d'une entrée OUVERTE, dont la spécialisation n'est pas une union close. La sortie est typée par
 * l'union générée de son catalogue (`SpecId`) : un littéral de code hors catalogue ne compile pas.
 */
export function specFermeeDe<T extends TypeEntite, const I extends string>(type: T, id: I): z.ZodType<SpecId<T, I>>;
export function specFermeeDe(type: TypeEntite, id: string): z.ZodType<string> {
  return specDe(type, id).superRefine((_spec, ctx) => {
    if (entreeOuverte(type, id)) ctx.addIssue({ code: 'custom', message: `« ${id} » est une entrée OUVERTE du catalogue des ${TYPES[type].catalogue} (${espaceDe(type)}) : sa spécialisation n'est pas une union close.` });
  });
}

/**
 * RÉGIME d'une référence à spécialisation — ce que le PORTEUR admet :
 *  - `specOuChoix` : exactement un de `spec` / `choix` (`specRef`, option d'un `pick`) ;
 *  - `specSeule` : `{ id }` ou `{ id, spec }` — un porteur qui DÉSIGNE ; `choix` non déclaré (défaut de
 *    `refOuSpec`) ;
 *  - `specOuChoixFacultatifs` : `{ id }`, `{ id, spec }` ou `{ id, choix }` — un porteur d'EMPLACEMENT.
 */
export type RegimeDeSpec = 'specOuChoix' | 'specSeule' | 'specOuChoixFacultatifs';

/** Régime qu'un PORTEUR déclare pour une référence dont la spécialisation est facultative (`refOuSpec`). */
export type RegimeDePorteur = Exclude<RegimeDeSpec, 'specOuChoix'>;

/** Ce qu'un nœud à spécialisation (`specRef`, `refOuSpec`) déclare : le type de l'entrée que désigne
 *  son `id`, son régime et les clés propres au porteur ; `undefined` hors d'un tel nœud. Un clone à
 *  enfants identiques se lit comme son original (`produitDe`). */
export function declarationDeRefASpecialisation(noeud: unknown): { type: TypeEntite; regime: RegimeDeSpec; extra: readonly string[] } | undefined {
  const produit = produitDe(noeud);
  if (produit?.fabrique !== 'noeudASpecialisation') return undefined;
  const type = typeDeFeuilleDId(enfantsDe(noeud).find((e) => e.cle === 'id')?.noeud);
  return type && { type, regime: produit.role as RegimeDeSpec, extra: Object.keys(produit.clesDExtra) };
}

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
  const admetChoix = regime !== 'specSeule';
  const choixRefuse = (input: unknown, cles: readonly PropertyKey[]): string => {
    const autres = cles.filter((k) => k !== 'choix').map((k) => `« ${String(k)} »`);
    return `« ${String((input as { id?: unknown } | null)?.id)} » : ce champ DÉSIGNE une spécialisation — « choix » (emplacement non désigné) n'y est pas admis, seul « spec » l'est (catalogue des ${catalogue}, ${espace}).`
      + (autres.length ? ` Clés non reconnues aussi : ${autres.join(', ')}.` : '');
  };
  const champs = {
    id: idDe(type),
    spec: z.string().min(1).optional(),
    choix: z.union([z.literal(true), z.array(z.string().min(1))]).optional(),
    ...((extra ?? {}) as Record<string, z.ZodType>),
  };
  const { choix: _choix, ...designe } = champs;
  const metas = { id: META_ID, spec: { label: "spécialisation", texte: { regime: 'designation' as const } }, choix: { label: "choix", texte: { regime: 'designation' as const } }, ...metasExtra(extra) };
  const { choix: _metaChoix, ...metasDesignees } = metas;
  return marquerProduit(nommerChamps(z
    .strictObject(admetChoix ? champs : (designe as typeof champs), {
      error: (iss) => (iss.code === 'unrecognized_keys' && iss.keys.includes('choix') ? choixRefuse(iss.input, iss.keys) : undefined),
    })
    .superRefine((v, ctx) => {
      const aSpec = v.spec != null;
      const aChoix = v.choix != null;
      if (!aSpec && !aChoix) {
        if (regime !== 'specOuChoix') return;
        ctx.addIssue({ code: 'custom', message: unRegime(v.id) });
        return;
      }
      if (!estSpecialisable(type, String(v.id))) {
        ctx.addIssue({ code: 'custom', message: messageDeRefusDeSpec(type, String(v.id), '', 'nonSpecialisable', admetChoix) });
        return;
      }
      if (aSpec && aChoix) {
        ctx.addIssue({ code: 'custom', message: unRegime(v.id) });
        return;
      }
      const candidats = aSpec ? [v.spec as string] : Array.isArray(v.choix) ? (v.choix as string[]) : [];
      const refus = candidats.map((c) => [c, refusDeSpec(type, String(v.id), c)] as const);
      // Une sentinelle masque le reste : l'auteur a écrit un emplacement là où il désignait.
      const sentinelle = refus.some(([, r]) => r === 'sentinelle');
      for (const [c, r] of refus) {
        if (r === null || (sentinelle && r !== 'sentinelle')) continue;
        ctx.addIssue({ code: 'custom', path: [aSpec ? 'spec' : 'choix'], message: messageDeRefusDeSpec(type, String(v.id), c, r, admetChoix) });
      }
    }), admetChoix ? metas : (metasDesignees as typeof metas)), 'noeudASpecialisation', regime, extra);
}

/**
 * Référence À SPÉCIALISATION : `{ id, spec }` XOR `{ id, choix: true | [ids] }` — exactement UN des
 * deux régimes (une réf sans spécialisation est un `ref(type)` nu, ou un `refOuSpec(type)` quand le
 * site accepte les deux). L'entrée VISÉE doit d'abord être spécialisable, c'est-à-dire déclarer un
 * catalogue de specs (`estSpecialisable`) ; `spec`/`choix` sont ensuite validés contre ce catalogue
 * quand l'entrée est FERMÉE (`entreeOuverte`).
 */
export function specRef<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<never, never>>(
  type: T,
  extra?: E,
): z.ZodType<unknown> {
  return noeudASpecialisation(type, extra, 'specOuChoix');
}

/** Ce que la charge utile `extra` d'une référence ajoute à sa forme, à la sortie du parse ; rien sans elle. */
type ExtraDe<E extends Record<string, z.ZodType>> = [keyof E] extends [never] ? unknown : z.output<z.ZodObject<E>>;

/**
 * Référence dont la spécialisation est FACULTATIVE : `{ id }` (aucune spécialisation visée) OU
 * `{ id, spec }` — et `{ id, choix }` pour un porteur d'EMPLACEMENT, qui ouvre le régime
 * `specOuChoixFacultatifs`. MÊME nœud que `specRef`, seul le régime change — donc UN
 * seul nœud par site (jamais une union de deux graphies du même emplacement) : c'est la forme à
 * écrire dès qu'une donnée désigne une entrée « toute spécialisation comprise » aussi bien qu'une spécialisation précise.
 */
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<never, never>>(
  type: T,
  extra?: E,
): z.ZodType<RefDesignee & ExtraDe<E>>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<never, never>>(
  type: T,
  extra: E | undefined,
  regime: 'specOuChoixFacultatifs',
): z.ZodType<RefASpecialisation & ExtraDe<E>>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<never, never>>(
  type: T,
  extra: E | undefined,
  regime: RegimeDePorteur,
): z.ZodType<RefASpecialisation & ExtraDe<E>>;
export function refOuSpec<T extends TypeEntite, E extends Record<string, z.ZodType> = Record<never, never>>(
  type: T,
  extra?: E,
  regime: RegimeDePorteur = 'specSeule',
): z.ZodType<RefASpecialisation> {
  return noeudASpecialisation(type, extra, regime);
}

/** Une issue zod, et, d'une union, celles de chacune de ses branches. */
interface IssueDeParse { readonly code: string; readonly message: string; readonly errors?: readonly (readonly IssueDeParse[])[] }

/** Une issue de FORME : la valeur n'a pas la silhouette de la branche (type, clé, ou valeur d'un littéral ou d'une
 *  énumération) ; d'une union, aucune de ses branches n'a la sienne. */
const estDeForme = (issue: IssueDeParse): boolean =>
  ['invalid_type', 'unrecognized_keys', 'invalid_value'].includes(issue.code) || (issue.code === 'invalid_union' && (issue.errors ?? []).every((b) => b.some(estDeForme)));

/** La valeur `valeur` a-t-elle la forme du nœud `noeud` : son parse n'y lève aucune issue de forme (`estDeForme`),
 *  seulement, au plus, celles de son contenu. */
export const aLaFormeDe = (noeud: unknown, valeur: unknown): boolean =>
  !((noeud as z.ZodType).safeParse(valeur).error?.issues as readonly IssueDeParse[] | undefined)?.some(estDeForme);

/**
 * UNION DE FORMES — union dont les branches se distinguent par leur silhouette (`{ id }`, `{ id, spec }`,
 * `{ pick, of }`…). Une valeur refusée par toutes l'est par le message de la PREMIÈRE branche dont elle a
 * la forme (aucune issue de type ni de clé) — celui d'`idDe` nomme l'id et son catalogue —, jamais par
 * l'« Entrée invalide » générique d'une union.
 */
export function unionDeFormes(branches: readonly [z.ZodType, ...z.ZodType[]]): z.ZodType<unknown> {
  return z.union(branches, { error: messageDeFormes });
}

/** Le message d'une union de formes (`unionDeFormes`), pour l'union qui garde le type de ses branches. */
export function messageDeFormes(iss: z.core.$ZodRawIssue): string | undefined {
  const parBranche = (iss as IssueDeParse).errors ?? [];
  return parBranche.find((b) => b.length > 0 && !b.some(estDeForme))?.[0]?.message;
}

/**
 * Choix « n parmi » : `{ pick, of: [...] }` (liste énumérée) ou `{ pick, table }` (tirage sur une
 * table d100). Remplace les graphies `choice[]` et `random` des lots L2/L3.
 *
 * Une entrée de `of` est l'UNION des trois façons de désigner une option : référence nue `ref(type)`,
 * référence à spécialisation `specRef(type)` (`{id, spec}` XOR `{id, choix}`, validée contre le pool
 * de l'entrée À TRAVERS l'`of`), ou un `pick` IMBRIQUÉ (un « n parmi » dont une option est elle-même
 * un choix). La récursion se referme sur le nœud LUI-MÊME (`noeud`).
 *
 * `optionsDuPorteur` ouvre l'`of` aux formes que le PORTEUR admet en plus des trois ci-dessus —
 * même composition FERMÉE que l'`extra` de `ref()`/`specRef()` : le porteur déclare ce qu'il
 * accepte, la fabrique ne connaît aucun cas particulier (cf. `avancement.ts`, `{random}`).
 */
export function pick<T extends TypeEntite>(type: T, optionsDuPorteur: readonly z.ZodType<unknown>[] = []): z.ZodType<unknown> {
  const option: z.ZodType<unknown> = z.lazy(() => unionDeFormes([ref(type), specRef(type), noeud, ...optionsDuPorteur]));
  const noeud: z.ZodType<unknown> = marquerProduit(nommerChamps(z.strictObject({ pick: nombreDeTirages(), of: z.array(option).min(1) }), { pick: { label: "sélection" }, of: { label: "contenu" } }), 'pick', 'of');
  return noeud;
}

/** Le nombre `n` d'un « n parmi » ou d'un tirage. */
const nombreDeTirages = (): z.ZodNumber => z.number().int().positive();

/**
 * Tirage sur table : `{ pick, table }` — `pick` tirages sur la table que désigne `table`, le nœud de
 * référence que le PORTEUR déclare.
 */
export function tirageSurTable<T>(table: z.ZodType<T>): z.ZodType<{ pick: number; table: T }> {
  return marquerProduit(nommerChamps(z.strictObject({ pick: nombreDeTirages(), table }), { pick: { label: "sélection" }, table: { label: "table" } }), 'pick', 'table', { table });
}

