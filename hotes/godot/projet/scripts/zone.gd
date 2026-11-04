## Une zone de l'écran (#3328, `src/hote/elements.ts`) : les éléments d'une source dessinés dans le conteneur qui la
## porte, son parent, chacun par le composant de son type (`res://composants/<type>.tscn`, une scène sans script).
## Les éléments se réconcilient par type et par id : un élément déjà dessiné garde son nœud, un élément parti le quitte,
## l'ordre suit la source ; en `ajout` (un journal), un élément déjà dessiné reste tel quel et le nouveau s'ajoute au
## pied, montré par le défilement qui le contient. Chaque élément se pose sur son composant : chaque `Liaison`, `Geste`
## et `Saisie` le reçoit, et chaque zone imbriquée y lit le champ que sa `source` nomme, son geste relayé par celle-ci.
## `masque` se cache quand la zone n'a rien à montrer.
##
## La source d'une zone de l'écran est une clé de `vue.zones` (`CONTRAT.md`), que le routeur lui donne (`racines`).
class_name Zone
extends Node

## L'intention d'un geste pressé sous la zone (`Jeu` de `src/hote/elements.ts`).
signal geste(jeu: Dictionary)

@export var source: String
@export var ajout := false
@export var masque: Control = null

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
		dernier = noeud
	if not ajout:
		for cle in dessines:
			if not gardes.has(cle):
				conteneur.remove_child(dessines[cle])
				dessines[cle].queue_free()
	if masque != null:
		masque.visible = not elements.is_empty() or (ajout and not dessines.is_empty())
	if ajout and dernier != null:
		_montrer_le_pied(dernier)


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


## Les zones de l'écran sous `ecran` : celles que la scène pose, avant qu'aucun composant n'y soit dessiné.
static func racines(ecran: Node) -> Array[Zone]:
	var zones: Array[Zone] = []
	for n in ecran.find_children("*", "", true, false):
		if n is Zone:
			zones.append(n)
	return zones


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
