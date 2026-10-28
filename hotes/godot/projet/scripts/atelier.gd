## L'atelier 3D (#3086) : les modèles que le serveur de l'export liste (`GET modeles/`), indexés par le pont
## (`modeles`, `hotes/godot/pont/atelier.ts`), et chaque GLB chargé à l'exécution (`GET modeles/<id>.glb`). Le joueur y
## choisit un corps, monte un élément par point d'accroche (`MontageDEquipement.attacher`), joue les clips de la base
## image par image, montre les aides (os, emplacements, prises) et recharge les GLB réexportés sans relancer l'atelier.
## Chaque geste mis en page, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`).
extends Node3D

const VIDE := "vide"
const AIDE_DU_GENRE := {emplacement = "emplacements", prise = "prises"}
const COULEUR_DES_AIDES := {os = Color(0.95, 0.85, 0.2), emplacements = Color(0.3, 0.8, 1.0), prises = Color(1.0, 0.4, 0.35)}
const TAILLE_DU_REPERE := 0.03
const TAILLE_DE_L_ETIQUETTE := 0.0015
const DEBUT_D_EMPREINTE := 12

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _support_du_modele: Node3D = $Modele
@onready var _interface: CanvasLayer = $Interface
@onready var _etat: Label = %Etat
@onready var _corps: HFlowContainer = %Corps
@onready var _points: VBoxContainer = %Points
@onready var _clips: VBoxContainer = %ListeDesClips
@onready var _cases_des_aides := {os = %AideOs, emplacements = %AideEmplacements, prises = %AidePrises}

var _modeles: Dictionary = {}
var _base: Dictionary = {}
var _modele: Node3D = null
var _squelette: Skeleton3D = null
var _lecteur: AnimationPlayer = null
var _clip := ""
var _pas := 0.0
var _instant := 0.0
var _lecture := false
var _vitesse := 1.0
var _montes: Dictionary = {}
var _supports: Dictionary = {}
var _aides := {os = false, emplacements = false, prises = false}
var _reperes := {os = [], emplacements = [], prises = []}
var _erreurs: Array[String] = []


func _ready() -> void:
	%Recharger.pressed.connect(_recharger)
	%Lecture.pressed.connect(_lire)
	%Pause.pressed.connect(_mettre_en_pause)
	%ImagePrecedente.pressed.connect(_aller_a_l_image.bind(-1.0))
	%ImageSuivante.pressed.connect(_aller_a_l_image.bind(1.0))
	for bouton in %Vitesses.get_children():
		bouton.pressed.connect(_regler_la_vitesse.bind(float(bouton.get_meta("vitesse"))))
	for aide in _cases_des_aides:
		_cases_des_aides[aide].toggled.connect(_montrer_l_aide.bind(aide))
	for defilement in [%Defilement, %Clips]:
		defilement.get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier())
	_pont.refus.connect(func(erreur: Dictionary) -> void: _signaler(str(erreur.message)))
	_pont.panne.connect(_signaler)
	if not _pont.est_web:
		_signaler("Cet hôte joue dans une page : son pont est `wfrp-pont.js` (export Web).")
		return
	if not _pont.est_pret():
		await _pont.pret
	await _charger()


## Le listage du serveur, puis l'index du pont, puis la base retenue (la même si elle reste listée, la première sinon).
func _charger() -> void:
	_erreurs.clear()
	var listage := await _lire_json("modeles/")
	for erreur in listage.get("erreurs", []):
		_erreurs.append(str(erreur))
	var reponse := _pont.appeler("modeles", {manifestes = listage.get("manifestes", {})})
	if reponse.get("ok") != true:
		_montrer_l_etat()
		return
	_modeles = reponse
	for refus in reponse.refus:
		_erreurs.append(str(refus))
	_vider(_corps)
	var retenue: Variant = null
	for base in reponse.bases:
		var bouton := Button.new()
		bouton.text = base.id
		bouton.pressed.connect(_choisir_la_base.bind(base.id))
		_corps.add_child(bouton)
		if retenue == null or base.id == _base.get("id"):
			retenue = base
	if retenue == null:
		_base = {}
		_poser_le_modele(null)
		_montrer_l_etat()
		return
	await _poser(retenue)


func _choisir_la_base(id: String) -> void:
	if id == _base.get("id"):
		return
	for base in _modeles.bases:
		if base.id == id:
			_montes.clear()
			_clip = ""
			_instant = 0.0
			await _poser(base)


func _recharger() -> void:
	if _lecteur != null and _clip != "":
		_instant = _lecteur.current_animation_position
		_lecture = _lecteur.is_playing()
	await _charger()


