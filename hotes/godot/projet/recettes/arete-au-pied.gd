extends SceneTree

## Une arête se pose debout à son pied (#3476, `hotes/godot/pont/CONTRAT.md`, méthode `aretes`) :
## `pied` et `hauteurM` sont en mètres, le volume de la scène (`scripts/volume_de_scene.gd`, `poser_les_aretes`) les
## porte à l'échelle de son plateau, en groupes d'instances (#3948), chacune lue à l'instance de son arête
## (`VolumeDeScene.transform_d_instance`, l'instance d'un groupe ne se lit pas sans rendu).
## Sur un plateau de 2 m par case, la boîte d'une arête sans modèle servi, de famille nulle ou d'une famille qu'aucun
## modèle ne sert, pied à 4 m, part de 2 unités, centrée sur le côté de sa case. Posées à nouveau (#3947), le groupe
## inchangé reste, le groupe dont une arête change est refait, celui de l'arête changée naît, le groupe parti quitte
## l'arbre.
## Une arête dont la famille a un modèle d'arête servi (#4471, `aretes` de la réponse de `modeles`, figée par la sonde
## avec les échantillons de l'atelier, `hotes/godot/recettes/decor.ts`, servie par un `PontFige`, lue par le chargeur
## des décors, `MontageDesModeles`) se pose une fois son modèle lu (`VolumeDeScene.attendre_les_aretes` ; rien avant,
## recette `sortie-de-l-arbre.gd`) : pour chaque famille servie, le nœud de chacune de ses pièces (mur, portes,
## fenêtres, brèche, échelle haute du dénivelé de ses cases) va de son pied à son pied plus sa hauteur, centré sur le
## côté de sa case, le mur couvrant l'arête de bout en bout quelle que soit sa hauteur, muret d'un mètre et diagonale compris, sur un plateau de 2 m comme de 3 m
## par case, à l'échelle métrique en épaisseur, son +Z vers son dehors (`(-sens.y, sens.x)`) ; chaque surface de chacun
## de ses maillages, vue et en ombre, dans une matière de la couleur de la palette de l'arête (figée avec le décor,
## `paletteDesAretes`) à l'emplacement de cette surface, qu'elle porte, la croisée d'une fenêtre comprise ; chaque
## surface d'une matière texturée au projet porte sa texture neutre, teinte de la palette, son relief, projetée sur les
## trois axes de la pièce, un motif tous les `MiseEnPage.METRES_PAR_MOTIF` de la pièce posée sur chaque axe quel que
## soit son étirement (#4471), chaque surface du modèle d'une matière texturée, et sa surface `corps` s'il en a une,
## l'étant sur l'une de ses pièces, au moins une par famille. Posée,
## lue puis vidée tour à tour (`VolumeDeScene.vider`), elle ne fait pas croître les maillages et les matières teints du
## volume. Les deux portes d'une ouverture de deux arêtes ont chacune leur groupe, et pour pièce le nœud
## `<pièce>--<position>` du modèle quand il l'a, sinon `<pièce>` (`VolumeDeScene.noeud_de_la_piece`) ; une pièce que le
## modèle n'a pas se pose hors de lui.
## Une arête dont le modèle servi ne se lit pas se pose en boîte une fois sa lecture close, l'erreur dite une fois
## (`ERREURS_ATTENDUES`) ; posée à nouveau, en boîte, son modèle n'est pas relu.

