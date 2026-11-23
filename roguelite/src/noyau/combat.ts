/**
 * Couture de l'hôte avec le noyau pour un combat : une arène générée, le groupe et la rencontre, joués de bout en bout
 * en cadence automatique par la partie du noyau (`ouvrirLeLancement`, `src/hote/partie.ts`). L'hôte ne résout aucune
 * règle : il reprend les jetons programmés, joue la fenêtre qui tient la main (`fenetreDuJeu`), et relève à chaque pas
 * le plateau et le journal pour le rejeu.
 */
import { ouvrirLeLancement } from '../../../src/hote/partie';
import { arena, setEncounters } from '../../../src/scenes/test-scenarios/_shared';
import { fenetreDuJeu } from '../../../src/noyau/combatAuto';
import { EVT, type ChargeDAttaque } from '../../../src/noyau/bus';
import { footprintN } from '../../../src/noyau/monde/footprint';
import { findCreatureById } from '../../../src/data';
import type { Combatant } from '../../../src/engine/types';
import type { Intention } from '../../../src/noyau/partie';
import { jouerLaFenetre } from './partie';
import { nomDeSort } from './carriere';

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

/** Plafond de pas : un combat qui ne se ferme pas s'arrête en impasse plutôt que de boucler. */
const PLAFOND_DE_PAS = 4000;

/** Joue le combat du `groupe` contre les créatures `ennemis` (ids du Bestiaire) à la graine `graine`.
 *  `lumiere` : id d'un `lightLevels` (`jour`, `crepuscule`…), posé sur la scène (`ambientLight`) ; sans lui, l'arène suit
 *  l'horloge et le premier jour tombe de nuit. */
/** Les pièces d'équipement qu'un héros a lâchées à terre pendant la rencontre (on lâche ce qu'on tient en tombant
 *  Inconscient) : le groupe vainqueur les ramasse, chacune revient dans la main où elle était. */
function ramasser(avant: readonly Combatant[], apres: Combatant[]): Combatant[] {
  const piece = (k?: string) => k === 'melee' || k === 'distance' || k === 'armor';
  return apres.map((c) => {
    const a = avant.find((x) => x.id === c.id);
    const perdues = (a?.items ?? []).filter((i) => piece(i.kind) && !(c.items ?? []).some((j) => j.uid === i.uid));
    if (!a || !perdues.length) return c;
    const revient = (uid?: string | null) => !!uid && perdues.some((i) => i.uid === uid);
    const loadouts = (c.loadouts ?? []).map((l) => {
      const la = (a.loadouts ?? []).find((x) => x.id === l.id);
      return la ? { ...l, main: l.main ?? (revient(la.main) ? la.main : l.main), secondaire: l.secondaire ?? (revient(la.secondaire) ? la.secondaire : l.secondaire) } : l;
    });
    return { ...c, items: [...(c.items ?? []), ...perdues], loadouts };
  });
}

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
      groupeFinal = fin === 'victoire' ? ramasser(groupe, clore()) : clore();
      break;
    }
    if (!jouerLaFenetre(partie, recevoir, releve)) break;
  }
  partie.fermer();
  return { issue, pas, groupe: groupeFinal, morts, largeur, hauteur };
}

/** Libellé du Bestiaire d'une créature. */
export const nomDeCreature = (id: string): string => findCreatureById(id)?.label ?? id;
