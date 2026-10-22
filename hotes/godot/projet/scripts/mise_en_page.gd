## La mise en page de l'hôte : la case du plateau vers le monde et retour, le centre du plateau, le quart de tour de la
## caméra, son zoom borné, et les millisecondes du pont en secondes de minuteur. Seul script où l'arithmétique et la
## mesure sont permises (`scripts/guards/lib/gdscriptSansRegle.mjs`) : des constantes et des fonctions statiques, chacune
## typée et sur au plus un vecteur, sans état.
class_name MiseEnPage
extends RefCounted

const MS_PAR_SECONDE := 1000.0
const DEMI_CASE := 0.5
const QUART_DE_TOUR := PI / 2.0
const PAS_DE_ZOOM := 1.15


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
