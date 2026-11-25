extends SceneTree

## Les pièces de toit se posent en instances sur les arêtes des toits (#4471, `hotes/godot/pont/CONTRAT.md`, méthode
## `aretes`, `piecesDeToit`) : celles des échantillons de toit figés par la sonde (`toit` de `hotes/godot/recettes/decor.ts`,
## une couverture sur ses quatre profils à 2 m comme à 3 m par case, et le plan de l'Opéra), une pièce par case, faîtières,
## arêtiers et noues, posées par le volume de la scène (`VolumeDeScene.poser_les_aretes`) sur les nappes de ce même
## échantillon (`VolumeDeScene.poser`), du modèle de toit de test (`_modele_de_test` : une `faitiere` longue de `LONG`,
## un `aretier` et une `noue` longs de `LONG_D_ARETE`, chacun le long de X, Y à 0 sur son arête, un V en travers dont
## chaque bras descend, ou monte pour la noue, d'une pente de 1), puis de chaque modèle de toit servi au figé (`toits` de
## la réponse de `modeles`), chaque pièce que son kit porte. Chaque pièce a son instance ; son arête court d'un bout à
## l'autre, à leurs cotes, cisaillée de son gradient, et deux pièces voisines se rejoignent au bout qu'elles partagent ;
## au modèle de test, le bout de chaque bras de chaque pièce repose sur le plus haut des triangles des nappes posées à
## son aplomb, quelle que soit sa nappe, sans exception : une arête recule à un nœud de ce dont sa pose y déborderait
## (`src/noyau/monde/piecesDeToit.ts`) ; cachée avec sa nappe (`VolumeDeScene.cacher`), elle quitte les instances vues,
## et y revient quand la nappe revient. L'instance se lit par `VolumeDeScene.transform_d_instance`, sans rendu.

