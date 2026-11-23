/**
 * La forge et le relais : équipement et provisions.
 */
import { refusDUsage, qualitesDites, doter, armureRapide, articleDuCatalogue, ARMURES_RAPIDES, type ArticleDuCatalogue, type PoidsDArmure, type Qualite } from '../noyau';

import { ARMES_DE_FORGE, ARMURES_DE_FORGE, ECHELLE_DES_PRIX, MAIN_SECONDAIRE, MUNITIONS, PROVISIONS } from './valeurs';
import { Etat, Heros } from './etat';
import { auNoyau, heros } from './outils';

export const prixDe = (id: string): number => Math.max(1, Math.round(articleDuCatalogue(id).prixCO * ECHELLE_DES_PRIX));
export const prixDArmure = (p: PoidsDArmure): number => Math.round({ legere: 2, moyenne: 5, lourde: 30 }[p] * ECHELLE_DES_PRIX); // LDB 63 l.95-103

/** Un objet en vente : ce que le catalogue en dit, son prix au hameau, et la main où il se tient (arme). */
export interface Article extends ArticleDuCatalogue { id: string; prix: number; tenue: 'main' | 'secondaire' }
export const article = (id: string): Article => ({ ...articleDuCatalogue(id), id, prix: prixDe(id), tenue: MAIN_SECONDAIRE.has(id) ? 'secondaire' : 'main' });
export const armesEnVente = (e: Etat): Article[] => ARMES_DE_FORGE.slice(0, e.batiments.forge + 1).flat().map(article);
export interface ArmureEnVente { poids: PoidsDArmure; label: string; prix: number; enc: number; pa: number; qualites: Qualite[] }
export const armuresEnVente = (e: Etat): ArmureEnVente[] =>
  ARMURES_DE_FORGE.slice(0, e.batiments.forge + 1).map((poids) => {
    const a = ARMURES_RAPIDES[poids];
    return { poids, label: a.label, prix: prixDArmure(poids), enc: a.enc, pa: a.pa, qualites: qualitesDites(a.qualites) };
  });
export const provisionsEnVente = (e: Etat): Article[] => PROVISIONS.slice(0, e.batiments.relais + 1).flat().map(article);

/** Le set d'armes que le héros a en main. */
const setActif = (h: Pick<Heros, 'c'>) => (h.c.loadouts ?? []).find((l) => l.id === h.c.activeLoadoutId) ?? h.c.loadouts?.[0];

/** Ce que le héros tient : main principale, main secondaire (du set actif), armure portée et ses PA au corps. */
export function equipement(h: Heros): { main?: string; secondaire?: string; armure?: string; pa: number } {
  const lo = setActif(h);
  const nom = (uid?: string) => (uid ? h.c.items?.find((i) => i.uid === uid)?.label : undefined);
  return { main: nom(lo?.main), secondaire: nom(lo?.secondaire), armure: h.c.items?.filter((i) => i.kind === 'armor' && i.equipped).map((i) => i.label).join(', ') || undefined, pa: h.c.armour.corps };
}

/** Une pièce portée, décrite : son nom, son article au catalogue (`id`), son Encombrement, et ce que le catalogue ou
 *  la pièce en disent (Dégâts, mains, allonge, portée, qualités). Les PA d'une armure se lisent par zone au héros. */
