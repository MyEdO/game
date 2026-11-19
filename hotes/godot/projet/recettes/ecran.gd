## LA RECETTE DE L'ÉCRAN (#3328) : chaque vue que la sonde fige (`hotes/godot/recettes/ecran.ts`, écrite sous
## `VUES` dans la copie qu'elle importe) montrée par la scène `Ecran` comme le routeur `combat.gd` la montre, dans la
## disposition qu'elle nomme. Chaque zone de la scène lit une source de la vue et chaque source a sa zone, hors des
## zones d'un panneau que la disposition cache (le journal sous une scène qui le tient, `Disposition.journal`) ; chaque
## élément a son composant, dans l'ordre de la zone qui le range, et aucun ne reste sans zone ; chaque texte qu'il dit
## (`DITS`) se lit à l'écran, au survol de son contrôle ou au menu de la partie ouvert ; chaque geste pressé joue l'intention que l'élément porte,
## un formulaire celle que la vue attend, un curseur glissé ou réglé par sa boîte à nombre sa valeur (#4081) ; le geste
## en focus le prend. Remontrée, une vue garde ses nœuds et ne joue rien (sa pose remet chaque curseur) ; vidée, une
## zone les quitte et la fenêtre se cache, le journal garde ses lignes. Chaque disposition dédiée (`res://ecrans/`) est
## montrée par une vue. Sur le pont vivant, un clic droit d'exploration sur la case de Gustav montre son statbloc (#3687).
extends SceneTree

const RECETTE_AUTONOME := true
## Le contrôle de chaque composant de geste qui prend le focus.
const FOCUS := {bouton = "Presser", liste = "Valeurs", formulaire = "Jouer"}
const VUES := "res://recettes/vues/ecran.json"
## Les champs d'un élément que l'écran dit en texte.
const DITS := ["texte", "libelle", "qui", "cible", "resultat", "dr", "verdict", "refus", "detail"]
const ECRANS := "res://ecrans"
const SCENE := "Interface/Ossature/Colonne/Milieu/Scene"
const CASE_DE_GUSTAV := Vector3i(5, 3, 0)
const ATTENTE_DE_L_EXPLORATION_MS := 45_000

var _fautes: Array[String] = []
var _joues: Array = []
var _presses: Array[String] = []
var _posees := {}
## Le panneau du journal de l'écran (`Disposition.journal`), que la disposition posée cache quand elle le tient.
var _journal: Control


class PontDeLInspection extends PontEspion:
	func parametre(cle: String) -> String:
		return "dialogue-multi" if cle == "scenario" else super(cle)


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
		await _recetter_la_vue(_disposer(ecran, vue.disposition, vue.combat), vue)
	var zones := _disposer(ecran, null, false)
	Zone.montrer_toutes(zones, {})
	_verifier(not (ecran.get_node(SCENE).find_child("Cadre", true, false) as Control).visible, "sans fenêtre, le cadre de la fenêtre se cache")
	for scene in _dedicaces(ECRANS):
		_verifier(_posees.has(scene), "%s : aucune vue ne la montre" % scene)
	for zone in zones:
		var restants := _dessines(zone).size()
		_verifier(zone.ajout or restants == 0, "%s vidée : %d éléments restent" % [zone.source, restants])
	_verifier(not _dessines(_zone_de(zones, "journal.lignes")).is_empty(), "le journal garde ses lignes")
	ecran.queue_free()
	await process_frame
	await _recetter_l_inspection()
	for faute in _fautes:
		push_error("[ecran] ", faute)
	print("[ecran] %d vues montrées, %d gestes joués, %d fautes" % [vues.size(), _presses.size(), _fautes.size()])
	quit(1 if not _fautes.is_empty() else 0)


## La case de Gustav pointée dans le monde, le clic droit ouvre ses zones de statbloc sans jouer de geste.
func _recetter_l_inspection() -> void:
	var pont := PontDeLInspection.new()
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _fautes.append("inspection : " + message))
	pont.refus.connect(func(message: String) -> void: _fautes.append("inspection : " + message))
	var combat: Node = (load("res://scenes/Combat.tscn") as PackedScene).instantiate()
	root.add_child(combat)
	var limite := Time.get_ticks_msec() + ATTENTE_DE_L_EXPLORATION_MS
	while Time.get_ticks_msec() < limite:
		var vue: Dictionary = combat.get("_vue")
		if vue.get("champ") != null:
			break
		if vue.get("projection", {}).get("fenetre") != null:
			for geste: Dictionary in vue.zones["fenetre.gestes"]:
				if geste.focus:
					combat.call("_jouer", geste.jeu)
					break
		await process_frame
	var avant: Dictionary = combat.get("_vue")
	if avant.get("champ") == null or avant.projection.exploration == null:
		_verifier(false, "inspection : l'exploration de la tablée ne s'ouvre pas")
	else:
		await _cliquer_sur_gustav(combat, avant)
	combat.queue_free()
	await process_frame


