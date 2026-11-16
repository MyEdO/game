extends SceneTree

## Le décor qui change selon la saison (#4335, `hotes/godot/pont/CONTRAT.md`, sections « Corps d'un combattant »,
## `DecorServi`, et « Atelier 3D », `echantillon`) : l'atelier ouvert sur un pont figé (`PontFige`, sur l'atelier figé
## des saisons, `hotes/godot/recettes/decor.ts`, `figerLeDecor`, `saisons`), qui sert un décor de banc à nœuds
## `sans-hiver` (son feuillage) et `avec-hiver`, teint en automne, et son GLB. Son échantillon choisi, l'onglet Équipement
## est offert et sa liste `saison` offre le décor tel que bâti puis chaque saison servie ; chaque saison choisie tour à
## tour, l'atelier envoie l'entrée attendue, et le modèle posé cache `sans-hiver` et montre `avec-hiver` en hiver,
## l'inverse hors de l'hiver, son feuillage prend la teinte servie en automne et elle seule ; de printemps en été, son
## corps inchangé, le modèle reste celui qui est posé, sans se remonter ; aucune erreur ne se signale.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/decor.json"
## Les images au plus qu'attend la base posée à l'ouverture, et chaque modèle du décor.
const IMAGES_DE_L_OUVERTURE := 600
## Les saisons choisies, dans l'ordre des gestes : chacune, puis le décor tel que bâti.
const CHOIX := ["printemps", "ete", "automne", "hiver", MontageDeComposition.VIDE]
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[saisons-du-decor] version=", Engine.get_version_info().string)
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not decor is Dictionary or not decor.has("saisons"):
		push_error("[saisons-du-decor] %s : aucun atelier des saisons figé" % FIGE)
		quit(2)
		return
	var figee: Dictionary = decor.saisons
	var pont := PontFige.poser(self, figee)
	var atelier: Node = load("res://scenes/Atelier.tscn").instantiate()
	root.add_child(atelier)
	for image in IMAGES_DE_L_OUVERTURE:
		if pont.ecran.get("atelier", {}).get("base") != null:
			break
		await process_frame
	var prop: String = figee.modeles.decors.keys()[0]
	_choisir(atelier, "modele/decor", prop)
	var sans_saison: Dictionary = figee.echantillon[JSON.stringify({famille = "decor", id = prop})]
	var automne: String = figee.echantillon[JSON.stringify({famille = "decor", id = prop, saison = "automne"})].decors[prop].palette.vegetal
	var montage := await _pose(atelier, sans_saison, prop, automne, "tel que bâti")
	_verifier("equipement" in pont.ecran.get("atelier", {}).get("onglets", []), "l'échantillon saisonnier n'offre pas l'onglet Équipement")
	var liste := _liste(atelier, "saison")
	if liste != null:
		var offertes := range(liste.item_count).map(func(rang: int) -> Variant: return liste.get_item_metadata(rang))
		var servies: Array = [MontageDeComposition.VIDE]
		servies.append_array(sans_saison.saisons.map(func(saison: Dictionary) -> String: return saison.id))
		_verifier(offertes == servies, "saison : %s offertes, attendu %s" % [offertes, servies])
	var precedente: Node3D = null if montage == null else montage.scene
	for choix: String in CHOIX:
		var entree := {famille = "decor", id = prop}
		if choix != MontageDeComposition.VIDE:
			entree.saison = choix
		var cle := JSON.stringify(entree)
		_choisir(atelier, "saison", choix)
		montage = await _pose(atelier, figee.echantillon[cle], prop, automne, choix)
		_verifier(not pont.entrees.is_empty() and pont.entrees.back() == cle, "%s : entrée %s, attendu %s" % [choix, "aucune" if pont.entrees.is_empty() else pont.entrees.back(), cle])
		if montage == null:
			continue
		if choix == "ete":
			_verifier(montage.scene == precedente, "été : le corps du printemps inchangé, le modèle s'est remonté")
		precedente = montage.scene
	_verifier(pont.ecran.get("atelier", {}).get("erreurs", []).is_empty(), "erreurs %s" % [pont.ecran.get("atelier", {}).get("erreurs")])
	for faute in _fautes:
		push_error("[saisons-du-decor] " + faute)
	print("[saisons-du-decor] %d choix posés, erreurs=%d" % [CHOIX.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## Le montage du modèle du décor `prop` de l'échantillon servi `reponse`, attendu au plus `IMAGES_DE_L_OUVERTURE` images,
## jusqu'à ce qu'il montre ce qu'elle sert : `sans-hiver` caché et `avec-hiver` montré si `caches` nomme `sans-hiver`,
## l'inverse sinon, et son feuillage à la teinte `automne` si et seulement si sa `palette` la porte ; chaque écart nommé
## (`quoi`) ; `null` faute de modèle posé.
func _pose(atelier: Node, reponse: Dictionary, prop: String, automne: String, quoi: String) -> MontageDeVehicule:
	var modeles: MontageDesModeles = atelier.get_node("Echantillon/Scene/Modeles")
	var servi: Dictionary = reponse.decors[prop]
	var hiver: bool = "sans-hiver" in servi.caches
	var teinte: Variant = servi.palette.get("vegetal")
	var montage: MontageDeVehicule = null
	var etat := {}
	for image in IMAGES_DE_L_OUVERTURE:
		await process_frame
		if modeles.poses().size() != 1:
			continue
		montage = modeles.get("_montes")[modeles.poses()[0]]
		if montage.scene == null:
			continue
		etat = _etat(montage.scene, automne)
		if etat.sans_hiver == not hiver and etat.avec_hiver == hiver and etat.teint == (teinte != null):
			break
	if not _verifier(not etat.is_empty(), "%s : aucun modèle posé" % quoi):
		return null
	_verifier(etat.sans_hiver == not hiver and etat.avec_hiver == hiver, "%s : sans-hiver %s, avec-hiver %s, attendu %s et %s" % [quoi, etat.sans_hiver, etat.avec_hiver, not hiver, hiver])
	_verifier(etat.teint == (teinte != null), "%s : feuillage %s, teinte servie %s" % [quoi, etat.feuillage, teinte])
	print("[saisons-du-decor] %s : %s" % [quoi, {caches = servi.caches, palette = servi.palette, feuillage = etat.feuillage}])
	return montage


## Ce que montre la scène `scene` d'un modèle posé : ses nœuds `sans-hiver` et `avec-hiver` visibles ou non, la couleur
## du matériau du premier (`feuillage`), et s'il est teint de `teinte` (`teint`).
static func _etat(scene: Node3D, teinte: String) -> Dictionary:
	var sans := scene.find_child("sans-hiver", true, false) as MeshInstance3D
	var avec := scene.find_child("avec-hiver", true, false) as Node3D
	var materiau: BaseMaterial3D = null if sans == null else sans.get_active_material(0) as BaseMaterial3D
	var feuillage: Variant = null if materiau == null else materiau.albedo_color
	return {
		sans_hiver = sans != null and sans.visible,
		avec_hiver = avec != null and avec.visible,
		feuillage = feuillage,
		teint = feuillage != null and (feuillage as Color).is_equal_approx(Color(teinte)),
	}


## La liste de clé `cle` sous `atelier`.
func _liste(atelier: Node, cle: String) -> OptionButton:
	for liste in atelier.find_children("*", "OptionButton", true, false):
		if liste.get_meta("cle", "") == cle:
			return liste
	_fautes.append("liste %s absente" % cle)
	return null


## L'article d'id `id` choisi dans la liste de clé `cle`, son signal émis comme au clic.
func _choisir(atelier: Node, cle: String, id: String) -> void:
	var liste := _liste(atelier, cle)
	if liste == null:
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
