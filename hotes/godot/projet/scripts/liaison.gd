## Une liaison (#3328) : un champ de l'élément que sa zone pose (`Zone`, `src/hote/elements.ts`) écrit dans une
## propriété du contrôle qui la porte, son parent. La valeur se convertit d'après le type de la propriété : un texte
## (`null` : vide), un booléen (`null` : faux, toute autre valeur qui n'est pas un booléen : vrai, comme un refus qui
## désactive), un nombre, un nom (le ton en variation du thème). Une liste de valeurs nommées remplit une liste
## déroulante (`OptionButton`) : chaque libellé, chaque refus désactivé et dit à son survol, la valeur pressée
## choisie. `cacher_si_nul` : le contrôle se cache quand le champ vaut `null`. Un champ absent de l'élément est une faute de la scène.
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
## valeur pressée choisie.
static func _remplir(liste: OptionButton, valeurs: Array) -> void:
	liste.clear()
	liste.select(-1)
	for i in valeurs.size():
		liste.add_item(str(valeurs[i].libelle))
		liste.set_item_disabled(i, valeurs[i].refus != null)
		liste.set_item_tooltip(i, "" if valeurs[i].refus == null else str(valeurs[i].refus))
		if valeurs[i].presse:
			liste.select(i)
