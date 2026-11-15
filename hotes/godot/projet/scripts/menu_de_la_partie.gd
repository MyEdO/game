## Le menu de la partie (#3935) : la pastille du menu (`partie.menu`, en `pastille`) et, ouverte, la liste des gestes du
## groupe puis de la partie (`groupe.gestes`, `partie.gestes`) dans un cartouche ancré au-dessus d'elle. La pastille
## l'ouvre et le ferme ; il se ferme au choix d'un geste, le focus suivant ce que le geste ouvre, et sans choix (Échap,
## clic hors de lui, pastille pressée de nouveau), le focus rendu au contrôle qui le portait avant l'ouverture s'il est
## encore focalisable, sinon à la pastille. Ouvert, le focus passe à son premier geste ; ses gestes se parcourent au
## clavier. Son état ouvert est local à l'écran.
class_name MenuDeLaPartie
extends Control

## Le menu s'est ouvert ou fermé.
signal change

@onready var _liste: Control = $Liste
@onready var _pastille: Control = $Pastille
## Le dernier contrôle hors du menu qui a pris le focus : celui qui le portait avant l'ouverture (un clic sur la
## pastille le lui prend).
var _avant: Control = null


func _ready() -> void:
	_pastille.child_entered_tree.connect(_relier_la_pastille)
	get_viewport().gui_focus_changed.connect(_retenir)
	for zone in Zone.racines(_liste):
		zone.geste.connect(_cacher.unbind(1))


## Le bouton de la pastille que sa zone pose, relié à l'ouverture du menu.
func _relier_la_pastille(composant: Node) -> void:
	var bouton := composant.find_child("Presser", false, false) as BaseButton
	if bouton != null and not bouton.pressed.is_connected(_basculer):
		bouton.pressed.connect(_basculer)


## Le menu ancré au coin haut-droit de la fenêtre, sa liste ouverte sous la pastille (`en_haut`), ou au coin bas-droit,
## sa liste ouverte au-dessus d'elle.
func ancrer(en_haut: bool) -> void:
	var bord := 0.0 if en_haut else 1.0
	var oppose := 1.0 if en_haut else 0.0
	anchor_top = bord
	anchor_bottom = bord
	offset_top = 8.0 if en_haut else -42.0
	offset_bottom = 42.0 if en_haut else -8.0
	grow_vertical = Control.GROW_DIRECTION_END if en_haut else Control.GROW_DIRECTION_BEGIN
	_liste.anchor_top = oppose
	_liste.anchor_bottom = oppose
	_liste.offset_top = 8.0 if en_haut else -8.0
	_liste.offset_bottom = _liste.offset_top
	_liste.grow_vertical = grow_vertical


func _basculer() -> void:
	if _liste.visible:
		_fermer()
	else:
		_ouvrir()


func _retenir(controle: Control) -> void:
	if not is_ancestor_of(controle):
		_avant = controle


func _ouvrir() -> void:
	_liste.visible = true
	change.emit()
	var gestes := _liste.find_children("*", "BaseButton", true, false).filter(func(b: BaseButton) -> bool: return b.is_visible_in_tree() and not b.disabled)
	if not gestes.is_empty():
		(gestes[0] as Control).grab_focus()


## Le menu fermé sans choix, le focus rendu (`_avant`, sinon la pastille).
func _fermer() -> void:
	if not _liste.visible:
		return
	_cacher()
	if is_instance_valid(_avant) and _avant.is_visible_in_tree() and _avant.focus_mode != FOCUS_NONE:
		_avant.grab_focus()
	else:
		(_pastille.find_child("Presser", true, false) as Control).grab_focus()


## Le menu caché, le focus laissé à ce qui le prend.
func _cacher() -> void:
	if not _liste.visible:
		return
	_liste.visible = false
	change.emit()


func _input(event: InputEvent) -> void:
	if not _liste.visible:
		return
	if event.is_action_pressed(&"ui_cancel"):
		_fermer()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and not _sous(event, _liste) and not _sous(event, _pastille):
		_fermer()


## Si le clic `clic` tombe sur `controle`.
static func _sous(clic: InputEventMouseButton, controle: Control) -> bool:
	return Rect2(Vector2.ZERO, controle.size).has_point((controle.make_input_local(clic) as InputEventMouseButton).position)
