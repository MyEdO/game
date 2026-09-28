import { useState, type ReactNode } from 'react';
import { CharFrame } from './CharFrame';
import { PanneauParametre, type ParamOption } from './PanneauParametre';
import { GatedAction } from './GatedAction';
import { Icon } from './Icon';
import type { Combatant } from '../engine/types';

/**
 * CASE D'AFFECTATION — affordance UNIQUE « qui est affecté ici, et comment en ajouter un » : les
 * personnes affectées en portraits (clic = retirer) suivies de l'ajout `[ + ]`. Source partagée des
 * lignes de `PostesRoster` (rôles de marche EDOC 8, postes d'équipage MDG 14, stations MDG 13) ET des
 * Scènes de bataille de masse (ADE II 8).
 *
 * DEUX RÈGLES portées ICI, donc tenues par tous ses consommateurs à la fois :
 *  - une case VIDE ne porte AUCUN MOT (arbitrage user 2026-08-24, étendu aux rosters le 2026-09-04) :
 *    ni « Aucun PJ affecté », ni « Libre » — il reste l'affordance d'ajout et son NOM ACCESSIBLE ;
 *  - l'ajout est un PANNEAU-PARAMÈTRE BORNÉ (`PanneauParametre`) ancré au `[ + ]`, pas une liste
 *    dépliée en permanence : la situation borne les candidats, un clic commit et referme, Échap
 *    annule gratuitement. Un SEUL mécanisme de choix borné dans le dépôt.
 *
 * Case FERMÉE (`refus`) : l'affordance d'ajout reste VISIBLE — le MÊME glyphe, simplement ÉTEINT
 * (`aria-disabled`, jamais `disabled` : il garde le clavier et la manette) — et dit POURQUOI au
 * survol/focus/tap via `GatedAction`. Jamais un filtrage silencieux, jamais un refus inline.
 */
export function AssignRow({
  assigned, candidates, onAssign, onRemove, intitule, canPick = true, retirable = true, nomRetirer, metaDe, refus,
}: {
  /** Personnes actuellement affectées à CETTE case. */
  assigned: Combatant[];
  /** Candidats à l'ajout (l'appelant filtre : jamais quelqu'un de déjà affecté ICI). */
  candidates: Combatant[];
  onAssign: (heroId: string) => void;
  onRemove: (heroId: string) => void;
  /** Ce que le panneau DEMANDE, en une ligne (« Postes d’équipage — Timonier : affecter ») — c'est aussi
   *  le nom accessible du `[ + ]`. */
  intitule: string;
  /** Gèle l'ajout (Round résolu, Scène close…) : les portraits restent, le `[ + ]` disparaît. */
  canPick?: boolean;
  /** Les portraits de cette case sont-ils RETIRABLES ? `false` = ils sont là par CONSTAT et non par
   *  affectation (le banc : ces personnes ne tiennent aucun poste, il n'y a rien à leur retirer) — ils
   *  sont alors rendus DÉCORATIFS, sans geste ni promesse de geste. Une affordance qui ne change rien
   *  est morte : elle ne se rend pas. */
  retirable?: boolean;
  /** Nom accessible d'un portrait affecté (défaut : « X — retirer »). */
  nomRetirer?: (c: Combatant) => string;
  /** MÉTA d'un candidat dans le panneau — ce qui fait DÉCIDER : son affectation actuelle (« Gréement »),
   *  qui rend le déplacement visible avant le clic. */
  metaDe?: (c: Combatant) => ReactNode;
  /** RAISON pour laquelle cette case n'est pas tenable ici — rendue au survol/focus/tap. */
  refus?: string;
}) {
  // Le BOUTON (ancre potentielle) et l'OUVERTURE sont deux choses : une `ref` callback est appelée au
  // MONTAGE, donc s'en servir d'état d'ouverture rendrait tous les panneaux du roster ouverts d'emblée.
  const [btnAjout, setBtnAjout] = useState<HTMLButtonElement | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const ferme = refus != null;
  const options: ParamOption[] = candidates.map((c) => ({
    key: c.id,
    label: c.label,
    // DÉCORATIVE : le candidat EST déjà un bouton (`OptionChooser`), et c'est lui qui porte le geste
    // et le nom — une tuile cliquable de plus y serait un bouton dans un bouton. La RANGÉE
    // (portrait, nom, méta) est rangée par `PanneauParametre`, jamais ici.
    visuel: <CharFrame c={c} variant="identity" size="sm" decoratif />,
    ...(metaDe?.(c) != null ? { meta: metaDe(c) } : {}),
    onSelect: () => onAssign(c.id),
  }));
  return (
    <div className="pr-cases">
      {assigned.map((h) => (retirable ? (
        <CharFrame
          key={h.id}
          c={h}
          variant="identity"
          size="xs"
          nom={nomRetirer?.(h) ?? `${h.label} — retirer`}
          onClick={() => onRemove(h.id)}
        />
      ) : (
        <CharFrame key={h.id} c={h} variant="identity" size="xs" decoratif />
      )))}
      {ferme ? (
        <GatedAction
          id={`assign-${intitule.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
          label={<Icon id="ui/add" size="sm" />}
          ariaLabel={intitule}
          enabled={false}
          reason={refus!}
          onClick={() => {}}
          primary={false}
          btnClassName="small"
        />
      ) : canPick && candidates.length > 0 ? (
        <>
          <button
            type="button"
            className="btn small pr-add"
            ref={setBtnAjout}
            aria-label={intitule}
            aria-haspopup="dialog"
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
          >
            <Icon id="ui/add" size="sm" />
          </button>
          <PanneauParametre anchor={ouvert ? btnAjout : null} intitule={intitule} options={options} onClose={() => setOuvert(false)} />
        </>
      ) : null}
    </div>
  );
}
