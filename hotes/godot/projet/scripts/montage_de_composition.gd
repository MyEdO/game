## Une base composée (#3253) : le nœud qui porte le modèle d'une base, tiré de `modeles/` (`hotes/godot/pont/CONTRAT.md`,
## « Atelier 3D »), et la composition que `composer` y monte (« Composition d'un personnage ») : chaque élément à sa ligne
## ou à son point, rigide, tenu, rangé ou skinné (#3086 D4, #3319), habillé de la palette de la composition et de son
## emblème (#3111), le gabarit (`GabaritDuSquelette`) et les morphes posés. L'atelier (`atelier.gd`) et chaque combattant
## du plateau (`combattant.gd`) en sont deux porteurs : l'un l'offre au joueur, l'autre le monte d'après la vue.
## La réponse de `modeles` retenue (`retenir_les_modeles`) est commune à tous les montages : chaque GLB s'y télécharge une
## fois, et chaque emblème s'y rastérise une fois, d'un chargement des modèles au suivant.
class_name MontageDeComposition
extends Node3D

## L'id d'un élément ou d'un emblème absent : aucun.
const VIDE := "vide"
const ORIGINE := [0.0, 0.0, 0.0]
## La largeur en pixels à laquelle le SVG d'un emblème se rastérise (#3111).
const LARGEUR_D_EMBLEME := 512.0
## La métadonnée de la scène d'un GLB (`scene_du_glb`) qui porte, par nom, chacun de ses matériaux.
const MATERIAUX := &"materiaux"


## Le GLB d'un fichier de `modeles/`, en vol jusqu'à `lue`, puis reçu (`octets`) ou en échec (`erreurs`).
class Lecture extends RefCounted:
	signal lue
	var en_vol := true
	var octets := PackedByteArray()
	var erreurs: Array[String] = []


## La réponse de `modeles` retenue.
static var modeles: Dictionary = {}
## Par fichier de `modeles/`, sa `Lecture`, d'un chargement des modèles au suivant.
static var _lectures: Dictionary = {}
## Par emblème, sa texture rastérisée (`texture_de_l_embleme`), d'un chargement des modèles au suivant.
static var _textures: Dictionary = {}

## La base posée, `{}` sans base.
var base: Dictionary = {}
## Par nom, chaque matériau du GLB de la base posée, ceux qu'aucune primitive ne porte compris : une variante qu'une
## surface nomme par sexe (#3188).
var materiaux_de_la_base: Dictionary = {}
var modele: Node3D = null
var squelette: Skeleton3D = null
var lecteur: AnimationPlayer = null
## Le modificateur du squelette de la base qui pose le gabarit de la composition.
var gabarit: GabaritDuSquelette = null
## Les modificateurs du squelette de la base qui posent la main libre sur la seconde prise de l'objet tenu (`SecondePrise`).
var seconde_prise: Array[Node] = []
## La réponse de `composer` retenue, `{}` sans composition : sa `palette`, son `gabarit`, ses `morphes`.
var composee: Dictionary = {}
## Où vont les erreurs de la pose, de l'habillage et des emblèmes.
var erreurs: Array[String] = []
## Par id d'emplacement de montage (l'id d'un point, `ligne/<ligne>` d'une ligne), l'élément monté.
var montes: Dictionary = {}
## Par id d'emplacement monté dont l'élément porte une surface `blason`, l'emblème posé (#3111).
var emblemes: Dictionary = {}
## Par id d'emplacement monté, ses meshes montés.
var pieces: Dictionary = {}
## Par id d'emplacement monté dont l'élément porte une surface `blason`, l'emblème demandé, posé ou non.
var _emblemes_demandes: Dictionary = {}
## Par id d'emplacement monté, les nœuds qui portent ses meshes dans la scène.
var _noeuds: Dictionary = {}
## Par id d'emplacement, la demande de montage retenue : le montage en vol d'une autre demande est jeté.
var _demandes: Dictionary = {}
## Les meshes de la base posée, relevés avant tout montage.
var _pieces_de_la_base: Array[MeshInstance3D] = []


## La réponse `reponse` de `modeles` retenue : les GLB lus et les emblèmes rastérisés sous la précédente sont oubliés.
static func retenir_les_modeles(reponse: Dictionary) -> void:
	modeles = reponse
	_lectures = {}
	_textures = {}


## Le listage des modèles (`GET modeles/listage.json`, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D »), par le pont que `hote`
## rejoint (`PontDuNoyau.requeter`) ; ses erreurs à `recueil`, vide s'il ne se lit pas.
static func lister(hote: Node, recueil: Array[String]) -> Dictionary:
	var octets := await (hote.get_node("/root/Pont") as PontDuNoyau).requeter("modeles/listage.json", recueil)
	var listage: Variant = JSON.parse_string(octets.get_string_from_utf8()) if not octets.is_empty() else null
	if not listage is Dictionary:
		recueil.append("listage-illisible : modeles/listage.json")
		return {}
	for erreur in listage.get("erreurs", []):
		recueil.append(str(erreur))
	return listage


## La réponse de `pont` à `modeles` sur le listage `listage` (`lister`), `ok` vrai ou faux, `{}` en panne.
static func indexer(pont: PontDuNoyau, listage: Dictionary) -> Dictionary:
	return pont.appeler("modeles", {manifestes = listage.get("manifestes", {}), osDesRigides = listage.get("osDesRigides", {})})


