import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { EmbeddedShell } from './RollShell';
import { CharFrame } from './CharFrame';
import { StateChips } from './StateChips';
import { Coins } from './Coins';
import { OptionChooser } from './OptionChooser';
import {
  lodgingOptions,
  foodOptions,
  nourrituresDeTroupe,
  restCost,
  partsDuRepos,
  noteDAubergeCouverte,
  type RestLodging,
  type RestFood,
} from '../noyau/restFlow';
import { refusDeLaValidationNommee } from '../noyau/validationDeFenetre';
import { partyMoneyTotal } from '../noyau/bourseFlow';
import { exposureTestCount, exposureShelterFromTent } from '../engine/exposure';
import { activeExposureSeverity, nuitDispenseeParPleinAir } from '../noyau/combatFlow';
import { t, type MsgKey } from '../i18n';
import { refusDeRecuperation } from '../engine/rest';
import { toBrass } from '../engine/money';
import { ReadyRow } from './ReadyRow';
import { ownsLocal } from '../noyau/netOwnership';
import { Icon } from './Icon';
import type { IconId } from '../data/icons';
import type { Combatant } from '../engine/types';
import { GatedAction, raisonSi } from './GatedAction';
import { Row } from './Layout';

const LODGING_META: Record<RestLodging, { icon: IconId; labelKey: MsgKey }> = {
  privee: { icon: 'repos/lit', labelKey: 'valeur.couchage.privee' },
  commune: { icon: 'repos/canape', labelKey: 'valeur.couchage.commune' },
  maison: { icon: 'repos/chez-soi', labelKey: 'valeur.couchage.maison' },
  dehors: { icon: 'repos/campement', labelKey: 'valeur.couchage.dehors' },
  bord: { icon: 'voyage/navire-a-voile', labelKey: 'valeur.couchage.bord' },
};
const FOOD_META: Record<RestFood, { icon: IconId; labelKey: MsgKey }> = {
  repas: { icon: 'repos/ragout', labelKey: 'valeur.pitance.repas' },
  maison: { icon: 'repos/repas-fait-maison', labelKey: 'valeur.pitance.maison' },
  ration: { icon: 'objet/divers', labelKey: 'valeur.pitance.ration' },
  rien: { icon: 'interface/interdit', labelKey: 'valeur.pitance.rien' },
};

/** Avertissements de la ligne d'un héros (info de DÉCISION, pas de texte tuto). */
function heroWarnings(h: Combatant, lodging: RestLodging, food: RestFood, exposureTests: number): ReactNode[] {
  const out: ReactNode[] = [];
  const sansRecuperation = refusDeRecuperation(h);
  if (sansRecuperation) out.push(<><Icon id="interface/attention" size="sm" /> {sansRecuperation}</>);
  if (food === 'rien') out.push(<><Icon id="interface/attention" size="sm" /> ventre vide</>);
  if (lodging === 'dehors' && exposureTests > 0) out.push(<><Icon id="repos/froid" size="sm" /> Exposition ×{exposureTests}</>);
  return out;
}

/**
 * CORPS de la modale de repos — `embedded` (#333) bascule le rendu en zone embarquée (sans `Modal`,
 * patron `CascadeBody`/`RollShell embedded`) pour l'incrustation dans l'écran-hub de voyage. Défaut
 * `false` = modale flottante. Une seule phase, les RÉGLAGES de la nuit : par héros,
 * couchage + pitance (choix PERSONNELS et orthogonaux — manger à l'auberge et dormir dehors est
 * permis) ; coût RAW total calculé ; avertissements en ligne. Le bilan n'est pas ici : « Dormir
 * jusqu’à l’aube » (`fenetreValider('repos')`, au quorum) vide `pendingRest` et ouvre la nuit en CASCADE (`openRestNight`,
 * `restFlow.ts`).
 */
