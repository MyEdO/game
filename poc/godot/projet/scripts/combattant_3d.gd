## Modèle 3D d'un combattant (glTF de son camp, animé par son `AnimationPlayer`) : actif, hors de combat,
## étiquette, déplacement, attaque et coup reçu animés.
class_name Combattant3D
extends Node3D

const DUREE_PAS_S := 0.16
const FONDU_S := 0.15
const OPACITE_HORS_DE_COMBAT := 0.35
const ANIMATION_REPOS := &"Idle"
const ANIMATION_MARCHE := &"Walking_A"
const ANIMATION_ATTAQUE := &"1H_Melee_Attack_Chop"
const ANIMATION_COUP := &"Hit_A"
const ANIMATION_MORT := &"Death_A"

@export var modele_heros: PackedScene
@export var modele_adversaires: PackedScene

@onready var _modele: Node3D = $Modele
@onready var _selection: MeshInstance3D = $Selection
@onready var _etiquette: Etiquette = $Vue/Etiquette
@onready var _panneau: Sprite3D = $Panneau

var hors_de_combat := false
var _animations: AnimationPlayer
var _blessures := 0


func configurer(combattant: Dictionary) -> void:
	var modele: Node3D = (modele_heros if combattant.camp == "heros" else modele_adversaires).instantiate()
	_modele.add_child(modele)
	_animations = modele.get_node("AnimationPlayer")
	_animations.playback_default_blend_time = FONDU_S
	for animation in [ANIMATION_REPOS, ANIMATION_MARCHE]:
		_animations.get_animation(animation).loop_mode = Animation.LOOP_LINEAR
	_animations.play(ANIMATION_REPOS)
	_blessures = combattant.blessures
	mettre_a_jour(combattant, false)


func mettre_a_jour(combattant: Dictionary, actif: bool) -> void:
	_etiquette.afficher(combattant)
	_selection.visible = actif and not combattant.horsDeCombat
	if combattant.horsDeCombat and not hors_de_combat:
		hors_de_combat = true
		_animations.clear_queue()
		_animations.play(ANIMATION_MORT)
		_panneau.modulate.a = OPACITE_HORS_DE_COMBAT
	elif combattant.blessures < _blessures and not hors_de_combat:
		_jouer_puis_repos(ANIMATION_COUP)
	_blessures = combattant.blessures


## Tourne le modèle (avant = +Z, celui du glTF) vers `cible`, sur le plan du sol.
func regarder(cible: Vector3) -> void:
	var direction := cible - position
	if Vector2(direction.x, direction.z).length() > 0.01:
		_modele.rotation.y = atan2(direction.x, direction.z)


func attaquer(cible: Vector3) -> void:
	regarder(cible)
	_jouer_puis_repos(ANIMATION_ATTAQUE)


## Parcourt `points` (positions de monde, départ compris) case par case.
func parcourir(points: Array[Vector3]) -> void:
	_animations.play(ANIMATION_MARCHE)
	var tween := create_tween()
	for p in points.slice(1):
		tween.tween_callback(regarder.bind(p))
		tween.tween_property(self, "position", p, DUREE_PAS_S)
	await tween.finished
	_animations.play(ANIMATION_REPOS)


func _jouer_puis_repos(animation: StringName) -> void:
	_animations.clear_queue()
	_animations.play(animation)
	_animations.queue(ANIMATION_REPOS)
