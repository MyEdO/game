## L'interface du combat, lue dans la vue : le round et le tour, la fiche de l'actif, la barre de ses offres (une offre
## pressée rend son id), la raison d'une barre fermée, le journal, le refus d'un geste, une panne du pont et la fin du
## combat.
class_name InterfaceDuCombat
extends CanvasLayer

signal offre_choisie(offre: String)

const LARGEUR_PANNEAU := 300

var _tour := Label.new()
var _fiche := Label.new()
var _barre := Label.new()
var _offres := HFlowContainer.new()
var _journal := RichTextLabel.new()
var _message := Label.new()
var _panne := Label.new()


func _ready() -> void:
	var gauche := _panneau(Control.PRESET_TOP_LEFT, Vector2(LARGEUR_PANNEAU, 0), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_END)
	gauche.add_child(_tour)
	gauche.add_child(_fiche)
	gauche.add_child(_barre)
	_barre.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var droite := _panneau(Control.PRESET_RIGHT_WIDE, Vector2(LARGEUR_PANNEAU, 0), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_BOTH)
	var titre := Label.new()
	titre.text = "Journal"
	droite.add_child(titre)
	_journal.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_journal.scroll_following = true
	droite.add_child(_journal)
	var bas := _panneau(Control.PRESET_BOTTOM_WIDE, Vector2.ZERO, Control.GROW_DIRECTION_BOTH, Control.GROW_DIRECTION_BEGIN)
	bas.get_parent().offset_right = -LARGEUR_PANNEAU
	_offres.alignment = FlowContainer.ALIGNMENT_CENTER
	bas.add_child(_offres)
	var avis := VBoxContainer.new()
	add_child(avis)
	avis.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	avis.grow_horizontal = Control.GROW_DIRECTION_BOTH
	for etiquette in [_message, _panne]:
		etiquette.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		avis.add_child(etiquette)
	_panne.add_theme_color_override("font_color", Color(1.0, 0.45, 0.4))


func _panneau(preset: Control.LayoutPreset, taille: Vector2, en_largeur: Control.GrowDirection, en_hauteur: Control.GrowDirection) -> VBoxContainer:
	var cadre := PanelContainer.new()
	cadre.custom_minimum_size = taille
	cadre.grow_horizontal = en_largeur
	cadre.grow_vertical = en_hauteur
	add_child(cadre)
	cadre.set_anchors_and_offsets_preset(preset)
	var pile := VBoxContainer.new()
	cadre.add_child(pile)
	return pile


func montrer(vue: Dictionary, journal: Array) -> void:
	_message.text = ""
	for ligne in journal:
		var texte: Variant = ligne.get("texte") if ligne.de == "journal" else ligne.evenement.get("text")
		if texte != null:
			_journal.add_text("%s\n" % texte)
	var combat: Variant = vue.projection.combat
	for bouton in _offres.get_children():
		bouton.queue_free()
	if combat == null:
		_tour.text = ""
		_fiche.text = ""
		_barre.text = ""
		return
	_tour.text = "Round %d · tour %d / %d" % [int(combat.round), int(combat.tour), int(combat.tours)]
	_fiche.text = "" if combat.actif == null else _decrire(combat.actif)
	_barre.text = "" if combat.barre.raison == null else str(combat.barre.raison)
	if combat.fin != null:
		_message.text = "Fin du combat : %s" % combat.fin
	if combat.offres != null:
		for offre in combat.offres.liste:
			var bouton := Button.new()
			bouton.text = offre.id if offre.cout == null else "%s (%s)" % [offre.id, offre.cout]
			bouton.toggle_mode = true
			bouton.set_pressed_no_signal(combat.intention == offre.id)
			bouton.pressed.connect(func() -> void: offre_choisie.emit(offre.id))
			_offres.add_child(bouton)


func _decrire(actif: Dictionary) -> String:
	var etats := PackedStringArray()
	for e in actif.etats:
		etats.append("%s %d" % [e.id, int(e.valeur)])
	return "%s\nBlessures : %d / %d\nAvantage : %d\nMouvement : %d / %d\nAction : %s\nÉtats : %s" % [
		actif.nom, int(actif.pb[0]), int(actif.pb[1]), int(actif.avantage),
		int(actif.mouvement[0]), int(actif.mouvement[1]), actif.action, ", ".join(etats) if not etats.is_empty() else "aucun"]


func afficher_refus(texte: String) -> void:
	_message.text = texte


func afficher_panne(texte: String) -> void:
	_panne.text = texte
