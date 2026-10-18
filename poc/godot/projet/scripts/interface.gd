## Interface du combat : remplit les textes des scènes `Interface.tscn` et `EntreeInitiative.tscn`.
class_name InterfaceCombat
extends CanvasLayer

signal demande_mode(mode: String)
signal demande_fin_de_tour

const SCENE_ENTREE := preload("res://scenes/EntreeInitiative.tscn")

@onready var _racine: Control = $Racine
@onready var _round: Label = $Racine/Bandeau/Contenu/Round
@onready var _entrees: HBoxContainer = $Racine/Bandeau/Contenu/Entrees
@onready var _fiche_nom: Label = $Racine/Fiche/Contenu/Nom
@onready var _fiche_blessures: Label = $Racine/Fiche/Contenu/Blessures
@onready var _fiche_avantage: Label = $Racine/Fiche/Contenu/Avantage
@onready var _fiche_etats: Label = $Racine/Fiche/Contenu/Etats
@onready var _fiche_mouvement: Label = $Racine/Fiche/Contenu/Mouvement
@onready var _journal: RichTextLabel = $Racine/Journal/Contenu/Lignes
@onready var _jet_protagonistes: Label = $Racine/DernierJet/Contenu/Protagonistes
@onready var _jet_attaque: Label = $Racine/DernierJet/Contenu/Attaque
@onready var _jet_defense: Label = $Racine/DernierJet/Contenu/Defense
@onready var _jet_dr_net: Label = $Racine/DernierJet/Contenu/DrNet
@onready var _jet_localisation: Label = $Racine/DernierJet/Contenu/Localisation
@onready var _jet_degats: Label = $Racine/DernierJet/Contenu/Degats
@onready var _jet_blessures: Label = $Racine/DernierJet/Contenu/BlessuresPerdues
@onready var _jet_critiques: Label = $Racine/DernierJet/Contenu/Critiques
@onready var _jet_mort_subite: Label = $Racine/DernierJet/Contenu/MortSubite
@onready var _bouton_deplacer: Button = $Racine/Actions/Contenu/Deplacer
@onready var _bouton_attaquer: Button = $Racine/Actions/Contenu/Attaquer
@onready var _bouton_fin: Button = $Racine/Actions/Contenu/FinDeTour
@onready var _message: Label = $Racine/Message
@onready var _erreur: PanelContainer = $Racine/ErreurPont
@onready var _erreur_nature: Label = $Racine/ErreurPont/Contenu/Nature
@onready var _erreur_methode: Label = $Racine/ErreurPont/Contenu/Methode
@onready var _erreur_entree: Label = $Racine/ErreurPont/Contenu/Entree
@onready var _erreur_message: Label = $Racine/ErreurPont/Contenu/Message
@onready var _erreur_partiels: RichTextLabel = $Racine/ErreurPont/Contenu/Partiels
@onready var _fin: PanelContainer = $Racine/EcranFin
@onready var _fin_titre: Label = $Racine/EcranFin/Contenu/Titre
@onready var _fin_sous_titre: Label = $Racine/EcranFin/Contenu/SousTitre
@onready var _hors_navigateur: PanelContainer = $Racine/HorsNavigateur


func _ready() -> void:
	_bouton_deplacer.pressed.connect(func() -> void: demande_mode.emit("deplacer"))
	_bouton_attaquer.pressed.connect(func() -> void: demande_mode.emit("attaquer"))
	_bouton_fin.pressed.connect(func() -> void: demande_fin_de_tour.emit())
	$Racine/ErreurPont/Contenu/Fermer.pressed.connect(_erreur.hide)


func afficher_hors_navigateur() -> void:
	for enfant in _racine.get_children():
		enfant.visible = enfant == _hors_navigateur


func afficher_vue(vue: Dictionary) -> void:
	_message.text = ""
	_round.text = "Round %d" % int(vue.round)
	var par_id := {}
	for c in vue.combattants:
		par_id[c.id] = c
	for entree in _entrees.get_children():
		_entrees.remove_child(entree)
		entree.queue_free()
	for id in vue.ordre:
		var c: Dictionary = par_id[id]
		var entree: PanelContainer = SCENE_ENTREE.instantiate()
		entree.get_node("Libelle").text = c.libelle
		entree.theme_type_variation = &"EntreeActive" if id == vue.actif else (&"EntreeHeros" if c.camp == "heros" else &"EntreeAdversaires")
		if c.horsDeCombat:
			entree.modulate.a = 0.4
		_entrees.add_child(entree)
	var actif: Dictionary = par_id.get(vue.actif, {})
	if not actif.is_empty():
		_fiche_nom.text = actif.libelle
		_fiche_blessures.text = "Blessures : %d / %d" % [int(actif.blessures), int(actif.blessuresMax)]
		_fiche_avantage.text = "Avantage : %d" % int(actif.avantage)
		_fiche_etats.text = "États : %s" % _etats(actif.etats)
		_fiche_mouvement.text = "Mouvement : %d cases%s" % [int(actif.mouvement), " (déjà déplacé)" if actif.aDeplace else ""]
	_journal.text = "\n".join(PackedStringArray(vue.journal))


