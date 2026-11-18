extends SceneTree

## Le décor qui change selon la saison (#4335, `hotes/godot/pont/CONTRAT.md`, sections « Corps d'un combattant »,
## `DecorServi`, et « Atelier 3D », `echantillon`), sur le noyau vivant (`--pont=<chemin>` après `--`, que
## `construire.mjs --rendus` passe) : l'atelier (`scenes/Atelier.tscn`) sur son pont espion (`PontDesSaisons`), le
## chêne publié (`decor--arbre`, `scripts/personnage-3d/decor/arbre/`) en échantillon. Son échantillon choisi, l'onglet
## Équipement est offert et sa liste `saison` offre le décor tel que bâti puis chaque saison servie ; chaque saison
## choisie tour à tour, l'atelier envoie l'entrée attendue, et le modèle posé cache `sans-hiver` (son feuillage) et montre
## `avec-hiver` (sa ramure nue) en hiver, l'inverse hors de l'hiver, son feuillage à la teinte que sert la saison, la
## sienne sans elle ; de l'été au décor tel que bâti, son corps inchangé, le modèle reste celui qui est posé, sans se
## remonter ; aucune erreur ne se signale.
## Aux pixels, calques de l'écran cachés, MSAA coupé, dans une fenêtre de `FENETRE` : le feuillage est ce que son mesh
## peint en noir change à l'image (`PIXELS.masque`). Hors de l'hiver il tient au moins `INTERIEUR_LISIBLE` pixels
## intérieurs, dont la couleur médiane a le ton de la teinte servie à `TOLERANCE_DE_TON` près, et le vert de sa matière
## sans teinte servie, et aucun pixel n'est de la ramure ; en hiver aucun pixel n'est de lui, et la ramure nue en tient
## au moins `RAMURE_LISIBLE`. Les images s'écrivent sous
## `--sortie=<dossier>` s'il est donné.
##
## Rendu réel, sous chacun des deux rendus : `npm run godot:rendus`.

const RECETTE_RENDUE := true
const PIXELS := preload("res://recettes/lecture_des_pixels.gd")
const ATELIER := "res://scenes/Atelier.tscn"
const PROP := "arbre"
const FENETRE := Vector2i(800, 450)
## L'attente la plus longue d'un état : le lancement du processus et l'ouverture de l'atelier compris.
const ATTENTE_S := 150.0
## Les saisons choisies, dans l'ordre des gestes : chacune, puis le décor tel que bâti.
const CHOIX := ["printemps", "automne", "hiver", "ete", MontageDeComposition.VIDE]
const FEUILLAGE := "sans-hiver"
const RAMURE := "avec-hiver"
## Le moins de pixels intérieurs d'un feuillage lu, et de pixels d'une ramure, trop fine pour en avoir d'intérieurs.
const INTERIEUR_LISIBLE := 40
const RAMURE_LISIBLE := 40
## L'écart de ton (`Color.h`, de 0 à 1) toléré entre le feuillage lu et sa teinte, sous l'éclairage de l'atelier.
const TOLERANCE_DE_TON := 0.08
## Les tons entre lesquels un feuillage sans teinte servie est vert.
const VERT := [0.20, 0.45]
var _fautes: Array[String] = []
var _signales: Array[String] = []
var _sortie := ""


