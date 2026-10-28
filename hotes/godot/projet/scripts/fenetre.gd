## La fenêtre qui tient la main (`vue.fenetre`, `src/hote/gestes.ts`), rendue de façon générique : son titre, son étape
## et qui tient la main, les lignes de son corps, puis chacun de ses gestes ouverts d'après son rendu : une rangée de
## choix (chaque valeur de l'argument `aChoisir` se joue d'un clic), une liste, ou un formulaire (chaque argument saisi
## selon sa `saisie`, puis le bouton, qui le nomme) défilent ; les gestes rendus en bouton restent au pied de la fenêtre.
## Un argument posé par la fenêtre (`fixe`) part tel quel ; un argument optionnel laissé vide clôt la liste. Le geste attendu prend le focus, à défaut le premier bouton (Entrée le joue). Chaque texte vient de la
## vue.
class_name FenetreDuJeu
extends CanvasLayer

signal geste(geste: Dictionary)

const LARGEUR := 440.0
const HAUT := 210.0
const MARGE := 12.0
const TAILLE_DU_TITRE := 20
const FOND := Color(0.11, 0.1, 0.09, 1.0)
const BORD := Color(0.55, 0.47, 0.33, 1.0)

var _cadre := PanelContainer.new()
var _pile := VBoxContainer.new()
var _pied := HFlowContainer.new()
var _focus: Control = null


func _ready() -> void:
	var fond := StyleBoxFlat.new()
	fond.bg_color = FOND
	fond.border_color = BORD
	fond.set_border_width_all(1)
	fond.set_content_margin_all(MARGE)
	_cadre.add_theme_stylebox_override("panel", fond)
	add_child(_cadre)
	_cadre.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	_cadre.offset_left = 0.0
	_cadre.offset_top = HAUT
	_cadre.offset_right = LARGEUR
	_cadre.offset_bottom = 0.0
	var colonne := VBoxContainer.new()
	_cadre.add_child(colonne)
	var defilement := ScrollContainer.new()
	defilement.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	defilement.size_flags_vertical = Control.SIZE_EXPAND_FILL
	colonne.add_child(defilement)
	_pile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	defilement.add_child(_pile)
	colonne.add_child(HSeparator.new())
	colonne.add_child(_pied)
	_cadre.hide()


## Montre `fenetre` (`FenetreADessiner`), ou se cache quand rien ne tient la main (`null`).
func montrer(fenetre: Variant) -> void:
	for conteneur in [_pile, _pied]:
		Controles.vider(conteneur)
	if fenetre == null:
		_cadre.hide()
		return
	_cadre.show()
	_focus = null
	_ligne(fenetre.titre).add_theme_font_size_override("font_size", TAILLE_DU_TITRE)
	var sous_titre := PackedStringArray()
	if fenetre.etape != null and fenetre.etape != fenetre.titre:
		sous_titre.append(fenetre.etape)
	var nom: Variant = fenetre.proprietaire.get("nom")
	if nom != null:
		sous_titre.append(nom)
	if not sous_titre.is_empty():
		_ligne(" · ".join(sous_titre))
	_pile.add_child(HSeparator.new())
	for ligne in fenetre.corps:
		_ligne(ligne)
	for g in fenetre.gestes:
		if not g.ouvert:
			continue
		match g.rendu:
			"bouton":
				_pied.add_child(_bouton(g, {}))
			"choix":
				_choix(g)
			"liste":
				_liste(g)
			_:
				_formulaire(g)
	if _focus == null and _pied.get_child_count() != 0:
		_focus = _pied.get_child(0)
	if _focus != null:
		_focus.grab_focus.call_deferred()


## Les arguments du geste `g` : chaque argument posé par la fenêtre, puis chaque valeur saisie (`valeurs`, par nom).
func _args(g: Dictionary, valeurs: Dictionary) -> Array:
	var args := []
	for a in g.arguments:
		if a.saisie == "fixe":
			args.append(a.valeur)
		elif valeurs.has(a.nom):
			args.append(valeurs[a.nom])
		elif a.optionnel:
			break
		else:
			args.append(a.valeur)
	return args


func _jouer(g: Dictionary, valeurs: Dictionary) -> void:
	geste.emit({type = g.verbe, args = _args(g, valeurs)})


## L'argument que le geste `g` fait choisir (`aChoisir`, rendus `choix` et `liste`).
func _a_choisir(g: Dictionary) -> Dictionary:
	for a in g.arguments:
		if a.nom == g.aChoisir:
			return a
	return {}


