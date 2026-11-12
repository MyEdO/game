## Le combat, hôte du noyau (`hotes/godot/pont/CONTRAT.md`), et le seul lecteur de la vue : il ouvre une partie au
## groupe (`ouvrir`, `PontDuNoyau.au_groupe`), que le joueur compose puis lance sur une campagne du jeu (`lancer`),
## charge une sauvegarde (`charger`, `PontDuNoyau.a_charger`) ou montre celles à charger (`PontDuNoyau.reprise`), ou démarre la partie des
## paramètres `scenario` et `graine` (`PontDuNoyau.parametre`), la scène que l'éditeur a mise à l'essai (`PontDuNoyau.essai`), ou,
## sans paramètre `scenario`, le scénario que le joueur choisit au panneau des scénarios (`scenarios`), pose au plateau le monde de sa scène (son manifeste,
## `monde`, et les seuls morceaux dont l'empreinte a bougé, `morceaux`), à nouveau chaque fois que la partie change de
## scène (`vue.projection.scene`) ou que sa clé change (`plateau.cleDuMonde`), ce que le regard en retire (`retrait`), à
## nouveau chaque fois que l'empreinte du masque change (`plateau.cleDuRetrait`), ce que le groupe en connaît
## (`vision`, `VolumeDeScene.voir`), à nouveau chaque fois que sa clé change (`vue.vision`), la première vision d'une
## scène posée sans fondu depuis celle de la scène d'avant, et ses arêtes (`aretes`), à nouveau
## chaque fois que leur empreinte change (`plateau.cleDesAretes`), et applique chaque suite. La vue va au plateau, sa lumière (`vue.lumiere`) à la `Lumiere` du monde, sa musique (`vue.musique`) à la `Musique` ; la fenêtre prend la disposition que la vue nomme (`vue.disposition`,
## `Disposition`) ; chaque zone de l'écran (`Zone.racines`, scène `Ecran` sans script) reçoit les éléments de sa source
## qui lui reviennent (`Zone.montrer_toutes` : `vue.zones`, et ce que les suites ont ajouté depuis le début de la
## partie, `zones` : les lignes du journal, qu'une zone posée plus tard reçoit donc toutes) ;
## le journal va au plateau ; chaque jeton programmé est armé en minuteur et repris à son échéance. Chaque geste du joueur part en intention : celle de l'élément pressé
## (`Zone.geste` ; la fiche d'un combattant, montrée ou fermée, par la méthode `fiche` ; la création d'un héros par la
## méthode `creation`), un clic du champ (`vue.champ` : le verbe du clic, sur la case et le combattant qui s'y tient ;
## `null`, le champ ne se clique pas), ou un clic droit, qui montre la fiche du combattant de la case, le combattant
## d'une case lu dans `vue.occupants`. Une recette pose la caméra sur un cadrage (`_cadrer`). Un refus se dit ; l'écran
## reste tel quel, saisies comprises. Avant la partie, il tire le listage des modèles et l'index du pont
## (`MontageDeComposition.lister`, `indexer`), que chaque corps du plateau monte ; un échec se dit dans l'avis de panne,
## et la partie se joue sans corps. Chaque vue montrée, chaque corps changé, chaque défilement, chaque onglet et chaque
## cadrage du monde, il publie ce que l'écran porte (`PontDuNoyau.publier_l_ecran`), une fois par image, que la
## recette lit ; hors recette, rien. La bulle de l'aperçu
## (`combat.apercu`) se tient au-dessus de sa case. Le monde se cadre sur la scène (`Monde.cadre`), la part de l'écran que
## l'interface lui laisse.
extends Node

