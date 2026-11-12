extends SceneTree

## Les arêtes en instances groupées (#3948) rendues comme à `851700b3a` : chaque maillage de chaque pièce, mur et porte
## ouverte du kit, boîte sans pièce au kit, dans les deux sens, à un pied et à une hauteur de mur quelconques, sur un
## volume déplacé et un plateau de 2 m par case, a, à l'instance de son arête dans `Vu_<maillage>` et dans
## `Ombre_<maillage>`, la transformation dans le monde, le maillage et les matières qu'il avait sous la pièce d'avant,
## rebâtie ici en témoin hors du volume (une pièce par arête, `_piece_d_avant`). Le rang d'une arête est celui de
## `VolumeDeScene.cacher` : les montrées puis les cachées, dans l'ordre reçu ; cachées, `Vu` ne montre que les
## premières, `Ombre` les garde toutes. Plus de huit foyers : onze murs, un par bloc, chacun sous sa lampe, sont tous
## éclairés, lus aux pixels de l'image rendue ; témoin : les mêmes murs dans un seul bloc, un seul groupe, n'en ont que
## huit sous le rendu de compatibilité, sa borne (`rendering/limits/opengl/max_lights_per_object`), et tous sous
## Forward+, qui n'en a pas.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`. En `--headless`,
## `MultiMesh.get_instance_transform` rend l'identité et le rendu ne peint aucune image : la sonde n'en contrôle que
## l'analyse.

