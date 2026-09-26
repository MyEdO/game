import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import { clone, makePriest, makeSorceress, makeFlagellant } from './_casters';
import type { TestScenario } from './_shared';
import type { Combatant, CharKey } from '../../engine/types';

/**
 * « Magie en combat » : LA grande bataille magique, qui réunit le concile (toutes les familles curées),
 * le duel de lanceurs (IA caster des DEUX camps + Contre-sort/dissipation) et le Jalon 2 (Péché/Colère,
 * Corruption, ZdE, Surincantation, mémorisation aux PX). On entre en EXPLORATION : mémoriser un sort dans
 * la fiche d'Aelindra (PX), traverser l'Influence corruptrice (exposition → mutation possible), puis
 * franchir la ligne pour engager le combat.
 */
const scene = buildScene({
  id: 'test-magie',
  label: 'Magie en combat',
  desc: 'Arène de test.',
  size: [30, 22],
  heroStart: [3, 11],
  startMessage:
    'Concile de prêtres (un par dieu à miracles de combat) + Haute Sorcière + flagellant + Tueur, face à une ' +
    'warband ET un trio de casters ennemis (Eusapia, Envoûteuse, Sorcière). EXPLORATION d’abord : fiche ' +
    'd’Aelindra → Avancement (mémoriser un sort aux PX) ; traversez la zone de Malepierre (Influence ' +
    'corruptrice → mutation possible, Aelindra est proche du seuil) ; PUIS franchissez la ligne à l’est pour ' +
    'engager. En combat : enchantez/bénissez/invoquez/drainez, Explosion au clic-case (ZdE), surincantez, ' +
    'Contre-sort & dissipation des deux camps ; le Prêtre a 3 Péchés (Colère possible même sur Prière réussie) ; ' +
    'l’Envoûteuse cause Peur 2 + Terreur 2 à l’ouverture (Test de Psychologie).',
  // Influence corruptrice (LDB 19) puis ligne d'engagement : deux bandes verticales que le groupe traverse
  // en avançant vers l'est (réfs ennemies par ID STABLE, `RefIrresoluble` sinon).
  triggers: [
    {
      id: 'trg-corruption',
      rect: { x: 10, y: 1, w: 1, h: 20 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: 'Une veine de malepierre suinte entre les dalles — l’air poisse (Influence corruptrice modérée).' },
        { type: 'corruptionExposure', level: 'moderee', skill: { id: 'resistance' } },
      ]),
    },
    {
      id: 'engager-le-combat',
      rect: { x: 16, y: 1, w: 1, h: 20 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: 'La warband vous a repérés — les casters ennemis lèvent déjà les mains. À l’assaut !' },
        { type: 'startCombat', encounter: 'enc-magie' },
      ]),
    },
  ],
  encounters: [
    {
      id: 'enc-magie',
      enemies: [
        // Meute de bêtes (rapides, chargent) — flanc haut.
        { ref: 'loup', pos: { x: 20, y: 7 } },
        { ref: 'loup', pos: { x: 21, y: 8 } },
        { ref: 'sanglier', pos: { x: 22, y: 6 } },
        // Mob peau-verte — centre groupé (cible de choix pour une ZdE bien posée).
        { ref: 'orc', pos: { x: 25, y: 11 } },
        { ref: 'orc', pos: { x: 26, y: 12 } },
        { ref: 'gobelin', pos: { x: 24, y: 13 } },
        { ref: 'gobelin', pos: { x: 25, y: 14 } },
        // Hors-la-loi + bestiaux — flanc bas.
        { ref: 'seigneur-brigand', pos: { x: 23, y: 16 } },
        { ref: 'brigand', pos: { x: 24, y: 17 } },
        { ref: 'ungor', pos: { x: 27, y: 9 } },
        // TRIO de casters ennemis au fond (l'IA adverse joue son arsenal + Contre-sort/dissipation).
        { ref: 'eusapia-balacanon', pos: { x: 28, y: 9 } },
        { ref: 'envouteuse', pos: { x: 28, y: 11 } },
        { ref: 'sorciere', pos: { x: 28, y: 13 } },
      ],
    },
  ],
});

