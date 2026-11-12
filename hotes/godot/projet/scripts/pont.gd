## Le seul point de contact avec le noyau (`hotes/godot/pont/CONTRAT.md`), par le transport de son lieu (`Transport`) : la
## page de l'export Web (`TransportDeLaPage`) ou un processus Node (`TransportDuProcessus`) ; dont le fichier que le joueur
## choisit sur son disque (`choisir_un_fichier`), celui qu'il y enregistre (`enregistrer_un_fichier`), la pile des couches d'une tenue (`resoudre_la_pile`), les requêtes au
## serveur du jeu (`requeter`), ce que l'écran porte (`publier_l_ecran`, retenu dans `ecran`) et ce que Godot expose
## (`exposer`).
## Un appel envoie le nom d'une méthode et une chaîne JSON, et rend la réponse décodée ; une réponse `ok: false` est un
## refus, que `refus` porte ; une réponse illisible ou une erreur de la page (`erreursGlobales`) est une panne.
## Chargé en autoload `Pont` (`project.godot`).
class_name PontDuNoyau
extends Node

signal refus(message: String)
signal panne(message: String)

## Le plus long silence du réseau qu'un téléchargement tolère, compté par un `Timer` en temps de l'arbre : le délai
## repart à chaque bloc reçu, car la durée d'un téléchargement suit la fréquence d'image (#3470).
const SILENCE_S := 10.0
## Le plus grand bloc que HTTPRequest lit par image. Sur le Web, une image lit au plus un bloc du flux de la page
## (`platform/web/js/libs/library_godot_fetch.js`, `godot_js_fetch_read_chunk`, Godot 4.7-stable), jusqu'à 2 Mio
## mesurés : un GLB de base de 42 Mo s'y reçoit en une vingtaine d'images (#3470), pas en plus de 600 par 64 Kio.
const BLOC_DE_TELECHARGEMENT := 16777216

## Un genre de fichier que le joueur choisit ou enregistre : `accepte`, ce que le champ de fichier de la page admet ;
## `filtre`, celui du dialogue du système ; `type`, le type MIME du fichier remis par la page.
const IMAGES := {accepte = "image/png,image/jpeg,image/webp", filtre = "*.png, *.jpg, *.jpeg, *.webp ; Images PNG, JPEG ou WebP"}
const HEROS := {accepte = ".json,application/json", filtre = "*.json ; Personnage exporté", type = "application/json"}

## Le paramètre (`parametre`) que la recette pose à `1` (`hotes/godot/recette.mjs`, `en_recette`).
const PARAMETRE_DE_RECETTE := "recette"

## Si la partie à démarrer est la scène que l'éditeur a mise à l'essai (`demarrer { essai }`), plutôt que le scénario du
## paramètre `scenario`.
var essai := false
## Si la partie à ouvrir est une partie au groupe (`ouvrir`), que le joueur compose puis lance sur une campagne du jeu
## (`lancer`), plutôt qu'un scénario de test : « Jouer » de l'accueil le pose.
var au_groupe := false
## Si le combat s'ouvre sur les sauvegardes à charger (`sauvegardes`), sans partie : « Reprendre » de l'accueil le pose.
var reprise := false
## L'emplacement de la sauvegarde que le combat charge à son ouverture (`charger`), `null` sans chargement demandé.
var a_charger: Variant = null
## Si une recette pilote le jeu (`PARAMETRE_DE_RECETTE`) : l'écran se publie (`publier_l_ecran`), une image ne se dessine
## que si l'écran a changé (`OS.low_processor_usage_mode`), sans anticrénelage multiéchantillon (`Viewport.msaa_3d`), car
## dans l'export Web chaque image tient le fil de la page où la recette lit l'écran publié et où arrive chacun de ses
## gestes.
var en_recette := false
## Le dernier écran publié (`publier_l_ecran`).
var ecran: Dictionary = {}
var _transport: Transport


