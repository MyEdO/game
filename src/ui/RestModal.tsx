import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { CharFrame } from './CharFrame';
import { StateChips } from './StateChips';
import { Coins } from './Coins';
import { OptionChooser } from './OptionChooser';
import { lodgingOptions, foodOptions, restCost, type PendingRest, type RestLodging, type RestFood } from '../state/restFlow';
import { partyMoneyTotal } from '../state/bourseFlow';
import { weatherExposure, exposureTestCount, exposureShelterFromTent } from '../engine/exposure';
import { hasCondition } from '../engine/conditions';
import { toBrass } from '../engine/money';
import { ownsLocal } from './ownership';
import { ReadyRow } from './ReadyRow';
import { quorumAtteint } from '../state/netOwnership';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import type { Combatant } from '../engine/types';
import { GatedAction } from './GatedAction';
import { Row } from './Layout';

const LODGING_META: Record<RestLodging, { icon: IconIdInput; label: string }> = {
  privee: { icon: 'rest/bed', label: 'Privée' },
  commune: { icon: 'rest/couch', label: 'Commune' },
  maison: { icon: 'rest/home', label: 'Chez soi' },
  dehors: { icon: 'rest/camp', label: 'Dehors' },
  bord: { icon: 'travel/sail-ship', label: 'À bord' },
};
const FOOD_META: Record<RestFood, { icon: IconIdInput; label: string }> = {
  repas: { icon: 'rest/stew', label: 'Repas' },
  maison: { icon: 'rest/feast', label: 'Maison' },
  ration: { icon: 'item/misc', label: 'Ration' },
  rien: { icon: 'ui/forbidden', label: 'Rien' },
};

/** Avertissements de la ligne d'un héros (info de DÉCISION, pas de texte tuto). */
function heroWarnings(h: Combatant, lodging: RestLodging, food: RestFood, exposureTests: number): ReactNode[] {
  const out: ReactNode[] = [];
  if (hasCondition(h, 'hemorragique') || hasCondition(h, 'en-flammes') || hasCondition(h, 'empoisonne')) {
    out.push(<><Icon id="ui/warning" size="sm" /> à stabiliser (pas de repos réparateur)</>);
  }
  if (food === 'rien') out.push(<><Icon id="ui/warning" size="sm" /> ventre vide</>);
  if (lodging === 'dehors' && exposureTests > 0) out.push(<><Icon id="rest/cold" size="sm" /> Exposition ×{exposureTests}</>);
  return out;
}

/**
 * CORPS de la modale de repos — `embedded` (#333) bascule le rendu en zone embarquée (sans `Modal`,
 * patron `CascadeBody`/`RollShell embedded`) pour l'incrustation dans l'écran-hub de voyage. Défaut
 * `false` = modale flottante. Une seule phase, les RÉGLAGES de la nuit : par héros,
 * couchage + pitance (choix PERSONNELS et orthogonaux — manger à l'auberge et dormir dehors est
 * permis) ; coût RAW total calculé ; avertissements en ligne. Le bilan n'est pas ici : « Dormir
 * jusqu’à l’aube » (`restSleep`) vide `pendingRest` et ouvre la nuit en CASCADE (`openRestNight`,
 * `restFlow.ts`).
 */
