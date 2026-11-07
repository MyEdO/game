## La marche de l'atelier 3D (#3086) : les actions `avant`, `arriere`, `gauche` et `droite` (`project.godot`, `[input]`)
## déplacent la racine du modèle sur le sol, tournée vers sa direction de marche, à la vitesse au sol de la base
## (`vitesseAuSol` de la réponse de `modeles`, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») à l'échelle de son
## gabarit posé ; le clip du rôle `walk` (`clips.walk`) se joue par le lecteur de l'atelier pendant le déplacement ; à
## l'arrêt, le clip reste engagé en pause à son début et le squelette revient à sa pose de repos. La caméra orbite
## autour de la racine au glissé du bouton droit de la souris, s'en rapproche ou s'en éloigne à la molette hors de
## l'interface, et la suit ; l'atelier la cadre sur le corps posé.
class_name MarcheDeLAtelier
extends Node

## La marche commence : l'atelier joue le clip `clip` à son lecteur.
signal marche_commencee(clip: String)
## La marche s'arrête : le clip en pause à son début, le squelette au repos.
signal marche_arretee

const ACTIONS: Array[StringName] = [&"avant", &"arriere", &"gauche", &"droite"]
const ECHELLE_MINIMALE := 0.3
const ECHELLE_MAXIMALE := 3.0
## L'échelle de l'orbite qui cadre le corps neutre de la base, celle de la caméra de la scène.
const CADRE_NEUTRE := 1.0
## L'échelle de la vitesse au sol sans gabarit posé.
const VITESSE_NEUTRE := 1.0

## Le pivot de l'orbite, posé sur la racine : son lacet.
@export var orbite: Node3D
## L'enfant de l'orbite qui porte la caméra : son tangage.
@export var tangage: Node3D
@export var camera: Camera3D

var _racine: Node3D = null
var _lecteur: AnimationPlayer = null
var _squelette: Skeleton3D = null
var _clip := ""
var _vitesse := 0.0
## L'échelle de la vitesse au sol du gabarit posé (`echelleDeVitesse`, `CONTRAT.md`, « Gabarit d'une base »).
var _echelle_de_vitesse := VITESSE_NEUTRE
var _en_marche := false
var _echelle := CADRE_NEUTRE
## Les actions de la marche dont l'appui a atteint `_input`, tant qu'elles restent tenues.
var _prises: Dictionary = {}
var _position_de_la_camera := Vector3.ZERO


func _ready() -> void:
	_position_de_la_camera = camera.position


## La racine `racine` du modèle posé (aucun si `null`), son lecteur de clips `lecteur`, le clip `clip` du rôle `walk`
## de sa base et sa vitesse au sol `vitesse` en m/s.
func suivre(racine: Node3D, lecteur: AnimationPlayer, clip: String, vitesse: float) -> void:
	_racine = racine
	_lecteur = lecteur
	_squelette = MontageDeComposition.squelette_de(racine) if racine != null else null
	_clip = clip
	_vitesse = vitesse
	_en_marche = false


## L'échelle `echelle` de la vitesse au sol du gabarit posé, `VITESSE_NEUTRE` sans gabarit.
func poser_l_echelle_de_vitesse(echelle: float) -> void:
	_echelle_de_vitesse = echelle


## Une touche de la marche que l'interface n'a pas prise est à elle seule : les flèches ne déplacent pas le focus du
## panneau. Une liste ouverte (le `PopupMenu` d'un `OptionButton`, fenêtre incrustée qui a le focus) reçoit la touche
## avant tout `_input` de la scène, qui ne la voit pas (« Using InputEvent », « How does it work? », Godot 4.7).
func _input(event: InputEvent) -> void:
	if not event is InputEventKey:
		return
	for action in ACTIONS:
		if event.is_action(action, true):
			get_viewport().set_input_as_handled()
			if event.is_pressed():
				_prises[action] = true


## La force de l'action `action` si son appui a atteint `_input`, 0 sinon ; relâchée, elle n'est plus prise.
func _force(action: StringName) -> float:
	if not Input.is_action_pressed(action):
		_prises.erase(action)
	return Input.get_action_strength(action) if _prises.has(action) else 0.0


func _process(delta: float) -> void:
	if _racine == null:
		return
	var entree := MiseEnPage.entree_de_marche(_force(&"gauche"), _force(&"droite"), _force(&"avant"), _force(&"arriere"))
	if entree.is_zero_approx() or _lecteur == null or not _lecteur.has_animation(_clip):
		if _en_marche:
			_arreter()
	else:
		if not _en_marche:
			_en_marche = true
			marche_commencee.emit(_clip)
		var direction := Vector3(entree.x, 0.0, entree.y).normalized().rotated(Vector3.UP, orbite.rotation.y)
		_racine.quaternion = Quaternion(Basis.looking_at(direction, Vector3.UP, true))
		_racine.global_translate(MiseEnPage.pas_de_marche(direction, _vitesse, _echelle_de_vitesse, _lecteur.speed_scale, delta))
	orbite.global_position = _racine.global_position


func _arreter() -> void:
	_en_marche = false
	_lecteur.pause()
	_lecteur.seek(0.0, true)
	if _squelette != null:
		_squelette.reset_bone_poses()
	marche_arretee.emit()


## Un cran de molette sur un contrôle de l'interface n'atteint jamais la caméra : un défilement en bout de course le
## laisse passer (`Viewport.gui_get_hovered_control`).
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		orbite.rotation.y = MiseEnPage.lacet_glisse(orbite.rotation.y, event.relative.x)
		tangage.rotation.x = MiseEnPage.tangage_glisse(tangage.rotation.x, event.relative.y, MiseEnPage.TANGAGE_MINIMAL, MiseEnPage.TANGAGE_MAXIMAL)
	elif event is not InputEventMouseButton or not event.pressed or get_viewport().gui_get_hovered_control() != null:
		return
	elif event.button_index == MOUSE_BUTTON_WHEEL_UP:
		_zoomer(-1.0)
	elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		_zoomer(1.0)


## La caméra d'un pas de zoom plus loin de la racine (`sens` 1) ou plus près (-1).
func _zoomer(sens: float) -> void:
	cadrer(MiseEnPage.distance_zoomee(_echelle, sens, ECHELLE_MINIMALE, ECHELLE_MAXIMALE))


## L'échelle de l'orbite.
func echelle() -> float:
	return _echelle


## L'orbite à l'échelle `echelle` (`CADRE_NEUTRE` : la caméra de la scène, qui cadre le corps neutre), le zoom repris de là.
func cadrer(echelle: float) -> void:
	_echelle = echelle
	camera.position = MiseEnPage.position_a_l_echelle(_position_de_la_camera, _echelle)