## Le premier `Skeleton3D` sous `noeud`, `null` s'il n'en porte aucun.
static func squelette_de(noeud: Node) -> Skeleton3D:
	for candidat in noeud.find_children("*", "Skeleton3D", true, false):
		return candidat as Skeleton3D
	return null


## Le `Portage` d'un point d'attache `{os, position, rotation}` (`hotes/godot/asset/attache.ts`), posé sous `sous`
## par le `BoneAttachment3D` nommé `nom` ; `null` si l'os est absent.
static func attacher(sous: Skeleton3D, declaration: Dictionary, nom: String) -> Node3D:
	if sous.find_bone(declaration.os) == -1:
		return null
	var attache := BoneAttachment3D.new()
	attache.name = nom
	sous.add_child(attache)
	attache.bone_name = declaration.os
	var support := Node3D.new()
	support.name = "Portage"
	support.transform = repere(declaration)
	attache.add_child(support)
	return support


## Le repère d'une attache `{position, rotation}` dans son os : rotation en radians, ordre XYZ de three, R = Rx·Ry·Rz
## (`hotes/godot/asset/attache.ts`, `scripts/personnage-3d/base/anatomie.py`).
static func repere(declaration: Dictionary) -> Transform3D:
	var rotation := Vector3(declaration.rotation[0], declaration.rotation[1], declaration.rotation[2])
	return Transform3D(Basis.from_euler(rotation, EULER_ORDER_XYZ),
		Vector3(declaration.position[0], declaration.position[1], declaration.position[2]))


## Le duplicata du matériau actif de la surface `surface` de `piece`, posé en matériau de surface propre à `piece` ;
## `null` si ce matériau n'est pas un `BaseMaterial3D`.
static func materiau_local(piece: MeshInstance3D, surface: int) -> BaseMaterial3D:
	var original := piece.get_active_material(surface) as BaseMaterial3D
	if original == null:
		return null
	var local := original.duplicate() as BaseMaterial3D
	piece.set_surface_override_material(surface, local)
	return local


## `element` porte-t-il une surface `blason` ?
static func porte_un_blason(element: String) -> bool:
	return modeles.surfaces[element].any(func(surface: Dictionary) -> bool: return surface.get("blason", false))


## Le GLB du modèle `id`, sous le fichier que lui donne `glb` de la réponse retenue, en scène neuve, qui porte en
## métadonnée `MATERIAUX` chaque matériau du GLB par son nom (`GLTFState.get_materials`, ceux qu'aucune primitive ne porte
## compris) : téléchargé une fois par chargement des modèles, chaque demande d'un même fichier attendant la première, puis
## lu à chaque demande, car un
## `GLTFState` ne génère qu'une scène dont le squelette trouve ses os par leur nom (`generate_scene` rappelé : `find_bone`
## rend -1), par le `GLTFDocument` qui l'a lu (un autre rend des `ImporterMeshInstance3D`, Godot 4.7-stable) ; `null`
## (et une erreur à `recueil`) s'il n'y a pas de fichier ou s'il ne se lit pas, et un
## fichier qui ne s'est pas téléchargé se redemande. Chaque liaison d'un skin y porte le nom de son os (#3086, D4 ;
## `GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS`,
## `modules/gltf/gltf_document.cpp` `_create_skins`, `scene/3d/skeleton_3d.cpp` `NOTIFICATION_UPDATE_SKELETON`,
## Godot 4.7-stable).
func scene_du_glb(id: String, recueil: Array[String]) -> Node3D:
	if not modeles.glb.has(id):
		recueil.append("glb-absent : %s" % id)
		return null
	var fichier: String = modeles.glb[id]
	var lecture: Lecture = _lectures.get(fichier)
	if lecture == null:
		lecture = Lecture.new()
		_lectures[fichier] = lecture
		await _lire(fichier, lecture)
	elif lecture.en_vol:
		await lecture.lue
	recueil.append_array(lecture.erreurs)
	if lecture.octets.is_empty():
		return null
	var document := GLTFDocument.new()
	var etat := GLTFState.new()
	etat.handle_binary_image_mode = GLTFState.HANDLE_BINARY_IMAGE_MODE_EMBED_AS_UNCOMPRESSED
	var code := document.append_from_buffer(lecture.octets, "", etat, GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS)
	if code != OK:
		recueil.append("glb-illisible : %s (%s)" % [id, error_string(code)])
		return null
	var scene := document.generate_scene(etat) as Node3D
	if scene == null:
		return null
	var par_nom := {}
	for materiau in etat.get_materials():
		par_nom[materiau.resource_name] = materiau
	scene.set_meta(MATERIAUX, par_nom)
	return scene


func _lire(fichier: String, lecture: Lecture) -> void:
	lecture.octets = await (get_node("/root/Pont") as PontDuNoyau).requeter("modeles/%s" % fichier, lecture.erreurs)
	if lecture.octets.is_empty() and _lectures.get(fichier) == lecture:
		_lectures.erase(fichier)
	lecture.en_vol = false
	lecture.lue.emit()


