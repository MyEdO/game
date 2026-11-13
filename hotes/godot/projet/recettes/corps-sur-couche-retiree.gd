extends SceneTree

## Une cible sur une couche que le regard retire se clique (#4028, `hotes/godot/pont/CONTRAT.md`, section « Vue »,
## `voisins`) : sur un plateau (`scripts/plateau.gd`) de deux couches, le rez et un plancher d'étage au-dessus de lui,
## le masque du retrait ôte la case (0, 0) de l'étage. Sans combattant dessiné sur elle, le rayon qui tombe à la
## verticale de la case touche le rez dessous ; un combattant que la vue nomme sur elle (`Plateau.montrer`), il touche
## l'étage (`Monde.poser_les_corps`, `Monde._toucher`) ; la vue qui ne le nomme plus, de nouveau le rez.

const RECETTE_AUTONOME := true
const METRES_PAR_CASE := 2.0
## Le sol de deux cases, en mètres, dans le repère du volume (la case (0, 0) centrée sur l'origine).
const SOL := [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
	1.0, -1.0, 3.0, -1.0, 1.0, 1.0, 3.0, -1.0, 3.0, 1.0, 1.0, 1.0]
const SOMMETS := 12
const HAUTEURS := [{z = 0, rangees = [[0.0, 0.0]]}, {z = 1, rangees = [[4.0, 4.0]]}]
## Le masque : 2 octets par rangée, deux plans d'une rangée par couche ; le plan du sol de l'étage à la rangée 2.
const LARGEUR := 2
const RANGEES := 4
const SOL_DE_L_ETAGE := 2
const HAUT := Vector3i(0, 0, 1)
const BAS := Vector3i(0, 0, 0)
const AU_DESSUS := Vector3(0.6, 5.0, 0.6)
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[corps-sur-couche-retiree] version=", Engine.get_version_info().string)
	var plateau: Plateau = (load("res://scenes/Plateau.tscn") as PackedScene).instantiate()
	root.add_child(plateau)
	var monde: Monde = plateau.get_node("Monde")
	var rez := _morceau("sol/0/0/0", 0.0, 0, 0)
	var etage := _morceau("sol/1/0/0", 4.0, 1, SOL_DE_L_ETAGE)
	plateau.poser_le_monde({monde = {metresParCase = METRES_PAR_CASE, hauteurs = HAUTEURS, morceaux = [rez, etage].map(_empreinte)}, toits = [], couronnes = [], meteo = null},
		{volume = [rez, etage], toits = [], couronnes = []})
	monde.volume.retirer(_retrait())
	await physics_frame
	plateau.montrer(_vue([]))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), BAS, "aucun combattant dessiné sur la case retirée")
	plateau.montrer(_vue([{id = "cible", nom = "Cible", pb = [10, 10], horsCombat = false, pos = [HAUT.x, HAUT.y, HAUT.z]}]))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "un combattant dessiné sur la case retirée")
	plateau.montrer(_vue([]))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), BAS, "le combattant que la vue ne nomme plus")
	for faute in _fautes:
		push_error("[corps-sur-couche-retiree] " + faute)
	print("[corps-sur-couche-retiree] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## La vue d'un combat au regard tactique, sans actif, qui nomme les combattants `voisins` et rien d'autre.
func _vue(voisins: Array) -> Dictionary:
	return {
		projection = {combat = {actif = null, voisins = {liste = voisins}, cibles = {liste = []}, apercu = null}, exploration = null},
		plateau = {regard = "tactique", toitsLeves = [], couronnesAbattues = [], aretesDegagees = [], coupesDesNavires = {}, metresParCase = METRES_PAR_CASE},
		corps = {navires = {}, refus = "aucun corps", combattants = {}, vehicules = {}},
		marques = {}, zonesQuiDurent = [], cases = [], champ = null,
	}


## Une géométrie de clé `cle` : les deux cases de `SOL` à la hauteur `hauteur` (m), à la couche `z`, au plan du masque
## de première rangée `rangee`.
func _morceau(cle: String, hauteur: float, z: int, rangee: int) -> Dictionary:
	var positions := []
	var normales := []
	var couleurs := []
	for rang in SOMMETS:
		positions.append_array([SOL[2 * rang], hauteur, SOL[2 * rang + 1]])
		normales.append_array([0.0, 1.0, 0.0])
		couleurs.append_array([1.0, 1.0, 1.0, 1.0])
	return {cle = cle, empreinte = cle, rangee = rangee, positions = positions, normales = normales, couleurs = couleurs,
		cases = [0, 0, z, 0, 0, z, 1, 0, z, 1, 0, z], surfaces = [{debut = 0, fin = SOMMETS, matiere = "terrain--terre"}]}


func _empreinte(contenu: Dictionary) -> Dictionary:
	return {cle = contenu.cle, empreinte = contenu.empreinte}


## Le masque qui retire la case (0, 0) du sol de l'étage.
func _retrait() -> Dictionary:
	var masque := PackedByteArray()
	masque.resize(LARGEUR * RANGEES)
	masque[SOL_DE_L_ETAGE * LARGEUR] = 255
	return {masque = Marshalls.raw_to_base64(masque), largeur = LARGEUR, rangees = RANGEES}


func _case(touche: Variant) -> Variant:
	return null if touche == null else touche.case


func _attendu(obtenu: Variant, attendu: Variant, quoi: String) -> void:
	if obtenu != attendu:
		_fautes.append("%s : %s, attendu %s" % [quoi, obtenu, attendu])
