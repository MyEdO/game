extends SceneTree

## La vision du groupe sous le jeu (#3950, `hotes/godot/pont/CONTRAT.md`, méthode `vision`, champ `vue.vision`), sur le
## noyau vivant (`TransportDuProcessus`, `--pont=<chemin>` après `--`), chaque partie sur son propre pont espion
## (`PontEspion`, qui garde chaque méthode appelée et la dernière réponse de chacune) et son combat (`scenes/Combat.tscn`).
## `embuscade-fluviale` : au départ, chaque combattant posé que `voisins` ne nomme pas (`vue.occupants`) n'a ni modèle
## ni marque ; la vision est posée une fois, son image est le masque servi, la case d'un héros lit 255, une case d'un
## ennemi hors de vue jamais 255 et l'une d'elles 0 ; sans actif en vue, la caméra suit un combattant dessiné ; l'attaque
## armée, la cible hors de vue que le noyau laisse viser est surlignée en cible à sa case (`vue.casesDesCibles`). `grimpant` : le premier clic du pas
## (l'aperçu) ne rappelle rien ; le second rappelle `vision` une fois, ni `monde` ni `morceaux`, pose l'image neuve,
## son fondu part de 0, et l'ennemi sorti de la vue perd son modèle et sa marque ; le pas annulé pendant le fondu, la
## vision reçue attend, l'ennemi rentré dans la vue regagne son modèle ; le fondu fini, la vision qui attendait se pose
## et se fond à son tour jusqu'à 1 ; un coup, une incantation et une zone sans auteur jouent leur arrivée ou leur nappe
## sans aucun départ ; un coup en vol et un déplacement en cours dont le combattant quitte l'arbre ne lèvent rien ; la
## première vision d'une autre scène se pose sans fondu. `arene` (exploration) : un pas du groupe rappelle `vision`, ni
## `monde` ni `morceaux`, une case vue puis quittée lit 128, les noms posés sont ceux des entités que la vue nomme, et
## sous chacun des trois regards chaque matière des morceaux porte la vision posée. Le volume ne fond que par
## `avancer_le_fondu` (`set_process(false)`). Le code de sortie dit le verdict : 0 tenu, 1 une faute.

const RECETTE_AUTONOME := true
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus et le démarrage de la partie compris.
const ATTENTE_S := 120.0
## Les combattants de `embuscade-fluviale` hors de la vue du groupe au départ (#3950, mesure du contrat).
const HORS_DE_VUE_AU_DEPART := 5
## La case de `grimpant` dont le pas de l'actif fait sortir l'ennemi de la vue.
const CASE_DU_PAS := Vector3i(5, 0, 0)
## La case de `arene` où le pas du groupe le mène.
const CASE_DU_GROUPE := Vector3i(28, 24, 0)
const VISUEL := "etincelles"
var _fautes: Array[String] = []
## Chaque panne et chaque refus signalés par le pont.
var _signales: Array[String] = []


