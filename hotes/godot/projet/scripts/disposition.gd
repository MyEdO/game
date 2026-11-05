## La disposition de la fenêtre (#3328) : la scène d'éditeur, sans script, qui range les zones de la fenêtre qui tient
## la main. Celle que la vue nomme (`vue.disposition`, `res://ecrans/<disposition>.tscn`) quand elle existe, sinon la
## générique (`GENERIQUE`) ; elle s'instancie sous le parent de ce nœud et remplace la précédente.
class_name Disposition
extends Node

const GENERIQUE := "res://ecrans/fenetre.tscn"

## Le chemin de la scène posée, `""` avant la première.
var scene := ""
var _posee: Node = null


## La scène de `disposition` posée (`null` : la générique) ; vrai si elle a remplacé la précédente, ses zones neuves.
func disposer(disposition: Variant) -> bool:
	var chemin := GENERIQUE
	if disposition != null and ResourceLoader.exists("res://ecrans/%s.tscn" % disposition):
		chemin = "res://ecrans/%s.tscn" % disposition
	if chemin == scene:
		return false
	if _posee != null:
		_posee.get_parent().remove_child(_posee)
		_posee.queue_free()
	_posee = load(chemin).instantiate()
	get_parent().add_child(_posee)
	scene = chemin
	return true
