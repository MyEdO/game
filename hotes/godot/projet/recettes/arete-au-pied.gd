extends SceneTree

## Une arête se pose debout à son pied (#3476, `hotes/godot/pont/CONTRAT.md`, méthode `aretes`) :
## `pied` et `hauteurM` sont en mètres, le volume de la scène (`scripts/volume_de_scene.gd`, `poser_les_aretes`) les
## porte à l'échelle de son plateau.
## Sur un plateau de 2 m par case, le mur d'étage du kit, pied à 4 m et haut de 4 m, va de 2 à 4 unités, et la boîte
## d'une arête sans pièce au kit part de 2 unités. Posées à nouveau (#3947), l'arête inchangée garde sa pièce, l'arête
## changée reçoit la sienne, l'arête partie la quitte.

const RECETTE_AUTONOME := true
const EPSILON := 0.001
const METRES_PAR_CASE := 2.0
const PIED_M := 4.0
const HAUTEUR_M := 4.0
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-au-pied] version=", Engine.get_version_info().string)
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	root.add_child(volume)
	volume.metres_par_case = METRES_PAR_CASE
	var arete := {milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = PIED_M, hauteurM = HAUTEUR_M, piece = "mur"}
	var du_kit := arete.merged({cle = "kit", famille = "colombage"})
	var sans_piece := arete.merged({cle = "boite", famille = null})
	volume.poser_les_aretes([du_kit, sans_piece, arete.merged({cle = "partie", famille = null})])
	var aretes := volume.get_node("Aretes")
	_verifier("pièce du kit", _boite_de(aretes.get_child(0)), PIED_M / METRES_PAR_CASE, (PIED_M + HAUTEUR_M) / METRES_PAR_CASE)
	_verifier("boîte sans pièce", _boite_de(aretes.get_child(1)), PIED_M / METRES_PAR_CASE, NAN)
	var posees := aretes.get_children().map(func(piece: Node) -> int: return piece.get_instance_id())
	volume.poser_les_aretes([du_kit.duplicate(true), sans_piece.merged({piece = "porte-ouverte"}, true)])
	var reposees := aretes.get_children().map(func(piece: Node) -> int: return piece.get_instance_id())
	if reposees.size() != 2 or not reposees.has(posees[0]):
		_fautes.append("posée à nouveau, l'arête inchangée ne garde pas sa pièce")
	if reposees.has(posees[1]) or reposees.has(posees[2]):
		_fautes.append("posées à nouveau, l'arête changée ou l'arête partie garde sa pièce")
	if aretes.get_children().map(func(piece: Node) -> String: return piece.get_meta("cle")) != ["kit", "boite"]:
		_fautes.append("posées à nouveau, les arêtes ne sont pas celles nommées")
	for faute in _fautes:
		push_error("[arete-au-pied] " + faute)
	print("[arete-au-pied] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La boîte, dans le monde, des maillages de `noeud` et de ses descendants.
func _boite_de(noeud: Node) -> AABB:
	var boite := AABB()
	var premiere := true
	for maillage: MeshInstance3D in ([noeud] + noeud.find_children("*", "MeshInstance3D", true, false)).filter(func(n: Node) -> bool: return n is MeshInstance3D):
		var b := maillage.global_transform * maillage.get_aabb()
		boite = b if premiere else boite.merge(b)
		premiere = false
	if premiere:
		_fautes.append("%s : aucun maillage" % noeud.name)
	return boite


## Le bas de `boite` à `bas`, et son haut à `haut` si `haut` n'est pas `NAN`.
func _verifier(nom: String, boite: AABB, bas: float, haut: float) -> void:
	if absf(boite.position.y - bas) > EPSILON:
		_fautes.append("%s : bas à %.3f, attendu %.3f" % [nom, boite.position.y, bas])
	if not is_nan(haut) and absf(boite.end.y - haut) > EPSILON:
		_fautes.append("%s : haut à %.3f, attendu %.3f" % [nom, boite.end.y, haut])
