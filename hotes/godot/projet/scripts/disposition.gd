## La disposition de la fenêtre (#3328) : la scène d'éditeur, sans script, qui range les zones de la fenêtre qui tient
## la main. Celle que la vue nomme (`vue.disposition`, `res://ecrans/<disposition>.tscn`) quand elle existe, sinon la
## générique (`GENERIQUE`) ; elle s'instancie juste après ce nœud, au-dessus du round, de l'ordre (`Hud`), du meuble de
## l'actif (`Actif`) et de la fin du tour (`Tour`), sous le dialogue et le groupe, et remplace la précédente ; un bandeau
## de jet (groupe `BANDEAU`) s'instancie dans le poste de l'actif (`Actif`), à la place du meuble. En combat, la
## générique se pose en bas au centre, au-dessus du meuble de l'actif quand il se montre, à sa place sinon.
class_name Disposition
extends Node

## @contrat L'écran de Godot
## L'écran (`projet/scenes/Ecran.tscn`) se partage en trois : le journal à droite, le groupe au pied, et la scène
## (`Scene`), l'espace qui reste, que la fiche ouverte rétrécit à sa gauche, où se posent la disposition, le round en
## cartouche en haut à gauche (`Hud/Tour`, `Cartouche`), l'ordre du tour en colonne au bord gauche (`Hud/Corps/Ordre`),
## de haut en bas : la tête du round suivant estompée (`suite/`, en `rangPasse`), le round qui commence avec elle en
## rubrique dans un médaillon suivie d'un filet (`round`), puis ceux qui restent à jouer (`ordre/`, en `rang`), celui qui
## joue en bas en `rangDeLActif`, toujours montré par le défilement (`Zone.pied`) ; chaque rang porte son portrait sur le
## fond de son ton, son nom, ses Blessures en jauge de largeur fixe, et, pour un héros, le bouton de sa fiche posé sur
## son portrait (`surLeRang`, plat, sa bulle « Fiche »),
## le meuble de l'actif en bas au centre (`Actif/Poste/Meuble`, son chêne sous le portrait qui le dépasse, son thème de
## portée `art/meuble.tres` : en `meuble`, une seule forme, trois zones : à gauche, en deux colonnes titrées en petites
## capitales, ses Blessures en chiffres sur leur barre (`mesure`) et son Action en sceau de cire (`sceau`), son
## Mouvement en chiffres sur ses losanges, un par case (`jetons`), et son Avantage en chiffre dans son cadre
## (`compte`), ses États dessous ; au centre son portrait et son nom ; à droite ses offres, `combat.offres` : l'Action
## sous son ruban, à cheval sur le bord du chêne, en plaques larges à pictogramme et à nom (`plaques`) ; dessous,
## chaque autre choix en pastille ronde à pictogramme, en colonnes, son nom entier sous elle, qui ouvre au-dessus du
## meuble sa liste titrée en colonne, pressée tant qu'elle est ouverte (`PastilleDeChoix`)), posée sur sa droite, à
## son bord, la tablette de bois des six emplacements rapides (`Actif/Poste/Rapides/Tablette`, `combat.rapides` : une
## case pleine en `case`, voilée tant qu'elle est refusée, une case libre en `caseLibre`, chacune la touche de son rang
## dans un médaillon à son coin haut gauche, `touche.gd`, son nom entier dessous), qui se retire avec le meuble,
## la fin du tour en bas à droite (`Tour`, la part du tour de
## `combat.offres`, `economie/aucun`, en `finDuTour` :
## « Fin du tour » en gros bouton rond de laiton au sablier, son nom dessous, les autres en pastilles rondes empilées à sa gauche), les avis
## du combat en ligne au-dessus du meuble (`Actif/Avis`) et le dialogue, et où se cadre le monde (`Monde.cadre`) ;
## rien ne recouvre le groupe ni le journal. En combat, la
## fenêtre générique se pose en bas au centre, au-dessus du meuble de l'actif. Le coin bas-droit
## de la fenêtre est réservé à la pastille du menu de la partie (`partie.menu`, `projet/scenes/MenuDeLaPartie.tscn`), qui
## ouvre au-dessus d'elle les gestes du groupe et de la partie (`groupe.gestes`, `partie.gestes`) : le journal s'arrête
## au-dessus d'elle (`Droite/Pile/Coin`), et, le journal caché, le bandeau des héros lui laisse sa largeur à droite
## (`coin_du_pied`) ; aucune disposition ne pose ces gestes. Une disposition
## qui range elle-même les lignes du journal (`journal.lignes`) le tient dans sa scène : son panneau se cache et la
## scène prend sa largeur. Les zones de la
## fenêtre vivent dans sa disposition, une scène d'éditeur sans script que le nœud `Disposition`
## (`projet/scripts/disposition.gd`) de l'écran instancie : `projet/ecrans/<disposition>.tscn` quand elle existe, la
## générique `projet/ecrans/fenetre.tscn` sinon. Une disposition dédiée range autrement les mêmes sources : une zone qui
## nomme des `ids` n'en montre que ces éléments, un id fini par `/` nommant toute la famille des ids qui commencent par
## lui, une zone sans `ids` ceux qu'aucune autre zone de sa source ne nomme (`Zone.montrer_toutes`), si bien qu'aucun
## élément ne se perd. Les jets de combat sont des bandeaux qui héritent du cadre `projet/cadres/fenetre_de_jet.tscn`
## (groupe `bandeau`) : posé dans le poste de l'actif (`Actif`), à la place du meuble, que la vue ne sert pas sous un
## jet, il en prend l'ancrage et le calage, quel que soit le jet ; un parchemin dans le chêne ferré, le titre sur un
## ruban (`art/bandeau_de_jet.tres`), le corps à l'encre (`art/statbloc.tres`), les réserves du jet en puces (`fenetre.reserves`), les gestes en rangée dessous, celui que
## l'Entrée joue en laiton plein. Le camp du joueur à gauche (`jetDuCamp`), l'autre à droite en miroir
## (`jetDuCampEnMiroir`), chacun son portrait au bord (`Jet.combattant` : le joueur dans le laiton, l'autre sur la cire,
## les cadres des rangs de `art/rang.tres`, aucun sans combattant), son nom, sa compétence, son seuil, ses deux dés à dix faces (`navigation/des`, la face
## de chacun lue au résultat, `Liaison.face`), son résultat en sceau, son verdict en petites capitales, son DR et ses modificateurs ; au centre le reste,
## centré, le DR net en gothique (`art/dr_net.tres`), l'issue
## penchée (`art/issue_du_jet.tres`), chaque réglage en ligne qui coule (`choixEnLigne`). Le bandeau se centre sur la
## scène sans couvrir l'ordre du tour ni la fin du tour (`MiseEnPage.largeur_du_bandeau`) ; ses trois colonnes sont côte à côte (`Duel`), le nom
## d'un camp et ses modificateurs coulent dans la sienne. L'écran d'attaque (`projet/ecrans/cascade/attaque.tscn`) : au centre l'arme et la cible
## sur une ligne qui les sépare d'un point, ses pastilles, le DR net, l'issue et les options du coup, la Localisation sur
## une silhouette (`silhouette`, chaque zone le bouton de sa valeur, par l'id de la valeur, `art/silhouette.tres`) ; l'écran de Défense
## (`projet/ecrans/cascade/defense.tscn`),
## sa réaction à gauche, son score à atteindre avant le dé, face au jet de l'attaquant, révélé une fois le dé tombé.
## Le bandeau d'incantation (`projet/ecrans/cascade/incantation.tscn`) n'a qu'un camp, le lanceur (son NI au
## libellé) ; au centre le sort et sa cible, la zone et le budget de Surincantation en pastilles, l'issue, puis
## chaque axe que le sort ouvre en choix de pas, de 0 au budget, chaque pas de trop refusé avec sa raison. L'écran du
## lieu et la carte du monde sont la couche « monde », plein écran, jamais une fenêtre posée par-dessus : chacun hérite
## du cadre `projet/cadres/monde.tscn`, posé au-dessus du `Hud` et sous le dialogue comme toute disposition, le titre en grand
## et les gestes en tête, la bourse du groupe dessous quand l'écran la montre (`bourse`), et n'y ajoute que son
## contenu. L'écran du lieu (`projet/ecrans/ecranDuLieu.tscn`) ouvre la carte en tête (`lieu/carte`), dit sous son
## titre la date impériale (`lieu/date`, en `rubrique`) puis sa description quand il en a une (`lieu/description`) et
## se partage en deux : à gauche le plan de la
## carte vu d'ici, sur son parchemin (`lieu/plan`, ici en `alerte`) puis, sous leur titre (`lieu/trajets`), les
## trajets qui en partent, un par ligne, chacun sa destination, sa distance et ses moyens ; à droite, sous leur titre
## (`lieu/services`), ses services (`service/` : le fond de leur vignette, leur icône, le boniment de leur hôte, ce
## qu'on y fait) et les points d'intérêt de son plan qui mènent à une scène (`poi/`, chacun le choix `ecranDuLieu`
## `entrer`), en cartes ; la carte (`projet/ecrans/carteDuMonde.tscn`),
## son plan (`carte/plan` : chaque lieu visible, ici en `alerte`, sous chaque destination le départ du trajet qui y
## mène, le même élément qu'à l'écran du lieu, et chaque route entre deux lieux visibles, celles qui partent d'ici et
## sont ouvertes en `reussite`), puis la reprise d'un voyage interrompu. L'échoppe (`projet/ecrans/marchand.tscn`, lue
## par `marchandEnVue`, `src/noyau/marchandEnVue.ts`) montre côte à côte l'étal rangé par famille (`etal/` : chaque
## article à son prix, pressé tant que le panier en tient) et le comptoir : le panier (`panier` : chaque ligne qui en
## ôte une unité, puis le paiement de son total, refusé avec sa raison), les possessions de chaque héros (`vente/` :
## chacune à son gain, pressée tant qu'elle est au lot) et la vente du lot. Le marché de cargaison, à la halle
## (`projet/ecrans/marcheDeTerre.tscn`) comme au port (`projet/ecrans/port.tscn`, qui en hérite), est lu par
## `marcheEnVue` (`src/noyau/marcheEnVue.ts`) sur la formule de sa fenêtre (`FORMULES_DES_MARCHES`,
## `src/noyau/cargaison.ts`) : à gauche chaque offre (`offre/` : son Enc disponible, son prix de base par Enc, la
## qualité de son vin évalué ou son évaluation, l'estimation de son achat, puis son achat, qui la compose : le porteur
## qui la charge, le premier qui le peut saisi d'avance, l'Enc et la conclusion sont les choix du marché), à droite
## chaque lot des porteurs du groupe (`lot/` : son porteur et son Enc, son prix de base, sa vente, son bradage, puis
## son transfert en formulaire vers un porteur co-localisé). Le voyage
## (`projet/ecrans/voyage.tscn`) est la disposition de toute étape d'une séquence jouée en route (`voyageEnVue`,
## `src/noyau/voyageEnVue.ts`) : la journée ne s'y arrête qu'aux vrais choix (`jouerLaJournee`, `src/noyau/cascade.ts`),
## le reste va au journal. C'est une scène, jamais une fenêtre : son paysage tient tout le cadre (`scene/paysage`, les
## couches du moment, de la voie, de l'équipage et de la météo, que `Dessin` trace l'une sur l'autre) et tout s'y pose.
## En haut à gauche l'objet du temps, un cartouche (`Cartouche`) : le ciel du moment dans son arche (`scene/ciel`, en
## `arche`), le jour de la semaine, la date et le jour de route (`scene/jour`, `scene/date`, en `rubrique`), le
## pictogramme de la météo et le moment (`scene/meteo`, `scene/moment`) ; en haut à droite, dans un cartouche, le titre
## de la carte (`voyage/titre`, en `rubrique`) sur la carte du trajet (`voyage/carte`, en `carteDuVoyage` : chaque
## lieu, le départ et l'arrivée nommés, le groupe sur sa route) ; à droite le récit : le
## titre de ce qui tient la journée, le journal de la partie, ses dernières lignes au pied et le reste au défilement, les jets qu'aucun
## héros ne jette (`jets/`), le choix de sa cadence (`voyage/cadence`), puis ses gestes ; au pied les km qui restent
## avant l'arrivée, le chiffre et son unité (`voyage/reste`, en `reste`)
## sur la frise (`voyage/frise`, en `frise`, chaque point en `etapeDeFrise` : le départ, chaque nuit passée en route à
## son km sous son croissant, le groupe, l'arrivée).
## Le jet d'un héros (en `jetDeHeros` : son dé dans une pastille à son ton, puis son test et son issue) et les gestes
## qui le désignent sont sur sa carte (`groupe.heros`), cerclée quand c'est à lui d'agir. La halte de nuit
## (`projet/ecrans/repos.tscn`) est la même scène, hors d'un trajet comme en route : son paysage est celui de la nuit
## et de son toit, son arche le ciel de nuit, son moment la nuit et son lieu ; la nuit de chaque dormeur, son couchage et sa pitance, est sur sa
## carte.
## Le document remis (`projet/ecrans/document.tscn`) se pose au centre, son texte dans un
## défilement : le Markdown verbatim de la donnée, montré tel quel. Un écran dédié neuf, c'est une scène de plus sous
## `projet/ecrans/`, sans ligne de GDScript.

