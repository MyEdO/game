/**
 * Couture de l'hôte roguelite avec le noyau : un combat généré (arène, groupe, rencontre) lancé par la partie du
 * noyau (`ouvrirLeLancement`, `src/hote/partie.ts`), joué de bout en bout en cadence automatique : la cadence `auto`
 * fait jouer aux héros leur tour par l'IA du noyau. L'hôte ne résout aucune règle : il reprend les jetons programmés, joue le drive de
 * la fenêtre qui tient la main (`fenetreDuJeu`), et relève à chaque pas le plateau et le journal pour le rejeu.
 */
import { ouvrirLeLancement } from '../../src/hote/partie';
import { arena, setEncounters } from '../../src/scenes/test-scenarios/_shared';
import { fenetreDuJeu } from '../../src/noyau/combatAuto';
import { EVT, type ChargeDAttaque } from '../../src/noyau/bus';
import { footprintN } from '../../src/noyau/monde/footprint';
import { createHero } from '../../src/engine/character';
import { fabriqueLocale } from '../../src/engine/fabriqueDId';
import { inCareerChar, advanceCost, isCareerLevelComplete, careerChangeCost, talentCost } from '../../src/engine/advancement';
import { availableChars, skillSlots, talentSlots, designationsFor, parseRefKey } from '../../src/engine/careerSlots';
import { doterLePorteur } from '../../src/engine/bourse';
import { maxEncumbrance, totalEncumbrance } from '../../src/engine/items';
import { effectiveChar } from '../../src/engine/characteristics';
import { rollTest } from '../../src/engine/tests';
import { testValue } from '../../src/engine/skills';
import { makeRNG } from '../../src/engine/dice';
import { restRecovery } from '../../src/engine/rest';
import { applyHealWounds } from '../../src/engine/healing';
import { tickTraumaRecovery, applyFractureEnd, cureCriticalWounds, hasTreatableTrauma, treatTrauma, surgeryTraumas, removeSurgicalTrauma } from '../../src/engine/trauma';
import { encumbrancePenalties } from '../../src/engine/encumbrance';
import { consommableDe } from '../../src/engine/consumables';
import { refusDeConsommer } from '../../src/noyau/consumableFlow';
import { byId, findCareerById, findCreatureById, findSpellById, findTalentById, findTrappingById, levelsForCareer, characteristics, conditionLabel, refLabel } from '../../src/data';
import type { Combatant, CharKey, ItemInstance, HitLocation } from '../../src/engine/types';
import type { Intention } from '../../src/noyau/partie';

export type { Combatant, CharKey };
export type { RNG } from '../../src/engine/dice';
export { makeRNG };
export { generateName } from '../../src/engine/names';


/** Ce qui fait l'identité d'une recrue à sa création : le Talent de carrière choisi (et sa spécialisation : le dieu
 *  d'un Béni), les Sorts mineurs d'un lanceur. */
export interface Identite { talent: { id: string; spec?: string }; sortsMineurs?: readonly string[] }

/** Un héros neuf de la carrière `carriere`, tiré par la création du moteur (`createHero`) à la graine `graine`. */
export function nouvelleRecrue(graine: number, carriere: string, espece: string, nom: string, identite: Identite): Combatant {
  return createHero({
    idNeuf: fabriqueLocale(`r${graine}`), speciesId: espece, careerId: carriere, label: nom, seed: graine,
    careerTalent: identite.talent, ...(identite.sortsMineurs ? { pettySpells: [...identite.sortsMineurs] } : {}),
  });
}

/** Valeur courante d'une Caractéristique, Augmentations et effets compris. */
export const carac = (c: Combatant, k: CharKey): number => effectiveChar(c, k);

/** La Caractéristique `k` est-elle dans la carrière du héros (niveaux ≤ courant) ? Hors carrière, l'Augmentation coûte
 *  le double. LDB 07 l.43, l.91. */
export const dansLaCarriere = (c: Combatant, k: CharKey): boolean =>
  inCareerChar(availableChars(levelsForCareer(c.career ?? ''), c.careerLevel ?? 1), k);

/** Coût en PX de la prochaine Augmentation de `k`. */
export const coutDAugmentation = (c: Combatant, k: CharKey): number => advanceCost(c.charAdvances?.[k] ?? 0, 'caracteristique', dansLaCarriere(c, k));


