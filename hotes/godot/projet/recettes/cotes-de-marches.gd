extends SceneTree

## Les côtés des cases de marches se posent en instances (#4471, `hotes/godot/pont/CONTRAT.md`, méthode `aretes`,
## `cotesDeMarches`) : ceux de la volée de l'échantillon d'un sol bâti (`sceneDuSol`, `src/noyau/monde/echantillons.ts`,
## figé par la sonde, `volee` de `hotes/godot/recettes/decor.ts`), posés par le volume de la scène
## (`VolumeDeScene.poser_les_aretes`), sur un plateau de 2 m comme de 3 m par case, du modèle d'escalier de test
## (`_modele_de_test` : `limon` et `rampe` à plat, modélisés du pied de la pièce vers le haut et du bord de la case vers
## le dehors), puis de chaque modèle d'escalier servi au figé, au moins un (`escaliers` de la réponse de `modeles`, lu par le
## chargeur des décors). Chaque pièce de chaque côté a son instance dans le groupe de sa pièce ; le pied de sa pièce va
## du bord du dessus de sa case à un bout (`entree`) à l'autre (`sortie`) le long de son sens, ses montants restent
## verticaux, son +Z va vers son dehors (`(-sens.y, sens.x)`) ; deux côtés voisins sur la volée se rejoignent au coin
## qu'ils partagent. Au modèle de test, la rampe d'un côté au bout -X de sa suite (`position`) prend son nœud
## `rampe--gauche`, toute autre pièce le nœud de sa pièce. Un côté dont la famille n'a aucun modèle servi ne pose rien :
## aucune boîte. L'échelle de l'échantillon d'un mur (`ENCLOS`), du modèle d'arête de test au nœud `echelle`, va de son
## pied à son pied plus le dénivelé des cases qu'elle sépare (`hauteurM`).
## L'instance d'un groupe se lit par `VolumeDeScene.transform_d_instance`, sans rendu.

const RECETTE_AUTONOME := true
## La recette des arêtes au pied : ses volumes (`volume_neuf`).
const ARETE := preload("res://recettes/arete-au-pied.gd")
const FIGE := "res://recettes/vues/decor.json"
const EPSILON := 0.001
const PLATEAUX := [2.0, 3.0]
## Les modèles de test, servis à la place du figé le temps de leur passe : l'escalier à la famille `FAMILLE`, l'arête à
## celle de l'échelle de l'échantillon ; leurs pièces, à plat, longues de `LONG`, hautes de `HAUT`, épaisses de `EPAIS`.
const MODELE_D_ESCALIER := "escalier--test"
const MODELE_D_ARETE := "arete--test"
const LONG := 2.0
const HAUT := 0.9
const EPAIS := 0.1
## Le nœud de la rampe au bout -X de sa suite, seul nœud de place du modèle d'escalier de test.
const RAMPE_A_GAUCHE := Noyau.PieceDEscalier.RAMPE + "--" + Noyau.Position.GAUCHE
## Une famille qu'aucun modèle d'escalier ne sert.
const FAMILLE_SANS_MODELE := "sans-modele"
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[cotes-de-marches] version=", Engine.get_version_info().string)
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	var cotes: Array = decor.get("volee", {}).get("cotesDeMarches", []) if decor is Dictionary else []
	var echelles := _echelles(decor) if decor is Dictionary else []
	if cotes.is_empty() or echelles.is_empty():
		push_error("[cotes-de-marches] %s : aucun côté de marches à la volée figée, ou aucune échelle aux échantillons figés" % FIGE)
		quit(2)
		return
	var famille: String = cotes[0].famille
	var servis: Dictionary = decor.modeles.get("escaliers", {})
	print("[cotes-de-marches] %d côtés de la famille %s, modèles d'escalier servis au figé : %s" % [cotes.size(), famille, servis])
	for metres_par_case: float in PLATEAUX:
		var volume := _volume_de_test(metres_par_case, famille, echelles[0].famille)
		volume.poser_les_aretes([], cotes)
		_des_cotes(volume, cotes, "test, %.0f m par case" % metres_par_case)
		_aux_noeuds_de_leur_place(volume, cotes, "test, %.0f m par case" % metres_par_case)
		_sans_modele(volume, cotes)
		_de_l_echelle(volume, echelles[0])
	if servis.is_empty():
		_fautes.append("%s : aucun modèle d'escalier servi au figé" % FIGE)
	PontFige.poser(self, decor)
	MontageDeComposition.retenir_les_modeles(decor.modeles, decor.listage)
	for servie: String in servis:
		var volume := ARETE.volume_neuf(_scene(), PLATEAUX[0])
		volume.poser_les_aretes([], cotes.map(func(c: Dictionary) -> Dictionary: return c.merged({famille = servie}, true)))
		await volume.attendre_les_aretes()
		_des_cotes(volume, cotes, "servi %s" % servis[servie])
	for faute in _fautes:
		push_error("[cotes-de-marches] " + faute)
	print("[cotes-de-marches] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)



## Les échelles des arêtes des échantillons figés (`echantillon`, chaque entrée).
static func _echelles(decor: Dictionary) -> Array:
	var echelles := []
	for echantillon: Dictionary in decor.get("echantillon", {}).values():
		echelles.append_array(echantillon.aretes.filter(func(a: Dictionary) -> bool: return a.piece == Noyau.Piece.ECHELLE))
	return echelles


func _scene() -> Node3D:
	var scene := Node3D.new()
	root.add_child(scene)
	return scene


## Un volume neuf sur un plateau de `metres_par_case`, les modèles de test retenus, celui d'escalier servi à la famille
## d'escalier `escalier` et lu, celui d'arête servi à la famille d'arête `arete`, lu à la pose de l'échelle (le volume
## libère un modèle qu'aucune pose ne demande).
func _volume_de_test(metres_par_case: float, escalier: String, arete: String) -> VolumeDeScene:
	MontageDeComposition.retenir_les_modeles({aretes = {arete: MODELE_D_ARETE}, escaliers = {escalier: MODELE_D_ESCALIER},
		surfaces = {MODELE_D_ARETE: [], MODELE_D_ESCALIER: []}}, {})
	var volume := ARETE.volume_neuf(_scene(), metres_par_case)
	volume._modeles_d_arete[MODELE_D_ESCALIER] = _modele_de_test([Noyau.PieceDEscalier.LIMON, Noyau.PieceDEscalier.RAMPE,
		RAMPE_A_GAUCHE])
	return volume


## Un modèle de test : par pièce de `pieces`, un nœud racine à mesh, une boîte de `LONG` × `HAUT` × `EPAIS` posée sur
## son pied (Y de 0 à `HAUT`) et sur son bord (Z de 0 à `EPAIS`), centrée en X ; et la taille du modèle.
static func _modele_de_test(pieces: Array) -> Dictionary:
	var scene := Node3D.new()
	for piece: String in pieces:
		var maillage := MeshInstance3D.new()
		maillage.name = piece
		var boite := BoxMesh.new()
		boite.size = Vector3(LONG, HAUT, EPAIS)
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, boite.get_mesh_arrays())
		mesh.surface_set_material(0, StandardMaterial3D.new())
		maillage.mesh = mesh
		maillage.position = Vector3(0.0, HAUT / 2.0, EPAIS / 2.0)
		scene.add_child(maillage)
	return {scene = scene, taille = Vector3(LONG, HAUT, EPAIS)}