export interface PieceDecrite { label: string; id?: string; enc: number; degats?: string; mains?: number; allonge?: string; portee?: number; qualites: Qualite[] }
/** La panoplie du héros : ses deux mains (set actif) et son armure portée, décrites. */
export function panoplie(h: Heros): { main?: PieceDecrite; secondaire?: PieceDecrite; armure?: PieceDecrite } {
  const lo = setActif(h);
  const arme = (uid?: string): PieceDecrite | undefined => {
    const it = uid ? h.c.items?.find((i) => i.uid === uid) : undefined;
    if (!it) return undefined;
    const a = it.trappingId ? articleDuCatalogue(it.trappingId) : undefined;
    return { label: it.label, enc: Number(it.enc ?? 0), qualites: a?.qualites ?? [], ...(it.trappingId ? { id: it.trappingId } : {}), ...(a?.degats ? { degats: a.degats } : {}), ...(a?.mains ? { mains: a.mains } : {}), ...(a?.allonge ? { allonge: a.allonge } : {}), ...(a?.portee ? { portee: a.portee } : {}) };
  };
  const portees = (h.c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped);
  return {
    main: arme(lo?.main), secondaire: arme(lo?.secondaire),
    ...(portees.length ? { armure: { label: portees.map((i) => i.label).join(', '), enc: portees.reduce((n, i) => n + Number(i.enc ?? 0), 0), qualites: qualitesDites(portees.flatMap((i) => i.qualities ?? [])) } } : {}),
  };
}

/** Ce qui se voit du héros équipé : la forme (`shape.id`) de ce que tiennent ses mains et combien de mains prend son
 *  arme, la forme de l'arme de tir d'un autre set, le poids de son armure la plus lourde et les membres couverts. */
export interface Allure { main?: { forme: string; mains: number }; secondaire?: string; tir?: string; armure?: { poids: PoidsDArmure; bras: boolean; jambes: boolean } }
const POIDS_DE_MATIERE: Record<string, PoidsDArmure> = { 'cuir-souple': 'legere', 'cuir-bouilli': 'legere', mailles: 'moyenne', plate: 'lourde' };
export function allure(h: Pick<Heros, 'c'>): Allure {
  const objet = (uid?: string) => (uid ? h.c.items?.find((i) => i.uid === uid) : undefined);
  const lo = setActif(h), main = objet(lo?.main), secondaire = objet(lo?.secondaire);
  const tir = (h.c.loadouts ?? []).map((l) => objet(l.main)).find((i) => i && i !== main && i.kind === 'distance');
  const portees = (h.c.items ?? []).filter((i) => i.kind === 'armor' && i.equipped);
  const poids = [...ARMURES_DE_FORGE].reverse().find((p) => portees.some((i) => POIDS_DE_MATIERE[i.subType ?? ''] === p));
  const couvre = (zone: 'bras' | 'jambe') => portees.some((i) => i.locs?.some((l) => l.startsWith(zone)));
  return {
    ...(main?.shape ? { main: { forme: main.shape.id, mains: main.hands ?? 1 } } : {}), ...(secondaire?.shape ? { secondaire: secondaire.shape.id } : {}),
    ...(tir?.shape ? { tir: tir.shape.id } : {}), ...(poids ? { armure: { poids, bras: couvre('bras'), jambes: couvre('jambe') } } : {}),
  };
}

export function payer(e: Etat, h: Heros | undefined, prix: number): string | null {
  if (!h) return 'Héros introuvable.';
  if (e.expedition?.groupe.includes(h.c.id)) return 'Ce héros est en expédition.';
  if (e.or < prix) return `Il faut ${prix} CO.`;
  e.or -= prix;
  return null;
}

/** Achète l'arme `armeId` au héros et la lui met en main ; l'objet qu'elle remplace est laissé au forgeron. */
/** Le héros sait-il se battre à deux armes (Talent Maniement de deux armes) ? Sinon, la main secondaire ne tient qu'un
 *  bouclier ou ce qu'il portait déjà. */
export const manieDeuxArmes = (h: Heros): boolean => (h.c.talents ?? []).some((t) => t.talentId === 'maniement-de-deux-armes');
const estUnBouclier = (armeId: string) => /^bouclier/.test(armeId);

