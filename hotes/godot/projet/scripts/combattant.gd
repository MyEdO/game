## Un combattant du plateau : son corps, la base composée que la vue lui donne (`vue.corps.combattants[id]`,
## `hotes/godot/pont/CONTRAT.md`), posée par son montage (`MontageDeComposition`, le nœud `Modele`) à l'échelle métrique
## du plateau (`vue.plateau.metresParCase`) et animée par son arbre d'états (`Etats`, `EtatsDuCorps`, #3949), dont
## chaque état joue le clip de sa base qui tient son rôle (`clips` de la réponse de `modeles`, ou `clipsDeuxMains` sous son
## maniement tant qu'il tient un objet des deux mains, `MontageDeComposition.clip`) ;
## son nom et ses Points de Blessures (`pb`) en étiquette au-dessus de sa tête, l'anneau de l'actif. Il glisse vers sa nouvelle case,
## ou parcourt le chemin qui l'y mène (`parcourir`, #3822), frappe vers une cible, accuse le coup qui le vise et tombe hors de combat. Sans corps, il garde son anneau et son
## étiquette, à la hauteur du nom d'une entité (`MiseEnPage.HAUTEUR_DU_NOM`). Véhicule ou engin (`vue.corps.vehicules[id]`,
## #2987), son corps se monte sous `Vehicule` (`MontageDeVehicule`), posé sur ses N×N cases, à sa taille réelle ou les
## remplissant (`poser_sur_l_empreinte`), tourné vers son cap (`tourner_au_cap`) et animé par les clips de son élément
## (`clips` de son corps) sous le même arbre, comme un corps par ceux de sa base.
class_name Combattant
extends Node3D

## Son corps a changé : sa base posée, un élément monté ou démonté, un emblème posé.
signal habille

const DUREE_DEPLACEMENT_S := 0.45
const OPACITE_HORS_COMBAT := 0.35
const VIDE := MontageDeComposition.VIDE

@onready var _montage: MontageDeComposition = $Modele
@onready var _selection: MeshInstance3D = $Selection
@onready var _etiquette: Label3D = $Etiquette
@onready var _vehicule: MontageDeVehicule = $Vehicule
@onready var _etats: EtatsDuCorps = $Etats

## L'id du combattant (`c.id`).
var _id := ""
var _hors_combat := false
var _deplacement: Tween
## Le lieu où la vue le pose en dernier (`montrer`), qu'il gagne ou a gagné.
var _destination := Vector3.ZERO
## Le dernier corps reçu, `null` sans corps, et son empreinte.
var _corps: Variant = null
var _empreinte := ""
## L'id de la base demandée en dernier, posée ou en chargement.
var _base_demandee: Variant = null
## Le chargement retenu : un chargement qu'un autre remplace jette son GLB.
var _chargement: RefCounted = null
## Les chargements de son corps en vol : sa base, chacun de ses éléments (`est_vetu`). Une reprise dont le chargement
## n'y est plus libère ce qu'elle a reçu et rend la main.
var _en_vol := {}
## La hauteur, dans son repère, du plus haut point d'accroche de sa base au repos, sans gabarit.
var _hauteur_de_tete := 0.0


## La tenue suit l'état que son arbre joue (`EtatsDuCorps.suivi`, `MontageDeComposition.poser_le_clip`).
func _ready() -> void:
	_etiquette.position.y = MiseEnPage.HAUTEUR_DU_NOM
	_destination = position
	_etats.suivi.connect(_montage.poser_le_clip)


## Sorti de l'arbre, il n'y revient pas (`Plateau._retirer_hors_de`, `SceneTree.change_scene_to_file`, #4195) : ses
## chargements en vol sont abandonnés (`_en_vol`).
func _exit_tree() -> void:
	_en_vol.clear()


## `c` : un combattant projeté (`voisins`) ; `lieu` : le centre de sa case ; `corps` : son corps (`null` : aucun) ;
## `vehicule` : son véhicule (`null` : aucun) ; `metres_par_case` : l'échelle du plateau (`vue.plateau.metresParCase`).
## Posé ailleurs que là où il va, il y glisse (`_aller`).
func montrer(c: Dictionary, lieu: Vector3, actif: bool, corps: Variant, vehicule: Variant, metres_par_case: float) -> void:
	_id = c.id
	var echelle := MiseEnPage.echelle_metrique(metres_par_case)
	_montage.scale = Vector3(echelle, echelle, echelle)
	_etiquette.text = "%s\n%d / %d" % [c.nom, int(c.pb[0]), int(c.pb[1])]
	_selection.visible = actif and not c.horsCombat
	if c.horsCombat and not _hors_combat:
		_hors_combat = true
		_etats.jouer(EtatsDuCorps.MORT)
		_etiquette.modulate.a = OPACITE_HORS_COMBAT
	if not lieu.is_equal_approx(_destination):
		_destination = lieu
		_aller(lieu)
	vetir(corps)
	if await _vehicule.monter(vehicule, _montage, _poser_le_vehicule.bind(vehicule, metres_par_case)):
		_brancher()
		_signaler()


