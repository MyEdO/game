extends RecetteDuSalon

## L'hôte de la coop à deux processus (#3009, `construire.mjs --coop`, avec `recettes/coop-invite.gd`), sur le noyau
## vivant et le relay local (`VITE_RELAY_URL`), le dossier `--echange=<dossier>` partagé avec l'invité. Le scénario
## `SCENARIO` lancé, son premier round commencé : hors salon, la demande de fermeture de la fenêtre n'appelle pas
## `salon` (P5). « Héberger » ouvre la room : « Partie <code> » se lit au panneau, le code passe à l'invité, puis
## l'invité assis se lit sous son nom à côté de « Hote (vous) » (P1). La valeur du siège de l'invité pressée sur le
## héros au tour se relit pressée (P2) ; la fin du tour que l'invité joue passe le tour de ce héros (P3). La demande de
## fermeture en session joue « Quitter le salon » (P4). Une seconde room ouverte, l'invité assis et le héros de nouveau
## à son siège, l'invité ferme sa fenêtre : son siège quitte la table, sans reconnexion, et le héros revient à l'hôte.
## La demande de fermeture joue de nouveau « Quitter le salon », puis, le pont retiré de l'arbre, son processus sort de
## lui-même en 0 (P4). Le code de sortie dit le verdict : 0 tenu, 1 une faute.

## Le scénario de test que l'hôte joue : un combat d'entrée, des héros au groupe.
const SCENARIO := "dome"
var _echange := ""
## Le code de la room ouverte.
var _code := ""
## La rangée de `salon.sieges` du héros attribué à l'invité (`heros/<id>`).
var _heros := ""


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	_commencer("coop-hote")
	_echange = _pont.parametre("echange")
	if await _ouvrir_la_partie() and await _p5() and await _heberger("code") and await _p2() and await _p3() and _quitter("P4"):
		_panneau().relire()
		if await _heberger("seconde") and await _fermeture_de_l_invite() and _quitter("P4, seconde room"):
			await _sortie_du_processus()
	await _conclure()


## Le scénario `SCENARIO` lancé du panneau des scénarios, son premier round commencé, un héros au tour.
func _ouvrir_la_partie() -> bool:
	change_scene_to_file(COMBAT)
	if not await _attendre(func() -> bool: return _publie("bouton/lancer/" + SCENARIO) != null, "« %s » au panneau des scénarios" % SCENARIO):
		return false
	_cliquer(_publie("bouton/lancer/" + SCENARIO))
	if not await _attendre(func() -> bool: return _en_partie() and _publie("bouton/fenetreValider@debutDuRound") != null, "« Commencer le round »"):
		return false
	_cliquer(_publie("bouton/fenetreValider@debutDuRound"))
	if not await _attendre(func() -> bool: return _heros_au_tour() != "", "un héros au tour"):
		return false
	print("[coop-hote] %s lancé, %s au tour" % [SCENARIO, _heros_au_tour()])
	return true


## P5 : hors salon, la demande de fermeture de la fenêtre n'appelle pas `salon`.
func _p5() -> bool:
	var avant := _pont.appels.count("salon")
	root.propagate_notification(Node.NOTIFICATION_WM_CLOSE_REQUEST)
	_verifier(_pont.appels.count("salon") == avant, "P5 : la demande de fermeture hors salon appelle `salon`")
	print("[coop-hote] P5 : hors salon, %d appel de `salon` à la demande de fermeture" % (_pont.appels.count("salon") - avant))
	return true


## P1 : une room ouverte au panneau, son code dit à l'invité sous `nom`, l'invité assis.
func _heberger(nom: String) -> bool:
	if not _panneau().racine().visible and (not await _frais() or not await _presser_au_menu("salon")):
		return false
	if not await _attendre(func() -> bool: return _bouton("formulaire/heberger", "Héberger") != null, "« Héberger » offert"):
		return false
	_saisir("heberger/nom", "Hote")
	_cliquer(_bouton("formulaire/heberger", "Héberger"))
	if not await _attendre(func() -> bool: return not _textes("Etat").is_empty() and _textes("Etat")[0].begins_with("Partie "), "« Partie <code> » au panneau"):
		return false
	_code = _textes("Etat")[0].trim_prefix("Partie ")
	_dire(nom, _code)
	if not await _attendre(func() -> bool: return _textes("Etat") == ["Partie " + _code, "Hote (vous)", "Invite"], "l'invité assis à la table"):
		return false
	print("[coop-hote] P1 (%s) : %s" % [nom, _textes("Etat")])
	return true


## P2 : la valeur du siège de l'invité pressée sur le héros au tour, relue pressée.
func _p2() -> bool:
	_heros = "heros/" + _heros_au_tour()
	if not await _attribuer():
		return false
	print("[coop-hote] P2 : %s attribué au siège 1, relu pressé" % _heros)
	return true