const RECETTE_AUTONOME := true
## L'erreur que dit la lecture du modèle `MODELE_ILLISIBLE` (`VolumeDeScene._lire_le_modele_d_arete`), une fois
## (`hotes/godot/construire.mjs`, `erreursDeLaRecette`).
const ERREURS_ATTENDUES := ["[aretes] modele-absent : absent-du-listage"]
## Un id de modèle que le listage du figé n'a pas, servi à la famille `FAMILLE_ILLISIBLE` (`_d_un_modele_illisible`).
const MODELE_ILLISIBLE := "absent-du-listage"
const FAMILLE_ILLISIBLE := "illisible"
const FIGE := "res://recettes/vues/decor.json"
const EPSILON := 0.001
const METRES_PAR_CASE := 2.0
const PIED_M := 4.0
const HAUTEUR_M := 4.0
## Une famille qu'aucun modèle d'arête du figé ne sert (`servir_le_fige`).
const FAMILLE_SANS_MODELE := "sans-modele"
## L'autre plateau où les arêtes servies se recettent bout à bout (`_bout_a_bout`), l'échelle de l'éditeur réglable.
const AUTRES_METRES_PAR_CASE := 3.0
## La hauteur, en mètres, d'un muret (`wallHeightM` de `mur-en-pierres-seches`, `structureAppearance.json`).
const MURET_M := 1.0
## Les tours de pose, de lecture et de vidage du volume (`_caches_bornes`).
const TOURS_DE_VIDAGE := 4
var _fautes: Array[String] = []
## La palette des arêtes servies, figée avec le décor (`paletteDesAretes`, `hotes/godot/recettes/decor.ts`).
var _palette := {}


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arete-au-pied] version=", Engine.get_version_info().string)
	var decor := servir_le_fige(self, "arete-au-pied")
	if decor.is_empty():
		return
	_palette = decor.paletteDesAretes
	_des_boites(_volume_neuf(METRES_PAR_CASE))
	_noeud_de_la_piece()
	for famille: String in decor.modeles.aretes:
		var avant := _fautes.size()
		var modele: String = decor.modeles.aretes[famille]
		await _du_modele_servi(_volume_neuf(METRES_PAR_CASE), famille, decor.modeles.surfaces[modele])
		await _ouverture_de_deux(_volume_neuf(METRES_PAR_CASE), famille)
		await _bout_a_bout(_volume_neuf(AUTRES_METRES_PAR_CASE), famille)
		await _caches_bornes(_volume_neuf(METRES_PAR_CASE), famille)
		for rang in range(avant, _fautes.size()):
			_fautes[rang] = "%s, %s" % [famille, _fautes[rang]]
	await _d_un_modele_illisible(_volume_neuf(METRES_PAR_CASE))
	for faute in _fautes:
		push_error("[arete-au-pied] " + faute)
	print("[arete-au-pied] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Le figé `FIGE` servi sous `arbre` par un `PontFige`, ses modèles retenus
## (`MontageDeComposition.retenir_les_modeles`) ; sans modèle d'arête servi, s'il en sert un à `FAMILLE_SANS_MODELE`, ou
## sans palette des arêtes servies (`paletteDesAretes`), l'erreur dite au nom de `recette`, `arbre` quitté en 2 et rien
## de rendu (`{}`).
static func servir_le_fige(arbre: SceneTree, recette: String) -> Dictionary:
	var decor: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not decor is Dictionary or decor.modeles.get("aretes", {}).is_empty() or decor.modeles.aretes.has(FAMILLE_SANS_MODELE) \
			or decor.get("paletteDesAretes", {}).is_empty():
		push_error("[%s] %s : aucun modèle d'arête servi, un servi à %s, ou aucune palette des arêtes servies"
			% [recette, FIGE, FAMILLE_SANS_MODELE])
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


## Les boîtes des arêtes sans modèle servi et leurs groupes, posés puis posés à nouveau.
func _des_boites(volume: VolumeDeScene) -> void:
	var arete := {milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}, pied = PIED_M, hauteurM = HAUTEUR_M,
		palette = {}, piece = Noyau.Piece.MUR, position = Noyau.Position.SEULE, bloc = "0/0/0"}
	var sans_modele := arete.merged({cle = "sans-modele", famille = FAMILLE_SANS_MODELE})
	var boite := arete.merged({cle = "boite", famille = null})
	var voisine := arete.merged({cle = "voisine", famille = null, milieu = {x = 1.0, y = -0.5}}, true)
	var partie := arete.merged({cle = "partie", famille = null, bloc = "0/1/0"}, true)
	volume.poser_les_aretes([sans_modele, boite, voisine, partie])
	var aretes := volume.get_node("Aretes")
	var groupes := _groupes(aretes)
	if groupes.keys() != [["sans-modele"], ["boite", "voisine"], ["partie"]]:
		_fautes.append("posées, les groupes sont %s, attendu la boîte sans modèle, les deux du bloc, celle de l'autre bloc"
			% [groupes.keys()])
	else:
		var boites: Node3D = groupes[["boite", "voisine"]]
		var mur := _boite_de(volume, groupes[["sans-modele"]], sans_modele)
		_verifier("boîte sans modèle", mur, PIED_M / METRES_PAR_CASE, NAN)
		_centree("boîte sans modèle", mur, sans_modele, EPSILON)
		_verifier("boîte sans famille", _boite_de(volume, boites, boite), PIED_M / METRES_PAR_CASE, NAN)
		_centree("boîte sans famille", _boite_de(volume, boites, boite), boite, EPSILON)
		_verifier("boîte voisine", _boite_de(volume, boites, voisine), PIED_M / METRES_PAR_CASE, NAN)
		var ecart := _boite_de(volume, boites, voisine).get_center().x - _boite_de(volume, boites, boite).get_center().x
		if absf(ecart - 1.0) > EPSILON:
			_fautes.append("les deux boîtes du groupe ne sont pas à une case l'une de l'autre")
	if volume.ce_qui_est_pose().aretes != 4:
		_fautes.append("posées, %d arêtes comptées, attendu 4" % volume.ce_qui_est_pose().aretes)
	var seuil := voisine.merged({piece = Noyau.Piece.PORTE_OUVERTE}, true)
	volume.poser_les_aretes([sans_modele.duplicate(true), boite.duplicate(true), seuil])
	var reposes := _groupes(aretes)
	if reposes.keys() != [["sans-modele"], ["boite"], ["voisine"]]:
		_fautes.append("posées à nouveau, les groupes sont %s, attendu la boîte sans modèle, la boîte, le seuil"
			% [reposes.keys()])
	elif groupes.size() == 3:
		if reposes[["sans-modele"]] != groupes[["sans-modele"]]:
			_fautes.append("posé à nouveau, le groupe inchangé n'est pas gardé")
		if reposes.values().has(groupes[["boite", "voisine"]]) or reposes.values().has(groupes[["partie"]]):
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti est gardé")
		var partis: bool = not is_instance_valid(groupes[["boite", "voisine"]]) and not is_instance_valid(groupes[["partie"]])
		if not is_instance_valid(groupes[["sans-modele"]]) or not partis:
			_fautes.append("posés à nouveau, le groupe changé ou le groupe parti n'a pas quitté l'arbre")
	if volume.ce_qui_est_pose().aretes != 3:
		_fautes.append("posées à nouveau, %d arêtes comptées, attendu 3" % volume.ce_qui_est_pose().aretes)


