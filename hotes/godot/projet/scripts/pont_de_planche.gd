## Le pont d'une planche (#3935) : il rend à chaque méthode la réponse que la planche enregistre sous son nom
## (`Planche`, `hotes/godot/recettes/ecran.ts`), et une méthode qu'elle n'enregistre pas est une panne. Le combat
## (`combat.gd`) montre alors cet état comme une partie qu'il démarre, sans la jouer. Avant la planche lue, toute méthode
## va au pont du noyau.
class_name PontDePlanche
extends PontDuNoyau

## @contrat Écran publié
## Une planche est un état de partie figé par le pont, déposé dans l'export (`construire.mjs --export`) sous
## `planches/<nom>.json` (ses réponses propres, `reponses`), les réponses que partagent les planches de son scénario
## sous `planches/communes/<scenario>.json`. Le pont de la planche rend à chaque méthode la réponse enregistrée sous son
## nom, à toute entrée ; une méthode sans réponse enregistrée est une panne (`PontDuNoyau.panne`, une erreur de la page),
## jamais une question au pont du noyau. L'adresse `?planche=<nom>`
## l'ouvre à la place du menu d'entrée : le combat la montre par son routeur, comme la partie de `?scenario=` qu'il
## démarre, et un geste qu'on y presse est une panne, la planche ne servant pas les gestes. `&monde=sans` ne dessine
## pas le monde 3D sous l'écran (`Viewport.disable_3d`) : l'image ne dépend alors que de l'interface. Godot publie à la
## page `globalThis.wfrpPlancheMontree`, le nom de la planche une fois son écran publié et ses portraits pris (`CALME_S`
## sans écran neuf), `null` tant qu'elle ne l'est pas. Godot expose aussi à la page
## `globalThis.wfrpMontrerLaPlanche(nom, rendre)` (`PontDuNoyau.exposer`) : l'écran à l'écran retiré, `rendre` reçoit
## `""` et la planche `nom` est montrée dans le jeu déjà lancé par le même chemin que `?planche=<nom>`,
## `wfrpPlancheMontree` passé à `null` dès la demande puis à `nom` une fois montrée. Le banc des étalons
## (`hotes/godot/etalons.mjs`) les lit.

const DOSSIER := "planches"
const COMBAT := "res://scenes/Combat.tscn"
## Le dossier des polices de l'hôte (`art/police.tres`).
const POLICES := "res://polices"
## Le temps sans écran publié (s) après lequel la planche est dite montrée, ses portraits pris.
const CALME_S := 0.5

var _nom := ""
var _parametres := {}
## Les réponses de la planche par méthode, vides avant la planche lue.
var _reponses := {}
var _calme := Timer.new()


func _ready() -> void:
	super()
	_calme.one_shot = true
	add_child(_calme)
	_calme.timeout.connect(_constater_le_calme)
	exposer("wfrpMontrerLaPlanche", _demander)
	_publier_la_planche_montree(false)
	_montrer(parametre("planche"))


## La planche `nom` montrée à la demande de la page, l'écran de la précédente retiré avant qu'elle soit lue, et les
## glyphes que ses polices ont rastérisés oubliés : rangés dans l'ordre où l'écran d'avant les a demandés, ils
## dessineraient le texte autrement que dans un jeu neuf.
func _demander(nom: String, rendre: Callable) -> void:
	_calme.stop()
	_publier_la_planche_montree(false)
	get_tree().unload_current_scene()
	for police in ResourceLoader.list_directory(POLICES):
		if police.ends_with(".ttf"):
			(load(POLICES.path_join(police)) as FontFile).clear_cache()
	rendre.call("")
	_montrer(nom)


## La planche `nom` lue et montrée par le combat, sans son monde 3D à `&monde=sans` ; illisible, une panne le dit et le
## menu d'entrée reste celui du jeu.
func _montrer(nom: String) -> void:
	var recueil: Array[String] = []
	var planche: Variant = JSON.parse_string((await requeter("%s/%s.json" % [DOSSIER, nom], recueil)).get_string_from_utf8())
	var communes: Variant = null
	if planche is Dictionary:
		communes = JSON.parse_string((await requeter("%s/communes/%s.json" % [DOSSIER, planche.parametres.scenario], recueil)).get_string_from_utf8())
	if not communes is Dictionary:
		_signaler("planche %s illisible : %s" % [nom, " ; ".join(recueil)])
		return
	_nom = nom
	_parametres = planche.parametres
	_reponses = planche.reponses.merged(communes)
	get_tree().root.disable_3d = parametre("monde") == "sans"
	get_tree().change_scene_to_file(COMBAT)


## La réponse de la planche à `methode`, à toute entrée ; `{}` et une panne si elle n'en enregistre pas.
func appeler(methode: String, entree: Variant = null) -> Dictionary:
	if _reponses.is_empty():
		return super(methode, entree)
	if not _reponses.has(methode):
		_signaler("planche %s : la méthode %s n'y est pas servie" % [_nom, methode])
		return {}
	return _reponses[methode]


## Le paramètre `cle` de la partie de la planche (son `scenario`), sinon celui du lancement (`PontDuNoyau.parametre`).
func parametre(cle: String) -> String:
	return str(_parametres[cle]) if _parametres.has(cle) else super(cle)


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
