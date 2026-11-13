/**
 * LES ARMES DESSINÉES d'un porteur, sans art (#2097, #2948) : la seule attribution des mains (`mainsDesArmes`), les armes
 * tenues et rangées d'un combattant (`armesDuCombattant`, que lit ce qu'il porte, `porteeDuCombattant`), les armes
 * qu'une entité de scène déclare (`armesDEntite`, l'éditeur), son emblème (`emblemeDe`) et la forme qu'une arme donne à
 * lire (`armeDeDessin`), keyés par ids stables.
 */
import type { Combatant, Weapon, Main } from '../engine/types';
import {
  apparencesCandidates,
  apparencesObjetsDe,
  deciderApparencesDesArmes,
  isWeaponActive,
  objetDeSlot,
  objetsDeLInventaire,
  peutEtreTenu,
  weaponFromItem,
  weaponHands,
  type ContexteDeManiement,
  type TrappingResolver,
  isShieldItem,
} from '../engine/items';
import { renderWeaponsFromTraits, traitsDevantLEquipement } from '../engine/creatureEquip';
import type { TraitInstance } from '../engine/statEntry';
import { porteurDuProfil, traitsDeLIndividu } from './monde/spawn';
import type { TraitPose } from '../data/schemas/grammaire/reference';
import type { EntityAppearance } from '../engine/authoringAppearance';
import { findCreatureById } from '../data';
import { enrolledEntityIds, type Scene, type SceneEntity } from './monde/scene';
import { emblemeDuPorteur, type EmblemeResolu } from './apparence/gardeRobe';

/** Clés d'objet lues par le dessin (#2097) : `FormeDArme` en dérive. */
const CLES_ARME = ['attackKind', 'hands', 'natural', 'teinte', 'subType', 'type'] as const;

/** Ce que le dessin lit d'une arme : ses clés et ses candidats résolus, dont la dernière entrée est la racine. */
export type FormeDArme = Pick<Weapon, (typeof CLES_ARME)[number]> & { candidats: readonly string[] };
/** `hands` : mains qu'occupe l'arme pour SON porteur (`weaponHands`, monté ou non). */
type ObjetDArme = FormeDArme & { bouclier: boolean; hands: 1 | 2 };
type ArmeDeDessin = ObjetDArme & { hand: Main };

/** Copie DÉTACHÉE des seules clés listées : aucune référence vivante ne survit à la projection. */
function projeter<T extends object, K extends keyof T>(src: T, cles: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of cles) if (src[k] !== undefined) out[k] = structuredClone(src[k]);
  return out;
}

/** L'arme `w` dessinée seule : ses clés, ses mains, ses candidats, et la main que lui donne `mainsDesArmes`. */
export function armeDeDessin(w: Weapon, maniement: ContexteDeManiement = {}): ArmeDeDessin {
  const [{ hand }] = mainsDesArmes([w], maniement).tenues;
  return { ...projeter(w, CLES_ARME), hands: weaponHands(w, maniement), candidats: apparencesCandidates(w), bouclier: isShieldItem(w), hand };
}

/** Les armes tenues, chacune à sa main, et le surplus, chacun dans l'ordre relatif de `weapons` : la seule attribution
 *  des mains. Les mains explicites passent d'abord ; une arme naturelle ne réserve aucune main. */
function mainsDesArmes(weapons: readonly Weapon[], maniement: ContexteDeManiement): { tenues: { arme: Weapon; hand: Main }[]; surplus: Weapon[] } {
  const libres = new Set<Main>(['main', 'secondaire']);
  const tenues: { position: number; arme: Weapon; hand: Main }[] = [];
  const surplus: { position: number; arme: Weapon }[] = [];
  const priorites = weapons.map((w, position) => ({ w, position })).sort((a, b) => Number(a.w.hand === undefined) - Number(b.w.hand === undefined));
  for (const { w, position } of priorites) {
    const hands = weaponHands(w, maniement);
    const hand = w.hand ?? (isShieldItem(w) ? 'secondaire' : w.natural || libres.has('main') ? 'main' : 'secondaire');
    if (w.natural) { tenues.push({ position, arme: w, hand }); continue; }
    if (!libres.has(hand) || (hands === 2 && libres.size !== 2)) { surplus.push({ position, arme: w }); continue; }
    tenues.push({ position, arme: w, hand });
    libres.delete(hand);
    if (hands === 2) libres.clear();
  }
  const parPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
  return { tenues: tenues.sort(parPosition).map(({ arme, hand }) => ({ arme, hand })), surplus: surplus.sort(parPosition).map((s) => s.arme) };
}

