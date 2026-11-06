## La mise en page de l'hôte : la case du plateau vers le monde et retour, le centre du plateau, le quart de tour de la
## caméra, son zoom borné, les millisecondes du pont en secondes de minuteur, le pas d'image d'un clip et l'image
## voisine d'un instant, le diamètre d'une sphère, l'échelle qui porte une image à une largeur voulue, l'entrée et le
## pas de la marche de l'atelier, l'orbite de sa caméra et son cadrage, le gabarit d'une base posé sur ses os, ses pieds
## au sol, un vecteur rapporté à un repère, le repère d'un objet rangé à un emplacement, le coin d'une bulle au-dessus
## d'un point, la largeur d'un texte de bulle replié, le point où se dit le nom de ce qui occupe une case, et la pose
## d'une arête (mur ou porte) sur le côté de sa case. Seul script où l'arithmétique et la mesure sont permises
## (`scripts/guards/lib/gdscriptSansRegle.mjs`) : des constantes et des fonctions statiques, chacune typée et sur au
## plus un vecteur, sans état.
class_name MiseEnPage
extends RefCounted

const MS_PAR_SECONDE := 1000.0
const DEMI_CASE := 0.5
const QUART_DE_TOUR := PI / 2.0
const PAS_DE_ZOOM := 1.15
const TOLERANCE_D_IMAGE := 0.001
## Le jeu, en mètres, entre la peau et la face arrière d'un objet rangé (`origine_de_rangement`) : assez pour passer
## par-dessus un vêtement ample et une ceinture.
const DEGAGEMENT_DE_RANGEMENT := 0.05
## La longueur sous laquelle la position d'un emplacement est sur l'axe de son os.
const TOLERANCE_DE_NORMALE := 0.001
const RADIANS_PAR_PIXEL := 0.005
## Le tangage de l'orbite, borné entre la vue plongeante et la vue rasante au-dessus du sol.
const TANGAGE_MINIMAL := -1.2
const TANGAGE_MAXIMAL := 0.2
## L'écart, en pixels, entre une bulle et le point de l'écran qu'elle désigne.
const ECART_DE_BULLE := 12.0
## La largeur, en pixels, au-delà de laquelle le texte d'une bulle se replie au mot (`Bulle`).
const LARGEUR_DE_BULLE := 420.0
## La hauteur, au-dessus du sol, du nom d'une entité de la scène.
const HAUTEUR_DU_NOM := 1.2


## La largeur du texte d'une bulle qui, sur une ligne, en prendrait `largeur` : la sienne, au pixel supérieur, au plus
## `LARGEUR_DE_BULLE`.
static func largeur_de_bulle(largeur: float) -> float:
	return minf(LARGEUR_DE_BULLE, ceilf(largeur))


## Le diamètre d'une sphère de rayon `rayon` (`SphereMesh.height`).
static func diametre(rayon: float) -> float:
	return 2.0 * rayon


## Le point, au-dessus du centre de la case `case`, où se dit le nom de ce qui l'occupe.
static func au_dessus_de_la_case(case: Vector2i) -> Vector3:
	return Vector3(case.x + DEMI_CASE, HAUTEUR_DU_NOM, case.y + DEMI_CASE)


## Le centre d'une arête de `hauteur` dont le milieu est `milieu`, en coins de grille (`plateauDeLaScene`).
static func centre_d_arete(milieu: Vector2, hauteur: float) -> Vector3:
	return Vector3(milieu.x + DEMI_CASE, hauteur / 2.0, milieu.y + DEMI_CASE)


## Le lacet d'une arête qui court selon `sens` sur le plateau.
static func lacet_d_arete(sens: Vector2) -> float:
	return atan2(-sens.y, sens.x)


## La longueur, en cases, d'une arête qui court selon `sens`.
static func longueur_d_arete(sens: Vector2) -> float:
	return sens.length()


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


## Le pas de la marche en `delta` secondes : la direction unitaire `direction` sur le sol, à `vitesse` m/s multipliée par
## `echelle`, celle de la vitesse au sol du gabarit posé (`echelleDeVitesse`, `CONTRAT.md`, « Gabarit d'une base »), à
## la cadence `cadence` du lecteur de clips (`AnimationPlayer.speed_scale`), qui règle le clip au même rythme.
static func pas_de_marche(direction: Vector3, vitesse: float, echelle: float, cadence: float, delta: float) -> Vector3:
	return direction * vitesse * echelle * cadence * delta


## Le lacet de l'orbite tourné par un glissé de `pixels` à la souris.
static func lacet_glisse(lacet: float, pixels: float) -> float:
	return lacet - pixels * RADIANS_PAR_PIXEL


## Le tangage de l'orbite tourné par un glissé de `pixels` à la souris, borné à [`TANGAGE_MINIMAL`, `TANGAGE_MAXIMAL`].
static func tangage_glisse(tangage: float, pixels: float) -> float:
	return clampf(tangage - pixels * RADIANS_PAR_PIXEL, TANGAGE_MINIMAL, TANGAGE_MAXIMAL)


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


## La plus basse des hauteurs `hauteur` et `autre`.
static func plus_bas(hauteur: float, autre: float) -> float:
	return minf(hauteur, autre)


## La plus haute des hauteurs `hauteur` et `autre`.
static func plus_haut(hauteur: float, autre: float) -> float:
	return maxf(hauteur, autre)


## L'échelle monde d'un os d'échelle `echelle` dans un squelette d'échelle monde `echelle_du_squelette`.
static func echelle_composee(echelle_du_squelette: float, echelle: float) -> float:
	return echelle_du_squelette * echelle


## L'échelle de l'orbite qui cadre un corps de sommet `sommet` comme elle cadre, à l'échelle 1, le corps neutre de sommet
## `sommet_neutre`.
static func echelle_de_cadrage(sommet: float, sommet_neutre: float) -> float:
	return sommet / sommet_neutre


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


## L'origine du repère de prise d'un objet rangé à l'emplacement de base `emplacement` et de position `point`, dont la
## face arrière de la boîte est à la cote `arriere` de ce repère : sur la normale sortante, la face arrière à
## `DEGAGEMENT_DE_RANGEMENT` de l'emplacement.
static func origine_de_rangement(emplacement: Basis, point: Vector3, arriere: float) -> Vector3:
	return point + axe_de_rangement(emplacement, point, Vector3.AXIS_Z) * (DEGAGEMENT_DE_RANGEMENT - arriere)


## Le coin d'une bulle de `largeur` sur `hauteur`, centrée au-dessus du point `point` de l'écran.
static func bulle_au_dessus(point: Vector2, largeur: float, hauteur: float) -> Vector2:
	return Vector2(point.x - largeur / 2.0, point.y - hauteur - ECART_DE_BULLE)
