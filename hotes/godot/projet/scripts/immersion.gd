## L'immersion (`hotes/godot/pont/CONTRAT.md`, section « Vue », `plateau.regard`) : aux yeux du meneur, à hauteur
## d'homme (`plateau.oeilM`), ou sous le plafond de la case de ce sol (`plateau.oeilsSousPlafond`), au-dessus du sol
## touché sous lui (`Monde.sol_sous`), le groupe marche librement au clavier
## (`avant`, `arriere`, `gauche`, `droite`, `courir` tenu pour courir) et regarde à la souris, captive : `ui_cancel` la
## libère, un clic la reprend, et sur le Web le premier clic la prend. Le noyau garde la règle : la case qu'un pas va
## franchir, sondée un peu devant l'œil, se joue au clic du champ (`case_jouee`) ; tant que le groupe ne s'y tient pas,
## l'œil ne la franchit pas. `agir` joue de même la case visée (E ou clic), sous le point de mire au centre de l'écran
## (`mire`). L'œil se pose à la case du groupe, tourné vers son cap (`exploration.cap`), quand l'immersion commence ou
## que le groupe change de case sans pas de l'œil, ou à la case qu'on lui pose (`poser`) ; elle cesse hors
## d'exploration, et se suspend tant que le champ ne se clique pas (`vue.champ`).
class_name Immersion
extends Node

## La case `case`, sa couche comprise, se joue : le pas de l'œil va la franchir, ou elle est visée (`agir`).
signal case_jouee(case: Vector3i)

## Les vitesses de la marche et de la course (m/s), et l'avance de la sonde devant l'œil (m), qui le tient à distance
## des murs.
const VITESSE_M_S := 3.0
const VITESSE_DE_COURSE_M_S := 6.0
const SONDE_M := 0.4

@export var monde: Monde
## Le point de mire, au centre de l'écran, visible tant que l'œil se mène.
@export var mire: CanvasItem

var _active := false
var _suspendue := true
## La souris libérée (`ui_cancel`) : elle ne mène plus le regard jusqu'au clic qui la reprend.
var _liberee := false
## La case du groupe (`exploration.groupe`, `etage`), celle que l'œil demande de franchir, et la dernière refusée, que
## l'œil ne redemande pas tant que le groupe n'a pas changé de case.
var _case := Vector3i.ZERO
var _demandee: Variant = null
var _refusee: Variant = null
## Le sol sous l'œil et sa case, sa couche comprise, son lacet, son tangage ; la hauteur de l'œil (m) debout et sous le
## plafond des cases qui l'abaissent, par la clé `x,y,z` de chacune, et les mètres d'une case du plateau.
var _pied := Vector3.ZERO
var _case_du_pied := Vector3i.ZERO
var _lacet := 0.0
var _tangage := 0.0
var _oeil_m := 0.0
var _oeils_sous_plafond := {}
var _metres_par_case := 1.0


## La vue `vue` : l'immersion active sous le regard `immersion` en exploration, suspendue sans clic du champ.
func montrer(vue: Dictionary) -> void:
	var exploration: Variant = vue.projection.exploration
	var active: bool = vue.plateau != null and vue.plateau.regard == "immersion" and exploration != null
	_suspendue = vue.champ == null
	if not active:
		_active = false
		_capturer(false)
		return
	_oeil_m = vue.plateau.oeilM
	_oeils_sous_plafond = vue.plateau.oeilsSousPlafond
	_metres_par_case = vue.plateau.metresParCase
	var case := Vector3i(int(exploration.groupe[0]), int(exploration.groupe[1]), 0 if exploration.etage == null else int(exploration.etage))
	var demandee: bool = _demandee == case
	_demandee = null
	if case != _case:
		_refusee = null
	if _active and (case == _case or demandee):
		_case = case
		_capturer(false)
		return
	_case = case
	if not _active:
		_lacet = MiseEnPage.LACETS_DES_CAPS.get(exploration.cap, 0.0)
		_tangage = 0.0
		_liberee = false
	_active = true
	_capturer(false)
	_pied = monde.lieu(Vector2i(case.x, case.y), case.z)
	_case_du_pied = case
	_poser_l_oeil()