func _cliquer_sur_gustav(combat: Node, avant: Dictionary) -> void:
	var case := CASE_DE_GUSTAV
	var plateau := combat.get_node("Plateau") as Plateau
	var monde := plateau.get_node("Monde") as Monde
	var refus := plateau.cadrer({regard = monde.regard(), case = {x = case.x, y = case.y}, lacet = 0.0, zoom = 15.0})
	_verifier(refus.is_empty(), "inspection : " + refus)
	await physics_frame
	await process_frame
	var point: Array = plateau.points().get("%d,%d,%d" % [case.x, case.y, case.z], [])
	if point.is_empty() or monde.case_sous(Vector2(point[0], point[1])) != case:
		_verifier(false, "inspection : le pointeur doit désigner la case de Gustav")
		return
	for appuye in [true, false]:
		var clic := InputEventMouseButton.new()
		clic.button_index = MOUSE_BUTTON_RIGHT
		clic.pressed = appuye
		clic.position = Vector2(point[0], point[1])
		clic.global_position = clic.position
		root.push_input(clic, true)
	await process_frame
	var apres: Dictionary = combat.get("_vue")
	var zones := Zone.racines(combat.get_node("Ecran"))
	var porteurs := _dessines(_zone_de(zones, "fiche.porteur"))
	_verifier(porteurs.size() == 1 and _se_lit(_textes(porteurs[0]), "Gustav"), "inspection : Gustav se lit sur sa fiche")
	_verifier(not _dessines(_zone_de(zones, "fiche.profil")).is_empty(), "inspection : le profil du statbloc est montré")
	_verifier(apres.projection.pas == avant.projection.pas, "inspection : le clic droit a joué un geste de la partie")


## Les zones de l'écran, la disposition de `disposition` posée (`Disposition.disposer`) : chacune rend son geste joué.
func _disposer(ecran: Node, disposition: Variant, en_combat: bool) -> Array[Zone]:
	var posee := ecran.get_node(SCENE + "/Disposition") as Disposition
	posee.disposer(disposition, en_combat)
	_posees[posee.scene] = true
	_journal = posee.journal
	var zones := Zone.racines(ecran)
	for zone in zones:
		if not zone.geste.is_connected(_noter):
			zone.geste.connect(_noter)
	return zones


func _noter(jeu: Dictionary) -> void:
	_joues.append(jeu)


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
	for zone in zones:
		for e in vue.zones.get(zone.source, []):
			var noeud: Node = noeuds.get(_cle(zone.source, Zone.cle(e)))
			if noeud == null:
				continue
			var textes := _textes(noeud)
			for dit in _dits(e):
				_verifier(_se_lit(textes, dit), "%s, %s/%s : « %s » ne se lit pas (%s)" % [vue.nom, e.type, e.id, dit, textes])
			_presser(vue, noeud, e)
	await process_frame
	var focus := root.gui_get_focus_owner()
	for e in vue.zones.get("fenetre.gestes", []):
		if e.focus:
			var noeud: Node = noeuds.get(_cle("fenetre.gestes", Zone.cle(e)))
			var attendu: Node = noeud.get_node(FOCUS[e.type])
			_verifier(focus == attendu, "%s : le geste en focus %s n'a pas le focus (%s)" % [vue.nom, e.id, focus])
	_joues.clear()
	Zone.montrer_toutes(zones, vue.zones)
	_verifier(_joues.is_empty(), "%s : la vue remontrée joue %s" % [vue.nom, _joues])
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


## Si `dit` se lit dans `textes` : un texte entier, ou des lignes entières d'un texte, dont la bulle qu'écrivent à la
## suite les unes des autres plusieurs liaisons (`Liaison.a_la_suite` : le libellé, le détail, le refus).
static func _se_lit(textes: Array, dit: String) -> bool:
	return textes.any(func(t: String) -> bool: return ("\n%s\n" % t).contains("\n%s\n" % dit))