const GENERIQUE := "res://ecrans/fenetre.tscn"
## Le groupe de la racine d'un bandeau de jet, posé dans le poste de l'actif.
const BANDEAU := &"bandeau"
## La source des lignes du journal : la disposition qui la range tient le journal dans sa scène.
const LIGNES_DU_JOURNAL := "journal.lignes"
## Les lignes du journal que la chronique fermée montre sur la scène, les dernières.
const LIGNES_DE_LA_CHRONIQUE := 3
## La hauteur du défilement de la chronique ouverte.
const HAUTEUR_DE_LA_CHRONIQUE := 420.0
## Le thème de la chronique fermée, ses lignes claires sur la scène, et celui de la chronique ouverte, sur parchemin.
const CHRONIQUE_FERMEE := preload("res://art/chronique.tres")
const CHRONIQUE_OUVERTE := preload("res://art/statbloc.tres")

## Le panneau du journal de l'écran, caché sous une disposition qui range elle-même ses lignes.
@export var journal: Control
## La place que le bandeau des héros réserve à droite au menu de la partie, tenue quand le journal est caché.
@export var coin_du_pied: Control
## Le poste de l'actif, au-dessus duquel la générique se pose en combat, et où se pose un bandeau de jet.
@export var actif: Control
## L'ordre du tour, en colonne au bord gauche, à droite duquel se cale le poste de l'actif.
@export var ordre: Control
## La fin du tour, en bas à droite, à gauche de laquelle se cale le poste de l'actif.
@export var tour: Control
## La chronique posée sur la scène en combat, à la place du panneau du journal.
@export var chronique: Control
## Le défilement des lignes du journal (`journal.lignes`), seul : au panneau du journal hors combat, à la chronique en
## combat (`_ranger_les_lignes`).
@export var lignes: ScrollContainer
## Le panneau de la chronique, qui tient les lignes en combat.
@export var panneau: PanelContainer
## La pastille de la chronique (`journal.titre`), qui l'ouvre et la ferme (`ouvrir_la_chronique`).
@export var bascule: Button
## Le menu de la partie, en haut à droite en combat, en bas à droite sinon.
@export var menu: MenuDeLaPartie

