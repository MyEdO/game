## Le plateau du jeu : sur le monde de la scène (`Monde`), sous le regard du plateau (`vue.plateau.regard`,
## `Monde.regarder`), sa caméra à la suite de l'actif du combat, sinon du groupe (`Monde.suivre`), ou l'œil du meneur
## (`Immersion`, dont chaque case jouée part en clic), les arêtes du plateau (`vue.plateau`, `Monde.poser_les_aretes`),
## ses nappes de toit retirées (`toitsLeves`), ses arêtes retirées, abattues sous le cran de la caméra
## (`aretesDegagees`), et ses couronnes crénelées, tombées avec leur mur (`couronnesAbattues`, `Monde.cacher_le_bati`),
## chaque combattant à sa case et sa couche (`voisins`) ou, en exploration, le meneur du groupe à la case du groupe, chacun sous son
## corps (`vue.corps`, aucun sous son `refus`) et son véhicule (`vue.corps.vehicules`), chaque navire de la scène sous le
## modèle de son corps (`vue.corps.navires`, `MontageDeVehicule`), sous tout regard, coupé sous les ponts que le regard
## retire (`plateau.coupesDesNavires`), sa mer bordée par sa coque (`Monde.border_la_mer`), et chaque entité de la scène nommée à sa case, les surbrillances des cases
## que la vue peint (`vue.cases`), des cibles, des entités nommées et de l'aperçu du premier clic, et la case sous le
## pointeur jusqu'au clic, chacun sur le sol de sa case ; aucun combattant sous l'œil de l'immersion ; les effets de chaque
## appel entre ses combattants (`Effets`). Il ne rend que la
## case cliquée : celle que le monde désigne sous le pointeur, ou que l'œil franchit ou vise ; et, au clic droit, la
## case inspectée sous le pointeur.
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector3i)
## Le clic droit sur une case, qui ouvre la fiche de son occupant.
signal case_inspectee(case: Vector3i)
## Le corps d'un combattant dessiné a changé (`Combattant.habille`).
signal habille

@export var scene_combattant: PackedScene

@onready var _monde: Monde = $Monde
@onready var _combattants: Node3D = $Combattants
@onready var _navires: Node3D = $Navires
## Le montage qui tire les GLB des navires (`MontageDeComposition.scene_du_glb`) et en recueille les erreurs.
@onready var _chargeur: MontageDeComposition = $Navires/Chargeur
@onready var _immersion: Immersion = $Immersion

## Les effets des appels, rendus au plateau (`Effets`).
var _effets := Effets.new()
var _modeles: Dictionary = {}
## Par id d'entité, le montage de chaque navire posé (`_poser_les_navires`).
var _navires_montes: Dictionary = {}
var _vue: Dictionary = {}
var _survol: Variant = null


func _ready() -> void:
	_monde.cadrage_change.connect(func() -> void: _survoler(_monde.case_sous(get_viewport().get_mouse_position())))
	_immersion.case_jouee.connect(case_cliquee.emit)
	_effets.name = "Effets"
	add_child(_effets)
	_effets.depart.connect(_agir)
	_effets.arrivee.connect(_subir)


## Montre la vue.
func montrer(vue: Dictionary) -> void:
	_vue = vue
	var combat: Variant = vue.projection.combat
	var exploration: Variant = vue.projection.exploration
	var actif: Variant = null if combat == null or combat.actif == null else combat.actif.id
	var dessines: Array = []
	if combat != null:
		dessines = combat.voisins.liste
	elif exploration != null:
		dessines = exploration.heros.slice(0, 1)
		_nommer_les_entites(exploration.entites.liste)
	if vue.plateau != null:
		_monde.regarder(vue.plateau.regard)
		_monde.poser_les_aretes(vue.plateau.aretes)
		_monde.cacher_le_bati(vue.plateau.toitsLeves, vue.plateau.couronnesAbattues, vue.plateau.aretesDegagees)
		_combattants.visible = vue.plateau.regard != "immersion"
		var suivi: Array = dessines.filter(func(c: Dictionary) -> bool: return c.pos != null and (actif == null or c.id == actif))
		if not suivi.is_empty():
			_monde.suivre(_lieu(suivi[0].pos))
	_immersion.montrer(vue)
	if vue.plateau != null:
		_poser_les_navires(vue.corps.navires, vue.plateau.coupesDesNavires, vue.plateau.metresParCase)
	for c in dessines:
		if c.pos == null:
			continue
		var lieu := _lieu(c.pos)
		if not _modeles.has(c.id):
			var modele: Combattant = scene_combattant.instantiate()
			modele.position = lieu
			_combattants.add_child(modele)
			modele.habille.connect(habille.emit)
			_modeles[c.id] = modele
		_modeles[c.id].montrer(c, lieu, c.id == actif, null if vue.corps.refus != null else vue.corps.combattants.get(c.id), vue.corps.vehicules.get(c.id), vue.plateau.metresParCase)
	_peindre()


