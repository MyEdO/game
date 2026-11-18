## Feuilleter (#3935) : le bouton qui porte ce nœud, son parent, montre l'onglet à `pas` du courant dans le
## `TabContainer` qui le contient (un feuillet du registre des règles), fermé quand il n'y en a pas ; `masque`, ce
## qui se cache alors avec lui.
class_name Feuilleter
extends Node

@export var pas := 1
@export var masque: Control


func _ready() -> void:
	var bouton := get_parent() as BaseButton
	bouton.pressed.connect(func() -> void: _onglets().current_tab += pas)
	_onglets().tab_changed.connect(_poser.unbind(1))
	_onglets().child_order_changed.connect(_poser)
	_poser.call_deferred()


## L'onglet de la page qui porte le bouton, et le bouton fermé ou caché au bout des onglets.
func _poser() -> void:
	var onglets := _onglets()
	var page := get_parent() as Node
	while page.get_parent() != onglets:
		page = page.get_parent()
	var vise := onglets.get_tab_idx_from_control(page as Control) + pas
	var ouvert := vise >= 0 and vise < onglets.get_tab_count()
	var bouton := get_parent() as BaseButton
	bouton.disabled = not ouvert
	if masque != null:
		masque.visible = ouvert


func _onglets() -> TabContainer:
	var n := get_parent()
	while not n is TabContainer:
		n = n.get_parent()
	return n
