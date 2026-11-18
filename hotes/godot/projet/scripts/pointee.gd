## Ce qui se déplie au survol (#3935) : le contrôle qui porte ce nœud, son parent, montre `deplie` tant que le pointeur
## est sur lui ou sur l'un de ses contrôles, et prend alors la variation `variation_pointee` du thème, sa variation de
## repos sinon.
class_name Pointee
extends Node

@export var deplie: Control
@export var variation_pointee: StringName

var _repos: StringName
var _pointee := true


func _ready() -> void:
	_repos = (get_parent() as Control).theme_type_variation
	_pointer(false)


func _input(evenement: InputEvent) -> void:
	if evenement is InputEventMouseMotion:
		var cible := get_parent() as Control
		_pointer(cible.is_visible_in_tree() and cible.get_global_rect().has_point((evenement as InputEventMouseMotion).position))


func _pointer(pointee: bool) -> void:
	if pointee == _pointee:
		return
	_pointee = pointee
	deplie.visible = pointee
	(get_parent() as Control).theme_type_variation = variation_pointee if pointee else _repos
