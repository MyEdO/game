extends SceneTree

## Les poses des objets rangés d'une tenue (#4351, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D ») : l'évaluateur
## (`hotes/godot/asset/evaluer.mjs`) et le rendu de contrôle (`scripts/personnage-3d/rendu.py`) les demandent par
## `posesDesRanges` (`hotes/godot/asset/posesDesRanges.mjs`), que `poserLesRanges` de `hotes/godot/construire.mjs` lance
## par l'éditeur épinglé. Le montage du jeu (`MontageDeComposition`) pose la base, monte chaque élément et range chaque
## objet (`_ranger`), puis, à chaque instant demandé, pose le gabarit et les morphes, engage le clip à son instant et
## laisse le squelette se mettre à jour (`_suivre_les_poids`) : la transformation de chaque mesh rangé et montré se lit
## dans la scène, sans autre calcul.
##
## La commande, en JSON : `modeles`, la réponse de `modeles` sur les manifestes de la tenue ; `base`, l'id de sa base ;
## `fichiers`, par fichier de `modeles.fichiers`, le chemin du GLB à lire ; `montes`, les `montes` de `composer` ;
## `instants`, chacun `{ gabarit?, morphes, clip, t }` (`gabarit` et `morphes` de `composer`, `clip` vide au repos, qui
## se demande avant tout clip).
## La sortie, en JSON : `pieces`, chaque mesh rangé `{ ligne, mesh, offrant }` (la ligne de `montes` qui le monte, le nom
## de son nœud, l'élément monté qui offre son emplacement, vide si la base l'offre) ; `poses`, par instant, par pièce, sa transformation dans le repère de la base en 16 nombres, colonne par
## colonne, `null` si elle n'est pas montrée rangée à cet instant ; `erreurs`, celles du montage.
##
##   godot --headless --path <projet> --script res://outils/poses_des_ranges.gd -- <commande.json> <sortie.json>

## Les images laissées au squelette pour jouer ses modificateurs puis le suivi des poids, qui se branche en différé sur
## sa mise à jour (`MontageDeComposition.poser_le_modele`).
const IMAGES_DE_MISE_A_JOUR := 2


func _initialize() -> void:
	_poser.call_deferred()


func _poser() -> void:
	var arguments := OS.get_cmdline_user_args()
	var commande: Variant = JSON.parse_string(FileAccess.get_file_as_string(arguments[0])) if arguments.size() == 2 else null
	if not commande is Dictionary:
		push_error("[poses] commande illisible : %s" % " ".join(arguments))
		quit(2)
		return
	var erreurs: Array[String] = []
	MontageDeComposition.retenir_les_modeles(commande.modeles, {forme = "glb"})
	for fichier: String in commande.fichiers:
		var lecture := MontageDeComposition.Lecture.new()
		lecture.en_vol = false
		lecture.paquet = MontageDeComposition._paquet_lu(fichier, FileAccess.get_file_as_bytes(commande.fichiers[fichier]), lecture.erreurs)
		MontageDeComposition._lectures[fichier] = lecture
	var montage := MontageDeComposition.new()
	root.add_child(montage)
	montage.poser_le_modele(_base(commande.base), await montage.scene_du_modele(commande.base, erreurs))
	erreurs.append_array(montage.erreurs)
	montage.composee = {montes = commande.montes}
	var cibles := montage.cibles()
	if montage.squelette != null:
		for ligne: String in cibles:
			await montage.monter(ligne, cibles[ligne].element, erreurs)
	var lignes := {}
	for prise: String in montage._tenus_ranges:
		lignes[montage._tenus_ranges[prise].rangement] = prise
	var pieces := []
	var meshes: Array[MeshInstance3D] = []
	for ligne: String in montage._rangements:
		for rangee: Dictionary in montage._rangements[ligne]:
			pieces.append({ligne = lignes.get(ligne, ligne), mesh = String(rangee.piece.name), offrant = montage._offrant_du_point(montage._point(ligne))})
			meshes.append(rangee.piece)
	var poses := []
	for instant: Dictionary in commande.instants:
		montage.composee = {montes = commande.montes, gabarit = instant.get("gabarit", {}), morphes = instant.morphes}
		if instant.clip != "":
			montage.lecteur.play(instant.clip)
			montage.lecteur.pause()
			montage.lecteur.seek(instant.t, true)
		elif montage.lecteur != null and montage.lecteur.assigned_animation != "":
			erreurs.append("repos-apres-un-clip : le repos se demande avant tout clip, un lecteur ne se désengage pas")
		erreurs.append_array(montage.poser_le_gabarit().map(func(os: String) -> String: return "os-absent : %s" % os))
		montage.poser_les_morphes()
		for _image in IMAGES_DE_MISE_A_JOUR:
			await process_frame
		poses.append(meshes.map(func(mesh: MeshInstance3D) -> Variant: return _matrice(mesh.global_transform) if mesh.is_visible_in_tree() else null))
	var sortie := FileAccess.open(arguments[1], FileAccess.WRITE)
	if sortie == null:
		push_error("[poses] sortie illisible : %s" % arguments[1])
		quit(2)
		return
	sortie.store_string(JSON.stringify({pieces = pieces, poses = poses, erreurs = erreurs}, "", false, true))
	sortie.close()
	print("[poses] %d pièce(s) rangée(s), %d instant(s), %d erreur(s)" % [pieces.size(), poses.size(), erreurs.size()])
	quit(0)


## La base `id` de la réponse de `modeles` retenue, `{}` si elle ne la sert pas.
static func _base(id: String) -> Dictionary:
	for base: Dictionary in MontageDeComposition.modeles.bases:
		if base.id == id:
			return base
	return {}


## `repere` en 16 nombres, colonne par colonne (`Matrix4.fromArray` de three).
static func _matrice(repere: Transform3D) -> Array:
	var matrice := []
	for colonne: Vector3 in [repere.basis.x, repere.basis.y, repere.basis.z]:
		matrice.append_array([colonne.x, colonne.y, colonne.z, 0.0])
	matrice.append_array([repere.origin.x, repere.origin.y, repere.origin.z, 1.0])
	return matrice