## Le pont du noyau vivant, sur la partie du scénario `scenario` : il garde chaque méthode appelée, dans l'ordre, et la
## dernière réponse de chacune.
class PontEspion extends PontDuNoyau:
	var scenario := ""
	var appels: Array[String] = []
	var reponses := {}

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		appels.append(methode)
		var reponse := super(methode, entree)
		reponses[methode] = reponse
		return reponse

	func parametre(cle: String) -> String:
		return scenario if cle == "scenario" else super(cle)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[vision-du-combat] version=", Engine.get_version_info().string)
	await _embuscade()
	await _grimpant()
	await _arene()
	for faute in _fautes:
		push_error("[vision-du-combat] " + faute)
	print("[vision-du-combat] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


func _embuscade() -> void:
	var partie := await _demarrer("embuscade-fluviale")
	if partie.is_empty():
		return
	var pont: PontEspion = partie.pont
	var combat: Node = partie.combat
	var plateau: Plateau = combat.get_node("Plateau")
	var vue: Dictionary = combat.get("_vue")
	var caches := _hors_de_vue(vue)
	print("[vision-du-combat] embuscade : hors de vue %s" % [caches])
	_verifier(caches.size() == HORS_DE_VUE_AU_DEPART, "embuscade : %d combattants hors de vue, attendu %d" % [caches.size(), HORS_DE_VUE_AU_DEPART])
	for id: String in caches:
		_verifier(not plateau.get("_modeles").has(id) and not plateau.get("_marques").has(id), "embuscade : %s hors de vue a un modèle ou une marque" % id)
		_verifier(not _dessines(plateau).has(id), "embuscade : %s hors de vue dans l'arbre" % id)
	_verifier(pont.appels.count("vision") == 1, "embuscade : `vision` appelée %d fois, attendu une" % pont.appels.count("vision"))
	var volume: VolumeDeScene = (combat.get_node("Plateau/Monde") as Monde).volume
	_verifier(_image_posee(volume) == _masque_servi(pont), "embuscade : l'image posée n'est pas le masque servi")
	var heros: Dictionary = vue.projection.combat.voisins.liste.filter(func(c: Dictionary) -> bool: return c.id.ends_with("-de-test"))[0]
	_verifier(_etat(volume, heros.pos) == 255, "embuscade : la case du héros %s lit %d, attendu 255" % [heros.id, _etat(volume, heros.pos)])
	var etats: Array = caches.values().map(func(cle: String) -> int: return _etat(volume, Array(cle.split(","))))
	_verifier(not etats.has(255) and etats.has(0), "embuscade : les cases hors de vue lisent %s, aucune 255 et une 0 attendues" % [etats])
	var suivi: Variant = (combat.get_node("Plateau/Monde") as Monde).lieu_suivi()
	var lieux_dessines: Array = vue.projection.combat.voisins.liste.map(func(c: Dictionary) -> Vector3: return plateau.call("_lieu", c.pos))
	_verifier(suivi != null and lieux_dessines.any(func(l: Vector3) -> bool: return l.is_equal_approx(suivi)),
		"embuscade : la caméra suit %s, attendu le lieu d'un combattant dessiné parmi %s" % [suivi, lieux_dessines])
	_passer_les_fenetres(combat)
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.combat.actif != null, "embuscade : un actif en vue"):
		await _clore(combat)
		return
	_jouer(combat, _jeu(combat.get("_vue").zones, "attaque"))
	caches = _hors_de_vue(combat.get("_vue"))
	var cibles: Array = combat.get("_vue").projection.combat.cibles.liste.filter(func(id: String) -> bool: return caches.has(id))
	if _verifier(not cibles.is_empty(), "embuscade : l'attaque armée ne vise aucun combattant hors de vue"):
		var case: Array = combat.get("_vue").casesDesCibles[cibles[0]]
		var plaque: Variant = _plaque(plateau, Vector3i(int(case[0]), int(case[1]), int(case[2])))
		_verifier(plaque != null and (plaque as MeshInstance3D).mesh == (plateau.get_node("Monde") as Monde).surbrillances.get_item_mesh(Monde.ITEM_CIBLE),
			"embuscade : la cible hors de vue %s n'est pas surlignée en cible à sa case %s" % [cibles[0], case])
		_verifier(not plateau.get("_modeles").has(cibles[0]), "embuscade : la cible hors de vue %s a un modèle" % cibles[0])
	await _clore(combat)