## @contrat L'écran de Godot
## Le routeur `projet/scripts/combat.gd` est le seul script qui lit la vue et le seul qui appelle le pont. L'écran est
## une scène sans script (`projet/scenes/Ecran.tscn`) : chaque zone y est un nœud `Zone` (`projet/scripts/zone.gd`) posé
## dans le conteneur qui la montre, sa `source` une clé de `vue.zones` ou des `zones` de la suite, qu'elle ajoute
## (`ajout`) au lieu de les remplacer. Une zone dessine chaque élément par le composant de son type
## (`projet/composants/<type>.tscn`, une scène sans script), ou par celui qu'elle donne à ce type à cet usage
## (`formes`, `<type>:<forme>` : `projet/composants/<forme>.tscn`), le réconcilie par type et par id, et le pose sur son
## composant : chaque `Liaison` y écrit un champ de l'élément dans une propriété du contrôle qui la porte (le ton en
## variation du thème, `art/theme.tres`), chaque `Geste` joue l'intention que l'élément porte par le signal `geste` de
## la zone (un bouton à bascule garde l'état que la vue lui donne ; le routeur envoie `{ fiche }` à `fiche`, `{ creation
## }` à `creation`, `{ roster }` à `roster`, `{ lancer }` à `lancer`, `{ quitter }` à `quitter`, d'où il revient à l'accueil, `{ sauvegardes }`
## au panneau des sauvegardes (`sauvegardes`), `{ reglages }` au panneau des réglages (`reglages`,
## `projet/scripts/reglages.gd`), `{ sauvegarder }` à `sauvegarder`, `{ charger }` à `charger`, la partie
## ouverte quittée d'abord et le combat rechargé, toute autre intention à `jouer`), chaque `Saisie` lit la valeur d'un formulaire, et une zone
## imbriquée y montre le champ que sa `source` nomme. L'icône (`icone`) et le fond (`fond`) ne portent que l'id de
## leur dessin : `Dessin` (`projet/scripts/dessin.gd`) le lit au catalogue que la construction dépose une fois dans le
## projet (`art/dessins.json`, `hotes/godot/asset/dessins.ts`) et le trace aux couleurs du thème. Le plan (`plan`) est le seul composant qui se dessine : son
## contrôle `Plan` (`projet/scripts/plan.gd`) trace chaque trait d'un point à l'autre et chaque point à sa place dans le
## contrôle, chacun à la couleur de son ton, et pose sous chaque point son composant (`point` : son nom, puis ses
## éléments). Le `detail` d'une puce ou d'une ligne se pose sur sa `Bulle` (`projet/scripts/bulle.gd`), qui couvre le
## composant et montre au survol la bulle du thème repliée au mot. Les héros du groupe se rangent en cartes au pied de
## l'écran (`projet/composants/heros.tscn` : le portrait, le nom, les Blessures en trait, la bourse, puis ce que la
## carte porte d'autre), « Quitter la partie » et « Nouveau héros » au pied du journal ; avant le lancement, les
## pré-tirés à recruter et les campagnes à lancer se rangent en deux colonnes sur la scène ; la barre du combat (`combat.offres`) les surmonte, chacun de ses choix
## en onglet, sauf la part du tour (`economie/aucun`), au panneau de l'actif ; la création ouverte se pose au centre,
## sa page titrée en tête, ses rubriques défilant dessous, ses gestes en rangée au pied ; la conversation se pose en bas
## au centre, son interlocuteur en titre, sa réplique, puis ses réponses l'une sous l'autre ; la fiche ouverte se pose
## à gauche de la scène, qu'elle rétrécit, en statbloc au thème `art/statbloc.tres` (papier, encre), chaque section en
## onglet, la possession choisie et ses gestes sous ses sections.
## Un clic droit sur une case occupée ouvre la fiche de son occupant (`case_inspectee`, `projet/scripts/plateau.gd`). Un
## refus se dit au-dessus de l'écran, qui reste tel quel, saisies comprises. Changer l'écran, c'est éditer ces scènes ;
## un type d'élément nouveau, c'est un composant.

@onready var _plateau: Plateau = $Plateau
@onready var _lumiere: Lumiere = $Plateau/Monde/Lumiere
@onready var _ecran: Node = $Ecran
@onready var _monde: Monde = $Plateau/Monde
@onready var _scene: Control = $Ecran/Interface/Ossature/Colonne/Milieu/Scene
@onready var _disposition: Disposition = $Ecran/Interface/Ossature/Colonne/Milieu/Scene/Disposition
@onready var _refus: Label = $Ecran/Interface/Avis/Refus
@onready var _panne: Label = $Ecran/Interface/Avis/Panne
@onready var _apercu: Control = $Ecran/Interface/Apercu
@onready var _scenarios: Control = $Scenarios/Cadre
@onready var _sauvegardes: Control = $Sauvegardes/Cadre
@onready var _reglages: PanneauDesReglages = $Reglages
@onready var _pont: PontDuNoyau = get_node("/root/Pont")

