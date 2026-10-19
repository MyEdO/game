## Modale d'attaque d'un héros (#2870 ; étalon `src/ui/RollShell.tsx` et `src/ui/jetProps/useAttackJetProps.tsx`) :
## remplit `ModaleAttaque.tscn` depuis l'`Apercu` et le `Jet` du pont, et branche ses gestes sur les méthodes
## du contrat (`apercuAttaque`, `lancerAttaque`, `relancerAttaque`, `chancePlusUnDR`, `appliquerAttaque`,
## `annulerAttaque`). Mise en page, couleurs et durées : la scène et `theme/wfrp.tres`.
class_name ModaleAttaque
extends CanvasLayer

## `{resultat, vue}` après « Appliquer », `{vue}` après « Annuler », `{}` si le pont n'a pas répondu `ok`.
signal fermee(issue: Dictionary)

const PILE := "Racine/Centre/Cadre/Pile/"

@onready var _titre: Label = get_node(PILE + "Titre")
@onready var _sous_titre: Label = get_node(PILE + "SousTitre")
@onready var _attaquant: VBoxContainer = get_node(PILE + "Opposition/Attaquant")
@onready var _cible: VBoxContainer = get_node(PILE + "Opposition/Cible")
@onready var _arme: Label = get_node(PILE + "Opposition/Fleche/Arme")
@onready var _degats: Label = get_node(PILE + "Opposition/Fleche/Degats")
@onready var _localisation: HBoxContainer = get_node(PILE + "Localisation")
@onready var _choix: OptionButton = get_node(PILE + "Localisation/Choix")
@onready var _rangee_attaque: RangeeJet = get_node(PILE + "Rangees/Attaque")
@onready var _rangee_defense: RangeeJet = get_node(PILE + "Rangees/Defense")
@onready var _dr_net: Label = get_node(PILE + "DrNet")
@onready var _phrase: Label = get_node(PILE + "Phrase")
@onready var _critique: Label = get_node(PILE + "Critique")
@onready var _influences: HBoxContainer = get_node(PILE + "Influences")
@onready var _relancer: Button = get_node(PILE + "Influences/Relancer")
@onready var _plus_un_dr: Button = get_node(PILE + "Influences/PlusUnDR")
@onready var _annuler: Button = get_node(PILE + "Pied/Annuler")
@onready var _appliquer: Button = get_node(PILE + "Pied/Appliquer")
@onready var _lancer: Button = get_node(PILE + "Pied/Lancer")
@onready var _roulis: Control = $Racine/Roulis
@onready var _faces: Label = $Racine/Roulis/Faces
@onready var _cadence: Timer = $Cadence
@onready var _duree: Timer = $Duree

var _apercu: Dictionary = {}
var _jet: Dictionary = {}
var _occupe := false


func _ready() -> void:
	_choix.item_selected.connect(_changer_localisation)
	_lancer.pressed.connect(_jouer.bind("lancerAttaque"))
	_relancer.pressed.connect(_jouer.bind("relancerAttaque"))
	_plus_un_dr.pressed.connect(_jouer.bind("chancePlusUnDR"))
	_annuler.pressed.connect(_annuler_attaque)
	_appliquer.pressed.connect(_appliquer_attaque)
	_cadence.timeout.connect(func() -> void: _faces.text = "%02d" % randi_range(0, 99))
	_roulis.gui_input.connect(_cliquer_roulis)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("annuler"):
		if _occupe:
			_passer_roulis()
		else:
			_annuler_attaque()
	elif event.is_action_pressed("lancer_jet"):
		if _jet.is_empty():
			_jouer("lancerAttaque")
	else:
		return
	get_viewport().set_input_as_handled()


## Ouvre l'attaque côté pont et remplit l'aperçu ; faux si le pont refuse.
func ouvrir(attaquant: String, cible: String) -> bool:
	var reponse := Pont.appeler("apercuAttaque", {attaquant = attaquant, cible = cible})
	if not reponse.get("ok", false):
		return false
	remplir_apercu(reponse.apercu)
	return true


