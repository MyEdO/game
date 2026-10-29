## L'atelier 3D (#3086) : les modèles que le serveur de l'export liste (`GET modeles/`), indexés par le pont
## (`modeles`, `hotes/godot/pont/atelier.ts`), et chaque GLB chargé à l'exécution (`GET modeles/<id>.glb`). Le joueur y
## choisit un corps, monte un élément par point d'accroche (`hotes/godot/asset/evaluateur/evaluer.ts` `monter`,
## `MontageDEquipement.attacher`), joue les clips de la base
## image par image, montre les aides (os, emplacements, prises) et recharge les GLB réexportés sans relancer l'atelier.
## Chaque geste mis en page, il publie à la page ce que l'écran porte (`PontDuNoyau.publier_l_ecran`).
extends Node3D

const VIDE := "vide"
const AIDE_DU_GENRE := {emplacement = "emplacements", prise = "prises"}
const COULEUR_DES_AIDES := {os = Color(0.95, 0.85, 0.2), emplacements = Color(0.3, 0.8, 1.0), prises = Color(1.0, 0.4, 0.35)}
const ORIGINE := [0.0, 0.0, 0.0]
const RAYON_DU_REPERE_D_OS := 0.02
## Plus grand que celui d'un os : le repère d'un point déborde de celui de son os, quel que soit l'ordre de rendu.
const RAYON_DU_REPERE_DE_POINT := 0.035
const TAILLE_DE_L_ETIQUETTE := 0.0015
const DEBUT_D_EMPREINTE := 12
const DELAI_DE_REQUETE_S := 10.0
## Le plus grand bloc que HTTPRequest lit par image : un GLB de base se reçoit en quelques images, pas en une par 64 Kio.
const BLOC_DE_TELECHARGEMENT := 16777216
## La largeur en pixels à laquelle le SVG d'un emblème se rastérise (#3111).
const LARGEUR_D_EMBLEME := 512.0

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _support_du_modele: Node3D = $Modele
@onready var _interface: CanvasLayer = $Interface
@onready var _etat: Label = %Etat
@onready var _corps: HFlowContainer = %Corps
@onready var _points: VBoxContainer = %Points
@onready var _clips: VBoxContainer = %ListeDesClips
@onready var _instant: Label = %Instant
@onready var _cases_des_aides := {os = %AideOs, emplacements = %AideEmplacements, prises = %AidePrises}

var _modeles: Dictionary = {}
var _base: Dictionary = {}
## L'id de la base demandée en dernier, posée ou en chargement.
var _base_demandee: Variant = null
## Le chargement retenu : un chargement qu'un autre remplace jette son résultat.
var _chargement: RefCounted = null
var _modele: Node3D = null
var _squelette: Skeleton3D = null
var _lecteur: AnimationPlayer = null
var _pas := 0.0
var _vitesse := 1.0
## Le clip que « Recharger » rejoue, à son instant, en lecture ou en pause.
var _reprise: Dictionary = {}
var _montes: Dictionary = {}
## Par point monté dont l'élément porte une surface à blason, l'emblème posé (#3111).
var _emblemes: Dictionary = {}
var _supports: Dictionary = {}
## Par point, sa ligne au panneau ; et la ligne de ses emblèmes, s'il en offre.
var _lignes: Dictionary = {}
var _lignes_des_emblemes: Dictionary = {}
## Par point, la demande de montage retenue : le montage en vol d'une autre demande est jeté.
var _demandes: Dictionary = {}
var _boutons_des_bases: Dictionary = {}
var _boutons_des_clips: Dictionary = {}
var _boutons_des_points: Dictionary = {}
var _boutons_des_emblemes: Dictionary = {}
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
	%Defilement.get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier())
	if await _pont.rejoindre(_signaler, _signaler):
		await _charger({}, {})


func _process(_delta: float) -> void:
	_instant.text = "%.3f s" % _lecteur.current_animation_position if _a_un_clip() else ""


