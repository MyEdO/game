/**
 * LE GABARIT D'UNE BASE (#2972, #3086) : la pose du gabarit (`poseDuGabarit`), les poids des shape keys de silhouette
 * (`poidsDeSilhouettes`), calculés une fois ici pour l'évaluateur
 * (`evaluateur/gabarit.ts`, qui les pose sur une scène three) et pour l'hôte (`hotes/godot/pont/CONTRAT.md`, « Gabarit
 * d'une base »). PUR : ni three ni le noyau à l'exécution (`chargerEvaluateur`, `charger.mjs`).
 */
import type { GabaritResolu, Sexe } from '../../../src/noyau/index.ts';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence.ts';
import { SEXES } from '../../../src/lib/sexe.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { CARRURE_MOINS, CARRURE_PLUS, FEMININ, CORPULENCE, NOMS_DES_SILHOUETTES, estSilhouette } from './silhouettes.ts';
import {
  CLES_DU_GABARIT,
  PREFIXE_DES_CLES_DU_GABARIT,
  fauteDeBornesDuGabarit,
  type BornesDuGabarit,
  type ManifesteDeBase,
  type TableDeGabarit,
} from './manifesteDeBase.ts';
import { FACTEURS_NEUTRES } from './facteursDuGabarit.ts';

