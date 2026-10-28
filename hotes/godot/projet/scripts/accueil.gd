## Le menu d'entrée de l'hôte (#3086) : un bouton vers le combat, un vers l'atelier. Mis en page, il publie à la page ce
## que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit.
extends CenterContainer

@onready var _pont: PontDuNoyau = get_node("/root/Pont")


func _ready() -> void:
	$Menu/Combat.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Combat.tscn"))
	$Menu/Atelier.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Atelier.tscn"))
	if not _pont.est_web:
		return
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([self])})