## Le montage ramené à aucun modèle : ni squelette ni lecteur, ni élément monté, ni demande de montage en vol.
func vider() -> void:
	if modele != null:
		remove_child(modele)
		modele.queue_free()
	modele = null
	materiaux_de_la_base = {}
	_pieces_de_la_base.clear()
	squelette = null
	lecteur = null
	gabarit = null
	seconde_prise.clear()
	pieces.clear()
	_noeuds.clear()
	montes.clear()
	emblemes.clear()
	_emblemes_demandes.clear()
	_demandes.clear()


## La base `posee` retenue et, si `scene` (son GLB en scène) n'est pas nulle, posée sous ce nœud : ses matériaux
## (`MATERIAUX`) et ses meshes relevés, habillés de la palette de la composition, son squelette (`squelette-absent` aux
## erreurs sans lui), qui reçoit le modificateur du gabarit, et son lecteur de clips.
func poser_le_modele(posee: Dictionary, scene: Node3D) -> void:
	base = posee
	if scene == null:
		return
	modele = scene
	materiaux_de_la_base = scene.get_meta(MATERIAUX, {})
	add_child(scene)
	_pieces_de_la_base.assign(scene.find_children("*", "MeshInstance3D", true, false))
	squelette = squelette_de(scene)
	for candidat in scene.find_children("*", "AnimationPlayer", true, false):
		lecteur = candidat as AnimationPlayer
		break
	habiller_la_base()
	if squelette == null:
		erreurs.append("squelette-absent : %s" % base.id)
		return
	gabarit = GabaritDuSquelette.new()
	gabarit.lecteur = lecteur
	squelette.add_child(gabarit)


## Par ligne de `montes` de la composition retenue, sa première entrée qui monte un élément.
func cibles() -> Dictionary:
	var retenues := {}
	for monte in composee.get("montes", []):
		if monte.element != null and not retenues.has(monte.ligne):
			retenues[monte.ligne] = monte
	return retenues


## L'emplacement `id` démonté avec son emblème ; le montage en vol qu'il attendait est jeté.
func demonter(id: String) -> void:
	_demandes[id] = RefCounted.new()
	for noeud in _noeuds.get(id, []):
		noeud.free()
	_noeuds.erase(id)
	pieces.erase(id)
	montes.erase(id)
	emblemes.erase(id)
	_emblemes_demandes.erase(id)
	masquer_les_zones_couvertes()
	poser_la_seconde_prise()


## @contrat Atelier 3D
## Au montage d'un élément, à un point ou à une ligne, Godot instancie son GLB et monte chacun de ses meshes (#3086,
## D4) : un mesh rigide passe sous un os sous l'os de la base de même nom, à sa position locale, comme l'évaluateur
## (`asset/evaluateur/evaluer.ts`, `monter`) ; un mesh skinné passe sous le `Skeleton3D` de la base, qui devient son
## `skeleton`, et son skin se lie par NOM d'os : le GLB se charge avec le drapeau
## `GLTFDocument.IMPORT_FLAG_USE_NAMED_SKIN_BINDS` d'`append_from_buffer`, qui donne à chaque liaison le nom du nœud
## de son joint, sans indice d'os (`Skin.add_named_bind` ; `modules/gltf/gltf_document.cpp` `_create_skins`, Godot
## 4.7-stable), et le squelette de la base résout une liaison nommée par le nom de ses os, avant tout indice
## (`scene/3d/skeleton_3d.cpp`, `NOTIFICATION_UPDATE_SKELETON`, Godot 4.7-stable), quels que soient l'ordre des joints
## et celui des nœuds du GLB de l'élément. Sans ce drapeau, chaque liaison porterait l'indice de son os dans le
## squelette du GLB de l'élément, que l'import range par indice de nœud (`modules/gltf/skin_tool.cpp`
## `_create_skeletons`), et que rien ne relie aux os de la base. Un mesh à la racine, ni pendu à un os ni skinné,
## n'est pas monté. Chaque os qu'un mesh nomme (l'os de son attache, ou le nom d'une liaison de son skin) et que la
## base n'a pas ajoute `os-absent : <os>` aux `erreurs`, et l'élément n'est pas monté ; un élément sans mesh à monter
## ajoute `element-sans-piece : <element>` et n'est pas monté.

## L'emplacement `id` démonté, puis `element` monté une fois son GLB chargé, si aucune autre demande ne l'a remplacé à
## cet emplacement (#3086, D4) : chaque mesh rigide pendu à un os du GLB, à sa transformation locale, sous l'os de même
## nom de la base (`hotes/godot/asset/evaluateur/evaluer.ts` `monter`) ; chaque mesh skinné sous le squelette de la
## base, son skin lié par nom d'os (`scene_du_glb`). Rien de monté s'il n'a aucun mesh à monter, ou si un os que ses
## meshes nomment manque à la base : chacun va à `recueil`. Monté, il reçoit les morphes de la composition ; rend s'il
## l'est.
func monter(id: String, element: String, recueil: Array[String]) -> bool:
	demonter(id)
	var demande: RefCounted = _demandes[id]
	var sous := squelette
	if sous == null:
		return false
	var scene := await scene_du_glb(element, recueil)
	if demande != _demandes.get(id):
		if scene != null:
			scene.free()
		return false
	if scene == null:
		return false
	var trouvees: Array[MeshInstance3D] = []
	var os_des_pieces: Array[Array] = []
	var absents: Array[String] = []
	for noeud in scene.find_children("*", "MeshInstance3D", true, false):
		var piece := noeud as MeshInstance3D
		var noms := _os_de_la_piece(piece)
		if noms.is_empty():
			continue
		trouvees.append(piece)
		os_des_pieces.append(noms)
		for nom in noms:
			if sous.find_bone(nom) == -1 and not nom in absents:
				absents.append(nom)
	for nom in absents:
		recueil.append("os-absent : %s" % nom)
	if trouvees.is_empty():
		recueil.append("element-sans-piece : %s" % element)
	if trouvees.is_empty() or not absents.is_empty():
		scene.free()
		return false
	var noeuds: Array[Node] = []
	for rang in trouvees.size():
		noeuds.append(_poser_la_piece(trouvees[rang], os_des_pieces[rang], sous, id))
	scene.free()
	pieces[id] = trouvees
	_noeuds[id] = noeuds
	montes[id] = element
	poser_les_morphes()
	masquer_les_zones_couvertes()
	poser_la_seconde_prise()
	return true


