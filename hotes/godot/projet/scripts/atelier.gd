## L'atelier 3D (#3086) : les modèles que le serveur de l'export liste (`GET modeles/`), indexés par le pont
## (`modeles`, `hotes/godot/pont/atelier.ts`), et chaque GLB chargé à l'exécution (`GET modeles/<id>.glb`). Le joueur y
## choisit un corps, compose un personnage depuis un preset ou ses axes (`composer`, `catalogues`, `presetDeComposition`,
## `hotes/godot/pont/composition.ts`), monte un élément par point d'accroche ou par ligne de pièce (`hotes/godot/asset/evaluateur/evaluer.ts`
## `monter`, `MontageDEquipement.attacher`, #3086 D3 et D4), joue les clips de la base
## image par image, fait marcher la base au clavier (`MarcheDeLAtelier`), montre les aides (os, emplacements, prises) et
## recharge les GLB réexportés sans relancer l'atelier.
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
## Le choix d'un axe à liste qui retire son champ de la composition.
const AUCUN := "aucun"
## Le bouton d'un axe `plage` qui retire son champ de la composition, sa valeur au `neutre` de l'axe.
const NEUTRE := "neutre"
## Le pas de la glissière d'un axe `plage`.
const PAS_DE_PLAGE := 0.05

@onready var _pont: PontDuNoyau = get_node("/root/Pont")
@onready var _support_du_modele: Node3D = $Modele
@onready var _interface: CanvasLayer = $Interface
@onready var _marche: MarcheDeLAtelier = $Marche
@onready var _etat: Label = %Etat
@onready var _corps: HFlowContainer = %Corps
@onready var _points: VBoxContainer = %Points
@onready var _lignes_de_piece: VBoxContainer = %Lignes
@onready var _clips: VBoxContainer = %ListeDesClips
@onready var _instant: Label = %Instant
@onready var _cases_des_aides := {os = %AideOs, emplacements = %AideEmplacements, prises = %AidePrises}
@onready var _onglets := {montage = %Defilement, composition = %DefilementDeComposition}

var _modeles: Dictionary = {}
var _base: Dictionary = {}
## L'id de la base demandée en dernier, posée ou en chargement.
var _base_demandee: Variant = null
## Le chargement retenu : un chargement qu'un autre remplace jette son résultat.
var _chargement: RefCounted = null
var _modele: Node3D = null
var _squelette: Skeleton3D = null
var _pose_des_os: Dictionary = {}
var _lecteur: AnimationPlayer = null
var _pas := 0.0
var _vitesse := 1.0
## Le clip que « Recharger » rejoue, à son instant, en lecture ou en pause.
var _reprise: Dictionary = {}
## Par id d'emplacement de montage, l'emplacement : un point (son id) ou une ligne de pièce (`ligne/<ligne>`), sa clé
## publiée, `montes` ou `lignes` qui la publie, sa rangée au panneau, les éléments qu'il offre et ses bascules par élément.
var _emplacements: Dictionary = {}
## Par id d'emplacement, l'élément monté.
var _montes: Dictionary = {}
## Par id d'emplacement monté dont l'élément porte une surface `blason`, l'emblème posé (#3111).
var _emblemes: Dictionary = {}
## Par id d'emplacement monté, ses meshes montés, et les nœuds qui les portent dans la scène.
var _pieces: Dictionary = {}
var _noeuds: Dictionary = {}
## Par id d'emplacement, la rangée de ses emblèmes, s'il en offre.
var _lignes_des_emblemes: Dictionary = {}
## Par id d'emplacement, la demande de montage retenue : le montage en vol d'une autre demande est jeté.
var _demandes: Dictionary = {}
var _boutons_des_bases: Dictionary = {}
var _boutons_des_clips: Dictionary = {}
var _boutons_des_emblemes: Dictionary = {}
var _aides := {os = false, emplacements = false, prises = false}
var _reperes := {os = [], emplacements = [], prises = []}
## Les erreurs du chargement, du montage et de la page.
var _erreurs: Array[String] = []
## Les erreurs du dernier geste de composition (`_composer`, `_copier`), que le suivant remplace.
var _erreurs_de_composition: Array[String] = []
## Les erreurs du gabarit posé (`os-absent`), que chaque pose remplace.
var _erreurs_du_gabarit: Array[String] = []
## Où va une erreur signalée : `_erreurs`, `_erreurs_de_composition` le temps d'un geste de composition.
var _recueil: Array[String] = []
## La réponse de `catalogues` : les choix de chaque champ d'une composition, et les presets.
var _catalogues: Dictionary = {}
## La composition courante (`CONTRAT.md`, « Composition d'un personnage ») : un preset appliqué la remplace, un axe changé
## la modifie.
var _composition: Dictionary = {}
## L'id du dernier preset appliqué, `null` avant tout preset : l'enveloppe de « Copier ».
var _preset: Variant = null
## La réponse de `composer` sur la base posée, vide avant toute composition, après un refus et après un changement de base.
var _composee: Dictionary = {}
## Le texte affiché du refus de la composition courante par `composer` (erreur `validation`), vide sans refus.
var _refus_de_composition := ""
## Les axes de `catalogues`, dans leur ordre.
var _axes: Array = []
## Par champ d'axe, son sélecteur : la liste d'un axe `ref` ou `valeur`, la glissière d'un axe `plage`.
var _selecteurs_d_axe: Dictionary = {}
## Le modificateur du squelette de la base qui pose le gabarit de la composition composée.
var _gabarit: GabaritDuSquelette = null
var _onglet := "montage"


