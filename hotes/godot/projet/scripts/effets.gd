## Les effets d'un appel (`suite.effets`, `pont/CONTRAT.md`, section « Effets ») rendus au plateau, tels que le noyau
## les résout : chaque coup part de l'attaquant (sa phase de départ), son projectile vole jusqu'à la cible le temps et
## sur la cloche de son `trajet`, puis sa phase d'arrivée joue sur la cible ; chaque incantation joue son départ au
## lanceur, puis, réussie, son arrivée sur sa cible ; chaque zone (#3783) joue son départ à son auteur, son jet jusqu'au
## centre, puis sa nappe sur chacune de ses cases et son son au centre ; sans auteur (`de` nul), seules l'arrivée ou la
## nappe jouent ; chaque son joue partout, autant de fois que l'effet le dit (les pas d'un déplacement, #3825). Les
## flottants d'un coup ou d'une incantation montent de sa cible à son arrivée, l'un après l'autre ; un flottant seul
## monte de son combattant ou de sa case. Une phase dessine son visuel, la scène de son id sous
## `res://effets/visuels/` (`eclater`), et joue son son, une de ses variantes à son tour (`variante_du_son`), à son
## point, sur le bus de son canal (`son.canal`) ; l'arrivée sonore d'un coup et la nappe sonore d'une zone atténuent la
## musique (`Musique.attenuer`). Chaque déplacement (#3822) part aussitôt, tous ensemble : le chemin de son combattant,
## le lieu de chacune de ses cases et ses mètres, va à qui le parcourt (`deplacement`). Les autres effets d'un même
## appel se suivent, `ECART_S` secondes l'un après l'autre.
class_name Effets
extends Node3D

## @contrat Effets
## Le plateau (`projet/scripts/plateau.gd`) rend `suite.effets` par son nœud `Effets` (`projet/scripts/effets.gd`),
## chaque déplacement aussitôt, tous ensemble, puis les autres l'un après l'autre : chaque visuel est la scène de son id
## (`res://effets/visuels/<visuel>.tscn`), teinte de la couleur de l'effet, au point de sa phase ; chaque projectile,
## celle de son id sous `res://effets/projectiles/` ; chaque son joue en 3D à son point, sur le bus d'`AudioServer`
## nommé par son `canal` (`projet/default_bus_layout.tres`), et la phase d'arrivée sonore d'un coup ou la nappe sonore
## d'une zone atténue la musique (section « Musique »). Au départ d'un coup ou d'une incantation, l'auteur se tourne
## vers sa cible et joue son clip d'attaque ; à l'arrivée d'un coup qui touche, la cible accuse le coup. Un coup, une
## incantation ou une zone sans auteur (`de` nul) n'a ni départ ni trajet : son arrivée ou sa nappe joue seule, et
## personne ne s'anime à son départ. La recette `projet/recettes/effets.gd` les vérifie,
## `projet/recettes/chemin-du-groupe.gd` le parcours d'un déplacement, et `projet/recettes/vision-du-combat.gd` l'effet
## sans auteur.

## Un coup, une incantation ou une zone part de son auteur `de` (son id), vers le point au sol `vers`.
signal depart(de: String, vers: Vector3)
## La phase d'arrivée d'un coup ou d'une incantation joue sur `vers` ; `touche` : un coup qui touche.
signal arrivee(vers: String, touche: bool)
## Le combattant `qui` parcourt `lieux`, le lieu de chaque case de son chemin, chacune à `metres` (au même rang) de la
## précédente.
signal deplacement(qui: String, lieux: Array, metres: Array)

## Secondes entre deux effets d'un même appel.
const ECART_S := 0.35
## Secondes entre le départ et l'arrivée d'un coup sans projectile, d'une incantation.
const ELAN_S := 0.3
## La dispersion d'un son 3D : sa taille d'unité, en cases, au-delà de laquelle il décroît.
const PORTEE_DU_SON := 30.0
## La durée (s) de la montée d'un flottant, au bout de laquelle il s'est éteint, et l'écart (s) entre deux flottants
## d'une même cible.
const VIE_DU_FLOTTANT_S := 1.2
const ECART_DES_FLOTTANTS_S := 0.3
## La taille (px) du texte d'un flottant, celle d'un critique, et celle du contour d'une étiquette (`etiquette`).
const TAILLE_DU_FLOTTANT := 40
const TAILLE_DU_CRITIQUE := 56
const CONTOUR_D_ETIQUETTE := 10

