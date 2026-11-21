## Le volume d'une scène tel que le jeu le dessine, que le monde du plateau et de l'éditeur (`Monde`) et l'atelier
## instancient tous deux : le volume du monde (`CONTRAT.md`, section « Monde ») en morceaux, mis à l'échelle d'une unité
## par case, chacun un nœud nommé par sa clé, gardé tant que son empreinte ne bouge pas (`poser`, `manquants`), une
## instance vue sans ombre portée, habillée du shader de monde (`art/monde.gdshader`), et une instance en ombre seule du
## même maillage, dans une matière standard, une surface par matière, texturée ou colorée par sommet, rendue des deux
## côtés hors des surfaces d'un navire et de celles des décors que leur modèle montre (`peindre_sans`), la mer de chaque
## navire bordée par sa coque (`border_la_mer`) ; ce que le regard
## en retire, masqué case par case dans le shader sans toucher ni aux maillages ni à leur ombre (`retirer`) ; ce que le
## groupe en voit, voilé de même case par case et fondu d'une vision à la suivante (`voir`) ; le voile de cette vision
## sur chaque modèle posé (`voile`, par clé de pose de `MontageDesModeles`, jusqu'à `oublier_le_voile`,
## `art/voile.gdshader`), lié au sol de chaque case des morceaux posés, en texture rangée comme la vision
## (`_batir_les_sols`) ; les nappes de toit et les couronnes crénelées des
## murs, de même forme qu'un morceau, voilées comme lui mais jamais masquées, réconciliées de même par clé et
## empreinte ; les arêtes de la scène, en unités de plateau, chacune la pièce que l'arête nomme du modèle d'arête servi
## de sa famille (`modele_servi`, #4471), sinon sa boîte, et les côtés de ses cases de marches, chacun les pièces qu'il
## nomme du modèle d'escalier servi de sa famille, cisaillées à sa pente, en groupes d'instances
## (`poser_les_aretes`), chaque instance vue teinte par l'état de la meilleure des cases qu'elle sépare ; et ce que qui
## l'instancie en cache à la caméra (`cacher`) ou en retire
## (`retirer_les_couronnes`).
class_name VolumeDeScene
extends Node3D

## Le fondu de la vision (`voir`) est parvenu à sa fin, aucune vision n'attendant plus (`part_du_fondu`).
signal fondu_fini
## Ce que le regard retire a changé : le masque du retrait (`retirer`) ou les nappes de toit cachées (`cacher`).
signal retire
## Les nouvelles empreintes des morceaux rétablis par `retablir_le_decor`, par clé, pour les formes du rayon.
signal empreintes_retablies(empreintes: Dictionary)
## Chaque modèle d'arête en lecture lu (`_lire_le_modele_d_arete`), ses arêtes posées (`aretes_en_lecture`).
signal aretes_posees
## Plus aucun modèle d'arête en lecture : chacun lu, ou sa lecture périmée à la sortie de l'arbre
## (`attendre_les_aretes`).
signal _lectures_closes
## Le repli en cours a fini de préparer et de poser sa réponse.
signal _secours_libre

## La couche de rendu de l'ombre des luminaires (`_morceau`), la deuxième (`VisualInstance3D.layers`), que la lampe d'un
## foyer exclut de son ombre (`Foyer`).
const COUCHE_DES_LUMINAIRES := 2
## La couche de rendu de tout ce qui n'est pas un luminaire, la première.
const COUCHE_DU_MONDE := 1
## Netteté de la projection d'une texture de matière sur les trois axes (`texturer`, `_matiere`).
const NETTETE_DU_MOTIF := 4.0
## La durée, en secondes, du fondu d'une vision posée à la suivante (`voir`).
const DUREE_DU_FONDU_S := 0.3
## Le voile de la vision sur un navire (`voile`), et le sol, dans sa texture (`_batir_les_sols`), d'une couche d'une
## colonne qui n'y a pas de case.
const VOILE := preload("res://art/voile.gdshader")
const SANS_CASE := INF

## Les sortes de ce que le volume pose sur les arêtes, par catalogue des modèles servis (`MontageDeComposition.modeles`) :
## les arêtes (`aretes`, méthode `aretes`), étirées à la hauteur de leur mur, en boîte sans modèle lu qui ait leur pièce ;
## les côtés de marches (`escaliers`, `cotesDeMarches` de la méthode `aretes`), à la hauteur de leur modèle, rien sans
## modèle lu qui ait leur pièce.
const SORTES := {
	aretes = {etiree = true, repli = true},
	escaliers = {etiree = false, repli = false},
}

## Ce qui se pose sur une arête sans modèle d'arête lu qui ait sa pièce : un mur, une porte fermée, le seuil d'une
## porte ouverte ou d'une brèche.
@export var mesh_mur: BoxMesh
@export var mesh_porte: BoxMesh
@export var mesh_seuil: BoxMesh
## La matière standard de l'instance en ombre seule de chaque morceau et de chaque nappe, jamais masquée : la couleur
## de ses sommets. Une matière qui ne déplace pas ses sommets porte l'ombre que Godot dessine pour toutes
## (`drivers/gles3/rasterizer_scene_gles3.cpp:283` à 4.7).
@export var couleur_des_sommets: StandardMaterial3D
## Les modèles de la matière d'une surface de l'instance vue d'un morceau ou d'une nappe, du shader de monde, sans
## texture puis texturée (`texturer`), que la vision lie (`voir`), et le masque celle d'un morceau (`retirer`).
@export var couleur_des_sommets_masquee: ShaderMaterial
@export var matiere_texturee_masquee: ShaderMaterial

@onready var _volume: Node3D = $Volume
@onready var _morceaux: Node3D = $Volume/Morceaux
@onready var _toits: Node3D = $Volume/Toits
@onready var _couronnes: Node3D = $Volume/Couronnes
@onready var _aretes: Node3D = $Aretes

## Les mètres d'une case du dernier volume posé.
var metres_par_case := 1.0
## Par id de navire, le contour de sa coque à sa flottaison dans le plan du volume (`border_la_mer`).
var _coques := {}
## Les ids des types de décor dont le modèle montre les surfaces, chacun à `true` (`peindre_sans`).
var _decors_montres := {}
## La source et la révision du volume posé dont le pont peut rendre les recettes de décor.
var _secours_des_decors := {}
var _secours_en_cours := false
## Par nom de matière, une référence faible à la matière des morceaux ou des nappes et couronnes qui la portent.
## Le retrait lie les matières des morceaux (`retirer`) et écarte chaque nappe par nœud (`cacher`).
var _matieres_masquees := {}
var _matieres_des_nappes := {}
## L'indice de chaque couche du volume posé (`poser`, dans l'ordre de `hauteurs`), par son `z`, et les rangées d'une
## couche, en cases.
var _couches := {}
var _rangees_d_une_couche := 0
## Le masque posé (`retirer`), en image et en texture, `null` sans retrait.
var _masque: Image = null
var _retrait: ImageTexture = null
## La vision posée (`voir`) en image, `null` sans vision, et celle d'où son fondu part ; ses textures, celle d'où le
## fondu part et celle où il va, et ce qui se lie avec elles au shader de monde : la part du fondu et les teintes
## (inconnue, explorée, vue) ; la dernière vision reçue pendant un fondu, qui attend sa fin, `null` sinon.
var _vision: Image = null
var _vision_d_avant: Image = null
var _vision_avant: ImageTexture = null
var _vision_neuve: ImageTexture = null
var _part_du_fondu := 1.0
var _teintes := Vector3.ONE
## Les rangées d'un plan de la vision posée (`rangeesParPlan`), un plan par couche : la hauteur `h`, en cases.
var _rangees_par_plan := 1
var _vision_en_attente: Variant = null
## Le sol de chaque case du volume posé (`_batir_les_sols`), et, par clé de modèle posé, la matière de son voile (`voile`),
## liée à la vision comme les nappes.
var _sols: ImageTexture = null
var _voiles := {}
## Les matières de la lumière que la vision voile (`lier_a_la_vision` : la brume de la vision, le sol du hors-carte),
## liées à la vision et aux sols comme un voile.
var _liees: Array[ShaderMaterial] = []
## Les groupes d'arêtes à teindre à la prochaine image dessinée (`_teindre_le_pose`), chacun en clé, et ceux que chaque
## pas du fondu reteint (`avancer_le_fondu`) : ceux dont une case change d'état d'une vision à l'autre
## (`_change_d_etat`), tous quand la vision se pose sans fondu (`_mesurer_le_fondu`).
var _a_teindre := {}
var _du_fondu := {}
## Le chargeur des modèles servis, celui des décors (`MontageDesModeles`) : d'où se lit le modèle d'arête ou d'escalier
## de chaque famille servie (`modele_servi`, `MontageDeComposition.scene_du_modele`).
var chargeur: MontageDeComposition
## Par id d'élément `arete` lu, sa scène hors de l'arbre et la taille de sa boîte en mètres (`_taille_du_modele`) ;
## ceux en lecture, chacun à son jeton (`_lire_le_modele_d_arete`, jetés à la sortie de l'arbre) ; ceux dont la
## lecture a échoué, dite une fois ; et les poses reçues au dernier `poser_les_aretes` (`_poses_de`), reposées à chaque
## modèle lu.
var _modeles_d_arete := {}
var _en_lecture := {}
var _illisibles := {}
var _poses_recues: Array = []
## Par pièce d'un modèle d'arête, palette et étirement, `<id>|<pièce>|<palette>|<étirement>`, la pièce peinte hors
## de l'arbre (`piece_peinte`).
var _pieces_peintes := {}
## Les clés des arêtes cachées à la caméra (`cacher`), indexées (`aretes`, chaque clé à `true`), et celles des nappes
## de toit et des couronnes cachées, en tableaux (`toits`, `couronnes`).
var _cachees := {aretes = {}, toits = [], couronnes = []}
## Les clés des couronnes retirées (`retirer_les_couronnes`).
var _retirees: Array = []
## Par maillage d'une pièce d'un modèle d'arête ou d'une boîte, sa copie que voient les instances vues de ses
## arêtes, et par matière, sa copie qui prend pour albédo la couleur de l'instance (`_maillage_teint`) ; oubliés avec
## les modèles d'arête (`_oublier_les_modeles_d_arete`).
var _maillages_teints := {}
var _matieres_teintes := {}


