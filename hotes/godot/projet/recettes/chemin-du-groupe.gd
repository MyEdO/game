extends SceneTree

## Le chemin d'un déplacement (#3822, `hotes/godot/pont/CONTRAT.md`, section « Effets », `deplacement`). Sur « La porte
## close » figée par la sonde (`hotes/godot/recettes/chemin.ts`, `figerLeChemin`) et servie par un pont figé
## (`PontFige`), le plateau (`scripts/plateau.gd`) montre la suite d'avant le clic, le meneur sous sa base posée, puis
## celle du clic d'une case du réduit au-delà de la porte : le meneur parcourt le chemin du déplacement
## (`Combattant.parcourir`), passe par le lieu de chacune de ses cases (`Monde.lieu`), dans l'ordre, et finit là où la vue
## le pose, au bout du temps que sa vitesse au sol (`vitesseAuSol` de sa base, `echelleDeVitesse` de son gabarit) donne à
## la somme des mètres du chemin. Un combattant sans corps parcourt un chemin qui gagne une case, monte à sa verticale
## (une échelle), puis passe sur un pont plus haut : il passe par chaque lieu, tourné à l'horizontale vers chaque case
## qu'il gagne sans jamais pencher, et garde son cap à la verticale. Sur le même pont figé, l'atelier offre « Parcourir un
## chemin » à la base posée, qui passe par chaque case du chemin de la vitrine (`vitrine.deplacement`) à l'état de
## marche de l'arbre d'états du jeu (`EtatsDuCorps`, #4081) : au milieu du parcours, l'arbre est actif, le lecteur brut
## arrêté, et la marche se gagne par un fondu qui nomme le repos quitté ; au bout, le repos se gagne par un fondu depuis
## la marche, puis l'arbre se débranche et le lecteur brut joue le clip de repos.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/chemin.json"
## Les images laissées à un chargement ou à un montage, lus et posés en quelques images.
const IMAGES_D_ATTENTE := 600
## Le pas (s) dont la recette avance un parcours, l'écart toléré entre un lieu et le plus proche des points relevés, et
## celui d'une durée relevée, au pas près, son dernier pas compris.
const PAS_S := 0.01
const EPSILON := 0.05
const ECART_DE_DUREE_S := 2.0 * PAS_S
## Le chemin du combattant sans corps : une case vers l'est, la verticale de cette case, puis un pont plus haut au sud.
const ECHELLE := [Vector3(0.5, 0.0, 0.5), Vector3(1.5, 0.0, 0.5), Vector3(1.5, 1.5, 0.5), Vector3(1.5, 2.0, 1.5)]
const METRES_DE_L_ECHELLE := [0.0, 2.0, 3.0, 2.3]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[chemin-du-groupe] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[chemin-du-groupe] %s : aucun chemin figé" % FIGE)
		quit(2)
		return
	PontFige.poser(self, lu)
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	await _le_plateau(lu)
	_l_echelle()
	await _l_atelier()
	for faute in _fautes:
		push_error("[chemin-du-groupe] " + faute)
	print("[chemin-du-groupe] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le meneur du plateau parcourt le chemin du clic, au temps de sa vitesse au sol.
func _le_plateau(lu: Dictionary) -> void:
	var plateau: Plateau = (load("res://scenes/Plateau.tscn") as PackedScene).instantiate()
	root.add_child(plateau)
	plateau.poser_le_monde(lu.monde, lu.morceaux)
	plateau.montrer(lu.avant.vue)
	var heros: Dictionary = lu.apres.vue.projection.exploration.heros[0]
	var meneur: Combattant = plateau.get("_modeles")[heros.id]
	var montage: MontageDeComposition = meneur.get_node("Modele")
	await _attendre(func() -> bool: return montage.modele != null, "la base du meneur posée")
	var deplacement: Dictionary = lu.apres.effets.filter(func(e: Dictionary) -> bool: return e.quoi == "deplacement")[0]
	plateau.montrer(lu.apres.vue)
	plateau.jouer_les_effets(lu.apres.effets)
	var releve := _relever(meneur.get("_deplacement"), meneur, montage)
	var lieux: Array = deplacement.cases.map(func(c: Dictionary) -> Vector3: return plateau.get_node("Monde").lieu(Vector2i(int(c.x), int(c.y)), int(c.z)))
	_passer_par(releve.points, lieux, "le meneur")
	var arrivee: Vector3 = plateau.get_node("Monde").lieu(Vector2i(int(heros.pos[0]), int(heros.pos[1])), int(heros.pos[2]))
	if not meneur.position.is_equal_approx(arrivee):
		_fautes.append("le meneur finit en %s, la vue le pose en %s" % [meneur.position, arrivee])
	var metres := 0.0
	for c: Dictionary in deplacement.cases:
		metres += c.metres
	var gabarit: Dictionary = lu.apres.vue.corps.combattants[heros.id].get("gabarit", {})
	var attendue: float = metres / (montage.base.vitesseAuSol * gabarit.get("echelleDeVitesse", 1.0))
	if absf(releve.duree - attendue) > ECART_DE_DUREE_S:
		_fautes.append("le meneur parcourt %.2f m en %.2f s, attendu %.2f s à sa vitesse au sol" % [metres, releve.duree, attendue])
	print("[chemin-du-groupe] meneur : %d cases, %.2f m en %.2f s" % [lieux.size(), metres, releve.duree])
	plateau.queue_free()


## Le combattant sans corps gravit l'échelle et passe sur le pont, à l'horizontale.
func _l_echelle() -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	combattant.position = ECHELLE[0]
	root.add_child(combattant)
	combattant.parcourir(ECHELLE, METRES_DE_L_ECHELLE)
	var montage: Node3D = combattant.get_node("Modele")
	var releve := _relever(combattant.get("_deplacement"), combattant, montage)
	var rangs := _passer_par(releve.points, ECHELLE, "l'échelle")
	for haut: Vector3 in releve.hauts:
		if not haut.is_equal_approx(Vector3.UP):
			_fautes.append("l'échelle : le corps penche, son haut en %s" % haut)
			break
	if rangs.size() == ECHELLE.size():
		var en_montant: Vector3 = releve.avants[(rangs[1] + rangs[2]) / 2]
		if not en_montant.is_equal_approx(Vector3.RIGHT):
			_fautes.append("à mi-échelle, le corps regarde %s, attendu l'est qu'il garde" % en_montant)
	if not montage.global_basis.z.is_equal_approx(Vector3.BACK):
		_fautes.append("sur le pont, le corps regarde %s, attendu le sud, vers la case gagnée" % montage.global_basis.z)
	var attendue := (ECHELLE.size() - 1) * Combattant.DUREE_DEPLACEMENT_S
	if absf(releve.duree - attendue) > ECART_DE_DUREE_S:
		_fautes.append("sans base, %d pas en %.2f s, attendu %.2f s" % [ECHELLE.size() - 1, releve.duree, attendue])
	print("[chemin-du-groupe] échelle : %d cases en %.2f s, sur le pont tourné vers %s" % [ECHELLE.size(), releve.duree, montage.global_basis.z])
	combattant.queue_free()


## L'atelier offre « Parcourir un chemin » à la base posée, qui passe par chaque case du chemin de la vitrine, par
## l'arbre d'états du jeu : le parcours tenu, la marche gagnée par un fondu depuis le repos ; au bout, le repos gagné
## par un fondu depuis la marche, puis la main rendue au lecteur brut, sur le clip de repos.
func _l_atelier() -> void:
	var atelier: Node = (load("res://scenes/Atelier.tscn") as PackedScene).instantiate()
	root.add_child(atelier)
	var montage: MontageDeComposition = atelier.get("_montage")
	var etats: EtatsDuCorps = atelier.get_node("Etats")
	var bouton: Button = atelier.get_node("%Parcourir")
	await _attendre(func() -> bool: return montage.lecteur != null and bouton.visible, "« Parcourir un chemin » offert à la base posée")
	etats.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	bouton.pressed.emit()
	var parcours: Tween = atelier.get("_parcours")
	parcours.pause()
	var vers_la_marche := await FonduDeLArbre.fondre(self, etats, "marche")
	_verifier(FonduDeLArbre.tenu(vers_la_marche, "repos"), "l'atelier vers la marche : états quittés %s, attendu repos puis rien" % [vers_la_marche])
	_verifier(etats.active and not montage.lecteur.is_playing() and montage.lecteur.assigned_animation == montage.clip("marche"), "au milieu du parcours de l'atelier : arbre actif %s, lecteur brut en lecture %s, clip marqué %s" % [etats.active, montage.lecteur.is_playing(), montage.lecteur.assigned_animation])
	var releve := _relever(parcours, montage.modele, montage.modele)
	var vitrine: Dictionary = atelier.get("_vitrine")
	var lieux: Array = vitrine.deplacement.cases.map(func(c: Dictionary) -> Vector3: return MiseEnPage.lieu_de_la_case_de_vitrine(c.x, c.y, vitrine.metresParCase))
	_passer_par(releve.points, lieux, "l'atelier")
	var vers_le_repos := await FonduDeLArbre.fondre(self, etats, "repos")
	_verifier(FonduDeLArbre.tenu(vers_le_repos, "marche"), "l'atelier vers le repos : états quittés %s, attendu marche puis rien" % [vers_le_repos])
	for i in IMAGES_D_ATTENTE:
		if not etats.active:
			break
		await FonduDeLArbre.pas(self, etats)
	_verifier(not etats.active and etats.anim_player.is_empty() and montage.lecteur.is_playing() and montage.lecteur.current_animation == montage.clip("repos"),
			"au repos retrouvé : arbre actif %s, lecteur brut en lecture %s sur %s, attendu l'arbre débranché et le repos %s" % [etats.active, montage.lecteur.is_playing(), montage.lecteur.current_animation, montage.clip("repos")])
	print("[chemin-du-groupe] atelier : %d cases en %.2f s, fondu repos → marche %s, marche → repos %s" % [lieux.size(), releve.duree, vers_la_marche, vers_le_repos])
	atelier.queue_free()


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)


