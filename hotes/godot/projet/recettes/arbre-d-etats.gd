extends SceneTree

## L'arbre d'états d'un corps (#3949, `EtatsDuCorps`, `Combattant`) : sur le pont figé de l'atelier (`PontFige`,
## `hotes/godot/recettes/atelier.ts`, `figerLeRepos`), un vrai `Combattant` vêtu de la base humanoïde. Chaque couple
## (état courant, rôle demandé) que `Combattant` produit passe par un fondu qui nomme l'état quitté
## (`get_fading_from_node`), sur le corps comme sur un véhicule qui porte un clip pour chaque rôle ; pendant le fondu du
## repos à la marche, un os témoin (celui que la coupe d'un clip à l'autre déplace le plus) passe strictement entre la
## pose quittée et la pose gagnée, d'image en image sans le saut de la coupe. Melee et coup reviennent seuls au repos,
## la mort tient. Le clip de l'état courant est marqué au lecteur (`assigned_animation`), retour automatique compris ;
## une hallebarde montée (seconde prise, `clipsDeuxMains`) fait jouer à `role/repos` son clip à deux mains. Un
## habillage en pleine marche ne fait pas sauter la pose (`advance(0.0)` après le gabarit) ; un véhicule démonté rend
## l'arbre au lecteur du corps sans alias périmé ; le studio des portraits photographie un corps fini
## (`Combattant.est_vetu`), son gabarit mesuré, sur la première image de son clip de repos posée sur le repos du
## squelette, quelle que soit la pose d'avant, et la pose figée (`Combattant.figer`) ne repart pas ; un combattant sans
## corps garde son arbre inactif.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/repos.json"
const BASE := "humanoide"
const HALLEBARDE := "humanoide--rigide--hallebarde"
## Le pas (s) de l'horloge manuelle de l'arbre.
const PAS_S := 1.0 / 60.0
## Les images laissées à une lecture, un montage ou un retour au repos.
const IMAGES_D_ATTENTE := 600
## L'écart (rad) sous lequel deux poses d'os sont la même.
const MEME_POSE := 0.0001
## L'angle (rad) dont chaque os est tourné avant la photo du studio : la pose qu'un clip joué avant elle aurait laissée.
const POSE_D_AVANT := 0.3
## Un gabarit qui abaisse le haut de la tête de la base (`gabarit` de `composer`).
const GABARIT := {racine = {os = "root", echelle = 0.74}, enfantsDe = {thigh_l = 0.62, calf_l = 0.62, thigh_r = 0.62, calf_r = 0.62}, pieds = ["foot_l", "foot_r"], jambes = ["thigh_l", "calf_l", "thigh_r", "calf_r"], clipsPlantes = [], deplacementsDesOs = {}}
const CLIPS_DU_VEHICULE := {repos = "v_repos", marche = "v_marche", melee = "v_melee", tir = "v_tir", coup = "v_coup", mort = "v_mort"}
var _fautes: Array[String] = []
var _arbre: EtatsDuCorps = null


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[arbre-d-etats] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[arbre-d-etats] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	PontFige.poser(self, lu)
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var base: Dictionary = lu.modeles.bases.filter(func(b: Dictionary) -> bool: return b.id == BASE)[0]
	await _sans_corps()
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	root.add_child(combattant)
	var montage: MontageDeComposition = combattant.get_node("Modele")
	combattant.vetir({base = BASE})
	await _attendre(func() -> bool: return montage.lecteur != null)
	_arbre = combattant.get_node("Etats")
	_arbre.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	await _pas(2)
	var etats: AnimationNodeStateMachinePlayback = _arbre.get("parameters/playback")
	var lecteur := montage.lecteur
	_verifier(_arbre.active and _arbre.get_node(_arbre.anim_player) == lecteur, "l'arbre n'est pas branché actif sur le lecteur de la base")
	_verifier(etats.get_current_node() == "repos", "à la pose, état %s, attendu repos" % etats.get_current_node())

	await _matrice("corps", combattant, etats)
	var temoin := await _fondu(combattant, etats, montage.squelette)
	await _retours(combattant, etats, lecteur, base)
	await _habiller_en_marche(combattant, etats, montage.squelette)
	await _deux_mains(combattant, etats, lecteur, montage, base)
	await _vehicule_demonte(combattant, montage, lecteur)
	print("[arbre-d-etats] os témoin : ", montage.squelette.get_bone_name(temoin))
	combattant.queue_free()
	await process_frame
	await _vehicule_complet()
	await _studio()
	for faute in _fautes:
		push_error("[arbre-d-etats] " + faute)
	print("[arbre-d-etats] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Chaque couple (état courant, rôle demandé) dont le lecteur branché porte les deux alias : depuis l'état posé sans
## fondu (`start`), le rôle demandé (`EtatsDuCorps.jouer`), l'arbre le gagne par un fondu qui nomme l'état quitté.
func _matrice(cas: String, combattant: Combattant, etats: AnimationNodeStateMachinePlayback) -> void:
	var lecteur := combattant._lecteur()
	var couples := 0
	for de: String in EtatsDuCorps.ROLES:
		for vers: String in EtatsDuCorps.ROLES:
			if de == vers or de == EtatsDuCorps.MORT or not lecteur.has_animation("role/" + de) or not lecteur.has_animation("role/" + vers):
				continue
			etats.start(de)
			await _pas(3)
			_arbre.jouer(vers)
			var quitte := "?"
			for i in IMAGES_D_ATTENTE:
				await _pas()
				if etats.get_current_node() == vers:
					quitte = etats.get_fading_from_node()
					break
			couples += 1
			_verifier(quitte == de, "%s : %s → %s gagné sans fondu depuis %s (quitté : %s)" % [cas, de, vers, de, quitte])
	print("[arbre-d-etats] %s : %d couples parcourus" % [cas, couples])


## Le fondu du repos à la marche : rend l'os témoin, celui que la coupe d'un clip à l'autre (`start`, sans fondu)
## déplace le plus. Pendant le fondu, `get_fading_from_node` vaut `repos` puis se vide ; l'os passe strictement entre la
## pose quittée et la pose gagnée, et aucun écart d'une image à la suivante n'atteint la moitié du saut de la coupe.
func _fondu(combattant: Combattant, etats: AnimationNodeStateMachinePlayback, squelette: Skeleton3D) -> int:
	etats.start("repos")
	await _pas(30)
	var avant := _rotations(squelette)
	etats.start("marche")
	await _pas()
	var apres := _rotations(squelette)
	var temoin := 0
	for os in squelette.get_bone_count():
		if _angle(avant[os], apres[os]) > _angle(avant[temoin], apres[temoin]):
			temoin = os
	var coupe := _angle(avant[temoin], apres[temoin])
	etats.start("repos")
	await _pas(30)
	var poses: Array[Quaternion] = [squelette.get_bone_pose_rotation(temoin)]
	var quittes: Array[String] = []
	_arbre.jouer("marche")
	for i in IMAGES_D_ATTENTE:
		await _pas()
		poses.append(squelette.get_bone_pose_rotation(temoin))
		quittes.append(etats.get_fading_from_node())
		if quittes[-1] == "":
			break
	var fondues := quittes.count("repos")
	_verifier(fondues >= 3 and quittes.slice(0, fondues).all(func(q: String) -> bool: return q == "repos") and quittes[-1] == "", "repos → marche : états quittés %s" % [quittes])
	var depart := poses[0]
	var arrivee := poses[-1]
	var milieu := poses[1 + fondues / 2]
	var plein := _angle(depart, arrivee)
	_verifier(_angle(milieu, depart) > MEME_POSE and _angle(milieu, arrivee) > MEME_POSE and _angle(milieu, depart) < plein and _angle(milieu, arrivee) < plein,
			"repos → marche : au milieu du fondu, l'os témoin à %.4f du départ et %.4f de l'arrivée, qui sont à %.4f" % [_angle(milieu, depart), _angle(milieu, arrivee), plein])
	var plus_grand := 0.0
	for i in range(1, poses.size()):
		plus_grand = maxf(plus_grand, _angle(poses[i - 1], poses[i]))
	_verifier(plus_grand < coupe / 2.0, "repos → marche : écart d'image %.4f, saut de la coupe %.4f" % [plus_grand, coupe])
	print("[arbre-d-etats] fondu repos → marche : %d images, écart d'image max %.4f rad, saut de la coupe %.4f rad, milieu à %.4f / %.4f de %.4f" % [fondues, plus_grand, coupe, _angle(milieu, depart), _angle(milieu, arrivee), plein])
	return temoin


## Melee et coup reviennent seuls au repos, la mort tient ; le clip de l'état courant est marqué au lecteur, retour
## automatique compris.
func _retours(combattant: Combattant, etats: AnimationNodeStateMachinePlayback, lecteur: AnimationPlayer, base: Dictionary) -> void:
	etats.start("repos")
	await _pas(3)
	_arbre.jouer("marche")
	await _pas(3)
	_verifier(etats.get_current_node() == "marche" and lecteur.assigned_animation == base.clips.marche, "marche : état %s, clip marqué %s, attendu %s" % [etats.get_current_node(), lecteur.assigned_animation, base.clips.marche])
	_arbre.jouer("repos")
	await _pas(30)
	for cas: Array in [["melee", combattant.agir_vers.bind(Vector3(5.0, 0.0, 0.0))], ["coup", combattant.subir]]:
		cas[1].call()
		var images := 0
		while etats.get_current_node() != cas[0] and images < IMAGES_D_ATTENTE:
			await _pas()
			images += 1
		_verifier(etats.get_current_node() == cas[0] and lecteur.assigned_animation == base.clips[cas[0]], "%s : état %s, clip marqué %s" % [cas[0], etats.get_current_node(), lecteur.assigned_animation])
		images = 0
		while etats.get_current_node() != "repos" and images < IMAGES_D_ATTENTE:
			await _pas()
			images += 1
		await _pas()
		_verifier(etats.get_current_node() == "repos" and lecteur.assigned_animation == base.clips.repos, "%s : pas revenu au repos (état %s, clip marqué %s)" % [cas[0], etats.get_current_node(), lecteur.assigned_animation])
		print("[arbre-d-etats] %s → repos seul en %d images" % [cas[0], images])
	_arbre.jouer("mort")
	await _pas(int(lecteur.get_animation("role/mort").length / PAS_S) + 60)
	_verifier(etats.get_current_node() == "mort", "mort : l'arbre est à %s, attendu mort tenue" % etats.get_current_node())


## Un habillage neuf de la même base en pleine marche (`_composer`) : la pose reste celle de l'arbre, puis une image
## l'avance d'un écart d'image.
func _habiller_en_marche(combattant: Combattant, etats: AnimationNodeStateMachinePlayback, squelette: Skeleton3D) -> void:
	etats.start("marche")
	await _pas(25)
	var avant := _rotations(squelette)
	combattant.vetir({base = BASE, morphes = {}})
	var juste_apres := _rotations(squelette)
	await _pas()
	var une_image_apres := _rotations(squelette)
	var saut := _ecart(avant, juste_apres)
	_verifier(saut < MEME_POSE, "habillage en marche : la pose saute de %.4f rad" % saut)
	print("[arbre-d-etats] habillage en marche : écart avant → juste après %.6f rad, juste après → une image après %.4f rad" % [saut, _ecart(juste_apres, une_image_apres)])


## Une hallebarde montée à la prise `main` (seconde prise, maniement `hampe`) : `role/repos` joue son clip de
## `clipsDeuxMains`, marqué au lecteur sous le repos, et la main libre tient la seconde prise, la tenue posée sur l'état
## suivi (`EtatsDuCorps.suivi`) ; démontée, le clip de `clips`.
func _deux_mains(combattant: Combattant, etats: AnimationNodeStateMachinePlayback, lecteur: AnimationPlayer, montage: MontageDeComposition, base: Dictionary) -> void:
	etats.start("repos")
	await _pas(3)
	combattant.vetir({base = BASE, montes = [{ligne = "main", element = HALLEBARDE}]})
	await _attendre(func() -> bool: return montage.montes.has("main"))
	await _pas(2)
	var a_deux_mains: String = base.clipsDeuxMains[MontageDeComposition.modeles.secondesPrises[HALLEBARDE].maniement].repos
	_verifier(not montage.seconde_prise.is_empty() and montage.seconde_prise.all(func(m: SkeletonModifier3D) -> bool: return m.active), "hallebarde : la main libre ne tient pas la seconde prise sous %s, la tenue ne suit pas l'état (`EtatsDuCorps.suivi`)" % lecteur.assigned_animation)
	_verifier(_alias_de(lecteur, "repos", a_deux_mains) and lecteur.assigned_animation == a_deux_mains, "hallebarde : role/repos ne joue pas %s (clip marqué %s)" % [a_deux_mains, lecteur.assigned_animation])
	combattant.vetir({base = BASE})
	await _pas(2)
	_verifier(_alias_de(lecteur, "repos", base.clips.repos) and lecteur.assigned_animation == base.clips.repos, "hallebarde démontée : role/repos ne rejoue pas %s (clip marqué %s)" % [base.clips.repos, lecteur.assigned_animation])


## Un véhicule posé sur le corps (le lecteur de ses clips), puis la hallebarde montée sous lui, puis le véhicule démonté
## (`MontageDeVehicule.monter`, puis `_brancher` comme `Combattant.montrer`) : l'arbre revient au lecteur du corps, et
## chaque alias du corps est celui de la tenue posée, aucun du véhicule.
func _vehicule_demonte(combattant: Combattant, montage: MontageDeComposition, lecteur: AnimationPlayer) -> void:
	var vehicule := _poser_un_vehicule(combattant)
	_verifier(_arbre.get_node(_arbre.anim_player) == vehicule.lecteur, "véhicule posé : l'arbre n'est pas branché sur son lecteur")
	combattant.vetir({base = BASE, montes = [{ligne = "main", element = HALLEBARDE}]})
	await _attendre(func() -> bool: return montage.montes.has("main"))
	await _pas(2)
	_verifier(await vehicule.monter(null, montage, Callable()), "le véhicule ne se démonte pas")
	combattant._brancher()
	await _pas(2)
	_verifier(_arbre.get_node(_arbre.anim_player) == lecteur and _arbre.get_node(_arbre.root_node) == lecteur.get_node(lecteur.root_node), "véhicule démonté : l'arbre n'est pas rebranché sur le lecteur du corps")
	for role: String in EtatsDuCorps.ROLES:
		var clip := montage.clip(role)
		_verifier(_alias_de(lecteur, role, clip) if clip != "" else not lecteur.has_animation("role/" + role), "véhicule démonté : role/%s périmé (attendu %s)" % [role, clip])


## Un combattant sans corps, dont le véhicule porte un clip pour chaque rôle (`CLIPS_DU_VEHICULE`) : la matrice des
## fondus, `tir` compris.
func _vehicule_complet() -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	root.add_child(combattant)
	_arbre = combattant.get_node("Etats")
	_arbre.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_poser_un_vehicule(combattant)
	await _pas(2)
	await _matrice("véhicule", combattant, _arbre.get("parameters/playback"))
	combattant.queue_free()
	await process_frame


## Un véhicule posé sous `combattant` comme `MontageDeVehicule.monter` le pose (scène, lecteur, `clips` de son corps),
## avec un clip d'une seconde pour chaque rôle, puis l'arbre branché (`Combattant.montrer`).
func _poser_un_vehicule(combattant: Combattant) -> MontageDeVehicule:
	var vehicule: MontageDeVehicule = combattant.get_node("Vehicule")
	var scene := Node3D.new()
	var lecteur := AnimationPlayer.new()
	scene.add_child(lecteur)
	var bibliotheque := AnimationLibrary.new()
	for nom: String in CLIPS_DU_VEHICULE.values():
		var clip := Animation.new()
		clip.length = 1.0
		bibliotheque.add_animation(nom, clip)
	lecteur.add_animation_library("", bibliotheque)
	vehicule.add_child(scene)
	vehicule.scene = scene
	vehicule.lecteur = lecteur
	vehicule.clips = CLIPS_DU_VEHICULE
	combattant._brancher()
	return vehicule


## Le studio des portraits : sa photo se pose (`_photographier`) à la première image où son corps est monté en entier,
## son gabarit mesuré ; dix images après (le rendu headless ne publie aucune image, `frame_post_draw`), la pose du corps
## n'a pas bougé, ni le haut de sa tête, que sa caméra cadre.
func _studio() -> void:
	var studio := StudioDePortraits.studio()
	await process_frame
	var combattant: Combattant = studio.get_node("Monde/Combattant")
	var montage: MontageDeComposition = combattant.get_node("Modele")
	(combattant.get_node("Etats") as AnimationTree).callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	studio.photographier({base = BASE, gabarit = GABARIT, montes = [{ligne = "main", element = HALLEBARDE}]})
	await _attendre(func() -> bool: return montage.squelette != null)
	for os in montage.squelette.get_bone_count():
		montage.squelette.set_bone_pose_rotation(os, montage.squelette.get_bone_pose_rotation(os) * Quaternion(Vector3.RIGHT, POSE_D_AVANT))
	await _attendre(func() -> bool: return studio._etape == StudioDePortraits.Etape.PHOTO)
	var a_la_photo := _rotations(montage.squelette)
	var marque := montage.lecteur.assigned_animation
	var hors_du_clip := _ecart(a_la_photo, _premiere_image(montage.squelette, montage.lecteur.get_animation(marque)))
	_verifier(not montage.seconde_prise.is_empty() and hors_du_clip < MEME_POSE, "studio : la pose de la photo s'écarte de %.4f rad de la première image de %s posée sur le repos" % [hors_du_clip, marque])
	var tete := combattant.hauteur_de_la_tete()
	for i in 10:
		await process_frame
	var ecart := _ecart(a_la_photo, _rotations(montage.squelette))
	_verifier(ecart < MEME_POSE, "studio : la pose repart de %.4f rad dix images après la photo" % ecart)
	var cadrage := MiseEnPage.cadrage_en_buste(combattant.hauteur_de_la_tete())
	var cadree := (studio.get_node("Monde/Camera") as Camera3D).position.is_equal_approx(Vector3(0.0, cadrage.x, cadrage.y))
	_verifier(not montage.gabarit.mesures().is_empty() and is_equal_approx(tete, combattant.hauteur_de_la_tete()) and cadree, "studio : la photo part avant la mesure du gabarit (tête à %.4f à la photo, %.4f dix images après)" % [tete, combattant.hauteur_de_la_tete()])
	print("[arbre-d-etats] studio : écart de pose à la première image de %s %.6f rad, dix images après la photo %.6f rad, tête à %.4f" % [marque, hors_du_clip, ecart, tete])
	studio.queue_free()
	await process_frame


## Un combattant sans corps ni véhicule, montré hors de combat : son arbre reste inactif et débranché.
func _sans_corps() -> void:
	var combattant: Combattant = (load("res://scenes/Combattant.tscn") as PackedScene).instantiate()
	root.add_child(combattant)
	combattant.montrer({id = "seul", nom = "Seul", pb = [0, 5], horsCombat = true}, Vector3.ZERO, true, null, null, 2.0)
	for i in 5:
		await process_frame
	var arbre: EtatsDuCorps = combattant.get_node("Etats")
	_verifier(not arbre.active and arbre.anim_player.is_empty(), "sans corps : l'arbre est actif ou branché")
	combattant.queue_free()
	await process_frame


## L'alias `role/<role>` du lecteur joue-t-il le clip `clip` : la même ressource, ou sa copie à la boucle de son rôle
## (`EtatsDuCorps.BOUCLES`) ?
func _alias_de(lecteur: AnimationPlayer, role: String, clip: String) -> bool:
	if not lecteur.has_animation("role/" + role) or not lecteur.has_animation(clip):
		return false
	var alias := lecteur.get_animation("role/" + role)
	var source := lecteur.get_animation(clip)
	return alias == source or (alias.loop_mode == EtatsDuCorps.BOUCLES.get(role, source.loop_mode) and alias.length == source.length and alias.get_track_count() == source.get_track_count() and alias.track_get_path(0) == source.track_get_path(0) and alias.track_get_key_count(0) == source.track_get_key_count(0))


## `n` images de l'horloge manuelle de l'arbre, chacune suivie d'une image du jeu (`EtatsDuCorps._process`).
func _pas(n := 1) -> void:
	for i in n:
		_arbre.advance(PAS_S)
		await process_frame


## La rotation de chaque os de `squelette` à la première image de `clip` posée sur son repos : celle de sa piste, ou
## celle du repos pour un os que le clip n'anime pas.
func _premiere_image(squelette: Skeleton3D, clip: Animation) -> Array[Quaternion]:
	var rotations: Array[Quaternion] = []
	for os in squelette.get_bone_count():
		rotations.append(squelette.get_bone_rest(os).basis.get_rotation_quaternion())
	for piste in clip.get_track_count():
		var os := squelette.find_bone(clip.track_get_path(piste).get_concatenated_subnames())
		if clip.track_get_type(piste) == Animation.TYPE_ROTATION_3D and os != -1:
			rotations[os] = clip.rotation_track_interpolate(piste, 0.0)
	return rotations


## La rotation de la pose de chaque os de `squelette`.
func _rotations(squelette: Skeleton3D) -> Array[Quaternion]:
	var rotations: Array[Quaternion] = []
	for os in squelette.get_bone_count():
		rotations.append(squelette.get_bone_pose_rotation(os))
	return rotations


## Le plus grand écart (rad) d'un os entre les poses `a` et `b`.
func _ecart(a: Array[Quaternion], b: Array[Quaternion]) -> float:
	var ecart := 0.0
	for os in a.size():
		ecart = maxf(ecart, _angle(a[os], b[os]))
	return ecart


## L'angle (rad) de la rotation qui mène de `a` à `b`, exact près de zéro (`asin` de la corde, où `acos` perd ses
## décimales).
func _angle(a: Quaternion, b: Quaternion) -> float:
	return 4.0 * asin(minf((a - b).length(), (a + b).length()) / 2.0)


## Les images passées jusqu'à ce que `tenu` le soit, au plus `IMAGES_D_ATTENTE`.
func _attendre(tenu: Callable) -> void:
	for i in IMAGES_D_ATTENTE:
		if tenu.call():
			return
		await process_frame
	_fautes.append("attente échue")


func _verifier(tenu: bool, faute: String) -> void:
	if not tenu:
		_fautes.append(faute)
