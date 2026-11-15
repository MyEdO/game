## Le Compendium (#4020), ouvert par le bouton « Compendium » du menu : son panneau (`PanneauDuCompendium`), atelier
## compris, ouvert sur la première famille, que « Fermer » quitte pour le menu. Chaque `change` du panneau, il publie
## ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit.
extends Node

@onready var _panneau: PanneauDuCompendium = $Panneau
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

## La publication de l'écran, attendue jusqu'à ce que l'interface soit mise en page.
var _publication: PublicationDeLEcran


func _ready() -> void:
	_publication = PublicationDeLEcran.new(_pont, self, _panneau, _ecran_publie)
	_panneau.change.connect(_publication.demander)
	_panneau.ferme.connect(_pont.revenir_a_l_accueil)
	if not await _pont.rejoindre(_panneau.dire_le_refus, _panneau.dire_la_panne):
		return
	_panneau.ouvrir()


## Ce que l'écran porte : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), l'emprise de ses panneaux
## (`PontDuNoyau.panneaux_a_l_ecran`), ses champs de texte (`PontDuNoyau.saisies_a_l_ecran`), et les zones du Compendium.
func _ecran_publie() -> Dictionary:
	var racines := [_panneau.racine()]
	return {boutons = PontDuNoyau.boutons_a_l_ecran(racines), panneaux = PontDuNoyau.panneaux_a_l_ecran(racines), saisies = PontDuNoyau.saisies_a_l_ecran(racines), compendium = {zones = _panneau.vues()}}