## Le listage du serveur, puis l'index du pont, puis la base retenue (la demandée si elle reste listée, la première sinon),
## qui remonte les éléments `montes` que ses points listent encore, sous leurs `emblemes`.
func _charger(montes: Dictionary, emblemes: Dictionary) -> void:
	var chargement := RefCounted.new()
	_chargement = chargement
	_erreurs.clear()
	var listage := await _lire_json("modeles/")
	if chargement != _chargement:
		return
	for erreur in listage.get("erreurs", []):
		_erreurs.append(str(erreur))
	var reponse := _pont.appeler("modeles", {manifestes = listage.get("manifestes", {}), osDesRigides = listage.get("osDesRigides", {})})
	if reponse.get("ok") != true:
		_montrer_l_etat()
		return
	_modeles = reponse
	for refus in reponse.refus:
		_erreurs.append(str(refus))
	Controles.vider(_corps)
	_boutons_des_bases = {}
	var groupe := ButtonGroup.new()
	var retenue: Variant = null
	for base in reponse.bases:
		_boutons_des_bases[base.id] = _bascule(base.id, groupe, _corps, _choisir_la_base.bind(base.id))
		if retenue == null or base.id == _base_demandee:
			retenue = base
	_base_demandee = null if retenue == null else retenue.id
	await _poser(retenue, montes, emblemes, chargement)


## La base `id` demandée : le dernier clic gagne, contre la base posée comme contre celle en chargement.
func _choisir_la_base(id: String) -> void:
	_marquer(_boutons_des_bases, _base.get("id"))
	if id == _base_demandee:
		_publier()
		return
	for base in _modeles.bases:
		if base.id == id:
			_base_demandee = id
			_reprise = {}
			var chargement := RefCounted.new()
			_chargement = chargement
			await _poser(base, {}, {}, chargement)


func _recharger() -> void:
	_reprise = {}
	if _a_un_clip():
		_reprise = {clip = _lecteur.assigned_animation, instant = _lecteur.current_animation_position, lecture = _lecteur.is_playing()}
	await _charger(_montes.duplicate(), _emblemes.duplicate())


## La base `base` (aucune si `null`) posée dans la scène depuis son GLB, si `chargement` reste le chargement retenu : ses
## points, ses aides, ses clips, et les éléments `montes` que ses points listent encore, sous leurs `emblemes`.
func _poser(base: Variant, montes: Dictionary, emblemes: Dictionary, chargement: RefCounted) -> void:
	var scene: Node3D = null
	if base != null:
		scene = await _scene_du_glb(base.id)
	if chargement != _chargement:
		if scene != null:
			scene.free()
		return
	_remettre_a_zero()
	_base = {} if base == null else base
	_marquer(_boutons_des_bases, _base.get("id"))
	if scene != null:
		_poser_le_modele(scene)
	if _squelette != null:
		for os in _squelette.get_bone_count():
			var declaration := {os = _squelette.get_bone_name(os), position = ORIGINE, rotation = ORIGINE}
			var support := MontageDEquipement.attacher(_squelette, declaration, "Os_%d" % os)
			support.add_child(_repere(COULEUR_DES_AIDES.os, RAYON_DU_REPERE_D_OS))
			_reperes.os.append(support)
	for point in _base.get("points", []):
		_ligne_du_point(point)
		_poser_l_aide_du_point(point)
		if montes.get(point.id) in point.elements:
			_choisir(point, montes[point.id], emblemes.get(point.id, VIDE))
	_poser_les_clips()
	for aide in _aides:
		_montrer_l_aide(_aides[aide], aide)
	_montrer_l_etat()


## L'écran ramené à aucun modèle : ni squelette ni lecteur, ni ligne de point, ni clip, ni repère, ni élément monté, ni
## demande de montage en vol.
func _remettre_a_zero() -> void:
	if _modele != null:
		_support_du_modele.remove_child(_modele)
		_modele.queue_free()
	_modele = null
	_squelette = null
	_lecteur = null
	_pas = 0.0
	Controles.vider(_points)
	Controles.vider(_clips)
	_reperes = {os = [], emplacements = [], prises = []}
	_supports.clear()
	_montes.clear()
	_emblemes.clear()
	_demandes.clear()
	_lignes.clear()
	_lignes_des_emblemes.clear()
	_boutons_des_points = {}
	_boutons_des_emblemes = {}
	_boutons_des_clips = {}


func _poser_le_modele(scene: Node3D) -> void:
	_modele = scene
	_support_du_modele.add_child(scene)
	_squelette = MontageDEquipement.squelette_de(scene)
	for candidat in scene.find_children("*", "AnimationPlayer", true, false):
		_lecteur = candidat as AnimationPlayer
		break
	if _squelette == null:
		_erreurs.append("squelette-absent : %s" % _base.id)