/** `cases` : le côté de l'empreinte du corps, en cases (`footprintN` : 2 pour un Grand). */
export interface PionDuPlateau { id: string; label: string; camp: 'heros' | 'ennemi'; creature?: string; arme?: string; pv: number; max: number; x: number; y: number; cases: number; hors: boolean }
/** Un coup tel que le noyau l'annonce au rendu (`EVT.ANIM_ATTACK`, `ChargeDAttaque`). */
export interface Coup { de: string; vers: string; genre: 'melee' | 'distance' | 'creature' | 'spell'; touche: boolean; blessures: number; critique: boolean; defense: 'parade' | 'esquive' | 'aucune'; sort?: string }
/** Un État qu'un combattant gagne pendant le pas (`etatGagne` de la partie). */
export interface EtatGagne { porteur: string; etat: string }
/** Un pas du rejeu : les lignes du journal, le plateau, les coups portés, l'actif et l'ordre du round. */
export interface Pas { lignes: string[]; pions: PionDuPlateau[]; round: number; coups: Coup[]; etats: EtatGagne[]; actif: string | null; ordre: string[] }
export interface IssueDuCombat {
  issue: 'victoire' | 'defaite' | 'impasse';
  pas: Pas[];
  /** Le groupe tel que le noyau le rend après le combat (Blessures, États, morts). */
  groupe: Combatant[];
  /** Les héros tombés pour de bon. */
  morts: string[];
  largeur: number;
  hauteur: number;
}

/** Le coup d'une `ChargeDAttaque` : une arme ou une créature touche (`AttackResult.hit`) ; un sort à projectile touche
 *  (`MissileResult.hit`) ; un autre sort porte s'il est lancé et non dissipé (`CastResult.cast`). */
function coupDe(a: ChargeDAttaque): Coup {
  const base = { de: a.from, vers: a.to, genre: a.kind, defense: a.defense };
  if (a.kind === 'spell') {
    const r = a.result;
    const touche = a.projectile ? !!a.result.hit : r.cast && !r.dispelled;
    return { ...base, touche, blessures: a.projectile ? a.result.woundsLost ?? 0 : 0, critique: r.isCritical, sort: nomDeSort(a.spell) };
  }
  if (a.kind === 'creature') return { ...base, touche: true, blessures: 0, critique: false };
  return { ...base, touche: a.result.hit, blessures: a.result.woundsLost ?? 0, critique: !!a.result.critical };
}

type PartieOuverte = ReturnType<typeof ouvrirLeLancement>['partie'];
type Resultat = Parameters<ReturnType<typeof ouvrirLeLancement>['jetons']['programmes']>[0];

/** Joue la fenêtre qui tient la main : son drive, à défaut sa validation. Faux s'il n'y a rien à jouer (aucune
 *  fenêtre, ou une fenêtre qui attend un choix sans défaut). `apres` suit chaque geste. */
function jouerLaFenetre(partie: PartieOuverte, recevoir: (r: Resultat) => void, apres: () => void = () => {}): boolean {
  const f = fenetreDuJeu(partie.etat() as never);
  if (!f) return false;
  const suite = f.drive?.length ? f.drive : f.gestes.filter((g) => g.verbe === 'fenetreValider');
  if (!suite.length) return false;
  for (const g of suite) {
    recevoir(partie.envoyer({ type: g.verbe, args: g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : [] } as unknown as Intention));
    apres();
  }
  return true;
}

/** Plafond de pas : un combat qui ne se ferme pas s'arrête en impasse plutôt que de boucler. */
const PLAFOND_DE_PAS = 4000;

/** Joue le combat du `groupe` contre les créatures `ennemis` (ids du Bestiaire) à la graine `graine`.
 *  `lumiere` : id d'un `lightLevels` (`jour`, `crepuscule`…), posé sur la scène (`ambientLight`) ; sans lui, l'arène suit
 *  l'horloge et le premier jour tombe de nuit. */
