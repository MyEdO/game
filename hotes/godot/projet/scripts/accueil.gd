## Le menu d'entrée de l'hôte (#3086) : un bouton vers le jeu (#3009), un vers le combat d'un scénario de test, un vers
## l'atelier, un vers l'éditeur de carte (#3508).
## Mis en page, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit. Le paramètre
## `planche` (`PontDuNoyau.parametre`, #3935) pose à sa place le pont qui montre cette planche (`PontDePlanche`).
extends CenterContainer

## @contrat Écran publié
## L'entrée de l'application est un menu (`scenes/Accueil.tscn`, `run/main_scene`) à quatre boutons : « Jouer », qui
## ouvre une partie au groupe (`ouvrir`, `PontDuNoyau.au_groupe`), « Combat », qui démarre un scénario de test,
## « Atelier » et « Éditeur ».

@onready var _pont: PontDuNoyau = get_node("/root/Pont")


func _ready() -> void:
	$Menu/Jouer.pressed.connect(func() -> void:
		_pont.au_groupe = true
		get_tree().change_scene_to_file("res://scenes/Combat.tscn"))
	$Menu/Combat.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Combat.tscn"))
	$Menu/Atelier.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Atelier.tscn"))
	$Menu/Editeur.pressed.connect(get_tree().change_scene_to_file.bind("res://scenes/Editeur.tscn"))
	await get_tree().process_frame
	if _pont.parametre("planche") != "":
		PontDuNoyau.remplacer(get_tree(), PontDePlanche.new())
		return
	_pont.publier_l_ecran(func() -> Dictionary: return {boutons = PontDuNoyau.boutons_a_l_ecran([self])})