## Chaque pièce que le modèle d'arête servi de `famille` a, de surfaces `surfaces`, son modèle lu : à son pied, à sa
## hauteur, tournée vers son dehors et peinte dans la matière, la croisée de sa fenêtre comprise si le modèle en a une ;
## le mur couvrant son arête de bout en bout (`_couverture`) quelle que soit sa hauteur, muret et diagonale compris ;
## posées à nouveau, leurs groupes gardés.
func _du_modele_servi(volume: VolumeDeScene, famille: String, surfaces: Array) -> void:
	var servie := {famille = famille, palette = _palette, piece = Noyau.Piece.MUR,
		position = Noyau.Position.SEULE, bloc = "0/0/0", pied = PIED_M,
		hauteurM = HAUTEUR_M, sens = {x = 1.0, y = 0.0}}
	var croisee := surfaces.any(func(s: Dictionary) -> bool: return s.palette == "vet1")
	var texturees := {}
	var aretes := [
		servie.merged({cle = "est", milieu = {x = 0.0, y = -0.5}}, true),
		servie.merged({cle = "ouest", milieu = {x = 2.0, y = -0.5}, sens = {x = -1.0, y = 0.0}}, true),
		servie.merged({cle = "sud", milieu = {x = 3.5, y = 1.0}, sens = {x = 0.0, y = 1.0}, pied = 0.0}, true),
		servie.merged({cle = "basse", milieu = {x = 5.0, y = -0.5}, hauteurM = 3.0}, true),
		servie.merged({cle = "haute", milieu = {x = 7.0, y = -0.5}, hauteurM = 5.0}, true),
		servie.merged({cle = "muret", milieu = {x = 17.0, y = -0.5}, hauteurM = MURET_M}, true),
		servie.merged({cle = "diagonale", milieu = {x = 13.0, y = 0.0}, sens = {x = 1.0, y = 1.0}}, true),
		servie.merged({cle = "porte", milieu = {x = 9.0, y = -0.5}, piece = Noyau.Piece.PORTE_FERMEE}, true),
		servie.merged({cle = "ouverte", milieu = {x = 19.0, y = -0.5}, piece = Noyau.Piece.PORTE_OUVERTE}, true),
		servie.merged({cle = "fenetre", milieu = {x = 15.0, y = -0.5}, piece = Noyau.Piece.FENETRE}, true),
		servie.merged({cle = "close", milieu = {x = 21.0, y = -0.5}, piece = Noyau.Piece.FENETRE_CLOSE}, true),
		servie.merged({cle = "breche", milieu = {x = 23.0, y = -0.5}, piece = Noyau.Piece.BRECHE}, true),
		servie.merged({cle = "echelle", milieu = {x = 25.0, y = -0.5}, piece = Noyau.Piece.ECHELLE, hauteurM = 3.0}, true),
		servie.merged({cle = "boite", famille = null, palette = {}, milieu = {x = 11.0, y = -0.5}}, true),
	]
	volume.poser_les_aretes(aretes)
	await volume.attendre_les_aretes()
	var groupes := _groupes(volume.get_node("Aretes"))
	var attendus := [["boite"]] + aretes.filter(func(a: Dictionary) -> bool: return a.famille != null).map(
		func(a: Dictionary) -> Array: return [a.cle])
	if groupes.keys() != attendus:
		_fautes.append("modèle lu, les groupes sont %s, attendu la boîte, puis un par arête servie" % [groupes.keys()])
		return
	var lu: Node = volume._modeles_d_arete[VolumeDeScene.modele_servi("aretes", famille)].scene
	for a: Dictionary in aretes.filter(func(a: Dictionary) -> bool: return a.famille != null and lu.has_node(a.piece)):
		var groupe: Node3D = groupes[[a.cle]]
		var piece := _boite_de(volume, groupe, a)
		_verifier(a.cle, piece, a.pied / METRES_PAR_CASE, (a.pied + a.hauteurM) / METRES_PAR_CASE)
		if a.piece == Noyau.Piece.MUR:
			_couverture(volume, groupe, a)
		_centree(a.cle, piece, a, EPSILON if a.piece == Noyau.Piece.MUR else 0.5)
		_pose_de_l_instance(volume, groupe, a)
		var peints := _peinte(groupe, a.cle, surfaces)
		texturees.merge(_texturee(groupe, a, surfaces))
		if a.piece == Noyau.Piece.FENETRE and croisee and not peints.has("vet1"):
			_fautes.append("fenetre : aucune surface de la croisée (vet1) peinte, peintes %s" % [peints])
	for surface: Dictionary in surfaces:
		if (_de_matiere_texturee(surface) or surface.palette == "corps") and not texturees.has(surface.nom):
			_fautes.append("surface %s (%s) : sa matière %s est texturée au projet ou du corps, aucune de ses pièces ne la porte texturée"
				% [surface.nom, surface.palette, surface.matiere])
	if texturees.is_empty():
		_fautes.append("aucune surface texturée contrôlée, surfaces %s" % [surfaces.map(func(s: Dictionary) -> String: return s.nom)])
	volume.poser_les_aretes(aretes.map(func(a: Dictionary) -> Dictionary: return a.duplicate(true)))
	var reposes := _groupes(volume.get_node("Aretes"))
	if reposes.values() != groupes.values() or volume.ce_qui_est_pose().aretes != aretes.size():
		_fautes.append("modèle lu, posées à nouveau, les groupes ne sont pas gardés")


