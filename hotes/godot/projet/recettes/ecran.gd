## LA RECETTE DE L'ÉCRAN (#3328) : chaque vue que la sonde fige (`hotes/godot/recettes/ecran.ts`, écrite sous
## `VUES` dans la copie qu'elle importe) montrée par la scène `Ecran` comme le routeur `combat.gd` la montre. Chaque zone
## de la scène lit une source de la vue et chaque source a sa zone ; chaque élément a son composant, dans l'ordre de sa
## zone, et chaque texte qu'il dit (`DITS`) se lit à l'écran ; chaque geste pressé joue l'intention que l'élément porte,
## un formulaire celle que la vue attend ; le geste en focus le prend. Remontrée, une vue garde ses nœuds ; vidée, une
## zone les quitte et la fenêtre se cache, le journal garde ses lignes.
extends SceneTree

const RECETTE_AUTONOME := true
## Le contrôle de chaque composant de geste qui prend le focus.
const FOCUS := {bouton = "Presser", liste = "Valeurs", formulaire = "Jouer"}
const VUES := "res://recettes/vues/ecran.json"
## Les champs d'un élément que l'écran dit en texte.
const DITS := ["texte", "libelle", "qui", "base", "difficulte", "cible", "resultat", "dr", "verdict", "refus"]

var _fautes: Array[String] = []
var _joues: Array = []
var _presses: Array[String] = []


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
	var zones := Zone.racines(ecran)
	for zone in zones:
		zone.geste.connect(func(jeu: Dictionary) -> void: _joues.append(jeu))
	for vue in vues:
		await _recetter_la_vue(ecran, zones, vue)
	_montrer(zones, {})
	_verifier(not (ecran.get_node("Fenetre/Cadre") as Control).visible, "sans fenêtre, le cadre de la fenêtre se cache")
	for zone in zones:
		var restants := _dessines(zone).size()
		_verifier(zone.ajout or restants == 0, "%s vidée : %d éléments restent" % [zone.source, restants])
	_verifier(not _dessines(_zone_de(zones, "journal.lignes")).is_empty(), "le journal garde ses lignes")
	for faute in _fautes:
		push_error("[ecran] ", faute)
	print("[ecran] %d vues montrées, %d gestes joués, %d fautes" % [vues.size(), _presses.size(), _fautes.size()])
	quit(1 if not _fautes.is_empty() else 0)


func _recetter_la_vue(ecran: Node, zones: Array[Zone], vue: Dictionary) -> void:
	for source in vue.zones:
		_verifier(_zone_de(zones, source) != null, "%s : la source %s n'a pas de zone" % [vue.nom, source])
	_montrer(zones, vue.zones)
	var noeuds := {}
	for zone in zones:
		_verifier(vue.zones.has(zone.source), "%s : la zone %s ne lit aucune source de la vue" % [vue.nom, zone.source])
		var elements: Array = vue.zones.get(zone.source, [])
		var dessines := _dessines(zone)
		var cles := elements.map(func(e: Dictionary) -> String: return "%s/%s" % [e.type, e.id])
		_verifier(dessines.map(func(n: Node) -> String: return n.get_meta(Zone.META)) == cles, "%s, %s : composants %s, éléments %s" % [vue.nom, zone.source, dessines.map(func(n: Node) -> String: return n.get_meta(Zone.META)), cles])
		for n in dessines:
			noeuds[n.get_meta(Zone.META)] = n
	for zone in zones:
		for e in vue.zones.get(zone.source, []):
			var noeud: Node = noeuds.get("%s/%s" % [e.type, e.id])
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
			var noeud: Node = noeuds.get("%s/%s" % [e.type, e.id])
			var attendu: Node = noeud.get_node(FOCUS[e.type])
			_verifier(focus == attendu, "%s : le geste en focus %s n'a pas le focus (%s)" % [vue.nom, e.id, focus])
	_montrer(zones, vue.zones)
	for zone in zones:
		for n in _dessines(zone):
			_verifier(noeuds.get(n.get_meta(Zone.META)) == n, "%s : %s redessiné au lieu d'être gardé" % [vue.nom, n.get_meta(Zone.META)])