func _ready() -> void:
	RenderingServer.frame_pre_draw.connect(_teindre_le_pose)


## Juste avant que l'image se dessine (`frame_pre_draw`), chaque groupe d'arêtes posé que `_a_teindre` nomme teint
## (`_teindre`) sur ce qui est posé à cet instant : le monde, la vision et les arêtes d'une même scène, quel que soit
## l'ordre où l'appelant les a posés (`combat.gd`, `_suivre`).
func _teindre_le_pose() -> void:
	for groupe: Node3D in _aretes.get_children():
		if _a_teindre.has(groupe):
			_teindre(groupe)
	_a_teindre.clear()


## Sorti de l'arbre : chaque lecture de modèle d'arête en vol est périmée (`_lire_le_modele_d_arete`), et qui attend
## les arêtes (`attendre_les_aretes`) rendu par `_lectures_closes`, sans rien signaler à qui écoute `aretes_posees`.
func _exit_tree() -> void:
	if aretes_en_lecture():
		_en_lecture.clear()
		_lectures_closes.emit()


func _notification(quoi: int) -> void:
	if quoi != NOTIFICATION_PREDELETE:
		return
	_oublier_les_modeles_d_arete()


## Les clés du manifeste `monde` (`CONTRAT.md`, méthode `monde` : `{ monde, toits, couronnes }`) dont l'empreinte posée
## diffère ou manque : `{ volume, toits, couronnes }`, l'entrée de la méthode `morceaux` sans sa `source`.
func manquants(monde: Dictionary) -> Dictionary:
	return {
		volume = _manquants_sous(_morceaux, monde.monde.morceaux),
		toits = _manquants_sous(_toits, monde.toits),
		couronnes = _manquants_sous(_couronnes, monde.couronnes),
	}


## Les matières des géométries reçues que leurs maillages peuvent employer, y compris après remaillage d'un décor.
static func matieres_des_morceaux(recus: Dictionary) -> Dictionary:
	var matieres := {}
	for famille in ["volume", "toits", "couronnes"]:
		for geometrie: Dictionary in recus.get(famille, []):
			_relever_les_matieres(geometrie, matieres)
	return matieres


static func _relever_les_matieres(geometrie: Dictionary, matieres: Dictionary) -> void:
	for surface: Dictionary in geometrie.surfaces:
		if not surface.get("priseSeulement", false) and not surface.has("navire"):
			matieres[surface.matiere] = false


## Le volume du manifeste `monde` (`{ monde, toits, couronnes }`) à l'échelle d'une unité par case, sa case (0, 0) sur
## la case (0, 0) du plateau, ses morceaux, ses nappes de toit et ses couronnes réconciliés par clé (`reconcilier`) : un
## posé dont l'empreinte n'a pas bougé reste, un reçu (`recus`, la réponse de `morceaux` : `{ volume, toits, couronnes }`)
## se pose à la place, une clé partie du manifeste quitte l'arbre. Chaque morceau (`_morceau`) et chaque nappe
## (`_nappe`) cachés si `cacher` les nomme, chaque couronne retirée si `retirer_les_couronnes` la nomme ; la vision posée
## (`voir`) liée à l'échelle du volume.
func poser(monde: Dictionary, recus: Dictionary) -> void:
	_secours_des_decors = monde.monde.get("secoursDecors", {})
	metres_par_case = monde.monde.metresParCase
	_couches = {}
	for indice in monde.monde.hauteurs.size():
		_couches[int(monde.monde.hauteurs[indice].z)] = indice
		_rangees_d_une_couche = monde.monde.hauteurs[indice].rangees.size()
	var echelle := MiseEnPage.echelle_metrique(monde.monde.metresParCase)
	_volume.scale = Vector3(echelle, echelle, echelle)
	_volume.position = MiseEnPage.centre_de_case(Vector2i.ZERO, 0.0)
	reconcilier(_morceaux, monde.monde.morceaux, par_cle(recus.volume), _morceau)
	reconcilier(_toits, monde.toits, par_cle(recus.toits), _nappe)
	reconcilier(_couronnes, monde.couronnes, par_cle(recus.couronnes), _nappe)
	_batir_les_sols(monde.monde.hauteurs)
	_lier_la_vision()
	_montrer_le_pose()


## Le masque du retrait (`retrait`, `CONTRAT.md`, section « Monde », `RetraitDuMonde` : `{ masque, largeur, rangees }`)
## en texture d'un octet par case, liée à chaque matière des morceaux : le shader de monde y replie chaque sommet d'une
## case retirée ; `null`, rien n'est retiré. Ni nœud ni maillage ne change.
func retirer(retrait: Variant) -> void:
	_masque = null if retrait == null else Image.create_from_data(int(retrait.largeur), int(retrait.rangees), false, Image.FORMAT_R8, Marshalls.base64_to_raw(retrait.masque))
	_retrait = null if _masque == null else ImageTexture.create_from_image(_masque)
	for matiere in _matieres_vivantes(_matieres_masquees):
		matiere.set_shader_parameter("retrait", _retrait)
	retire.emit()


## Si le masque posé (`retirer`) retire la case `case` du plan de première rangée `rangee` (`MorceauDuMonde.rangee`).
func retiree(case: Vector2i, rangee: int) -> bool:
	return _masque != null and _masque.get_pixelv(MiseEnPage.texel_du_masque(case, rangee)).r8 != 0


## Si le regard retire la pose d'un décor `pose` (`PoseDeDecor` : `case`, `nappe`) : portée par une nappe de toit,
## quand elle est cachée (`cacher`), comme ses triangles, que le masque ne lie jamais ; sinon, quand le masque posé
## (`retirer`) retire sa case (sa couche en `z`) du plan `pose` de sa couche (`MiseEnPage.rangee_de_pose`), celui où
## se rangent les faces d'un décor. Une case hors du monde posé (`poser`), celle d'une pose du monde précédent que
## `MontageDesModeles` tient jusqu'à son `poser`, ne l'est pas.
func pose_retiree(pose: Dictionary) -> bool:
	if pose.has("nappe"):
		return _cachees.toits.has(pose.nappe)
	var case := Vector3i(int(pose.case.x), int(pose.case.y), int(pose.case.z))
	if _masque == null or not _couches.has(case.z):
		return false
	var texel := MiseEnPage.texel_du_masque(Vector2i(case.x, case.y), int(MiseEnPage.rangee_de_pose(_couches[case.z], _rangees_d_une_couche)))
	return Rect2i(Vector2i.ZERO, _masque.get_size()).has_point(texel) and _masque.get_pixelv(texel).r8 != 0


## La vision du groupe (`vision`, `CONTRAT.md`, section « Monde », `VisionDuMonde` : `{ masque, largeur, rangees,
## rangeesParPlan, teintes }`) en texture d'un octet par case, liée à chaque matière des morceaux avec ses teintes et
## les rangées d'un plan : le shader de monde en voile chaque fragment ; `null`, rien n'est voilé. La première vision,
## ou une vision d'une autre taille, se pose sans fondu ; une autre se fond depuis celle d'avant en `DUREE_DU_FONDU_S`
## (`avancer_le_fondu`), et une vision reçue pendant un fondu attend sa fin, à la place de celle qui attendait. Ni nœud
## ni maillage ne change ; la vision se lie aussi aux nappes (`_lier_la_vision`) et teint les instances vues des
## groupes d'arêtes du fondu (`_mesurer_le_fondu`) à la prochaine image dessinée (`_teindre_le_pose`).
func voir(vision: Variant) -> void:
	if vision == null:
		_vision = null
		_vision_d_avant = null
		_vision_avant = null
		_vision_neuve = null
		_part_du_fondu = 1.0
		_teintes = Vector3.ONE
		_vision_en_attente = null
		_lier_la_vision()
		_mesurer_le_fondu()
		return
	if _part_du_fondu != 1.0:
		_vision_en_attente = vision
		return
	var image := Image.create_from_data(int(vision.largeur), int(vision.rangees), false, Image.FORMAT_R8, Marshalls.base64_to_raw(vision.masque))
	var neuve := ImageTexture.create_from_image(image)
	var fondue := _vision != null and _vision.get_size() == image.get_size()
	_vision_d_avant = _vision if fondue else image
	_vision_avant = _vision_neuve if fondue else neuve
	_part_du_fondu = 0.0 if fondue else 1.0
	_vision = image
	_vision_neuve = neuve
	_teintes = Vector3(vision.teintes.unknown, vision.teintes.explored, vision.teintes.visible)
	_rangees_par_plan = int(vision.rangeesParPlan)
	_lier_la_vision()
	_mesurer_le_fondu()


