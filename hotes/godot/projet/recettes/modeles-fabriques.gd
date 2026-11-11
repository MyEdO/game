extends SceneTree

## Les modèles fabriqués (#3946, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D », `forme` du listage) : sur le pont figé du
## chemin (`PontFige`, tous les modèles du projet, `hotes/godot/recettes/chemin.ts`), la fabrique (`FabriqueDeModeles`)
## écrit dans le projet la scène d'une base à textures, d'un véhicule à clips et d'un élément skinné. Servi en forme
## `scene`, chacun se charge de sa scène fabriquée, jamais de son GLB, et sa scène vaut celle que son GLB donne à la
## lecture, nœud par nœud et ressource par ressource (meshes, skins, os, clips, matériaux et leur table `MATERIAUX`),
## hors ses textures : chacune a la taille de la sienne, compressée (RGTC pour une normale), avec ses mipmaps. Aucun de
## ses nœuds ne porte de fichier de scène. Les matériaux de ses meshes sont ceux de sa table. La base se pose depuis sa
## scène fabriquée, avec son squelette, son lecteur et ses matériaux.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/chemin.json"
const BASE := "humanoide"
const VEHICULE := "vehicule--baliste"
const SKINNE := "humanoide--vetement--chemise"
## Les images laissées à la lecture des modèles.
const IMAGES_D_ATTENTE := 600
## La propriété de matériau qui porte une texture de normales.
const NORMALE := ".normal_texture"
var _fautes: Array[String] = []
## Les textures comparées : `{ ou, lue, fabriquee }`.
var _textures: Array[Dictionary] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[modeles-fabriques] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[modeles-fabriques] %s : aucun chemin figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, lu)
	var ids := [BASE, VEHICULE, SKINNE]
	for id: String in ids:
		var fichiers: Dictionary = lu.modeles.fichiers[id]
		FabriqueDeModeles.fabriquer(id, FileAccess.get_file_as_bytes("res://modeles/%s" % fichiers.glb), "res://modeles/%s" % fichiers.scene, _fautes)
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	var lues := await _tirer(montage, lu.modeles, lu.listage, ids)
	pont.requetes.clear()
	var fabriquees := await _tirer(montage, lu.modeles, {forme = MontageDeComposition.FORME_SCENE}, ids)
	_verifier(montage.erreurs.is_empty(), "des modèles ne se lisent pas : %s" % [montage.erreurs])
	var attendues: Array[String] = []
	for id: String in ids:
		attendues.append("modeles/%s" % lu.modeles.fichiers[id].scene)
	_verifier(pont.requetes == attendues, "en forme scene, les fichiers demandés sont %s, pas %s" % [pont.requetes, attendues])
	if _fautes.is_empty():
		for id: String in ids:
			_comparer_les_scenes(id, lues[id], fabriquees[id])
		_verifier(_textures.any(func(t: Dictionary) -> bool: return t.ou.begins_with(BASE)), "la base %s ne porte aucune texture" % BASE)
		_verifier(not fabriquees[VEHICULE].find_children("*", "AnimationPlayer", true, false).is_empty(), "le véhicule %s ne porte aucun clip" % VEHICULE)
		_verifier(fabriquees[SKINNE].find_children("*", "MeshInstance3D", true, false).any(func(m: MeshInstance3D) -> bool: return m.skin != null), "l'élément %s n'est pas skinné" % SKINNE)
		for texture in _textures:
			_verifier_la_texture(texture)
		var base: Dictionary = lu.modeles.bases.filter(func(b: Dictionary) -> bool: return b.id == BASE)[0]
		montage.poser_le_modele(base, fabriquees[BASE])
		fabriquees.erase(BASE)
		_verifier(montage.squelette != null and montage.lecteur != null and montage.erreurs.is_empty(), "la base ne se pose pas depuis sa scène fabriquée : %s" % [montage.erreurs])
		_verifier(montage.materiaux_de_la_base.keys() == lues[BASE].get_meta(MontageDeComposition.MATERIAUX).keys(), "la base posée depuis sa scène fabriquée n'a pas les matériaux de son GLB")
	for scene: Node in lues.values() + fabriquees.values():
		if scene != null:
			scene.free()
	print("[modeles-fabriques] textures=", _textures.size())
	for faute in _fautes:
		push_error("[modeles-fabriques] " + faute)
	print("[modeles-fabriques] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Par id de `ids`, la scène que `montage` en tire, la réponse `modeles` retenue pour le listage `listage`.
func _tirer(montage: MontageDeComposition, modeles: Dictionary, listage: Dictionary, ids: Array) -> Dictionary:
	MontageDeComposition.retenir_les_modeles(modeles, listage)
	var scenes := {}
	for id: String in ids:
		scenes[id] = await montage.scene_du_modele(id, montage.erreurs)
	return scenes


## La scène `fabriquee` du modèle `id` contre sa scène `lue` : les mêmes nœuds, de mêmes valeurs (`_comparer`), et les
## matériaux de ses meshes pris à sa table `MATERIAUX`.
func _comparer_les_scenes(id: String, lue: Node, fabriquee: Node) -> void:
	var noeuds_lus := [lue] + lue.find_children("*", "", true, false)
	var noeuds_fabriques := [fabriquee] + fabriquee.find_children("*", "", true, false)
	var chemins := func(racine: Node, noeuds: Array) -> Array: return noeuds.map(func(n: Node) -> String: return "%s %s" % [n.get_class(), racine.get_path_to(n)])
	if chemins.call(lue, noeuds_lus) != chemins.call(fabriquee, noeuds_fabriques):
		_fautes.append("%s : la scène fabriquée n'a pas les nœuds de la scène lue" % id)
		return
	var vus := {}
	for i in noeuds_lus.size():
		_comparer(noeuds_lus[i], noeuds_fabriques[i], "%s:%s" % [id, lue.get_path_to(noeuds_lus[i])], vus)
		_verifier(noeuds_fabriques[i].scene_file_path == noeuds_lus[i].scene_file_path, "%s:%s : fichier de scène %s" % [id, lue.get_path_to(noeuds_lus[i]), noeuds_fabriques[i].scene_file_path])
	var table: Dictionary = fabriquee.get_meta(MontageDeComposition.MATERIAUX)
	for piece: MeshInstance3D in fabriquee.find_children("*", "MeshInstance3D", true, false):
		for surface in piece.mesh.get_surface_count():
			var materiau := piece.get_active_material(surface)
			_verifier(materiau == null or table.get(materiau.resource_name) == materiau, "%s : le matériau %s de %s n'est pas celui de la table des matériaux" % [id, materiau.resource_name if materiau else "", piece.name])


## Les écarts de `fabrique` à `lu`, à `ou` : deux objets valent par leur classe et par chacune de leurs propriétés
## enregistrées ; deux textures se retiennent (`_textures`) ; un objet de `vus` est déjà comparé.
func _comparer(lu: Variant, fabrique: Variant, ou: String, vus: Dictionary) -> void:
	if lu is Texture2D and fabrique is Texture2D:
		if not vus.has(lu):
			vus[lu] = true
			_textures.append({ou = ou, lue = lu, fabriquee = fabrique})
	elif typeof(lu) != typeof(fabrique):
		_fautes.append("%s : %s / %s" % [ou, type_string(typeof(lu)), type_string(typeof(fabrique))])
	elif lu is Object:
		if vus.has(lu):
			return
		vus[lu] = true
		if lu.get_class() != fabrique.get_class():
			_fautes.append("%s : %s / %s" % [ou, lu.get_class(), fabrique.get_class()])
			return
		for propriete in lu.get_property_list():
			if propriete.usage & PROPERTY_USAGE_STORAGE:
				_comparer(lu.get(propriete.name), fabrique.get(propriete.name), "%s.%s" % [ou, propriete.name], vus)
	elif lu is Dictionary:
		if lu.keys() != fabrique.keys():
			_fautes.append("%s : clés %s / %s" % [ou, lu.keys(), fabrique.keys()])
			return
		for cle: Variant in lu:
			_comparer(lu[cle], fabrique[cle], "%s[%s]" % [ou, cle], vus)
	elif lu is Array:
		if lu.size() != fabrique.size():
			_fautes.append("%s : %d / %d valeurs" % [ou, lu.size(), fabrique.size()])
			return
		for i in lu.size():
			_comparer(lu[i], fabrique[i], "%s[%d]" % [ou, i], vus)
	elif lu != fabrique and not (lu is Transform3D and lu.is_equal_approx(fabrique)):
		_fautes.append("%s : %s / %s" % [ou, str(lu).left(80), str(fabrique).left(80)])


## La texture fabriquée de `texture` a la taille de la texture lue, compressée (RGTC à deux canaux pour une normale, et
## elle seule), avec ses mipmaps et son nom.
func _verifier_la_texture(texture: Dictionary) -> void:
	var lue: Image = texture.lue.get_image()
	var fabriquee: Image = texture.fabriquee.get_image()
	_verifier(fabriquee.get_size() == lue.get_size(), "%s : texture de %s au lieu de %s" % [texture.ou, fabriquee.get_size(), lue.get_size()])
	_verifier(not lue.is_compressed() and fabriquee.is_compressed(), "%s : texture fabriquée non compressée (format %d)" % [texture.ou, fabriquee.get_format()])
	_verifier((fabriquee.get_format() == Image.FORMAT_RGTC_RG) == texture.ou.ends_with(NORMALE), "%s : texture fabriquée au format %d" % [texture.ou, fabriquee.get_format()])
	_verifier(fabriquee.has_mipmaps(), "%s : texture fabriquée sans mipmaps" % texture.ou)
	_verifier(texture.fabriquee.resource_name == texture.lue.resource_name, "%s : texture renommée" % texture.ou)


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