## Le chemin de la scène posée, `""` avant la première.
var scene := ""
var _posee: Node = null
var _en_combat := false
## Le panneau du journal qui tient les lignes hors combat.
var _pile_du_journal: Node
## La chronique est fermée en combat : ses lignes alignées à droite (`_aligner`).
var _fermee := false


func _ready() -> void:
	_pile_du_journal = lignes.get_parent()
	for signal_ in [actif.resized, actif.visibility_changed, ordre.resized, tour.resized, tour.visibility_changed, (chronique.get_parent() as Control).resized]:
		signal_.connect(_caler)
	lignes.get_node("Lignes").child_entered_tree.connect(_aligner)


## La scène de `disposition` posée (`null` : la générique), `en_combat` ou non ; vrai si elle a remplacé la précédente,
## ses zones neuves.
func disposer(disposition: Variant, en_combat: bool) -> bool:
	var chemin := GENERIQUE
	if disposition != null and ResourceLoader.exists("res://ecrans/%s.tscn" % disposition):
		chemin = "res://ecrans/%s.tscn" % disposition
	if chemin == scene and en_combat == _en_combat:
		return false
	if _posee != null:
		_posee.get_parent().remove_child(_posee)
		_posee.queue_free()
	_posee = load(chemin).instantiate()
	if _posee.is_in_group(BANDEAU):
		actif.add_child(_posee)
	else:
		add_sibling(_posee)
	journal.visible = not en_combat and not Zone.racines(_posee).any(func(zone: Zone) -> bool: return zone.source == LIGNES_DU_JOURNAL)
	coin_du_pied.visible = not en_combat and not journal.visible
	chronique.visible = en_combat
	if en_combat != _en_combat:
		lignes.reparent(panneau if en_combat else _pile_du_journal, false)
		if not en_combat:
			_pile_du_journal.move_child(lignes, 0)
		bascule.set_pressed_no_signal(false)
		_ranger_les_lignes(en_combat, false)
	menu.ancrer(en_combat)
	scene = chemin
	_en_combat = en_combat
	_caler()
	return true