## La ligne d'un point : son id, puis « vide » et un bouton par élément, bascules d'un même groupe ; « aucun élément »
## s'il n'en a pas.
func _ligne_du_point(point: Dictionary) -> void:
	var ligne := HFlowContainer.new()
	var titre := Label.new()
	titre.text = point.id
	ligne.add_child(titre)
	_points.add_child(ligne)
	_lignes[point.id] = ligne
	if point.elements.is_empty():
		var aucun := Label.new()
		aucun.text = "aucun élément"
		ligne.add_child(aucun)
		return
	var groupe := ButtonGroup.new()
	var boutons := {}
	var choix := [VIDE]
	choix.append_array(point.elements)
	for element in choix:
		var bouton := _bascule(element, groupe, ligne, _choisir.bind(point, element))
		bouton.set_meta("cle", "%s/%s" % [point.id, element])
		boutons[element] = bouton
	_boutons_des_points[point.id] = boutons
	_marquer(boutons, VIDE)


## Une bascule du groupe `groupe` posée dans `parent`, qui joue `geste`.
func _bascule(texte: String, groupe: ButtonGroup, parent: Node, geste: Callable) -> Button:
	var bouton := Button.new()
	bouton.text = texte
	bouton.toggle_mode = true
	bouton.button_group = groupe
	bouton.pressed.connect(geste)
	parent.add_child(bouton)
	return bouton


## Chaque bascule de `boutons` pressée si sa clé est `retenu`, relâchée sinon : l'écran presse ce qui est.
func _marquer(boutons: Dictionary, retenu: Variant) -> void:
	for cle in boutons:
		boutons[cle].set_pressed_no_signal(cle == retenu)


## La demande du joueur au point `point` : l'élément monté démonté avec son emblème, puis `element` monté sous
## l'emblème `embleme` s'il n'est pas « vide ».
func _choisir(point: Dictionary, element: String, embleme: String = VIDE) -> void:
	var demande := RefCounted.new()
	_demandes[point.id] = demande
	if _supports.has(point.id):
		for support in _supports[point.id]:
			support.get_parent().free()
		_supports.erase(point.id)
		_montes.erase(point.id)
	_emblemes.erase(point.id)
	if _lignes_des_emblemes.has(point.id):
		_points.remove_child(_lignes_des_emblemes[point.id])
		_lignes_des_emblemes[point.id].queue_free()
		_lignes_des_emblemes.erase(point.id)
		_boutons_des_emblemes.erase(point.id)
	_marquer(_boutons_des_points[point.id], VIDE)
	if element != VIDE:
		await _monter(point, element, embleme, demande)
	_publier()


## `element` monté au point `point` une fois son GLB chargé, si `demande` reste la demande retenue de ce point : chaque
## mesh rigide pendu à un os du GLB, à sa transformation locale, sous l'os de même nom de la base
## (`hotes/godot/asset/evaluateur/evaluer.ts` `monter`) ; rien de monté s'il n'en a aucun ou si l'un de ses os manque.
## Monté, il offre ses emblèmes s'il porte une surface à blason, `embleme` posé.
func _monter(point: Dictionary, element: String, embleme: String, demande: RefCounted) -> void:
	var squelette := _squelette
	if squelette == null:
		return
	var scene := await _scene_du_glb(element)
	if demande != _demandes.get(point.id):
		if scene != null:
			scene.free()
		return
	if scene == null:
		_montrer_l_etat()
		return
	var pieces := _rigides_pendus(scene)
	if pieces.is_empty():
		_erreurs.append("rigide-sans-os : %s" % element)
	var supports: Array[Node3D] = []
	for piece in pieces:
		var os: String = (piece.get_parent() as BoneAttachment3D).bone_name
		var support := MontageDEquipement.attacher(squelette, {os = os, position = ORIGINE, rotation = ORIGINE}, "Monte_%s_%s" % [point.id, piece.name])
		if support == null:
			_erreurs.append("os-absent : %s" % os)
			break
		supports.append(support)
		piece.owner = null
		piece.reparent(support, false)
	scene.free()
	if pieces.is_empty() or supports.size() != pieces.size():
		for support in supports:
			support.get_parent().free()
		_montrer_l_etat()
		return
	_supports[point.id] = supports
	_montes[point.id] = element
	_marquer(_boutons_des_points[point.id], element)
	_ligne_des_emblemes(point.id, element, embleme)


