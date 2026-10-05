import { useEffect, useId, useRef, useState } from 'react';
import { QtyStepper } from './QtyStepper';

/** Ce que la primitive MONTE autour du champ (#1318 E1). */
export type NumberFieldVariant =
  /** Champ + compteur + plage dite — la forme PLEINE (exige `min` et `max`). */
  | 'complet'
  /** Libellé au-dessus + champ seul : une rangée qui n'a pas la place de trois affordances. */
  | 'champ'
  /** Champ SEUL, le libellé étant porté par l'appelant (rangée `.dr`, `.ed-field`, `.hr-row`) — il
   *  devient alors le nom accessible du champ. */
  | 'nu';

/** Moment où la valeur remonte à l'appelant. */
export type NumberFieldCommit =
  /** À la frappe, calée dans les bornes. */
  | 'frappe'
  /** Au geste TERMINAL (Entrée, et la perte de focus si `commitOnBlur`) : la frappe reste locale, et
   *  une saisie hors domaine est REFUSÉE (retour à la dernière valeur commise, `aria-invalid`,
   *  domaine rendu apparent) plutôt que calée en silence. */
  | 'geste';

type NumberFieldCommun = {
  id?: string;
  /** Libellé — affiché en `complet`/`champ`, nom accessible en `nu`. */
  label: string;
  /** Nom accessible quand il doit être plus précis que le libellé affiché (N champs homonymes). */
  ariaLabel?: string;
  min?: number;
  max?: number;
  /** Pas du compteur et de la saisie (défaut 1). */
  step?: number;
  /** Ce qui se compte, au pluriel (« points ») — AFFICHAGE. */
  unit?: string;
  variant?: NumberFieldVariant;
  disabled?: boolean;
  placeholder?: string;
  /** Largeur du champ dans une rangée dense (longueur CSS ou px). */
  width?: number | string;
  // `title` / `ariaLabel` / `describedBy` : attributs GLOBAUX du DOM (infobulle, nom et description
  // accessibles), portés par n'importe quel contrôle — aucune matière d'écran ne passe par ici (une
  // classe d'écran, elle, se déclare au CONTENEUR du site, cf. `.rm-die-pick > label > input`).
  title?: string;
  describedBy?: string;
  /** Invalidité posée par l'APPELANT (règle qui dépasse le champ) : s'ajoute au refus de saisie du
   *  champ ; le message de l'appelant se lie par `describedBy`. */
  invalide?: boolean;
  commit?: NumberFieldCommit;
  /** La perte de focus commet (défaut, `commit: 'geste'`). `false` là où commettre est IRRÉVERSIBLE. */
  commitOnBlur?: boolean;
  /** Poignée de commit exposée à l'hôte : il la déclenche quand son bouton d'action suit la frappe
   *  sans validation. Rend `true` si une valeur a été posée. */
  commitRef?: { current: null | (() => boolean) };
};

type NumberFieldPlein = { vide?: false; value: number; onChange: (n: number) => void };
type NumberFieldVidable = { vide: true; value: number | null | undefined; onChange: (n: number | null) => void };

export type NumberFieldProps = NumberFieldCommun & (NumberFieldPlein | NumberFieldVidable);

/**
 * CHAMP NOMBRE BORNÉ — primitive PARTAGÉE (#1279) : la saisie et le compteur, ensemble, pour poser un
 * nombre dans une plage. Moissonnée de l'étalon de la coquille de cascade (l'étape « quantité »,
 * `CascadeModal`) et composée aussi par les réglages de table des jeux de taverne.
 *
 * TROIS affordances pour UNE grandeur en variante `complet`, et c'est le point : le CHAMP (clavier,
 * saisie directe — d'un bout à l'autre d'un 1..100, cliquer 99 fois n'est pas une affordance), le
 * COMPTEUR (`QtyStepper`, primitive canonique) pour le cran à cran, et la PLAGE DITE (une flèche
 * éteinte sans raison est une affordance morte). Les rangées DENSES (atelier du Codex, registre des
 * règles optionnelles, rangée de marché) n'ont la place que du champ : elles prennent `champ` ou
 * `nu` — une variante de la MÊME primitive, jamais un `<input type="number">` recodé.
 *
 * La borne reste tenue à UN endroit (`cale`), pour tous les gestes, et ne cale que ce qui est BORNÉ
 * (un entier de donnée sans domaine — page de source, modificateur signé — n'en reçoit aucune).
 *
 * STRUCTURE de l'étalon, tenue ici : le `<label>` n'enveloppe QUE son champ (un stepper est fait de
 * boutons — les enfermer dans un label les rend cliquables par le libellé, ce qui n'est pas ce qu'un
 * libellé promet). Le libellé est donc lié au champ par `htmlFor`, et les boutons portent le leur.
 */