## Les familles d'effets : chacune un dossier `res://effets/<famille>/` de scènes nommées par l'id de la donnée.
const FAMILLE_DES_VISUELS := "visuels"
const FAMILLE_DES_PROJECTILES := "projectiles"
const FAMILLE_DES_FLAMMES := "flammes"
## Le groupe des nœuds d'une scène d'effet qui prennent la couleur de l'effet (`teinter`).
const GROUPE_DE_LA_TEINTE := "teinte"

## Par chemin, la scène d'effet chargée (`scene_de_l_effet`).
static var _scenes := {}
## Par liste passée à `au_tour` (sa forme écrite), ses éléments dans l'ordre de leurs prochains tours.
static var _tours := {}

var _metres_par_case := 1.0
## Les matières de ses mailles teintes (`teinter`), qu'il tient au-delà de leur vie (`MontageDeComposition.materiau_local`).
var _locaux := {}


## La clé d'une case d'un effet (`{ x, y, z? }`) parmi les lieux que reçoit `jouer`.
static func cle_de_case(case: Dictionary) -> String:
	return "%d,%d,%d" % [case.x, case.y, case.get("z", 0)]


## Les cases de `effet` dont `jouer` lit le lieu sous leur clé (`cle_de_case`) : chaque case d'une zone et son centre, la
## case d'un flottant, chaque case d'un déplacement.
static func cases_de(effet: Dictionary) -> Array:
	var cases: Array = []
	if effet.quoi == "zone":
		cases = effet.cases.duplicate()
		cases.append(effet.centre)
	elif effet.quoi == "flottant" and effet.case != null:
		cases = [effet.case]
	elif effet.quoi == "deplacement":
		cases = effet.cases
	return cases


## Joue `effets` (`suite.effets`) sur un plateau de `metres_par_case` mètres par case, chaque combattant au point au sol
## que `lieux` donne par son id, chaque case d'un effet par sa clé (`cle_de_case`).
func jouer(effets: Array, lieux: Dictionary, metres_par_case: float) -> void:
	_metres_par_case = metres_par_case
	for effet: Dictionary in effets:
		if effet.quoi == "deplacement":
			deplacement.emit(effet.qui, effet.cases.map(func(case: Dictionary) -> Vector3: return lieux[cle_de_case(case)]), effet.cases.map(func(case: Dictionary) -> float: return case.metres))
	var premier := true
	for effet: Dictionary in effets.filter(func(e: Dictionary) -> bool: return e.quoi != "deplacement"):
		if not premier:
			await get_tree().create_timer(ECART_S).timeout
		premier = false
		match effet.quoi:
			"coup":
				_coup(effet, lieux)
			"incantation":
				_incantation(effet, lieux)
			"zone":
				_zone(effet, lieux)
			"flottant":
				_flottant(effet, lieux)
			"son":
				_repeter_le_son(effet.son, effet.fois, effet.ecartS)


func _point(sol: Vector3) -> Vector3:
	return MiseEnPage.point_du_coup(sol, _metres_par_case)


## Le coup `effet` : son départ (`_partir`), puis son arrivée et ses flottants sur sa cible.
func _coup(effet: Dictionary, lieux: Dictionary) -> void:
	var sol: Vector3 = lieux[effet.vers]
	var teinte := Color(effet.couleur)
	await _partir(effet, lieux, sol, teinte)
	_phase(effet.arrivee, _point(sol), teinte)
	if effet.arrivee != null and effet.arrivee.son != null:
		Musique.attenuer(get_tree())
	_flotter(effet.flottants, sol)
	arrivee.emit(effet.vers, effet.issue == "touche" or effet.issue == "critique")


## L'incantation `effet` : son départ au lanceur (`_partir`), puis son arrivée et ses flottants sur sa cible.
func _incantation(effet: Dictionary, lieux: Dictionary) -> void:
	var sol: Vector3 = lieux[effet.vers]
	var teinte := Color(effet.couleur)
	await _partir(effet, lieux, sol, teinte)
	_phase(effet.arrivee, _point(sol), teinte)
	_flotter(effet.flottants, sol)
	arrivee.emit(effet.vers, false)


