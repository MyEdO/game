import { Fragment } from 'react';
import { summarizeEffects, combatantFlags, chipCodex, chipNom, type EffectChip } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';
import { CodexRef } from './compendium/CodexRef';
import { GatedAction } from './GatedAction';
import { Icon } from './Icon';

/**
 * GESTE porté par UNE pastille — slot GÉNÉRIQUE (arbitrage HUD 2026-08-16, verbatim : « Réactions
 * d'État sur la PASTILLE (`StateChips`+`GatedAction`) »). La forme ne nomme AUCUNE mécanique :
 * l'appelant fournit le nom accessible et le dispatcher — une `Cell` de la console la satisfait
 * telle quelle, et une autre réaction d'État s'y branchera sans fork.
 * Un geste FERMÉ reste un CONTRÔLE : il porte sa raison au survol/focus/tap (`CodexRef refus`,
 * arbitrage user 2026-08-24), reste atteignable (`aria-disabled`, jamais `disabled`) et son clic est
 * inerte. L'appelant ne rend `undefined` que là où AUCUN geste n'existe (pastille informative).
 */
interface ChipAction {
  /** Nom ACCESSIBLE du geste : la pastille n'affiche qu'un glyphe, elle n'a aucun texte à lui prêter. */
  label: string;
  run: () => void;
  /** Raison du REFUS quand le geste existe mais est fermé — portée au survol/focus, jamais inline. */
  refus?: string;
}

/**
 * Pastilles d'États / effets actifs d'un combattant (la colonne `.ptile-states`), posable
 * hors de `PortraitTile` : dans l'arche de la console elles vivent À DROITE de la barre de Mouvement,
 * jamais DERRIÈRE elle, où une pastille (le +10 CC d'une Bénédiction) passerait sous la jauge. `max` = pastilles avant le « ▾ » de débord.
 * Pure (testable en SSR).
 *
 * Elles informent par le MÊME mécanisme que `EffectChips` : `CodexRef` (routage `chipCodex`), jamais
 * une infobulle native — et une pastille sans règle résolue reste nue (aucun popover de consolation,
 * arbitrage user 2026-07-18).
 *
 * Chaque pastille porte SON CHIFFRE quand elle en a un (`EffectChip.indice` : pions de l'État, DR de
 * Focalisation, Indice de Peur) — l'icône seule ne disait pas « combien ».
 *
 * `reserve` : rack d'alvéoles RÉSERVÉES — `max` cellules TOUJOURS DESSINÉES, les vides comprises
 * (arbitrage user 2026-07-11 « empreinte stable », rappel 2026-08-17 verbatim : « une zone pour
 * mettre les états icônes et leur indice »). Un État de plus ne redimensionne donc aucune carte, et
 * une liste de rangées-personnages garde ses colonnes alignées. Sans `reserve`, rien n'est rendu
 * quand il n'y a aucun effet (défaut HUD).
 *
 * `extra` : pastilles d'ÉTAT que le Combatant ne porte pas lui-même — elles dépendent de la SITUATION
 * de combat (`battle`) et non de `conditions`/`activeEffects` : Assailli ×N, Cloué, Renfort de pièce.
 * Elles entrent dans le MÊME rack, après les effets portés — une seule niche d'États, jamais deux.
 *
 * `action` : RÉSOLVEUR de geste, appelé pour CHAQUE pastille rendue (portée ou `extra`) — il rend le
 * geste que CET effet ouvre, ou `undefined` (la pastille reste alors purement informative). Le
 * contrôle est composé par `GatedAction` et reste enveloppé de son `CodexRef` : la règle et le geste
 * vivent dans la MÊME alvéole, aucune 2ᵉ surface.
 */
