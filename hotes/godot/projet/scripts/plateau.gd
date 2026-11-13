## Le plateau du jeu : sur le monde de la scène (`Monde`), sous le regard du plateau (`vue.plateau.regard`,
## `Monde.regarder`), sa caméra à la suite de l'actif du combat en vue, sinon du groupe (`Monde.suivre`), d'abord du
## premier combattant dessiné tant qu'elle ne suit rien, ou l'œil du meneur
## (`Immersion`, dont chaque case jouée part en clic), ses nappes de toit retirées (`toitsLeves`), ses arêtes retirées, abattues sous le cran de la caméra
## (`aretesDegagees`), et ses couronnes crénelées, tombées avec leur mur (`couronnesAbattues`, `Monde.cacher_le_bati`),
## chaque combattant que la vue nomme à sa case et sa couche (`voisins`, réconciliés par id : celui qu'elle ne nomme plus
## quitte l'arbre avec ses marques) ou, en exploration, le meneur du groupe à la case du groupe, à
## la station d'une case que le modèle d'un navire rogne (`Monde.poser_les_stations`), chacun sous son corps (`vue.corps`,
## aucun sous son `refus`), son véhicule (`vue.corps.vehicules`) et les marques de ses États (`vue.marques`,
## `MarquesDEtats`), les zones qui durent (`vue.zonesQuiDurent`, `ZonesQuiDurent`), chaque navire de la scène sous le modèle
## de son corps (`vue.corps.navires`, `MontageDesNavires`), sous tout regard, coupé sous les ponts que le regard
## retire (`plateau.coupesDesNavires`), sa mer bordée par sa coque (`VolumeDeScene.border_la_mer`), et chaque entité que l'exploration nomme (`exploration.entites`, aucune en combat) nommée à sa case, les surbrillances des cases
## que la vue peint (`vue.cases`), des cibles à la case que `vue.casesDesCibles` leur donne, en vue ou non, des entités nommées et de l'aperçu du premier clic, et la case sous le
## pointeur jusqu'au clic, chacun sur le sol de sa case ; aucun combattant sous l'œil de l'immersion ; les effets de chaque
## appel entre ses combattants (`Effets`), dont le chemin de chaque déplacement, que son combattant parcourt (#3822). Il ne rend que la
## case cliquée : celle que le monde désigne sous le pointeur, ou que l'œil franchit ou vise ; et, au clic droit, la
## case inspectée sous le pointeur. Il pose la caméra sur un cadrage sans rien jouer (`cadrer`).
class_name Plateau
extends Node3D

signal case_cliquee(case: Vector3i)
## Le clic droit sur une case, qui ouvre la fiche de son occupant.
signal case_inspectee(case: Vector3i)
## Le corps d'un combattant dessiné a changé (`Combattant.habille`), ou le modèle d'un navire s'est posé.
signal habille

## Les clés que lit le cadrage sous chaque regard (`cadrer`), `etage` seule facultative.
const CLES_DU_CADRAGE := {
	immersion = ["regard", "case", "etage", "lacet", "tangage"],
	tactique = ["regard", "case", "etage", "lacet", "zoom"],
	plateau = ["regard", "case", "etage", "lacet", "zoom"],
}

@export var scene_combattant: PackedScene

@onready var _monde: Monde = $Monde
@onready var _combattants: Node3D = $Combattants
@onready var _navires: MontageDesNavires = $Navires
@onready var _immersion: Immersion = $Immersion

## Les effets des appels, rendus au plateau (`Effets`).
var _effets := Effets.new()
## Les zones qui durent sur le plateau (`ZonesQuiDurent`).
var _zones := ZonesQuiDurent.new()
## Par id d'un combattant dessiné, les marques de ses États (`MarquesDEtats`).
var _marques: Dictionary = {}
var _modeles: Dictionary = {}
var _vue: Dictionary = {}
var _survol: Variant = null


func _ready() -> void:
	_monde.cadrage_change.connect(func() -> void: _survoler(_monde.case_sous(get_viewport().get_mouse_position())))
	_immersion.case_jouee.connect(case_cliquee.emit)
	_navires.pose.connect(habille.emit)
	_effets.name = "Effets"
	add_child(_effets)
	_zones.name = "ZonesQuiDurent"
	add_child(_zones)
	_effets.depart.connect(_agir)
	_effets.arrivee.connect(_subir)
	_effets.deplacement.connect(_parcourir)


