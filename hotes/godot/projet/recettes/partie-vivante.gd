class_name PartieVivante
extends SceneTree

## Une partie sur le noyau vivant (#3945, `hotes/godot/pont/CONTRAT.md`, section « Transport ») : sur le pont de l'arbre,
## ouvert sur le processus du noyau (`TransportDuProcessus` : `--pont=<chemin>` après `--` sous l'éditeur, le noyau
## embarqué dans l'exécutable de bureau, qui joue cette recette en boucle principale, `application/run/main_loop_type`,
## #3951), la scène du combat (`scenes/Combat.tscn`) prend la place de la scène en cours et montre le panneau des
## scénarios ; un clic sur le bouton de `dome` démarre la partie, dont la
## première vue se montre ; une pile des couches demandée (`PontDuNoyau.resoudre_la_pile`), suivie d'un appel écrit
## avant qu'elle ne soit rendue, revient `ok: true` à son rappel, et l'appel reçoit sa propre réponse ; `morceaux` de
## toutes les clés du manifeste (`monde`) arrive en octets (`PontDuNoyau._recoller`) : chaque géométrie porte quatre
## `PackedFloat32Array` aux tailles que disent ses surfaces, et les clés et empreintes du manifeste ; le `monde` demandé
## ensuite reçoit sa propre réponse, le manifeste de nouveau ; un clic sur un
## geste de l'écran publié, la fin du tour s'il est offert, change la vue ; ni panne ni refus ne se signale, et l'avis
## de panne du combat reste vide. Le fichier de stockage du processus (`TransportDuProcessus.fichier_du_stockage`) est
## celui que le lancement demande, aucun sous une recette qui n'en demande pas, `stockage.json` sous `user://` sous le
## jeu, et cette recette tient la boucle principale par son script. Le code de sortie dit le verdict : 0 tenu, 1 une
## faute.