## @contrat Atelier 3D
## Un vêtement masque ce qu'il couvre (#2972) : à chaque montage et démontage,
## `MontageDeComposition.masquer_les_zones_couvertes` cache chaque mesh de zone (`extras.zone` de son nœud glTF, que
## Godot importe en métadonnée `extras`), de la base ou d'un élément monté, dont la zone est couverte (`couvre` de
## `couches`) par un élément monté qui masque son porteur (`masque`), et le montre sinon ; toute couche masque la
## base. La chemise sous le pourpoint ne montre ainsi que les pièces de ses zones qu'il ne couvre pas, son col. La
## garde `traversee` de l'évaluateur (`asset/evaluateur/gardes/traversee.ts`) applique le même masque, puis mesure en
## clip qu'aucune couche visible ne passe devant celle qui la couvre.

## Chaque mesh de zone (`extras.zone`), de la base ou d'un élément monté, caché si un élément monté couvre sa zone et
## masque son porteur (`couvre` et `masque` de `couches` dans `modeles`, #2972), montré sinon ; la base est masquée par
## toute couche.
func masquer_les_zones_couvertes() -> void:
	var couches: Dictionary = modeles.get("couches", {})
	var porteurs: Array = [[_pieces_de_la_base, null]]
	for id in pieces:
		porteurs.append([pieces[id], montes[id]])
	for porteur in porteurs:
		for piece: MeshInstance3D in porteur[0]:
			var zone: Variant = piece.get_meta("extras", {}).get("zone")
			if zone != null:
				piece.visible = not montes.values().any(func(par: String) -> bool: return _masque(couches.get(par, {}), porteur[1], zone))


## La couche `couche` cache-t-elle la zone `zone` de `porteur`, un élément ou la base (`null`) ?
static func _masque(couche: Dictionary, porteur: Variant, zone: String) -> bool:
	return zone in couche.get("couvre", []) and (porteur == null or porteur in couche.get("masque", []))


## @contrat Atelier 3D
## Un élément monté à la prise `main` qui a une seconde prise (`secondesPrises` de `modeles`) se tient des deux mains
## tant que la prise `off` ne monte rien (#3319) : `MontageDeComposition.poser_la_seconde_prise`
## (`projet/scripts/montage_de_composition.gd`), rappelée à chaque montage et démontage, pose sous le squelette, après
## le gabarit, les modificateurs natifs de `SecondePrise.poser` (`projet/scripts/seconde_prise.gd`, tenus dans
## `seconde_prise`), et les retire sinon. Dans l'ordre : un `AimModifier3D` tourne l'os de la prise `main` pour
## pointer vers l'os de la prise `off` du clip celui de ses axes le plus proche de la direction de la seconde prise ;
## un `ModifierBoneTarget3D` suit cet os et porte le repère de la seconde prise, puis celui où l'os de la prise `off`
## la tient ; un `FABRIK3D` y ploie le bras de la main `off` (l'os de la prise `off` et ses deux parents), en partant
## chaque fois de la pose du clip ; un `CopyTransformModifier3D` donne enfin à l'os de la main `off` l'orientation de
## ce repère, et à chacun de ses descendants la rotation de son homologue sous la main `main`, appariés enfant par
## enfant, en même nombre (le poing de la main qui tient). La recette autonome `projet/recettes/seconde-prise.gd` le
## vérifie à 1 mm. Le repos de l'atelier est le clip `idle` de la composition montée (`MontageDeComposition.clip`), à
## deux mains sous une seconde prise : il se joue à la pose d'une base sans clip de reprise et à l'arrêt de la marche
## ; un montage ou un démontage passe le clip engagé à celui de son rôle sous la nouvelle tenue, en lecture ou en
## pause comme lui (`_jouer_le_repos`, `_rejouer`, `projet/scripts/atelier.gd`). La recette autonome
## `projet/recettes/repos-de-l-atelier.gd` le vérifie.

## La main de la prise `off` posée sur la seconde prise de l'élément monté à la prise `main` (`secondesPrises` de
## `modeles`, #3319), si la prise `off` ne tient rien ; aucune sinon.
func poser_la_seconde_prise() -> void:
	for modificateur in seconde_prise:
		modificateur.free()
	seconde_prise.clear()
	var seconde: Variant = modeles.get("secondesPrises", {}).get(montes.get("main", VIDE))
	var tenante := _point("main")
	var libre := _point("off")
	if squelette == null or seconde == null or montes.has("off") or tenante.is_empty() or libre.is_empty():
		return
	seconde_prise = SecondePrise.poser(squelette, tenante.attache, libre.attache, seconde.repere)



