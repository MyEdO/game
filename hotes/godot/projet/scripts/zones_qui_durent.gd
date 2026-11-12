## Les zones qui durent sur le plateau (`vue.zonesQuiDurent`, `CONTRAT.md`, section « Vue », #3834) : sur chaque case
## de chacune, la scène de son visuel posée en continu (`Effets.pose_continue`) à sa teinte, et son son en boucle à sa
## case centrale. Une zone se nomme par sa `cle` d'une vue à l'autre : une zone déjà posée se réconcilie case à case
## (#3950), une zone qui ne dure plus est retirée.
class_name ZonesQuiDurent
extends Node3D

## @contrat Effets
## Le plateau pose `vue.zonesQuiDurent` par son nœud `ZonesQuiDurent` (`projet/scripts/zones_qui_durent.gd`) : sur
## chaque case d'une zone, la scène de son visuel (`res://effets/visuels/`) posée en continu à sa teinte, et son son en
## boucle à sa case centrale.
## Une zone se nomme par sa `cle` : absente de la vue, elle est retirée.
## Déjà posée, elle se réconcilie par case : une case neuve se pose, une case sortie part, les autres restent telles
## quelles, sans visuel relancé ; son son suit `centre`.
## La recette `projet/recettes/zones-et-marques.gd` le vérifie.

## Par clé, le nœud de chaque zone posée.
var _posees: Dictionary = {}


## Pose les zones `zones` (`ZoneQuiDure[]`), chaque case à son lieu (`lieu`, de `{ x, y, z? }` vers le point au sol),
## sur un plateau de `metres_par_case` mètres par case, à la place de celles qui ne durent plus.
func poser(zones: Array, lieu: Callable, metres_par_case: float) -> void:
	var voulues := {}
	for zone: Dictionary in zones:
		voulues[zone.cle] = zone
	for cle: String in _posees.keys():
		if not voulues.has(cle):
			_posees[cle].queue_free()
			_posees.erase(cle)
	for cle: String in voulues:
		if not _posees.has(cle):
			_posees[cle] = _zone(voulues[cle])
		_accorder(_posees[cle], voulues[cle], lieu, metres_par_case)


## Le nœud vide de la zone `zone` sous ce nœud, et son son en boucle.
func _zone(zone: Dictionary) -> Node3D:
	var noeud := Node3D.new()
	noeud.name = "zone"
	noeud.set_meta("cle", zone.cle)
	add_child(noeud, true)
	if zone.boucle != null:
		noeud.add_child(Effets.son_en_boucle(zone.boucle))
	return noeud


## Accorde le nœud `noeud` aux cases de la zone `zone` : la nappe d'une case sortie part, celle d'une case neuve se pose,
## les autres restent ; son son à sa case centrale.
func _accorder(noeud: Node3D, zone: Dictionary, lieu: Callable, metres_par_case: float) -> void:
	var neuves := {}
	for case: Dictionary in zone.cases:
		neuves[_cle_de_case(case)] = case
	for enfant: Node in noeud.get_children():
		if enfant is AudioStreamPlayer3D:
			(enfant as AudioStreamPlayer3D).position = lieu.call(zone.centre)
		elif neuves.has(enfant.get_meta("case")):
			neuves.erase(enfant.get_meta("case"))
		else:
			noeud.remove_child(enfant)
			enfant.queue_free()
	if zone.visuel == null:
		return
	for cle: String in neuves:
		var nappe := Effets.pose_continue(Effets.FAMILLE_DES_VISUELS, zone.visuel, Color(zone.couleur))
		nappe.name = zone.visuel
		nappe.set_meta("case", cle)
		nappe.position = lieu.call(neuves[cle])
		nappe.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
		noeud.add_child(nappe, true)


## La clé `x,y,z` de la case `case`.
func _cle_de_case(case: Dictionary) -> String:
	return "%d,%d,%d" % [case.x, case.y, case.get("z", 0)]


## Le nœud de la zone de clé `cle`, `null` si elle n'est pas posée.
func zone(cle: String) -> Node3D:
	return _posees.get(cle)