## Sous la ligne du point `point_id`, si `element` qui y est monté porte une surface à blason (`blasons` de la réponse de
## `modeles`) : « vide » et un bouton par emblème, bascules d'un même groupe, `embleme` posé s'il est offert.
func _ligne_des_emblemes(point_id: String, element: String, embleme: String) -> void:
	if _modeles.blasons.get(element, []).is_empty():
		return
	var ligne := HFlowContainer.new()
	var titre := Label.new()
	titre.text = "emblème"
	ligne.add_child(titre)
	_lignes[point_id].add_sibling(ligne)
	_lignes_des_emblemes[point_id] = ligne
	var groupe := ButtonGroup.new()
	var boutons := {}
	var choix: Array = [{id = VIDE, label = VIDE}]
	choix.append_array(_modeles.emblemes)
	for offert in choix:
		var bouton := _bascule(offert.label, groupe, ligne, _choisir_l_embleme.bind(point_id, offert.id))
		bouton.set_meta("cle", "%s/embleme/%s" % [point_id, offert.id])
		boutons[offert.id] = bouton
	_boutons_des_emblemes[point_id] = boutons
	_choisir_l_embleme(point_id, embleme if boutons.has(embleme) else VIDE)


## L'emblème `embleme` posé sur l'élément monté au point `point_id` : sur chaque surface dont le matériau porte un nom de
## ses `blasons`, un matériau propre (`MontageDEquipement.materiau_local`) dont la couche de détail, en UV1 et en
## mélange, est l'emblème ; « vide » rend à chaque surface le matériau du GLB.
func _choisir_l_embleme(point_id: String, embleme: String) -> void:
	var noms: Array = _modeles.blasons[_montes[point_id]]
	var texture: ImageTexture = _texture_de_l_embleme(embleme) if embleme != VIDE else null
	for support in _supports[point_id]:
		for enfant in support.get_children():
			var piece := enfant as MeshInstance3D
			if piece == null:
				continue
			for surface in piece.mesh.get_surface_count():
				piece.set_surface_override_material(surface, null)
				var materiau := piece.get_active_material(surface)
				if texture == null or materiau == null or not (materiau.resource_name in noms):
					continue
				var local := MontageDEquipement.materiau_local(piece, surface)
				if local == null:
					continue
				local.detail_enabled = true
				local.detail_albedo = texture
				local.detail_uv_layer = BaseMaterial3D.DETAIL_UV_1
				local.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MIX
	var pose := VIDE if texture == null else embleme
	if pose == VIDE:
		_emblemes.erase(point_id)
	else:
		_emblemes[point_id] = pose
	_marquer(_boutons_des_emblemes[point_id], pose)
	_publier()


## Le SVG de l'emblème `id` (`emblemes` de la réponse de `modeles`) rastérisé à `LARGEUR_D_EMBLEME` pixels de large, ses
## mipmaps générées ; `null` (et une erreur) s'il ne se lit pas.
func _texture_de_l_embleme(id: String) -> ImageTexture:
	for embleme in _modeles.emblemes:
		if embleme.id != id:
			continue
		var image := Image.new()
		var code := image.load_svg_from_string(embleme.svg)
		if code == OK:
			code = image.load_svg_from_string(embleme.svg, MiseEnPage.echelle_d_image(LARGEUR_D_EMBLEME, image.get_width()))
		if code != OK or image.is_empty():
			_erreurs.append("embleme-illisible : %s (%s)" % [id, error_string(code)])
			return null
		image.generate_mipmaps()
		return ImageTexture.create_from_image(image)
	_erreurs.append("embleme-absent : %s" % id)
	return null


## Les meshes rigides de `scene` pendus à un os : l'import glTF pose chacun sous un `BoneAttachment3D` de son os.
func _rigides_pendus(scene: Node3D) -> Array[MeshInstance3D]:
	var pieces: Array[MeshInstance3D] = []
	for noeud in scene.find_children("*", "MeshInstance3D", true, false):
		var piece := noeud as MeshInstance3D
		if piece.skin == null and piece.get_parent() is BoneAttachment3D:
			pieces.append(piece)
	return pieces


func _poser_l_aide_du_point(point: Dictionary) -> void:
	if _squelette == null:
		return
	var aide: String = AIDE_DU_GENRE[point.genre]
	var support := MontageDEquipement.attacher(_squelette, point.attache, "Aide_%s" % point.id)
	if support == null:
		return
	support.add_child(_repere(COULEUR_DES_AIDES[aide], RAYON_DU_REPERE_DE_POINT))
	var etiquette := Label3D.new()
	etiquette.text = point.id
	etiquette.pixel_size = TAILLE_DE_L_ETIQUETTE
	etiquette.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	etiquette.no_depth_test = true
	etiquette.modulate = COULEUR_DES_AIDES[aide]
	support.add_child(etiquette)
	_reperes[aide].append(support)


