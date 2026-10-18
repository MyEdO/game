## Jeton d'un combattant sur la carte : affiche la vue du pont, anime le déplacement.
class_name Unite
extends Node2D

const DUREE_PAS_S := 0.16
const OPACITE_HORS_DE_COMBAT := 0.35

@export var texture_heros: Texture2D
@export var texture_adversaires: Texture2D

@onready var _jeton: Sprite2D = $Jeton
@onready var _selection: Sprite2D = $Selection
@onready var _nom: Label = $Nom
@onready var _blessures: ProgressBar = $Blessures


func configurer(combattant: Dictionary) -> void:
	_jeton.texture = texture_heros if combattant.camp == "heros" else texture_adversaires
	mettre_a_jour(combattant, false)


func mettre_a_jour(combattant: Dictionary, actif: bool) -> void:
	_nom.text = combattant.libelle
	_blessures.max_value = maxf(1.0, combattant.blessuresMax)
	_blessures.value = combattant.blessures
	_selection.visible = actif and not combattant.horsDeCombat
	if combattant.horsDeCombat:
		modulate.a = OPACITE_HORS_DE_COMBAT
		z_index = -1


## Parcourt `points` (positions locales, départ compris) case par case.
func parcourir(points: Array[Vector2]) -> void:
	var tween := create_tween()
	for p in points.slice(1):
		tween.tween_property(self, "position", p, DUREE_PAS_S)
	await tween.finished
