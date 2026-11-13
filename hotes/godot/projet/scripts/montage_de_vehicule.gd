## Un véhicule ou un engin monté (#2987) : le nœud qui porte la scène de l'élément d'un corps de véhicule
## (`hotes/godot/pont/CONTRAT.md`, « Corps d'un combattant », `CorpsDuVehicule`), peinte de sa palette et de son emblème,
## les pièces de ses postes montées à leur bord (`monter_au_poste`), celles de ses Améliorations à leur place
## (`monter_l_amelioration`), les nœuds que changent ses Améliorations cachés (`cacher_selon`), coupé à une hauteur
## (`couper`). Chaque combattant du plateau (`combattant.gd`) et l'atelier (`atelier.gd`) en sont deux porteurs : l'un le
## pose sur son empreinte, tourné vers son cap, l'autre au sol, sous un cadrage à sa taille ; le plateau y monte aussi
## chaque navire de la scène, coupé sous les ponts que le regard retire.
class_name MontageDeVehicule
extends Node3D

## L'id de l'élément posé (`null` : aucun).
var element: Variant = null
## L'id de l'emblème posé sur les surfaces `blason` de l'élément (`null` : aucun).
var embleme: Variant = null
## Les ids des éléments montés à ses postes, puis ceux de ses Améliorations, dans l'ordre du corps.
var postes: Array[String] = []
var ameliorations: Array[String] = []
## La scène de l'élément posé, `null` sans élément, et ses meshes, relevés avant toute pièce.
var scene: Node3D = null
## Le lecteur des clips de l'élément posé, relevé avant toute pièce (`null` : aucun), et sa table rôle → clip (`clips` du
## corps).
var lecteur: AnimationPlayer = null
var clips: Dictionary = {}
var _meshes: Array[MeshInstance3D] = []
## Le dernier corps reçu, en JSON.
var _recu := ""
## Le chargement retenu : un chargement qu'un autre remplace jette ses GLB.
var _chargement: RefCounted = null
## La hauteur, dans son repère, au-dessus de laquelle rien de sa scène n'est montré (`couper`), `null` : entière.
var coupe: Variant = null
## La boîte de sa scène, dans son repère, depuis que ses sommets portent leur hauteur (`_porter_la_hauteur`), `null` avant.
var _boite_de_coupe: Variant = null
## Les meshes de sa scène dont les sommets portent leur hauteur (`_porter_la_hauteur`), que la coupe écarte.
var _coupees: Array[MeshInstance3D] = []


