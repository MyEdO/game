## La touche d'un élément (`touche` d'un `Bouton` ou d'une `Ligne`, `src/hote/elements.ts`) : une `Liaison` qui écrit,
## au lieu du nom de l'action d'entrée, la touche que l'`InputMap` lui lie, celle de son premier événement de clavier
## (`as_text_physical_keycode`) ; `null` : vide.
extends Liaison


func _ecrire(cible: Node, valeur: Variant) -> void:
	var texte: Variant = null
	if valeur != null:
		for evenement in InputMap.action_get_events(valeur):
			if evenement is InputEventKey:
				texte = (evenement as InputEventKey).as_text_physical_keycode()
				break
	super(cible, texte)
