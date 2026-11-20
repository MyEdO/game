extends SceneTree

## Les surfaces d'un décor à la prise seule, puis ses recettes peintes lorsqu'un fichier servi ne se lit pas (#4577).
const RECETTE_AUTONOME := true
const DECOR := "decor-de-recette"
const ELEMENT := "decor--fixture"
const FICHIER := "fixture-decor-absent.glb"
const SECOURS := {source = "partie", revision = 1}

var _erreurs := 0


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	var recette := {decor = DECOR, luminaire = true, matiere = "fixture--decor"}
	var prise := recette.merged({priseSeulement = true})
	var navire := {navire = "fixture", matiere = "fixture--navire"}
	var sol := {matiere = "fixture--sol"}
	var bloc := _geometrie("bloc", "prise", [prise, prise, navire, sol])
	var entier := _geometrie("bloc", "entier", [recette, recette, navire, sol])
	var toit := _geometrie("toit", "prise", [sol])
	var toit_entier := _geometrie("toit", "entier", [sol, recette])
	var cle_du_secours := JSON.stringify(SECOURS.merged({prop = DECOR}))
	var pont := PontFige.poser(self, {retablirDecors = {cle_du_secours: {ok = true, volume = [entier], toits = [toit_entier]}}})
	var index := {fichiers = {ELEMENT: {glb = FICHIER}}}
	MontageDeComposition.retenir_les_modeles(index, {forme = "glb"})
	var monde: Monde = (load("res://scenes/Monde.tscn") as PackedScene).instantiate()
	root.add_child(monde)
	var volume := monde.volume
	var modeles := MontageDesModeles.new()
	modeles.volume = volume
	modeles.chargeur = MontageDeComposition.new()
	modeles.add_child(modeles.chargeur)
	monde.add_child(modeles)
	var poses_emises: Array[bool] = []
	modeles.pose.connect(func() -> void: poses_emises.append(true))
	monde.poser(_manifeste(bloc, toit), {volume = [bloc], toits = [toit], couronnes = []})
	volume.cacher([], [toit.cle], [])
	var morceau: Node3D = volume.get_node("Volume/Morceaux/bloc")
	var forme: CollisionShape3D = volume.get_node("Volume/Corps/bloc")
	var nappe: Node3D = volume.get_node("Volume/Toits/toit")
	var masque_des_sols: Texture2D = volume.voile("temoin").get_shader_parameter("sols")
	await physics_frame
	await process_frame
	var au_dessus := Vector3(0.5, 6.0, 0.5)
	var dessus := Vector3(0.5, 1.0, 0.5)
	var a_l_ecran: Vector2 = monde.a_l_ecran(dessus)
	var par_le_sol: Variant = monde.sol_sous(au_dessus)
	var par_le_clic: Variant = monde.touche_sous(a_l_ecran)
	_verifier(par_le_sol != null and par_le_sol.case == Vector3i.ZERO and par_le_sol.lieu.is_equal_approx(dessus), "Le décor à la prise seule est touché par le rayon vertical.")
	_verifier(par_le_clic != null and par_le_clic.case == Vector3i.ZERO and par_le_clic.lieu.is_equal_approx(dessus), "Le décor à la prise seule est touché par le clic.")
	_verifier(_faces(morceau, "Vu") == 1 and _faces(morceau, "Ombre") == 1 and not morceau.has_node("OmbreDesLuminaires"), "Le décor à la prise seule est absent de la vue et de l’ombre.")
	var attributs: Array = morceau.get_node("Vu").mesh.surface_get_arrays(0)
	var couleur: Color = attributs[Mesh.ARRAY_COLOR][0]
	var normale: Vector3 = attributs[Mesh.ARRAY_NORMAL][0]
	var texel: Vector2 = attributs[Mesh.ARRAY_TEX_UV2][0]
	_verifier(couleur.is_equal_approx(Color.GREEN) and normale.dot(Vector3.UP) > 0.9999 and texel.is_equal_approx(Vector2(1, 3)), "Les attributs du sol gardent leur rang après un décor à la prise seule et une surface de navire filtrée : %s, %s, %s." % [couleur, normale, texel])
	var decors := {DECOR: {element = ELEMENT, palette = {}, caches = [], poses = [_pose("pose-a", 0), _pose("pose-b", 1)]}}
	pont.retient = true
	modeles.poser({}, decors, {}, 1.0)
	modeles.poser({}, decors, {}, 1.0)
	_verifier(pont.demandes.size() == 1 and pont.entrees.is_empty() and poses_emises.is_empty() and _faces(morceau, "Vu") == 1, "Les poses en vol partagent la lecture du modèle et attendent son résultat.")
	pont.relache.emit()
	await process_frame
	_verifier(pont.entrees == [cle_du_secours] and poses_emises.size() == 1 and modeles.poses().is_empty(), "Le fichier absent rétablit les deux poses par un seul appel et un seul signal.")
	_verifier(_faces(morceau, "Vu") == 3 and _faces(morceau, "Ombre") == 1 and _faces(morceau, "OmbreDesLuminaires") == 2, "La recette rétablit la vue et sépare l’ombre des luminaires.")
	_verifier(nappe == volume.get_node("Volume/Toits/toit") and not nappe.get_node("Vu").visible and _faces(nappe, "Ombre") == 2, "La nappe rétablie garde son retrait et retrouve l’ombre du décor.")
	_verifier(forme == volume.get_node("Volume/Corps/bloc") and masque_des_sols == volume.voile("temoin").get_shader_parameter("sols"), "Le repli garde la forme du rayon et la texture de sol du voile.")
	_verifier(_meme_touche(par_le_sol, monde.sol_sous(au_dessus)) and _meme_touche(par_le_clic, monde.touche_sous(a_l_ecran)), "Le rayon et le clic gardent la case et le point touchés après le repli.")
	modeles.poser({}, decors, {}, 1.0)
	_verifier(pont.demandes.size() == 1 and pont.entrees.size() == 1 and _faces(morceau, "Vu") == 3, "Une nouvelle pose du type rétabli garde ses recettes sans relire son modèle.")
	var publication := _manifeste(entier, toit_entier)
	_verifier(forme.get_meta("empreinte") == entier.empreinte and volume.manquants(publication) == {volume = [], toits = [], couronnes = []}, "La publication avec le décor rétabli retrouve les empreintes de la forme et du rendu posés.")
	MontageDeComposition.retenir_les_modeles(index.duplicate(), {forme = "glb"})
	var nouvelle := _manifeste(bloc, toit)
	nouvelle.monde.secoursDecors = {source = SECOURS.source, revision = SECOURS.revision + 1}
	_verifier(volume.manquants(nouvelle) == {volume = [bloc.cle], toits = [toit.cle], couronnes = []}, "La publication directe au nouvel index redemande la prise, après le repli.")
	monde.poser(nouvelle, {volume = [bloc], toits = [toit], couronnes = []})
	modeles.poser({}, decors, {}, 1.0)
	_verifier(pont.demandes.size() == 2 and _faces(volume.get_node("Volume/Morceaux/bloc"), "Vu") == 1, "Un nouvel index relit le modèle et ne peint plus ses primitives.")
	await physics_frame
	await process_frame
	_verifier(_meme_touche(par_le_sol, monde.sol_sous(au_dessus)) and _meme_touche(par_le_clic, monde.touche_sous(a_l_ecran)), "Le monde à nouveau compact garde la même prise.")
	modeles.vider()
	pont.relache.emit()
	await process_frame
	_verifier(pont.entrees.size() == 1 and poses_emises.size() == 1, "Une pose retirée pendant le chargement ne déclenche aucun repli.")
	monde.queue_free()
	await process_frame
	print("[decor-pris-et-retabli] deux poses, un repli, clic et sol stables, erreurs=", _erreurs)
	quit(0 if _erreurs == 0 else 1)


