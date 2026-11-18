## Une icône de thème tracée au catalogue des dessins (#3935, `Dessin`) : la texture qu'un thème de portée nomme là où
## Godot attend une icône (le curseur d'une glissière, la flèche d'une liste), le dessin `dessin` de la famille
## `icone` tracé à `taille` de côté, aux couleurs `Dessin` du thème, une fois.
class_name IconeDuCatalogue
extends Texture2D

@export var dessin := ""
@export var taille := 16


func _get_width() -> int:
	return taille


func _get_height() -> int:
	return taille


func _has_alpha() -> bool:
	return true


func _draw(to_canvas_item: RID, pos: Vector2, modulate: Color, transpose: bool) -> void:
	_trace().draw(to_canvas_item, pos, modulate, transpose)


func _draw_rect(to_canvas_item: RID, rect: Rect2, tile: bool, modulate: Color, transpose: bool) -> void:
	_trace().draw_rect(to_canvas_item, rect, tile, modulate, transpose)


func _draw_rect_region(to_canvas_item: RID, rect: Rect2, src_rect: Rect2, modulate: Color, transpose: bool, clip_uv: bool) -> void:
	var trace := _trace()
	var echelle := Vector2(trace.get_size()) / float(taille)
	trace.draw_rect_region(to_canvas_item, rect, Rect2(src_rect.position * echelle, src_rect.size * echelle), modulate, transpose, clip_uv)


## Le dessin tracé à la finesse de l'écran, assez fin pour `taille` à toute échelle de la fenêtre.
func _trace() -> ImageTexture:
	var famille := Dessin.famille_du_catalogue("icone")
	var ecran := (Engine.get_main_loop() as SceneTree).root.get_final_transform().get_scale()
	return Dessin.trace("icone", [dessin], MiseEnPage.echelle_de_dessin(taille * ecran.x, taille * ecran.y, famille.largeur, famille.hauteur))