## Ce que fait le lieu du noyau, la page ou un processus : chaque lieu, une classe qui l'étend.
@abstract class Transport extends Node:
	## Une panne du lieu, que la façade signale (`PontDuNoyau.panne`).
	signal panne(message: String)

	## Le lieu ouvert, au premier appel : `true` prêt, `false` sa panne signalée.
	@abstract func ouvrir() -> bool

	## Si le lieu est ouvert et vivant : un appel y reçoit sa réponse.
	@abstract func est_ouvert() -> bool

	## La réponse de `methode` sur `json` (la chaîne JSON de l'entrée, ou `null`), la chaîne JSON que rend
	## `wfrpPont.appelerEnOctets` ; `null`, sa panne signalée.
	@abstract func appeler(methode: String, json: Variant) -> Variant

	## Les octets de la dernière réponse d'`appeler`, lus quand elle porte `octets`.
	@abstract func octets() -> PackedByteArray

	## La réponse à la pile des couches `demande`, une chaîne JSON, attendue sans tenir l'image ; `null`, sa panne
	## signalée.
	@abstract func resoudre_la_pile(demande: String) -> Variant

	## `valeur` publiée sous `nom`, pour qui pilote le lieu.
	@abstract func publier(nom: String, valeur: Variant) -> void

	## `rappel` exposé sous `nom` à qui pilote le lieu : chaque appel lui passe son entrée, une chaîne, et `rendre`, le
	## `Callable` qui reçoit sa réponse, une chaîne.
	@abstract func exposer(nom: String, rappel: Callable) -> void

	@abstract func adresse(relative: String) -> String

	@abstract func choisir_un_fichier(genre: Dictionary) -> Dictionary

	@abstract func enregistrer_un_fichier(genre: Dictionary, nom: String, texte: String) -> void

	@abstract func parametre(cle: String) -> String


func _ready() -> void:
	_transport = TransportDeLaPage.new() if OS.has_feature("web") else TransportDuProcessus.new()
	_transport.panne.connect(_signaler)
	add_child(_transport)
	if parametre(PARAMETRE_DE_RECETTE) == "1":
		en_recette = true
		OS.low_processor_usage_mode = true
		get_viewport().msaa_3d = Viewport.MSAA_DISABLED


## Si le lieu du noyau est ouvert (`Transport.est_ouvert`).
func est_pret() -> bool:
	return _transport.est_ouvert()


## Le pont rejoint par un écran : chaque refus rendu à `au_refus` (son message), chaque panne à `a_la_panne`, chacun abonné
## une fois et désabonné à la libération de son objet ; `true` une fois le lieu du noyau ouvert et les volumes posés
## (`regler_les_volumes`), `false` (la panne signalée) s'il ne s'ouvre pas.
func rejoindre(au_refus: Callable, a_la_panne: Callable) -> bool:
	if not refus.is_connected(au_refus):
		refus.connect(au_refus)
	if not panne.is_connected(a_la_panne):
		panne.connect(a_la_panne)
	if not await _transport.ouvrir():
		return false
	regler_les_volumes()
	return true


## @contrat Effets
## Les volumes du joueur se posent sur les bus d'`AudioServer` (`projet/default_bus_layout.tres`) :
## `PontDuNoyau.regler_les_volumes` lit la méthode `preferences` et pose sur chaque bus dont la préférence
## `volume-<nom du bus>` existe sa valeur (de 0 à 1, `AudioServer.set_bus_volume_linear`) ; les bus `Master` et
## `musique-jouee` n'en ont aucune. `rejoindre` l'appelle une fois le lieu du noyau ouvert, le panneau des réglages
## après chaque réglage (`projet/scripts/reglages.gd`). La recette `projet/recettes/mixage.gd` le vérifie.

## Le volume de chaque bus d'`AudioServer` dont la préférence `volume-<nom du bus>` existe (méthode `preferences`), posé
## à sa valeur ; rien si l'appel ne rend pas `ok`.
func regler_les_volumes() -> void:
	var reponse := appeler("preferences")
	if reponse.get("ok") != true:
		return
	for bus in AudioServer.bus_count:
		var cle := "volume-%s" % AudioServer.get_bus_name(bus)
		if reponse.preferences.has(cle):
			AudioServer.set_bus_volume_linear(bus, reponse.preferences[cle])


## La réponse de `methode` sur `entree` (un objet, ou `null` sans entrée) : décodée, `ok` vrai ou faux, chaque tableau
## passé en octets recollé (`_recoller`) ; `{}` en panne.
func appeler(methode: String, entree: Variant = null) -> Dictionary:
	var reponse := _decoder(methode, _transport.appeler(methode, null if entree == null else JSON.stringify(entree)))
	if reponse.has("octets"):
		_recoller(reponse, _transport.octets())
	if reponse.get("ok") == false:
		refus.emit(str(reponse.erreur.message))
	var releve := _decoder("erreursGlobales", _transport.appeler("erreursGlobales", null))
	for e in releve.get("erreurs", []):
		_signaler("%s (%s)" % [e.message, e.source])
	return reponse