## Le clip du rôle `role` de la base posée : tant que la main libre tient la seconde prise (`seconde_prise`), celui de
## `clipsDeuxMains` sous le maniement de l'élément tenu (`secondesPrises` de `modeles`) ; celui de `clips` sinon, ou faute
## de clip à deux mains pour ce maniement et ce rôle ; `""` sans clip.
func clip(role: String) -> String:
	var clips: Dictionary = base.get("clips", {})
	if seconde_prise.is_empty():
		return clips.get(role, "")
	var maniement: Variant = modeles.secondesPrises[montes.main].maniement
	return base.get("clipsDeuxMains", {}).get(maniement, {}).get(role, clips.get(role, ""))


## La durée (s) d'un pas de `metres` mètres d'un chemin (#3822) à la vitesse au sol de la base posée (`vitesseAuSol` de
## `modeles`) à l'échelle de vitesse du gabarit composé (`echelleDeVitesse`, neutre sans gabarit,
## `MiseEnPage.duree_du_pas`).
func duree_du_pas(metres: float) -> float:
	return MiseEnPage.duree_du_pas(metres, base.vitesseAuSol, composee.get("gabarit", {}).get("echelleDeVitesse", MarcheDeLAtelier.VITESSE_NEUTRE))


## Les tables rôle → clip de la base posée : `clips`, puis celle de chaque maniement de `clipsDeuxMains`.
func tables_de_clips() -> Array[Dictionary]:
	var tables: Array[Dictionary] = [base.get("clips", {})]
	tables.append_array(base.get("clipsDeuxMains", {}).values())
	return tables


## Le rôle du clip `nom` dans une table de la base posée (`tables_de_clips`), `""` s'il n'en joue aucun.
func role_du_clip(nom: String) -> String:
	for table: Dictionary in tables_de_clips():
		var role: Variant = table.find_key(nom)
		if role != null:
			return role
	return ""


## Le rôle du clip engagé au lecteur (`role_du_clip`) quand la tenue posée lui donne un autre clip (`clip`) ; `""` sinon,
## ou sans clip engagé.
func role_a_rejouer() -> String:
	if lecteur == null or lecteur.assigned_animation == "":
		return ""
	var role := role_du_clip(lecteur.assigned_animation)
	return "" if role == "" or clip(role) == lecteur.assigned_animation else role


## Les os qui portent `piece` : celui de son `BoneAttachment3D` pour un mesh rigide (l'import glTF le pose sous l'attache
## de son os) ; pour un mesh skinné, le nom de chaque liaison de son skin (`Skin.get_bind_name`, posé à l'import par
## `scene_du_glb`) ; aucun pour un mesh à la racine.
func _os_de_la_piece(piece: MeshInstance3D) -> Array[String]:
	var noms: Array[String] = []
	if piece.skin != null:
		for liaison in piece.skin.get_bind_count():
			noms.append(String(piece.skin.get_bind_name(liaison)))
	elif piece.get_parent() is BoneAttachment3D:
		noms.append((piece.get_parent() as BoneAttachment3D).bone_name)
	return noms


## `piece`, qui pend aux os `noms`, posée sur `sous`, le squelette de la base, pour l'emplacement `id` : rigide, sous un
## os de même nom que le sien ; tenue (son os est celui d'une prise), reposée du repère de sa prise d'origine dans celui
## de la prise `id`, sans miroir, ou rangée à l'emplacement `id` (`_repere_de_rangement`) (#3319, `CONTRAT.md`) ;
## skinnée, sous le squelette, son skin lié par nom dès l'import (`scene_du_glb`). Le nœud qui la porte dans la scène.
func _poser_la_piece(piece: MeshInstance3D, noms: Array[String], sous: Skeleton3D, id: String) -> Node:
	piece.owner = null
	if piece.skin == null:
		var nom := ("Monte_%s_%s" % [id, piece.name]).validate_node_name()
		var cible := _point(id)
		var origine := _prise_de_l_os(noms[0])
		if cible.is_empty() or origine.is_empty() or (cible.genre == "emplacement" and cible.attache.os == noms[0]):
			var support := attacher(sous, {os = noms[0], position = ORIGINE, rotation = ORIGINE}, nom)
			piece.reparent(support, false)
			return support.get_parent()
		var relais := Node3D.new()
		relais.name = "DepuisLaPrise_%s" % origine.id
		relais.transform = repere(origine.attache).affine_inverse()
		if cible.genre == "prise":
			var portage := attacher(sous, cible.attache, nom)
			portage.add_child(relais)
			piece.reparent(relais, false)
			return portage.get_parent()
		var rangement := Node3D.new()
		rangement.name = "Range_%s" % cible.id
		attacher(sous, {os = cible.attache.os, position = ORIGINE, rotation = ORIGINE}, nom).add_child(rangement)
		rangement.add_child(relais)
		piece.reparent(relais, false)
		rangement.transform = _repere_de_rangement(cible.attache, _arriere(piece, rangement))
		return rangement.get_parent().get_parent()
	piece.reparent(sous, false)
	piece.skeleton = piece.get_path_to(sous)
	return piece


