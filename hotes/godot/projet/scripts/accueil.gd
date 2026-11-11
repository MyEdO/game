## Le menu d'entrée de l'hôte (#3086) : un bouton vers le combat, un vers l'atelier, un vers l'éditeur de carte (#3508).
## Mis en page, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit. L'adresse
## d'une planche (`?planche=<nom>`, #3935) pose à sa place le pont qui la montre (`PontDePlanche`).
extends CenterContainer

## @contrat Écran publié
## L'entrée de l'application est un menu (`scenes/Accueil.tscn`, `run/main_scene`) à trois boutons, « Combat »,
## « Atelier » et « Éditeur ».

@onready var _pont: PontDuNoyau = get_node("/root/Pont")


func _ready() -> void:
	$Menu/Combat.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Combat.tscn"))
	$Menu/Atelier.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Atelier.tscn"))
	$Menu/Editeur.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Editeur.tscn"))
	if not _pont.est_web:
		return
	await get_tree().process_frame
	if _pont.parametre("planche") != "":
		PontDuNoyau.remplacer(get_tree(), PontDePlanche.new())
		return
	_pont.publier_l_ecran(func() -> Dictionary: return {boutons = PontDuNoyau.boutons_a_l_ecran([self])})