## La base `base` posée dans la scène depuis son GLB : ses points, ses aides, ses clips, et les éléments montés que ses
## points listent encore.
func _poser(base: Dictionary) -> void:
	_base = base
	var scene := await _scene_du_glb(base.id)
	_poser_le_modele(scene)
	_vider(_points)
	_vider(_clips)
	_reperes = {os = [], emplacements = [], prises = []}
	_supports.clear()
	var montes := _montes.duplicate()
	_montes.clear()
	if _squelette != null:
		for os in _squelette.get_bone_count():
			var attache := BoneAttachment3D.new()
			attache.name = "Os_%d" % os
			_squelette.add_child(attache)
			attache.bone_name = _squelette.get_bone_name(os)
			attache.add_child(_repere(COULEUR_DES_AIDES.os))
			_reperes.os.append(attache)
	for point in base.points:
		_ligne_du_point(point, montes.get(point.id))
		_poser_l_aide_du_point(point)
	for point in base.points:
		if montes.get(point.id) in point.elements:
			await _monter(point, montes[point.id])
	_poser_les_clips()
	for aide in _aides:
		_montrer_l_aide(_aides[aide], aide)
	_montrer_l_etat()


func _poser_le_modele(scene: Node3D) -> void:
	if _modele != null:
		_support_du_modele.remove_child(_modele)
		_modele.queue_free()
	_modele = scene
	_squelette = null
	_lecteur = null
	if scene == null:
		return
	_support_du_modele.add_child(scene)
	for candidat in scene.find_children("*", "Skeleton3D", true, false):
		_squelette = candidat as Skeleton3D
		break
	for candidat in scene.find_children("*", "AnimationPlayer", true, false):
		_lecteur = candidat as AnimationPlayer
		break
	if _squelette == null:
		_erreurs.append("squelette-absent : %s" % _base.id)


## La ligne d'un point : son id, puis « vide » et un bouton par élément, bascules d'un même groupe ; « aucun élément »
## s'il n'en a pas.
func _ligne_du_point(point: Dictionary, monte: Variant) -> void:
	var ligne := HFlowContainer.new()
	var titre := Label.new()
	titre.text = point.id
	ligne.add_child(titre)
	_points.add_child(ligne)
	if point.elements.is_empty():
		var aucun := Label.new()
		aucun.text = "aucun élément"
		ligne.add_child(aucun)
		return
	var groupe := ButtonGroup.new()
	var choix := [VIDE]
	choix.append_array(point.elements)
	for element in choix:
		var bouton := Button.new()
		bouton.text = element
		bouton.toggle_mode = true
		bouton.button_group = groupe
		bouton.set_meta("cle", "%s/%s" % [point.id, element])
		bouton.set_pressed_no_signal(element == (VIDE if monte == null or not monte in point.elements else monte))
		bouton.pressed.connect(_choisir.bind(point, element))
		ligne.add_child(bouton)


func _choisir(point: Dictionary, element: String) -> void:
	if _supports.has(point.id):
		_supports[point.id].get_parent().free()
		_supports.erase(point.id)
		_montes.erase(point.id)
	if element != VIDE:
		await _monter(point, element)
	_publier()


func _monter(point: Dictionary, element: String) -> void:
	var scene := await _scene_du_glb(element)
	if scene == null:
		return
	if _squelette == null or not is_instance_valid(_squelette):
		scene.free()
		return
	var support := MontageDEquipement.attacher(_squelette, point.attache, "Monte_%s" % point.id)
	if support == null:
		scene.free()
		_erreurs.append("os-absent : %s" % point.attache.os)
		_montrer_l_etat()
		return
	support.add_child(scene)
	_supports[point.id] = support
	_montes[point.id] = element


func _poser_l_aide_du_point(point: Dictionary) -> void:
	if _squelette == null:
		return
	var aide: String = AIDE_DU_GENRE[point.genre]
	var support := MontageDEquipement.attacher(_squelette, point.attache, "Aide_%s" % point.id)
	if support == null:
		return
	support.add_child(_repere(COULEUR_DES_AIDES[aide]))
	var etiquette := Label3D.new()
	etiquette.text = point.id
	etiquette.pixel_size = TAILLE_DE_L_ETIQUETTE
	etiquette.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	etiquette.no_depth_test = true
	etiquette.modulate = COULEUR_DES_AIDES[aide]
	support.add_child(etiquette)
	_reperes[aide].append(support)


func _repere(couleur: Color) -> MeshInstance3D:
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.albedo_color = couleur
	matiere.no_depth_test = true
	var boule := SphereMesh.new()
	boule.radius = TAILLE_DU_REPERE
	boule.height = TAILLE_DU_REPERE
	boule.material = matiere
	var repere := MeshInstance3D.new()
	repere.mesh = boule
	return repere


func _montrer_l_aide(montre: bool, aide: String) -> void:
	_aides[aide] = montre
	_cases_des_aides[aide].set_pressed_no_signal(montre)
	for repere in _reperes[aide]:
		repere.visible = montre
	_publier()


