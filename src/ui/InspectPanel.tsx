import { useState } from 'react';
import type { Combatant } from '../engine/types';
import { useGame } from '../state/store';
import { presetPnjById } from '../state/campaignData';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { PortraitTile } from './PortraitTile';
import { summarizeEffects, combatantFlags } from '../gameIso/effectIcons';
import { CodexSections } from './compendium/CodexEntry';
import { combatantSections, proseDeFiche } from './compendium/registry';
import { Tabs } from './Tabs';
import { EffectChips } from './EffectChips';
import { isFrenzied } from '../engine/psychology';
import { isVehicle } from '../engine/vehicle';
import { isEngin } from '../engine/structures';
import { ShipInspectBody } from './ShipSheet';
import { Icon } from './Icon';
import { WoundsBadge } from './WoundsBadge';

/**
 * Panneau d'INSPECTION d'une entité (geste secondaire d'un jeton ou d'un portrait, touche `inspecter`) — un
 * combattant en combat, un héros ou un PNJ de scène hors combat : tête VIVANTE (portrait,
 * PB exacts, psychologie au coup d'œil, États) + le STATBLOC COMPLET rendu par le MÊME composant
 * que la fiche Codex (`CodexSections`, alimenté par les valeurs réelles via `combatantSections`).
 * Plus de panneau recopié ni de sous-ensemble de caractéristiques — une seule vérité de rendu.
 *
 * ONGLETS (#2206) : « Profil » (le statbloc) et « Description » (`proseDeFiche` : la `desc` de la fiche,
 * avec l'entrée qui la porte). Sans prose, ni onglet ni barre : le statbloc seul.
 *
 * COQUE (navire/engin, #240) : le statbloc-personnage n'a aucun sens (caracs nulles) → on inspecte l'objet
 * visible via `ShipInspectBody` (Coque, cap, postes, Traits/Améliorations dont la Proue-idole #221) — même
 * geste, une coque ENNEMIE y répond comme un combattant, en LECTURE.
 */
export function InspectPanel({ combatant, onClose }: { combatant: Combatant; onClose: () => void }) {
  const c = combatant;
  const battle = useGame((s) => s.battle);
  const facing = useGame((s) => s.facing);
  const hull = isVehicle(c) || isEngin(c);
  const fx = summarizeEffects(c.conditions, c.activeEffects ?? [], Infinity, combatantFlags(c));
  const prose = hull ? null : proseDeFiche(c, presetPnjById);
  const [onglet, setOnglet] = useState<'profil' | 'description'>('profil');
  const crew = hull ? (c.crewIds ?? []).map((id) => battle?.combatants.find((x) => x.id === id)).filter((x): x is Combatant => !!x) : [];

  return (
    <Modal
      label={`Inspection — ${c.label}`}
      kind="inspection"
      taille="apercu"
      onClose={onClose}
      backdropClose
      footer={<button className="btn btn-primary" onClick={onClose}>Fermer</button>}
    >
      <div className="insp-head">
        {hull ? <PortraitTile c={c} ring="var(--gold)" variant="full" size="lg" /> : <CharFrame c={c} variant="vital" size="lg" />}
        <div className="insp-id">
          <h3>{c.label}</h3>
          {/* PB en tête sans libellé texte : l'icône `resource/wounds` porte le sens (choix DÉLIBÉRÉ
              du site d'appel — le badge, lui, rend seulement la valeur). */}
          {!hull && <span className="insp-pv-num"><Icon id="resource/wounds" size="sm" /> <WoundsBadge wounds={c.wounds} /></span>}
        </div>
      </div>

      {hull ? (
        <ShipInspectBody hull={c} crew={crew} cap={facing[c.id]} />
      ) : (
        <>
          {/* Coup d'œil tactique : psychologie + « lanceur de sorts » (le détail est dans le statbloc). */}
          {(c.causesTerreur || c.causesPeur || c.psychImmune || isFrenzied(c) || (c.spells?.length ?? 0) > 0) && (
            <div className="insp-badges">
              {c.causesTerreur ? (
                <span className="insp-badge foe"><Icon id="flag/fear" size="sm" /> Terreur {c.causesTerreur}</span>
              ) : c.causesPeur ? (
                <span className="insp-badge foe"><Icon id="flag/fear" size="sm" /> Peur {c.causesPeur}</span>
              ) : null}
              {c.psychImmune && <span className="insp-badge"><Icon id="char/int" size="sm" /> Immunité psy</span>}
              {isFrenzied(c) && <span className="insp-badge foe"><Icon id="flag/frenzy" size="sm" /> Frénésie</span>}
              {(c.spells?.length ?? 0) > 0 && <span className="insp-badge foe"><Icon id="action/cast" size="sm" /> Lanceur de sorts</span>}
            </div>
          )}

          {fx.visible.length > 0 && (
            <div className="insp-row">
              <span className="insp-lbl">États</span>
              <EffectChips conditions={c.conditions} effects={c.activeEffects ?? []} flags={combatantFlags(c)} />
            </div>
          )}

          {prose && (
            <Tabs
              tabs={[{ key: 'profil', label: 'Profil' }, { key: 'description', label: 'Description' }]}
              active={onglet}
              onChange={setOnglet}
              label={`Fiche de ${c.label}`}
            />
          )}
          {/* Statbloc COMPLET et Description via le rendu PARTAGÉ du Codex (toutes les caracs, armes,
              armure, traits, compétences, talents, sorts — chaque entité cliquable vers sa fiche). Les
              deux onglets restent montés : l'inactif est inerte et caché (`.insp-onglets`). */}
          {prose ? (
            <div className="insp-statblock insp-onglets">
              <div inert={onglet !== 'profil'} aria-hidden={onglet !== 'profil'}>
                <CodexSections sections={combatantSections(c)} />
              </div>
              <div inert={onglet !== 'description'} aria-hidden={onglet !== 'description'}>
                <CodexSections sections={[prose.section]} entree={prose.entree} />
              </div>
            </div>
          ) : (
            <div className="insp-statblock">
              <CodexSections sections={combatantSections(c)} />
            </div>
          )}
        </>
      )}

    </Modal>
  );
}
