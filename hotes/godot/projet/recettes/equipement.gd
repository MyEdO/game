extends SceneTree

var _fautes: Array[String] = []
var _controles: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var arguments := OS.get_cmdline_user_args()
	if arguments.is_empty():
		push_error("-- <vue JSON figée> requis")
		quit(2)
		return
	var vue: Variant = JSON.parse_string(FileAccess.get_file_as_string(arguments[0]))
	if not vue is Dictionary:
		push_error("vue JSON illisible")
		quit(2)
		return
	for c in vue.projection.combat.voisins.liste:
		var combattant: Combattant = load("res://scenes/Combattant.tscn").instantiate()
		root.add_child(combattant)
		combattant.configurer(c, Vector3.ZERO)
		var dessin: Dictionary = vue.equipements[c.id]
		combattant.montrer(c, Vector3.ZERO, false, dessin)
		var montage: MontageDEquipement = combattant.get("_equipement")
		for erreur in montage.erreurs:
			_fautes.append("%s : %s" % [c.id, erreur])
		var modele: Node = combattant.get("_personnage")
		var manifeste: Dictionary = combattant.get("_manifeste")
		for emplacement in ["tenues", "rangees"]:
			for position in dessin[emplacement].size():
				var objet: Dictionary = dessin[emplacement][position]
				var nom := "Equipement_%s_%d" % [emplacement, position]
				var attache := modele.find_child(nom, true, false) as BoneAttachment3D
				if objet.modele == null:
					_verifier(attache == null, "%s : absence sans nœud" % c.id)
					continue
				_verifier(attache != null, "%s : %s monté" % [c.id, nom])
				if attache == null:
					continue
				for composant in objet.modele.composants:
					var donneur := MontageDEquipement.manifeste_du_modele(composant.modele)
					var cible: String = str(objet.arme.hand) if emplacement == "tenues" else donneur.montage.composants[composant.composant].rangement
					_verifier(attache.bone_name == manifeste.montage.attaches[cible].os, "%s : os %s" % [c.id, cible])
					for piece in composant.pieces:
						var noeud := attache.find_child(piece, true, false) as MeshInstance3D
						_verifier(noeud != null and noeud.skin == null, "%s : pièce rigide %s" % [c.id, piece])
		for piece in manifeste.pieces.values():
			if manifeste.montage.composants.has(piece.component):
				var noeud := modele.find_child(piece.node, true, false) as Node3D
				_verifier(noeud != null and not noeud.visible, "%s : défaut masqué %s" % [c.id, piece.node])
		_controles.append(c.id)
		print("[recette-équipement] %s : contrôlé" % c.id)
		combattant.free()
	for id in vue.equipements:
		_verifier(_controles.has(id), "cas non parcouru : %s" % id)
	print("[recette-équipement] cas contrôlés (%d) : %s" % [_controles.size(), JSON.stringify(_controles)])
	for faute in _fautes:
		push_error("[recette-équipement] %s" % faute)
	print("[recette-équipement] %d erreur(s), couverture %s" % [_fautes.size(), JSON.stringify(vue.couverture)])
	quit(0 if _fautes.is_empty() else 1)


func _verifier(condition: bool, message: String) -> void:
	if not condition:
		_fautes.append(message)