/**
 * @contrat Gabarit d'une base
 * Le domaine des silhouettes et du gabarit :
 *
 * - `etatsDuGabarit(table, silhouettes)` (`asset/etatsDuGabarit.ts`) émet la liste commune à la cuisson, à la
 *   correction des poids et à la porte CLI `--etats-gabarit` de `godot:evaluer` : produit des coins de silhouettes
 *   par les jeux de facteurs (neutre, chaque sens cuit, chaque milieu, combinaisons aux milieux et aux extrêmes).
 *   Chaque état porte ses facteurs, ses poids de silhouettes et de gabarit, et les poids de référence sans
 *   silhouettes ni clés croisées. Ces poids proviennent de `poidsDeSilhouettes` et `poidsDuGabarit` ; Python les
 *   applique.
 * - `etatsAuxFacteursNeutres(table, silhouettes)` (même module) en rend la sous-liste dont chaque facteur vaut le
 *   neutre de sa clé (`sontNeutres`, `asset/facteursDuGabarit.ts`) : les phases neutre et silhouettes de la
 *   construction la reçoivent sans la filtrer. La finition des silhouettes reçoit `etatsDuGabarit` entier (#3104).
 * - `cellulesDeSilhouettesAtteignables` (`asset/gabarit.ts`) émet les quatre cellules affines du domaine continu,
 *   avec leur origine et leurs deux colonnes en poids de silhouettes, dérivées de `poidsDeSilhouettes` et
 *   `poidsDeCarrure`. `coinsDeSilhouettesAtteignables`, commun à `etatsDuGabarit` et `grilleDesAppuis`, en dérive les
 *   coins ; les poids identiques et les jeux de facteurs identiques sont dédupliqués. La règle des deux carrures
 *   exclusives appartient à `poidsDeCarrure`. `poidsDeSilhouettes` ne cumule `carrure_plus` avec aucune autre
 *   silhouette : un corps féminin la perd, un corps masculin ne la garde que plus forte que `corpulence`, qui
 *   l'emporte à égalité (#3104, levée par #3280). Une branche de carrure dont le coin lointain n'est pas la somme de
 *   ses deux colonnes perd sa colonne de corpulence : sa cellule se réduit à l'axe de carrure, l'axe de corpulence
 *   restant porté par l'autre branche du même sexe ; la branche `carrure_plus` d'un corps féminin a une colonne de
 *   carrure nulle. Sans silhouette, le domaine est un point, ses coins contiennent seulement `{}` et sa liste de
 *   cellules est vide ; Python ne réénonce pas les axes du domaine. Les coins prouvent le maximum de norme et le
 *   maximum d’erreur de positions GLB, par convexité d’une norme de fonction affine.
 * - Les opérations de `gabarit.mjs` : `silhouettes` rend le vocabulaire de `asset/silhouettes.ts`, que Python lit par
 *   `noms_silhouettes.py` ; `etatsAuxFacteursNeutres` et `etatsDuGabarit` rendent ces états et le champ requis
 *   `cellulesSilhouettes`, émis aussi par la cuisson ; `cles` cuit les seules clés `gabarit_*` d'un `corps`, sans les
 *   positions des états ; `matrices` reçoit les états et rend les `groupes` de matrices ; `appuis` rend les seuls
 *   `etats` de sa grille. `etatsAuxFacteursNeutres`, `etatsDuGabarit` et `appuis` exigent la liste `silhouettes`,
 *   sinon le refus est nommé `silhouettes-absentes`. `humanoide.preparer_moteurs` lit les cellules de ce domaine et
 *   les conserve avec chaque groupe pour `etats_ponderes` en Python ; leur absence est refusée par
 *   `topologie-silhouettes-absente`.
 * - `groupes_de_peau` (`scripts/personnage-3d/base/cuisson_gabarit.py`) rend, par jeu de facteurs,
 *   `(états, matrices, longueurs des clips)` : les matrices de peau au repos puis à chaque instant de chaque clip,
 *   lues en memmap. `GroupePondere` en tire la clause de chaque échantillon, le repos puis chaque clip, que la
 *   correction des poids distingue dans ses plans de coupe.
 * - `extremes` est la mesure commune de la finition, de la porte R et de la correction des poids. La finition
 *   applique `etats_ponderes` puis `extremes` aux matrices de repos de chaque jeu de facteurs, et à celles des clips
 *   aux facteurs neutres (`mesurer_domaine`), sur les champs courants et, aux facteurs non neutres, sur les clés
 *   `gabarit_*` que `cuisson_des_champs` cuit sur ces champs sous les poids courants : le même calcul sur les mêmes
 *   entrées que la cuisson de la phase gabarit. Une clé croisée ne lit que le champ de sa silhouette ; seuls les
 *   champs changés depuis la mesure précédente sont recuits, et l'opération `cles` nomme la silhouette de chaque clé.
 *   À chaque instant et dans chaque cellule, `extremes` certifie le minimum par la borne triangulaire (minimum des
 *   coins moins la demi-somme des normes des colonnes), puis résout le QP sur les cellules que cette borne ne
 *   certifie pas : quatre bords et point stationnaire intérieur. Le rapport garde la même longueur de référence sans
 *   silhouettes `l_b`. La trace porte le minimum, sa nature EXACT ou CERTIFIÉ (dans ce cas `bas` est une borne
 *   inférieure), la cellule, les poids de l’argmin exact sur toute arête en défaut, et l’instant. Sa portée est «
 *   exact sur les silhouettes, aux facteurs de `etatsDuGabarit` » : au repos l’arête est bilinéaire en silhouettes ×
 *   facteurs. `mesurer_domaine` et `diagnostic_poids` lisent cette trace ; la finition attribue chaque arête en
 *   défaut, au repos ou en clip, aux silhouettes de poids non nul de son argmin.
 * - Une couche par domaine : défaut d'une silhouette, au repos ou en clip aux facteurs neutres → clés (finition des
 *   clés, sous les poids de la phase neutre) ; défaut en clip du neutre, ou que la finition laisse aux clés →
 *   correction des poids de la phase silhouettes, qui mesure les mêmes états sous les clips posés au sol.
 *   `raboter_sous_correction` (`silhouettes.py`) conserve les masques par clé : chaque passe de `formes.raboter`
 *   multiplie par `RABOT`, sur les nœuds de leurs arêtes en défaut (`region_locale`, qui gagne un anneau quand la clé
 *   y stagne sous `STAGNATION_M`), les clés participantes aux états actuellement en défaut, au repos du domaine comme
 *   sous les clips aux facteurs neutres ; chaque clé garde sa forme partout ailleurs (#3104). Les défauts se mesurent
 *   sur le champ que `correction` rend de cette passe, qui répartit la part imposée par les anneaux au prorata du
 *   rabot cumulé de chaque nœud, et la passe suivante rabote ce champ corrigé. La vraie amplitude des silhouettes aux
 *   plis de flexion attend les formes correctives (#3294). Les autres champs restent figés mais sont remesurés et
 *   peuvent redevenir participants. `correction` impose les centres, épaisseurs et extrémités ; toutes les clés
 *   restent présentes jusqu’au verdict collectif, et une silhouette dont le plus grand déplacement ne dépasse pas
 *   `SOL_TOLERANCE_M` refuse la construction dès la finition (`refuser_les_inertes`), comme l'évaluateur
 *   (`silhouette-inerte`).
 * - La finition précède la pose des clés `gabarit_*` et tient déjà leur repos. Les états croisés sont remesurés après
 *   la cuisson de la phase gabarit, sous les mêmes poids que la dernière finition : un défaut y refuse la
 *   construction, avec capture, avant toute correction des poids qui ne peut corriger ce repos. La construction
 *   réunit finition des silhouettes, pose des clips au sol, cuisson en données et correction des poids dans la boucle
 *   unique de `point_fixe.atteindre_le_point_fixe`, bornée par `PASSES_MAX`.
 * - Après chaque cuisson et avant la correction des poids, `preparer_moteurs` mesure le repos de tous ces états sous
 *   les poids d'entrée, par `preparer_correction` et `extremes` ; `verifier_repos_cuit` refuse toute arête hors de
 *   `ETIREMENT_DES_CLES`, avant le transport des matrices de clips. Cette constante unique de `seuils.py`, également
 *   employée par la finition des silhouettes, est l'intersection de `ETIREMENT_AU_REPOS` et `ETIREMENT_EN_CLIP` ; la
 *   garde de l'évaluateur conserve ses propres bornes de repos.
 * - La correction des poids mesure aussi le repos à chaque proposition de poids et refuse une proposition qui laisse
 *   hors bornes une arête incidente à la région retouchée. Les nœuds des surfaces de pied sont contraints hors
 *   retouche et restent mesurés. L'arrêt exige des poids inchangés et des clés stables à la tolérance commune ; la
 *   borne sans point fixe refuse la construction.
 * - Sous `DIAGNOSTIC_POIDS_PREFIXE`, seul le refus sauvegarde son état : géométrie, poids d'entrée et de sortie,
 *   arêtes, jumeaux, contraintes, positions et références des états, piles de matrices, longueurs des clips et
 *   contexte. En phase gabarit, le champ JSON `h5` du NPZ porte l'entrée exacte `{ table, corps }` envoyée à
 *   `gabarit.mjs` pour la peau refusée (positions, arêtes, poids, squelette et binds, deltas de silhouettes), la
 *   correspondance `noeud` vers les sommets d'origine et le `resultat` avant cette expansion. Le rejeu transmet cette
 *   entrée au même pont de cuisson. Les clés `gabarit_*` sont posées sur les peaux par `exporter_gabarit` après
 *   convergence.
 */