## La chronique ouverte (`ouverte`, sa pastille pressée) ou fermée.
func ouvrir_la_chronique(ouverte: bool) -> void:
	_ranger_les_lignes(true, ouverte)


## Les lignes du journal rangées : toutes en défilement hors combat ou la chronique `ouverte`, sur parchemin ; ses
## seules dernières sur la scène la chronique fermée, sans cadre, laissant passer la souris, bulles comprises.
func _ranger_les_lignes(en_combat: bool, ouverte: bool) -> void:
	var defile := ouverte or not en_combat
	_fermee = not defile
	for ligne in lignes.get_node("Lignes").get_children():
		_aligner(ligne)
	(lignes.get_node("Lignes/Zone") as Zone).derniers = 0 if defile else LIGNES_DE_LA_CHRONIQUE
	lignes.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO if defile else ScrollContainer.SCROLL_MODE_DISABLED
	lignes.custom_minimum_size.y = HAUTEUR_DE_LA_CHRONIQUE if en_combat and ouverte else 0.0
	lignes.mouse_behavior_recursive = Control.MOUSE_BEHAVIOR_INHERITED if defile else Control.MOUSE_BEHAVIOR_DISABLED
	panneau.theme = CHRONIQUE_OUVERTE if ouverte else CHRONIQUE_FERMEE
	panneau.theme_type_variation = &"Parchemin" if ouverte else &""
	panneau.mouse_filter = Control.MOUSE_FILTER_STOP if ouverte else Control.MOUSE_FILTER_IGNORE


