extends SceneTree

## La photo du studio des portraits ne dépend que du corps photographié (#3935, `scripts/studio_de_portraits.gd`) : sur
## le pont figé de l'atelier (`PontFige`, `hotes/godot/recettes/atelier.ts`, `figerLeRepos`), le même corps tenu à deux
## mains (une hallebarde, seconde prise) photographié par deux studios après deux histoires, l'un neuf, l'autre dont le
## corps a d'abord porté un autre corps, joué des images de son arbre d'états et quitté sa pose avant la refonte
## (`MontageDeComposition.refondre`). Le rendu headless ne publie aucune image (`frame_post_draw`) : chaque photo se juge,
## posée (`StudioDePortraits.Etape.PHOTO`), sur ce dont l'image est faite, au bit près : les liaisons de la fusion
## (`Skin`), la place de chaque `BoneAttachment3D` et la caméra.

const RECETTE_AUTONOME := true
const FIGE := "res://recettes/vues/repos.json"
const BASE := "humanoide"
const HALLEBARDE := "humanoide--rigide--hallebarde"
## Un gabarit qui abaisse le haut de la tête de la base (`gabarit` de `composer`).
const GABARIT := {racine = {os = "root", echelle = 0.74}, enfantsDe = {thigh_l = 0.62, calf_l = 0.62, thigh_r = 0.62, calf_r = 0.62}, pieds = ["foot_l", "foot_r"], jambes = ["thigh_l", "calf_l", "thigh_r", "calf_r"], clipsPlantes = []}
const CORPS := {base = BASE, gabarit = GABARIT, montes = [{ligne = "main", element = HALLEBARDE}]}
## Le corps porté avant `CORPS` dans la seconde histoire.
const AVANT := {base = BASE}
## Le pas (s) de l'horloge manuelle de l'arbre d'états du studio.
const PAS_S := 1.0 / 60.0
## Les images de l'arbre jouées dans la seconde histoire avant de vêtir `CORPS`.
const IMAGES_JOUEES := 37
## L'angle (rad) dont chaque os est tourné avant de vêtir `CORPS` : la pose qu'un clip joué avant aurait laissée.
const POSE_D_AVANT := 0.3
## Les images laissées à un habillage.
const IMAGES_D_ATTENTE := 600
## Les images laissées au squelette, la photo posée, pour publier sa pose aux attaches (`skeleton_updated`).
const IMAGES_DE_POSE := 3
var _fautes: Array[String] = []


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	print("[photo-du-studio] version=", Engine.get_version_info().string)
	var lu: Variant = JSON.parse_string(FileAccess.get_file_as_string(FIGE))
	if not lu is Dictionary:
		push_error("[photo-du-studio] %s : aucun atelier figé" % FIGE)
		quit(2)
		return
	PontFige.poser(self, lu)
	MontageDeComposition.retenir_les_modeles(lu.modeles, lu.listage)
	var neuf := await _studio()
	var photo_neuve := await _photo(neuf, CORPS)
	neuf.queue_free()
	await process_frame
	var vecu := await _studio()
	var combattant: Combattant = vecu.get_node("Monde/Combattant")
	combattant.vetir(AVANT)
	await _attendre(combattant.est_vetu)
	var arbre: AnimationTree = combattant.get_node("Etats")
	var squelette := (combattant.get_node("Modele") as MontageDeComposition).squelette
	for i in IMAGES_JOUEES:
		arbre.advance(PAS_S)
		await process_frame
	for os in squelette.get_bone_count():
		squelette.set_bone_pose_rotation(os, squelette.get_bone_pose_rotation(os) * Quaternion(Vector3.RIGHT, POSE_D_AVANT))
	var photo_vecue := await _photo(vecu, CORPS)
	vecu.queue_free()
	for partie in photo_neuve:
		if photo_neuve[partie] != photo_vecue.get(partie):
			_fautes.append("%s de la photo diffère après un autre corps et %d images jouées" % [partie, IMAGES_JOUEES])
	print("[photo-du-studio] %d liaisons, %d attaches comparées" % [photo_neuve.get("liaisons", []).size(), photo_neuve.get("attaches", []).size()])
	for faute in _fautes:
		push_error("[photo-du-studio] " + faute)
	print("[photo-du-studio] erreurs=", _fautes.size())
	quit(0 if _fautes.is_empty() else 1)


## Un studio posé dans l'arbre, l'arbre d'états de son corps sur l'horloge manuelle.
func _studio() -> StudioDePortraits:
	var studio: StudioDePortraits = (load("res://scenes/StudioDePortraits.tscn") as PackedScene).instantiate()
	root.add_child(studio)
	await process_frame
	(studio.get_node("Monde/Combattant/Etats") as AnimationTree).callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	return studio


## Ce dont est faite la photo de `corps` par `studio`, une fois posée : par liaison de la fusion son os et son repère,
## par `BoneAttachment3D` son os et sa place, et la place de la caméra.
func _photo(studio: StudioDePortraits, corps: Dictionary) -> Dictionary:
	studio.photographier(corps)
	await _attendre(func() -> bool: return studio._etape == StudioDePortraits.Etape.PHOTO)
	for i in IMAGES_DE_POSE:
		await process_frame
	var montage: MontageDeComposition = studio.get_node("Monde/Combattant/Modele")
	if studio._etape != StudioDePortraits.Etape.PHOTO or montage.fusion == null:
		_fautes.append("%s : aucune photo d'un corps fondu" % StudioDePortraits.cle(corps))
		return {}
	var liaisons := []
	for liaison in montage.fusion.skin.get_bind_count():
		liaisons.append([montage.fusion.skin.get_bind_name(liaison), montage.fusion.skin.get_bind_pose(liaison)])
	var attaches := []
	for attache: BoneAttachment3D in montage.find_children("*", "BoneAttachment3D", true, false):
		attaches.append([attache.bone_name, attache.global_transform])
	if corps == CORPS and montage.seconde_prise.is_empty():
		_fautes.append("%s : photo sans seconde prise" % StudioDePortraits.cle(corps))
	return {liaisons = liaisons, attaches = attaches, camera = (studio.get_node("Monde/Camera") as Camera3D).global_transform}


func _attendre(tenu: Callable) -> void:
	for i in IMAGES_D_ATTENTE:
		if tenu.call():
			return
		await process_frame
	_fautes.append("attente échue")
