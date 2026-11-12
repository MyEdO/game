## LA RECETTE DE L'ÉCRAN (#3328) : chaque vue que la sonde fige (`hotes/godot/recettes/ecran.ts`, écrite sous
## `VUES` dans la copie qu'elle importe) montrée par la scène `Ecran` comme le routeur `combat.gd` la montre, dans la
## disposition qu'elle nomme. Chaque zone de la scène lit une source de la vue et chaque source a sa zone, hors des
## zones d'un panneau que la disposition cache (le journal sous une scène qui le tient, `Disposition.journal`) ; chaque
## élément a son composant, dans l'ordre de la zone qui le range, et aucun ne reste sans zone ; chaque texte qu'il dit
## (`DITS`) se lit à l'écran, ou au survol de son contrôle ; chaque geste pressé joue l'intention que l'élément porte,
## un formulaire celle que la vue attend ; le geste en focus le prend. Remontrée, une vue garde ses nœuds ; vidée, une
## zone les quitte et la fenêtre se cache, le journal garde ses lignes. Chaque disposition dédiée (`res://ecrans/`) est
## montrée par une vue.
extends SceneTree

const RECETTE_AUTONOME := true
## Le contrôle de chaque composant de geste qui prend le focus.
const FOCUS := {bouton = "Presser", liste = "Valeurs", formulaire = "Jouer"}
const VUES := "res://recettes/vues/ecran.json"
## Les champs d'un élément que l'écran dit en texte.
const DITS := ["texte", "libelle", "qui", "cible", "resultat", "dr", "verdict", "refus", "detail"]
const ECRANS := "res://ecrans"
const SCENE := "Interface/Ossature/Colonne/Milieu/Scene"

var _fautes: Array[String] = []
var _joues: Array = []
var _presses: Array[String] = []
var _posees := {}
## Le panneau du journal de l'écran (`Disposition.journal`), que la disposition posée cache quand elle le tient.
var _journal: Control


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var vues: Variant = JSON.parse_string(FileAccess.get_file_as_string(VUES))
	if not vues is Array or vues.is_empty():
		push_error("%s : aucune vue figée" % VUES)
		quit(2)
		return
	var ecran: Node = load("res://scenes/Ecran.tscn").instantiate()
	root.add_child(ecran)
	for vue in vues:
		await _recetter_la_vue(_disposer(ecran, vue.disposition), vue)
	var zones := _disposer(ecran, null)
	Zone.montrer_toutes(zones, {})
	_verifier(not (ecran.get_node(SCENE).find_child("Cadre", true, false) as Control).visible, "sans fenêtre, le cadre de la fenêtre se cache")
	for scene in _dedicaces(ECRANS):
		_verifier(_posees.has(scene), "%s : aucune vue ne la montre" % scene)
	for zone in zones:
		var restants := _dessines(zone).size()
		_verifier(zone.ajout or restants == 0, "%s vidée : %d éléments restent" % [zone.source, restants])
	_verifier(not _dessines(_zone_de(zones, "journal.lignes")).is_empty(), "le journal garde ses lignes")
	for faute in _fautes:
		push_error("[ecran] ", faute)
	print("[ecran] %d vues montrées, %d gestes joués, %d fautes" % [vues.size(), _presses.size(), _fautes.size()])
	quit(1 if not _fautes.is_empty() else 0)


## Les zones de l'écran, la disposition de `disposition` posée (`Disposition.disposer`) : chacune rend son geste joué.
func _disposer(ecran: Node, disposition: Variant) -> Array[Zone]:
	var posee := ecran.get_node(SCENE + "/Disposition") as Disposition
	posee.disposer(disposition)
	_posees[posee.scene] = true
	_journal = posee.journal
	var zones := Zone.racines(ecran)
	for zone in zones:
		if zone.geste.get_connections().is_empty():
			zone.geste.connect(func(jeu: Dictionary) -> void: _joues.append(jeu))
	return zones