/**
 * @contrat Gabarit d'une base
 * La porte de construction relit le GLB exporté et compare ses positions à H5 direct sur chaque état de la liste
 * commune `etatsDuGabarit`, coins compris. Un écart de position supérieur à `1e-5 m` refuse la construction dans
 * chacun de ces états. Le pont émet par état le drapeau `pointCuisson`, les `poidsSilhouettes` et les `poidsGabarit`
 * séparés, et le nombre `sensCuits` pour le corps ; Python lit ces données. La porte exige autant de points de
 * cuisson que de sens cuits. Pour les normales, les points de cuisson sont chaque clé `gabarit_<k>_<sens>` seule à
 * poids 1, sans silhouette : un écart supérieur à `1°` au p99 ou `2°` au maximum refuse la construction. Dans tous
 * les états dont `pointCuisson` vaut faux, y compris les coins de silhouettes croisés aux facteurs cuits, les milieux
 * et les combinaisons, les écarts de normales sont mesurés et imprimés sans seuil ; chaque ligne porte aussi les
 * mêmes mesures sur l'état privé de ses clés `gabarit_*`, avec les silhouettes seules aux mêmes poids, contre leur
 * propre référence. Les normales de morph doivent être présentes dans l'export. Voir la [décision du
 * 2026-10-31](https://github.com/MyEdO/game/issues/3104#issuecomment-6547804765).
 *
 * Les coins que l'exporteur fusionne sont mesurés chacun contre le sommet livré ; la porte prend le maximum par
 * sommet sur ses coins avant de calculer le p99 sur les sommets, et imprime les écarts entre références fusionnées
 * sans seuil distinct.
 */

/**
 * @contrat Gabarit d'une base
 * Les noms de silhouettes ont pour source `asset/silhouettes.ts`, publiés par `NOMS_DES_SILHOUETTES` et par
 * `gabarit.mjs` (`operation: silhouettes`) pour Python. La table `SILHOUETTES` de la construction lit cette réponse,
 * dans l’ordre `NOMS_DES_SILHOUETTES` : féminin, corpulence, carrure moins, carrure plus. Les `silhouettes` du
 * manifeste sont les noms de ce vocabulaire présents sur les peaux, publiés dans l'ordre de première rencontre.
 * `etatsDuGabarit` et `poidsDeSilhouettes` lisent cette même source ; `validerManifesteDeBase` refuse par
 * `silhouette-inconnue` tout nom hors de ce vocabulaire, même si le GLB porte cette shape key. Le schéma refuse toute
 * silhouette dont le nom commence par `PREFIXE_DES_CLES_DU_GABARIT` (`asset/manifesteDeBase.ts`), en nommant la
 * silhouette : les silhouettes et les clés de gabarit sont disjointes. `nomDeCleDuGabarit` emploie ce même préfixe,
 * dont le schéma est la source unique.
 */