func _ready() -> void:
	_recueil = _erreurs
	%Recharger.pressed.connect(_recharger)
	%Lecture.pressed.connect(_lire)
	%Pause.pressed.connect(_mettre_en_pause)
	%ImagePrecedente.pressed.connect(_aller_a_l_image.bind(-1.0))
	%ImageSuivante.pressed.connect(_aller_a_l_image.bind(1.0))
	for bouton in %Vitesses.get_children():
		bouton.pressed.connect(_regler_la_vitesse.bind(float(bouton.get_meta("vitesse"))))
	for aide in _cases_des_aides:
		_cases_des_aides[aide].toggled.connect(_montrer_l_aide.bind(aide))
	for onglet in _onglets:
		_onglets[onglet].get_v_scroll_bar().value_changed.connect(func(_valeur: float) -> void: _publier())
	%OngletMontage.pressed.connect(_montrer_l_onglet.bind("montage"))
	%OngletComposition.pressed.connect(_montrer_l_onglet.bind("composition"))
	%Copier.pressed.connect(_copier)
	_marche.marche_commencee.connect(_jouer_le_clip)
	_marche.marche_arretee.connect(_publier)
	if await _pont.rejoindre(_signaler, _signaler):
		_poser_les_catalogues()
		await _charger({}, {})


func _process(_delta: float) -> void:
	_instant.text = "%.3f s" % _lecteur.current_animation_position if _a_un_clip() else ""
	if _a_un_clip() and _lecteur.is_playing():
		_publier()


## Le listage du serveur, puis l'index du pont, puis la base retenue (la demandée si elle reste listée, la première sinon),
## qui remonte les éléments `montes` que ses emplacements offrent encore, sous leurs `emblemes`.
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
	%Rapport.text = "\n".join(PackedStringArray(reponse.rapport))
	%Rapport.visible = not reponse.rapport.is_empty()
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
			_composee = {}
			_refus_de_composition = ""
			_erreurs_de_composition = []
			_montrer_la_composition()
			var chargement := RefCounted.new()
			_chargement = chargement
			await _poser(base, {}, {}, chargement)


func _recharger() -> void:
	_reprise = {}
	if _a_un_clip():
		_reprise = {clip = _lecteur.assigned_animation, instant = _lecteur.current_animation_position, lecture = _lecteur.is_playing()}
	await _charger(_montes.duplicate(), _emblemes.duplicate())


## La base `base` (aucune si `null`) posée dans la scène depuis son GLB, si `chargement` reste le chargement retenu : ses
## points, ses lignes de pièce, ses aides, ses clips, et les éléments `montes` que ses emplacements offrent encore, sous
## leurs `emblemes`.
func _poser(base: Variant, montes: Dictionary, emblemes: Dictionary, chargement: RefCounted) -> void:
	var scene: Node3D = null
	if base != null:
		scene = await _scene_du_glb(base.id, _erreurs)
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
		_emplacement_du_point(point)
		_poser_l_aide_du_point(point)
	for ligne in _base.get("lignes", []):
		_emplacement_de_la_ligne(ligne)
	for id in _emplacements:
		if montes.get(id) in _emplacements[id].elements:
			_choisir(_emplacements[id], montes[id], emblemes.get(id, VIDE))
	_poser_les_clips()
	_poser_le_gabarit()
	_poser_les_morphes()
	_marche.suivre(_modele, _lecteur, _base.get("marche", {}))
	for aide in _aides:
		_montrer_l_aide(_aides[aide], aide)
	_montrer_l_etat()


## L'écran ramené à aucun modèle : ni squelette ni lecteur, ni emplacement, ni clip, ni repère, ni élément monté, ni
## demande de montage en vol.
func _remettre_a_zero() -> void:
	if _modele != null:
		_support_du_modele.remove_child(_modele)
		_modele.queue_free()
	_modele = null
	_squelette = null
	_pose_des_os = {}
	_lecteur = null
	_gabarit = null
	_pas = 0.0
	Controles.vider(_points)
	Controles.vider(_lignes_de_piece)
	Controles.vider(_clips)
	_reperes = {os = [], emplacements = [], prises = []}
	_emplacements.clear()
	_pieces.clear()
	_noeuds.clear()
	_montes.clear()
	_emblemes.clear()
	_demandes.clear()
	_lignes_des_emblemes.clear()
	_boutons_des_emblemes = {}
	_boutons_des_clips = {}


func _poser_le_modele(scene: Node3D) -> void:
	_modele = scene
	_support_du_modele.add_child(scene)
	_squelette = MontageDEquipement.squelette_de(scene)
	if _squelette != null:
		_squelette.skeleton_updated.connect(_memoriser_la_pose)
	for candidat in scene.find_children("*", "AnimationPlayer", true, false):
		_lecteur = candidat as AnimationPlayer
		break
	if _squelette == null:
		_erreurs.append("squelette-absent : %s" % _base.id)
		return
	_gabarit = GabaritDuSquelette.new()
	_gabarit.mesure.connect(_cadrer)
	_squelette.add_child(_gabarit)


## L'emplacement de montage `id`, de clé publiée `cle` dans `publie` (`montes` ou `lignes`), qui offre `elements` : sa
## rangée posée dans `parent`, sans bouton encore.
func _emplacement(id: String, cle: String, publie: String, parent: Node, elements: Array) -> Dictionary:
	var rangee := HFlowContainer.new()
	parent.add_child(rangee)
	var emplacement := {id = id, cle = cle, publie = publie, rangee = rangee, elements = elements, boutons = {}}
	_emplacements[id] = emplacement
	return emplacement


