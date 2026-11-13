/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : l'index (base, clé) → élément
 * (`indexerModeles`) des manifestes que le listage servi a validés contre leur GLB (`verdictsDesModeles`), mis en données
 * que Godot dessine sans les relire : chaque base avec ses points d'accroche (ses emplacements, puis ses prises), à chaque
 * emplacement les objets rigides construits pour elle dont un mesh pend à l'os du point, et les objets tenus qui s'y rangent
 * (`emplacementsDeRangement`), à chaque prise ceux dont un mesh pend à l'os de l'une de ses prises (`osDesRigides` du
 * listage, `asset/glb.ts` `meshes`, `asset/evaluateur/evaluer.ts` `monter`), que Godot repose du repère de leur prise
 * d'origine dans celui de la prise retenue, ou range à l'emplacement (#3319) ; ses lignes de pièce (#3086, D3), tirées de la
 * garde-robe, où vont ses éléments liés au `squelette` ou en `surface` et ses accessoires, rigides compris ; les fichiers de chaque élément servi
 * (`fichiersDuModele`) et le libellé de la chose qu'il porte ; les surfaces de chaque base et de chaque élément servi
 * (`asset/surfaces.ts`), où se posent au montage la palette de la composition et les emblèmes de la garde-robe (#3111) ;
 * la table rôle → clip de chaque base et la vitesse au sol de son rôle `marche` ; chaque véhicule servi, élément sans base
 * (#2987), sous la fiche que nomme sa clé `definition` ; le rapport de l'index, dont l'élément n'est servi nulle part.
 * Monté, un véhicule porte ses pièces aux postes en vigueur (`postesEnVigueur`), celles de ses Améliorations, et cache
 * les nœuds que ses Améliorations montées ou non changent (`noeudsCaches`).
 */
import { rangDeCase, type Attache, type EmplacementOffert, type Repere } from '../asset/attache';
import { COUCHES, ETATS_AU_POSTE, RANG_DU_CORPS, noeudSelon, type Couche, type ManifesteDElement } from '../asset/element';
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import type { Surface } from '../asset/surfaces';
import { fichiersDuModele, indexerModeles, type EntreeDeModele } from '../asset/modeles';
import { cataloguesDeComposition, emplacementDePiece, emplacementsDeRangement, gardeRobe, findTeinteById, libelleDeCleDElement, maniementDeLaForme, pieceRacine, type LigneDeGardeRobe, type EmblemeResolu, type FireArc, type Maniement, type PosteDuVehicule } from '../../../src/noyau/index';

/**
 * @contrat Atelier 3D
 * La réponse de `modeles` :
 */
export interface ModelesDeLAtelier {
  /** les bases de l'index (base, clé) → élément (`indexerModeles`, `asset/modeles.ts`). Les `points` d'une base
   *  listent ses `emplacements`, puis ses `prises` si elle en déclare, chacun avec le libellé de son emplacement de
   *  la garde-robe ou de sa main (`prises` de `catalogues`), à défaut son id. À chaque point vont les ids des
   *  éléments de cette base liés en `liaison.mode === 'rigide'`, hors accessoires, dont `osDesRigides` contient, pour
   *  un emplacement, `attache.os` du point, pour une prise, l'`os` de l'une des prises de la base : un objet tenu se
   *  monte à chaque prise, et Godot le repose du repère de sa prise d'origine, celle dont l'os porte son mesh, dans
   *  celui de la prise retenue, sans miroir (#3319). Un objet tenu va aussi aux emplacements où se range sa forme
   *  `cle.apparence` (`emplacementsDeRangement` de la surface du noyau : le `rangement` des trappings de cette forme,
   *  puis chaque emplacement où un preset range un objet de cette apparence, `rangementsObjets`), et Godot l'y
   *  range (section « Atelier 3D », `MontageDeComposition._ranger`). Une attache se pose en Euler XYZ de three, R
   *  = Rx·Ry·Rz (`asset/attache.ts`, `MontageDeComposition.repere`)
   *  (`.claude/skills/creer-un-personnage-3d/references/procedure.md`, rigide tenu ; `asset/evaluateur/evaluer.ts`,
   *  `monter`). Un rigide dont aucun mesh ne pend à un os (décor, véhicule, mesh à la racine) n'a aucun point ni
   *  ligne ; un élément lié au `squelette` ou en `surface`, ou un accessoire, n'a aucun point. Les `lignes` d'une
   *  base (#3086, D3) sont tirées de la garde-robe (`src/data/garde-robe.json`, `gardeRobe` et `emplacementDePiece`
   *  de la surface du noyau), dans son ordre : le sélecteur `tete`, dont chaque `choix` est une entrée
   *  `kind: 'tete'`, et dont `label` est celui de l'axe `tete` de `catalogues` ; le sélecteur `coiffure`, de même,
   *  dont chaque `choix` est une entrée `kind: 'coiffure'` ; une bascule `piece` par entrée `kind: 'piece'` de
   *  `categorie` `vetement` ou `armure`, `variantes` vrai si une entrée `kind: 'variante'` de la garde-robe est une
   *  variante de cette pièce (#3446) ; une liste `emplacement` par entrée `kind: 'emplacement'` que nomme
   *  l'`emplacement` d'une pièce d'accessoire. `id` est celui de l'entrée, `label` son libellé. `elements` liste les
   *  éléments de la base liés au `squelette` ou en `surface`, et ses accessoires, rigides compris, dont la clé vaut
   *  `id` : `cle.tete`, `cle.coiffure`, `cle.piece` ou la pièce de la variante `cle.piece` (`pieceRacine`, #3446),
   *  ou, pour une ligne `emplacement`, l'emplacement de la pièce `cle.piece` (`emplacementDePiece`). Une liste
   *  `elements` vide est un « manquant ». Un élément lié au `squelette` ou en `surface`, ou un accessoire, va à une
   *  ligne au plus : un accessoire `rigide` va à la ligne de son emplacement, que la base ou l'une de ses pièces
   *  l'offre (le plumet au `cimier` du casque), jamais à un point. `empreinte` vaut `glb.sha256` de la base. `clips`
   *  vaut la table rôle → clip de la base (`clips` du manifeste, « Gabarit d'une base ») et `vitesseAuSol` la vitesse
   *  au sol en m/s de son clip du rôle `marche` (`appuis.vitesseAuSol`). */
  bases: BaseDeLAtelier[];
  /** les fichiers, sous `modeles/`, de chaque base et de chaque élément servi, à un point, à une ligne ou en véhicule
   *  (`fichiersDuModele`) : son GLB et la scène que l'export en fabrique. Godot demande celui que nomme la `forme` du
   *  listage. */
  fichiers: Record<string, { glb: string; scene: string }>;
  /** ceux de l'index (`[base-absente]`, `[cle-en-doublon]`, `[base-en-doublon]`, `[forme]`). Un manifeste qui n'est
   *  ni une base (il porte `os`, schéma `VERSION_DU_SCHEMA_DE_BASE`, `asset/manifesteDeBase.ts`) ni un élément qui
   *  nomme sa `base` (schéma 3) ou d'une catégorie sans base (`decor`, `vehicule` : `estSansBase`,
   *  `asset/element.ts`, #2987, rangé sous sa seule clé) est refusé en `[forme]`. Un refus de l'index bloque aussi
   *  l'import et la Release (`asset/importer.ts`, `asset/release.ts` `modelesEpingles`). */
  refus: string[];
  /** le rapport de l'index, qui ne bloque ni l'import ni la Release : `[emplacement-non-offert] <élément> : …` pour
   *  un accessoire dont l'emplacement de sa pièce n'est offert ni par sa base ni par un vêtement ou une armure de la
   *  même base (`emplacementsNonOfferts`, `asset/element.ts`). Cet élément n'est servi ni à un point ni à une ligne.
   *  L'import (`hotes/godot/importer.mjs`) imprime le même rapport, sans bloquer. */
  rapport: string[];
  /** pour chaque base servie, et pour chaque élément servi, à un point, à une ligne ou en véhicule, quelle que soit
   *  sa liaison, et pour eux seuls, ses `surfaces` (`asset/surfaces.ts`), dans l'ordre du manifeste ; une base sans
   *  `surfaces` (champ optionnel de son manifeste, déclaré par son corps,
   *  `scripts/personnage-3d/base/humanoide.json`) n'en a aucune, seul un élément admet `blason` et `matiere`, et
   *  seule une base `parSexe`. Le `nom` d'une surface est celui d'un matériau du GLB (`surface-absente`) ; `palette`
   *  est l'emplacement de palette dont il prend la couleur, l'un de `SLOTS` (`palette-inconnue`), quelle que soit la
   *  catégorie de l'élément ; `blason: true` dit qu'il reçoit l'emblème, chacune de ses primitives portant alors
   *  `TEXCOORD_0` (`uv-absente`) ; `matiere` nomme la matière de décor du monde dont il s'habille, `prop--<id>` d'une
   *  matière du domaine `prop` de `materials.json` (`matieresDeDecor`, surface du noyau ; `matiere-inconnue`) ;
   *  `parSexe`, une table d'un sexe (`sexeSchema`) au nom d'un matériau du GLB, nomme le matériau qui remplace le
   *  sien sur un corps de ce sexe (#3188), la variante `KHR_materials_variants` du nom du sexe de chaque primitive de
   *  la surface (`surface-absente` sinon), que la construction recouche des UV du corps qui le peint sur celles de la
   *  surface (`scripts/personnage-3d/base/materiaux_par_sexe.py`). */
  surfaces: Record<string, readonly Surface[]>;
  /** pour chaque élément servi, le libellé de la chose que sa `cle` désigne (`libelleDeCleDElement`, surface du
   *  noyau : sa tête, sa coiffure, sa pièce, son apparence ou la fiche de son véhicule, celle-ci marquée du sigle de
   *  son livre, `libelleDAuteur` : « Baliste (AA) », « Baliste (ADE II) »), à défaut son id. */
  libelles: Record<string, string>;
  /** pour chaque élément servi dont le manifeste déclare `liaison.secondePrise` (un rigide tenu des deux mains,
   *  `asset/element.ts`, #3319), et pour eux seuls, son `repere`, celui où se pose le repère de prise de la main
   *  libre, dans le repère de la prise qui le tient, en Euler XYZ comme une attache, et son `maniement` : celui de sa
   *  forme (`cle.apparence`, ou la racine dont elle est une variante, `maniementDeLaForme`,
   *  `src/noyau/animation.ts`), `null` sans forme ou si sa racine n'en déclare pas ; il choisit la table de
   *  `clipsDeuxMains` que joue la base qui le tient. L'import refuse une seconde prise sur un élément dont aucun mesh
   *  ne pend à l'os d'une prise de la base (`seconde-prise-sans-prise`). */
  secondesPrises: Record<string, SecondePriseDeLAtelier>;
  /** pour chaque élément servi dont le manifeste déclare une `couche`, et pour eux seuls, le rang de sa couche dans
   *  `COUCHES` (`asset/element.ts`, de `peau` à `manteau`), s'il est un accessoire, les zones de sa base qu'il couvre
   *  (`couvre`, aucune s'il n'en déclare pas) et les éléments servis qu'il masque (`masque`) : ceux dont la couche est
   *  plus intérieure, et ceux sans couche. */
  couches: Record<string, CoucheDeLAtelier>;
  /** les entrées `kind: 'embleme'` de la garde-robe (`src/data/garde-robe.json`, `gardeRobe` de la surface du noyau),
   *  chacune réduite à `id`, `label` et `svg`. `svg` est un document SVG complet, couleurs comprises, à `viewBox`
   *  carré dont `width` et `height`, s'ils sont posés, sont égaux, chacun valant à défaut le côté du `viewBox` (une
   *  longueur sans unité vaut des `px`), puisque `Image.load_svg_from_string` les retient comme taille intrinsèque ;
   *  refusé au parse sinon (`schemas/defs/garde-robe.ts`, `refusDeSvg`). Le pont étant un bundle qui gèle `src/data`,
   *  l'emblème atteint Godot par cette réponse, sans fichier servi. */
  emblemes: EmblemeDeLAtelier[];
  /** par fiche de coque ou d'engin, l'id de l'élément `vehicule` servi dont la `cle.definition` la nomme (#2987),
   *  dans l'ordre des libellés de ces éléments (`libelles`). */
  vehicules: Record<string, string>;
  /** par Amélioration navale (`kind: 'amelioration'` de `naval-traits.json`), l'id de l'élément `amelioration` servi
   *  dont la `cle.amelioration` la nomme (#2987). Un élément `amelioration` n'a pas de base ; son manifeste porte
   *  `montage` : `ancrages`, il se monte aux `ancrages` de son Amélioration dans le manifeste du véhicule, ou
   *  `postes`, il se monte à chaque poste que son Amélioration offre (`selon.<amelioration>.postes` du manifeste du
   *  véhicule) et porte alors deux nœuds à mesh, `ouvert`, montré devant une pièce montée, et `ferme`, montré sinon
   *  (`ETATS_AU_POSTE`, refus `etat-absent`). Un véhicule n'a pas de base (`REGLES_DES_CATEGORIES`,
   *  `asset/element.ts`) : il n'est servi ni à un point ni à une ligne, et ses meshes restent à la racine de sa scène
   *  ou sous ses propres nœuds. Son manifeste offre en option des `postes` : par bord (`FIRE_ARCS`,
   *  `src/engine/types.ts`), la liste des positions de sa scène, en mètres, où se montent dans l'ordre les pièces des
   *  postes de ce bord (section « Corps d'un combattant »), et des `ancrages` : par Amélioration navale, la liste des
   *  positions de sa scène, en mètres, où se monte la pièce de cette Amélioration (refus `cle-inconnue` sur un id qui
   *  n'est pas une Amélioration). Le manifeste d'un véhicule ou d'une pièce d'Amélioration porte en option `selon` :
   *  par Amélioration navale (refus `cle-inconnue`), ce qui change quand elle est montée, `{}` pour une pièce,
   *  `{ postes? }` pour un véhicule, ses postes, de même forme que `postes`, qui remplacent ceux de chaque bord
   *  qu'ils nomment ; un nœud à mesh de son GLB nommé `avec-<amelioration>` ou `sans-<amelioration>` (`noeudSelon`)
   *  nomme une Amélioration de son `selon` (refus `selon-absent`), montré seulement quand elle est montée, ou
   *  seulement quand elle ne l'est pas. */
  ameliorations: Record<string, string>;
}

/**
 * @contrat Atelier 3D
 * Une base de `bases`.
 */
export interface BaseDeLAtelier {
  /** son id de modèle. */
  id: string;
  /** l'empreinte de son GLB. */
  empreinte: string;
  /** ses points d'accroche. */
  points: PointDAccroche[];
  /** ses lignes de pièce. */
  lignes: LigneDePiece[];
  /** le clip de chaque rôle qu'elle joue (`ManifesteDeBase.clips`). */
  clips: ManifesteDeBase['clips'];
  /** par maniement, le clip de chaque rôle qu'elle joue en tenant des deux mains un objet de ce maniement
   *  (`ManifesteDeBase.clipsDeuxMains`), vide sans table. */
  clipsDeuxMains: NonNullable<ManifesteDeBase['clipsDeuxMains']>;
  /** par clip, les prises que son geste occupe (`ManifesteDeBase.prisesOccupees`), vide sans table : Godot y range
   *  l'objet tenu (`MontageDeComposition.poser_le_clip`). */
  prisesOccupees: NonNullable<ManifesteDeBase['prisesOccupees']>;
  /** la vitesse au sol en m/s du clip du rôle `marche` (`ManifesteDeBase.appuis.vitesseAuSol`). */
  vitesseAuSol: number;
  /** les os de ses chaînes (`ManifesteDeBase.chaines`, section « Pile des couches »). */
  osDeChaine: string[];
}

/**
 * @contrat Atelier 3D
 * Un point d'accroche d'une base : un emplacement ou une prise, son libellé, son repère, et les ids des éléments qui s'y
 * montent. Les emplacements sont ceux de la base, puis ceux qu'offrent ses pièces sans que la base les offre.
 */
export interface PointDAccroche {
  /** l'id de l'emplacement ou de la prise. */
  id: string;
  /** son libellé. */
  label: string;
  /** emplacement ou prise. */
  genre: 'emplacement' | 'prise';
  /** son repère sur un os de la base ; offert par des pièces, celui de la première (`offertPar`). */
  attache: Attache;
  /** les ids des éléments qui s'y montent. */
  elements: string[];
  /** absent, la base l'offre ; sinon, par id d'élément de pièce qui l'offre (`emplacements` de son manifeste), son
   *  repère et les os qu'il suit : Godot n'y range un objet que sous une pièce montée qui l'offre, à son repère, qui
   *  suit ses `poids` (#3844). */
  offertPar?: Record<string, EmplacementOffert>;
}

/**
 * @contrat Atelier 3D
 * Une ligne de pièce (#3086, D3) : le sélecteur d'un axe (`tete`, `coiffure`), une pièce de vêtement ou d'armure
 * (`piece`), bascule ou, si la garde-robe lui déclare des variantes (#3446), liste, ou la liste des accessoires d'un
 * emplacement (`emplacement`) ; `elements` vide : « manquant ».
 */
export type LigneDePiece =
  /** le sélecteur d'un axe : son libellé et ses choix. */
  | { sorte: 'tete' | 'coiffure'; label: string; choix: ChoixDeLigne[] }
  /** une pièce de vêtement ou d'armure : bascule, ou liste si la garde-robe lui déclare des variantes (#3446). */
  | ({ sorte: 'piece'; variantes: boolean } & ChoixDeLigne)
  /** la liste des accessoires d'un emplacement. */
  | ({ sorte: 'emplacement' } & ChoixDeLigne);

/**
 * @contrat Atelier 3D
 * Un choix d'une ligne de pièce.
 */
export interface ChoixDeLigne {
  /** un id de la garde-robe. */
  id: string;
  /** son libellé. */
  label: string;
  /** les ids des pièces de la base qui le portent. */
  elements: string[];
}

/**
 * @contrat Atelier 3D
 * La seconde prise d'un élément (`liaison.secondePrise`).
 */
export interface SecondePriseDeLAtelier {
  /** son repère dans celui de sa prise. */
  repere: Repere;
  /** le maniement de sa forme (`cle.apparence`, `maniementDeLaForme`), qui choisit ses clips à deux mains, `null` sans
   *  forme ou sans déclaration. */
  maniement: Maniement | null;
}

/**
 * @contrat Atelier 3D
 * La couche d'un élément au montage.
 */
export interface CoucheDeLAtelier {
  /** le rang de sa couche dans `COUCHES`, de la plus intérieure à la plus extérieure (section « Pile des couches »). */
  rang: number;
  /** vrai pour un accessoire (`categorie` de son manifeste, section « Pile des couches »). */
  accessoire: boolean;
  /** les zones qu'il couvre. */
  couvre: readonly string[];
  /** les éléments qu'il masque. */
  masque: readonly string[];
}

/** Un emblème offert au montage : son id, son libellé et son dessin. */
type EmblemeDeLAtelier = Pick<LigneDeGardeRobe<'embleme'>, 'id' | 'label' | 'svg'>;

/** La `cle` du manifeste d'élément `manifeste`. */
export const cleDe = (manifeste: unknown): Readonly<Record<string, string | undefined>> => (manifeste as ManifesteDElement).cle;
const modeDe = (e: EntreeDeModele) => (e.brut as ManifesteDElement).liaison.mode;
/** Le GLB du modèle `id` et la scène que l'export en fabrique (`fichiersDuModele`). */
const formesDe = (id: string): ModelesDeLAtelier['fichiers'][string] => { const { glb, scene } = fichiersDuModele(id); return { glb, scene }; };
/** La base de l'élément `e`, `undefined` s'il est sans base (`estSansBase`). */
const baseDe = (e: EntreeDeModele): string | undefined => { const m = e.brut as ManifesteDElement; return 'base' in m ? m.base : undefined; };
/** Les `nom` des surfaces `blason: true` du manifeste d'élément `manifeste`, dans l'ordre du manifeste. */
export const blasonsDe = (manifeste: unknown): string[] => (manifeste as ManifesteDElement).surfaces.filter((s) => s.blason === true).map((s) => s.nom);

/** L'emblème `embleme` d'un porteur, à poser sur l'élément de manifeste `manifeste` (`undefined` : aucun élément) s'il
 *  porte une surface `blason` (`blasonsDe`) : `{ embleme }`, sinon rien. */
export const emblemeMonte = (embleme: EmblemeResolu | undefined, manifeste: unknown): { embleme?: EmblemeResolu } =>
  embleme && manifeste !== undefined && blasonsDe(manifeste).length > 0 ? { embleme } : {};

/** Les modèles de `manifestes` (id de modèle → manifeste du listage servi, validé) : les bases, leurs points d'accroche et
 *  leurs lignes de pièce, les surfaces de chaque modèle servi, les emblèmes de la garde-robe, les véhicules, les refus de
 *  l'index et son rapport. Un objet lié en `rigide` se monte aux emplacements de sa base dont l'os est l'un de ses `osDesRigides` (id
 *  de modèle → os qui portent ses meshes rigides, du listage servi), et à chacune de ses prises si l'un d'eux est l'os d'une
 *  prise (#3319) ; toute pièce, accessoire rigide compris, à la ligne dont
 *  l'id vaut sa clé : `tete`, `coiffure`, `piece` d'un vêtement ou d'une armure, ou de la pièce de sa variante (`pieceRacine`,
 *  #3446), ou l'emplacement de sa pièce
 *  d'accessoire (`emplacementDePiece`), que la base ou l'une de ses pièces offre. */
export function modelesDeLAtelier(manifestes: Record<string, unknown>, osDesRigides: Readonly<Record<string, readonly string[]>>): ModelesDeLAtelier {
  const index = indexerModeles(Object.entries(manifestes).map(([id, brut]) => ({ id, brut })));
  const elements = [...index.elements.values()];
  const fichiers: ModelesDeLAtelier['fichiers'] = {};
  const surfaces: Record<string, readonly Surface[]> = {};
  const libelles: Record<string, string> = {};
  const secondesPrises: Record<string, SecondePriseDeLAtelier> = {};
  const rangs: Record<string, Pick<CoucheDeLAtelier, 'rang' | 'accessoire' | 'couvre'>> = {};
  const catalogues = cataloguesDeComposition();
  const libelleDuPoint = (id: string, genre: PointDAccroche['genre']): string => {
    const [racine] = id.split('#');
    const label = (genre === 'prise' ? catalogues.prises : gardeRobe.filter((g) => g.kind === 'emplacement')).find((c) => c.id === racine)?.label ?? racine;
    const rang = rangDeCase(id);
    return rang === undefined ? label : `${label} ${rang}`;
  };
  const libelleDeLAxe = (champ: 'tete' | 'coiffure'): string => catalogues.axes.find((a) => a.champ === champ)!.label;
  const servir = (servis: readonly EntreeDeModele[]): string[] =>
    servis.map(({ id, brut }) => {
      fichiers[id] = formesDe(id);
      surfaces[id] = (brut as ManifesteDElement).surfaces;
      libelles[id] = libelleDeCleDElement(cleDe(brut)) ?? id;
      const { couche, couvre } = brut as { couche?: Couche; couvre?: readonly string[] };
      if (couche) rangs[id] = { rang: COUCHES.indexOf(couche), accessoire: (brut as ManifesteDElement).categorie === 'accessoire', couvre: couvre ?? [] };
      const { liaison } = brut as ManifesteDElement;
      const forme = cleDe(brut).apparence;
      if ('secondePrise' in liaison && liaison.secondePrise) secondesPrises[id] = { repere: liaison.secondePrise, maniement: (forme && maniementDeLaForme(forme)) || null };
      return id;
    });
  const bases = [...index.bases.values()].map(({ id, brut }): BaseDeLAtelier => {
    const m = brut as ManifesteDeBase;
    const deLaBase = elements.filter((e) => baseDe(e) === m.base);
    const estUnePiece = (e: EntreeDeModele) => modeDe(e) !== 'rigide' || (e.brut as ManifesteDElement).categorie === 'accessoire';
    const objets = deLaBase.filter((e) => !estUnePiece(e));
    const pieces = deLaBase.filter(estUnePiece);
    fichiers[id] = formesDe(id);
    surfaces[id] = m.surfaces ?? [];
    const osDesPrises = Object.values(m.prises ?? {}).map((a) => a.os);
    const pointsDe = (genre: PointDAccroche['genre'], attaches: Readonly<Record<string, Attache>>): PointDAccroche[] =>
      Object.entries(attaches).map(([pointId, attache]) => {
        const pendA = (e: EntreeDeModele, porteurs: readonly string[]) => (osDesRigides[e.id] ?? []).some((os) => porteurs.includes(os));
        const seRangeIci = (e: EntreeDeModele) => {
          const apparence = cleDe(e.brut).apparence;
          return apparence !== undefined && pendA(e, osDesPrises) && emplacementsDeRangement(apparence).includes(pointId);
        };
        const offert = genre === 'prise' ? (e: EntreeDeModele) => pendA(e, osDesPrises) : (e: EntreeDeModele) => pendA(e, [attache.os]) || seRangeIci(e);
        return { id: pointId, label: libelleDuPoint(pointId, genre), genre, attache, elements: servir(objets.filter(offert)) };
      });
    const offerts = new Map<string, Record<string, EmplacementOffert>>();
    for (const e of pieces) {
      for (const [pointId, attache] of Object.entries((e.brut as { emplacements?: Readonly<Record<string, EmplacementOffert>> }).emplacements ?? {}))
        if (!(pointId in m.emplacements)) offerts.set(pointId, { ...offerts.get(pointId), [e.id]: attache });
    }
    const points = [
      ...pointsDe('emplacement', m.emplacements),
      ...pointsDe('emplacement', Object.fromEntries([...offerts].map(([pointId, par]) => [pointId, Object.values(par)[0]]))).map((p) => ({ ...p, offertPar: offerts.get(p.id)! })),
      ...pointsDe('prise', m.prises ?? {}),
    ];
    const choix = (idDeChoix: string, label: string, porte: (e: EntreeDeModele) => boolean): ChoixDeLigne => ({ id: idDeChoix, label, elements: servir(pieces.filter(porte)) });
    const racineDe = (e: EntreeDeModele) => {
      const piece = cleDe(e.brut).piece;
      return piece === undefined ? undefined : pieceRacine(piece)?.id;
    };
    const emplacementDe = (e: EntreeDeModele) => {
      const piece = cleDe(e.brut).piece;
      return piece === undefined ? undefined : emplacementDePiece(piece);
    };
    const lignes: LigneDePiece[] = [
      { sorte: 'tete', label: libelleDeLAxe('tete'), choix: gardeRobe.flatMap((g) => (g.kind === 'tete' ? [choix(g.id, g.label, (e) => cleDe(e.brut).tete === g.id)] : [])) },
      { sorte: 'coiffure', label: libelleDeLAxe('coiffure'), choix: gardeRobe.flatMap((g) => (g.kind === 'coiffure' ? [choix(g.id, g.label, (e) => cleDe(e.brut).coiffure === g.id)] : [])) },
      ...gardeRobe.flatMap((g): LigneDePiece[] => (g.kind === 'piece' && g.categorie !== 'accessoire' ? [{ sorte: 'piece', variantes: gardeRobe.some((v) => v.kind === 'variante' && v.piece.id === g.id), ...choix(g.id, g.label, (e) => racineDe(e) === g.id) }] : [])),
      ...gardeRobe.flatMap((g): LigneDePiece[] =>
        g.kind === 'emplacement' && gardeRobe.some((p) => p.kind === 'piece' && emplacementDePiece(p.id) === g.id)
          ? [{ sorte: 'emplacement', ...choix(g.id, g.label, (e) => emplacementDe(e) === g.id) }]
          : []),
    ];
    return { id, empreinte: m.glb.sha256, points, lignes, clips: m.clips, clipsDeuxMains: m.clipsDeuxMains ?? {}, prisesOccupees: m.prisesOccupees ?? {}, vitesseAuSol: m.appuis.vitesseAuSol, osDeChaine: Object.values(m.chaines).flat() };
  });
  const emblemes = gardeRobe.flatMap((e) => (e.kind === 'embleme' ? [{ id: e.id, label: e.label, svg: e.svg }] : []));
  const couches = Object.fromEntries(Object.entries(rangs).map(([id, couche]): [string, CoucheDeLAtelier] =>
    [id, { ...couche, masque: Object.keys(libelles).filter((autre) => (rangs[autre]?.rang ?? RANG_DU_CORPS) < couche.rang) }]));
  const parCle = (categorie: 'vehicule' | 'amelioration', champ: 'definition' | 'amelioration') => Object.fromEntries(elements.flatMap((e) => {
    const m = e.brut as ManifesteDElement;
    return m.categorie === categorie ? [[cleDe(m)[champ]!, servir([e])[0]]] : [];
  }));
  const vehicules = Object.fromEntries(Object.entries(parCle('vehicule', 'definition')).sort(([, a], [, b]) => libelles[a].localeCompare(libelles[b], 'fr')));
  return { bases, fichiers, refus: index.refus, rapport: index.rapport, surfaces, libelles, secondesPrises, couches, emblemes, vehicules, ameliorations: parCle('amelioration', 'amelioration') };
}

/** Une pièce montée sur un véhicule : l'élément `vehicule` servi qui dessine sa fiche, son bord, sa position dans la
 *  scène du véhicule (`postes` de son manifeste) et sa palette, en `#rrggbb` par emplacement de palette. */
export interface PosteMonte {
  element: string;
  bord: FireArc;
  position: readonly [number, number, number];
  palette: Record<string, string>;
}

type ManifesteDeVehicule = Extract<ManifesteDElement, { categorie: 'vehicule' }>;

/** Les postes du véhicule de manifeste `manifeste` qui porte les Améliorations `ameliorations` : ceux de son manifeste,
 *  chaque bord que nomme `selon.<amelioration>.postes` d'une Amélioration montée remplacé par les siens (MDG 12 l.362). */
export const postesEnVigueur = (manifeste: unknown, ameliorations: readonly string[]): ManifesteDeVehicule['postes'] => {
  const { postes, selon } = manifeste as ManifesteDeVehicule;
  return Object.assign({}, postes, ...ameliorations.map((a) => selon?.[a]?.postes));
};

/** Les pièces de `postes` montées sur le véhicule de manifeste `manifeste`, de palette `palette`, qui porte les
 *  Améliorations `ameliorations` : chacune à la position de son bord qui suit celles des pièces précédentes de ce bord,
 *  si ses postes en vigueur (`postesEnVigueur`) l'offrent et qu'un élément de `vehicules` (fiche → élément servi) dessine
 *  sa fiche, à la palette du véhicule où la palette de sa teinte (`findTeinteById`) colore ; une autre ne se monte pas. */
export function postesMontes(manifeste: unknown, ameliorations: readonly string[], postes: readonly PosteDuVehicule[], vehicules: Readonly<Record<string, string>>, palette: Readonly<Record<string, string>>): PosteMonte[] {
  const offertes = postesEnVigueur(manifeste, ameliorations) ?? {};
  const rangs = new Map<FireArc, number>();
  return postes.flatMap(({ definition, bord, teinte }) => {
    const rang = rangs.get(bord) ?? 0;
    rangs.set(bord, rang + 1);
    const position = offertes[bord]?.[rang];
    const element = vehicules[definition];
    return position && element ? [{ element, bord, position, palette: { ...palette, ...findTeinteById(teinte)?.palette } }] : [];
  });
}

/** Les Améliorations de `offertes` que le véhicule de manifeste `manifeste` peut monter, dans leur ordre : celles que
 *  nomment ses `ancrages` ou son `selon`. */
export const ameliorationsMontables = (manifeste: unknown, offertes: readonly string[]): string[] => {
  const { ancrages, selon } = manifeste as ManifesteDeVehicule;
  return offertes.filter((a) => (ancrages && a in ancrages) || (selon && a in selon));
};

type EtatAuPoste = (typeof ETATS_AU_POSTE)[keyof typeof ETATS_AU_POSTE];

/** Une pièce d'Amélioration montée sur un véhicule : l'élément `amelioration` servi qui la dessine, sa position dans la
 *  scène du véhicule, et, montée à un poste, son bord, le nœud qu'elle montre et celui qu'elle cache (`ETATS_AU_POSTE`). */
export interface AmeliorationMontee {
  element: string;
  position: readonly [number, number, number];
  poste?: { bord: FireArc; montre: EtatAuPoste; cache: EtatAuPoste };
}

/** Les pièces des `ameliorations` montées sur le véhicule de manifeste `manifeste`, dont `montes` sont les pièces de ses
 *  postes (`postesMontes`) : pour chaque Amélioration dont un élément de `pieces` (Amélioration → élément servi, de manifeste
 *  dans `manifestes`) est servi, une pièce à chacun de ses `ancrages` dans le manifeste du véhicule, ou, montée aux postes,
 *  à chaque poste que l'Amélioration offre (`selon.<amelioration>.postes`), `ouvert` devant une pièce montée, `ferme` sinon. */
export function ameliorationsMontees(manifeste: unknown, ameliorations: readonly string[], montes: readonly PosteMonte[], pieces: Readonly<Record<string, string>>, manifestes: Readonly<Record<string, unknown>>): AmeliorationMontee[] {
  const vehicule = manifeste as ManifesteDeVehicule;
  return ameliorations.flatMap((amelioration) => {
    const element = pieces[amelioration];
    if (!element) return [];
    if ((manifestes[element] as Extract<ManifesteDElement, { categorie: 'amelioration' }>).montage === 'ancrages') return (vehicule.ancrages?.[amelioration] ?? []).map((position) => ({ element, position }));
    return Object.entries(vehicule.selon?.[amelioration]?.postes ?? {}).flatMap(([bord, positions]) => positions.map((position) => {
      const arme = montes.some((m) => m.bord === bord && m.position === position);
      return { element, position, poste: { bord: bord as FireArc, montre: arme ? ETATS_AU_POSTE.arme : ETATS_AU_POSTE.vide, cache: arme ? ETATS_AU_POSTE.vide : ETATS_AU_POSTE.arme } };
    }));
  });
}

/** Les nœuds à cacher du véhicule de manifeste `manifeste`, qui porte les Améliorations `ameliorations`, et de ses pièces
 *  d'Amélioration `montees` (`ameliorationsMontees`, de manifeste dans `manifestes`) : pour chaque Amélioration que nomme
 *  leur `selon`, ses nœuds `sans-` si elle est montée, `avec-` sinon (`noeudSelon`). */
export function noeudsCaches(manifeste: unknown, ameliorations: readonly string[], montees: readonly AmeliorationMontee[], manifestes: Readonly<Record<string, unknown>>): string[] {
  const nommees = new Set([manifeste, ...montees.map((m) => manifestes[m.element])].flatMap((m) => Object.keys((m as Extract<ManifesteDElement, { categorie: 'vehicule' | 'amelioration' }>).selon ?? {})));
  return [...nommees].map((a) => noeudSelon(ameliorations.includes(a) ? 'sans' : 'avec', a));
}