## Montre la vue.
func montrer(vue: Dictionary) -> void:
	_vue = vue
	var combat: Variant = vue.projection.combat
	var exploration: Variant = vue.projection.exploration
	var actif: Variant = null if combat == null or combat.actif == null else combat.actif.id
	var dessines: Array = []
	if combat != null:
		dessines = combat.voisins.liste
	elif exploration != null:
		dessines = exploration.heros.slice(0, 1)
	_nommer_les_entites([] if exploration == null else exploration.entites.liste)
	if vue.plateau != null:
		_monde.regarder(vue.plateau.regard)
		_monde.poser_les_stations(vue.corps.navires)
		_monde.cacher_le_bati(vue.plateau.toitsLeves, vue.plateau.couronnesAbattues, vue.plateau.aretesDegagees)
		_combattants.visible = vue.plateau.regard != "immersion"
		var libre := _monde.lieu_suivi() == null
		var suivi: Array = dessines.filter(func(c: Dictionary) -> bool: return c.pos != null and (combat == null or libre or c.id == actif))
		if not suivi.is_empty():
			_monde.suivre(_lieu(suivi[0].pos))
	_immersion.montrer(vue)
	if vue.plateau != null:
		_navires.poser(vue.corps.navires, vue.plateau.coupesDesNavires, vue.plateau.metresParCase)
	var poses := {}
	for c in dessines:
		if c.pos == null:
			continue
		poses[c.id] = true
		var lieu := _lieu(c.pos)
		if not _modeles.has(c.id):
			var modele: Combattant = scene_combattant.instantiate()
			modele.position = lieu
			_combattants.add_child(modele)
			modele.habille.connect(habille.emit)
			_modeles[c.id] = modele
		_modeles[c.id].montrer(c, lieu, c.id == actif, null if vue.corps.refus != null else vue.corps.combattants.get(c.id), vue.corps.vehicules.get(c.id), vue.plateau.metresParCase)
		_marquer(c.id, lieu, vue.marques.get(c.id, []), vue.plateau.metresParCase)
	_retirer_hors_de(_modeles, poses)
	_retirer_hors_de(_marques, poses)
	if vue.plateau != null:
		_zones.poser(vue.zonesQuiDurent, func(case: Dictionary) -> Vector3: return _lieu([case.x, case.y, case.get("z", 0)]), vue.plateau.metresParCase)
	_peindre()


## Chaque nœud de `noeuds` (par id de combattant) dont l'id n'est pas l'un de `poses` retiré de l'arbre, avec ce qu'il
## porte.
static func _retirer_hors_de(noeuds: Dictionary, poses: Dictionary) -> void:
	for id: String in noeuds.keys():
		if not poses.has(id):
			noeuds[id].queue_free()
			noeuds.erase(id)


## Les marques `marques` des États du combattant `id`, posées au sol `lieu` de sa case.
func _marquer(id: String, lieu: Vector3, marques: Array, metres_par_case: float) -> void:
	if not _marques.has(id):
		var posees := MarquesDEtats.new()
		posees.name = "marques"
		_combattants.add_child(posees, true)
		_marques[id] = posees
	_marques[id].position = lieu
	_marques[id].montrer(marques, metres_par_case)


## Rend `effets` (`suite.effets`, `Effets.jouer`) entre les combattants dessinés et sur le sol des cases de chaque
## effet (`Effets.cases_de`) : l'auteur d'un coup, d'une incantation ou d'une zone se tourne vers sa cible et l'anime à son départ, la cible
## d'un coup qui touche l'accuse à son arrivée, un combattant dessiné qui se déplace parcourt son chemin.
func jouer_les_effets(effets: Array) -> void:
	if _vue.plateau == null:
		return
	var lieux := {}
	for id: String in _modeles:
		lieux[id] = _modeles[id].position
	for effet: Dictionary in effets:
		for case: Dictionary in Effets.cases_de(effet):
			lieux[Effets.cle_de_case(case)] = _lieu([case.x, case.y, case.get("z", 0)])
	_effets.jouer(effets, lieux, _vue.plateau.metresParCase)