## Le point d'accroche `id` de la base posée, emplacement ou prise, `{}` si aucun.
func _point(id: String) -> Dictionary:
	for point in base.get("points", []):
		if point.id == id:
			return point
	return {}


## Le repère, dans l'os de l'emplacement `attache`, où se pose le repère de prise d'un objet rangé dont la face arrière
## de la boîte, dans ce repère de prise, est à `arriere` : ses axes et son origine (`MiseEnPage.axe_de_rangement`,
## `MiseEnPage.origine_de_rangement`).
static func _repere_de_rangement(attache: Dictionary, arriere: float) -> Transform3D:
	var emplacement := repere(attache)
	var point := emplacement.origin
	var axes := emplacement.basis
	return Transform3D(Basis(MiseEnPage.axe_de_rangement(axes, point, Vector3.AXIS_X), MiseEnPage.axe_de_rangement(axes, point, Vector3.AXIS_Y),
		MiseEnPage.axe_de_rangement(axes, point, Vector3.AXIS_Z)), MiseEnPage.origine_de_rangement(axes, point, arriere))


## La cote en z de la face arrière de la boîte de `piece` dans le repère du nœud `dans`, son ancêtre : la boîte de ses
## huit coins (`AABB.expand`).
static func _arriere(piece: MeshInstance3D, dans: Node3D) -> float:
	var boite := piece.get_aabb()
	var dans_le_repere := AABB(dans.to_local(piece.to_global(boite.get_endpoint(0))), Vector3.ZERO)
	for coin in range(1, 8):
		dans_le_repere = dans_le_repere.expand(dans.to_local(piece.to_global(boite.get_endpoint(coin))))
	return dans_le_repere.position.z


## La prise de la base posée dont l'os est `os`, `{}` si aucune.
func _prise_de_l_os(os: String) -> Dictionary:
	for point in base.get("points", []):
		if point.genre == "prise" and point.attache.os == os:
			return point
	return {}


## L'emblème `embleme` demandé à l'emplacement `id`, qu'un élément monte : « vide » sur un élément sans surface `blason`
## ou pour un emblème que `modeles` n'offre pas ; puis l'élément habillé (`_habiller`). Rend l'emblème posé, « vide » si
## aucune surface ne l'a reçu.
func choisir_l_embleme(id: String, embleme: String) -> String:
	var element: String = montes[id]
	var offert: bool = modeles.emblemes.any(func(offre: Dictionary) -> bool: return offre.id == embleme)
	_emblemes_demandes[id] = embleme if offert and porte_un_blason(element) else VIDE
	var pose: String = _emblemes_demandes[id] if _habiller(id) else VIDE
	if pose == VIDE:
		emblemes.erase(id)
	else:
		emblemes[id] = pose
	return pose


## @contrat Atelier 3D
## Chaque élément monté s'habille, au montage et à chaque composition, de la `palette` de la dernière réponse de
## `composer`, chaque emplacement de palette que colore la `palette` de son entrée de `montes` (sa teinte) pris à
## celle-ci quand cette entrée monte cet élément, et de l'emblème demandé à son emplacement ; la base posée s'habille
## des `materiaux` et de la palette de la même réponse, à sa pose et à chaque composition. Habiller, c'est rendre
## d'abord à chaque surface de ses meshes son override ; sur la base, chaque surface dont le matériau actif porte (par
## `resource_name`) le `nom` d'une surface que `materiaux` nomme prend en override le matériau du GLB de ce nom, ceux
## qu'aucune primitive ne porte compris (`GLTFState.get_materials`, relevés par nom à la lecture du GLB,
## `MontageDeComposition.materiaux_de_la_base`), un nom absent du GLB ajoutant `materiau-absent : <nom>` aux `erreurs`
## ; puis c'est donner à chaque surface dont le matériau actif porte (par `resource_name`) le `nom` d'une de ses
## `surfaces` un matériau propre (`MontageDeComposition.materiau_local`, `projet/scripts/montage_de_composition.gd`)
## si la palette colore son emplacement de palette, si elle est `blason` sous un emblème demandé, ou si la texture de
## sa `matiere` est au projet : celle-ci l'habille comme le monde (section « Monde », `VolumeDeScene.texturer`), projetée sur
## les trois axes du repère du mesh, l'albédo à blanc ; la couleur y remplace l'albédo du GLB, texture comprise, pour
## que la tête et le corps d'une même peau aient la même couleur, ou teint la texture de sa matière ; l'emblème en
## devient la couche *detail* (`detail_enabled`, `detail_albedo`, `detail_blend_mode` mix), lue aux UV du GLB :
## `detail_uv_layer` UV1, ou UV2 sur une surface à matière texturée, dont la matière projette l'UV1, la pièce recevant
## alors une copie de son mesh dont ces surfaces portent leurs UV en UV2. Ni le mesh ni le matériau partagé ne
## changent ; toute autre surface garde le matériau du GLB. Le SVG d'un emblème se rastérise une fois par chargement
## des modèles, par `Image.load_svg_from_string` à 512 px de large (échelle 512 / largeur intrinsèque), mipmaps
## générées ; un SVG illisible ajoute `embleme-illisible : <id> (<erreur>)` aux `erreurs` publiées et ne pose rien. Un
## emblème qui ne se pose sur aucune surface (aucun matériau actif ne porte le nom d'une surface `blason`, ou aucun
## n'est un `BaseMaterial3D`) ajoute `blason-sans-surface : <element>` aux `erreurs` et n'est pas posé : `emblemes`
## n'en porte rien. Chaque pose réécrit `%Etat`, erreurs comprises, à « Recharger les modèles » aussi. Le carré UV
## [0,1]² de la surface porteuse est le cadre de l'emblème
## (`.claude/skills/creer-un-personnage-3d/references/procedure.md`).