export function RestBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingRest);
  const party = useGame((s) => s.party);
  const money = partyMoneyTotal(useGame.getState); // somme des bourses (le groupe est abonné via `party`)
  const scene = useGame((s) => s.scene);
  const net = useGame((s) => s.net);
  const restSet = useGame((s) => s.restSet);
  const restSleep = useGame((s) => s.restSleep);
  const restCancel = useGame((s) => s.restCancel);
  const restReady = useGame((s) => s.restReady);
  const state = useGame();
  // Héros PERSONNALISÉS (détachés du choix maître de troupe) — le reste SUIT la troupe. Arbitrage user
  // 2026-07-11 : « ≠ personnaliser » déplie les contrôles du héros seul, « ↺ » le rend au choix de troupe.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  if (!p) return null;

  // Titre FRANC (arbitrage user 2026-07-11) : la nature de la halte + le lieu (`scene.label`) quand il existe.
  const lieu = scene?.label ? <> — {scene.label}</> : null;
  const title = p.places.auberge ? <><Icon id="rest/bed" size="sm" /> Nuit à l’auberge{lieu}</> : p.places.maison ? <><Icon id="time/night" size="sm" /> Nuit chez soi{lieu}</> : p.places.bord ? <><Icon id="travel/sail-ship" size="sm" /> Nuit à bord{lieu}</> : <><Icon id="rest/camp" size="sm" /> À la belle étoile{lieu}</>;

  // ── Phase RÉGLAGES ──
  const cost = restCost(p, party);
  const severity = weatherExposure(scene?.weather);
  const sheltered = exposureShelterFromTent(party);
  const exposureTests = exposureTestCount(severity, sheltered);
  const online = net.mode !== 'local';
  const ready = p.readyBySeat ?? {};
  // Le QUORUM est celui du dispatcher (`siegesRequis`) : un siège nommé sans héros vivant ne bloque
  // pas la nuit, et la rangée ne l'affiche pas non plus (même source, `ReadyRow`).
  const allReady = !online || quorumAtteint({ party, net }, ready);
  const canPay = toBrass(cost) === 0 || toBrass(money) >= toBrass(cost);
  const reglagesTitle = <>{title}{p.days > 1 ? ` — ${p.days} nuits` : ''}{p.quality === 'pietre' ? ' (piètre)' : ''}</>;

  // Héros affichés (vivants, dotés d'un réglage) ; ÉDITABLES = ceux que le siège local contrôle.
  const heroes = party.filter((h) => !h.dead && p.perHero[h.id]);
  const editable = heroes.filter((h) => ownsLocal(state, h.id)); // solo : tous (#1262)
  // FOLLOWERS = éditables NON personnalisés : le choix maître « Pour toute la troupe » les pilote.
  const followers = editable.filter((h) => !expanded.has(h.id));
  const cfgOf = (h: Combatant) => p.perHero[h.id];
  // Valeur COMMUNE des followers (sinon aucune sélection maître) — Couchage / Nourriture.
  const commonLodging = followers.length && followers.every((h) => cfgOf(h).lodging === cfgOf(followers[0]).lodging) ? cfgOf(followers[0]).lodging : undefined;
  const commonFood = followers.length && followers.every((h) => cfgOf(h).food === cfgOf(followers[0]).food) ? cfgOf(followers[0]).food : undefined;
  // Menu de troupe : Couchage = l'offre du lieu (identique pour tous) ; Nourriture = les choix
  // COLLECTIFS (repas/maison/rien) — la Ration est PERSONNELLE (dépend du sac du héros), hors maître.
  const masterFood: RestFood[] = [...(p.places.auberge ? ['repas' as const] : []), ...(p.places.maison ? ['maison' as const] : []), 'rien'];
  const applyTroupe = (patch: Partial<{ lodging: RestLodging; food: RestFood }>) => { for (const h of followers) restSet(h.id, patch); };
  // Coût INDIVIDUEL d'un héros (réutilise le calcul canonique `restCost` sur un pending mono-héros).
  const heroCost = (h: Combatant) => restCost({ ...p, perHero: { [h.id]: cfgOf(h) } } as PendingRest, [h]);

  const reglagesBody = (
    <>
      {/* Panneau de nuit = la DÉCISION seule (vague « lisibilité du voyage » 2/2) : le BILAN du jour
          (km, péripéties, jets) est sorti d'ici — il vit dans la CHRONIQUE du hub, sélectionnable
          comme un jour passé (`VoyageScreen`/`voyageDayCards`), pas re-déroulé ici. */}
      {severity !== 'clement' && (
        <p className="rest-weather">{severity === 'extreme' ? <><Icon id="rest/storm" size="sm" /> Temps de chien</> : <><Icon id="rest/rain" size="sm" /> Mauvais temps</>}{sheltered ? ' — la tente abritera le camp' : ''}</p>
      )}
      {/* CHOIX MAÎTRE « Pour toute la troupe » (arbitrage user 2026-07-11) : Couchage + Pitance appliqués
          d'un coup à tous les héros non personnalisés. */}
      {editable.length > 1 && (
        <div className="rest-master">
          <div className="mini-title">Pour toute la troupe</div>
          <Row className="rest-master-choices">
            <OptionChooser
              layout="seg"
              groupLabel="Couchage"
              options={lodgingOptions(p.places).map((l) => ({ key: l, label: <><Icon id={LODGING_META[l].icon} size="sm" /> {LODGING_META[l].label}</>, selected: commonLodging === l, onSelect: () => applyTroupe({ lodging: l }) }))}
            />
            <OptionChooser
              layout="seg"
              groupLabel="Pitance"
              options={masterFood.map((f) => ({ key: f, label: <><Icon id={FOOD_META[f].icon} size="sm" /> {FOOD_META[f].label}</>, selected: commonFood === f, onSelect: () => applyTroupe({ food: f }) }))}
            />
          </Row>
        </div>
      )}
      <div className="rest-rows">
        {heroes.map((h) => {
          const cfg = cfgOf(h);
          const mine = ownsLocal(state, h.id);
          const isOpen = expanded.has(h.id);
          const warns = heroWarnings(h, cfg.lodging, cfg.food, exposureTests);
          const share = heroCost(h);
          return (
            <div key={h.id} className="rest-hero">
              <div className="rest-hero-line">
                <CharFrame c={h} variant="identity" size="sm" />
                <div className="rest-hero-id">
                  <span className="rest-hero-name">{h.label}</span>
                  <StateChips c={h} reserve />
                </div>
                {/* Choix COURANT en toutes lettres (arbitrage user : plus de segments cryptiques par défaut). */}
                <div className="rest-hero-pick">
                  <span className="rest-hero-choice"><Icon id={LODGING_META[cfg.lodging].icon} size="sm" /> {LODGING_META[cfg.lodging].label} · <Icon id={FOOD_META[cfg.food].icon} size="sm" /> {FOOD_META[cfg.food].label}</span>
                  {warns.length > 0 && (
                    <span className="rest-warn">{warns.map((w, i) => <span key={i}>{i > 0 && ' · '}{w}</span>)}</span>
                  )}
                </div>
                <span className="rest-hero-cost">{toBrass(share) > 0 ? <Coins money={share} /> : '—'}</span>
                {mine && (
                  isOpen
                    ? <button type="button" className="btn small btn-ghost rest-hero-toggle" onClick={() => { restSet(h.id, { lodging: commonLodging ?? cfg.lodging, food: commonFood ?? cfg.food }); setExpanded((s) => { const n = new Set(s); n.delete(h.id); return n; }); }} title="Revenir au choix de la troupe">↺ Troupe</button>
                    : <button type="button" className="btn small btn-ghost rest-hero-toggle" onClick={() => setExpanded((s) => new Set(s).add(h.id))} title="Régler ce héros à part">≠ Personnaliser</button>
                )}
              </div>
              {isOpen && mine && (
                <Row className="rest-hero-controls">
                  <OptionChooser
                    layout="seg"
                    groupLabel="Couchage"
                    options={lodgingOptions(p.places).map((l) => ({ key: l, label: <><Icon id={LODGING_META[l].icon} size="sm" /> {LODGING_META[l].label}</>, selected: cfg.lodging === l, onSelect: () => restSet(h.id, { lodging: l }) }))}
                  />
                  <OptionChooser
                    layout="seg"
                    groupLabel="Nourriture"
                    options={foodOptions(p.places, h).map((f) => ({ key: f, label: <><Icon id={FOOD_META[f].icon} size="sm" /> {FOOD_META[f].label}</>, selected: cfg.food === f, onSelect: () => restSet(h.id, { food: f }) }))}
                  />
                </Row>
              )}
            </div>
          );
        })}
      </div>
      <div className="rest-foot">
        {toBrass(cost) > 0 ? (
          <span className={`rest-cost ${canPay ? '' : 'over'}`}>Total <Coins money={cost} /> · Bourse <Coins money={money} /></span>
        ) : (
          <span className="rest-cost">Nuit gratuite</span>
        )}
      </div>
      {online && (
        <ReadyRow ready={ready} />
      )}
    </>
  );
  const reglagesFooter = (
    <>
        {!p.travelHalt && <button className="btn btn-ghost" onClick={() => restCancel()}>Annuler</button>}
        {online && !ready[net.mySeat] && (
          <button className="btn" onClick={() => restReady(net.mySeat)}><Icon id="action/attack" size="sm" /> Prêt</button>
        )}
        {(!online || net.mode === 'host') && (
          <GatedAction
            id="rest-sleep"
            label={<><Icon id="time/night" size="sm" /> Dormir jusqu’à l’aube</>}
            ariaLabel="Dormir jusqu’à l’aube"
            enabled={canPay && allReady}
            reason={!canPay ? 'Pas assez d’argent — choisissez des couchages plus modestes.' : 'Tous les sièges ne se sont pas déclarés prêts.'}
            onClick={() => restSleep()}
          />
        )}
    </>
  );
  if (embedded) {
    return <EmbeddedShell title={reglagesTitle} footer={reglagesFooter}>{reglagesBody}</EmbeddedShell>;
  }
  return (
    <Modal title={reglagesTitle} onClose={p.travelHalt ? undefined : () => restCancel()} footer={reglagesFooter}>
      {reglagesBody}
    </Modal>
  );
}

/** MODALE DE REPOS flottante — repos au camp en exploration (hors hub de voyage). */
export function RestModal() {
  return <RestBody />;
}
