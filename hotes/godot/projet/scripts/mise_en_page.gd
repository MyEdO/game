## La mise en page de l'hôte : la case du plateau vers le monde, le centre du plateau, le quart de tour de la
## caméra, son zoom borné, son lacet à un azimut, les millisecondes du pont en secondes de minuteur, le pas d'image d'un clip et l'image
## voisine d'un instant, le diamètre d'une sphère, l'échelle qui porte une image à une largeur voulue, l'entrée et le
## pas de la marche de l'atelier, la durée d'un pas d'un chemin, l'orbite de sa caméra, son cadrage et son zoom, le gabarit d'une base posé sur ses os, ses pieds
## au sol, un vecteur rapporté à un repère, l'axe unité le plus proche d'un vecteur, le repère d'un objet rangé à un emplacement, son
## appui sur ce qui est porté et sa place à côté des autres objets du même point, le coin d'une bulle au-dessus
## d'un point, la largeur d'un texte de bulle replié, le point où se dit le nom de ce qui occupe une case, la pose
## d'une arête (mur ou porte) sur le côté de sa case et l'échelle d'une pièce du kit qui s'y pose, l'échelle métrique d'un modèle et d'une hauteur sur le plateau et
## la hauteur d'un point du corps à son gabarit, le point d'un lieu sur le plan et le coin de ce qui se pose sous lui, la
## coupe d'un navire, le compte des triangles d'une géométrie, le texel d'une case au masque du retrait et à celui de la
## vision, la part d'un fondu de la vision après un pas de temps, le relief d'un matériau à son facteur, et l'abscisse
## sur un rayon d'un point, d'un point au-delà de celui qu'il touche et du bout de chaque tronçon dont il reprend. Seul
## script où l'arithmétique et la mesure sont permises (`scripts/guards/lib/gdscriptSansRegle.mjs`) : des constantes et
## des fonctions statiques, chacune typée et sur au plus un vecteur, sans état.
class_name MiseEnPage
extends RefCounted

const MS_PAR_SECONDE := 1000.0
const DEMI_CASE := 0.5
## L'écart du calque de référence au sol de son plan, en unités du plateau.
const DECALAGE_DU_CALQUE := 0.01
## Le côté, en mètres, du motif d'une texture du sol posée sur le volume du monde.
const METRES_PAR_MOTIF := 2.0
const QUART_DE_TOUR := PI / 2.0
const PAS_DE_ZOOM := 1.15
## Les bornes du zoom de l'orbite de l'atelier, rapportées à l'échelle du cadre posé.
const ZOOM_MINIMAL := 0.3
const ZOOM_MAXIMAL := 3.0
const TOLERANCE_D_IMAGE := 0.001
## Le jeu, en mètres, entre les boîtes de deux objets rangés côte à côte au même point (`decalage_a_cote`).
const JEU_ENTRE_RANGES := 0.02
## Le jeu, en mètres, entre un objet rangé et ce qui est porté dessous (`recul_d_appui`, `pivot_sur_la_case`).
const JEU_DE_RANGEMENT := 0.005
## Le côté, en mètres, des cases où un objet rangé se confronte à ce qui est porté dessous (`case_de_contact`).
const CASE_DE_CONTACT := 0.02
## Le pas, en mètres, dont un rayon reprend au-delà d'un point touché (`point_au_dela`), et dont un tronçon recouvre la
## fin du précédent (`point_en_deca`).
const PAS_AU_DELA_M := 0.0005
## La longueur, en mètres, d'un tronçon dont un rayon reprend (`bout_du_troncon`) : le moteur physique du projet
## (GodotPhysics3D, `physics/3d/physics_engine` au défaut) manque toute face plus proche de l'origine du tronçon que
## `CMP_EPSILON` fois sa longueur (`core/math/geometry_3d.h:115`, `core/math/math_defs.h:50`, Godot 4.7).
const PORTEE_D_UN_TRONCON_M := 20.0
## La hauteur, en mètres, sous l'attache d'un objet rangé jusqu'où il s'appuie sur ce qui est porté ; plus bas, il pivote
## (`recul_sur_la_case`, `pivot_sur_la_case`).
const APPUI_DE_RANGEMENT := 0.05
## La cote, en mètres, sur la normale sortante d'un repère de rangement, d'où part et où finit la visée qui cherche ce qui
## est porté sous une case (`centre_de_contact`).
const PORTEE_DE_CONTACT := 1.0
## Sous cette composante avant, l'axe X d'un repère de rangement est latéral (`sens_vers_l_avant`).
const TOLERANCE_LATERALE := 0.1
## L'inclinaison depuis la verticale, en radians, d'un objet rangé en bandoulière (`biais_de_rangement`), son haut vers
## la droite du personnage.
const INCLINAISON_EN_BANDOULIERE := PI / 6.0
## La longueur sous laquelle la position d'un emplacement est sur l'axe de son os.
const TOLERANCE_DE_NORMALE := 0.001
const RADIANS_PAR_PIXEL := 0.005
## Le tangage de l'orbite, borné entre la vue plongeante et la vue rasante au-dessus du sol.
const TANGAGE_MINIMAL := -1.2
const TANGAGE_MAXIMAL := 0.2
## Le tangage de la caméra au regard `plateau`, à la verticale du plateau.
const TANGAGE_DU_PLATEAU := -PI / 2.0
## La plus longue image de marche (s) que compte l'immersion.
const DUREE_D_UNE_IMAGE_DE_MARCHE := 0.1
## Le tangage de l'œil au regard `immersion`, borné de part et d'autre de l'horizon, en deçà de la verticale.
const TANGAGE_DE_L_OEIL := 1.4
## Le lacet d'une caméra qui regarde vers chaque cap (`Dir8`) du plateau : le nord vers -Z, l'ouest vers -X.
const LACETS_DES_CAPS := {N = 0.0, NO = PI / 4.0, O = PI / 2.0, SO = 3.0 * PI / 4.0, S = PI, SE = -3.0 * PI / 4.0, E = -PI / 2.0, NE = -PI / 4.0}
## Le lacet, dans le repère d'un véhicule dont la proue est le +Z, d'une pièce dont l'avant est son +Z montée à chaque bord
## (`FIRE_ARCS`, `src/engine/types.ts`) : tournée vers lui, tribord à droite de la proue, vers -X.
const LACETS_DES_BORDS := {proue = 0.0, tribord = -PI / 2.0, poupe = PI, babord = PI / 2.0}
## L'écart, en pixels, entre une bulle et le point de l'écran qu'elle désigne.
const ECART_DE_BULLE := 12.0
## La largeur, en pixels, au-delà de laquelle le texte d'une bulle se replie au mot (`Bulle`).
const LARGEUR_DE_BULLE := 420.0
## La hauteur, au-dessus du sol de sa case, du nom d'une entité de la scène.
const HAUTEUR_DU_NOM := 1.2
## Hauteur (m) d'où part un coup, au-dessus du sol de son auteur, et où il arrive sur sa cible.
const HAUTEUR_DU_COUP := 1.1
## La hauteur (m) au-dessus de son sol d'où part un flottant, et celle qu'il gagne en montant.
const HAUTEUR_DU_FLOTTANT := 2.1
const MONTEE_DU_FLOTTANT := 0.8
## La hauteur (m) de la première marque d'État au-dessus du sol de son porteur, l'écart (m) entre deux marques, et la
## hauteur (m) du visuel d'une marque (#3834).
const HAUTEUR_DES_MARQUES := 1.85
const ECART_DES_MARQUES := 0.3
const HAUTEUR_DU_VISUEL_DE_MARQUE := 0.9
## La marge, en pixels, entre le bord d'un plan et ses points.
const MARGE_DU_PLAN := 28.0
## Les pixels de la texture d'un dessin par pixel d'écran : l'écran étire l'interface (`window/stretch`).
const FINESSE_DE_DESSIN := 2.0
## L'écart, en pixels, entre un point du plan et ce qui se pose sous lui.
const ECART_SOUS_LE_POINT := 2.0
## Ce que la coupe d'un navire ôte (m) sous le plus bas des sols qu'un regard lui retire (`hauteur_de_coupe`) : le
## plancher de ce pont, les baux qui le portent et l'imprécision de la hauteur que porte chaque sommet
## (`opacite_de_coupe`).
const MARGE_DE_COUPE := 0.15


