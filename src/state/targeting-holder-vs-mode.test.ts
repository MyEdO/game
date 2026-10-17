/**
 * #1016 — CONFRONTATION `targetingHolder` ⇄ mode réellement rendu (`currentTargetingMode`).
 *
 * Le verdict de détention sert DEUX bouts qui ne peuvent pas diverger : l'aiguilleur (quel mode
 * commite le clic) et la possession réseau (quel siège a le droit de cliquer). S'ils divergeaient,
 * un siège se verrait accorder un clic que l'autre mode commiterait — la classe de bug de #1013.
 *
 * PORTÉE EXACTE (mesurée) : la garde confronte les CAS ÉNUMÉRÉS de la table `CAS` ci-dessous, plus la
 * couverture DÉRIVÉE de `TARGETING_HOLDERS` (tout détenteur déclaré a au moins un cas, et une entrée
 * au registre `HORS_MODAL`). L'axe des MODES, lui, reste MANUSCRIT : `targetingModes` n'expose aucun
 * catalogue complet de ses modes (seul `TILE_MODES` l'est) — un mode absent de la table PASSE ici
 * sans être vu. Un 4ᵉ détenteur, en revanche, ne passe pas : il doit entrer dans `TARGETING_HOLDERS`,
 * donc dans la table.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { initialFields } from './stateFields';
import { targetingHolder, TARGETING_HOLDERS } from './targetingHolder';
import { currentTargetingMode } from './targetingModes';
import { placingZoneOf } from './combatFlow';
import { horsModalByPending } from './modalArbiter';

const g = useGame.getState;

/** Cas d'état → (détenteur attendu, mode attendu). `null` = aucun détenteur (clic universel). */
const CAS: { nom: string; etat: Record<string, unknown>; holder: string | null; mode: string }[] = [
  { nom: 'balayage en cours', etat: { pendingCleave: { attackerId: 'a', hitIds: [], count: 0 } }, holder: 'pendingCleave', mode: 'cleave' },
  { nom: 'balayage dont la frappe est ouverte (pendingAttack)', etat: { pendingCleave: { attackerId: 'a', hitIds: [], count: 0 }, pendingAttack: { attackerId: 'a', targetId: 'b', location: null, result: null } }, holder: null, mode: 'attack' },
  { nom: '2ᵉ frappe en attente de cible', etat: { pendingDualStrike: { attackerId: 'a', offWeaponUid: 'o', jet: 43 } }, holder: 'pendingDualStrike', mode: 'dual' },
  { nom: 'pilonnage indirect (placeur de case)', etat: { pendingSiegeAim: { gunnerId: 'a', weaponUid: 'w', radius: 1, rangeTiles: null } }, holder: 'pendingSiegeAim', mode: 'placing-zone' },
  { nom: 'Surincantation « +Cible » (fenêtre du registre des MODALES)', etat: { pendingCast: { casterId: 'a', spellId: 's', pickingTargets: true } }, holder: null, mode: 'overcast' },
  { nom: 'aucun ciblage particulier', etat: {}, holder: null, mode: 'attack' },
  // Pose de zone d'un SORT : `targetingHolder` y rend `undefined` par un prédicat JUMEAU de celui de
  // `combatFlow.placingZoneOf` (source 'cast') — les deux bouts sont confrontés sur cet état réel ici
  // et au cas « le lanceur garde son clic » ci-dessous.
  { nom: 'pose de zone d’un SORT (fenêtre du registre des MODALES)', etat: { pendingCast: { casterId: 'a', spellId: 's', zone: { placing: true, radius: 1 } } }, holder: null, mode: 'placing-zone' },
];

describe('#1016 — le détenteur du ciblage et le mode rendu ne peuvent pas répondre différemment', () => {
  beforeEach(() => useGame.setState({ ...initialFields(), battle: null }));

  for (const c of CAS) {
    it(`${c.nom} → détenteur ${c.holder ?? 'aucun'}, mode ${c.mode}`, () => {
      useGame.setState(c.etat as never);
      expect(targetingHolder(g())).toBe(c.holder ?? undefined);
      expect(currentTargetingMode(g).id).toBe(c.mode);
    });
  }

  it('le détenteur `pendingSiegeAim` tombe bien dans le placeur de SIÈGE (pas dans une zone de sort)', () => {
    useGame.setState({ pendingSiegeAim: { gunnerId: 'a', weaponUid: 'w', radius: 1, rangeTiles: null } } as never);
    expect(placingZoneOf(g())?.source).toBe('siege');
  });

  it('tout détenteur possible est une fenêtre DÉCLARÉE au registre HORS_MODAL (owner coop connu)', () => {
    const registre = horsModalByPending();
    for (const k of TARGETING_HOLDERS) {
      expect(registre[k], `${k} : détient le ciblage sans entrée HORS_MODAL`).toBeTruthy();
    }
  });

  it('couverture DÉRIVÉE : chaque `TARGETING_HOLDERS` a au moins un cas dans la table', () => {
    const couverts = new Set(CAS.map((c) => c.holder).filter(Boolean));
    const nus = TARGETING_HOLDERS.filter((k) => !couverts.has(k));
    expect(nus, 'détenteur déclaré jamais confronté au mode rendu — ajouter son cas').toEqual([]);
  });

  /** R4 (sonde du juge, promue) : le prédicat DUPLIQUÉ se juge là où les deux sources pourraient
   *  diverger — une zone de sort en pose PENDANT qu'un pilonnage est armé. Si `targetingHolder`
   *  oubliait la branche 'cast', il désignerait l'ARTILLEUR alors que le mode pose la zone du LANCEUR :
   *  le clic du lanceur serait volé. */
  it('zone de SORT en pose ET pilonnage armé : le lanceur garde son clic, l’artilleur ne détient rien', () => {
    useGame.setState({ pendingCast: { casterId: 'a', spellId: 's', zone: { placing: true, radius: 1 } },
                       pendingSiegeAim: { gunnerId: 'b', weaponUid: 'w', radius: 2, rangeTiles: null } } as never);
    expect(placingZoneOf(g())?.source, 'l’aiguilleur pose la zone du SORT').toBe('cast');
    expect(targetingHolder(g()), 'divergence : le détenteur désignerait l’artilleur').toBeUndefined();
    expect(currentTargetingMode(g).id).toBe('placing-zone');
  });
});
