## La lumière de la scène que le noyau publie (`vue.lumiere`, `CONTRAT.md`, section « Lumière ») : le soleil de l'heure,
## l'ambiante, le ciel nuageux d'un extérieur en immersion (`art/ciel.gdshader`) ou le fond de la brume, la brume de
## profondeur au-delà du point que la caméra vise ou depuis l'œil, le sol du hors-carte (`HorsCarte`,
## `art/hors-carte.gdshader`) et un foyer par source de lumière de la scène (`Foyer` : sa lampe, sa flamme, son son).
## Sans `eclairer`, la lumière fixe de la scène reste (l'atelier).
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
## (`projet/scenes/Lumiere.tscn`, qui porte leurs valeurs) ; ce brouillard, un volume de toute la scène le porte
## (`brume`, `art/brume-de-la-vision.gdshader`), à la densité de l'environnement, que la vision voile (`VolumeDeScene`).
## Aucune lampe ne reçoit l'ombre d'un luminaire (les surfaces `luminaire` du volume, section « Monde »), et une
## lampe portée (sa clé, `portee/<id>`), celle d'aucun corps : ce qui la porte la masquerait. La recette
## `projet/recettes/lumiere-des-deux-rendus.gd` le vérifie sous chaque rendu.

@onready var _environnement: Environment = ($Environnement as WorldEnvironment).environment
@onready var _soleil: DirectionalLight3D = $Soleil
@onready var _sources: Node3D = $Sources
@onready var _hors_carte: MeshInstance3D = $HorsCarte
## La matière du sol du hors-carte, que la vision voile (`VolumeDeScene.lier_a_la_vision`).
@onready var sol_hors_carte: ShaderMaterial = _hors_carte.get_surface_override_material(0)

## La part de son énergie que garde le soleil sous le rendu de compatibilité : sa lumière, ombrée, s'y dessine en
## passe à part, ajoutée à la passe de base en sRGB et non en lumière linéaire (« 3D lights and shadows », Godot 4.7,
## Compatibility) ; à pleine énergie, un albédo clair au soleil s'y écrête en blanc pur.
@export var part_du_soleil_en_compatibilite := 1.0

var _brume: Dictionary = {}
## Sous Forward+ seul (`rendu_complet`), la matière du volume de brouillard de toute la scène, qui porte la densité du
## brouillard volumétrique de l'environnement (`_porter_la_brume`), et que la vision voile (`VolumeDeScene.lier_a_la_vision`) ;
## `null` sous le rendu de compatibilité, qui ne charge pas un shader de brouillard.
var brume: ShaderMaterial = null


## Si le rendu en cours est Forward+, qui porte l'occlusion ambiante et le brouillard volumétrique.
static func rendu_complet() -> bool:
	return RenderingServer.get_current_rendering_method() == "forward_plus"


func _ready() -> void:
	_environnement.ssao_enabled = rendu_complet()
	if rendu_complet():
		_porter_la_brume()


## Le brouillard volumétrique de l'environnement porté par un volume de toute la scène (`brume`) : sa densité passe de
## l'environnement à la matière du volume.
func _porter_la_brume() -> void:
	brume = ShaderMaterial.new()
	brume.shader = load("res://art/brume-de-la-vision.gdshader")
	brume.set_shader_parameter("densite", _environnement.volumetric_fog_density)
	_environnement.volumetric_fog_density = 0.0
	var volume := FogVolume.new()
	volume.shape = RenderingServer.FOG_VOLUME_SHAPE_WORLD
	volume.material = brume
	add_child(volume)


## La part de son énergie que le soleil garde sous le rendu en cours : entière sous Forward+ (`rendu_complet`).
func part_du_soleil() -> float:
	return 1.0 if rendu_complet() else part_du_soleil_en_compatibilite