## Le cadrage d'un portrait (`Portrait`) : la part de la hauteur de la tête montrée sous son haut, la marge au-dessus
## d'elle en part du cadre, et l'angle de vue vertical de sa caméra, en degrés.
const BUSTE_DU_PORTRAIT := 0.2
const MARGE_DU_PORTRAIT := 0.08
const ANGLE_DU_PORTRAIT := 20.0


## La caméra d'un portrait qui cadre en buste un corps au haut de tête à `tete` (`Combattant.hauteur_de_la_tete`), de
## face : sa hauteur (`x`) et sa distance au corps (`y`), le haut de la tête sous la marge, `BUSTE_DU_PORTRAIT` de sa
## hauteur sous lui au bas du cadre.
static func cadrage_en_buste(tete: float) -> Vector2:
	var cadre := tete * BUSTE_DU_PORTRAIT / (1.0 - MARGE_DU_PORTRAIT)
	return Vector2(tete + cadre * MARGE_DU_PORTRAIT - cadre / 2.0, cadre / 2.0 / tan(deg_to_rad(ANGLE_DU_PORTRAIT) / 2.0))


## La largeur du texte d'une bulle qui, sur une ligne, en prendrait `largeur` : la sienne, au pixel supérieur, au plus
## `LARGEUR_DE_BULLE`.
static func largeur_de_bulle(largeur: float) -> float:
	return minf(LARGEUR_DE_BULLE, ceilf(largeur))


## Le diamètre d'une sphère de rayon `rayon` (`SphereMesh.height`).
static func diametre(rayon: float) -> float:
	return 2.0 * rayon


## Le point, au-dessus du centre de la case `case` dont le sol est à `sol`, où se dit le nom de ce qui l'occupe.
static func au_dessus_de_la_case(case: Vector2i, sol: float) -> Vector3:
	return Vector3(case.x + DEMI_CASE, sol + HAUTEUR_DU_NOM, case.y + DEMI_CASE)


## Le centre d'une arête de `hauteur` (unités du plateau) debout à son pied `pied` (mètres, `areteDessinee`) sur un
## plateau de `metres_par_case` mètres par case, dont le milieu est `milieu`, en coins de grille.
static func centre_d_arete(milieu: Vector2, pied: float, metres_par_case: float, hauteur: float) -> Vector3:
	return Vector3(milieu.x + DEMI_CASE, hauteur_au_plateau(pied, metres_par_case) + hauteur / 2.0, milieu.y + DEMI_CASE)


## Le cran de caméra (`Rot` de `src/geometry/iso.ts`, 0 à 3) d'une caméra dont l'arrière (`global_basis.z`) est
## `arriere` : 0 au sud-est du plateau, puis un cran par quart de tour vers le sud-ouest, le nord-ouest et le nord-est.
static func rotation_iso(arriere: Vector3) -> float:
	return fposmod(roundf((atan2(arriere.z, arriere.x) - QUART_DE_TOUR / 2.0) / QUART_DE_TOUR), 4.0)


## Le lacet d'une arête qui court selon `sens` sur le plateau.
static func lacet_d_arete(sens: Vector2) -> float:
	return atan2(-sens.y, sens.x)


## La longueur, en cases, d'une arête qui court selon `sens`.
static func longueur_d_arete(sens: Vector2) -> float:
	return sens.length()


## L'échelle d'une pièce du kit des arêtes (longue de 1, haute de 1, épaisse en mètres : `hotes/godot/asset/kit.ts`)
## posée sur une arête qui court selon `sens`, haute de `hauteur` mètres, sur un plateau de `metres_par_case`.
static func echelle_de_piece(sens: Vector2, hauteur: float, metres_par_case: float) -> Vector3:
	return Vector3(longueur_d_arete(sens), hauteur_au_plateau(hauteur, metres_par_case), echelle_metrique(metres_par_case))


## L'échelle qui porte un modèle mesuré en mètres sur un plateau de `metres_par_case` mètres par case.
static func echelle_metrique(metres_par_case: float) -> float:
	return 1.0 / metres_par_case


## L'échelle qui porte un modèle dont la boîte mesure `taille` sur une empreinte de `empreinte` cases de côté : sa plus
## grande dimension horizontale y vaut l'empreinte (#2987).
static func echelle_d_empreinte(taille: Vector3, empreinte: int) -> float:
	return empreinte / maxf(taille.x, taille.z)


