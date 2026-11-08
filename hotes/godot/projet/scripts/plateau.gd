## Le plateau du jeu : sur le monde de la scène (`Monde`), sous le regard du plateau (`vue.plateau.regard`,
## `Monde.regarder`), sa caméra à la suite de l'actif du combat, sinon du groupe (`Monde.suivre`), ou l'œil du meneur
## (`Immersion`, dont chaque case jouée part en clic), les arêtes du plateau (`vue.plateau`, `Monde.poser_les_aretes`),
## ses nappes de toit retirées (`toitsLeves`), ses arêtes retirées, abattues sous le cran de la caméra
## (`aretesDegagees`), et ses couronnes crénelées, tombées avec leur mur (`couronnesAbattues`, `Monde.cacher_le_bati`),
## chaque combattant à sa case et sa couche (`voisins`) ou, en exploration, le meneur du groupe à la case du groupe, chacun sous son
## corps (`vue.corps`, aucun sous son `refus`) et son véhicule (`vue.corps.vehicules`), et chaque entité de la scène nommée à sa case, les surbrillances des cases
## que la vue peint (`vue.cases`), des cibles, des entités nommées et de l'aperçu du premier clic, et la case sous le
## pointeur jusqu'au clic, chacun sur le sol de sa case ; aucun combattant sous l'œil de l'immersion. Il ne rend que la
## case cliquée : celle que le monde désigne sous le pointeur, ou que l'œil franchit ou vise.
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector3i)
## Le corps d'un combattant dessiné a changé (`Combattant.habille`).
signal habille

@export var scene_combattant: PackedScene

@onready var _monde: Monde = $Monde
@onready var _combattants: Node3D = $Combattants
@onready var _immersion: Immersion = $Immersion

var _modeles: Dictionary = {}
var _vue: Dictionary = {}
var _survol: Variant = null


func _ready() -> void:
	_monde.cadrage_change.connect(func() -> void: _survoler(_monde.case_sous(get_viewport().get_mouse_position())))
	_immersion.case_jouee.connect(case_cliquee.emit)


## Montre la vue ; chaque ligne de `journal` qui nomme un acteur et sa cible tourne l'acteur vers elle et l'anime, et
## la cible accuse le coup.
func montrer(vue: Dictionary, journal: Array) -> void:
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
	for ligne in journal:
		var e: Variant = ligne.get("evenement")
		if e != null and _modeles.has(e.get("actorId", "")) and _modeles.has(e.get("targetId", "")) and e.actorId != e.targetId:
			_modeles[e.actorId].agir_vers(_modeles[e.targetId].position)
			_modeles[e.targetId].subir()
	_peindre()


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
	else:
		return
	get_viewport().set_input_as_handled()


func _survoler(case: Variant) -> void:
	if case != _survol:
		_survol = case
		_peindre()
