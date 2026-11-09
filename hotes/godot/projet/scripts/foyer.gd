## Une source de lumière (`vue.lumiere.sources`, `CONTRAT.md`, section « Lumière ») posée à son foyer : sa lampe, qui vacille
## si son ton vacille, ce qu'elle montre (#3783 : le feu et sa fumée, la flammèche, la lueur), des gerbes continues dont
## les particules naissent d'avance (`preprocess`, `Effets.gerbe_de`), et le son qu'elle joue en boucle à son point.
class_name Foyer
extends Node3D

## Par visuel de lumière, ses gerbes continues (la forme d'une gerbe d'`Effets.GERBES` ; `teinte` : la couleur de la
## source).
const FLAMMES := {
	"feu": [
		{nombre = 24, duree = 0.6, vitesse = [0.4, 0.9], pesanteur = Vector3(0.0, 1.5, 0.0), taille = [0.25, 0.45], couleur = "teinte", opacite = 1.0, dispersion = 15.0, anneau = [0.15, 0.0], lumineuse = true},
		{nombre = 12, duree = 2.5, vitesse = [0.3, 0.6], pesanteur = Vector3(0.0, 0.3, 0.0), taille = [0.4, 0.8], couleur = "#5a5550", opacite = 0.35, dispersion = 20.0, anneau = null, lumineuse = false},
	],
	"flammeche": [
		{nombre = 8, duree = 0.4, vitesse = [0.05, 0.15], pesanteur = Vector3(0.0, 0.3, 0.0), taille = [0.04, 0.08], couleur = "teinte", opacite = 1.0, dispersion = 10.0, anneau = null, lumineuse = true},
	],
	"lueur": [
		{nombre = 16, duree = 1.6, vitesse = [0.1, 0.3], pesanteur = Vector3(0.0, 0.2, 0.0), taille = [0.05, 0.1], couleur = "teinte", opacite = 0.9, dispersion = 180.0, anneau = [0.3, 0.2], lumineuse = true},
	],
}

## Le temps que le serveur audio relâche la lecture du son en boucle d'un foyer libéré.
const SON_LIBERE_S := 0.1

var _lampe := OmniLight3D.new()
var _energie := 0.0
var _scintillement: Variant = null


## Pose la source `source` sur un plateau de `metres_par_case` mètres par case : sa lampe de `rayonCases` cases, ses
## gerbes à l'échelle du plateau, son son en boucle.
func poser(source: Dictionary, metres_par_case: float) -> void:
	_lampe.omni_range = source.rayonCases
	_lampe.light_color = Color(source.couleur)
	_lampe.light_energy = source.energie
	add_child(_lampe)
	_energie = source.energie
	_scintillement = source.scintillement
	if source.visuel != null:
		var flamme := Node3D.new()
		flamme.name = source.visuel
		flamme.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
		add_child(flamme)
		for recette: Dictionary in FLAMMES[source.visuel]:
			var gerbe := Effets.gerbe_de(recette, recette.taille, Color(source.couleur))
			gerbe.one_shot = false
			gerbe.explosiveness = 0.0
			gerbe.preprocess = recette.duree
			flamme.add_child(gerbe)
	if source.son != null:
		var lecteur := AudioStreamPlayer3D.new()
		lecteur.name = "son-%s" % source.son.id
		lecteur.stream = Effets.variantes_du_son(source.son, true)
		lecteur.volume_db = linear_to_db(source.son.volume)
		lecteur.unit_size = Effets.PORTEE_DU_SON
		lecteur.autoplay = true
		add_child(lecteur)


## La lampe vacille, si son ton vacille.
func _process(_delta: float) -> void:
	if _scintillement == null:
		return
	_lampe.light_energy = MiseEnPage.energie_vacillante(_energie, _scintillement.amplitude, _scintillement.hz, MiseEnPage.secondes(Time.get_ticks_msec()))
