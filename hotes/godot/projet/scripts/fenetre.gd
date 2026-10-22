## La fenêtre qui tient la main (`projection.fenetre`), rendue de façon générique : sa clé, son propriétaire, son étape ;
## la fenêtre d'attaque en données quand la vue la porte (`vue.attaque`), ou les jets de la fenêtre (`projection.jets`) ;
## puis ses verbes, chacun d'après ses paramètres (`vue.parametres`). Un verbe sans argument, ou dont le seul argument
## est l'id que la fenêtre désigne (`pid`), est un bouton ; un choix de la fenêtre d'attaque dont l'argument d'un verbe
## admet chaque valeur est une rangée de boutons qui jouent ce verbe. Chaque contrôle ne rend qu'un geste.
class_name FenetreDuJeu
extends CanvasLayer

signal geste(geste: Dictionary)

const LARGEUR := 480

var _cadre := PanelContainer.new()
var _pile := VBoxContainer.new()


func _ready() -> void:
	_cadre.custom_minimum_size = Vector2(LARGEUR, 0)
	add_child(_cadre)
	_cadre.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_cadre.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_cadre.grow_vertical = Control.GROW_DIRECTION_BOTH
	_cadre.add_child(_pile)
	_cadre.hide()


func montrer(vue: Dictionary) -> void:
	for enfant in _pile.get_children():
		_pile.remove_child(enfant)
		enfant.queue_free()
	var fenetre: Variant = vue.projection.fenetre
	if fenetre == null:
		_cadre.hide()
		return
	_cadre.show()
	_ligne("%s · %s" % [fenetre.cle, "—" if fenetre.proprietaire == null else fenetre.proprietaire])
	if fenetre.has("etape"):
		_ligne("étape %s (%s)" % [fenetre.etape.genre, fenetre.etape.interaction])
	if vue.attaque != null:
		_montrer_l_attaque(vue, fenetre)
	else:
		for jet in vue.projection.jets:
			_montrer_le_jet(jet, _noms(vue))
	var boutons := HFlowContainer.new()
	for verbe in fenetre.verbes:
		var args: Variant = _arguments(vue.parametres.get(verbe), fenetre.pid)
		if args == null:
			continue
		var bouton := Button.new()
		bouton.text = verbe
		bouton.pressed.connect(func() -> void: geste.emit({type = verbe, args = args}))
		boutons.add_child(bouton)
	_pile.add_child(boutons)
	if boutons.get_child_count() > 0:
		boutons.get_child(0).grab_focus.call_deferred()


## Les arguments d'un verbe que la fenêtre remplit seule : aucun, ou l'id qu'elle désigne ; `null` sinon.
func _arguments(parametres: Variant, pid: Variant) -> Variant:
	if parametres == null:
		return null
	var args := []
	for p in parametres:
		if p.optionnel:
			break
		if args.is_empty() and pid != null and p.forme.genre == "chaine":
			args.append(pid)
		else:
			return null
	return args


func _montrer_l_attaque(vue: Dictionary, fenetre: Dictionary) -> void:
	var a: Dictionary = vue.attaque
	_ligne(a.intitule)
	_ligne(a.sousTitre)
	_ligne(a.enTete)
	if a.bloque != null:
		_ligne(a.bloque)
	for choix in [a.choixDArme, a.localisation]:
		if choix != null and not a.jete:
			_montrer_le_choix(vue, fenetre, choix)
	var jet: Variant = a.jet
	if jet != null:
		_ligne(_test_jete(jet.d) if jet.has("d") else "%s : %d → %d (%s)%s" % [jet.pending.label, int(jet.pending.base), int(jet.pending.target), jet.pending.difficulty, _mods(jet.pending.mods)])
	var defense: Variant = a.defense
	if defense != null:
		_ligne(_test_jete(defense.d) if defense.has("d") else "%s (%s)%s" % [defense.pending.label, defense.pending.difficulty, _mods(defense.pending.mods)])
	if a.opposition != null:
		_ligne("DR net %+d" % int(a.opposition.drNet))
	if a.issue != null:
		_ligne(a.issue.ligne)
	if a.attente != null:
		_ligne(a.attente)