func _grimpant() -> void:
	var partie := await _demarrer("grimpant")
	if partie.is_empty():
		return
	var pont: PontEspion = partie.pont
	var combat: Node = partie.combat
	var plateau: Plateau = combat.get_node("Plateau")
	var volume: VolumeDeScene = (combat.get_node("Plateau/Monde") as Monde).volume
	volume.set_process(false)
	_passer_les_fenetres(combat)
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.combat.actif != null, "grimpant : un actif en vue"):
		await _clore(combat)
		return
	var vue: Dictionary = combat.get("_vue")
	var actif: String = vue.projection.combat.actif.id
	var ennemis: Array = vue.projection.combat.voisins.liste.filter(func(c: Dictionary) -> bool: return c.id != actif).map(func(c: Dictionary) -> String: return c.id)
	if not _verifier(ennemis.size() == 1, "grimpant : %s en vue près de l'actif, un ennemi attendu" % [ennemis]):
		await _clore(combat)
		return
	var ennemi: String = ennemis[0]
	_verifier(plateau.get("_modeles").has(ennemi), "grimpant : %s en vue sans modèle" % ennemi)
	var modele: Node = plateau.get("_modeles").get(ennemi)
	var marque: Node = plateau.get("_marques").get(ennemi)
	var avant := pont.appels.size()
	plateau.case_cliquee.emit(CASE_DU_PAS)
	_verifier(not pont.appels.slice(avant).has("vision"), "grimpant : l'aperçu du pas rappelle `vision`, sa clé inchangée")
	avant = pont.appels.size()
	var cle: String = combat.get("_vue").vision
	plateau.case_cliquee.emit(CASE_DU_PAS)
	var au_pas := pont.appels.slice(avant)
	print("[vision-du-combat] grimpant, au pas : %s, clé %s puis %s" % [au_pas, cle, combat.get("_vue").vision])
	_verifier(combat.get("_vue").vision != cle, "grimpant : le pas vers %s ne change pas la clé de la vision" % CASE_DU_PAS)
	_verifier(au_pas.count("vision") == 1, "grimpant : au pas, `vision` appelée %d fois, attendu une" % au_pas.count("vision"))
	for methode in ["monde", "morceaux"]:
		_verifier(not au_pas.has(methode), "grimpant : au pas, `%s` redemandé" % methode)
	_verifier(_image_posee(volume) == _masque_servi(pont), "grimpant : au pas, l'image posée n'est pas le masque neuf")
	_verifier(volume.part_du_fondu() == 0.0, "grimpant : au pas, le fondu part de %s, attendu 0" % volume.part_du_fondu())
	_verifier(not plateau.get("_modeles").has(ennemi) and not plateau.get("_marques").has(ennemi), "grimpant : %s sorti de la vue garde son modèle ou sa marque" % ennemi)
	await process_frame
	_verifier(not is_instance_valid(modele) and not is_instance_valid(marque), "grimpant : le modèle ou la marque de %s sorti de la vue reste dans l'arbre" % ennemi)
	volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S / 2.0)
	_jouer(combat, _jeu(combat.get("_vue").zones, "annulation-deplacement"))
	_verifier(volume.vision_en_attente() != null and volume.part_du_fondu() == 0.5, "grimpant : la vision reçue pendant le fondu n'attend pas (part %s)" % volume.part_du_fondu())
	_verifier(plateau.get("_modeles").has(ennemi), "grimpant : %s rentré dans la vue sans modèle" % ennemi)
	volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	_verifier(volume.vision_en_attente() == null and volume.part_du_fondu() == 0.0, "grimpant : le fondu fini, la vision qui attendait ne se fond pas (part %s)" % volume.part_du_fondu())
	_verifier(_image_posee(volume) == _masque_servi(pont), "grimpant : la vision qui attendait n'est pas posée")
	volume.avancer_le_fondu(VolumeDeScene.DUREE_DU_FONDU_S)
	_verifier(volume.part_du_fondu() == 1.0, "grimpant : le fondu atteint %s, attendu 1" % volume.part_du_fondu())
	await _sans_auteur(plateau, actif)
	await _en_cours(plateau, actif, ennemi)
	_autre_scene(combat, volume)
	await _clore(combat)