/** Un dieu à miracles de combat → un Prêtre COMPLET (toutes Bénédictions + Miracles, talents de culte). */
const PRIESTS: { id: string; label: string; cult: string; chars: Partial<Record<CharKey, number>>; pos: { x: number; y: number } }[] = [
  { id: 'pr-sigmar', label: 'Frère Anselm, Grand Prêtre de Sigmar', cult: 'sigmar', chars: { sociabilite: 68, 'force-mentale': 60, force: 45, endurance: 45 }, pos: { x: 3, y: 4 } },
  { id: 'pr-ulric', label: "Wulfric, Prêtre d'Ulric", cult: 'ulric', chars: { sociabilite: 66, 'force-mentale': 58, force: 48, endurance: 48 }, pos: { x: 3, y: 8 } },
  { id: 'pr-myrmidia', label: 'Valentina, Prêtresse de Myrmidia', cult: 'myrmidia', chars: { sociabilite: 64, 'force-mentale': 58, force: 44, endurance: 44 }, pos: { x: 3, y: 12 } },
  { id: 'pr-shallya', label: 'Sœur Helga, Prêtresse de Shallya', cult: 'shallya', chars: { sociabilite: 66, 'force-mentale': 60, force: 38, endurance: 42 }, pos: { x: 2, y: 16 } },
  { id: 'pr-morr', label: 'Helmut, Prêtre de Morr', cult: 'morr', chars: { sociabilite: 62, 'force-mentale': 60, force: 42, endurance: 44 }, pos: { x: 2, y: 19 } },
  { id: 'pr-taal', label: 'Gunnar, Prêtre de Taal', cult: 'taal', chars: { sociabilite: 62, 'force-mentale': 56, force: 46, endurance: 46 }, pos: { x: 4, y: 6 } },
  { id: 'pr-verena', label: 'Adelheid, Prêtresse de Verena', cult: 'verena', chars: { sociabilite: 66, 'force-mentale': 60, force: 40, endurance: 42 }, pos: { x: 4, y: 10 } },
  { id: 'pr-manann', label: 'Bjorn, Prêtre de Manann', cult: 'manann', chars: { sociabilite: 62, 'force-mentale': 58, force: 46, endurance: 46 }, pos: { x: 4, y: 14 } },
  { id: 'pr-ranald', label: 'Lukas, Prêtre de Ranald', cult: 'ranald', chars: { sociabilite: 66, 'force-mentale': 56, force: 42, endurance: 42 }, pos: { x: 4, y: 18 } },
  { id: 'pr-rhya', label: 'Brunhilde, Prêtresse de Rhya', cult: 'rhya', chars: { sociabilite: 64, 'force-mentale': 58, force: 44, endurance: 46 }, pos: { x: 2, y: 6 } },
];

/**
 * Aelindra (Haute Sorcière multi-domaine + Nécromancie) + UN Prêtre COMPLET de chaque dieu à miracles de
 * combat + 1 flagellant + Grunni le Tueur. Tweaks Jalon 2 : Aelindra proche du seuil de Corruption et dotée
 * de PX (mémorisation) + d'Explosion (ZdE) ; le Grand Prêtre porte 3 Péchés (Colère des dieux).
 */
function makeMagicParty(): Combatant[] {
  const ans = pregenParty(PREGEN.pretre)[0]; // base prêtre (clonée par makePriest/makeFlagellant)

  const sorc = makeSorceress('sc-elfe', 'Aelindra, Haute Sorcière', { x: 2, y: 11 });
  if (!sorc.spells?.includes('explosion')) sorc.spells = ['explosion', ...(sorc.spells ?? [])]; // ZdE au clic-case
  sorc.xp = 300; // de quoi mémoriser un sort dans la fiche (Avancement)
  sorc.corruption = 5; // proche du seuil BFM+BE → l'Influence corruptrice peut faire MUTER

  const priests = PRIESTS.map((p) => {
    const pr = makePriest(ans, p.id, p.label, p.cult, p.chars);
    pr.pos = { ...p.pos };
    return pr;
  });
  priests[0].sinPoints = 3; // Grand Prêtre de Sigmar : ~30 % de Colère par Prière (dé des unités ≤ 3)
  // Varie l'apparence des prêtres (sinon clones visuels de la même base) — alterne sexe et carrure.
  priests.forEach((pr, i) => {
    if (!pr.appearance) return;
    pr.appearance.sex = i % 2 ? 'F' : 'M';
    pr.appearance.build = 0.5 + (i % 4) * 0.06;
  });

  const flagellant = makeFlagellant(ans, 'pr-flagellant', 'Konrad le Flagellant', 'ulric', { sociabilite: 60, 'force-mentale': 56, 'capacite-de-combat': 60, force: 52, endurance: 50 }, { x: 6, y: 10 });

  const grunni = clone(pregenParty(PREGEN.tueur)[0]);
  grunni.pos = { x: 6, y: 12 };

  return [sorc, ...priests, flagellant, grunni];
}

export const scenario: TestScenario = {
  id: 'magie',
  order: 3,
  category: 'magie',
  icon: 'scenario/magic',
  title: 'Magie en combat',
  tests:
    'Grande bataille magique : toutes les familles curées (invocations, drains, enchantements, zones, soins), ' +
    'IA caster des DEUX camps + Contre-sort & dissipation (trio ennemi Eusapia/Envoûteuse/Sorcière), ZdE au ' +
    'clic-case + Surincantation, Péché → Colère (Prêtre, 3 Péchés), Corruption (zone de Malepierre → mutation, ' +
    'Aelindra proche du seuil), mémorisation aux PX, Psychologie (Peur/Terreur de l’Envoûteuse).',
  partyNote: 'Aelindra (Haute Sorcière + Nécromancie) + 10 Prêtres (un par dieu de combat) + flagellant + Tueur',
  makeParty: makeMagicParty,
  scene,
  // pas d'autoCombat : exploration (mémorisation, exposition à la Corruption) PUIS combat via le trigger.
};
