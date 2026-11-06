## La main libre sur la seconde prise d'un objet tenu des deux mains (#3319, `hotes/godot/pont/CONTRAT.md`, « Atelier
## 3D ») : un `SkeletonModifier3D` enfant du `Skeleton3D`, après le gabarit (`GabaritDuSquelette`), qui à chaque mise à
## jour oriente l'objet vers la main libre, puis ploie le bras libre (l'os de la main libre et ses deux parents) pour que
## le repère de prise de la main libre se pose sur la seconde prise. Les clips d'une base frappent d'une main : la main
## qui tient pivote autour de sa prise, au plus court, pour que la seconde prise pointe vers la main libre du clip, sans
## quoi elle passerait hors de portée du bras libre. Le coude garde le plan que le clip lui donne, tourné au plus court :
## l'avant-bras ploie au coude jusqu'à la distance de la cible, puis le bras pivote à l'épaule vers elle ; la main prend
## l'orientation de la seconde prise, et ses doigts la pose des doigts de la main qui tient, os à os : les deux mains
## d'une base ont la même hiérarchie de doigts, en miroir, et le même repère local donne le même poing.
class_name SecondePrise
extends SkeletonModifier3D

## Le plus petit écart, en mètres, sous lequel un bras est tenu pour tendu ou replié à plat.
const EPSILON := 0.0001

var _tenante := -1
## Le repère de la prise qui tient, dans celui de son os.
var _prise := Transform3D.IDENTITY
var _main := -1
var _coude := -1
var _epaule := -1
## Les paires (os de la main qui tient, os de la main libre) de leurs doigts, appariés par rang dans la hiérarchie.
var _doigts: Array[Vector2i] = []
## Le repère de la seconde prise, dans celui de l'os de la prise qui tient.
var _seconde := Transform3D.IDENTITY
## Le repère de la prise libre, dans celui de son os.
var _libre := Transform3D.IDENTITY


## La seconde prise `seconde` (`secondesPrises` de `modeles`) de l'objet tenu à la prise `tenante`, saisie par la main
## de la prise `libre` (deux attaches de prise de la base) : rend si le squelette parent a l'os de chaque prise et deux
## parents à l'os de la main libre.
func poser(tenante: Dictionary, libre: Dictionary, seconde: Dictionary) -> bool:
	var squelette := get_skeleton()
	_tenante = squelette.find_bone(tenante.os)
	_main = squelette.find_bone(libre.os)
	_coude = squelette.get_bone_parent(_main) if _main != -1 else -1
	_epaule = squelette.get_bone_parent(_coude) if _coude != -1 else -1
	_prise = MontageDeComposition.repere(tenante)
	_seconde = _prise * MontageDeComposition.repere(seconde)
	_libre = MontageDeComposition.repere(libre)
	_doigts.clear()
	if _tenante != -1 and _main != -1:
		_apparier(squelette, _tenante, _main)
	return _tenante != -1 and _epaule != -1


## Les descendants de l'os `tenant` appariés à ceux de l'os `libre`, enfant par enfant, tant que leurs enfants sont en
## même nombre.
func _apparier(squelette: Skeleton3D, tenant: int, libre: int) -> void:
	var enfants_tenants := squelette.get_bone_children(tenant)
	var enfants_libres := squelette.get_bone_children(libre)
	if enfants_tenants.size() != enfants_libres.size():
		return
	for rang in enfants_tenants.size():
		_doigts.append(Vector2i(enfants_tenants[rang], enfants_libres[rang]))
		_apparier(squelette, enfants_tenants[rang], enfants_libres[rang])


func _process_modification_with_delta(_delta: float) -> void:
	var squelette := get_skeleton()
	if squelette == null or _tenante == -1 or _epaule == -1:
		return
	var tenue := squelette.get_bone_global_pose(_tenante)
	var prise := (tenue * _prise).origin
	var vers_la_seconde := (tenue * _seconde).origin - prise
	var vers_la_main_libre := (squelette.get_bone_global_pose(_main) * _libre).origin - prise
	var axe := vers_la_seconde.cross(vers_la_main_libre)
	if axe.length() > EPSILON:
		var orientation := Basis(axe.normalized(), vers_la_seconde.angle_to(vers_la_main_libre))
		squelette.set_bone_global_pose(_tenante, Transform3D(orientation * tenue.basis, orientation * (tenue.origin - prise) + prise))
	var cible := squelette.get_bone_global_pose(_tenante) * _seconde * _libre.affine_inverse()
	var epaule := squelette.get_bone_global_pose(_epaule).origin
	var coude := squelette.get_bone_global_pose(_coude).origin
	var main := squelette.get_bone_global_pose(_main).origin
	var bras := coude.distance_to(epaule)
	var avant_bras := main.distance_to(coude)
	var portee := clampf(cible.origin.distance_to(epaule), absf(bras - avant_bras) + EPSILON, bras + avant_bras - EPSILON)
	var vers_l_epaule := epaule - coude
	var vers_la_main := main - coude
	var pli := vers_l_epaule.cross(vers_la_main)
	if pli.length() > EPSILON and bras > EPSILON and avant_bras > EPSILON:
		var voulu := acos(clampf((bras * bras + avant_bras * avant_bras - portee * portee) / (2.0 * bras * avant_bras), -1.0, 1.0))
		_tourner(squelette, _coude, pli.normalized(), voulu - vers_l_epaule.angle_to(vers_la_main))
	var portee_actuelle := squelette.get_bone_global_pose(_main).origin - epaule
	var vers_la_cible := cible.origin - epaule
	var pivot := portee_actuelle.cross(vers_la_cible)
	if pivot.length() > EPSILON:
		_tourner(squelette, _epaule, pivot.normalized(), portee_actuelle.angle_to(vers_la_cible))
	var posee := squelette.get_bone_global_pose(_main)
	squelette.set_bone_global_pose(_main, Transform3D(cible.basis, posee.origin))
	for paire in _doigts:
		squelette.set_bone_pose_rotation(paire.y, squelette.get_bone_pose_rotation(paire.x))


## L'os `os` tourné de `angle` radians autour de l'axe `axe` du repère du squelette, passant par son origine ; ses
## enfants le suivent.
static func _tourner(squelette: Skeleton3D, os: int, axe: Vector3, angle: float) -> void:
	var pose := squelette.get_bone_global_pose(os)
	squelette.set_bone_global_pose(os, Transform3D(Basis(axe, angle) * pose.basis, pose.origin))
