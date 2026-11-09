## Le combat, hôte du noyau (`hotes/godot/pont/CONTRAT.md`), et le seul lecteur de la vue : il démarre la partie de
## l'adresse de la page (`?scenario=<id>&graine=<n>`), la scène que l'éditeur a mise à l'essai (`PontDuNoyau.essai`), ou,
## l'adresse n'en nommant aucun, le scénario que le joueur choisit au panneau des scénarios (`scenarios`), pose au plateau le monde de sa scène (`monde`), à nouveau chaque
## fois que la partie change de scène (`vue.projection.scene`), et applique chaque suite. La vue va au plateau, sa lumière (`vue.lumiere`) à la `Lumiere` du monde ; la fenêtre prend la disposition que la vue nomme (`vue.disposition`,
## `Disposition`) ; chaque zone de l'écran (`Zone.racines`, scène `Ecran` sans script) reçoit les éléments de sa source
## qui lui reviennent (`Zone.montrer_toutes` : `vue.zones`, et ce que la suite ajoute, `zones` : les lignes du journal) ;
## le journal va au plateau ; chaque jeton programmé est armé en minuteur et repris à son échéance. Chaque geste du joueur part en intention : celle de l'élément pressé
## (`Zone.geste` ; la fiche d'un combattant, montrée ou fermée, par la méthode `fiche` ; la création d'un héros par la
## méthode `creation`), un clic du champ (`vue.champ` : le verbe du clic, sur la case et le combattant qui s'y tient ;
## `null`, le champ ne se clique pas), ou un clic droit, qui montre la fiche du combattant de la case, le combattant
## d'une case lu dans `vue.occupants`. Une recette pose la caméra sur un cadrage (`_cadrer`). Un refus se dit ; l'écran
## reste tel quel, saisies comprises. Avant la partie, il tire le listage des modèles et l'index du pont
## (`MontageDeComposition.lister`, `indexer`), que chaque corps du plateau monte ; un échec se dit dans l'avis de panne,
## et la partie se joue sans corps. Chaque vue montrée, et chaque corps changé, il publie à la page ce que l'écran porte
## (`PontDuNoyau.publier_l_ecran`), que la recette lit. La bulle de l'aperçu (`combat.apercu`) se tient au-dessus de sa
## case.
extends Node

@onready var _plateau: Plateau = $Plateau
@onready var _lumiere: Lumiere = $Plateau/Monde/Lumiere
@onready var _ecran: Node = $Ecran
@onready var _disposition: Disposition = $Ecran/Fenetre/Disposition
@onready var _refus: Label = $Ecran/Interface/Avis/Refus
@onready var _panne: Label = $Ecran/Interface/Avis/Panne
@onready var _apercu: Control = $Ecran/Interface/Apercu
@onready var _scenarios: Control = $Scenarios/Cadre
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _vue: Dictionary = {}
## La scène et la clé du volume du monde posé au plateau, vide avant le premier.
var _cle_du_monde := ""
var _zones: Array[Zone] = []


func _ready() -> void:
	_plateau.case_cliquee.connect(_cliquer)
	_plateau.case_inspectee.connect(_inspecter)
	_plateau.habille.connect(_publier_l_ecran)
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	_pont.exposer("wfrpCadrer", _cadrer)
	await _indexer_les_modeles()
	var scenario := _pont.parametre("scenario")
	if not _pont.essai and scenario == "":
		scenario = await _choisir_un_scenario()
	var entree := {essai = true} if _pont.essai else {scenario = scenario}
	var graine := _pont.parametre("graine")
	if graine.is_valid_int():
		entree.graine = graine.to_int()
	_suivre(_pont.appeler("demarrer", entree))


## Le scénario que le joueur choisit au panneau des scénarios (`scenarios`, #3786) : l'id que porte le bouton pressé
## (`{ scenario }`), le panneau caché ensuite ; son défilement republie l'écran.
func _choisir_un_scenario() -> String:
	var zones := Zone.racines(_scenarios)
	Zone.montrer_toutes(zones, _pont.appeler("scenarios").get("zones", {}))
	var barre := (_scenarios.get_node("Defilement") as ScrollContainer).get_v_scroll_bar()
	barre.value_changed.connect(_defile)
	_scenarios.visible = true
	_publier_l_ecran.call_deferred()
	var jeu: Dictionary = await zones[0].geste
	barre.value_changed.disconnect(_defile)
	_scenarios.visible = false
	return str(jeu.scenario)


## Le listage du serveur et l'index du pont (`MontageDeComposition.lister`, `indexer`), retenu pour les corps du
## plateau ; ses erreurs, les refus de l'index et celui du pont vont à l'avis de panne.
func _indexer_les_modeles() -> void:
	var recueil: Array[String] = []
	var reponse := MontageDeComposition.indexer(_pont, await MontageDeComposition.lister(self, recueil))
	if reponse.get("ok") == true:
		MontageDeComposition.retenir_les_modeles(reponse)
		for refus in reponse.refus:
			recueil.append(str(refus))
	elif reponse.get("ok") == false:
		recueil.append(str(reponse.erreur.message))
	if not recueil.is_empty():
		_panne.text = "\n".join(PackedStringArray(recueil))


## L'intention d'un geste : la fiche que l'écran montre va à `fiche`, un geste de la création d'un héros à `creation`,
## toute autre à `jouer`.
func _jouer(jeu: Dictionary) -> void:
	_suivre(_pont.appeler("fiche" if jeu.has("fiche") else "creation" if jeu.has("creation") else "jouer", jeu))