## Le tween `parcours` avancé de `PAS_S` en `PAS_S` jusqu'à sa fin : chaque point de `mobile` relevé, l'avant et le haut
## de `modele`, et la durée du parcours.
func _relever(parcours: Tween, mobile: Node3D, modele: Node3D) -> Dictionary:
	var releve := {points = [mobile.position], avants = [modele.global_basis.z], hauts = [modele.global_basis.y], duree = 0.0}
	var en_cours := true
	while en_cours:
		en_cours = parcours.custom_step(PAS_S)
		releve.duree += PAS_S
		releve.points.append(mobile.position)
		releve.avants.append(modele.global_basis.z)
		releve.hauts.append(modele.global_basis.y)
	return releve


## Les points relevés `points` passent par chaque lieu de `lieux`, dans l'ordre, à `EPSILON` près : le rang du premier
## point proche de chacun, ceux des lieux atteints avant le premier manqué.
func _passer_par(points: Array, lieux: Array, quoi: String) -> Array[int]:
	var rangs: Array[int] = []
	var depuis := 0
	for lieu: Vector3 in lieux:
		var proche := -1
		for i in range(depuis, points.size()):
			if (points[i] as Vector3).distance_to(lieu) <= EPSILON:
				proche = i
				break
		if proche < 0:
			_fautes.append("%s ne passe pas par %s après le point %d (%s), le plus proche à %.3f" % [quoi, lieu, depuis, points[depuis], _ecart(points.slice(depuis), lieu)])
			return rangs
		rangs.append(proche)
		depuis = proche
	return rangs


## L'écart du plus proche des points `points` au lieu `lieu`.
func _ecart(points: Array, lieu: Vector3) -> float:
	var ecart := INF
	for point: Vector3 in points:
		ecart = minf(ecart, point.distance_to(lieu))
	return ecart


## Les images passées jusqu'à ce que `tenu` le soit, au plus `IMAGES_D_ATTENTE`.
func _attendre(tenu: Callable, quoi: String) -> void:
	for i in IMAGES_D_ATTENTE:
		if tenu.call():
			return
		await process_frame
	_fautes.append("attente échue : %s" % quoi)