## L'origine qui, sous l'échelle `echelle`, centre sur une empreinte de `empreinte` cases depuis la case de son parent,
## son coin nord-ouest, une boîte de centre `centre` dans ce parent, l'origine gardée au sol (#2987).
static func origine_sur_l_empreinte(centre: Vector3, echelle: float, empreinte: int) -> Vector3:
	var milieu := milieu_de_l_empreinte(empreinte)
	return Vector3(milieu.x - centre.x * echelle, 0.0, milieu.z - centre.z * echelle)


## Le milieu au sol d'une empreinte de `empreinte` cases de côté, depuis la case de son parent, son coin nord-ouest (#2987).
static func milieu_de_l_empreinte(empreinte: int) -> Vector3:
	var milieu := (empreinte - 1) * DEMI_CASE
	return Vector3(milieu, 0.0, milieu)


## Le lacet qui tourne vers un cap un modèle dont l'avant est son +Z, depuis le `lacet` d'une caméra qui regarde vers ce
## cap (`LACETS_DES_CAPS`, l'avant d'une caméra étant son -Z).
static func lacet_de_proue(lacet: float) -> float:
	return lacet + PI


## Une hauteur de `hauteur` mètres sur le plateau d'une scène de `metres_par_case`.
static func hauteur_au_plateau(hauteur: float, metres_par_case: float) -> float:
	return hauteur * echelle_metrique(metres_par_case)


## L'échelle uniforme qui porte un nœud mesuré en mètres sur le plateau d'une scène de `metres_par_case`.
static func echelle_au_plateau(metres_par_case: float) -> Vector3:
	return Vector3.ONE * echelle_metrique(metres_par_case)


## L'échelle uniforme qui porte en mètres le plateau d'une scène de `metres_par_case`, celle qui défait
## `echelle_au_plateau`.
static func echelle_en_metres(metres_par_case: float) -> Vector3:
	return Vector3.ONE * metres_par_case


## Le point d'où part un coup du combattant dont le sol est en `sol`, et où arrive celui qui le vise : `HAUTEUR_DU_COUP`
## au-dessus, sur le plateau d'une scène de `metres_par_case`.
static func point_du_coup(sol: Vector3, metres_par_case: float) -> Vector3:
	return sol + Vector3.UP * hauteur_au_plateau(HAUTEUR_DU_COUP, metres_par_case)


## Le point d'où part le flottant du combattant ou de la case dont le sol est en `sol`, `HAUTEUR_DU_FLOTTANT`
## au-dessus, sur le plateau d'une scène de `metres_par_case`.
static func point_du_flottant(sol: Vector3, metres_par_case: float) -> Vector3:
	return sol + Vector3.UP * hauteur_au_plateau(HAUTEUR_DU_FLOTTANT, metres_par_case)


## Le point de la marque d'État de rang `rang` au-dessus du sol de son porteur, la première à `HAUTEUR_DES_MARQUES`,
## les suivantes `ECART_DES_MARQUES` plus haut chacune, sur le plateau d'une scène de `metres_par_case`.
static func point_de_la_marque(rang: int, metres_par_case: float) -> Vector3:
	return Vector3.UP * hauteur_au_plateau(HAUTEUR_DES_MARQUES + rang * ECART_DES_MARQUES, metres_par_case)


## Le point du visuel d'une marque d'État, `HAUTEUR_DU_VISUEL_DE_MARQUE` au-dessus du sol de son porteur.
static func point_du_visuel_de_marque(metres_par_case: float) -> Vector3:
	return Vector3.UP * hauteur_au_plateau(HAUTEUR_DU_VISUEL_DE_MARQUE, metres_par_case)


## Le point où s'éteint le flottant parti de `point`, `MONTEE_DU_FLOTTANT` plus haut.
static func montee_du_flottant(point: Vector3, metres_par_case: float) -> Vector3:
	return point + Vector3.UP * hauteur_au_plateau(MONTEE_DU_FLOTTANT, metres_par_case)


## Le temps (s) de la montée d'un projectile en vol `duree` secondes, au sommet de sa cloche à mi-vol.
static func mi_vol(duree: float) -> float:
	return duree / 2.0


## La hauteur, sur le plateau d'une scène de `metres_par_case`, où se coupe le modèle d'un navire dont un regard retire
## les ponts dès le sol `sol` (m) : `MARGE_DE_COUPE` sous lui.
static func hauteur_de_coupe(sol: float, metres_par_case: float) -> float:
	return hauteur_au_plateau(sol - MARGE_DE_COUPE, metres_par_case)


## L'opacité d'un sommet à la hauteur `hauteur` d'un modèle qui s'étend de `bas` à `haut` : 1 en bas, 0 en haut,
## linéaire, si bien qu'un fragment est au-dessus de la hauteur `h` quand son opacité est sous celle de `h`.
static func opacite_de_coupe(hauteur: float, bas: float, haut: float) -> float:
	return (haut - hauteur) / (haut - bas)


## Le nombre de triangles que portent `sommets` sommets, trois par triangle.
static func triangles(sommets: int) -> float:
	return sommets / 3.0


## Le compte de `triangles` triangles, plus ceux que portent `sommets` sommets (`triangles`).
static func triangles_de_plus(triangles: int, sommets: int) -> float:
	return triangles + sommets / 3.0


## Le texel, dans le masque du retrait (`RetraitDuMonde`), de la case `case` du plan de première rangée `rangee`.
static func texel_du_masque(case: Vector2i, rangee: int) -> Vector2i:
	return Vector2i(case.x, case.y + rangee)


## Le texel, dans le masque de la vision (`VisionDuMonde`, un plan de `rangees_par_plan` rangées par couche), de la case
## `case` de la couche d'indice `couche`.
static func texel_de_vision(case: Vector2i, couche: int, rangees_par_plan: int) -> Vector2i:
	return Vector2i(case.x, case.y + couche * rangees_par_plan)


## La part, de 0 à 1, d'un fondu de `duree` secondes parvenu à la part `part`, `secondes` secondes plus tard.
static func part_du_fondu(part: float, secondes: float, duree: float) -> float:
	return minf(1.0, part + secondes / duree)