## L'œil posé sur le sol de la case `case`, sa couche comprise, tourné du lacet `lacet` et du tangage `tangage`, sans pas
## ni case jouée : le groupe reste où il est (`Plateau.cadrer`) ; la souris libérée, comme à `ui_cancel`, le point de
## mire caché, un clic la reprend. Rend s'il s'est posé, l'immersion active.
func poser(case: Vector3i, lacet: float, tangage: float) -> bool:
	if not _active:
		return false
	_pied = monde.lieu(Vector2i(case.x, case.y), case.z)
	_case_du_pied = case
	_lacet = lacet
	_tangage = tangage
	_liberee = true
	_capturer(false)
	_poser_l_oeil()
	return true


## Le point de mire montré tant que l'œil se mène : active, ni suspendue ni libérée ; la souris captive alors, sauf sur
## le Web hors du traitement d'un geste du joueur (`geste`), où le navigateur refuse le verrouillage du pointeur : elle y
## attend le clic qui la prend.
func _capturer(geste: bool) -> void:
	var menee := _active and not _suspendue and not _liberee
	mire.visible = menee
	if not menee:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif geste or not OS.has_feature("web"):
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


## La hauteur de l'œil (m) au-dessus du sol de sa case.
func _hauteur_de_l_oeil() -> float:
	return _oeils_sous_plafond.get("%d,%d,%d" % [_case_du_pied.x, _case_du_pied.y, _case_du_pied.z], _oeil_m)


func _poser_l_oeil() -> void:
	monde.poser_l_oeil(MiseEnPage.oeil_sur(_pied, _hauteur_de_l_oeil(), _metres_par_case), _lacet, _tangage)


func _process(delta: float) -> void:
	if not _active or _suspendue or not monde.clavier_libre():
		return
	var forces := monde.forces_du_clavier()
	if forces.all(func(f: float) -> bool: return f == 0.0):
		return
	var vitesse := VITESSE_DE_COURSE_M_S if Input.is_action_pressed(&"courir") else VITESSE_M_S
	var vise := MiseEnPage.lieu_apres_la_marche(_pied, forces[0], forces[1], forces[2], forces[3], _lacet, MiseEnPage.metres_de_marche(vitesse, delta), _metres_par_case)
	var oeil := _hauteur_de_l_oeil()
	var sonde: Variant = monde.sol_sous(MiseEnPage.oeil_sur(MiseEnPage.lieu_apres_la_marche(vise, forces[0], forces[1], forces[2], forces[3], _lacet, SONDE_M, _metres_par_case), oeil, _metres_par_case))
	if sonde == null:
		return
	if sonde.case != _case:
		if sonde.case == _refusee:
			return
		_demandee = sonde.case
		case_jouee.emit(sonde.case)
		_demandee = null
		if sonde.case != _case:
			_refusee = sonde.case
			return
	var sol: Variant = monde.sol_sous(MiseEnPage.oeil_sur(vise, oeil, _metres_par_case))
	if sol == null:
		return
	_pied = sol.lieu
	_case_du_pied = sol.case
	_poser_l_oeil()


## Le regard tourne à la souris captive ; `ui_cancel` la libère, un clic la prend quand elle ne l'est pas ; `agir` joue
## la case visée.
func _unhandled_input(event: InputEvent) -> void:
	if not _active or _suspendue:
		return
	if event.is_action_pressed("ui_cancel") and not _liberee:
		_liberee = true
		_capturer(true)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		_liberee = false
		_capturer(true)
	elif event.is_action_pressed("agir") and not _liberee:
		var visee: Variant = monde.case_sous(get_viewport().get_visible_rect().get_center())
		if visee != null:
			case_jouee.emit(visee)
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		_lacet = MiseEnPage.lacet_glisse(_lacet, event.relative.x)
		_tangage = MiseEnPage.tangage_glisse(_tangage, event.relative.y, -MiseEnPage.TANGAGE_DE_L_OEIL, MiseEnPage.TANGAGE_DE_L_OEIL)
		_poser_l_oeil()
	else:
		return
	get_viewport().set_input_as_handled()
