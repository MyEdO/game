extends SceneTree

## Un objet tenu se monte à chaque prise et se range à son emplacement (#3319, `hotes/godot/pont/CONTRAT.md`,
## section « Atelier 3D ») : le montage d'une composition (`scripts/montage_de_composition.gd`, `_poser_la_piece`)
## repose un mesh rigide pendu à l'os de sa prise d'origine. Sur un squelette à deux mains d'orientations différentes,
## le mesh garde, dans le repère de la prise retenue, la place qu'il avait dans celui de sa prise d'origine ; à sa
## propre prise, il garde sa place sous son os. Rangé à un emplacement du bassin, sa prise a la tête vers le bas du
## personnage, à plat, sa face arrière à `JEU_DE_RANGEMENT` de ce qui est porté dessous, de l'emplacement sans rien
## dessous ; un second objet au même point se range à côté du premier, vers l'avant du personnage. Un fourreau
## (`extras.fourreau`) n'est montré que rangé. Un objet qui pendrait jusqu'au sol passe en bandoulière, le fer en haut
## penché vers la droite du personnage, le milieu de sa boîte sur l'emplacement.

const RECETTE_AUTONOME := true
const EPSILON := 0.0001
const MAIN := {id = "main", genre = "prise", attache = {os = "main_d", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFF := {id = "secondaire", genre = "prise", attache = {os = "main_g", position = [0.02, 0.09, 0.003], rotation = [1.32, 3.1, 0.03]}}
const CEINTURE := {id = "ceinture_avant", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.148, 0.108], rotation = [-0.29, 0.0, 0.0]}}
const DOS := {id = "dos", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.3, -0.13], rotation = [0.0, 0.0, 0.0]}}
const HANCHE := {id = "ceinture_g", genre = "emplacement", attache = {os = "bassin", position = [0.15, 0.117, 0.0], rotation = [-0.29, 0.0, 0.0]}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[prise-reposee] version=", Engine.get_version_info().string)
	for cible in ["secondaire", "main", "ceinture_avant"]:
		await _verifier(cible)
	await _verifier_cote_a_cote()
	await _verifier_l_empilement()
	await _verifier_l_appui()
	await _verifier_la_bandouliere()
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
	var gaine := MeshInstance3D.new()
	gaine.name = "Fourreau"
	gaine.mesh = BoxMesh.new()
	gaine.set_meta("extras", {fourreau = true})
	import.add_child(gaine)
	montage.call("_poser_la_piece", gaine, ["main_d"] as Array[String], squelette, cible + "#2" if cible == "ceinture_avant" else cible)
	montage.call("_ranger")
	await process_frame
	await process_frame
	if gaine.visible != (cible == "ceinture_avant"):
		_fautes.append("%s : fourreau %s" % [cible, "monté" if gaine.visible else "caché"])
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
		var cotes := _cotes(piece, os * point, os.basis * sortante, os.basis * bas.cross(sortante))
		juste = _proches(prise.basis.y, os.basis * bas) and absf(cotes.arriere - MiseEnPage.JEU_DE_RANGEMENT) < EPSILON \
				and cotes.epaisseur <= cotes.largeur + EPSILON
		if not juste:
			_fautes.append("%s : prise Y %s, attendu %s ; face arrière à %.4f de l'emplacement, attendue à %.4f ; épaisseur %.3f, largeur %.3f"
				% [cible, prise.basis.y, os.basis * bas, cotes.arriere, MiseEnPage.JEU_DE_RANGEMENT, cotes.epaisseur, cotes.largeur])
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


## Deux objets rangés au même point de la hanche, `ceinture_g` puis `ceinture_g#2` : le second vers l'avant du
## personnage (+Z du squelette), ses sommets hors de l'étendue angulaire du premier autour de l'axe de l'os.
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
	var os: Node3D = pieces[0].get_parent().get_parent().get_parent()
	var azimuts := pieces.map(func(piece: MeshInstance3D) -> Vector2: return _azimuts(MontageDeComposition._sommets(piece, os)))
	var ecart: float = maxf(azimuts[1].x - azimuts[0].y, azimuts[0].x - azimuts[1].y)
	var centres := pieces.map(func(piece: MeshInstance3D) -> Vector3: return squelette.to_local(piece.global_transform * piece.get_aabb().get_center()))
	var avant: float = centres[1].z - centres[0].z
	var juste: bool = ecart > 0.0 and avant > 0.0
	if not juste:
		_fautes.append("côte à côte : écart angulaire %.4f rad (positif attendu), vers l'avant %.4f" % [ecart, avant])
	print("[prise-reposee] côte à côte : %s" % ("OK" if juste else "KO"))
	montage.free()
	squelette.queue_free()
	await process_frame


## Deux objets rangés au même point de la hanche, le second trop large pour tenir à côté du premier sans passer de
## l'autre côté du corps (`MiseEnPage.tour_dans_la_place`, #4254) : il s'empile sur le premier, son milieu sur la normale sortante
## de l'emplacement, sa face arrière au-dessus de la face avant du premier.
func _verifier_l_empilement() -> void:
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
		boite.size = Vector3(0.2 + 0.6 * rang, 0.25, 0.08)
		boite.subdivide_width = 16
		boite.subdivide_height = 4
		piece.mesh = boite
		piece.transform = _repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.0, 0.12, 0.04))
		import.add_child(piece)
		montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, "ceinture_g" if rang == 0 else "ceinture_g#2")
		pieces.append(piece)
	montage.call("_ranger")
	await process_frame
	var os := squelette.global_transform * squelette.get_bone_global_pose(squelette.find_bone("bassin"))
	var emplacement := _repere(HANCHE.attache)
	var sortante := Vector3(emplacement.origin.x, 0.0, emplacement.origin.z).normalized()
	var bas := -emplacement.basis.y
	bas = (bas - sortante * bas.dot(sortante)).normalized()
	var cotes := pieces.map(func(piece: MeshInstance3D) -> Dictionary: return _cotes(piece, os * emplacement.origin, os.basis * sortante, os.basis * bas.cross(sortante)))
	var dessus: float = cotes[1].arriere - (cotes[0].arriere + cotes[0].epaisseur)
	var milieu := os.affine_inverse() * (pieces[1].global_transform * pieces[1].get_aabb().get_center()) - emplacement.origin
	var hors_normale := absf(milieu.dot(bas.cross(sortante)))
	var juste := dessus > 0.0 and hors_normale < 0.001
	if not juste:
		_fautes.append("empilement : face arrière du second à %.4f de la face avant du premier (positive attendue), milieu à %.4f de la normale"
			% [dessus, hors_normale])
	print("[prise-reposee] empilement : %s" % ("OK" if juste else "KO"))
	montage.free()
	squelette.queue_free()
	await process_frame


