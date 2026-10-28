## Le combat, hôte du noyau (`hotes/godot/pont/CONTRAT.md`) : il démarre la partie de l'adresse de la page
## (`?scenario=<id>&graine=<n>`), applique chaque suite (la vue au plateau, à l'interface et à la fenêtre, le journal
## au plateau et à l'interface, chaque jeton programmé armé en minuteur et repris à son échéance), et rend chaque geste
## du joueur en intention : une offre de la vue, un geste de la fenêtre, ou un clic du champ (`vue.champ` : le verbe qui
## désigne un combattant, celui qui désigne une case). Chaque vue montrée, il publie à la page ce que l'écran porte
## (`PontDuNoyau.publier_l_ecran`), que la recette lit.
extends Node

@onready var _plateau: Plateau = $Plateau
@onready var _interface: InterfaceDuCombat = $Interface
@onready var _fenetre: FenetreDuJeu = $Fenetre
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _vue: Dictionary = {}


func _ready() -> void:
	_plateau.case_cliquee.connect(_cliquer)
	_interface.offre_choisie.connect(func(offre: String) -> void: _jouer({offre = offre}))
	_fenetre.geste.connect(_jouer)
	if not await _pont.rejoindre(_interface.afficher_refus, _interface.afficher_panne):
		return
	var entree := {scenario = _pont.parametre("scenario")}
	var graine := _pont.parametre("graine")
	if graine.is_valid_int():
		entree.graine = graine.to_int()
	_suivre(_pont.appeler("demarrer", entree))


func _jouer(geste: Dictionary) -> void:
	_suivre(_pont.appeler("jouer", geste))


func _reprendre(jeton: int) -> void:
	_suivre(_pont.appeler("reprendre", {jeton = jeton}))


## Une `Suite` du contrat : sa vue montrée, son journal écrit, ses jetons armés.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_vue = reponse.vue
	_plateau.montrer(_vue, reponse.journal)
	_interface.montrer(_vue, reponse.journal)
	_fenetre.montrer(_vue.fenetre)
	for programme in reponse.programmes:
		get_tree().create_timer(MiseEnPage.secondes(programme.delai)).timeout.connect(_reprendre.bind(int(programme.id)))
	_publier_l_ecran.call_deferred()


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`) et le point de
## chaque case du plateau.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([_interface, _fenetre]), cases = _plateau.points()})


## Un clic sur `case` : le clic du champ qui désigne son occupant s'il en a un, celui qui désigne la case sinon.
func _cliquer(case: Vector2i) -> void:
	var combat: Variant = _vue.get("projection", {}).get("combat")
	if combat == null or combat.barre.forme != "ouverte":
		return
	for c in combat.voisins.liste:
		if c.pos != null and not c.horsCombat and Vector2i(int(c.pos[0]), int(c.pos[1])) == case:
			_jouer({type = _vue.champ.combattant, args = [c.id]})
			return
	_jouer({type = _vue.champ.case, args = [{x = case.x, y = case.y}]})