/**
 * @contrat Gabarit d'une base
 * L'évaluateur résout une seule liste de silhouettes (`asset/evaluateur/evaluer.ts`, `nomsDesSilhouettes`) : celles
 * du manifeste valide, ou les formes du GLB de base dont le nom ne commence pas par `PREFIXE_DES_CLES_DU_GABARIT`
 * sans manifeste valide. Sans manifeste valide, chaque silhouette est mesurée seule à 1, y compris les formes nommées
 * carrure ; aucune table `st` n'est supposée et la mesure de carrure vaut `null`. `lireGlb.formes` conserve toutes
 * les clés, silhouettes et gabarit compris ; `gardeBudget` compte les triangles de chaque mesh, indépendamment de ses
 * formes.
 *
 * L'évaluateur calcule les poids finaux une fois avant la pose : les silhouettes déclarées à zéro, la carrure de
 * `facteurs.st` par `poidsDeCarrure` pour ses clés déclarées comme silhouettes, puis les poids explicites de
 * `entree.silhouettes`, qui priment en cas de même nom. Ces poids explicites appartiennent à `nomsDesSilhouettes` ;
 * sinon l'exception nommée `silhouette-absente` les refuse en nommant les silhouettes déclarées, même si la forme
 * existe dans le GLB. Une carrure demandée par `st` et absente des silhouettes déclarées est refusée par
 * `carrure-absente`. Une forme indépendante de cette liste garde son influence d'entrée et ne produit aucune clé
 * croisée. `poidsDesFormesDe(manifeste, facteurs)` (`asset/evaluateur/evaluer.ts`) fournit la dérivation qui complète
 * ensuite ces poids par `poidsDuGabarit(facteurs, manifeste.gabarit.bornes, silhouettes)`, et `poserFormes` pose cet
 * ensemble une seule fois, par nom sur chaque mesh de la base et des éléments montés qui porte la clé. Un mesh sans
 * cette clé n'en reçoit rien. Avec des facteurs non neutres, une clé nommée par `poidsDuGabarit` absente de la base,
 * même de poids nul, est refusée par l'exception nommée `gabarit-absent`.
 *
 * Cette même dérivation `poidsDesFormes` est transmise à `mesurerSilhouettes` et à
 * `sousLesFormes(scene, noms, mesurer, poidsDesFormes)` (`asset/evaluateur/gardes/silhouettes.ts`), dont `noms` vaut
 * ici les silhouettes déclarées. Chaque pose de mesure refuse tout poids demandé hors de `noms`, remet à zéro les
 * `noms` sans poids demandé, puis recalcule toutes les clés du gabarit depuis ces poids de mesure ; les formes
 * indépendantes conservent leur influence d'entrée. Les silhouettes sont donc mesurées sous le gabarit courant, clés
 * croisées comprises. La référence d'étirement pose toutes les silhouettes à zéro : les clés propres du gabarit
 * gardent leur poids et les croisées valent zéro. Les os et les binds compensés restent ceux du gabarit courant. À la
 * sortie, y compris si la mesure lève, toutes les influences sont restaurées à leur état d'entrée.
 */

const borne = (x: number): number => Math.min(1, Math.max(0, x));

export type CleDuGabarit = typeof CLES_DU_GABARIT[number];
export type SensDuGabarit = 'moins' | 'plus';

export const nomDeCleDuGabarit = (cle: CleDuGabarit, sens: SensDuGabarit, silhouette?: string): string =>
  `${PREFIXE_DES_CLES_DU_GABARIT}${cle}_${sens}${silhouette === undefined ? '' : `_${silhouette}`}`;

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export interface PoseDuGabarit {
  readonly racine: { readonly os: string; readonly echelle: number };
  readonly enfantsDe: Readonly<Record<string, number>>;
  readonly echellesDesOs: Readonly<Record<string, readonly [number, number, number]>>;
  readonly pieds: readonly string[];
  readonly jambes: readonly string[];
  readonly clipsPlantes: readonly string[];
  readonly echelleDeVitesse: number;
}