## L'emplacement d'un point : son id, puis ses éléments en liste (`_liste`) ; « aucun élément » s'il n'en a pas.
func _emplacement_du_point(point: Dictionary) -> void:
	_liste(_emplacement(point.id, point.id, "montes", _points, point.elements), point.id, "aucun élément")


## L'emplacement d'une ligne de pièce (#3086, D3), d'id `ligne/<ligne>`, sa clé publiée `<ligne>` valant la `sorte` d'un
## sélecteur, `<sorte>/<id>` sinon : le sélecteur d'un axe (`tete`, `coiffure`), la bascule d'une `piece`, la liste d'un
## `emplacement`. Un choix sans élément dit « manquant », sans bouton.
func _emplacement_de_la_ligne(ligne: Dictionary) -> void:
	match ligne.sorte:
		"piece":
			_bascule_de_piece(ligne)
		"emplacement":
			var cle := "emplacement/%s" % ligne.id
			_liste(_emplacement("ligne/%s" % cle, cle, "lignes", _lignes_de_piece, ligne.elements), ligne.label, "manquant")
		_:
			_selecteur(ligne)


## Dans la rangée d'`emplacement`, `titre`, puis « vide » et un bouton par élément offert (son id), bascules d'un même
## groupe, de clé `<emplacement>/<élément>` ; `absent` s'il n'en offre aucun.
func _liste(emplacement: Dictionary, titre: String, absent: String) -> void:
	_etiquette(titre, emplacement.rangee)
	if emplacement.elements.is_empty():
		_etiquette(absent, emplacement.rangee)
		return
	var groupe := ButtonGroup.new()
	var choix := [VIDE]
	choix.append_array(emplacement.elements)
	for element in choix:
		_bouton_de_choix(emplacement, element, element, element, groupe)
	_marquer(emplacement.boutons, VIDE)


## Le sélecteur d'un axe : sa `sorte`, puis « vide » et un bouton par choix pourvu (son `label`, de clé
## `ligne/<sorte>/<id>`), bascules d'un même groupe, qui monte l'élément du choix, unique par (base, clé) ; sous sa
## rangée, chaque choix sans élément dit « <label> : manquant », un par ligne. Sans aucun choix pourvu, ni « vide » ni
## bouton.
func _selecteur(ligne: Dictionary) -> void:
	var elements := []
	for choix in ligne.choix:
		elements.append_array(choix.elements)
	var emplacement := _emplacement("ligne/%s" % ligne.sorte, ligne.sorte, "lignes", _lignes_de_piece, elements)
	_etiquette(ligne.sorte, emplacement.rangee)
	var groupe := ButtonGroup.new()
	if not elements.is_empty():
		_bouton_de_choix(emplacement, VIDE, VIDE, VIDE, groupe)
	for choix in ligne.choix:
		if choix.elements.is_empty():
			_etiquette("%s : manquant" % choix.label, _lignes_de_piece)
		else:
			_bouton_de_choix(emplacement, choix.elements[0], choix.label, choix.id, groupe)
	_marquer(emplacement.boutons, VIDE)


## La bascule d'une pièce : son `label`, de clé `ligne/piece/<id>`, qui monte l'élément de la pièce, unique par (base,
## clé), ou le démonte s'il l'est ; « <label> : manquant » sans élément.
func _bascule_de_piece(ligne: Dictionary) -> void:
	var cle := "piece/%s" % ligne.id
	var emplacement := _emplacement("ligne/%s" % cle, cle, "lignes", _lignes_de_piece, ligne.elements)
	if ligne.elements.is_empty():
		_etiquette("%s : manquant" % ligne.label, emplacement.rangee)
		return
	var element: String = ligne.elements[0]
	var bascule := func() -> void: _choisir(emplacement, VIDE if _montes.get(emplacement.id) == element else element)
	var bouton := _bascule(ligne.label, null, emplacement.rangee, bascule)
	bouton.set_meta("cle", emplacement.id)
	emplacement.boutons[element] = bouton
	_marquer(emplacement.boutons, VIDE)


## Le bouton qui monte `element` à `emplacement`, de texte `texte` et de clé `<emplacement>/<suffixe>`, bascule du groupe
## `groupe`.
func _bouton_de_choix(emplacement: Dictionary, element: String, texte: String, suffixe: String, groupe: ButtonGroup) -> void:
	var bouton := _bascule(texte, groupe, emplacement.rangee, _choisir.bind(emplacement, element))
	bouton.set_meta("cle", "%s/%s" % [emplacement.id, suffixe])
	emplacement.boutons[element] = bouton


func _etiquette(texte: String, parent: Node) -> void:
	var etiquette := Label.new()
	etiquette.text = texte
	parent.add_child(etiquette)


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


## La demande du joueur à `emplacement` : l'élément monté démonté avec son emblème, puis `element` monté sous l'emblème
## `embleme` s'il n'est pas « vide », ses erreurs au recueil du geste qui le demande.
func _choisir(emplacement: Dictionary, element: String, embleme: String = VIDE) -> void:
	var id: String = emplacement.id
	var recueil := _recueil
	var demande := RefCounted.new()
	_demandes[id] = demande
	for noeud in _noeuds.get(id, []):
		noeud.free()
	_noeuds.erase(id)
	_pieces.erase(id)
	_montes.erase(id)
	_emblemes.erase(id)
	if _lignes_des_emblemes.has(id):
		var rangee: Node = _lignes_des_emblemes[id]
		rangee.get_parent().remove_child(rangee)
		rangee.queue_free()
		_lignes_des_emblemes.erase(id)
		_boutons_des_emblemes.erase(id)
	_marquer(emplacement.boutons, VIDE)
	if element != VIDE:
		await _monter(emplacement, element, embleme, demande, recueil)
	_publier()