## @contrat Écran publié
## Sous une recette seulement (la page ouverte avec `?recette=1`, `PontDuNoyau.en_recette`), chaque vue mise en page,
## Godot pose `globalThis.wfrpEcran` ; hors recette, il ne publie rien et ne calcule rien de ce qu'il publierait
## (#3947). Chaque publication remplace l'objet. À l’atelier, la lecture d’un clip renouvelle aussi cette publication à
## chaque image, après mise en page, sans remesurer `peaux`.
##
## - Au menu : `{ boutons: { texte, x, y }[] }`, le texte et le centre de chaque bouton actif.
## - Au combat : `{ boutons: { texte, x, y, element?, choix?, ids?, retenu? }[], cases: Record<"x,y,z", [x, y]>,
##   glisse: boolean, fondu: boolean, cadre: [x, y, largeur, hauteur], corps: Record<string, { base: string, elements: string[],
##   emblemes: Record<string, string>, couleurs: Record<string, Record<string, string>> }>, navires: string[] }`,
##   plus le point de l'écran du sol de chaque case de chaque couche du plateau, à l'écran ou non, si la caméra
##   glisse vers un lieu ou pivote (`Monde.glisse` : publié au départ du glissé, où les points de `cases` sont encore
##   ceux d'avant, puis à sa fin, où ils tiennent), si la vision posée se fond encore depuis celle d'avant
##   (`VolumeDeScene.part_du_fondu` : publié à la vue qui la pose, puis à la fin du fondu), la part de l'écran où le
##   monde se voit, que l'interface ne couvre pas (`Monde.cadre`, vide avant la première mise en page), les ids des
##   navires de la scène dont le modèle est posé (`Plateau.navires`), republiés à chaque modèle posé, et, par id de
##   combattant dessiné avec un corps, sa base, les ids des éléments montés, par ligne de `montes`, l'id de
##   l'emblème posé, et `couleurs`, comme à l'atelier, par emplacement monté dont une surface a un matériau propre,
##   la couleur d'albédo `#rrggbb` de ce matériau, par nom du matériau du GLB
##   (`MontageDeComposition.couleurs_posees`).
##   `element` est l'élément de la vue que dessine le composant qui porte le bouton, `"<type>/<id>"` (`bouton/fin-de-tour`
##   pour une offre, `bouton/<clé du geste>` pour un geste de la fenêtre, `bouton/<clé du geste>/<n>` pour la n-ième
##   valeur d'un choix) ; une liste déroulante publie aussi `choix`, `ids`, `retenu`, `ouverte` et `designe`, comme à
##   l'atelier.
## - À l'éditeur : `{ boutons: { texte, x, y, element?, choix?, ids?, retenu? }[], saisies: { texte, x, y, element? }[],
##   panneau: { valeur, contenu, page, haut, bas, boutons, saisies }, cases: Record<"x,y", [x, y]>, editeur: { zones, surcouche, aretes,
##   noms, calque, calque_pose } }`, chaque champ de texte éditable à l'écran, son texte et son centre
##   (`PontDuNoyau.saisies_a_l_ecran`), le défilement du panneau d'outils, ses boutons et ses champs défilés hors de
##   son cadre compris (`PontDuNoyau.defilement_publie`), le point de l'écran du sol de
##   chaque case de la couche éditée, les zones, la surcouche et le calque de la dernière réponse de `editer` (section
##   « Éditeur »), le nombre d'arêtes posées sur le monde, les noms posés sur le monde par case `x,y,z`, et si le calque
##   y est posé, sa planche lue.
## - À l'atelier : `{ boutons: { texte, x, y, cle?, choix?, ids?, retenu? }[], atelier: { base: string|null, empreinte:
##   string|null, clip: string|null, instant: number|null, duree: number|null, lecture: boolean, vitesse: number,
##   montes: Record<point | `<point>#<rang>`, element>, lignes: Record<ligne, element>, emblemes: Record<emplacement, emblemeId>, aides: {
##   os: boolean, emplacements: boolean, prises: boolean }, erreurs: string[], onglet: Onglet, onglets: Onglet[],
##   defilement: number, plages: Record<champ, { gauche: number, droite: number, y: number, valeur: number }>,
##   composition: { courante: Composition, preset: string|null, montes: Monte[], manquants: Manquant[], morphes:
##   Record<shapeKey, number>, palette: Record<Slot, string>, refus: string|null, copie: string }, gabarit: { neutre?:
##   Mesure, repos?: Mesure, image?: Mesure }, cadre: number, os: Record<os, [number, number, number]>, peaux:
##   Record<emplacement, { centre: [number, number, number], taille: [number, number, number] }>, morphes: { corps:
##   Record<mesh, Record<shapeKey, number>>, montes: Record<emplacement, Record<mesh, Record<shapeKey, number>>> },
##   couleurs: Record<emplacement, Record<materiau, string>>, vehicule: { definition: string, element: string|null,
##   embleme: string|null, postes: string[], ameliorations: string[], couleurs: Record<materiau, string>, caches:
##   string[], taille: [number, number, number]|null, demande: { postes: { definition: string, bord: FireArc }[],
##   ameliorations: string[] } } | null, echantillon: { famille: string, id: string, triangles: number, aretes:
## number, toits: number, couronnes: number } | null } }. `vehicule` est le véhicule demandé (section « Atelier 3D »),
## `null` sans
##   lui : sa fiche, puis ce que son montage a posé (`MontageDeVehicule`) : l'élément, l'emblème de ses voiles, les
##   éléments de ses pièces et de ses Améliorations, la couleur de chaque surface de son élément à matériau propre
##   (`MontageDeVehicule.couleurs_posees`), le nom de chaque nœud caché sous sa scène, pièces comprises, chacun une
##   fois, trié, la taille de sa boîte en mètres, et les pièces et Améliorations demandées. `echantillon` est
## l'échantillon demandé (section « Atelier 3D »), `null` sans lui : sa famille, son id, puis ce que sa scène a posé
## (`VolumeDeScene.ce_qui_est_pose`) : les triangles de son volume, et ses arêtes, ses nappes de toit et ses couronnes
## montrées.`, `Mesure` valant `{ pied:
##   number, piedSansGabarit: number, sommet: number, echelle: number }` et `Onglet` `'personnage' | 'equipement' |
##   'couleurs' | 'animation' | 'effets' | 'outils'`. `onglet` est l'onglet montré, `onglets` ceux dont le bouton est
##   montré, ceux que le modèle posé offre, dans l'ordre du panneau (section « Atelier 3D »). `composition` porte la
##   composition courante (`{}` à l'ouverture), l'id du dernier preset appliqué, puis `montes` et `manquants` de la
##   dernière réponse de `composer` sur la base posée (section « Composition d'un personnage »), vides avant toute
##   composition, après un refus et après un changement de base ; `refus` est le texte affiché du refus de la
##   composition courante (« composition refusée : » suivi du message), `null` sans refus, et `copie` l’entrée copiée
##   par « Copier la composition », vide avant toute copie, après chaque composition et après un refus. Le verdict reste
##   affiché dans l’atelier. `composition.morphes` porte les poids attendus de la dernière réponse de `composer`, vide
##   sans composition, et `composition.palette` sa `palette`. `couleurs` porte, sous l'id du point ou `ligne/<ligne>` de
##   chaque emplacement monté dont une surface a un matériau propre (section « Atelier 3D », habiller), la couleur
##   d'albédo `#rrggbb` de ce matériau, par nom du matériau du GLB. `erreurs` porte celles du chargement, du montage et
##   de la page, puis celles du dernier geste de composition, puis celles du gabarit posé (section « Atelier 3D »).
##   `cadre` est l'échelle de l'orbite de la caméra (`MarcheDeLAtelier.echelle`), 1 au corps neutre. `gabarit` porte les
##   mesures du gabarit posé par `GabaritDuSquelette` (section « Gabarit d'une base »), vide sans gabarit et avant sa
##   mesure : `neutre` au repos sans gabarit, `repos` au repos au gabarit, pieds au sol, et `image` sur la dernière pose
##   modifiée, au repos comme pendant un clip ; chacune la hauteur monde de l'os de `pieds` le plus bas (`pied`), celle
##   de l'os de `pieds` le plus bas de la même pose sans gabarit (`piedSansGabarit`), que `pied` égale (« Gabarit d'une
##   base », étape 3), celle de l'os le plus haut (`sommet`), et l'échelle monde de `racine.os` (`echelle`). `os` porte
##   la position monde de chaque os de la base sur la dernière pose envoyée au skinning, par nom, vide sans base. Les
##   positions dans le repère du squelette sont relevées au signal `Skeleton3D.skeleton_updated`, après les
##   modificateurs et avant la restauration des poses sans gabarit (Godot 4.7, `Skeleton3D::_notification`,
##   `NOTIFICATION_UPDATE_SKELETON`), puis converties en monde à la publication, comme les sommets skinnés. `peaux`
##   porte, sous l'id du point ou `ligne/<ligne>` de chaque emplacement monté qui porte un mesh skinné, la boîte de ses
##   meshes skinnés posés par le moteur sur la pose courante (`MeshInstance3D.bake_mesh_from_current_skeleton_pose`, qui
##   lit les os que le squelette a liés au skin) : son centre monde (`centre`) et sa taille dans le repère du squelette
##   (`taille`). Elle se mesure à la publication qui suit un geste ou un changement d'état, que l'atelier retient tant
##   que le skin d'un mesh skinné monté n'a pas ses os au serveur de rendu ; chaque image d'un clip en lecture republie
##   la dernière mesure, car la mesure relit au processeur les tampons de chaque mesh
##   (`RenderingServer.mesh_get_surface`), une lecture synchrone sous WebGL (#3787). `morphes` porte les poids cuits des
##   shape keys de chaque mesh qui en possède (`MontageDeComposition.cuire_les_formes`), par nom de clé : `corps` pour
##   les meshes de la base, `montes` pour ceux de chaque emplacement monté. Les clés `mesh` sont les chemins depuis la
##   racine du modèle. Un mesh sans shape key est absent ; un emplacement monté sans shape key porte un record vide.
##   `defilement` est la position verticale du défilement du panneau de l'onglet courant
##   (`ScrollContainer.scroll_vertical`), en pixels ; chaque changement publie. `plages` porte, par `champ` d'un axe
##   `plage` dont la glissière est à l'écran, le bord gauche et le bord droit de son cadre et son milieu vertical, et la
##   valeur de la glissière (`valeur`, le `neutre` de l'axe sans champ) : un clic sur un bord pose la borne de l'axe.
##   `cle` est optionnelle : la liste d'un emplacement porte son id (l'id du point, `"ligne/tete"`, `"ligne/coiffure"`,
##   `"ligne/emplacement/<id>"`), la case ou la liste d'une pièce `"ligne/piece/<id>"`, la liste d'emblème d'un
##   emplacement `"<emplacement>/embleme"`, la liste d'un axe `"axe/<champ>"` et le bouton « neutre » d'un axe `plage`
##   `"axe/<champ>/neutre"`, la liste d'une couleur `"couleur/<emplacement de palette>"`, la liste des clips `"clip"`,
##   les listes de tête des modèles `"modele/corps"`, `"modele/vehicule"` et `"modele/<famille>"` de chaque famille
## d'échantillons, parce que leur texte (« Aucun », un
##   libellé) se répète d'une rangée à l'autre ; le préfixe `ligne/` sépare une ligne d'un point de même id. Une liste
##   déroulante publie aussi le texte de chaque article (`choix`), l'id de chaque article (`ids`, `null` pour un article
##   sans id), le rang de l'article choisi (`retenu`, -1 sans choix), si elle est ouverte (`ouverte`) et le rang de
##   l'article que désigne sa liste ouverte (`designe`, -1 sans lui), republiés quand elle s'ouvre, se ferme ou
##   désigne un autre article au clavier (`suivre_les_listes`) : on la choisit en la cliquant, puis en allant à son
##   article au clavier. `lignes` porte l'élément monté
##   à chaque ligne de pièce, sous la clé `<ligne>` : la `sorte` d'un sélecteur (`tete`, `coiffure`), `piece/<id>` ou
##   `emplacement/<id>` ; une ligne sous « Aucun » ou démontée en est absente, comme un point de `montes`. `emblemes` ne
##   porte que les emplacements montés dont un emblème est posé, sous l'id du point ou `ligne/<ligne>` : un emplacement
##   sous « Aucun » ou démonté en est absent. `duree` est la longueur du clip engagé (`null` sans clip) : chaque clip
##   boucle, et « Image suivante » / « Image précédente » mènent à l'image voisine modulo `duree`
##   (`MiseEnPage.image_voisine`, `projet/scripts/mise_en_page.gd`), la suivante de la dernière image étant la première.


