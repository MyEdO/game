## Une zone de l'écran (#3328, `src/hote/elements.ts`) : les éléments d'une source dessinés dans le conteneur qui la
## porte, son parent, chacun par le composant de son type (`res://composants/<type>.tscn`, une scène sans script).
## Les éléments se réconcilient par type et par id : un élément déjà dessiné garde son nœud, un élément parti le quitte,
## l'ordre suit la source ; en `ajout` (un journal), un élément déjà dessiné reste tel quel et le nouveau s'ajoute au
## pied, montré par le défilement qui le contient. Chaque élément se pose sur son composant : chaque `Liaison`, `Geste`
## et `Saisie` le reçoit, et chaque zone imbriquée y lit le champ que sa `source` nomme, son geste relayé par celle-ci.
## `masque` se cache quand aucune des zones qui le nomment n'a rien à montrer. Sous un `TabContainer`, chaque élément
## est un onglet, titré de son nom (`nom`, sinon `libelle`), qui ne le redit pas (son `Nom` caché).
##
## La source d'une zone de l'écran est une clé de `vue.zones` (`CONTRAT.md`). Une zone qui nomme des `ids` n'en montre
## que les éléments de ces ids, dans l'ordre de la source ; une zone sans `ids` montre ceux qu'aucune autre zone de sa
## source ne nomme (`montrer_toutes`) : une disposition range les éléments d'une source sans en perdre aucun.
class_name Zone
extends Node

## L'intention d'un geste pressé sous la zone (`Jeu` de `src/hote/elements.ts`).
signal geste(jeu: Dictionary)

@export var source: String
@export var ajout := false
@export var masque: Control = null
## Sans initialiseur : l'export Web de Godot 4.7 perd la valeur posée d'un `PackedStringArray` initialisé par `[]`.
@export var ids: PackedStringArray

const META := &"element"


func montrer(elements: Array) -> void:
	var conteneur := get_parent()
	var dessines := {}
	for enfant in conteneur.get_children():
		if enfant.has_meta(META):
			dessines[enfant.get_meta(META)] = enfant
	var gardes := {}
	var dernier: Node = null
	for e in elements:
		var cle := "%s/%s" % [e.type, e.id]
		gardes[cle] = true
		var noeud: Node = dessines.get(cle)
		if noeud != null and ajout:
			continue
		if noeud == null:
			noeud = load("res://composants/%s.tscn" % e.type).instantiate()
			noeud.set_meta(META, cle)
			conteneur.add_child(noeud)
		conteneur.move_child(noeud, -1)
		Zone.poser(noeud, e, self)
		if conteneur is TabContainer:
			var onglets := conteneur as TabContainer
			onglets.set_tab_title(onglets.get_tab_idx_from_control(noeud), str(e.nom if e.has("nom") else e.libelle))
			if noeud.has_node("Nom"):
				(noeud.get_node("Nom") as Control).visible = false
		dernier = noeud
	if not ajout:
		for cle in dessines:
			if not gardes.has(cle):
				conteneur.remove_child(dessines[cle])
				dessines[cle].queue_free()
	if ajout and dernier != null:
		_montrer_le_pied(dernier)


## Chaque zone de `zones` montre les éléments de sa source dans `sources` qui lui reviennent (`ids`).
## Un `masque` se montre quand l'une des zones qui le nomment a quelque chose à montrer.
static func montrer_toutes(zones: Array[Zone], sources: Dictionary) -> void:
	var masques := {}
	for zone in zones:
		zone.montrer(Zone.elements_de(zones, zone, sources))
		if zone.masque != null:
			masques[zone.masque] = masques.get(zone.masque, false) or zone.get_parent().get_children().any(func(n: Node) -> bool: return n.has_meta(META))
	for masque in masques:
		masque.visible = masques[masque]


## Les éléments de la source de `zone` dans `sources` qui lui reviennent parmi `zones` : ceux de ses `ids`, ou, sans
## `ids`, ceux qu'aucune zone de sa source ne nomme.
static func elements_de(zones: Array[Zone], zone: Zone, sources: Dictionary) -> Array:
	var elements: Array = sources.get(zone.source, [])
	if not zone.ids.is_empty():
		return elements.filter(func(e: Dictionary) -> bool: return zone.ids.has(e.id))
	var nommes := PackedStringArray()
	for autre in zones:
		if autre.source == zone.source:
			nommes.append_array(autre.ids)
	return elements.filter(func(e: Dictionary) -> bool: return not nommes.has(e.id))


## `element` posé sur le composant `racine` et ses descendants, hors des composants d'une zone imbriquée.
static func poser(racine: Node, element: Dictionary, zone: Zone) -> void:
	for enfant in racine.get_children():
		if enfant.has_meta(META):
			continue
		if enfant is Liaison:
			enfant.poser(element)
		elif enfant is Geste or enfant is Saisie:
			enfant.poser(element, zone)
		elif enfant is Zone:
			if not enfant.geste.is_connected(zone.geste.emit):
				enfant.geste.connect(zone.geste.emit)
			enfant.montrer(element.get(enfant.source, []))
		else:
			Zone.poser(enfant, element, zone)


## Les zones de l'écran sous `ecran` : celles que ses scènes posent, hors des zones imbriquées d'un composant dessiné.
static func racines(ecran: Node) -> Array[Zone]:
	var zones: Array[Zone] = []
	for n in ecran.find_children("*", "", true, false):
		if n is Zone and not Zone._dans_un_composant(n, ecran):
			zones.append(n)
	return zones


## Si `noeud` est sous un composant dessiné, sous `ecran`.
static func _dans_un_composant(noeud: Node, ecran: Node) -> bool:
	var parent := noeud.get_parent()
	while parent != ecran:
		if parent.has_meta(META):
			return true
		parent = parent.get_parent()
	return false


## `noeud` montré par le défilement qui le contient, une image plus tard : le défilement a pris sa taille.
func _montrer_le_pied(noeud: Control) -> void:
	await get_tree().process_frame
	if not is_instance_valid(noeud) or not noeud.is_inside_tree():
		return
	var parent := noeud.get_parent()
	while parent != null and not parent is ScrollContainer:
		parent = parent.get_parent()
	if parent != null:
		(parent as ScrollContainer).ensure_control_visible(noeud)