## L'auteur `de` d'un effet, s'il est encore dessiné, se tourne vers `vers` et s'anime, sauf sur lui-même (un sort sur
## soi, un hurlement).
func _agir(de: String, vers: Vector3) -> void:
	if _modeles.has(de) and not _modeles[de].position.is_equal_approx(vers):
		_modeles[de].agir_vers(vers)


## La cible `vers` d'un coup qui touche, si elle est encore dessinée, accuse le coup.
func _subir(vers: String, touche: bool) -> void:
	if touche and _modeles.has(vers):
		_modeles[vers].subir()


## Le combattant `qui`, s'il est dessiné, parcourt `lieux`, chaque case à `metres` de la précédente (`Combattant.parcourir`).
func _parcourir(qui: String, lieux: Array, metres: Array) -> void:
	if _modeles.has(qui):
		_modeles[qui].parcourir(lieux, metres)


## Chaque entité de `entites` nommée au-dessus de sa case, à la place des précédentes (`Monde.etiqueter`).
func _nommer_les_entites(entites: Array) -> void:
	var noms := {}
	for e in entites:
		if e.nom != null:
			noms[Vector3i(int(e.pos[0]), int(e.pos[1]), int(e.pos[2]))] = e.nom
	_monde.etiqueter(noms)


## Les ids des navires de la scène dont le modèle est posé (`MontageDesNavires.poses`).
func navires() -> Array:
	return _navires.poses()


## La caméra posée sur le cadrage `cadrage` (`CONTRAT.md`, section « Écran publié », `wfrpCadrer`), sous le regard du
## plateau, sans rien jouer : en immersion, l'œil sur le sol de la case `case` (`{ x, y }`) de la couche `etage` (0 sans
## elle), à l'azimut `lacet` et au tangage `tangage`, en degrés (`Immersion.poser`) ; sous les regards `tactique` et
## `plateau`, la caméra sur le sol de cette case, regardant à l'azimut `lacet`, à la distance `zoom` (`Monde.cadrer`).
## Rend le refus d'un cadrage d'un autre regard, d'une clé hors de celles de son regard ou manquante, d'une case qui
## n'est pas une case du plateau à l'une de ses couches, d'un nombre hors de ses bornes, ou de l'œil hors d'exploration ;
## `""` une fois posé.
func cadrer(cadrage: Dictionary) -> String:
	var regard := _monde.regard()
	if cadrage.get("regard") != regard:
		return "le cadrage du regard %s sous le regard %s" % [cadrage.get("regard"), regard]
	var lues: Array = CLES_DU_CADRAGE[regard]
	for cle: String in cadrage:
		if not lues.has(cle):
			return "clé hors contrat : %s (sous le regard %s : %s)" % [cle, regard, ", ".join(PackedStringArray(lues))]
	for cle: String in lues:
		if cle != "etage" and not cadrage.has(cle):
			return "clé manquante : %s" % cle
	var case: Variant = cadrage.case
	var etage: Variant = cadrage.get("etage", 0)
	if not (case is Dictionary and case.size() == 2 and _entier(case.get("x")) and _entier(case.get("y")) and _entier(etage)):
		return "case { x, y } et etage entiers attendus : %s, %s" % [JSON.stringify(case), JSON.stringify(etage)]
	var ici := Vector3i(int(case.x), int(case.y), int(etage))
	if not Rect2i(Vector2i.ZERO, _monde.taille()).has_point(Vector2i(ici.x, ici.y)) or not _monde.couches().has(ici.z):
		return "case %s hors du plateau de %s cases aux couches %s" % [ici, _monde.taille(), _monde.couches()]
	for cle: String in ["lacet", "tangage", "zoom"]:
		if cadrage.has(cle) and not (cadrage[cle] is float or cadrage[cle] is int):
			return "%s : un nombre attendu, %s reçu" % [cle, JSON.stringify(cadrage[cle])]
	var lacet := MiseEnPage.lacet_de_l_azimut(cadrage.lacet)
	if regard != "immersion":
		return "" if _monde.cadrer(_lieu([ici.x, ici.y, ici.z]), lacet, cadrage.zoom) else "zoom %s hors de [%s, %s]" % [cadrage.zoom, Monde.DISTANCE_MIN, Monde.DISTANCE_MAX]
	var tangage := deg_to_rad(cadrage.tangage)
	if MiseEnPage.tangage_glisse(tangage, 0.0, -MiseEnPage.TANGAGE_DE_L_OEIL, MiseEnPage.TANGAGE_DE_L_OEIL) != tangage:
		return "tangage %s° hors de ±%s°" % [cadrage.tangage, rad_to_deg(MiseEnPage.TANGAGE_DE_L_OEIL)]
	return "" if _immersion.poser(ici, lacet, tangage) else "l'œil ne se pose qu'en exploration"


