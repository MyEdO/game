/**
 * « Aux dés » — cérémonie de tirage RÉCURRENTE du créateur (arbitrage 2026-07-13) : même place (tête
 * de Zone A), même langage à chaque étape qui offre un tirage (d100 Race/Carrière, 2d10 Caractéristiques,
 * d100 Signe astral). Un seul composant remplace les 4 libellés de tirage divergents.
 *
 * LA CARTE est celle de la planche ratifiée (`.c-dicewell`) : plateau de
 * DEUX FACES DE DÉS (`DieFace` — jamais l'icône `navigation/des` étriquée, qui ne montrait aucun dé), libellé
 * d'ACTION à l'impératif en tête, gain de PX en sous-texte ; puis, le sort rendu, la carte RÉSOLUE
 * (`.dicewell.done`, laiton : « Aux dés — d100 » / « le ciel a rendu 15 — Le Trait du Peintre »). C'est
 * la MÊME carte que les encriers Race/Carrière posaient à la main — elle vit ici, une fois.
 *
 * Le GAIN DE PX est mis en scène par `XpBadge` : la fiche vivante (CreatorSummary) recalcule `xpTotal`
 * à chaque changement du brouillon, donc accepter un tirage incrémente le compteur PX EN DIRECT.
 * Composé exclusivement de primitives/classes existantes (Section, XpBadge, `.dicewell`, DieFace).
 */
import type { ReactNode } from 'react';
import { useRollFrisson } from '../useRollFrisson';
import { DiceRoll, DieFace } from '../DiceRoll';
import { d100Faces } from '../Dice';
import { Section, XpBadge } from './CreatorStepFrame';

/** Plateau de l'encrier : les deux faces du d100 (planche `.tray`). `null` = face NUE — un tirage
 *  dont l'appelant ne conserve pas la valeur se fige sans chiffre, jamais sur un score inventé. */
function DiceTray({ faces }: { faces: readonly [number | null, number | null] }) {
  return (
    <span className="dicewell-tray">
      {faces.map((n, i) => (
        <span key={i} className="rm-die dicewell-die">
          <DieFace n={n} landed tone="gold" />
        </span>
      ))}
    </span>
  );
}

export function CreatorDice({ label, sub, verdict, hint, rolled, xp, onRoll, roll, frisson, bare, children }: {
  /** Libellé du bouton de tirage, à l'IMPÉRATIF (« Tirer aux dés — d100 ») — inutile si `rolled`. */
  label?: string;
  /** Sous-texte de la carte d'attente : le GAIN DE PX (planche — « l'affordance à ne jamais laisser
   *  passer inaperçue »). Absent = carte à un seul libellé. */
  sub?: ReactNode;
  /** Sous-texte de la carte RÉSOLUE (« le ciel a rendu 15 — Le Trait du Peintre »). Absent ⇒ aucune
   *  carte de verdict : l'étape porte le sien en `children` (chips tirées, bouton de relance…). */
  verdict?: ReactNode;
  /** Règle du bonus (LDB) sous le bouton — réf sourcée, jamais une paraphrase. */
  hint?: ReactNode;
  /** Un tirage a-t-il été posé ? (masque le bouton initial, montre le verdict). */
  rolled: boolean;
  /** PX gagnés si le tirage est gardé — reflété EN DIRECT dans le compteur de la fiche. */
  xp: number;
  onRoll?: () => void;
  /** Valeur d100 COURANTE du tirage (#396 v3) — traduite en vraies faces à l'atterrissage
   *  (`d100Faces`) ET gravée sur la carte résolue. Absente ⇒ les dés se figent SANS chiffre plutôt
   *  que d'en inventer un (jamais une face qui contredit le score). */
  roll?: number;
  /** `false` = pas de scène centrale : le résolveur s'exécute AU CLIC et l'étape porte son PROPRE
   *  théâtre de dés (ex. cérémonie séquentielle des dix 2d10, #393 agentivité — les rangées roulent,
   *  pas la carte). Défaut : `true` (roulis central puis vraies faces). */
  frisson?: boolean;
  /** Carte NUE, sans la section « Aux dés » — pour la TOPBAR de l'étape (`StepHeader`), là où la
   *  planche pose l'encrier (`.fam-topbar` : titre à gauche, encrier borné à droite). */
  bare?: boolean;
  /** Verdict garder/relancer/choisir (contrôles propres à l'étape). */
  children?: ReactNode;
}) {
  // Même geste que RollShell/RollRow (#396) : le tirage du créateur roule au centre de sa zone avant
  // de révéler son verdict. Découplé de `rolled` (qui bascule DÈS le résolveur commis, en plein
  // `landed`) : sinon les vraies faces n'auraient pas le temps de s'afficher.
  const { rolling, landed, trigger, skip } = useRollFrisson(onRoll, { frisson });
  const faces = roll != null ? d100Faces(roll) : null;
  const body =
    rolling || landed ? (
      <DiceRoll scene landed={landed} faces={landed ? faces : null} onSkip={skip} tone="gold" />
    ) : !rolled && onRoll ? (
      /* Attente = encrier rouge bordé-teinté « Atelier du scribe » (#414 : composant unique, langue
         « tu peux agir » — ROUGE bordé, en retrait du rempli de navigation). */
      <button type="button" className="dicewell act emph" onClick={() => trigger()}>
        <DiceTray faces={[null, null]} />
        <span className="dicewell-copy">
          <span className="dicewell-txt">{label}</span>
          {sub && <span className="dicewell-sub">{sub}</span>}
        </span>
      </button>
    ) : (
      <>
        {verdict != null && (
          <div className="dicewell done">
            <DiceTray faces={faces ?? [null, null]} />
            <span className="dicewell-copy">
              <span className="dicewell-txt">Aux dés — d100</span>
              <span className="dicewell-sub">{verdict}</span>
            </span>
          </div>
        )}
        {children}
      </>
    );
  return bare ? (
    body
  ) : (
    <Section title="Aux dés" right={<XpBadge value={xp} />}>
      {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
      {body}
    </Section>
  );
}
