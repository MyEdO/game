extends SceneTree

## Une arête se pose debout à son pied (#3476, `hotes/godot/pont/CONTRAT.md`, méthode `aretes`) :
## `pied` et `hauteurM` sont en mètres, le volume de la scène (`scripts/volume_de_scene.gd`, `poser_les_aretes`) les
## porte à l'échelle de son plateau, en groupes d'instances (#3948), chacune lue à l'instance de son arête
## (`VolumeDeScene.translation_d_instance`, l'instance d'un groupe ne se lit pas sans rendu).
## Sur un plateau de 2 m par case, le mur d'étage du kit, pied à 4 m et haut de 4 m, va de 2 à 4 unités, centré sur le
## côté de sa case, et la boîte d'une arête sans pièce au kit part de 2 unités. Posées à nouveau (#3947), le groupe
## inchangé reste, le groupe dont une arête change est refait, celui de l'arête changée naît, le groupe parti quitte
## l'arbre.
## Une arête dont la famille a un modèle d'arête servi (#4471, `aretes` de la réponse de `modeles`, figée par la sonde
## avec les échantillons de l'atelier, `hotes/godot/recettes/decor.ts`, servie par un `PontFige`, lue par le chargeur
## des décors, `MontageDesModeles`) se pose une fois son modèle lu (`VolumeDeScene.attendre_les_aretes` ; rien avant,
## recette `sortie-de-l-arbre.gd`) : le nœud de sa pièce va de son pied à son pied plus sa hauteur, centré sur le côté
## de sa case, couvrant l'arête de bout en bout quelle que soit sa hauteur, diagonale comprise, sur un plateau de 2 m
## comme de 3 m par case, à l'échelle métrique en épaisseur, son +Z vers son dehors (`(-sens.y, sens.x)`) ; chaque
## surface de chacun de ses maillages, vue et en ombre, dans une matière de la couleur de la palette de l'arête à
## l'emplacement de cette surface, la croisée d'une fenêtre comprise. Posée, lue puis vidée tour à tour
## (`VolumeDeScene.vider`), elle ne fait pas croître les maillages et les matières teints du volume.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/decor.json"
const EPSILON := 0.001
const METRES_PAR_CASE := 2.0
const PIED_M := 4.0
const HAUTEUR_M := 4.0
## La famille du kit des arêtes sans modèle servi que la recette pose.
const FAMILLE_DU_KIT := "pierre"
## La palette des arêtes servies des recettes : celle de `mur-a-ossature-en-bois` (`structureAppearance.json`), son
## accent et son métal pris à `porte`, sa croisée à son meneau.
const PALETTE := {corps = "#cdbb9a", bois = "#43301c", accent = "#5a4632", vet1 = "#3b2e1f", metal = "#b9902f"}
## L'autre plateau où les arêtes servies se recettent bout à bout (`_bout_a_bout`), l'échelle de l'éditeur réglable.
const AUTRES_METRES_PAR_CASE := 3.0
## Les tours de pose, de lecture et de vidage du volume (`_caches_bornes`).
const TOURS_DE_VIDAGE := 4
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-au-pied] version=", Engine.get_version_info().string)
	var decor := servir_le_fige(self, "arete-au-pied")
	if decor.is_empty():
		return
	_du_kit_et_des_boites(_volume_neuf(METRES_PAR_CASE))
	var famille: String = decor.modeles.aretes.keys()[0]
	var modele: String = decor.modeles.aretes[famille]
	await _du_modele_servi(_volume_neuf(METRES_PAR_CASE), famille, decor.modeles.surfaces[modele])
	await _bout_a_bout(_volume_neuf(AUTRES_METRES_PAR_CASE), famille)
	await _caches_bornes(_volume_neuf(METRES_PAR_CASE), famille)
	for faute in _fautes:
		push_error("[arete-au-pied] " + faute)
	print("[arete-au-pied] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le figé `FIGE` servi sous `arbre` par un `PontFige`, ses modèles retenus
## (`MontageDeComposition.retenir_les_modeles`) ; sans modèle d'arête servi, l'erreur dite au nom de `recette`, `arbre`
## quitté en 2 et rien de rendu (`{}`).
static func servir_le_fige(arbre: SceneTree, recette: String) -> Dictionary:
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not decor is Dictionary or decor.modeles.get("aretes", {}).is_empty():
		push_error("[%s] %s : aucun modèle d'arête servi" % [recette, FIGE])
		arbre.quit(2)
		return {}
	PontFige.poser(arbre, decor)
	MontageDeComposition.retenir_les_modeles(decor.modeles, decor.listage)
	return decor


## Les modèles posés (`MontageDesModeles`) du volume `volume`, sous `parent`, avec leur chargeur, comme au plateau.
static func modeles_poses(volume: VolumeDeScene, parent: Node) -> MontageDesModeles:
	var modeles := MontageDesModeles.new()
	modeles.volume = volume
	var chargeur := MontageDeComposition.new()
	chargeur.name = "Chargeur"
	modeles.add_child(chargeur)
	modeles.chargeur = chargeur
	parent.add_child(modeles)
	return modeles


## Un volume neuf sous `parent`, sur un plateau de `metres_par_case`, ses modèles posés sous lui (`modeles_poses`).
static func volume_neuf(parent: Node, metres_par_case: float) -> VolumeDeScene:
	var volume: VolumeDeScene = (load("res://scenes/VolumeDeScene.tscn") as PackedScene).instantiate()
	parent.add_child(volume)
	volume.metres_par_case = metres_par_case
	modeles_poses(volume, volume)
	return volume


## Un volume neuf sous une scène neuve de la racine (`volume_neuf`).
func _volume_neuf(metres_par_case: float) -> VolumeDeScene:
	var scene := Node3D.new()
	root.add_child(scene)
	return volume_neuf(scene, metres_par_case)


## La pièce du kit, les boîtes et leurs groupes, posés puis posés à nouveau.
func _du_kit_et_des_boites(volume: VolumeDeScene) -> void:
	var arete := {milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = PIED_M, hauteurM = HAUTEUR_M,
		palette = {}, piece = Noyau.Piece.MUR, bloc = "0/0/0"}
	var du_kit := arete.merged({cle = "kit", famille = FAMILLE_DU_KIT})
	var boite := arete.merged({cle = "boite", famille = null})
	var voisine := arete.merged({cle = "voisine", famille = null, milieu = {x = 1.0, y = -0.5}}, true)
	var partie := arete.merged({cle = "partie", famille = null, bloc = "0/1/0"}, true)
	volume.poser_les_aretes([du_kit, boite, voisine, partie])
	var aretes := volume.get_node("Aretes")
	var groupes := _groupes(aretes)
	if groupes.keys() != [["kit"], ["boite", "voisine"], ["partie"]]:
		_fautes.append("posées, les groupes sont %s, attendu le kit, les deux boîtes du bloc, la boîte de l'autre bloc"
			% [groupes.keys()])
	else:
		var boites: Node3D = groupes[["boite", "voisine"]]
		var mur := _boite_de(volume, groupes[["kit"]], du_kit)
		_verifier("pièce du kit", mur, PIED_M / METRES_PAR_CASE, (PIED_M + HAUTEUR_M) / METRES_PAR_CASE)
		_centree("pièce du kit", mur, du_kit, EPSILON)
		_verifier("boîte sans pièce", _boite_de(volume, boites, boite), PIED_M / METRES_PAR_CASE, NAN)
		_verifier("boîte voisine", _boite_de(volume, boites, voisine), PIED_M / METRES_PAR_CASE, NAN)
		var ecart := _boite_de(volume, boites, voisine).get_center().x - _boite_de(volume, boites, boite).get_center().x
		if absf(ecart - 1.0) > EPSILON:
			_fautes.append("les deux boîtes du groupe ne sont pas à une case l'une de l'autre")
	if volume.ce_qui_est_pose().aretes != 4:
		_fautes.append("posées, %d arêtes comptées, attendu 4" % volume.ce_qui_est_pose().aretes)
	var seuil := voisine.merged({piece = Noyau.Piece.PORTE_OUVERTE}, true)
	volume.poser_les_aretes([du_kit.duplicate(true), boite.duplicate(true), seuil])
	var reposes := _groupes(aretes)
	if reposes.keys() != [["kit"], ["boite"], ["voisine"]]:
		_fautes.append("posées à nouveau, les groupes sont %s, attendu le kit, la boîte, le seuil" % [reposes.keys()])
	elif groupes.size() == 3:
		if reposes[["kit"]] != groupes[["kit"]]:
			_fautes.append("posé à nouveau, le groupe inchangé n'est pas gardé")
		if reposes.values().has(groupes[["boite", "voisine"]]) or reposes.values().has(groupes[["partie"]]):
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti est gardé")
		var partis: bool = not is_instance_valid(groupes[["boite", "voisine"]]) and not is_instance_valid(groupes[["partie"]])
		if not is_instance_valid(groupes[["kit"]]) or not partis:
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti n'a pas quitté l'arbre")
	if volume.ce_qui_est_pose().aretes != 3:
		_fautes.append("posées à nouveau, %d arêtes comptées, attendu 3" % volume.ce_qui_est_pose().aretes)


## Les pièces du modèle d'arête servi de `famille`, de surfaces `surfaces`, son modèle lu : chacune à son
## pied, à sa hauteur, couvrant son arête de bout en bout (`_couverture`) quelle que soit sa hauteur, en diagonale
## aussi, tournée vers son dehors et peinte dans la matière, la croisée de sa fenêtre comprise ; posées à nouveau,
## leurs groupes gardés.
func _du_modele_servi(volume: VolumeDeScene, famille: String, surfaces: Array) -> void:
	var servie := {famille = famille, palette = PALETTE, piece = Noyau.Piece.MUR, bloc = "0/0/0", pied = PIED_M,
		hauteurM = HAUTEUR_M, sens = {x = 1.0, y = 0.0}}
	var aretes := [
		servie.merged({cle = "est", milieu = {x = 0.0, y = -0.5}}, true),
		servie.merged({cle = "ouest", milieu = {x = 2.0, y = -0.5}, sens = {x = -1.0, y = 0.0}}, true),
		servie.merged({cle = "sud", milieu = {x = 3.5, y = 1.0}, sens = {x = 0.0, y = 1.0}, pied = 0.0}, true),
		servie.merged({cle = "basse", milieu = {x = 5.0, y = -0.5}, hauteurM = 3.0}, true),
		servie.merged({cle = "haute", milieu = {x = 7.0, y = -0.5}, hauteurM = 5.0}, true),
		servie.merged({cle = "diagonale", milieu = {x = 13.0, y = 0.0}, sens = {x = 1.0, y = 1.0}}, true),
		servie.merged({cle = "porte", milieu = {x = 9.0, y = -0.5}, piece = Noyau.Piece.PORTE_FERMEE}, true),
		servie.merged({cle = "fenetre", milieu = {x = 15.0, y = -0.5}, piece = Noyau.Piece.FENETRE}, true),
		servie.merged({cle = "boite", famille = null, palette = {}, milieu = {x = 11.0, y = -0.5}}, true),
	]
	volume.poser_les_aretes(aretes)
	await volume.attendre_les_aretes()
	var groupes := _groupes(volume.get_node("Aretes"))
	var attendus := [["boite"], ["est"], ["ouest"], ["sud"], ["basse"], ["haute"], ["diagonale"], ["porte"], ["fenetre"]]
	if groupes.keys() != attendus:
		_fautes.append("modèle lu, les groupes sont %s, attendu la boîte, puis un par arête servie" % [groupes.keys()])
		return
	for a: Dictionary in aretes.filter(func(a: Dictionary) -> bool: return a.famille != null):
		var groupe: Node3D = groupes[[a.cle]]
		var piece := _boite_de(volume, groupe, a)
		_verifier(a.cle, piece, a.pied / METRES_PAR_CASE, (a.pied + a.hauteurM) / METRES_PAR_CASE)
		if a.piece == Noyau.Piece.MUR:
			_couverture(volume, groupe, a)
		_centree(a.cle, piece, a, EPSILON if a.piece == Noyau.Piece.MUR else 0.5)
		_pose_de_l_instance(volume, groupe, a)
		var peints := _peinte(groupe, a.cle, surfaces)
		if a.piece == Noyau.Piece.FENETRE and not peints.has("vet1"):
			_fautes.append("fenetre : aucune surface de la croisée (vet1) peinte, peintes %s" % [peints])
	volume.poser_les_aretes(aretes.map(func(a: Dictionary) -> Dictionary: return a.duplicate(true)))
	var reposes := _groupes(volume.get_node("Aretes"))
	if reposes.values() != groupes.values() or volume.ce_qui_est_pose().aretes != aretes.size():
		_fautes.append("modèle lu, posées à nouveau, les groupes ne sont pas gardés")


## Sur le volume `volume` d'un autre plateau, les murs servis de `famille`, droits, bas et diagonaux, couvrent chacun
## leur arête de bout en bout (`_couverture`).
func _bout_a_bout(volume: VolumeDeScene, famille: String) -> void:
	var servie := {famille = famille, palette = PALETTE, piece = Noyau.Piece.MUR, bloc = "0/0/0", pied = 0.0,
		hauteurM = HAUTEUR_M, sens = {x = 1.0, y = 0.0}}
	var aretes := [
		servie.merged({cle = "droite", milieu = {x = 0.0, y = -0.5}}, true),
		servie.merged({cle = "basse", milieu = {x = 2.0, y = -0.5}, hauteurM = 3.0}, true),
		servie.merged({cle = "diagonale", milieu = {x = 4.0, y = 0.0}, sens = {x = 1.0, y = 1.0}}, true),
	]
	volume.poser_les_aretes(aretes)
	await volume.attendre_les_aretes()
	var groupes := _groupes(volume.get_node("Aretes"))
	for a: Dictionary in aretes:
		if not groupes.has([a.cle]):
			_fautes.append("à %.1f m par case, %s : aucun groupe posé" % [volume.metres_par_case, a.cle])
			continue
		_couverture(volume, groupes[[a.cle]], a)


## Chaque maillage vu du groupe `groupe`, à l'instance de l'arête `a`, couvre l'arête d'un coin de grille à l'autre :
## projetée sur son sens, la boîte de la pièce va de `milieu - sens / 2` à `milieu + sens / 2`.
func _couverture(volume: VolumeDeScene, groupe: Node3D, a: Dictionary) -> void:
	var sens := Vector3(a.sens.x, 0.0, a.sens.y)
	var axe := sens.normalized()
	var milieu := Vector3(a.milieu.x + MiseEnPage.DEMI_CASE, 0.0, a.milieu.y + MiseEnPage.DEMI_CASE)
	var debut := INF
	var fin := -INF
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var repere := vu.global_transform * Transform3D(Basis.IDENTITY, volume.translation_d_instance(vu, a))
		var boite := vu.multimesh.mesh.get_aabb()
		for coin in range(8):
			var abscisse := axe.dot(repere * boite.get_endpoint(coin) - milieu)
			debut = minf(debut, abscisse)
			fin = maxf(fin, abscisse)
	var demi := sens.length() / 2.0
	if absf(debut + demi) > EPSILON or absf(fin - demi) > EPSILON:
		_fautes.append("à %.1f m par case, %s : couvre de %.4f à %.4f le long de son sens, attendu de %.4f à %.4f"
			% [volume.metres_par_case, a.cle, debut, fin, -demi, demi])


## Sur le volume `volume`, une arête servie de `famille` posée, son modèle lu, puis le volume vidé, `TOURS_DE_VIDAGE`
## fois : les maillages et les matières teints (`_maillage_teint`) gardent la taille du premier tour.
func _caches_bornes(volume: VolumeDeScene, famille: String) -> void:
	var arete := {cle = "mur", famille = famille, palette = PALETTE, piece = Noyau.Piece.MUR, bloc = "0/0/0",
		pied = 0.0, hauteurM = HAUTEUR_M, milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, cases = []}
	var tailles := []
	for tour in TOURS_DE_VIDAGE:
		volume.poser_les_aretes([arete.duplicate(true)])
		await volume.attendre_les_aretes()
		tailles.append([volume._maillages_teints.size(), volume._matieres_teintes.size()])
		volume.vider()
	if not tailles.all(func(t: Array) -> bool: return t == tailles[0]):
		_fautes.append("posée, lue puis vidée %d fois, maillages et matières teints %s, attendu la taille du premier tour"
			% [TOURS_DE_VIDAGE, tailles])


## L'instance de l'arête `a` de chaque maillage vu du groupe `groupe` : à l'échelle métrique en épaisseur, son +Z vers
## le dehors de l'arête.
func _pose_de_l_instance(volume: VolumeDeScene, groupe: Node3D, a: Dictionary) -> void:
	var dehors := Vector3(-a.sens.y, 0.0, a.sens.x).normalized()
	var metrique := MiseEnPage.echelle_metrique(METRES_PAR_CASE)
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var base := (vu.global_transform * Transform3D(Basis.IDENTITY, volume.translation_d_instance(vu, a))).basis
		var echelles := base.get_scale()
		if absf(echelles.z - metrique) > EPSILON:
			_fautes.append("%s, %s : échelle %s, attendue %.4f en épaisseur" % [a.cle, vu.name, echelles, metrique])
		if base.z.normalized().distance_to(dehors) > EPSILON:
			_fautes.append("%s, %s : +Z vers %s, attendu vers le dehors %s" % [a.cle, vu.name, base.z.normalized(), dehors])


## Chaque surface de chaque maillage du groupe `groupe`, vue et en ombre, dans une matière de la couleur de `PALETTE` à
## l'emplacement de sa surface (`surfaces`, par le nom du matériau), la vue prenant pour albédo la couleur de
## l'instance ; rend les emplacements peints, chacun à `true`.
func _peinte(groupe: Node3D, cle: String, surfaces: Array) -> Dictionary:
	var emplacements := {}
	for surface: Dictionary in surfaces:
		emplacements[surface.nom] = surface.palette
	var peints := {}
	for instances: MultiMeshInstance3D in groupe.find_children("*", "MultiMeshInstance3D", true, false):
		var mesh := instances.multimesh.mesh
		for rang in mesh.get_surface_count():
			var matiere: BaseMaterial3D = mesh.surface_get_material(rang)
			var emplacement: Variant = emplacements.get(matiere.resource_name)
			if emplacement == null or not PALETTE.has(emplacement):
				continue
			peints[emplacement] = true
			if not matiere.albedo_color.is_equal_approx(Color(PALETTE[emplacement])):
				_fautes.append("%s, %s, surface %s : albédo %s, attendu %s (%s)" % [cle, instances.name,
					matiere.resource_name, matiere.albedo_color.to_html(false), PALETTE[emplacement], emplacement])
			if matiere.vertex_color_use_as_albedo != instances.name.begins_with("Vu_"):
				_fautes.append("%s, %s, surface %s : la couleur de l'instance n'est l'albédo que de la vue"
					% [cle, instances.name, matiere.resource_name])
	if peints.is_empty():
		_fautes.append("%s : aucune surface peinte de la palette" % cle)
	return peints


## Chaque groupe posé sous `aretes`, par les clés de ses arêtes, et le nombre de ses instances au nombre de ses arêtes.
func _groupes(aretes: Node) -> Dictionary:
	var groupes := {}
	for groupe: Node3D in aretes.get_children():
		var cles: Array = groupe.get_meta("aretes").map(func(a: Dictionary) -> String: return a.cle)
		groupes[cles] = groupe
		for instances: MultiMeshInstance3D in groupe.find_children("*", "MultiMeshInstance3D", true, false):
			if instances.multimesh.instance_count != cles.size():
				_fautes.append("groupe %s : %s porte %d instances" % [cles, instances.name, instances.multimesh.instance_count])
	return groupes


## La boîte, dans le monde, de l'instance de l'arête `a` de chaque maillage vu du groupe `groupe`.
func _boite_de(volume: VolumeDeScene, groupe: Node3D, a: Dictionary) -> AABB:
	var boite := AABB()
	var premiere := true
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var instance := Transform3D(Basis.IDENTITY, volume.translation_d_instance(vu, a))
		var b := vu.global_transform * instance * vu.multimesh.mesh.get_aabb()
		boite = b if premiere else boite.merge(b)
		premiere = false
	if premiere:
		_fautes.append("%s : aucun maillage" % groupe.name)
	return boite


## `boite` centrée, à `ecart` près, sur le côté de la case de l'arête `a`.
func _centree(nom: String, boite: AABB, a: Dictionary, ecart: float) -> void:
	var centre := boite.get_center()
	var attendu := Vector2(a.milieu.x, a.milieu.y) + Vector2.ONE * MiseEnPage.DEMI_CASE
	if absf(centre.x - attendu.x) > ecart or absf(centre.z - attendu.y) > ecart:
		_fautes.append("%s : centrée en %s, hors du côté de sa case" % [nom, centre])


## Le bas de `boite` à `bas`, et son haut à `haut` si `haut` n'est pas `NAN`.
func _verifier(nom: String, boite: AABB, bas: float, haut: float) -> void:
	if absf(boite.position.y - bas) > EPSILON:
		_fautes.append("%s : bas à %.3f, attendu %.3f" % [nom, boite.position.y, bas])
	if not is_nan(haut) and absf(boite.end.y - haut) > EPSILON:
		_fautes.append("%s : haut à %.3f, attendu %.3f" % [nom, boite.end.y, haut])