export function jouerLeCombat(groupe: readonly Combatant[], ennemis: readonly string[], graine: number, lumiere = 'jour'): IssueDuCombat {
  const largeur = 14;
  const hauteur = Math.max(6, Math.max(groupe.length, ennemis.length) * 2);
  const { partie, jetons, lancement } = ouvrirLeLancement(
    { graine, regles: {}, cadence: 'auto', desFixes: false },
    () => {
      const scene = arena({ id: 'arene', label: 'Rencontre', w: largeur, h: hauteur, heroStart: { x: 2, y: Math.floor(hauteur / 2) } });
      scene.ambientLight = lumiere;
      setEncounters(scene, [{
        id: 'rencontre',
        enemies: ennemis.map((id, i) => ({ creature: { id }, pos: { x: largeur - 3, y: 1 + Math.round((i + 0.5) * (hauteur - 2) / ennemis.length - 0.5) }, facing: 'O' as const })),
      }]);
      return { party: groupe.map((h) => structuredClone(h)), scene, projet: null, combatDirect: 'rencontre' };
    },
    () => {},
  );
  const file: number[] = [];
  let coups: Coup[] = [];
  let etats: EtatGagne[] = [];
  const recevoir = (r: Parameters<typeof jetons.programmes>[0]) => {
    file.push(...jetons.programmes(r).map((p) => p.id));
    for (const e of r.evenements) {
      if (e.type === 'etatGagne') etats.push({ porteur: e.porteur, etat: e.etat });
      if (e.type !== 'emis' || e.evt !== EVT.ANIM_ATTACK) continue;
      coups.push(coupDe(e.payload as ChargeDAttaque));
    }
  };
  recevoir(lancement);

  const pas: Pas[] = [];
  let vus = 0;
  const releve = () => {
    const b = partie.etat().battle;
    if (!b) return;
    const lignes = b.log.slice(vus).map((l) => l.text).filter((t): t is string => !!t);
    vus = b.log.length;
    const montee = (c: Combatant) => !!c.riderId && b.combatants.some((r) => r.id === c.riderId && !r.dead);
    const pions = b.combatants.filter((c) => c.pos && !montee(c)).map((c): PionDuPlateau => ({
      id: c.id, label: c.label, camp: c.kind === 'heros' ? 'heros' : 'ennemi', ...(c.creatureId ? { creature: c.creatureId } : {}), ...(c.weapons[0] ? { arme: c.weapons[0].label } : {}),
      pv: Math.max(0, c.wounds.current), max: c.wounds.max, x: c.pos!.x, y: c.pos!.y, cases: footprintN(c),
      hors: !!c.dead || c.conditions.some((e) => e.id === 'inconscient'),
    }));
    const actif = b.order[b.turn] ?? null;
    const precedent = pas[pas.length - 1];
    const memePlateau = precedent && precedent.actif === actif && JSON.stringify(precedent.pions) === JSON.stringify(pions);
    if (memePlateau && lignes.length === 0 && coups.length === 0 && etats.length === 0) return;
    if (memePlateau && precedent.lignes.length === 0 && precedent.coups.length === 0) { precedent.lignes.push(...lignes); precedent.coups.push(...coups); precedent.etats.push(...etats); }
    else pas.push({ lignes, pions, round: b.round, coups, etats, actif, ordre: [...b.order] });
    coups = [];
    etats = [];
  };

  /** La rencontre close par le noyau : la fenêtre de fin fermée (`fenetreFermer`), le groupe revenu en exploration,
   *  débarrassé de ce qui ne vit que le temps d'une rencontre. Rend le groupe tel que l'état le porte alors. */
  const clore = (): Combatant[] => {
    for (let k = 0; k < 5 && partie.etat().battle; k++) {
      const ferme = fenetreDuJeu(partie.etat() as never)?.gestes.find((g) => g.verbe === 'fenetreFermer');
      if (!ferme) break;
      recevoir(partie.envoyer({ type: 'fenetreFermer', args: [ferme.fenetre] } as unknown as Intention));
      while (file.length) recevoir(jetons.reprendre(file.shift()!));
    }
    const e = partie.etat();
    const heros = e.battle ? e.battle.combatants.filter((c) => c.kind === 'heros') : e.party;
    return heros.map((c) => structuredClone(c));
  };

  let issue: IssueDuCombat['issue'] = 'impasse';
  let morts: string[] = [];
  let groupeFinal: Combatant[] = groupe.map((h) => structuredClone(h));
  for (let n = 0; n < PLAFOND_DE_PAS; n++) {
    while (file.length) {
      recevoir(jetons.reprendre(file.shift()!));
      releve();
    }
    const s = partie.etat();
    const fin = s.battle?.over;
    if (fin === 'victoire' || fin === 'defaite') {
      issue = fin;
      morts = (s.battle?.combatants ?? []).filter((c) => c.kind === 'heros' && c.dead).map((c) => c.id);
      groupeFinal = clore();
      break;
    }
    if (!jouerLaFenetre(partie, recevoir, releve)) break;
  }
  partie.fermer();
  return { issue, pas, groupe: groupeFinal, morts, largeur, hauteur };
}

