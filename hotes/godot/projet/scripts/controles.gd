## Les gestes communs aux écrans de l'hôte sur leurs contrôles.
class_name Controles
extends RefCounted


## `conteneur` vidé de ses enfants, retirés aussitôt et libérés en fin d'image.
static func vider(conteneur: Node) -> void:
	for enfant in conteneur.get_children():
		conteneur.remove_child(enfant)
		enfant.queue_free()
