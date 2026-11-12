extends SceneTree

## Les échantillons dans l'atelier (#3802, `hotes/godot/pont/CONTRAT.md`, section « Atelier 3D ») : l'atelier ouvert sur un
## pont figé (`PontFige`, `pont_fige.gd`, sur les échantillons figés par la sonde, `hotes/godot/recettes/decor.ts`,
## `figerLeDecor`). Chaque famille servie a sa liste de tête, de clé `modele/<famille>`, qui offre chacune de ses entrées
## dans l'ordre servi. Un décor, la mer, une matière de relief, une matière de toit et un mur crénelé choisis tour à
## tour : à chaque geste, l'atelier envoie l'entrée attendue, et sa scène (`VolumeDeScene`) pose autant de triangles que
## le volume servi (la crête du mur crénelé comprise), chaque arête et chaque nappe de toit servies, et chaque couronne sauf celles que sa brèche abat ;
## seuls les onglets Effets et Outils sont offerts, et aucune erreur ne se signale. « Recharger » garde l'échantillon
## posé.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/decor.json"
## Les images au plus qu'attend la base posée à l'ouverture.
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
		_choisir(atelier, "modele/%s" % entree.famille, entree.id)
		await _images(2)
		_conforme(pont, cle, decor.echantillon[cle], "%s %s" % [entree.famille, entree.id])
		derniere = cle
	atelier._recharger()
	await _images(4)
	_conforme(pont, derniere, decor.echantillon[derniere], "après « Recharger »")
	for faute in _fautes:
		push_error("[atelier-du-decor] " + faute)
	print("[atelier-du-decor] %d échantillons posés, erreurs=%d" % [decor.echantillon.size(), _fautes.size()])
	quit(0 if _fautes.is_empty() else 1)


## L'entrée de clé `cle` envoyée en dernier, et l'échantillon que l'écran publie conforme à la réponse `reponse` de
## `echantillon` : ses triangles, ses arêtes, ses nappes de toit et ses couronnes montrées, sous les seuls onglets Effets
## et Outils, sans erreur.
func _conforme(pont: PontFige, cle: String, reponse: Dictionary, geste: String) -> void:
	_verifier(not pont.entrees.is_empty() and pont.entrees.back() == cle, "%s : entrée %s, attendu %s" % [geste, "aucune" if pont.entrees.is_empty() else pont.entrees.back(), cle])
	var atelier: Dictionary = pont.ecran.get("atelier", {})
	var publie: Variant = atelier.get("echantillon")
	var entree: Dictionary = JSON.parse_string(cle)
	var attendu := {
		famille = entree.famille,
		id = entree.id,
		triangles = reponse.monde.morceaux.reduce(func(somme: int, morceau: Dictionary) -> int: return somme + PackedFloat32Array(morceau.cases).to_byte_array().to_vector3_array().size(), 0),
		aretes = reponse.aretes.size(),
		toits = reponse.toits.size(),
		couronnes = reponse.couronnes.size() - reponse.couronnesAbattues.size(),
	}
	_verifier(publie is Dictionary and attendu.keys().all(func(k: String) -> bool: return int(publie[k]) == attendu[k] if attendu[k] is int else publie[k] == attendu[k]), "%s : échantillon publié %s, attendu %s" % [geste, publie, attendu])
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