/** `jours` journées de repos (LDB 18 l.296) et de convalescence des Blessures critiques (LDB 18 l.202-222), par les
 *  primitives du moteur ; le Test de fin d'une fracture est lancé sur place. Mute `c`, rend le journal. */
export function reposer(c: Combatant, graine: number, jours: number): string[] {
  const rng = makeRNG(graine);
  const lignes = restRecovery(c, rng, jours);
  const fins: string[] = [];
  const convalescence = tickTraumaRecovery(c, jours, (spec) => {
    const m = spec.meta as { severity: string; location: string; traumaLabel: string };
    const r = rollTest(spec.test ? testValue(c, spec.test) : spec.base, spec.difficulty, rng);
    fins.push(...applyFractureEnd(c, r.success, m.severity, m.location, m.traumaLabel));
  });
  return [...lignes, ...convalescence, ...fins];
}

/** `pv` Points de Blessure regagnés par un soin (`applyHealWounds`) : un Inconscient guéri revient à lui. */
export const soigner = (c: Combatant, pv: number): string[] => applyHealWounds(c, pv);

/** Les séquelles portées (`traumas`) et leur issue : jours de convalescence restants, chirurgie exigée (LDB 18 l.208,
 *  l.239), sinon permanente. */
export const sequelles = (c: Combatant): { label: string; jours?: number; chirurgie: boolean; desc?: string }[] =>
  (c.traumas ?? []).map((t) => ({ label: t.label, chirurgie: !!t.needsSurgery, ...(t.recoveryDays != null ? { jours: t.recoveryDays } : {}), ...(t.desc ? { desc: t.desc } : {}) }));

/** Ce qu'un soigneur peut encore faire des séquelles : des plaies à panser par la Guérison (LDB 18 l.204, l.222), des
 *  blessures à opérer (LDB 18 l.208, l.239). */
export const plaiesASoigner = (c: Combatant): { panser: boolean; operer: number } => ({ panser: panserSert(c), operer: surgeryTraumas(c).length });

/** Panser changerait-il une plaie ? Joué sur une copie, chaque Test réussi : une déchirure majeure n'est que
 *  diagnostiquée (LDB 18 l.231), une déchirure mineure raccourcit, une fracture est réduite. */
function panserSert(c: Combatant): boolean {
  if (!hasTreatableTrauma(c)) return false;
  const copie = structuredClone(c);
  const etatDe = (x: Combatant) => JSON.stringify((x.traumas ?? []).map((t) => [t.recoveryDays, t.fractureSet]));
  const avant = etatDe(copie);
  while (hasTreatableTrauma(copie)) treatTrauma(copie, 0, true);
  return etatDe(copie) !== avant;
}

/** Un soigneur de Guérison `valeur` panse chaque plaie qui le permet : un Test par plaie, le jet consommé même raté
 *  (`treatTrauma`). LDB 18 l.204, l.222 */
export function panserLesPlaies(c: Combatant, valeur: number, graine: number): string[] {
  const rng = makeRNG(graine);
  const lignes: string[] = [];
  while (hasTreatableTrauma(c)) {
    const r = rollTest(valeur, 'intermediaire', rng);
    lignes.push(...treatTrauma(c, r.sl, r.success));
  }
  return lignes;
}

/** L'opération réussie de chaque blessure qui exige la Chirurgie (`removeSurgicalTrauma`). LDB 10 l.184 */
export function opererLesBlessures(c: Combatant): string[] {
  const lignes: string[] = [];
  while (surgeryTraumas(c).length) lignes.push(...removeSurgicalTrauma(c));
  return lignes;
}

/** Guérit `n` Blessures critiques de convalescence, jamais une amputation (`cureCriticalWounds`). LDB 42 */
export const guerirDesSequelles = (c: Combatant, n: number): string[] => cureCriticalWounds(c, n);