## L'abscisse du point `point` sur le rayon de sens `-rayon.z` (unitaire), comptée depuis l'abscisse `depuis`.
static func abscisse(point: Vector3, rayon: Basis, depuis: float) -> float:
	return -rayon.z.dot(point) - depuis


## Le point d'où un rayon de sens `-rayon.z` reprend au-delà du point `touche` qu'il touche, de `PAS_AU_DELA_M` sur un
## plateau de `metres_par_case` mètres par case.
static func point_au_dela(touche: Vector3, rayon: Basis, metres_par_case: float) -> Vector3:
	return touche - rayon.z * PAS_AU_DELA_M * echelle_metrique(metres_par_case)


## Le point d'où reprend le tronçon qui suit celui qui finit en `bout`, sur un rayon de sens `-rayon.z` : en deçà de
## `PAS_AU_DELA_M`, sur un plateau de `metres_par_case` mètres par case.
static func point_en_deca(bout: Vector3, rayon: Basis, metres_par_case: float) -> Vector3:
	return bout + rayon.z * PAS_AU_DELA_M * echelle_metrique(metres_par_case)


## L'abscisse, comptée depuis `depuis`, du bout du tronçon qui part de `debut` sur un rayon de sens `-rayon.z`
## d'abscisse finale `fin` : `PORTEE_D_UN_TRONCON_M` plus loin sur un plateau de `metres_par_case` mètres par case,
## `fin` au plus.
static func bout_du_troncon(debut: Vector3, rayon: Basis, depuis: float, fin: float, metres_par_case: float) -> float:
	return minf(abscisse(debut, rayon, depuis) + PORTEE_D_UN_TRONCON_M * echelle_metrique(metres_par_case), fin)


## Le point d'abscisse `abscisse_du_point`, comptée depuis `depuis`, sur le rayon de sens `-rayon.z` qui passe par
## `debut`.
static func point_a_l_abscisse(debut: Vector3, rayon: Basis, depuis: float, abscisse_du_point: float) -> Vector3:
	return debut - rayon.z * (abscisse_du_point - abscisse(debut, rayon, depuis))


## La hauteur du calque de référence posé sur le plan `plan` (mètres), décalé de `decalage` : juste au-dessus du sol
## qu'il recouvre, ou juste dessous.
static func hauteur_du_calque(plan: float, metres_par_case: float, decalage: float) -> float:
	return hauteur_au_plateau(plan, metres_par_case) + decalage


## La hauteur `hauteur` d'un point du corps neutre portée au gabarit dont le sommet des os est à `sommet`, celui du corps
## neutre à `sommet_neutre`.
static func hauteur_au_gabarit(hauteur: float, sommet: float, sommet_neutre: float) -> float:
	return hauteur * echelle_de_cadrage(sommet, sommet_neutre)


## Le centre de la case `case` sur son sol, à `sol` au-dessus du plan du plateau.
static func centre_de_case(case: Vector2i, sol: float) -> Vector3:
	return Vector3(case.x + DEMI_CASE, sol, case.y + DEMI_CASE)


## Le point du plateau au-dessus du point (`x`, `y`) de la carte, en cases continues (une case centrée sur l'entier), à
## `hauteur`.
static func point_de_la_carte(x: float, y: float, hauteur: float) -> Vector3:
	return Vector3(x + DEMI_CASE, hauteur, y + DEMI_CASE)


## Le sens où éclaire une lumière directionnelle qui vient de `direction` (vers la source).
static func sens_d_eclairage(direction: Vector3) -> Vector3:
	return -direction


## La profondeur, depuis la caméra, de ce qui est à `cases` au-delà du point qu'elle vise à `distance`.
static func profondeur_de_brume(distance: float, cases: float) -> float:
	return distance + cases


## L'énergie `energie` d'une flamme qui vacille de la part `amplitude` à `hz` hertz, à l'instant `secondes`.
static func energie_vacillante(energie: float, amplitude: float, hz: float, secondes: float) -> float:
	return energie * (1.0 + amplitude * sin(TAU * hz * secondes))


## Le centre du sol d'un plateau de `taille` cases.
static func centre_du_plateau(taille: Vector2i) -> Vector3:
	return Vector3(taille.x / 2.0, 0.0, taille.y / 2.0)


## Le point de la carte, en cases continues (une case centrée sur l'entier), sous le lieu `lieu` du plateau : celui que
## l'éditeur de carte désigne (`PointDeCarte.f`, `src/noyau/edition/pointeur.ts`).
static func point_de_carte_du_lieu(lieu: Vector3) -> Vector2:
	return Vector2(lieu.x - DEMI_CASE, lieu.z - DEMI_CASE)


## Le lacet de la caméra au regard `plateau` sous le lacet `lacet` du regard `tactique`, en biais d'un demi-quart de tour :
## les bords du plateau droits à l'écran.
static func lacet_du_plateau(lacet: float) -> float:
	return lacet - QUART_DE_TOUR / 2.0


## Le lacet du regard `tactique` sous lequel la caméra du regard `plateau` prend le lacet `lacet` (`lacet_du_plateau`).
static func lacet_sous_le_plateau(lacet: float) -> float:
	return lacet + QUART_DE_TOUR / 2.0


## Le lacet d'une caméra qui regarde à l'azimut `azimut`, en degrés au compas : 0 au nord, 90 à l'est
## (`LACETS_DES_CAPS`).
static func lacet_de_l_azimut(azimut: float) -> float:
	return -deg_to_rad(azimut)


## L'azimut, en degrés au compas dans [0, 360[, d'une caméra au lacet `lacet` (`lacet_de_l_azimut`).
static func azimut_du_lacet(lacet: float) -> float:
	return fposmod(-rad_to_deg(lacet), 360.0)


## L'œil à `oeil` mètres au-dessus du sol `sol`, sur un plateau de `metres_par_case` mètres par case.
static func oeil_sur(sol: Vector3, oeil: float, metres_par_case: float) -> Vector3:
	return Vector3(sol.x, sol.y + hauteur_au_plateau(oeil, metres_par_case), sol.z)


## Les mètres d'une image de marche de `duree` secondes à `vitesse` m/s, l'image bornée à `DUREE_D_UNE_IMAGE_DE_MARCHE` :
## une image lente ne fait jamais sauter une case.
static func metres_de_marche(vitesse: float, duree: float) -> float:
	return vitesse * minf(duree, DUREE_D_UNE_IMAGE_DE_MARCHE)


