/**
 * La forge et l'hospice : équipement, potions et remèdes.
 */
import {
  refusDUsage,
  qualitesDesPieces,
  doter,
  gesteDeLObjet,
  gesteDeLaMain,
  gesteDePrendreLaPanoplie,
  articleDuCatalogue,
  armureRapideDe,
  DISPONIBILITES,
  drPerdusSousLesPieces,
  encombrementDesPieces,
  equipConflicts,
  maniement,
  objetsEnRayon,
  progression,
  protectionDesPieces,
  tenableEnMainSecondaire,
  type ArticleDuCatalogue,
  type Geste,
  type ItemInstance,
  type ObjetEnRayon,
  type Qualite,
} from '../noyau';

import {
  ARMES_DE_LA_FORGE,
  ARMURES_DE_LA_FORGE,
  ECHELLE_DES_PRIX,
  GROUPE_DES_REMEDES,
  GROUPES_SANS_COMPETENCE,
  MAIN_SECONDAIRE,
  MUNITIONS,
  REMEDES_DE_L_HOSPICE,
  disponibilitesDuPalier,
  type ArmureDeLaForge,
  type GroupeDeLaForge,
} from './valeurs';
import { Etat, Heros } from './etat';
import { enRuine } from './village';
import { auNoyau, heros, refusDuPrix } from './outils';

export const prixDe = (id: string): number => Math.max(1, Math.round(articleDuCatalogue(id).prixCO * ECHELLE_DES_PRIX));

/** Où se tient une arme : une main du set de mêlée, ou le set de tir (une arme à distance). */
export type Tenue = 'main' | 'secondaire' | 'tir';
const enMainSecondaire = (a: ArticleDuCatalogue, id: string): boolean =>
  !!a.bouclier || MAIN_SECONDAIRE.armes.has(id) || (MAIN_SECONDAIRE.groupes.has(a.groupe ?? '') && (a.mains ?? 1) === 1);
const tenueDe = (a: ArticleDuCatalogue, id: string): Tenue => (enMainSecondaire(a, id) ? 'secondaire' : a.categorie === 'distance' ? 'tir' : 'main');
/** Un objet en vente : ce que le catalogue en dit, son prix au hameau, et où il se tient (arme). */
export interface Article extends ArticleDuCatalogue { id: string; prix: number; tenue: Tenue }
export const article = (id: string): Article => { const a = articleDuCatalogue(id); return { ...a, id, prix: prixDe(id), tenue: tenueDe(a, id) }; };

/** Les objets `ids` que le catalogue vend (`objetsEnRayon`), rangés par Disponibilité puis par prix. */
const rayon = (ids: readonly string[]): ObjetEnRayon[] =>
  objetsEnRayon().filter((o) => ids.includes(o.id)).sort((a, b) => DISPONIBILITES.indexOf(a.disponibilite) - DISPONIBILITES.indexOf(b.disponibilite) || prixDe(a.id) - prixDe(b.id));
const RAYON_DE_LA_FORGE = rayon(Object.values(ARMES_DE_LA_FORGE).flat());
const RAYON_DE_L_HOSPICE = rayon(REMEDES_DE_L_HOSPICE);
/** Les potions et remèdes du catalogue que l'hospice reconnaît au sac d'un héros, vendus ou non. */
const REMEDES = new Set(objetsEnRayon().filter((o) => o.consommable && articleDuCatalogue(o.id).groupe === GROUPE_DES_REMEDES).map((o) => o.id));
/** Les objets du rayon `r` de Disponibilité ouverte au palier `palier`. */
const auPalier = (r: readonly ObjetEnRayon[], palier: number): string[] => {
  const ouvertes = disponibilitesDuPalier(palier);
  return r.filter((o) => ouvertes.includes(o.disponibilite)).map((o) => o.id);
};
/** Le héros manie-t-il l'arme `id` : un Groupe proposé à tous (`GROUPES_SANS_COMPETENCE`), ou que couvre pleinement
 *  (`maniement`) une Compétence de Corps à corps ou de Projectiles de sa fiche ou de sa carrière (`progression`). */