const RECETTE_AUTONOME := true
## La recette des arêtes au pied : ses volumes (`volume_neuf`).
const ARETE := preload("res://recettes/arete-au-pied.gd")
const FIGE := "res://recettes/vues/decor.json"
const EPSILON := 0.001
## Le modèle de test, servi à la famille des pièces de toit figées le temps de sa passe : sa faîtière longue de `LONG`,
## son arêtier et sa noue longs de `LONG_D_ARETE` (la diagonale d'une case de 2 m), leurs bras larges de `BRAS` en
## travers, descendant d'autant, montant d'autant pour la noue (`SENS_DES_BRAS`).
const MODELE_DE_TOIT := "toit--test"
const LONG := 2.0
const LONG_D_ARETE := 2.0 * sqrt(2.0)
const BRAS := 0.4
const SENS_DES_BRAS := {faitiere = -1.0, aretier = -1.0, noue = 1.0}
## La part de la longueur de la pièce où se sondent les bouts de ses bras, en deçà de ses bouts.
const SONDE := 0.8
## L'écart, en mètres, dont les rangs coplanaires des faces d'une nappe (`COPLANAR_BIAS_M` de
## `src/noyau/monde/volume/worldTris.ts`, par rang) décalent le soffite d'une rive du plan de son pan.
const RANGS_M := 0.01
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[pieces-de-toit] version=", Engine.get_version_info().string)
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	var echantillons: Dictionary = decor.get("toit", {}) if decor is Dictionary else {}
	if echantillons.is_empty() or echantillons.values().any(func(e: Dictionary) -> bool: return e.piecesDeToit.is_empty()):
		push_error("[pieces-de-toit] %s : aucun échantillon de toit figé, ou un échantillon sans pièce de toit" % FIGE)
		quit(2)
		return
	var servis: Dictionary = decor.modeles.get("toits", {})
	print("[pieces-de-toit] échantillons à %s m par case, modèles de toit servis au figé : %s" % [echantillons.keys(), servis])
	for cle: String in echantillons:
		var echantillon: Dictionary = echantillons[cle]
		var moment := "test, %s (%s m par case)" % [cle, echantillon.monde.metresParCase]
		var volume := _volume_de_test(echantillon)
		volume.poser_les_aretes([], [], echantillon.piecesDeToit)
		_des_pieces(volume, echantillon.piecesDeToit, moment, true)
		_avec_leur_nappe(volume, echantillon.piecesDeToit, moment)
	PontFige.poser(self, decor)
	MontageDeComposition.retenir_les_modeles(decor.modeles, decor.listage)
	var echantillon: Dictionary = echantillons.opera
	for servie: String in servis:
		var volume := _volume(echantillon)
		var pieces: Array = echantillon.piecesDeToit.map(func(f: Dictionary) -> Dictionary: return f.merged({famille = servie}, true))
		volume.poser_les_aretes([], [], pieces)
		await volume.attendre_les_aretes()
		var scene: Node = volume._modeles_d_arete[servis[servie]].scene
		_des_pieces(volume, pieces.filter(func(f: Dictionary) -> bool: return not VolumeDeScene.noeud_de_la_piece(scene, f.piece, f.position).is_empty()), "servi %s" % servis[servie], false)
	for faute in _fautes:
		push_error("[pieces-de-toit] " + faute)
	print("[pieces-de-toit] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un volume neuf sous une scène neuve de la racine, les nappes de l'échantillon `echantillon` posées.
func _volume(echantillon: Dictionary) -> VolumeDeScene:
	var scene := Node3D.new()
	root.add_child(scene)
	var volume := ARETE.volume_neuf(scene, echantillon.monde.metresParCase)
	var recus := {volume = echantillon.monde.morceaux, toits = echantillon.toits, couronnes = echantillon.couronnes}
	volume.poser({monde = echantillon.monde, toits = echantillon.toits, couronnes = echantillon.couronnes}, recus)
	return volume


## `_volume`, le modèle de test retenu, servi à la famille des pièces de toit de l'échantillon, et lu.
func _volume_de_test(echantillon: Dictionary) -> VolumeDeScene:
	var famille: String = echantillon.piecesDeToit[0].famille
	MontageDeComposition.retenir_les_modeles({toits = {famille: MODELE_DE_TOIT}, surfaces = {MODELE_DE_TOIT: []}}, {})
	var volume := _volume(echantillon)
	volume._modeles_d_arete[MODELE_DE_TOIT] = _modele_de_test()
	return volume


## Le modèle de test : un nœud racine à mesh par pièce de toit, deux bras en V le long de X, de l'arête (Y = 0, Z = 0)
## à leur bout (Y = ±`BRAS` selon `SENS_DES_BRAS`, Z = ±`BRAS`), longs de `LONG` pour la faîtière, de `LONG_D_ARETE`
## pour l'arêtier et la noue ; et la taille du modèle.
static func _modele_de_test() -> Dictionary:
	var scene := Node3D.new()
	for piece: String in [Noyau.PieceDeToit.FAITIERE, Noyau.PieceDeToit.ARETIER, Noyau.PieceDeToit.NOUE]:
		var long := LONG if piece == Noyau.PieceDeToit.FAITIERE else LONG_D_ARETE
		var maillage := MeshInstance3D.new()
		maillage.name = piece
		var sommets := PackedVector3Array()
		for cote: float in [-1.0, 1.0]:
			var a := Vector3(-long / 2.0, 0.0, 0.0)
			var b := Vector3(long / 2.0, 0.0, 0.0)
			var c := Vector3(long / 2.0, SENS_DES_BRAS[piece] * BRAS, cote * BRAS)
			var d := Vector3(-long / 2.0, SENS_DES_BRAS[piece] * BRAS, cote * BRAS)
			sommets.append_array([a, b, c, a, c, d])
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = sommets
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		mesh.surface_set_material(0, StandardMaterial3D.new())
		maillage.mesh = mesh
		scene.add_child(maillage)
	return {scene = scene, taille = Vector3(LONG_D_ARETE, 2.0 * BRAS, 2.0 * BRAS)}


## Le repère qui porte un point du modèle de la pose `pose`, posée dans `groupe`, au monde.
static func _au_monde(volume: VolumeDeScene, groupe: Node3D, pose: Dictionary) -> Transform3D:
	var vu: MultiMeshInstance3D = groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)[0]
	var dans_le_groupe := groupe.global_transform.affine_inverse() * vu.global_transform
	return vu.global_transform * volume.transform_d_instance(vu, pose) * dans_le_groupe.affine_inverse()


