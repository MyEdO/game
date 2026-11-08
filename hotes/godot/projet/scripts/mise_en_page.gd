## La mise en page de l'hôte : la case du plateau vers le monde, le centre du plateau, le quart de tour de la
## caméra, son zoom borné, les millisecondes du pont en secondes de minuteur, le pas d'image d'un clip et l'image
## voisine d'un instant, le diamètre d'une sphère, l'échelle qui porte une image à une largeur voulue, l'entrée et le
## pas de la marche de l'atelier, l'orbite de sa caméra, son cadrage et son zoom, le gabarit d'une base posé sur ses os, ses pieds
## au sol, un vecteur rapporté à un repère, l'axe unité le plus proche d'un vecteur, le repère d'un objet rangé à un emplacement, le coin d'une bulle au-dessus
## d'un point, la largeur d'un texte de bulle replié, le point où se dit le nom de ce qui occupe une case, la pose
## d'une arête (mur ou porte) sur le côté de sa case et l'échelle d'une pièce du kit qui s'y pose, l'échelle métrique d'un modèle et d'une hauteur sur le plateau et
## la hauteur d'un point du corps à son gabarit, le point d'un lieu sur le plan et le coin de ce qui se pose sous lui. Seul script où l'arithmétique et la mesure sont permises
## (`scripts/guards/lib/gdscriptSansRegle.mjs`) : des constantes et des fonctions statiques, chacune typée et sur au
## plus un vecteur, sans état.
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
## Le jeu, en mètres, entre la peau et la face arrière d'un objet rangé (`origine_de_rangement`) : assez pour passer
## par-dessus un vêtement ample et une ceinture.
const DEGAGEMENT_DE_RANGEMENT := 0.05
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
## La marge, en pixels, entre le bord d'un plan et ses points.
const MARGE_DU_PLAN := 28.0
## Le rayon, en pixels, d'un point du plan.
const RAYON_DU_POINT := 7.0
## L'écart, en pixels, entre un point du plan et ce qui se pose sous lui.
const ECART_SOUS_LE_POINT := 2.0


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


## L'axe unité (±X, ±Y ou ±Z) le plus proche de `vecteur` posé dans le repère de base `base` : celui de sa plus grande
## composante, à son signe (`SecondePrise`, #3319).
static func axe_le_plus_proche(base: Basis, vecteur: Vector3) -> Vector3:
	var pose := base * vecteur
	var axe := pose.abs().max_axis_index()
	var unite := Vector3.ZERO
	unite[axe] = signf(pose[axe])
	return unite


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


## L'échelle de projection d'une texture du sol dans le repère du volume, en mètres : un motif tous les
## `METRES_PAR_MOTIF`.
static func echelle_de_motif() -> Vector3:
	return Vector3.ONE / METRES_PAR_MOTIF


## Le point d'un plan de `taille` pixels où se pose un point placé en (`x`, `y`) de son cadre (0..1 sur chaque axe),
## la marge du plan autour.
static func point_du_plan(taille: Vector2, x: float, y: float) -> Vector2:
	return Vector2(MARGE_DU_PLAN, MARGE_DU_PLAN) + Vector2(x, y) * (taille - Vector2(MARGE_DU_PLAN, MARGE_DU_PLAN) * 2.0)


## Le coin d'un contrôle de `largeur` sur `hauteur` centré sous le point du plan `centre`, gardé dans le plan de
## `largeur_du_plan` sur `hauteur_du_plan`.
static func sous_le_point(centre: Vector2, largeur: float, hauteur: float, largeur_du_plan: float, hauteur_du_plan: float) -> Vector2:
	return Vector2(
		clampf(centre.x - largeur / 2.0, 0.0, maxf(0.0, largeur_du_plan - largeur)),
		clampf(centre.y + RAYON_DU_POINT + ECART_SOUS_LE_POINT, 0.0, maxf(0.0, hauteur_du_plan - hauteur)))