## L'étendue angulaire (min, max), autour de l'axe Y de leur os, des sommets `sommets` dans le repère de cet os.
static func _azimuts(sommets: PackedVector3Array) -> Vector2:
	var etendue := Vector2(INF, -INF)
	for v in sommets:
		var azimut := atan2(v.x, v.z)
		etendue = Vector2(minf(etendue.x, azimut), maxf(etendue.y, azimut))
	return etendue


## Les cotes des sommets de `piece`, au monde, depuis `origine` : `arriere`, la plus petite sur `normale`, `epaisseur` et
## `largeur`, leurs étendues sur `normale` et sur `tangente`.
func _cotes(piece: MeshInstance3D, origine: Vector3, normale: Vector3, tangente: Vector3) -> Dictionary:
	var sommets := piece.global_transform * (piece.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX] as PackedVector3Array)
	var sur_n := Array(sommets).map(func(v: Vector3) -> float: return (v - origine).dot(normale))
	var sur_t := Array(sommets).map(func(v: Vector3) -> float: return (v - origine).dot(tangente))
	return {arriere = sur_n.min(), epaisseur = sur_n.max() - sur_n.min(), largeur = sur_t.max() - sur_t.min()}


## Un objet rangé à `ceinture_g` sur une plaque skinnée au bassin dont la face sortante passe à 5 cm de l'emplacement : sa
## face arrière à `JEU_DE_RANGEMENT` au-dessus de la plaque.
func _verifier_l_appui() -> void:
	var squelette := _squelette()
	var bassin := squelette.get_bone_global_rest(squelette.find_bone("bassin"))
	var emplacement := _repere(HANCHE.attache)
	var sortante := Vector3(emplacement.origin.x, 0.0, emplacement.origin.z).normalized()
	var bas := -emplacement.basis.y
	bas = (bas - sortante * bas.dot(sortante)).normalized()
	var plaque := BoxMesh.new()
	plaque.size = Vector3(0.6, 0.6, 0.02)
	plaque.subdivide_width = 4
	plaque.subdivide_height = 4
	var dans_l_os := Transform3D(Basis(bas.cross(sortante), -bas, sortante), emplacement.origin + sortante * 0.04 + bas * 0.2)
	var tableaux := plaque.surface_get_arrays(0)
	tableaux[Mesh.ARRAY_VERTEX] = (bassin * dans_l_os) * (tableaux[Mesh.ARRAY_VERTEX] as PackedVector3Array)
	var maille := ArrayMesh.new()
	maille.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
	var porte := MeshInstance3D.new()
	porte.mesh = maille
	porte.skin = Skin.new()
	porte.skin.add_named_bind("bassin", bassin.affine_inverse())
	var montage := MontageDeComposition.new()
	montage.base = {points = [HANCHE, MAIN, OFF]}
	montage.squelette = squelette
	montage.set("_pieces_de_la_base", [porte] as Array[MeshInstance3D])
	var import := BoneAttachment3D.new()
	import.bone_name = "main_d"
	squelette.add_child(import)
	var piece := MeshInstance3D.new()
	var boite := BoxMesh.new()
	boite.size = Vector3(0.2, 0.25, 0.08)
	piece.mesh = boite
	piece.transform = _repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.0, 0.14, 0.04))
	import.add_child(piece)
	montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, "ceinture_g")
	montage.call("_ranger")
	await process_frame
	var os := squelette.global_transform * squelette.get_bone_global_pose(squelette.find_bone("bassin"))
	var arriere: float = _cotes(piece, os * emplacement.origin, os.basis * sortante, os.basis * bas.cross(sortante)).arriere
	var attendue := 0.05 + MiseEnPage.JEU_DE_RANGEMENT
	var juste := absf(arriere - attendue) < 0.001
	if not juste:
		_fautes.append("appui : face arrière à %.4f de l'emplacement, attendue à %.4f" % [arriere, attendue])
	print("[prise-reposee] appui : %s" % ("OK" if juste else "KO"))
	porte.free()
	montage.free()
	squelette.queue_free()
	await process_frame


