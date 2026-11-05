## Un geste (#3328, `Bouton`, `Choix`, `Formulaire` de `src/hote/elements.ts`) : le contrôle qui le porte, son parent,
## joue l'intention de l'élément que sa zone pose, par la zone (`Zone.geste`). Un bouton joue son `jeu` ; une liste
## déroulante, le `jeu` de la valeur choisie ; le bouton d'un formulaire, son verbe et les arguments saisis sous le
## composant (`Saisie.arguments`). Le geste en `focus` le prend : l'Entrée le joue. Un bouton à bascule garde l'état
## que la vue lui donne (`presse`) : seule une vue suivante le change, jamais le clic ni son refus.
class_name Geste
extends Node

var _element: Dictionary = {}
var _zone: Zone = null


func _ready() -> void:
	var cible := get_parent()
	if cible is OptionButton:
		(cible as OptionButton).item_selected.connect(func(i: int) -> void: _jouer(_element.valeurs[i].jeu))
	else:
		(cible as BaseButton).pressed.connect(_presser)


func poser(element: Dictionary, zone: Zone) -> void:
	_element = element
	_zone = zone
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


func _jouer(jeu: Dictionary) -> void:
	_zone.geste.emit(jeu)