## Les groupes des pièces de toit posées sur `volume`.
static func _groupes(volume: VolumeDeScene) -> Array:
	return volume.get_node("Aretes").get_children().filter(func(g: Node3D) -> bool: return g.get_meta("aretes")[0].catalogue == "toits")


## Les pièces de toit `pieces` posées sur `volume`, au moment `moment` : une instance chacune, son arête d'un bout à
## l'autre à leurs cotes, les voisines jointes ; et, si `sur_les_pans`, le bout de chaque bras sur le toit à son aplomb.
func _des_pieces(volume: VolumeDeScene, pieces: Array, moment: String, sur_les_pans: bool) -> void:
	var triangles := _triangles_des_nappes(volume)
	var bouts := {}
	var poses := 0
	var sondes := 0
	var par_piece := {}
	var tolerance := EPSILON + RANGS_M / volume.metres_par_case
	for groupe: Node3D in _groupes(volume):
		var de_groupe: Array = groupe.get_meta("aretes")
		for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
			if vu.multimesh.instance_count != de_groupe.size():
				_fautes.append("%s, groupe %s : %d instances pour %d poses" % [moment, groupe.name, vu.multimesh.instance_count, de_groupe.size()])
		for pose: Dictionary in de_groupe:
			poses += 1
			par_piece[pose.piece] = par_piece.get(pose.piece, 0) + 1
			var monde := _au_monde(volume, groupe, pose)
			var modele := VolumeDeScene.modele_servi("toits", pose.famille)
			var noeud := VolumeDeScene.noeud_de_la_piece(volume._modeles_d_arete[modele].scene, pose.piece, pose.position)
			var long := volume.taille_de_la_piece(modele, noeud).x / 2.0
			var sens := Vector2(pose.sens.x, pose.sens.y)
			var milieu := Vector2(pose.milieu.x, pose.milieu.y)
			for bout: Array in [[-1.0, pose.entree], [1.0, pose.sortie]]:
				var coin: Vector2 = milieu + sens * bout[0] / 2.0
				var attendu := Vector3(coin.x + MiseEnPage.DEMI_CASE, bout[1] / volume.metres_par_case, coin.y + MiseEnPage.DEMI_CASE)
				var lu: Vector3 = monde * Vector3(bout[0] * long, 0.0, 0.0)
				if lu.distance_to(attendu) > EPSILON:
					_fautes.append("%s, %s : bout %s de l'arête à %s, attendu %s" % [moment, pose.cle, bout[0], lu, attendu])
				bouts.get_or_add(Vector2(snappedf(coin.x, EPSILON), snappedf(coin.y, EPSILON)), []).append(lu)
			if sur_les_pans:
				for le_long: float in [-SONDE, 0.0, SONDE]:
					for cote: float in [-1.0, 1.0]:
						var bras: Vector3 = monde * Vector3(le_long * long, SENS_DES_BRAS[pose.piece] * BRAS, cote * BRAS)
						var pan := _pan_sous(triangles, bras)
						sondes += 1
						var sous := NAN if pan.is_empty() else _cote_du_plan(pan, bras)
						if is_nan(sous) or absf(bras.y - sous) > tolerance:
							_fautes.append("%s, %s : bras %s à %.4f, pan à %.4f" % [moment, pose.cle, cote, bras.y, sous])
	if poses != pieces.size():
		_fautes.append("%s : %d pièces de toit posées, attendu %d" % [moment, poses, pieces.size()])
	var jointes := 0
	for coin: Vector2 in bouts:
		var points: Array = bouts[coin]
		if points.size() > 1:
			jointes += 1
			if points.any(func(p: Vector3) -> bool: return p.distance_to(points[0]) > EPSILON):
				_fautes.append("%s : au bout %s, les pièces voisines s'arrêtent à %s" % [moment, coin, points])
	if jointes == 0 and pieces.size() > 1:
		_fautes.append("%s : aucune pièce voisine d'une autre, la continuité ne se recette pas" % moment)
	if sur_les_pans and sondes == 0:
		_fautes.append("%s : aucun bras sondé sur son pan" % moment)
	print("[pieces-de-toit] %s : %d pièces %s, %d bouts joints, %d bras sondés" % [moment, poses, par_piece, jointes, sondes])