export function acheterUneArme(e: Etat, id: string, armeId: string): string | null {
  const h = heros(e, id);
  if (!armesEnVente(e).some((a) => a.id === armeId)) return 'La forge ne la vend pas encore.';
  if (h && MAIN_SECONDAIRE.has(armeId) && !estUnBouclier(armeId) && !manieDeuxArmes(h)) return 'Une arme en main secondaire demande le Talent Maniement de deux armes.';
  const refus = payer(e, h, prixDe(armeId));
  if (refus || !h) return refus;
  const slot = MAIN_SECONDAIRE.has(armeId) ? 'secondaire' : 'main';
  const lo = setActif(h);
  const ancien = lo?.[slot];
  const munition = MUNITIONS[armeId];
  const neufs = doter(munition && !h.c.items?.some((i) => i.trappingId === munition) ? [armeId, munition] : [armeId], `forge${e.graine++}`);
  const avant = h.c;
  h.c = { ...h.c, items: [...(h.c.items ?? []).filter((i) => i.uid !== ancien), ...neufs] };
  const ligne = lo ? auNoyau(e, h, [{ verbe: 'garnirLaPanoplie', args: [h.c.id, lo.id, slot, neufs[0].uid] }]) : 'Ce héros n’a pas de panoplie.';
  if ((h.c.loadouts ?? []).some((l) => l[slot] === neufs[0].uid)) {
    reprendreLaMainSecondaire(e, h, lo!.id, armeId);
    return null;
  }
  h.c = avant;
  e.or += prixDe(armeId);
  return ligne || 'Le forgeron ne peut pas lui mettre cette arme en main.';
}

/** Une arme à une main libère la main secondaire : la dague ou le bouclier resté au sac y revient. */
function reprendreLaMainSecondaire(e: Etat, h: Heros, loadout: string, armeId: string): void {
  if (MAIN_SECONDAIRE.has(armeId) || articleDuCatalogue(armeId).mains === 2) return;
  const lo = (h.c.loadouts ?? []).find((l) => l.id === loadout);
  if (!lo || lo.secondaire) return;
  const tenus = new Set((h.c.loadouts ?? []).flatMap((l) => [l.main, l.secondaire]));
  const libre = (h.c.items ?? []).find((i) => i.trappingId && MAIN_SECONDAIRE.has(i.trappingId) && !tenus.has(i.uid));
  if (libre) auNoyau(e, h, [{ verbe: 'garnirLaPanoplie', args: [h.c.id, loadout, 'secondaire', libre.uid] }]);
}

/** Achète l'armure `poids` des règles rapides au héros et la lui fait porter ; ses anciennes pièces sont reprises. */
export function acheterUneArmure(e: Etat, id: string, poids: PoidsDArmure): string | null {
  const h = heros(e, id);
  if (!armuresEnVente(e).some((a) => a.poids === poids)) return 'La forge ne la vend pas encore.';
  const refus = payer(e, h, prixDArmure(poids));
  if (refus || !h) return refus;
  const neuve = armureRapide(poids, `forge${e.graine++}-armure`);
  h.c.items = [...(h.c.items ?? []).filter((i) => i.kind !== 'armor'), neuve];
  auNoyau(e, h, [{ verbe: 'equiperLObjet', args: [neuve.uid] }]);
  return null;
}

export function acheterUneProvision(e: Etat, id: string, objetId: string): string | null {
  const h = heros(e, id);
  if (!provisionsEnVente(e).some((a) => a.id === objetId)) return 'Le relais n’en vend pas encore.';
  const refus = payer(e, h, prixDe(objetId));
  if (refus || !h) return refus;
  h.c.items = [...(h.c.items ?? []), ...doter([objetId], `relais${e.graine++}`)];
  return null;
}

/** Les provisions qu'un héros porte, regroupées : une entrée par objet du catalogue, avec un uid à utiliser. */
export function provisionsPortees(h: Heros): { id: string; label: string; nombre: number; uid: string; refus: string | null }[] {
  const ids = new Set(PROVISIONS.flat());
  const out = new Map<string, { id: string; label: string; nombre: number; uid: string; refus: string | null }>();
  for (const i of h.c.items ?? []) {
    if (!i.trappingId || !ids.has(i.trappingId)) continue;
    const prev = out.get(i.trappingId);
    if (prev) prev.nombre += i.qty ?? 1;
    else out.set(i.trappingId, { id: i.trappingId, label: i.label, nombre: i.qty ?? 1, uid: i.uid, refus: refusDUsage(h.c, i.uid) });
  }
  return [...out.values()];
}
