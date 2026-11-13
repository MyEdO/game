## Un geste (#3328, `Bouton`, `Choix`, `Curseur`, `Formulaire` de `src/hote/elements.ts`) : le contrôle qui le porte,
## son parent, joue l'intention de l'élément que sa zone pose, par la zone (`Zone.geste`). Un bouton joue son `jeu` ;
## une liste déroulante, le `jeu` de la valeur choisie ; le bouton d'un formulaire, son verbe et les arguments saisis
## sous le composant (`Saisie.arguments`) ; la glissière d'un curseur, son verbe, ses arguments et la valeur que le
## joueur lui donne, un glissement fini (#4081) ou tout autre changement hors glissement (sa boîte à nombre, les
## flèches) ; la molette ne la règle pas, elle défile la liste qui la porte ; refusé, le curseur ne se règle pas. Le geste en `focus` le prend : l'Entrée le joue. Un
## bouton à bascule garde l'état que la vue lui donne (`presse`) : seule une vue suivante le change, jamais le clic ni
## son refus.
class_name Geste
extends Node

## La boîte à nombre d'un curseur, reliée à sa glissière (`Range.share`).
@export var boite: SpinBox
var _element: Dictionary = {}
var _zone: Zone = null
var _glisse := false


func _ready() -> void:
	var cible := get_parent()
	if cible is OptionButton:
		(cible as OptionButton).item_selected.connect(func(i: int) -> void: _jouer(_element.valeurs[i].jeu))
	elif cible is Slider:
		var glissiere := cible as Slider
		boite.share(glissiere)
		glissiere.drag_started.connect(func() -> void: _glisse = true)
		glissiere.drag_ended.connect(_finir_le_glissement)
		glissiere.value_changed.connect(_changer)
	else:
		(cible as BaseButton).pressed.connect(_presser)


func poser(element: Dictionary, zone: Zone) -> void:
	_element = element
	_zone = zone
	if get_parent() is Slider:
		(get_parent() as Slider).editable = element.refus == null
		boite.editable = element.refus == null
		return
	if element.focus:
		_prendre_le_focus.call_deferred()


## Le focus pris en fin d'image, si le geste est encore à l'écran : une vue suivante a pu le retirer.
func _prendre_le_focus() -> void:
	if is_inside_tree():
		(get_parent() as Control).grab_focus()


func _presser() -> void:
	var cible := get_parent() as BaseButton
	if cible.toggle_mode:
		cible.set_pressed_no_signal(_element.presse)
	if _element.type == "formulaire":
		_jouer({type = _element.verbe, args = Saisie.arguments(owner, _element.champs)})
	else:
		_jouer(_element.jeu)


func _changer(_valeur: float) -> void:
	if not _glisse:
		_regler()


func _finir_le_glissement(change: bool) -> void:
	_glisse = false
	if change:
		_regler()


## Le geste du curseur à la valeur de sa glissière.
func _regler() -> void:
	var args: Array = _element.arguments.duplicate()
	args.append((get_parent() as Range).value)
	_jouer({type = _element.verbe, args = args})


func _jouer(jeu: Dictionary) -> void:
	_zone.geste.emit(jeu)
