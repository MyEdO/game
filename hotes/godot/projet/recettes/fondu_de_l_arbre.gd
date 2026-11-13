class_name FonduDeLArbre
extends RefCounted

## Le fondu d'une action de l'atelier, relevé par ses recettes à l'horloge manuelle de l'arbre d'états (`EtatsDuCorps`,
## `ANIMATION_CALLBACK_MODE_PROCESS_MANUAL`, #4081) : `chemin-du-groupe.gd` (« Parcourir un chemin ») et
## `atelier-du-vehicule.gd` (« Attaquer »).

## Le pas (s) de l'horloge manuelle, et les images laissées à un état pour être gagné puis fondu.
const PAS_S := 1.0 / 60.0
const IMAGES_D_ATTENTE := 600


## Une image de l'horloge manuelle de `etats`, suivie d'une image de `arbre`.
static func pas(arbre: SceneTree, etats: EtatsDuCorps) -> void:
	etats.advance(PAS_S)
	await arbre.process_frame


## Les états quittés (`get_fading_from_node`), image après image de l'horloge de `etats`, depuis la première où l'état
## courant vaut `etat` jusqu'à la fin de son fondu ; vide si `etat` n'est pas gagné.
static func fondre(arbre: SceneTree, etats: EtatsDuCorps, etat: String) -> Array[String]:
	var quittes: Array[String] = []
	for i in IMAGES_D_ATTENTE:
		await pas(arbre, etats)
		if etats.lecture().get_current_node() != etat:
			continue
		quittes.append(etats.lecture().get_fading_from_node())
		if quittes[-1] == "":
			break
	return quittes


## L'horloge de `etats` avancée jusqu'à ce que l'atelier le débranche, l'action revenue au repos.
static func rendre(arbre: SceneTree, etats: EtatsDuCorps) -> void:
	for i in IMAGES_D_ATTENTE:
		if not etats.active:
			break
		await pas(arbre, etats)


## Si le fondu `quittes` (`fondre`) nomme `quitte` sur plusieurs images, puis se vide.
static func tenu(quittes: Array[String], quitte: String) -> bool:
	var fondues := quittes.count(quitte)
	return fondues >= 3 and quittes.slice(0, fondues).all(func(q: String) -> bool: return q == quitte) and quittes[-1] == ""
