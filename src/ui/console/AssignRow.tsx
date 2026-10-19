import { Fragment, useState, type ReactNode } from 'react';
import { CharFrame } from '../CharFrame';
import { PanneauParametre, type ParamOption } from '../PanneauParametre';
import { GatedAction } from '../GatedAction';
import { Icon } from '../Icon';
import type { Combatant } from '../../engine/types';

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
 *
 * Candidat FERMÉ (`refusDe`) : la case est tenable, mais pas par CE candidat (un Test CHOISI qu'il ne
 * peut pas tenter, LDB 09 l.30 ; #2588). Il reste OFFERT au panneau, éteint, avec sa raison — le refus
 * PAR OPTION que `RollOption.refus` porte déjà (`OptionChooser`).
 *
 * PARAMÈTRE de l'affectation (`parametreDe`) : la case demande, une fois la personne choisie, UN
 * paramètre de plus (la Compétence de Pratiquer une Compétence, EDOC 8) — un SECOND panneau-paramètre
 * ancré au MÊME `[ + ]`, dont chaque valeur fermée porte sa raison. L'affectation ne part qu'avec lui.
 */
/** Valeur d'un paramètre d'affectation : sa clé (rendue à `onAssign`), son nom, et sa raison s'il est fermé. */
export interface ParametreAffectation { key: string; label: string; refus?: string }
export function AssignRow({
  assigned, candidates, onAssign, onRemove, intitule, canPick = true, retirable = true, nomRetirer, metaDe, precisionDe, refus, refusDe, parametreDe,
}: {
  /** Personnes actuellement affectées à CETTE case. */
  assigned: Combatant[];
  /** Candidats à l'ajout (l'appelant filtre : jamais quelqu'un de déjà affecté ICI). */
  candidates: Combatant[];
  /** Affecte `heroId` ; `parametre` = clé de la valeur choisie quand la case en demande une (`parametreDe`). */
  onAssign: (heroId: string, parametre?: string) => void;
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
  /** PRÉCISION VISIBLE d'une personne affectée (la Compétence qu'elle pratique), rendue à côté de son portrait. */
  precisionDe?: (c: Combatant) => ReactNode;
  /** RAISON pour laquelle cette case n'est pas tenable ici — rendue au survol/focus/tap. */
  refus?: string;
  /** RAISON pour laquelle CE candidat ne peut pas tenir la case — son option est éteinte et le dit. */
  refusDe?: (c: Combatant) => string | undefined;
  /** PARAMÈTRE que CE candidat doit fixer pour tenir la case (sa question, ses valeurs) ; absent = aucun. */
  parametreDe?: (c: Combatant) => { intitule: string; valeurs: ParametreAffectation[] } | undefined;
}) {
  // Le BOUTON (ancre potentielle) et l'OUVERTURE sont deux choses : une `ref` callback est appelée au
  // MONTAGE, donc s'en servir d'état d'ouverture rendrait tous les panneaux du roster ouverts d'emblée.
  const [btnAjout, setBtnAjout] = useState<HTMLButtonElement | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [parametrant, setParametrant] = useState<Combatant | null>(null);
  const parametre = parametrant ? parametreDe?.(parametrant) : undefined;
  const ferme = refus != null;
  const options: ParamOption[] = candidates.map((c) => ({
    key: c.id,
    label: c.label,
    // DÉCORATIVE : le candidat EST déjà un bouton (`OptionChooser`), et c'est lui qui porte le geste
    // et le nom — une tuile cliquable de plus y serait un bouton dans un bouton. La RANGÉE
    // (portrait, nom, méta) est rangée par `PanneauParametre`, jamais ici.
    visuel: <CharFrame c={c} variant="identity" size="sm" decoratif />,
    ...(metaDe?.(c) != null ? { meta: metaDe(c) } : {}),
    ...(refusDe?.(c) != null ? { refus: refusDe(c) } : {}),
    onSelect: () => (parametreDe?.(c) ? setParametrant(c) : onAssign(c.id)),
  }));
  const valeurs: ParamOption[] = parametrant && parametre
    ? parametre.valeurs.map((v) => ({
      key: v.key,
      label: v.label,
      ...(v.refus != null ? { refus: v.refus } : {}),
      onSelect: () => onAssign(parametrant.id, v.key),
    }))
    : [];
  return (
    <div className="pr-cases">
      {assigned.map((h) => (
        <Fragment key={h.id}>
          {retirable ? (
            <CharFrame c={h} variant="identity" size="xs" nom={nomRetirer?.(h) ?? `${h.label} — retirer`} onClick={() => onRemove(h.id)} />
          ) : (
            <CharFrame c={h} variant="identity" size="xs" decoratif />
          )}
          {precisionDe?.(h)}
        </Fragment>
      ))}
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
          {parametre ? <PanneauParametre anchor={btnAjout} intitule={parametre.intitule} options={valeurs} onClose={() => setParametrant(null)} /> : null}
        </>
      ) : null}
    </div>
  );
}
