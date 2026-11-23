extends SceneTree

## Une coque terrestre se montre par le monde (#4471, `hotes/godot/pont/CONTRAT.md`, section « Corps d'un combattant »,
## `coques`), sur le noyau vivant (`TransportDuProcessus`, `--pont=<chemin>` après `--`), la partie du scénario
## `coque-terrestre` sur son pont espion (`PontEspion`) et son combat (`scenes/Combat.tscn`). En exploration, la
## diligence est servie parmi les coques, sans stations ni flottaison, et son modèle est monté au monde
## (`MontageDesModeles`), son origine au point de la carte du centre de son empreinte, à l'échelle métrique du plateau
## (la boîte de sa scène posée, celle de sa scène nue à cette échelle), tournée vers son cap ; l'exploration ne la
## nomme pas et aucun nom ne flotte au-dessus d'elle ; chaque mesh de son modèle porte le voile de sa clé
## (`VolumeDeScene.voile`), lié à la vision posée, et ses cases lisent leur état au masque servi. Le premier pas du
## groupe ouvre le combat : la diligence n'est pas servie parmi les véhicules, son modèle reste le même, au même lieu,
## et c'est le seul modèle de son élément dans l'arbre ; son combattant, s'il est dessiné, n'a aucun véhicule monté.
## Le code de sortie dit le verdict : 0 tenu, 1 une faute.

const RECETTE_AUTONOME := true
const COMBAT := "res://scenes/Combat.tscn"
## L'attente la plus longue d'un état : le lancement du processus et le démarrage de la partie compris.
const ATTENTE_S := 120.0
const SCENARIO := "coque-terrestre"
const COQUE := "diligence"
const ELEMENT := "vehicule--diligence"
## Le centre de l'empreinte de 2 × 2 cases de la diligence, son coin nord-ouest en (6, 3).
const CENTRE := Vector2(6.5, 3.5)
## La case du premier pas du groupe, dans la bande qui ouvre le combat.
const PAS := Vector3i(3, 4, 0)
const EPSILON := 0.001
var _fautes: Array[String] = []
var _signales: Array[String] = []


