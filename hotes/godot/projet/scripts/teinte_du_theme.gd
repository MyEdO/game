## Les teintes d'un matériau lues au thème (#3935) : chaque paramètre de `teintes` du matériau du contrôle qui porte ce
## nœud, son parent, reçoit la couleur `Dessin` du thème du projet que sa valeur nomme ; le thème reste seul à porter
## les couleurs.
class_name TeinteDuTheme
extends Node

## Paramètre du matériau → jeton `Dessin/colors` du thème.
@export var teintes: Dictionary


func _ready() -> void:
	var materiau := (get_parent() as CanvasItem).material as ShaderMaterial
	var theme := ThemeDB.get_project_theme()
	for parametre in teintes:
		materiau.set_shader_parameter(parametre, theme.get_color(StringName(teintes[parametre]), Dessin.TYPE))
