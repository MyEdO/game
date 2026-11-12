/**
 * LES GESTES D'EXPLORATION DU GROUPE (#2898) : ce que le groupe peut jouer, chaque geste écrit en verbe du noyau et ses
 * arguments, pour un hôte qui les donne prêts à jouer. Les arêtes qu'il borde (`aretesUtilisables`, offertes comme à
 * l'écran : `aretesOffertes`), les sauts (`atterrissagesDeSaut`), les sorties de scène (déclencheurs à transition,
 * `triggersEnJeu`), les offres des entités à sa portée (`offresDExploration` : parler, commercer, s'asseoir, une action
 * authorée, un objet posé au sol à ramasser), refusées avec leur raison, la carte du monde quand le groupe est à l'un de ses lieux ou en voyage (`ouvrirLaCarte`), l'écran du lieu où il se tient
 * (`ouvrirLeLieu`), puis les dénivelés qu'il borderait ailleurs à son étage (`gesteDeDenivele`), le plus proche de chaque libellé, du
 * plus proche au plus lointain. Ce qui ne se joue pas depuis sa case se rejoint par le chemin du groupe (`exploreMovePlan`), joué par
 * le clic de sa case (`cliquerLaCase`), comme un saut.
 */
import { aretesUtilisables, casesADenivele } from './aretes';
import { aretesOffertes, GESTES_DEPLACANTS, gesteDeDenivele, gesteDeLArete, gestesDeplacantsOuverts } from './gesteDArete';
import { cheminMarchable, marcheOuverte } from './marcheDuGroupe';
import { triggersEnJeu } from './monde/decouvertePorteSecrete';
import { offresDExploration } from './interactionsDExploration';
import { cheminsDuGroupe, exploreMovePlan, optionsDeCheminDuGroupe } from './monde/exploreNav';
import { memeCase } from './monde/seating';
import { atterrissagesDeSaut, type CheminsDepuis, type Pt } from './monde/path';
import { computeStateVisible } from './visionState';
import { flowEffects } from '../engine/flowCore';
import { t } from '../i18n';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { GesteDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';

/** Un geste d'exploration : son libellé joueur, la suite de gestes du noyau qui le joue, et la raison qui le refuse. */
export interface GesteDExploration {
  libelle: string;
  gestes: GesteDuNoyau[];
  refus?: string;
}

/** La marche du groupe jusqu'à `vers` (`cliquerLaCase`) par ses `chemins` et son nombre de pas, `null` la marche
 *  fermée (`marcheOuverte`) ou sans chemin à pied qui y finisse. */
function marcheVers(s: Jeu, chemins: CheminsDepuis, vers: Pt): { gestes: GesteDuNoyau[]; pas: number } | null {
  const plan = marcheOuverte(s) && s.scene ? exploreMovePlan(s.scene, vers, chemins) : null;
  const fin = plan?.path[plan.path.length - 1];
  return plan && fin && plan.path.length > 1 && memeCase(fin, vers) && cheminMarchable(s.scene!, plan.path) ? { gestes: [{ verbe: 'cliquerLaCase', args: [vers] }], pas: plan.path.length - 1 } : null;
}

const estTransition = (e: Effect): e is Extract<Effect, { type: 'transition' }> => e.type === 'transition';

/** Les gestes d'exploration du groupe ; aucun hors exploration. */
export function gestesDExploration(s: Jeu): GesteDExploration[] {
  const { scene, partyPos } = s;
  if (!scene || s.mode !== 'exploration') return [];
  const visible = computeStateVisible(s);
  const chemins = cheminsDuGroupe(scene, partyPos, s.party);
  const out: GesteDExploration[] = [];
  const z = partyPos.z ?? 0;
  const duGroupe = aretesUtilisables({ scene, visible, controleur: partyPos, activeZ: z });
  for (const arete of aretesOffertes(duGroupe, gestesDeplacantsOuverts(s))) {
    const geste = gesteDeLArete(s, arete);
    if (!geste) continue;
    const marche = geste.verbe === 'cliquerLaCase' ? marcheVers(s, chemins, geste.args[0]) : { gestes: [geste] };
    if (marche) out.push({ libelle: arete.libelle, gestes: marche.gestes });
  }
  for (const a of marcheOuverte(s) ? atterrissagesDeSaut(scene, partyPos, optionsDeCheminDuGroupe(s.party)) : []) {
    out.push({ libelle: t('exploration.saut', { x: a.x, y: a.y }), gestes: [{ verbe: 'cliquerLaCase', args: [a] }] });
  }
  for (const trig of triggersEnJeu(scene, () => visible)) {
    if (s.flags[`__trigger_${trig.id}`]) continue;
    const sortie = flowEffects(trig.flow).find(estTransition);
    if (!sortie) continue;
    const marche = marcheVers(s, chemins, { x: trig.rect.x, y: trig.rect.y, z: trig.rect.z ?? 0 });
    if (marche) out.push({ libelle: t('exploration.sortie', { scene: sortie.scene.id }), gestes: marche.gestes });
  }
  for (const p of offresDExploration(s)) {
    for (const o of p.offres) {
      out.push({
        libelle: p.porteurLabel ? t('exploration.offre', { porteur: p.porteurLabel, action: o.label }) : o.label,
        gestes: [{ verbe: 'jouerAction', args: [p.porteurId, o.id] }],
        ...(o.gate.ok ? {} : { refus: o.gate.reason }),
      });
    }
  }
  if (s.worldMap && (s.lieu || s.travelPlan)) out.push({ libelle: t('exploration.carte'), gestes: [{ verbe: 'ouvrirLaCarte', args: [] }] });
  if (s.lieu && !s.travelPlan) out.push({ libelle: t('exploration.lieu'), gestes: [{ verbe: 'ouvrirLeLieu', args: [] }] });
  if (!gestesDeplacantsOuverts(s)) return out;
  const bordees = new Set(duGroupe.map((a) => a.cle));
  const ailleurs: (GesteDExploration & { pas: number; arete: string })[] = [];
  for (const { x, y } of casesADenivele(scene, z)) {
    if (x === partyPos.x && y === partyPos.y) continue;
    for (const arete of aretesUtilisables({ scene, visible, controleur: { x, y, z }, activeZ: z }, GESTES_DEPLACANTS)) {
      const geste = gesteDeDenivele(arete);
      if (!geste || bordees.has(arete.cle)) continue;
      bordees.add(arete.cle);
      const marche = marcheVers(s, chemins, arete.ancrage);
      if (marche) ailleurs.push({ libelle: t('exploration.ailleurs', { geste: arete.libelle, x, y }), gestes: [...marche.gestes, geste], pas: marche.pas, arete: arete.libelle });
    }
  }
  const plusProches = new Map<string, GesteDExploration>();
  for (const { libelle, gestes, arete } of ailleurs.sort((a, b) => a.pas - b.pas)) if (!plusProches.has(arete)) plusProches.set(arete, { libelle, gestes });
  return [...out, ...plusProches.values()];
}