## Publie ce que l'écran porte, ce que rend `publie`, pour la recette qui le pilote sans voir dans le canevas : retenu
## dans `ecran`, puis passé au lieu sous `wfrpEcran` ; rien si `publie` rend `null` (un écran qui n'est pas prêt). Hors
## recette (`en_recette`), `publie` n'est pas appelé.
func publier_l_ecran(publie: Callable) -> void:
	if not en_recette:
		return
	var rendu: Variant = publie.call()
	if rendu != null:
		ecran = rendu
		_transport.publier("wfrpEcran", rendu)


## @contrat Écran publié
## Au combat, Godot expose à la page une fonction pour les recettes qui capturent des vues,
## `globalThis.wfrpCadrer(entree, rendre)` (`PontDuNoyau.exposer`, `combat.gd`). `entree` est un cadrage en JSON : `{
## regard, case: { x, y }, etage?, lacet, tangage }` en immersion, `{ regard, case: { x, y }, etage?, lacet, zoom }`
## en tactique et au plateau ; `etage` est la couche de la case (0 sans elle), `lacet` l'azimut où la caméra regarde,
## en degrés au compas (0 au nord, 90 à l'est, `MiseEnPage.lacet_de_l_azimut`), `tangage` celui de l'œil, en degrés,
## positif vers le haut, borné à `MiseEnPage.TANGAGE_DE_L_OEIL`, et `zoom` la distance de la caméra, en cases, de
## `Monde.DISTANCE_MIN` à `Monde.DISTANCE_MAX`. Godot pose la caméra sous le regard de la partie, sans rien jouer ni
## appeler le pont (`Plateau.cadrer`) : l'œil de l'immersion à la hauteur de l'œil de la case (`oeilsSousPlafond`)
## au-dessus de son sol, le groupe restant à la sienne, la souris libérée et le point de mire caché, comme à
## `ui_cancel` (`Immersion.poser`), ou la caméra de la tactique et du plateau sur le sol de la case, où elle reste
## tant que le groupe ne change pas de case (`Monde.cadrer`). Le volume reste celui que le regard montre pour le
## groupe (section « Vue ») : en immersion, entier ; en tactique et au plateau, sans les toits, les couches et le haut
## des navires qu'il retire au-dessus du groupe. Deux images dessinées, `rendre` reçoit la réponse en JSON : `{ ok:
## true, camera: { regard, case, lacet, tangage, zoom } }`, la caméra posée (`Monde.camera` : la case `[x, y, z]` du
## sol touché sous l'œil, ou sous le lieu que la caméra regarde, `null` hors du monde, l'azimut et le tangage en
## degrés, la distance, `null` en immersion) ; ou un refus `validation` (`Plateau.cadrer`) : une entrée illisible, un
## cadrage d'un autre regard que celui de la partie, que la recette prend d'abord à la touche du regard, comme un
## joueur (l'immersion hors d'exploration comprise), une clé hors de celles de son regard ou manquante, une case ou un
## étage non entiers, une case hors du plateau ou d'une couche qu'il n'a pas, un nombre hors de ses bornes. La recette
## autonome `projet/recettes/cadrage.gd` en est l'épreuve.