func _bouton(g: Dictionary, valeurs: Dictionary) -> Button:
	var bouton := Button.new()
	bouton.text = g.libelle
	bouton.pressed.connect(_jouer.bind(g, valeurs))
	if g.attendu:
		_focus = bouton
	return bouton


func _choix(g: Dictionary) -> void:
	var a := _a_choisir(g)
	_ligne(g.libelle)
	var rangee := HFlowContainer.new()
	for v in a.valeurs:
		var bouton := Button.new()
		bouton.text = v.libelle
		bouton.toggle_mode = true
		bouton.set_pressed_no_signal(v.valeur == a.valeur)
		bouton.disabled = v.refus != null
		bouton.tooltip_text = "" if v.refus == null else v.refus
		bouton.pressed.connect(_jouer.bind(g, {a.nom: v.valeur}))
		rangee.add_child(bouton)
	_pile.add_child(rangee)


func _liste(g: Dictionary) -> void:
	var a := _a_choisir(g)
	_ligne(g.libelle)
	var liste := _options(a)
	liste.item_selected.connect(func(i: int) -> void: _jouer(g, {a.nom: a.valeurs[i].valeur}))
	_pile.add_child(liste)


## Une liste des valeurs de l'argument `a`, sa valeur courante choisie.
func _options(a: Dictionary) -> OptionButton:
	var liste := OptionButton.new()
	for v in a.valeurs:
		liste.add_item(v.libelle)
	liste.select(-1)
	for i in a.valeurs.size():
		liste.set_item_disabled(i, a.valeurs[i].refus != null)
		if a.valeurs[i].valeur == a.valeur:
			liste.select(i)
	return liste


func _formulaire(g: Dictionary) -> void:
	var grille := GridContainer.new()
	grille.columns = 2
	var lectures := {}
	for a in g.arguments:
		if a.saisie != "fixe":
			var etiquette := Label.new()
			etiquette.text = a.libelle
			grille.add_child(etiquette)
			lectures[a.nom] = _saisie(a, grille)
	_pile.add_child(grille)
	var bouton := Button.new()
	bouton.text = g.libelle
	bouton.pressed.connect(func() -> void: _jouer(g, _lire(lectures)))
	if g.attendu:
		_focus = bouton
	_pile.add_child(bouton)


## Les valeurs saisies, par nom : chaque lecture rend `[]` (vide) ou `[valeur]`.
func _lire(lectures: Dictionary) -> Dictionary:
	var valeurs := {}
	for nom in lectures:
		var lue: Array = lectures[nom].call()
		if not lue.is_empty():
			valeurs[nom] = lue[0]
	return valeurs


## Le contrôle de l'argument `a`, posé dans `parent`, et sa lecture (`[]` : vide ; `[valeur]`).
func _saisie(a: Dictionary, parent: Control) -> Callable:
	match a.saisie:
		"choix":
			var liste := _options(a)
			parent.add_child(liste)
			return func() -> Array: return [] if liste.selected == -1 else [a.valeurs[liste.selected].valeur]
		"nombre":
			var nombre := SpinBox.new()
			nombre.allow_greater = a.bornes == null
			nombre.allow_lesser = a.bornes == null
			if a.bornes != null:
				nombre.min_value = a.bornes.min
				nombre.max_value = a.bornes.max
				nombre.step = 1.0 if a.bornes.pas == null else a.bornes.pas
			if a.valeur != null:
				nombre.value = a.valeur
			parent.add_child(nombre)
			return func() -> Array: return [nombre.value]
		"objet":
			var champs := VBoxContainer.new()
			var lectures := {}
			for c in a.champs:
				var etiquette := Label.new()
				etiquette.text = c.libelle
				champs.add_child(etiquette)
				lectures[c.nom] = _saisie(c, champs)
			parent.add_child(champs)
			return func() -> Array: return [_lire(lectures)]
		_:
			var texte := LineEdit.new()
			texte.text = "" if a.valeur == null else str(a.valeur)
			parent.add_child(texte)
			var json: bool = a.saisie == "json"
			return func() -> Array:
				if texte.text.is_empty():
					return []
				return [JSON.parse_string(texte.text) if json else texte.text]


func _ligne(texte: String) -> Label:
	var etiquette := Label.new()
	etiquette.text = texte
	etiquette.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pile.add_child(etiquette)
	return etiquette
