## L'immersion (`hotes/godot/pont/CONTRAT.md`, section « Vue », `plateau.regard`) : aux yeux du meneur, à hauteur
## d'homme (`plateau.oeilM`) au-dessus du sol touché sous lui (`Monde.sol_sous`), le groupe marche librement au clavier
## (`avant`, `arriere`, `gauche`, `droite`) et regarde à la souris, bouton droit tenu. Le noyau garde la règle : la case
## qu'un pas va franchir, sondée un peu devant l'œil, se joue au clic du champ (`case_franchie`) ; tant que le groupe ne
## s'y tient pas, l'œil ne la franchit pas. L'œil se pose à la case du groupe, tourné vers son cap (`exploration.cap`),
## quand l'immersion commence ou que le groupe change de case sans pas de l'œil ; elle cesse hors d'exploration, et se
## suspend tant que le champ ne se clique pas (`vue.champ`).
class_name Immersion
extends Node

## Le pas de l'œil va franchir la case `case`, sa couche comprise.
signal case_franchie(case: Vector3i)

## La vitesse de la marche (m/s), et l'avance de la sonde devant l'œil (m), qui le tient à distance des murs.
const VITESSE_M_S := 3.0
const SONDE_M := 0.4

@export var monde: Monde

var _active := false
var _suspendue := true
## La case du groupe (`exploration.groupe`, `etage`), celle que l'œil demande de franchir, et la dernière refusée, que
## l'œil ne redemande pas tant que le groupe n'a pas changé de case.
var _case := Vector3i.ZERO
var _demandee: Variant = null
var _refusee: Variant = null
## Le sol sous l'œil, son lacet, son tangage ; la hauteur de l'œil (m) et les mètres d'une case du plateau.
var _pied := Vector3.ZERO
var _lacet := 0.0
var _tangage := 0.0
var _oeil_m := 0.0
var _metres_par_case := 1.0


## La vue `vue` : l'immersion active sous le regard `immersion` en exploration, suspendue sans clic du champ.
func montrer(vue: Dictionary) -> void:
	var exploration: Variant = vue.projection.exploration
	var active: bool = vue.plateau != null and vue.plateau.regard == "immersion" and exploration != null
	_suspendue = vue.champ == null
	if not active:
		_active = false
		return
	_oeil_m = vue.plateau.oeilM
	_metres_par_case = vue.plateau.metresParCase
	var case := Vector3i(int(exploration.groupe[0]), int(exploration.groupe[1]), 0 if exploration.etage == null else int(exploration.etage))
	var demandee: bool = _demandee == case
	_demandee = null
	if case != _case:
		_refusee = null
	if _active and (case == _case or demandee):
		_case = case
		return
	_case = case
	if not _active:
		_lacet = MiseEnPage.LACETS_DES_CAPS.get(exploration.cap, 0.0)
		_tangage = 0.0
	_active = true
	_pied = monde.lieu(Vector2i(case.x, case.y), case.z)
	_poser_l_oeil()


func _poser_l_oeil() -> void:
	monde.poser_l_oeil(MiseEnPage.oeil_sur(_pied, _oeil_m, _metres_par_case), _lacet, _tangage)


func _process(delta: float) -> void:
	if not _active or _suspendue:
		return
	var forces := [Input.get_action_strength(&"gauche"), Input.get_action_strength(&"droite"), Input.get_action_strength(&"avant"), Input.get_action_strength(&"arriere")]
	if forces.all(func(f: float) -> bool: return f == 0.0):
		return
	var vise := MiseEnPage.lieu_apres_la_marche(_pied, forces[0], forces[1], forces[2], forces[3], _lacet, MiseEnPage.metres_de_marche(VITESSE_M_S, delta), _metres_par_case)
	var sonde: Variant = monde.sol_sous(MiseEnPage.oeil_sur(MiseEnPage.lieu_apres_la_marche(vise, forces[0], forces[1], forces[2], forces[3], _lacet, SONDE_M, _metres_par_case), _oeil_m, _metres_par_case))
	if sonde == null:
		return
	if sonde.case != _case:
		if sonde.case == _refusee:
			return
		_demandee = sonde.case
		case_franchie.emit(sonde.case)
		_demandee = null
		if sonde.case != _case:
			_refusee = sonde.case
			return
	var sol: Variant = monde.sol_sous(MiseEnPage.oeil_sur(vise, _oeil_m, _metres_par_case))
	if sol == null:
		return
	_pied = sol.lieu
	_poser_l_oeil()


## Le regard tourne à la souris, bouton droit tenu, la souris captive le temps du glissé.
func _unhandled_input(event: InputEvent) -> void:
	if not _active:
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if event.pressed else Input.MOUSE_MODE_VISIBLE
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		_lacet = MiseEnPage.lacet_glisse(_lacet, event.relative.x)
		_tangage = MiseEnPage.tangage_glisse(_tangage, event.relative.y, -MiseEnPage.TANGAGE_DE_L_OEIL, MiseEnPage.TANGAGE_DE_L_OEIL)
		_poser_l_oeil()
	else:
		return
	get_viewport().set_input_as_handled()