export function NumberField(props: NumberFieldProps) {
  const {
    label, ariaLabel, min, max, step = 1, unit, variant = 'complet',
    disabled, placeholder, width, title, describedBy, commit = 'frappe',
    commitOnBlur = true, commitRef, vide, value, invalide,
  } = props;
  const auto = useId();
  const id = props.id ?? auto;
  const domaineId = useId();
  const pas = Math.max(1, Math.floor(step));
  const unite = unit ? ` ${unit}` : '';
  const cale = (n: number): number => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  };
  const emet = (n: number | null) => {
    if (vide) (props.onChange as (n: number | null) => void)(n);
    else (props.onChange as (n: number) => void)(n ?? cale(min ?? 0));
  };
  const courant = value ?? null;

  // Brouillon du commit DIFFÉRÉ : une valeur qui ne remonte qu'au geste terminal reste locale entre
  // deux frappes — un commit par frappe rendrait tout nombre à deux chiffres insaisissable là où
  // poser la valeur DÉCLENCHE (le « 5 » de « 50 » résoudrait le Test, recette #1117).
  const [brouillon, setBrouillon] = useState(courant != null ? String(courant) : '');
  const [refusee, setRefusee] = useState(false);
  const commis = useRef<number | null>(courant);
  // Resynchronisation sur une valeur EXTERNE nouvelle (l'hôte passe d'une fiche à une entrée neuve,
  // la même instance restant montée) : la valeur précédente est tenue en ÉTAT, jamais dans la seule
  // réf — sous `StrictMode` le rendu est double, et une réf mutée au premier passage fait sauter la
  // resynchronisation au second (le brouillon garderait la valeur de la fiche d'avant).
  const [precedente, setPrecedente] = useState<number | null>(courant);
  if (commit === 'geste' && precedente !== courant) {
    setPrecedente(courant);
    commis.current = courant;
    setBrouillon(courant != null ? String(courant) : '');
  }
  const poser = (): boolean => {
    const n = Number(brouillon);
    if (brouillon !== '' && Number.isInteger(n) && (min == null || n >= min) && (max == null || n <= max)) {
      if (n !== commis.current) {
        commis.current = n;
        setBrouillon(String(n));
        emet(n);
      }
      setRefusee(false);
      return true;
    }
    setRefusee(brouillon !== ''); // champ VIDE = pas de saisie à refuser
    setBrouillon(commis.current != null ? String(commis.current) : '');
    return false;
  };
  // La poignée est tenue au RENDU tant que le champ est monté : le clic sur le bouton d'action de
  // l'hôte peut suivre la frappe dans le même tick.
  const mienne = useRef<null | (() => boolean)>(null);
  if (commit === 'geste' && commitRef) { commitRef.current = poser; mienne.current = poser; }
  // … et RELÂCHÉE au démontage : la réf de l'hôte SURVIT au champ (une coquille de jet reste montée
  // d'une étape à l'autre, `RollShell.hoistDieCommit`). Une poignée orpheline répond `true` à la garde
  // `withPickedDie` et avale le clic du CTA suivant. On ne relâche que SA poignée : un autre champ
  // monté sur la même réf l'a déjà reprise, et sa prise reste la bonne.
  // Le SETUP la REPREND : sous StrictMode (le montage réel de l'app) React joue un cycle
  // setup→cleanup→setup jeté, et un relâchement seul laisserait l'hôte sans poignée pour toute la vie
  // du champ — le CTA hissé redeviendrait muet.
  useEffect(() => {
    if (commit === 'geste' && commitRef) commitRef.current = mienne.current;
    return () => { if (commitRef && commitRef.current === mienne.current) commitRef.current = null; };
  }, [commit, commitRef]);
  const domaineDit = refusee && min != null && max != null;

  const saisie = (
    <input
      id={id}
      type="number"
      aria-label={variant === 'nu' ? (ariaLabel ?? label) : ariaLabel}
      min={min}
      max={max}
      step={pas}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      style={width != null ? { width } : undefined}
      aria-invalid={refusee || invalide || undefined}
      aria-describedby={domaineDit ? domaineId : describedBy}
      value={commit === 'geste' ? brouillon : (courant ?? '')}
      onChange={(e) => {
        if (commit === 'geste') { setRefusee(false); setBrouillon(e.target.value); return; }
        if (e.target.value === '') { emet(null); return; }
        emet(cale(Number(e.target.value) || 0));
      }}
      onKeyDown={commit === 'geste' ? (e) => {
        if (e.key !== 'Enter') return;
        // Entrée est CONSOMMÉE par le champ : elle pose la valeur, et rien d'autre. Sans
        // `stopPropagation`, l'écouteur clavier de `Modal` la reçoit à son tour et clique le bouton
        // primaire — la valeur posée partirait avec la validation de la boîte.
        e.preventDefault();
        e.stopPropagation();
        poser();
      } : undefined}
      // Le blur ne COMMET pas quand `commitOnBlur: false` — et il n'EFFACE rien non plus : cliquer le
      // bouton d'action blur d'abord, un brouillon effacé à cet instant part avec la saisie.
      onBlur={commit === 'geste' && commitOnBlur ? poser : undefined}
    />
  );
  // Le DOMAINE, rendu apparent quand la saisie est refusée — un fait (les bornes), pas une phrase
  // d'aide rédigée.
  const domaine = domaineDit
    ? <span id={domaineId} className="hint" role="status">{min}–{max}</span>
    : null;

  if (variant === 'nu') return <>{saisie}{domaine}</>;

  const champ = (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {saisie}
      {domaine}
    </label>
  );
  if (variant === 'champ') return champ;

  const bas = min ?? 0;
  const haut = max ?? bas;
  const nombre = courant ?? bas;
  return (
    <div className="prow-act">
      {champ}
      <QtyStepper
        center={<>{nombre}{unite}</>}
        onDec={() => emet(cale(nombre - pas))}
        onInc={() => emet(cale(nombre + pas))}
        decDisabled={nombre <= bas}
        incDisabled={nombre >= haut}
        decLabel={`Retirer ${pas}`}
        incLabel={`Ajouter ${pas}`}
      />
      <p className="hint">De {bas} à {haut}{unite}.</p>
    </div>
  );
}
