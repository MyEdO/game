## La police de tout texte de l’hôte (#3498) : `art/police.tres`, sa base et ses replis, posée en police par défaut du
## thème au lancement. Le thème du projet ne la référence pas : l'import d'un projet neuf charge ce thème avant
## d'importer les polices.
## Chargé en autoload `Police` (`project.godot`).
extends Node


func _init() -> void:
	ThemeDB.get_project_theme().default_font = load("res://art/police.tres")
