## La mise en page de l'hôte : la case du plateau vers le monde et retour, le centre du plateau, le quart de tour de la
## caméra, son zoom borné, les millisecondes du pont en secondes de minuteur, le pas d'image d'un clip et l'image
## voisine d'un instant, le diamètre d'une sphère, l'échelle qui porte une image à une largeur voulue. Seul script où
## l'arithmétique et la mesure sont permises (`scripts/guards/lib/gdscriptSansRegle.mjs`) : des constantes et des
## fonctions statiques, chacune typée et sur au plus un vecteur, sans état.
class_name MiseEnPage
extends RefCounted

const MS_PAR_SECONDE := 1000.0
const DEMI_CASE := 0.5
const QUART_DE_TOUR := PI / 2.0
const PAS_DE_ZOOM := 1.15
const TOLERANCE_D_IMAGE := 0.001


## Le diamètre d'une sphère de rayon `rayon` (`SphereMesh.height`).
static func diametre(rayon: float) -> float:
	return 2.0 * rayon


## Le centre de la case `case` sur le sol (y = 0).
static func centre_de_case(case: Vector2i) -> Vector3:
	return Vector3(case.x + DEMI_CASE, 0.0, case.y + DEMI_CASE)


## Le centre du sol d'un plateau de `taille` cases.
static func centre_du_plateau(taille: Vector2i) -> Vector3:
	return Vector3(taille.x / 2.0, 0.0, taille.y / 2.0)


## La case qui porte le point `sol` du sol.
static func case_du_point(sol: Vector3) -> Vector2i:
	return Vector2i(floori(sol.x), floori(sol.z))


## Le lacet de la caméra tourné d'un quart de tour dans le sens `sens` (1 ou -1).
static func lacet_tourne(lacet: float, sens: float) -> float:
	return lacet + sens * QUART_DE_TOUR


## La distance de la caméra d'un pas de zoom plus loin (`sens` 1) ou plus près (-1), bornée à [`minimum`, `maximum`].
static func distance_zoomee(distance: float, sens: float, minimum: float, maximum: float) -> float:
	return clampf(distance * pow(PAS_DE_ZOOM, sens), minimum, maximum)


## Un délai du pont (millisecondes) en secondes de minuteur.
static func secondes(ms: float) -> float:
	return ms / MS_PAR_SECONDE


## L'échelle qui porte une image de `largeur` pixels à `largeur_voulue` ; 1 pour une image vide.
static func echelle_d_image(largeur_voulue: float, largeur: int) -> float:
	return 1.0 if largeur == 0 else largeur_voulue / largeur


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
