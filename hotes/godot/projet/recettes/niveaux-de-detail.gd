extends SceneTree

## Les niveaux de détail des meshes dessinés (#4413, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : sur chaque
## modèle de `MODELES`, chaque surface d'au moins `PLANCHER` triangles porte au serveur de rendu au moins un niveau de
## détail (`RenderingServer.mesh_get_surface`, `lods`), son niveau 0 au compte de triangles du GLB lu sans eux : chaque
## mesh lu (`MontageDeComposition.scene_lue`), avec ses shape keys ; chaque mesh cuit
## (`MontageDeComposition.cuire_les_formes`), avec chacune de ses surfaces ; le mesh fondu de ses pièces
## (`MontageDeComposition.refondre`), au compte de triangles des pièces fondues ; et chaque mesh de la scène que la
## fabrique en écrit (`FabriqueDeModeles.fabriquer`), rechargée comme à l'exécution (`MontageDeComposition._paquet_charge`).

const RECETTE_AUTONOME := true
## La tête humaine, et la base, dont des surfaces portent un canal libre (`Mesh.ARRAY_CUSTOM0`).
const MODELES := ["humanoide--tete--humain", "humanoide"]
## Le compte de triangles d'une surface au-dessus duquel la génération en tire au moins un niveau.
const PLANCHER := 300
## La scène fabriquée de la tête, hors du dossier des modèles du projet.
const FABRIQUEE := "user://niveaux-de-detail.scn"
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[niveaux-de-detail] version=", Engine.get_version_info().string)
	for id: String in MODELES:
		_recetter_le_modele(id)
	_recetter_la_fabrique(MODELES[0])
	_finir()


func _recetter_la_fabrique(id: String) -> void:
	var recueil: Array[String] = []
	FabriqueDeModeles.fabriquer(id, FileAccess.get_file_as_bytes("res://modeles/%s.glb" % id), FABRIQUEE, recueil)
	var paquet := MontageDeComposition._paquet_charge(id, FileAccess.get_file_as_bytes(FABRIQUEE), recueil)
	DirAccess.remove_absolute(FABRIQUEE)
	if paquet == null:
		_fautes.append_array(recueil)
		return
	var scene := paquet.instantiate()
	for noeud in scene.find_children("*", "MeshInstance3D", true, false):
		_verifier("%s, fabriqué %s" % [id, noeud.name], (noeud as MeshInstance3D).mesh as ArrayMesh)
	scene.free()


func _recetter_le_modele(id: String) -> void:
	var octets := FileAccess.get_file_as_bytes("res://modeles/%s.glb" % id)
	var recueil: Array[String] = []
	var scene := MontageDeComposition.scene_lue(id, octets, recueil)
	if scene == null:
		_fautes.append_array(recueil)
		return
	var brut := _lu_sans_niveaux(octets)
	var pieces := scene.find_children("*", "MeshInstance3D", true, false)
	if pieces.is_empty():
		_fautes.append("%s : aucun mesh" % id)
		return
	for noeud in pieces:
		var piece := noeud as MeshInstance3D
		var mesh := piece.mesh as ArrayMesh
		var lu: Dictionary = brut[String(piece.name)]
		if mesh.get_blend_shape_count() != lu.formes:
			_fautes.append("%s, lu %s : %d shape keys, %d au GLB" % [id, piece.name, mesh.get_blend_shape_count(), lu.formes])
		if _triangles(mesh) != lu.triangles:
			_fautes.append("%s, lu %s : niveau 0 à %d triangles, %d au GLB" % [id, piece.name, _triangles(mesh), lu.triangles])
		_verifier("%s, lu %s" % [id, piece.name], mesh)

	root.add_child(scene)
	var cuits := 0
	for noeud in pieces:
		var piece := noeud as MeshInstance3D
		var formes := piece.mesh as ArrayMesh
		if formes.get_blend_shape_count() == 0:
			continue
		MontageDeComposition.cuire_les_formes(piece, {String(formes.get_blend_shape_name(0)): 1.0})
		var cuit := piece.mesh as ArrayMesh
		cuits += 1
		if cuit == formes or cuit.get_blend_shape_count() != 0 or cuit.get_surface_count() != formes.get_surface_count():
			_fautes.append("%s, cuit %s : %d surfaces et %d shape keys, %d surfaces au mesh à formes" % [id, piece.name, cuit.get_surface_count(), cuit.get_blend_shape_count(), formes.get_surface_count()])
			continue
		_verifier("%s, cuit %s" % [id, piece.name], cuit)
	if cuits == 0:
		_fautes.append("%s : aucun mesh à shape keys" % id)

	var squelette := scene.find_children("*", "Skeleton3D", true, false)
	if squelette.is_empty():
		_fautes.append("%s : aucun squelette" % id)
		return
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	montage.modele = scene
	montage.squelette = squelette[0]
	montage.refondre()
	if montage.fusion == null:
		_fautes.append("%s : aucune fusion" % id)
		return
	var fondues := 0
	for noeud in pieces:
		if (noeud as MeshInstance3D).layers == 0:
			fondues += _triangles((noeud as MeshInstance3D).mesh)
	var fondu := montage.fusion.mesh as ArrayMesh
	if _triangles(fondu) != fondues:
		_fautes.append("%s, fondu : niveau 0 à %d triangles, %d aux pièces fondues" % [id, _triangles(fondu), fondues])
	_verifier("%s, fondu" % id, fondu)
	montage.free()
	scene.free()


func _finir() -> void:
	for faute in _fautes:
		push_error("[niveaux-de-detail] " + faute)
	print("[niveaux-de-detail] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Par nom de mesh du GLB `octets` lu sans niveaux de détail, ses `triangles` et ses `formes` (shape keys).
func _lu_sans_niveaux(octets: PackedByteArray) -> Dictionary:
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	document.append_from_buffer(octets, "", etat, GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS)
	var scene := document.generate_scene(etat)
	var lus := {}
	for noeud in scene.find_children("*", "MeshInstance3D", true, false):
		var mesh := (noeud as MeshInstance3D).mesh
		lus[String(noeud.name)] = {triangles = _triangles(mesh), formes = mesh.get_blend_shape_count()}
	scene.free()
	return lus


## Chaque surface de `mesh` d'au moins `PLANCHER` triangles porte un niveau de détail au serveur de rendu ; une faute
## sous `quoi` sinon.
func _verifier(quoi: String, mesh: ArrayMesh) -> void:
	var detail := []
	for surface in mesh.get_surface_count():
		var triangles := (mesh.surface_get_arrays(surface)[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3
		var lods: Array = RenderingServer.mesh_get_surface(mesh.get_rid(), surface).get("lods", [])
		detail.append("%d+%d" % [triangles, lods.size()])
		if triangles >= PLANCHER and lods.is_empty():
			_fautes.append("%s, surface %d : %d triangles sans niveau de détail" % [quoi, surface, triangles])
	print("[niveaux-de-detail] %s : par surface, triangles du niveau 0 + niveaux %s" % [quoi, ", ".join(detail)])


func _triangles(mesh: Mesh) -> int:
	var total := 0
	for surface in mesh.get_surface_count():
		total += (mesh.surface_get_arrays(surface)[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3
	return total
