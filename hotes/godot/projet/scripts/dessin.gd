## Le dessin d'un élément (#3935, `Icone`, `Fond` et `Paysage` de `src/hote/elements.ts`) : celui que l'élément nomme par
## son id, ou ceux qu'il nomme en liste, tracés l'un sur l'autre dans l'ordre (les couches d'un paysage),
## lu au catalogue des dessins (`CATALOGUE`, déposé à la construction, `hotes/godot/asset/dessins.ts`), tracé aux
## couleurs du thème (`Dessin` : `encre` pour `currentColor`, puis la couleur du nom de chaque jeton `var(--<jeton>)`,
## ses tirets en soulignés) et posé en texture sur l'image qui le porte, son parent, à la finesse de sa taille
## (`MiseEnPage.echelle_de_dessin`). Un dessin tracé à une taille ne se retrace pas.
class_name Dessin
extends Node

const CATALOGUE := "res://art/dessins.json"
const TYPE := &"Dessin"

static var _catalogue := {}
static var _traces := {}


func poser(element: Dictionary) -> void:
	var cible := get_parent() as TextureRect
	if _catalogue.is_empty():
		_catalogue = JSON.parse_string(FileAccess.get_file_as_string(CATALOGUE))
	var famille: Dictionary = _catalogue[element.type]
	var nommes: Variant = element[element.type]
	var couches: Array = nommes if nommes is Array else [nommes]
	var echelle := MiseEnPage.echelle_de_dessin(cible.custom_minimum_size.x, cible.custom_minimum_size.y, famille.largeur, famille.hauteur)
	var cle := "%s/%s@%s" % [element.type, "+".join(couches), echelle]
	if not _traces.has(cle):
		_traces[cle] = _tracer(cible, famille, "".join(couches.map(func(couche: Variant) -> String: return str(famille.dessins[couche]))), echelle)
	cible.texture = _traces[cle]


func _tracer(cible: Control, famille: Dictionary, dessin: String, echelle: float) -> ImageTexture:
	dessin = dessin.replace("currentColor", "#" + cible.get_theme_color(&"encre", TYPE).to_html(false))
	for jeton in ThemeDB.get_project_theme().get_color_list(TYPE):
		dessin = dessin.replace("var(--%s)" % jeton.replace("_", "-"), "#" + cible.get_theme_color(jeton, TYPE).to_html(false))
	if dessin.contains("var(--"):
		push_error("dessin : un jeton sans couleur au thème (%s) dans %s" % [TYPE, dessin.substr(dessin.find("var(--"), 24)])
	var image := Image.new()
	image.load_svg_from_string('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">%s</svg>' % [famille.largeur, famille.hauteur, dessin], echelle)
	return ImageTexture.create_from_image(image)