/** Ce que `poseDuGabarit` lit d'un manifeste de base ; la construction n'en a que la table. */
export type ManifesteDuGabarit = Required<Pick<ManifesteDeBase, 'gabarit'>> & Partial<Pick<ManifesteDeBase, 'appuis' | 'clips' | 'clipsDeuxMains'>>;

/** Les clips plantés de la base : le clip du rôle `marche`, à une main et à deux mains. */
export const clipsPlantes = ({ clips, clipsDeuxMains }: Partial<Pick<ManifesteDeBase, 'clips' | 'clipsDeuxMains'>>): string[] =>
  [...new Set([clips?.marche, ...Object.values(clipsDeuxMains ?? {}).map((table) => table.marche)].filter((clip): clip is string => clip !== undefined))];

/**
 * @contrat Gabarit d'une base
 * Godot ne calcule aucun facteur : il reçoit des nombres par nom d'os et par nom de shape key, calculés une fois en TS
 * (`asset/gabarit.ts`) sur les facteurs de `gabaritResolu` (`GabaritResolu`, surface du noyau). L'évaluateur les
 * applique à la pose de repos de la base (`appliquerGabarit`, `asset/evaluateur/gabarit.ts`) ; Godot les applique à la
 * pose de chaque image, après le clip, par un `SkeletonModifier3D` enfant du squelette
 * (`projet/scripts/gabarit_du_squelette.gd`, `GabaritDuSquelette`), ce qui revient au même au repos et garde les
 * proportions pendant un clip, dont les pistes réécrivent la pose : le moteur joue un modificateur après
 * l'`AnimationMixer` et restaure la pose non modifiée après le skinning (`Skeleton3D`, `NOTIFICATION_UPDATE_SKELETON`),
 * sans cumul d'une image à l'autre. L'os `racine.os` voit son échelle de pose multipliée par `echelle`, chaque os
 * enfant la composante Y de sa position de pose, et, sur un clip planté, les jambes se plient (`poserLeGabarit`) :
 *
 * - `poseDuGabarit(manifeste, facteurs)` → `{ racine: { os, echelle }, enfantsDe: Record<os, facteur>, echellesDesOs:
 *   Record<os, [x, y, z]>, pieds: os[], echelleDeVitesse: number, jambes: os[], clipsPlantes: string[] }`. L'os
 *   `racine.os` reçoit l'échelle uniforme `sl`. Chaque enfant os direct d'un os de `enfantsDe` reçoit sa position
 *   locale animée avec Y multiplié par le facteur de son parent ; X, Z, rotations et échelles des enfants sont
 *   conservés. La construction peut fournir uniquement la table `gabarit`. `pieds` relaie `appuis.pieds` pour les
 *   consommateurs d'appui et l'hôte. `echelleDeVitesse` vaut `sl` : la vitesse au sol du clip du rôle `marche`,
 *   `appuis.vitesseAuSol`, au gabarit, en est multipliée, pour la garde `appuis` de l'évaluateur (`evaluer.ts`) comme
 *   pour la marche de l'atelier (`MarcheDeLAtelier`). `jambes` relaie `gabarit.legs` ; `clipsPlantes`
 *   (`clipsPlantes(manifeste)`) liste, chacun une fois, le clip du rôle `marche` de `clips` et de chaque maniement de
 *   `clipsDeuxMains` : les marches que la construction plante (#3314).
 *
 * Le manifeste de base, schéma `VERSION_DU_SCHEMA_DE_BASE`, porte `appuis.plusBas`, une liste non vide de copies de
 * géométrie : chaque candidat contient `position`, triplet en espace de bind, `os`, une à quatre influences `{ nom,
 * poids }` positives de somme 1, et `deltas`, les deltas non nuls des silhouettes et des clés `gabarit_*` par nom ; un
 * nom absent vaut le triplet nul, et la construction omet tout triplet exactement nul. Ces copies ne dépendent d'aucun
 * indice de sommet livré. La construction les sélectionne avant l'export sur le corps entier par `selectionner_appuis`
 * (`scripts/personnage-3d/base/selection_appuis.py`), qui les copie en repère glTF par `copies_d_appui`. Les matrices
 * de peau proviennent du transport binaire de `groupes_de_peau`, groupées par facteurs ; `matricesDePeauDuGabarit`
 * applique `poserLeGabarit` et `bindsAuGabarit` aux poses de tous les clips, jambes pliées sur les instants des clips
 * plantés (drapeau par échantillon, repos compris, dont le nombre doit égaler celui des poses). Le skinning vectoriel
 * unique de `poids.py` fournit les positions, chaque mélange de matrices servant tous les états de son groupe.
 * L'évaluateur conserve three pour les mesures. La grille nommée `grilleDesAppuis` vaut G = (∏ k∈{legs,arms,head}
 * ({FACTEURS_NEUTRES[k]} ∪ {c.extremite | c∈sensCuitsDuGabarit(bornes), c.cle=k})) ×
 * `coinsDeSilhouettesAtteignables(manifeste.gabarit, manifeste.silhouettes)` ; la règle « jamais les deux carrures »
 * vient de `poidsDeCarrure` par cet énumérateur commun, et `bornes` est `manifeste.gabarit.bornes`. Aucun milieu n'est
 * ajouté : cette grille couvre les extrémités de chaque domaine cuit et le neutre ; les instants sont l'union de la
 * cadence commune et des clés de chaque clip (`instants`). Chaque état inclut aussi le repos. La sélection conserve
 * chaque sommet qui réalise le minimum vertical à l'un de ces instants ; elle utilise les mêmes facteurs et binds sans
 * translation R2, qui ne change pas l'identité du minimum. Les fichiers binaires de travail vivent dans un dossier
 * temporaire privé, nettoyé en fin de sélection, y compris sur échec.
 *
 * La table est disjointe entre `legs`, `arms` et `head` : le schéma refuse un os sous deux clés, en nommant l'os et
 * les deux clés. Le champ `racine` ne participe pas à cette disjonction. `echellesDesOs` donne, pour chaque os listé,
 * S_b = `(1, f, 1)` sous `legs` et `arms`, `(f, f, f)` sous `head`. Les hôtes disposent ainsi des multiplicateurs du
 * décalage local d'un emplacement ou d'une prise sur cet os ; ce champ ne modifie pas l'échelle du squelette.
 */