var _vue: Dictionary = {}
var _musique := Musique.new()
## La scène et la clé du volume du monde posé au plateau, vide avant le premier.
var _cle_du_monde := ""
## La scène et l'empreinte du masque du retrait posé au volume (`plateau.cleDuRetrait`), vide avant le premier.
var _cle_du_retrait := ""
## La scène et la clé de la vision posée au volume (`vue.vision`), vide avant la première.
var _cle_de_la_vision := ""
## La scène et l'empreinte des arêtes posées au plateau (`plateau.cleDesAretes`), vide avant les premières.
var _cle_des_aretes := ""
var _zones: Array[Zone] = []
## Ce que les suites ont ajouté à l'écran depuis le début de la partie (`zones`), par source : une zone posée en
## cours de partie (`Disposition`) le reçoit en entier.
var _ajouts := {}
## Une publication de l'écran attend l'image qui vient (`_publier_l_ecran`).
var _publication_prevue := false


func _ready() -> void:
	_musique.name = "Musique"
	add_child(_musique)
	_plateau.case_cliquee.connect(_cliquer)
	_plateau.case_inspectee.connect(_inspecter)
	_plateau.habille.connect(_publier_l_ecran)
	_pont.suivre_les_listes(_ecran, _publier_l_ecran)
	_monde.cadrage_change.connect(_recadrer)
	_scene.resized.connect(func() -> void: _monde.cadre = _scene.get_global_rect())
	if not await _pont.rejoindre(func(texte: String) -> void: _refus.text = texte, func(texte: String) -> void: _panne.text = texte):
		return
	_pont.exposer("wfrpCadrer", _cadrer)
	await _indexer_les_modeles()
	for zone in Zone.racines(_sauvegardes):
		zone.geste.connect(_jouer)
	_reglages.change.connect(_publier_l_ecran)
	var entree := {}
	var graine := _pont.parametre("graine")
	if graine.is_valid_int():
		entree.graine = graine.to_int()
	if _pont.a_charger != null:
		var reponse := _pont.appeler("charger", entree.merged({charger = _pont.a_charger}))
		_pont.a_charger = null
		_suivre(reponse)
		if reponse.get("ok") != true:
			_montrer_les_sauvegardes(_pont.appeler("sauvegardes"))
		return
	if _pont.reprise:
		_montrer_les_sauvegardes(_pont.appeler("sauvegardes"))
		return
	if _pont.au_groupe:
		_suivre(_pont.appeler("ouvrir", entree))
		return
	var scenario := _pont.parametre("scenario")
	if not _pont.essai and scenario == "":
		scenario = await _choisir_un_scenario()
	_suivre(_pont.appeler("demarrer", entree.merged({essai = true} if _pont.essai else {scenario = scenario})))


## Le scénario que le joueur choisit au panneau des scénarios (`scenarios`, #3786) : l'id que porte le bouton pressé
## (`{ scenario }`), le panneau caché ensuite ; son défilement republie l'écran.
func _choisir_un_scenario() -> String:
	var zones := Zone.racines(_scenarios)
	Zone.montrer_toutes(zones, _pont.appeler("scenarios").get("zones", {}))
	var barre := (_scenarios.get_node("Defilement") as ScrollContainer).get_v_scroll_bar()
	barre.value_changed.connect(_republier)
	_scenarios.visible = true
	_publier_l_ecran.call_deferred()
	var jeu: Dictionary = await zones[0].geste
	barre.value_changed.disconnect(_republier)
	_scenarios.visible = false
	return str(jeu.scenario)


## Le listage du serveur et l'index du pont, retenu pour les corps du plateau (`MontageDeComposition.indexer_les_modeles`) ;
## ses erreurs, les refus de l'index et celui du pont vont à l'avis de panne.
func _indexer_les_modeles() -> void:
	var recueil: Array[String] = await MontageDeComposition.indexer_les_modeles(self)
	if not recueil.is_empty():
		_panne.text = "\n".join(PackedStringArray(recueil))


