## La lumière de la scène que le noyau publie (`vue.lumiere`, `CONTRAT.md`, section « Lumière ») : le soleil de l'heure,
## l'ambiante, le ciel d'un extérieur ou le fond d'un intérieur, la brume de profondeur au-delà du point que la caméra
## vise ou depuis l'œil, et un foyer par source de lumière de la scène (`Foyer` : sa lampe, sa flamme, son son). Sans `eclairer`, la lumière fixe de la scène reste
## (l'atelier).
class_name Lumiere
extends Node3D

## @contrat Lumière
## Le combat pose `vue.lumiere` sur la `Lumiere` du monde (`projet/scenes/Monde.tscn`) (`projet/scripts/lumiere.gd`) à
## chaque vue : chaque source y est un `Foyer` (`projet/scripts/foyer.gd`), sa lampe qui vacille, ses gerbes continues
## nées d'avance et son son en boucle à son point, le même d'une vue à l'autre tant que la vue nomme sa clé (`cle`) ;
## la recette `projet/recettes/foyers.gd` le vérifie.
##
## @contrat Lumière
## Deux rendus dessinent les mêmes scènes (#3951) : Forward+ hors d'une page, où la carte graphique le permet, et le
## rendu de compatibilité dans la page ou en repli (`rendering/renderer/rendering_method` de `projet/project.godot`).
## Sous les deux, la lampe de chaque foyer porte une ombre (#3811) ; sous Forward+ seul (`Lumiere.rendu_complet`), la
## `Lumiere` allume l'occlusion ambiante et le brouillard volumétrique de son environnement
## (`projet/scenes/Lumiere.tscn`, qui porte leurs valeurs). Aucune lampe ne reçoit l'ombre d'un luminaire (les
## surfaces `luminaire` du volume, section « Monde »), et une lampe portée (sa clé, `portee/<id>`), celle d'aucun
## corps : ce qui la porte la masquerait. La recette `projet/recettes/lumiere-des-deux-rendus.gd` le vérifie sous chaque
## rendu.

@onready var _environnement: Environment = ($Environnement as WorldEnvironment).environment
@onready var _soleil: DirectionalLight3D = $Soleil
@onready var _sources: Node3D = $Sources

var _brume: Dictionary = {}


## Si le rendu en cours est Forward+, qui porte l'occlusion ambiante et le brouillard volumétrique.
static func rendu_complet() -> bool:
	return RenderingServer.get_current_rendering_method() == "forward_plus"


func _ready() -> void:
	_environnement.ssao_enabled = rendu_complet()


## Pose `lumiere` sur un plateau de `metres_par_case` mètres par case.
func eclairer(lumiere: Dictionary, metres_par_case: float) -> void:
	var soleil: Variant = lumiere.soleil
	_soleil.visible = soleil != null
	if soleil != null:
		_soleil.basis = Basis.looking_at(MiseEnPage.sens_d_eclairage(Vector3(soleil.vers.x, soleil.vers.y, soleil.vers.z)))
		_soleil.light_color = Color(soleil.couleur)
		_soleil.light_energy = soleil.energie
	_environnement.ambient_light_color = Color(lumiere.ambiante.couleur)
	_environnement.ambient_light_energy = lumiere.ambiante.energie
	var ciel: Variant = lumiere.ciel
	if ciel != null:
		var materiau := _environnement.sky.sky_material as ProceduralSkyMaterial
		materiau.sky_top_color = Color(ciel.zenith)
		materiau.sky_horizon_color = Color(ciel.horizon)
		materiau.ground_horizon_color = Color(ciel.horizon)
		materiau.ground_bottom_color = Color(lumiere.brume.couleur)
		_environnement.background_mode = Environment.BG_SKY
	else:
		_environnement.background_mode = Environment.BG_COLOR
		_environnement.background_color = Color(lumiere.brume.couleur)
	_environnement.fog_enabled = true
	_environnement.fog_light_color = Color(lumiere.brume.couleur)
	_environnement.volumetric_fog_enabled = rendu_complet()
	_brume = lumiere.brume
	_poser_les_sources(lumiere.sources, metres_par_case)


## Un foyer par source de `sources`, réconcilié par sa clé (`cle`) : celui d'une source déjà posée reste, à son point,
## celui d'une source partie la quitte.
func _poser_les_sources(sources: Array, metres_par_case: float) -> void:
	var poses := {}
	for foyer in _sources.get_children():
		poses[foyer.get_meta("cle")] = foyer
	for source: Dictionary in sources:
		var foyer: Foyer = poses.get(source.cle)
		poses.erase(source.cle)
		if foyer == null:
			foyer = Foyer.new()
			foyer.set_meta("cle", source.cle)
			_sources.add_child(foyer)
		foyer.position = MiseEnPage.point_de_la_carte(source.x, source.y, MiseEnPage.hauteur_au_plateau(source.hM, metres_par_case))
		foyer.poser(source, metres_par_case)
	for parti: Foyer in poses.values():
		parti.free()


## La brume suit la distance de la caméra au point qu'elle vise, que le zoom change, ou part de l'œil
## (`brume.depuisLOeil`).
func _process(_delta: float) -> void:
	if _brume.is_empty():
		return
	var distance := 0.0 if _brume.depuisLOeil else get_viewport().get_camera_3d().position.z
	_environnement.fog_depth_begin = MiseEnPage.profondeur_de_brume(distance, _brume.debutCases)
	_environnement.fog_depth_end = MiseEnPage.profondeur_de_brume(distance, _brume.finCases)
