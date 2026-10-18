## Nom et barre de Blessures d'un combattant, au-dessus de son jeton 2D ou de son modèle 3D.
class_name Etiquette
extends Control

@onready var _nom: Label = $Nom
@onready var _blessures: ProgressBar = $Blessures


func afficher(combattant: Dictionary) -> void:
	_nom.text = combattant.libelle
	_blessures.max_value = maxf(1.0, combattant.blessuresMax)
	_blessures.value = combattant.blessures