## Rend `effets` (`suite.effets`, `Effets.jouer`) entre les combattants dessinés et sur le sol des cases de chaque
## zone : l'auteur d'un coup, d'une incantation ou d'une zone se tourne vers sa cible et l'anime à son départ, la cible
## d'un coup qui touche l'accuse à son arrivée.
func jouer_les_effets(effets: Array) -> void:
	if _vue.plateau == null:
		return
	var lieux := {}
	for id: String in _modeles:
		lieux[id] = _modeles[id].position
	for effet: Dictionary in effets:
		if effet.quoi == "zone":
			var cases: Array = effet.cases.duplicate()
			cases.append(effet.centre)
			for case: Dictionary in cases:
				lieux[Effets.cle_de_case(case)] = _lieu([case.x, case.y, case.get("z", 0)])
	_effets.jouer(effets, lieux, _vue.plateau.metresParCase)


## L'auteur `de` d'un effet se tourne vers `vers` et s'anime, sauf sur lui-même (un sort sur soi, un hurlement).
func _agir(de: String, vers: Vector3) -> void:
	var auteur: Node3D = _modeles[de]
	if not auteur.position.is_equal_approx(vers):
		auteur.agir_vers(vers)


func _subir(vers: String, touche: bool) -> void:
	if touche:
		_modeles[vers].subir()


## Chaque navire de `navires` (`vue.corps.navires`) monté sous `Navires` (`_monter_le_navire`), coupé à la hauteur de
## coupe du plus bas des sols que le regard lui retire (`coupes`, `plateau.coupesDesNavires`, `MiseEnPage.hauteur_de_coupe`),
## entier sinon ; ceux que la vue ne sert plus, retirés.
func _poser_les_navires(navires: Dictionary, coupes: Dictionary, metres_par_case: float) -> void:
	for id: String in _navires_montes.keys():
		if not navires.has(id):
			_navires_montes[id].queue_free()
			_navires_montes.erase(id)
	for id: String in navires:
		if not _navires_montes.has(id):
			var montage := MontageDeVehicule.new()
			_navires.add_child(montage)
			_navires_montes[id] = montage
		_navires_montes[id].couper(MiseEnPage.hauteur_de_coupe(coupes[id], metres_par_case) if coupes.has(id) else null)
		_monter_le_navire(id, navires[id], metres_par_case)


## Le corps du navire `navire` d'id `id` monté (`MontageDeVehicule.monter`) et posé (`_poser_le_navire`) ; posé, la mer de
## sa flottaison bordée par ce que sa coque plonge sous la hauteur 0 de la scène (`MontageDeVehicule.contour_sous`,
## `Monde.border_la_mer`).
func _monter_le_navire(id: String, navire: Dictionary, metres_par_case: float) -> void:
	var montage: MontageDeVehicule = _navires_montes[id]
	var pose: bool = await montage.monter(navire.corps, _chargeur, _poser_le_navire.bind(navire, metres_par_case))
	if pose and montage.scene != null:
		_monde.border_la_mer(id, montage.contour_sous(MiseEnPage.hauteur_au_plateau(0.0, metres_par_case)))


## La scène nue `scene` du navire `navire` à l'échelle métrique du plateau de `metres_par_case`, sa proue, le +Z de son
## repère, tournée vers son cap (`MiseEnPage.lacet_de_proue`), son origine au point de la carte sous elle (`centre`), à
## la hauteur 0 de la scène, sa flottaison.
func _poser_le_navire(scene: Node3D, navire: Dictionary, metres_par_case: float) -> void:
	var echelle := MiseEnPage.echelle_metrique(metres_par_case)
	var origine := MiseEnPage.point_de_la_carte(navire.centre.x, navire.centre.y, 0.0)
	scene.transform = scene.transform.scaled(Vector3(echelle, echelle, echelle)).rotated(Vector3.UP, MiseEnPage.lacet_de_proue(MiseEnPage.LACETS_DES_CAPS[navire.corps.cap])).translated(origine)


