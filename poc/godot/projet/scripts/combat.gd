## Combat isométrique du prototype #2793 : géométrie (grille, chemin, adjacence), saisie, affichage et
## politique de l'IA adverse. Jets, Blessures, Avantage, initiative, Mouvement et issue viennent de `Pont`.
extends Node2D

const SOURCE_ATTEIGNABLE := 2
const SOURCE_SURVOL := 3
const SOURCE_CIBLE := 4
const POIDS_OCCUPE := 1000.0
const DELAI_IA_S := 0.6
const GRAINE := 1
const VOISINS: Array[Vector2i] = [
	Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1),
	Vector2i(1, 1), Vector2i(1, -1), Vector2i(-1, 1), Vector2i(-1, -1),
]

@export var scene_unite: PackedScene

@onready var _sol: TileMapLayer = $Sol
@onready var _surbrillance: TileMapLayer = $Surbrillance
@onready var _unites: Node2D = $Unites
@onready var _departs_heros: Node2D = $Departs/Heros
@onready var _departs_adversaires: Node2D = $Departs/Adversaires
@onready var _interface: InterfaceCombat = $Interface
@onready var _mesures: Node = $Mesures

var _astar := AStarGrid2D.new()
var _vue: Dictionary = {}
var _positions: Dictionary = {}
var _jetons: Dictionary = {}
var _mode := ""
var _occupe := false
var _case_survolee := Vector2i(-1, -1)
var _atteignables: Dictionary = {}


func _ready() -> void:
	_construire_grille()
	_interface.demande_mode.connect(_basculer_mode)
	_interface.demande_fin_de_tour.connect(_fin_de_tour_joueur)
	Pont.erreur_pont.connect(_interface.afficher_erreur)
	Pont.refus.connect(func(erreur: Dictionary) -> void: _interface.afficher_message(str(erreur.get("message", ""))))
	if not Pont.est_web:
		_interface.afficher_hors_navigateur()
		return
	if not Pont.est_pret():
		await Pont.pret
	var reponse := Pont.appeler("demarrer", {graine = GRAINE})
	if not reponse.get("ok", false):
		return
	_placer(reponse.vue)
	_appliquer_vue(reponse.vue)
	_mesures.lancer(_vue)
	_suite_du_tour()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("fin_de_tour"):
		_fin_de_tour_joueur()
	elif event.is_action_pressed("annuler"):
		_poser_mode("")
	elif event.is_action_pressed("mode_deplacer"):
		_basculer_mode("deplacer")
	elif event.is_action_pressed("mode_attaquer"):
		_basculer_mode("attaquer")
	elif event is InputEventMouseMotion:
		var case := _sol.local_to_map(_sol.get_local_mouse_position())
		if case != _case_survolee:
			_case_survolee = case
			_peindre_surbrillance()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_cliquer(_sol.local_to_map(_sol.get_local_mouse_position()))
	else:
		return
	get_viewport().set_input_as_handled()


# --- Géométrie ---------------------------------------------------------------------------------

func _construire_grille() -> void:
	_astar.region = _sol.get_used_rect()
	_astar.cell_size = Vector2(_sol.tile_set.tile_size)
	_astar.cell_shape = AStarGrid2D.CELL_SHAPE_ISOMETRIC_DOWN
	_astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_astar.default_compute_heuristic = AStarGrid2D.HEURISTIC_CHEBYSHEV
	_astar.default_estimate_heuristic = AStarGrid2D.HEURISTIC_CHEBYSHEV
	_astar.update()
	for case in _cases():
		var donnees := _sol.get_cell_tile_data(case)
		_astar.set_point_solid(case, donnees == null or donnees.get_custom_data("bloquant"))


func _cases() -> Array[Vector2i]:
	var cases: Array[Vector2i] = []
	var zone := _astar.region
	for y in range(zone.position.y, zone.end.y):
		for x in range(zone.position.x, zone.end.x):
			cases.append(Vector2i(x, y))
	return cases


func _occupant(case: Vector2i) -> String:
	for id in _positions:
		if _positions[id] == case:
			return id
	return ""


func _adjacent(a: Vector2i, b: Vector2i) -> bool:
	return a != b and maxi(absi(a.x - b.x), absi(a.y - b.y)) == 1


