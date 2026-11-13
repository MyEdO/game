extends SceneTree

## Le véhicule dans l'atelier (#2987, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier ouvert sur un
## pont figé (`PontFige`, `pont_fige.gd`, sur le véhicule figé par la sonde, `hotes/godot/recettes/vehicule.ts`), qui
## sert le listage et les GLB du projet et répond à chaque entrée de `vehicule` que la sonde a figée. À l'ouverture, la
## base posée, servie sans aucun élément, offre chaque onglet, Équipement pour ce qui reste à produire (#3792). La
## caraque choisie à la liste de tête des véhicules se pose au sol, cadrée à sa taille, l'onglet montré cédant la place
## au premier qu'elle offre ; un canon choisi à une place de tribord, le Sabord installé, la Figure de proue installée,
## le Sabord retiré, une couleur et un emblème posés : à chaque geste, l'atelier envoie l'entrée attendue, et son montage
## (`MontageDeVehicule`) porte le corps que le pont a rendu : chaque pièce de poste à sa position, tournée vers son bord,
## chaque pièce d'Amélioration à la sienne, celle d'un poste montrant son nœud `montre` et cachant son nœud `cache`, les
## nœuds de `caches` cachés et chaque autre nœud `avec-`/`sans-` visible, chaque place de la réponse offerte à l'onglet
## Équipement sur la pièce qui y est montée, une case par Amélioration qu'il peut monter (`montables`), la palette et
## l'emblème sur ses surfaces, aucun onglet Personnage, et l'onglet Couleurs réduit aux emplacements de palette de ses
## surfaces posées. La caraque n'attaque pas : l'onglet Animation ne montre aucune action ; l'onglet Effets offre un
## bouton par variante, par zone, par lumière, par son, par flottant et par musique de la vitrine (#3777, #3783, #3825,
## `vitrine`), chacun d'un visuel, d'un projectile et de fichiers sonores que Godot connaît, chaque son sur un canal
## qui est un bus (#3949) ; le coup d'un canon y part de
## l'auteur, le souffle de feu pose sa nappe sur chaque case, la flamme son foyer sur la cible, le flottant critique
## monte, une musique joue, cède la place à une autre et se tait, la zone de feu dure sur ses cases, les marques des
## États se posent sur la cible et se retirent (#3834), chaque météo enfoncée pose ses averses et ses nappes et fait jouer
## son son sur un bus, relâche la précédente, et relâchée les retire (#4081) ; le trébuchet choisi, sans place ni Amélioration à
## monter, n'offre pas Équipement et attaque depuis l'onglet Animation : sa pierre vole et son clip de tir joue par
## l'arbre d'états du jeu (`EtatsDuCorps`, #4081), gagné par un fondu depuis le repos (`FonduDeLArbre`), le lecteur
## brut arrêté ; bien que l'atelier boucle ce clip à son lecteur, l'arbre revient au repos par un fondu depuis le tir,
## puis se débranche et rend au lecteur brut son clip de repos ; un clip choisi à la liste pendant une attaque
## débranche l'arbre.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/vehicule.json"
## La plus petite échelle d'orbite qui cadre une coque d'une trentaine de mètres, la caméra de la scène cadrant un corps.
const CADRE_D_UNE_COQUE := 5.0
## Les secondes au bout desquelles les éclats des effets joués sont éteints et retirés, le clip de tir rendu au repos.
const ECLATS_ETEINTS_S := 4.0
## Le clip de la liste choisi pendant une attaque du trébuchet.
const CLIP_CHOISI := "marche"
## Les images au plus qu'attend la base posée à l'ouverture.
const IMAGES_DE_L_OUVERTURE := 600
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[atelier-du-vehicule] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[atelier-du-vehicule] %s : aucun véhicule figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, lu)
	var atelier: Node = load("res://scenes/Atelier.tscn").instantiate()
	root.add_child(atelier)
	await _images(2)
	var cles: Array = lu.vehicule.keys()
	for image in IMAGES_DE_L_OUVERTURE:
		if pont.ecran.get("atelier", {}).get("base") != null:
			break
		await process_frame
	var a_l_ouverture: Array = pont.ecran.get("atelier", {}).get("onglets", [])
	_verifier(a_l_ouverture == ["personnage", "equipement", "couleurs", "animation", "effets", "outils"], "la base sans élément posée à l'ouverture : onglets offerts %s" % [a_l_ouverture])
	_choisir(atelier, "modele/vehicule", "caraque")
	await _etape(atelier, pont, cles, 0, "caraque choisie")
	_verifier(pont.ecran.atelier.onglet == pont.ecran.atelier.onglets[0], "la caraque choisie depuis Personnage : l'onglet montré %s, attendu le premier offert %s" % [pont.ecran.atelier.onglet, pont.ecran.atelier.onglets[0]])
	var cadre: float = (atelier.get_node("Marche") as MarcheDeLAtelier).echelle()
	_verifier(cadre > CADRE_D_UNE_COQUE, "la caraque cadrée à sa taille : échelle d'orbite %.2f" % cadre)
	_choisir(atelier, "poste/tribord/0", "canon-moyen")
	await _etape(atelier, pont, cles, 1, "canon à tribord 1")
	_cocher(atelier, "amelioration/sabord", true)
	await _etape(atelier, pont, cles, 2, "Sabord installé")
	_cocher(atelier, "amelioration/figure-de-proue", true)
	await _etape(atelier, pont, cles, 3, "Figure de proue installée")
	_cocher(atelier, "amelioration/sabord", false)
	await _etape(atelier, pont, cles, 4, "Sabord retiré")
	atelier._changer_la_couleur("vet1", "peau-brune")
	await _etape(atelier, pont, cles, 5, "couleur posée")
	_choisir(atelier, "vehicule/embleme", "taureau-rouge")
	await _etape(atelier, pont, cles, 6, "emblème posé")
	await _vitrine(atelier, pont, cles, lu)
	atelier.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[atelier-du-vehicule] " + faute)
	print("[atelier-du-vehicule] %d entrées de `vehicule`, erreurs=%d" % [pont.entrees.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## L'onglet Effets sur la vitrine figée `lu.vitrine` : la caraque sans attaque, chaque effet et chaque lumière connus de
## Godot et offerts par leur bouton, le coup d'un canon joué, le souffle de feu qui pose sa nappe sur chaque case de sa
## zone, la flamme qui pose un seul foyer sur la cible, le flottant critique, les musiques, puis le trébuchet choisi qui
## attaque.
func _vitrine(atelier: Node, pont: PontFige, cles: Array, lu: Dictionary) -> void:
	var vitrine: Dictionary = lu.vitrine
	var actions := _controle_par_nom(atelier, "Actions")
	var attaquer := _controle_par_nom(atelier, "Attaquer") as Button
	_verifier(not actions.visible, "la caraque n'attaque pas, l'onglet Animation ne doit offrir aucune action")
	var effets: Array = vitrine.attaques.values()
	var cles_des_boutons: Array[String] = []
	for famille in [vitrine.armes, vitrine.sorts]:
		for entree in famille:
			for variante in entree.variantes:
				effets.append(variante.effet)
				cles_des_boutons.append("effet/%s/%s" % [entree.id, variante.variante])
	for famille in [["manoeuvre", vitrine.manoeuvres], ["souffle", vitrine.souffles], ["son", vitrine.sons], ["flottant", vitrine.flottants]]:
		for entree in famille[1]:
			effets.append(entree.effet)
			cles_des_boutons.append("%s/%s" % [famille[0], entree.id])
	for effet in effets:
		_connu(effet)
	for lumiere in vitrine.lumieres:
		cles_des_boutons.append("lumiere/%s" % lumiere.id)
		var source: Dictionary = lumiere.source
		_verifier(source.visuel == null or ResourceLoader.exists(Effets.chemin_de_l_effet(Effets.FAMILLE_DES_FLAMMES, source.visuel)), "visuel de lumière inconnu de Godot : %s" % source.visuel)
		if source.son != null:
			_connu({quoi = "son", son = source.son})
	for zone in vitrine.zonesQuiDurent:
		cles_des_boutons.append("zone-qui-dure/%s" % zone.id)
		_verifier(ResourceLoader.exists(Effets.chemin_de_l_effet(Effets.FAMILLE_DES_VISUELS, zone.zone.visuel)), "visuel de zone qui dure inconnu de Godot : %s" % zone.zone.visuel)
		if zone.zone.boucle != null:
			_connu({quoi = "son", son = zone.zone.boucle})
	for marque in vitrine.marques:
		cles_des_boutons.append("marque/%s" % marque.id)
		_verifier(marque.marque.visuel == null or ResourceLoader.exists(Effets.chemin_de_l_effet(Effets.FAMILLE_DES_FLAMMES, marque.marque.visuel)), "visuel de marque inconnu de Godot : %s" % marque.marque.visuel)
		if marque.marque.son != null:
			_connu({quoi = "son", son = marque.marque.son})
	for meteo in vitrine.meteos:
		cles_des_boutons.append("meteo/%s" % meteo.id)
		if meteo.meteo.son != null:
			_connu({quoi = "son", son = meteo.meteo.son})
	for musique in vitrine.musiques:
		cles_des_boutons.append("musique/%s" % musique.id)
		for piste in musique.musique.pistes:
			_connu({quoi = "son", son = piste})
	for cle in cles_des_boutons:
		_controle(atelier, cle)
	(_controle_par_nom(atelier, "OngletEffets") as Button).pressed.emit()
	(_controle(atelier, "effet/canon/touche") as Button).pressed.emit()
	var noeud_des_effets := atelier.get_node("Effets")
	_verifier(noeud_des_effets.get_node_or_null("eclair-de-bouche") != null and noeud_des_effets.get_node_or_null("boulet") != null, "le canon de la vitrine : ni éclair de bouche ni boulet (%s)" % [noeud_des_effets.get_children().map(func(n: Node) -> String: return n.name)])
	await _images(2)
	_verifier((atelier.get_node("Cible") as Node3D).visible, "la cible de la vitrine cachée sur l'onglet Effets")
	var souffle: Dictionary = vitrine.souffles.filter(func(s: Dictionary) -> bool: return s.id == "feu")[0].effet
	(_controle(atelier, "souffle/feu") as Button).pressed.emit()
	await create_timer(souffle.trajet.dureeS + 0.2).timeout
	var nappes := noeud_des_effets.get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes"))
	_verifier(nappes.size() == souffle.cases.size(), "le souffle de feu de la vitrine : %d nappes de flammes, une par case attendue" % nappes.size())
	(_controle(atelier, "lumiere/flamme") as Button).pressed.emit()
	(_controle(atelier, "lumiere/flamme") as Button).pressed.emit()
	(_controle(atelier, "flottant/critique") as Button).pressed.emit()
	await create_timer(Effets.ELAN_S + 0.1).timeout
	_verifier(noeud_des_effets.get_children().any(func(n: Node) -> bool: return n is Label3D), "le flottant critique de la vitrine ne monte pas")
	await _ecouter(atelier, vitrine.musiques)
	await _durer_et_marquer(atelier)
	await _faire_tomber(atelier, vitrine.meteos)
	var foyers := atelier.get_node("Cible").get_children().filter(func(n: Node) -> bool: return n is Foyer)
	_verifier(foyers.size() == 1 and foyers[0].get_node_or_null("feu") != null and foyers[0].get_node_or_null("son-crepitement") != null, "la flamme de la vitrine : un seul foyer, son feu et son crépitement attendus sur la cible, posés %s" % [foyers.map(func(f: Node) -> Array: return f.get_children().map(func(n: Node) -> String: return n.name))])
	_choisir(atelier, "modele/vehicule", "trebuchet-ade2")
	await _etape(atelier, pont, cles, 7, "trébuchet choisi")
	_verifier(actions.visible and "animation" in pont.ecran.atelier.onglets, "le trébuchet posé attaque, l'onglet Animation doit offrir « Attaquer »")
	var montage := atelier.get_node("Vehicule") as MontageDeVehicule
	var etats := atelier.get_node("Etats") as EtatsDuCorps
	var lecteur := montage.lecteur
	var horloge := etats.callback_mode_process
	etats.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	attaquer.pressed.emit()
	await _images(2)
	_verifier(noeud_des_effets.get_node_or_null("pierre") != null, "la pierre du trébuchet ne vole pas")
	_verifier(lecteur.get_animation(montage.clips.tir).loop_mode == Animation.LOOP_LINEAR, "l'atelier ne boucle pas le clip de tir du trébuchet à son lecteur")
	var vers_le_tir := await FonduDeLArbre.fondre(self, etats, "tir")
	_verifier(FonduDeLArbre.tenu(vers_le_tir, "repos"), "« Attaquer » vers le tir : états quittés %s, attendu repos puis rien" % [vers_le_tir])
	_verifier(etats.active and etats.lecture().get_current_node() == "tir" and lecteur.assigned_animation == montage.clips.tir and not lecteur.is_playing(),
			"« Attaquer » : arbre actif %s à l'état %s, clip marqué %s, lecteur brut en lecture %s ; attendu l'arbre actif au tir, le lecteur brut arrêté" % [etats.active, etats.lecture().get_current_node(), lecteur.assigned_animation, lecteur.is_playing()])
	var vers_le_repos := await FonduDeLArbre.fondre(self, etats, "repos")
	_verifier(FonduDeLArbre.tenu(vers_le_repos, "tir"), "« Attaquer » vers le repos : états quittés %s, attendu tir puis rien" % [vers_le_repos])
	await FonduDeLArbre.rendre(self, etats)
	_verifier(not etats.active and etats.anim_player.is_empty() and lecteur.is_playing() and lecteur.current_animation == montage.clips.repos,
			"après « Attaquer » : arbre actif %s à l'état %s, lecteur brut en lecture %s sur %s ; attendu l'arbre débranché, le lecteur brut au repos %s" % [etats.active, etats.lecture().get_current_node(), lecteur.is_playing(), lecteur.current_animation, montage.clips.repos])
	print("[atelier-du-vehicule] « Attaquer » : fondu repos → tir %s, tir → repos %s, puis le lecteur brut au repos" % [vers_le_tir, vers_le_repos])
	etats.callback_mode_process = horloge
	attaquer.pressed.emit()
	await _images(2)
	_verifier(etats.active, "la seconde attaque ne branche pas l'arbre")
	_choisir(atelier, "clip", CLIP_CHOISI)
	_verifier(not etats.active and etats.anim_player.is_empty() and lecteur.is_playing() and lecteur.current_animation == CLIP_CHOISI,
			"un clip choisi pendant l'attaque : arbre actif %s, lecteur brut en lecture %s sur %s, attendu l'arbre débranché et %s au lecteur brut" % [etats.active, lecteur.is_playing(), lecteur.current_animation, CLIP_CHOISI])
	await create_timer(ECLATS_ETEINTS_S).timeout


## La zone qui dure du feu posée autour de la cible, une par case, puis retirée ; les marques En flammes et Sonné sur
## la cible, puis la seule Sonné quand En flammes se relâche.
func _durer_et_marquer(atelier: Node) -> void:
	var zones := atelier.get_node("ZonesQuiDurent") as ZonesQuiDurent
	var feu := _controle(atelier, "zone-qui-dure/sort-de-feu") as Button
	feu.button_pressed = true
	_verifier(zones.get_child_count() == 1 and zones.get_child(0).get_children().filter(func(n: Node) -> bool: return n.name.begins_with("nappe-de-flammes")).size() > 1, "la zone de feu de la vitrine ne pose pas sa nappe sur ses cases")
	feu.button_pressed = false
	await process_frame
	_verifier(zones.get_child_count() == 0, "la zone de feu relâchée reste posée")
	var marques := atelier.get_node("Cible/Marques") as MarquesDEtats
	var en_flammes := _controle(atelier, "marque/en-flammes") as Button
	en_flammes.button_pressed = true
	(_controle(atelier, "marque/sonne") as Button).button_pressed = true
	var textes := func() -> Array: return marques.get_children().filter(func(n: Node) -> bool: return n is Label3D and not n.is_queued_for_deletion()).map(func(t: Label3D) -> String: return t.text)
	_verifier(textes.call() == ["En flammes", "Sonné"], "les marques de la vitrine : %s" % [textes.call()])
	en_flammes.button_pressed = false
	_verifier(textes.call() == ["Sonné"], "la marque relâchée reste posée : %s" % [textes.call()])
	(_controle(atelier, "marque/sonne") as Button).button_pressed = false
	await create_timer(Foyer.SON_LIBERE_S).timeout


## Chaque météo `meteos` de la vitrine à son bouton à bascule : enfoncée, son nœud `Meteo` pose une averse, instance de
## sa scène, par boîte de sa pluie et une nappe par nappe de brume, et joue son son sur le bus de son canal, la météo
## précédente relâchée ; relâchée, plus rien n'est posé ni ne s'entend.
func _faire_tomber(atelier: Node, meteos: Array) -> void:
	var noeud := atelier.get_node("Meteo") as Meteo
	_verifier(_controle_par_nom(atelier, "TitreMeteos").visible and _controle_par_nom(atelier, "VitrineMeteos").visible, "la section « Météo » de la vitrine est cachée")
	var precedent: Button = null
	for meteo in meteos:
		var bouton := _controle(atelier, "meteo/%s" % meteo.id) as Button
		bouton.button_pressed = true
		await process_frame
		var averses := noeud.get_children().filter(func(n: Node) -> bool: return n.scene_file_path == Meteo.AVERSE.resource_path)
		var nappes := noeud.get_children().filter(func(n: Node) -> bool: return n.scene_file_path == Meteo.NAPPE.resource_path)
		var attendues: Array = [] if meteo.meteo.pluie == null else meteo.meteo.pluie.averses
		_verifier(averses.map(func(a: CPUParticles3D) -> int: return a.amount) == attendues.map(func(a: Dictionary) -> int: return int(a.nombre)), "la météo « %s » de la vitrine : averses %s, attendu %s" % [meteo.label, averses.map(func(a: CPUParticles3D) -> int: return a.amount), attendues])
		_verifier(nappes.size() == meteo.meteo.nappes.size(), "la météo « %s » de la vitrine : %d nappes, attendu %d" % [meteo.label, nappes.size(), meteo.meteo.nappes.size()])
		var son := noeud.son()
		if meteo.meteo.son == null:
			_verifier(son == null, "la météo « %s » de la vitrine joue un son qu'elle n'a pas" % meteo.label)
		else:
			_verifier(son != null and son.playing and son.bus == StringName(meteo.meteo.son.canal) and AudioServer.get_bus_index(son.bus) != -1, "la météo « %s » de la vitrine ne joue pas son son sur le bus %s" % [meteo.label, meteo.meteo.son.canal])
		_verifier(precedent == null or not precedent.button_pressed, "la météo « %s » de la vitrine ne relâche pas la précédente" % meteo.label)
		precedent = bouton
	precedent.button_pressed = false
	await process_frame
	_verifier(noeud.get_child_count() == 0 and noeud.son() == null, "la météo relâchée de la vitrine reste posée : %s" % [noeud.get_children().map(func(n: Node) -> String: return n.name)])
	await create_timer(Foyer.SON_LIBERE_S).timeout


## Les musiques `musiques` de la vitrine à leurs boutons à bascule : la première enfoncée joue, la deuxième enfoncée prend
## sa place et relâche la première, relâchée elle rend le silence.
func _ecouter(atelier: Node, musiques: Array) -> void:
	var musique := atelier.get_node("Musique") as Musique
	var premier := _controle(atelier, "musique/%s" % musiques[0].id) as Button
	var second := _controle(atelier, "musique/%s" % musiques[1].id) as Button
	premier.button_pressed = true
	_verifier(musique.lecteur() != null and musique.lecteur().playing and musique.cle == musiques[0].musique.cle, "la musique « %s » de la vitrine ne joue pas" % musiques[0].label)
	second.button_pressed = true
	_verifier(not premier.button_pressed and musique.cle == musiques[1].musique.cle, "la musique « %s » de la vitrine ne prend pas la place de la première" % musiques[1].label)
	second.button_pressed = false
	_verifier(musique.lecteur() == null and musique.cle == "", "la musique relâchée de la vitrine ne rend pas le silence")
	await create_timer(Musique.FONDU_S + Foyer.SON_LIBERE_S).timeout
	_verifier(musique.get_child_count() == 0, "les musiques éteintes de la vitrine restent posées")


## Chaque phase de l'effet `effet` d'un visuel dont la scène existe, son trajet d'un projectile dont la scène existe, et
## chaque son de fichiers posés sous `res://sons/`, sur un canal qui est un bus d'`AudioServer`.
func _connu(effet: Dictionary) -> void:
	var sons: Array = []
	if effet.quoi == "son":
		sons.append(effet.son)
	for cle in ["depart", "arrivee", "nappe"]:
		var phase: Variant = effet.get(cle)
		if phase == null:
			continue
		_verifier(phase.visuel == null or ResourceLoader.exists(Effets.chemin_de_l_effet(Effets.FAMILLE_DES_VISUELS, phase.visuel)), "visuel inconnu de Godot : %s" % phase.visuel)
		if phase.son != null:
			sons.append(phase.son)
	var trajet: Variant = effet.get("trajet")
	_verifier(trajet == null or ResourceLoader.exists(Effets.chemin_de_l_effet(Effets.FAMILLE_DES_PROJECTILES, trajet.projectile)), "projectile inconnu de Godot : %s" % [null if trajet == null else trajet.projectile])
	for son in sons:
		_verifier(AudioServer.get_bus_index(son.canal) != -1, "son %s : son canal %s n'est pas un bus" % [son.id, son.canal])
		for fichier in son.fichiers:
			_verifier(FileAccess.file_exists("res://sons/%s" % fichier), "son %s : res://sons/%s absent" % [son.id, fichier])


## Le contrôle nommé `nom` sous `atelier`.
func _controle_par_nom(atelier: Node, nom: String) -> Control:
	return atelier.get_node("Interface").find_child(nom, true, false) as Control


func _images(n: int) -> void:
	for i in n:
		await process_frame


## Après le geste `geste`, l'entrée `cles[rang]` envoyée en dernier, et le véhicule de l'atelier conforme à sa réponse.
func _etape(atelier: Node, pont: PontFige, cles: Array, rang: int, geste: String) -> void:
	await _images(2)
	var cle: String = cles[rang]
	if pont.entrees.is_empty() or pont.entrees.back() != cle:
		_fautes.append("%s : entrée %s, attendu %s" % [geste, "aucune" if pont.entrees.is_empty() else pont.entrees.back(), cle])
		return
	_conforme(atelier, pont, pont.fige.vehicule[cle], geste)
	print("[atelier-du-vehicule] %s : %s" % [geste, JSON.stringify(pont.ecran.get("atelier", {}).get("vehicule"))])


## Le montage du véhicule de `atelier` porte la réponse `reponse` de `vehicule`, et l'écran publié par `pont` offre
## Équipement et Couleurs sans Personnage, chaque couleur montrée si une surface posée la prend (la chair de la Figure de
## proue, « peau », n'est offerte qu'installée).
func _conforme(atelier: Node, pont: PontFige, reponse: Dictionary, geste: String) -> void:
	var corps: Dictionary = reponse.vehicule
	var montage := atelier.get_node("Vehicule") as MontageDeVehicule
	var scene := montage.scene
	if scene == null:
		_fautes.append("%s : aucune scène posée" % geste)
		return
	_verifier(montage.element == corps.element, "%s : élément %s, attendu %s" % [geste, montage.element, corps.element])
	var postes: Array = corps.postes.map(func(p: Dictionary) -> String: return p.element)
	var montees: Array = corps.ameliorations.map(func(a: Dictionary) -> String: return a.element)
	_verifier(Array(montage.postes) == postes and Array(montage.ameliorations) == montees, "%s : pièces %s / %s, attendu %s / %s" % [geste, montage.postes, montage.ameliorations, postes, montees])
	var enfants := scene.get_children()
	var pieces := enfants.slice(enfants.size() - postes.size() - montees.size())
	for i in corps.postes.size():
		var poste: Dictionary = corps.postes[i]
		var piece := pieces[i] as Node3D
		_verifier(piece.position.is_equal_approx(_vecteur(poste.position)), "%s : pièce %d en %s, attendu %s" % [geste, i, piece.position, poste.position])
		_verifier(piece.basis.is_equal_approx(Basis(Vector3.UP, MiseEnPage.LACETS_DES_BORDS[poste.bord])), "%s : pièce %d non tournée vers %s" % [geste, i, poste.bord])
	for i in corps.ameliorations.size():
		var montee: Dictionary = corps.ameliorations[i]
		var piece := pieces[corps.postes.size() + i] as Node3D
		_verifier(piece.position.is_equal_approx(_vecteur(montee.position)), "%s : pièce de « %s » en %s, attendu %s" % [geste, montee.element, piece.position, montee.position])
		if montee.has("poste"):
			_verifier(piece.find_child(montee.poste.montre, true, false).visible and not piece.find_child(montee.poste.cache, true, false).visible, "%s : « %s » en %s ne montre pas %s seul" % [geste, montee.element, montee.position, montee.poste.montre])
	for noeud in scene.find_children("*", "Node3D", true, false):
		var nom := String(noeud.name)
		if nom in corps.caches:
			_verifier(not (noeud as Node3D).visible, "%s : %s visible, attendu caché" % [geste, nom])
		elif nom.begins_with("avec-") or nom.begins_with("sans-"):
			_verifier((noeud as Node3D).visible, "%s : %s caché, attendu visible" % [geste, nom])
	var listes := atelier.find_children("*", "OptionButton", true, false).filter(func(o: Node) -> bool: return String(o.get_meta("cle", "")).begins_with("poste/"))
	_verifier(listes.size() == reponse.places.size(), "%s : %d places de poste à l'écran, attendu %d" % [geste, listes.size(), reponse.places.size()])
	for place in reponse.places:
		var liste := _controle(atelier, "poste/%s/%d" % [place.bord, place.rang]) as OptionButton
		var attendue: String = MontageDeComposition.VIDE if place.piece == null else place.piece
		_verifier(liste != null and liste.get_item_metadata(liste.selected) == attendue, "%s : %s sur %s, attendu %s" % [geste, place.label, null if liste == null else liste.get_item_metadata(liste.selected), attendue])
	var cases := atelier.find_children("*", "CheckButton", true, false).filter(func(c: Node) -> bool: return String(c.get_meta("cle", "")).begins_with("amelioration/"))
	var offertes := cases.map(func(c: Node) -> String: return String(c.get_meta("cle")).trim_prefix("amelioration/"))
	_verifier(offertes == reponse.montables, "%s : Améliorations offertes %s, attendu celles que le véhicule peut monter %s" % [geste, offertes, reponse.montables])
	for amelioration in cases:
		var id := String(amelioration.get_meta("cle")).trim_prefix("amelioration/")
		_verifier((amelioration as CheckButton).button_pressed == (id in reponse.ameliorations), "%s : case %s %s" % [geste, id, (amelioration as CheckButton).button_pressed])
	var couleurs := montage.couleurs_posees()
	for surface in MontageDeComposition.modeles.surfaces[corps.element]:
		if corps.palette.has(surface.palette):
			_verifier(String(couleurs.get(surface.nom, "")).to_lower() == String(corps.palette[surface.palette]).to_lower(), "%s : %s en %s, attendu %s" % [geste, surface.nom, couleurs.get(surface.nom), corps.palette[surface.palette]])
	var embleme: Variant = corps.get("embleme", {}).get("id")
	_verifier(montage.embleme == embleme, "%s : emblème %s, attendu %s" % [geste, montage.embleme, embleme])
	var onglets: Array = pont.ecran.get("atelier", {}).get("onglets", [])
	var equipement: bool = not reponse.places.is_empty() or not reponse.montables.is_empty() or MontageDeComposition.porte_un_blason(corps.element)
	_verifier(not "personnage" in onglets and ("equipement" in onglets) == equipement and "couleurs" in onglets, "%s : onglets offerts %s, attendu Couleurs, sans Personnage, Équipement %s" % [geste, onglets, "offert" if equipement else "absent"])
	_verifier(onglets.has(pont.ecran.atelier.onglet), "%s : l'onglet montré %s n'est pas offert" % [geste, pont.ecran.atelier.onglet])
	var palette := {}
	for id in [corps.element] + postes + montees:
		for surface in MontageDeComposition.modeles.surfaces[id]:
			palette[surface.palette] = true
	for liste in atelier.find_children("*", "OptionButton", true, false).filter(func(o: Node) -> bool: return String(o.get_meta("cle", "")).begins_with("couleur/")):
		var slot := String(liste.get_meta("cle")).trim_prefix("couleur/")
		_verifier(_rangee_de_couleur_montree(atelier, slot) == palette.has(slot), "%s : couleur « %s » %s, ses surfaces posées %s" % [geste, slot, "offerte" if _rangee_de_couleur_montree(atelier, slot) else "cachée", palette.keys()])


## Si la rangée de la couleur de l'emplacement de palette `slot` est montrée à l'onglet Couleurs.
func _rangee_de_couleur_montree(atelier: Node, slot: String) -> bool:
	return (_controle(atelier, "couleur/%s" % slot).get_parent() as Control).visible


func _vecteur(lieu: Array) -> Vector3:
	return Vector3(lieu[0], lieu[1], lieu[2])


## Le contrôle de clé `cle` sous `atelier`.
func _controle(atelier: Node, cle: String) -> Control:
	for controle in atelier.find_children("*", "Control", true, false):
		if controle.get_meta("cle", "") == cle:
			return controle
	_fautes.append("contrôle %s absent" % cle)
	return null


## L'article d'id `id` choisi dans la liste de clé `cle`, son signal émis comme au clic.
func _choisir(atelier: Node, cle: String, id: String) -> void:
	var liste := _controle(atelier, cle) as OptionButton
	if liste == null:
		return
	for rang in liste.item_count:
		if liste.get_item_metadata(rang) == id:
			liste.select(rang)
			liste.item_selected.emit(rang)
			return
	_fautes.append("%s n'offre pas %s" % [cle, id])


## La case de clé `cle` cochée (`coche`) ou décochée, son signal émis comme au clic.
func _cocher(atelier: Node, cle: String, coche: bool) -> void:
	var case := _controle(atelier, cle) as CheckButton
	if case != null:
		case.button_pressed = coche


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