## Un coup, une incantation et une zone sans auteur (`de` nul) sur l'actif `actif` : aucun départ, chaque arrivée et la
## nappe jouées.
func _sans_auteur(plateau: Plateau, actif: String) -> void:
	var effets: Effets = plateau.get_node("Effets")
	var departs := []
	var compter := func(de: Variant, _vers: Vector3) -> void: departs.append(de)
	effets.depart.connect(compter)
	var eclats := []
	var eclater := func(n: Node) -> void:
		if n.name.begins_with(VISUEL):
			eclats.append(n.name)
	effets.child_entered_tree.connect(eclater)
	var case: Array = plateau.get("_vue").projection.combat.actif.pos
	var arrivee := {visuel = VISUEL, son = null}
	plateau.jouer_les_effets([
		{quoi = "coup", de = null, vers = actif, issue = "touche", couleur = "#ffffff", depart = null, trajet = null, arrivee = arrivee, flottants = []},
		{quoi = "incantation", de = null, vers = actif, reussie = true, couleur = "#ffffff", depart = null, arrivee = arrivee, flottants = []},
		{quoi = "zone", de = null, centre = {x = case[0], y = case[1], z = case[2]}, cases = [{x = case[0], y = case[1], z = case[2]}], couleur = "#ffffff", depart = null, trajet = null, nappe = arrivee},
	])
	await create_timer(Effets.ECART_S * 3.0).timeout
	effets.depart.disconnect(compter)
	effets.child_entered_tree.disconnect(eclater)
	_verifier(departs.is_empty(), "sans auteur : départs %s" % [departs])
	_verifier(eclats.size() == 3, "sans auteur : %s joués, trois arrivées ou nappes attendues" % [eclats])


## Un coup en vol de l'actif `actif` vers `ennemi` et un déplacement de `ennemi` en cours, puis le pas qui fait sortir
## `ennemi` de la vue : rien ne lève, et `ennemi` n'a plus de modèle à l'arrivée du coup.
func _en_cours(plateau: Plateau, actif: String, ennemi: String) -> void:
	var vers: Array = plateau.get("_vue").projection.combat.voisins.liste.filter(func(c: Dictionary) -> bool: return c.id == ennemi)[0].pos
	var arrivees := []
	var compter := func(qui: String, _touche: bool) -> void: arrivees.append(qui)
	(plateau.get_node("Effets") as Effets).arrivee.connect(compter)
	plateau.jouer_les_effets([
		{quoi = "deplacement", qui = ennemi, cases = [{x = vers[0], y = vers[1], z = vers[2], metres = 0.0}, {x = vers[0], y = vers[1], z = vers[2], metres = 0.0}]},
		{quoi = "coup", de = actif, vers = ennemi, issue = "touche", couleur = "#ffffff", depart = null, trajet = {projectile = "fleche", dureeS = 0.4, hauteurM = 0.5}, arrivee = null, flottants = []},
	])
	plateau.case_cliquee.emit(CASE_DU_PAS)
	plateau.case_cliquee.emit(CASE_DU_PAS)
	_verifier(not plateau.get("_modeles").has(ennemi), "en cours : %s sorti de la vue garde son modèle" % ennemi)
	await create_timer(1.0).timeout
	(plateau.get_node("Effets") as Effets).arrivee.disconnect(compter)
	_verifier(arrivees == [ennemi], "en cours : arrivées %s, attendu [%s]" % [arrivees, ennemi])


## La vision d'une autre scène, de même taille, posée par le combat (`_poser_la_vision_de`) : sans fondu ; puis celle de
## la scène de la partie, sans fondu de même.
func _autre_scene(combat: Node, volume: VolumeDeScene) -> void:
	var vue: Dictionary = combat.get("_vue")
	combat.call("_poser_la_vision_de", {id = "autre-scene"}, vue.vision)
	_verifier(volume.part_du_fondu() == 1.0, "autre scène : sa première vision se fond depuis l'ancienne (part %s)" % volume.part_du_fondu())
	combat.call("_poser_la_vision_de", vue.projection.scene, vue.vision)
	_verifier(volume.part_du_fondu() == 1.0, "retour de scène : sa première vision se fond depuis l'autre (part %s)" % volume.part_du_fondu())