## Visible, ou dans un onglet que son `TabContainer` ne montre pas, dans la liste fermée d'une ouvrante (`Ouvrante` :
## le menu de la partie, une pastille de choix), ou composant qu'une zone en `derniers` cache (la chronique fermée, que
## sa pastille ouvre) : il se lit en choisissant son onglet, en ouvrant la liste, en pressant la pastille.
func _lisible(n: Control) -> bool:
	var c: Node = n
	while c is Control:
		if not (c as Control).visible and not c.get_parent() is TabContainer and not c.get_parent() is Ouvrante and not _cache_par_derniers(c):
			return false
		c = c.get_parent()
	return true


## Si `c` est un composant de zone que sa zone cache en `derniers` (`Zone.derniers`).
static func _cache_par_derniers(c: Node) -> bool:
	return c.has_meta(Zone.META) and c.get_parent().get_children().any(func(z: Node) -> bool: return z is Zone and z.derniers > 0)


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
			if v is String and (champ == "libelle" or not valeur and (DITS.has(champ) or champ == "nom" and (e.type == Noyau.TypeDElement.ENTITE or e.type == Noyau.TypeDElement.POINT) or champ == "valeur" and e.type == Noyau.TypeDElement.PUCE)):
				dits.append(v)
			elif v is Array:
				dits.append_array(_dits(v, e.type == Noyau.TypeDElement.LISTE or e.type == Noyau.TypeDeSaisie.SAISIE_CHOIX or e.type == Noyau.TypeDeSaisie.SAISIE_COCHES))
	return dits


## Chaque geste de l'élément `e` pressé sous `noeud`, celui d'une entité sous son propre composant : l'intention qu'il
## joue est celle qu'il porte ; une liste montre choisie sa valeur pressée, aucune sans elle.
func _presser(vue: Dictionary, noeud: Node, e: Dictionary) -> void:
	match e.type:
		Noyau.TypeDElement.BOUTON:
			_attendre(vue, e.id, func() -> void: (noeud.get_node("Presser") as BaseButton).pressed.emit(), e.jeu)
		Noyau.TypeDElement.PUCE:
			if e.jeu != null:
				_attendre(vue, e.id, func() -> void: (noeud.get_node("Presser") as BaseButton).pressed.emit(), e.jeu)
		Noyau.TypeDElement.CHOIX, Noyau.TypeDElement.LISTE:
			var deroulantes := noeud.find_children("*", "OptionButton", true, false)
			if deroulantes.is_empty():
				for v in e.valeurs:
					var bouton := _composant_de(noeud, v)
					_attendre(vue, v.id, func() -> void: (bouton.get_node("Presser") as BaseButton).pressed.emit(), v.jeu)
				return
			var liste: OptionButton = deroulantes.front()
			var pressee := -1
			for i in e.valeurs.size():
				if e.valeurs[i].presse:
					pressee = i
			_verifier(liste.selected == pressee, "%s, %s : liste choisie à %d, valeur pressée %d" % [vue.nom, e.id, liste.selected, pressee])
			for i in e.valeurs.size():
				_attendre(vue, e.valeurs[i].id, func() -> void: liste.item_selected.emit(i), e.valeurs[i].jeu)
		Noyau.TypeDElement.CURSEUR:
			var glissiere := noeud.get_node("Glissiere") as Slider
			var boite := noeud.get_node("Nombre") as SpinBox
			_verifier([boite.value, boite.min_value, boite.max_value, boite.step] == [e.valeur, e.min, e.max, e.pas], "%s, %s : la boîte à nombre montre %s" % [vue.nom, e.id, [boite.value, boite.min_value, boite.max_value, boite.step]])
			_verifier(glissiere.editable == (e.refus == null) and boite.editable == (e.refus == null), "%s, %s : réglable malgré son refus, ou refusé sans lui" % [vue.nom, e.id])
			var glisser := func() -> void:
				glissiere.drag_started.emit()
				glissiere.value = e.min
				glissiere.drag_ended.emit(true)
			_attendre(vue, e.id, glisser, {type = e.verbe, args = e.arguments + [e.min]})
			_attendre(vue, e.id, func() -> void: boite.value = e.max, {type = e.verbe, args = e.arguments + [e.max]})
		Noyau.TypeDElement.FORMULAIRE:
			var jouer: Node = noeud.get_node("Jouer")
			_attendre(vue, e.id, func() -> void: (jouer as BaseButton).pressed.emit(), vue.attendus.get(e.id))
		Noyau.TypeDElement.PLAN:
			for p in e.points:
				_presser(vue, _composant_de(noeud, p), p)
		Noyau.TypeDElement.ENTITE, Noyau.TypeDElement.POINT:
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