/** Hors de combat : à 0 PB ou Inconscient. */
export const horsDeCombat = (c: Combatant): boolean => !!c.dead || c.wounds.current <= 0 || c.conditions.some((e) => e.id === 'inconscient');

/** Les Compétences qu'un combat automatique teste. */
const COMPETENCES_DU_COMBAT = new Set(['corps-a-corps', 'projectiles', 'esquive', 'calme', 'resistance', 'focalisation', 'priere', 'athletisme', 'intimidation']);
/** Le Talent agit-il dans un combat automatique : effet de combat, passif, effets, trait conféré, domaine ou voie de
 *  lanceur, ou bonus non manuel à un Test qu'un combat lance (`talents.json`) ? */
export function talentDeCombat(id: string): boolean {
  const t = findTalentById(id);
  if (!t) return false;
  if (t.combat || t.passive || t.effects || t.confereTrait || t.grantsArcaneDomain) return true;
  return (t.test?.matches ?? []).some((m) => !('manual' in m && m.manual) && 'skill' in m && !!m.skill && COMPETENCES_DU_COMBAT.has(m.skill.id));
}

/** Libellé d'une carrière (`careers.json`). */
export const nomDeCarriereDuLivre = (id: string): string => findCareerById(id)?.label ?? id;

/** Libellé d'un sort ou d'un miracle (`spells.json`). */
export const nomDeSort = (id: string): string => findSpellById(id)?.label ?? id;

/** Libellé du Bestiaire d'une créature. */
export const nomDeCreature = (id: string): string => findCreatureById(id)?.label ?? id;

/** Abréviation et libellé d'une Caractéristique, tels que la donnée les porte (`characteristics.json`). */
export function libelleDeCarac(k: CharKey): { abr: string; label: string } {
  const d = characteristics.find((x) => x.id === k);
  return { abr: d?.abr ?? k, label: d?.label ?? k };
}

/** Libellé d'un État porté (`etats.json`), sa valeur comprise. */
export const libelleDEtat = (id: string, valeur: number): string => {
  const nom = conditionLabel(id);
  return valeur > 1 ? `${nom} ${valeur}` : nom;
};

// ─── Au hameau : les actes hors combat, joués par le noyau ─────────────────────────────────────────────────

/** Un geste du noyau : un verbe de `ActionsDuNoyau` et ses arguments. */
export interface Geste { verbe: string; args: unknown[] }
export interface IssueAuHameau { groupe: Combatant[]; journal: string[] }

/** Joue `gestes` sur le `groupe` dans une partie du noyau ouverte hors combat (une place dégagée, en exploration) :
 *  achats aux PX, changement de niveau de carrière, objet utilisé, prière ou sort lancé. Rend le groupe tel que le
 *  noyau le laisse, et les lignes que son journal a écrites (refus compris). */
export function auHameau(groupe: readonly Combatant[], gestes: readonly Geste[], graine: number): IssueAuHameau {
  const { partie, jetons, lancement } = ouvrirLeLancement(
    { graine, regles: {}, cadence: 'auto', desFixes: false },
    () => ({ party: groupe.map((h) => structuredClone(h)), scene: arena({ id: 'hameau', label: 'Grisefosse', w: 8, h: 8 }), projet: null }),
    () => {},
  );
  const journal: string[] = [];
  const file: number[] = [];
  const recevoir = (r: Resultat) => {
    file.push(...jetons.programmes(r).map((p) => p.id));
    for (const l of r.journal) { const t = l.de === 'journal' ? l.texte : l.evenement.text; if (t) journal.push(t); }
  };
  const pomper = () => {
    for (let n = 0; n < 200; n++) {
      while (file.length) recevoir(jetons.reprendre(file.shift()!));
      if (!jouerLaFenetre(partie, recevoir)) return;
    }
  };
  recevoir(lancement);
  pomper();
  for (const g of gestes) {
    recevoir(partie.envoyer({ type: g.verbe, args: g.args } as unknown as Intention));
    pomper();
  }
  const rendu = partie.etat().party.map((c) => structuredClone(c));
  partie.fermer();
  return { groupe: rendu, journal };
}