## Si `valeur` est un nombre entier.
static func _entier(valeur: Variant) -> bool:
	return (valeur is int or valeur is float) and int(valeur) == valeur


## La caméra du regard telle qu'elle est posée (`Monde.camera`).
func camera() -> Dictionary:
	return _monde.camera()


## Par id de combattant dessiné, ce que porte son corps (`Combattant.corps`).
func corps() -> Dictionary:
	var portes := {}
	for id in _modeles:
		portes[id] = _modeles[id].corps()
	return portes


## Le point de l'écran de la case de l'aperçu du premier clic (sa case, ou celle du combattant qu'il vise), `null` sans
## aperçu.
func point_de_l_apercu() -> Variant:
	var combat: Variant = _vue.get("projection", {}).get("combat")
	var apercu: Variant = null if combat == null else combat.apercu
	if apercu == null:
		return null
	var vises := _cases_des([apercu.cible])
	var case: Variant = apercu.case if vises.is_empty() else vises[0]
	if case == null:
		return null
	return _monde.a_l_ecran(_lieu(case))


## Le point de l'écran du sol de chaque case de chaque couche du plateau, par sa clé `x,y,z` (`Monde.points`).
func points() -> Dictionary:
	var points := {}
	for z: int in _monde.couches():
		var couche := _monde.points(z)
		for cle: String in couche:
			points["%s,%d" % [cle, z]] = couche[cle]
	return points


## Les cases (`[x, y, z]`) que `vue.casesDesCibles` donne aux cibles `ids`, en vue ou non ; un id nul n'en a aucune.
func _cases_des(ids: Array) -> Array:
	return ids.filter(func(id: Variant) -> bool: return id != null).map(func(id: String) -> Array: return _vue.casesDesCibles[id])


## Le monde de la scène (`monde`, la réponse de l'appel `monde`) sous le plateau : son volume, ses nappes de toit et
## ses couronnes crénelées (`Monde.poser`, les géométries reçues `recus`, réponse de `morceaux`), et sa météo
## (`Monde.poser_la_meteo`).
func poser_le_monde(monde: Dictionary, recus: Dictionary) -> void:
	_monde.poser(monde, recus)
	_monde.poser_la_meteo(monde.meteo)


## Où se tient l'occupant de la case `pos` (`[x, y, z]`, la case et sa couche) sur son sol (`Monde.lieu`).
func _lieu(pos: Array) -> Vector3:
	return _monde.lieu(Vector2i(int(pos[0]), int(pos[1])), int(pos[2]))


## Les cases peintes (`Monde.peindre`) : celles de la vue, les cibles, l'aperçu, les entités nommées de l'exploration, puis
## la case sous le pointeur, chacune à la place de celle qu'elle portait.
func _peindre() -> void:
	var plaques := {}
	var surligner := func(pos: Array, item: int) -> void: plaques[Vector3i(int(pos[0]), int(pos[1]), int(pos[2]))] = item
	for c in _vue.get("cases", []):
		surligner.call([c.case.x, c.case.y, c.case.get("z", 0)], Monde.ITEM_ATTEIGNABLE)
	var combat: Variant = _vue.get("projection", {}).get("combat")
	if combat != null:
		for case: Array in _cases_des(combat.cibles.liste):
			surligner.call(case, Monde.ITEM_CIBLE)
		var apercu: Variant = combat.apercu
		if apercu != null:
			for case: Array in _cases_des([apercu.cible]):
				surligner.call(case, Monde.ITEM_SURVOL)
		if apercu != null and apercu.case != null:
			surligner.call(apercu.case, Monde.ITEM_SURVOL)
	var exploration: Variant = _vue.get("projection", {}).get("exploration")
	if exploration != null:
		for e in exploration.entites.liste:
			if e.nom != null:
				surligner.call(e.pos, Monde.ITEM_CIBLE)
	if _survol != null:
		surligner.call([_survol.x, _survol.y, _survol.z], Monde.ITEM_SURVOL)
	_monde.peindre(plaques)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		_survoler(_monde.case_sous(event.position))
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var case: Variant = _monde.case_sous(event.position)
		_survol = null
		_peindre()
		if case != null:
			case_cliquee.emit(case)
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
		var case: Variant = _monde.case_sous(event.position)
		if case != null:
			case_inspectee.emit(case)
	else:
		return
	get_viewport().set_input_as_handled()


