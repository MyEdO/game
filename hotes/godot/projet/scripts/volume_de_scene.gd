## Le volume d'une scène tel que le jeu le dessine, que le monde du plateau et de l'éditeur (`Monde`) et l'atelier
## instancient tous deux : le volume du monde (`CONTRAT.md`, section « Monde ») en morceaux, mis à l'échelle d'une unité
## par case, chacun un nœud nommé par sa clé, gardé tant que son empreinte ne bouge pas (`poser`, `manquants`), une
## instance vue sans ombre portée, habillée du shader de monde (`art/monde.gdshader`), et une instance en ombre seule du
## même maillage, dans une matière standard, une surface par matière, texturée ou colorée par sommet, rendue des deux
## côtés hors des surfaces d'un navire, la mer de chaque navire bordée par sa coque (`border_la_mer`) ; ce que le regard
## en retire, masqué case par case dans le shader sans toucher ni aux maillages ni à leur ombre (`retirer`) ; ce que le
## groupe en voit, voilé de même case par case et fondu d'une vision à la suivante (`voir`) ; le voile de cette vision
## sur chaque navire (`voile`, jusqu'à `oublier_le_voile`, `art/voile.gdshader`), lié au sol de chaque case des morceaux
## posés, en texture rangée comme la vision (`_batir_les_sols`) ; les nappes de toit et les couronnes crénelées des
## murs, de même forme qu'un morceau, voilées comme lui mais jamais masquées, réconciliées de même par clé et
## empreinte ; les arêtes de la scène, en unités de plateau, chacune la pièce du kit des arêtes (`KIT`) que l'arête
## nomme, sinon sa boîte, en groupes d'instances (`poser_les_aretes`), chaque instance vue teinte par l'état de la
## meilleure des cases qu'elle sépare ; et ce que qui l'instancie en cache à la caméra (`cacher`) ou en retire
## (`retirer_les_couronnes`).
class_name VolumeDeScene
extends Node3D

## Le fondu de la vision (`voir`) est parvenu à sa fin, aucune vision n'attendant plus (`part_du_fondu`).
signal fondu_fini

## La couche de rendu de l'ombre des luminaires (`_morceau`), la deuxième (`VisualInstance3D.layers`), que la lampe d'un
## foyer exclut de son ombre (`Foyer`).
const COUCHE_DES_LUMINAIRES := 2
## Netteté de la projection d'une texture de matière sur les trois axes (`texturer`, `_matiere`).
const NETTETE_DU_MOTIF := 4.0
## Le kit des arêtes (`CONTRAT.md`, méthode `aretes`) : une pièce par nœud racine, `<famille>--<pièce>`.
const KIT := "res://kit/kit.glb"
## La durée, en secondes, du fondu d'une vision posée à la suivante (`voir`).
const DUREE_DU_FONDU_S := 0.3
## Le voile de la vision sur un navire (`voile`), et le sol, dans sa texture (`_batir_les_sols`), d'une couche d'une
## colonne qui n'y a pas de case.
const VOILE := preload("res://art/voile.gdshader")
const SANS_CASE := INF

## Ce qui se pose sur une arête dont le kit n'a pas la pièce, ou sans kit au projet : un mur, une porte fermée, le seuil
## d'une porte ouverte ou d'une brèche.
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
## Par nom de matière, la matière de rendu des surfaces des morceaux, que le masque lie (`retirer`), et celle des
## nappes et des couronnes, qu'il ne lie jamais : le retrait d'une nappe est par nœud (`cacher`).
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
## Le sol de chaque case du volume posé (`_batir_les_sols`), et, par id de navire, la matière de son voile (`voile`),
## liée à la vision comme les nappes.
var _sols: ImageTexture = null
var _voiles := {}
## Les groupes d'arêtes à teindre à la prochaine image dessinée (`_teindre_le_pose`), chacun en clé, et ceux que chaque
## pas du fondu reteint (`avancer_le_fondu`) : ceux dont une case change d'état d'une vision à l'autre
## (`_change_d_etat`), tous quand la vision se pose sans fondu (`_mesurer_le_fondu`).
var _a_teindre := {}
var _du_fondu := {}
## Le kit des arêtes, hors de l'arbre, `null` sans kit au projet.
var _kit: Node3D
## Les clés des arêtes cachées à la caméra (`cacher`), indexées (`aretes`, chaque clé à `true`), et celles des nappes
## de toit et des couronnes cachées, en tableaux (`toits`, `couronnes`).
var _cachees := {aretes = {}, toits = [], couronnes = []}
## Les clés des couronnes retirées (`retirer_les_couronnes`).
var _retirees: Array = []
## Par maillage d'une pièce du kit ou d'une boîte, sa copie que voient les instances vues de ses arêtes, et par matière,
## sa copie qui prend pour albédo la couleur de l'instance (`_maillage_teint`).
var _maillages_teints := {}
var _matieres_teintes := {}