## `element` monté à `emplacement` une fois son GLB chargé, si `demande` reste la demande retenue de cet emplacement
## (#3086, D4) : chaque mesh rigide pendu à un os du GLB, à sa transformation locale, sous l'os de même nom de la base
## (`hotes/godot/asset/evaluateur/evaluer.ts` `monter`) ; chaque mesh skinné sous le squelette de la base, son skin lié
## par nom d'os (`_scene_du_glb`). Rien de monté s'il n'a aucun mesh à monter, ou si un os que ses meshes nomment manque
## à la base : chacun va à `recueil`. Monté, il offre ses emblèmes s'il porte une surface `blason`, `embleme`
## posé.
func _monter(emplacement: Dictionary, element: String, embleme: String, demande: RefCounted, recueil: Array[String]) -> void:
	var id: String = emplacement.id
	var squelette := _squelette
	if squelette == null:
		return
	var scene := await _scene_du_glb(element, recueil)
	if demande != _demandes.get(id):
		if scene != null:
			scene.free()
		return
	if scene == null:
		_montrer_l_etat()
		return
	var pieces: Array[MeshInstance3D] = []
	var os_des_pieces: Array[Array] = []
	var absents: Array[String] = []
	for noeud in scene.find_children("*", "MeshInstance3D", true, false):
		var piece := noeud as MeshInstance3D
		var noms := _os_de_la_piece(piece)
		if noms.is_empty():
			continue
		pieces.append(piece)
		os_des_pieces.append(noms)
		for nom in noms:
			if squelette.find_bone(nom) == -1 and not nom in absents:
				absents.append(nom)
	for nom in absents:
		recueil.append("os-absent : %s" % nom)
	if pieces.is_empty():
		recueil.append("element-sans-piece : %s" % element)
	if pieces.is_empty() or not absents.is_empty():
		scene.free()
		_montrer_l_etat()
		return
	var noeuds: Array[Node] = []
	for rang in pieces.size():
		noeuds.append(_poser_la_piece(pieces[rang], os_des_pieces[rang], squelette, id))
	scene.free()
	_pieces[id] = pieces
	_noeuds[id] = noeuds
	_montes[id] = element
	_marquer(emplacement.boutons, element)
	_poser_les_morphes()
	_ligne_des_emblemes(emplacement, element, embleme)


## Les os qui portent `piece` : celui de son `BoneAttachment3D` pour un mesh rigide (l'import glTF le pose sous l'attache
## de son os) ; pour un mesh skinné, le nom de chaque liaison de son skin (`Skin.get_bind_name`, posé à l'import par
## `_scene_du_glb`) ; aucun pour un mesh à la racine.
func _os_de_la_piece(piece: MeshInstance3D) -> Array[String]:
	var noms: Array[String] = []
	if piece.skin != null:
		for liaison in piece.skin.get_bind_count():
			noms.append(String(piece.skin.get_bind_name(liaison)))
	elif piece.get_parent() is BoneAttachment3D:
		noms.append((piece.get_parent() as BoneAttachment3D).bone_name)
	return noms


## `piece`, qui pend aux os `noms`, posée sur `squelette`, celui de la base, pour l'emplacement `id` : rigide, sous un os
## de même nom que le sien ; skinnée, sous le squelette, son skin lié par nom dès l'import (`_scene_du_glb`). Le nœud qui
## la porte dans la scène.
func _poser_la_piece(piece: MeshInstance3D, noms: Array[String], squelette: Skeleton3D, id: String) -> Node:
	piece.owner = null
	if piece.skin == null:
		var nom := ("Monte_%s_%s" % [id, piece.name]).validate_node_name()
		var support := MontageDEquipement.attacher(squelette, {os = noms[0], position = ORIGINE, rotation = ORIGINE}, nom)
		piece.reparent(support, false)
		return support.get_parent()
	piece.reparent(squelette, false)
	piece.skeleton = piece.get_path_to(squelette)
	return piece


## Sous la rangée d'`emplacement`, si `element` qui y est monté porte une surface `blason` (`blasons` de la réponse de
## `modeles`) : « vide » et un bouton par emblème, bascules d'un même groupe, `embleme` posé s'il est offert.
func _ligne_des_emblemes(emplacement: Dictionary, element: String, embleme: String) -> void:
	if _modeles.blasons.get(element, []).is_empty():
		return
	var id: String = emplacement.id
	var ligne := HFlowContainer.new()
	_etiquette("emblème", ligne)
	emplacement.rangee.add_sibling(ligne)
	_lignes_des_emblemes[id] = ligne
	var groupe := ButtonGroup.new()
	var boutons := {}
	var choix: Array = [{id = VIDE, label = VIDE}]
	choix.append_array(_modeles.emblemes)
	for offert in choix:
		var bouton := _bascule(offert.label, groupe, ligne, _choisir_l_embleme.bind(id, offert.id))
		bouton.set_meta("cle", "%s/embleme/%s" % [id, offert.id])
		boutons[offert.id] = bouton
	_boutons_des_emblemes[id] = boutons
	_choisir_l_embleme(id, embleme if boutons.has(embleme) else VIDE)