function manie(h: Pick<Heros, 'c'>, id: string): boolean {
  if (GROUPES_SANS_COMPETENCE.has(articleDuCatalogue(id).groupe as GroupeDeLaForge)) return true;
  const deCarriere = progression(h.c).competences.filter((k) => k.ref.id === 'corps-a-corps' || k.ref.id === 'projectiles');
  const skills = [...h.c.skills, ...deCarriere.filter((k) => !h.c.skills.some((s) => s.id === k.ref.id && s.spec === k.ref.spec)).map((k) => ({ ...k.ref, characteristic: k.ref.id === 'projectiles' ? 'capacite-de-tir' as const : 'capacite-de-combat' as const, advances: 0 }))];
  return maniement({ ...h.c, skills }, id).maitrise === 'complet';
}
/** Les armes que la forge vend au héros `h` à son palier : celles qu'il manie (`manie`). */
export const armesEnVente = (e: Etat, h: Pick<Heros, 'c'>): Article[] => auPalier(RAYON_DE_LA_FORGE, e.batiments.forge).filter((id) => manie(h, id)).map(article);

/** Les armures d'une pièce que le héros porte (`armureRapideDe`). */
const armuresRapidesPortees = (h: Pick<Heros, 'c'>): ItemInstance[] =>
  (h.c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped && !!i.trappingId && armureRapideDe(i.trappingId) === i.trappingId);
/** Les armures que le héros garde en revêtant `neuve` : celles d'une pièce qu'il porte sans conflit de couche avec elle
 *  (`equipConflicts`), une armure Flexible sous une autre qui ne l'est pas ; le reste de son armure est laissé au forgeron.
 *  LDB 63 l.74 ; MyEdO/game#4208 */
function gardeesSous(h: Pick<Heros, 'c'>, neuve: ItemInstance): ItemInstance[] {
  const portees = armuresRapidesPortees(h);
  const conflits = new Set(equipConflicts({ items: portees }, neuve).map((i) => i.uid));
  return portees.filter((i) => !conflits.has(i.uid));
}
/** Une armure en vente (`ARMURES_DE_LA_FORGE`) : son prix, et ce que le héros porterait l'ayant revêtue sur ce qu'il garde
 *  (`gardeesSous`) : son Encombrement (`encombrementDesPieces`), ses PA par zone (`protectionDesPieces`) et ses qualités,
 *  Défauts et pénalités de port totales compris (`qualitesDesPieces`, LDB 63). */
export interface ArmureEnVente { id: ArmureDeLaForge; label: string; prix: number; enc: number; pa: { zone: string; pa: number }[]; qualites: Qualite[] }
/** Les armures que la forge vend au héros `h` : celles dont la Disponibilité est ouverte à son palier, hors de celle qu'il porte. */
export function armuresEnVente(e: Etat, h: Pick<Heros, 'c'>): ArmureEnVente[] {
  const portees = new Set(armuresRapidesPortees(h).map((i) => i.trappingId));
  return auPalier(rayon(ARMURES_DE_LA_FORGE), e.batiments.forge).filter((id) => !portees.has(id)).map((id) => {
    const neuve = doter([id], 'essai'), revetues = [...gardeesSous(h, neuve[0]), ...neuve];
    return {
      id: id as ArmureDeLaForge, label: articleDuCatalogue(id).label, prix: prixDe(id), enc: encombrementDesPieces(revetues),
      pa: protectionDesPieces(revetues), qualites: qualitesDesPieces(revetues),
    };
  });
}
/** Les potions et remèdes de l'hospice, rien tant qu'il est en ruine. */
export const provisionsEnVente = (e: Etat): Article[] => (enRuine(e.batiments, 'temple') ? [] : auPalier(RAYON_DE_L_HOSPICE, e.batiments.temple).map(article));