## Le pont espion sur la partie du scénario `scenario`.
class PontDuScenario extends PontEspion:
	var scenario := ""

	func parametre(cle: String) -> String:
		return scenario if cle == "scenario" else super(cle)


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[coque-terrestre] version=", Engine.get_version_info().string)
	var pont := PontDuScenario.new()
	pont.scenario = SCENARIO
	PontDuNoyau.remplacer(self, pont)
	pont.panne.connect(func(message: String) -> void: _signales.append("panne : " + message))
	pont.refus.connect(func(message: String) -> void: _signales.append("refus : " + message))
	var combat: Node = (load(COMBAT) as PackedScene).instantiate()
	root.add_child(combat)
	var plateau: Plateau = combat.get_node("Plateau")
	if await _attendre(func() -> bool: return plateau.coques().has(COQUE) and (plateau.get_node("Monde") as Monde).volume.get("_vision") != null, "le modèle de la diligence posé"):
		var modele := await _exploration(pont, combat, plateau)
		if modele != null:
			await _combat(combat, plateau, modele)
	_fautes.append_array(_signales)
	combat.queue_free()
	await create_timer(Foyer.SON_LIBERE_S).timeout
	for faute in _fautes:
		push_error("[coque-terrestre] " + faute)
	print("[coque-terrestre] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## L'exploration vérifiée ; rend la scène posée du modèle de la diligence, `null` sans elle.
func _exploration(pont: PontEspion, combat: Node, plateau: Plateau) -> Node3D:
	var vue: Dictionary = combat.get("_vue")
	var monde: Monde = plateau.get_node("Monde")
	var servie: Dictionary = vue.corps.coques[COQUE]
	_verifier(servie.corps.element == ELEMENT and servie.corps.taille == "reelle" and servie.corps.cap == "E", "exploration : la diligence servie sous %s" % [servie.corps])
	_verifier(not servie.has("stations") and not servie.has("flottaison"), "exploration : la diligence servie avec des stations ou une flottaison")
	_verifier(Vector2(servie.centre.x, servie.centre.y).is_equal_approx(CENTRE), "exploration : centre servi %s, attendu %s" % [servie.centre, CENTRE])
	var metres_par_case: float = vue.plateau.metresParCase
	var montage: MontageDeVehicule = (plateau.get_node("Modeles") as MontageDesModeles).get("_montes")[COQUE]
	var scene := montage.scene
	var origine := MiseEnPage.point_de_la_carte(CENTRE.x, CENTRE.y, 0.0)
	_verifier(scene.global_position.distance_to(origine) < EPSILON, "exploration : l'origine du modèle en %s, attendu %s" % [scene.global_position, origine])
	var echelle := MiseEnPage.echelle_metrique(metres_par_case)
	_verifier(scene.global_basis.get_scale().is_equal_approx(Vector3(echelle, echelle, echelle)), "exploration : modèle à l'échelle %s, attendu %.3f" % [scene.global_basis.get_scale(), echelle])
	var proue := scene.global_basis.z.normalized()
	_verifier(proue.is_equal_approx(Vector3.RIGHT), "exploration : la proue (+Z) tournée vers %s, attendu l'est %s" % [proue, Vector3.RIGHT])
	var boite: AABB = MontageDeVehicule.boite(scene, plateau)
	var longueur := maxf(boite.size.x, boite.size.z) * metres_par_case
	var milieu := boite.get_center()
	print("[coque-terrestre] boîte %.2f × %.2f m, haute de %.2f m, son milieu à %s pour une empreinte de %.1f m centrée en %s" % [boite.size.x * metres_par_case, boite.size.z * metres_par_case, boite.size.y * metres_par_case, Vector2(milieu.x, milieu.z), 2.0 * metres_par_case, Vector2(origine.x, origine.z)])
	var entites: Array = vue.projection.exploration.entites.liste.map(func(e: Dictionary) -> String: return e.id)
	_verifier(not entites.has(COQUE), "exploration : la diligence nommée parmi les entités %s" % [entites])
	var noms: Array = monde.get("_etiquettes").get_children().map(func(n: Label3D) -> String: return n.text)
	_verifier(not noms.has("La diligence"), "exploration : un nom flotte au-dessus de la diligence (%s)" % [noms])
	var voile := monde.volume.voile(COQUE)
	var meshes := scene.find_children("*", "MeshInstance3D", true, false)
	_verifier(not meshes.is_empty() and meshes.all(func(m: MeshInstance3D) -> bool: return m.material_overlay == voile), "exploration : un mesh de la diligence sans son voile")
	_verifier(voile.get_shader_parameter("vision") == monde.volume.get("_vision_neuve"), "exploration : le voile de la diligence n'est pas lié à la vision posée")
	var masque := Marshalls.base64_to_raw(pont.reponses.get("vision", {}).get("masque", ""))
	var largeur := int(pont.reponses.vision.largeur)
	for dy in 2:
		for dx in 2:
			var case := Vector2i(6 + dx, 3 + dy)
			_verifier(monde.volume.etat_de_la_case(case, 0) == masque[case.y * largeur + case.x], "exploration : la case %s de la diligence ne lit pas son état servi" % case)
	print("[coque-terrestre] exploration : %d meshes voilés, longueur %.2f m" % [meshes.size(), longueur])
	return scene


## Le premier pas du groupe, puis le combat vérifié : la diligence, même modèle, au même lieu, seul de son élément.
func _combat(combat: Node, plateau: Plateau, modele: Node3D) -> void:
	var lieu := modele.global_transform
	plateau.case_cliquee.emit(PAS)
	if not await _attendre(func() -> bool: return combat.get("_vue").projection.combat != null, "le combat ouvert au premier pas"):
		return
	var vue: Dictionary = combat.get("_vue")
	_verifier(not vue.corps.vehicules.has(COQUE), "combat : la diligence servie parmi les véhicules")
	_verifier(vue.corps.coques.has(COQUE) and plateau.coques().has(COQUE), "combat : la diligence n'est plus posée au monde")
	var montage: MontageDeVehicule = (plateau.get_node("Modeles") as MontageDesModeles).get("_montes")[COQUE]
	_verifier(montage.scene == modele and modele.global_transform.is_equal_approx(lieu), "combat : le modèle de la diligence remonté ou déplacé")
	var montes := root.find_children("*", "MontageDeVehicule", true, false).filter(func(m: MontageDeVehicule) -> bool: return m.element == ELEMENT)
	_verifier(montes.size() == 1, "combat : %d modèles de %s dans l'arbre, attendu un" % [montes.size(), ELEMENT])
	var dessines: Dictionary = plateau.get("_modeles")
	if dessines.has(COQUE):
		_verifier((dessines[COQUE] as Combattant).get_node("Vehicule").get("scene") == null, "combat : le combattant de la diligence monte un véhicule")
	print("[coque-terrestre] combat : diligence dessinée %s, %d modèle(s) de %s" % [dessines.has(COQUE), montes.size(), ELEMENT])


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