## Le lieu `lieu` après `metres` mètres de marche, sur un plateau de `metres_par_case` mètres par case : vers l'entrée de
## force `gauche`, `droite`, `avant` et `arriere` par action, bornée à l'unité, tournée du lacet `lacet`.
static func lieu_apres_la_marche(lieu: Vector3, gauche: float, droite: float, avant: float, arriere: float, lacet: float, metres: float, metres_par_case: float) -> Vector3:
	var direction := Vector3(droite - gauche, 0.0, arriere - avant).limit_length(1.0).rotated(Vector3.UP, lacet)
	return lieu + direction * hauteur_au_plateau(metres, metres_par_case)


## Le lacet de la caméra tourné d'un quart de tour dans le sens `sens` (1 ou -1).
static func lacet_tourne(lacet: float, sens: float) -> float:
	return lacet + sens * QUART_DE_TOUR


## La distance de la caméra d'un pas de zoom plus loin (`sens` 1) ou plus près (-1), bornée à [`minimum`, `maximum`].
static func distance_zoomee(distance: float, sens: float, minimum: float, maximum: float) -> float:
	return clampf(distance * pow(PAS_DE_ZOOM, sens), minimum, maximum)


## L'étendue (m) qu'une caméra en perspective d'angle vertical `angle` (degrés) montre sur la hauteur de sa fenêtre, au
## lieu qu'elle regarde à `distance` mètres.
static func etendue_en_perspective(distance: float, angle: float) -> float:
	return 2.0 * distance * tan(deg_to_rad(angle) / 2.0)


## Le décalage de l'objectif (horizontal, vertical, en mètres) d'une caméra qui montre `etendue` mètres sur la hauteur
## d'une fenêtre de `largeur` sur `hauteur` pixels : le lieu qu'elle regarde se pose au point `centre` de la fenêtre au
## lieu de son milieu.
static func decalage_de_l_objectif(centre: Vector2, largeur: float, hauteur: float, etendue: float) -> Vector2:
	return Vector2(largeur / 2.0 - centre.x, centre.y - hauteur / 2.0) * etendue / hauteur


## Un délai du pont (millisecondes) en secondes de minuteur.
static func secondes(ms: float) -> float:
	return ms / MS_PAR_SECONDE


## L'échelle qui porte une image de `largeur` pixels à `largeur_voulue` ; 1 pour une image vide.
static func echelle_d_image(largeur_voulue: float, largeur: int) -> float:
	return 1.0 if largeur == 0 else largeur_voulue / largeur


## L'échelle d'un dessin au cadre de `largeur_du_cadre` sur `hauteur_du_cadre` unités qui couvre `largeur` sur `hauteur`
## pixels d'écran, sa texture `FINESSE_DE_DESSIN` fois plus fine que l'écran.
static func echelle_de_dessin(largeur: float, hauteur: float, largeur_du_cadre: float, hauteur_du_cadre: float) -> float:
	return FINESSE_DE_DESSIN * maxf(largeur / largeur_du_cadre, hauteur / hauteur_du_cadre)


## Le pas d'image d'un clip de `duree` secondes, sa piste suivante de `cles` clés réparties sur le clip retenue si son pas
## est plus fin que `pas` (0 : aucune piste retenue encore).
static func pas_d_image(pas: float, duree: float, cles: int) -> float:
	if cles < 2:
		return pas
	var pas_de_la_piste := duree / (cles - 1)
	return pas_de_la_piste if pas == 0.0 or pas_de_la_piste < pas else pas


## L'instant de l'image de la grille de `pas` strictement voisine de `instant` dans le sens `sens` (1 ou -1), sur le clip
## bouclé de `duree` secondes : la suivante de la dernière image est la première, la précédente de la première est la
## dernière ; `instant` lui-même, borné à [0, `duree`], sans pas.
static func image_voisine(instant: float, pas: float, sens: float, duree: float) -> float:
	if pas == 0.0:
		return clampf(instant, 0.0, duree)
	var image := instant / pas
	var voisine := floorf(image + TOLERANCE_D_IMAGE) + 1.0 if sens > 0.0 else ceilf(image - TOLERANCE_D_IMAGE) - 1.0
	return fposmod(voisine * pas, duree)


## Le pas de la marche en `delta` secondes : la direction unitaire `direction` sur le sol, à `vitesse` m/s multipliée par
## `echelle`, celle de la vitesse au sol du gabarit posé (`echelleDeVitesse`, `CONTRAT.md`, « Gabarit d'une base »), à
## la cadence `cadence` du lecteur de clips (`AnimationPlayer.speed_scale`), qui règle le clip au même rythme.
static func pas_de_marche(direction: Vector3, vitesse: float, echelle: float, cadence: float, delta: float) -> Vector3:
	return direction * vitesse * echelle * cadence * delta


## La durée (s) d'un pas de `metres` mètres d'un chemin (#3822) à `vitesse` m/s multipliée par `echelle`, celle de la
## vitesse au sol du gabarit posé (`echelleDeVitesse`, `CONTRAT.md`, « Gabarit d'une base ») : la foulée du clip de marche.
static func duree_du_pas(metres: float, vitesse: float, echelle: float) -> float:
	return metres / (vitesse * echelle)


## Le lacet de l'orbite tourné par un glissé de `pixels` à la souris.
static func lacet_glisse(lacet: float, pixels: float) -> float:
	return lacet - pixels * RADIANS_PAR_PIXEL


## Le tangage tourné par un glissé de `pixels` à la souris, borné à [`minimum`, `maximum`].
static func tangage_glisse(tangage: float, pixels: float, minimum: float, maximum: float) -> float:
	return clampf(tangage - pixels * RADIANS_PAR_PIXEL, minimum, maximum)


## L'échelle de pose `echelle` de l'os `racine` du gabarit à l'échelle uniforme `facteur` (`CONTRAT.md`, « Gabarit d'une
## base »).
static func echelle_au_gabarit(echelle: Vector3, facteur: float) -> Vector3:
	return echelle * facteur


## La position de pose locale `position` d'un os enfant au gabarit `facteur` (`CONTRAT.md`, « Gabarit d'une base ») :
## sa composante Y multipliée, X et Z gardées.
static func position_au_gabarit(position: Vector3, facteur: float) -> Vector3:
	return Vector3(position.x, position.y * facteur, position.z)