## L'octet (0 inconnue, 128 explorée, 255 vue) de la case `case` de la couche d'indice `couche` dans la vision posée
## (`voir`).
func etat_de_la_case(case: Vector2i, couche: int) -> int:
	return _vision.get_pixelv(MiseEnPage.texel_de_vision(case, couche, _rangees_par_plan)).r8


## La part, de 0 à 1, du fondu de la vision d'avant à la vision posée (`voir`) : 1, aucun fondu en cours.
func part_du_fondu() -> float:
	return _part_du_fondu


## La vision reçue pendant un fondu, qui attend sa fin (`voir`), `null` sinon.
func vision_en_attente() -> Variant:
	return _vision_en_attente


func _process(secondes: float) -> void:
	avancer_le_fondu(secondes)


## Le fondu de la vision (`voir`) avancé de `secondes` secondes, que `_process` avance à chaque image, sur les matières
## du shader de monde et, à la prochaine image dessinée, sur les instances vues des arêtes (`_teindre_le_pose`) ;
## parvenu à sa fin, la vision qui attend se pose, sinon il se dit fini (`fondu_fini`).
func avancer_le_fondu(secondes: float) -> void:
	if _part_du_fondu == 1.0:
		return
	_part_du_fondu = MiseEnPage.part_du_fondu(_part_du_fondu, secondes, DUREE_DU_FONDU_S)
	for matiere in _matieres_de_la_vision():
		matiere.set_shader_parameter("vision_fondu", _part_du_fondu)
	_a_teindre.merge(_du_fondu)
	if _part_du_fondu != 1.0:
		return
	if _vision_en_attente == null:
		fondu_fini.emit()
		return
	var attendue: Variant = _vision_en_attente
	_vision_en_attente = null
	voir(attendue)


## La vision posée (`voir`) liée à chaque matière qui la lit (`_matieres_de_la_vision`, `_lier_la_vision_a`).
func _lier_la_vision() -> void:
	for matiere in _matieres_de_la_vision():
		_lier_la_vision_a(matiere)


## Les matières qui lisent la vision : celles des morceaux, des nappes, des voiles des navires et de la lumière
## (`lier_a_la_vision`).
func _matieres_de_la_vision() -> Array[ShaderMaterial]:
	var matieres: Array[ShaderMaterial] = []
	matieres.append_array(_matieres_vivantes(_matieres_masquees))
	matieres.append_array(_matieres_vivantes(_matieres_des_nappes))
	matieres.append_array(_voiles.values())
	matieres.append_array(_liees)
	return matieres


static func _matieres_vivantes(references: Dictionary) -> Array[ShaderMaterial]:
	var matieres: Array[ShaderMaterial] = []
	for nom: String in references.keys():
		var matiere := (references[nom] as WeakRef).get_ref() as ShaderMaterial
		if matiere == null:
			references.erase(nom)
		else:
			matieres.append(matiere)
	return matieres


## Les groupes d'arêtes du fondu de la vision posée (`voir`, `_du_fondu`), à teindre à la prochaine image dessinée
## (`_teindre_le_pose`) : tous sans fondu, ceux dont une case change d'état (`_change_d_etat`) sinon.
func _mesurer_le_fondu() -> void:
	_du_fondu = {}
	for groupe: Node3D in _aretes.get_children():
		if _part_du_fondu == 1.0 or _change_d_etat(groupe):
			_du_fondu[groupe] = true
	_a_teindre.merge(_du_fondu)


## Si une case d'une arête du groupe `groupe` (méta `aretes`) change d'état de la vision d'où le fondu part à la posée
## (`voir`).
func _change_d_etat(groupe: Node3D) -> bool:
	return groupe.get_meta("aretes").any(func(a: Dictionary) -> bool: return a.cases.any(func(c: Dictionary) -> bool:
		var texel := _texel_de_vision(c)
		return _vision_d_avant.get_pixelv(texel).r8 != _vision.get_pixelv(texel).r8))


## Le texel de la case `c` (`{ x, y, z }`) dans la vision posée (`voir`), au plan de sa couche.
func _texel_de_vision(c: Dictionary) -> Vector2i:
	return MiseEnPage.texel_de_vision(Vector2i(int(c.x), int(c.y)), _couches[int(c.z)], _rangees_par_plan)


## La vision posée (`voir`) liée à la matière `matiere` du shader de monde, à l'échelle du volume posé (`poser`).
func _lier_la_vision_a(matiere: ShaderMaterial) -> void:
	matiere.set_shader_parameter("vision_avant", _vision_avant)
	matiere.set_shader_parameter("vision", _vision_neuve)
	matiere.set_shader_parameter("vision_fondu", _part_du_fondu)
	matiere.set_shader_parameter("vision_teintes", _teintes)
	matiere.set_shader_parameter("vision_rangees_par_plan", _rangees_par_plan)
	matiere.set_shader_parameter("vision_cases_par_metre", MiseEnPage.echelle_metrique(metres_par_case))


## La matière du voile de la vision du modèle posé sous la clé `cle` (`MontageDesModeles`, `art/voile.gdshader`), liée
## à la vision posée (`voir`) et au sol de chaque case du volume posé (`_batir_les_sols`), la même tant que
## `oublier_le_voile` ne l'a pas oubliée.
func voile(cle: String) -> ShaderMaterial:
	if not _voiles.has(cle):
		var matiere := ShaderMaterial.new()
		matiere.shader = VOILE
		matiere.set_shader_parameter("sols", _sols)
		_lier_la_vision_a(matiere)
		_voiles[cle] = matiere
	return _voiles[cle]


## La matière `matiere` de la lumière (la brume de la vision, `Lumiere.brume`, `art/brume-de-la-vision.gdshader` ; le sol
## du hors-carte, `Lumiere.sol_hors_carte`, `art/hors-carte.gdshader`) liée, comme un voile, à la vision posée (`voir`)
## et au sol de chaque case du volume posé (`_batir_les_sols`), son fondu compris.
func lier_a_la_vision(matiere: ShaderMaterial) -> void:
	_liees.append(matiere)
	matiere.set_shader_parameter("sols", _sols)
	_lier_la_vision_a(matiere)


## Le voile du modèle posé sous la clé `cle` (`voile`) oublié.
func oublier_le_voile(cle: String) -> void:
	_voiles.erase(cle)


## Le sol de chaque case de chaque couche du volume posé, de hauteurs `hauteurs` (`VolumeDuMonde.hauteurs`, en mètres),
## en texture d'un flottant par case au rangement de la vision (`MiseEnPage.texel_de_vision`), en unités de plateau :
## une case est une case d'un triangle d'un morceau posé (méta `cases`), `SANS_CASE` ailleurs ; liée aux voiles.
func _batir_les_sols(hauteurs: Array) -> void:
	var taille := MiseEnPage.taille_du_masque(hauteurs[0].rangees[0].size(), hauteurs.size(), _rangees_d_une_couche)
	var image := Image.create_empty(taille.x, taille.y, false, Image.FORMAT_RF)
	image.fill(Color(SANS_CASE, 0.0, 0.0))
	for morceau: Node3D in _morceaux.get_children():
		for c: Vector3i in morceau.get_meta("cases"):
			var couche: int = _couches[c.z]
			image.set_pixelv(MiseEnPage.texel_de_vision(Vector2i(c.x, c.y), couche, _rangees_d_une_couche), Color(MiseEnPage.hauteur_au_plateau(hauteurs[couche].rangees[c.y][c.x], metres_par_case), 0.0, 0.0))
	_sols = ImageTexture.create_from_image(image)
	for matiere: ShaderMaterial in _voiles.values():
		matiere.set_shader_parameter("sols", _sols)
	for matiere in _liees:
		matiere.set_shader_parameter("sols", _sols)


## Rien de posé : ni morceau, ni nappe, ni arête ; les modèles d'arête lus, leurs pièces peintes et leurs échecs
## oubliés (`_oublier_les_modeles_d_arete`), relus à la prochaine pose.
func vider() -> void:
	_secours_des_decors = {}
	oublier_les_aretes()
	for parent: Node3D in [_morceaux, _toits, _couronnes]:
		reconcilier(parent, [], {}, Callable())
	_matieres_masquees.clear()
	_matieres_des_nappes.clear()


## Les arêtes de la scène quittée et les ressources de ses pièces, dont les lectures encore en vol.
func oublier_les_aretes() -> void:
	var lectures_en_cours := aretes_en_lecture()
	_en_lecture.clear()
	_poses_recues = []
	reconcilier(_aretes, [], {}, Callable())
	_a_teindre.clear()
	_du_fondu.clear()
	_oublier_les_modeles_d_arete()
	if lectures_en_cours:
		_lectures_closes.emit()


## Les surfaces des décors `decors` (ids de `props.json`, `decor` d'une surface, `CONTRAT.md`, section « Monde ») ni
## vues ni en ombre, leur modèle les montrant (`decors` de la vue, `MontageDesModeles`), à la place de celles d'avant :
## chaque morceau et chaque nappe de toit posés qui portent un décor entré ou sorti se remaillent, et chacun à poser
## les laisse.
func peindre_sans(decors: Array) -> void:
	var montres := {}
	for decor: String in decors:
		montres[decor] = true
	if montres == _decors_montres:
		return
	var changes := {}
	for parmi: Dictionary in [montres, _decors_montres]:
		for decor: String in parmi:
			if montres.has(decor) != _decors_montres.has(decor):
				changes[decor] = true
	_decors_montres = montres
	for parent: Node3D in [_morceaux, _toits]:
		for noeud: Node3D in parent.get_children():
			if noeud.get_meta("decors").any(func(decor: String) -> bool: return changes.has(decor)):
				(_mailler if parent == _morceaux else _mailler_la_nappe).call(noeud, noeud.get_meta("geometrie"))


