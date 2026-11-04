## Le combat, hôte du noyau (`hotes/godot/pont/CONTRAT.md`), et le seul lecteur de la vue : il démarre la partie de
## l'adresse de la page (`?scenario=<id>&graine=<n>`) et applique chaque suite. La vue va au plateau, et chaque zone de
## l'écran (`Zone.racines`, scène `Ecran` sans script) reçoit les éléments de sa source (`vue.zones`, et ce que la
## suite ajoute, `zones` : les lignes du journal) ; le journal va au plateau ; chaque jeton programmé est armé
## en minuteur et repris à son échéance. Chaque geste du joueur part en intention : celle de l'élément pressé
## (`Zone.geste`), ou un clic du champ (`vue.champ` : le verbe qui désigne un combattant, celui qui désigne une case ;
## `null`, le champ ne se clique pas), le combattant d'une case lu dans `vue.occupants`. Un refus se dit ; l'écran
## reste tel quel, saisies comprises. Chaque vue montrée, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`),
## que la recette lit.
extends Node

@onready var _plateau: Plateau = $Plateau
@onready var _ecran: Node = $Ecran
@onready var _refus: Label = $Ecran/Interface/Avis/Refus
@onready var _panne: Label = $Ecran/Interface/Avis/Panne
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _vue: Dictionary = {}
var _zones: Array[Zone] = []


func _ready() -> void:
	_zones = Zone.racines(_ecran)
	for zone in _zones:
		zone.geste.connect(_jouer)
	_plateau.case_cliquee.connect(_cliquer)
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	var entree := {scenario = _pont.parametre("scenario")}
	var graine := _pont.parametre("graine")
	if graine.is_valid_int():
		entree.graine = graine.to_int()
	_suivre(_pont.appeler("demarrer", entree))


func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler("jouer", jeu))


func _reprendre(jeton: int) -> void:
	_suivre(_pont.appeler("reprendre", {jeton = jeton}))


## Une `Suite` du contrat : sa vue montrée, son journal écrit, ses jetons armés.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_vue = reponse.vue
	_refus.text = ""
	_plateau.montrer(_vue, reponse.journal)
	_montrer(reponse.zones)
	for programme in reponse.programmes:
		get_tree().create_timer(MiseEnPage.secondes(programme.delai)).timeout.connect(_reprendre.bind(int(programme.id)))
	_publier_l_ecran.call_deferred()


## Chaque zone de l'écran montre les éléments de sa source dans la vue, ou dans ce que la suite ajoute (`ajouts`).
func _montrer(ajouts: Dictionary) -> void:
	var sources: Dictionary = _vue.zones.merged(ajouts)
	for zone in _zones:
		zone.montrer(sources.get(zone.source, []))


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`) et le point de
## chaque case du plateau.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([_ecran]), cases = _plateau.points()})


## Un clic sur `case` : le clic du champ qui désigne son occupant s'il en a un, celui qui désigne la case sinon.
func _cliquer(case: Vector2i) -> void:
	var champ: Variant = _vue.get("champ")
	if champ == null:
		return
	var occupant: Variant = _vue.occupants.get("%d,%d" % [case.x, case.y])
	if occupant != null:
		_jouer({type = champ.combattant, args = [occupant]})
	else:
		_jouer({type = champ.case, args = [{x = case.x, y = case.y}]})