## La position `position` de la caméra rapportée à l'échelle `echelle` de son orbite.
static func position_a_l_echelle(position: Vector3, echelle: float) -> Vector3:
	return position * echelle


## La translation de la racine du gabarit, de verticale monde `verticale` dans le repère de son parent, qui porte le pied
## le plus bas de la hauteur `pied` à la hauteur `cible` (`CONTRAT.md`, « Gabarit d'une base »).
static func decalage_au_sol(verticale: Vector3, cible: float, pied: float) -> Vector3:
	return verticale * (cible - pied)


## La longueur du vecteur `vecteur`.
static func longueur(vecteur: Vector3) -> float:
	return vecteur.length()


## L'extension d'une jambe : la distance `hanche_pied` de sa hanche à son pied rapportée à sa longueur, sa cuisse
## `cuisse` et son mollet `mollet` (`viseesDesJambes`, `CONTRAT.md`, « Gabarit d'une base »).
static func extension_de_jambe(hanche_pied: float, cuisse: float, mollet: float) -> float:
	return hanche_pied / (cuisse + mollet)


## La portée d'une jambe de cuisse `cuisse` et de mollet `mollet` à l'extension `extension` (`plierLesJambes`).
static func portee_de_jambe(extension: float, cuisse: float, mollet: float) -> float:
	return extension * (cuisse + mollet)


## La montée de la racine le long de la verticale monde rapportée au repère de base `repere` (le squelette) qui porte à
## `portee` la distance de la hanche d'une jambe à son pied visé, à `vers` d'elle, `INF` hors d'atteinte
## (`plierLesJambes`, `CONTRAT.md`, « Gabarit d'une base »).
static func montee_de_jambe(vers: Vector3, repere: Basis, portee: float) -> float:
	var haut := (repere.inverse() * Vector3.UP).normalized()
	var vertical := vers.dot(haut)
	var discriminant := vertical * vertical - vers.length_squared() + portee * portee
	return vertical + sqrt(discriminant) if discriminant >= 0 else INF


## Le déplacement de la racine de `montee` le long de la verticale monde rapportée au repère de base `repere`, nul pour
## une montée infinie (`plierLesJambes`).
static func deplacement_de_montee(repere: Basis, montee: float) -> Vector3:
	return (repere.inverse() * Vector3.UP).normalized() * montee if is_finite(montee) else Vector3.ZERO


## La visée `vers` d'un pied depuis sa hanche, d'une jambe à l'échelle de pose `echelle` et de repos `echelle_de_repos`,
## rapportée à la mesure de `TwoBoneIK3D` (`GabaritDuSquelette._poser_sur`).
static func visee_de_l_ik(vers: Vector3, echelle: float, echelle_de_repos: float) -> Vector3:
	return vers * echelle_de_repos / echelle


## La plus basse des hauteurs `hauteur` et `autre`.
static func plus_bas(hauteur: float, autre: float) -> float:
	return minf(hauteur, autre)


## La plus haute des hauteurs `hauteur` et `autre`.
static func plus_haut(hauteur: float, autre: float) -> float:
	return maxf(hauteur, autre)


## L'échelle monde d'un os d'échelle `echelle` dans un squelette d'échelle monde `echelle_du_squelette`.
static func echelle_composee(echelle_du_squelette: float, echelle: float) -> float:
	return echelle_du_squelette * echelle


## L'intensité `relief` de la carte de normales d'un matériau (`normal_scale`) portée au facteur `facteur` de sa surface
## (`reliefs` de la composition, #4002).
static func relief_au_facteur(relief: float, facteur: float) -> float:
	return relief * facteur


## L'échelle de l'orbite qui cadre un corps de sommet `sommet` comme elle cadre, à l'échelle 1, le corps neutre de sommet
## `sommet_neutre`.
static func echelle_de_cadrage(sommet: float, sommet_neutre: float) -> float:
	return sommet / sommet_neutre


## La hauteur que voit, au pivot, une caméra posée en `position` autour de lui sous l'angle vertical `fov` (degrés).
static func hauteur_vue_au_pivot(position: Vector3, fov: float) -> float:
	return 2.0 * position.length() * tan(deg_to_rad(fov) / 2.0)


## L'échelle de l'orbite où la diagonale d'une boîte de taille `taille` tient dans la hauteur `hauteur_vue` que la caméra
## voit au pivot à l'échelle 1 (`hauteur_vue_au_pivot`).
static func echelle_de_la_boite(taille: Vector3, hauteur_vue: float) -> float:
	return taille.length() / hauteur_vue


## L'échelle de l'orbite d'un pas de zoom plus loin (`sens` 1) ou plus près (-1), bornée de `ZOOM_MINIMAL` à
## `ZOOM_MAXIMAL` fois l'échelle `cadre` du cadre posé (`distance_zoomee`).
static func echelle_zoomee(echelle: float, sens: float, cadre: float) -> float:
	return distance_zoomee(echelle, sens, ZOOM_MINIMAL * cadre, ZOOM_MAXIMAL * cadre)


## L'entrée de la marche sur le sol, de force `gauche`, `droite`, `avant` et `arriere` par action.
static func entree_de_marche(gauche: float, droite: float, avant: float, arriere: float) -> Vector2:
	return Vector2(droite - gauche, arriere - avant)


## Le vecteur `vecteur` rapporté au repère de base `base` (`Basis.inverse`).
static func dans_la_base(base: Basis, vecteur: Vector3) -> Vector3:
	return base.inverse() * vecteur


## L'axe `axe` (`Vector3.AXIS_X`, `AXIS_Y` ou `AXIS_Z`) du repère de prise d'un objet rangé à l'emplacement de base
## `emplacement` et de position `point` dans son os (#3319, `CONTRAT.md`) : Z, vers les jointures, sur la normale
## sortante, la composante de `point` hors de l'axe de l'os, ou l'avant de l'emplacement sur cet axe ; Y, de
## l'auriculaire vers l'index, vers le bas de l'emplacement, ôté de sa part sur Z ; X, leur produit.
static func axe_de_rangement(emplacement: Basis, point: Vector3, axe: int) -> Vector3:
	var sortante := Vector3(point.x, 0.0, point.z)
	sortante = sortante.normalized() if sortante.length() > TOLERANCE_DE_NORMALE else emplacement.z.normalized()
	if axe == Vector3.AXIS_Z:
		return sortante
	var bas := -emplacement.y
	bas = (bas - sortante * bas.dot(sortante)).normalized()
	return bas if axe == Vector3.AXIS_Y else bas.cross(sortante)