## La zone `effet` : son départ vers son centre (`_partir`), puis sa nappe, son visuel sur chaque case et son son au
## centre.
func _zone(effet: Dictionary, lieux: Dictionary) -> void:
	var teinte := Color(effet.couleur)
	var sol_du_centre: Vector3 = lieux[cle_de_case(effet.centre)]
	await _partir(effet, lieux, sol_du_centre, teinte)
	if effet.nappe == null:
		return
	if effet.nappe.visuel != null:
		for case: Dictionary in effet.cases:
			eclater(effet.nappe.visuel, lieux[cle_de_case(case)], teinte)
	if effet.nappe.son != null:
		_jouer_le_son(effet.nappe.son, _point(sol_du_centre))
		Musique.attenuer(get_tree())


## Le départ de `effet` (un coup, une incantation, une zone) vers le sol `sol` : son auteur s'y tourne, sa phase de départ
## joue à l'auteur, puis le projectile de son `trajet` vole jusqu'au point de `sol` (aucun : un élan). Sans auteur
## (`de` nul, `CONTRAT.md`, section « Effets »), rien : son arrivée ou sa nappe joue seule.
func _partir(effet: Dictionary, lieux: Dictionary, sol: Vector3, teinte: Color) -> void:
	if effet.de == null:
		return
	depart.emit(effet.de, sol)
	var de := _point(lieux[effet.de])
	_phase(effet.depart, de, teinte)
	if effet.get("trajet") != null:
		await _voler(effet.trajet, de, _point(sol), teinte)
	else:
		await get_tree().create_timer(ELAN_S).timeout


## Le flottant `effet` au-dessus de son combattant (`sur`) ou de sa case, sauf hors des lieux dessinés.
func _flottant(effet: Dictionary, lieux: Dictionary) -> void:
	var cle: String = effet.sur if effet.sur != null else cle_de_case(effet.case)
	if lieux.has(cle):
		flottant_de(effet.flottant, lieux[cle])


## Les flottants `flottants` au-dessus du sol `sol`, `ECART_DES_FLOTTANTS_S` secondes l'un après l'autre.
func _flotter(flottants: Array, sol: Vector3) -> void:
	var premier := true
	for flottant: Dictionary in flottants:
		if not premier:
			await get_tree().create_timer(ECART_DES_FLOTTANTS_S).timeout
		premier = false
		flottant_de(flottant, sol)


## Le flottant `flottant` (`{ genre, texte, couleur, critique }`) au-dessus du sol `sol` : son texte à sa teinte, plus
## grand pour un critique, face à la caméra et devant le décor, qui monte et s'éteint en `VIE_DU_FLOTTANT_S` secondes.
func flottant_de(flottant: Dictionary, sol: Vector3) -> Label3D:
	var texte := etiquette(flottant.texte, flottant.couleur, TAILLE_DU_CRITIQUE if flottant.critique else TAILLE_DU_FLOTTANT, _metres_par_case)
	texte.name = "flottant"
	texte.position = MiseEnPage.point_du_flottant(sol, _metres_par_case)
	add_child(texte, true)
	var montee := create_tween().set_parallel()
	montee.tween_property(texte, "position", MiseEnPage.montee_du_flottant(texte.position, _metres_par_case), VIE_DU_FLOTTANT_S)
	montee.tween_property(texte, "modulate:a", 0.0, VIE_DU_FLOTTANT_S).set_ease(Tween.EASE_IN)
	montee.finished.connect(texte.queue_free)
	return texte


## L'étiquette `texte` à la teinte `couleur` (`#rrggbb`), de `taille` points, face à la caméra et devant le décor, à
## l'échelle d'un plateau de `metres_par_case` mètres par case : un flottant, la marque d'un État.
static func etiquette(texte: String, couleur: String, taille: int, metres_par_case: float) -> Label3D:
	var texte_3d := Label3D.new()
	texte_3d.text = texte
	texte_3d.modulate = Color(couleur)
	texte_3d.font_size = taille
	texte_3d.outline_size = CONTOUR_D_ETIQUETTE
	texte_3d.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	texte_3d.no_depth_test = true
	texte_3d.scale = MiseEnPage.echelle_au_plateau(metres_par_case)
	return texte_3d


## Le son `son` joué partout `fois` fois, `ecart_s` secondes l'un après l'autre.
func _repeter_le_son(son: Dictionary, fois: int, ecart_s: float) -> void:
	for rang in fois:
		if rang != 0:
			await get_tree().create_timer(ecart_s).timeout
		_jouer_le_son(son, null)


