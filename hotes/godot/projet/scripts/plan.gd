## Le plan d'un élément `plan` (#3534, `src/hote/elements.ts`) : chaque trait d'un point à l'autre et chaque point à sa
## position dans le contrôle (`MiseEnPage.point_du_plan`), chacun à la couleur de son ton (`font_color` de la variation
## du thème qui porte ce nom) ; sous chaque point, son composant (`point`), que la zone imbriquée du plan dessine, posé
## par `MiseEnPage.sous_le_point`. `points` et `traits` se posent par une `Liaison`.
class_name Plan
extends Container

const EPAISSEUR := 3.0

@export var points: Array = []:
	set(valeur):
		points = valeur
		queue_redraw()
		queue_sort()
@export var traits: Array = []:
	set(valeur):
		traits = valeur
		queue_redraw()


func _notification(quoi: int) -> void:
	if quoi == NOTIFICATION_SORT_CHILDREN:
		var composants := {}
		for enfant in get_children():
			if enfant.has_meta(Zone.META):
				composants[enfant.get_meta(Zone.META)] = enfant
		for p in points:
			var composant: Control = composants[Zone.cle(p)]
			var taille := composant.get_combined_minimum_size()
			var centre := MiseEnPage.point_du_plan(size, float(p.x), float(p.y))
			fit_child_in_rect(composant, Rect2(MiseEnPage.sous_le_point(centre, taille.x, taille.y, size.x, size.y), taille))


func _draw() -> void:
	var places := {}
	for p in points:
		places[p.id] = MiseEnPage.point_du_plan(size, float(p.x), float(p.y))
	for t in traits:
		draw_line(places[t.de], places[t.vers], _couleur(t.ton), EPAISSEUR, true)
	for p in points:
		draw_circle(places[p.id], MiseEnPage.RAYON_DU_POINT, _couleur(p.ton))


## La couleur du ton `ton` : celle du texte de sa variation du thème.
func _couleur(ton: String) -> Color:
	return get_theme_color(&"font_color", StringName(ton) if ton != "neutre" else &"Label")