## Ce que son corps porte, lu de son montage : l'id de sa base posée (`null` sans corps), chaque élément monté, par
## emplacement l'emblème posé, par emplacement les couleurs posées (`MontageDeComposition.couleurs_posees`), l'id de
## l'élément de son véhicule posé (`null` : aucun), l'emblème posé sur ses voiles et pavillons (`null` : aucun), ceux des
## éléments montés à ses postes et ceux de ses Améliorations (`MontageDeVehicule`).
func corps() -> Dictionary:
	return {base = null if _montage.modele == null else _montage.base.id, elements = _montage.montes.values(), emblemes = _montage.emblemes.duplicate(), couleurs = _montage.couleurs_posees(), vehicule = _vehicule.element, embleme_du_vehicule = _vehicule.embleme, postes = _vehicule.postes.duplicate(), ameliorations = _vehicule.ameliorations.duplicate()}


## La scène `scene` d'un véhicule, dans l'arbre sous un nœud à la case de son combattant, posée sur ses `empreinte` ×
## `empreinte` cases, depuis cette case, son coin nord-ouest (`footprintTiles`, #2987), à l'échelle `echelle`, ou, nulle,
## sa plus grande dimension horizontale valant l'empreinte (`MiseEnPage.echelle_d_empreinte`) : sa boîte
## (`MontageDeVehicule.boite`) centrée sur elle (`MiseEnPage.origine_sur_l_empreinte`), son origine au sol.
static func poser_sur_l_empreinte(scene: Node3D, empreinte: int, echelle_posee: Variant) -> void:
	var boite: AABB = MontageDeVehicule.boite(scene, scene.get_parent_node_3d())
	var echelle: float = MiseEnPage.echelle_d_empreinte(boite.size, empreinte) if echelle_posee == null else echelle_posee
	scene.transform = scene.transform.scaled(Vector3(echelle, echelle, echelle)).translated(MiseEnPage.origine_sur_l_empreinte(boite.get_center(), echelle, empreinte))


## La scène `scene` d'un véhicule posée sur ses `empreinte` × `empreinte` cases (`poser_sur_l_empreinte`), tournée autour
## du milieu de son empreinte pour que sa proue, le +Z de son repère, regarde le cap `cap` (`Dir8`).
static func tourner_au_cap(scene: Node3D, cap: String, empreinte: int) -> void:
	var milieu := MiseEnPage.milieu_de_l_empreinte(empreinte)
	scene.transform = scene.transform.translated(-milieu).rotated(Vector3.UP, MiseEnPage.lacet_de_proue(MiseEnPage.LACETS_DES_CAPS[cap])).translated(milieu)


## Le tween `pas` mène `mobile` de sa place à chaque lieu de `lieux` après le premier, la case qu'il quitte, l'un après
## l'autre en ligne droite, chacun en la durée de même rang de `durees`, `modele` tourné vers lui au début de son pas
## (`tourner_vers`).
static func parcourir_les_lieux(pas: Tween, mobile: Node3D, modele: Node3D, lieux: Array, durees: Array) -> void:
	for i in range(1, lieux.size()):
		pas.tween_callback(tourner_vers.bind(modele, lieux[i]))
		pas.tween_property(mobile, "position", lieux[i], durees[i])


## `modele` tourné à l'horizontale vers `cible`, son avant au +Z ; à la verticale de `cible`, il garde son cap.
static func tourner_vers(modele: Node3D, cible: Vector3) -> void:
	var ici := modele.global_position
	if not Vector2(cible.x, cible.z).is_equal_approx(Vector2(ici.x, ici.z)):
		modele.look_at(Vector3(cible.x, ici.y, cible.z), Vector3.UP, true)


