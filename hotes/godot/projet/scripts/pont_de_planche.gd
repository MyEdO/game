## Le pont d'une planche (#3935) : il rend à `demarrer`, à `monde`, à `morceaux`, à `retrait` et à `aretes` les réponses
## enregistrées d'un état de partie (`Planche`, `hotes/godot/recettes/ecran.ts`), et toute autre méthode au pont du
## noyau. Le combat
## (`combat.gd`) montre alors cet état comme une partie qu'il démarre, sans la jouer.
class_name PontDePlanche
extends PontDuNoyau

## @contrat Écran publié
## Une planche est un état de partie figé par le pont, déposé dans l'export (`construire.mjs --export`) sous
## `planches/<nom>.json` (les réponses de `demarrer`, `aretes` et `retrait`), le monde de son scénario sous
## `planches/mondes/<scenario>.json` (`{ monde, morceaux }` : la réponse de `monde`, et celle de `morceaux` à toutes ses
## clés, que le pont de la planche rend à toute entrée). L'adresse `?planche=<nom>`
## l'ouvre à la place du menu d'entrée : le combat la montre par son routeur, comme la partie de `?scenario=` qu'il
## démarre, et un geste qu'on y presse est refusé par le pont, aucune partie n'étant démarrée. `&monde=sans` ne dessine
## pas le monde 3D sous l'écran (`Viewport.disable_3d`) : l'image ne dépend alors que de l'interface. Godot publie à la
## page `globalThis.wfrpPlancheMontree`, le nom de la planche une fois son écran publié et ses portraits pris (`CALME_S`
## sans écran neuf), `null` tant qu'elle ne l'est pas. Le banc des étalons (`hotes/godot/etalons.mjs`) le lit.

const DOSSIER := "planches"
const COMBAT := "res://scenes/Combat.tscn"
## Le temps sans écran publié (s) après lequel la planche est dite montrée, ses portraits pris.
const CALME_S := 0.5

var _nom := ""
var _planche := {}
var _monde := {}
var _calme := Timer.new()


func _ready() -> void:
	super()
	_calme.one_shot = true
	add_child(_calme)
	_calme.timeout.connect(_constater_le_calme)
	_publier_la_planche_montree(false)
	_montrer(parametre("planche"))


## La planche `nom` lue et montrée par le combat, sans son monde 3D à `&monde=sans` ; illisible, une panne le dit et le
## menu d'entrée reste celui du jeu.
func _montrer(nom: String) -> void:
	var recueil: Array[String] = []
	var planche: Variant = JSON.parse_string((await requeter("%s/%s.json" % [DOSSIER, nom], recueil)).get_string_from_utf8())
	var monde: Variant = null
	if planche is Dictionary:
		monde = JSON.parse_string((await requeter("%s/mondes/%s.json" % [DOSSIER, planche.parametres.scenario], recueil)).get_string_from_utf8())
	if not monde is Dictionary:
		_signaler("planche %s illisible : %s" % [nom, " ; ".join(recueil)])
		return
	_nom = nom
	_planche = planche
	_monde = monde
	get_tree().root.disable_3d = parametre("monde") == "sans"
	get_tree().change_scene_to_file(COMBAT)


func appeler(methode: String, entree: Variant = null) -> Dictionary:
	if not _planche.is_empty():
		match methode:
			"demarrer":
				return _planche.demarrer
			"monde":
				return _monde.monde
			"morceaux":
				return _monde.morceaux
			"retrait":
				return _planche.retrait
			"aretes":
				return _planche.aretes
	return super(methode, entree)


## Le paramètre `cle` de la partie de la planche (son `scenario`), sinon celui du lancement (`PontDuNoyau.parametre`).
func parametre(cle: String) -> String:
	return str(_planche.parametres[cle]) if _planche.get("parametres", {}).has(cle) else super(cle)


func publier_l_ecran(publie: Callable) -> void:
	super(publie)
	_publier_la_planche_montree(false)
	_calme.start(CALME_S)


func _constater_le_calme() -> void:
	if StudioDePortraits.au_repos():
		_publier_la_planche_montree(true)
	else:
		_calme.start(CALME_S)


func _publier_la_planche_montree(montree: bool) -> void:
	_transport.publier("wfrpPlancheMontree", _nom if montree else null)