func _ready() -> void:
	if ResourceLoader.exists(KIT):
		_kit = (load(KIT) as PackedScene).instantiate()
	RenderingServer.frame_pre_draw.connect(_teindre_le_pose)


## Juste avant que l'image se dessine (`frame_pre_draw`), chaque groupe d'arêtes posé que `_a_teindre` nomme teint
## (`_teindre`) sur ce qui est posé à cet instant : le monde, la vision et les arêtes d'une même scène, quel que soit
## l'ordre où l'appelant les a posés (`combat.gd`, `_suivre`).
func _teindre_le_pose() -> void:
	for groupe: Node3D in _aretes.get_children():
		if _a_teindre.has(groupe):
			_teindre(groupe)
	_a_teindre.clear()


func _notification(quoi: int) -> void:
	if quoi == NOTIFICATION_PREDELETE and _kit != null:
		_kit.free()


## Les clés du manifeste `monde` (`CONTRAT.md`, méthode `monde` : `{ monde, toits, couronnes }`) dont l'empreinte posée
## diffère ou manque : `{ volume, toits, couronnes }`, l'entrée de la méthode `morceaux` sans sa `source`.
func manquants(monde: Dictionary) -> Dictionary:
	return {
		volume = _manquants_sous(_morceaux, monde.monde.morceaux),
		toits = _manquants_sous(_toits, monde.toits),
		couronnes = _manquants_sous(_couronnes, monde.couronnes),
	}


## Le volume du manifeste `monde` (`{ monde, toits, couronnes }`) à l'échelle d'une unité par case, sa case (0, 0) sur
## la case (0, 0) du plateau, ses morceaux, ses nappes de toit et ses couronnes réconciliés par clé (`reconcilier`) : un
## posé dont l'empreinte n'a pas bougé reste, un reçu (`recus`, la réponse de `morceaux` : `{ volume, toits, couronnes }`)
## se pose à la place, une clé partie du manifeste quitte l'arbre. Chaque morceau (`_morceau`) et chaque nappe
## (`_nappe`) cachés si `cacher` les nomme, chaque couronne retirée si `retirer_les_couronnes` la nomme ; la vision posée
## (`voir`) liée à l'échelle du volume.
func poser(monde: Dictionary, recus: Dictionary) -> void:
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
	for matiere: ShaderMaterial in _matieres_masquees.values():
		matiere.set_shader_parameter("retrait", _retrait)


## Si le masque posé (`retirer`) retire la case `case` du plan de première rangée `rangee` (`MorceauDuMonde.rangee`).
func retiree(case: Vector2i, rangee: int) -> bool:
	return _masque != null and _masque.get_pixelv(MiseEnPage.texel_du_masque(case, rangee)).r8 != 0


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
	for matieres: Dictionary in [_matieres_masquees, _matieres_des_nappes, _voiles]:
		for matiere: ShaderMaterial in matieres.values():
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


## La vision posée (`voir`) liée à chaque matière des morceaux, des nappes et des voiles des navires (`_lier_la_vision_a`).
func _lier_la_vision() -> void:
	for matieres: Dictionary in [_matieres_masquees, _matieres_des_nappes, _voiles]:
		for matiere: ShaderMaterial in matieres.values():
			_lier_la_vision_a(matiere)


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


## La matière du voile de la vision du navire `navire` (`art/voile.gdshader`), liée à la vision posée (`voir`) et au sol
## de chaque case du volume posé (`_batir_les_sols`), la même tant que `oublier_le_voile` ne l'a pas oubliée.
func voile(navire: String) -> ShaderMaterial:
	if not _voiles.has(navire):
		var matiere := ShaderMaterial.new()
		matiere.shader = VOILE
		matiere.set_shader_parameter("sols", _sols)
		_lier_la_vision_a(matiere)
		_voiles[navire] = matiere
	return _voiles[navire]


