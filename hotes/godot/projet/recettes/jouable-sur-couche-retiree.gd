extends SceneTree

## Une case jouable qui se voit sur une couche que le regard retire se clique (#4028, `hotes/godot/pont/CONTRAT.md`,
## section « Monde ») : sur un plateau (`scripts/plateau.gd`) de deux couches, le rez et un plancher d'étage au-dessus
## de lui, le masque du retrait ôte la case (0, 0) de l'étage. Le rayon qui tombe à la verticale de la case touche le rez
## dessous tant que rien de jouable ne s'y voit ; il touche l'étage sous un combattant que la vue nomme sur elle, ou sous
## une cible que la vue offre hors de vue à sa case (`casesDesCibles`, plaque sans corps), même au-dessus d'un
## combattant dessiné au rez (`Plateau._peindre`, `Monde.poser_les_cases_jouables`, `Monde._toucher`). L'étage que le
## masque ne retire plus reste le premier sol touché. Au clic gauche, une cible offerte au rez prend le clic au point
## commun aux deux couches, que le plancher soit retiré ou conservé. Une plaque offerte reste cliquable au-dessus
## de la flottaison, dont les triangles sont exclus de la collision du monde.

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


class CombatEnregistre extends "res://scripts/combat.gd":
	var gestes: Array[Dictionary] = []

	func _init() -> void:
		add_child(_musique)

	func _jouer(jeu: Dictionary) -> void:
		gestes.append(jeu)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[jouable-sur-couche-retiree] version=", Engine.get_version_info().string)
	var plateau: Plateau = (load("res://scenes/Plateau.tscn") as PackedScene).instantiate()
	root.add_child(plateau)
	var monde: Monde = plateau.get_node("Monde")
	var rez := _morceau("sol/0/0/0", 0.0, 0, 0)
	var etage := _morceau("sol/1/0/0", 4.0, 1, SOL_DE_L_ETAGE)
	_poser_le_monde(plateau, rez, etage)
	monde.volume.retirer(_retrait(true))
	await physics_frame
	var cible := {cible = [HAUT.x, HAUT.y, HAUT.z]}
	plateau.montrer(_vue([], {}))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), BAS, "rien de jouable sur la case retirée")
	plateau.montrer(_vue([_combattant("cible", HAUT)], {}))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "un combattant dessiné sur la case retirée")
	plateau.montrer(_vue([], {}))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), BAS, "le combattant que la vue ne nomme plus")
	plateau.montrer(_vue([], cible))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "une cible offerte hors de vue sur la case retirée")
	plateau.montrer(_vue([_combattant("heros", BAS)], cible))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "la cible retirée au-dessus d'un combattant dessiné au rez")
	monde.volume.retirer(_retrait(false))
	plateau.montrer(_vue([], {}))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "l'étage que le masque ne retire plus")
	plateau.montrer(_vue([_combattant("heros", BAS)], {}))
	_attendu(_case(monde.sol_sous(AU_DESSUS)), HAUT, "l'étage non retiré au-dessus d'un combattant dessiné au rez")
	await _recetter_le_clic(plateau, monde, etage)
	for faute in _fautes:
		push_error("[jouable-sur-couche-retiree] " + faute)
	print("[jouable-sur-couche-retiree] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _recetter_le_clic(plateau: Plateau, monde: Monde, etage: Dictionary) -> void:
	var vue := _vue([], {
		cible = [BAS.x, BAS.y, BAS.z], autre = [BAS.x, BAS.y, BAS.z],
		etage = [HAUT.x, HAUT.y, HAUT.z], voisine = [1, 0, 0],
	})
	vue.plateau.regard = "plateau"
	vue.projection.combat.cibles.liste = [null, "cible"]
	vue.occupants = {"0,0,0": "autre", "1,0,0": "voisine"}
	vue.champ = "cliquerLaCase"
	plateau.montrer(vue)
	var combat := CombatEnregistre.new()
	combat._plateau = plateau
	combat._vue = vue
	plateau.case_cliquee.connect(combat._cliquer)
	monde.cadrer(Vector3.ZERO, 0.0, 10.0)
	await process_frame
	var points := plateau.points()
	var pied: Array = points["0,0,0"]
	var plafond: Array = points["0,0,1"]
	var point := Vector2(pied[0], pied[1])
	_attendu(point.is_equal_approx(Vector2(plafond[0], plafond[1])), true, "les deux couches publient le même point")
	var clics: Array[Vector3i] = []
	plateau.case_cliquee.connect(func(case: Vector3i) -> void: clics.append(case))
	var inspections: Array[Vector3i] = []
	plateau.case_inspectee.connect(func(case: Vector3i) -> void: inspections.append(case))

	_attendu(monde.case_sous(point), HAUT, "le rayon ordinaire s'arrête sur le plancher conservé")
	_clic(point, MOUSE_BUTTON_RIGHT)
	_attendu(inspections, [HAUT], "le clic droit inspecte la surface")
	_clic(point)
	_attendu(clics.pop_front(), BAS, "le clic gauche atteint la cible offerte sous le plancher conservé")
	var args_cible := [{x = BAS.x, y = BAS.y}, "cible"]
	_attendu(combat.gestes.back(), {type = vue.champ, args = args_cible}, "le champ vise la cible offerte, même avec un autre occupant")
	_attendu(monde.get_node("Surbrillance").get_child_count(), 1, "une seule plaque pour la case partagée")

	vue.projection.combat.cibles.liste = ["cible", "autre"]
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), BAS, "deux cibles offertes à la même case se cliquent")
	_attendu(combat.gestes.back(), {type = vue.champ, args = args_cible}, "le champ reçoit la première cible offerte à la case")

	vue.projection.combat.cibles.liste = ["cible", "etage"]
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), HAUT, "entre deux cibles offertes, le rayon prend la première rencontrée")
	vue.projection.combat.cibles.liste = ["cible"]
	plateau.montrer(vue)
	monde.volume.retirer(_retrait(true))
	_clic(point)
	_attendu(clics.pop_front(), BAS, "le clic gauche atteint la cible offerte sous le plancher retiré")
	monde.volume.retirer(_retrait(false))

	vue.projection.combat.cibles.liste = ["voisine"]
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), HAUT, "une offre ailleurs laisse le clic ordinaire sur le plancher")
	var plaques := monde.get_node("Surbrillance").get_children()
	_attendu(plaques.map(func(plaque: Node) -> Vector3i: return plaque.get_meta("case")), [Vector3i(1, 0, 0)],
		"seule la cible offerte a une plaque")
	_attendu(plateau.get_node("Combattants").get_child_count(), 0, "les occupants cachés ne deviennent pas des corps")
	_attendu(monde.get_node("Etiquettes").get_child_count(), 0, "les occupants cachés ne deviennent pas des noms")

	vue.cases = [{case = {x = BAS.x, y = BAS.y, z = BAS.z}}]
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), HAUT, "une plaque de déplacement ne prend pas la priorité d'une cible")
	vue.cases = []
	vue.projection.combat.cibles.liste = []
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), HAUT, "le clic sans offre rend le plancher")
	monde.volume.retirer(_retrait(true))
	_clic(point)
	_attendu(clics.pop_front(), BAS, "le clic ordinaire traverse la couche retirée")
	_attendu(combat.gestes.back(), {type = vue.champ, args = [{x = BAS.x, y = BAS.y}, "autre"]},
		"le clic ordinaire transmet l'occupant du rez")
	monde.volume.retirer(_retrait(false))
	var eau := _morceau("pose/0/0/0", 0.0, 0, 1)
	eau.surfaces[0].flottaison = "barge"
	_poser_le_monde(plateau, eau, etage)
	monde.cadrer(Vector3.ZERO, 0.0, 10.0)
	await physics_frame
	monde.volume.retirer(_retrait(true))
	_attendu(monde.case_sous(point), null, "avec le plancher retiré, aucune collision au niveau de la flottaison")
	monde.volume.retirer(_retrait(false))
	_clic(point)
	_attendu(clics.pop_front(), HAUT, "sans offre le clic garde le plancher au-dessus de la flottaison")
	vue.projection.combat.cibles.liste = ["cible"]
	plateau.montrer(vue)
	_clic(point)
	_attendu(clics.pop_front(), BAS, "le clic atteint la plaque offerte au niveau de la flottaison")
	_attendu(clics.size(), 0, "chaque clic ne publie qu'une case")
	combat.free()