## Le poids cumulé des repères d'un point suivi (`MontageDeComposition._suivre_les_poids`) de poids cumulé `cumul`, quand
## s'y ajoute un repère de poids `poids`.
static func cumul_des_poids(cumul: float, poids: float) -> float:
	return cumul + poids


## La part, dans le mélange des repères d'un point suivi, de poids cumulé `cumul` (`cumul_des_poids`), du dernier ajouté,
## de poids `poids` : le mélange déjà fait s'interpole vers lui d'autant.
static func part_du_melange(cumul: float, poids: float) -> float:
	return poids / cumul


## Le décalage, le long du +Y (vers le bas) d'un repère de rangement, qui monte à son origine la cote `haut` d'un objet.
static func suspension(haut: float) -> Vector3:
	return Vector3(0.0, -haut, 0.0)


## Le tour, autour de la normale sortante (+Z) d'un repère de rangement, d'un objet rangé dont la boîte, pendue à
## l'emplacement, descend à `bas` sous lui, à `hauteur` au-dessus du sol : nul s'il ne l'atteint pas ; sinon l'objet passe
## en bandoulière, son +Y (le fer) vers le haut, penché de `INCLINAISON_EN_BANDOULIERE` vers `droite`, la droite du
## personnage dans ce repère.
static func biais_de_rangement(bas: float, hauteur: float, droite: Vector3) -> float:
	return 0.0 if bas <= hauteur else PI + signf(droite.x) * INCLINAISON_EN_BANDOULIERE


## Hauteur au-dessus du sol d'un point exprimé dans le repère d'un os de repos (origine = hauteur de l'os).
static func hauteur_au_sol(os: Basis, point: Vector3, origine: float) -> float:
	return origine + (os * point).y


## Le décalage, dans un repère de rangement, qui pose sur l'emplacement `milieu`, le milieu de la boîte d'un objet en
## bandoulière (`biais_de_rangement`), sur la hauteur et la largeur ; sa face arrière s'appuie sur ce qui est porté.
static func centre_en_bandouliere(milieu: Vector3) -> Vector3:
	return Vector3(-milieu.x, -milieu.y, 0.0)


## Le signe, +1 ou -1, de l'axe `x` d'un repère de rangement, posé dans le repère au repos `os` de son os, vers l'avant du
## personnage (+Z du squelette) ; +1 pour un axe latéral.
static func sens_vers_l_avant(os: Basis, x: Vector3) -> float:
	return -1.0 if (os * x).z < -TOLERANCE_LATERALE else 1.0


## Le tour, autour de l'axe Y de l'os, d'un objet rangé `decalage` mètres plus loin, le long de l'axe X de son repère
## de rangement, qu'un objet de tour `tour` rangé à l'emplacement de base `emplacement` et de position `point` : `tour`
## plus `decalage / r` radians, `r` la distance du point à l'axe de l'os ; `tour` sur l'axe (`point_de_rangement`).
static func tour_de_rangement(emplacement: Basis, point: Vector3, tour: float, decalage: float) -> float:
	var rayon := Vector2(point.x, point.z).length()
	if rayon <= TOLERANCE_DE_NORMALE:
		return tour
	return tour + signf(axe_de_rangement(emplacement, point, Vector3.AXIS_X).dot(Vector3(point.z, 0.0, -point.x))) * decalage / rayon


## Le tour `tour` d'un objet rangé à l'emplacement de base `emplacement` et de position `point`, corrigé pour que
## l'étendue des azimuts de ses sommets posés, de `debut` à `fin`, passe à `JEU_ENTRE_RANGES` (rapporté à la distance
## `r` du point à l'axe de l'os) de celle du précédent, de `debut_precedent` à `fin_precedente`, du côté où va l'axe X
## de rangement de sens `sens` (`tour_de_rangement`) ; `tour` sur l'axe.
static func tour_a_cote(emplacement: Basis, point: Vector3, tour: float, sens: float, debut_precedent: float, fin_precedente: float, debut: float, fin: float) -> float:
	var rayon := Vector2(point.x, point.z).length()
	if rayon <= TOLERANCE_DE_NORMALE:
		return tour
	var jeu := JEU_ENTRE_RANGES / rayon
	if tour_de_rangement(emplacement, point, 0.0, sens) > 0.0:
		return tour + fin_precedente + jeu - debut
	return tour + debut_precedent - jeu - fin


## L'azimut du point `point` autour de l'axe Y de son os (atan2 de x sur z), compté depuis l'azimut `depuis`, dans
## ]-π, π].
static func azimut(point: Vector3, depuis: float) -> float:
	return wrapf(atan2(point.x, point.z) - depuis, -PI, PI)


## Le point d'un objet rangé à `decalage` mètres, le long de l'axe X de son repère de rangement, de l'emplacement de base
## `emplacement` et de position `point` sur l'axe de son os ; hors de l'axe, le point même (`tour_de_rangement` le
## porte).
static func point_de_rangement(emplacement: Basis, point: Vector3, decalage: float) -> Vector3:
	if Vector2(point.x, point.z).length() > TOLERANCE_DE_NORMALE:
		return point
	return point + axe_de_rangement(emplacement, point, Vector3.AXIS_X) * decalage


## Le lacet, autour de l'axe Y d'un repère de rangement, qui met à plat un objet de boîte de taille `taille` : sa plus
## petite largeur sur la normale sortante.
static func lacet_a_plat(taille: Vector3) -> float:
	return 0.0 if taille.x >= taille.z else QUART_DE_TOUR


## Le décalage, le long de l'axe X du repère de rangement, d'un objet dont la boîte va de `debut` à `fin` sur cet axe,
## rangé à côté du précédent, décalé de `decalage` et de boîte de `debut_precedent` à `fin_precedente`, du côté `sens`
## (+1 ou -1), `JEU_ENTRE_RANGES` entre leurs boîtes.
static func decalage_a_cote(decalage: float, sens: float, debut_precedent: float, fin_precedente: float, debut: float, fin: float) -> float:
	return decalage + (fin_precedente - debut + JEU_ENTRE_RANGES if sens > 0.0 else debut_precedent - fin - JEU_ENTRE_RANGES)


