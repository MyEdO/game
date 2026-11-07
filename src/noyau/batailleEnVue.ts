/**
 * LA BATAILLE DE MASSE EN VUE (#3328) — ce qu'un hôte montre de la bataille qui tient la main (ADE II 8) : le Round,
 * chaque armée et sa Puissance, la Menace qui pèse sur les Tests, puis chaque Scène de la situation du Round, son effet,
 * sa position quand elle se tient, les PJ libres qui s'y postent, et le verbe qui l'engage, fermé par son verdict
 * (`refusDeSceneDeBataille`) ; l'aléa du Round, ou les gestes qui le tirent ; le Test spectaculaire, ou entre deux
 * Rounds le Rassemblement et le Round suivant ; l'issue de la bataille terminée. Lecteur PUR, lu par les hôtes du noyau
 * (`hote/ecran.ts`).
 */
import type { Jeu } from './etat';
import type { GesteDuNoyau } from './actionsDuNoyau';
import {
  armyMight, armyStartMight, battleSceneById, battleSceneEffectLabel, herosLibres, massBattleThreatPenalty, refusDeRassemblement,
  refusDeSceneDeBataille, type MassBattleState,
} from './massBattleFlow';
import { BATTLE_HAZARDS, MIGHT_MAX } from '../engine/massBattle';
import { formatDice } from '../engine/dice';
import { massBattleHazardsDie } from '../data';
import { fenetreDuJeu } from './combatAuto';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Un geste de la bataille : son nom, le verbe qui le joue, pourquoi il ne se joue pas (`null` s'il se joue). */
export interface GesteDeBataille { libelle: string; geste: GesteDuNoyau; refus: string | null }

/** Une armée : son camp, son nom, sa Puissance sur `max`, sa Puissance de départ, et le bonus de ses Tests de
 *  Puissance ce Round (`0` : aucun). */
export interface ArmeeEnVue { camp: 'ally' | 'enemy'; nom: string; puissance: number; depart: number; max: number; bonus: number }

/** Un PJ libre qu'une Scène peut poster : son nom, s'il y est posté, et le verbe qui l'y poste ou l'en retire. */
export interface PosteEnVue { nom: string; poste: boolean; geste: GesteDuNoyau }

/** Une Scène de la situation : son nom, son effet chiffré et sa description, sa position quand elle se tient
 *  (`null` sinon), les PJ libres qui s'y postent (`null` : un combat engage tout le groupe, ou la Scène ne se joue plus
 *  ce Round), et son engagement. */
export interface SceneEnVue { id: string; libelle: string; effet: string; desc: string | null; resolue: boolean; position: string | null; postes: PosteEnVue[] | null; engager: GesteDeBataille }

/** La bataille ouverte : son Round (`null` une fois terminée), ses armées, son terrain, la pénalité de Menace
 *  (`0` : aucune), ses Scènes, son aléa (`null` : pas encore tiré) et les gestes qui le tirent, les gestes du Round,
 *  son issue (`null` tant qu'elle dure) et le camp qui l'emporte (`null` : aucun). */
export interface BatailleEnVue {
  round: string | null;
  armees: ArmeeEnVue[];
  terrain: string | null;
  menace: number;
  scenes: SceneEnVue[];
  alea: { libelle: string; texte: string } | null;
  tirerAlea: GesteDeBataille | null;
  choisirAlea: GesteDeBataille[];
  gestes: GesteDeBataille[];
  issue: { gagnant: 'ally' | 'enemy' | null; texte: string } | null;
}

/** La position d'une Scène qui se tient : son Point de rupture, ou sa déroute. ADE II 8 l.161 */
function positionDe(mb: MassBattleState, id: string, rupture: number): string {
  const etat = mb.sceneState[id];
  return etat?.broken ? t('mbf.positionPerdue') : t('mbf.pointDeRupture', { bp: etat?.breakpoint ?? 0, max: rupture });
}

/** Les Scènes de la situation du Round, chacune avec ses postes et son engagement. ADE II 8 l.114-118 */
function scenesDuRound(s: Jeu, mb: MassBattleState): SceneEnVue[] {
  const libres = herosLibres(mb, s.party);
  return mb.situation.map((id): SceneEnVue => {
    const sc = garanti(battleSceneById(id), id, 'Scène de bataille');
    const combat = sc.sceneKind === 'combat' || sc.sceneKind === 'threat';
    const postes = mb.assignment[id] ?? [];
    const resolue = mb.resolvedScenes.includes(id);
    return {
      id, libelle: sc.label, effet: battleSceneEffectLabel(sc), desc: sc.desc ?? null, resolue,
      position: sc.sceneKind === 'hold' && sc.hold ? positionDe(mb, id, sc.hold.breakpoint) : null,
      postes: combat || resolue || mb.awaitingNext ? null : libres.map((h) => {
        const poste = postes.includes(h.id);
        return { nom: h.label, poste, geste: { verbe: 'setMassBattleHero', args: [id, poste ? postes.filter((x) => x !== h.id) : [...postes, h.id]] } };
      }),
      engager: { libelle: t(combat ? 'mbf.engagerLeCombat' : 'mbf.resoudre'), geste: { verbe: 'massBattleScene', args: [id] }, refus: refusDeSceneDeBataille(s, id) },
    };
  });
}

/** La bataille de masse qui tient la main (`fenetreDuJeu`) ; `null` sinon. PUR. */
export function batailleEnVue(s: Jeu): BatailleEnVue | null {
  const mb = s.massBattle;
  if (!mb || fenetreDuJeu(s)?.cle !== 'batailleDeMasse') return null;
  const enRound = mb.phase === 'round';
  const armee = (camp: 'ally' | 'enemy', bonus: number): ArmeeEnVue => {
    const a = camp === 'ally' ? mb.ally : mb.enemy;
    return { camp, nom: a.label, puissance: armyMight(a), depart: armyStartMight(a), max: MIGHT_MAX, bonus };
  };
  const aleaOuvert = enRound && !mb.hazard && !mb.awaitingNext;
  return {
    round: mb.phase === 'over' ? null : t('mbf.round', { n: mb.round, total: mb.plannedRounds }),
    armees: [armee('ally', enRound ? mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0) : 0), armee('enemy', 0)],
    terrain: enRound ? mb.terrain ?? null : null,
    menace: enRound ? massBattleThreatPenalty(mb) : 0,
    scenes: enRound ? scenesDuRound(s, mb) : [],
    alea: mb.hazard ? { libelle: mb.hazard.label, texte: mb.hazard.text } : null,
    tirerAlea: aleaOuvert ? { libelle: t('mbf.tirerAlea', { die: formatDice(massBattleHazardsDie()) }), geste: { verbe: 'massBattleHazard', args: [] }, refus: null } : null,
    choisirAlea: aleaOuvert ? BATTLE_HAZARDS.map((h) => ({ libelle: h.label, geste: { verbe: 'massBattleHazard', args: [h.min] }, refus: null })) : [],
    gestes: !enRound ? [] : mb.awaitingNext
      ? [
          { libelle: t('mbf.rallyLabel'), geste: { verbe: 'massBattleRally', args: [] }, refus: refusDeRassemblement(s) },
          { libelle: t('mbf.roundSuivant'), geste: { verbe: 'massBattleAdvance', args: [] }, refus: null },
        ]
      : [{ libelle: t('mbf.testSpectaculaire'), geste: { verbe: 'massBattleClash', args: [] }, refus: null }],
    issue: mb.phase === 'over' ? issueDe(mb) : null,
  };
}

/** L'issue de la bataille terminée : le camp qui l'emporte, ou aucun vainqueur. ADE II 8 l.124 */
function issueDe(mb: MassBattleState): NonNullable<BatailleEnVue['issue']> {
  if (mb.outcome === 'ally' || mb.outcome === 'enemy') return { gagnant: mb.outcome, texte: t('mbf.issue', { armee: mb[mb.outcome].label }) };
  return { gagnant: null, texte: t('mbf.issueNulle') };
}