func _verifier(tenu: bool, message: String) -> void:
	if not tenu:
		_erreurs += 1
		push_error("[decor-pris-et-retabli] " + message)


static func _meme_touche(a: Variant, b: Variant) -> bool:
	return a != null and b != null and a.case == b.case and a.lieu.is_equal_approx(b.lieu)


static func _faces(noeud: Node3D, instance: String) -> int:
	return int(MiseEnPage.triangles(noeud.get_node(instance).mesh.get_faces().size()))


static func _pose(cle: String, x: int) -> Dictionary:
	return {cle = cle, ancre = {x = x, y = 0}, piedM = 1.0, cap = "S", case = {x = x, y = 0, z = 0}, luminaire = true}


static func _manifeste(bloc: Dictionary, toit: Dictionary) -> Dictionary:
	return {monde = {metresParCase = 1.0, hauteurs = [{z = 0, rangees = [[0.5, 0.0], [0.0, 0.0]]}], morceaux = [bloc], secoursDecors = SECOURS}, toits = [toit], couronnes = []}


static func _geometrie(cle: String, empreinte: String, faces: Array) -> Dictionary:
	var geometrie := {cle = cle, empreinte = empreinte, rangee = 2, positions = [], normales = [], couleurs = [], cases = [], surfaces = []}
	for i in faces.size():
		var x := float(i % 2)
		var y := floorf(i / 2.0)
		var h := 1.0 if i < 2 else 0.0
		geometrie.positions.append_array([x - 0.4, h, y - 0.4, x, h, y + 0.4, x + 0.4, h, y - 0.4])
		geometrie.cases.append_array([x, y, 0.0])
		var surface: Dictionary = faces[i].merged({debut = 3 * i, fin = 3 * (i + 1)})
		geometrie.surfaces.append(surface)
		if not surface.get("priseSeulement", false):
			var couleur := Color.GREEN if surface.matiere == "fixture--sol" else Color.RED
			var normale := [0.0, 0.0, -1.0] if surface.has("navire") else [0.0, 1.0, 0.0]
			for _sommet in 3:
				geometrie.normales.append_array(normale)
				geometrie.couleurs.append_array([couleur.r, couleur.g, couleur.b, couleur.a])
	return geometrie
