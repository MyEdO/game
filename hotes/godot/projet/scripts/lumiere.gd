## La lumière de la scène que le noyau publie (`vue.lumiere`, `CONTRAT.md`, section « Lumière ») : le soleil de l'heure,
## l'ambiante, le ciel d'un extérieur ou le fond d'un intérieur, la brume de profondeur au-delà du point que la caméra
## vise, et une lampe vacillante par source de lumière de la scène. Sans `eclairer`, la lumière fixe de la scène reste
## (l'atelier).
class_name Lumiere
extends Node3D

@onready var _environnement: Environment = ($Environnement as WorldEnvironment).environment
@onready var _soleil: DirectionalLight3D = $Soleil
@onready var _sources: Node3D = $Sources

var _brume: Dictionary = {}
var _flammes: Array[Dictionary] = []


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
	_brume = lumiere.brume
	_poser_les_sources(lumiere.sources, metres_par_case)


func _poser_les_sources(sources: Array, metres_par_case: float) -> void:
	for lampe in _sources.get_children():
		lampe.free()
	_flammes.clear()
	for source: Dictionary in sources:
		var lampe := OmniLight3D.new()
		lampe.position = MiseEnPage.point_de_la_carte(source.x, source.y, MiseEnPage.hauteur_au_plateau(source.hM, metres_par_case))
		lampe.omni_range = source.rayonCases
		lampe.light_color = Color(source.couleur)
		lampe.light_energy = source.energie
		_sources.add_child(lampe)
		if source.scintillement != null:
			_flammes.append({lampe = lampe, energie = source.energie, scintillement = source.scintillement})


## La brume suit la distance de la caméra au point qu'elle vise, que le zoom change ; les flammes vacillent.
func _process(_delta: float) -> void:
	if _brume.is_empty():
		return
	var distance := get_viewport().get_camera_3d().position.z
	_environnement.fog_depth_begin = MiseEnPage.profondeur_de_brume(distance, _brume.debutCases)
	_environnement.fog_depth_end = MiseEnPage.profondeur_de_brume(distance, _brume.finCases)
	var secondes := MiseEnPage.secondes(Time.get_ticks_msec())
	for flamme in _flammes:
		flamme.lampe.light_energy = MiseEnPage.energie_vacillante(flamme.energie, flamme.scintillement.amplitude, flamme.scintillement.hz, secondes)
