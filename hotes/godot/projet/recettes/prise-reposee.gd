extends SceneTree

## Un objet tenu se monte à chaque prise (#3319, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier
## (`scripts/atelier.gd`, `_poser_la_piece`) repose un mesh rigide pendu à l'os de sa prise d'origine dans le repère de
## la prise retenue. Sur un squelette à deux mains d'orientations différentes, le mesh garde, dans le repère de la prise
## retenue, la place qu'il avait dans celui de sa prise d'origine ; à sa propre prise, il garde sa place sous son os.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const MAIN := {id = "main", genre = "prise", attache = {os = "main_d", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFF := {id = "off", genre = "prise", attache = {os = "main_g", position = [0.02, 0.09, 0.003], rotation = [1.32, 3.1, 0.03]}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[prise-reposee] version=", Engine.get_version_info().string)
	await _verifier("off")
	await _verifier("main")
	for faute in _fautes:
		push_error("[prise-reposee] " + faute)
	print("[prise-reposee] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le squelette à deux mains, posé dans l'arbre : `main_d` et `main_g` ont des repos d'orientations différentes.
func _squelette() -> Skeleton3D:
	var squelette := Skeleton3D.new()
	root.add_child(squelette)
	for os in [{nom = "main_d", repos = Transform3D(Basis.from_euler(Vector3(0.3, -0.8, 0.1)), Vector3(-0.4, 1.0, 0.05))},
			{nom = "main_g", repos = Transform3D(Basis.from_euler(Vector3(-0.5, 0.9, 1.2)), Vector3(0.4, 1.1, -0.02))}]:
		var indice := squelette.add_bone(os.nom)
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	return squelette


func _repere(attache: Dictionary) -> Transform3D:
	return Transform3D(Basis.from_euler(Vector3(attache.rotation[0], attache.rotation[1], attache.rotation[2])),
		Vector3(attache.position[0], attache.position[1], attache.position[2]))


func _verifier(cible: String) -> void:
	var squelette := _squelette()
	var import := BoneAttachment3D.new()
	import.bone_name = "main_d"
	squelette.add_child(import)
	var piece := MeshInstance3D.new()
	piece.name = "Lame"
	piece.transform = Transform3D(Basis.from_euler(Vector3(0.2, 0.4, -0.7)), Vector3(0.01, 0.12, -0.03))
	import.add_child(piece)
	var local := piece.transform
	var atelier: Node3D = load("res://scripts/atelier.gd").new()
	atelier.set("_base", {points = [MAIN, OFF]})
	atelier.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, cible)
	await process_frame
	await process_frame
	var os_cible := squelette.find_bone(MAIN.attache.os if cible == "main" else OFF.attache.os)
	var attendu := squelette.global_transform * squelette.get_bone_global_pose(os_cible)
	if cible == "main":
		attendu = attendu * local
	else:
		attendu = attendu * _repere(OFF.attache) * _repere(MAIN.attache).affine_inverse() * local
	var obtenu := piece.global_transform
	if not (obtenu.origin.is_equal_approx(attendu.origin) and obtenu.basis.x.distance_to(attendu.basis.x) < EPSILON
			and obtenu.basis.y.distance_to(attendu.basis.y) < EPSILON and obtenu.basis.z.distance_to(attendu.basis.z) < EPSILON):
		_fautes.append("%s : lame à %s, attendue à %s" % [cible, obtenu, attendu])
	print("[prise-reposee] %s : %s" % [cible, "OK" if _fautes.is_empty() else "KO"])
	atelier.free()
	squelette.queue_free()
	await process_frame