func _reprendre(jeton: int) -> void:
	_suivre(_pont.appeler("reprendre", {jeton = jeton}))


## Une `Suite` du contrat : sa vue montrée, ses effets rendus, son journal écrit, ses jetons armés.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_vue = reponse.vue
	_refus.text = ""
	_poser_le_monde_de(_vue.projection.scene, _vue.plateau)
	_plateau.montrer(_vue)
	_plateau.jouer_les_effets(reponse.effets)
	if _vue.lumiere != null:
		_lumiere.eclairer(_vue.lumiere, _vue.plateau.metresParCase)
	if _disposition.disposer(_vue.disposition):
		_relier()
	Zone.montrer_toutes(_zones, _vue.zones.merged(reponse.zones))
	for programme in reponse.programmes:
		get_tree().create_timer(MiseEnPage.secondes(programme.delai)).timeout.connect(_reprendre.bind(int(programme.id)))
	_publier_l_ecran.call_deferred()


## Le monde de la scène `scene` (`vue.projection.scene`), sous le regard du plateau (`plateau.cleDuMonde`), au plateau
## (`Plateau.poser_le_monde`), s'il n'y est pas déjà.
func _poser_le_monde_de(scene: Variant, plateau: Variant) -> void:
	var cle := "" if scene == null or plateau == null else "%s|%s" % [scene.id, plateau.cleDuMonde]
	if cle == _cle_du_monde:
		return
	_cle_du_monde = cle
	var monde := _pont.appeler("monde")
	if monde.get("ok") == true and monde.monde != null:
		_plateau.poser_le_monde(monde)


## La bulle de l'aperçu suit sa case à l'écran, la caméra tournée ou zoomée.
func _process(_delta: float) -> void:
	var point: Variant = _plateau.point_de_l_apercu()
	if _apercu.visible and point != null:
		_apercu.position = MiseEnPage.bulle_au_dessus(point, _apercu.size.x, _apercu.size.y)


## Les zones de l'écran, la disposition posée : chacune relie son geste au jeu ; chaque défilement republie l'écran, ses
## boutons à l'écran changeant avec lui.
func _relier() -> void:
	_zones = Zone.racines(_ecran)
	for zone in _zones:
		if not zone.geste.is_connected(_jouer):
			zone.geste.connect(_jouer)
	for defilement in _ecran.find_children("*", "ScrollContainer", true, false):
		var barre := (defilement as ScrollContainer).get_v_scroll_bar()
		if not barre.value_changed.is_connected(_defile):
			barre.value_changed.connect(_defile)


func _defile(_valeur: float) -> void:
	_publier_l_ecran()


## Ce que l'écran porte, une fois la vue mise en page : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), le point de
## chaque case du plateau, ce que porte le corps de chaque combattant dessiné (`Plateau.corps`) et les navires posés
## (`Plateau.navires`).
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	_pont.publier_l_ecran({boutons = PontDuNoyau.boutons_a_l_ecran([_ecran, _scenarios]), cases = _plateau.points(), corps = _plateau.corps(), navires = _plateau.navires()})


## Le cadrage d'une recette (`globalThis.wfrpCadrer(entree, rendre)`, `CONTRAT.md`, section « Écran publié ») : `entree`,
## un cadrage en JSON, sous le regard de la partie (`Plateau.cadrer`) ; la caméra posée et deux images dessinées, `rendre`
## reçoit la réponse en JSON : `{ ok: true, camera }` (`Plateau.camera`), ou
## `{ ok: false, erreur: { categorie: "validation", message } }`.
func _cadrer(args: Array) -> void:
	var cadrage: Variant = JSON.parse_string(str(args[0]))
	var refus := _plateau.cadrer(cadrage) if cadrage is Dictionary else "cadrage illisible : %s" % args[0]
	var reponse := {ok = refus == ""}
	if refus == "":
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		reponse.camera = _plateau.camera()
	else:
		reponse.erreur = {categorie = "validation", message = refus}
	(args[1] as JavaScriptObject).call("call", null, JSON.stringify(reponse))


## La touche du regard (`changer_de_regard`) passe au regard suivant (`regarder`, `plateau.regardSuivant`).
func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("changer_de_regard") and _vue.get("plateau") != null:
		get_viewport().set_input_as_handled()
		_suivre(_pont.appeler("regarder", {regard = _vue.plateau.regardSuivant}))


## Un clic sur `case` : le clic du champ sur la case, et sur son occupant s'il en a un.
func _cliquer(case: Vector3i) -> void:
	var champ: Variant = _vue.get("champ")
	if champ == null:
		return
	var args: Array = [{x = case.x, y = case.y} if case.z == 0 else {x = case.x, y = case.y, z = case.z}]
	var occupant: Variant = _vue.occupants.get("%d,%d,%d" % [case.x, case.y, case.z])
	if occupant != null:
		args.append(occupant)
	_jouer({type = champ, args = args})


## Un clic droit sur `case` : la fiche du combattant qui s'y tient, s'il y en a un.
func _inspecter(case: Vector3i) -> void:
	var occupant: Variant = _vue.occupants.get("%d,%d,%d" % [case.x, case.y, case.z])
	if occupant != null:
		_jouer({fiche = {porteur = occupant}})
