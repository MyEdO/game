extends RecetteDuSalon

## L'invité de la coop à deux processus (#3009, `construire.mjs --coop`, avec `recettes/coop-hote.gd`), sur le noyau
## vivant et le relay local (`VITE_RELAY_URL`), le dossier `--echange=<dossier>` partagé avec l'hôte. « Jouer en ligne »
## de l'accueil, puis « Rejoindre » sur le code que l'hôte dit : assis, il lit « Hote » et « Invite (vous) » au
## panneau, sur la partie de l'hôte (P1). La barre de l'actif, spectatrice, s'ouvre quand l'hôte lui attribue le héros
## au tour (P2) ; sa fin du tour passe ce tour (P3). L'hôte fermant sa fenêtre, sa session finit sur « Coop : Partie
## fermée par l’hôte. », le panneau sans partie, sans jamais lire l'hôte déconnecté (P4). Assis dans la seconde room
## de l'hôte, le héros de nouveau à son siège, il ferme sa fenêtre : « Quitter le salon » part, le panneau sans partie
## rend les formulaires. Le code de
## sortie dit le verdict : 0 tenu, 1 une faute.

## La ligne d'une session que l'hôte ferme (`coop.reason`, raison du relay `server/src/room.ts`).
const FERMEE := "Coop : Partie fermée par l’hôte."
## La ligne de l'hôte parti sans quitter (`coop.invite.attente.hoteAbsent`).
const HOTE_ABSENT := "L'hôte est déconnecté — la partie reprendra à son retour."
var _echange := ""


func _initialize() -> void:
	_recetter.call_deferred()


func _recetter() -> void:
	_commencer("coop-invite")
	_echange = _pont.parametre("echange")
	if not await _attendre(func() -> bool: return _au_menu(), "l'accueil"):
		await _conclure()
		return
	_cliquer(_bouton("bouton/salon", "Jouer en ligne"))
	var code := await _entendre("code")
	if code != "" and await _s_asseoir(code, "P1") and await _p3() and await _p4():
		var seconde := await _entendre("seconde")
		if seconde != "" and await _s_asseoir(seconde, "seconde room") and await _entendre("attribue") != "":
			await _fermer()
	await _conclure()


## Rejoindre la room `code` du panneau sans partie, assis à la table sur la partie de l'hôte.
func _s_asseoir(code: String, etape: String) -> bool:
	if not await _attendre(func() -> bool: return _au_combat() and _bouton("formulaire/rejoindre", "Rejoindre") != null, "« Rejoindre » au panneau sans partie"):
		return false
	_rejoindre(code)
	if not await _attendre(func() -> bool: return _textes("Etat").slice(0, 3) == ["Partie " + code, "Hote", "Invite (vous)"] and _en_partie(), "assis à la table, la partie de l'hôte montrée"):
		return false
	print("[coop-invite] %s : %s" % [etape, _textes("Etat")])
	return true


## P2, puis P3 : la barre de l'actif, d'abord spectatrice, s'ouvre quand l'hôte lui attribue le héros au tour ; la fin
## du tour jouée, armée d'abord si l'Action reste, passe ce tour.
func _p3() -> bool:
	if not await _attendre(func() -> bool: return _barre() == "spectatrice", "la barre spectatrice avant l'attribution"):
		return false
	var temoin := FileAccess.open(_echange.path_join("spectatrice"), FileAccess.WRITE)
	if temoin == null:
		_fautes.append("P2 : impossible de signaler la barre spectatrice à l'hôte")
		return false
	temoin.close()
	if not await _attendre(func() -> bool: return _barre() == "ouverte" and _publie("bouton/fin-de-tour") != null, "la barre ouverte sur le héros attribué"):
		return false
	var heros: String = current_scene.get("_vue").projection.combat.actif.id
	print("[coop-invite] P2 : barre spectatrice, puis ouverte sur %s" % heros)
	_cliquer(_publie("bouton/fin-de-tour"))
	if not await _attendre(func() -> bool: return _actif() != heros or current_scene.get("_vue").projection.combat.finDeTourArmee, "la fin du tour armée ou jouée"):
		return false
	var gestes := 1
	if _actif() == heros:
		if not await _attendre(_publie_a_jour.bind("bouton/fin-de-tour"), "la fin du tour armée publiée à sa place"):
			return false
		_cliquer(_publie("bouton/fin-de-tour"))
		gestes = 2
		if not await _attendre(func() -> bool: return _actif() != heros, "le tour de %s passé" % heros):
			return false
	print("[coop-invite] P3 : le tour de %s fini en %d geste(s)" % [heros, gestes])
	return true