export function RestBody({ embedded = false }: { embedded?: boolean } = {}) {
  const p = useGame((s) => s.pendingRest);
  const party = useGame((s) => s.party);
  const money = partyMoneyTotal(useGame.getState); // somme des bourses (le groupe est abonné via `party`)
  const net = useGame((s) => s.net);
  const choisir = useGame((s) => s.fenetreChoisir);
  const regler = (heroId: string, patch: Partial<{ lodging: RestLodging; food: RestFood }>) => {
    if (patch.lodging) choisir('repos', 'couchage', patch.lodging, heroId);
    if (patch.food) choisir('repos', 'pitance', patch.food, heroId);
  };
  const valider = useGame((s) => s.fenetreValider);
  const fermer = useGame((s) => s.fenetreFermer);
  const renoncer = () => fermer('repos');
  const severity = useGame((s) => activeExposureSeverity(() => s));
  const pleinAir = useGame((s) => nuitDispenseeParPleinAir(() => s));
  const state = useGame();
  const refusDormir = useGame((s) => refusDeLaValidationNommee(s, 'repos'));
  const couverte = useGame(noteDAubergeCouverte);
  // Héros PERSONNALISÉS (détachés du choix maître de troupe) — le reste SUIT la troupe. Arbitrage user
  // 2026-07-11 : « ≠ personnaliser » déplie les contrôles du héros seul, « ↺ » le rend au choix de troupe.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  if (!p) return null;

  // Titre FRANC (arbitrage user 2026-07-11) : la nature de la halte + le lieu nommé par l'appelant d'`ouvrirLeRepos`.
  const lieu = <> — {p.lieu}</>;
  const title = p.places.auberge ? <><Icon id="repos/lit" size="sm" /> {t('rf.nightInn')}{lieu}</> : p.places.maison ? <><Icon id="temps/nuit" size="sm" /> {t('rf.nightHome')}{lieu}</> : p.places.bord ? <><Icon id="voyage/navire-a-voile" size="sm" /> {t('rf.nightAboard')}{lieu}</> : <><Icon id="repos/campement" size="sm" /> {t('rf.nightStars')}{lieu}</>;

  // ── Phase RÉGLAGES ──
  const cost = restCost(p, party);
  const sheltered = exposureShelterFromTent(party);
  const exposureTests = exposureTestCount(severity, sheltered);
  const online = net.mode !== 'local';
  const ready = p.readyBySeat ?? {};
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
  // Menu de troupe : Couchage = l'offre du lieu (identique pour tous) ; Nourriture = `nourrituresDeTroupe`.
  const masterFood = nourrituresDeTroupe(p.places);
  const applyTroupe = (patch: Partial<{ lodging: RestLodging; food: RestFood }>) => { for (const h of followers) regler(h.id, patch); };
  // Part de chaque héros dans la note (`partsDuRepos`, dont `restCost` est la somme).
  const parts = partsDuRepos(p, party);

  const reglagesBody = (
    <>
      {/* Panneau de nuit = la DÉCISION seule (vague « lisibilité du voyage » 2/2) : le BILAN du jour
          (km, péripéties, jets) est sorti d'ici — il vit dans la CHRONIQUE du hub, sélectionnable
          comme un jour passé (`VoyageScreen`/`voyageDayCards`), pas re-déroulé ici. */}
      {pleinAir && <p className="rest-weather"><Icon id="expedition/grand-air" size="sm" /> {t('rf.pleinAirDispense')}</p>}
      {severity !== 'clement' && (
        <p className="rest-weather">{severity === 'extreme' ? <><Icon id="repos/tempete" size="sm" /> {t('rf.tempsDeChien')}</> : <><Icon id="repos/pluie" size="sm" /> {t('rf.mauvaisTemps')}</>}{sheltered ? <> — {t('rf.tenteAbrite')}</> : ''}</p>
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
              options={lodgingOptions(p.places).map((l) => ({ key: l, label: <><Icon id={LODGING_META[l].icon} size="sm" /> {t(LODGING_META[l].labelKey)}</>, selected: commonLodging === l, onSelect: () => applyTroupe({ lodging: l }) }))}
            />
            <OptionChooser
              layout="seg"
              groupLabel="Pitance"
              options={masterFood.map((f) => ({ key: f, label: <><Icon id={FOOD_META[f].icon} size="sm" /> {t(FOOD_META[f].labelKey)}</>, selected: commonFood === f, onSelect: () => applyTroupe({ food: f }) }))}
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
          const share = parts[h.id];
          return (
            <div key={h.id} className="rest-hero">
              <div className="rest-hero-line">
                <CharFrame c={h} variant="identity" size="sm" />
                <div className="rest-hero-id">
                  <StateChips c={h} reserve />
                </div>
                {/* Choix COURANT en toutes lettres (arbitrage user : plus de segments cryptiques par défaut). */}
                <div className="rest-hero-pick">
                  <span className="rest-hero-choice"><Icon id={LODGING_META[cfg.lodging].icon} size="sm" /> {t(LODGING_META[cfg.lodging].labelKey)} · <Icon id={FOOD_META[cfg.food].icon} size="sm" /> {t(FOOD_META[cfg.food].labelKey)}</span>
                  {warns.length > 0 && (
                    <span className="rest-warn">{warns.map((w, i) => <span key={i}>{i > 0 && ' · '}{w}</span>)}</span>
                  )}
                </div>
                <span className="rest-hero-cost">{toBrass(share) > 0 ? <Coins money={share} /> : '—'}</span>
                {mine && (
                  isOpen
                    ? <button type="button" className="btn small btn-ghost rest-hero-toggle" onClick={() => { regler(h.id, { lodging: commonLodging ?? cfg.lodging, food: commonFood ?? cfg.food }); setExpanded((s) => { const n = new Set(s); n.delete(h.id); return n; }); }} title="Revenir au choix de la troupe">↺ Troupe</button>
                    : <button type="button" className="btn small btn-ghost rest-hero-toggle" onClick={() => setExpanded((s) => new Set(s).add(h.id))} title="Régler ce héros à part">≠ Personnaliser</button>
                )}
              </div>
              {isOpen && mine && (
                <Row className="rest-hero-controls">
                  <OptionChooser
                    layout="seg"
                    groupLabel="Couchage"
                    options={lodgingOptions(p.places).map((l) => ({ key: l, label: <><Icon id={LODGING_META[l].icon} size="sm" /> {t(LODGING_META[l].labelKey)}</>, selected: cfg.lodging === l, onSelect: () => regler(h.id, { lodging: l }) }))}
                  />
                  <OptionChooser
                    layout="seg"
                    groupLabel="Nourriture"
                    options={foodOptions(p.places, h).map((f) => ({ key: f, label: <><Icon id={FOOD_META[f].icon} size="sm" /> {t(FOOD_META[f].labelKey)}</>, selected: cfg.food === f, onSelect: () => regler(h.id, { food: f }) }))}
                  />
                </Row>
              )}
            </div>
          );
        })}
      </div>
      <div className="rest-foot">
        {toBrass(cost) > 0 ? (
          <span className={`rest-cost ${couverte ? '' : 'over'}`}>Total <Coins money={cost} /> · Bourse <Coins money={money} /></span>
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
        {!p.travelHalt && <button className="btn btn-ghost" onClick={renoncer}>Annuler</button>}
        {net.mode === 'invite' && !ready[net.mySeat] && (
          <button className="btn" onClick={() => valider('repos')}><Icon id="action/attaquer" size="sm" /> Prêt</button>
        )}
        {(!online || net.mode === 'hote') && (
          <GatedAction
            id="rest-sleep"
            label={<><Icon id="temps/nuit" size="sm" /> Dormir jusqu’à l’aube</>}
            ariaLabel="Dormir jusqu’à l’aube"
            enabled={!refusDormir}
            {...raisonSi(refusDormir)}
            onClick={() => valider('repos')}
          />
        )}
    </>
  );
  if (embedded) {
    return <EmbeddedShell title={reglagesTitle} footer={reglagesFooter}>{reglagesBody}</EmbeddedShell>;
  }
  return (
    <Modal title={reglagesTitle} onClose={p.travelHalt ? undefined : renoncer} footer={reglagesFooter}>
      {reglagesBody}
    </Modal>
  );
}

/** MODALE DE REPOS flottante — repos au camp en exploration (hors hub de voyage). */
export function RestModal() {
  return <RestBody />;
}