## Plus court chemin (départ et arrivée compris) ; les cases occupées hors `libres` sont exclues.
func _chemin(depart: Vector2i, arrivee: Vector2i, libres: Array) -> Array[Vector2i]:
	for case in _cases():
		_astar.set_point_weight_scale(case, 1.0)
	for id in _positions:
		if not libres.has(_positions[id]):
			_astar.set_point_weight_scale(_positions[id], POIDS_OCCUPE)
	var chemin: Array[Vector2i] = _astar.get_id_path(depart, arrivee)
	for i in range(1, chemin.size()):
		if not libres.has(chemin[i]) and _occupant(chemin[i]) != "":
			return chemin.slice(0, i)
	return chemin


func _calculer_atteignables(c: Dictionary) -> Dictionary:
	var resultat := {}
	if c.aDeplace:
		return resultat
	var depart: Vector2i = _positions[c.id]
	var portee := int(c.mouvement)
	for case in _cases():
		if case == depart or _astar.is_point_solid(case) or _occupant(case) != "":
			continue
		if maxi(absi(case.x - depart.x), absi(case.y - depart.y)) > portee:
			continue
		var chemin := _chemin(depart, case, [depart])
		if not chemin.is_empty() and chemin[-1] == case and chemin.size() - 1 <= portee:
			resultat[case] = chemin
	return resultat


func _adversaires_adjacents(c: Dictionary) -> Array[String]:
	var ids: Array[String] = []
	if not _positions.has(c.id):
		return ids
	for autre in _vue.combattants:
		if autre.camp != c.camp and _positions.has(autre.id) and _adjacent(_positions[c.id], _positions[autre.id]):
			ids.append(autre.id)
	return ids


# --- Vue du pont -------------------------------------------------------------------------------

func _placer(vue: Dictionary) -> void:
	var rangs := {heros = 0, adversaires = 0}
	for c in vue.combattants:
		var departs: Node2D = _departs_heros if c.camp == "heros" else _departs_adversaires
		var rang: int = rangs[c.camp]
		rangs[c.camp] = rang + 1
		if rang >= departs.get_child_count():
			push_error("[combat] aucun point de départ pour ", c.id, " (camp ", c.camp, ")")
			continue
		var case := _sol.local_to_map(_sol.to_local(departs.get_child(rang).global_position))
		var jeton: Unite = scene_unite.instantiate()
		jeton.position = _sol.map_to_local(case)
		_unites.add_child(jeton)
		jeton.configurer(c)
		_positions[c.id] = case
		_jetons[c.id] = jeton


func _appliquer_vue(vue: Dictionary) -> void:
	_vue = vue
	for c in vue.combattants:
		if _jetons.has(c.id):
			_jetons[c.id].mettre_a_jour(c, c.id == vue.actif)
		if c.horsDeCombat:
			_positions.erase(c.id)
	_interface.afficher_vue(vue)
	_rafraichir()
	if vue.issue != null:
		_interface.afficher_issue(vue.issue)


func _combattant(id: Variant) -> Dictionary:
	for c in _vue.get("combattants", []):
		if c.id == id:
			return c
	return {}


func _actif() -> Dictionary:
	return _combattant(_vue.get("actif"))


func _tour_du_joueur() -> bool:
	var c := _actif()
	return not _occupe and _vue.get("issue") == null and not c.is_empty() and c.camp == "heros"


func _rafraichir() -> void:
	var c := _actif()
	var joueur := _tour_du_joueur()
	_atteignables = _calculer_atteignables(c) if joueur and _mode == "deplacer" else {}
	_peindre_surbrillance()
	_interface.regler_actions(
		joueur and not c.aDeplace and int(c.mouvement) > 0,
		joueur and not c.aAttaque and not _adversaires_adjacents(c).is_empty(),
		joueur,
		_mode)


func _peindre_surbrillance() -> void:
	_surbrillance.clear()
	if not _tour_du_joueur():
		return
	for case in _atteignables:
		_surbrillance.set_cell(case, SOURCE_ATTEIGNABLE, Vector2i.ZERO)
	var c := _actif()
	if not c.aAttaque and _mode != "":
		for id in _adversaires_adjacents(c):
			_surbrillance.set_cell(_positions[id], SOURCE_CIBLE, Vector2i.ZERO)
	if _astar.is_in_boundsv(_case_survolee):
		_surbrillance.set_cell(_case_survolee, SOURCE_SURVOL, Vector2i.ZERO)


# --- Gestes ------------------------------------------------------------------------------------