func _survoler(case: Variant) -> void:
	if case != _survol:
		_survol = case
		_peindre()


## @contrat Vue
## Le plateau coupe le modèle du navire un peu sous la hauteur de sa coupe (`plateau.coupesDesNavires`,
## `MontageDeVehicule.couper`, `MiseEnPage.hauteur_de_coupe`, `MARGE_DE_COUPE`, recette
## `projet/recettes/coupe-du-navire.gd`), la coupe ne changeant que ce que voit la caméra : son ombre reste celle du
## navire entier, pièces montées comprises (un double d'ombre seule de chaque mesh,
## `MontageDeVehicule._porter_la_hauteur`), et sous un pont coupé l'intérieur reste à l'ombre du pont du dessus.

## @contrat Vue
## Le jeu pose sa caméra sous le regard (`Monde.regarder`, la touche V passant au regard suivant), à la suite de
## l'actif du combat, sinon du groupe, dès que son lieu change ; tant qu'elle ne suit aucun lieu
## (`Monde.lieu_suivi`), elle prend le premier combattant dessiné ; ensuite, en combat, `combat.actif` nul (avant le
## premier tour, ou l'actif hors de la vue du groupe) la laisse où elle est ; en tactique et au plateau, elle pivote d'un quart de
## tour (A, E d'un AZERTY) ou librement (bouton du milieu tenu), zoome à la molette, glisse au clavier (`avant`,
## `arriere`, `gauche`, `droite`) et revient au lieu suivi (Origine) ; en immersion, l'œil du meneur, à la hauteur de
## l'œil de la case du sol sous lui, marche librement au clavier, court (Maj tenue), regarde à la souris captive
## (Échap la libère, un clic la reprend ; sur le Web, où le navigateur ne la capture qu'au geste du joueur, le premier
## clic la prend), et chaque case qu'il franchit ou qu'il vise au point de mire (E ou clic) se joue au clic du champ
## (`Immersion`), sans plaque de surbrillance au sol (`Monde.regarder`).

