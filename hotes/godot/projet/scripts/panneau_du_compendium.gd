## Le panneau du Compendium (#4020), hôte de la méthode `compendium` du pont (`hotes/godot/pont/CONTRAT.md`, section
## « Compendium ») : ouvert avec l'index des chapitres du `Source/` que sert le poste (`PosteDEdition.manifeste`), il
## montre chaque zone de la réponse dans la sienne (`Zone.racines`) et joue au pont le geste de l'élément pressé. Le
## chapitre qu'une réponse attend se charge et revient au pont ; les données qu'une réponse donne à écrire partent au
## dépôt (`PUT donnees/<fichier>`, `If-Match` l'empreinte d'avant), et l'issue de l'écriture revient au pont. La scène
## qui le porte publie ce que l'écran porte à chaque `change` (`PontDuNoyau.publier_l_ecran`).
class_name PanneauDuCompendium
extends CanvasLayer

## @contrat Compendium
## Le panneau du Compendium (`projet/scenes/PanneauDuCompendium.tscn`, `projet/scripts/panneau_du_compendium.gd`) se
## pose dans la scène `projet/scenes/Compendium.tscn`, que le bouton « Compendium » du menu ouvre et que « Fermer »
## quitte pour le menu, et au combat, en consultation : la puce d'un terme de la fiche joue `{ compendium: { geste:
## 'suivre', categorie, id, instance? } }`, qui l'y ouvre sur cette entrée, l'atelier caché, et « Fermer » le cache.
## Ouvert, il passe à `{ ouvrir }` l'index des chapitres que sert `GET source/manifest.json` s'il répond, et l'entrée
## du renvoi, puis montre les zones : la navigation à gauche (familles, catégories, recherche, liste), la fiche au
## milieu, l'atelier à droite, ses gestes (« Modifier », « Enregistrer »…) en tête hors du défilement, l'état
## au-dessus. Il envoie le geste de l'élément pressé ; une réponse qui porte `chapitre` le
## charge par `GET source/<book>/<ch>.md` et rend `{ compendium: { geste: 'chapitre', book, ch, texte } }`, `texte`
## nul s'il ne répond pas ; une réponse qui porte `donnees` part en `PUT donnees/<fichier>`, son en-tête `If-Match`
## l'empreinte `avant`, et rend `{ compendium: { geste: 'enregistrement', reussi, refus? } }`, `refus` l'échec de la
## requête (`PontDuNoyau.requeter`), la raison du poste au bout.

## Ce que le panneau porte à l'écran a changé : ouvert, montré, défilé, saisi ou fermé.
signal change
## « Fermer » pressé, le panneau caché.
signal ferme

## En consultation (au combat), l'atelier caché.
@export var consultation := false

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _cadre: Control = $Cadre
@onready var _refus: Label = $Cadre/Avis/Refus
@onready var _panne: Label = $Cadre/Avis/Panne

var _zones: Array[Zone] = []
## Les zones de la dernière réponse montrée.
var _vues := {}
## Les attentes au poste : le manifeste, le chapitre, l'écriture (`PosteDEdition`).
var _poste: PosteDEdition


func _ready() -> void:
	_zones = Zone.racines(_cadre)
	for zone in _zones:
		zone.geste.connect(_jouer)
	_poste = PosteDEdition.new(_pont)
	(%Atelier as Control).visible = not consultation
	(%Fermer as Button).pressed.connect(_fermer)
	for defilement in _cadre.find_children("*", "ScrollContainer", true, false):
		(defilement as ScrollContainer).get_v_scroll_bar().value_changed.connect(change.emit.unbind(1))
	_pont.suivre_les_listes(_cadre, change.emit)
	_pont.suivre_les_saisies(_cadre, change.emit)
	_pont.refus.connect(dire_le_refus)
	_pont.panne.connect(dire_la_panne)


## Sorti de l'arbre, il n'y revient pas (#4195) : ses attentes au poste sont abandonnées.
func _exit_tree() -> void:
	_poste.abandonner()


## Le panneau ouvert, sur l'entrée que suit le renvoi `renvoi` (`{ geste: 'suivre', categorie, id, instance? }`) s'il
## est donné, une fois l'index des chapitres servi lu.
func ouvrir(renvoi := {}) -> void:
	var entree := renvoi.duplicate()
	entree.erase("geste")
	entree.ouvrir = true
	_poste.manifeste(func(manifeste: String) -> void:
		if manifeste != "":
			entree.manifeste = manifeste
		_suivre(_pont.appeler(Noyau.Methode.COMPENDIUM, entree)))


## La racine de ce que le panneau porte à l'écran (`PontDuNoyau.boutons_a_l_ecran`).
func racine() -> Control:
	return _cadre


## Les zones que le panneau montre, vides caché.
func vues() -> Dictionary:
	return _vues if _cadre.visible else {}


## Le refus d'un appel au pont (`PontDuNoyau.refus`), dit à l'avis du panneau.
func dire_le_refus(texte: String) -> void:
	_refus.text = texte


## La panne du pont (`PontDuNoyau.panne`), dite à l'avis du panneau.
func dire_la_panne(texte: String) -> void:
	_panne.text = texte


func _fermer() -> void:
	_cadre.visible = false
	change.emit()
	ferme.emit()


func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler(Noyau.Methode.COMPENDIUM, jeu))


## Une réponse de `compendium` : ses zones montrées, le chapitre attendu chargé, les données à écrire écrites au dépôt.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_refus.text = ""
	_vues = reponse.zones
	_cadre.visible = true
	Zone.montrer_toutes(_zones, _vues)
	change.emit()
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
