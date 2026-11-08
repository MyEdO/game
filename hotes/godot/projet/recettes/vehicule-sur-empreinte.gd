extends SceneTree

## Un véhicule posé sur son empreinte (#2987, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `vehicules`) : la scène de son GLB, à la case de son combattant, couvre ses N×N cases depuis cette case, son coin
## nord-ouest (`Combattant.poser_sur_l_empreinte`). Sa plus grande dimension horizontale y vaut N cases, sa boîte est
## centrée sur l'empreinte, son origine reste au sol, quel que soit son repère d'auteur ; la boîte réunit chaque mesh,
## jusqu'au plus profond.

const RECETTE_AUTONOME := true
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[vehicule-sur-empreinte] version=", Engine.get_version_info().string)
	for cas in [{empreinte = 4, coque = Vector3(30.0, 8.0, 6.0)}, {empreinte = 2, coque = Vector3(5.0, 3.0, 12.0)}, {empreinte = 1, coque = Vector3(2.0, 1.0, 2.0)}]:
		_verifier(cas.empreinte, cas.coque)
	for faute in _fautes:
		push_error("[vehicule-sur-empreinte] " + faute)
	print("[vehicule-sur-empreinte] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une scène de GLB : sa racine déplacée, une coque de taille `coque` décentrée, et un mât sous un nœud intermédiaire
## tourné, qui dépasse de la coque vers le haut.
func _scene(coque: Vector3) -> Node3D:
	var scene := Node3D.new()
	scene.position = Vector3(0.7, 0.0, -1.3)
	var corps := MeshInstance3D.new()
	var boite := BoxMesh.new()
	boite.size = coque
	corps.mesh = boite
	corps.position = Vector3(2.0, coque.y / 2.0, -3.0)
	scene.add_child(corps)
	var greement := Node3D.new()
	greement.transform = Transform3D(Basis(Vector3.UP, 0.3), Vector3(2.0, coque.y, -3.0))
	scene.add_child(greement)
	var mat := MeshInstance3D.new()
	var perche := BoxMesh.new()
	perche.size = Vector3(0.2, coque.y, 0.2)
	mat.mesh = perche
	mat.position = Vector3(0.0, coque.y / 2.0, 0.0)
	greement.add_child(mat)
	return scene


## La boîte de chaque mesh sous `noeud`, dans le repère du nœud `dans`, son ancêtre.
func _boite(noeud: Node, dans: Node3D) -> Variant:
	var boite: Variant = null
	if noeud is MeshInstance3D:
		var piece := noeud as MeshInstance3D
		boite = dans.global_transform.affine_inverse() * piece.global_transform * piece.get_aabb()
	for enfant in noeud.get_children():
		var sous: Variant = _boite(enfant, dans)
		if sous != null:
			boite = sous if boite == null else (boite as AABB).merge(sous)
	return boite


func _verifier(empreinte: int, coque: Vector3) -> void:
	var case := Node3D.new()
	case.position = Vector3(5.5, 0.0, 7.5)
	root.add_child(case)
	var scene := _scene(coque)
	case.add_child(scene)
	Combattant.poser_sur_l_empreinte(scene, empreinte)
	var boite: AABB = _boite(scene, case)
	var cas := "empreinte %d, coque %s" % [empreinte, coque]
	if not is_equal_approx(maxf(boite.size.x, boite.size.z), empreinte):
		_fautes.append("%s : plus grande dimension horizontale %s, attendu %d cases" % [cas, maxf(boite.size.x, boite.size.z), empreinte])
	var milieu := (empreinte - 1) * 0.5
	if not is_equal_approx(boite.get_center().x, milieu) or not is_equal_approx(boite.get_center().z, milieu):
		_fautes.append("%s : boîte centrée en %s, attendu (%s, %s) en x, z" % [cas, boite.get_center(), milieu, milieu])
	if not is_equal_approx(boite.position.y, 0.0):
		_fautes.append("%s : pied de la coque à %s, attendu au sol" % [cas, boite.position.y])
	case.queue_free()