## La phase `phase` (`null` : aucune) jouée au point `point` : son visuel, puis son son.
func _phase(phase: Variant, point: Vector3, teinte: Color) -> void:
	if phase == null:
		return
	if phase.visuel != null:
		eclater(phase.visuel, point, teinte)
	if phase.son != null:
		_jouer_le_son(phase.son, point)


## L'éclat du visuel `visuel` (sa scène, `FAMILLE_DES_VISUELS`) au point `point`, teint de `teinte`, en mètres à
## l'échelle du plateau ; son animation `eclat` l'éteint puis le retire.
func eclater(visuel: String, point: Vector3, teinte: Color) -> Node3D:
	var eclat: Node3D = scene_de_l_effet(FAMILLE_DES_VISUELS, visuel).instantiate()
	teinter(eclat, teinte, _locaux)
	eclat.name = visuel
	eclat.position = point
	eclat.scale = MiseEnPage.echelle_au_plateau(_metres_par_case)
	add_child(eclat, true)
	return eclat


## La scène de l'effet `id` de la famille `famille` posée en continu, teinte de `teinte` : chacune de ses gerbes émet
## sans fin, ses particules nées d'avance (`preprocess`), tout autre enfant (éclair, animation) retiré avant l'entrée
## dans l'arbre, donc aucune maille à teindre. Une flamme, une zone qui dure, la marque d'un État.
static func pose_continue(famille: String, id: String, teinte: Color) -> Node3D:
	var pose: Node3D = scene_de_l_effet(famille, id).instantiate()
	for enfant in pose.get_children():
		var gerbe := enfant as CPUParticles3D
		if gerbe == null:
			enfant.free()
			continue
		gerbe.one_shot = false
		gerbe.explosiveness = 0.0
		gerbe.preprocess = gerbe.lifetime
	teinter(pose, teinte, {})
	return pose


## Le chemin de la scène de l'effet `id` de la famille `famille` : le nom du fichier est l'id de la donnée.
static func chemin_de_l_effet(famille: String, id: String) -> String:
	return "res://effets/%s/%s.tscn" % [famille, id]


## La scène de l'effet `id` de la famille `famille`, gardée une fois chargée.
static func scene_de_l_effet(famille: String, id: String) -> PackedScene:
	var chemin := chemin_de_l_effet(famille, id)
	if not _scenes.has(chemin):
		_scenes[chemin] = load(chemin)
	return _scenes[chemin]


## Teint de `teinte` chaque descendant de `noeud` du groupe `GROUPE_DE_LA_TEINTE` : une gerbe par sa `color`, une lampe
## par sa `light_color`, une maille par sa matière locale (`MontageDeComposition.materiau_local`), tenue dans `locaux`,
## ceux de son porteur ; aucune ressource de la scène ne change.
static func teinter(noeud: Node, teinte: Color, locaux: Dictionary) -> void:
	for teint in noeud.find_children("*", "", true, false):
		if not teint.is_in_group(GROUPE_DE_LA_TEINTE):
			continue
		if teint is CPUParticles3D:
			(teint as CPUParticles3D).color = teinte
		elif teint is OmniLight3D:
			(teint as OmniLight3D).light_color = teinte
		elif teint is MeshInstance3D:
			var matiere := MontageDeComposition.materiau_local(teint as MeshInstance3D, 0, locaux)
			matiere.albedo_color = teinte
			if matiere.emission_enabled:
				matiere.emission = teinte


## Le projectile du trajet `trajet` en vol de `de` à `vers` en `trajet.dureeS` secondes : son nœud file droit vers la
## cible, son corps monte de `trajet.hauteurM` à mi-vol puis redescend ; retiré à l'arrivée.
func _voler(trajet: Dictionary, de: Vector3, vers: Vector3, teinte: Color) -> void:
	var projectile := projectile_de(trajet.projectile, teinte)
	add_child(projectile)
	projectile.position = de
	if not de.is_equal_approx(vers):
		projectile.look_at(vers, Vector3.UP, true)
	var vol := create_tween()
	vol.tween_property(projectile, "position", vers, trajet.dureeS)
	var corps: Node3D = projectile.get_node("Corps")
	var mi_vol := MiseEnPage.mi_vol(trajet.dureeS)
	var cloche := create_tween()
	cloche.tween_property(corps, "position:y", MiseEnPage.hauteur_au_plateau(trajet.hauteurM, _metres_par_case), mi_vol).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	cloche.tween_property(corps, "position:y", 0.0, mi_vol).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	await vol.finished
	projectile.queue_free()