func _poser_mode(mode: String) -> void:
	if not _tour_du_joueur():
		return
	_mode = mode
	_rafraichir()


func _basculer_mode(mode: String) -> void:
	_poser_mode("" if _mode == mode else mode)


func _mode_par_defaut(c: Dictionary) -> String:
	if not c.aDeplace and int(c.mouvement) > 0:
		return "deplacer"
	if not c.aAttaque and not _adversaires_adjacents(c).is_empty():
		return "attaquer"
	return ""


func _cliquer(case: Vector2i) -> void:
	if not _tour_du_joueur():
		return
	var c := _actif()
	var occupant := _occupant(case)
	if occupant != "" and _mode != "" and _adversaires_adjacents(c).has(occupant):
		_occupe = true
		_rafraichir()
		_attaquer(c.id, occupant)
		_occupe = false
	elif _mode == "deplacer" and _atteignables.has(case):
		var chemin: Array[Vector2i] = _atteignables[case]
		_occupe = true
		_rafraichir()
		await _deplacer(c.id, chemin)
		_occupe = false
	else:
		return
	_mode = _mode_par_defaut(_actif())
	_rafraichir()


func _fin_de_tour_joueur() -> void:
	if _tour_du_joueur():
		_finir_tour()


func _deplacer(id: String, chemin: Array[Vector2i]) -> bool:
	var points: Array[Vector2] = []
	for case in chemin:
		points.append(_sol.map_to_local(case))
	var jeton: Unite = _jetons[id]
	await jeton.parcourir(points)
	var reponse := Pont.appeler("deplacer", {id = id, cases = chemin.size() - 1})
	if not reponse.get("ok", false):
		jeton.position = points[0]
		return false
	_positions[id] = chemin[-1]
	print("[deplacement] ", id, " ", chemin[0], " -> ", chemin[-1], " cases=", chemin.size() - 1)
	_appliquer_vue(reponse.vue)
	return true


func _attaquer(attaquant: String, cible: String) -> bool:
	var reponse := Pont.appeler("attaquer", {attaquant = attaquant, cible = cible})
	if not reponse.get("ok", false):
		return false
	_interface.afficher_jet(reponse.resultat, _combattant(attaquant).libelle, _combattant(cible).libelle)
	_appliquer_vue(reponse.vue)
	return true


func _finir_tour() -> void:
	var reponse := Pont.appeler("finDeTour")
	if not reponse.get("ok", false):
		return
	_mode = ""
	_appliquer_vue(reponse.vue)
	_suite_du_tour()


func _suite_du_tour() -> void:
	var c := _actif()
	if _vue.get("issue") != null or c.is_empty():
		return
	if c.camp == "adversaires":
		await _jouer_ia(c.id)
	else:
		_mode = _mode_par_defaut(c)
		_rafraichir()


# --- IA adverse : cible la plus proche, s'en approche, attaque au contact -----------------------

func _jouer_ia(id: String) -> void:
	_occupe = true
	_rafraichir()
	await get_tree().create_timer(DELAI_IA_S).timeout
	var cible := _heros_le_plus_proche(id)
	if cible != "" and not _adjacent(_positions[id], _positions[cible]) and not _combattant(id).aDeplace:
		var chemin := _chemin(_positions[id], _positions[cible], [_positions[id], _positions[cible]])
		if not chemin.is_empty() and chemin[-1] == _positions[cible]:
			chemin.remove_at(chemin.size() - 1)
		var cases := mini(chemin.size() - 1, int(_combattant(id).mouvement))
		if cases > 0:
			await _deplacer(id, chemin.slice(0, cases + 1))
			await get_tree().create_timer(DELAI_IA_S).timeout
	if cible != "" and _positions.has(cible) and _adjacent(_positions[id], _positions[cible]) and not _combattant(id).aAttaque:
		_attaquer(id, cible)
		await get_tree().create_timer(DELAI_IA_S).timeout
	_occupe = false
	if _vue.get("issue") == null:
		_finir_tour()


func _heros_le_plus_proche(id: String) -> String:
	var depart: Vector2i = _positions[id]
	var meilleur := ""
	var distance_min := 1 << 30
	for c in _vue.combattants:
		if c.camp == "heros" and _positions.has(c.id):
			var d := maxi(absi(_positions[c.id].x - depart.x), absi(_positions[c.id].y - depart.y))
			if d < distance_min:
				distance_min = d
				meilleur = c.id
	return meilleur