## L'emblème `embleme` posé sur l'élément monté à l'emplacement `id`, rigide ou skinné : sur chaque surface d'un mesh
## monté dont le matériau porte un nom de ses `blasons`, un matériau propre (`MontageDEquipement.materiau_local`) dont la
## couche de détail, en UV1 et en mélange, est l'emblème ; « vide » rend à chaque surface le matériau du GLB. Aucune
## surface posée, l'emblème ne l'est pas.
func _choisir_l_embleme(id: String, embleme: String) -> void:
	var element: String = _montes[id]
	var noms: Array = _modeles.blasons[element]
	var texture: ImageTexture = _texture_de_l_embleme(embleme) if embleme != VIDE else null
	var posees: Array[int] = []
	for piece: MeshInstance3D in _pieces[id]:
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
			posees.append(surface)
	if texture != null and posees.is_empty():
		_erreurs.append("blason-sans-surface : %s" % element)
	var pose := VIDE if posees.is_empty() else embleme
	if pose == VIDE:
		_emblemes.erase(id)
	else:
		_emblemes[id] = pose
	_marquer(_boutons_des_emblemes[id], pose)
	_montrer_l_etat()


## Le SVG de l'emblème `id`, offert par `emblemes` de la réponse de `modeles`, rastérisé à `LARGEUR_D_EMBLEME` pixels de
## large, ses mipmaps générées ; `null` (et une erreur) s'il ne se lit pas.
func _texture_de_l_embleme(id: String) -> ImageTexture:
	var svg: String = _modeles.emblemes.filter(func(offert: Dictionary) -> bool: return offert.id == id)[0].svg
	var image := Image.new()
	var code := image.load_svg_from_string(svg)
	if code == OK:
		code = image.load_svg_from_string(svg, MiseEnPage.echelle_d_image(LARGEUR_D_EMBLEME, image.get_width()))
	if code != OK or image.is_empty():
		_erreurs.append("embleme-illisible : %s (%s)" % [id, error_string(code)])
		return null
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


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
## `null` (et une erreur à `recueil`) s'il n'y a pas de fichier ou s'il ne se lit pas. Chaque liaison d'un skin y porte le
## nom de son os (#3086, D4 ; `GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS`, `modules/gltf/gltf_document.cpp`
## `_create_skins`, `scene/3d/skeleton_3d.cpp` `NOTIFICATION_UPDATE_SKELETON`, Godot 4.7-stable).
func _scene_du_glb(id: String, recueil: Array[String]) -> Node3D:
	if not _modeles.glb.has(id):
		recueil.append("glb-absent : %s" % id)
		return null
	var octets := await _telecharger("modeles/%s" % _modeles.glb[id], recueil)
	if octets.is_empty():
		return null
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	etat.handle_binary_image_mode = GLTFState.HANDLE_BINARY_IMAGE_MODE_EMBED_AS_UNCOMPRESSED
	var code := document.append_from_buffer(octets, "", etat, GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS)
	var scene := document.generate_scene(etat) as Node3D if code == OK else null
	if scene == null:
		recueil.append("glb-illisible : %s (%s)" % [id, error_string(code)])
	return scene


func _lire_json(relative: String) -> Dictionary:
	var octets := await _telecharger(relative, _erreurs)
	var valeur: Variant = JSON.parse_string(octets.get_string_from_utf8()) if not octets.is_empty() else null
	if not valeur is Dictionary:
		_erreurs.append("listage-illisible : %s" % relative)
		return {}
	return valeur


## Les octets de `relative`, adresse relative à la page ; vides (et une erreur à `recueil`) si la requête échoue ou expire.
func _telecharger(relative: String, recueil: Array[String]) -> PackedByteArray:
	var requete := HTTPRequest.new()
	requete.timeout = DELAI_DE_REQUETE_S
	requete.download_chunk_size = BLOC_DE_TELECHARGEMENT
	add_child(requete)
	var code := requete.request(_pont.adresse(relative))
	if code != OK:
		requete.queue_free()
		recueil.append("requete-refusee : %s (%s)" % [relative, error_string(code)])
		return PackedByteArray()
	var resultat: Array = await requete.request_completed
	requete.queue_free()
	if resultat[0] != HTTPRequest.RESULT_SUCCESS or resultat[1] != 200:
		recueil.append("requete-echouee : %s (resultat %s, HTTP %s)" % [relative, resultat[0], resultat[1]])
		return PackedByteArray()
	return resultat[3]


func _signaler(message: String) -> void:
	_recueil.append(message)
	_montrer_l_etat()


## Les erreurs publiées : celles de `_erreurs`, puis celles du dernier geste de composition, puis celles du gabarit posé.
func _toutes_les_erreurs() -> Array[String]:
	var toutes: Array[String] = _erreurs.duplicate()
	toutes.append_array(_erreurs_de_composition)
	toutes.append_array(_erreurs_du_gabarit)
	return toutes


func _montrer_l_etat() -> void:
	var lignes: Array[String] = []
	if not _base.is_empty():
		lignes.append("%s · %s" % [_base.id, str(_base.empreinte).left(DEBUT_D_EMPREINTE)])
	lignes.append_array(_toutes_les_erreurs())
	_etat.text = "\n".join(PackedStringArray(lignes))
	_publier()


## L'onglet `onglet` du panneau montré, l'autre caché : chacun son défilement, aucun imbriqué.
func _montrer_l_onglet(onglet: String) -> void:
	_onglet = onglet
	for autre in _onglets:
		_onglets[autre].visible = autre == onglet
	_publier()