## Un bouton par clip de la base, chacun mis en boucle ; le clip retenu rejoué à son instant, à sa vitesse.
func _poser_les_clips() -> void:
	if _lecteur == null:
		_clip = ""
		return
	for nom in _lecteur.get_animation_list():
		_lecteur.get_animation(nom).loop_mode = Animation.LOOP_LINEAR
		var bouton := Button.new()
		bouton.text = nom
		bouton.pressed.connect(_jouer_le_clip.bind(nom))
		_clips.add_child(bouton)
	_lecteur.speed_scale = _vitesse
	if not _lecteur.has_animation(_clip):
		_clip = ""
		return
	_jouer_le_clip(_clip)
	_lecteur.seek(_instant, true)
	if not _lecture:
		_lecteur.pause()


func _jouer_le_clip(nom: String) -> void:
	_clip = nom
	_lecture = true
	_lecteur.play(nom)
	_pas = 0.0
	var animation := _lecteur.get_animation(nom)
	for piste in animation.get_track_count():
		if animation.track_get_key_count(piste) in [0, 1]:
			continue
		_pas = MiseEnPage.ecart(animation.track_get_key_time(piste, 0), animation.track_get_key_time(piste, 1))
		break
	_publier()


func _lire() -> void:
	if _lecteur != null and _clip != "":
		_lecteur.play()
		_lecture = true
	_publier()


func _mettre_en_pause() -> void:
	if _lecteur != null and _clip != "":
		_lecteur.pause()
		_lecture = false
	_publier()


func _aller_a_l_image(sens: float) -> void:
	if _lecteur != null and _clip != "":
		_lecteur.pause()
		_lecture = false
		_lecteur.seek(MiseEnPage.image_voisine(_lecteur.current_animation_position, _pas, sens, _lecteur.current_animation_length), true)
	_publier()


func _regler_la_vitesse(vitesse: float) -> void:
	_vitesse = vitesse
	if _lecteur != null:
		_lecteur.speed_scale = vitesse
	_publier()


## Le GLB du modèle `id`, chargé à l'exécution en scène ; `null` (et une erreur) s'il ne se lit pas.
func _scene_du_glb(id: String) -> Node3D:
	var octets := await _telecharger("modeles/%s.glb" % id)
	if octets.is_empty():
		return null
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	etat.handle_binary_image_mode = GLTFState.HANDLE_BINARY_IMAGE_MODE_EMBED_AS_UNCOMPRESSED
	var code := document.append_from_buffer(octets, "", etat)
	var scene := document.generate_scene(etat) as Node3D if code == OK else null
	if scene == null:
		_erreurs.append("glb-illisible : %s (%s)" % [id, error_string(code)])
	return scene


func _lire_json(relative: String) -> Dictionary:
	var octets := await _telecharger(relative)
	var valeur: Variant = JSON.parse_string(octets.get_string_from_utf8()) if not octets.is_empty() else null
	if not valeur is Dictionary:
		_erreurs.append("listage-illisible : %s" % relative)
		return {}
	return valeur


## Les octets de `relative`, adresse relative à la page ; vides (et une erreur) si la requête échoue.
func _telecharger(relative: String) -> PackedByteArray:
	var requete := HTTPRequest.new()
	add_child(requete)
	var code := requete.request(_pont.adresse(relative))
	var resultat: Array = [code, 0, [], PackedByteArray()]
	if code == OK:
		resultat = await requete.request_completed
	requete.queue_free()
	if resultat[0] != OK or resultat[1] != 200:
		_erreurs.append("requete-echouee : %s (%s, HTTP %s)" % [relative, resultat[0], resultat[1]])
		return PackedByteArray()
	return resultat[3]


func _signaler(message: String) -> void:
	_erreurs.append(message)
	_montrer_l_etat()


func _montrer_l_etat() -> void:
	var lignes: Array[String] = []
	if not _base.is_empty():
		lignes.append("%s · %s" % [_base.id, str(_base.empreinte).left(DEBUT_D_EMPREINTE)])
	lignes.append_array(_erreurs)
	_etat.text = "\n".join(PackedStringArray(lignes))
	_publier()


func _vider(conteneur: Node) -> void:
	for enfant in conteneur.get_children():
		conteneur.remove_child(enfant)
		enfant.queue_free()


func _publier() -> void:
	_publier_l_ecran.call_deferred()


## Ce que l'écran porte, une fois mis en page : ses boutons, et l'état de l'atelier.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	var clip: Variant = _clip if _clip != "" else null
	_pont.publier_l_ecran({
		boutons = PontDuNoyau.boutons_a_l_ecran([_interface]),
		atelier = {
			base = _base.get("id"),
			empreinte = _base.get("empreinte"),
			clip = clip,
			instant = _lecteur.current_animation_position if clip != null else null,
			lecture = _lecteur.is_playing() if clip != null else false,
			vitesse = _lecteur.speed_scale if _lecteur != null else null,
			montes = _montes,
			aides = _aides,
			erreurs = _erreurs,
		},
	})