## Un choix de la fenêtre d'attaque, s'il est l'argument d'un verbe de la fenêtre : ses options en boutons ; l'option
## sans valeur (`""`) est l'argument `null` quand le verbe l'admet.
func _montrer_le_choix(vue: Dictionary, fenetre: Dictionary, choix: Dictionary) -> void:
	var valeurs := []
	for o in choix.options:
		if o.valeur != "":
			valeurs.append(o.valeur)
	if valeurs.is_empty():
		return
	for verbe in fenetre.verbes:
		var forme: Variant = _seule_union(vue.parametres.get(verbe))
		if forme == null or not valeurs.all(func(v: String) -> bool: return _admet(forme, v)):
			continue
		var libelle := Label.new()
		libelle.text = choix.libelle
		_pile.add_child(libelle)
		var rangee := HFlowContainer.new()
		for o in choix.options:
			var bouton := Button.new()
			bouton.text = o.libelle
			bouton.toggle_mode = true
			bouton.set_pressed_no_signal(o.valeur == choix.choisie)
			var valeur: Variant = null if o.valeur == "" and _admet(forme, null) else o.valeur
			bouton.pressed.connect(func() -> void: geste.emit({type = verbe, args = [valeur]}))
			rangee.add_child(bouton)
		_pile.add_child(rangee)
		return


## La forme du seul argument d'un verbe s'il est une union, `null` sinon.
func _seule_union(parametres: Variant) -> Variant:
	if parametres == null or parametres.size() != 1 or parametres[0].forme.genre != "union":
		return null
	return parametres[0].forme


## L'union `forme` admet-elle `valeur` : un littéral égal, `null` pour `null`, une chaîne pour toute chaîne.
func _admet(forme: Dictionary, valeur: Variant) -> bool:
	for m in forme.membres:
		if (m.genre == "litteral" and m.valeur == valeur) or (m.genre == "null" and valeur == null) or (m.genre == "chaine" and valeur is String):
			return true
	return false


func _montrer_le_jet(jet: Dictionary, noms: Dictionary) -> void:
	for l in jet.lignes:
		var qui: String = noms.get(l.qui, "")
		if l.genre == "test":
			var cible := "" if l.cible == null else " : cible %d" % int(l.cible)
			var tombe := " · à jeter" if l.jet == null else " · %d, DR %+d, %s" % [int(l.jet.d100), int(l.jet.dr), "réussi" if l.jet.reussi else "raté"]
			_ligne("%s — %s%s%s" % [qui, l.test, cible, tombe])
		elif l.genre == "table":
			_ligne("%s — %s%s" % [qui, l.table, "" if l.jet == null else " : %s" % l.jet.ligne])
		else:
			_ligne("%s — %s%s" % [qui, l.de, "" if l.jet == null else " : %s" % l.jet.lecture])
	if jet.oppose != null:
		_ligne("DR net %+d" % int(jet.oppose.drNet))


func _test_jete(d: Dictionary) -> String:
	return "%s : %d contre %d, DR %+d, %s%s" % [d.label, int(d.roll), int(d.target), int(d.sl), "réussite" if d.success else "échec", _mods(d.mods)]


func _mods(mods: Array) -> String:
	var textes := PackedStringArray()
	for m in mods:
		textes.append("%+d %s" % [int(m.value), m.label])
	return "" if textes.is_empty() else " · " + ", ".join(textes)


func _noms(vue: Dictionary) -> Dictionary:
	var noms := {}
	var combat: Variant = vue.projection.combat
	if combat != null:
		for c in combat.voisins.liste:
			noms[c.id] = c.nom
	return noms


func _ligne(texte: String) -> void:
	var etiquette := Label.new()
	etiquette.text = texte
	etiquette.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pile.add_child(etiquette)