const objetDe = (h: Pick<Heros, 'c'>, uid?: string) => (uid ? h.c.items?.find((i) => i.uid === uid) : undefined);

/** Les deux sets d'armes du héros, reconnus à ce qu'ils tiennent et non au set en main, que le combat change : le
 *  set de tir tient une arme à distance (à défaut, le second set, vide) ; l'autre est le set de mêlée. */
function sets(h: Pick<Heros, 'c'>) {
  const tous = h.c.loadouts ?? [];
  const tir = tous.find((l) => objetDe(h, l.main)?.kind === 'distance') ?? tous.find((l, i) => i > 0 && !l.main);
  return { melee: tous.find((l) => l !== tir), tir };
}

/** Une pièce portée, décrite : son nom, son article au catalogue (`id`), son Encombrement, et ce que le catalogue ou
 *  la pièce en disent (Dégâts, mains, allonge, portée, qualités) ; pour une arme de tir, les `munitions` qui restent.
 *  Les PA d'une armure se lisent par zone au héros. */
export interface PieceDecrite { label: string; id?: string; enc: number; degats?: string; mains?: number; allonge?: string; portee?: number; qualites: Qualite[]; munitions?: { label: string; nombre: number } }
/** L'équipement du héros : ses deux mains (set de mêlée), son arme à distance (set de tir) et son armure portée. */
export function panoplie(h: Heros): { main?: PieceDecrite; secondaire?: PieceDecrite; tir?: PieceDecrite; armure?: PieceDecrite } {
  const { melee, tir } = sets(h);
  const arme = (uid?: string): PieceDecrite | undefined => {
    const it = objetDe(h, uid);
    if (!it) return undefined;
    const a = it.trappingId ? articleDuCatalogue(it.trappingId) : undefined;
    const munition = MUNITIONS[it.trappingId ?? ''];
    const reste = (h.c.items ?? []).filter((i) => i.trappingId === munition);
    return {
      label: it.label, enc: Number(it.enc ?? 0), qualites: a?.qualites ?? [], ...(it.trappingId ? { id: it.trappingId } : {}), ...(a?.degats ? { degats: a.degats } : {}), ...(a?.mains ? { mains: a.mains } : {}), ...(a?.allonge ? { allonge: a.allonge } : {}), ...(a?.portee ? { portee: a.portee } : {}),
      ...(munition ? { munitions: { label: articleDuCatalogue(munition).label, nombre: reste.reduce((n, i) => n + (i.qty ?? 1), 0) } } : {}),
    };
  };
  const portees = (h.c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped);
  return {
    main: arme(melee?.main), secondaire: arme(melee?.secondaire), tir: arme(tir?.main),
    ...(portees.length ? { armure: {
      label: portees.map((i) => i.label).join(', '), enc: encombrementDesPieces(portees), qualites: qualitesDesPieces(portees),
    } } : {}),
  };
}

/** Ce qui se voit du héros équipé : la forme (`shape.id`) de ce que tiennent ses mains (set de mêlée) et combien de
 *  mains prend son arme, la forme de son arme de tir, la plus lourde des armures d'une pièce dans lesquelles se lit son
 *  armure (`armureRapideDe`) et les membres couverts. */
export interface Allure { main?: { forme: string; mains: number }; secondaire?: string; tir?: string; armure?: { poids: ArmureDeLaForge; bras: boolean; jambes: boolean } }
export function allure(h: Pick<Heros, 'c'>): Allure {
  const lo = sets(h), main = objetDe(h, lo.melee?.main), secondaire = objetDe(h, lo.melee?.secondaire), tir = objetDe(h, lo.tir?.main);
  const portees = (h.c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped);
  const lues = new Set(portees.map((i) => i.trappingId && armureRapideDe(i.trappingId)));
  const poids = [...ARMURES_DE_LA_FORGE].reverse().find((b) => lues.has(b));
  const couvre = (zone: 'bras' | 'jambe') => portees.some((i) => i.locs?.some((l) => l.startsWith(zone)));
  return {
    ...(main?.shape ? { main: { forme: main.shape.id, mains: main.hands ?? 1 } } : {}), ...(secondaire?.shape ? { secondaire: secondaire.shape.id } : {}),
    ...(tir?.shape ? { tir: tir.shape.id } : {}), ...(poids ? { armure: { poids, bras: couvre('bras'), jambes: couvre('jambe') } } : {}),
  };
}