func _clic(point: Vector2, bouton := MOUSE_BUTTON_LEFT) -> void:
	for appuye: bool in [true, false]:
		var clic := InputEventMouseButton.new()
		clic.button_index = bouton
		clic.pressed = appuye
		clic.position = point
		clic.global_position = point
		root.push_input(clic, true)


func _poser_le_monde(plateau: Plateau, rez: Dictionary, etage: Dictionary) -> void:
	plateau.poser_le_monde({
		monde = {metresParCase = METRES_PAR_CASE, hauteurs = HAUTEURS, morceaux = [rez, etage].map(_empreinte)},
		toits = [], couronnes = [], meteo = null,
	}, {volume = [rez, etage], toits = [], couronnes = []})


## Le combattant `id` que la vue nomme à la case `case`.
func _combattant(id: String, case: Vector3i) -> Dictionary:
	return {id = id, nom = id, pb = [10, 10], horsCombat = false, pos = [case.x, case.y, case.z]}


## La vue d'un combat au regard tactique, sans actif, qui nomme les combattants `voisins` et offre les cibles
## `cibles` (par id, la case `[x, y, z]` que `casesDesCibles` leur donne), hors de vue si `voisins` ne les nomme pas.
func _vue(voisins: Array, cibles: Dictionary) -> Dictionary:
	return {
		projection = {combat = {actif = null, voisins = {liste = voisins}, cibles = {liste = cibles.keys()}, apercu = null}, exploration = null},
		plateau = {regard = "tactique", toitsLeves = [], couronnesAbattues = [], aretesDegagees = [], coupesDesNavires = {}, metresParCase = METRES_PAR_CASE},
		corps = {navires = {}, decors = {}, refus = "aucun corps", combattants = {}, vehicules = {}},
		marques = {}, zonesQuiDurent = [], cases = [], champ = null, casesDesCibles = cibles,
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


## Le masque qui retire la case (0, 0) du sol de l'étage si `retiree`, qui ne retire rien sinon.
func _retrait(retiree: bool) -> Dictionary:
	var masque := PackedByteArray()
	masque.resize(LARGEUR * RANGEES)
	if retiree:
		masque[SOL_DE_L_ETAGE * LARGEUR] = 255
	return {masque = Marshalls.raw_to_base64(masque), largeur = LARGEUR, rangees = RANGEES}


func _case(touche: Variant) -> Variant:
	return null if touche == null else touche.case


func _attendu(obtenu: Variant, attendu: Variant, quoi: String) -> void:
	if obtenu != attendu:
		_fautes.append("%s : %s, attendu %s" % [quoi, obtenu, attendu])