## Sur le volume `volume`, la famille `FAMILLE_ILLISIBLE` servie par `MODELE_ILLISIBLE`, que le listage n'a pas
## (`MontageDeComposition.scene_du_modele` le rend `null`, `modele-absent`) : son arête se pose en boîte une fois la
## lecture close ; posée à nouveau, en boîte, le modèle n'est pas relu (`aretes_posees` émis une seule fois) ; les
## modèles retenus rendus ensuite.
func _d_un_modele_illisible(volume: VolumeDeScene) -> void:
	var retenus := MontageDeComposition.modeles
	MontageDeComposition.modeles = retenus.merged({aretes = {FAMILLE_ILLISIBLE: MODELE_ILLISIBLE}}, true)
	var lectures := [0]
	volume.aretes_posees.connect(func() -> void: lectures[0] += 1)
	var arete := {cle = "illisible", famille = FAMILLE_ILLISIBLE, palette = _palette, piece = Noyau.Piece.MUR,
		position = Noyau.Position.SEULE, bloc = "0/0/0", pied = PIED_M, hauteurM = HAUTEUR_M,
		milieu = {x = 0.0, y = -0.5}, sens = {x = 1.0, y = 0.0}}
	volume.poser_les_aretes([arete])
	await volume.attendre_les_aretes()
	_seule_boite(volume, "lu")
	volume.poser_les_aretes([arete.duplicate(true)])
	_seule_boite(volume, "posé à nouveau")
	print("[arete-au-pied] modèle illisible : en lecture %s, %d lecture(s) close(s)" % [volume.aretes_en_lecture(), lectures[0]])
	if volume.aretes_en_lecture() or lectures[0] != 1:
		_fautes.append("modèle illisible, posé à nouveau : en lecture %s, %d lectures closes, attendu une" % [volume.aretes_en_lecture(), lectures[0]])
	MontageDeComposition.modeles = retenus