## L'intention d'un geste : la fiche que l'écran montre va à `fiche`, un geste de la création d'un héros à `creation`,
## un geste sur le roster de l'hôte à `roster` (`_jouer_le_roster`), la campagne à lancer à `lancer`, la partie à quitter à `quitter` (`_quitter`), le panneau des sauvegardes à ouvrir à
## `sauvegardes` ou à fermer (`_fermer_les_sauvegardes`), l'emplacement où écrire à `sauvegarder`, celui à charger à
## `_charger`, le panneau des réglages à ouvrir à `PanneauDesReglages.ouvrir`, toute autre à `jouer`.
func _jouer(jeu: Dictionary) -> void:
	if jeu.has("quitter"):
		_quitter()
		return
	if jeu.has("sauvegardes"):
		if jeu.sauvegardes:
			_montrer_les_sauvegardes(_pont.appeler("sauvegardes"))
		else:
			_fermer_les_sauvegardes()
		return
	if jeu.has("sauvegarder"):
		_montrer_les_sauvegardes(_pont.appeler("sauvegarder", jeu))
		return
	if jeu.has("reglages"):
		_reglages.ouvrir()
		return
	if jeu.has("charger"):
		_charger(jeu.charger)
		return
	if jeu.has("roster"):
		_jouer_le_roster(jeu)
		return
	_suivre(_pont.appeler("fiche" if jeu.has("fiche") else "creation" if jeu.has("creation") else "lancer" if jeu.has("lancer") else "jouer", jeu))


## Un geste sur le roster de l'hôte (`roster`), sa suite suivie : le fichier qu'elle porte (`fichier`) est remis au
## joueur ; le choix qu'elle demande (`choix`) est fait par le joueur, et le texte du fichier choisi revient au pont
## (`{ importe }`, `null` s'il renonce).
func _jouer_le_roster(jeu: Dictionary) -> void:
	var reponse := _pont.appeler("roster", jeu)
	_suivre(reponse)
	if reponse.has("fichier"):
		_pont.enregistrer_un_fichier(PontDuNoyau.HEROS, reponse.fichier.nom, reponse.fichier.texte)
	if reponse.has("choix"):
		var choisi := await _pont.choisir_un_fichier(PontDuNoyau.HEROS)
		_suivre(_pont.appeler("roster", {roster = {importe = choisi.octets.get_string_from_utf8() if choisi.has("octets") else null}}))


## La partie quittée (`quitter`) : l'accueil revient, d'où une autre s'ouvre ; un refus laisse l'écran tel quel.
func _quitter() -> void:
	if _pont.appeler("quitter").get("ok") != true:
		return
	_revenir_a_l_accueil()


## L'accueil revient, plus rien ne disant au combat comment s'ouvrir.
func _revenir_a_l_accueil() -> void:
	_pont.au_groupe = false
	_pont.essai = false
	_pont.reprise = false
	get_tree().change_scene_to_file("res://scenes/Accueil.tscn")


