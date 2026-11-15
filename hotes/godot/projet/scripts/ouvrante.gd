## Une pastille ouvrante de l'écran (#3935) : sa pastille (`pastille`, dont le bouton `Presser` est un enfant direct
## de la pastille ou du composant que sa zone y pose) ouvre et ferme sa liste (`liste`). La liste se ferme au choix
## d'un geste, le focus suivant ce que le geste ouvre, et sans choix (Échap, clic hors d'elle, pastille pressée de
## nouveau), le focus rendu au contrôle qui le portait avant l'ouverture s'il est encore focalisable, sinon à la
## pastille. Ouverte, le focus passe à son premier geste ; ses gestes se parcourent au clavier. Une seule liste est
## ouverte dans tout l'écran : en ouvrir une ferme l'autre. Son état ouvert est local à l'écran.
class_name Ouvrante
extends Control

## La liste s'est ouverte ou fermée.
signal change

@export var pastille: Control
@export var liste: Control
## Le dernier contrôle hors de l'ouvrante qui a pris le focus : celui qui le portait avant l'ouverture (un clic sur la
## pastille le lui prend).
var _avant: Control = null
## Le clic qui a fermé la liste, tant que ni un contrôle ni le plateau ne l'a pris.
var _fermant: InputEvent = null
## L'ouvrante dont la liste est ouverte dans l'écran, `null` sans elle.
static var _ouverte: Ouvrante = null


func _ready() -> void:
	_relier(pastille)
	pastille.child_entered_tree.connect(_relier)
	get_viewport().gui_focus_changed.connect(_retenir)
	for zone in Zone.racines(liste):
		zone.geste.connect(_cacher.unbind(1))


## Le bouton `Presser` enfant direct de `noeud`, relié à l'ouverture de la liste.
func _relier(noeud: Node) -> void:
	var bouton := noeud.find_child("Presser", false, false) as BaseButton
	if bouton != null and not bouton.pressed.is_connected(_basculer):
		bouton.pressed.connect(_basculer)


func _basculer() -> void:
	if liste.visible:
		_fermer()
	else:
		_ouvrir()


func _retenir(controle: Control) -> void:
	if not is_ancestor_of(controle):
		_avant = controle


## La liste posée à sa place, ouverte ; rien à poser par défaut.
func _placer() -> void:
	pass


func _ouvrir() -> void:
	if is_instance_valid(_ouverte) and _ouverte != self:
		_ouverte._cacher()
	_ouverte = self
	liste.visible = true
	_placer()
	change.emit()
	var gestes := liste.find_children("*", "BaseButton", true, false).filter(func(b: BaseButton) -> bool: return b.is_visible_in_tree() and not b.disabled)
	if not gestes.is_empty():
		(gestes[0] as Control).grab_focus()


## La liste fermée sans choix, le focus rendu (`_avant`, sinon la pastille).
func _fermer() -> void:
	if not liste.visible:
		return
	_cacher()
	if is_instance_valid(_avant) and _avant.is_visible_in_tree() and _avant.focus_mode != FOCUS_NONE:
		_avant.grab_focus()
	else:
		(pastille.find_child("Presser", true, false) as Control).grab_focus()


## La liste cachée, le focus laissé à ce qui le prend.
func _cacher() -> void:
	if not liste.visible:
		return
	liste.visible = false
	if _ouverte == self:
		_ouverte = null
	change.emit()


## Échap ferme la liste ; un clic hors d'elle et de sa pastille la ferme, et, s'il ne tombe sur aucun contrôle, ne
## joue rien au plateau (`_unhandled_input`).
func _input(event: InputEvent) -> void:
	if not liste.visible:
		return
	if event.is_action_pressed(&"ui_cancel"):
		_fermer()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and not _sous(event, liste) and not _sous(event, pastille):
		_fermer()
		_fermant = event


func _unhandled_input(event: InputEvent) -> void:
	if event == _fermant:
		get_viewport().set_input_as_handled()
	_fermant = null


## Si le clic `clic` tombe sur `controle`.
static func _sous(clic: InputEventMouseButton, controle: Control) -> bool:
	return Rect2(Vector2.ZERO, controle.size).has_point((controle.make_input_local(clic) as InputEventMouseButton).position)
