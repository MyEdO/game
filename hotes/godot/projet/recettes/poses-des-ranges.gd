extends SceneTree

## Le relevé des objets rangés (#4351, `outils/poses_des_ranges.gd`, `relever`) rend ce que le jeu pose : au repos, un
## objet rangé à une case qu'offre une pièce a sa face arrière à `JEU_DE_RANGEMENT` de la case ; à un instant d'un clip,
## la case suit le mélange de ses `poids` (`MontageDeComposition._suivre_les_poids`), et l'objet avec elle : sa
## transformation relevée est celle du repos portée par ce mélange, que la recette refait sur les os posés. Monté sur le
## corps du premier instant (`Outil.monter_sur_le_corps`), un objet rangé à la ceinture s'appuie sur la base cuite à ses
## morphes : la forme `GONFLE` avance de `AVANCEE` la face de la base sous l'emplacement, et l'objet d'autant.

const RECETTE_AUTONOME := true
const Outil := preload("res://outils/poses_des_ranges.gd")
const EPSILON := 0.0001
const CLIP := "Torsion"
const INSTANT := 0.5
const MAIN := {id = "main", genre = "prise", attache = {os = "main", position = [-0.02, 0.09, 0.003], rotation = [1.32, -3.1, -0.03]}}
const OFFERTE := {os = "torse", position = [0.0, 0.1, 0.12], rotation = [0.0, 0.0, 0.0], poids = {torse = 0.5, epaule = 0.5}}
const CASE := {id = "bandouliere", genre = "emplacement", attache = OFFERTE, offertPar = {sangle = OFFERTE}}
const TAILLE := Vector3(0.03, 0.07, 0.03)
const GONFLE := "gonfle"
const AVANCEE := 0.05
const CEINTURE := {id = "ceinture", genre = "emplacement", attache = {os = "bassin", position = [0.0, 0.0, 0.1], rotation = [0.0, 0.0, 0.0]}}
const MAIN_DU_BASSIN := {id = "main", genre = "prise", attache = {os = "main", position = [0.0, 0.0, 0.0], rotation = [0.0, 0.0, 0.0]}}
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[poses-des-ranges] version=", Engine.get_version_info().string)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var squelette := Skeleton3D.new()
	squelette.name = "Squelette"
	montage.add_child(squelette)
	for os in [{nom = "main", repos = Transform3D(Basis.from_euler(Vector3(0.3, -0.8, 0.1)), Vector3(-0.4, 1.0, 0.05))},
			{nom = "torse", repos = Transform3D(Basis.from_euler(Vector3(0.1, 0.0, 0.0)), Vector3(0.0, 1.2, 0.0))},
			{nom = "epaule", repos = Transform3D(Basis.IDENTITY, Vector3(0.2, 1.4, 0.0))}]:
		var indice := squelette.add_bone(os.nom)
		squelette.set_bone_rest(indice, os.repos)
		squelette.set_bone_pose(indice, os.repos)
	var clip := Animation.new()
	clip.length = 1.0
	var piste := clip.add_track(Animation.TYPE_ROTATION_3D)
	clip.track_set_path(piste, "Squelette:epaule")
	clip.rotation_track_insert_key(piste, 0.0, Quaternion.IDENTITY)
	clip.rotation_track_insert_key(piste, 1.0, Quaternion(Vector3.BACK, PI / 2.0))
	var clips := AnimationLibrary.new()
	clips.add_animation(CLIP, clip)
	var lecteur := AnimationPlayer.new()
	montage.add_child(lecteur)
	lecteur.add_animation_library("", clips)
	montage.base = {points = [CASE, MAIN]}
	montage.squelette = squelette
	montage.lecteur = lecteur
	montage.montes = {"ligne/emplacement/torse": "sangle"}
	montage.pieces = {"ligne/emplacement/torse": []}
	squelette.skeleton_updated.connect(montage._suivre_les_poids, CONNECT_DEFERRED)
	var import := BoneAttachment3D.new()
	import.bone_name = "main"
	squelette.add_child(import)
	var piece := MeshInstance3D.new()
	piece.name = "Fiole"
	var boite := BoxMesh.new()
	boite.size = TAILLE
	piece.mesh = boite
	piece.transform = MontageDeComposition.repere(MAIN.attache) * Transform3D(Basis.IDENTITY, Vector3(0.0, TAILLE.y / 2.0 + 0.015, TAILLE.z / 2.0))
	import.add_child(piece)
	montage.call("_poser_la_piece", piece, ["main"] as Array[String], squelette, "bandouliere")
	montage.call("_ranger")
	var erreurs: Array[String] = []
	var releve: Dictionary = await Outil.relever(self, montage, [], [{morphes = {}, clip = "", t = 0.0}, {morphes = {}, clip = CLIP, t = INSTANT}], erreurs)
	for erreur in erreurs:
		_fautes.append("relevé : %s" % erreur)
	if releve.pieces != [{ligne = "bandouliere", mesh = "Fiole", offrant = "sangle", os = "torse"}]:
		_fautes.append("pièces relevées : %s" % [releve.pieces])
	var au_repos := _repere(releve.poses[0][0])
	var a_l_instant := _repere(releve.poses[1][0])
	var torse := squelette.get_bone_global_rest(squelette.find_bone("torse"))
	var epaule := squelette.get_bone_global_rest(squelette.find_bone("epaule"))
	var case_ := MontageDeComposition.repere(OFFERTE)
	var sortante := torse.basis * Vector3(case_.origin.x, 0.0, case_.origin.z).normalized()
	var arriere := INF
	for sommet: Vector3 in boite.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]:
		arriere = minf(arriere, (au_repos * sommet - torse * case_.origin).dot(sortante))
	var pose_au_repos := absf(arriere - MiseEnPage.JEU_DE_RANGEMENT) < 0.001
	if not pose_au_repos:
		_fautes.append("repos : face arrière à %.4f de la case, attendue à %.4f" % [arriere, MiseEnPage.JEU_DE_RANGEMENT])
	print("[poses-des-ranges] repos : %s" % ("OK" if pose_au_repos else "KO"))
	var tournee := Transform3D(Basis(Quaternion.IDENTITY.slerp(Quaternion(Vector3.BACK, PI / 2.0), INSTANT)), epaule.origin)
	var melange := torse.interpolate_with(tournee * epaule.affine_inverse() * torse, 0.5)
	var attendue := melange * torse.affine_inverse() * au_repos
	var suivie := _proches(a_l_instant, attendue) and not _proches(a_l_instant, au_repos)
	if not suivie:
		_fautes.append("clip %s à %.2f s : fiole à %s, attendue à %s (repos %s)" % [CLIP, INSTANT, a_l_instant, attendue, au_repos])
	print("[poses-des-ranges] clip : %s" % ("OK" if suivie else "KO"))
	var nu: Transform3D = await _range_sur_le_corps({})
	var cuit: Transform3D = await _range_sur_le_corps({GONFLE: 1.0})
	var sur_le_corps_cuit := absf(cuit.origin.z - nu.origin.z - AVANCEE) < 0.001
	if not sur_le_corps_cuit:
		_fautes.append("corps cuit : objet avancé de %.4f, attendu de %.4f" % [cuit.origin.z - nu.origin.z, AVANCEE])
	print("[poses-des-ranges] corps cuit avant le rangement : %s" % ("OK" if sur_le_corps_cuit else "KO"))
	for faute in _fautes:
		push_error("[poses-des-ranges] " + faute)
	print("[poses-des-ranges] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La pose, dans le bassin, de la fiole montée à la ceinture par `Outil.monter_sur_le_corps` sur une base cubique
## autour du bassin, skinnée, de forme `GONFLE`, au corps de morphes `morphes`.
func _range_sur_le_corps(morphes: Dictionary) -> Transform3D:
	var fiole := Node3D.new()
	var prise := BoneAttachment3D.new()
	prise.bone_name = "main"
	fiole.add_child(prise)
	var piece := MeshInstance3D.new()
	piece.name = "Fiole"
	var boite := BoxMesh.new()
	boite.size = TAILLE
	piece.mesh = boite
	prise.add_child(piece)
	prise.owner = fiole
	piece.owner = fiole
	var paquet := PackedScene.new()
	paquet.pack(fiole)
	fiole.free()
	MontageDeComposition.retenir_les_modeles({fichiers = {fiole = {glb = "fiole.glb"}}, surfaces = {corps = []}}, {forme = "glb"})
	var lecture := MontageDeComposition.Lecture.new()
	lecture.en_vol = false
	lecture.paquet = paquet
	MontageDeComposition._lectures["fiole.glb"] = lecture
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	montage.poser_le_modele({id = "corps", points = [CEINTURE, MAIN_DU_BASSIN]}, _corps_a_forme())
	var erreurs: Array[String] = []
	await Outil.monter_sur_le_corps(montage, [{ligne = "ceinture", element = "fiole"}], {morphes = morphes, clip = "", t = 0.0}, erreurs)
	for erreur in erreurs:
		_fautes.append("corps cuit : %s" % erreur)
	var pose: Transform3D = montage._rangements["ceinture"][0].noeud.transform
	montage.free()
	return pose


## Une base : un squelette (bassin, main) et un cube de 20 cm autour du bassin, skinné sur lui, dont la forme `GONFLE`
## avance de `AVANCEE` sur +Z sa face avant, sous l'emplacement `CEINTURE`.
static func _corps_a_forme() -> Node3D:
	var corps := Node3D.new()
	var squelette := Skeleton3D.new()
	corps.add_child(squelette)
	for os in [{nom = "bassin", repos = Vector3(0.0, 1.0, 0.0)}, {nom = "main", repos = Vector3(0.4, 1.0, 0.0)}]:
		var indice := squelette.add_bone(os.nom)
		squelette.set_bone_rest(indice, Transform3D(Basis.IDENTITY, os.repos))
		squelette.set_bone_pose(indice, Transform3D(Basis.IDENTITY, os.repos))
	var tableaux := BoxMesh.new().get_mesh_arrays()
	var sommets := PackedVector3Array()
	var gonfles := PackedVector3Array()
	var liaisons := PackedInt32Array()
	var poids := PackedFloat32Array()
	for coin: Vector3 in tableaux[Mesh.ARRAY_VERTEX]:
		var sommet := Vector3(0.0, 1.0, 0.0) + coin * 0.2
		sommets.append(sommet)
		gonfles.append(sommet + Vector3(0.0, 0.0, AVANCEE) if coin.z > 0.0 else sommet)
		liaisons.append_array([0, 0, 0, 0])
		poids.append_array([1.0, 0.0, 0.0, 0.0])
	tableaux[Mesh.ARRAY_VERTEX] = sommets
	tableaux[Mesh.ARRAY_BONES] = liaisons
	tableaux[Mesh.ARRAY_WEIGHTS] = poids
	var forme := []
	forme.resize(Mesh.ARRAY_MAX)
	forme[Mesh.ARRAY_VERTEX] = gonfles
	forme[Mesh.ARRAY_NORMAL] = tableaux[Mesh.ARRAY_NORMAL]
	forme[Mesh.ARRAY_TANGENT] = tableaux[Mesh.ARRAY_TANGENT]
	var mesh := ArrayMesh.new()
	mesh.blend_shape_mode = Mesh.BLEND_SHAPE_MODE_NORMALIZED
	mesh.add_blend_shape(GONFLE)
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux, [forme])
	var skin := Skin.new()
	skin.add_named_bind("bassin", Transform3D(Basis.IDENTITY, Vector3(0.0, 1.0, 0.0)).affine_inverse())
	var base := MeshInstance3D.new()
	base.mesh = mesh
	base.skin = skin
	squelette.add_child(base)
	return corps


## La transformation des 16 nombres `matrice`, colonne par colonne (`Outil._matrice`).
func _repere(matrice: Array) -> Transform3D:
	return Transform3D(Vector3(matrice[0], matrice[1], matrice[2]), Vector3(matrice[4], matrice[5], matrice[6]),
		Vector3(matrice[8], matrice[9], matrice[10]), Vector3(matrice[12], matrice[13], matrice[14]))


func _proches(a: Transform3D, b: Transform3D) -> bool:
	return a.origin.distance_to(b.origin) < EPSILON and a.basis.x.distance_to(b.basis.x) < EPSILON \
			and a.basis.y.distance_to(b.basis.y) < EPSILON and a.basis.z.distance_to(b.basis.z) < EPSILON