export function payer(e: Etat, h: Heros | undefined, prix: number): string | null {
  if (!h) return 'Héros introuvable.';
  if (e.expedition?.groupe.includes(h.c.id)) return 'Ce héros est en expédition.';
  const refus = refusDuPrix(e.or, prix);
  if (refus) return refus;
  e.or -= prix;
  return null;
}

/** Le héros sait-il se battre à deux armes (Talent Maniement de deux armes) ? Sinon, la main secondaire ne tient qu'un
 *  bouclier ou ce qu'il portait déjà. */
export const manieDeuxArmes = (h: Heros): boolean => (h.c.talents ?? []).some((t) => t.talentId === 'maniement-de-deux-armes');
const estUnBouclier = (armeId: string) => !!articleDuCatalogue(armeId).bouclier;

/** Achète l'arme `armeId` au héros et la lui fait tenir : une arme à distance au set de tir, les autres au set de
 *  mêlée, qu'il garde en main hors du combat ; l'objet qu'elle remplace est laissé au forgeron. */
export function acheterUneArme(e: Etat, id: string, armeId: string): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  if (!armesEnVente(e, h).some((a) => a.id === armeId)) return 'La forge ne la lui vend pas.';
  const tenue = article(armeId).tenue;
  if (tenue === 'secondaire' && !estUnBouclier(armeId) && !manieDeuxArmes(h)) return 'Une arme en main secondaire demande le Talent Maniement de deux armes.';
  const refus = payer(e, h, prixDe(armeId));
  if (refus) return refus;
  const { melee, tir } = sets(h);
  const lo = tenue === 'tir' ? tir : melee;
  const munition = MUNITIONS[armeId];
  const neufs = doter(munition && !h.c.items?.some((i) => i.trappingId === munition) ? [armeId, munition] : [armeId], `forge${e.graine++}`);
  const slot = tenue === 'secondaire' || (tenue === 'tir' && secondeArmeDeTir(h, lo?.main, neufs[0])) ? 'secondaire' : 'main';
  const ancien = lo?.[slot];
  const avant = h.c;
  h.c = { ...h.c, items: [...(h.c.items ?? []).filter((i) => i.uid !== ancien), ...neufs] };
  // Hors du combat il garde en main son set de mêlée ; sans arme de mêlée, son set de tir.
  const enMain = tenue !== 'main' && !melee?.main && (tenue === 'tir' || tir?.main) ? tir : melee;
  const ligne = lo && enMain ? auNoyau(e, h, [gesteDeLaMain(h.c.id, lo.id, slot, neufs[0].uid), gesteDePrendreLaPanoplie(h.c.id, enMain.id)]) : 'Ce héros n’a pas de panoplie.';
  if ((h.c.loadouts ?? []).some((l) => l[slot] === neufs[0].uid)) {
    if (tenue !== 'tir') reprendreLaMainSecondaire(e, h, lo!.id, armeId);
    return null;
  }
  h.c = avant;
  e.or += prixDe(armeId);
  return ligne || 'Le forgeron ne peut pas lui mettre cette arme en main.';
}

/** L'arme de tir `neuve` va-t-elle en main secondaire du set de tir, à côté de celle que tient sa main principale
 *  (`tenue`) ? Seulement pour qui manie deux armes, les deux tenables d'une main (`tenableEnMainSecondaire`). LDB 14 l.138 */