## Le corps `vehicule` (`null` : aucun), s'il a changé depuis le dernier reçu : le GLB de son élément tiré par `montage`
## (`MontageDeComposition.scene_du_modele`), peint de sa `palette` et de son `embleme` (`peindre_l_element`, un emblème
## qu'aucune surface ne reçoit donne `blason-sans-surface` aux erreurs de `montage`), posé à la place du précédent, puis
## `placer` joué sur sa scène nue, avant toute pièce ; le GLB de chacune de ses pièces peint de la sienne et monté à son
## poste (`monter_au_poste`), le GLB de chacune de ses Améliorations peint de la palette du véhicule et monté à sa place
## (`monter_l_amelioration`), les nœuds que changent ses Améliorations cachés (`cacher_selon`), et sa coupe posée
## (`couper`). Chacun est peint avant d'être monté : une pièce n'est pas habillée des surfaces du véhicule. Son lecteur
## de clips et sa table `clips` sont retenus. Rend s'il a posé ce corps.
func monter(vehicule: Variant, montage: MontageDeComposition, placer: Callable) -> bool:
	var recu := JSON.stringify(vehicule)
	if recu == _recu:
		return false
	_recu = recu
	var chargement := RefCounted.new()
	_chargement = chargement
	var posee: Node3D = null if vehicule == null else await montage.scene_du_modele(vehicule.element, montage.erreurs)
	var pieces: Array[Node3D] = []
	var montees: Array[Node3D] = []
	if posee != null:
		for poste in vehicule.postes:
			pieces.append(await montage.scene_du_modele(poste.element, montage.erreurs))
		for montee in vehicule.ameliorations:
			montees.append(await montage.scene_du_modele(montee.element, montage.erreurs))
	if chargement != _chargement:
		for lot in [pieces, montees, [posee]]:
			for piece in lot:
				if piece != null:
					piece.free()
		return false
	_retirer()
	if posee == null:
		return true
	var texture: ImageTexture = montage.texture_de_l_embleme(vehicule.embleme.id) if vehicule.has("embleme") else null
	if peindre_l_element(posee, vehicule.element, vehicule.palette, texture):
		embleme = vehicule.embleme.id
	elif texture != null:
		montage.erreurs.append("blason-sans-surface : %s" % vehicule.element)
	add_child(posee)
	scene = posee
	_meshes.assign(posee.find_children("*", "MeshInstance3D", true, false))
	for candidat in posee.find_children("*", "AnimationPlayer", true, false):
		lecteur = candidat as AnimationPlayer
		break
	clips = vehicule.clips
	placer.call(posee)
	for i in pieces.size():
		if pieces[i] != null:
			peindre_l_element(pieces[i], vehicule.postes[i].element, vehicule.postes[i].palette, null)
			monter_au_poste(posee, pieces[i], vehicule.postes[i])
			postes.append(vehicule.postes[i].element)
	for i in montees.size():
		if montees[i] != null:
			peindre_l_element(montees[i], vehicule.ameliorations[i].element, vehicule.palette, null)
			monter_l_amelioration(posee, montees[i], vehicule.ameliorations[i])
			ameliorations.append(vehicule.ameliorations[i].element)
	cacher_selon(posee, vehicule.caches)
	element = vehicule.element
	_appliquer_la_coupe()
	return true


## Sorti de l'arbre avec son combattant, son atelier ou ses navires, qui n'y reviennent pas (#4195) : le chargement en
## vol est jeté (`_chargement`, `monter`).
func _exit_tree() -> void:
	_chargement = null


## Aucun véhicule : la scène posée retirée, le corps reçu oublié et le chargement en vol jeté.
func vider() -> void:
	_recu = ""
	_chargement = null
	_retirer()


## Le corps reçu oublié : le prochain, même égal, se repose (ses GLB rechargés).
func oublier() -> void:
	_recu = ""


## Le lecteur des clips du modèle posé (#4081) : le sien si un élément est posé, sinon celui de la base `base`
## (`null` : aucun).
func lecteur_pose(base: MontageDeComposition) -> AnimationPlayer:
	return lecteur if scene != null else base.lecteur


## Le clip du rôle `role` du modèle posé (#4081) : celui de sa table (`clips` du corps) si un élément est posé, sinon
## celui de la base `base` sous sa tenue (`MontageDeComposition.clip`) ; `""` sans clip pour ce rôle.
func clip_pose(role: String, base: MontageDeComposition) -> String:
	return clips.get(role, "") if scene != null else base.clip(role)


func _retirer() -> void:
	for ancienne in get_children():
		ancienne.queue_free()
	scene = null
	_boite_de_coupe = null
	_coupees.clear()
	lecteur = null
	clips = {}
	_meshes.clear()
	element = null
	embleme = null
	postes.clear()
	ameliorations.clear()


## Sa scène coupée à la hauteur `hauteur` de son repère : aucun fragment n'en est montré au-dessus, et son ombre reste
## celle de la scène entière (`_porter_la_hauteur`) ; `null` : entière. La coupe vaut pour chaque scène que `monter` pose
## ensuite.
func couper(hauteur: Variant) -> void:
	coupe = hauteur
	_appliquer_la_coupe()


