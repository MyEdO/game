extends SceneTree

## Le monde en morceaux (#3948, `hotes/godot/pont/CONTRAT.md`, section « Monde ») : sur un plateau de 2 m par case, deux
## cases au rez et un plancher d'étage à 4 m au-dessus d'elles, chaque couche son morceau, et deux nappes de toit. Le
## volume ne demande que les clés dont l'empreinte diffère de celle qu'il a posée (`VolumeDeScene.manquants`). Posé à
## nouveau sous un manifeste où un seul morceau et une seule nappe ont changé d'empreinte et un morceau est parti, le
## morceau inchangé garde son nœud et sa forme, la nappe inchangée le sien, le morceau et la nappe changés en reçoivent
## un neuf, le morceau parti quitte l'arbre avec sa forme. Changer le masque du retrait (`VolumeDeScene.retirer`) ne crée
## ni ne libère aucun nœud ni maillage. La case de l'étage retirée, le rayon du pointeur et celui qui tombe à la
## verticale d'un lieu la traversent et touchent le rez dessous (`Monde._toucher`) ; la case voisine de l'étage, gardée,
## les arrête. Une case retirée recouvre une face gardée, un biais coplanaire du noyau plus bas : le rayon qui tombe
## jusque sous le monde et celui du pointeur, oblique et long jusqu'au plan lointain de la caméra, touchent la face gardée.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
## Le sol de deux cases, en mètres, dans le repère du volume (la case (0, 0) centrée sur l'origine), à la hauteur 0 puis
## 4 m ; la case de chacun de leurs triangles, à la couche `z`.
const REZ := [-1.0, 0.0, -1.0, 1.0, 0.0, -1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, 1.0,
	1.0, 0.0, -1.0, 3.0, 0.0, -1.0, 1.0, 0.0, 1.0, 3.0, 0.0, -1.0, 3.0, 0.0, 1.0, 1.0, 0.0, 1.0]