function secondeArmeDeTir(h: Heros, tenue: string | undefined, neuve: ItemInstance): boolean {
  const principale = objetDe(h, tenue);
  return !!principale && manieDeuxArmes(h) && tenableEnMainSecondaire(principale) && tenableEnMainSecondaire(neuve);
}

/** Une arme à une main libère la main secondaire : la dague ou le bouclier resté au sac y revient. */
function reprendreLaMainSecondaire(e: Etat, h: Heros, loadout: string, armeId: string): void {
  if (article(armeId).tenue === 'secondaire' || articleDuCatalogue(armeId).mains === 2) return;
  const lo = (h.c.loadouts ?? []).find((l) => l.id === loadout);
  if (!lo || lo.secondaire) return;
  const tenus = new Set((h.c.loadouts ?? []).flatMap((l) => [l.main, l.secondaire]));
  const libre = (h.c.items ?? []).find((i) => i.trappingId && estUneArme(i) && article(i.trappingId).tenue === 'secondaire' && !tenus.has(i.uid));
  if (libre) auNoyau(e, h, [gesteDeLaMain(h.c.id, loadout, 'secondaire', libre.uid)]);
}

/** Remet au héros les objets `ids` du catalogue et les lui fait tenir (`tenirLesObjets`). */
export function remettreLesObjets(e: Etat, h: Heros, ids: readonly string[]): void {
  tenirLesObjets(e, h, doter(ids, `dotation${e.graine++}`));
}

const estUneArme = (i: ItemInstance): boolean => !!i.trappingId && (i.kind === 'melee' || i.kind === 'distance');

/** Donne au héros les objets `neufs`, et les munitions de leurs armes qu'il ne porte pas, lui fait porter leurs
 *  armures par le noyau (`equiperLObjet`) et tenir leurs armes : une arme à distance au set de tir, à sa première main libre ; un objet de main
 *  secondaire au set de mêlée ; une autre arme en main principale. Ce qu'ils remplacent reste à son sac. */
export function tenirLesObjets(e: Etat, h: Heros, neufs: readonly ItemInstance[]): void {
  const armes = neufs.filter(estUneArme);
  const portes = [...(h.c.items ?? []), ...neufs.map((i) => (i.kind === 'armor' ? { ...i, equipped: false } : i))];
  const munitions = [...new Set(armes.flatMap((i) => MUNITIONS[i.trappingId!] ?? []))].filter((m) => !portes.some((i) => i.trappingId === m));
  h.c = { ...h.c, items: [...portes, ...(munitions.length ? doter(munitions, `munitions${e.graine++}`) : [])] };
  const { melee, tir } = sets(h);
  const garnis = new Set<string>();
  const gestes = armes.flatMap((it) => {
    const tenue = article(it.trappingId!).tenue;
    const lo = tenue === 'tir' ? tir : melee;
    if (!lo) return [];
    const slot = tenue === 'secondaire' || (tenue === 'tir' && (lo.main || garnis.has(lo.id))) ? 'secondaire' : 'main';
    garnis.add(lo.id);
    return [gesteDeLaMain(h.c.id, lo.id, slot, it.uid)];
  });
  const armures = neufs.filter((i) => i.kind === 'armor').map((i) => gesteDeLObjet(h.c.id, i.uid, 'porter'));
  if (gestes.length || armures.length) auNoyau(e, h, [...gestes, ...armures]);
}

const degatsDe = (i: ItemInstance): number => (i.damage as { flat?: number } | undefined)?.flat ?? 0;

/** Le héros prend ses armes de mêlée : en main principale, l'arme que sa carrière nomme (`spec`) plutôt que son
 *  double générique ; s'il manie deux armes (`manieDeuxArmes`), sa meilleure autre arme à une main en main secondaire,
 *  à la place d'une arme moindre. */