## @contrat Corps d'un combattant
## Le combat de Godot tire `GET modeles/listage.json` (section « Atelier 3D ») et appelle `modeles` avec ses
## `manifestes` et ses `osDesRigides` avant `demarrer`. Pour chaque corps de la vue, Godot charge la base sous
## `modeles/` (`fichiers` de la réponse de `modeles`, sous la `forme` du listage), la pose à l'échelle du plateau (un mètre du modèle vaut
## `1 / plateau.metresParCase` case) et lui pose son `gabarit`, ses silhouettes (`morphes`), ses `materiaux` et sa
## `palette` ; il pose les éléments de `montes` comme l'atelier les monte (section « Atelier 3D »), une entrée sans
## élément ne montant rien. L'emblème d'une entrée de `montes` se pose par `MontageDeComposition`
## (`projet/scripts/montage_de_composition.gd`), comme à l'atelier. Le corps est animé par un arbre d'états
## (`EtatsDuCorps`, le nœud `Etats` de `Combattant.tscn`, machine `projet/animation/corps.tres`, #3949) dont chaque état joue le
## clip de sa base qui tient son rôle (`clips` de la base, réponse de `modeles`) : `repos` en boucle, `marche` en boucle
## au déplacement, `tir` vers une cible si sa table en porte un clip, `melee` sinon, `coup` au coup reçu, `melee`, `tir`
## et `coup` revenant seuls au repos en fin de clip,
## `mort` hors de combat, sans retour ; chaque passage d'un état à un autre est un fondu, réglé dans l'éditeur. Tant que
## sa main libre tient la seconde prise d'un objet (section « Atelier 3D »), un rôle joue le clip de `clipsDeuxMains`
## sous le maniement de cet objet (`secondesPrises`), à défaut celui de `clips` (`MontageDeComposition.clip`) ; l'état
## en cours passe au clip de son rôle quand la tenue change (recette `projet/recettes/arbre-d-etats.gd`). Un combattant sans
## corps garde son anneau et son étiquette. Pour chaque véhicule de la vue (`vehicules`), Godot monte son corps sous le
## nœud `Vehicule` du combattant (`MontageDeVehicule`, `projet/scripts/montage_de_vehicule.gd`, que l'atelier monte de
## même) : il charge le GLB de son élément et le pose à la case du combattant, sur ses N×N cases depuis elle, son coin
## nord-ouest : à `taille` `reelle`, à l'échelle métrique du plateau, comme un corps ; à `taille` `empreinte`, sa plus
## grande dimension horizontale vaut N cases, quelle que soit son échelle d'auteur ; sa boîte est centrée sur
## l'empreinte et son origine reste au sol (`Combattant.poser_sur_l_empreinte`, recette
## `projet/recettes/vehicule-sur-empreinte.gd`). Il peint le véhicule de sa `palette` aux surfaces de son élément, et de
## son `embleme` (`MontageDeComposition.texture_de_l_embleme`) à ses surfaces `blason`, ses voiles et son pavillon (un
## emblème qu'aucune ne reçoit donne `blason-sans-surface`), avant d'y monter quoi que ce soit, et chaque pièce de sa
## palette, sans emblème (`MontageDeVehicule.peindre_l_element`, `MontageDeComposition.peindre`, recette
## `projet/recettes/peinture-du-vehicule.gd`). Il charge le GLB de l'élément de chacun de ses `postes` et le monte sous
## la scène du véhicule, à sa `position` dans le repère du véhicule, dont il prend l'échelle, son +Z tourné vers son
## `bord` (`MontageDeVehicule.monter_au_poste`, `MiseEnPage.LACETS_DES_BORDS` : tribord à droite d'une proue en +Z) ; il
## charge le GLB de l'élément de chacune de ses `ameliorations`, le peint de la `palette` du véhicule et le monte sous
## sa scène, à sa `position`, tourné comme le véhicule, ou, s'il porte `poste`, tourné vers son `bord` comme une pièce
## de ce poste, son nœud `montre` visible et son nœud `cache` caché (`MontageDeVehicule.monter_l_amelioration`, recette
## `projet/recettes/ameliorations-du-vehicule.gd`) ; il cache sous la scène du véhicule, pièces comprises, tout nœud
## dont le nom est l'un de `caches` (`MontageDeVehicule.cacher_selon`, même recette) ; puis le véhicule tourne autour du
## milieu de son empreinte, sa proue, le +Z de son repère, vers son `cap` (`Combattant.tourner_au_cap`, recette
## `projet/recettes/postes-du-vehicule.gd`). Un véhicule joue les clips de son élément par rôle (`clips`,
## `MontageDeVehicule.lecteur`) sous le même arbre d'états, comme un corps ceux de sa base : `repos` en boucle, `marche`
## en boucle au déplacement, et, vers une cible, le clip de son rôle d'attaque, `tir` si sa table en porte un, `melee`
## sinon, puis le repos en fin de clip
## (recette `projet/recettes/clips-du-vehicule.gd`). Pour chaque navire de la vue (`navires`), le plateau monte son
## `corps` sous son nœud `Navires` (`MontageDesNavires`, `projet/scripts/montage_des_navires.gd`, que l'éditeur monte de
## même : `MontageDeVehicule`, son GLB tiré par le montage `Navires/Chargeur`), peint, ses
## pièces et ses Améliorations montées et ses nœuds cachés comme un véhicule, sous tout regard ; sa scène nue à
## l'échelle métrique du plateau, sa proue, le +Z de son repère, tournée vers le `cap` de son corps
## (`MiseEnPage.lacet_de_proue`), son origine au point de la carte `centre`, à la hauteur 0 de la scène
## (`MontageDesNavires._placer`) ; un navire dont seul le `centre` change se repose sans se recharger ; un navire que la
## vue ne sert plus est retiré. `corps()` d'un combattant rapporte
## l'élément de son véhicule posé (`vehicule`), l'emblème posé sur lui (`embleme_du_vehicule`, `null` : aucun), ceux de
## ses pièces montées (`postes`) et ceux de ses Améliorations (`ameliorations`).