/** L'emblème d'un porteur : celui de son apparence d'auteur, sinon celui de sa créature. */
export function emblemeDe(override: Pick<EntityAppearance, 'embleme'> | undefined, creatureId: string | undefined): EmblemeResolu | undefined {
  return emblemeDuPorteur(override?.embleme ?? findCreatureById(creatureId)?.appearance?.embleme);
}

/** Armes RANGÉES d'un combattant : les objets des slots `main`/`secondaire` de TOUS ses sets (`objetDeSlot`), sauf
 *  ceux qu'il tient (`isWeaponActive`). Un objet porté au fourreau n'est pas manié : aucun veto de maniement. */
function armesRangees(c: Combatant, maniement: ContexteDeManiement): Weapon[] {
  const uids = new Set((c.loadouts ?? []).flatMap((lo) => [lo.main, lo.secondaire]));
  return [...uids].filter((uid) => !isWeaponActive(c, uid)).flatMap((uid) => {
    const it = objetDeSlot(c, uid);
    return it ? [weaponFromItem(it, undefined, maniement)] : [];
  });
}

/** Les armes d'un combattant : tenues, chacune à sa main (`mainsDesArmes`), puis rangées (`armesRangees`, puis le
 *  surplus des mains). */
export function armesDuCombattant(c: Combatant): { tenues: { arme: Weapon; hand: Main }[]; rangees: Weapon[] } {
  const maniement: ContexteDeManiement = { mounted: !!c.mountId };
  const { tenues, surplus } = mainsDesArmes(c.weapons ?? [], maniement);
  return { tenues, rangees: [...armesRangees(c, maniement), ...surplus] };
}

/** Ce qu'une ENTITÉ de scène déclare de ses armes : apparence d'auteur (`apparencesObjets`), inventaire d'auteur
 *  (`SceneEntity.inventaire`), statbloc d'éditeur (`traits`), enrôlement. */
interface EquipementDAuteur extends Pick<EntityAppearance, 'apparencesObjets'> {
  inventaire?: SceneEntity['inventaire'];
  traits?: readonly TraitPose[];
  /** Profil du statbloc d'éditeur : référent des Indices formulés de ses `traits`. */
  char?: Partial<Record<string, number | null>>;
  /** Id du porteur (l'entité de scène) : ses fourchettes de Trait se tirent comme à son spawn. */
  porteur?: string;
  /** Membre d'une rencontre : porte les ARMES des traits de son record (parité avec `creatureToCombatant`). */
  enrolled?: boolean;
}

/** Ce que déclare une entité de la scène `scene` : son apparence d'auteur, son inventaire, son statbloc d'éditeur, son
 *  enrôlement (`enrolledEntityIds`). */
export const equipementDAuteurDe = (ent: Pick<SceneEntity, 'id' | 'appearance' | 'inventaire' | 'statblock'>, scene: Scene): EntityAppearance & EquipementDAuteur => ({
  ...ent.appearance, inventaire: ent.inventaire, traits: ent.statblock?.traits, char: ent.statblock?.char, enrolled: enrolledEntityIds(scene).has(ent.id), porteur: ent.id,
});

/** Traits du porteur d'auteur, statbloc d'éditeur sinon record, tirés pour lui comme à son spawn
 *  (`traitsDeLIndividu`), leurs Indices formulés lus sur le profil qui les porte (`porteurDuProfil`). */
function traitsDeLEntite(ref: string | undefined, opts: EquipementDAuteur): TraitInstance[] {
  const rec = opts.traits ? undefined : findCreatureById(ref);
  const poses = opts.traits ?? rec?.traits ?? [];
  return traitsDeLIndividu(poses, porteurDuProfil(opts.porteur ?? ref ?? '', (opts.traits ? opts.char : rec?.char) ?? {}));
}

/** Armes du porteur d’auteur : celles de son inventaire, puis celles des traits explicites ou d’une entité enrôlée qui
 *  restent devant lui (`traitsDevantLEquipement`), comme à son spawn (`spawn.ts`). */
export function armesDEntite(resolveTrapping: TrappingResolver, ref: string | undefined, opts: EquipementDAuteur = {}): Weapon[] {
  const objets = objetsDeLInventaire(opts.inventaire ?? {}, (t) => `${opts.porteur ?? ref}-objet-${t}`, apparencesObjetsDe(opts, ref), resolveTrapping);
  const traits = traitsDevantLEquipement(traitsDeLEntite(ref, opts), objets, resolveTrapping);
  const armes = [...objets.filter(peutEtreTenu).map((o) => weaponFromItem(o)), ...renderWeaponsFromTraits(opts.traits || opts.enrolled ? traits : [], resolveTrapping)];
  deciderApparencesDesArmes(resolveTrapping, armes, opts, ref, objets);
  return armes;
}