## Les scènes de disposition dédiées sous `dossier`, hors de la générique.
func _dedicaces(dossier: String) -> Array:
	var scenes := []
	for fichier in DirAccess.get_files_at(dossier):
		var chemin := "%s/%s" % [dossier, fichier.trim_suffix(".remap")]
		if chemin.ends_with(".tscn") and chemin != Disposition.GENERIQUE:
			scenes.append(chemin)
	for sous in DirAccess.get_directories_at(dossier):
		scenes.append_array(_dedicaces("%s/%s" % [dossier, sous]))
	return scenes


func _recetter_la_vue(zones: Array[Zone], vue: Dictionary) -> void:
	for source in vue.zones:
		_verifier(_zone_de(zones, source) != null, "%s : la source %s n'a pas de zone" % [vue.nom, source])
	Zone.montrer_toutes(zones, vue.zones)
	zones = zones.filter(func(zone: Zone) -> bool: return _journal.visible or not _journal.is_ancestor_of(zone))
	var noeuds := {}
	for zone in zones:
		_verifier(vue.zones.has(zone.source), "%s : la zone %s ne lit aucune source de la vue" % [vue.nom, zone.source])
		var elements := Zone.elements_de(zones, zone, vue.zones)
		var dessines := _dessines(zone)
		var cles := elements.map(func(e: Dictionary) -> String: return "%s/%s" % [e.type, e.id])
		_verifier(dessines.map(func(n: Node) -> String: return n.get_meta(Zone.META)) == cles, "%s, %s : composants %s, éléments %s" % [vue.nom, zone.source, dessines.map(func(n: Node) -> String: return n.get_meta(Zone.META)), cles])
		for n in dessines:
			noeuds[_cle(zone.source, n.get_meta(Zone.META))] = n
	for source in vue.zones:
		for e in vue.zones[source]:
			_verifier(noeuds.has(_cle(source, Zone.cle(e))), "%s, %s : %s n'a aucune zone" % [vue.nom, source, Zone.cle(e)])
	for zone in zones:
		for e in vue.zones.get(zone.source, []):
			var noeud: Node = noeuds.get(_cle(zone.source, Zone.cle(e)))
			if noeud == null:
				continue
			var textes := _textes(noeud)
			for dit in _dits(e):
				_verifier(textes.has(dit), "%s, %s/%s : « %s » ne se lit pas (%s)" % [vue.nom, e.type, e.id, dit, textes])
			_presser(vue, noeud, e)
	await process_frame
	var focus := root.gui_get_focus_owner()
	for e in vue.zones.get("fenetre.gestes", []):
		if e.focus:
			var noeud: Node = noeuds.get(_cle("fenetre.gestes", Zone.cle(e)))
			var attendu: Node = noeud.get_node(FOCUS[e.type])
			_verifier(focus == attendu, "%s : le geste en focus %s n'a pas le focus (%s)" % [vue.nom, e.id, focus])
	Zone.montrer_toutes(zones, vue.zones)
	for zone in zones:
		for n in _dessines(zone):
			_verifier(noeuds.get(_cle(zone.source, n.get_meta(Zone.META))) == n, "%s : %s redessiné au lieu d'être gardé" % [vue.nom, n.get_meta(Zone.META)])


## La clé, dans la source `source`, du composant de clé `cle` (`Zone.cle`) : un id n'est stable que dans sa zone.
func _cle(source: String, cle: String) -> String:
	return "%s|%s" % [source, cle]


func _zone_de(zones: Array[Zone], source: String) -> Zone:
	for zone in zones:
		if zone.source == source:
			return zone
	return null


## Les composants que la zone a dessinés, dans l'ordre de son conteneur.
func _dessines(zone: Zone) -> Array:
	return zone.get_parent().get_children().filter(func(n: Node) -> bool: return n.has_meta(Zone.META))


