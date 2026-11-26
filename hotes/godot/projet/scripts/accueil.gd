## Le menu d'entrée de l'hôte (#3086, #3009, #4411) : sur l'image de l'accueil (la couche de paysage `FOND`), le titre,
## les entrées que le pont lui donne (`ZonesDeLAccueil` de `src/hote/accueil.ts`), celles de jeu en plaques et les
## outils en pastilles, chacune suivie vers sa scène, et le panneau des réglages (`PanneauDesReglages`).
## Mis en page, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit. Le paramètre
## `planche` (`PontDuNoyau.parametre`, #3935) pose à sa place le pont qui montre cette planche (`PontDePlanche`).
extends Control

## @contrat Écran publié
## Après la scène de démarrage (`scenes/Demarrage.tscn`, `run/main_scene`), le menu (`scenes/Accueil.tscn`)
## montre la zone `accueil.gestes`
## de la méthode `accueil` en trois zones (« Reprendre » en tête, armé ; « Jouer » et « Jouer en ligne » en plaques ;
## les autres en outils) : « Jouer » ouvre une partie au groupe (`ouvrir`), « Reprendre » montre les sauvegardes à
## charger (`sauvegardes`), « Jouer en ligne » montre le panneau du salon sans partie (`salon`), chacune au combat, qui
## suit l'entrée de l'accueil (`PontDuNoyau.entree`) ; « Combat » démarre un scénario de test, « Atelier », « Éditeur » et
## « Compendium » ouvrent leur scène, « Options » ouvre le panneau des réglages (`reglages`).

## L'image du fond, au catalogue des dessins (`src/data/schemas/paysages/defs/accueil.ts`).
const FOND := "accueil-couchant"

## La scène de chaque entrée de l'accueil (`EntreeDeLAccueil`).
const SCENES := {
	jouer = "res://scenes/Combat.tscn", reprendre = "res://scenes/Combat.tscn", salon = "res://scenes/Combat.tscn",
	combat = "res://scenes/Combat.tscn",
	atelier = "res://scenes/Atelier.tscn", editeur = "res://scenes/Editeur.tscn", compendium = "res://scenes/Compendium.tscn",
}

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _fond: TextureRect = $Fond
@onready var _menu: Control = $Menu
@onready var _refus: Label = $Menu/Entrees/Refus
@onready var _panne: Label = $Menu/Entrees/Panne
@onready var _reglages: PanneauDesReglages = $Reglages

var _publication: PublicationDeLEcran


func _ready() -> void:
	await get_tree().process_frame
	if _pont.parametre("planche") != "":
		PontDuNoyau.remplacer(get_tree(), PontDePlanche.new())
		return
	_publication = PublicationDeLEcran.new(_pont, self, self, _ecran_publie)
	var famille := Dessin.famille_du_catalogue("paysage")
	_fond.texture = Dessin.trace("paysage", [FOND], MiseEnPage.echelle_de_dessin(size.x, size.y, famille.largeur, famille.hauteur))
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	for zone in Zone.racines(_menu):
		zone.geste.connect(_jouer)
	_reglages.change.connect(_publication.demander)
	var reponse := _pont.appeler("accueil")
	if reponse.get("ok") != true:
		return
	Zone.montrer_toutes(Zone.racines(_menu), reponse.zones)
	_publication.demander()


## L'intention d'un geste : le panneau des réglages ouvert, ou l'entrée de l'accueil suivie vers sa scène.
func _jouer(jeu: Dictionary) -> void:
	if jeu.has("reglages"):
		_reglages.ouvrir()
		return
	_pont.entree = jeu.accueil
	get_tree().change_scene_to_file(SCENES[jeu.accueil])


## Les boutons de l'accueil et les réglages posés à l'écran.
func _ecran_publie() -> Dictionary:
	return {
		boutons = PontDuNoyau.boutons_a_l_ecran([_menu, _reglages.racine()]),
		curseurs = PontDuNoyau.curseurs_a_l_ecran([_reglages.racine()]),
	}
