## Un véhicule ou un engin monté (#2987) : le nœud qui porte la scène de l'élément d'un corps de véhicule
## (`hotes/godot/pont/CONTRAT.md`, « Corps d'un combattant », `CorpsDuVehicule`), peinte de sa palette et de son emblème,
## les pièces de ses postes montées à leur bord (`monter_au_poste`), celles de ses Améliorations à leur place
## (`monter_l_amelioration`), les nœuds que changent ses Améliorations cachés (`cacher_selon`). Chaque combattant du
## plateau (`combattant.gd`) et l'atelier (`atelier.gd`) en sont deux porteurs : l'un le pose sur son empreinte, tourné
## vers son cap, l'autre au sol, sous un cadrage à sa taille.
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


## Le corps `vehicule` (`null` : aucun), s'il a changé depuis le dernier reçu : le GLB de son élément tiré par `montage`
## (`MontageDeComposition.scene_du_glb`), peint de sa `palette` et de son `embleme` (`peindre_l_element`, un emblème
## qu'aucune surface ne reçoit donne `blason-sans-surface` aux erreurs de `montage`), posé à la place du précédent, puis
## `placer` joué sur sa scène nue, avant toute pièce ; le GLB de chacune de ses pièces peint de la sienne et monté à son
## poste (`monter_au_poste`), le GLB de chacune de ses Améliorations peint de la palette du véhicule et monté à sa place
## (`monter_l_amelioration`), les nœuds que changent ses Améliorations cachés (`cacher_selon`). Chacun est peint avant
## d'être monté : une pièce n'est pas habillée des surfaces du véhicule. Son lecteur de clips et sa table `clips` sont
## retenus. Rend s'il a posé ce corps.
func monter(vehicule: Variant, montage: MontageDeComposition, placer: Callable) -> bool:
	var recu := JSON.stringify(vehicule)
	if recu == _recu:
		return false
	_recu = recu
	var chargement := RefCounted.new()
	_chargement = chargement
	var posee: Node3D = null if vehicule == null else await montage.scene_du_glb(vehicule.element, montage.erreurs)
	var pieces: Array[Node3D] = []
	var montees: Array[Node3D] = []
	if posee != null:
		for poste in vehicule.postes:
			pieces.append(await montage.scene_du_glb(poste.element, montage.erreurs))
		for montee in vehicule.ameliorations:
			montees.append(await montage.scene_du_glb(montee.element, montage.erreurs))
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
	return true


## Aucun véhicule : la scène posée retirée, le corps reçu oublié et le chargement en vol jeté.
func vider() -> void:
	_recu = ""
	_chargement = null
	_retirer()


## Le corps reçu oublié : le prochain, même égal, se repose (ses GLB rechargés).
func oublier() -> void:
	_recu = ""


func _retirer() -> void:
	for ancienne in get_children():
		ancienne.queue_free()
	scene = null
	lecteur = null
	clips = {}
	_meshes.clear()
	element = null
	embleme = null
	postes.clear()
	ameliorations.clear()


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