const RECETTE_RENDUE := true
const EPSILON := 1e-4
const METRES_PAR_CASE := 2.0
const DECALAGE := Vector3(2.5, 0.0, -1.5)
## Les groupes attendus des arêtes de `_aretes`, par leurs clés, et les arêtes cachées : tout un groupe, une partie de
## deux autres.
const GROUPES := [["m1", "m2", "m3"], ["n1", "n2"], ["o1", "o2"], ["b1", "b2", "b3"], ["s1"]]
const CACHEES := ["m2", "n1", "n2", "o1", "b3"]
## Les murs sous les lampes : un toutes les quatre cases, une lampe à une unité du sol, en avant de chaque mur, de portée
## courte ; le fond d'un mur est lu à son haut, hors de portée de sa lampe.
const MURS := 11
const ECART_DES_MURS := 4.0
const HAUTEUR_DE_LAMPE := 1.0
const RECUL_DE_LAMPE := 0.6
const PORTEE_DE_LAMPE := 1.5
const HAUT_DU_MUR := 3.5
## L'écart de luminance (sur 255) au-delà duquel un mur est éclairé par sa lampe, contre son haut.
const ECLAIRE := 20
var _fautes: Array[String] = []
var _comparaisons := 0
var _ecart_origine := 0.0
var _ecart_base := 0.0


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[aretes-en-instances] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	var scene := Node3D.new()
	root.add_child(scene)
	var camera := Camera3D.new()
	scene.add_child(camera)
	camera.current = true
	await _poses_d_avant(scene)
	await _foyers(scene, camera)
	for faute in _fautes:
		push_error("[aretes-en-instances] " + faute)
	print("[aretes-en-instances] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Point 1 et 2 : les instances contre la pose d'avant, posées, puis après `cacher`, puis toutes rendues.
func _poses_d_avant(scene: Node3D) -> void:
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	scene.add_child(volume)
	volume.position = DECALAGE
	volume.metres_par_case = METRES_PAR_CASE
	var kit: Node3D = (load(VolumeDeScene.KIT) as PackedScene).instantiate()
	var aretes := _aretes()
	volume.poser_les_aretes(aretes)
	var temoin := Node3D.new()
	var noeud_des_aretes: Node3D = volume.get_node("Aretes")
	temoin.transform = noeud_des_aretes.transform
	noeud_des_aretes.add_sibling(temoin)
	for etape: Array in [["posées", []], ["cachées", CACHEES], ["rendues", []]]:
		volume.cacher(etape[1], [], [])
		await _image()
		_controler(etape[0], volume, temoin, kit, aretes, etape[1])
	print("[aretes-en-instances] %d comparaisons aux pièces d'avant ; écart maximal : origine %.9f, base %.9f (borne %s)" % [_comparaisons, _ecart_origine, _ecart_base, EPSILON])
	kit.free()
	volume.free()


## Les arêtes de la recette : deux blocs (et une couche), le mur du kit dans les deux sens, à 4 m et à 1,25 m de haut,
## la porte ouverte du kit à un pied de 4 m, la boîte d'un mur et le seuil d'une porte ouverte sans famille.
func _aretes() -> Array:
	var aretes := []
	for k in 3:
		aretes.append(_arete("m%d" % (k + 1), "0/0/0", "colombage", "mur", Vector2(1, 0), 4.0, 0.0, Vector2(k, -0.5)))
	for k in 2:
		aretes.append(_arete("n%d" % (k + 1), "0/0/0", "colombage", "mur", Vector2(0, 1), 1.25, 2.0, Vector2(-0.5, k)))
	for k in 2:
		aretes.append(_arete("o%d" % (k + 1), "0/1/0", "pierre", "porte-ouverte", Vector2(1, 0), 4.0, 4.0, Vector2(8 + 2 * k, 1.5)))
	for k in 3:
		aretes.append(_arete("b%d" % (k + 1), "0/1/0", null, "mur", Vector2(0, 1), 4.0, 2.0, Vector2(11.5, 2 + k)))
	aretes.append(_arete("s1", "1/1/0", null, "porte-ouverte", Vector2(1, 0), 4.0, 0.0, Vector2(9, 3.5)))
	return aretes


func _arete(cle: String, bloc: String, famille: Variant, piece: String, sens: Vector2, hauteur: float, pied: float, milieu: Vector2) -> Dictionary:
	return {cle = cle, bloc = bloc, famille = famille, piece = piece, sens = {x = sens.x, y = sens.y}, hauteurM = hauteur, pied = pied, milieu = {x = milieu.x, y = milieu.y}}


## Chaque groupe posé, ses comptes d'instances, et chacune de ses instances à son rang (les montrées puis les cachées
## `cachees`, dans l'ordre de `aretes`) contre la pièce d'avant de son arête.
func _controler(etape: String, volume: VolumeDeScene, temoin: Node3D, kit: Node3D, aretes: Array, cachees: Array) -> void:
	var groupes := {}
	for groupe: Node3D in volume.get_node("Aretes").get_children():
		groupes[groupe.get_meta("aretes").map(func(a: Dictionary) -> String: return a.cle)] = groupe
	if groupes.keys() != GROUPES:
		_fautes.append("%s : groupes %s, attendu %s" % [etape, groupes.keys(), GROUPES])
		return
	for cles: Array in GROUPES:
		var groupe: Node3D = groupes[cles]
		var membres := aretes.filter(func(a: Dictionary) -> bool: return cles.has(a.cle))
		var ordre := membres.filter(func(a: Dictionary) -> bool: return not cachees.has(a.cle))
		var montrees := ordre.size()
		ordre.append_array(membres.filter(func(a: Dictionary) -> bool: return cachees.has(a.cle)))
		var vus := groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)
		for vu: MultiMeshInstance3D in vus:
			var ombre := groupe.find_child("Ombre_" + vu.name.trim_prefix("Vu_"), true, false) as MultiMeshInstance3D
			if vu.multimesh.instance_count != membres.size() or vu.multimesh.visible_instance_count != montrees:
				_fautes.append("%s, groupe %s, %s : %d instances dont %d montrées, attendu %d dont %d" % [etape, cles, vu.name, vu.multimesh.instance_count, vu.multimesh.visible_instance_count, membres.size(), montrees])
			if ombre == null or ombre.multimesh.instance_count != membres.size() or not [-1, membres.size()].has(ombre.multimesh.visible_instance_count):
				_fautes.append("%s, groupe %s : l'ombre de %s ne porte pas ses %d instances" % [etape, cles, vu.name, membres.size()])
		for rang in ordre.size():
			var piece := _piece_d_avant(temoin, kit, volume, ordre[rang])
			var maillages := piece.find_children("*", "MeshInstance3D", true, false)
			if piece is MeshInstance3D:
				maillages.append(piece)
			if maillages.size() != vus.size():
				_fautes.append("%s, %s : %d maillages sous la pièce d'avant, %d instances groupées vues" % [etape, ordre[rang].cle, maillages.size(), vus.size()])
			for maillage: MeshInstance3D in maillages:
				for prefixe in ["Vu_", "Ombre_"]:
					var instances := groupe.find_child(prefixe + maillage.name, true, false) as MultiMeshInstance3D
					if instances == null:
						_fautes.append("%s, %s : aucune instance %s%s" % [etape, ordre[rang].cle, prefixe, maillage.name])
						continue
					_comparer("%s, %s, %s rang %d" % [etape, ordre[rang].cle, instances.name, rang], maillage, instances, rang)
			piece.free()


