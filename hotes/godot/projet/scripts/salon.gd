## Le panneau du salon (#3009, `ZonesDuSalon` de `src/hote/salon.ts`), au-dessus du combat qui le porte, sur le modèle
## du panneau des réglages (`PanneauDesReglages`) : il montre les zones de la méthode `salon` et lui rend chacun de leurs
## gestes, relève `nouvelles` sur sa minuterie et ne garde rien d'une session.
class_name PanneauDuSalon
extends CanvasLayer

## @contrat L'écran de Godot
## Le panneau du salon (`projet/scenes/Salon.tscn`, `projet/scripts/salon.gd`), posé au combat, montre les zones de la
## méthode `salon` (`salon.etat`, `salon.sieges`, `salon.gestes`) et, sous `journal.lignes`, les lignes de la dernière
## `quittee` de `nouvelles`, jusqu'aux zones qu'il montre ensuite. `{ salon: true }` l'ouvre ; `{ salon: false }`
## (« Fermer ») le ferme, sur la partie ouverte, ou, sans partie, sur l'accueil ; tout autre geste de ses zones va à
## `salon`, puis il relève `nouvelles`. Sa minuterie relève `nouvelles` toutes les `PERIODE_S` secondes si et
## seulement si les dernières zones lues de `salon` offrent `{ salon: 'quitter' }`, panneau à l'écran ou non : hors
## salon, aucun appel ne part. Le combat relit `salon` après chaque `Suite`, d'où qu'elle vienne. Une `Suite` relevée
## passe par le combat ; une `quittee` relevée pendant une partie montrée recharge le combat sans partie
## (`PontDuNoyau.fin_du_salon`, `PontDuNoyau.entree`), sur le panneau qui en dit les lignes ; sans partie, le panneau
## les montre avec les zones relues.

## Ce que le panneau porte à l'écran a changé : ouvert, relu, défilé ou fermé.
signal change
## « Fermer » pressé, le panneau caché.
signal ferme
## Une `Suite` relevée par `nouvelles`, que le combat suit (`_suivre`).
signal suite(reponse: Dictionary)
## Une session finie (`nouvelles`, `quittee`) : ses lignes du journal.
signal fini(lignes: Array)

## La période de la relève de `nouvelles`, en secondes.
const PERIODE_S := 0.25
## Le `jeu` de « Quitter le salon », que les zones offrent tant qu'un salon est ouvert ou s'ouvre.
const QUITTER := {salon = "quitter"}

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _cadre: Control = $Cadre
var _minuterie := Timer.new()


func _ready() -> void:
	for zone in Zone.racines(_cadre):
		zone.geste.connect(_jouer)
	(%Defilement as ScrollContainer).get_v_scroll_bar().value_changed.connect(change.emit.unbind(1))
	_minuterie.wait_time = PERIODE_S
	_minuterie.timeout.connect(_relever)
	add_child(_minuterie)


## Le panneau ouvert sur les zones de `salon` et les lignes d'une session finie au combat d'avant
## (`PontDuNoyau.fin_du_salon`), qu'il vide.
func ouvrir() -> void:
	var lignes := _pont.fin_du_salon
	_pont.fin_du_salon = []
	_montrer(_pont.appeler("salon"), lignes)


## Les zones de `salon` relues, la minuterie réglée sur elles, montrées si le panneau est à l'écran.
func relire() -> void:
	var reponse := _pont.appeler("salon")
	if _cadre.visible:
		_montrer(reponse, [])
	elif reponse.get("ok") == true:
		_regler(reponse.zones)


## La racine de ce que le panneau porte à l'écran (`PontDuNoyau.boutons_a_l_ecran`).
func racine() -> Control:
	return _cadre


func _jouer(jeu: Dictionary) -> void:
	if jeu.get("salon") is bool:
		_cadre.visible = false
		change.emit()
		ferme.emit()
		return
	_montrer(_pont.appeler("salon", jeu), [])
	_relever()


## `nouvelles` relevé : une `Suite` au combat (`suite`) ; une session finie (`fini`), puis, le panneau encore dans
## l'arbre, `salon` relu et montré avec ses lignes.
func _relever() -> void:
	var reponse := _pont.appeler("nouvelles")
	if reponse.get("ok") != true:
		return
	if reponse.has("vue"):
		suite.emit(reponse)
	elif reponse.has("quittee"):
		fini.emit(reponse.quittee.lignes)
		if is_inside_tree():
			_montrer(_pont.appeler("salon"), reponse.quittee.lignes)


## Les zones de `reponse` montrées, avec `lignes` sous `journal.lignes`, la minuterie réglée ; une réponse refusée
## laisse le panneau tel quel, le refus dit par le pont (`PontDuNoyau.refus`).
func _montrer(reponse: Dictionary, lignes: Array) -> void:
	if reponse.get("ok") != true:
		return
	_regler(reponse.zones)
	Zone.montrer_toutes(Zone.racines(_cadre), reponse.zones.merged({"journal.lignes": lignes}))
	_cadre.visible = true
	change.emit()


## La minuterie en marche si et seulement si `zones` offrent « Quitter le salon » (`QUITTER`).
func _regler(zones: Dictionary) -> void:
	var offert: bool = zones["salon.gestes"].any(func(g: Dictionary) -> bool: return g.get("jeu") == QUITTER)
	if offert and _minuterie.is_stopped():
		_minuterie.start()
	elif not offert:
		_minuterie.stop()