## La valeur du siège de l'invité pressée sur `_heros`, relue pressée.
func _attribuer() -> bool:
	var valeur := "bouton/%s/1" % _heros
	if not await _attendre(func() -> bool: return _publie(valeur) != null, "la valeur %s publiée" % valeur):
		return false
	_cliquer(_publie(valeur))
	return await _attendre(func() -> bool: return _presse(_heros, 1) and not _presse(_heros, 0), "%s relu pressé au siège de l'invité" % _heros)


## P3 : la fin du tour que joue l'invité passe le tour de son héros chez l'hôte.
func _p3() -> bool:
	if not await _attendre(func() -> bool: return "heros/" + _heros_au_tour() != _heros, "le tour de %s passé par l'invité" % _heros):
		return false
	print("[coop-hote] P3 : le tour de %s passé par l'invité, au tour : %s" % [_heros, current_scene.get("_vue").projection.combat.actif.nom])
	return true


## `_heros` attribué de nouveau à l'invité, qui le sait, puis ferme sa fenêtre : son siège quitte la table, sans
## reconnexion, et le héros revient à l'hôte.
func _fermeture_de_l_invite() -> bool:
	if not await _attribuer():
		return false
	_dire("attribue", _heros)
	if not await _attendre(func() -> bool: return _textes("Etat") == ["Partie " + _code, "Hote (vous)"] and _presse(_heros, 0), "le siège de l'invité libéré, sans reconnexion, %s rendu à l'hôte" % _heros):
		return false
	print("[coop-hote] fermeture de l'invité : %s, %s rendu à l'hôte" % [_textes("Etat"), _heros])
	return true


## P4 : la demande de fermeture de la fenêtre en session joue « Quitter le salon », une fois, accepté.
func _quitter(etape: String) -> bool:
	var avant := _pont.appels.count("salon")
	root.propagate_notification(Node.NOTIFICATION_WM_CLOSE_REQUEST)
	_verifier(_pont.appels.count("salon") > avant, "%s : la demande de fermeture en session n'appelle pas `salon`" % etape)
	_verifier(_pont.reponses.salon.get("ok") == true and not _pont.reponses.salon.zones["salon.gestes"].any(func(g: Dictionary) -> bool: return g.get("jeu") == PanneauDuSalon.QUITTER), "%s : « Quitter le salon » sans effet : %s" % [etape, JSON.stringify(_pont.reponses.salon).left(200)])
	if not _fautes.is_empty():
		return false
	print("[coop-hote] %s : « Quitter le salon » joué à la demande de fermeture" % etape)
	return true


## P4 : le pont retiré de l'arbre, la scène d'abord, sa publication finie, son processus sort de lui-même en 0.
func _sortie_du_processus() -> void:
	if not await _attendre(func() -> bool: return not current_scene.get("_publication").get("_attendue"), "l'écran publié"):
		return
	unload_current_scene()
	await process_frame
	var pid: int = _pont.get("_transport").get("_pid")
	var debut := Time.get_ticks_msec()
	root.remove_child(_pont)
	var code := OS.get_process_exit_code(pid)
	print("[coop-hote] P4 : le pont retiré de l'arbre, son processus sorti en %d ms, code %d" % [Time.get_ticks_msec() - debut, code])
	_verifier(not OS.is_process_running(pid) and code == 0, "P4 : le processus du pont ne sort pas de lui-même en 0 (code %d)" % code)
	_pont.free()


## L'id du héros au tour dans la vue montrée, `""` hors du tour d'un héros.
func _heros_au_tour() -> String:
	var vue: Dictionary = current_scene.get("_vue")
	if vue.is_empty() or vue.projection.combat == null or vue.projection.combat.actif == null:
		return ""
	var actif: Dictionary = vue.projection.combat.actif
	return actif.id if actif.camp == "heros" else ""


## Si la valeur du héros `heros` au siège `siege` se relit pressée dans les dernières zones de `salon`.
func _presse(heros: String, siege: int) -> bool:
	for rangee: Dictionary in _pont.reponses.salon.zones["salon.sieges"]:
		if rangee.id == heros:
			return rangee.valeurs.any(func(v: Dictionary) -> bool: return v.id == "%s/%d" % [heros, siege] and v.presse)
	return false


## `texte` dit à l'invité sous le nom `nom` du dossier d'échange.
func _dire(nom: String, texte: String) -> void:
	var brouillon := _echange.path_join(nom + ".brouillon")
	FileAccess.open(brouillon, FileAccess.WRITE).store_string(texte)
	DirAccess.rename_absolute(brouillon, _echange.path_join(nom))
