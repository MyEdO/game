## La bulle d'un élément (#3328) : le contrôle qui couvre son composant et porte son `detail` (`tooltip_text`, posé par
## une `Liaison`), montré au survol dans la bulle du thème (`TooltipLabel`), replié au mot à la largeur de
## `MiseEnPage.largeur_de_bulle` : la bulle par défaut de Godot ne se replie pas, et un détail long sortirait de l'écran.
class_name Bulle
extends Control


func _make_custom_tooltip(texte: String) -> Object:
	var etiquette := Label.new()
	etiquette.theme_type_variation = &"TooltipLabel"
	etiquette.text = texte
	etiquette.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var police := get_theme_font(&"font", &"TooltipLabel")
	var taille := get_theme_font_size(&"font_size", &"TooltipLabel")
	etiquette.custom_minimum_size.x = MiseEnPage.largeur_de_bulle(police.get_multiline_string_size(texte, HORIZONTAL_ALIGNMENT_LEFT, -1, taille).x)
	return etiquette