export function StateChips({
  c,
  max = 4,
  reserve = false,
  extra,
  action,
}: {
  c: Combatant;
  max?: number;
  reserve?: boolean;
  extra?: EffectChip[];
  action?: (chip: EffectChip) => ChipAction | undefined;
}) {
  const all = [...summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible, ...(extra ?? [])];
  // En rack réservé, le débord occupe la DERNIÈRE alvéole : le compte de cellules dessinées ne bouge
  // pas d'un cran, quel que soit le nombre d'États portés.
  const room = reserve && all.length > max ? max - 1 : max;
  const shown = all.slice(0, room);
  const more = all.slice(room);
  if (!reserve && shown.length === 0 && more.length === 0) return null;
  const vides = reserve ? Math.max(0, max - shown.length - (more.length > 0 ? 1 : 0)) : 0;
  return (
    <span className="ptile-states" data-reserve={reserve ? '' : undefined}>
      {shown.map((v) => {
        const ref = chipCodex(v);
        const geste = action?.(v);
        const inner = (
          <>
            <Icon id={v.icon} size="sm" />
            {v.indice != null && <b className="pt-n">{v.indice}</b>}
          </>
        );
        if (geste) {
          // Le bouton EST l'alvéole : il arrive NU (`bare`) et garde la matière du rack (`pt-state`).
          // Aucun conteneur — un `<div>` de `GatedAction` romprait le flux inline des alvéoles, d'où
          // la forme `reasonId` : la raison d'un refus vit dans l'infobulle du `CodexRef` qui
          // enveloppe l'alvéole, et dans le NOM ACCESSIBLE du bouton.
          const rid = `pt-act-${v.key}`;
          const nom = geste.refus ? `${geste.label} — ${geste.refus}` : geste.label;
          const bouton = (
            <GatedAction
              id={rid}
              reasonId={rid}
              label={inner}
              ariaLabel={nom}
              enabled={!geste.refus}
              primary={false}
              bare
              btnClassName="pt-state"
              onClick={geste.run}
            />
          );
          // Ni règle résolue ni refus : l'alvéole reste NUE (arbitrage user 2026-07-18) — aucune
          // enveloppe, le nom accessible du bouton porte déjà le libellé de l'effet.
          if (!ref && !geste.refus) return <Fragment key={v.key}>{bouton}</Fragment>;
          return (
            <CodexRef
              key={v.key}
              category={ref?.category}
              id={ref?.id}
              label={ref?.label ?? v.label}
              instance={ref?.instance}
              refus={geste.refus}
              wrap
            >
              {bouton}
            </CodexRef>
          );
        }
        // Pastille informative SANS règle résolue : elle reste NUE à l'œil (arbitrage user
        // 2026-07-18 — aucun popover, aucune infobulle native), mais jamais MUETTE pour autant : son
        // NOM (`chipNom`) est son NOM ACCESSIBLE (`role="img"` + `aria-label`), sinon l'icône ne dit
        // rien du tout à un lecteur d'écran.
        if (!ref) return <span key={v.key} className="pt-state" role="img" aria-label={chipNom(v)}>{inner}</span>;
        // Règle résolue : le nom accessible se POSE (`ariaLabel`) au lieu d'être dérivé de la fiche —
        // le CHIFFRE de l'alvéole (`pt-n`) est du texte : il suffisait à nommer le contrôle, qui
        // s'annonçait alors « 3 ». MÊME texte que la chip de la fiche (`chipNom`, source unique).
        return (
          <CodexRef
            key={v.key}
            category={ref.category}
            id={ref.id}
            label={ref.label}
            instance={ref.instance}
            ariaLabel={chipNom(v)}
            className="pt-state"
          >
            {inner}
          </CodexRef>
        );
      })}
      {more.length > 0 && (
        <CodexRef
          category="etats"
          label={`${more.length} effet${more.length > 1 ? 's' : ''} de plus`}
          fallback={{ body: more.map((m) => m.label).join(' · ') }}
          className="pt-state ptile-more"
        >
          ▾
        </CodexRef>
      )}
      {Array.from({ length: vides }, (_, i) => (
        <span key={`vide-${i}`} className="pt-void" aria-hidden="true" />
      ))}
    </span>
  );
}
