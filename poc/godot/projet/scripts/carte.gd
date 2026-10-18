## Disposition d'un combat (taille, cases bloquantes, départs par camp), éditable dans l'inspecteur et
## lue par les deux plateaux.
class_name Carte
extends Resource

@export var taille := Vector2i(12, 12)
@export var bloquantes: Array[Vector2i] = []
@export var departs_heros: Array[Vector2i] = []
@export var departs_adversaires: Array[Vector2i] = []


func cases() -> Array[Vector2i]:
	var resultat: Array[Vector2i] = []
	for y in taille.y:
		for x in taille.x:
			resultat.append(Vector2i(x, y))
	return resultat


func contient(case: Vector2i) -> bool:
	return Rect2i(Vector2i.ZERO, taille).has_point(case)


func est_bloquante(case: Vector2i) -> bool:
	return bloquantes.has(case)


func departs(camp: String) -> Array[Vector2i]:
	return departs_heros if camp == "heros" else departs_adversaires