## Chaque entité de la scène nommée au-dessus de sa case (`Monde.etiqueter`).
func _nommer_les_entites(entites: Array) -> void:
	var noms := {}
	for e in entites:
		if e.nom != null:
			noms[Vector3i(int(e.pos[0]), int(e.pos[1]), int(e.pos[2]))] = e.nom
	_monde.etiqueter(noms)


## Par id de combattant dessiné, ce que porte son corps (`Combattant.corps`).
func corps() -> Dictionary:
	var portes := {}
	for id in _modeles:
		portes[id] = _modeles[id].corps()
	return portes


## Le point de l'écran de la case de l'aperçu du premier clic (sa case, ou celle du combattant qu'il vise), `null` sans
## aperçu.
func point_de_l_apercu() -> Variant:
	var combat: Variant = _vue.get("projection", {}).get("combat")
	var apercu: Variant = null if combat == null else combat.apercu
	if apercu == null:
		return null
	var case: Variant = apercu.case
	for c in combat.voisins.liste:
		if c.id == apercu.cible:
			case = c.pos
	if case == null:
		return null
	return _monde.a_l_ecran(_lieu(case))


## Le point de l'écran du sol de chaque case de chaque couche du plateau, par sa clé `x,y,z` (`Monde.points`).
func points() -> Dictionary:
	var points := {}
	for z: int in _monde.couches():
		var couche := _monde.points(z)
		for cle: String in couche:
			points["%s,%d" % [cle, z]] = couche[cle]
	return points


## Le monde de la scène (`monde`, la réponse de l'appel `monde`) sous le plateau : son volume (`Monde.poser`), ses
## nappes de toit et ses couronnes crénelées (`Monde.poser_les_nappes`).
func poser_le_monde(monde: Dictionary) -> void:
	_monde.poser(monde.monde)
	_monde.poser_les_nappes(monde.toits, monde.couronnes)
	_monde.poser_la_meteo(monde.meteo)


## Le centre du sol de la case `pos` (`[x, y, z]`, la case et sa couche).
func _lieu(pos: Array) -> Vector3:
	return _monde.lieu(Vector2i(int(pos[0]), int(pos[1])), int(pos[2]))


## Les cases peintes (`Monde.peindre`) : celles de la vue, les cibles, l'aperçu, les entités nommées de l'exploration, puis
## la case sous le pointeur, chacune à la place de celle qu'elle portait.
func _peindre() -> void:
	var plaques := {}
	var surligner := func(pos: Array, item: int) -> void: plaques[Vector3i(int(pos[0]), int(pos[1]), int(pos[2]))] = item
	for c in _vue.get("cases", []):
		surligner.call([c.case.x, c.case.y, c.case.get("z", 0)], Monde.ITEM_ATTEIGNABLE)
	var combat: Variant = _vue.get("projection", {}).get("combat")
	if combat != null:
		var vises: Array = combat.cibles.liste.duplicate()
		var apercu: Variant = combat.apercu
		if apercu != null and apercu.cible != null:
			vises.append(apercu.cible)
		for c in combat.voisins.liste:
			if c.pos != null and vises.has(c.id):
				surligner.call(c.pos, Monde.ITEM_SURVOL if apercu != null and apercu.cible == c.id else Monde.ITEM_CIBLE)
		if apercu != null and apercu.case != null:
			surligner.call(apercu.case, Monde.ITEM_SURVOL)
	var exploration: Variant = _vue.get("projection", {}).get("exploration")
	if exploration != null:
		for e in exploration.entites.liste:
			if e.nom != null:
				surligner.call(e.pos, Monde.ITEM_CIBLE)
	if _survol != null:
		surligner.call([_survol.x, _survol.y, _survol.z], Monde.ITEM_SURVOL)
	_monde.peindre(plaques)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_survoler(_monde.case_sous(event.position))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var case: Variant = _monde.case_sous(event.position)
		_survol = null
		_peindre()
		if case != null:
			case_cliquee.emit(case)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		var case: Variant = _monde.case_sous(event.position)
		if case != null:
			case_inspectee.emit(case)
	else:
		return
	get_viewport().set_input_as_handled()


func _survoler(case: Variant) -> void:
	if case != _survol:
		_survol = case
		_peindre()