## Une ligne du journal alignée à droite dans la chronique fermée, à gauche sinon.
func _aligner(ligne: Node) -> void:
	if ligne is Label:
		(ligne as Label).horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if _fermee else HORIZONTAL_ALIGNMENT_LEFT


## Le poste de l'actif calé entre l'ordre du tour et la fin du tour (`MiseEnPage.decalage_du_poste`), un bandeau de jet
## centré sur la scène (`MiseEnPage.largeur_du_bandeau`) ; la chronique
## dans la place libre à sa droite, au-dessus de la fin du tour, ou au-dessus du poste quand cette place est trop étroite
## (`MiseEnPage.gauche_de_la_chronique`, `bas_de_la_chronique`) ; en combat, la générique posée en bas au centre, à sa
## largeur minimale, au-dessus du meuble de l'actif s'il se montre (`MiseEnPage.au_dessus_du_meuble`).
func _caler() -> void:
	var cadre_de_scene := (chronique.get_parent() as Control).get_global_rect()
	var droite := tour.global_position.x if tour.visible else cadre_de_scene.end.x
	if _posee != null and _posee.is_in_group(BANDEAU):
		(_posee as Control).custom_minimum_size.x = MiseEnPage.largeur_du_bandeau(cadre_de_scene.position.x, cadre_de_scene.size.x, ordre.get_global_rect().end.x, droite)
	var largeur := actif.size.x if actif.visible else 0.0
	var decalage := MiseEnPage.decalage_du_poste(cadre_de_scene.position.x, cadre_de_scene.size.x, largeur, ordre.get_global_rect().end.x, droite)
	actif.offset_left = decalage
	actif.offset_right = decalage
	var libre := MiseEnPage.libre_a_droite_du_poste(cadre_de_scene.size.x, largeur, decalage)
	chronique.offset_left = MiseEnPage.gauche_de_la_chronique(libre)
	var bas := MiseEnPage.bas_de_la_chronique(libre, actif.size.y if actif.visible else 0.0, tour.size.y if tour.visible else 0.0)
	chronique.offset_top = bas
	chronique.offset_bottom = bas
	if not _en_combat or scene != GENERIQUE:
		return
	var cadre := _posee as Control
	var bas_du_cadre := MiseEnPage.au_dessus_du_meuble(actif.size.y if actif.visible else 0.0)
	cadre.anchor_left = 0.5
	cadre.anchor_right = 0.5
	cadre.offset_left = 0.0
	cadre.offset_right = 0.0
	cadre.grow_horizontal = Control.GROW_DIRECTION_BOTH
	cadre.offset_top = bas_du_cadre
	cadre.offset_bottom = bas_du_cadre
