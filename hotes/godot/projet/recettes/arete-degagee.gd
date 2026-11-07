extends SceneTree

## Une arête que le groupe dégage tombe sous les crans de caméra qui la nomment (#3476, `hotes/godot/pont/CONTRAT.md`,
## section « Vue », `plateau.aretesDegagees`, `abattueSous`) : celle qui borde l'espace dégagé tombe quand la caméra la
## voit du dehors, et reste debout de l'autre côté ; celle qui se dresse au-dessus d'une tête tombe sous tout regard, avec
## sa couronne. Un demi-tour de la caméra relève le mur abattu et abat celui d'en face.

const RECETTE_AUTONOME := true
## Deux murs est-ouest de part et d'autre d'une pièce (y de 0 à 2), abattus sous les crans que le noyau leur donne
## (`aretes.test.ts`) : le premier, au nord, vu du nord-ouest et du nord-est ; le second, au sud, vu du sud-est et du
## sud-ouest ; et un troisième au-dessus d'une tête.
const NORD := {cle = "nord", milieu = {x = 0.0, y = -0.5}, abattueSous = [2, 3]}
const SUD := {cle = "sud", milieu = {x = 0.0, y = 1.5}, abattueSous = [0, 1]}
const DESSUS := {cle = "dessus", milieu = {x = 3.0, y = -0.5}, abattueSous = [0, 1, 2, 3]}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-degagee] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.poser_les_aretes([NORD, SUD, DESSUS].map(func(a: Dictionary) -> Dictionary:
		return {cle = a.cle, milieu = a.milieu, sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 2.0, piece = "mur", famille = null}))
	monde.poser_les_nappes([], [{cle = "dessus", positions = [], normales = [], couleurs = [], surfaces = []}])
	monde.cacher_le_bati([], [], [NORD, SUD, DESSUS].map(func(a: Dictionary) -> Dictionary: return {cle = a.cle, abattueSous = a.abattueSous}))
	_verifier(monde, "de face")
	var pivot: Node3D = monde.get_node("Pivot")
	pivot.rotation.y += PI
	monde._abattre_les_aretes()
	_verifier(monde, "après un demi-tour")
	for faute in _fautes:
		push_error("[arete-degagee] " + faute)
	print("[arete-degagee] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Sous le regard courant : le mur que la caméra voit du dehors abattu, l'autre debout ; le mur au-dessus d'une tête et
## sa couronne abattus.
func _verifier(monde: Monde, moment: String) -> void:
	var camera := monde.get_viewport().get_camera_3d().global_position.z
	var aretes := {}
	for piece in monde.get_node("Aretes").get_children():
		aretes[piece.get_meta("cle")] = piece.visible
	var au_nord := camera < NORD.milieu.y + MiseEnPage.DEMI_CASE
	if aretes.nord == au_nord:
		_fautes.append("%s : le mur nord %s, la caméra %s" % [moment, "debout" if aretes.nord else "abattu", "au nord" if au_nord else "au sud"])
	if aretes.sud != au_nord:
		_fautes.append("%s : le mur sud %s, la caméra %s" % [moment, "debout" if aretes.sud else "abattu", "au nord" if au_nord else "au sud"])
	if aretes.dessus:
		_fautes.append("%s : le mur au-dessus d'une tête est debout" % moment)
	if (monde.get_node("Volume/Couronnes").get_child(0) as Node3D).visible:
		_fautes.append("%s : la couronne du mur au-dessus d'une tête est debout" % moment)
