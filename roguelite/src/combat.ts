/**
 * Couture de l'hôte roguelite avec le noyau : un combat généré (arène, groupe, rencontre) lancé par la partie du
 * noyau (`ouvrirLeLancement`, `src/hote/partie.ts`), joué de bout en bout en cadence automatique : la cadence `auto`
 * fait jouer aux héros leur tour par l'IA du noyau. L'hôte ne résout aucune règle : il reprend les jetons programmés, joue le drive de
 * la fenêtre qui tient la main (`fenetreDuJeu`), et relève à chaque pas le plateau et le journal pour le rejeu.
 */
import { ouvrirLeLancement } from '../../src/hote/partie';
import { arena, setEncounters } from '../../src/scenes/test-scenarios/_shared';
import { fenetreDuJeu } from '../../src/noyau/combatAuto';
import { createHero } from '../../src/engine/character';
import { fabriqueLocale } from '../../src/engine/fabriqueDId';
import { buyCharAdvance, inCareerChar, advanceCost } from '../../src/engine/advancement';
import { availableChars } from '../../src/engine/careerSlots';
import { effectiveChar, bonusDe } from '../../src/engine/characteristics';
import { rollTest } from '../../src/engine/tests';
import { testValue } from '../../src/engine/skills';
import { makeRNG } from '../../src/engine/dice';
import { findCreatureById, levelsForCareer, characteristics, conditionLabel } from '../../src/data';
import type { Combatant, CharKey } from '../../src/engine/types';
import type { Intention } from '../../src/noyau/partie';

export type { Combatant, CharKey };
export type { RNG } from '../../src/engine/dice';
export { makeRNG };
export { generateName } from '../../src/engine/names';


/** Un héros neuf de la carrière `carriere`, tiré par la création du moteur (`createHero`) à la graine `graine`. */
export function nouvelleRecrue(graine: number, carriere: string, espece: string, nom: string): Combatant {
  return createHero({ idNeuf: fabriqueLocale(`r${graine}`), speciesId: espece, careerId: carriere, label: nom, seed: graine });
}

/** Valeur courante d'une Caractéristique, Augmentations et effets compris. */
export const carac = (c: Combatant, k: CharKey): number => effectiveChar(c, k);

/** La Caractéristique `k` est-elle dans la carrière du héros (niveaux ≤ courant) ? Hors carrière, l'Augmentation coûte
 *  le double. LDB 07 l.43, l.91. */
export const dansLaCarriere = (c: Combatant, k: CharKey): boolean =>
  inCareerChar(availableChars(levelsForCareer(c.career ?? ''), c.careerLevel ?? 1), k);

/** Coût en PX de la prochaine Augmentation de `k`. */
export const coutDAugmentation = (c: Combatant, k: CharKey): number => advanceCost(c.charAdvances?.[k] ?? 0, 'caracteristique', dansLaCarriere(c, k));

/** Achat d'une Augmentation de Caractéristique aux PX (`buyCharAdvance`) : le message du moteur en cas de refus. */
export function augmenter(c: Combatant, k: CharKey): string | null {
  const r = buyCharAdvance(c, k, dansLaCarriere(c, k));
  return r.ok ? null : (r.reason ?? 'refusé');
}

export interface PionDuPlateau { id: string; label: string; camp: 'heros' | 'ennemi'; pv: number; max: number; x: number; y: number; hors: boolean }
export interface Pas { lignes: string[]; pions: PionDuPlateau[]; round: number }
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

/** Plafond de pas : un combat qui ne se ferme pas s'arrête en impasse plutôt que de boucler. */
const PLAFOND_DE_PAS = 4000;

/** Joue le combat du `groupe` contre les créatures `ennemis` (ids du Bestiaire) à la graine `graine`. */
/** `lumiere` : id d'un `lightLevels` (`jour`, `crepuscule`…), posé sur la scène (`ambientLight`) ; sans lui, l'arène suit
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
  const recevoir = (r: Parameters<typeof jetons.programmes>[0]) => file.push(...jetons.programmes(r).map((p) => p.id));
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
      id: c.id, label: c.label, camp: c.kind === 'heros' ? 'heros' : 'ennemi',
      pv: Math.max(0, c.wounds.current), max: c.wounds.max, x: c.pos!.x, y: c.pos!.y,
      hors: !!c.dead || c.conditions.some((e) => e.id === 'inconscient'),
    }));
    const precedent = pas[pas.length - 1];
    const memePlateau = precedent && JSON.stringify(precedent.pions) === JSON.stringify(pions);
    if (memePlateau && lignes.length === 0) return;
    if (memePlateau && precedent.lignes.length === 0) precedent.lignes.push(...lignes);
    else pas.push({ lignes, pions, round: b.round });
  };

  let issue: IssueDuCombat['issue'] = 'impasse';
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
      groupeFinal = (s.battle?.combatants ?? []).filter((c) => c.kind === 'heros').map((c) => structuredClone(c));
      break;
    }
    const f = fenetreDuJeu(s as never);
    if (!f) break;
    const suite = f.drive?.length ? f.drive : f.gestes.filter((g) => g.verbe === 'fenetreValider');
    if (!suite.length) break;
    for (const g of suite) {
      recevoir(partie.envoyer({ type: g.verbe, args: g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : [] } as unknown as Intention));
      releve();
    }
  }
  partie.fermer();
  const morts = groupeFinal.filter((c) => c.dead).map((c) => c.id);
  return { issue, pas, groupe: groupeFinal.map(remiseAuRepos), morts, largeur, hauteur };
}

/** Le héros sorti du combat : sa place, ses engagements et son Avantage ne survivent pas à la rencontre. */
function remiseAuRepos(c: Combatant): Combatant {
  const h: Combatant = { ...c, advantage: 0, engagedWith: [] };
  delete h.pos;
  return h;
}

/** Guérison naturelle après une nuit de sommeil : Test de Résistance Accessible (+20), DR + BE Points de
 *  Blessure sur succès. LDB 18 l.296. Rend les PB regagnés (0 sur échec). */
export function guerisonNaturelle(c: Combatant, graine: number): number {
  const r = rollTest(testValue(c, { skill: { id: 'resistance' } }), 'accessible', makeRNG(graine));
  if (!r.success) return 0;
  const gain = Math.max(0, Math.min(c.wounds.max - c.wounds.current, r.sl + bonusDe(c, 'endurance')));
  soigner(c, gain);
  return gain;
}

/** `pv` Points de Blessure regagnés ; un porteur revenu au-dessus de 0 PB se relève. LDB 16 (Inconscient). */
export function soigner(c: Combatant, pv: number): void {
  c.wounds = { ...c.wounds, current: Math.min(c.wounds.max, c.wounds.current + pv) };
  if (c.wounds.current > 0) c.conditions = c.conditions.filter((e) => e.id !== 'inconscient' && e.id !== 'a-terre');
}

/** Bonus d'Endurance. */
export const bonusDEndurance = (c: Combatant): number => bonusDe(c, 'endurance');

/** Hors de combat : à 0 PB ou Inconscient. */
export const horsDeCombat = (c: Combatant): boolean => !!c.dead || c.wounds.current <= 0 || c.conditions.some((e) => e.id === 'inconscient');

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
