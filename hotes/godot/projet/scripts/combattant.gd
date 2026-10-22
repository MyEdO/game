## Un combattant du plateau : le modèle glTF de son camp animé par son `AnimationPlayer`, son nom et ses Points de
## Blessures (`pb`) en étiquette, l'anneau de l'actif ; il glisse vers sa nouvelle case, frappe vers une cible, accuse
## le coup qui le vise et tombe hors de combat.
class_name Combattant
extends Node3D

const DUREE_DEPLACEMENT_S := 0.45
const OPACITE_HORS_COMBAT := 0.35
const ANIMATION_REPOS := &"Idle"
const ANIMATION_MARCHE := &"Walking_A"
const ANIMATION_ATTAQUE := &"1H_Melee_Attack_Chop"
const ANIMATION_COUP := &"Hit_A"
const ANIMATION_MORT := &"Death_A"

@export var modele_heros: PackedScene
@export var modele_adversaires: PackedScene

@onready var _modele: Node3D = $Modele
@onready var _selection: MeshInstance3D = $Selection
@onready var _etiquette: Label3D = $Etiquette

var _animations: AnimationPlayer
var _hors_combat := false
var _deplacement: Tween


## `c` : un combattant projeté (`voisins`) ; `lieu` : le centre de sa case.
func configurer(c: Dictionary, lieu: Vector3) -> void:
	position = lieu
	var modele: Node3D = (modele_heros if c.camp == "hero" else modele_adversaires).instantiate()
	_modele.add_child(modele)
	_animations = modele.get_node("AnimationPlayer")
	for animation in [ANIMATION_REPOS, ANIMATION_MARCHE]:
		_animations.get_animation(animation).loop_mode = Animation.LOOP_LINEAR
	_animations.play(ANIMATION_REPOS)


func montrer(c: Dictionary, lieu: Vector3, actif: bool) -> void:
	_etiquette.text = "%s\n%d / %d" % [c.nom, int(c.pb[0]), int(c.pb[1])]
	_selection.visible = actif and not c.horsCombat
	if c.horsCombat and not _hors_combat:
		_hors_combat = true
		_animations.clear_queue()
		_animations.play(ANIMATION_MORT)
		_etiquette.modulate.a = OPACITE_HORS_COMBAT
	if not lieu.is_equal_approx(position):
		_aller(lieu)


## Tourné vers `cible` (une position du plateau), il frappe.
func agir_vers(cible: Vector3) -> void:
	_tourner_vers(cible)
	_jouer_puis_repos(ANIMATION_ATTAQUE)


## Visé par un coup, il l'accuse, s'il tient encore debout.
func subir() -> void:
	if not _hors_combat:
		_jouer_puis_repos(ANIMATION_COUP)


func _aller(lieu: Vector3) -> void:
	_tourner_vers(lieu)
	if _deplacement != null:
		_deplacement.kill()
	_animations.play(ANIMATION_MARCHE)
	_deplacement = create_tween()
	_deplacement.tween_property(self, "position", lieu, DUREE_DEPLACEMENT_S)
	_deplacement.tween_callback(_reposer)


func _reposer() -> void:
	if not _hors_combat:
		_animations.play(ANIMATION_REPOS)


func _tourner_vers(cible: Vector3) -> void:
	if not cible.is_equal_approx(position):
		_modele.look_at(cible, Vector3.UP, true)


func _jouer_puis_repos(animation: StringName) -> void:
	_animations.clear_queue()
	_animations.play(animation)
	_animations.queue(ANIMATION_REPOS)
