extends SceneTree

## Un objet tenu se monte à chaque prise et se range à son emplacement (#3319, `hotes/godot/pont/CONTRAT.md`,
## section « Atelier 3D ») : le montage d'une composition (`scripts/montage_de_composition.gd`, `_poser_la_piece`)
## repose un mesh rigide pendu à l'os de sa prise d'origine. Sur un squelette à deux mains d'orientations différentes,
## le mesh garde, dans le repère de la prise retenue, la place qu'il avait dans celui de sa prise d'origine ; à sa
## propre prise, il garde sa place sous son os. Rangé à un emplacement du bassin, sa prise a la tête vers le bas du
## personnage et les jointures sur la normale sortante, sa poignée sur l'emplacement, et sa boîte à 5 cm de la peau ;
## un second objet au même point se range à côté du premier, vers l'avant du personnage.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const DEGAGEMENT := 0.05
const MAIN := {id = "main", genre = "prise", attache = {os = "main_d", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFF := {id = "off", genre = "prise", attache = {os = "main_g", position = [0.02, 0.09, 0.003], rotation = [1.32, 3.1, 0.03]}}
const CEINTURE := {id = "ceinture_avant", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.148, 0.108], rotation = [-0.29, 0.0, 0.0]}}
const HANCHE := {id = "ceinture_g", genre = "emplacement", attache = {os = "bassin", position = [0.15, 0.117, 0.0], rotation = [-0.29, 0.0, 0.0]}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[prise-reposee] version=", Engine.get_version_info().string)
	for cible in ["off", "main", "ceinture_avant"]:
		await _verifier(cible)
	await _verifier_cote_a_cote()
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
	var montage := MontageDeComposition.new()
	montage.base = {points = [CEINTURE, MAIN, OFF]}
	montage.squelette = squelette
	montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, cible)
	montage.call("_ranger")
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
		var arriere := (en_prise * piece.get_aabb()).position.z
		var poignee_attendue := os * (point + sortante * (DEGAGEMENT - arriere))
		juste = _proches(prise.basis.y, os.basis * bas) and _proches(prise.basis.z, os.basis * sortante) and _proches(prise.origin, poignee_attendue)
		if not juste:
			_fautes.append("%s : prise Y %s Z %s, poignée %s ; attendus %s, %s, %s" % [cible, prise.basis.y, prise.basis.z, prise.origin,
				os.basis * bas, os.basis * sortante, poignee_attendue])
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
	montage.free()
	squelette.queue_free()
	await process_frame


## Deux objets rangés au même point de la hanche, `ceinture_g` puis `ceinture_g#2` : même orientation, le second vers
## l'avant du personnage (+Z du squelette), sa boîte à `JEU_ENTRE_RANGES` de celle du premier sur l'axe X du rangement.
func _verifier_cote_a_cote() -> void:
	var squelette := _squelette()
	var montage := MontageDeComposition.new()
	montage.base = {points = [HANCHE, MAIN, OFF]}
	montage.squelette = squelette
	var pieces: Array[MeshInstance3D] = []
	for rang in 2:
		var import := BoneAttachment3D.new()
		import.bone_name = "main_d"
		squelette.add_child(import)
		var piece := MeshInstance3D.new()
		var boite := BoxMesh.new()
		boite.size = Vector3(0.2 - 0.08 * rang, 0.25, 0.08)
		piece.mesh = boite
		piece.transform = _repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.03 * rang, 0.12, 0.04))
		import.add_child(piece)
		montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, "ceinture_g" if rang == 0 else "ceinture_g#2")
		pieces.append(piece)
	montage.call("_ranger")
	await process_frame
	var premier: Node3D = pieces[0].get_parent().get_parent()
	var boites := pieces.map(func(piece: MeshInstance3D) -> AABB: return MontageDeComposition._boite(piece, premier))
	var ecart: float = boites[1].position.x - boites[0].end.x
	var avant: float = (pieces[1].global_transform * boites[1].get_center() - pieces[0].global_transform * boites[0].get_center()).z
	var meme_axe := _proches(pieces[0].global_basis.y, pieces[1].global_basis.y) and _proches(pieces[0].global_basis.z, pieces[1].global_basis.z)
	var juste: bool = meme_axe and absf(ecart - MontageDeComposition.JEU_ENTRE_RANGES) < EPSILON and avant > 0.0
	if not juste:
		_fautes.append("côte à côte : même axe %s, écart %.4f (attendu %.4f), vers l'avant %.4f" % [meme_axe, ecart, MontageDeComposition.JEU_ENTRE_RANGES, avant])
	print("[prise-reposee] côte à côte : %s" % ("OK" if juste else "KO"))
	montage.free()
	squelette.queue_free()
	await process_frame
