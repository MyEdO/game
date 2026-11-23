extends SceneTree

## Les poses des objets rangés d'une tenue (#4351, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D ») : l'évaluateur
## (`hotes/godot/asset/evaluer.mjs`) et le rendu de contrôle (`scripts/personnage-3d/rendu.py`) les demandent par
## `posesDesRanges` (`hotes/godot/asset/posesDesRanges.mjs`), que `poserLesRanges` de `hotes/godot/construire.mjs` lance
## par l'éditeur épinglé. Le montage du jeu (`MontageDeComposition`) pose la base, y pose le gabarit et les morphes du
## premier instant, puis monte chaque élément et range chaque objet (`_ranger`), comme le personnage du jeu
## (`Combattant._composer`) ; à chaque instant demandé, il pose le gabarit et les morphes s'ils changent, engage le clip
## à son instant et laisse le squelette se mettre à jour (`_suivre_les_poids`) : la transformation de chaque mesh rangé
## et montré se lit dans la scène, sans autre calcul.
##
## La commande, en JSON : `modeles`, la réponse de `modeles` sur les manifestes de la tenue ; `base`, l'id de sa base ;
## `fichiers`, par fichier de `modeles.fichiers`, le chemin du GLB à lire ; `montes`, les `montes` de `composer` ;
## `instants`, un au moins, chacun `{ gabarit?, morphes, clip, t }` (`gabarit` et `morphes` de `composer`, `clip` vide
## au repos, qui se demande avant tout clip), le premier portant le corps sur lequel les objets se rangent.
## La sortie, en JSON : `pieces`, chaque mesh rangé `{ ligne, mesh, offrant, os }` (la ligne de `montes` qui le monte, le
## nom de son nœud, l'élément monté qui offre son emplacement, vide si la base l'offre, et l'os de cet emplacement) ; `poses`, par instant, par pièce,
## sa transformation dans le repère de la base en 16 nombres, colonne par colonne, `null` si elle n'est pas montrée
## rangée à cet instant. Une erreur du montage ou du relevé se dit en erreur,
## et le code de sortie vaut 1, comme à la fabrique des modèles (`outils/fabrique_de_modeles.gd`).
##
##   godot --headless --path <projet> --script res://outils/poses_des_ranges.gd -- <commande.json> <sortie.json>

## Les images laissées au squelette pour jouer ses modificateurs puis le suivi des poids, qui se branche en différé sur
## sa mise à jour (`MontageDeComposition.poser_le_modele`).
const IMAGES_DE_MISE_A_JOUR := 2


## Sans fenêtre qui dessine, Godot dort `OS.low_processor_usage_mode_sleep_usec` à chaque image (6,9 ms par défaut) :
## le relevé, qui attend `IMAGES_DE_MISE_A_JOUR` images par instant, tourne sans ce sommeil (#4743).
func _initialize() -> void:
	OS.low_processor_usage_mode_sleep_usec = 0
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
	var releve := {pieces = [], poses = []}
	if montage.squelette != null:
		await monter_sur_le_corps(montage, commande.montes, commande.instants[0], erreurs)
		releve = await relever(self, montage, commande.montes, commande.instants, erreurs)
	var sortie := FileAccess.open(arguments[1], FileAccess.WRITE)
	if sortie == null:
		push_error("[poses] sortie illisible : %s" % arguments[1])
		quit(2)
		return
	sortie.store_string(JSON.stringify(releve, "", false, true))
	sortie.close()
	for erreur in erreurs:
		push_error("[poses] " + erreur)
	print("[poses] %d pièce(s) rangée(s), %d instant(s), %d erreur(s)" % [releve.pieces.size(), releve.poses.size(), erreurs.size()])
	quit(0 if erreurs.is_empty() else 1)


## Le relevé des objets rangés de `montage`, monté dans `arbre`, sous les `montes` de sa composition : `pieces`, chaque
## mesh rangé (`ligne`, `mesh`, `offrant`, `os`), et `poses`, par instant d'`instants`, la transformation de chacun (`_matrice`),
## `null` s'il n'est pas montré rangé. À chaque instant, le clip s'engage en pause à son instant, le gabarit et les
## morphes se posent s'ils ne sont pas ceux que `montage` a retenus (`_poser_le_corps`, les poser refond les pièces), et
## le squelette joue `IMAGES_DE_MISE_A_JOUR` images ; un repos demandé après un clip et un clip que la base n'a pas vont
## à `erreurs`.
static func relever(arbre: SceneTree, montage: MontageDeComposition, montes: Array, instants: Array, erreurs: Array[String]) -> Dictionary:
	var lignes := {}
	for prise: String in montage._tenus_ranges:
		lignes[montage._tenus_ranges[prise].rangement] = prise
	var pieces := []
	var meshes: Array[MeshInstance3D] = []
	for ligne: String in montage._rangements:
		for rangee: Dictionary in montage._rangements[ligne]:
			var point := montage._point(ligne)
			pieces.append({ligne = lignes.get(ligne, ligne), mesh = String(rangee.piece.name), offrant = montage._offrant_du_point(point),
				os = montage._attache_du_point(point).get("os", "")})
			meshes.append(rangee.piece)
	var poses := []
	for instant: Dictionary in instants:
		if instant.clip != "" and (montage.lecteur == null or not montage.lecteur.has_animation(instant.clip)):
			erreurs.append("clip-absent : %s" % instant.clip)
		elif instant.clip != "":
			montage.lecteur.play(instant.clip)
			montage.lecteur.pause()
			montage.lecteur.seek(instant.t, true)
		elif montage.lecteur != null and montage.lecteur.assigned_animation != "":
			erreurs.append("repos-apres-un-clip : le repos se demande avant tout clip, un lecteur ne se désengage pas")
		if _corps_de(montes, instant) != montage.composee:
			_poser_le_corps(montage, montes, instant, erreurs)
		for _image in IMAGES_DE_MISE_A_JOUR:
			await arbre.process_frame
		poses.append(meshes.map(func(mesh: MeshInstance3D) -> Variant: return _matrice(mesh.global_transform) if mesh.is_visible_in_tree() else null))
	return {pieces = pieces, poses = poses}


## Sur `montage`, le corps de l'instant `instant` posé (`_poser_le_corps`), puis chaque cible des `montes` montée, qui
## range ses objets sur ce corps, comme le personnage du jeu (`Combattant._composer`) ; les erreurs vont à `erreurs`.
static func monter_sur_le_corps(montage: MontageDeComposition, montes: Array, instant: Dictionary, erreurs: Array[String]) -> void:
	_poser_le_corps(montage, montes, instant, erreurs)
	var cibles := montage.cibles()
	for ligne: String in cibles:
		await montage.monter(ligne, cibles[ligne].element, erreurs)


## La composition des `montes` au corps de l'instant `instant` : son gabarit (aucun s'il n'en a pas) et ses morphes.
static func _corps_de(montes: Array, instant: Dictionary) -> Dictionary:
	return {montes = montes, gabarit = instant.get("gabarit", {}), morphes = instant.morphes}


## La composition `_corps_de(montes, instant)` retenue par `montage`, son gabarit et ses morphes posés ; chaque os du
## gabarit que la base n'a pas va à `erreurs`.
static func _poser_le_corps(montage: MontageDeComposition, montes: Array, instant: Dictionary, erreurs: Array[String]) -> void:
	montage.composee = _corps_de(montes, instant)
	erreurs.append_array(montage.poser_le_gabarit().map(func(os: String) -> String: return "os-absent : %s" % os))
	montage.poser_les_morphes()


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
