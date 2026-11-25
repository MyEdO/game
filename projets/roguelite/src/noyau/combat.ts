/**
 * Couture de l'hôte avec le noyau pour un combat : une arène générée, le groupe et la rencontre, joués de bout en bout
 * en cadence automatique par la couture de la rencontre (`jouerLaRencontre`, `src/hote/rencontre.ts`) sur la partie
 * écoutée du roguelite (`ouvrirEcoutee`, `./partie.ts`). L'hôte ne résout aucune règle : il relève à chaque résultat
 * le plateau et le journal pour le rejeu.
 */
import { arena, setEncounters } from '../../../../src/scenes/test-scenarios/_shared';
import { jouerLaRencontre, type LotAuSol } from '../../../../src/hote/rencontre';
import { EVT, type ChargeDAttaque } from '../../../../src/noyau/bus';
import { footprintN } from '../../../../src/noyau/monde/footprint';
import { ligneDuCoup } from '../../../../src/engine/combat';
import { findCreatureById } from '../../../../src/data';
import type { Combatant } from '../../../../src/engine/types';
import { ouvrirEcoutee } from './partie';
import { nomDeSort } from './carriere';

/** `cases` : le côté de l'empreinte du corps, en cases (`footprintN` : 2 pour un Grand). */
export interface PionDuPlateau { id: string; label: string; camp: 'heros' | 'ennemi'; creature?: string; arme?: string; pv: number; max: number; x: number; y: number; cases: number; hors: boolean }
/** Un coup tel que le noyau l'annonce au rendu (`EVT.ANIM_ATTACK`, `ChargeDAttaque`). `ligne` : la ligne que le noyau
 *  journalise pour un coup d'arme (`ligneDuCoup`), qui dit, elle, ce qui a porté le coup sur sa cible (tir dévié…). */
export interface Coup { de: string; vers: string; genre: 'melee' | 'distance' | 'creature' | 'spell'; touche: boolean; blessures: number; critique: boolean; defense: 'parade' | 'esquive' | 'aucune'; sort?: string; ligne?: string }
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
  /** Le Destin que chaque héros a perdu pendant la rencontre (`RencontreClose.destinDepense`), vide en impasse. */
  destinDepense: Record<string, number>;
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
  return { ...base, touche: a.result.hit, blessures: a.result.woundsLost ?? 0, critique: !!a.result.critical, ligne: ligneDuCoup(a.result) };
}

/** Ce que le rejeu annonce d'un coup d'arme porté sur une figure de son propre camp (`allie`), `null` pour tout autre
 *  coup : le fait (`flash`, s'il touche), et pour ruban la ligne que le noyau journalise de ce coup, seule à en dire la
 *  cause (tir dévié…) ; le noyau ne type pas cette cause (#4830). */
export function annonceDuCoupSurUnAllie(c: Coup, allie: boolean): { flash: string | null; ruban: string } | null {
  if (!allie || c.genre === 'spell' || c.de === c.vers || !c.ligne) return null;
  return { flash: c.touche ? 'Touche un allié !' : null, ruban: c.ligne };
}

/** Les lots que les héros ont laissés au sol pendant la rencontre (`LotAuSol` : on lâche ce qu'on tient en tombant
 *  Inconscient, l'arme de jet lancée) : le groupe vainqueur les ramasse, chaque pièce revient dans la main où elle était
 *  avant la rencontre (`avant`). */
function ramasser(avant: readonly Combatant[], apres: Combatant[], auSol: readonly LotAuSol[]): Combatant[] {
  return apres.map((c) => {
    const a = avant.find((x) => x.id === c.id);
    const perdues = auSol.filter((l) => l.porteur === c.id).flatMap((l) => l.objets);
    if (!a || !perdues.length) return c;
    const revient = (uid?: string | null) => !!uid && perdues.some((i) => i.uid === uid);
    const loadouts = (c.loadouts ?? []).map((l) => {
      const la = (a.loadouts ?? []).find((x) => x.id === l.id);
      return la ? { ...l, main: l.main ?? (revient(la.main) ? la.main : l.main), secondaire: l.secondaire ?? (revient(la.secondaire) ? la.secondaire : l.secondaire) } : l;
    });
    return { ...c, items: [...(c.items ?? []), ...perdues], loadouts };
  });
}

/** Les cases entre la ligne des ennemis et la tête du groupe. */
const ECART = 10;

/** Joue le combat du `groupe` contre les créatures `ennemis` (ids du Bestiaire) à la graine `graine`. Le noyau pose le
 *  groupe dans son ordre en file depuis son départ (`formationDeCombat`) : l'arène tourne cette file vers la ligne des
 *  ennemis, le premier du groupe en tête.
 *  `lumiere` : id d'un `lightLevels` (`jour`, `crepuscule`…), posé sur la scène (`ambientLight`) ; sans lui, l'arène suit
 *  l'horloge et le premier jour tombe de nuit. Une impasse rend le groupe tel qu'il est parti. */
export function jouerLeCombat(groupe: readonly Combatant[], ennemis: readonly string[], graine: number, lumiere = 'jour'): IssueDuCombat {
  const largeur = Math.max(6, Math.max(groupe.length, ennemis.length) * 2);
  const hauteur = ECART + groupe.length + 2;
  let coups: Coup[] = [];
  let etats: EtatGagne[] = [];
  const pas: Pas[] = [];
  let vus = 0;
  const o = ouvrirEcoutee(
    graine,
    () => {
      const scene = arena({ id: 'arene', label: 'Rencontre', w: largeur, h: hauteur, heroStart: { x: Math.floor(largeur / 2) + 1, y: ECART + 1 } });
      scene.ambientLight = lumiere;
      setEncounters(scene, [{
        id: 'rencontre',
        enemies: ennemis.map((id, i) => ({ creature: { id }, pos: { x: 1 + Math.round((i + 0.5) * (largeur - 2) / ennemis.length - 0.5), y: 1 }, facing: 'S' as const })),
      }]);
      return { party: groupe.map((h) => structuredClone(h)), scene, projet: null, combatDirect: 'rencontre' };
    },
    (r) => {
      for (const e of r.evenements) {
        if (e.type === 'etatGagne') etats.push({ porteur: e.porteur, etat: e.etat });
        if (e.type !== 'emis' || e.evt !== EVT.ANIM_ATTACK) continue;
        coups.push(coupDe(e.payload as ChargeDAttaque));
      }
      releve();
    },
  );

  /** Relève le pas que le dernier résultat laisse : ses lignes de journal, le plateau, ses coups et ses États. */
  function releve() {
    const b = o.partie.etat().battle;
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
  }

  try {
    const r = jouerLaRencontre(o, o.lancement);
    if (r.issue === 'impasse') return { issue: 'impasse', pas, groupe: groupe.map((h) => structuredClone(h)), morts: [], destinDepense: {}, largeur, hauteur };
    const rendu = r.issue === 'victoire' ? ramasser(groupe, r.groupe, r.auSol) : r.groupe;
    return { issue: r.issue, pas, groupe: rendu, morts: rendu.filter((c) => c.dead).map((c) => c.id), destinDepense: r.destinDepense, largeur, hauteur };
  } finally {
    o.partie.fermer();
  }
}

/** Libellé du Bestiaire d'une créature. */
export const nomDeCreature = (id: string): string => findCreatureById(id)?.label ?? id;