const SOMMETS := 12
const HAUTEURS := [{z = 0, rangees = [[0.0, 0.0]]}, {z = 1, rangees = [[4.0, 4.0]]}]
## Le masque : 2 octets par rangée, deux plans d'une rangée par couche ; le plan du sol de l'étage à la rangée 2.
const LARGEUR := 2
const RANGEES := 4
const SOL_DE_L_ETAGE := 2
## La hauteur (m) de la face retirée qui recouvre la face gardée, et l'écart (m) de la face gardée sous elle : le biais
## coplanaire du noyau (`COPLANAR_BIAS_M`, `src/noyau/monde/volume/worldTris.ts`).
const HAUT_M := 2.0
const BIAIS_COPLANAIRE_M := 0.0015
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[morceaux-du-monde] version=", Engine.get_version_info().string)
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var volume := monde.volume
	var rez := _morceau("sol/0/0/0", "rez", 0.0, 0, 0)
	var etage := _morceau("sol/1/0/0", "etage", 4.0, 1, SOL_DE_L_ETAGE)
	var decor := _morceau("pose/0/0/0", "decor", 1.0, 0, 1)
	var maison := _morceau("maison", "maison", 6.0, 1, 0)
	var grange := _morceau("grange", "grange", 7.0, 1, 0)
	var avant := _manifeste([rez, etage, decor], [maison, grange])
	_attendu(volume.manquants(avant), {volume = ["sol/0/0/0", "sol/1/0/0", "pose/0/0/0"], toits = ["maison", "grange"], couronnes = []}, "manquants, rien de posé")
	monde.poser(avant, {volume = [rez, etage, decor], toits = [maison, grange], couronnes = []})
	_attendu(volume.manquants(avant), {volume = [], toits = [], couronnes = []}, "manquants, le même manifeste posé")
	var noeuds := _noeuds(monde)
	var etage_change := _morceau("sol/1/0/0", "etage-change", 4.0, 1, SOL_DE_L_ETAGE)
	var grange_changee := _morceau("grange", "grange-changee", 7.5, 1, 0)
	var apres := _manifeste([rez, etage_change], [maison, grange_changee])
	_attendu(volume.manquants(apres), {volume = ["sol/1/0/0"], toits = ["grange"], couronnes = []}, "manquants, un morceau et une nappe changés")
	monde.poser(apres, {volume = [etage_change], toits = [grange_changee], couronnes = []})
	var reposes := _noeuds(monde)
	for garde in ["morceau sol/0/0/0", "forme sol/0/0/0", "toit maison"]:
		_attendu(reposes.get(garde), noeuds[garde], "%s inchangé, même instance" % garde)
	for change in ["morceau sol/1/0/0", "forme sol/1/0/0", "toit grange"]:
		if not reposes.has(change) or reposes[change] == noeuds[change]:
			_fautes.append("%s changé : %s, attendu un nœud neuf" % [change, "absent" if not reposes.has(change) else "même instance"])
	for parti in ["morceau pose/0/0/0", "forme pose/0/0/0"]:
		_attendu(reposes.has(parti), false, "%s parti du manifeste, hors de l'arbre" % parti)
	print("[morceaux-du-monde] reposé : %d nœuds gardés, %s" % [noeuds.keys().filter(func(cle: String) -> bool: return reposes.get(cle) == noeuds[cle]).size(), reposes.keys()])
	await physics_frame
	_attendu(_case(monde.sol_sous(Vector3(0.6, 5.0, 0.6))), Vector3i(0, 0, 1), "rien de retiré : le sol sous la case (0, 0)")
	var arbre := _arbre(monde)
	volume.retirer(_retrait(SOL_DE_L_ETAGE))
	volume.retirer(null)
	volume.retirer(_retrait(SOL_DE_L_ETAGE))
	_attendu(_arbre(monde), arbre, "les nœuds et les maillages, le masque changé trois fois")
	_attendu(_case(monde.sol_sous(Vector3(0.6, 5.0, 0.6))), Vector3i(0, 0, 0), "la case (0, 0) de l'étage retirée : le sol sous elle")
	_attendu(_case(monde.sol_sous(Vector3(1.6, 5.0, 0.6))), Vector3i(1, 0, 1), "la case (1, 0) de l'étage gardée : le sol sous elle")
	monde.regarder("immersion")
	for cas: Array in [[Vector3(0.5, 5.0, 0.5), Vector3i(0, 0, 0)], [Vector3(1.5, 5.0, 0.5), Vector3i(1, 0, 1)]]:
		monde.poser_l_oeil(cas[0], 0.0, -PI / 2.0)
		var touche: Variant = monde.touche_sous(root.get_visible_rect().size / 2.0)
		_attendu(_case(touche), cas[1], "le rayon du pointeur, l'œil au-dessus de %s" % cas[0])
		print("[morceaux-du-monde] rayon du pointeur sous %s : %s" % [cas[0], touche])
	var haut := _morceau("haut", "haut", HAUT_M, 1, SOL_DE_L_ETAGE)
	var bas := _morceau("bas", "bas", HAUT_M - BIAIS_COPLANAIRE_M, 0, 0)
	monde.poser(_manifeste([haut, bas], []), {volume = [haut, bas], toits = [], couronnes = []})
	await physics_frame
	_attendu(_case(monde.sol_sous(Vector3(0.5, 5.0, 0.5))), Vector3i(0, 0, 0), "la face gardée un biais coplanaire sous la case retirée : le sol sous elle")
	monde.poser_l_oeil(Vector3(0.5, 4.0, 3.5), 0.0, -PI / 4.0)
	var oblique: Variant = monde.touche_sous(root.get_visible_rect().size / 2.0)
	_attendu(_case(oblique), Vector3i(0, 0, 0), "la face gardée un biais coplanaire sous la case retirée : le rayon oblique du pointeur")
	print("[morceaux-du-monde] sous la case retirée, un biais coplanaire plus bas : %s" % oblique)
	for faute in _fautes:
		push_error("[morceaux-du-monde] " + faute)
	print("[morceaux-du-monde] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Une géométrie de clé `cle` et d'empreinte `empreinte` : les deux cases de `REZ` à la hauteur `hauteur` (m), à la
## couche `z`, au plan du masque de première rangée `rangee`.
func _morceau(cle: String, empreinte: String, hauteur: float, z: int, rangee: int) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	for rang in SOMMETS:
		positions.append_array([REZ[3 * rang], hauteur, REZ[3 * rang + 2]])
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([1.0, 1.0, 1.0, 1.0])
	return {cle = cle, empreinte = empreinte, rangee = rangee, positions = positions, normales = normales, couleurs = couleurs,
		cases = [0, 0, z, 0, 0, z, 1, 0, z, 1, 0, z], surfaces = [{debut = 0, fin = SOMMETS, matiere = "terrain--terre"}]}


func _manifeste(morceaux: Array, toits: Array) -> Dictionary:
	var empreintes := func(contenu: Dictionary) -> Dictionary: return {cle = contenu.cle, empreinte = contenu.empreinte}
	return {monde = {metresParCase = METRES_PAR_CASE, hauteurs = HAUTEURS, morceaux = morceaux.map(empreintes)}, toits = toits.map(empreintes), couronnes = []}


## Le masque qui retire la case (0, 0) du plan de première rangée `rangee`.
func _retrait(rangee: int) -> Dictionary:
	var masque := PackedByteArray()
	masque.resize(LARGEUR * RANGEES)
	masque[rangee * LARGEUR] = 255
	return {masque = Marshalls.raw_to_base64(masque), largeur = LARGEUR, rangees = RANGEES}


## L'instance de chaque morceau, de chaque forme et de chaque nappe de toit posés, par `<genre> <clé>`.
func _noeuds(monde: Monde) -> Dictionary:
	var noeuds := {}
	for genre: String in ["morceau", "forme", "toit"]:
		var parent: Node = monde.get_node({morceau = "VolumeDeScene/Volume/Morceaux", forme = "VolumeDeScene/Volume/Corps", toit = "VolumeDeScene/Volume/Toits"}[genre])
		for enfant in parent.get_children():
			noeuds["%s %s" % [genre, enfant.get_meta("cle")]] = enfant.get_instance_id()
	return noeuds


## L'instance de chaque nœud sous le volume, et de chaque maillage qu'il porte.
func _arbre(monde: Monde) -> Array:
	var arbre := []
	for noeud in monde.volume.find_children("*", "", true, false):
		arbre.append(noeud.get_instance_id())
		if noeud is MeshInstance3D and noeud.mesh != null:
			arbre.append(noeud.mesh.get_instance_id())
	return arbre


func _case(touche: Variant) -> Variant:
	return null if touche == null else touche.case


func _attendu(obtenu: Variant, attendu: Variant, quoi: String) -> void:
	if obtenu != attendu:
		_fautes.append("%s : %s, attendu %s" % [quoi, obtenu, attendu])
