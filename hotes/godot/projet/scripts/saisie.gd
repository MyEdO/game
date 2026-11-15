## Une saisie d'un formulaire (#3328, `Saisie` de `src/hote/elements.ts`) : la valeur que le contrôle qui la porte, son
## parent, dit à l'instant où le formulaire se joue. `lire` rend `[]` (rien de saisi) ou `[valeur]` : la valeur posée
## d'une saisie `fixe`, la valeur choisie d'une liste, la liste des valeurs cochées d'une rangée de cases, le nombre
## d'une boîte à nombre, le texte d'un champ ou d'une zone de texte multiligne (lu en JSON pour une saisie
## `saisieJson`), et l'objet de chaque champ saisi d'une saisie `saisieObjet`. La zone de texte multiligne
## (`composants/saisieMultiligne.tscn`) grandit avec son texte (`scroll_fit_content_height`) : elle ne défile jamais
## elle-même, et la molette va au panneau qui la porte.
class_name Saisie
extends Node

var _element: Dictionary = {}


func poser(element: Dictionary, _zone: Zone) -> void:
	_element = element


func lire() -> Array:
	var cible := get_parent()
	match _element.type:
		"fixe":
			return [_element.valeur]
		"saisieObjet":
			return [Saisie.objet(cible, _element.champs)]
		"saisieChoix":
			var liste := cible as OptionButton
			return [] if liste.selected == -1 else [_element.valeurs[liste.selected].valeur]
		"saisieCoches":
			var cases := cible.get_children().filter(func(n: Node) -> bool: return n is CheckBox)
			return [range(cases.size()).filter(func(i: int) -> bool: return (cases[i] as CheckBox).button_pressed).map(func(i: int) -> Variant: return _element.valeurs[i].valeur)]
		"saisieNombre":
			return [(cible as SpinBox).value]
	var texte: String = (cible as TextEdit).text if _element.type == "saisieMultiligne" else (cible as LineEdit).text
	if texte.is_empty():
		return []
	return [JSON.parse_string(texte)] if _element.type == "saisieJson" else [texte]


## Les saisies sous `racine`, par l'id de leur élément.
static func _par_id(racine: Node) -> Dictionary:
	var saisies := {}
	for n in racine.find_children("*", "", true, false):
		if n is Saisie:
			saisies[n._element.get("id")] = n
	return saisies


## Les arguments d'un verbe saisis sous `racine`, dans l'ordre de `champs` : un champ optionnel laissé vide clôt la
## liste, un champ requis laissé vide part `null`, que le noyau refuse en le nommant.
static func arguments(racine: Node, champs: Array) -> Array:
	var saisies := Saisie._par_id(racine)
	var args := []
	for c in champs:
		var lue: Array = saisies[c.id].lire()
		if lue.is_empty() and c.optionnel:
			break
		args.append(null if lue.is_empty() else lue[0])
	return args


## L'objet saisi sous `racine` : chaque champ de `champs` saisi, par son nom ; un champ optionnel laissé vide en est
## absent, un champ requis laissé vide vaut `null`.
static func objet(racine: Node, champs: Array) -> Dictionary:
	var saisies := Saisie._par_id(racine)
	var valeurs := {}
	for c in champs:
		var lue: Array = saisies[c.id].lire()
		if not lue.is_empty() or not c.optionnel:
			valeurs[c.nom] = null if lue.is_empty() else lue[0]
	return valeurs
