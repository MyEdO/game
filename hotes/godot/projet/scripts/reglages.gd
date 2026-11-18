## Le panneau des réglages (#3009, #3935, `ZonesDesReglages` de `src/hote/reglages.ts`), posé sur la table au-dessus de
## l'écran qui le porte : le titre, le volet des préférences, le registre des règles maison ouvert au domaine de son
## signet et au feuillet que ses flèches tournent (`Feuilleter`), la croix qui le ferme. Ouvert sur les zones de la
## méthode `reglages`, il rend à cette méthode le geste de chacun de ses contrôles, repose ensuite le volume des bus du
## mixage (`PontDuNoyau.regler_les_volumes`) et se ferme sur `{ reglages: false }` ; le geste d'une action de règle,
## un geste de la partie (`{ suite }`), va à l'écran qui le porte (`joue`). Un geste refusé laisse le panneau tel quel,
## le refus dit par le pont (`PontDuNoyau.refus`).
class_name PanneauDesReglages
extends CanvasLayer

## Ce que le panneau porte à l'écran a changé : ouvert, relu, feuilleté ou fermé.
signal change
## Un geste de la partie que le panneau porte (l'action d'une règle), à jouer par l'écran qui le montre.
signal joue(jeu: Dictionary)

## Le fond du panneau, au catalogue des dessins (`src/data/paysages/defs/table.ts`).
const LUEUR := "table-lueur"
## Le thème d'un signet fermé et celui du signet ouvert.
const SIGNET := preload("res://art/signet.tres")
const SIGNET_OUVERT := preload("res://art/signet_ouvert.tres")

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _cadre: Control = $Cadre
@onready var _domaines: TabContainer = %Domaines
@onready var _signets: Control = %Signets


func _ready() -> void:
	for zone in Zone.racines(_cadre):
		zone.geste.connect(_jouer)
	($Cadre/Titre/Marges/Rangee/Medaillon/Picto/Dessin as Dessin).poser({})
	_domaines.tab_changed.connect(_marquer_les_signets.unbind(1))


## Le panneau ouvert sur les réglages du pont.
func ouvrir() -> void:
	var lueur := $Cadre/Lueur as TextureRect
	if lueur.texture == null:
		var famille := Dessin.famille_du_catalogue("paysage")
		lueur.texture = Dessin.trace("paysage", [LUEUR], MiseEnPage.echelle_de_dessin(_cadre.size.x, _cadre.size.y, famille.largeur, famille.hauteur))
	_montrer(_pont.appeler(Noyau.Methode.REGLAGES))


## La racine de ce que le panneau porte à l'écran (`PontDuNoyau.boutons_a_l_ecran`).
func racine() -> Control:
	return _cadre


func _jouer(jeu: Dictionary) -> void:
	if jeu.has("reglages"):
		_cadre.visible = false
		change.emit()
		return
	if jeu.has("suite"):
		joue.emit(jeu)
		_montrer(_pont.appeler(Noyau.Methode.REGLAGES))
		return
	_montrer(_pont.appeler(Noyau.Methode.REGLAGES, jeu))
	_pont.regler_les_volumes()


func _montrer(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	Zone.montrer_toutes(Zone.racines(_cadre), reponse.zones)
	_relier_les_signets()
	_cadre.visible = true
	change.emit()


## Chaque signet ouvre le domaine de son rang au registre ; chaque feuillet tourné se publie.
func _relier_les_signets() -> void:
	for signet in _poses(_signets):
		var ouvrir := signet.get_node("Ouvrir") as Button
		if not ouvrir.pressed.is_connected(_ouvrir):
			ouvrir.pressed.connect(_ouvrir.bind(signet))
	for domaine in _poses(_domaines):
		if not (domaine as TabContainer).tab_changed.is_connected(_feuilleter):
			(domaine as TabContainer).tab_changed.connect(_feuilleter)
	_marquer_les_signets()


## Le domaine du signet `signet` ouvert au registre.
func _ouvrir(signet: Control) -> void:
	_domaines.current_tab = _poses(_signets).find(signet)


func _feuilleter(_onglet: int) -> void:
	change.emit()


## Le signet du domaine ouvert au thème d'un signet ouvert, pressé ; les autres fermés.
func _marquer_les_signets() -> void:
	var signets := _poses(_signets)
	for i in signets.size():
		var ouvert := i == _domaines.current_tab
		signets[i].theme = SIGNET_OUVERT if ouvert else SIGNET
		(signets[i].get_node("Ouvrir") as Button).set_pressed_no_signal(ouvert)
	change.emit()


## Les composants que la zone de `conteneur` y a posés, dans l'ordre.
static func _poses(conteneur: Node) -> Array:
	return conteneur.get_children().filter(func(n: Node) -> bool: return n.has_meta(Zone.META))
