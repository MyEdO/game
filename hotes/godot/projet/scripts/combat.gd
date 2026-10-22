## Le combat, hôte du noyau (`hotes/godot/pont/CONTRAT.md`) : il démarre la partie de l'adresse de la page
## (`?scenario=<id>&graine=<n>`), applique chaque suite (la vue au plateau, à l'interface et à la fenêtre, le journal
## au plateau et à l'interface, chaque jeton programmé armé en minuteur et repris à son échéance), et rend chaque geste
## du joueur en intention : une offre de la vue, un verbe de la fenêtre, ou un clic du champ (`vue.champ`). Chaque vue
## montrée, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), que la recette lit.
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
	_pont.refus.connect(func(erreur: Dictionary) -> void: _interface.afficher_refus("%s : %s" % [erreur.categorie, erreur.message]))
	_pont.panne.connect(_interface.afficher_panne)
	if not _pont.est_web:
		_interface.afficher_panne("Cet hôte joue dans une page : son pont est `wfrp-pont.js` (export Web).")
		return
	if not _pont.est_pret():
		await _pont.pret
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
	_fenetre.montrer(_vue)
	for programme in reponse.programmes:
		get_tree().create_timer(programme.delai / 1000.0).timeout.connect(_reprendre.bind(int(programme.id)))
	_publier_l_ecran.call_deferred(int(_vue.projection.pas))


## Ce que l'écran porte, une fois la vue `pas` mise en page : chaque bouton actif (son texte, son centre) et le point de
## chaque case du plateau.
func _publier_l_ecran(pas: int) -> void:
	await get_tree().process_frame
	var boutons := []
	for racine in [_interface, _fenetre]:
		for bouton in racine.find_children("*", "BaseButton", true, false):
			if bouton.is_visible_in_tree() and not bouton.disabled:
				var centre: Vector2 = bouton.get_global_rect().get_center()
				boutons.append({texte = bouton.text, x = centre.x, y = centre.y})
	_pont.publier_l_ecran({pas = pas, boutons = boutons, cases = _plateau.points()})


## Un clic sur `case` : celui de son occupant s'il en a un, celui de la case sinon, chacun par le clic du champ dont le
## premier paramètre a la forme de ce qu'il désigne (un id, une case).
func _cliquer(case: Vector2i) -> void:
	var combat: Variant = _vue.get("projection", {}).get("combat")
	if combat == null or combat.barre.forme != "ouverte":
		return
	var occupant := ""
	for c in combat.voisins.liste:
		if c.pos != null and not c.horsCombat and Vector2i(int(c.pos[0]), int(c.pos[1])) == case:
			occupant = c.id
	if occupant != "":
		_jouer_le_champ("chaine", occupant)
	else:
		_jouer_le_champ("objet", {x = case.x, y = case.y})


func _jouer_le_champ(genre: String, valeur: Variant) -> void:
	for verbe in _vue.champ:
		var parametres: Array = _vue.parametres.get(verbe, [])
		if not parametres.is_empty() and parametres[0].forme.genre == genre:
			_jouer({type = verbe, args = [valeur]})
			return
