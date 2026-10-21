/**
 * LES GESTES D'EXPLORATION DU GROUPE (#2898) : ce que le groupe peut jouer, chaque geste écrit en verbe du noyau et ses
 * arguments, pour un hôte qui les donne prêts à jouer. Les arêtes qu'il borde (`aretesUtilisables`, offertes comme à
 * l'écran : `aretesOffertes`), les sauts (`atterrissagesDeSaut`), les sorties de scène (déclencheurs à transition,
 * `triggersEnJeu`), puis les dénivelés qu'il borderait ailleurs à son étage (`gesteDeDenivele`), le plus proche de chaque libellé, du
 * plus proche au plus lointain. Ce qui ne se joue pas depuis sa case se rejoint par le chemin du groupe (`exploreMovePlan`), joué par
 * `marcherVers`.
 */
import { aretesUtilisables } from './aretes';
import { aretesOffertes, gesteDeDenivele, gesteDeLArete, gestesDeplacantsOuverts } from './gesteDArete';
import { cheminMarchable, porteActionnable } from './marcheDuGroupe';
import { triggersEnJeu } from './monde/decouvertePorteSecrete';
import { exploreMovePlan, optionsDeCheminDuGroupe } from './monde/exploreNav';
import { memeCase } from './monde/seating';
import { atterrissagesDeSaut, type Pt } from './monde/path';
import { computeStateVisible } from './visionState';
import { flowEffects } from '../engine/flowCore';
import { t } from '../i18n';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';

/** Un geste d'exploration : son libellé joueur et la suite de gestes du noyau qui le joue. */
export interface GesteDExploration {
  libelle: string;
  gestes: GesteDuNoyau[];
}

/** La marche du groupe jusqu'à `vers` (`marcherVers`) et son nombre de pas, `null` sans chemin à pied qui y finisse. */
function marcheVers(s: Jeu, vers: Pt): { gestes: GesteDuNoyau[]; pas: number } | null {
  const plan = s.scene && exploreMovePlan(s.scene, s.partyPos, vers, optionsDeCheminDuGroupe(s.party));
  const fin = plan?.path[plan.path.length - 1];
  return plan && fin && plan.path.length > 1 && memeCase(fin, vers) && cheminMarchable(s.scene!, plan.path) ? { gestes: [{ verbe: 'marcherVers', args: [vers] }], pas: plan.path.length - 1 } : null;
}

const estTransition = (e: Effect): e is Extract<Effect, { type: 'transition' }> => e.type === 'transition';

/** Les gestes d'exploration du groupe ; aucun hors exploration. */
export function gestesDExploration(s: Jeu): GesteDExploration[] {
  const { scene, partyPos } = s;
  if (!scene || s.mode !== 'exploration') return [];
  const visible = computeStateVisible(s);
  const out: GesteDExploration[] = [];
  for (const arete of aretesOffertes(aretesUtilisables({ scene, visible, controleur: partyPos, activeZ: partyPos.z ?? 0 }), gestesDeplacantsOuverts(s))) {
    const geste = gesteDeLArete(arete);
    if (!geste) continue;
    if (arete.portail && !porteActionnable(s.mode, arete.portail)) {
      const marche = marcheVers(s, arete.portail.to);
      if (marche) out.push({ libelle: arete.libelle, gestes: marche.gestes });
    } else out.push({ libelle: arete.libelle, gestes: [geste] });
  }
  for (const a of atterrissagesDeSaut(scene, partyPos, optionsDeCheminDuGroupe(s.party))) {
    out.push({ libelle: t('exploration.saut', { x: a.x, y: a.y }), gestes: [{ verbe: 'sauter', args: [[partyPos, a], 1] }] });
  }
  for (const trig of triggersEnJeu(scene, () => visible)) {
    if (s.flags[`__trigger_${trig.id}`]) continue;
    const sortie = flowEffects(trig.flow).find(estTransition);
    if (!sortie) continue;
    const marche = marcheVers(s, { x: trig.rect.x, y: trig.rect.y, z: trig.rect.z ?? 0 });
    if (marche) out.push({ libelle: t('exploration.sortie', { scene: sortie.scene }), gestes: marche.gestes });
  }
  if (!gestesDeplacantsOuverts(s)) return out;
  const z = partyPos.z ?? 0;
  const bordees = new Set(aretesUtilisables({ scene, visible, controleur: partyPos, activeZ: z }).map((a) => a.cle));
  const ailleurs: (GesteDExploration & { pas: number; arete: string })[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (x === partyPos.x && y === partyPos.y) continue;
      for (const arete of aretesUtilisables({ scene, visible, controleur: { x, y, z }, activeZ: z })) {
        const geste = gesteDeDenivele(arete);
        if (!geste || bordees.has(arete.cle) || arete.ancrage.x !== x || arete.ancrage.y !== y) continue;
        bordees.add(arete.cle);
        const marche = marcheVers(s, arete.ancrage);
        if (marche) ailleurs.push({ libelle: t('exploration.ailleurs', { geste: arete.libelle, x, y }), gestes: [...marche.gestes, geste], pas: marche.pas, arete: arete.libelle });
      }
    }
  }
  const plusProches = new Map<string, GesteDExploration>();
  for (const { libelle, gestes, arete } of ailleurs.sort((a, b) => a.pas - b.pas)) if (!plusProches.has(arete)) plusProches.set(arete, { libelle, gestes });
  return [...out, ...plusProches.values()];
}