## Le décor `decor` dont le modèle est illisible, peint par ses recettes, dans le volume intégral ou par
## `retablirDecors` sur le manifeste posé. Seuls ses morceaux et nappes changés sont remaillés. Les empreintes
## des morceaux sont signalées à `Monde` pour les formes du rayon, dont les triangles gardent leur ordre et leur case.
func retablir_le_decor(decor: String) -> bool:
	if not _decors_montres.has(decor):
		return false
	if _secours_des_decors.is_empty():
		for parent: Node3D in [_morceaux, _toits]:
			for noeud: Node3D in parent.get_children():
				if noeud.get_meta("decors").has(decor):
					var montres := _decors_montres.keys()
					montres.erase(decor)
					peindre_sans(montres)
					return true
		return false
	var secours := _secours_des_decors
	while _secours_en_cours:
		await _secours_libre
	if not is_inside_tree() or secours != _secours_des_decors or not _decors_montres.has(decor):
		return false
	_secours_en_cours = true
	var retabli := await _preparer_le_repli(decor, secours)
	_secours_en_cours = false
	_secours_libre.emit()
	return retabli


## La préparation et la pose d'une même réponse de secours précèdent la demande suivante sur le pont.
func _preparer_le_repli(decor: String, secours: Dictionary) -> bool:
	var pont := get_node("/root/Pont") as PontDuNoyau
	var recus := pont.appeler("retablirDecors", secours.merged({prop = decor}))
	if recus.get("ok") != true:
		return false
	var textures := await TexturesDeMatiere.preparer(self, matieres_des_morceaux(recus))
	if not is_inside_tree() or secours != _secours_des_decors:
		return false
	_poser_le_repli(decor, recus)
	textures.clear()
	return true


func _poser_le_repli(decor: String, recus: Dictionary) -> void:
	_decors_montres.erase(decor)
	_retablir_sous(_morceaux, recus.volume)
	_retablir_sous(_toits, recus.toits)
	_cacher_sous(_toits, _cachees.toits)
	var empreintes := {}
	for morceau: Dictionary in recus.volume:
		empreintes[morceau.cle] = morceau.empreinte
	if not empreintes.is_empty():
		empreintes_retablies.emit(empreintes)


func _retablir_sous(parent: Node3D, recus: Array) -> void:
	if recus.is_empty():
		return
	var noeuds := {}
	for noeud: Node3D in parent.get_children():
		noeuds[noeud.get_meta("cle")] = noeud
	for geometrie: Dictionary in recus:
		var noeud: Node3D = noeuds.get(geometrie.cle)
		if parent == _morceaux:
			_poser_le_morceau(noeud, geometrie)
		elif noeud == null:
			noeud = _nappe(geometrie)
			noeud.name = geometrie.cle
			noeud.set_meta("cle", geometrie.cle)
			parent.add_child(noeud)
		else:
			_poser_la_nappe(noeud, geometrie)
		noeud.set_meta("empreinte", geometrie.empreinte)


## La mer du navire `navire` (les surfaces `flottaison` du volume, `CONTRAT.md`, section « Monde ») bordée par sa coque,
## de contour `contour` dans le plan horizontal du repère global (`MontageDeVehicule.contour_sous`) : chaque morceau
## posé qui la porte se remaille, peint hors d'elle seulement.
func border_la_mer(navire: String, contour: PackedVector2Array) -> void:
	var dans_le_volume := PackedVector2Array()
	for point in contour:
		var local := _volume.to_local(Vector3(point.x, 0.0, point.y))
		dans_le_volume.append(Vector2(local.x, local.z))
	_coques[navire] = dans_le_volume
	for morceau: Node3D in _morceaux.get_children():
		if morceau.get_meta("flottaisons").has(navire):
			_mailler(morceau, morceau.get_meta("geometrie"))


## Les enfants de `parent`, un par entrée de `voulus` (chacune `{ cle, empreinte }`), réconciliés par clé : un enfant
## dont l'empreinte est celle voulue reste (même instance) ; sinon il quitte l'arbre, et le contenu reçu sous sa clé
## (`recus`) s'y pose, bâti par `batir` (`null` : rien à poser), nommé par sa clé ; un enfant dont la clé n'est plus
## voulue quitte l'arbre.
static func reconcilier(parent: Node, voulus: Array, recus: Dictionary, batir: Callable) -> void:
	var poses := {}
	for enfant in parent.get_children():
		poses[enfant.get_meta("cle")] = enfant
	for voulu: Dictionary in voulus:
		var pose: Node = poses.get(voulu.cle)
		poses.erase(voulu.cle)
		if pose != null and pose.get_meta("empreinte") == voulu.empreinte:
			continue
		if pose != null:
			parent.remove_child(pose)
			pose.free()
		if not recus.has(voulu.cle):
			continue
		var neuf: Node = batir.call(recus[voulu.cle])
		if neuf == null:
			continue
		neuf.name = voulu.cle
		neuf.set_meta("cle", voulu.cle)
		neuf.set_meta("empreinte", voulu.empreinte)
		parent.add_child(neuf)
	for parti: Node in poses.values():
		parent.remove_child(parti)
		parti.free()


## Chacun de `contenus` (chacun sa `cle`) par sa clé.
static func par_cle(contenus: Array) -> Dictionary:
	var par := {}
	for contenu: Dictionary in contenus:
		par[contenu.cle] = contenu
	return par


## Les clés de `voulus` (chacune `{ cle, empreinte }`) dont aucun enfant de `parent` ne porte l'empreinte.
static func _manquants_sous(parent: Node, voulus: Array) -> Array:
	var posees := {}
	for enfant in parent.get_children():
		posees[enfant.get_meta("cle")] = enfant.get_meta("empreinte")
	return voulus.filter(func(voulu: Dictionary) -> bool: return posees.get(voulu.cle) != voulu.empreinte).map(func(voulu: Dictionary) -> String: return voulu.cle)


## Le nœud du morceau `morceau` (`MorceauDuMonde`, `_vu_et_ombre`) maillé (`_mailler`) ; s'il porte un luminaire
## (surfaces `luminaire`, #3811), `Ombre` sans ses surfaces et `OmbreDesLuminaires`, en ombre seule sur
## `COUCHE_DES_LUMINAIRES`, avec elles seules ; les navires dont il porte la mer (`flottaison`) et les décors dont il
## porte des surfaces (`decor`), et sa géométrie s'il porte l'un ou l'autre, que `border_la_mer` et `peindre_sans`
## remaillent.
func _morceau(morceau: Dictionary) -> Node3D:
	var noeud := _vu_et_ombre()
	var cases := {}
	for c in PackedFloat32Array(morceau.cases).to_byte_array().to_vector3_array():
		cases[Vector3i(c)] = true
	noeud.set_meta("cases", cases.keys())
	_poser_le_morceau(noeud, morceau)
	return noeud


func _poser_le_morceau(noeud: Node3D, morceau: Dictionary) -> void:
	if not noeud.has_node("OmbreDesLuminaires") and morceau.surfaces.any(_est_d_un_luminaire):
		var des_luminaires := _en_ombre_seule("OmbreDesLuminaires")
		des_luminaires.layers = COUCHE_DES_LUMINAIRES
		noeud.add_child(des_luminaires)
	var flottaisons: Array = morceau.surfaces.filter(func(surface: Dictionary) -> bool: return surface.has("flottaison")).map(func(surface: Dictionary) -> String: return surface.flottaison)
	noeud.set_meta("flottaisons", flottaisons)
	var decors := _decors_de(morceau)
	noeud.set_meta("decors", decors)
	if not flottaisons.is_empty() or not decors.is_empty():
		noeud.set_meta("geometrie", morceau)
		_retenir_les_textures_du_remaillage(noeud, morceau)
	else:
		noeud.remove_meta("geometrie")
		noeud.remove_meta("textures_du_remaillage")
	_mailler(noeud, morceau)


## Les ids des décors dont la géométrie `geometrie` porte des surfaces à peindre (`decor`).
static func _decors_de(geometrie: Dictionary) -> Array:
	var decors := {}
	for surface: Dictionary in geometrie.surfaces:
		if surface.has("decor") and not surface.get("priseSeulement", false):
			decors[surface.decor] = true
	return decors.keys()


## Un nœud à deux instances d'un même maillage : `Vu`, que la caméra voit sans qu'il porte d'ombre, et `Ombre`, en ombre
## seule (`SHADOWS_ONLY`, #3758) dans la matière standard `couleur_des_sommets`.
func _vu_et_ombre() -> Node3D:
	var noeud := Node3D.new()
	var vu := MeshInstance3D.new()
	vu.name = "Vu"
	vu.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	noeud.add_child(vu)
	noeud.add_child(_en_ombre_seule("Ombre"))
	return noeud


## Une instance en ombre seule (`SHADOWS_ONLY`, #3758) nommée `nom`, dans la matière standard `couleur_des_sommets`.
func _en_ombre_seule(nom: String) -> MeshInstance3D:
	var ombre := MeshInstance3D.new()
	ombre.name = nom
	ombre.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	ombre.material_override = couleur_des_sommets
	return ombre