func _arene() -> void:
	var partie := await _demarrer("arene")
	if partie.is_empty():
		return
	var pont: PontEspion = partie.pont
	var combat: Node = partie.combat
	var plateau: Plateau = combat.get_node("Plateau")
	var monde: Monde = combat.get_node("Plateau/Monde")
	var volume: VolumeDeScene = monde.volume
	volume.set_process(false)
	_passer_les_fenetres(combat)
	if not await _attendre(func() -> bool: return combat.get("_vue").champ != null, "arène : le champ cliquable"):
		await _clore(combat)
		return
	_verifier(_noms(monde) == _noms_de_la_vue(combat.get("_vue")), "arène : les noms posés ne sont pas ceux des entités de la vue")
	var avant := _masque_servi(pont)
	var largeur := int(pont.reponses.vision.largeur)
	var depuis := pont.appels.size()
	plateau.case_cliquee.emit(CASE_DU_GROUPE)
	var au_pas := pont.appels.slice(depuis)
	print("[vision-du-combat] arène, au pas : %s" % [au_pas])
	_verifier(au_pas.count("vision") == 1, "arène : au pas, `vision` appelée %d fois, attendu une" % au_pas.count("vision"))
	for methode in ["monde", "morceaux"]:
		_verifier(not au_pas.has(methode), "arène : au pas, `%s` redemandé" % methode)
	var apres := _masque_servi(pont)
	var quittee := -1
	for i in apres.size():
		if avant[i] == 255 and apres[i] == 128:
			quittee = i
			break
	if _verifier(quittee != -1, "arène : aucune case vue puis quittée au masque d'après"):
		var case := Vector2i(quittee % largeur, quittee / largeur)
		_verifier(volume.etat_de_la_case(case, 0) == 128, "arène : la case quittée %s lit %d, attendu 128" % [case, volume.etat_de_la_case(case, 0)])
	_verifier(_noms(monde) == _noms_de_la_vue(combat.get("_vue")), "arène : après le pas, les noms posés ne sont pas ceux des entités de la vue")
	for regard: String in ["tactique", "plateau", "immersion"]:
		combat.call("_suivre", pont.appeler("regarder", {regard = regard}))
		_verifier(monde.regard() == regard, "arène : regard %s, attendu %s" % [monde.regard(), regard])
		var sans := _matieres_sans_la_vision(volume)
		_verifier(sans.is_empty(), "arène : sous le regard %s, %d matières des morceaux sans la vision posée" % [regard, sans.size()])
	await _clore(combat)


## La partie du scénario `scenario` sur un pont espion neuf et son combat, sa première vue montrée : `{ pont, combat }`,
## vide et une faute si elle ne vient pas.
func _demarrer(scenario: String) -> Dictionary:
	_signales.clear()
	var pont := PontEspion.new()
	pont.scenario = scenario
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	if not await _attendre(func() -> bool: return not combat.get("_vue").is_empty(), "la première vue de %s" % scenario):
		await _clore(combat)
		return {}
	print("[vision-du-combat] %s : scène %s, vision %s" % [scenario, combat.get("_vue").projection.scene.id, combat.get("_vue").vision])
	return {pont = pont, combat = combat}


## Le combat `combat` retiré, chaque panne et chaque refus signalés comptés en fautes.
func _clore(combat: Node) -> void:
	_fautes.append_array(_signales)
	_signales.clear()
	combat.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout


## Chaque fenêtre ouverte passée par le geste en focus de son pied.
func _passer_les_fenetres(combat: Node) -> void:
	while combat.get("_vue").projection.get("fenetre") != null:
		_jouer(combat, combat.get("_vue").zones["fenetre.gestes"].filter(func(g: Dictionary) -> bool: return g.focus)[0].jeu)


## L'intention `jeu` jouée comme un geste du joueur (`combat.gd`, `_jouer`).
func _jouer(combat: Node, jeu: Variant) -> void:
	if _verifier(jeu != null, "geste absent de la vue"):
		combat.call("_jouer", jeu)