## Une hampe de 2 m rangée dans le dos, à 1,25 m du sol : en bandoulière, son +Y de prise (le fer) vers le haut, penché de
## `INCLINAISON_EN_BANDOULIERE` vers la droite du personnage (-X du squelette) dans le plan de l'emplacement, le milieu
## de sa boîte sur la normale sortante de l'emplacement.
func _verifier_la_bandouliere() -> void:
	var squelette := _squelette()
	var montage := MontageDeComposition.new()
	montage.base = {points = [DOS, MAIN, OFF]}
	montage.squelette = squelette
	var import := BoneAttachment3D.new()
	import.bone_name = "main_d"
	squelette.add_child(import)
	var piece := MeshInstance3D.new()
	var boite := BoxMesh.new()
	boite.size = Vector3(0.04, 2.0, 0.03)
	piece.mesh = boite
	var local := _repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.0, 0.6, 0.0))
	piece.transform = local
	import.add_child(piece)
	montage.call("_poser_la_piece", piece, ["main_d"] as Array[String], squelette, "dos")
	montage.call("_ranger")
	await process_frame
	var os := squelette.global_transform * squelette.get_bone_global_pose(squelette.find_bone("bassin"))
	var emplacement := _repere(DOS.attache)
	var sortante := Vector3(emplacement.origin.x, 0.0, emplacement.origin.z).normalized()
	var bas := -emplacement.basis.y
	bas = (bas - sortante * bas.dot(sortante)).normalized()
	var en_prise := _repere(MAIN.attache).affine_inverse() * local
	var fer := os.basis.inverse() * (piece.global_transform * en_prise.affine_inverse()).basis.y.normalized()
	var droite := os.basis.inverse() * Vector3.LEFT
	var penche := fer.angle_to(-bas)
	var milieu := os.affine_inverse() * (piece.global_transform * piece.get_aabb().get_center()) - emplacement.origin
	var hors_normale := (milieu - sortante * milieu.dot(sortante)).length()
	var juste := absf(penche - MiseEnPage.INCLINAISON_EN_BANDOULIERE) < 0.001 and fer.dot(droite) > 0.0 \
			and absf(fer.dot(sortante)) < 0.001 and hors_normale < 0.001
	if not juste:
		_fautes.append("bandoulière : fer penché de %.4f rad (attendu %.4f), vers la droite %.4f, sur la normale %.4f ; milieu à %.4f de la normale"
			% [penche, MiseEnPage.INCLINAISON_EN_BANDOULIERE, fer.dot(droite), fer.dot(sortante), hors_normale])
	print("[prise-reposee] bandoulière : %s" % ("OK" if juste else "KO"))
	montage.free()
	squelette.queue_free()
	await process_frame