## Si `surface` est d'un décor qui éclaire (`luminaire`, `CONTRAT.md`, section « Monde »).
static func _est_d_un_luminaire(surface: Dictionary) -> bool:
	return surface.has("luminaire") and not surface.get("priseSeulement", false)


## Le maillage de la géométrie `morceau` (`_maillage_de`, chaque case sur la `rangee` du morceau, dans les matières que
## le masque lie) posé sur les instances du nœud `noeud` : entier sur `Vu` ; sur `Ombre` aussi, ou, si le morceau porte
## un luminaire, sans ses surfaces, qui vont à `OmbreDesLuminaires`.
func _mailler(noeud: Node3D, morceau: Dictionary) -> void:
	var texel_de := func(c: Vector3) -> Vector2i: return MiseEnPage.texel_du_masque(Vector2i(int(c.x), int(c.y)), int(morceau.rangee))
	var maillage := _maillage_de(morceau, texel_de, true)
	(noeud.get_node("Vu") as MeshInstance3D).mesh = maillage
	var des_luminaires: MeshInstance3D = noeud.get_node_or_null("OmbreDesLuminaires")
	if des_luminaires == null:
		(noeud.get_node("Ombre") as MeshInstance3D).mesh = maillage
		return
	(noeud.get_node("Ombre") as MeshInstance3D).mesh = _maillage_de(morceau, texel_de, true, func(surface: Dictionary) -> bool: return not _est_d_un_luminaire(surface))
	des_luminaires.mesh = _maillage_de(morceau, texel_de, true, _est_d_un_luminaire)


## Le nœud d'une nappe de toit ou d'une couronne (`NappeDuMonde`, `_vu_et_ombre`) maillé (`_mailler_la_nappe`), voilé
## par la vision, vu tant que `cacher` ne la nomme pas, son ombre toujours portée ; les décors dont elle porte des
## surfaces (`decor`, ornements du bâti qu'une nappe porte), et sa géométrie, que `peindre_sans` remaille.
func _nappe(nappe: Dictionary) -> Node3D:
	var noeud := _vu_et_ombre()
	_poser_la_nappe(noeud, nappe)
	return noeud


func _poser_la_nappe(noeud: Node3D, nappe: Dictionary) -> void:
	var decors := _decors_de(nappe)
	noeud.set_meta("decors", decors)
	if not decors.is_empty():
		noeud.set_meta("geometrie", nappe)
		_retenir_les_textures_du_remaillage(noeud, nappe)
	else:
		noeud.remove_meta("geometrie")
		noeud.remove_meta("textures_du_remaillage")
	_mailler_la_nappe(noeud, nappe)


## Les textures déjà préparées des surfaces qu'un remaillage de ce nœud peut faire revenir.
static func _retenir_les_textures_du_remaillage(noeud: Node3D, geometrie: Dictionary) -> void:
	var matieres := {}
	_relever_les_matieres(geometrie, matieres)
	var textures: Array[Texture2D] = []
	for nom: String in matieres:
		for chemin: String in [texture_de(nom), relief_de(nom)]:
			var texture := TexturesDeMatiere.retenue(chemin)
			if texture != null:
				textures.append(texture)
	noeud.set_meta("textures_du_remaillage", textures)


## Le maillage de la nappe `nappe` (`_maillage_de`, chaque case au plan `sol` de sa couche, `MiseEnPage.texel_de_nappe`,
## dans des matières que le masque ne lie jamais) posé sur les deux instances du nœud `noeud`.
func _mailler_la_nappe(noeud: Node3D, nappe: Dictionary) -> void:
	var maillage := _maillage_de(nappe, func(c: Vector3) -> Vector2i: return MiseEnPage.texel_de_nappe(Vector2i(int(c.x), int(c.y)), _couches[int(c.z)], _rangees_d_une_couche), false)
	(noeud.get_node("Vu") as MeshInstance3D).mesh = maillage
	(noeud.get_node("Ombre") as MeshInstance3D).mesh = maillage


## Les arêtes `aretes` et les côtés de marches `cotes` (`CONTRAT.md`, méthode `aretes`), chacun sur le côté de sa
## case, debout à son pied (`_poses_de`), en groupes d'instances : les poses de même catalogue, `bloc`, `famille`,
## `piece`, `position`, `sens`, `hauteurM` et `palette`, dans l'ordre reçu, une instance chacune de chaque maillage de
## leur pièce (`_groupe`) ; cachées si `cacher` les nomme. Les groupes sont réconciliés par clé (`reconcilier`) : un
## groupe dont les poses n'ont pas changé à la même échelle reste, un groupe changé (une porte ouverte quitte un groupe
## et en rejoint un autre) est refait, un groupe parti quitte l'arbre. Une pose dont la famille a un modèle servi
## (`modele_servi`) ne se pose qu'une fois ce modèle lu : il se lit une fois les autres posées
## (`_lire_le_modele_d_arete`), et les poses reçues se reposent à sa lecture ; celle d'un modèle illisible se pose en
## boîte, sans relire le modèle, si sa sorte se replie (`SORTES`), sinon pas du tout.
func poser_les_aretes(aretes: Array, cotes: Array) -> void:
	_poser(_poses_de(aretes, cotes))


## Les poses des arêtes `aretes`, chacune elle-même, de son catalogue `aretes`, à plat (de `entree` à `sortie`, toutes
## deux à son pied), et celles des côtés de marches `cotes`, une par pièce de chacun (`pieces`), de son catalogue
## `escaliers`, à la place de sa rampe dans sa suite de rampes (`position`), sans palette, montant de son `entree` à
## sa `sortie` le long de son `sens`.
static func _poses_de(aretes: Array, cotes: Array) -> Array:
	var poses := aretes.map(func(a: Dictionary) -> Dictionary: return a.merged({catalogue = "aretes", entree = a.pied, sortie = a.pied}))
	for c: Dictionary in cotes:
		for piece: String in c.pieces:
			poses.append(c.merged({catalogue = "escaliers", piece = piece, palette = {}, hauteurM = 0.0}))
	return poses


## Les poses `poses` (`_poses_de`) posées en groupes d'instances (`poser_les_aretes`), retenues pour être reposées à la
## lecture d'un modèle.
func _poser(poses: Array) -> void:
	_poses_recues = poses
	var groupes := {}
	var a_lire := {}
	var demandes := {}
	for a: Dictionary in poses:
		var modele := modele_servi(a.catalogue, a.famille)
		if not modele.is_empty():
			demandes[modele] = true
			if not _modeles_d_arete.has(modele) and not _illisibles.has(modele):
				a_lire[modele] = true
				continue
		elif not SORTES[a.catalogue].repli:
			continue
		var cle := "%s|%s|%s|%s|%s|%s|%s|%s|%s" % [a.catalogue, a.bloc, a.famille, a.piece, a.position, a.sens.x, a.sens.y,
			a.hauteurM, a.palette]
		groupes.get_or_add(cle, []).append(a)
	reconcilier(_aretes, groupes.keys().map(func(cle: String) -> Dictionary: return {cle = cle, empreinte = [groupes[cle], metres_par_case]}), groupes, _groupe)
	_montrer_le_pose()
	var lectures_ecartees := _ecarter_les_modeles_d_arete(demandes)
	for modele: String in a_lire:
		_lire_le_modele_d_arete(modele)
	if lectures_ecartees and a_lire.is_empty() and not aretes_en_lecture():
		_lectures_closes.emit()


## Les ressources de pièces dont aucune arête reçue ne demande le modèle, libérées avec leurs lectures.
func _ecarter_les_modeles_d_arete(demandes: Dictionary) -> bool:
	var lectures_ecartees := false
	for modele: String in _en_lecture.keys():
		if not demandes.has(modele):
			_en_lecture.erase(modele)
			lectures_ecartees = true
	var lus_ecartes := false
	for modele: String in _modeles_d_arete.keys():
		if not demandes.has(modele):
			_modeles_d_arete[modele].scene.free()
			_modeles_d_arete.erase(modele)
			lus_ecartes = true
	if lus_ecartes:
		for cle: String in _pieces_peintes.keys():
			if not demandes.has(cle.get_slice("|", 0)):
				_pieces_peintes[cle].free()
				_pieces_peintes.erase(cle)
		_maillages_teints.clear()
		_matieres_teintes.clear()
	return lectures_ecartees


## L'id de l'élément servi au catalogue `catalogue` (`SORTES` : `aretes` ou `escaliers` de la réponse de `modeles`
## retenue, `MontageDeComposition.modeles`) pour la famille de kit `famille`, vide sans lui.
static func modele_servi(catalogue: String, famille: Variant) -> String:
	return MontageDeComposition.modeles.get(catalogue, {}).get(famille, "")