## Le panneau des sauvegardes montre les zones de `reponse` (`sauvegardes`, `sauvegarder`) ; une réponse refusée le
## laisse tel quel, le refus dit à l'avis.
func _montrer_les_sauvegardes(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	Zone.montrer_toutes(Zone.racines(_sauvegardes), reponse.zones)
	_sauvegardes.visible = true
	_publier_l_ecran.call_deferred()


## Le panneau des sauvegardes fermé : sur la partie ouverte, ou, sans partie, sur l'accueil.
func _fermer_les_sauvegardes() -> void:
	if _vue.is_empty():
		_revenir_a_l_accueil()
		return
	_sauvegardes.visible = false
	_publier_l_ecran.call_deferred()


## La sauvegarde de l'emplacement `emplacement` à charger : la partie ouverte quittée (`quitter`, son point de reprise
## gardé), le combat se recharge et l'ouvre (`PontDuNoyau.a_charger`), son monde reposé de zéro.
func _charger(emplacement: Variant) -> void:
	if not _vue.is_empty() and _pont.appeler("quitter").get("ok") != true:
		return
	_pont.au_groupe = false
	_pont.essai = false
	_pont.reprise = false
	_pont.a_charger = emplacement
	get_tree().reload_current_scene()


func _reprendre(jeton: int) -> void:
	_suivre(_pont.appeler("reprendre", {jeton = jeton}))


## Une `Suite` du contrat : sa vue montrée, ses effets rendus, sa musique jouée, son journal écrit, ses jetons armés.
func _suivre(reponse: Dictionary) -> void:
	if reponse.get("ok") != true:
		return
	_vue = reponse.vue
	_refus.text = ""
	_poser_le_monde_de(_vue.projection.scene, _vue.plateau)
	_poser_le_retrait_de(_vue.projection.scene, _vue.plateau)
	_poser_la_vision_de(_vue.projection.scene, _vue.vision)
	_poser_les_aretes_de(_vue.projection.scene, _vue.plateau)
	_plateau.montrer(_vue)
	_plateau.jouer_les_effets(reponse.effets)
	if _vue.lumiere != null:
		_lumiere.eclairer(_vue.lumiere, _vue.plateau.metresParCase)
	_musique.jouer(_vue.musique)
	if _disposition.disposer(_vue.disposition):
		_relier()
	Portrait.corps = _vue.corps.combattants
	for source in reponse.zones:
		_ajouts.get_or_add(source, []).append_array(reponse.zones[source])
	Zone.montrer_toutes(_zones, _vue.zones.merged(_ajouts))
	for programme in reponse.programmes:
		get_tree().create_timer(MiseEnPage.secondes(programme.delai)).timeout.connect(_reprendre.bind(int(programme.id)))
	_publier_l_ecran.call_deferred()


## Le monde de la scène `scene` (`vue.projection.scene`), sous le regard du plateau (`plateau.cleDuMonde`), au plateau
## (`Plateau.poser_le_monde`), s'il n'y est pas déjà : son manifeste (`monde`), et la géométrie des seules clés dont
## l'empreinte posée diffère (`VolumeDeScene.manquants`, `morceaux` de la partie), demandée s'il en manque.
func _poser_le_monde_de(scene: Variant, plateau: Variant) -> void:
	var cle := "" if scene == null or plateau == null else "%s|%s" % [scene.id, plateau.cleDuMonde]
	if cle == _cle_du_monde:
		return
	_cle_du_monde = cle
	var monde := _pont.appeler("monde")
	if monde.get("ok") != true or monde.monde == null:
		return
	var manquants := _monde.volume.manquants(monde)
	var recus := {volume = [], toits = [], couronnes = []}
	if not manquants.values().all(func(cles: Array) -> bool: return cles.is_empty()):
		recus = _pont.appeler("morceaux", manquants.merged({source = "partie"}))
		if recus.get("ok") != true:
			return
	_plateau.poser_le_monde(monde, recus)


## Ce que le regard de la partie retire du volume du monde (`retrait`) masqué au volume (`VolumeDeScene.retirer`), si le
## masque de son empreinte (`plateau.cleDuRetrait`) n'y est pas déjà.
func _poser_le_retrait_de(scene: Variant, plateau: Variant) -> void:
	_cle_du_retrait = _reposer(_cle_du_retrait, scene, null if plateau == null else plateau.cleDuRetrait, "retrait", _monde.volume.retirer)


## Ce que le groupe connaît de la scène `scene` (`vision`) voilé au volume (`VolumeDeScene.voir`), si la vision de sa clé
## (`vue.vision`) n'y est pas déjà ; la première d'une scène posée sans fondu, la vision de la scène d'avant levée.
func _poser_la_vision_de(scene: Variant, vision: Variant) -> void:
	var avant := _cle_de_la_vision
	_cle_de_la_vision = _reposer(avant, scene, vision, "vision", func(reponse: Dictionary) -> void:
		if not avant.begins_with("%s|" % scene.id):
			_monde.volume.voir(null)
		_monde.volume.voir(reponse))


## La réponse de la méthode `methode` du pont posée par `poser`, si l'empreinte `empreinte` de la scène `scene` n'est pas
## celle de la clé `cle` déjà posée : rend la clé `scène|empreinte` de ce qui est posé, `""` sans scène ni empreinte,
## sans rien demander.
func _reposer(cle: String, scene: Variant, empreinte: Variant, methode: String, poser: Callable) -> String:
	var neuve := "" if scene == null or empreinte == null else "%s|%s" % [scene.id, empreinte]
	if neuve != cle and neuve != "":
		var reponse := _pont.appeler(methode)
		if reponse.get("ok") == true:
			poser.call(reponse)
	return neuve


## Les arêtes de la scène `scene` (`aretes`) sur le volume du monde (`VolumeDeScene.poser_les_aretes`), si celles de
## leur empreinte (`plateau.cleDesAretes`) n'y sont pas déjà.
func _poser_les_aretes_de(scene: Variant, plateau: Variant) -> void:
	_cle_des_aretes = _reposer(_cle_des_aretes, scene, null if plateau == null else plateau.cleDesAretes, "aretes", func(reponse: Dictionary) -> void:
		_monde.volume.poser_les_aretes(reponse.aretes))


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
	for defilement: ScrollContainer in _ecran.find_children("*", "ScrollContainer", true, false):
		for barre: ScrollBar in [defilement.get_v_scroll_bar(), defilement.get_h_scroll_bar()]:
			if not barre.value_changed.is_connected(_republier):
				barre.value_changed.connect(_republier)
	for onglets in _ecran.find_children("*", "TabContainer", true, false):
		if not (onglets as TabContainer).tab_changed.is_connected(_republier):
			(onglets as TabContainer).tab_changed.connect(_republier)


## Le monde recadré : l'écran republié, une fois la partie montrée.
func _recadrer() -> void:
	if not _vue.is_empty():
		_publier_l_ecran()


## L'écran republié quand ce qu'il montre change sans vue : un défilement, un onglet.
func _republier(_valeur: Variant) -> void:
	_publier_l_ecran()


## L'écran publié à la recette (`PontDuNoyau.publier_l_ecran`, `_ecran_publie`), une fois la vue mise en page, une
## fois par image ; rien si le combat a quitté l'arbre avant cette image (la partie quittée, une sauvegarde chargée).
func _publier_l_ecran() -> void:
	if _publication_prevue:
		return
	_publication_prevue = true
	await get_tree().process_frame
	_publication_prevue = false
	if is_inside_tree():
		_pont.publier_l_ecran(_ecran_publie)


## Ce que l'écran porte : ses boutons (`PontDuNoyau.boutons_a_l_ecran`), le point de chaque case du plateau, si la
## caméra glisse (`Monde.glisse`), la part de l'écran où le monde se voit (`Monde.cadre`), ce que porte le corps de
## chaque combattant dessiné (`Plateau.corps`) et les navires posés (`Plateau.navires`).
func _ecran_publie() -> Dictionary:
	var cadre := _monde.cadre
	return {
		boutons = PontDuNoyau.boutons_a_l_ecran([_ecran, _scenarios, _sauvegardes, _reglages.racine()]), cases = _plateau.points(),
		glisse = _monde.glisse(),
		cadre = [cadre.position.x, cadre.position.y, cadre.size.x, cadre.size.y], corps = _plateau.corps(), navires = _plateau.navires(),
	}


## Le cadrage d'une recette (`globalThis.wfrpCadrer(entree, rendre)`, `CONTRAT.md`, section « Écran publié ») : `entree`,
## un cadrage en JSON, sous le regard de la partie (`Plateau.cadrer`) ; la caméra posée et deux images dessinées, `rendre`
## reçoit la réponse en JSON : `{ ok: true, camera }` (`Plateau.camera`), ou
## `{ ok: false, erreur: { categorie: "validation", message } }`.
func _cadrer(entree: String, rendre: Callable) -> void:
	var cadrage: Variant = JSON.parse_string(entree)
	var refus := _plateau.cadrer(cadrage) if cadrage is Dictionary else "cadrage illisible : %s" % entree
	var reponse := {ok = refus == ""}
	if refus == "":
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		reponse.camera = _plateau.camera()
	else:
		reponse.erreur = {categorie = "validation", message = refus}
	rendre.call(JSON.stringify(reponse))


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