## Sur le volume `volume`, l'arête `illisible` seule posée, en boîte, au moment `moment`.
func _seule_boite(volume: VolumeDeScene, moment: String) -> void:
	var groupes := _groupes(volume.get_node("Aretes"))
	if groupes.keys() != [["illisible"]] or not groupes[["illisible"]].has_node("Vu_Boite"):
		_fautes.append("modèle illisible, %s : groupes %s, attendu la seule boîte" % [moment, groupes.keys()])
	if volume.ce_qui_est_pose().aretes != 1:
		_fautes.append("modèle illisible, %s : %d arêtes comptées, attendu 1" % [moment, volume.ce_qui_est_pose().aretes])


## Dans un modèle qui a le nœud `porte-fermee--gauche` et pas `porte-fermee--droite`, la porte gauche prend le sien, la
## droite, celle du milieu et la porte seule, `porte-fermee` (`VolumeDeScene.noeud_de_la_piece`) ; une porte ouverte,
## que le modèle n'a pas, aucun nœud.
func _noeud_de_la_piece() -> void:
	var modele := Node3D.new()
	var porte := Noyau.Piece.PORTE_FERMEE
	var gauche := "%s--%s" % [porte, Noyau.Position.GAUCHE]
	for nom in [porte, gauche]:
		var noeud := Node3D.new()
		noeud.name = nom
		modele.add_child(noeud)
	var attendus := {
		Noyau.Position.GAUCHE: gauche, Noyau.Position.DROITE: porte, Noyau.Position.MILIEU: porte,
		Noyau.Position.SEULE: porte,
	}
	for position: String in attendus:
		var noeud := VolumeDeScene.noeud_de_la_piece(modele, porte, position)
		if noeud != attendus[position]:
			_fautes.append("porte fermée %s : nœud %s, attendu %s" % [position, noeud, attendus[position]])
	var ouverte := VolumeDeScene.noeud_de_la_piece(modele, Noyau.Piece.PORTE_OUVERTE, Noyau.Position.GAUCHE)
	if not ouverte.is_empty():
		_fautes.append("porte ouverte absente du modèle : nœud %s, attendu aucun" % ouverte)
	modele.free()