## Le modèle d'arête ou d'escalier `modele` lu une fois par le chargeur (`MontageDeComposition.scene_du_modele`) sous
## un jeton, ses erreurs dites à la console ; repris au jeton périmé (le volume sorti de l'arbre, #4195), la scène reçue est libérée
## et rien d'autre ne bouge ; lu, il est retenu avec sa taille (`_taille_du_modele`), illisible, il est retenu
## illisible, et les poses reçues se reposent (`_poser`), le retrait et la teinte courants repris
## (`_montrer_le_pose`) ; `_lectures_closes` puis `aretes_posees` sont émis quand plus aucun modèle n'est en lecture.
func _lire_le_modele_d_arete(modele: String) -> void:
	if _en_lecture.has(modele):
		return
	var jeton := RefCounted.new()
	_en_lecture[modele] = jeton
	var recueil: Array[String] = []
	var scene: Node3D = await chargeur.scene_du_modele(modele, recueil)
	if _en_lecture.get(modele) != jeton:
		if scene != null:
			scene.free()
		return
	_en_lecture.erase(modele)
	for erreur in recueil:
		push_error("[aretes] %s" % erreur)
	if scene == null:
		_illisibles[modele] = true
	else:
		_modeles_d_arete[modele] = {scene = scene, taille = _taille_du_modele(scene)}
	_poser(_poses_recues)
	if _en_lecture.is_empty():
		_lectures_closes.emit()
		aretes_posees.emit()


## Si un modèle d'arête est en lecture (`_lire_le_modele_d_arete`) : ses arêtes attendent sa lecture.
func aretes_en_lecture() -> bool:
	return not _en_lecture.is_empty()


## Rendu quand plus aucun modèle d'arête n'est en lecture (`aretes_en_lecture`, `_lectures_closes`), lus ou leur
## lecture périmée à la sortie de l'arbre : ce qu'attend qui lit les arêtes posées.
func attendre_les_aretes() -> void:
	while aretes_en_lecture():
		await _lectures_closes


## La taille, en mètres, du modèle d'arête ou d'escalier lu `modele` (`_taille_du_modele`), celle à laquelle ses pièces
## s'étirent.
func taille_du_modele_d_arete(modele: String) -> Vector3:
	return _modeles_d_arete[modele].taille


## La taille, en mètres, de la scène `scene` d'un modèle : celle de sa boîte (`MontageDeVehicule.boite`), mesurée
## sous le volume le temps de la mesure.
func _taille_du_modele(scene: Node3D) -> Vector3:
	add_child(scene)
	var boite: AABB = MontageDeVehicule.boite(scene, scene)
	remove_child(scene)
	return boite.size


## Les modèles d'arête lus et leurs pièces peintes libérés, les modèles illisibles, les maillages et les matières
## teints oubliés.
func _oublier_les_modeles_d_arete() -> void:
	for noeud: Node3D in _pieces_peintes.values():
		noeud.free()
	for modele: Dictionary in _modeles_d_arete.values():
		modele.scene.free()
	_pieces_peintes.clear()
	_modeles_d_arete.clear()
	_illisibles.clear()
	_maillages_teints.clear()
	_matieres_teintes.clear()


## Chaque arête cachée à la caméra si `aretes` la nomme, son ombre gardée (`_ecrire_les_instances`), chaque nappe de
## toit si `toits` la nomme, chaque couronne si `couronnes` la nomme (`_cacher_sous`), par leur clé ; montrées sinon, et
## de même pour celles qui se poseront. Une clé qui ne nomme rien de posé ne cache rien. Les poses de décor
## que porte une nappe cachée sont retirées avec elle (`pose_retiree`) : `retire` est émis quand les nappes
## cachées changent.
func cacher(aretes: Array, toits: Array, couronnes: Array) -> void:
	var index := {}
	for cle in aretes:
		index[cle] = true
	var toits_changes: bool = toits != _cachees.toits
	_cachees = {aretes = index, toits = toits, couronnes = couronnes}
	_montrer_le_pose()
	if toits_changes:
		retire.emit()


## Chaque couronne que `cles` nomme retirée, ni vue ni ombre ; montrée sinon, et de même pour celles qui se poseront.
func retirer_les_couronnes(cles: Array) -> void:
	_retirees = cles
	_montrer_le_pose()


func _montrer_le_pose() -> void:
	for groupe: Node3D in _aretes.get_children():
		_ecrire_les_instances(groupe)
	_cacher_sous(_toits, _cachees.toits)
	_cacher_sous(_couronnes, _cachees.couronnes)
	for couronne: Node3D in _couronnes.get_children():
		couronne.visible = not _retirees.has(couronne.get_meta("cle"))


## Ce qui est posé : le nombre de triangles peints des morceaux posés, masqués compris, d'arêtes posées et de pièces
## de côtés de marches posées (les poses de chaque groupe, par catalogue, `SORTES`), de nappes de toit posées, et de
## couronnes montrées.
func ce_qui_est_pose() -> Dictionary:
	var triangles := 0
	for morceau: Node3D in _morceaux.get_children():
		triangles = int(MiseEnPage.triangles_de_plus(triangles, (morceau.get_node("Vu") as MeshInstance3D).mesh.get_faces().size()))
	var poses := {aretes = [], escaliers = []}
	for groupe: Node3D in _aretes.get_children():
		var de_groupe: Array = groupe.get_meta("aretes")
		poses[de_groupe[0].catalogue].append_array(de_groupe)
	return {
		triangles = triangles,
		aretes = poses.aretes.size(),
		cotesDeMarches = poses.escaliers.size(),
		toits = _toits.get_child_count(),
		couronnes = _couronnes.get_children().filter(func(couronne: Node3D) -> bool: return couronne.visible).size(),
	}


## Chaque nappe sous `parent` (`_nappe`) que `cles` nomme cachée à la caméra, son instance en ombre seule gardée
## (#3758), montrée sinon.
func _cacher_sous(parent: Node3D, cles: Array) -> void:
	for nappe: Node3D in parent.get_children():
		(nappe.get_node("Vu") as Node3D).visible = not cles.has(nappe.get_meta("cle"))


## Le maillage d'une géométrie du monde : positions et cases à l'ordre du rayon, normales et couleurs rangées
## sur les seules surfaces à peindre (`priseSeulement` absent). `texel_de` donne l'UV2 de chaque sommet par la case
## de son triangle. Les surfaces que montrent un navire ou un décor (`peindre_sans`), et celles que `retenue`
## écarte, passent dans le rangement des attributs sans conversion. La mer est bordée par la coque (`border_la_mer`).
## Godot tient pour face avant le sens horaire, le volume le sens trigonométrique (`_retournes`).
func _maillage_de(geometrie: Dictionary, texel_de: Callable, masquee: bool, retenue := Callable()) -> ArrayMesh:
	var positions := PackedFloat32Array(geometrie.positions)
	var normales := PackedFloat32Array(geometrie.normales)
	var couleurs := PackedFloat32Array(geometrie.couleurs)
	var cases := PackedFloat32Array(geometrie.cases)
	var rangs := [Mesh.ARRAY_VERTEX, Mesh.ARRAY_NORMAL, Mesh.ARRAY_COLOR, Mesh.ARRAY_TEX_UV2]
	var maillage := ArrayMesh.new()
	var rang_d_attribut := 0
	for surface: Dictionary in geometrie.surfaces:
		if surface.get("priseSeulement", false):
			continue
		var plage := Vector2i(int(surface.debut), int(surface.fin))
		var plage_d_attribut := MiseEnPage.plage_reportee(plage, rang_d_attribut)
		rang_d_attribut = plage_d_attribut.y
		if surface.has("navire") or _decors_montres.has(surface.get("decor")) or (retenue.is_valid() and not retenue.call(surface)):
			continue
		var texels := PackedVector2Array()
		# Chaque triangle a trois sommets et trois coordonnées de case.
		for c: Vector3 in cases.slice(plage.x, plage.y).to_byte_array().to_vector3_array():
			var texel := Vector2(texel_de.call(c))
			texels.append_array([texel, texel, texel])
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = _octets_des_composantes(positions, plage, 3).to_vector3_array()
		tableaux[Mesh.ARRAY_NORMAL] = _octets_des_composantes(normales, plage_d_attribut, 3).to_vector3_array()
		tableaux[Mesh.ARRAY_COLOR] = _octets_des_composantes(couleurs, plage_d_attribut, 4).to_color_array()
		tableaux[Mesh.ARRAY_TEX_UV2] = texels
		if surface.has("flottaison") and _coques.has(surface.flottaison):
			tableaux = _hors_du_contour(tableaux, _coques[surface.flottaison])
		if tableaux[Mesh.ARRAY_VERTEX].is_empty():
			continue
		for rang in rangs:
			tableaux[rang] = _retournes(tableaux[rang])
		var indice := maillage.get_surface_count()
		maillage.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, tableaux)
		maillage.surface_set_material(indice, _matiere(surface.matiere, masquee))
	return maillage


## Les octets des composantes des rangs de `plage` dans `tableau`.
static func _octets_des_composantes(tableau: PackedFloat32Array, plage: Vector2i, composantes: int) -> PackedByteArray:
	var bornes := MiseEnPage.plage_des_composantes(plage, composantes)
	return tableau.slice(bornes.x, bornes.y).to_byte_array()