## Les triangles des nappes posées sur `volume`, au monde, ceux qui ne sont pas verticaux.
static func _triangles_des_nappes(volume: VolumeDeScene) -> Array:
	var triangles := []
	for nappe: Node3D in volume.get_node("Volume/Toits").get_children():
		var vu := nappe.get_node("Vu") as MeshInstance3D
		var faces := vu.mesh.get_faces()
		for i in range(0, faces.size(), 3):
			var t := [vu.global_transform * faces[i], vu.global_transform * faces[i + 1], vu.global_transform * faces[i + 2]]
			if absf((t[1] - t[0]).cross(t[2] - t[0]).normalized().y) > EPSILON:
				triangles.append(t)
	return triangles


## Les coordonnées barycentriques, en X et Z, du point `p` dans le triangle `t`.
static func _barycentre(t: Array, p: Vector3) -> Vector3:
	var a := Vector2(t[0].x, t[0].z)
	var b := Vector2(t[1].x, t[1].z)
	var c := Vector2(t[2].x, t[2].z)
	var q := Vector2(p.x, p.z)
	var aire := (b - a).cross(c - a)
	var u := (b - q).cross(c - q) / aire
	var v := (c - q).cross(a - q) / aire
	return Vector3(u, v, 1.0 - u - v)


## La cote du plan du triangle `t` à l'aplomb du point `p`, dedans ou dehors.
static func _cote_du_plan(t: Array, p: Vector3) -> float:
	var k := _barycentre(t, p)
	return k.x * t[0].y + k.y * t[1].y + k.z * t[2].y


## Le plus haut des triangles `triangles` qui couvrent le point `p` (en X et Z), `[]` si aucun ne le couvre.
static func _pan_sous(triangles: Array, p: Vector3) -> Array:
	var dessus := []
	for t: Array in triangles:
		var k := _barycentre(t, p)
		if k.x < -EPSILON or k.y < -EPSILON or k.z < -EPSILON:
			continue
		if dessus.is_empty() or _cote_du_plan(t, p) > _cote_du_plan(dessus, p):
			dessus = t
	return dessus


## Chaque pièce de `pieces` posée sur `volume` cachée avec sa nappe (`cacher`), hors des instances vues de son
## groupe, et rendue avec elle.
func _avec_leur_nappe(volume: VolumeDeScene, pieces: Array, moment: String) -> void:
	for f: Dictionary in pieces:
		volume.cacher([], [f.nappe], [])
		if _vue(volume, f.cle):
			_fautes.append("%s, %s : vue sous sa nappe %s cachée" % [moment, f.cle, f.nappe])
		volume.cacher([], [], [])
		if not _vue(volume, f.cle):
			_fautes.append("%s, %s : cachée sous sa nappe %s montrée" % [moment, f.cle, f.nappe])


## Si la pose de clé `cle` est parmi les instances vues de son groupe (`ordre`, `visible_instance_count`).
static func _vue(volume: VolumeDeScene, cle: String) -> bool:
	for groupe: Node3D in _groupes(volume):
		var ordre: Array = groupe.get_meta("ordre")
		var vu: MultiMeshInstance3D = groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)[0]
		for rang in ordre.size():
			if ordre[rang].cle == cle:
				return rang < vu.multimesh.visible_instance_count
	return false