## La pièce de l'arête `a` posée comme à `851700b3a` (`_piece`) sous `temoin` : celle du kit, au centre de l'arête,
## orientée et mise à l'échelle sur son nœud ; sinon sa boîte, par `VolumeDeScene.poser_sur_l_arete`.
func _piece_d_avant(temoin: Node3D, kit: Node3D, volume: VolumeDeScene, a: Dictionary) -> Node3D:
	if a.famille == null:
		var boite := MeshInstance3D.new()
		boite.name = "Boite"
		temoin.add_child(boite)
		volume.poser_sur_l_arete(boite, {"mur": volume.mesh_mur, "porte-ouverte": volume.mesh_seuil}[a.piece], a)
		return boite
	var sens := Vector2(a.sens.x, a.sens.y)
	var piece := Node3D.new()
	piece.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, volume.metres_par_case, 0.0)
	piece.rotation.y = MiseEnPage.lacet_d_arete(sens)
	piece.scale = MiseEnPage.echelle_de_piece(sens, a.hauteurM, volume.metres_par_case)
	piece.add_child(kit.get_node("%s--%s" % [a.famille, a.piece]).duplicate())
	temoin.add_child(piece)
	return piece


## L'instance `rang` de `instances` contre `maillage` de la pièce d'avant : transformation dans le monde (origine et
## base à `EPSILON` près), maillage et matières.
func _comparer(lieu: String, maillage: MeshInstance3D, instances: MultiMeshInstance3D, rang: int) -> void:
	var avant := maillage.global_transform
	var apres := instances.global_transform * instances.multimesh.get_instance_transform(rang)
	var origine := avant.origin.distance_to(apres.origin)
	var base := maxf(maxf(avant.basis.x.distance_to(apres.basis.x), avant.basis.y.distance_to(apres.basis.y)), avant.basis.z.distance_to(apres.basis.z))
	_comparaisons += 1
	_ecart_origine = maxf(_ecart_origine, origine)
	_ecart_base = maxf(_ecart_base, base)
	if origine > EPSILON or base > EPSILON:
		_fautes.append("%s : %s dans le monde, %s sous la pièce d'avant" % [lieu, apres, avant])
	if instances.multimesh.mesh != maillage.mesh:
		_fautes.append("%s : un autre maillage que sous la pièce d'avant" % lieu)
		return
	for surface in maillage.mesh.get_surface_count():
		var matiere := instances.material_override if instances.material_override != null else instances.multimesh.mesh.surface_get_material(surface)
		if matiere != maillage.get_active_material(surface):
			_fautes.append("%s : surface %d dans une autre matière que sous la pièce d'avant" % [lieu, surface])