## Les presets et les axes de `catalogues` (#3086, D2 et D3) : un bouton par preset (son `label`), puis chaque axe de
## `axes`, dans leur ordre, son `label` en tête : la liste de ses choix (leur `label`, l'id stocké), « aucun » en tête,
## pour un axe `ref` ou `valeur` ; pour un axe `plage`, une glissière bornée par `min` et `max` au pas `PAS_DE_PLAGE`,
## puis « neutre ».
func _poser_les_catalogues() -> void:
	var reponse := _pont.appeler("catalogues")
	if reponse.get("ok") != true:
		return
	_catalogues = reponse
	_axes = reponse.axes
	for preset in reponse.presets:
		var bouton := Button.new()
		bouton.text = preset.label
		bouton.pressed.connect(_appliquer_le_preset.bind(preset))
		%Presets.add_child(bouton)
	for axe in _axes:
		var rangee := HBoxContainer.new()
		_etiquette(axe.label, rangee)
		var selecteur: Control = _glissiere(axe, rangee) if axe.forme == "plage" else _liste_d_axe(axe, rangee)
		selecteur.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		%Axes.add_child(rangee)
		_selecteurs_d_axe[axe.champ] = selecteur
	_montrer_la_composition()


## La liste de l'axe `axe` posée dans `rangee`, de clé `axe/<champ>` : « aucun », puis chaque choix de sa liste de
## `catalogues`.
func _liste_d_axe(axe: Dictionary, rangee: HBoxContainer) -> OptionButton:
	var selecteur := OptionButton.new()
	selecteur.set_meta("cle", "axe/%s" % axe.champ)
	selecteur.add_item(AUCUN)
	selecteur.set_item_metadata(0, null)
	for choix in _catalogues[axe.liste]:
		var rang := selecteur.item_count
		selecteur.add_item(choix.label)
		selecteur.set_item_metadata(rang, choix.id)
	selecteur.item_selected.connect(func(rang: int) -> void: _changer_l_axe(axe, selecteur.get_item_metadata(rang)))
	rangee.add_child(selecteur)
	return selecteur


## La glissière de l'axe `plage` `axe` posée dans `rangee`, puis son bouton « neutre », de clé `axe/<champ>/neutre`.
func _glissiere(axe: Dictionary, rangee: HBoxContainer) -> HSlider:
	var glissiere := HSlider.new()
	glissiere.min_value = float(axe.min)
	glissiere.max_value = float(axe.max)
	glissiere.step = PAS_DE_PLAGE
	glissiere.value = float(axe.neutre)
	glissiere.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	glissiere.value_changed.connect(func(valeur: float) -> void: _changer_l_axe(axe, valeur))
	rangee.add_child(glissiere)
	var neutre := Button.new()
	neutre.text = NEUTRE
	neutre.set_meta("cle", "axe/%s/%s" % [axe.champ, NEUTRE])
	neutre.pressed.connect(_changer_l_axe.bind(axe, null))
	rangee.add_child(neutre)
	return glissiere


## Le preset `preset` appliqué : sa composition remplace la courante, puis se compose.
func _appliquer_le_preset(preset: Dictionary) -> void:
	_preset = preset.id
	_composition = preset.composition.duplicate(true)
	_composer()


## La valeur `valeur` de l'axe `axe` posée dans la composition courante, puis la composition recomposée : `null` retire
## son champ, un id se pose en `{ id }` (`ref`) ou nu (`valeur`), un nombre (`plage`) tel quel.
func _changer_l_axe(axe: Dictionary, valeur: Variant) -> void:
	if valeur == null:
		_composition.erase(axe.champ)
	else:
		_composition[axe.champ] = {id = valeur} if axe.forme == "ref" else valeur
	_composer()


## Un geste de composition : `geste` joué, ses erreurs (`_signaler` compris) remplaçant celles du précédent.
func _geste_de_composition(geste: Callable) -> void:
	_erreurs_de_composition = []
	_recueil = _erreurs_de_composition
	geste.call()
	_recueil = _erreurs
	_montrer_l_etat()


## Le texte affiché du refus `reponse` (erreur `validation`) de `composer` ou de `presetDeComposition`.
func _texte_du_refus(reponse: Dictionary) -> String:
	return "composition refusée : %s" % reponse.erreur.message


## La composition courante composée, en geste de composition (`_composer_la_courante`).
func _composer() -> void:
	_geste_de_composition(_composer_la_courante)


## La composition courante composée par `composer` sur la base posée : chaque emplacement monte l'élément que `montes`
## lui donne et démonte les autres, puis le gabarit et les morphes de la réponse se posent, les morphes de la précédente
## remis à 0. Refusée (erreur `validation`), rien n'est composé : chaque emplacement est démonté, ni gabarit ni morphe, et
## le texte du refus est gardé. Le texte de « Copier » est effacé.
func _composer_la_courante() -> void:
	var anciens: Dictionary = _composee.get("morphes", {})
	_composee = {}
	_refus_de_composition = ""
	%Verdict.text = ""
	%Entree.text = ""
	if _base.is_empty():
		_montrer_la_composition()
		return
	var reponse := _pont.appeler("composer", {base = _base.id, composition = _composition})
	if reponse.get("ok") == true:
		_composee = reponse
	elif reponse.get("ok") == false:
		_refus_de_composition = _texte_du_refus(reponse)
	var cibles := {}
	for monte in _composee.get("montes", []):
		if monte.element != null and not cibles.has(monte.ligne):
			cibles[monte.ligne] = monte.element
	for id in _emplacements:
		var cible: String = cibles.get(id, VIDE)
		if _montes.get(id, VIDE) != cible:
			_choisir(_emplacements[id], cible)
	_poser_le_gabarit()
	_poser_des_morphes(anciens.keys(), 0.0)
	_poser_les_morphes()
	_montrer_la_composition()