## La coupe (`coupe`) sur sa scène : chaque matière écarte les fragments dont l'opacité de hauteur
## (`_porter_la_hauteur`) est sous celle de la coupe (`MiseEnPage.opacite_de_coupe`), aucun sans coupe. Rien sans scène,
## ni tant qu'aucune coupe n'a été demandée.
func _appliquer_la_coupe() -> void:
	if scene == null or (coupe == null and _boite_de_coupe == null):
		return
	if _boite_de_coupe == null:
		_boite_de_coupe = boite(scene, self)
		_coupees.assign(scene.find_children("*", "MeshInstance3D", true, false))
		for piece in _coupees:
			_porter_la_hauteur(piece, _boite_de_coupe)
	var seuil := 0.0 if coupe == null else MiseEnPage.opacite_de_coupe(coupe, _boite_de_coupe.position.y, _boite_de_coupe.end.y)
	for piece in _coupees:
		for rang in piece.mesh.get_surface_count():
			(piece.get_surface_override_material(rang) as BaseMaterial3D).alpha_scissor_threshold = seuil


## Le mesh de `piece` recopié, chaque sommet blanc, d'opacité sa hauteur dans la boîte `boite` de son repère
## (`MiseEnPage.opacite_de_coupe`), et chaque matière de ses surfaces locale (`MontageDeComposition.materiau_local`), qui
## en tire son opacité et écarte ce qui est sous son seuil. La passe d'ombre ne suit pas cette opacité (une matière à
## ciseau d'alpha de sommet n'y projette rien, ou tout) : `piece` ne projette plus d'ombre, et son double, son mesh et ses
## matières d'avant la coupe, enfant à son repère, projette seul la sienne, entière (`SHADOWS_ONLY`).
func _porter_la_hauteur(piece: MeshInstance3D, boite: AABB) -> void:
	var source := piece.mesh as ArrayMesh
	var ombre := MeshInstance3D.new()
	ombre.mesh = source
	for rang in source.get_surface_count():
		ombre.set_surface_override_material(rang, piece.get_active_material(rang))
	ombre.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	piece.add_child(ombre)
	piece.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var copie := ArrayMesh.new()
	for rang in source.get_surface_count():
		var tableaux := source.surface_get_arrays(rang)
		var couleurs := PackedColorArray()
		for sommet: Vector3 in tableaux[Mesh.ARRAY_VERTEX]:
			couleurs.append(Color(1.0, 1.0, 1.0, MiseEnPage.opacite_de_coupe(to_local(piece.to_global(sommet)).y, boite.position.y, boite.end.y)))
		tableaux[Mesh.ARRAY_COLOR] = couleurs
		copie.add_surface_from_arrays(source.surface_get_primitive_type(rang), tableaux)
		copie.surface_set_material(rang, source.surface_get_material(rang))
	piece.mesh = copie
	for rang in copie.get_surface_count():
		var locale := MontageDeComposition.materiau_local(piece, rang)
		locale.vertex_color_use_as_albedo = true
		locale.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR


## L'enveloppe convexe, dans le plan horizontal du repère global, de ce que sa scène montre sous la hauteur globale
## `hauteur` : ses sommets dessous et les points où les côtés de ses triangles la traversent, hors des doubles d'ombre.
func contour_sous(hauteur: float) -> PackedVector2Array:
	var plan := Plane(Vector3.UP, hauteur)
	var points := PackedVector2Array()
	for piece: MeshInstance3D in scene.find_children("*", "MeshInstance3D", true, false):
		if not piece.is_visible_in_tree() or piece.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY:
			continue
		for rang in piece.mesh.get_surface_count():
			var tableaux := piece.mesh.surface_get_arrays(rang)
			var globaux := PackedVector3Array()
			for sommet: Vector3 in tableaux[Mesh.ARRAY_VERTEX]:
				var point := piece.to_global(sommet)
				globaux.append(point)
				if not plan.is_point_over(point):
					points.append(Vector2(point.x, point.z))
			var ordre: Variant = range(globaux.size()) if tableaux[Mesh.ARRAY_INDEX] == null else tableaux[Mesh.ARRAY_INDEX]
			for triangle: Array in VolumeDeScene.rangs_des_triangles(ordre.size()):
				for cote in [[0, 1], [1, 2], [2, 0]]:
					var traverse: Variant = plan.intersects_segment(globaux[ordre[triangle[cote[0]]]], globaux[ordre[triangle[cote[1]]]])
					if traverse != null:
						points.append(Vector2(traverse.x, traverse.z))
	return Geometry2D.convex_hull(points)