## `rappel` exposé au lieu sous `nom` : chaque appel lui passe son entrée, une chaîne, et `rendre`, le `Callable` qui
## reçoit sa réponse, une chaîne.
func exposer(nom: String, rappel: Callable) -> void:
	_transport.exposer(nom, rappel)


## Sous une recette, `republier` appelé quand une liste déroulante sous `racine`, présente ou à venir, s'ouvre, se ferme
## ou désigne un autre article au clavier : l'écran publie l'état de ses listes (`boutons_a_l_ecran`).
func suivre_les_listes(racine: Node, republier: Callable) -> void:
	if not en_recette:
		return
	var suivre := func(noeud: Node) -> void:
		if noeud is OptionButton and racine.is_ancestor_of(noeud):
			var articles := (noeud as OptionButton).get_popup()
			articles.visibility_changed.connect(republier)
			articles.id_focused.connect(func(_id: int) -> void: republier.call())
	for liste in racine.find_children("*", "OptionButton", true, false):
		suivre.call(liste)
	var arbre := get_tree()
	arbre.node_added.connect(suivre)
	racine.tree_exited.connect(func() -> void: arbre.node_added.disconnect(suivre))


## Le pont `pont` posé à la place de celui de l'arbre (`/root/Pont`), que chaque écran rejoint ensuite.
static func remplacer(arbre: SceneTree, pont: PontDuNoyau) -> void:
	var ancien := arbre.root.get_node_or_null("Pont")
	if ancien != null:
		arbre.root.remove_child(ancien)
		ancien.free()
	pont.name = "Pont"
	arbre.root.add_child(pont)


