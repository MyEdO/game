## Une source de lumière (`vue.lumiere.sources`, `CONTRAT.md`, section « Lumière ») posée à son foyer : sa lampe, qui vacille
## si son ton vacille, ce qu'elle montre (#3783 : le feu et sa fumée, la flammèche, la lueur), la scène de son visuel
## sous `res://effets/flammes/` posée en continu (`Effets.pose_continue`), et le son qu'elle joue en boucle à son point.
## Posée à nouveau (`poser`), la même flamme et le même son restent, sans repartir de zéro (#3947).
class_name Foyer
extends Node3D

## Le temps que le serveur audio relâche la lecture du son en boucle d'un foyer libéré.
const SON_LIBERE_S := 0.5
## La part de la lampe que diffuse le brouillard volumétrique (`projet/scenes/Lumiere.tscn`) : son halo.
const HALO := 5.0
## Le préfixe de la clé d'une source portée (`SourceDeLumiere.cle`, `CONTRAT.md`, section « Lumière »).
const PORTEE := "portee/"

var _lampe := OmniLight3D.new()
var _energie := 0.0
var _scintillement: Variant = null
## Ce que le foyer montre et joue : son visuel, sa couleur, l'échelle du plateau et son son (`poser`).
var _montre: Array = []
## La flamme et le son posés, `null` sans eux.
var _flamme: Node3D = null
var _son: AudioStreamPlayer3D = null


func _init() -> void:
	_lampe.shadow_enabled = true
	_lampe.light_volumetric_fog_energy = HALO
	_lampe.shadow_caster_mask &= ~VolumeDeScene.COUCHE_DES_LUMINAIRES
	add_child(_lampe)


## Pose la source `source` sur un plateau de `metres_par_case` mètres par case : sa lampe de `rayonCases` cases, ses
## flamme à l'échelle du plateau, son son en boucle ; la flamme et le son déjà posés restent s'ils sont les mêmes. La
## lampe d'une source portée ne reçoit l'ombre d'aucun corps (`MontageDeComposition.CALQUE`).
func poser(source: Dictionary, metres_par_case: float) -> void:
	_lampe.omni_range = source.rayonCases
	_lampe.light_color = Color(source.couleur)
	_lampe.light_energy = source.energie
	if str(source.cle).begins_with(PORTEE):
		_lampe.shadow_caster_mask &= ~MontageDeComposition.CALQUE
	_energie = source.energie
	_scintillement = source.scintillement
	var montre := [source.visuel, source.couleur, metres_par_case, source.son]
	if montre == _montre:
		return
	_montre = montre
	if _flamme != null:
		_flamme.free()
		_flamme = null
	if _son != null:
		_son.free()
		_son = null
	if source.visuel != null:
		_flamme = Effets.pose_continue(Effets.FAMILLE_DES_FLAMMES, source.visuel, Color(source.couleur))
		_flamme.name = source.visuel
		_flamme.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
		add_child(_flamme)
	if source.son != null:
		_son = Effets.son_en_boucle(source.son)
		add_child(_son)


## La lampe vacille, si son ton vacille.
func _process(_delta: float) -> void:
	if _scintillement == null:
		return
	_lampe.light_energy = MiseEnPage.energie_vacillante(_energie, _scintillement.amplitude, _scintillement.hz, MiseEnPage.secondes(Time.get_ticks_msec()))