export function prendreSesArmes(e: Etat, h: Heros): void {
  const lo = sets(h).melee;
  if (!lo) return;
  const items = h.c.items ?? [];
  const tenue = objetDe(h, lo.main);
  const nommee = tenue && !tenue.spec ? items.find((i) => i.trappingId === tenue.trappingId && i.spec && i.uid !== tenue.uid) : undefined;
  const main = nommee?.uid ?? lo.main;
  const gestes: Geste[] = nommee ? [gesteDeLaMain(h.c.id, lo.id, 'main', nommee.uid)] : [];
  const secondaire = objetDe(h, lo.secondaire);
  if (manieDeuxArmes(h) && !(secondaire?.trappingId && estUnBouclier(secondaire.trappingId))) {
    const tenus = new Set((h.c.loadouts ?? []).flatMap((l) => (l.id === lo.id ? [main] : [l.main, l.secondaire])));
    const meilleure = items.filter((i) => i.kind === 'melee' && (i.hands ?? 1) === 1 && !tenus.has(i.uid)).sort((a, b) => degatsDe(b) - degatsDe(a))[0];
    if (meilleure && (!secondaire || secondaire.uid === main || degatsDe(meilleure) > degatsDe(secondaire))) gestes.push(gesteDeLaMain(h.c.id, lo.id, 'secondaire', meilleure.uid));
  }
  if (gestes.length) auNoyau(e, h, gestes);
}

/** Achète l'armure `armureId` au héros : il garde dessous ou dessus les armures d'une pièce qui s'y superposent
 *  (`gardeesSous`), laisse le reste de son armure au forgeron, sans reprise, et le noyau la lui fait revêtir
 *  (`tenirLesObjets`). */
export function acheterUneArmure(e: Etat, id: string, armureId: string): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  if (armuresRapidesPortees(h).some((i) => i.trappingId === armureId)) return 'Il la porte déjà.';
  const offre = armuresEnVente(e, h).find((a) => a.id === armureId);
  if (!offre) return 'La forge ne la vend pas encore.';
  const essai = doter([armureId], 'essai')[0], gardees = gardeesSous(h, essai);
  const dr = drPerdusSousLesPieces(h.c, [...gardees, essai]);
  if (dr) return `${offre.label} : −${dr} DR à ses Tests d’Incantation.`; // LDB 46 l.150-152
  const refus = payer(e, h, offre.prix);
  if (refus) return refus;
  h.c = { ...h.c, items: (h.c.items ?? []).filter((i) => i.kind !== 'armor' || gardees.includes(i)) };
  tenirLesObjets(e, h, doter([armureId], `forge${e.graine++}`));
  return null;
}

/** Achète au héros la potion ou le remède `objetId` de l'hospice. */
export function acheterUneProvision(e: Etat, id: string, objetId: string): string | null {
  const h = heros(e, id);
  if (!provisionsEnVente(e).some((a) => a.id === objetId)) return 'L’hospice n’en vend pas encore.';
  const refus = payer(e, h, prixDe(objetId));
  if (refus || !h) return refus;
  h.c.items = [...(h.c.items ?? []), ...doter([objetId], `hospice${e.graine++}`)];
  return null;
}

/** Les potions et remèdes qu'un héros porte, regroupés : une entrée par objet du catalogue, avec un uid à utiliser. */
export function provisionsPortees(h: Heros): { id: string; label: string; nombre: number; uid: string; refus: string | null }[] {
  const out = new Map<string, { id: string; label: string; nombre: number; uid: string; refus: string | null }>();
  for (const i of h.c.items ?? []) {
    if (!i.trappingId || !REMEDES.has(i.trappingId)) continue;
    const prev = out.get(i.trappingId);
    if (prev) prev.nombre += i.qty ?? 1;
    else out.set(i.trappingId, { id: i.trappingId, label: i.label, nombre: i.qty ?? 1, uid: i.uid, refus: refusDUsage(h.c, i.uid) });
  }
  return [...out.values()];
}
