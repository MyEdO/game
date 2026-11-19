extends SceneTree

## Les échantillons dans l'atelier (#3802, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier ouvert sur un
## pont figé (`PontFige`, `pont_fige.gd`, sur les échantillons figés par la sonde, `hotes/godot/recettes/decor.ts`,
## `figerLeDecor`). Chaque famille servie a sa liste de tête, de clé `modele/<famille>`, qui offre chacune de ses entrées
## dans l'ordre servi. Un décor sans modèle, un décor servi par son modèle, la mer, une matière de relief, une matière de
## toit, un mur crénelé et un mur de chaque famille d'un modèle d'arête servi (#4471), chacun de ceux-là choisi
## l'atelier au repos (`_choisir_au_repos`), choisis tour à tour : à chaque geste, l'atelier envoie l'entrée attendue,
## et sa scène (`VolumeDeScene`) pose autant de triangles que le volume servi hors des surfaces des décors servis
## (`decors`, la crête du mur crénelé comprise), et le modèle de chaque pose de chaque décor servi
## (`MontageDesModeles.poses`), chaque arête et chaque nappe de toit servies, et chaque couronne sauf celles que sa
## brèche abat ; seuls les onglets Effets et Outils sont offerts, et aucune erreur ne se signale. « Recharger » garde
## l'échantillon posé.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/decor.json"
## Les images au plus qu'attend la base posée à l'ouverture, et chaque modèle d'un échantillon.
const IMAGES_DE_L_OUVERTURE := 600
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[atelier-du-decor] version=", Engine.get_version_info().string)
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not decor is Dictionary:
		push_error("[atelier-du-decor] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	var pont := PontFige.poser(self, decor)
	var atelier: Node = load("res://scenes/Atelier.tscn").instantiate()
	root.add_child(atelier)
	for image in IMAGES_DE_L_OUVERTURE:
		if pont.ecran.get("atelier", {}).get("base") != null:
			break
		await process_frame
	for famille in decor.echantillons[JSON.stringify(null)].familles:
		var liste := _liste(atelier, "modele/%s" % famille.id)
		if liste != null:
			var offertes := range(liste.item_count).map(func(rang: int) -> Variant: return liste.get_item_metadata(rang))
			_verifier(offertes == famille.entrees.map(func(entree: Dictionary) -> String: return entree.id), "modele/%s : %d entrées offertes, attendu les %d servies dans leur ordre" % [famille.id, offertes.size(), famille.entrees.size()])
	var derniere := ""
	for cle: String in decor.echantillon:
		var entree: Dictionary = JSON.parse_string(cle)
		if _d_un_modele_servi(decor.echantillon[cle], decor.modeles.aretes):
			await _choisir_au_repos(atelier, pont, entree)
		else:
			_choisir(atelier, "modele/%s" % entree.famille, entree.id)
		await _images(2)
		await _modeles_poses(atelier, decor.echantillon[cle])
		_conforme(atelier, pont, cle, decor.echantillon[cle], "%s %s" % [entree.famille, entree.id])
		derniere = cle
	atelier._recharger()
	await _images(4)
	_conforme(atelier, pont, derniere, decor.echantillon[derniere], "après « Recharger »")
	for faute in _fautes:
		push_error("[atelier-du-decor] " + faute)
	print("[atelier-du-decor] %d échantillons posés, erreurs=%d" % [decor.echantillon.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## Les arêtes de l'échantillon posées, leurs modèles lus (`VolumeDeScene.attendre_les_aretes`) et l'écran republié
## (publication différée d'une image), et les poses de chaque décor servi par `reponse` (`decors`), dont l'atelier
## attend les modèles (`IMAGES_DE_L_OUVERTURE` images au plus).
func _modeles_poses(atelier: Node, reponse: Dictionary) -> void:
	await (atelier.get_node("Echantillon/Scene") as VolumeDeScene).attendre_les_aretes()
	await _images(2)
	var modeles: MontageDesModeles = atelier.get_node("Echantillon/Scene/Modeles")
	for image in IMAGES_DE_L_OUVERTURE:
		if modeles.poses().size() == _poses_servies(reponse):
			return
		await process_frame


## L'échantillon `entree` choisi l'atelier au repos (`_au_repos` : son clip en pause, ses peaux mesurées, l'écran
## qui ne se republie plus à chaque image), la lecture de son modèle d'arête retenue au pont (`PontFige.retient`)
## jusqu'au repos, puis relâchée : seul ce que le modèle lu signale (`VolumeDeScene.aretes_posees`) en republie l'écran.
func _choisir_au_repos(atelier: Node, pont: PontFige, entree: Dictionary) -> void:
	atelier._mettre_en_pause()
	pont.retient = true
	_choisir(atelier, "modele/%s" % entree.famille, entree.id)
	for image in IMAGES_DE_L_OUVERTURE:
		if _au_repos(atelier) and pont.retenues > 0:
			break
		await process_frame
	_verifier(_au_repos(atelier) and pont.retenues > 0, "%s : atelier au repos %s, %d lecture(s) retenue(s), attendu"
		% [entree.id, _au_repos(atelier), pont.retenues] + " au repos et la lecture du modèle d'arête retenue")
	pont.retient = false
	pont.relache.emit()


## Si une arête de l'échantillon `reponse` a pour famille une de celles dont le modèle d'arête est servi (`aretes`).
static func _d_un_modele_servi(reponse: Dictionary, aretes: Dictionary) -> bool:
	return reponse.aretes.any(func(a: Dictionary) -> bool: return aretes.has(a.famille))


## Si l'atelier `atelier` est au repos : ses peaux mesurées et aucun clip lu, son écran ne se republiant qu'à un geste
## ou à un changement d'état (`atelier.gd`, `_process`).
static func _au_repos(atelier: Node) -> bool:
	return not atelier._peaux_a_mesurer and not (atelier._a_un_clip() and atelier._lecteur().is_playing())


## Le nombre de poses des décors que `reponse` sert (`decors`).
static func _poses_servies(reponse: Dictionary) -> int:
	return reponse.decors.values().reduce(func(somme: int, servi: Dictionary) -> int: return somme + servi.poses.size(), 0)


## Les triangles du volume servi de `reponse` que la scène peint : ceux de chaque surface hors des décors servis
## (`decors`), que leurs modèles montrent.
static func _triangles_peints(reponse: Dictionary) -> int:
	var triangles := 0
	for morceau: Dictionary in reponse.monde.morceaux:
		for surface: Dictionary in morceau.surfaces:
			if not reponse.decors.has(surface.get("decor")):
				triangles += (int(surface.fin) - int(surface.debut)) / 3
	return triangles


## L'entrée de clé `cle` envoyée en dernier, et l'échantillon que l'écran publie conforme à la réponse `reponse` de
## `echantillon` : ses triangles peints (`_triangles_peints`), le modèle de chaque pose de ses décors servis, ses arêtes,
## ses nappes de toit et ses couronnes montrées, sous les seuls onglets Effets et Outils, sans erreur.
func _conforme(ouvert: Node, pont: PontFige, cle: String, reponse: Dictionary, geste: String) -> void:
	_verifier(not pont.entrees.is_empty() and pont.entrees.back() == cle, "%s : entrée %s, attendu %s" % [geste, "aucune" if pont.entrees.is_empty() else pont.entrees.back(), cle])
	var atelier: Dictionary = pont.ecran.get("atelier", {})
	var publie: Variant = atelier.get("echantillon")
	var entree: Dictionary = JSON.parse_string(cle)
	var attendu := {
		famille = entree.famille,
		id = entree.id,
		triangles = _triangles_peints(reponse),
		aretes = reponse.aretes.size(),
		toits = reponse.toits.size(),
		couronnes = reponse.couronnes.size() - reponse.couronnesAbattues.size(),
	}
	_verifier(publie is Dictionary and attendu.keys().all(func(k: String) -> bool: return int(publie[k]) == attendu[k] if attendu[k] is int else publie[k] == attendu[k]), "%s : échantillon publié %s, attendu %s" % [geste, publie, attendu])
	var poses := (ouvert.get_node("Echantillon/Scene/Modeles") as MontageDesModeles).poses().size()
	_verifier(poses == _poses_servies(reponse), "%s : %d modèles de décor posés, attendu les %d poses servies" % [geste, poses, _poses_servies(reponse)])
	_verifier(atelier.get("onglets") == ["effets", "outils"], "%s : onglets offerts %s, attendu Effets et Outils" % [geste, atelier.get("onglets")])
	_verifier(atelier.get("erreurs", []).is_empty(), "%s : erreurs %s" % [geste, atelier.get("erreurs")])
	print("[atelier-du-decor] %s : %s" % [geste, JSON.stringify(publie)])


func _images(n: int) -> void:
	for i in n:
		await process_frame


## La liste de tête de clé `cle` sous `atelier`.
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


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
