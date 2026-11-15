## Le Compendium (#4020), hôte de la méthode `compendium` du pont (`hotes/godot/pont/CONTRAT.md`, section
## « Compendium ») : il s'ouvre avec l'index des chapitres du `Source/` que sert le poste (`PosteDEdition.manifeste`),
## montre chaque zone de la réponse dans la sienne (`Zone.racines`), et joue au pont le geste de l'élément pressé. Le
## chapitre qu'une réponse attend se charge et revient au pont ; les données qu'une réponse donne à écrire partent au
## dépôt (`PUT donnees/<fichier>`, `If-Match` l'empreinte d'avant), et l'issue de l'écriture revient au pont. Chaque
## réponse montrée, et chaque défilement d'un panneau, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`),
## que la recette lit.
extends Node

## @contrat Compendium
## Le routeur `projet/scripts/compendium.gd` (scène `projet/scenes/Compendium.tscn`, ouverte par le bouton
## « Compendium » du menu) passe à `{ ouvrir }` l'index des chapitres que sert `GET source/manifest.json` s'il répond,
## puis montre les zones : la navigation à gauche (familles, catégories, recherche, liste), la fiche au milieu,
## l'atelier à droite, ses gestes (« Modifier », « Enregistrer »…) en tête hors du défilement, l'état
## au-dessus. Il envoie le geste de l'élément pressé ; une réponse qui porte `chapitre` le
## charge par `GET source/<book>/<ch>.md` et rend `{ compendium: { geste: 'chapitre', book, ch, texte } }`, `texte`
## nul s'il ne répond pas ; une réponse qui porte `donnees` part en `PUT donnees/<fichier>`, son en-tête `If-Match`
## l'empreinte `avant`, et rend `{ compendium: { geste: 'enregistrement', reussi, refus? } }`, `refus` l'échec de la
## requête (`PontDuNoyau.requeter`), la raison du poste au bout.

@onready var _interface: CanvasLayer = $Interface
@onready var _refus: Label = $Interface/Avis/Refus
@onready var _panne: Label = $Interface/Avis/Panne
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _zones: Array[Zone] = []
## Les zones de la dernière réponse montrée.
var _vues := {}
## La publication de l'écran, attendue jusqu'à ce que l'interface soit mise en page.
var _publication: PublicationDeLEcran
## Les attentes au poste : le manifeste, le chapitre, l'écriture (`PosteDEdition`).
var _poste: PosteDEdition


func _ready() -> void:
	_zones = Zone.racines(_interface)
	for zone in _zones:
		zone.geste.connect(_jouer)
	_publication = PublicationDeLEcran.new(_pont, self, _interface, _ecran_publie)
	_poste = PosteDEdition.new(_pont)
	for defilement in _interface.find_children("*", "ScrollContainer", true, false):
		(defilement as ScrollContainer).get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publication.demander())
	_pont.suivre_les_listes(_interface, _publication.demander)
	_pont.suivre_les_saisies(_interface, _publication.demander)
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	_poste.manifeste(func(manifeste: String) -> void:
		var ouvrir := {ouvrir = true}
		if manifeste != "":
			ouvrir.manifeste = manifeste
		_suivre(_pont.appeler("compendium", ouvrir)))


## Sorti de l'arbre, il n'y revient pas (#4195) : ses attentes au poste sont abandonnées.
func _exit_tree() -> void:
	_poste.abandonner()


func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler("compendium", jeu))


## Une réponse de `compendium` : ses zones montrées, le chapitre attendu chargé, les données à écrire écrites au dépôt.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_refus.text = ""
	_vues = reponse.zones
	Zone.montrer_toutes(_zones, _vues)
	_publication.demander.call_deferred()
	if reponse.has("chapitre"):
		var chapitre: Dictionary = reponse.chapitre
		_poste.charger_le_chapitre(chapitre, func(texte: Variant) -> void:
			_jouer({compendium = {geste = "chapitre", book = chapitre.book, ch = chapitre.ch, texte = texte}}))
	if reponse.has("donnees"):
		var donnees: Dictionary = reponse.donnees
		_poste.ecrire("donnees/%s" % donnees.fichier, donnees.texte, PackedStringArray(["If-Match: %d" % int(donnees.avant)]), func(recueil: Array[String]) -> void:
			var issue := {geste = "enregistrement", reussi = recueil.is_empty()}
			if not recueil.is_empty():
				issue.refus = "\n".join(recueil)
			_jouer({compendium = issue}))


## Ce que l'écran porte : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), l'emprise de ses panneaux
## (`PontDuNoyau.panneaux_a_l_ecran`), ses champs de texte (`PontDuNoyau.saisies_a_l_ecran`), et les zones du Compendium.
func _ecran_publie() -> Dictionary:
	return {boutons = PontDuNoyau.boutons_a_l_ecran([_interface]), panneaux = PontDuNoyau.panneaux_a_l_ecran([_interface]), saisies = PontDuNoyau.saisies_a_l_ecran([_interface]), compendium = {zones = _vues}}