## L'intention de l'élément d'id `id` sous `zones` (une zone, ou toutes), `null` sans lui.
func _jeu(zones: Variant, id: String) -> Variant:
	if zones is Dictionary:
		for zone: Variant in zones.values():
			var jeu: Variant = _jeu(zone, id)
			if jeu != null:
				return jeu
	elif zones is Array:
		for element: Variant in zones:
			if element is Dictionary and element.get("id") == id and element.has("jeu"):
				return element.jeu
			var jeu: Variant = _jeu(element.get("valeurs", []) if element is Dictionary else element, id)
			if jeu != null:
				return jeu
	return null


## Par id, la case (`x,y,z`) de chaque combattant posé de `vue` (`vue.occupants`) que `voisins` ne nomme pas.
func _hors_de_vue(vue: Dictionary) -> Dictionary:
	var voisins: Array = vue.projection.combat.voisins.liste.map(func(c: Dictionary) -> String: return c.id)
	var caches := {}
	for cle: String in vue.occupants:
		if not voisins.has(vue.occupants[cle]):
			caches[vue.occupants[cle]] = cle
	return caches


## Les ids des combattants dessinés dans l'arbre du plateau.
func _dessines(plateau: Plateau) -> Array:
	return plateau.get_node("Combattants").get_children().filter(func(n: Node) -> bool: return n is Combattant).map(func(n: Node) -> String: return n.get("_id"))


## Les octets de l'image de la vision posée au volume, vides sans elle.
func _image_posee(volume: VolumeDeScene) -> PackedByteArray:
	var image: Image = volume.get("_vision")
	return PackedByteArray() if image == null else image.get_data()


## Les octets du dernier masque servi par la méthode `vision`.
func _masque_servi(pont: PontEspion) -> PackedByteArray:
	return Marshalls.base64_to_raw(pont.reponses.get("vision", {}).get("masque", ""))


## L'octet de la vision posée à la case `pos` (`[x, y, z]`), sa couche par son rang au monde.
func _etat(volume: VolumeDeScene, pos: Array) -> int:
	var couches: Array = (volume.get_parent() as Monde).couches()
	return volume.etat_de_la_case(Vector2i(int(pos[0]), int(pos[1])), couches.find(int(pos[2])))


## La plaque de surbrillance posée à la case `case`, `null` sans elle.
func _plaque(plateau: Plateau, case: Vector3i) -> Variant:
	for plaque: Node in plateau.get_node("Monde").get("_surbrillance").get_children():
		if plaque.get_meta("case") == case:
			return plaque
	return null


## Les noms posés au monde (`Monde.etiqueter`), triés.
func _noms(monde: Monde) -> Array:
	var noms: Array = monde.get("_etiquettes").get_children().map(func(n: Label3D) -> String: return n.text)
	noms.sort()
	return noms


## Les noms des entités que la vue nomme (`exploration.entites`), triés.
func _noms_de_la_vue(vue: Dictionary) -> Array:
	var noms: Array = vue.projection.exploration.entites.liste.filter(func(e: Dictionary) -> bool: return e.nom != null).map(func(e: Dictionary) -> String: return e.nom)
	noms.sort()
	return noms


## Chaque matière des morceaux du volume qui ne porte pas la vision posée.
func _matieres_sans_la_vision(volume: VolumeDeScene) -> Array:
	var sans := []
	for noeud in volume.get_node("Volume/Morceaux").get_children():
		var vu: MeshInstance3D = noeud.get_node("Vu")
		for surface in vu.mesh.get_surface_count():
			var matiere := vu.get_active_material(surface) as ShaderMaterial
			if matiere.get_shader_parameter("vision") != volume.get("_vision_neuve"):
				sans.append(matiere)
	return sans


## Si `tenu` se tient avant `ATTENTE_S` et avant toute panne ou tout refus signalé.
func _attendre(tenu: Callable, quoi: String) -> bool:
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty():
		if tenu.call():
			return true
		await process_frame
	_fautes.append("attente échue : %s" % quoi)
	return false


## `vrai`, sinon la faute `faute` comptée.
func _verifier(vrai: bool, faute: String) -> bool:
	if not vrai:
		_fautes.append(faute)
	return vrai