## Le chemin d'un déplacement (`deplacement` de `suite.effets`, #3822) : `lieux`, où il se tient sur chacune de ses cases
## (`Monde.lieu`), parcouru de sa place (`parcourir_les_lieux`) à l'état de marche, chaque pas de `metres` (au même rang) à
## la vitesse au sol de sa base (`MontageDeComposition.duree_du_pas`), en `DUREE_DEPLACEMENT_S` sans base posée ; puis le
## repos. Un parcours neuf remplace celui en cours, comme son glissement.
func parcourir(lieux: Array, metres: Array) -> void:
	if _deplacement != null:
		_deplacement.kill()
	_etats.jouer(EtatsDuCorps.MARCHE)
	_deplacement = create_tween()
	parcourir_les_lieux(_deplacement, self, _montage, lieux, metres.map(_duree_du_pas))
	_deplacement.tween_callback(_reposer)


## Tourné vers `cible` (une position du plateau), il frappe : l'état de son rôle d'attaque, `tir` si sa table en
## porte un clip (une pièce de tir), `melee` sinon ; l'arbre revient au repos en fin de clip.
func agir_vers(cible: Vector3) -> void:
	tourner_vers(_montage, cible)
	_etats.jouer(EtatsDuCorps.TIR if _clip(EtatsDuCorps.TIR) != "" else EtatsDuCorps.ATTAQUE)


## Visé par un coup, il l'accuse, s'il tient encore debout ; l'arbre revient au repos en fin de clip.
func subir() -> void:
	if not _hors_combat:
		_etats.jouer(EtatsDuCorps.COUP)


## Si son dernier corps reçu est monté en entier : plus aucun chargement en vol, ni travail différé de son montage
## (`MontageDeComposition.en_travail`).
func est_vetu() -> bool:
	return _en_vol.is_empty() and not _montage.en_travail()


## Son arbre d'états arrêté, la pose de son lecteur laissée à qui la fige (`StudioDePortraits`) jusqu'au prochain
## vêtement (`EtatsDuCorps.suivre`).
func figer() -> void:
	_etats.active = false


## Le corps `corps`, s'il a changé : aucun, le montage est vidé et l'étiquette à la hauteur du nom d'une entité ; sur
## une autre base que celle demandée, elle est tirée de `modeles/` et posée, son arbre branché sur elle (`_brancher`),
## puis la composition du dernier corps reçu montée (`_composer`) ; sur la même, posée, la composition l'est aussitôt.
func vetir(corps: Variant) -> void:
	var empreinte := JSON.stringify(corps)
	if empreinte == _empreinte:
		return
	_empreinte = empreinte
	_corps = corps
	if corps == null:
		_base_demandee = null
		_chargement = null
		_montage.vider()
		_montage.poser_le_modele({}, null)
		_brancher()
		_etiquette.position.y = MiseEnPage.HAUTEUR_DU_NOM
		_signaler()
		return
	if corps.base == _base_demandee:
		if _montage.modele != null:
			_composer()
		return
	_base_demandee = corps.base
	var chargement := RefCounted.new()
	_chargement = chargement
	_en_vol[chargement] = true
	var scene := await _montage.scene_du_modele(corps.base, _montage.erreurs)
	if not _en_vol.erase(chargement) or chargement != _chargement:
		if scene != null:
			scene.free()
		return
	_montage.vider()
	_montage.poser_le_modele(_base(corps.base), scene)
	_brancher()
	if _montage.gabarit != null:
		_montage.gabarit.mesure.connect(_hausser_l_etiquette)
		_poser_l_etiquette()
	_composer()


## La scène nue `scene` du véhicule `vehicule` posée sur son empreinte (`poser_sur_l_empreinte`), à l'échelle métrique du
## plateau de `metres_par_case` s'il a sa `taille` réelle, puis tournée vers son cap (`tourner_au_cap`).
func _poser_le_vehicule(scene: Node3D, vehicule: Dictionary, metres_par_case: float) -> void:
	poser_sur_l_empreinte(scene, int(vehicule.empreinte), MiseEnPage.echelle_metrique(metres_par_case) if vehicule.taille == "reelle" else null)
	tourner_au_cap(scene, vehicule.cap, int(vehicule.empreinte))


## La base `id` de la réponse de `modeles` retenue.
func _base(id: String) -> Dictionary:
	for base in MontageDeComposition.modeles.bases:
		if base.id == id:
			return base
	return {}


