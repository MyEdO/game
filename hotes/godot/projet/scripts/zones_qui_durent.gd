## Les zones qui durent sur le plateau (`vue.zonesQuiDurent`, `CONTRAT.md`, section « Vue », #3834) : sur chaque case
## de chacune, les gerbes continues de son visuel (`Effets.GERBES`, `Effets.gerbe_continue`) à sa teinte, et son son en
## boucle à sa case centrale. Une zone se nomme par sa `cle` d'une vue à l'autre : une zone déjà posée reste telle
## quelle, une zone qui ne dure plus est retirée.
class_name ZonesQuiDurent
extends Node3D

## @contrat Effets
## Le plateau pose `vue.zonesQuiDurent` par son nœud `ZonesQuiDurent` (`projet/scripts/zones_qui_durent.gd`) : sur
## chaque case d'une zone, les gerbes continues de son visuel à sa teinte, et son son en boucle à sa case centrale.
## Une zone se nomme par sa `cle` : déjà posée, elle reste telle quelle ; absente de la vue, elle est retirée.
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
			_posees[cle] = _zone(voulues[cle], lieu, metres_par_case)


## La zone `zone` posée sous ce nœud.
func _zone(zone: Dictionary, lieu: Callable, metres_par_case: float) -> Node3D:
	var noeud := Node3D.new()
	noeud.name = "zone"
	noeud.set_meta("cle", zone.cle)
	add_child(noeud, true)
	if zone.visuel != null:
		for case: Dictionary in zone.cases:
			var nappe := Node3D.new()
			nappe.name = zone.visuel
			nappe.position = lieu.call(case)
			nappe.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
			noeud.add_child(nappe, true)
			for gerbe: Dictionary in Effets.GERBES[zone.visuel].gerbes:
				nappe.add_child(Effets.gerbe_continue(gerbe, gerbe.taille, Color(zone.couleur)))
	if zone.boucle != null:
		var lecteur := Effets.son_en_boucle(zone.boucle)
		lecteur.position = lieu.call(zone.centre)
		noeud.add_child(lecteur)
	return noeud


## Le nœud de la zone de clé `cle`, `null` si elle n'est pas posée.
func zone(cle: String) -> Node3D:
	return _posees.get(cle)