## Les côtés `cotes` posés sur `volume`, au moment `moment` : une instance par pièce de chaque côté, chacune à sa
## place (`_a_sa_place`), et les côtés voisins joints.
func _des_cotes(volume: VolumeDeScene, cotes: Array, moment: String) -> void:
	var bouts := {}
	var poses := 0
	for groupe: Node3D in volume.get_node("Aretes").get_children():
		var de_groupe: Array = groupe.get_meta("aretes")
		if de_groupe[0].catalogue != "escaliers":
			continue
		for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
			if vu.multimesh.instance_count != de_groupe.size():
				_fautes.append("%s, groupe %s : %d instances pour %d poses" % [moment, groupe.name, vu.multimesh.instance_count, de_groupe.size()])
		for pose: Dictionary in de_groupe:
			poses += 1
			_a_sa_place(volume, groupe, pose, moment, bouts)
	var attendues: int = cotes.reduce(func(n: int, c: Dictionary) -> int: return n + c.pieces.size(), 0)
	if poses != attendues:
		_fautes.append("%s : %d pièces posées, attendu %d" % [moment, poses, attendues])
	var jointes := 0
	for coin: Vector2 in bouts:
		var hauteurs: Array = bouts[coin]
		if hauteurs.size() > 1:
			jointes += 1
			if hauteurs.any(func(h: float) -> bool: return absf(h - hauteurs[0]) > EPSILON):
				_fautes.append("%s : au coin %s, les pièces voisines s'arrêtent à %s" % [moment, coin, hauteurs])
	if jointes == 0:
		_fautes.append("%s : aucune pièce voisine d'une autre, la volée ne se recette pas" % moment)
	print("[cotes-de-marches] %s : %d pièces, %d coins joints" % [moment, poses, jointes])


