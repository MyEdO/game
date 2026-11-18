## Feuilleter (#3935) : le bouton qui porte ce nœud, son parent, montre l'onglet à `pas` du courant dans le
## `TabContainer` qui le contient (un feuillet du registre des règles), fermé quand il n'y en a pas ; `masque`, ce
## qui se cache alors avec lui.
class_name Feuilleter
extends Node

@export var pas := 1
@export var masque: Control


func _ready() -> void:
	(get_parent() as BaseButton).pressed.connect(func() -> void: _onglets().current_tab = _vise())


## Les onglets suivis tant que le feuillet est dans l'arbre : sa zone le retire avant de libérer ses pages.
func _enter_tree() -> void:
	_onglets().tab_changed.connect(_au_changement)
	_onglets().child_order_changed.connect(_poser)
	_poser()


func _exit_tree() -> void:
	_onglets().tab_changed.disconnect(_au_changement)
	_onglets().child_order_changed.disconnect(_poser)


func _au_changement(_onglet: int) -> void:
	_poser()


## Le bouton fermé, et `masque` caché, quand aucun onglet n'est à `pas` de la page qui le porte.
func _poser() -> void:
	var ouvert := _vise() != -1
	(get_parent() as BaseButton).disabled = not ouvert
	if masque != null:
		masque.visible = ouvert


## Le rang de l'onglet à `pas` de la page qui porte le bouton, -1 au bout des onglets.
func _vise() -> int:
	var onglets := _onglets()
	var page := get_parent() as Node
	while page.get_parent() != onglets:
		page = page.get_parent()
	return int(MiseEnPage.onglet_a_pas(onglets.get_tab_idx_from_control(page as Control), pas, onglets.get_tab_count()))


func _onglets() -> TabContainer:
	var n := get_parent()
	while not n is TabContainer:
		n = n.get_parent()
	return n
