## La bulle d'un élément (#3328) : le contrôle qui couvre son composant et porte son `detail` (`tooltip_text`, posé par
## une `Liaison`), montré au survol dans la bulle à pointe du thème (`composants/bulleAPointe.tscn`, la bulle de refus
## des maquettes, `propositions/sources/gestes.css`), au-dessus du contrôle, centrée (`MiseEnPage.bulle_au_dessus`) ou
## alignée à sa droite (`a_droite`), repliée au mot à la largeur de `MiseEnPage.largeur_de_bulle` : la bulle par défaut
## de Godot se pose sous le pointeur et ne se replie pas, et un détail long sortirait de l'écran.
class_name Bulle
extends Control

const BULLE := preload("res://composants/bulleAPointe.tscn")
const BULLE_A_DROITE := preload("res://composants/bulleADroite.tscn")

## La bulle alignée à droite du contrôle, sa pointe près de son bord droit : le contrôle d'une rangée qui se range à
## droite (les règles du registre des options, `propositions/sources/accueil-et-systeme/options.css`).
@export var a_droite := false


## Aucune bulle sans texte : Godot demande la bulle d'un contrôle qui la dessine lui-même, même sans `tooltip_text`.
func _make_custom_tooltip(texte: String) -> Object:
	if texte.is_empty():
		return null
	var bulle := (BULLE_A_DROITE if a_droite else BULLE).instantiate() as Control
	var etiquette := bulle.get_node("Corps/Texte") as Label
	etiquette.text = texte
	var police := get_theme_font(&"font", &"TooltipLabel")
	var taille := get_theme_font_size(&"font_size", &"TooltipLabel")
	etiquette.custom_minimum_size.x = MiseEnPage.largeur_de_bulle(police.get_multiline_string_size(texte, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x)
	_poser.call_deferred(bulle)
	return bulle


## La fenêtre de la bulle sans le fond du thème (sa pointe dépasse son corps), posée au-dessus du contrôle.
func _poser(bulle: Control) -> void:
	var fenetre := bulle.get_window()
	fenetre.theme_type_variation = &"BulleAPointe"
	if a_droite:
		var coin := Vector2(get_global_rect().end.x, get_global_rect().position.y)
		fenetre.position = Vector2i(MiseEnPage.bulle_au_dessus_a_droite(coin, fenetre.size.x, fenetre.size.y))
	else:
		var haut := Vector2(get_global_rect().get_center().x, get_global_rect().position.y)
		fenetre.position = Vector2i(MiseEnPage.bulle_au_dessus(haut, fenetre.size.x, fenetre.size.y))