## La pièce de la pose `pose`, dans le groupe `groupe`, à sa place : le pied de la pièce (Y = 0 du groupe) au bord du
## dessus de sa case, à `entree` au bout -X, à `sortie` au bout +X, ses montants verticaux, son +Z vers son dehors ;
## chaque bout relevé dans `bouts`, par son coin de grille.
func _a_sa_place(volume: VolumeDeScene, groupe: Node3D, pose: Dictionary, moment: String, bouts: Dictionary) -> void:
	var vu: MultiMeshInstance3D = groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)[0]
	var dans_le_groupe := groupe.global_transform.affine_inverse() * vu.global_transform
	var monde := vu.global_transform * volume.transform_d_instance(vu, pose) * dans_le_groupe.affine_inverse()
	var long := volume.taille_du_modele_d_arete(VolumeDeScene.modele_servi("escaliers", pose.famille)).x / 2.0
	var sens := Vector2(pose.sens.x, pose.sens.y)
	var milieu := Vector2(pose.milieu.x, pose.milieu.y)
	for bout: Array in [[-1.0, pose.entree], [1.0, pose.sortie]]:
		var coin: Vector2 = milieu + sens * bout[0] / 2.0
		var attendu := Vector3(coin.x + MiseEnPage.DEMI_CASE, bout[1] / volume.metres_par_case, coin.y + MiseEnPage.DEMI_CASE)
		var lu: Vector3 = monde * Vector3(bout[0] * long, 0.0, 0.0)
		if lu.distance_to(attendu) > EPSILON:
			_fautes.append("%s, %s %s : bout %s à %s, attendu %s" % [moment, pose.cle, pose.piece, bout[0], lu, attendu])
		bouts.get_or_add(coin, []).append(lu.y)
	if monde.basis.y.normalized().distance_to(Vector3.UP) > EPSILON:
		_fautes.append("%s, %s %s : montant vers %s, attendu vertical" % [moment, pose.cle, pose.piece, monde.basis.y.normalized()])
	var dehors := Vector3(-sens.y, 0.0, sens.x).normalized()
	if monde.basis.z.normalized().distance_to(dehors) > EPSILON:
		_fautes.append("%s, %s %s : +Z vers %s, attendu vers le dehors %s" % [moment, pose.cle, pose.piece, monde.basis.z.normalized(), dehors])


## Les pièces des côtés `cotes` posés sur `volume` du modèle de test, au moment `moment`, chacune au nœud de la place de
## sa rampe que dit son côté (`position`) : `RAMPE_A_GAUCHE` pour la rampe d'un côté `gauche`, le nœud de sa pièce
## sinon (`VolumeDeScene.noeud_de_la_piece`) ; au moins une de chaque.
func _aux_noeuds_de_leur_place(volume: VolumeDeScene, cotes: Array, moment: String) -> void:
	var place_de := {}
	for c: Dictionary in cotes:
		place_de[c.cle] = c.position
	var vus := {}
	for groupe: Node3D in volume.get_node("Aretes").get_children():
		for pose: Dictionary in groupe.get_meta("aretes"):
			if pose.catalogue != "escaliers":
				continue
			var gauche: bool = pose.piece == Noyau.PieceDEscalier.RAMPE and place_de[pose.cle] == Noyau.Position.GAUCHE
			var attendu := "Vu_%s" % (RAMPE_A_GAUCHE if gauche else pose.piece)
			vus[attendu] = true
			if groupe.find_children(attendu, "MultiMeshInstance3D", true, false).is_empty():
				_fautes.append("%s, %s %s (%s) : aucune instance %s" % [moment, pose.cle, pose.piece, place_de[pose.cle], attendu])
	if not vus.has("Vu_" + RAMPE_A_GAUCHE) or not vus.has("Vu_" + Noyau.PieceDEscalier.RAMPE):
		_fautes.append("%s : rampes posées aux nœuds %s, attendu %s et %s" % [moment, vus.keys(), RAMPE_A_GAUCHE, Noyau.PieceDEscalier.RAMPE])


## Les côtés `cotes` d'une famille qu'aucun modèle ne sert, posés sur `volume` avec les autres : aucun groupe de plus.
func _sans_modele(volume: VolumeDeScene, cotes: Array) -> void:
	var avant := volume.get_node("Aretes").get_child_count()
	volume.poser_les_aretes([], cotes + cotes.map(func(c: Dictionary) -> Dictionary: return c.merged({famille = FAMILLE_SANS_MODELE, cle = c.cle + "|sans"}, true)))
	var apres := volume.get_node("Aretes").get_child_count()
	if apres != avant:
		_fautes.append("côtés sans modèle servi : %d groupes, attendu les %d des côtés servis, aucune boîte" % [apres, avant])


## L'échelle `echelle` posée sur `volume` : son instance va de son pied à son pied plus sa hauteur, le dénivelé des
## cases qu'elle sépare.
func _de_l_echelle(volume: VolumeDeScene, echelle: Dictionary) -> void:
	volume._modeles_d_arete[MODELE_D_ARETE] = _modele_de_test([Noyau.Piece.ECHELLE])
	volume.poser_les_aretes([echelle], [])
	var groupes := volume.get_node("Aretes").get_children()
	if groupes.size() != 1:
		_fautes.append("échelle : %d groupes posés, attendu 1" % groupes.size())
		return
	var groupe: Node3D = groupes[0]
	var vu: MultiMeshInstance3D = groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)[0]
	var pose: Dictionary = groupe.get_meta("aretes")[0]
	var boite: AABB = vu.global_transform * volume.transform_d_instance(vu, pose) * vu.multimesh.mesh.get_aabb()
	var bas: float = echelle.pied / volume.metres_par_case
	var haut: float = (echelle.pied + echelle.hauteurM) / volume.metres_par_case
	if absf(boite.position.y - bas) > EPSILON or absf(boite.end.y - haut) > EPSILON:
		_fautes.append("échelle à %.0f m par case : de %.3f à %.3f, attendu de %.3f à %.3f (dénivelé %.2f m)"
			% [volume.metres_par_case, boite.position.y, boite.end.y, bas, haut, echelle.hauteurM])