## Si le bouton publié de l'élément `element` est à sa place dans l'interface mise en page : aucune publication
## n'attend (`PublicationDeLEcran`), et l'écran que le combat publierait le porte au même point.
func _publie_a_jour(element: String) -> bool:
	if current_scene.get("_publication").get("_attendue"):
		return false
	var publie: Variant = _publie(element)
	for bouton: Dictionary in current_scene.call("_ecran_publie").boutons:
		if bouton.get("element") == element:
			return publie != null and publie.x == bouton.x and publie.y == bouton.y
	return false


## La forme de la barre de l'actif dans la vue montrée, `""` hors combat.
func _barre() -> String:
	var vue: Dictionary = current_scene.get("_vue")
	return "" if vue.is_empty() or vue.projection.combat == null else vue.projection.combat.barre.forme


## L'id de l'actif dans la vue montrée, `""` sans lui.
func _actif() -> String:
	var vue: Dictionary = current_scene.get("_vue")
	return "" if vue.is_empty() or vue.projection.combat == null or vue.projection.combat.actif == null else vue.projection.combat.actif.id


## La fenêtre fermée en session : « Quitter le salon » joué, le panneau sans partie rend les formulaires.
func _fermer() -> bool:
	var avant := _pont.appels.count("salon")
	root.propagate_notification(Node.NOTIFICATION_WM_CLOSE_REQUEST)
	_verifier(_pont.appels.count("salon") > avant, "la demande de fermeture en session n'appelle pas `salon`")
	if not await _attendre(func() -> bool: return _au_combat() and current_scene.get("_vue").is_empty() and _bouton("formulaire/rejoindre", "Rejoindre") != null, "le panneau sans partie après la fermeture"):
		return false
	print("[coop-invite] fermeture : « Quitter le salon » joué, %s" % [_textes("Journal")])
	return true


## P4 : l'hôte ferme sa fenêtre ; la session finit sur `FERMEE`, le panneau sans partie, jamais sur `HOTE_ABSENT`.
func _p4() -> bool:
	if not await _attendre(func() -> bool: return _textes("Etat").has(HOTE_ABSENT) or _textes("Journal").has(FERMEE), "la fin de la session par l'hôte"):
		return false
	_verifier(not _textes("Etat").has(HOTE_ABSENT), "P4 : l'hôte se lit déconnecté, pas parti : %s" % [_textes("Etat")])
	if not await _attendre(func() -> bool: return _au_combat() and current_scene.get("_vue").is_empty() and _bouton("formulaire/rejoindre", "Rejoindre") != null and _textes("Journal").has(FERMEE), "le panneau sans partie sur « %s »" % FERMEE):
		return false
	print("[coop-invite] P4 : %s, le panneau sans partie" % [_textes("Journal")])
	return _fautes.is_empty()


## Ce que l'hôte dit sous le nom `nom` du dossier d'échange, attendu ; `""` sur une faute.
func _entendre(nom: String) -> String:
	var fichier := _echange.path_join(nom)
	if not await _attendre(func() -> bool: return FileAccess.file_exists(fichier), "« %s » de l'hôte" % nom):
		return ""
	return FileAccess.get_file_as_string(fichier)
