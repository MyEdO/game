## Les marques des États d'un combattant (`vue.marques`, `CONTRAT.md`, section « Vue », #3834), posées au sol de son
## porteur : le texte de chacune à sa teinte, l'une au-dessus de l'autre (`MiseEnPage.point_de_la_marque`), les gerbes
## continues de son visuel (`Foyer.FLAMMES`) et son son en boucle. Les mêmes marques ne changent rien.
class_name MarquesDEtats
extends Node3D

## La taille (px) du texte d'une marque.
const TAILLE_DE_LA_MARQUE := 28

## Les textes des marques posées, dans leur ordre.
var _textes: Array = []


## Pose les marques `marques` (`MarqueDEtat[]`) sur un plateau de `metres_par_case` mètres par case, à la place des
## précédentes.
func montrer(marques: Array, metres_par_case: float) -> void:
	var textes := marques.map(func(m: Dictionary) -> String: return m.texte)
	if textes == _textes:
		return
	_textes = textes
	for posee in get_children():
		posee.queue_free()
	for rang in marques.size():
		var marque: Dictionary = marques[rang]
		var texte := Effets.etiquette(marque.texte, marque.couleur, TAILLE_DE_LA_MARQUE, metres_par_case)
		texte.name = "marque-%s" % marque.id
		texte.position = MiseEnPage.point_de_la_marque(rang, metres_par_case)
		add_child(texte)
		if marque.visuel != null:
			var visuel := Node3D.new()
			visuel.name = marque.visuel
			visuel.position = MiseEnPage.point_du_visuel_de_marque(metres_par_case)
			visuel.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
			add_child(visuel, true)
			for gerbe: Dictionary in Foyer.FLAMMES[marque.visuel]:
				visuel.add_child(Effets.gerbe_continue(gerbe, gerbe.taille, Color(marque.couleur)))
		if marque.son != null:
			add_child(Effets.son_en_boucle(marque.son), true)