## L'élément monté à l'emplacement `id` habillé de la palette de la composition, chaque emplacement de palette que
## colore la `palette` de son entrée de `montes` (sa teinte, #3456) pris à celle-ci quand cette entrée monte cet élément,
## et de l'emblème demandé (`peindre`) ; rend si l'emblème est posé sur une surface au moins, et un emblème demandé
## qu'aucune ne reçoit donne `blason-sans-surface`.
func _habiller(id: String) -> bool:
	var element: String = montes[id]
	var embleme: String = _emblemes_demandes.get(id, VIDE)
	var texture: ImageTexture = null if embleme == VIDE else texture_de_l_embleme(embleme)
	var monte: Dictionary = cibles().get(id, {})
	var palette: Dictionary = composee.get("palette", {}).duplicate()
	if monte.get("element") == element:
		palette.merge(monte.get("palette", {}), true)
	var posee := peindre(pieces[id], modeles.surfaces[element], texture, palette)
	if texture != null and not posee:
		erreurs.append("blason-sans-surface : %s" % element)
	return posee


## Les meshes de la base posée habillés des matériaux de la composition et de sa palette (`peindre`, `surfaces` de la
## base) : chaque surface que `materiaux` nomme prend le matériau de la base de ce nom (`materiaux_de_la_base`), un nom
## absent du GLB ajoutant `materiau-absent` aux erreurs.
func habiller_la_base() -> void:
	if base.is_empty():
		return
	var remplacants := {}
	var materiaux: Dictionary = composee.get("materiaux", {})
	for surface in materiaux:
		var remplacant: Material = materiaux_de_la_base.get(materiaux[surface])
		if remplacant == null:
			erreurs.append("materiau-absent : %s" % materiaux[surface])
		else:
			remplacants[surface] = remplacant
	peindre(_pieces_de_la_base, modeles.surfaces[base.id], null, composee.get("palette", {}), remplacants)


## Chaque surface de `meshes` dont le matériau du GLB porte le `nom` d'une de `surfaces` prend le matériau que
## `remplacants` donne à ce nom, puis reçoit un matériau propre (`materiau_local`) si `palette` colore son emplacement de
## palette, si elle est `blason` et `texture` n'est pas nulle, ou si la texture de sa `matiere` est au projet : celle-ci
## l'habille comme le monde (`VolumeDeScene.texturer`), l'albédo à blanc ; la couleur remplace l'albédo du GLB,
## texture comprise,
## pour que la tête et le corps d'une même peau aient la même couleur, ou teint la texture de sa matière ; `texture`
## devient la couche de détail, en mélange, lue aux UV du GLB : l'UV1, ou l'UV2 où la matière projette l'UV1 sur les
## trois axes (`_uv2_des_emblemes`). Toute autre surface garde le matériau du GLB. Rend si `texture` est posée sur une
## surface au moins.
static func peindre(meshes: Array, surfaces: Array, texture: ImageTexture, palette: Dictionary, remplacants: Dictionary = {}) -> bool:
	var par_nom := {}
	for surface in surfaces:
		par_nom[surface.nom] = surface
	var posee := false
	for piece: MeshInstance3D in meshes:
		if texture != null:
			_uv2_des_emblemes(piece, par_nom)
		for rang in piece.mesh.get_surface_count():
			piece.set_surface_override_material(rang, null)
			var materiau := piece.get_active_material(rang)
			var surface: Dictionary = {} if materiau == null else par_nom.get(materiau.resource_name, {})
			if surface.is_empty():
				continue
			if remplacants.has(surface.nom):
				piece.set_surface_override_material(rang, remplacants[surface.nom])
			var couleur: Variant = palette.get(surface.palette)
			var blason: bool = texture != null and surface.get("blason", false)
			var matiere := _matiere_texturee(surface)
			var texturee := not matiere.is_empty()
			if couleur == null and not blason and not texturee:
				continue
			var local := materiau_local(piece, rang)
			if local == null:
				continue
			if texturee:
				VolumeDeScene.texturer(local, matiere)
				local.albedo_color = Color.WHITE
			elif couleur != null:
				local.albedo_texture = null
			if couleur != null:
				local.albedo_color = Color(couleur)
			if blason:
				local.detail_enabled = true
				local.detail_albedo = texture
				local.detail_uv_layer = BaseMaterial3D.DETAIL_UV_2 if texturee else BaseMaterial3D.DETAIL_UV_1
				local.detail_blend_mode = BaseMaterial3D.BLEND_MODE_MIX
				posee = true
	return posee


## La matière texturée d'une `surface` de `peindre`, ou "" : sa texture est au projet.
static func _matiere_texturee(surface: Dictionary) -> String:
	var matiere: String = surface.get("matiere", "")
	return matiere if not matiere.is_empty() and ResourceLoader.exists(VolumeDeScene.texture_de(matiere)) else ""


