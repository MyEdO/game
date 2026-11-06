## Un combattant du plateau : son corps, la base composée que la vue lui donne (`vue.corps.combattants[id]`,
## `hotes/godot/pont/CONTRAT.md`), posée par son montage (`MontageDeComposition`, le nœud `Modele`) à l'échelle métrique
## du plateau (`vue.plateau.metresParCase`) et animée par les clips de sa base selon leur rôle (`clips` de la réponse de
## `modeles`, ou `clipsDeuxMains` sous son maniement tant qu'il tient un objet des deux mains, `MontageDeComposition.clip`) ;
## son nom et ses Points de Blessures (`pb`) en étiquette au-dessus de sa tête, l'anneau de l'actif. Il glisse vers sa nouvelle case,
## frappe vers une cible, accuse le coup qui le vise et tombe hors de combat. Sans corps, il garde son anneau et son
## étiquette, à la hauteur du nom d'une entité (`MiseEnPage.HAUTEUR_DU_NOM`).
class_name Combattant
extends Node3D

## Son corps a changé : sa base posée, un élément monté ou démonté, un emblème posé.
signal habille

const DUREE_DEPLACEMENT_S := 0.45
const OPACITE_HORS_COMBAT := 0.35
const VIDE := MontageDeComposition.VIDE
## Les rôles d'animation (`ROLES_D_ANIMATION`, `src/noyau/animation.ts`) qu'il joue.
const REPOS := "idle"
const MARCHE := "walk"
const ATTAQUE := "melee"
const COUP := "hit"
const MORT := "death"

@onready var _montage: MontageDeComposition = $Modele
@onready var _selection: MeshInstance3D = $Selection
@onready var _etiquette: Label3D = $Etiquette

## L'id du combattant (`c.id`).
var _id := ""
var _hors_combat := false
var _deplacement: Tween
## Le dernier corps reçu, `null` sans corps, et son empreinte.
var _corps: Variant = null
var _empreinte := ""
## L'id de la base demandée en dernier, posée ou en chargement.
var _base_demandee: Variant = null
## Le chargement retenu : un chargement qu'un autre remplace jette son GLB.
var _chargement: RefCounted = null
## La hauteur, dans son repère, du plus haut point d'accroche de sa base au repos, sans gabarit.
var _hauteur_de_tete := 0.0


func _ready() -> void:
	_etiquette.position.y = MiseEnPage.HAUTEUR_DU_NOM


## `c` : un combattant projeté (`voisins`) ; `lieu` : le centre de sa case ; `corps` : son corps (`null` : aucun) ;
## `metres_par_case` : l'échelle du plateau (`vue.plateau.metresParCase`).
func montrer(c: Dictionary, lieu: Vector3, actif: bool, corps: Variant, metres_par_case: float) -> void:
	_id = c.id
	var echelle := MiseEnPage.echelle_metrique(metres_par_case)
	_montage.scale = Vector3(echelle, echelle, echelle)
	_etiquette.text = "%s\n%d / %d" % [c.nom, int(c.pb[0]), int(c.pb[1])]
	_selection.visible = actif and not c.horsCombat
	if c.horsCombat and not _hors_combat:
		_hors_combat = true
		_jouer(MORT)
		_etiquette.modulate.a = OPACITE_HORS_COMBAT
	if not lieu.is_equal_approx(position):
		_aller(lieu)
	_vetir(corps)


## Ce que son corps porte, lu de son montage : l'id de sa base posée (`null` sans corps), chaque élément monté, et par
## emplacement l'emblème posé.
func corps() -> Dictionary:
	return {base = null if _montage.modele == null else _montage.base.id, elements = _montage.montes.values(), emblemes = _montage.emblemes.duplicate()}


## Tourné vers `cible` (une position du plateau), il frappe.
func agir_vers(cible: Vector3) -> void:
	_tourner_vers(cible)
	_jouer_puis_repos(ATTAQUE)


## Visé par un coup, il l'accuse, s'il tient encore debout.
func subir() -> void:
	if not _hors_combat:
		_jouer_puis_repos(COUP)


