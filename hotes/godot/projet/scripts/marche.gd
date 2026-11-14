## La marche de l'atelier 3D (#3086) : les actions `avant`, `arriere`, `gauche` et `droite` (`project.godot`, `[input]`)
## déplacent la racine du modèle sur le sol, tournée vers sa direction de marche, à la vitesse au sol de la base
## (`vitesseAuSol` de la réponse de `modeles`, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») à l'échelle de son
## gabarit posé ; le clip du rôle `marche` (`MontageDeComposition.clip`, à deux mains quand la main libre tient la seconde
## prise) se joue par le lecteur de l'atelier pendant le déplacement ; à l'arrêt, le clip s'arrête à son début, le
## squelette revient à sa pose de repos et l'atelier joue son clip de repos (`marche_arretee`). La caméra orbite
## autour de la racine au glissé du bouton droit de la souris, s'en rapproche ou s'en éloigne à la molette hors de
## l'interface, et la suit ; l'atelier la cadre sur le corps posé, ou sur la boîte d'un véhicule (`cadrer_la_boite`), et le
## zoom se borne autour de ce cadre.
class_name MarcheDeLAtelier
extends Node

## @contrat Atelier 3D
## La marche (`projet/scripts/marche.gd`, `MarcheDeLAtelier`) : les actions `avant`, `arriere`, `gauche` et `droite`
## (`project.godot`, `[input]`) portent chacune une touche par `physical_keycode`, W, S, A et D du clavier QWERTY
## américain (Z, S, Q et D d'un AZERTY), et une flèche. Tant qu'une est tenue et que son appui a atteint `_input` de
## la marche, la racine du modèle avance sur le sol dans la direction de ces actions (`MiseEnPage.entree_de_marche`),
## tournée par le lacet de la caméra, le modèle face à cette direction (son avant en +Z), à `vitesseAuSol` m/s de la
## base multipliée par `echelleDeVitesse` du gabarit posé (1 sans gabarit, section « Gabarit d'une base ») et par
## `speed_scale` du lecteur, et l'atelier joue le clip `marche` de la composition montée (`MontageDeComposition.clip`, à
## deux mains sous une seconde prise) à son lecteur comme au clic de son bouton ; relâchée, le clip s'arrête à son
## début, le squelette revient à sa pose de repos (`Skeleton3D.reset_bone_poses`), et l'atelier joue son clip de repos
## (section « Atelier 3D », seconde prise). Ces touches ne déplacent pas le focus du panneau ; une touche que
## l'interface prend avant la scène ne fait pas marcher : la liste ouverte d'un `OptionButton`, fenêtre incrustée qui
## a le focus, la reçoit avant tout `_input` (« Using InputEvent », « How does it work? », Godot 4.7). La caméra
## orbite autour de la racine, qu'elle suit : glisser au bouton droit tourne son lacet et son tangage (borné), la
## molette l'approche ou l'éloigne. La caméra de la scène cadre le corps neutre ; chaque gabarit posé, une fois mesuré
## au repos (`GabaritDuSquelette.mesures`), met l'orbite à l'échelle du sommet de ses os rapporté à celui du corps
## neutre (`MiseEnPage.echelle_de_cadrage`), le zoom repris de là ; sans gabarit, elle revient à la caméra de la
## scène. Un cran de molette sur un contrôle de l'interface (`Viewport.gui_get_hovered_control`) ne zoome jamais, même
## quand le défilement du panneau, en bout de course, le laisse passer.

## La marche commence : l'atelier joue le clip `clip` à son lecteur.
signal marche_commencee(clip: String)
## La marche s'arrête : le clip en pause à son début, le squelette au repos.
signal marche_arretee

const ACTIONS: Array[StringName] = [&"avant", &"arriere", &"gauche", &"droite"]
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
var _clip := func() -> String: return ""
var _vitesse := 0.0
## L'échelle de la vitesse au sol du gabarit posé (`echelleDeVitesse`, `CONTRAT.md`, « Gabarit d'une base »).
var _echelle_de_vitesse := VITESSE_NEUTRE
var _en_marche := false
var _echelle := CADRE_NEUTRE
## L'échelle du dernier cadre posé (`cadrer`), autour de laquelle le zoom se borne.
var _cadre := CADRE_NEUTRE
## Les actions de la marche dont l'appui a atteint `_input`, tant qu'elles restent tenues.
var _prises: Dictionary = {}
var _position_de_la_camera := Vector3.ZERO
## La hauteur que la caméra de la scène voit au pivot (`MiseEnPage.hauteur_vue_au_pivot`).
var _hauteur_vue := 0.0


func _ready() -> void:
	_position_de_la_camera = camera.position
	_hauteur_vue = MiseEnPage.hauteur_vue_au_pivot(camera.position, camera.fov)


## La racine `racine` du modèle posé (aucun si `null`), son lecteur de clips `lecteur`, `clip` qui rend le clip du rôle
## `marche` de sa base au moment de marcher, et sa vitesse au sol `vitesse` en m/s.
func suivre(racine: Node3D, lecteur: AnimationPlayer, clip: Callable, vitesse: float) -> void:
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
	if entree.is_zero_approx() or _lecteur == null or not _lecteur.has_animation(_clip.call()):
		if _en_marche:
			_arreter()
	else:
		if not _en_marche:
			_en_marche = true
			marche_commencee.emit(_clip.call())
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
	_echelle = MiseEnPage.echelle_zoomee(_echelle, sens, _cadre)
	camera.position = MiseEnPage.position_a_l_echelle(_position_de_la_camera, _echelle)


## L'échelle de l'orbite.
func echelle() -> float:
	return _echelle


## L'orbite à l'échelle `echelle` (`CADRE_NEUTRE` : la caméra de la scène, qui cadre le corps neutre), le zoom repris de là.
func cadrer(echelle: float) -> void:
	_cadre = echelle
	_echelle = echelle
	camera.position = MiseEnPage.position_a_l_echelle(_position_de_la_camera, _echelle)


## L'orbite à l'échelle où la diagonale de `boite` tient dans la hauteur que la caméra de la scène voit au pivot
## (`MiseEnPage.echelle_de_la_boite`).
func cadrer_la_boite(boite: AABB) -> void:
	cadrer(MiseEnPage.echelle_de_la_boite(boite.size, _hauteur_vue))
