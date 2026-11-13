## Une liaison (#3328) : un champ de l'élément que sa zone pose (`Zone`, `src/hote/elements.ts`) écrit dans une
## propriété du contrôle qui la porte, son parent. La valeur se convertit d'après le type de la propriété : un texte
## (`null` : vide), un booléen (`null` : faux, toute autre valeur qui n'est pas un booléen : vrai, comme un refus qui
## désactive), un nombre, un nom (le ton en variation du thème). Une liste de valeurs nommées remplit une liste
## déroulante (`OptionButton`) : chaque libellé, chaque refus désactivé et dit à son survol, la valeur pressée
## choisie ; ou une rangée de cases (`FlowContainer`), une case par valeur, cochée quand elle est pressée. `cacher_si_nul` : le contrôle se cache quand le champ vaut `null`. Un champ absent de l'élément est une faute de la scène.
## Une pose ne joue rien : celle d'un `Range` (bornes, pas, valeur) n'émet aucun signal, même quand la valeur s'y cale.
class_name Liaison
extends Node

@export var champ: String
@export var propriete: StringName = &"text"
@export var cacher_si_nul := false


func poser(element: Dictionary) -> void:
	var cible := get_parent()
	if not element.has(champ):
		push_error("%s : aucun champ « %s » dans l'élément %s %s" % [cible.get_path(), champ, element.get("type"), element.get("id")])
		return
	var valeur: Variant = element[champ]
	if cacher_si_nul:
		cible.visible = valeur != null
	if cible is OptionButton and valeur is Array:
		_remplir(cible, valeur)
		return
	if cible is FlowContainer and valeur is Array:
		_cocher(cible, valeur)
		return
	if cible is Range:
		cible.set_block_signals(true)
		_ecrire(cible, valeur)
		cible.set_block_signals(false)
	else:
		_ecrire(cible, valeur)


## `valeur` écrite dans la propriété de `cible`, convertie d'après son type.
func _ecrire(cible: Node, valeur: Variant) -> void:
	match typeof(cible.get(propriete)):
		TYPE_STRING:
			cible.set(propriete, "" if valeur == null else str(valeur))
		TYPE_STRING_NAME:
			cible.set(propriete, StringName("" if valeur == null else str(valeur)))
		TYPE_BOOL:
			cible.set(propriete, valeur if valeur is bool else valeur != null)
		TYPE_FLOAT:
			cible.set(propriete, 0.0 if valeur == null else float(valeur))
		TYPE_INT:
			cible.set(propriete, 0 if valeur == null else int(valeur))
		_:
			cible.set(propriete, valeur)


## `liste` remplie des `valeurs` : chacune son libellé, désactivée si elle porte un refus et le disant à son survol, la
## valeur pressée choisie, aucune sans valeur pressée (la première ajoutée se choisirait d'elle-même, et la choisir ne
## jouerait rien).
static func _remplir(liste: OptionButton, valeurs: Array) -> void:
	liste.clear()
	var choisie := -1
	for i in valeurs.size():
		liste.add_item(str(valeurs[i].libelle))
		liste.set_item_disabled(i, valeurs[i].refus != null)
		liste.set_item_tooltip(i, "" if valeurs[i].refus == null else str(valeurs[i].refus))
		if valeurs[i].presse:
			choisie = i
	liste.select(choisie)


## `rangee` refaite d'une case par valeur de `valeurs` : son libellé, cochée si elle est pressée, désactivée si elle
## porte un refus et le disant à son survol.
static func _cocher(rangee: FlowContainer, valeurs: Array) -> void:
	for n in rangee.get_children():
		if n is CheckBox:
			rangee.remove_child(n)
			n.queue_free()
	for v in valeurs:
		var case := CheckBox.new()
		case.text = str(v.libelle)
		case.button_pressed = v.presse
		case.disabled = v.refus != null
		case.tooltip_text = "" if v.refus == null else str(v.refus)
		rangee.add_child(case)
