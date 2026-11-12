extends SceneTree

## Le dégagement ne redemande aucune géométrie (#3948, `hotes/godot/pont/CONTRAT.md`, section « Monde », `retrait`). Le
## combat (`scenes/Combat.tscn`, `scripts/combat.gd`) ouvert sur un pont figé (`PontDuDegagement`, sur « La fenêtre des
## écuries » figée par la sonde, `hotes/godot/recettes/degagement.ts`) démarre la partie de l'adresse figée ; chaque
## fenêtre de l'entrée passée par le bouton de son geste en focus, il a demandé le manifeste du monde (`monde`), ses
## morceaux (`morceaux`) et le masque du regard (`retrait`), une fois chacun. Le clic du champ sur la case figée, émis
## par le plateau (`Plateau.case_cliquee`), change l'empreinte du masque sans changer la clé du monde : il ne demande
## alors que le masque, ni `monde` ni `morceaux` ; les nœuds des morceaux du volume (`VolumeDeScene`, sous
## `Volume/Morceaux`) restent les mêmes, leurs maillages aussi, et le masque posé est le neuf : la case qu'il retire et
## que l'ancien gardait est retirée (`VolumeDeScene.retiree`), celle qu'il rend, s'il en rend une, ne l'est plus. Aucune
## entrée n'est hors du figé.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/degagement.json"
const COMBAT := "res://scenes/Combat.tscn"
## Les images au plus qu'attend une partie démarrée.
const IMAGES_D_ATTENTE := 600
## Les fenêtres de l'entrée au plus que la recette passe.
const FENETRES_AU_PLUS := 10
var _fautes: Array[String] = []


## Le pont figé du dégagement : il garde chaque méthode appelée, dans l'ordre, et chaque réponse refusée, et n'expose
## rien à une page qu'il n'a pas.
class PontDuDegagement extends PontFige:
	var appels: Array[String] = []
	var refusees: Array[String] = []

	func appeler(methode: String, entree: Variant = null) -> Dictionary:
		appels.append(methode)
		var reponse := super(methode, entree)
		if reponse.get("ok") == false:
			refusees.append("%s : %s" % [methode, reponse.erreur.message])
		return reponse

	func exposer(_nom: String, _rappel: Callable) -> void:
		pass


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[degagement-du-combat] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[degagement-du-combat] %s : aucun dégagement figé" % FIGE)
		quit(2)
		return
	var pont := PontDuDegagement.new(lu)
	PontDuNoyau.remplacer(self, pont)
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	await _derouler(lu, pont, combat)
	_verifier(pont.refusees.is_empty(), "réponses refusées : %s" % [pont.refusees])
	print("[degagement-du-combat] appels : %s" % [pont.appels])
	combat.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[degagement-du-combat] " + faute)
	print("[degagement-du-combat] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Les fenêtres passées, puis le clic du champ, arrêtés à la première attente vaine.
func _derouler(lu: Dictionary, pont: PontDuDegagement, combat: Node) -> void:
	if not await _attendre(func() -> bool: return not combat.get("_vue").is_empty(), "la partie démarrée"):
		return
	for pas in FENETRES_AU_PLUS:
		var vue: Dictionary = combat.get("_vue")
		if vue.projection.get("fenetre") == null:
			break
		var focus: Array = vue.zones["fenetre.gestes"].filter(func(g: Dictionary) -> bool: return g.type == "bouton" and g.focus)
		if focus.is_empty() or not _presser(combat, focus[0].id):
			return
	_verifier(combat.get("_vue").projection.get("fenetre") == null, "fenêtres encore ouvertes après %d" % FENETRES_AU_PLUS)
	for methode in ["monde", "morceaux", "retrait"]:
		_verifier(pont.appels.count(methode) == 1, "avant le clic, `%s` appelé %d fois, attendu une" % [methode, pont.appels.count(methode)])
	var volume: VolumeDeScene = (combat.get_node("Plateau/Monde") as Monde).volume
	var poses := _morceaux_de(volume)
	_verifier(poses.size() == lu.monde["null"].monde.morceaux.size(), "%d morceaux posés, le manifeste en nomme %d" % [poses.size(), lu.monde["null"].monde.morceaux.size()])
	var retiree: Dictionary = lu.retireeParLeClic
	var rendue: Variant = lu.rendueParLeClic
	_verifier(not _retiree(volume, retiree), "avant le clic, la case %s déjà retirée" % [retiree])
	if rendue != null:
		_verifier(_retiree(volume, rendue), "avant le clic, la case %s pas retirée" % [rendue])
	pont.fige.retrait = lu.retraitDuClic
	pont.fige.vision = lu.visionDuClic
	var depuis := pont.appels.size()
	(combat.get_node("Plateau") as Plateau).case_cliquee.emit(Vector3i(int(lu.case.x), int(lu.case.y), 0))
	var au_clic := pont.appels.slice(depuis)
	print("[degagement-du-combat] au clic : %s" % [au_clic])
	_verifier(au_clic.count("jouer") == 1, "au clic, `jouer` appelé %d fois, attendu une" % au_clic.count("jouer"))
	_verifier(au_clic.count("retrait") == 1, "au clic, `retrait` appelé %d fois, attendu une" % au_clic.count("retrait"))
	for methode in ["monde", "morceaux"]:
		_verifier(not au_clic.has(methode), "au clic, `%s` redemandé" % methode)
	var reposes := _morceaux_de(volume)
	_verifier(reposes == poses, "au clic, les nœuds ou les maillages des morceaux changent : %s puis %s" % [poses, reposes])
	_verifier(_retiree(volume, retiree), "après le clic, la case %s pas retirée" % [retiree])
	if rendue != null:
		_verifier(not _retiree(volume, rendue), "après le clic, la case %s encore retirée" % [rendue])


## Par nom, le nœud de chaque morceau posé du volume `volume` et les maillages de ses instances `Vu` et `Ombre`.
func _morceaux_de(volume: VolumeDeScene) -> Dictionary:
	var poses := {}
	for noeud in volume.get_node("Volume/Morceaux").get_children():
		poses[noeud.name] = [noeud, (noeud.get_node("Vu") as MeshInstance3D).mesh, (noeud.get_node("Ombre") as MeshInstance3D).mesh]
	return poses


## Si le masque posé au volume `volume` retire la case figée `figee` (`{ case, rangee }`).
func _retiree(volume: VolumeDeScene, figee: Dictionary) -> bool:
	return volume.retiree(Vector2i(int(figee.case.x), int(figee.case.y)), int(figee.rangee))


## Le bouton de l'élément d'id `id` pressé, comme au clic ; `false` et une faute sans lui.
func _presser(combat: Node, id: String) -> bool:
	for bouton: BaseButton in combat.get_node("Ecran").find_children("*", "BaseButton", true, false):
		if bouton.owner != null and bouton.owner.get_meta(Zone.META, "") == "bouton/%s" % id:
			bouton.pressed.emit()
			return true
	_fautes.append("bouton %s absent" % id)
	return false


## Les images attendues jusqu'à ce que `pret` soit vrai, `false` et une faute `quoi` au bout de `IMAGES_D_ATTENTE`.
func _attendre(pret: Callable, quoi: String) -> bool:
	for image in IMAGES_D_ATTENTE:
		if pret.call():
			return true
		await process_frame
	_fautes.append("%s : rien après %d images" % [quoi, IMAGES_D_ATTENTE])
	return false


func _verifier(vrai: bool, faute: String) -> void:
	if not vrai:
		_fautes.append(faute)