## Le pont espion qui garde la dernière entrée de chaque méthode, en recette (`ecran`).
class PontDesSaisons extends PontEspion:
	var entrees := {}

	func _init() -> void:
		en_recette = true

	func appeler(methode: Noyau.Methode, entree: Variant = null) -> Dictionary:
		entrees[methode] = entree
		return super(methode, entree)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[saisons-du-decor] version=", Engine.get_version_info().string, " rendu=", RenderingServer.get_current_rendering_method())
	root.size = FENETRE
	root.msaa_3d = Viewport.MSAA_DISABLED
	for argument in OS.get_cmdline_user_args():
		if argument.begins_with("--sortie="):
			_sortie = argument.trim_prefix("--sortie=")
	var pont := PontDesSaisons.new()
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	var atelier: Node = (load(ATELIER) as PackedScene).instantiate()
	root.add_child(atelier)
	if await _attendre(func() -> bool: return pont.ecran.get("atelier", {}).get("base") != null and _liste(atelier, "modele/decor") != null):
		await _parcourir(atelier, pont)
	else:
		_fautes.append("l'atelier ne s'ouvre pas sur sa base et ses décors (%s)" % [_signales])
	_fautes.append_array(_signales)
	for faute in _fautes:
		push_error("[saisons-du-decor] " + faute)
	print("[saisons-du-decor] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## `pret` attendu au plus `ATTENTE_S`, sans panne ni refus ; rend s'il l'est.
func _attendre(pret: Callable) -> bool:
	var limite := Time.get_ticks_msec() + int(ATTENTE_S * 1000.0)
	while Time.get_ticks_msec() < limite and _signales.is_empty() and not pret.call():
		await process_frame
	return pret.call()


## L'échantillon de `PROP` choisi, puis chacun de `CHOIX`, posé et lu (`_pose`, `_lire`).
func _parcourir(atelier: Node, pont: PontDesSaisons) -> void:
	_choisir(atelier, "modele/decor", PROP)
	var montage := await _pose(atelier, pont, "tel que bâti")
	if montage == null:
		return
	_verifier("equipement" in pont.ecran.get("atelier", {}).get("onglets", []), "l'échantillon saisonnier n'offre pas l'onglet Équipement")
	var servies: Array = [MontageDeComposition.VIDE]
	servies.append_array(pont.reponses[Noyau.Methode.ECHANTILLON].saisons.map(func(saison: Dictionary) -> String: return saison.id))
	var liste := _liste(atelier, "saison")
	_verifier(liste != null, "liste saison absente")
	if liste != null:
		var offertes := range(liste.item_count).map(func(rang: int) -> Variant: return liste.get_item_metadata(rang))
		_verifier(offertes == servies, "saison : %s offertes, attendu %s" % [offertes, servies])
	for calque: CanvasLayer in root.find_children("*", "CanvasLayer", true, false):
		calque.visible = false
	for controle: Control in atelier.find_children("*", "Control", true, false):
		controle.visible = false
	var precedente: Node3D = montage.scene
	for choix: String in CHOIX:
		var entree := {famille = "decor", id = PROP}
		if choix != MontageDeComposition.VIDE:
			entree.saison = choix
		_choisir(atelier, "saison", choix)
		_verifier(pont.entrees.get(Noyau.Methode.ECHANTILLON) == entree, "%s : entrée %s, attendu %s" % [choix, pont.entrees.get(Noyau.Methode.ECHANTILLON), entree])
		montage = await _pose(atelier, pont, choix)
		if montage == null:
			continue
		if choix == MontageDeComposition.VIDE:
			_verifier(montage.scene == precedente, "tel que bâti : le corps de l'été inchangé, le modèle s'est remonté")
		precedente = montage.scene
		var servi: Dictionary = pont.reponses[Noyau.Methode.ECHANTILLON].decors[PROP]
		_verifier((FEUILLAGE in servi.caches) == (choix == "hiver"), "%s : nœuds cachés servis %s" % [choix, servi.caches])
		_verifier(servi.palette.has("vegetal") == (choix in ["printemps", "automne"]), "%s : palette servie %s" % [choix, servi.palette])
		await _lire(montage.scene, servi, choix)
	_verifier(pont.ecran.get("atelier", {}).get("erreurs", []).is_empty(), "erreurs %s" % [pont.ecran.get("atelier", {}).get("erreurs")])


## Le montage du modèle de `PROP` de l'échantillon que le pont vient de servir, attendu jusqu'à ce qu'il montre ce
## qu'elle sert : `sans-hiver` caché et `avec-hiver` montré si `caches` nomme `sans-hiver`, l'inverse sinon, et son
## feuillage à la couleur que sa `palette` donne à `vegetal`, blanc sans elle ; chaque écart nommé (`quoi`) ; `null`
## faute de modèle posé.
func _pose(atelier: Node, pont: PontDesSaisons, quoi: String) -> MontageDeVehicule:
	var modeles: MontageDesModeles = atelier.get_node("Echantillon/Scene/Modeles")
	var servi: Dictionary = pont.reponses.get(Noyau.Methode.ECHANTILLON, {}).get("decors", {}).get(PROP, {})
	if not _verifier(not servi.is_empty(), "%s : l'échantillon ne sert pas le décor %s" % [quoi, PROP]):
		return null
	var hiver: bool = FEUILLAGE in servi.caches
	var teinte := Color(servi.palette.vegetal) if servi.palette.has("vegetal") else Color.WHITE
	var lu := {etat = {}, montage = null}
	await _attendre(func() -> bool:
		if modeles.poses().size() != 1:
			return false
		lu.montage = modeles.get("_montes")[modeles.poses()[0]]
		lu.etat = _etat(lu.montage.scene)
		return lu.etat.feuillage == (not hiver) and lu.etat.ramure == hiver and lu.etat.couleur != null and (lu.etat.couleur as Color).is_equal_approx(teinte))
	var etat: Dictionary = lu.etat
	var montage: MontageDeVehicule = lu.montage
	if not _verifier(not etat.is_empty(), "%s : aucun modèle posé" % quoi):
		return null
	_verifier(etat.feuillage == (not hiver) and etat.ramure == hiver, "%s : sans-hiver %s, avec-hiver %s, attendu %s et %s" % [quoi, etat.feuillage, etat.ramure, not hiver, hiver])
	_verifier(etat.couleur != null and (etat.couleur as Color).is_equal_approx(teinte), "%s : feuillage %s, teinte servie %s" % [quoi, etat.couleur, servi.palette])
	print("[saisons-du-decor] %s : %s" % [quoi, {caches = servi.caches, palette = servi.palette, feuillage = etat.couleur}])
	return montage


## Ce que montre la scène `scene` d'un modèle posé : ses nœuds `sans-hiver` (`feuillage`) et `avec-hiver` (`ramure`)
## visibles ou non, et la couleur du matériau du premier (`couleur`).
static func _etat(scene: Node3D) -> Dictionary:
	var sans := scene.find_child(FEUILLAGE, true, false) as MeshInstance3D
	var avec := scene.find_child(RAMURE, true, false) as Node3D
	var materiau: BaseMaterial3D = null if sans == null else sans.get_active_material(0) as BaseMaterial3D
	return {
		feuillage = sans != null and sans.visible,
		ramure = avec != null and avec.visible,
		couleur = null if materiau == null else materiau.albedo_color,
	}


## Les pixels que le mesh du nœud `nom` de `scene`, peint en noir, change à l'image `temoin`.
func _pixels_du(scene: Node3D, nom: String, temoin: Image) -> Array[Vector2i]:
	var noir := StandardMaterial3D.new()
	noir.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	noir.albedo_color = Color.BLACK
	var piece := scene.find_child(nom, true, false) as MeshInstance3D
	piece.material_override = noir
	var peinte := await PIXELS.image(self)
	piece.material_override = null
	return PIXELS.masque(temoin, peinte)


## L'image du modèle `scene` servi `servi` en la saison `quoi`, lue : son feuillage et sa ramure aux pixels.
func _lire(scene: Node3D, servi: Dictionary, quoi: String) -> void:
	var temoin := await PIXELS.image(self)
	if not _sortie.is_empty():
		DirAccess.make_dir_recursive_absolute(_sortie)
		temoin.save_png(_sortie.path_join("saisons-du-decor-%s-%s.png" % [RenderingServer.get_current_rendering_method(), "bati" if quoi == MontageDeComposition.VIDE else quoi]))
	var feuillage := PIXELS.interieur(await _pixels_du(scene, FEUILLAGE, temoin))
	var ramure := await _pixels_du(scene, RAMURE, temoin)
	if FEUILLAGE in servi.caches:
		print("[saisons-du-decor] %s : %d pixels du feuillage, %d de la ramure" % [quoi, feuillage.size(), ramure.size()])
		_verifier(feuillage.is_empty(), "%s : %d pixels du feuillage, aucun attendu" % [quoi, feuillage.size()])
		_verifier(ramure.size() >= RAMURE_LISIBLE, "%s : %d pixels de la ramure, au moins %d attendus" % [quoi, ramure.size(), RAMURE_LISIBLE])
		return
	_verifier(ramure.is_empty(), "%s : %d pixels de la ramure d'hiver, aucun attendu" % [quoi, ramure.size()])
	if not _verifier(feuillage.size() >= INTERIEUR_LISIBLE, "%s : %d pixels intérieurs du feuillage, au moins %d attendus" % [quoi, feuillage.size(), INTERIEUR_LISIBLE]):
		return
	var ton := _mediane(temoin, feuillage).h
	if servi.palette.has("vegetal"):
		var attendu := Color(servi.palette.vegetal).h
		print("[saisons-du-decor] %s : %d pixels du feuillage, ton %.3f, teinte servie %s de ton %.3f" % [quoi, feuillage.size(), ton, servi.palette.vegetal, attendu])
		_verifier(absf(ton - attendu) <= TOLERANCE_DE_TON, "%s : feuillage de ton %.3f, teinte servie %s de ton %.3f" % [quoi, ton, servi.palette.vegetal, attendu])
	else:
		print("[saisons-du-decor] %s : %d pixels du feuillage, ton %.3f, vert de %.2f à %.2f" % [quoi, feuillage.size(), ton, VERT[0], VERT[1]])
		_verifier(ton >= VERT[0] and ton <= VERT[1], "%s : feuillage de ton %.3f, vert de %.2f à %.2f attendu" % [quoi, ton, VERT[0], VERT[1]])


## La couleur médiane, canal par canal, de `image` aux pixels `pixels`.
static func _mediane(image: Image, pixels: Array[Vector2i]) -> Color:
	var canaux := [PackedFloat32Array(), PackedFloat32Array(), PackedFloat32Array()]
	for pixel in pixels:
		var couleur := image.get_pixelv(pixel)
		canaux[0].append(couleur.r)
		canaux[1].append(couleur.g)
		canaux[2].append(couleur.b)
	for canal: PackedFloat32Array in canaux:
		canal.sort()
	return Color(canaux[0][pixels.size() / 2], canaux[1][pixels.size() / 2], canaux[2][pixels.size() / 2])


## La liste de clé `cle` sous `atelier`, `null` sans elle.
func _liste(atelier: Node, cle: String) -> OptionButton:
	for liste in atelier.find_children("*", "OptionButton", true, false):
		if liste.get_meta("cle", "") == cle:
			return liste
	return null


## L'article d'id `id` choisi dans la liste de clé `cle`, son signal émis comme au clic.
func _choisir(atelier: Node, cle: String, id: String) -> void:
	var liste := _liste(atelier, cle)
	if liste == null:
		_fautes.append("liste %s absente" % cle)
		return
	for rang in liste.item_count:
		if liste.get_item_metadata(rang) == id:
			liste.select(rang)
			liste.item_selected.emit(rang)
			return
	_fautes.append("%s n'offre pas %s" % [cle, id])


func _verifier(tenu: bool, faute: String) -> bool:
	if not tenu:
		_fautes.append(faute)
	return tenu