export function poseDuGabarit({ gabarit, appuis, ...clips }: ManifesteDuGabarit, facteurs: GabaritResolu): PoseDuGabarit {
  const enfantsDe: Record<string, number> = {};
  const echellesDesOs: Record<string, readonly [number, number, number]> = {};
  for (const cle of CLES_DU_GABARIT) {
    for (const nom of gabarit[cle]) {
      const facteur = facteurs[cle];
      enfantsDe[nom] = facteur;
      echellesDesOs[nom] = cle === 'head' ? [facteur, facteur, facteur] : [1, facteur, 1];
    }
  }
  return { racine: { os: gabarit.racine, echelle: facteurs.sl }, enfantsDe, echellesDesOs, pieds: appuis?.pieds ?? [], jambes: gabarit.legs, clipsPlantes: clipsPlantes(clips), echelleDeVitesse: facteurs.sl };
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function sensCuitsDuGabarit(bornes: BornesDuGabarit): readonly { readonly cle: CleDuGabarit; readonly sens: SensDuGabarit; readonly extremite: number }[] {
  return CLES_DU_GABARIT.flatMap((cle) => {
    const faute = fauteDeBornesDuGabarit(bornes[cle], FACTEURS_NEUTRES[cle]);
    if (faute) throw new Error(`gabarit.${cle} : ${faute}`);
    return (['moins', 'plus'] as const).flatMap((sens) => {
      const extremite = bornes[cle][sens === 'moins' ? 'min' : 'max'];
      return extremite === FACTEURS_NEUTRES[cle] ? [] : [{ cle, sens, extremite }];
    });
  });
}

/**
 * @contrat Gabarit d'une base
 * - `poidsDuGabarit(facteurs, bornes, silhouettes)` → `Record<shapeKey, poids>`. `manifeste.gabarit.bornes`
 *   (`BornesDuGabarit`) porte par `legs`, `arms`, `head` les `{ min, max }` cuits avant l’export par
 *   `scripts/personnage-3d/base/humanoide.py` via le pont `gabarit.mjs`, puis transmis à `manifeste.mjs`, avec
 *   `0 < min <= FACTEURS_NEUTRES[k] <= max` pour chaque clé `k` (`fauteDeBornesDuGabarit`), nombres finis. Le schéma
 *   et la fonction refusent les bornes invalides. Le producteur `scripts/personnage-3d/base/domaineDuGabarit.ts`
 *   compose les gabarits × races, avec le choix sans gabarit explicite qui reçoit la surcharge de race. La
 *   composition 3D et le domaine appellent la même fonction `facteursDeComposition`
 *   (`src/noyau/apparence/composition.ts`), l'unique appel de la composition 3D à `gabaritResolu` avec `legsMult: 1`.
 *   L'enveloppe ne porte que ce domaine reçu par la 3D. La morphologie de jambes des éléments relève de #3186, «
 *   Morpho de jambes des éléments : une composition, un domaine fini, reçue par la 3D ». Les hôtes lisent uniquement
 *   les bornes cuites, sans relire ces catalogues. `sensCuitsDuGabarit(bornes)` rend les `{ cle, sens, extremite }`
 *   depuis ces bornes pour la pondération, la cuisson et ses états de contrôle. Un sens dont la borne vaut le neutre
 *   `FACTEURS_NEUTRES[k]` n'a aucune clé, y compris croisée : `cuire` le refuse et `poidsDuGabarit` n'en rend pas le
 *   nom. Un facteur placé de ce côté est refusé par une exception qui nomme la clé, le facteur et ses bornes. `cuire`
 *   lit les bornes de la table du corps, sans autre entrée de bornes. `nomDeCleDuGabarit(k, sens, silhouette?)` est
 *   l'unique construction des noms : `gabarit_<k>_<sens>` et `gabarit_<k>_<sens>_<silhouette>`, `sens` valant `moins`
 *   ou `plus`. Avec `n_k = FACTEURS_NEUTRES[k]`, pour le sens de `f_k − n_k`, le poids vaut
 *   `max(0, (f_k − n_k)/(f_sens − n_k))`, avec `f_moins = min` et `f_plus = max` ; l'autre sens vaut 0. Au neutre les
 *   deux valent 0. Le poids n'est pas plafonné à 1. Chaque clé croisée vaut ce poids multiplié par celui de la
 *   silhouette reçue, sortie de `poidsDeSilhouettes`, sans recalcul. Les poids rendus incluent les zéros des seuls
 *   sens cuits. Les hôtes disposent de ces poids par nom pour la pose des shape keys.
 */
export function poidsDuGabarit(facteurs: GabaritResolu, bornes: BornesDuGabarit, silhouettes: Readonly<Record<string, number>>): Record<string, number> {
  const poids: Record<string, number> = {};
  const sensCuits = sensCuitsDuGabarit(bornes);
  for (const cle of CLES_DU_GABARIT) {
    const { min, max } = bornes[cle];
    const facteur = facteurs[cle];
    const sens = facteur < FACTEURS_NEUTRES[cle] ? 'moins' : facteur > FACTEURS_NEUTRES[cle] ? 'plus' : null;
    if (sens && !sensCuits.some((cuit) => cuit.cle === cle && cuit.sens === sens)) throw new Error(`gabarit.${cle} : facteur ${facteur} refusé pour les bornes [${min}, ${max}]`);
  }
  for (const { cle, sens, extremite } of sensCuits) {
    const p = Math.max(0, (facteurs[cle] - FACTEURS_NEUTRES[cle]) / (extremite - FACTEURS_NEUTRES[cle]));
    poids[nomDeCleDuGabarit(cle, sens)] = p;
    for (const [silhouette, w] of Object.entries(silhouettes)) poids[nomDeCleDuGabarit(cle, sens, silhouette)] = w * p;
  }
  return poids;
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export const poidsDeCarrure = (st: number, bornes: TableDeGabarit['st']): Record<typeof CARRURE_MOINS | typeof CARRURE_PLUS, number> => ({
  [CARRURE_MOINS]: st < FACTEURS_NEUTRES.st ? borne((FACTEURS_NEUTRES.st - st) / (FACTEURS_NEUTRES.st - bornes.min)) : 0,
  [CARRURE_PLUS]: st > FACTEURS_NEUTRES.st ? borne((st - FACTEURS_NEUTRES.st) / (bornes.max - FACTEURS_NEUTRES.st)) : 0,
});

/**
 * @contrat Gabarit d'une base
 * - `poidsDeSilhouettes({ sex, build, st }, table)` → `Record<shapeKey, poids>` : `carrure_moins` et `carrure_plus`
 *   par `poidsDeCarrure`, `feminin` à 1 pour `F` et 0 sinon, `corpulence` par `build`. Chaque poids se pose par nom
 *   sur chaque mesh de la base ET de chaque élément monté qui porte une shape key de ce nom ; un mesh sans cette clé
 *   n'en reçoit rien. Le corps neutre de la base est `build` `BUILD_NEUTRE` (`src/lib/corpulence.ts`), et
 *   `corpulence`, qui n'épaissit que dans un sens, vaut 0 de `build` 0 à `BUILD_NEUTRE` puis croît linéairement
 *   jusqu'à 1 à `build` 1.
 */
export const poidsDeSilhouettes = ({ sex, build, st }: { sex: Sexe; build: number; st: number }, table: TableDeGabarit): Record<string, number> => {
  const carrure = poidsDeCarrure(st, table.st);
  const corpulence = borne((build - BUILD_NEUTRE) / (1 - BUILD_NEUTRE));
  const plusSeule = sex === 'M' && carrure[CARRURE_PLUS] > corpulence;
  return tableTotale(NOMS_DES_SILHOUETTES, (nom) => nom === FEMININ ? (sex === 'F' ? 1 : 0)
    : nom === CORPULENCE ? (plusSeule ? 0 : corpulence) : nom === CARRURE_PLUS ? (plusSeule ? carrure[nom] : 0) : carrure[nom]);
};

export interface CelluleDeSilhouettes {
  readonly nom: string;
  readonly origine: Readonly<Record<string, number>>;
  readonly colonnes: readonly [Readonly<Record<string, number>>, Readonly<Record<string, number>>];
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function cellulesDeSilhouettesAtteignables(table: TableDeGabarit, silhouettes: readonly string[]): CelluleDeSilhouettes[] {
  for (const nom of silhouettes) {
    if (!estSilhouette(nom)) throw new Error(`silhouette-inconnue : ${nom}`);
  }
  if (!silhouettes.length) return [];
  const poids = (sex: Sexe, build: number, st: number) => {
    const valeurs = poidsDeSilhouettes({ sex, build, st }, table);
    return tableTotale(silhouettes, (nom) => valeurs[nom]);
  };
  return SEXES.flatMap((sex) => [table.st.min, table.st.max].map((st, branche) => {
    const origine = poids(sex, BUILD_NEUTRE, FACTEURS_NEUTRES.st);
    const [corpulence, carrure] = [poids(sex, 1, FACTEURS_NEUTRES.st), poids(sex, BUILD_NEUTRE, st)]
      .map((bout) => tableTotale(silhouettes, (nom) => bout[nom] - origine[nom]));
    const coin = poids(sex, 1, st);
    const cumul = silhouettes.every((nom) => coin[nom] === origine[nom] + corpulence[nom] + carrure[nom]);
    return { nom: `${sex}_${branche}`, origine,
      colonnes: [cumul ? corpulence : tableTotale(silhouettes, () => 0), carrure] as [Record<string, number>, Record<string, number>] };
  }));
}

/** `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». */
export function coinsDeSilhouettesAtteignables(table: TableDeGabarit, silhouettes: readonly string[]): Record<string, number>[] {
  if (!silhouettes.length) return [{}];
  const coins = cellulesDeSilhouettesAtteignables(table, silhouettes).flatMap(({ origine, colonnes }) =>
    [0, 1].flatMap((u) => [0, 1].map((v) => tableTotale(silhouettes,
      (nom) => origine[nom] + u * colonnes[0][nom] + v * colonnes[1][nom]))));
  return coins.filter((coin, i) => !coins.slice(0, i).some((avant) =>
    silhouettes.every((nom) => avant[nom] === coin[nom])));
}

/**
 * @contrat Gabarit d'une base
 * - Garde `suiviDuCorps` de l'évaluateur (`asset/evaluateur/gardes/suiviDuCorps.ts`) : chaque mesh skinné d'élément
 *   se mesure clé `gabarit_*` par clé, au repos sans gabarit ; elle ne fixe aucune règle d'application aux hôtes.
 * - Garde `segments` de l'évaluateur (`asset/evaluateur/gardes/segments.ts`) : au repos, chaque os de `echellesDesOs`
 *   (`poseDuGabarit`) se mesure par l'étendue, sur chacun de ses axes locaux, des sommets du corps qu'il mène seul
 *   (poids d'au moins 1 − `POIDS_NEGLIGEABLE`), au gabarit de l'évaluation, rapportée à la même étendue sans gabarit,
 *   aux mêmes silhouettes et aux clés `gabarit_*` nulles. Chaque rapport vaut la composante de S_b de son axe, que
 *   l'os ait un os enfant ou non : un écart relatif au-delà de `TOLERANCE_ECHELLE` (`gardes/pistesDEchelle.ts`) est
 *   `segment-hors-echelle`, un axe sans étendue mesurable est `segment-indetectable`, chacun nommé `<os>.<axe>`.
 *   `godot:evaluer` imprime, par os, S_b et ses trois rapports, puis leur plus grand écart relatif (ligne
 *   `segments du gabarit`).
 */
