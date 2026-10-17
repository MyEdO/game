import { useState } from 'react';
import { useGame } from '../state/store';
import { Combatant } from '../engine/types';
import { findStarById } from '../data';
import { BackgroundFields } from './BackgroundFields';
import { Icon } from './Icon';
import { ChoiceButtons } from './OptionChooser';
import { GatedAction } from './GatedAction';
import { Prose } from './Prose';
import { Row } from './Layout';
import { favorRequiredActivities, type Favor } from '../engine/favor';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { favorLevelSchema } from '../data/schemas/defs-scenes/effets';

/** Onglet « Background » de la fiche : bio en LECTURE SEULE (détails physiques + astrologie, LDB 05
 *  étape 6 — cosmétique) et les champs ÉDITABLES hors combat (Motivation + Ambitions court/long,
 *  LDB 05 l.730-736) — rendus par la primitive PARTAGÉE `BackgroundFields` (même markup/hints que le
 *  créateur). L'édition passe par `setHeroBackground` → persistée en save + roster. En combat, c'est
 *  verrouillé (on ne mute que `store.party`, jamais la copie de bataille). Les Faveurs dues (LDB 23
 *  l.139-153, #509) s'affichent ici — même famille narrative que Motivation/Ambitions. */
export function BackgroundPanel({ hero }: { hero: Combatant }) {
  const setHeroBackground = useGame((s) => s.setHeroBackground);
  const inBattle = useGame((s) => !!s.battle);
  const favors = useGame((s) => s.favors);
  const favorBreak = useGame((s) => s.favorBreak);
  const d = hero.details;
  const starLabel = hero.star ? (findStarById(hero.star)?.label ?? hero.star) : undefined;

  // Bio figée : on n'affiche que les champs RÉELLEMENT présents (rien d'inventé).
  const bio: [label: string, value: string | undefined][] = [
    ['Âge', d?.age != null ? `${d.age} ans` : undefined],
    ['Taille', d?.height != null ? `${d.height} cm` : undefined],
    ['Yeux', d?.eyes],
    ['Cheveux', d?.hair],
    ['Signe astral', starLabel],
    ['Ascendant', d?.ascendant],
  ];
  const shown = bio.filter(([, v]) => v != null && v !== '');
  const heroFavors = (favors ?? []).filter((f) => f.heroId === hero.id);

  return (
    <div className="bg-panel">
      {shown.length > 0 && (
        <>
          <div className="mini-title">Identité</div>
          <div className="bg-grid">
            {shown.map(([label, value]) => (
              <div className="stat-chip" key={label}>
                <span className="sc-label" title={label}>{label}</span>
                <span className="sc-value">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {heroFavors.length > 0 && (
        <>
          <div className="mini-title">Faveurs dues</div>
          <div className="bg-favors">
            {heroFavors.map((f) => (
              <FavorRow key={f.id} favor={f} disabled={inBattle} onBreak={() => favorBreak(hero.id, f.id)} />
            ))}
          </div>
        </>
      )}

      <div className="mini-title">
        Background <span className="bg-hint"><Icon id="ui/edit" size="sm" /> Modifiable hors combat</span>
      </div>
      <BackgroundFields
        values={{ motivation: hero.motivation ?? '', ambitionShort: d?.ambitionShort ?? '', ambitionLong: d?.ambitionLong ?? '' }}
        onChange={(patch) => setHeroBackground(hero.id, patch)}
        disabled={inBattle}
      />
    </div>
  );
}

const COMBAT_REFUS = 'Impossible de rompre une Faveur en plein combat.';

/** Une Faveur due : Niveau + créancier + progression d'acquittement, et la rupture explicite
 *  (confirmation à deux temps — `ChoiceButtons`, cf. primitives partagées) — « votre Niveau est
 *  toujours réduit de 1 […] si la rumeur de la perfidie se répand » (LDB 23 l.141). */
function FavorRow({ favor, disabled, onBreak }: { favor: Favor; disabled: boolean; onBreak: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const required = favorRequiredActivities(favor.level);
  return (
    <div className="stat-chip favor-chip">
      <span className="sc-label" title={`${libelleDeValeur(favorLevelSchema, favor.level)} envers ${favor.owedTo}`}>
        {libelleDeValeur(favorLevelSchema, favor.level)} envers {favor.owedTo}
      </span>
      <div className="sc-value"><Prose md={favor.desc} /></div>
      <span className="bg-hint">
        {required != null
          ? `${favor.progress}/${required} Activité${required > 1 ? 's' : ''} consécutive${required > 1 ? 's' : ''} pour l'acquitter (Entre deux aventures)`
          : `Ne peut pas être acquittée par une Activité — jouée comme une aventure complète`}
      </span>
      {confirming ? (
        <Row gap="sm" justify="end">
          <ChoiceButtons idPrefix={`favor-${favor.id}`} options={[
            { key: 'cancel', label: 'Annuler', ghost: true, onSelect: () => setConfirming(false) },
            {
              key: 'confirm', label: 'Confirmer la rupture', primary: true, refus: disabled ? COMBAT_REFUS : undefined,
              onSelect: () => { onBreak(); setConfirming(false); },
            },
          ]} />
        </Row>
      ) : (
        <GatedAction
          id={`favor-break-${favor.id}`}
          label="Rompre la Faveur"
          enabled={!disabled}
          reason={COMBAT_REFUS}
          descOfferte="Refuser la Faveur : Niveau de Carrière réduit de 1, minimum 0, si la rumeur se répand"
          onClick={() => setConfirming(true)}
          primary={false}
          btnClassName="small btn-ghost"
        />
      )}
    </div>
  );
}