## Le corps `corps`, s'il a changé : aucun, le montage est vidé et l'étiquette à la hauteur du nom d'une entité ; sur
## une autre base que celle demandée, elle est tirée de `modeles/` et posée, ses clips de repos et de marche en boucle,
## puis la composition du dernier corps reçu montée (`_composer`) ; sur la même, posée, la composition l'est aussitôt.
func _vetir(corps: Variant) -> void:
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
	var scene := await _montage.scene_du_glb(corps.base, _montage.erreurs)
	if chargement != _chargement:
		if scene != null:
			scene.free()
		return
	_montage.vider()
	_montage.poser_le_modele(_base(corps.base), scene)
	if _montage.lecteur != null:
		for table: Dictionary in _montage.tables_de_clips():
			for role in [REPOS, MARCHE]:
				if _montage.lecteur.has_animation(table.get(role, "")):
					_montage.lecteur.get_animation(table[role]).loop_mode = Animation.LOOP_LINEAR
		_jouer(MORT if _hors_combat else REPOS)
	if _montage.gabarit != null:
		_montage.gabarit.mesure.connect(_hausser_l_etiquette)
		_poser_l_etiquette()
	_composer()


## La base `id` de la réponse de `modeles` retenue.
func _base(id: String) -> Dictionary:
	for base in MontageDeComposition.modeles.bases:
		if base.id == id:
			return base
	return {}


## La composition du dernier corps reçu montée sur la base posée : chaque emplacement de ses `montes` qui monte un
## élément le monte sous son emblème, ou rhabille celui qui y est déjà monté ; tout autre élément monté est démonté ;
## puis la base se rhabille, et le gabarit et les morphes du corps se posent, ceux du précédent remis à 0.
func _composer() -> void:
	var anciens: Dictionary = _montage.composee.get("morphes", {})
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
	_montage.poser_des_morphes(anciens.keys(), 0.0)
	_montage.poser_les_morphes()
	_rejouer()
	_signaler()


## `element` monté à l'emplacement `id` sous l'emblème `embleme`.
func _monter(id: String, element: String, embleme: String) -> void:
	if await _montage.monter(id, element, _montage.erreurs):
		_montage.choisir_l_embleme(id, embleme)
	_rejouer()
	_signaler()


## Le clip en cours rejoué au clip que son rôle a maintenant (`MontageDeComposition.clip`), si la tenue à deux mains
## l'a changé.
func _rejouer() -> void:
	var lecteur := _montage.lecteur
	if lecteur == null:
		return
	var role: String = _montage.role_du_clip(lecteur.assigned_animation)
	if role != "" and _montage.clip(role) != lecteur.assigned_animation:
		_jouer(role)


## Chaque erreur du montage à la console, puis `habille`.
func _signaler() -> void:
	for erreur in _montage.erreurs:
		push_error("[corps] %s : %s" % [_id, erreur])
	_montage.erreurs.clear()
	habille.emit()


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


## Le clip du rôle `role` joué, la file vidée ; rend s'il l'est.
func _jouer(role: String) -> bool:
	var lecteur := _montage.lecteur
	if lecteur == null or not lecteur.has_animation(_montage.clip(role)):
		return false
	lecteur.clear_queue()
	lecteur.play(_montage.clip(role))
	return true


## Le clip du rôle `role` joué, puis celui du repos.
func _jouer_puis_repos(role: String) -> void:
	if _jouer(role) and _montage.lecteur.has_animation(_montage.clip(REPOS)):
		_montage.lecteur.queue(_montage.clip(REPOS))


func _aller(lieu: Vector3) -> void:
	_tourner_vers(lieu)
	if _deplacement != null:
		_deplacement.kill()
	_jouer(MARCHE)
	_deplacement = create_tween()
	_deplacement.tween_property(self, "position", lieu, DUREE_DEPLACEMENT_S)
	_deplacement.tween_callback(_reposer)


func _reposer() -> void:
	if not _hors_combat:
		_jouer(REPOS)


func _tourner_vers(cible: Vector3) -> void:
	if not cible.is_equal_approx(position):
		_montage.look_at(cible, Vector3.UP, true)