func afficher_jet(resultat: Dictionary, attaquant: String, cible: String) -> void:
	_jet_protagonistes.text = "%s attaque %s : %s%s" % [attaquant, cible, "touché" if resultat.touche else "raté", ", critique" if resultat.get("critique", false) else ""]
	_jet_attaque.text = "Attaque : %s" % _jet(resultat, "jetAttaque", "cibleAttaque", "drAttaque")
	_jet_defense.text = "Défense : %s" % (_jet(resultat, "jetDefense", "cibleDefense", "drDefense") if _present(resultat, "jetDefense") else "aucune")
	_jet_dr_net.text = "DR net : %+d" % int(resultat.drNet)
	_jet_localisation.text = "Localisation : %s" % (str(resultat.localisation) if _present(resultat, "localisation") else "-")
	_jet_degats.text = "Dégâts : %s" % _nombre(resultat, "degats")
	_jet_blessures.text = "Blessures perdues : %s" % _nombre(resultat, "blessuresPerdues")
	_jet_critiques.text = "Blessures critiques : %s" % _critiques(resultat.critiques)
	_jet_mort_subite.text = "Mort subite : %s" % ("oui" if resultat.mortSubite else "non")


func afficher_message(texte: String) -> void:
	_message.text = texte


func afficher_erreur(erreur: Dictionary) -> void:
	var action: Dictionary = erreur.get("action", {}) if erreur.get("action") is Dictionary else {}
	_erreur_nature.text = "Nature : %s" % str(erreur.get("nature", "?"))
	_erreur_methode.text = "Méthode : %s" % str(action.get("methode", "?"))
	_erreur_entree.text = "Entrée : %s" % JSON.stringify(action.get("entree"))
	_erreur_message.text = "Message : %s" % str(erreur.get("message", ""))
	var details := "Partiels : %s" % JSON.stringify(erreur.get("partiels"), "  ")
	if erreur.get("pile") != null:
		details += "\n\nPile :\n%s" % str(erreur.pile)
	_erreur_partiels.text = details
	_erreur.show()


func afficher_issue(issue: String) -> void:
	_fin_titre.text = "Victoire" if issue == "victoire" else "Défaite"
	_fin_sous_titre.text = "Le combat est terminé."
	_fin.show()


func regler_actions(peut_deplacer: bool, peut_attaquer: bool, peut_finir: bool, mode: String) -> void:
	_bouton_deplacer.disabled = not peut_deplacer
	_bouton_attaquer.disabled = not peut_attaquer
	_bouton_fin.disabled = not peut_finir
	_bouton_deplacer.set_pressed_no_signal(peut_deplacer and mode == "deplacer")
	_bouton_attaquer.set_pressed_no_signal(peut_attaquer and mode == "attaquer")


func _etats(etats: Array) -> String:
	if etats.is_empty():
		return "aucun"
	var parties := PackedStringArray()
	for e in etats:
		parties.append("%s %d" % [e.id, int(e.valeur)])
	return ", ".join(parties)


func _critiques(critiques: Array) -> String:
	if critiques.is_empty():
		return "aucune"
	var lignes := PackedStringArray()
	for c in critiques:
		lignes.append("\n- %s (%s)%s" % [c.libelle, c.localisation, ", mortelle" if c.mortel else ""])
	return "".join(lignes)


func _jet(resultat: Dictionary, jet: String, cible: String, dr: String) -> String:
	var texte := "%d" % int(resultat[jet])
	if _present(resultat, cible):
		texte += " contre %d" % int(resultat[cible])
	if _present(resultat, dr):
		texte += " (DR %+d)" % int(resultat[dr])
	return texte


func _nombre(resultat: Dictionary, cle: String) -> String:
	return "%d" % int(resultat[cle]) if _present(resultat, cle) else "-"


func _present(resultat: Dictionary, cle: String) -> bool:
	return resultat.get(cle) != null
