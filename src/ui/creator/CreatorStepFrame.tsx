/**
 * Gabarit d'étape UNIQUE du créateur — OSSATURE 2 ZONES (croquis user 2026-07-15, lot « ossature
 * enforcée » #393). Le rail 3 zones est MORT (planche FINALE : « Rail 286px MORT partout ») — le format
 * canonique s'encode ICI comme des SLOTS OBLIGATOIRES, plus jamais comme une consigne de brief :
 *
 *   ┌ zone de CHOIX ──────────────────────────┐ ┌ zone DESC ────────────────┐
 *   │ BANDE D'ACTION (slot REQUIS, en tête :  │ │ fiche de l'ÉLUE           │
 *   │  le choix de la voie — Choisir / Tirer  │ │ (Race/Carrière), puis     │
 *   │  aux dés — la carte d'action y vit)     │ │ FICHE VIVANTE (défaut :   │
 *   │ CHOIX (grille/contrôles de l'étape)     │ │ CreatorSummary→HeroSheet) │
 *   └─────────────────────────────────────────┘ └───────────────────────────┘
 *
 * Compose `MasterDetail` (gabarit de layout canon) ; chaque slot est estampillé d'un
 * `data-testid="creator-slot-*"` par CE composant UNIQUEMENT — la garde structurelle
 * (`creator-ossature.test.tsx`) monte les 8 étapes et vérifie leur présence par ces stamps
 * (identité du gabarit, jamais une convention de chaîne par-écran). Seule l'étape Présentation
 * garde son gabarit dédié (user 2026-07-15, verbatim : « c'est sensé être le même sauf sur le
 * dernier écran »).
 */
import type { ReactNode } from 'react';
import { CreatorDraft } from '../../noyau/creation/brouillon';
import { CreatorSummary } from './CreatorSummary';
import { MasterDetail } from '../MasterDetail';

/** Ce que produit chaque étape pour le gabarit — les SLOTS de l'ossature. */
export interface StepZones {
  /** Bande d'action, SLOT REQUIS en tête de la zone de choix : le choix de la voie de l'étape
   *  (« Choisir librement / Tirer aux dés +PX ») — l'encrier/carte d'action (`CreatorDice`,
   *  `.dicewell`) vit ici, jamais relégué ailleurs. */
  action: ReactNode;
  /** Zone de CHOIX : la grille/les contrôles de l'étape. */
  choice: ReactNode;
  /** Zone DESC : fiche de l'ÉLUE (Race/Carrière). Absente → FICHE VIVANTE (CreatorSummary,
   *  qui compose `HeroSheet` — identique au détail candidat du lobby). */
  desc?: ReactNode;
}

export function CreatorStepFrame({ d, step, zones, label }: { d: CreatorDraft; step: number; zones: StepZones; label?: string }) {
  return (
    <MasterDetail
      className="creator-step"
      listLabel={label}
      list={
        <>
          <div className="creator-step-action" data-testid="creator-slot-action">{zones.action}</div>
          <div className="creator-step-choice" data-testid="creator-slot-choice">{zones.choice}</div>
        </>
      }
      detail={
        <div className="creator-step-desc" data-testid="creator-slot-desc">
          {zones.desc ?? <CreatorSummary d={d} step={step} />}
        </div>
      }
    />
  );
}

/** En-tête d'étape — LA topbar de la planche ratifiée (`.fam-topbar`
 *  portant `.c-dhead` = titre `--font-display` 26px + sous-titre small-caps EN LIGNE, à sa baseline,
 *  puis les GESTES de l'étape en frères : plaque d'action, encrier). Consacrée en primitive par le lot
 *  « ossature enforcée » #393 (amendement 3, user 2026-07-15 : « c'est sensé etre des primitives ces
 *  éléments ») — le markup était recopié à la main par 6 appelants (étapes 3, 5a/5b/5c, 6, 7), qui ont
 *  chacun dérivé (sous-titre EMPILÉ sous le titre là où la planche le pose en ligne). Stylée UNE fois
 *  aux valeurs de la planche (`styles/creator-step.css`) — un pas COMPOSE cet en-tête, il ne le
 *  redessine pas. */
export function StepHeader({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="step-head">
      <h3 className="step-head-title">
        {/* Le NOM du pas dans son propre élément : il ne se coupe jamais en deux (cf. creator-step.css) —
            c'est la RUBRIQUE qui rend la place quand la topbar se resserre, jamais le titre. */}
        <span>{title}</span>
        {sub != null && <small>{sub}</small>}
      </h3>
      {children}
    </div>
  );
}

/** Section de zone : titre en petites capitales + séparateur (pas de boîte flottante). */
export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="zone-section">
      <h3>
        <span>{title}</span>
        {right && <span className="sect-right">{right}</span>}
      </h3>
      {children}
    </section>
  );
}

export function XpBadge({ value }: { value: number }) {
  return value > 0 ? <span className="xp-badge">+{value} PX</span> : null;
}