## Les triangles horizontaux de `tableaux` (sommets, normales, couleurs, cases au masque en `UV2`) hors du contour
## convexe `contour` du plan horizontal (`Geometry2D.clip_polygons`), triangulés (`Geometry2D.triangulate_polygon`, dans
## le sens trigonométrique), chaque morceau dans le sens, à la hauteur, de la normale, de la couleur et de la case de son
## triangle.
func _hors_du_contour(tableaux: Array, contour: PackedVector2Array) -> Array:
	var sommets: PackedVector3Array = tableaux[Mesh.ARRAY_VERTEX]
	var hors := []
	hors.resize(Mesh.ARRAY_MAX)
	hors[Mesh.ARRAY_VERTEX] = PackedVector3Array()
	hors[Mesh.ARRAY_NORMAL] = PackedVector3Array()
	hors[Mesh.ARRAY_COLOR] = PackedColorArray()
	hors[Mesh.ARRAY_TEX_UV2] = PackedVector2Array()
	for triangle: Array in rangs_des_triangles(sommets.size()):
		var premier: Vector3 = sommets[triangle[0]]
		var plan := PackedVector2Array(triangle.map(func(rang: int) -> Vector2: return Vector2(sommets[rang].x, sommets[rang].z)))
		for morceau in Geometry2D.clip_polygons(plan, contour):
			var rangs := Geometry2D.triangulate_polygon(morceau)
			if Geometry2D.is_polygon_clockwise(plan):
				rangs.reverse()
			for rang in rangs:
				hors[Mesh.ARRAY_VERTEX].append(Vector3(morceau[rang].x, premier.y, morceau[rang].y))
				hors[Mesh.ARRAY_NORMAL].append(tableaux[Mesh.ARRAY_NORMAL][triangle[0]])
				hors[Mesh.ARRAY_COLOR].append(tableaux[Mesh.ARRAY_COLOR][triangle[0]])
				hors[Mesh.ARRAY_TEX_UV2].append(tableaux[Mesh.ARRAY_TEX_UV2][triangle[0]])
	return hors


## Les rangs des sommets de chaque triangle d'une liste de `sommets` sommets, trois par triangle, dans leur ordre.
static func rangs_des_triangles(sommets: int) -> Array:
	var premiers := range(0, sommets, 3)
	var seconds := range(1, sommets, 3)
	var troisiemes := range(2, sommets, 3)
	var rangs := []
	for triangle in premiers.size():
		rangs.append([premiers[triangle], seconds[triangle], troisiemes[triangle]])
	return rangs


## `tableau` retourné en entier : chaque triangle change de sens (`_maillage_de`).
func _retournes(tableau: Variant) -> Variant:
	tableau.reverse()
	return tableau


## La matière de rendu des surfaces de la matière `nom` (`<domaine>--<id>`, `CONTRAT.md`, section « Monde »), du shader
## de monde : texturée (`texturer`) si sa texture est au projet, sinon la couleur de ses sommets, liée à la vision posée
## (`voir`). Celle d'un morceau (`masquee`) est liée au masque posé (`retirer`) ; celle d'une nappe, jamais : sa texture
## de retrait reste la noire par défaut, rien ne s'y replie.
func _matiere(nom: String, masquee: bool) -> ShaderMaterial:
	var matieres := _matieres_masquees if masquee else _matieres_des_nappes
	var reference := matieres.get(nom) as WeakRef
	var matiere := reference.get_ref() as ShaderMaterial if reference != null else null
	if matiere != null:
		return matiere
	var albedo := TexturesDeMatiere.retenue(texture_de(nom))
	matiere = (matiere_texturee_masquee if albedo != null else couleur_des_sommets_masquee).duplicate()
	texturer(matiere, nom, albedo, true)
	if masquee:
		matiere.set_shader_parameter("retrait", _retrait)
	_lier_la_vision_a(matiere)
	matieres[nom] = weakref(matiere)
	return matiere


## Le chemin de la texture de la matière `nom` au projet.
static func texture_de(nom: String) -> String:
	return "res://textures/%s.jpg" % nom


## Le chemin du relief de la texture de la matière `nom` au projet.
static func relief_de(nom: String) -> String:
	return "res://textures/%s.normale.jpg" % nom


## Le chemin de la texture neutre de la matière `nom` au projet, celle que teint une couleur de palette (#4313).
static func texture_neutre_de(nom: String) -> String:
	return "res://textures/%s.neutre.jpg" % nom


## `materiau`, une matière standard ou du shader de monde (qui nomme ses paramètres comme les propriétés de la matière
## standard), habillé de la texture `albedo` et du relief de `nom` que porte le catalogue, projetés sur les trois axes
## du repère du mesh si `projetee`, lus aux UV du mesh, en mètres, sinon (#4313). Le motif se répète à l'échelle
## `motif`, un pour `MiseEnPage.METRES_PAR_MOTIF` par défaut.
static func texturer(materiau: Material, nom: String, albedo: Texture2D, projetee: bool,
		motif := MiseEnPage.echelle_de_motif()) -> void:
	if albedo == null:
		return
	var propriete := "shader_parameter/" if materiau is ShaderMaterial else ""
	materiau.set(propriete + "albedo_texture", albedo)
	materiau.set(propriete + "uv1_triplanar", projetee)
	materiau.set(propriete + "uv1_triplanar_sharpness", NETTETE_DU_MOTIF)
	materiau.set(propriete + "uv1_scale", motif)
	var relief := TexturesDeMatiere.retenue(relief_de(nom))
	if relief != null:
		materiau.set(propriete + "normal_enabled", true)
		materiau.set(propriete + "normal_texture", relief)


## Le nœud du groupe des poses `aretes` (même catalogue, `bloc`, `famille`, `piece`, `position`, `sens`, `hauteurM`
## et `palette`, `_poser`), à l'origine de `Aretes` : orienté et étiré sur leur sens (`_etirer_sur`), il porte leur
## pièce : celle du modèle lu de leur famille à leur catalogue (`modele_servi`) à leur position, s'il l'a
## (`noeud_de_la_piece`), peinte de leur palette (`piece_peinte`), le +Z de son repère vers le dehors de l'arête,
## étirée sur leur longueur et mise à la hauteur de leur mur, ou à celle du modèle pour une sorte qui ne s'étire pas
## (`SORTES`, `MiseEnPage.echelle_d_arete_servie`) ; sinon leur boîte (`_boite`) si leur sorte se replie, aucun nœud
## sinon. Chaque maillage devient deux instances groupées de même place (`_instances`), une par pose : `Vu_<maillage>`,
## que la caméra voit sans qu'il porte d'ombre, de son maillage teint (`_maillage_teint`), et `Ombre_<maillage>`, en
## ombre seule (`SHADOWS_ONLY`, #3758), de son maillage. Les poses vont en méta (`aretes`), et la couleur de chaque
## instance vue, aucune encore (`couleurs`) ; les instances s'écrivent une fois le groupe dans l'arbre
## (`_ecrire_les_instances`).
func _groupe(aretes: Array) -> Node3D:
	var a: Dictionary = aretes[0]
	var sorte: Dictionary = SORTES[a.catalogue]
	var sens := Vector2(a.sens.x, a.sens.y)
	var modele := modele_servi(a.catalogue, a.famille)
	var noeud := "" if not _modeles_d_arete.has(modele) else noeud_de_la_piece(_modeles_d_arete[modele].scene, a.piece, a.position)
	if noeud.is_empty() and not sorte.repli:
		return null
	var groupe := Node3D.new()
	_etirer_sur(groupe, sens)
	var socle := 0.0
	if not noeud.is_empty():
		var taille := taille_du_modele_d_arete(modele)
		var etirement := MiseEnPage.echelle_d_arete_servie(sens, a.hauteurM if sorte.etiree else taille.y, taille.x, taille.y, metres_par_case)
		groupe.scale = etirement
		groupe.add_child(piece_peinte(modele, noeud, a.palette, etirement).duplicate())
	else:
		var boite := MeshInstance3D.new()
		boite.name = "Boite"
		boite.mesh = _boite(a.piece)
		socle = boite.mesh.size.y
		groupe.add_child(boite)
	for maillage: MeshInstance3D in groupe.find_children("*", "MeshInstance3D", true, false):
		var vu := _instances(maillage, _maillage_teint(maillage.mesh), "Vu_%s" % maillage.name, GeometryInstance3D.SHADOW_CASTING_SETTING_OFF, aretes.size(), socle)
		var ombre := _instances(maillage, maillage.mesh, "Ombre_%s" % maillage.name, GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY, aretes.size(), socle)
		vu.set_meta("ombre", ombre)
		maillage.add_sibling(vu)
		maillage.add_sibling(ombre)
		maillage.get_parent().remove_child(maillage)
		maillage.free()
	var aucune := []
	aucune.resize(aretes.size())
	groupe.set_meta("aretes", aretes)
	groupe.set_meta("couleurs", aucune)
	return groupe


## Le nœud de la pièce `piece` (`Noyau.Piece`) d'une arête à la position `position` de son ouverture
## (`Noyau.Position`) dans la scène `scene` d'un modèle d'arête : `<pièce>--<position>` s'il en est un nœud racine,
## sinon `<pièce>` s'il en est un, sinon aucun (`""`).
static func noeud_de_la_piece(scene: Node, piece: String, position: String) -> String:
	var place := "%s--%s" % [piece, position]
	if scene.has_node(place):
		return place
	return piece if scene.has_node(piece) else ""


