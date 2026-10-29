## L'interface du combat, lue dans le panneau de la vue (`vue.panneau`, `src/hote/ecran.ts`) : le round et le tour, la
## fiche de l'actif, la raison d'une barre fermée, l'aperçu du premier clic, la barre des offres de l'actif (une offre
## pressée rend son id), le journal, le refus d'un geste, une panne du pont et la fin du combat.
class_name InterfaceDuCombat
extends CanvasLayer

signal offre_choisie(offre: String)

const LARGEUR_PANNEAU := 300.0
const FOND_DU_PANNEAU := preload("res://art/fond_panneau.tres")

var _tour := Label.new()
var _fiche := Label.new()
var _raison := Label.new()
var _apercu := Label.new()
var _offres := HFlowContainer.new()
var _titre_du_journal := Label.new()
var _journal := RichTextLabel.new()
var _message := Label.new()
var _panne := Label.new()


func _ready() -> void:
	var gauche := _panneau(Control.PRESET_TOP_LEFT, Vector2(LARGEUR_PANNEAU, 0.0), Control.GROW_DIRECTION_END, Control.GROW_DIRECTION_END)
	for etiquette in [_tour, _fiche, _raison, _apercu]:
		etiquette.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		gauche.add_child(etiquette)
	var droite := _panneau(Control.PRESET_RIGHT_WIDE, Vector2(LARGEUR_PANNEAU, 0.0), Control.GROW_DIRECTION_BEGIN, Control.GROW_DIRECTION_BOTH)
	droite.add_child(_titre_du_journal)
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
	cadre.add_theme_stylebox_override("panel", FOND_DU_PANNEAU)
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
	Controles.vider(_offres)
	var panneau: Variant = vue.panneau
	for etiquette in [_tour, _fiche, _raison, _apercu, _titre_du_journal]:
		etiquette.text = ""
	if panneau == null:
		return
	_tour.text = panneau.tour
	_fiche.text = "\n".join(PackedStringArray(panneau.fiche))
	_raison.text = "" if panneau.raison == null else panneau.raison
	_apercu.text = "" if panneau.apercu == null else panneau.apercu
	_titre_du_journal.text = panneau.journal
	if panneau.fin != null:
		_message.text = panneau.fin
	var combat: Dictionary = vue.projection.combat
	if combat.offres != null:
		for offre in combat.offres.liste:
			var bouton := Button.new()
			bouton.text = panneau.offres[offre.id]
			bouton.toggle_mode = true
			bouton.set_pressed_no_signal(combat.intention == offre.id)
			bouton.pressed.connect(func() -> void: offre_choisie.emit(offre.id))
			_offres.add_child(bouton)


func afficher_refus(texte: String) -> void:
	_message.text = texte


func afficher_panne(texte: String) -> void:
	_panne.text = texte