## Chaque zone montre les éléments de sa source dans `sources`.
func _montrer(zones: Array[Zone], sources: Dictionary) -> void:
	for zone in zones:
		zone.montrer(sources.get(zone.source, []))


func _zone_de(zones: Array[Zone], source: String) -> Zone:
	for zone in zones:
		if zone.source == source:
			return zone
	return null


## Les composants que la zone a dessinés, dans l'ordre de son conteneur.
func _dessines(zone: Zone) -> Array:
	return zone.get_parent().get_children().filter(func(n: Node) -> bool: return n.has_meta(Zone.META))


## Chaque texte visible sous `noeud` : étiquettes, boutons, champs, et chaque entrée d'une liste déroulante.
func _textes(noeud: Node) -> Array:
	var textes := []
	var controles: Array = noeud.find_children("*", "Control", true, false)
	controles.push_front(noeud)
	for n in controles:
		if not (n as Control).is_visible_in_tree():
			continue
		if n is Label or n is Button or n is LineEdit:
			textes.append(n.text)
		if n is OptionButton:
			for i in (n as OptionButton).item_count:
				textes.append((n as OptionButton).get_item_text(i))
	return textes


## Chaque texte que l'élément `e` et ses éléments imbriqués disent (`DITS`, le nom d'une entité, la valeur d'une
## puce). Une valeur de saisie ou de liste se dit par son libellé seul : son refus la désactive.
func _dits(e: Variant, valeur: bool = false) -> Array:
	var dits := []
	if e is Array:
		for x in e:
			dits.append_array(_dits(x, valeur))
	elif e is Dictionary:
		for champ in e:
			var v: Variant = e[champ]
			if v is String and (champ == "libelle" or not valeur and (DITS.has(champ) or champ == "nom" and e.type == "entite" or champ == "valeur" and e.type == "puce")):
				dits.append(v)
			elif v is Array:
				dits.append_array(_dits(v, e.type == "liste" or e.type == "saisieChoix"))
	return dits


## Chaque geste de l'élément `e` pressé sous `noeud` : l'intention qu'il joue est celle qu'il porte.
func _presser(vue: Dictionary, noeud: Node, e: Dictionary) -> void:
	match e.type:
		"bouton":
			_attendre(vue, e.id, func() -> void: (noeud.get_node("Presser") as BaseButton).pressed.emit(), e.jeu)
		"choix":
			for v in e.valeurs:
				var bouton: Node = noeud.find_children("*", "", true, false).filter(func(b: Node) -> bool: return b.get_meta(Zone.META, "") == "bouton/%s" % v.id).front()
				_attendre(vue, v.id, func() -> void: (bouton.get_node("Presser") as BaseButton).pressed.emit(), v.jeu)
		"liste":
			var liste: OptionButton = noeud.find_children("*", "OptionButton", true, false).front()
			for i in e.valeurs.size():
				_attendre(vue, e.valeurs[i].id, func() -> void: liste.item_selected.emit(i), e.valeurs[i].jeu)
		"formulaire":
			var jouer: Node = noeud.get_node("Jouer")
			_attendre(vue, e.id, func() -> void: (jouer as BaseButton).pressed.emit(), vue.attendus.get(e.id))
		"entite":
			for x in e.elements:
				_presser(vue, noeud, x)


func _attendre(vue: Dictionary, id: String, presser: Callable, attendu: Variant) -> void:
	_joues.clear()
	_presses.append(id)
	presser.call()
	_verifier(_joues == [attendu], "%s, %s : joue %s, attendu %s" % [vue.nom, id, _joues, attendu])


func _verifier(condition: bool, faute: String) -> void:
	if not condition:
		_fautes.append(faute)