## La composition du dernier corps reçu montée sur la base posée : chaque emplacement de ses `montes` qui monte un
## élément le monte sous son emblème, ou rhabille celui qui y est déjà monté ; tout autre élément monté est démonté ;
## puis la base se rhabille, le gabarit du corps se pose, la pose suit l'état joué sous la tenue (`EtatsDuCorps.suivre`) et
## l'arbre reprend aussitôt la pose que la remise du gabarit au clip engagé a recouverte (`advance(0.0)`), puis les
## morphes se posent.
func _composer() -> void:
	_montage.composee = _corps
	var cibles := _montage.cibles()
	for id in _montage.montes.keys():
		if not cibles.has(id):
			_montage.demonter(id)
	for id in cibles:
		var embleme: String = cibles[id].get("embleme", {}).get("id", VIDE)
		if _montage.montes.get(id) == cibles[id].element:
			_montage.choisir_l_embleme(id, embleme)
		else:
			_monter(id, cibles[id].element, embleme)
	_montage.habiller_la_base()
	for os in _montage.poser_le_gabarit():
		_montage.erreurs.append("os-absent : %s" % os)
	_etats.suivre()
	if _etats.active:
		_etats.advance(0.0)
	_montage.poser_les_morphes()
	_signaler()


## `element` monté à l'emplacement `id` sous l'emblème `embleme`.
func _monter(id: String, element: String, embleme: String) -> void:
	var jeton := RefCounted.new()
	_en_vol[jeton] = true
	var monte := await _montage.monter(id, element, _montage.erreurs)
	if not _en_vol.erase(jeton):
		return
	if monte:
		_montage.choisir_l_embleme(id, embleme)
	_etats.suivre()
	_signaler()


## Chaque erreur du montage à la console, puis `habille`.
func _signaler() -> void:
	for erreur in _montage.erreurs:
		push_error("[corps] %s : %s" % [_id, erreur])
	_montage.erreurs.clear()
	habille.emit()


## La hauteur du haut de sa tête dans son repère, là où se pose le pied de son étiquette (`MiseEnPage.HAUTEUR_DU_NOM`
## sans corps).
func hauteur_de_la_tete() -> float:
	return _etiquette.position.y


## L'étiquette au plus haut des points d'accroche de la base au repos, le haut de sa tête : son pied de texte s'y pose.
func _poser_l_etiquette() -> void:
	var squelette := _montage.squelette
	var hauteur := -INF
	for point in _montage.base.points:
		var repos := squelette.get_bone_global_rest(squelette.find_bone(point.attache.os)).translated_local(MontageDeComposition.repere(point.attache).origin)
		hauteur = MiseEnPage.plus_haut(hauteur, to_local(squelette.to_global(repos.origin)).y)
	_hauteur_de_tete = hauteur
	_etiquette.position.y = hauteur


## L'étiquette portée au gabarit mesuré au repos (`GabaritDuSquelette.mesures`).
func _hausser_l_etiquette() -> void:
	var mesures := _montage.gabarit.mesures()
	_etiquette.position.y = MiseEnPage.hauteur_au_gabarit(_hauteur_de_tete, mesures.repos.sommet, mesures.neutre.sommet)


## Le lecteur de ses clips, celui de son modèle posé (`MontageDeVehicule.lecteur_pose`).
func _lecteur() -> AnimationPlayer:
	return _vehicule.lecteur_pose(_montage)


## Le clip du rôle `role` de son modèle posé (`MontageDeVehicule.clip_pose`).
func _clip(role: String) -> String:
	return _vehicule.clip_pose(role, _montage)


## Son arbre d'états branché sur le lecteur de ses clips (`_lecteur`), chaque rôle au clip que lui donne son modèle
## posé (`_clip`), à l'état de sa pose : la mort hors de combat, le repos sinon (`EtatsDuCorps.brancher`).
func _brancher() -> void:
	_etats.brancher(_lecteur(), _clip, EtatsDuCorps.MORT if _hors_combat else EtatsDuCorps.REPOS)


## Le glissement d'un déplacement sans chemin, en ligne droite jusqu'à `lieu`, en `DUREE_DEPLACEMENT_S`, à l'état de marche.
func _aller(lieu: Vector3) -> void:
	tourner_vers(_montage, lieu)
	if _deplacement != null:
		_deplacement.kill()
	_etats.jouer(EtatsDuCorps.MARCHE)
	_deplacement = create_tween()
	_deplacement.tween_property(self, "position", lieu, DUREE_DEPLACEMENT_S)
	_deplacement.tween_callback(_reposer)


func _reposer() -> void:
	if not _hors_combat:
		_etats.jouer(EtatsDuCorps.REPOS)


## La durée (s) d'un pas de `metres` mètres de son chemin (`parcourir`).
func _duree_du_pas(metres: float) -> float:
	return DUREE_DEPLACEMENT_S if _montage.modele == null else _montage.duree_du_pas(metres)