## Le nœud `piece` (`noeud_de_la_piece`, un nœud racine) du modèle d'arête lu `modele`, hors de l'arbre, une par palette et
## par étirement : ses surfaces peintes de `palette` (`MontageDeComposition.peindre`, les `surfaces` du modèle servi)
## dans la matière de chaque maillage, jamais aux sommets ni en matière propre au nœud, que les instances groupées
## perdraient ; la texture d'une matière projetée sur les trois axes de la pièce, à l'échelle qui garde son motif
## métrique sur la pièce étirée de `etirement` (`MiseEnPage.echelle_de_motif_etire`).
func piece_peinte(modele: String, piece: String, palette: Dictionary, etirement: Vector3) -> Node3D:
	var cle := "%s|%s|%s|%s" % [modele, piece, palette, etirement]
	if not _pieces_peintes.has(cle):
		var peinte: Node3D = _modeles_d_arete[modele].scene.get_node(piece).duplicate()
		var maillages := peinte.find_children("*", "MeshInstance3D", true, false)
		if peinte is MeshInstance3D:
			maillages.append(peinte)
		MontageDeComposition.peindre(maillages, MontageDeComposition.modeles.surfaces[modele], null, palette, {}, false,
			{}, {}, MiseEnPage.echelle_de_motif_etire(etirement, metres_par_case))
		for maillage: MeshInstance3D in maillages:
			var mesh: Mesh = maillage.mesh.duplicate()
			for rang in mesh.get_surface_count():
				mesh.surface_set_material(rang, maillage.get_active_material(rang))
				maillage.set_surface_override_material(rang, null)
			maillage.mesh = mesh
		_pieces_peintes[cle] = peinte
	return _pieces_peintes[cle]


## Les instances groupées `nom` du maillage `mesh`, à la place de `maillage`, `nombre` instances chacune de sa couleur
## (`use_colors`, posé avant leur nombre), projetant l'ombre `ombre`, pour une pièce dont le centre est à `socle`
## au-dessus de son pied (`transform_d_instance`).
func _instances(maillage: MeshInstance3D, mesh: Mesh, nom: String, ombre: GeometryInstance3D.ShadowCastingSetting, nombre: int, socle: float) -> MultiMeshInstance3D:
	var multimesh := MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_colors = true
	multimesh.mesh = mesh
	multimesh.instance_count = nombre
	var instances := MultiMeshInstance3D.new()
	instances.name = nom
	instances.multimesh = multimesh
	instances.transform = maillage.transform
	instances.cast_shadow = ombre
	instances.set_meta("socle", socle)
	return instances


## Les instances du groupe `groupe` (`_groupe`), une par arête, dans l'ordre des arêtes montrées puis des arêtes cachées
## (`cacher`), le même pour chaque maillage : `Vu_<maillage>` n'en montre que les premières, `Ombre_<maillage>` les
## projette toutes ; cet ordre en méta (`ordre`), chaque instance vue teinte à son rang à la prochaine image dessinée
## (`_teindre_le_pose`), et à chaque pas d'un fondu en cours si une de ses cases y change d'état (`_du_fondu`). Réécrites
## seulement si l'ensemble de ses arêtes cachées, lu à l'index de `cacher`, a changé depuis la dernière écriture (méta
## `cachees`, absente d'un groupe neuf).
func _ecrire_les_instances(groupe: Node3D) -> void:
	var aretes: Array = groupe.get_meta("aretes")
	var cachees := aretes.filter(func(a: Dictionary) -> bool: return _cachees.aretes.has(a.cle))
	var cles := cachees.map(func(a: Dictionary) -> String: return a.cle)
	if groupe.has_meta("cachees") and groupe.get_meta("cachees") == cles:
		return
	var ordre := aretes.filter(func(a: Dictionary) -> bool: return not _cachees.aretes.has(a.cle))
	var montrees := ordre.size()
	ordre.append_array(cachees)
	for vu: MultiMeshInstance3D in groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false):
		var ombre: MultiMeshInstance3D = vu.get_meta("ombre")
		for rang in ordre.size():
			var instance := transform_d_instance(vu, ordre[rang])
			vu.multimesh.set_instance_transform(rang, instance)
			ombre.multimesh.set_instance_transform(rang, instance)
		vu.multimesh.visible_instance_count = montrees
	groupe.set_meta("cachees", cles)
	groupe.set_meta("ordre", ordre)
	_a_teindre[groupe] = true
	if _part_du_fondu != 1.0 and _change_d_etat(groupe):
		_du_fondu[groupe] = true


## Chaque instance vue du groupe `groupe` (`Vu_<maillage>`) de la teinte de l'arête de son rang (méta `ordre`,
## `_teinte_d_arete`), réécrite seulement si elle n'est pas celle que l'instance de ce rang porte déjà (méta `couleurs`,
## aucune dans un groupe neuf).
func _teindre(groupe: Node3D) -> void:
	var avant: Array = groupe.get_meta("couleurs")
	var couleurs: Array = groupe.get_meta("ordre").map(_teinte_d_arete)
	var vus := groupe.find_children("Vu_*", "MultiMeshInstance3D", true, false)
	for rang in couleurs.size():
		if avant[rang] == couleurs[rang]:
			continue
		for vu: MultiMeshInstance3D in vus:
			vu.multimesh.set_instance_color(rang, couleurs[rang])
	groupe.set_meta("couleurs", couleurs)


## La teinte de l'instance vue de l'arête `a` : sans vision (`voir`), blanche ; sinon le plus grand des états fondus de
## ses cases (`cases`, chacune lue au plan de sa couche dans la vision d'avant et dans la posée, à la part du fondu),
## en part de lumière sRGB (`MiseEnPage.teinte_d_instance`).
func _teinte_d_arete(a: Dictionary) -> Color:
	if _vision == null:
		return Color.WHITE
	var etat := 0.0
	for c: Dictionary in a.cases:
		var texel := _texel_de_vision(c)
		etat = MiseEnPage.plus_grand_etat(etat, MiseEnPage.etat_fondu(_vision_d_avant.get_pixelv(texel).r8, _vision.get_pixelv(texel).r8, _part_du_fondu))
	var teinte := MiseEnPage.teinte_d_instance(etat, _teintes)
	return Color(teinte, teinte, teinte)


## La copie de `mesh` que voient les instances vues de ses arêtes, une par maillage : chaque matière remplacée par sa
## copie qui prend pour albédo la couleur de l'instance (`vertex_color_use_as_albedo`), en sRGB, que chaque rendu lit de
## même (`vertex_color_is_srgb`), sans spéculaire (`metallic_specular`), que la couleur d'instance ne voile pas, une par
## matière.
func _maillage_teint(mesh: Mesh) -> Mesh:
	if not _maillages_teints.has(mesh):
		var copie: Mesh = mesh.duplicate()
		for rang in mesh.get_surface_count():
			var matiere: BaseMaterial3D = mesh.surface_get_material(rang)
			if not _matieres_teintes.has(matiere):
				var teinte: BaseMaterial3D = matiere.duplicate()
				teinte.vertex_color_use_as_albedo = true
				teinte.vertex_color_is_srgb = true
				teinte.metallic_specular = 0.0
				_matieres_teintes[matiere] = teinte
			copie.surface_set_material(rang, _matieres_teintes[matiere])
		_maillages_teints[mesh] = copie
	return _maillages_teints[mesh]


## Le repère, dans `instances` (des instances groupées d'un maillage d'un groupe d'arêtes, dans l'arbre), de
## l'instance de la pose `a` : sa pièce posée au centre de l'arête (`MiseEnPage.centre_d_arete`, à son socle),
## cisaillée autour de lui de sa pente le long de son sens (`MiseEnPage.pente_d_arete`), ses montants restant
## verticaux. Lu par des témoins sans calcul : `place`, à la place des instances sous `Aretes` ; `cisaillee`, ce
## cisaillement au centre de l'arête sous `Aretes`, portant `posee` à cette place ; `lue`, sous les instances, à la place
## de `posee`.
func transform_d_instance(instances: MultiMeshInstance3D, a: Dictionary) -> Transform3D:
	var pente := MiseEnPage.pente_d_arete(Vector2(a.sens.x, a.sens.y), a.entree, a.sortie, metres_par_case)
	var place := Node3D.new()
	var cisaillee := Node3D.new()
	var posee := Node3D.new()
	var lue := Node3D.new()
	_aretes.add_child(place)
	place.global_transform = instances.global_transform
	_aretes.add_child(cisaillee)
	cisaillee.transform = Transform3D(Basis(Vector3(1.0, pente.x, 0.0), Vector3.UP, Vector3(0.0, pente.y, 1.0)),
		MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, metres_par_case, instances.get_meta("socle")))
	cisaillee.add_child(posee)
	posee.transform = place.transform
	instances.add_child(lue)
	lue.global_transform = posee.global_transform
	var transformation := lue.transform
	for temoin: Node3D in [place, cisaillee, lue]:
		temoin.get_parent().remove_child(temoin)
		temoin.free()
	return transformation


## La boîte de la pièce `piece` d'une arête : le seuil d'une porte ouverte ou d'une brèche, une porte fermée, sinon un
## mur.
func _boite(piece: String) -> BoxMesh:
	match piece:
		Noyau.Piece.PORTE_OUVERTE, Noyau.Piece.BRECHE:
			return mesh_seuil
		Noyau.Piece.PORTE_FERMEE:
			return mesh_porte
	return mesh_mur


## Le maillage `mesh` posé par `instance` sur l'arête `a`, debout à son pied (`a.pied`).
func poser_sur_l_arete(instance: MeshInstance3D, mesh: BoxMesh, a: Dictionary) -> void:
	instance.mesh = mesh
	instance.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, metres_par_case, mesh.size.y)
	_etirer_sur(instance, Vector2(a.sens.x, a.sens.y))


## `noeud` orienté sur une arête qui court selon `sens` et étiré à sa longueur.
func _etirer_sur(noeud: Node3D, sens: Vector2) -> void:
	noeud.rotation.y = MiseEnPage.lacet_d_arete(sens)
	noeud.scale.x = MiseEnPage.longueur_d_arete(sens)