## Le projectile `nom` (sa scène, `FAMILLE_DES_PROJECTILES`), teint de `teinte` s'il prend celle de l'effet : sous son
## nœud, son avant au +Z, son corps (`Corps`) à l'échelle du plateau, et la taille de chaque gerbe en coordonnées du
## monde portée au plateau.
func projectile_de(nom: String, teinte: Color) -> Node3D:
	var projectile: Node3D = scene_de_l_effet(FAMILLE_DES_PROJECTILES, nom).instantiate()
	projectile.name = nom
	(projectile.get_node("Corps") as Node3D).scale = MiseEnPage.echelle_au_plateau(_metres_par_case)
	teinter(projectile, teinte, _locaux)
	for gerbe: CPUParticles3D in projectile.find_children("*", "CPUParticles3D", true, false):
		if not gerbe.local_coords:
			gerbe.scale_amount_min = MiseEnPage.hauteur_au_plateau(gerbe.scale_amount_min, _metres_par_case)
			gerbe.scale_amount_max = MiseEnPage.hauteur_au_plateau(gerbe.scale_amount_max, _metres_par_case)
	return projectile


## L'une des variantes du son `son` (`{ id, fichiers, volume, canal }`), celui de ses fichiers de `res://sons/` (Ogg
## Vorbis, ou MP3 pour une musique) qui vient à son tour (`au_tour`), en boucle avec `boucle`. Un flux de fichier se
## joue en échantillon sous le Web, par le navigateur et hors de l'image (`AudioStreamPlayer.playback_type`, Godot
## 4.7) ; un flux composé (`AudioStreamRandomizer`, `AudioStreamSynchronized`) se mixe à chaque image et saccade dès
## qu'une image tarde.
static func variante_du_son(son: Dictionary, boucle: bool) -> AudioStream:
	var flux: AudioStream = load("res://sons/%s" % au_tour(son.fichiers))
	if boucle:
		flux = flux.duplicate()
		flux.set("loop", true)
	return flux


## L'élément de `liste` qui vient à son tour : chacun l'un après l'autre, d'un appel au suivant sur la même liste.
static func au_tour(liste: Array) -> Variant:
	var cle := str(liste)
	if not _tours.has(cle):
		_tours[cle] = liste.duplicate()
	var tour: Array = _tours[cle]
	tour.push_back(tour.pop_front())
	return tour.back()


## Le lecteur du son `son` (`{ id, fichiers, volume, canal }`) qui joue en boucle à son point dès sa pose, sur le bus de
## son canal : une flamme, une zone qui dure, la marque d'un État.
static func son_en_boucle(son: Dictionary) -> AudioStreamPlayer3D:
	var lecteur := AudioStreamPlayer3D.new()
	lecteur.name = "son-%s" % son.id
	lecteur.stream = variante_du_son(son, true)
	lecteur.volume_db = linear_to_db(son.volume)
	lecteur.bus = son.canal
	lecteur.unit_size = PORTEE_DU_SON
	lecteur.autoplay = true
	return lecteur


## Le son `son` (`{ id, fichiers, volume, canal }`), l'une de ses variantes à son tour, au point `point`, ou partout
## (`null`), sur le bus de son canal ; retiré une fois joué.
func _jouer_le_son(son: Dictionary, point: Variant) -> Node:
	var variante := variante_du_son(son, false)
	var lecteur: Node
	if point == null:
		var plat := AudioStreamPlayer.new()
		plat.stream = variante
		plat.volume_db = linear_to_db(son.volume)
		plat.bus = son.canal
		plat.finished.connect(plat.queue_free)
		lecteur = plat
	else:
		var spatial := AudioStreamPlayer3D.new()
		spatial.stream = variante
		spatial.volume_db = linear_to_db(son.volume)
		spatial.bus = son.canal
		spatial.unit_size = PORTEE_DU_SON
		spatial.position = point
		spatial.finished.connect(spatial.queue_free)
		lecteur = spatial
	lecteur.name = "son-%s" % son.id
	add_child(lecteur, true)
	lecteur.play()
	return lecteur
