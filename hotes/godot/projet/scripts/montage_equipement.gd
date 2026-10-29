class_name MontageDEquipement
extends RefCounted

static var _manifestes: Dictionary = {}
static var _modeles: Dictionary = {}

var erreurs: Array[String] = []
var _empreinte := ""
var _montes: Array[Node] = []


static func manifeste(chemin: String) -> Dictionary:
	if not _manifestes.has(chemin):
		var valeur: Variant = JSON.parse_string(FileAccess.get_file_as_string(chemin))
		if not valeur is Dictionary:
			push_error("[montage] manifeste-illisible : %s" % chemin)
			return {}
		_manifestes[chemin] = valeur
	return _manifestes[chemin]


static func scene(modele: String) -> PackedScene:
	if not _modeles.has(modele):
		_modeles[modele] = load("res://modeles/%s" % modele)
	return _modeles[modele] as PackedScene


static func manifeste_du_modele(modele: String) -> Dictionary:
	return manifeste("res://modeles/%s.manifeste.json" % modele.get_basename())


## Le premier `Skeleton3D` sous `modele`, `null` s'il n'en porte aucun.
static func squelette_de(modele: Node) -> Skeleton3D:
	for candidat in modele.find_children("*", "Skeleton3D", true, false):
		return candidat as Skeleton3D
	return null


## Le `Portage` d'un point d'attache `{os, position, rotation}` (`hotes/godot/asset/attache.ts`), posé sous `squelette`
## par le `BoneAttachment3D` nommé `nom` ; `null` si l'os est absent.
static func attacher(squelette: Skeleton3D, declaration: Dictionary, nom: String) -> Node3D:
	if squelette.find_bone(declaration.os) == -1:
		return null
	var attache := BoneAttachment3D.new()
	attache.name = nom
	squelette.add_child(attache)
	attache.bone_name = declaration.os
	var support := Node3D.new()
	support.name = "Portage"
	support.position = Vector3(declaration.position[0], declaration.position[1], declaration.position[2])
	support.rotation = Vector3(declaration.rotation[0], declaration.rotation[1], declaration.rotation[2])
	attache.add_child(support)
	return support


func masquer_armes(modele: Node, m: Dictionary) -> void:
	for piece in m.pieces.values():
		if m.montage.composants.has(piece.component):
			var noeud := modele.find_child(piece.node, true, false) as Node3D
			if noeud != null:
				noeud.visible = false


func montrer(modele: Node, porteur: Dictionary, dessin: Dictionary) -> void:
	var empreinte := JSON.stringify(dessin)
	if empreinte == _empreinte:
		return
	_empreinte = empreinte
	erreurs.clear()
	for noeud in _montes:
		noeud.free()
	_montes.clear()
	var squelette := squelette_de(modele)
	if squelette == null:
		_refuser("squelette-absent")
		return
	for emplacement in ["tenues", "rangees"]:
		for position in dessin[emplacement].size():
			var objet: Dictionary = dessin[emplacement][position]
			if objet.modele == null:
				continue
			_monter(squelette, porteur, objet, emplacement, position)


func _monter(squelette: Skeleton3D, porteur: Dictionary, objet: Dictionary, emplacement: String, position: int) -> void:
	var pieces: Array[Node3D] = []
	var prise := str(objet.arme.hand) if emplacement == "tenues" else ""
	var nom_attache := ""
	for composant in objet.modele.composants:
		var donneur := manifeste_du_modele(composant.modele)
		var portage: Dictionary = donneur.montage.composants.get(composant.composant, {})
		if portage.is_empty():
			_abandonner(pieces, "portage-absent : %s/%s" % [composant.modele, composant.composant])
			return
		if prise.is_empty():
			prise = portage.prise
		if portage.prise != prise:
			_abandonner(pieces, "prise-incompatible : %s/%s" % [composant.modele, composant.composant])
			return
		var cible: String = portage.rangement if emplacement == "rangees" else prise
		if not nom_attache.is_empty() and nom_attache != cible:
			_abandonner(pieces, "rangement-incompatible : %s/%s" % [composant.modele, composant.composant])
			return
		nom_attache = cible
		var source := scene(composant.modele).instantiate()
		for nom in composant.pieces:
			var piece := source.find_child(nom, true, false) as MeshInstance3D
			if piece == null or piece.skin != null:
				source.free()
				_abandonner(pieces, "piece-non-rigide : %s/%s" % [composant.modele, nom])
				return
			var copie := piece.duplicate() as MeshInstance3D
			copie.skeleton = NodePath()
			copie.visible = true
			pieces.append(copie)
			if not _teinter(copie, portage.matieres, objet.palette):
				source.free()
				_abandonner(pieces, "matiere-incompatible : %s/%s" % [composant.modele, nom])
				return
		source.free()
	var declaration: Dictionary = porteur.montage.attaches[nom_attache]
	var support := attacher(squelette, declaration, "Equipement_%s_%d" % [emplacement, position])
	if support == null:
		_abandonner(pieces, "os-absent : %s" % declaration.os)
		return
	for piece in pieces:
		support.add_child(piece)
	_montes.append(support.get_parent())


func _teinter(piece: MeshInstance3D, matieres: Array, palette: Variant) -> bool:
	if palette == null:
		return true
	for surface in piece.mesh.get_surface_count():
		piece.set_surface_override_material(surface, piece.get_active_material(surface))
	piece.material_override = null
	for liaison in matieres:
		if liaison.piece != str(piece.name) or not palette.has(liaison.cle):
			continue
		var surface := int(liaison.surface)
		var original := piece.get_active_material(surface) as BaseMaterial3D
		if original == null:
			return false
		var local := original.duplicate() as BaseMaterial3D
		local.albedo_color = Color(str(palette[liaison.cle]))
		piece.set_surface_override_material(surface, local)
	return true


func _abandonner(pieces: Array[Node3D], raison: String) -> void:
	for piece in pieces:
		piece.free()
	_refuser(raison)


func _refuser(raison: String) -> void:
	erreurs.append(raison)
	push_error("[montage] %s" % raison)