## Les boutons à l'écran sous `racines` : chaque `BaseButton` actif et visible qu'aucun défilement ne cache, ou, `defiles`
## vrai, que les défilements cachent aussi, son texte,
## son centre, sa méta `cle` s'il la porte, et l'élément que dessine le composant qui le porte (`Zone.META` :
## `<type>/<id>`) s'il en porte un ; une liste déroulante, aussi le texte de chaque article (`choix`), son id (`ids`,
## sa métadonnée), le rang de l'article choisi (`retenu`, -1 sans choix), si elle est ouverte (`ouverte`) et le rang de
## l'article que désigne sa liste ouverte (`designe`, -1 sans lui) ; puis chaque onglet montré d'un `TabContainer` visible, son titre et le
## centre de son onglet (`onglet`).
static func boutons_a_l_ecran(racines: Array, defiles := false) -> Array:
	var boutons := []
	for racine in racines:
		for pages in racine.find_children("*", "TabContainer", true, false):
			var barre := (pages as TabContainer).get_tab_bar()
			if not barre.is_visible_in_tree():
				continue
			for rang in barre.tab_count:
				var milieu: Vector2 = barre.get_global_transform().translated_local(barre.get_tab_rect(rang).get_center()).get_origin()
				if not barre.is_tab_hidden(rang) and (defiles or a_l_ecran(barre, milieu)):
					boutons.append({texte = barre.get_tab_title(rang), x = milieu.x, y = milieu.y, onglet = true})
		for bouton in racine.find_children("*", "BaseButton", true, false):
			var centre: Vector2 = bouton.get_global_rect().get_center()
			if bouton.is_visible_in_tree() and not bouton.disabled and (defiles or a_l_ecran(bouton, centre)):
				var publie := {texte = bouton.text, x = centre.x, y = centre.y}
				if bouton.has_meta("cle"):
					publie.cle = bouton.get_meta("cle")
				if bouton.owner != null and bouton.owner.has_meta(Zone.META):
					publie.element = bouton.owner.get_meta(Zone.META)
				if bouton is OptionButton:
					var liste := bouton as OptionButton
					publie.choix = range(liste.item_count).map(func(rang: int) -> String: return liste.get_item_text(rang))
					publie.ids = range(liste.item_count).map(liste.get_item_metadata)
					publie.retenu = liste.selected
					publie.ouverte = liste.get_popup().visible
					publie.designe = liste.get_popup().get_focused_item()
				boutons.append(publie)
	return boutons