## Une ouverture de deux portes fermées servies de `famille`, son modèle lu : chaque porte son groupe, sa pièce le nœud
## `porte-fermee--<position>` du modèle quand il l'a, sinon `porte-fermee` s'il l'a.
func _ouverture_de_deux(volume: VolumeDeScene, famille: String) -> void:
	var porte := {famille = famille, palette = _palette, piece = Noyau.Piece.PORTE_FERMEE, bloc = "0/0/0", pied = 0.0,
		hauteurM = HAUTEUR_M, sens = {x = 1.0, y = 0.0}}
	var aretes := [
		porte.merged({cle = "gauche", position = Noyau.Position.GAUCHE, milieu = {x = 0.0, y = -0.5}}, true),
		porte.merged({cle = "droite", position = Noyau.Position.DROITE, milieu = {x = 1.0, y = -0.5}}, true),
	]
	volume.poser_les_aretes(aretes)
	await volume.attendre_les_aretes()
	var groupes := _groupes(volume.get_node("Aretes"))
	if groupes.keys() != [["gauche"], ["droite"]]:
		_fautes.append("ouverture de deux portes, les groupes sont %s, attendu un par porte" % [groupes.keys()])
		return
	var modele: Node = volume._modeles_d_arete[VolumeDeScene.modele_servi("aretes", famille)].scene
	for a: Dictionary in aretes:
		var place := "%s--%s" % [a.piece, a.position]
		var attendu := place if modele.has_node(place) else String(a.piece)
		if not modele.has_node(attendu):
			continue
		var groupe: Node3D = groupes[[a.cle]]
		if not groupe.has_node(attendu) and not groupe.has_node("Vu_" + attendu):
			_fautes.append("ouverture de deux portes, %s : pièce %s, attendu %s" % [a.cle,
				groupe.get_children().map(func(n: Node) -> String: return n.name), attendu])


