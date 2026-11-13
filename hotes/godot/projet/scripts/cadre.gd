## Le style d'un panneau à matière (#3935) : sous lui, son ombre portée (`ombre`, un style tracé dessous et hors du
## rectangle) ; puis une matière du projet (`matiere`, `projet/textures/<matiere>.jpg`, répétée et teintée de `teinte`,
## omise si le projet ne la porte pas) ; puis le cadre `cadre` du catalogue des dessins (`dessin.gd`, famille `cadre`) en
## neuf tranches, angles fixes, bords et centre répétés à un nombre entier de motifs. Le cadre est tracé à la finesse
## de l'écran (`mise_en_page.gd`, `echelle_de_dessin` de l'échelle de la fenêtre) et retracé quand la fenêtre change de taille :
## le style se dit changé, le thème le redit à chaque contrôle qui le porte. Ses marges de contenu sont celles du style, et
## sa taille minimale aussi : un `PanelContainer` retranche la taille minimale de son style de la place de son contenu.
## Un style à script vit dans un thème de portée (`art/ecran.tres`, `art/cartes.tres`), jamais dans celui du projet :
## `ThemeDB` le tient encore à la fermeture de GDScript.
class_name CadreDeMatiere
extends StyleBox

const FAMILLE := "cadre"

@export var cadre := ""
@export var matiere := ""
@export var teinte := Color.WHITE
@export var ombre: StyleBox

## La matière chargée, retenue par le style : le tracé ne garde que son RID, une texture que rien ne tient se libère
## avant lui.
var _matiere_tenue: Texture2D


func _draw(to_canvas_item: RID, rect: Rect2) -> void:
	if ombre:
		ombre.draw(to_canvas_item, rect)
	var texture_de_matiere := _matiere()
	if texture_de_matiere:
		RenderingServer.canvas_item_add_nine_patch(to_canvas_item, rect, Rect2(Vector2.ZERO, texture_de_matiere.get_size()), texture_de_matiere.get_rid(), Vector2.ZERO, Vector2.ZERO, RenderingServer.NINE_PATCH_TILE, RenderingServer.NINE_PATCH_TILE, true, teinte)
	var famille := Dessin.famille_du_catalogue(FAMILLE)
	var tranches: Array = famille.tranches[cadre]
	RenderingServer.canvas_item_add_nine_patch(to_canvas_item, rect, Rect2(0, 0, famille.largeur, famille.hauteur), _trace(famille).get_rid(), Vector2(tranches[0], tranches[1]), Vector2(tranches[2], tranches[3]), RenderingServer.NINE_PATCH_TILE_FIT, RenderingServer.NINE_PATCH_TILE_FIT, true)


func _get_draw_rect(rect: Rect2) -> Rect2:
	return ombre.get_draw_rect(rect) if ombre else rect


## Le cadre tracé à la finesse de l'écran, à la taille de son dessin (`set_size_override`) : ses tranches se lisent en
## unités du dessin, quelle que soit la finesse.
func _trace(famille: Dictionary) -> ImageTexture:
	var fenetre := (Engine.get_main_loop() as SceneTree).root
	if not fenetre.size_changed.is_connected(emit_changed):
		fenetre.size_changed.connect(emit_changed)
	var ecran := fenetre.get_final_transform().get_scale()
	var echelle := MiseEnPage.echelle_de_dessin(ecran.x, ecran.y, 1.0, 1.0)
	var trace := Dessin.trace(FAMILLE, [cadre], echelle)
	trace.set_size_override(Vector2i(Vector2(famille.largeur, famille.hauteur)))
	return trace


func _matiere() -> Texture2D:
	var chemin := "res://textures/%s.jpg" % matiere
	if matiere.is_empty() or not ResourceLoader.exists(chemin):
		return null
	_matiere_tenue = load(chemin)
	return _matiere_tenue