## Les champs de texte à l'écran sous `racines` : chaque `LineEdit` ou `TextEdit` éditable et visible qu'aucun
## défilement ne cache, ou, `defiles` vrai, que les défilements cachent aussi, son texte, son centre, et l'élément que dessine le composant qui le porte (`Zone.META`) s'il en
## porte un.
static func saisies_a_l_ecran(racines: Array, defiles := false) -> Array:
	var saisies := []
	for racine in racines:
		for champ in racine.find_children("*", "", true, false).filter(func(n: Node) -> bool: return n is LineEdit or n is TextEdit):
			var centre: Vector2 = champ.get_global_rect().get_center()
			if champ.is_visible_in_tree() and champ.editable and (defiles or a_l_ecran(champ, centre)):
				var publie := {texte = champ.text, x = centre.x, y = centre.y}
				if champ.owner != null and champ.owner.has_meta(Zone.META):
					publie.element = champ.owner.get_meta(Zone.META)
				saisies.append(publie)
	return saisies


## Le défilement vertical `defilement` : sa position (`valeur`, la valeur de sa barre, `ScrollBar.value`), la hauteur
## de son contenu (`contenu`, `Range.max_value`) et celle qu'il montre (`page`, `Range.page`), le haut et le bas de son
## cadre à l'écran, et ses boutons et ses champs de texte, ceux qu'il cache compris, chacun publié comme à
## l'écran, à son point de l'écran hors du cadre s'il y est (`boutons_a_l_ecran`, `saisies_a_l_ecran`).
static func defilement_publie(defilement: ScrollContainer) -> Dictionary:
	var cadre := defilement.get_global_rect()
	var barre := defilement.get_v_scroll_bar()
	return {
		valeur = barre.value, contenu = barre.max_value, page = barre.page, haut = cadre.position.y, bas = cadre.end.y,
		boutons = boutons_a_l_ecran([defilement], true), saisies = saisies_a_l_ecran([defilement], true),
	}


## Si `point` de `controle` se voit à travers chaque défilement qui le contient.
static func a_l_ecran(controle: Control, point: Vector2) -> bool:
	var parent := controle.get_parent()
	while parent != null:
		if parent is ScrollContainer and not (parent as ScrollContainer).get_global_rect().has_point(point):
			return false
		parent = parent.get_parent()
	return true


## L'adresse absolue de `relative` contre celle du serveur du jeu.
func adresse(relative: String) -> String:
	return _transport.adresse(relative)