const RECETTE_AUTONOME := true
const SCENARIO := "dome"
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus et le démarrage de la partie compris.
const ATTENTE_S := 120.0
## La plus petite pile valide (`PileDemandee`, `hotes/godot/pont/pile.ts`) : aucune pièce.
const PILE := {pieces = [], peau = [], parents = {}, osDeChaine = []}
## Les familles de géométries d'une réponse de `morceaux`, et leur liste au manifeste de `monde`.
const FAMILLES := {volume = ["monde", "morceaux"], toits = ["toits"], couronnes = ["couronnes"]}
var _fautes: Array[String] = []
## Chaque panne et chaque refus signalés par le pont.
var _signales: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[partie-vivante] version=", Engine.get_version_info().string)
	_verifier_le_stockage()
	var pont: PontDuNoyau = root.get_node("Pont")
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	pont.en_recette = true
	change_scene_to_file(COMBAT)
	await scene_changed
	var combat := current_scene
	var lancer := "bouton/lancer/" + SCENARIO
	if await _attendre(func() -> bool: return _publie(pont, lancer) != null, "le bouton de %s au panneau des scénarios" % SCENARIO):
		_cliquer(_publie(pont, lancer))
	if await _attendre(func() -> bool: return not combat.get("_vue").is_empty(), "la première vue de %s" % SCENARIO):
		var premiere: Dictionary = combat.get("_vue")
		print("[partie-vivante] première vue : scène %s" % premiere.projection.scene.id)
		var piles := []
		pont.resoudre_la_pile(JSON.stringify(PILE), func(reponse: Dictionary) -> void: piles.append(reponse))
		var vue := pont.appeler("vue")
		if vue.get("ok") != true or vue.has("bilan"):
			_fautes.append("l'appel écrit pendant la pile reçoit %s" % JSON.stringify(vue).left(200))
		if await _attendre(func() -> bool: return not piles.is_empty(), "la pile des couches"):
			print("[partie-vivante] pile : ok=%s" % piles[0].get("ok"))
			if piles[0].get("ok") != true or not piles[0].has("bilan"):
				_fautes.append("la pile rend %s" % JSON.stringify(piles[0]).left(200))
		_verifier_les_morceaux(pont)
		if await _attendre(func() -> bool: return _geste(pont) != null, "un geste à l'écran publié"):
			var geste: Dictionary = _geste(pont)
			print("[partie-vivante] geste : %s (%s)" % [geste.element, geste.texte])
			_cliquer(geste)
			if await _attendre(func() -> bool: return not is_same(combat.get("_vue"), premiere), "une vue après le geste %s" % geste.element):
				if combat.get("_vue") == premiere:
					_fautes.append("le geste %s rend une vue identique à la première" % geste.element)
	_fautes.append_array(_signales)
	var avis: String = combat.get_node("Ecran/Interface/Avis/Panne").text
	if avis != "":
		_fautes.append("avis de panne du combat : %s" % avis.left(300))
	for faute in _fautes:
		push_error("[partie-vivante] " + faute)
	print("[partie-vivante] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le fichier de stockage du processus pour chaque lancement : demandé, sous une recette, sous le jeu.
func _verifier_le_stockage() -> void:
	var demande := "/stockage/demande.json"
	var attendus := [
		[demande, true, demande, "demandé sous une recette"],
		[demande, false, demande, "demandé sous le jeu"],
		["", true, "", "sous une recette sans demande"],
		["", false, ProjectSettings.globalize_path("user://stockage.json"), "sous le jeu sans demande"],
	]
	for cas: Array in attendus:
		var fichier := TransportDuProcessus.fichier_du_stockage(cas[0], cas[1])
		if fichier != cas[2]:
			_fautes.append("stockage %s : « %s » au lieu de « %s »" % [cas[3], fichier, cas[2]])
	if get_script() == null:
		_fautes.append("stockage : la boucle principale de la recette ne porte pas son script")
	print("[partie-vivante] stockage : %d cas" % attendus.size())


## `morceaux` de toutes les clés du manifeste, reçu en octets aux tailles que disent ses surfaces, puis un `monde` qui
## reçoit le manifeste de nouveau.
func _verifier_les_morceaux(pont: PontDuNoyau) -> void:
	var monde := pont.appeler("monde")
	if monde.get("ok") != true or monde.monde == null:
		_fautes.append("monde rend %s" % JSON.stringify(monde).left(200))
		return
	var demande := {source = "partie"}
	for famille: String in FAMILLES:
		demande[famille] = _au_manifeste(monde, famille).keys()
	var recus := pont.appeler("morceaux", demande)
	if recus.get("ok") != true or not recus.has("octets"):
		_fautes.append("morceaux rend %s" % JSON.stringify(recus).left(200))
		return
	var geometries := 0
	for famille: String in FAMILLES:
		var empreintes := {}
		for geometrie: Dictionary in recus[famille]:
			geometries += 1
			empreintes[geometrie.cle] = geometrie.empreinte
			_verifier_la_geometrie(geometrie)
		if empreintes != _au_manifeste(monde, famille):
			_fautes.append("morceaux : les clés et empreintes de %s ne sont pas celles du manifeste" % famille)
	print("[partie-vivante] morceaux : %d géométries, %d octets" % [geometries, int(recus.octets)])
	if recus.volume.is_empty():
		_fautes.append("morceaux : aucun morceau du volume reçu")
	var encore := pont.appeler("monde")
	if encore.get("ok") != true or encore.has("octets") or encore.monde != monde.monde:
		_fautes.append("le monde demandé après morceaux reçoit %s" % JSON.stringify(encore).left(200))


## L'empreinte de chaque clé de la famille `famille` au manifeste `monde`, par clé.
func _au_manifeste(monde: Dictionary, famille: String) -> Dictionary:
	var liste: Variant = monde
	for cle: String in FAMILLES[famille]:
		liste = liste[cle]
	var empreintes := {}
	for entree: Dictionary in liste:
		empreintes[entree.cle] = entree.empreinte
	return empreintes


## Les quatre tableaux de `geometrie` en `PackedFloat32Array`, aux tailles que disent ses surfaces : trois nombres par
## sommet pour `positions` et `normales`, quatre pour `couleurs`, trois par triangle pour `cases`.
func _verifier_la_geometrie(geometrie: Dictionary) -> void:
	var sommets := 0
	for surface: Dictionary in geometrie.surfaces:
		sommets = maxi(sommets, int(surface.fin))
	var tailles := {positions = sommets * 3, normales = sommets * 3, couleurs = sommets * 4, cases = sommets}
	for tableau: String in tailles:
		var recu: Variant = geometrie[tableau]
		if not recu is PackedFloat32Array or recu.size() != tailles[tableau]:
			_fautes.append("morceaux : %s de %s vaut %s de taille %s au lieu de %d" % [tableau, geometrie.cle, type_string(typeof(recu)), recu.size() if recu is PackedFloat32Array else "?", tailles[tableau]])


## Le bouton publié qui dessine l'élément `element`, `null` hors de l'écran.
func _publie(pont: PontDuNoyau, element: String) -> Variant:
	for bouton: Dictionary in pont.ecran.get("boutons", []):
		if bouton.get("element") == element:
			return bouton
	return null


## Le geste du joueur à l'écran publié : la fin du tour si elle est offerte, sinon le premier bouton d'un élément de la
## vue hors des fiches.
func _geste(pont: PontDuNoyau) -> Variant:
	var fin: Variant = _publie(pont, "bouton/fin-de-tour")
	if fin != null:
		return fin
	for bouton: Dictionary in pont.ecran.get("boutons", []):
		var element := str(bouton.get("element", ""))
		if element.begins_with("bouton/") and not element.begins_with("bouton/fiche/") and not element.begins_with("bouton/lancer/"):
			return bouton
	return null


## Un clic gauche au centre du bouton publié `bouton`, comme un joueur.
func _cliquer(bouton: Dictionary) -> void:
	for appuye in [true, false]:
		var clic := InputEventMouseButton.new()
		clic.button_index = MOUSE_BUTTON_LEFT
		clic.pressed = appuye
		clic.position = Vector2(bouton.x, bouton.y)
		clic.global_position = clic.position
		root.push_input(clic, true)


## Si `tenu` se tient avant `ATTENTE_S` et avant toute panne ou tout refus signalé.
func _attendre(tenu: Callable, quoi: String) -> bool:
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty():
		if tenu.call():
			return true
		await process_frame
	_fautes.append("attente échue : %s" % quoi)
	return false
