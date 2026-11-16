## Le dessin d'un élément (#3935, `Icone`, `Fond` et `Paysage` de `src/hote/elements.ts`) : celui que l'élément nomme par
## son id, ou ceux qu'il nomme en liste, ou celui
## que la scène nomme elle-même (`nomme`, le dé d'un jet), tracés l'un sur l'autre dans l'ordre (les couches d'un paysage),
## lu au catalogue des dessins (`CATALOGUE`, déposé à la construction, `hotes/godot/asset/dessins.ts`), tracé aux
## couleurs du thème (`Dessin` : `encre` pour `currentColor`, puis la couleur du nom de chaque jeton `var(--<jeton>)`,
## ses tirets en soulignés) et posé en texture sur l'image qui le porte, son parent, à la finesse de sa taille
## (`MiseEnPage.echelle_de_dessin`), ou en icône du bouton qui le porte, à la taille de son icône (`icon_max_width`). Un dessin tracé à une taille ne se retrace pas. Le catalogue et les tracés servent
## aussi les cadres de panneau (`cadre.gd`).
class_name Dessin
extends Node

const CATALOGUE := "res://art/dessins.json"
const TYPE := &"Dessin"

static var _catalogue := {}
static var _traces := {}


## Le champ de l'élément qui nomme son dessin, et la famille du catalogue qui le tient : celui du nom de son type, ou
## `icone` pour un bouton ou un choix, dont l'icône est facultative (absente : sans dessin).
@export var champ := ""
## Le dessin de cette famille que la scène nomme, quel que soit l'élément ; vide : celui que l'élément nomme.
@export var nomme := ""


func poser(element: Dictionary) -> void:
	var cible := get_parent() as Control
	var type: String = champ if champ != "" else element.type
	var nommes: Variant = nomme if nomme != "" else element.get(type)
	var texture: ImageTexture = null
	if nommes != null:
		var famille := famille_du_catalogue(type)
		var cote := float(cible.get_theme_constant(&"icon_max_width", &"Button"))
		var taille := cible.custom_minimum_size if cible is TextureRect else Vector2(cote, cote)
		var couches: Array = nommes if nommes is Array else [nommes]
		texture = trace(type, couches, MiseEnPage.echelle_de_dessin(taille.x, taille.y, famille.largeur, famille.hauteur))
	if cible is Button:
		(cible as Button).icon = texture
	else:
		(cible as TextureRect).texture = texture


## Les dessins `couches` de la famille `type` tracés l'un sur l'autre à `echelle`, tracés une fois.
static func trace(type: String, couches: Array, echelle: float) -> ImageTexture:
	var cle := "%s/%s@%s" % [type, "+".join(couches), echelle]
	if not _traces.has(cle):
		var famille := famille_du_catalogue(type)
		_traces[cle] = tracer(famille, "".join(couches.map(func(couche: Variant) -> String: return str(famille.dessins[couche]))), echelle)
	return _traces[cle]


## La famille `type` du catalogue des dessins (`icone`, `fond`, `paysage`, `cadre`), lu une fois.
static func famille_du_catalogue(type: String) -> Dictionary:
	if _catalogue.is_empty():
		_catalogue = JSON.parse_string(FileAccess.get_file_as_string(CATALOGUE))
	return _catalogue[type]


## Le `dessin` d'une `famille` du catalogue tracé à `echelle`, aux couleurs `Dessin` du thème du projet, seul à les porter.
static func tracer(famille: Dictionary, dessin: String, echelle: float) -> ImageTexture:
	var theme := ThemeDB.get_project_theme()
	dessin = dessin.replace("currentColor", "#" + theme.get_color(&"encre", TYPE).to_html(false))
	for jeton in theme.get_color_list(TYPE):
		dessin = dessin.replace("var(--%s)" % jeton.replace("_", "-"), "#" + theme.get_color(jeton, TYPE).to_html(false))
	if dessin.contains("var(--"):
		push_error("dessin : un jeton sans couleur au thème (%s) dans %s" % [TYPE, dessin.substr(dessin.find("var(--"), 24)])
	var image := Image.new()
	image.load_svg_from_string('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d">%s</svg>' % [famille.largeur, famille.hauteur, dessin], echelle)
	return ImageTexture.create_from_image(image)