## `apercu` : un `Apercu` du contrat.
func remplir_apercu(apercu: Dictionary) -> void:
	_apercu = apercu
	_jet = {}
	_titre.text = str(apercu.titre)
	_sous_titre.text = str(apercu.sousTitre)
	_poser_combattant(_attaquant, apercu.attaquant)
	_poser_combattant(_cible, apercu.cible)
	_arme.text = str(apercu.arme)
	_degats.text = "Dégâts +%d" % int(apercu.degats)
	_choix.clear()
	for i in apercu.localisations.size():
		var l: Dictionary = apercu.localisations[i]
		_choix.add_item(str(l.libelle))
		_choix.set_item_metadata(i, l.id)
		if l.id == apercu.localisation:
			_choix.select(i)
	var a: Dictionary = apercu.attaque
	_rangee_attaque.afficher_avant(str(a.competence), str(a.difficulte), RangeeJet.calcul(a.base, int(a.cible)), a.mods)
	var defense: Variant = apercu.defense
	_rangee_defense.visible = defense != null
	if defense != null:
		_rangee_defense.afficher_avant(str(defense.competence), "", "?", defense.mods)
	_poser_phase()


## `jet` : un `Jet` du contrat, sur l'aperçu déjà rempli.
func remplir_jet(jet: Dictionary) -> void:
	_jet = jet
	var a: Dictionary = _apercu.attaque
	var defense: Variant = jet.defense
	var attaquant_gagne: bool = jet.gagnant == "attaquant"
	_rangee_attaque.afficher_apres(jet.attaque, str(a.difficulte), RangeeJet.calcul(a.base, int(jet.attaque.cible)), attaquant_gagne or defense == null)
	_rangee_defense.visible = defense != null
	if defense != null:
		_rangee_defense.afficher_apres(defense, "", RangeeJet.calcul(null, int(defense.cible)), not attaquant_gagne)
	_dr_net.text = "DR net : %s" % RangeeJet.signe(int(jet.drNet))
	_dr_net.visible = defense != null
	_phrase.text = str(jet.phrase)
	_critique.visible = jet.critique
	_poser_influence(_relancer, "Relancer ×%d", jet.influences.relancer)
	_poser_influence(_plus_un_dr, "Chance : +1 DR ×%d", jet.influences.plusUnDR)
	_poser_phase()


func _poser_phase() -> void:
	var lance := not _jet.is_empty()
	_localisation.visible = not lance
	_lancer.visible = not lance
	_annuler.visible = not lance
	_appliquer.visible = lance
	_influences.visible = lance
	_phrase.visible = lance
	if not lance:
		_dr_net.hide()
		_critique.hide()


func _poser_combattant(noeud: VBoxContainer, c: Dictionary) -> void:
	var jauge: ProgressBar = noeud.get_node("Jauge")
	noeud.get_node("Nom").text = str(c.libelle)
	jauge.max_value = maxi(1, int(c.blessuresMax))
	jauge.value = int(c.blessures)
	noeud.get_node("Blessures").text = "Blessures %d / %d" % [int(c.blessures), int(c.blessuresMax)]


func _poser_influence(bouton: Button, format: String, influence: Dictionary) -> void:
	bouton.text = format % int(influence.restants)
	bouton.disabled = not influence.possible


func _changer_localisation(index: int) -> void:
	var reponse := Pont.appeler("apercuAttaque", {attaquant = _apercu.attaquant.id, cible = _apercu.cible.id, localisation = _choix.get_item_metadata(index)})
	if reponse.get("ok", false):
		remplir_apercu(reponse.apercu)


## Lancer, relancer ou +1 DR : le pont re-résout, le roulis précède l'affichage d'un dé neuf.
func _jouer(methode: String) -> void:
	if _occupe:
		return
	_occupe = true
	var reponse := Pont.appeler(methode)
	if reponse.get("ok", false):
		if methode != "chancePlusUnDR":
			await _rouler()
		remplir_jet(reponse.jet)
	_occupe = false


func _rouler() -> void:
	_roulis.show()
	_cadence.start()
	_duree.start()
	await _duree.timeout
	_cadence.stop()
	_roulis.hide()


func _cliquer_roulis(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_passer_roulis()


func _passer_roulis() -> void:
	if not _duree.is_stopped():
		_duree.stop()
		_duree.timeout.emit()


func _annuler_attaque() -> void:
	if _occupe or not _jet.is_empty():
		return
	var reponse := Pont.appeler("annulerAttaque")
	fermee.emit({vue = reponse.vue} if reponse.get("ok", false) else {})


func _appliquer_attaque() -> void:
	if _occupe or _jet.is_empty():
		return
	var reponse := Pont.appeler("appliquerAttaque")
	fermee.emit({resultat = reponse.resultat, vue = reponse.vue} if reponse.get("ok", false) else {})