## Point 3 : onze murs du kit sous onze lampes, un bloc par mur, puis le témoin, les mêmes murs dans un seul bloc.
func _foyers(scene: Node3D, camera: Camera3D) -> void:
	var milieu := (MURS - 1) * ECART_DES_MURS / 2.0 + MiseEnPage.DEMI_CASE
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = MURS * ECART_DES_MURS * 0.75
	camera.look_at_from_position(Vector3(milieu, HAUT_DU_MUR / 2.0, 30.0), Vector3(milieu, HAUT_DU_MUR / 2.0, 0.0))
	var monde := WorldEnvironment.new()
	monde.environment = Environment.new()
	monde.environment.background_mode = Environment.BG_COLOR
	monde.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	monde.environment.ambient_light_color = Color.WHITE
	monde.environment.ambient_light_energy = 0.05
	scene.add_child(monde)
	var centres: Array[Vector3] = []
	for rang in MURS:
		var centre := MiseEnPage.centre_d_arete(Vector2(rang * ECART_DES_MURS, -0.5), 0.0, 1.0, 0.0)
		centres.append(centre)
		var lampe := OmniLight3D.new()
		lampe.position = Vector3(centre.x, HAUTEUR_DE_LAMPE, centre.z + RECUL_DE_LAMPE)
		lampe.omni_range = PORTEE_DE_LAMPE
		lampe.light_energy = 2.0
		scene.add_child(lampe)
	var eclaires := {}
	for essai: Array in [["un bloc par mur", true], ["un seul bloc", false]]:
		var murs := []
		for rang in MURS:
			murs.append(_arete("mur%d" % rang, "0/%d/0" % rang if essai[1] else "0/0/0", "colombage", "mur", Vector2(1, 0), 4.0, 0.0, Vector2(rang * ECART_DES_MURS, -0.5)))
		var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
		scene.add_child(volume)
		volume.metres_par_case = 1.0
		volume.poser_les_aretes(murs)
		var image := await _image()
		var lus := []
		var fonds := []
		var compte := 0
		for centre in centres:
			var lu := _luminance(image, camera, Vector3(centre.x, HAUTEUR_DE_LAMPE, centre.z))
			var fond := _luminance(image, camera, Vector3(centre.x, HAUT_DU_MUR, centre.z))
			lus.append(lu)
			fonds.append(fond)
			if lu > fond + ECLAIRE:
				compte += 1
		eclaires[essai[0]] = compte
		print("[aretes-en-instances] %s (%d groupes) : %d murs sur %d éclairés par leur lampe ; luminance sous chaque lampe %s, au haut de chaque mur %s" % [essai[0], volume.get_node("Aretes").get_child_count(), compte, MURS, lus, fonds])
		volume.free()
	if eclaires["un bloc par mur"] != MURS:
		_fautes.append("un bloc par mur : %d murs éclairés, attendu %d" % [eclaires["un bloc par mur"], MURS])
	var borne := 8 if RenderingServer.get_current_rendering_method() == "gl_compatibility" else MURS
	if eclaires["un seul bloc"] != borne:
		_fautes.append("témoin dans un seul bloc : %d murs éclairés, attendu %d (la borne par objet)" % [eclaires["un seul bloc"], borne])


func _image() -> Image:
	for _image_rendue in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	return root.get_texture().get_image()


## La luminance moyenne (sur 255) des 5 × 5 pixels de l'image `image` autour de celui où la caméra `camera` montre
## `lieu`.
func _luminance(image: Image, camera: Camera3D, lieu: Vector3) -> int:
	var pixel := Vector2i(camera.unproject_position(lieu) * Vector2(image.get_size()) / root.get_visible_rect().size)
	var somme := 0.0
	for dy in range(-2, 3):
		for dx in range(-2, 3):
			somme += image.get_pixelv(pixel + Vector2i(dx, dy)).get_luminance()
	return roundi(somme / 25.0 * 255.0)