## La case, de `CASE_DE_CONTACT` mètres en (x, y) d'un repère de rangement, où tombe le sommet `sommet`.
static func case_de_contact(sommet: Vector3) -> Vector2i:
	return Vector2i(floori(sommet.x / CASE_DE_CONTACT), floori(sommet.y / CASE_DE_CONTACT))


## Le point d'un repère de rangement au centre de la case `case`, à la cote `cote` sur la normale sortante.
static func centre_de_contact(case: Vector2i, cote: float) -> Vector3:
	return Vector3((case.x + DEMI_CASE) * CASE_DE_CONTACT, (case.y + DEMI_CASE) * CASE_DE_CONTACT, cote)


## Le recul `recul`, sur la normale sortante, d'un objet rangé attaché à `haut` sur Y (vers le bas, `_appuyer`),
## relevé par la case `case` où ce qui est porté monte à `dessus` et la face arrière de l'objet est à `arriere` : seules
## comptent les cases au-dessus de `APPUI_DE_RANGEMENT` sous l'attache ; `-INF` tant qu'aucune n'a compté.
static func recul_sur_la_case(recul: float, case: Vector2i, haut: float, dessus: float, arriere: float) -> float:
	return maxf(recul, dessus - arriere) if case.y * CASE_DE_CONTACT <= haut + APPUI_DE_RANGEMENT else recul


## Le recul d'appui d'un objet rangé, de recul relevé `recul` (`recul_sur_la_case`) : sa face arrière à
## `JEU_DE_RANGEMENT` au-dessus de ce qui est porté sous son haut ; sans rien dessous, à `JEU_DE_RANGEMENT` de
## l'emplacement, sa boîte commençant à la cote `arriere`.
static func recul_d_appui(recul: float, arriere: float) -> float:
	return JEU_DE_RANGEMENT - arriere if is_inf(recul) else recul + JEU_DE_RANGEMENT


## L'angle `angle`, autour de l'axe X du repère de rangement, le bas vers l'extérieur, relevé par la case `case` sous les
## `APPUI_DE_RANGEMENT` du haut `haut` d'un objet reculé de `recul`, pour que sa face arrière, à `arriere` dans la case,
## passe à `JEU_DE_RANGEMENT` au-dessus de ce qui est porté, à `dessus`.
static func pivot_sur_la_case(angle: float, case: Vector2i, haut: float, dessus: float, arriere: float, recul: float) -> float:
	var y := (case.y + DEMI_CASE) * CASE_DE_CONTACT
	var manque := dessus + JEU_DE_RANGEMENT - arriere - recul
	return maxf(angle, atan2(manque, y)) if y > haut + APPUI_DE_RANGEMENT and y > 0.0 and manque > 0.0 else angle


## Le coin d'une bulle de `largeur` sur `hauteur`, centrée au-dessus du point `point` de l'écran.
static func bulle_au_dessus(point: Vector2, largeur: float, hauteur: float) -> Vector2:
	return Vector2(point.x - largeur / 2.0, point.y - hauteur - ECART_DE_BULLE)


## L'échelle de projection d'une texture du sol dans le repère du volume, en mètres : un motif tous les
## `METRES_PAR_MOTIF`.
static func echelle_de_motif() -> Vector3:
	return Vector3.ONE / METRES_PAR_MOTIF


## Le point d'un plan de `taille` pixels où se pose un point placé en (`x`, `y`) de son cadre (0..1 sur chaque axe),
## la marge du plan autour.
static func point_du_plan(taille: Vector2, x: float, y: float) -> Vector2:
	return Vector2(MARGE_DU_PLAN, MARGE_DU_PLAN) + Vector2(x, y) * (taille - Vector2(MARGE_DU_PLAN, MARGE_DU_PLAN) * 2.0)


## Le coin d'un contrôle de `largeur` sur `hauteur` centré sous le point du plan `centre`, de rayon `rayon`, gardé dans
## le plan de `largeur_du_plan` sur `hauteur_du_plan`.
static func sous_le_point(centre: Vector2, rayon: float, largeur: float, hauteur: float, largeur_du_plan: float, hauteur_du_plan: float) -> Vector2:
	return Vector2(
		clampf(centre.x - largeur / 2.0, 0.0, maxf(0.0, largeur_du_plan - largeur)),
		clampf(centre.y + rayon + ECART_SOUS_LE_POINT, 0.0, maxf(0.0, hauteur_du_plan - hauteur)))


## Le lieu, au sol, de la cible de la vitrine des effets de l'atelier, à `distance_m` mètres de l'auteur posé à l'origine
## (#3777).
static func lieu_de_la_cible(distance_m: float) -> Vector3:
	return Vector3(distance_m, 0.0, 0.0)


## Le sol de la case (`x`, `y`) de la vitrine des effets, où l'auteur tient la case (0, 0), sur des cases de
## `metres_par_case` mètres, dans l'atelier mesuré en mètres.
static func lieu_de_la_case_de_vitrine(x: float, y: float, metres_par_case: float) -> Vector3:
	return Vector3(x * metres_par_case, 0.0, y * metres_par_case)


## Le foyer d'une lumière de la vitrine posé sur la cible, à `hauteur_m` mètres, dans l'atelier de `metres_par_unite`.
static func foyer_de_la_vitrine(hauteur_m: float, metres_par_unite: float) -> Vector3:
	return Vector3.UP * hauteur_au_plateau(hauteur_m, metres_par_unite)


## Le coin de la boîte que l'orbite de l'atelier cadre pour la vitrine des effets : l'orbite tourne autour de l'auteur, à
## l'origine, et la boîte s'étend autant de part et d'autre de lui que la cible en est loin.
static func coin_de_la_vitrine(distance_m: float) -> Vector3:
	return Vector3(-distance_m, 0.0, -distance_m)


## L'étendue de cette boîte : deux fois la distance de la cible en largeur et en profondeur, deux fois la hauteur du coup.
static func etendue_de_la_vitrine(distance_m: float) -> Vector3:
	return Vector3(distance_m * 2.0, HAUTEUR_DU_COUP * 2.0, distance_m * 2.0)