## Le mesh de `piece` recopié, chaque surface `blason` de `par_nom` à matière texturée recevant en UV2 les UV du GLB : la
## matière projette l'UV1 sur les trois axes (`VolumeDeScene.texturer`), l'emblème garde son placement en UV2. Une pièce sans
## telle surface, ou déjà recopiée, garde son mesh.
static func _uv2_des_emblemes(piece: MeshInstance3D, par_nom: Dictionary) -> void:
	var source := piece.mesh as ArrayMesh
	var rangs := range(source.get_surface_count()).filter(func(rang: int) -> bool:
		var materiau := source.surface_get_material(rang)
		var surface: Dictionary = {} if materiau == null else par_nom.get(materiau.resource_name, {})
		return surface.get("blason", false) and not _matiere_texturee(surface).is_empty() \
			and source.surface_get_format(rang) & Mesh.ARRAY_FORMAT_TEX_UV2 == 0)
	if rangs.is_empty():
		return
	var copie := ArrayMesh.new()
	copie.blend_shape_mode = source.blend_shape_mode
	for forme in source.get_blend_shape_count():
		copie.add_blend_shape(source.get_blend_shape_name(forme))
	for rang in source.get_surface_count():
		var tableaux := source.surface_get_arrays(rang)
		if rang in rangs:
			tableaux[Mesh.ARRAY_TEX_UV2] = tableaux[Mesh.ARRAY_TEX_UV]
		copie.add_surface_from_arrays(source.surface_get_primitive_type(rang), tableaux, source.surface_get_blend_shape_arrays(rang))
		copie.surface_set_material(rang, source.surface_get_material(rang))
		copie.surface_set_name(rang, source.surface_get_name(rang))
	piece.mesh = copie


## Par emplacement monté dont une surface porte un matériau propre, la couleur d'albédo `#rrggbb` de ce matériau, par nom
## du matériau du GLB.
func couleurs_posees() -> Dictionary:
	var couleurs := {}
	for id in pieces:
		var posees := couleurs_des_meshes(pieces[id])
		if not posees.is_empty():
			couleurs[id] = posees
	return couleurs


## Par nom du matériau du GLB, la couleur d'albédo `#rrggbb` du matériau propre de chaque surface de `meshes` qui en
## porte un.
static func couleurs_des_meshes(meshes: Array) -> Dictionary:
	var posees := {}
	for piece: MeshInstance3D in meshes:
		for rang in piece.mesh.get_surface_count():
			var local := piece.get_surface_override_material(rang) as BaseMaterial3D
			if local != null:
				posees[local.resource_name] = "#" + local.albedo_color.to_html(false)
	return posees


## Le SVG de l'emblème `id`, offert par `emblemes` de la réponse de `modeles`, rastérisé à `LARGEUR_D_EMBLEME` pixels de
## large, ses mipmaps générées, une fois par chargement des modèles ; `null` (et une erreur) s'il ne se lit pas.
func texture_de_l_embleme(id: String) -> ImageTexture:
	if not _textures.has(id):
		_textures[id] = _rasteriser_l_embleme(id)
	return _textures[id]


func _rasteriser_l_embleme(id: String) -> ImageTexture:
	var svg: String = modeles.emblemes.filter(func(offert: Dictionary) -> bool: return offert.id == id)[0].svg
	var image := Image.new()
	var code := image.load_svg_from_string(svg)
	if code == OK:
		code = image.load_svg_from_string(svg, MiseEnPage.echelle_d_image(LARGEUR_D_EMBLEME, image.get_width()))
	if code != OK or image.is_empty():
		erreurs.append("embleme-illisible : %s (%s)" % [id, error_string(code)])
		return null
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)


## Le gabarit de la composition (`gabarit` de `composer`, aucun sans composition) remis au modificateur du squelette
## (`GabaritDuSquelette`, `CONTRAT.md`, « Gabarit d'une base »), qui le pose sur la pose de chaque image, au repos comme
## pendant un clip ; le squelette remis à sa pose de repos, puis le clip engagé reposé à son instant. Rend chaque os qu'il
## nomme et que la base n'a pas ; aucun sans modificateur.
func poser_le_gabarit() -> Array[String]:
	if gabarit == null:
		return []
	var absents := gabarit.poser(composee.get("gabarit", {}))
	squelette.reset_bone_poses()
	if lecteur != null and lecteur.assigned_animation != "":
		lecteur.seek(lecteur.current_animation_position, true)
	return absents


## Les poids `morphes` de la composition posés par nom de shape key sur chaque mesh de la base et de chaque élément monté
## qui porte la clé (#3086, D4) ; un mesh sans la clé n'en reçoit rien.
func poser_les_morphes() -> void:
	var morphes: Dictionary = composee.get("morphes", {})
	for nom in morphes:
		poser_des_morphes([nom], float(morphes[nom]))


## Le poids `poids` posé à chaque shape key nommée dans `noms`, sur chaque mesh du modèle qui la porte.
func poser_des_morphes(noms: Array, poids: float) -> void:
	if modele == null:
		return
	for noeud in modele.find_children("*", "MeshInstance3D", true, false):
		var mesh := noeud as MeshInstance3D
		for nom in noms:
			var rang := mesh.find_blend_shape_by_name(nom)
			if rang != -1:
				mesh.set_blend_shape_value(rang, poids)
