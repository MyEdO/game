extends SceneTree

## Un objet tenu se monte à chaque prise et se range à son emplacement (#3319, `hotes/godot/pont/CONTRAT.md`, section
## « Atelier 3D ») : l'atelier (`scripts/atelier.gd`, `_poser_la_piece`) repose un mesh rigide pendu à l'os de sa prise
## d'origine. Sur un squelette à deux mains d'orientations différentes, le mesh garde, dans le repère de la prise retenue,
## la place qu'il avait dans celui de sa prise d'origine ; à sa propre prise, il garde sa place sous son os. Rangé à un
## emplacement du bassin, sa prise a la tête vers le bas du personnage et les jointures sur la normale sortante, et sa
## boîte est centrée sur l'emplacement, à 1 cm de la peau.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const DEGAGEMENT := 0.01
const MAIN := {id = "main", genre = "prise", attache = {os = "main_d", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFF := {id = "off", genre = "prise", attache = {os = "main_g", position = [0.02, 0.09, 0.003], rotation = [1.32, 3.1, 0.03]}}
const CEINTURE := {id = "ceinture_avant", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.148, 0.108], rotation = [-0.29, 0.0, 0.0]}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[prise-reposee] version=", Engine.get_version_info().string)
	for cible in ["off", "main", "ceinture_avant"]:
		await _verifier(cible)
	for faute in _fautes:
		push_error("[prise-reposee] " + faute)
	print("[prise-reposee] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le squelette à deux mains et un bassin, posé dans l'arbre : `main_d` et `main_g` ont des repos d'orientations
## différentes, le bassin est penché.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	root.add_child(squelette)
	for os in [{nom = "main_d", repos = Transform3D(Basis.from_euler(Vector3(0.3, -0.8, 0.1)), Vector3(-0.4, 1.0, 0.05))},
			{nom = "main_g", repos = Transform3D(Basis.from_euler(Vector3(-0.5, 0.9, 1.2)), Vector3(0.4, 1.1, -0.02))},
			{nom = "bassin", repos = Transform3D(Basis.from_euler(Vector3(0.28, 0.1, 0.0)), Vector3(0.0, 0.95, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	return squelette


## Le repère d'une attache selon le contrat (`hotes/godot/asset/attache.ts`) : R = Rx·Ry·Rz, composée ici axe par axe.
func _repere(attache: Dictionary) -> Transform3D:
	var r: Array = attache.rotation
	return Transform3D(Basis(Vector3.RIGHT, r[0]) * Basis(Vector3.UP, r[1]) * Basis(Vector3.BACK, r[2]),
		Vector3(attache.position[0], attache.position[1], attache.position[2]))


func _proches(a: Vector3, b: Vector3) -> bool:
	return a.distance_to(b) < EPSILON


func _verifier(cible: String) -> void:
	var squelette := _squelette()
	var import := BoneAttachment3D.new()
	import.bone_name = "main_d"
	squelette.add_child(import)
	var piece := MeshInstance3D.new()
	piece.name = "Lame"
	var boite := BoxMesh.new()
	boite.size = Vector3(0.12, 0.03, 0.5)
	piece.mesh = boite
	piece.transform = Transform3D(Basis.from_euler(Vector3(0.2, 0.4, -0.7)), Vector3(0.01, 0.12, -0.03))
	import.add_child(piece)
	var local := piece.transform
	var atelier: Node3D = load("res://scripts/atelier.gd").new()
	atelier.set("_base", {points = [CEINTURE, MAIN, OFF]})
	atelier.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, cible)
	await process_frame
	await process_frame
	var juste: bool
	var obtenu := piece.global_transform
	if cible == "ceinture_avant":
		var os := squelette.global_transform * squelette.get_bone_global_pose(squelette.find_bone("bassin"))
		var emplacement := _repere(CEINTURE.attache)
		var point := emplacement.origin
		var sortante := Vector3(point.x, 0.0, point.z).normalized()
		var bas := -emplacement.basis.y
		bas = (bas - sortante * bas.dot(sortante)).normalized()
		var en_prise := _repere(MAIN.attache).affine_inverse() * local
		var prise := obtenu * en_prise.affine_inverse()
		var boite_en_prise := en_prise * piece.get_aabb()
		var centre := prise * boite_en_prise.get_center()
		var centre_attendu := os * (point + sortante * (DEGAGEMENT + boite_en_prise.size.z / 2.0))
		juste = _proches(prise.basis.y, os.basis * bas) and _proches(prise.basis.z, os.basis * sortante) and _proches(centre, centre_attendu)
		if not juste:
			_fautes.append("%s : prise Y %s Z %s, centre %s ; attendus %s, %s, %s" % [cible, prise.basis.y, prise.basis.z, centre,
				os.basis * bas, os.basis * sortante, centre_attendu])
	else:
		var os_cible := squelette.find_bone(MAIN.attache.os if cible == "main" else OFF.attache.os)
		var attendu := squelette.global_transform * squelette.get_bone_global_pose(os_cible)
		if cible == "main":
			attendu = attendu * local
		else:
			attendu = attendu * _repere(OFF.attache) * _repere(MAIN.attache).affine_inverse() * local
		juste = _proches(obtenu.origin, attendu.origin) and _proches(obtenu.basis.x, attendu.basis.x) \
				and _proches(obtenu.basis.y, attendu.basis.y) and _proches(obtenu.basis.z, attendu.basis.z)
		if not juste:
			_fautes.append("%s : lame à %s, attendue à %s" % [cible, obtenu, attendu])
	print("[prise-reposee] %s : %s" % [cible, "OK" if juste else "KO"])
	atelier.free()
	squelette.queue_free()
	await process_frame
