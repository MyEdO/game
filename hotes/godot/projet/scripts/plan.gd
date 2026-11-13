## Le plan d'un élément `plan` (#3534, `src/hote/elements.ts`) : chaque trait d'un point à l'autre et chaque point à sa
## position dans le contrôle (`MiseEnPage.point_du_plan`), chacun à la couleur de son ton (`font_color` de la variation
## du thème qui porte ce nom), à l'épaisseur du thème (`epaisseur` de `Plan`) et au rayon de son ton (`rayon` de la
## variation du ton quand elle en porte un, sinon celui de `Plan`) ; sous chaque point, son composant (`point`), que la
## zone imbriquée du plan dessine, posé par `MiseEnPage.sous_le_point`. `points` et `traits` se posent par une `Liaison`.
class_name Plan
extends Container

## @contrat Éditeur
## Un plan dont le composant nomme un `pointeur` (`projet/scripts/plan.gd`, `pointeur = &"edition"` au composant
## `projet/composants/planDeLEditeur.tscn`, la forme du `Plan` de la zone `editeur.carte`) joue le bouton gauche sur
## son cadre, par sa zone imbriquée (`Zone.geste`) que la zone de l'écran relaie, en `{ <pointeur>: { geste: 'appui' |
## 'glisse' | 'relache', point: { case: { x, y }, f: { x, y } } } }` : `f`, le point `(u, v)` du cadre 0..1 du plan
## multiplié par `UNITES_DU_PLAN_DE_CARTE` (100), hors du cadre compris, `case`, sa partie entière ; l'appui au point
## appuyé, un glissé à chaque case nouvelle sous le bouton tenu, le relâché toujours, au point relâché, sur le plan ou
## hors de lui. Sans `pointeur`, le plan ne joue rien de son pointeur.

## Les unités que vaut le côté du cadre au pointeur (`UNITES_DU_PLAN_DE_CARTE`, `src/noyau/edition/pointeur.ts`).
const UNITES := 100.0

@export var points: Array = []:
	set(valeur):
		points = valeur
		queue_redraw()
		queue_sort()
@export var traits: Array = []:
	set(valeur):
		traits = valeur
		queue_redraw()
## La clé de l'intention que joue le pointeur sur le plan ; vide, il n'en joue aucune.
@export var pointeur: StringName = &""

## La case du cadre sous le bouton tenu, `null` relâché.
var _tenu: Variant = null


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
			fit_child_in_rect(composant, Rect2(MiseEnPage.sous_le_point(centre, _rayon(p.ton), taille.x, taille.y, size.x, size.y), taille))


func _draw() -> void:
	var places := {}
	for p in points:
		places[p.id] = MiseEnPage.point_du_plan(size, float(p.x), float(p.y))
	for t in traits:
		draw_line(places[t.de], places[t.vers], _couleur(t.ton), get_theme_constant(&"epaisseur", &"Plan"), true)
	for p in points:
		draw_circle(places[p.id], _rayon(p.ton), _couleur(p.ton), true, -1.0, true)


## La couleur du ton `ton` : celle du texte de sa variation du thème.
func _couleur(ton: String) -> Color:
	return get_theme_color(&"font_color", StringName(ton) if ton != "neutre" else &"Label")


## Le rayon d'un point de ton `ton` : celui de la variation du thème qui porte ce nom, sinon celui de `Plan`.
func _rayon(ton: String) -> int:
	return get_theme_constant(&"rayon", StringName(ton)) if has_theme_constant(&"rayon", StringName(ton)) else get_theme_constant(&"rayon", &"Plan")


func _gui_input(event: InputEvent) -> void:
	if pointeur == &"":
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_tenu = point_sous(event.position).case
			_jouer("appui", event.position)
		elif _tenu != null:
			_tenu = null
			_jouer("relache", event.position)
		else:
			return
	elif event is InputEventMouseMotion and _tenu != null:
		var point := point_sous(event.position)
		if point.case == _tenu:
			return
		_tenu = point.case
		_jouer("glisse", event.position)
	else:
		return
	accept_event()


## Le geste `geste` du pointeur au point `ou` du contrôle, joué par la zone imbriquée du plan.
func _jouer(geste: String, ou: Vector2) -> void:
	($Zone as Zone).geste.emit({String(pointeur): {geste = geste, point = point_sous(ou)}})


## Le point du cadre sous le point `ou` du contrôle (`MiseEnPage.point_sous_le_plan`), en `UNITES` : `f`, et `case`,
## sa partie entière (`MiseEnPage.case_du_point`).
func point_sous(ou: Vector2) -> Dictionary:
	var f := MiseEnPage.point_sous_le_plan(size.x, size.y, ou, UNITES)
	var c := MiseEnPage.case_du_point(f)
	return {case = {x = c.x, y = c.y}, f = {x = f.x, y = f.y}}


## Le cadre 0..1 du plan à l'écran : le contrôle sans la marge du plan (`MiseEnPage.MARGE_DU_PLAN`).
func cadre() -> Rect2:
	return get_global_rect().grow(-MiseEnPage.MARGE_DU_PLAN)
