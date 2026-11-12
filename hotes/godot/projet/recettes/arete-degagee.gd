extends SceneTree

## Une arête que le groupe dégage tombe sous les crans de caméra qui la nomment (#3476, `hotes/godot/pont/CONTRAT.md`,
## section « Vue », `plateau.aretesDegagees`, `abattueSous`) : celle qui borde l'espace dégagé tombe quand la caméra la
## voit du dehors, et reste debout de l'autre côté ; celle qui se dresse au-dessus d'une tête tombe sous tout regard, avec
## sa couronne. Un demi-tour de la caméra relève le mur abattu et abat celui d'en face. Les crans arrivent par le JSON,
## comme du pont, en nombres réels. Un mur abattu sort du compte visible des instances vues de son groupe, et ses
## instances en ombre seule restent entières (#3948).

const RECETTE_AUTONOME := true
## Deux murs est-ouest de part et d'autre d'une pièce (y de 0 à 2), abattus sous les crans que le noyau leur donne
## (`aretes.test.ts`) : le premier, au nord, vu du nord-ouest et du nord-est ; le second, au sud, vu du sud-est et du
## sud-ouest ; et un troisième au-dessus d'une tête. Chacun dans son bloc, donc dans son groupe.
const NORD := {cle = "nord", milieu = {x = 0.0, y = -0.5}, bloc = "0/0/0", abattueSous = [2, 3]}
const SUD := {cle = "sud", milieu = {x = 0.0, y = 1.5}, bloc = "0/0/1", abattueSous = [0, 1]}
const DESSUS := {cle = "dessus", milieu = {x = 3.0, y = -0.5}, bloc = "0/1/0", abattueSous = [0, 1, 2, 3]}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-degagee] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	monde.volume.poser_les_aretes([NORD, SUD, DESSUS].map(func(a: Dictionary) -> Dictionary:
		return {cle = a.cle, milieu = a.milieu, sens = {x = 1.0, y = 0.0}, pied = 0.0, hauteurM = 2.0, piece = "mur", famille = null, bloc = a.bloc}))
	var couronne := {cle = "dessus", empreinte = "dessus", positions = [], normales = [], couleurs = [], cases = [], surfaces = []}
	monde.volume.poser({monde = {metresParCase = 1.0, hauteurs = [], morceaux = []}, toits = [], couronnes = [couronne]}, {volume = [], toits = [], couronnes = [couronne]})
	monde.cacher_le_bati([], [], JSON.parse_string(JSON.stringify([NORD, SUD, DESSUS].map(func(a: Dictionary) -> Dictionary: return {cle = a.cle, abattueSous = a.abattueSous}))))
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
	for groupe: Node3D in monde.get_node("VolumeDeScene/Aretes").get_children():
		aretes[groupe.get_meta("aretes")[0].cle] = _debout(groupe, moment)
	var au_nord := camera < NORD.milieu.y + MiseEnPage.DEMI_CASE
	if aretes.nord == au_nord:
		_fautes.append("%s : le mur nord %s, la caméra %s" % [moment, "debout" if aretes.nord else "abattu", "au nord" if au_nord else "au sud"])
	if aretes.sud != au_nord:
		_fautes.append("%s : le mur sud %s, la caméra %s" % [moment, "debout" if aretes.sud else "abattu", "au nord" if au_nord else "au sud"])
	if aretes.dessus:
		_fautes.append("%s : le mur au-dessus d'une tête est debout" % moment)
	var couronne: Node3D = monde.get_node("VolumeDeScene/Volume/Couronnes").get_child(0)
	if couronne.get_node("Vu").is_visible_in_tree():
		_fautes.append("%s : la couronne du mur au-dessus d'une tête est debout" % moment)


## Si la caméra voit le mur seul du groupe `groupe` : l'instance de chaque maillage vu au compte visible ; abattu ou
## debout, ses instances en ombre seule (`SHADOWS_ONLY`) projettent toutes (recette `ombres-du-regard.gd`).
func _debout(groupe: Node3D, moment: String) -> bool:
	var vus := groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)
	var ombres := groupe.find_children("Ombre_*", "MultiMeshInstance3D", true, false)
	if vus.is_empty() or ombres.size() != vus.size():
		_fautes.append("%s : le groupe %s n'a pas une instance vue et une en ombre seule par maillage" % [moment, groupe.name])
	for ombre: MultiMeshInstance3D in ombres:
		if not ombre.is_visible_in_tree() or ombre.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY or ombre.multimesh.visible_instance_count != -1 or ombre.multimesh.instance_count != 1:
			_fautes.append("%s : %s/%s ne projette pas son mur" % [moment, groupe.name, ombre.name])
	return vus.all(func(vu: MultiMeshInstance3D) -> bool: return vu.is_visible_in_tree() and vu.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF and vu.multimesh.visible_instance_count == 1)