func _repere(couleur: Color, rayon: float) -> MeshInstance3D:
	var matiere := StandardMaterial3D.new()
	matiere.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	matiere.albedo_color = couleur
	matiere.no_depth_test = true
	var boule := SphereMesh.new()
	boule.radius = rayon
	boule.height = MiseEnPage.diametre(rayon)
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


## Un bouton par clip de la base, chacun mis en boucle ; le clip de la reprise rejoué à son instant, en lecture ou en
## pause.
func _poser_les_clips() -> void:
	if _lecteur == null:
		return
	var groupe := ButtonGroup.new()
	for nom in _lecteur.get_animation_list():
		_lecteur.get_animation(nom).loop_mode = Animation.LOOP_LINEAR
		_boutons_des_clips[nom] = _bascule(nom, groupe, _clips, _jouer_le_clip.bind(nom))
	_lecteur.speed_scale = _vitesse
	_marquer(_boutons_des_clips, null)
	if not _lecteur.has_animation(_reprise.get("clip", "")):
		return
	_jouer_le_clip(_reprise.clip)
	_lecteur.seek(_reprise.instant, true)
	if not _reprise.lecture:
		_lecteur.pause()


func _jouer_le_clip(nom: String) -> void:
	_lecteur.play(nom)
	var animation := _lecteur.get_animation(nom)
	_pas = 0.0
	for piste in animation.get_track_count():
		_pas = MiseEnPage.pas_d_image(_pas, animation.length, animation.track_get_key_count(piste))
	_marquer(_boutons_des_clips, nom)
	_publier()


## Si un clip est engagé au lecteur, joué ou en pause.
func _a_un_clip() -> bool:
	return _lecteur != null and _lecteur.assigned_animation != ""


func _lire() -> void:
	if _a_un_clip():
		_lecteur.play()
	_publier()


func _mettre_en_pause() -> void:
	if _a_un_clip():
		_lecteur.pause()
	_publier()


func _aller_a_l_image(sens: float) -> void:
	if _a_un_clip():
		_lecteur.pause()
		_lecteur.seek(MiseEnPage.image_voisine(_lecteur.current_animation_position, _pas, sens, _lecteur.current_animation_length), true)
	_publier()


func _regler_la_vitesse(vitesse: float) -> void:
	_vitesse = vitesse
	if _lecteur != null:
		_lecteur.speed_scale = vitesse
	_publier()


## Le GLB du modèle `id`, sous le fichier que lui donne `glb` de la réponse retenue, chargé à l'exécution en scène ;
## `null` (et une erreur) s'il n'y a pas de fichier ou s'il ne se lit pas.
func _scene_du_glb(id: String) -> Node3D:
	if not _modeles.glb.has(id):
		_erreurs.append("glb-absent : %s" % id)
		return null
	var octets := await _telecharger("modeles/%s" % _modeles.glb[id])
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


## Les octets de `relative`, adresse relative à la page ; vides (et une erreur) si la requête échoue ou expire.
func _telecharger(relative: String) -> PackedByteArray:
	var requete := HTTPRequest.new()
	requete.timeout = DELAI_DE_REQUETE_S
	requete.download_chunk_size = BLOC_DE_TELECHARGEMENT
	add_child(requete)
	var code := requete.request(_pont.adresse(relative))
	if code != OK:
		requete.queue_free()
		_erreurs.append("requete-refusee : %s (%s)" % [relative, error_string(code)])
		return PackedByteArray()
	var resultat: Array = await requete.request_completed
	requete.queue_free()
	if resultat[0] != HTTPRequest.RESULT_SUCCESS or resultat[1] != 200:
		_erreurs.append("requete-echouee : %s (resultat %s, HTTP %s)" % [relative, resultat[0], resultat[1]])
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


func _publier() -> void:
	_publier_l_ecran.call_deferred()


## Ce que l'écran porte, une fois mis en page : ses boutons, et l'état de l'atelier.
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	var clip: Variant = _lecteur.assigned_animation if _a_un_clip() else null
	_pont.publier_l_ecran({
		boutons = PontDuNoyau.boutons_a_l_ecran([_interface]),
		atelier = {
			base = _base.get("id"),
			empreinte = _base.get("empreinte"),
			clip = clip,
			instant = _lecteur.current_animation_position if clip != null else null,
			lecture = _lecteur.is_playing() if clip != null else false,
			vitesse = _vitesse,
			montes = _montes,
			emblemes = _emblemes,
			aides = _aides,
			erreurs = _erreurs,
		},
	})