// ─── Équipement : le catalogue et les armures des règles rapides ────────────────────────────────────────────

const PARTOUT: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
export type PoidsDArmure = 'legere' | 'moyenne' | 'lourde';
/** « Option : Armure, règles rapides » : trois armures couvrant tous les emplacements. LDB 63 l.95-103 */
export const ARMURES_RAPIDES: Record<PoidsDArmure, { label: string; pa: number; enc: number; matiere: string; qualites: { id: string; value?: number }[] }> = {
  legere: { label: 'Armure légère', pa: 1, enc: 1, matiere: 'cuir-bouilli', qualites: [{ id: 'flexible' }] },
  moyenne: { label: 'Armure moyenne', pa: 2, enc: 5, matiere: 'mailles', qualites: [{ id: 'flexible' }, { id: 'en-perception', value: -10 }, { id: 'en-discretion', value: -10 }] },
  lourde: { label: 'Armure lourde', pa: 3, enc: 6, matiere: 'plate', qualites: [{ id: 'impenetrable' }, { id: 'points-faibles' }, { id: 'en-perception', value: -20 }, { id: 'en-discretion', value: -20 }] },
};

/** L'armure rapide `poids`, née non portée (`equiperLObjet` la fait porter), sous l'uid `uid`. */
export function armureRapide(poids: PoidsDArmure, uid: string): ItemInstance {
  const a = ARMURES_RAPIDES[poids];
  return { uid, label: a.label, kind: 'armor', qualities: a.qualites.map((q) => ({ ...q })), pa: a.pa, locs: [...PARTOUT], enc: a.enc, equipped: false, subType: a.matiere } as ItemInstance;
}

/** Les objets du catalogue `ids`, nés sous le préfixe d'uid `prefixe` (unique par achat). */
export function doter(ids: readonly string[], prefixe: string): ItemInstance[] {
  return doterLePorteur(ids.map((id) => ({ id })) as never, makeRNG(ids.length), fabriqueLocale(prefixe)).items;
}

/** Ce que le catalogue dit d'un objet : libellé, Encombrement, prix en couronnes d'or (CO), et pour une arme ses
 *  Dégâts, ses mains, son allonge ou sa portée et ses qualités. */
export interface ArticleDuCatalogue { label: string; enc: number; prixCO: number; desc?: string; degats?: string; mains?: number; allonge?: string; portee?: number; qualites: string[] }
export function articleDuCatalogue(id: string): ArticleDuCatalogue {
  const t = findTrappingById(id);
  const p = t?.price && t.price !== 'ND' ? t.price : { gold: 0, silver: 0, brass: 0 };
  const d = t?.damage as { plusBF?: boolean; flat?: number } | undefined;
  return {
    label: t?.label ?? id, enc: Number(t?.enc ?? 0), prixCO: (p.gold ?? 0) + (p.silver ?? 0) / 20 + (p.brass ?? 0) / 240, desc: t?.desc,
    ...(d ? { degats: d.plusBF ? `BF+${d.flat ?? 0}` : String(d.flat ?? 0) } : {}),
    ...(t?.hands ? { mains: Number(t.hands) } : {}), ...(t?.reach ? { allonge: String(t.reach) } : {}), ...(t?.range ? { portee: Number(t.range) } : {}),
    qualites: libellesDeQualites((t?.qualities ?? []) as { id: string; value?: number }[]),
  };
}

/** Les libellés des qualités d'un objet (`qualities.json`), leur valeur comprise. */
export const libellesDeQualites = (qs: readonly { id: string; value?: number }[]): string[] =>
  qs.map((q) => {
    const nom = refLabel('qualities', { id: q.id });
    if (q.value == null) return nom;
    return nom.startsWith('%') ? `${q.value} ${nom}` : `${nom} (${q.value})`;
  });

/** Pourquoi le héros ne peut pas utiliser maintenant l'objet `uid` (`refusDeConsommer`), ou `null`. */
export function refusDUsage(c: Combatant, uid: string): string | null {
  const it = c.items?.find((i) => i.uid === uid);
  const flux = it && consommableDe(it, findTrappingById);
  return !it || !flux ? 'Rien à utiliser.' : refusDeConsommer(c, it, flux);
}