## Le voile du navire `navire` (`voile`) oublié.
func oublier_le_voile(navire: String) -> void:
	_voiles.erase(navire)


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


## Rien de posé : ni morceau, ni nappe, ni arête.
func vider() -> void:
	for parent: Node3D in [_morceaux, _toits, _couronnes, _aretes]:
		reconcilier(parent, [], {}, Callable())


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
## `COUCHE_DES_LUMINAIRES`, avec elles seules ; les navires dont il porte la mer (`flottaison`), et sa géométrie s'il en
## porte, que `border_la_mer` remaille.
func _morceau(morceau: Dictionary) -> Node3D:
	var noeud := _vu_et_ombre()
	if morceau.surfaces.any(_est_d_un_luminaire):
		var des_luminaires := _en_ombre_seule("OmbreDesLuminaires")
		des_luminaires.layers = COUCHE_DES_LUMINAIRES
		noeud.add_child(des_luminaires)
	var flottaisons: Array = morceau.surfaces.filter(func(surface: Dictionary) -> bool: return surface.has("flottaison")).map(func(surface: Dictionary) -> String: return surface.flottaison)
	noeud.set_meta("flottaisons", flottaisons)
	var cases := {}
	for c in PackedFloat32Array(morceau.cases).to_byte_array().to_vector3_array():
		cases[Vector3i(c)] = true
	noeud.set_meta("cases", cases.keys())
	if not flottaisons.is_empty():
		noeud.set_meta("geometrie", morceau)
	_mailler(noeud, morceau)
	return noeud


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
	return surface.has("luminaire")


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


## Le nœud d'une nappe de toit ou d'une couronne (`NappeDuMonde`, `_vu_et_ombre`) : son maillage (`_maillage_de`, chaque
## case au plan `sol` de sa couche, `MiseEnPage.texel_de_nappe`, dans des matières que le masque ne lie jamais), voilé
## par la vision, vu tant que `cacher` ne la nomme pas, son ombre toujours portée.
func _nappe(nappe: Dictionary) -> Node3D:
	var noeud := _vu_et_ombre()
	var maillage := _maillage_de(nappe, func(c: Vector3) -> Vector2i: return MiseEnPage.texel_de_nappe(Vector2i(int(c.x), int(c.y)), _couches[int(c.z)], _rangees_d_une_couche), false)
	(noeud.get_node("Vu") as MeshInstance3D).mesh = maillage
	(noeud.get_node("Ombre") as MeshInstance3D).mesh = maillage
	return noeud


## Les arêtes `aretes` (`CONTRAT.md`, méthode `aretes`), chacune sur le côté de sa case, debout à son pied, en groupes
## d'instances : les arêtes de même `bloc`, `famille`, `piece`, `sens` et `hauteurM`, dans l'ordre reçu, une instance
## chacune de chaque maillage de leur pièce (`_groupe`) ; cachées si `cacher` les nomme. Les groupes sont réconciliés
## par clé (`reconcilier`) : un groupe dont les arêtes n'ont pas changé à la même échelle reste, un groupe changé (une
## porte ouverte quitte un groupe et en rejoint un autre) est refait, un groupe parti quitte l'arbre.
func poser_les_aretes(aretes: Array) -> void:
	var groupes := {}
	for a: Dictionary in aretes:
		groupes.get_or_add("%s|%s|%s|%s|%s|%s" % [a.bloc, a.famille, a.piece, a.sens.x, a.sens.y, a.hauteurM], []).append(a)
	reconcilier(_aretes, groupes.keys().map(func(cle: String) -> Dictionary: return {cle = cle, empreinte = [groupes[cle], metres_par_case]}), groupes, _groupe)
	_montrer_le_pose()


## Chaque arête cachée à la caméra si `aretes` la nomme, son ombre gardée (`_ecrire_les_instances`), chaque nappe de
## toit si `toits` la nomme, chaque couronne si `couronnes` la nomme (`_cacher_sous`), par leur clé ; montrées sinon, et
## de même pour celles qui se poseront. Une clé qui ne nomme rien de posé ne cache rien.
func cacher(aretes: Array, toits: Array, couronnes: Array) -> void:
	var index := {}
	for cle in aretes:
		index[cle] = true
	_cachees = {aretes = index, toits = toits, couronnes = couronnes}
	_montrer_le_pose()


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