## Le gabarit de la composition composée (`gabarit` de `composer`, aucun sans composition) remis au modificateur du
## squelette (`GabaritDuSquelette`, `CONTRAT.md`, « Gabarit d'une base »), qui le pose sur la pose de chaque image, au
## repos comme pendant un clip ; chaque os qu'il nomme et que la base n'a pas donne `os-absent : <os>` aux erreurs du
## gabarit, qui remplacent celles de la pose précédente. Le squelette est remis à sa pose de repos, puis le clip engagé
## est reposé à son instant ; l'orbite cadre le corps neutre jusqu'à la mesure du gabarit au repos.
func _poser_le_gabarit() -> void:
	_erreurs_du_gabarit = []
	if _gabarit == null:
		_marche.cadrer(MarcheDeLAtelier.CADRE_NEUTRE)
		return
	for os in _gabarit.poser(_composee.get("gabarit", {})):
		_erreurs_du_gabarit.append("os-absent : %s" % os)
	_squelette.reset_bone_poses()
	if _a_un_clip():
		_lecteur.seek(_lecteur.current_animation_position, true)
	_cadrer()


## L'orbite cadre le corps au gabarit mesuré au repos (`MiseEnPage.echelle_de_cadrage`, le sommet de ses os rapporté à
## celui du corps neutre), le corps neutre sans mesure.
func _cadrer() -> void:
	var mesures := _gabarit.mesures()
	_marche.cadrer(MarcheDeLAtelier.CADRE_NEUTRE if mesures.is_empty() else MiseEnPage.echelle_de_cadrage(mesures.repos.sommet, mesures.neutre.sommet))
	_publier()


## Les poids `morphes` de la composition composée posés par nom de shape key sur chaque mesh de la base et de chaque
## élément monté qui porte la clé (#3086, D4) ; un mesh sans la clé n'en reçoit rien.
func _poser_les_morphes() -> void:
	if _modele == null:
		return
	var morphes: Dictionary = _composee.get("morphes", {})
	for nom in morphes:
		_poser_des_morphes([nom], float(morphes[nom]))


## Le poids `poids` posé à chaque shape key nommée dans `noms`, sur chaque mesh du modèle qui la porte.
func _poser_des_morphes(noms: Array, poids: float) -> void:
	if _modele == null:
		return
	for noeud in _modele.find_children("*", "MeshInstance3D", true, false):
		var mesh := noeud as MeshInstance3D
		for nom in noms:
			var rang := mesh.find_blend_shape_by_name(nom)
			if rang != -1:
				mesh.set_blend_shape_value(rang, poids)


## Les sélecteurs d'axe sur la composition courante (la glissière d'un axe `plage` sans valeur à son `neutre`), les
## manquants de la composition composée (leur libellé, et celui de ce qui les apporte, `par.label`) et son rapport, ou le
## refus de la composition courante.
func _montrer_la_composition() -> void:
	for axe in _axes:
		var valeur: Variant = _composition.get(axe.champ)
		if axe.forme == "plage":
			(_selecteurs_d_axe[axe.champ] as HSlider).set_value_no_signal(float(axe.neutre) if valeur == null else float(valeur))
			continue
		var id: Variant = valeur.id if valeur is Dictionary else valeur
		var selecteur: OptionButton = _selecteurs_d_axe[axe.champ]
		for rang in selecteur.item_count:
			if selecteur.get_item_metadata(rang) == id:
				selecteur.select(rang)
	var lignes: Array[String] = []
	if not _refus_de_composition.is_empty():
		lignes.append(_refus_de_composition)
	if not _composee.is_empty():
		lignes.append("manquants : aucun" if _composee.manquants.is_empty() else "manquants :")
		for manquant in _composee.manquants:
			var apport: Variant = manquant.get("par")
			lignes.append("· %s" % manquant.label if apport == null else "· %s (%s)" % [manquant.label, apport.label])
	%Manquants.text = "\n".join(PackedStringArray(lignes))
	var rapport: Array = _composee.get("rapport", [])
	%RapportDeComposition.text = "\n".join(PackedStringArray(rapport))
	%RapportDeComposition.visible = not rapport.is_empty()
	_publier()


## La composition courante rendue par `presetDeComposition`, en geste de composition (`_copier_la_courante`).
func _copier() -> void:
	_geste_de_composition(_copier_la_courante)


## La composition courante rendue par `presetDeComposition`, sous l'enveloppe du dernier preset appliqué s'il y en a un
## (`preset`) : l'entrée et son verdict affichés, l'entrée copiée au presse-papiers. Refusée (erreur `validation`), le
## texte du refus remplace le verdict, sans entrée ni copie.
func _copier_la_courante() -> void:
	var entree := {composition = _composition}
	if _preset != null:
		entree.preset = _preset
	var reponse := _pont.appeler("presetDeComposition", entree)
	if reponse.get("ok") == false:
		%Verdict.text = _texte_du_refus(reponse)
		%Entree.text = ""
		_publier()
	if reponse.get("ok") != true:
		return
	var fautes: Array[String] = []
	for faute in reponse.verdict:
		fautes.append("%s : %s" % [".".join(PackedStringArray(faute.chemin.map(func(pas: Variant) -> String: return str(pas)))), faute.message])
	%Verdict.text = "verdict : valide" if fautes.is_empty() else "verdict :\n%s" % "\n".join(PackedStringArray(fautes))
	%Entree.text = reponse.entree
	DisplayServer.clipboard_set(reponse.entree)
	_publier()