## Par nom du matériau du GLB de l'élément posé, la couleur posée sur ses surfaces
## (`MontageDeComposition.couleurs_des_meshes`), pièces exclues.
func couleurs_posees() -> Dictionary:
	return MontageDeComposition.couleurs_des_meshes(_meshes)


## La boîte des meshes sous `noeud`, dans le repère de `dans`, son ancêtre : celle des huit coins de chacun
## (`AABB.expand`) ; `null` sans mesh.
static func boite(noeud: Node, dans: Node3D) -> Variant:
	var englobante: Variant = null
	if noeud is MeshInstance3D and (noeud as MeshInstance3D).mesh != null:
		var piece := noeud as MeshInstance3D
		var locale := piece.get_aabb()
		for coin in range(8):
			var point := dans.to_local(piece.to_global(locale.get_endpoint(coin)))
			englobante = AABB(point, Vector3.ZERO) if englobante == null else (englobante as AABB).expand(point)
	for enfant in noeud.get_children():
		var sous: Variant = boite(enfant, dans)
		if sous != null:
			englobante = sous if englobante == null else (englobante as AABB).merge(sous)
	return englobante


## Les meshes de la scène `scene` de l'élément `element` habillés de `palette` et de l'emblème `texture` (`null` :
## aucun) (`MontageDeComposition.peindre`, les `surfaces` de l'élément) ; rend si l'emblème est posé sur une surface.
static func peindre_l_element(scene: Node3D, element: String, palette: Dictionary, texture: ImageTexture) -> bool:
	return MontageDeComposition.peindre(scene.find_children("*", "MeshInstance3D", true, false), MontageDeComposition.modeles.surfaces[element], texture, palette)


## La scène `piece` d'une pièce montée sous la scène `scene` de son véhicule, au poste `poste` (`postes` du corps) : à
## sa `position` dans le repère du véhicule, dont elle prend l'échelle, tournée vers son `bord`
## (`MiseEnPage.LACETS_DES_BORDS`).
static func monter_au_poste(scene: Node3D, piece: Node3D, poste: Dictionary) -> void:
	scene.add_child(piece)
	var lieu: Array = poste.position
	piece.transform = Transform3D(Basis(Vector3.UP, MiseEnPage.LACETS_DES_BORDS[poste.bord]), Vector3(lieu[0], lieu[1], lieu[2]))


## La scène `piece` d'une pièce d'Amélioration montée sous la scène `scene` de son véhicule (`ameliorations` du corps) :
## à sa `position` dans le repère du véhicule, dont elle prend l'échelle ; montée à un poste, tournée vers son `bord`
## comme une pièce de ce poste (`monter_au_poste`), son nœud `montre` visible, `cache` caché.
static func monter_l_amelioration(scene: Node3D, piece: Node3D, montee: Dictionary) -> void:
	if not montee.has("poste"):
		scene.add_child(piece)
		var lieu: Array = montee.position
		piece.position = Vector3(lieu[0], lieu[1], lieu[2])
		return
	monter_au_poste(scene, piece, {position = montee.position, bord = montee.poste.bord})
	piece.find_child(montee.poste.montre, true, false).visible = true
	piece.find_child(montee.poste.cache, true, false).visible = false


## Les nœuds de la scène `scene` d'un véhicule, pièces montées comprises, dont le nom est l'un de `caches` (`caches` du
## corps), cachés.
static func cacher_selon(scene: Node3D, caches: Array) -> void:
	for nom: String in caches:
		for noeud in scene.find_children(nom, "Node3D", true, false):
			(noeud as Node3D).visible = false