## Chaque texte lisible sous `noeud` (`_lisible`) : le titre de son onglet, étiquettes, boutons, champs, chaque entrée
## d'une liste déroulante, et la bulle de chaque contrôle.
func _textes(noeud: Node) -> Array:
	var textes := []
	if noeud.get_parent() is TabContainer:
		var onglets := noeud.get_parent() as TabContainer
		textes.append(onglets.get_tab_title(onglets.get_tab_idx_from_control(noeud)))
	var controles: Array = noeud.find_children("*", "Control", true, false)
	controles.push_front(noeud)
	for n in controles:
		if not _lisible(n):
			continue
		if n is Label or n is Button or n is LineEdit:
			textes.append(n.text)
		if (n as Control).tooltip_text != "":
			textes.append((n as Control).tooltip_text)
		if n is OptionButton:
			for i in (n as OptionButton).item_count:
				textes.append((n as OptionButton).get_item_text(i))
	return textes


## Visible, ou dans un onglet que son `TabContainer` ne montre pas : il se lit en choisissant son onglet.
func _lisible(n: Control) -> bool:
	var c: Node = n
	while c is Control:
		if not (c as Control).visible and not c.get_parent() is TabContainer:
			return false
		c = c.get_parent()
	return true


## Chaque texte que l'élément `e` et ses éléments imbriqués disent (`DITS`, le nom d'une entité, la valeur d'une
## puce, le nom d'un point du plan). Une valeur de saisie ou de liste se dit par son libellé seul : son refus la
## désactive. Les traits d'un plan se dessinent sans rien dire.
func _dits(e: Variant, valeur: bool = false) -> Array:
	var dits := []
	if e is Array:
		for x in e:
			dits.append_array(_dits(x, valeur))
	elif e is Dictionary and e.has("type"):
		for champ in e:
			var v: Variant = e[champ]
			if v is String and (champ == "libelle" or not valeur and (DITS.has(champ) or champ == "nom" and (e.type == "entite" or e.type == "point") or champ == "valeur" and e.type == "puce")):
				dits.append(v)
			elif v is Array:
				dits.append_array(_dits(v, e.type == "liste" or e.type == "saisieChoix" or e.type == "saisieCoches"))
	return dits


## Chaque geste de l'élément `e` pressé sous `noeud`, celui d'une entité sous son propre composant : l'intention qu'il
## joue est celle qu'il porte ; une liste montre choisie sa valeur pressée, aucune sans elle.
func _presser(vue: Dictionary, noeud: Node, e: Dictionary) -> void:
	match e.type:
		"bouton":
			_attendre(vue, e.id, func() -> void: (noeud.get_node("Presser") as BaseButton).pressed.emit(), e.jeu)
		"choix":
			for v in e.valeurs:
				var bouton := _composant_de(noeud, v)
				_attendre(vue, v.id, func() -> void: (bouton.get_node("Presser") as BaseButton).pressed.emit(), v.jeu)
		"liste":
			var liste: OptionButton = noeud.find_children("*", "OptionButton", true, false).front()
			var pressee := -1
			for i in e.valeurs.size():
				if e.valeurs[i].presse:
					pressee = i
			_verifier(liste.selected == pressee, "%s, %s : liste choisie à %d, valeur pressée %d" % [vue.nom, e.id, liste.selected, pressee])
			for i in e.valeurs.size():
				_attendre(vue, e.valeurs[i].id, func() -> void: liste.item_selected.emit(i), e.valeurs[i].jeu)
		"formulaire":
			var jouer: Node = noeud.get_node("Jouer")
			_attendre(vue, e.id, func() -> void: (jouer as BaseButton).pressed.emit(), vue.attendus.get(e.id))
		"plan":
			for p in e.points:
				_presser(vue, _composant_de(noeud, p), p)
		"entite", "point":
			for x in e.elements:
				_presser(vue, _composant_de(noeud, x), x)


## Le composant de l'élément `e` sous `noeud`.
func _composant_de(noeud: Node, e: Dictionary) -> Node:
	return noeud.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n.get_meta(Zone.META, "") == Zone.cle(e)).front()


func _attendre(vue: Dictionary, id: String, presser: Callable, attendu: Variant) -> void:
	_joues.clear()
	_presses.append(id)
	presser.call()
	_verifier(_joues == [attendu], "%s, %s : joue %s, attendu %s" % [vue.nom, id, _joues, attendu])


func _verifier(condition: bool, faute: String) -> void:
	if not condition:
		_fautes.append(faute)