/** Encombrement porté et capacité sans pénalité (BF + BE). LDB 61 */
export const encombrement = (c: Combatant): { porte: number; capacite: number; mouvement: number; agilite: number; immobile: boolean } => {
  const p = encumbrancePenalties(c);
  return { porte: totalEncumbrance(c), capacite: maxEncumbrance(c), mouvement: p.movePenalty ?? 0, agilite: p.agilityPenalty, immobile: p.immobile };
};

// ─── Progression : ce que la carrière offre à son niveau ────────────────────────────────────────────────────

export interface OffreDeCarac { id: CharKey; label: string; valeur: number; augmentations: number; cout: number }
/** `carac` : l'abréviation de sa Caractéristique ; `valeur` : la valeur que son Test vise (`testValue`). */
export interface OffreDeCompetence { ref: { id: string; spec?: string }; label: string; augmentations: number; cout: number; carac: string; valeur: number }
/** `aSpecifier` : le Talent attend une spécialisation que la carrière laisse au choix (un domaine, un dieu). */
export interface OffreDeTalent { ref: { id: string; spec?: string }; label: string; possede: number; cout: number; aSpecifier?: boolean }
export interface Progression {
  niveau: number; titre: string; requis: number; complet: boolean; suivant: { niveau: number; titre: string; cout: number } | null;
  caracs: OffreDeCarac[]; competences: OffreDeCompetence[]; talents: OffreDeTalent[];
}

/** Les offres du niveau de carrière du héros : Caractéristiques et Compétences de carrière (cumul des niveaux
 *  atteints), Talents du niveau courant, et le niveau suivant. LDB 07 l.41-43, l.76, l.103, l.118-131 */
export function progression(c: Combatant): Progression {
  const carriere = c.career ?? '';
  const niveaux = levelsForCareer(carriere);
  const niveau = c.careerLevel ?? 1;
  const chars = availableChars(niveaux, niveau);
  const sSlots = skillSlots(niveaux, niveau);
  const tSlots = talentSlots(niveaux, niveau);
  const designations = designationsFor(c, carriere);
  const complet = isCareerLevelComplete(c, niveau, { skillSlots: sSlots, talentSlots: tSlots, careerChars: chars, designations });
  const refs = (slots: typeof sSlots) => slots.flatMap((sl) => {
    const designee = designations[sl.key];
    if (designee) { const r = parseRefKey(designee); return [{ id: r.id, ...(r.spec ? { spec: r.spec } : {}) }]; }
    return sl.options.filter((o) => o.optionId).map((o) => ({ id: o.optionId!, ...(o.spec ? { spec: o.spec } : {}), ...(sl.needsChoice && !o.spec ? { aSpecifier: true } : {}) }));
  });
  const prochain = niveaux.find((l) => l.level === niveau + 1);
  return {
    niveau, titre: niveaux.find((l) => l.level === niveau)?.label ?? carriere, requis: 5 * niveau, complet,
    suivant: prochain ? { niveau: prochain.level, titre: prochain.label, cout: careerChangeCost(complet) } : null,
    caracs: [...new Set(chars)].map((k) => ({ id: k, label: libelleDeCarac(k).label, valeur: effectiveChar(c, k), augmentations: c.charAdvances?.[k] ?? 0, cout: advanceCost(c.charAdvances?.[k] ?? 0, 'caracteristique', true) })),
    competences: refs(sSlots).filter((r) => !r.aSpecifier).map(({ aSpecifier: _a, ...ref }) => {
      const adv = c.skills.find((x) => x.id === ref.id && (x.spec ?? '') === (ref.spec ?? ''))?.advances ?? 0;
      const k = byId('skill', ref.id)?.characteristic as CharKey | undefined;
      return { ref, label: refLabel('skills', ref), augmentations: adv, cout: advanceCost(adv, 'competence', true), carac: k ? libelleDeCarac(k).abr : '', valeur: testValue(c, { skill: ref }) };
    }),
    talents: refs(tSlots).map(({ aSpecifier, ...ref }) => {
      const fois = c.talents.filter((t) => t.talentId === ref.id && (aSpecifier || (t.spec ?? '') === (ref.spec ?? ''))).reduce((n, t) => n + t.times, 0);
      return { ref, label: refLabel('talents', ref), possede: fois, cout: talentCost(fois), ...(aSpecifier ? { aSpecifier } : {}) };
    }),
  };
}