func _publier() -> void:
	_publier_l_ecran.call_deferred()


## Ce que l'écran porte, une fois mis en page : ses boutons, et l'état de l'atelier, l'élément monté à chaque point
## (`montes`) et à chaque ligne de pièce (`lignes`) sous sa clé publiée, les erreurs (`_toutes_les_erreurs`), l'onglet
## montré, le cadre de la glissière de chaque axe `plage` à l'écran (`plages`, avec sa valeur), la composition courante
## avec ce que `composer` en a monté, ce qui y manque, le texte de son refus et celui de « Copier », les mesures du
## gabarit posé (`GabaritDuSquelette.mesures`), l'échelle de l'orbite (`cadre`), la position des os de la base
## (`_positions_des_os`) et la boîte des meshes skinnés montés (`_peaux`).
func _publier_l_ecran() -> void:
	await get_tree().process_frame
	var clip: Variant = _lecteur.assigned_animation if _a_un_clip() else null
	var publies := {montes = {}, lignes = {}}
	for id in _montes:
		publies[_emplacements[id].publie][_emplacements[id].cle] = _montes[id]
	var plages := {}
	for champ in _selecteurs_d_axe:
		var glissiere := _selecteurs_d_axe[champ] as HSlider
		if glissiere == null or not glissiere.is_visible_in_tree():
			continue
		var cadre := glissiere.get_global_rect()
		if PontDuNoyau.a_l_ecran(glissiere, cadre.get_center()):
			plages[champ] = {gauche = cadre.position.x, droite = cadre.end.x, y = cadre.get_center().y, valeur = glissiere.value}
	_pont.publier_l_ecran({
		boutons = PontDuNoyau.boutons_a_l_ecran([_interface]),
		atelier = {
			base = _base.get("id"),
			empreinte = _base.get("empreinte"),
			clip = clip,
			instant = _lecteur.current_animation_position if clip != null else null,
			duree = _lecteur.current_animation_length if clip != null else null,
			lecture = _lecteur.is_playing() if clip != null else false,
			vitesse = _vitesse,
			montes = publies.montes,
			lignes = publies.lignes,
			emblemes = _emblemes,
			aides = _aides,
			erreurs = _toutes_les_erreurs(),
			onglet = _onglet,
			plages = plages,
			composition = {
				courante = _composition,
				preset = _preset,
				montes = _composee.get("montes", []),
				manquants = _composee.get("manquants", []),
				morphes = _composee.get("morphes", {}),
				refus = null if _refus_de_composition.is_empty() else _refus_de_composition,
				copie = %Entree.text,
			},
			gabarit = {} if _gabarit == null else _gabarit.mesures(),
			cadre = _marche.echelle(),
			os = _positions_des_os(),
			peaux = _peaux(),
			morphes = _morphes_des_meshes(),
		},
	})


## Godot 4.7, Skeleton3D::_notification, NOTIFICATION_UPDATE_SKELETON, skeleton_updated.
func _memoriser_la_pose() -> void:
	var pose := {}
	for os in _squelette.get_bone_count():
		pose[_squelette.get_bone_name(os)] = _squelette.get_bone_global_pose(os).origin
	_pose_des_os = pose


## CONTRAT.md, « Écran publié ».
func _positions_des_os() -> Dictionary:
	var positions := {}
	if _squelette == null:
		return positions
	for os in _pose_des_os:
		positions[os] = _en_liste(_squelette.to_global(_pose_des_os[os]))
	return positions


## Par id d'emplacement monté qui porte un mesh skinné, la boîte de ses meshes skinnés posés par le moteur sur la pose
## courante (`MeshInstance3D.bake_mesh_from_current_skeleton_pose`) : son centre monde (`centre`) et sa taille dans le
## repère du squelette (`taille`).
func _peaux() -> Dictionary:
	var peaux := {}
	for id in _pieces:
		var boite: Variant = null
		var porteuse: MeshInstance3D = null
		for piece: MeshInstance3D in _pieces[id]:
			if not is_instance_valid(piece) or piece.skin == null:
				continue
			var posee: AABB = piece.bake_mesh_from_current_skeleton_pose().get_aabb()
			boite = posee if boite == null else (boite as AABB).merge(posee)
			porteuse = piece
		if porteuse != null:
			peaux[id] = {centre = _en_liste(porteuse.to_global((boite as AABB).get_center())), taille = _en_liste((boite as AABB).size)}
	return peaux


## CONTRAT.md, « Écran publié ».
func _morphes_des_meshes() -> Dictionary:
	var morphes := {corps = {}, montes = {}}
	if _modele == null:
		return morphes
	var emplacements: Dictionary = {}
	for id in _pieces:
		morphes.montes[id] = {}
		for piece: MeshInstance3D in _pieces[id]:
			emplacements[piece] = id
	for noeud in _modele.find_children("*", "MeshInstance3D", true, false):
		var mesh := noeud as MeshInstance3D
		if mesh.mesh == null or mesh.mesh.get_blend_shape_count() == 0:
			continue
		var poids := {}
		for rang in mesh.mesh.get_blend_shape_count():
			poids[String(mesh.mesh.get_blend_shape_name(rang))] = mesh.get_blend_shape_value(rang)
		var chemin := String(_modele.get_path_to(mesh))
		if emplacements.has(mesh):
			morphes.montes[emplacements[mesh]][chemin] = poids
		else:
			morphes.corps[chemin] = poids
	return morphes


func _en_liste(vecteur: Vector3) -> Array[float]:
	return [vecteur.x, vecteur.y, vecteur.z]
