import { useState, type CSSProperties } from 'react';
import { CharFrame } from './CharFrame';
import { hpColor } from '../gameIso/teamColors';
import type { Combatant } from '../engine/types';

/** Alvéoles d'États réservées par tuile — GÉOMÉTRIE de la carte (planche 2026-08-17 : 1 colonne de
 *  3 cases dessinées). Le compte ne dépend jamais des États portés. */
const DOCK_STATE_CELLS = 3;

/** Dock de compagnie composé de portraits complets. La bande est
 *  strictement IDENTITAIRE : elle ne marque pas l'acteur du tour (spec §1c-bis BANDEAU, arbitrage user
 *  2026-08-17) — l'ordre du tour et l'actif vivent à la frise d'initiative seule. */
export type PartyDockProps = {
  heroes: Combatant[];
  targeting?: boolean;
  onOpen: (id: string) => void;
  /** GESTE SECONDAIRE d'une tuile (`PortraitTile.onInspect`) : la fiche de ce héros, en combat comme hors combat. */
  onInspect?: (id: string) => void;
};

export function PartyDock({ heroes, targeting, onOpen, onInspect }: PartyDockProps) {
  /** Bande DÉPLIÉE ? Seule la composition étroite (≤560px) la replie — au-dessus, la poignée est
   *  masquée en CSS et la piste toujours montée : l'état ne retire jamais de contenu du DOM. */
  const [open, setOpen] = useState(false);
  return (
    <div className={`party-dock${open ? ' on' : ''}`}>
      {/* POIGNÉE (≤560px) : la bande repliée rend le TERRAIN au joueur sans rien perdre — le compte
          du groupe et la vie de chacun restent lus, en micro-jauges, et le tap déplie les tuiles. */}
      <button
        type="button"
        className="chip pd-handle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Le compte dit EXACTEMENT ce que le volet déroule (une tuile par entrée, une micro-jauge
            par entrée) et NOMME ce qu'il compte — « 4 » nu se lisait indifféremment héros ou
            vignettes de la frise dessous. */}
        <span className="pd-count">{heroes.length}</span>
        <span className="pd-label">au groupe</span>
        <span className="pd-micro">
          {heroes.map((c) => {
            const ratio = c.wounds.max > 0 ? Math.max(0, Math.min(1, c.wounds.current / c.wounds.max)) : 0;
            return (
              <i
                key={c.id}
                title={`${c.label} — ${c.wounds.current}/${c.wounds.max}`}
                style={{ '--pd-hp': `${Math.round(ratio * 100)}%`, '--pd-hp-color': hpColor(ratio) } as CSSProperties}
              />
            );
          })}
        </span>
      </button>
      <div className="pd-track">
      {heroes.map((c) => (
        <figure key={c.id}>
          {/* Tuile = portrait + Blessures chiffrées + alvéoles d'État (spec §1c-bis). */}
          <CharFrame
            c={c}
            variant="full"
            size="md"
            /* COLONNE D'ÉTATS à alvéoles RÉSERVÉES au flanc du portrait (planche 2026-08-17) :
               3 cases toujours dessinées, chiffrées — zéro État ne rétrécit pas la carte, un 4ᵉ
               État prend l'alvéole de débord de la primitive. */
            reserveStates
            maxStates={DOCK_STATE_CELLS}
            onClick={() => onOpen(c.id)}
            onInspect={onInspect ? () => onInspect(c.id) : undefined}
            nom={targeting ? `${c.label} — cibler` : `${c.label} — fiche du personnage`}
          />
        </figure>
      ))}
      </div>
    </div>
  );
}