## Ce qui est posé : le nombre de triangles peints des morceaux posés, masqués compris, d'arêtes posées (celles de
## chaque groupe), de nappes de toit posées, et de couronnes montrées.
func ce_qui_est_pose() -> Dictionary:
	var triangles := 0
	for morceau: Node3D in _morceaux.get_children():
		triangles = int(MiseEnPage.triangles_de_plus(triangles, (morceau.get_node("Vu") as MeshInstance3D).mesh.get_faces().size()))
	var aretes := []
	for groupe: Node3D in _aretes.get_children():
		aretes.append_array(groupe.get_meta("aretes"))
	return {
		triangles = triangles,
		aretes = aretes.size(),
		toits = _toits.get_child_count(),
		couronnes = _couronnes.get_children().filter(func(couronne: Node3D) -> bool: return couronne.visible).size(),
	}


## Chaque nappe sous `parent` (`_nappe`) que `cles` nomme cachée à la caméra, son instance en ombre seule gardée
## (#3758), montrée sinon.
func _cacher_sous(parent: Node3D, cles: Array) -> void:
	for nappe: Node3D in parent.get_children():
		(nappe.get_node("Vu") as Node3D).visible = not cles.has(nappe.get_meta("cle"))


## Le maillage d'une géométrie du monde (`positions`, `normales`, `couleurs`, `cases`, `surfaces`) : une surface par
## matière, texturée ou colorée par sommet (`_matiere`, liée au masque si `masquee`), chaque sommet portant en `UV2` le
## texel au masque de la case de son triangle que `texel_de` rend (la case de chaque triangle lue en `x, y, z` à plat
## dans `cases`), chaque tableau retourné en entier (`_retournes`) ;
## sans les surfaces d'un navire (`navire`), que le rayon du pointeur touche et que le modèle du navire montre ; la mer
## d'un navire (`flottaison`) hors du contour de sa coque (`border_la_mer`, `_hors_du_contour`), entière tant qu'il
## n'est pas connu ; de ses seules surfaces que `retenue` retient, s'il est donné. Godot tient pour face avant le sens
## horaire, le volume le sens trigonométrique : chaque tableau retourné en entier retourne chaque triangle.
func _maillage_de(geometrie: Dictionary, texel_de: Callable, masquee: bool, retenue := Callable()) -> ArrayMesh:
	var sommets := PackedFloat32Array(geometrie.positions).to_byte_array().to_vector3_array()
	var normales := PackedFloat32Array(geometrie.normales).to_byte_array().to_vector3_array()
	var couleurs := PackedFloat32Array(geometrie.couleurs).to_byte_array().to_color_array()
	var texels := PackedVector2Array()
	for c: Vector3 in PackedFloat32Array(geometrie.cases).to_byte_array().to_vector3_array():
		var texel := Vector2(texel_de.call(c))
		texels.append_array([texel, texel, texel])
	var rangs := [Mesh.ARRAY_VERTEX, Mesh.ARRAY_NORMAL, Mesh.ARRAY_COLOR, Mesh.ARRAY_TEX_UV2]
	var maillage := ArrayMesh.new()
	for surface: Dictionary in geometrie.surfaces:
		if surface.has("navire") or (retenue.is_valid() and not retenue.call(surface)):
			continue
		var tableaux := []
		tableaux.resize(Mesh.ARRAY_MAX)
		tableaux[Mesh.ARRAY_VERTEX] = sommets.slice(int(surface.debut), int(surface.fin))
		tableaux[Mesh.ARRAY_NORMAL] = normales.slice(int(surface.debut), int(surface.fin))
		tableaux[Mesh.ARRAY_COLOR] = couleurs.slice(int(surface.debut), int(surface.fin))
		tableaux[Mesh.ARRAY_TEX_UV2] = texels.slice(int(surface.debut), int(surface.fin))
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
	if not matieres.has(nom):
		var matiere: ShaderMaterial = (matiere_texturee_masquee if ResourceLoader.exists(texture_de(nom)) else couleur_des_sommets_masquee).duplicate()
		texturer(matiere, nom)
		if masquee:
			matiere.set_shader_parameter("retrait", _retrait)
		_lier_la_vision_a(matiere)
		matieres[nom] = matiere
	return matieres[nom]


## Le chemin de la texture de la matière `nom` au projet.
static func texture_de(nom: String) -> String:
	return "res://textures/%s.jpg" % nom


