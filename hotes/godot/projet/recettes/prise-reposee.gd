extends SceneTree

## Un objet tenu se monte à chaque prise et se range à son emplacement (#3319, `hotes/godot/pont/CONTRAT.md`,
## section « Atelier 3D ») : le montage d'une composition (`scripts/montage_de_composition.gd`, `_poser_la_piece`)
## repose un mesh rigide pendu à l'os de sa prise d'origine. Sur un squelette à deux mains d'orientations différentes,
## le mesh garde, dans le repère de la prise retenue, la place qu'il avait dans celui de sa prise d'origine ; à sa
## propre prise, il garde sa place sous son os. Rangé à un emplacement du bassin, à plat, sa prise a la tête vers le bas
## du personnage et la paume sur la normale sortante, sa poignée sur l'emplacement, et sa boîte au jeu de la peau
## sans rien d'autre sous lui ; posé sur une ceinture et un vêtement qui bombe plus bas, il pend du haut de sa boîte au
## jeu de la ceinture et penche, le bas vers le dehors, jusqu'au jeu du bombé ; un sommet hors de sa largeur ne compte
## pas. Plus long que la hauteur de son emplacement au-dessus du sol, il passe en bandoulière, le fer en haut penché vers
## la droite du personnage, son milieu sur l'emplacement (`MiseEnPage.repere_de_rangement`).

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
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
	_verifier_les_appuis()
	_verifier_la_bandouliere()
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
	montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, cible)
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
		var arriere := (en_prise * piece.get_aabb()).position.x
		var poignee_attendue := os * (point + sortante * (MiseEnPage.JEU_DE_RANGEMENT - arriere))
		juste = _proches(prise.basis.y, os.basis * bas) and _proches(prise.basis.x, os.basis * sortante) and _proches(prise.origin, poignee_attendue)
		if not juste:
			_fautes.append("%s : prise Y %s X %s, poignée %s ; attendus %s, %s, %s" % [cible, prise.basis.y, prise.basis.x, prise.origin,
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


## Un objet rangé sur le flanc +X d'un os droit, sa boîte de 4 cm de large en Z, du haut à 10 cm au-dessus de la poignée au
## bas à 30 cm dessous : une ceinture saille de 2 cm à 9 cm au-dessus de la poignée, un bombé de 6 cm à 20 cm dessous,
## et un sommet très saillant est hors de sa largeur.
func _verifier_les_appuis() -> void:
	var point := Vector3(0.15, 0.0, 0.0)
	var boite := AABB(Vector3(-0.01, -0.1, -0.02), Vector3(0.02, 0.4, 0.04))
	var ceinture := Vector3(0.17, 0.09, 0.0)
	var bombe := Vector3(0.21, -0.2, 0.0)
	var appuis := PackedVector3Array([ceinture, bombe, Vector3(0.65, 0.0, 0.2)])
	var obtenu := MiseEnPage.repere_de_rangement(Basis.IDENTITY, point, boite, appuis)
	var jeu := MiseEnPage.JEU_DE_RANGEMENT
	var pivot := obtenu * Vector3(boite.position.x, boite.position.y, 0.0)
	var angle := atan((0.06 - 0.02) / 0.3)
	var pivot_attendu := Vector3(0.15 + 0.02 + jeu, 0.1, 0.0)
	var au_bombe := (bombe - pivot).dot(obtenu.basis.x)
	var juste := _proches(pivot, pivot_attendu) and absf(au_bombe + jeu * cos(angle)) < EPSILON \
			and (ceinture - pivot).dot(obtenu.basis.x) < 0.0 and absf(obtenu.basis.y.angle_to(Vector3.DOWN) - angle) < EPSILON
	if not juste:
		_fautes.append("appuis : pivot %s, attendu %s ; bombé à %s de la face arrière ; axe Y %s" % [pivot, pivot_attendu, au_bombe, obtenu.basis.y])
	print("[prise-reposee] appuis : %s" % ("OK" if juste else "KO"))


## Un objet de 2 m rangé dans le dos, à 1,3 m du sol : en bandoulière, à plat, la paume vers l'arrière, son fer vers le haut
## penché vers la droite du personnage, le milieu de sa boîte sur l'emplacement, sa face arrière au jeu d'un sommet du
## dos sous lui ; un sommet plus saillant, hors de sa largeur, ne compte pas.
func _verifier_la_bandouliere() -> void:
	var point := Vector3(0.0, 0.1, -0.13)
	var boite := AABB(Vector3(-0.01, -0.1, -0.02), Vector3(0.02, 2.0, 0.04))
	var a := MiseEnPage.INCLINAISON_EN_BANDOULIERE
	var dehors := Vector3(0.0, 0.0, -1.0)
	var fer := Vector3(-sin(a), cos(a), 0.0)
	var cote := dehors.cross(fer)
	var appuis := PackedVector3Array([point - fer * 0.5 + dehors * 0.05, point + cote * 0.3 + dehors * 0.5])
	var obtenu := MiseEnPage.repere_de_rangement(Basis.IDENTITY, point, boite, appuis, 1.3, Vector3(-1.0, 0.0, 0.0))
	var milieu := obtenu * Vector3(boite.position.x, boite.get_center().y, boite.get_center().z)
	var milieu_attendu := point + dehors * (0.05 + MiseEnPage.JEU_DE_RANGEMENT)
	var juste := _proches(milieu, milieu_attendu) and _proches(obtenu.basis.x, dehors) and _proches(obtenu.basis.y, fer)
	if not juste:
		_fautes.append("bandoulière : milieu %s, attendu %s ; axes %s" % [milieu, milieu_attendu, obtenu.basis])
	print("[prise-reposee] bandoulière : %s" % ("OK" if juste else "KO"))