## Le corps de la réponse à `methode` sur `relative`, adresse relative au serveur du jeu (`adresse`), `corps` envoyé ;
## vide, et une erreur à `recueil`, si la requête échoue, si la réponse n'est pas un 200 (son corps dit alors pourquoi),
## ou si `SILENCE_S` passe sans qu'un octet arrive : le minuteur `silence` repart à chaque image où HTTPRequest a lu un
## bloc.
func requeter(relative: String, recueil: Array[String], methode := HTTPClient.METHOD_GET, corps := "") -> PackedByteArray:
	var requete := HTTPRequest.new()
	requete.download_chunk_size = BLOC_DE_TELECHARGEMENT
	# Sur le Web, le navigateur a déjà décompressé un corps `Content-Encoding: gzip` (GitHub Pages, #3778) : HTTPRequest
	# ne le décompresse pas une seconde fois (`RESULT_BODY_DECOMPRESS_FAILED`).
	requete.accept_gzip = false
	add_child(requete)
	var code := requete.request(adresse(relative), PackedStringArray(), methode, corps)
	if code != OK:
		requete.queue_free()
		recueil.append("requete-refusee : %s (%s)" % [relative, error_string(code)])
		return PackedByteArray()
	var resultat := []
	requete.request_completed.connect(func(issue: int, statut: int, entetes: PackedStringArray, recu: PackedByteArray) -> void:
		resultat.append_array([issue, statut, entetes, recu]), CONNECT_ONE_SHOT)
	var silence := Timer.new()
	silence.one_shot = true
	requete.add_child(silence)
	silence.start(SILENCE_S)
	var recus := 0
	while resultat.is_empty() and not silence.is_stopped():
		await get_tree().process_frame
		if requete.get_downloaded_bytes() != recus:
			recus = requete.get_downloaded_bytes()
			silence.start(SILENCE_S)
	if resultat.is_empty():
		requete.cancel_request()
		requete.queue_free()
		recueil.append("requete-silencieuse : %s (aucun octet en %s s, %s reçus)" % [relative, SILENCE_S, recus])
		return PackedByteArray()
	requete.queue_free()
	if resultat[0] != HTTPRequest.RESULT_SUCCESS or resultat[1] != 200:
		var raison: String = resultat[3].get_string_from_utf8()
		recueil.append("requete-echouee : %s (resultat %s, HTTP %s)%s" % [relative, resultat[0], resultat[1], " : " + raison if raison != "" else ""])
		return PackedByteArray()
	return resultat[3]


## Le fichier du genre `genre` (`IMAGES`, `HEROS`) que le joueur choisit sur son disque : `{ octets, type }`, son contenu
## et son type MIME ; `{}` s'il renonce.
func choisir_un_fichier(genre: Dictionary) -> Dictionary:
	return await _transport.choisir_un_fichier(genre)


## Le texte `texte` remis au joueur en fichier du genre `genre`, sous le nom `nom` : téléchargé par la page, écrit où le
## joueur le choisit hors d'elle.
func enregistrer_un_fichier(genre: Dictionary, nom: String, texte: String) -> void:
	_transport.enregistrer_un_fichier(genre, nom, texte)


## La pile des couches `demande` (`PileDemandee`, en JSON, `CONTRAT.md`, « Pile des couches ») résolue par le lieu du
## noyau sans tenir l'image (`wfrpPont.resoudreLaPile`) : `rendre`, s'il vit encore, en reçoit la réponse décodée
## (`PileResolue`), `{}` en panne ; un refus est signalé.
func resoudre_la_pile(demande: String, rendre: Callable) -> void:
	var reponse := _decoder("resoudreLaPile", await _transport.resoudre_la_pile(demande))
	if reponse.get("ok") == false:
		refus.emit(str(reponse.erreur.message))
	if rendre.is_valid():
		rendre.call(reponse)


## Le paramètre `cle` du lancement, `""` s'il est absent.
func parametre(cle: String) -> String:
	return _transport.parametre(cle)


## La réponse brute `brut` de `methode` décodée ; `{}` en panne, celle du transport (`null`) déjà signalée.
func _decoder(methode: String, brut: Variant) -> Dictionary:
	if brut == null:
		return {}
	if typeof(brut) != TYPE_STRING:
		_signaler("%s : réponse de type %s au lieu d'une chaîne JSON" % [methode, type_string(typeof(brut))])
		return {}
	var decode: Variant = JSON.parse_string(brut)
	if not decode is Dictionary or not decode.has("ok"):
		_signaler("%s : réponse illisible : %s" % [methode, brut.left(200)])
		return {}
	return decode


## Chaque tableau d'une géométrie de `volume`, `toits` et `couronnes` de `reponse`, dont l'en-tête porte les bornes
## `[debut, fin]` dans `octets`, remplacé par ses `Float32`.
func _recoller(reponse: Dictionary, octets: PackedByteArray) -> void:
	for famille in ["volume", "toits", "couronnes"]:
		for geometrie: Dictionary in reponse[famille]:
			for tableau in ["positions", "normales", "couleurs", "cases"]:
				var bornes: Array = geometrie[tableau]
				geometrie[tableau] = octets.slice(int(bornes[0]), int(bornes[1])).to_float32_array()


func _signaler(message: String) -> void:
	push_error("[pont] ", message)
	panne.emit(message)