## Pose `lumiere` sur le plateau `plateau` (`vue.plateau` : `w` cases sur `h`, `metresParCase` mètres par case).
func eclairer(lumiere: Dictionary, plateau: Dictionary) -> void:
	var soleil: Variant = lumiere.soleil
	_soleil.visible = soleil != null
	if soleil != null:
		_soleil.basis = Basis.looking_at(MiseEnPage.sens_d_eclairage(Vector3(soleil.vers.x, soleil.vers.y, soleil.vers.z)))
		_soleil.light_color = Color(soleil.couleur)
		_soleil.light_energy = MiseEnPage.energie_du_soleil(soleil.energie, part_du_soleil())
	_environnement.ambient_light_color = Color(lumiere.ambiante.couleur)
	_environnement.ambient_light_energy = lumiere.ambiante.energie
	_environnement.tonemap_white = lumiere.blanc
	var ciel: Variant = lumiere.ciel
	if ciel != null:
		var materiau := _environnement.sky.sky_material as ShaderMaterial
		materiau.set_shader_parameter("zenith", Color(ciel.zenith))
		materiau.set_shader_parameter("horizon", Color(ciel.horizon))
		materiau.set_shader_parameter("sol", Color(lumiere.brume.couleur))
		_environnement.background_mode = Environment.BG_SKY
		# Le ciel porte la brume à son horizon : la brume de profondeur, qui couvrirait ses nuages, ne le voile pas.
		_environnement.fog_sky_affect = 0.0
	else:
		_environnement.background_mode = Environment.BG_COLOR
		_environnement.background_color = Color(lumiere.brume.couleur)
		_environnement.fog_sky_affect = 1.0
	_environnement.fog_enabled = true
	_environnement.fog_light_color = Color(lumiere.brume.couleur)
	_environnement.volumetric_fog_enabled = rendu_complet()
	_brume = lumiere.brume
	_poser_le_hors_carte(lumiere.horsCarte, plateau)
	_poser_les_sources(lumiere.sources, plateau.metresParCase)


## Le sol du hors-carte `hors_carte` (`horsCarte` de la vue) autour du plateau `plateau`, qu'il déborde
## (`MiseEnPage.centre_du_hors_carte`, `etendue_du_hors_carte`) : sa matière habillée comme le dessus d'une case
## (`VolumeDeScene.texturer`) si sa texture est au projet, sinon sa couleur, comme une case, effacée dans le fond en
## `fonduCases` cases depuis le bord, ou dans la seule brume ; aucun sans sol.
func _poser_le_hors_carte(hors_carte: Dictionary, plateau: Dictionary) -> void:
	_hors_carte.visible = hors_carte.sol != null
	if hors_carte.sol == null:
		return
	var taille := Vector2i(plateau.w, plateau.h)
	var texture := TexturesDeMatiere.retenue(VolumeDeScene.texture_de(hors_carte.sol.matiere))
	_hors_carte.position = MiseEnPage.centre_du_hors_carte(taille)
	_hors_carte.scale = MiseEnPage.etendue_du_hors_carte(taille)
	sol_hors_carte.set_shader_parameter("albedo_texture", null)
	sol_hors_carte.set_shader_parameter("normal_enabled", false)
	VolumeDeScene.texturer(sol_hors_carte, hors_carte.sol.matiere, texture, false)
	sol_hors_carte.set_shader_parameter("teinte", Color.WHITE if texture != null else Color(hors_carte.sol.couleur))
	sol_hors_carte.set_shader_parameter("metres_par_case", plateau.metresParCase)
	sol_hors_carte.set_shader_parameter("plateau", Vector2(taille))
	sol_hors_carte.set_shader_parameter("fondu_cases", 0.0 if hors_carte.fonduCases == null else hors_carte.fonduCases)


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
## (`brume.depuisLOeil`), et s'épaissit à la puissance `brume.courbe`.
func _process(_delta: float) -> void:
	if _brume.is_empty():
		return
	var distance := 0.0 if _brume.depuisLOeil else get_viewport().get_camera_3d().position.z
	_environnement.fog_depth_begin = MiseEnPage.profondeur_de_brume(distance, _brume.debutCases)
	_environnement.fog_depth_end = MiseEnPage.profondeur_de_brume(distance, _brume.finCases)
	_environnement.fog_depth_curve = _brume.courbe