## Le chemin du relief de la texture de la matière `nom` au projet.
static func relief_de(nom: String) -> String:
	return "res://textures/%s.normale.jpg" % nom


## `materiau`, une matière standard ou du shader de monde (qui nomme ses paramètres comme les propriétés de la matière
## standard), habillé de la matière `nom` si sa texture est au projet : la texture et son relief s'il y est, projetés
## sur les trois axes du repère du mesh, un motif tous les `MiseEnPage.METRES_PAR_MOTIF`.
static func texturer(materiau: Material, nom: String) -> void:
	if not ResourceLoader.exists(texture_de(nom)):
		return
	var propriete := "shader_parameter/" if materiau is ShaderMaterial else ""
	materiau.set(propriete + "albedo_texture", load(texture_de(nom)))
	materiau.set(propriete + "uv1_triplanar", true)
	materiau.set(propriete + "uv1_triplanar_sharpness", NETTETE_DU_MOTIF)
	materiau.set(propriete + "uv1_scale", MiseEnPage.echelle_de_motif())
	if ResourceLoader.exists(relief_de(nom)):
		materiau.set(propriete + "normal_enabled", true)
		materiau.set(propriete + "normal_texture", load(relief_de(nom)))


## Le nœud du groupe des arêtes `aretes` (même `bloc`, `famille`, `piece`, `sens` et `hauteurM`), à l'origine de
## `Aretes` : orienté et étiré sur leur sens (`_etirer_sur`), il porte leur pièce, celle du kit, `<famille>--<pièce>`,
## mise à la hauteur de leur mur (`MiseEnPage.echelle_de_piece`), sinon leur boîte (`_boite`), où chaque maillage
## devient deux instances groupées de même place (`_instances`), une par arête : `Vu_<maillage>`, que la caméra voit sans
## qu'il porte d'ombre, de son maillage teint (`_maillage_teint`), et `Ombre_<maillage>`, en ombre seule
## (`SHADOWS_ONLY`, #3758), de son maillage. Les arêtes vont en méta (`aretes`), et la couleur de chaque instance vue,
## aucune encore (`couleurs`) ; les instances s'écrivent une fois le groupe dans l'arbre (`_ecrire_les_instances`).
func _groupe(aretes: Array) -> Node3D:
	var a: Dictionary = aretes[0]
	var sens := Vector2(a.sens.x, a.sens.y)
	var nom := "%s--%s" % [a.famille, a.piece]
	var groupe := Node3D.new()
	_etirer_sur(groupe, sens)
	var socle := 0.0
	if _kit != null and a.famille != null and _kit.has_node(nom):
		groupe.scale = MiseEnPage.echelle_de_piece(sens, a.hauteurM, metres_par_case)
		groupe.add_child(_kit.get_node(nom).duplicate())
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


## Les instances groupées `nom` du maillage `mesh`, à la place de `maillage`, `nombre` instances chacune de sa couleur
## (`use_colors`, posé avant leur nombre), projetant l'ombre `ombre`, pour une pièce dont le centre est à `socle`
## au-dessus de son pied (`translation_d_instance`).
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
			var instance := Transform3D(Basis.IDENTITY, translation_d_instance(vu, ordre[rang]))
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


## La translation, dans `instances` (des instances groupées d'un maillage d'un groupe d'arêtes, dans l'arbre), de
## l'instance de l'arête `a` : là où ce maillage était quand sa pièce se posait au centre de l'arête
## (`MiseEnPage.centre_d_arete`, à son socle), lu par un témoin sans rotation ni échelle posé à ce centre sous `Aretes`.
func translation_d_instance(instances: MultiMeshInstance3D, a: Dictionary) -> Vector3:
	var temoin := Node3D.new()
	_aretes.add_child(temoin)
	temoin.position = MiseEnPage.centre_d_arete(Vector2(a.milieu.x, a.milieu.y), a.pied, metres_par_case, instances.get_meta("socle"))
	var translation := instances.to_local(temoin.to_global(_aretes.to_local(instances.global_position)))
	_aretes.remove_child(temoin)
	temoin.free()
	return translation


## La boîte de la pièce `piece` d'une arête : le seuil d'une porte ouverte ou d'une brèche, une porte fermée, sinon un
## mur.
func _boite(piece: String) -> BoxMesh:
	match piece:
		"porte-ouverte", "breche":
			return mesh_seuil
		"porte-fermee":
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