## Sur le volume `volume` d'un autre plateau, les murs servis de `famille`, droits, bas, murets et diagonaux, couvrent
## chacun leur arête de bout en bout (`_couverture`).
func _bout_a_bout(volume: VolumeDeScene, famille: String) -> void:
	var servie := {famille = famille, palette = _palette, piece = Noyau.Piece.MUR,
		position = Noyau.Position.SEULE, bloc = "0/0/0", pied = 0.0,
		hauteurM = HAUTEUR_M, sens = {x = 1.0, y = 0.0}}
	var aretes := [
		servie.merged({cle = "droite", milieu = {x = 0.0, y = -0.5}}, true),
		servie.merged({cle = "basse", milieu = {x = 2.0, y = -0.5}, hauteurM = 3.0}, true),
		servie.merged({cle = "muret", milieu = {x = 6.0, y = -0.5}, hauteurM = MURET_M}, true),
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
		var repere := vu.global_transform * volume.transform_d_instance(vu, _posee(groupe, a))
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
	var arete := {cle = "mur", famille = famille, palette = _palette, piece = Noyau.Piece.MUR,
		position = Noyau.Position.SEULE, bloc = "0/0/0",
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
		var base := (vu.global_transform * volume.transform_d_instance(vu, _posee(groupe, a))).basis
		var echelles := base.get_scale()
		if absf(echelles.z - metrique) > EPSILON:
			_fautes.append("%s, %s : échelle %s, attendue %.4f en épaisseur" % [a.cle, vu.name, echelles, metrique])
		if base.z.normalized().distance_to(dehors) > EPSILON:
			_fautes.append("%s, %s : +Z vers %s, attendu vers le dehors %s" % [a.cle, vu.name, base.z.normalized(), dehors])


## Chaque surface de chaque maillage du groupe `groupe`, vue et en ombre, dans une matière de la couleur de `_palette` à
## l'emplacement de sa surface (`surfaces`, par le nom du matériau), que `_palette` porte, la vue prenant pour albédo la
## couleur de l'instance ; rend les emplacements peints, chacun à `true`.
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
			if emplacement == null:
				continue
			if not _palette.has(emplacement):
				_fautes.append("%s, %s, surface %s : l'emplacement %s, que la palette ne porte pas" % [cle, instances.name,
					matiere.resource_name, emplacement])
				continue
			peints[emplacement] = true
			if not matiere.albedo_color.is_equal_approx(Color(_palette[emplacement])):
				_fautes.append("%s, %s, surface %s : albédo %s, attendu %s (%s)" % [cle, instances.name,
					matiere.resource_name, matiere.albedo_color.to_html(false), _palette[emplacement], emplacement])
			if matiere.vertex_color_use_as_albedo != instances.name.begins_with("Vu_"):
				_fautes.append("%s, %s, surface %s : la couleur de l'instance n'est l'albédo que de la vue"
					% [cle, instances.name, matiere.resource_name])
	if peints.is_empty():
		_fautes.append("%s : aucune surface peinte de la palette" % cle)
	return peints


## Chaque surface de chaque maillage vu du groupe `groupe` de l'arête `a` dont la matière (`surfaces`, par le nom du
## matériau) a sa texture au projet : texture neutre et relief de sa matière, projetés sur les trois axes, un motif tous
## les `MiseEnPage.METRES_PAR_MOTIF` de la pièce posée sur chaque axe, lu à l'échelle de son instance ; rend les noms de
## ces surfaces, chacun à `true`.
func _texturee(groupe: Node3D, a: Dictionary, surfaces: Array) -> Dictionary:
	var matieres := {}
	for surface: Dictionary in surfaces:
		matieres[surface.nom] = surface
	var vues := {}
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var echelles := vu.global_transform.basis.get_scale()
		var mesh := vu.multimesh.mesh
		for rang in mesh.get_surface_count():
			var matiere: BaseMaterial3D = mesh.surface_get_material(rang)
			var surface: Dictionary = matieres.get(matiere.resource_name, {})
			if surface.is_empty() or not _de_matiere_texturee(surface):
				continue
			vues[surface.nom] = true
			var lieu := "%s, %s, surface %s" % [a.cle, vu.name, surface.nom]
			if matiere.albedo_texture != load(VolumeDeScene.texture_neutre_de(surface.matiere)):
				_fautes.append("%s : albédo %s, attendu la texture neutre de %s" % [lieu, matiere.albedo_texture,
					surface.matiere])
			if not matiere.uv1_triplanar or matiere.uv1_world_triplanar:
				_fautes.append("%s : texture non projetée sur les trois axes de la pièce" % lieu)
			if not matiere.normal_enabled or matiere.normal_texture != load(VolumeDeScene.relief_de(surface.matiere)):
				_fautes.append("%s : sans le relief de %s" % [lieu, surface.matiere])
			var motif := echelles * METRES_PAR_CASE / matiere.uv1_scale
			if not motif.is_equal_approx(Vector3.ONE * MiseEnPage.METRES_PAR_MOTIF):
				_fautes.append("%s : un motif tous les %s m de la pièce posée, attendu %s m" % [lieu, motif,
					MiseEnPage.METRES_PAR_MOTIF])
	return vues


## La matière de la surface `surface` d'un modèle a sa texture au projet (`VolumeDeScene.texture_de`).
static func _de_matiere_texturee(surface: Dictionary) -> bool:
	return ResourceLoader.exists(VolumeDeScene.texture_de(surface.get("matiere", "")))


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
		var instance := volume.transform_d_instance(vu, _posee(groupe, a))
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


## La pose de l'arête `a` que porte le groupe `groupe` (méta `aretes`, `VolumeDeScene._poser`), de même clé.
static func _posee(groupe: Node3D, a: Dictionary) -> Dictionary:
	return groupe.get_meta("aretes").filter(func(p: Dictionary) -> bool: return p.cle == a.cle)[0]
