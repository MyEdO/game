import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { NumberField } from './NumberField';
import { RefField, type RefFieldCfgUnique } from './compendium/RefField';
import { sourceRefLabel } from '../data';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';

/** Ce que le champ édite : une `SourceRef`, et les clés que son porteur y ajoute (`quote` d'un
 *  `SecondaryRef`), qui traversent l'édition intactes et à leur place. */
type Porteur = { book?: string; page?: number; note?: string };

/** Saisie en cours, tenue par le champ : elle survit à une réf incomplète, qui n'est jamais émise. */
type Brouillon = { book: string; page: number | null; note: string };

type Commun<T extends Porteur> = {
  /** IDENTITÉ de ce qui est édité (entité + chemin du champ) : quand elle change, le champ repart de
   *  `value` — le brouillon d'un porteur ne s'affiche ni ne s'émet jamais sur un autre. */
  identite: string;
  /** Libellé visible du champ ; complète les noms accessibles quand `sujet` manque. */
  label: string;
  /** Complément des noms accessibles (« du stade 2 » → « Page de la source du stade 2 »). */
  sujet?: string;
  value: T | undefined;
};
/** Un brouillon incomplet n'émet rien : la source retenue reste la précédente. `facultative` : un
 *  brouillon VIDE (livre, page et note vides) émet `undefined`. */
export type SourceRefFieldProps<T extends Porteur> = Commun<T> & (
  | { facultative: true; onChange: (v: (T & SourceRef) | undefined) => void }
  | { facultative?: false; onChange: (v: T & SourceRef) => void }
);

type Signaler = (cle: string, enCours: boolean) => void;

/** Saisies EN COURS (tapées, que l'enregistrement ne poserait pas) d'un sous-arbre de champs. */
const SaisiesEnCours = createContext<Signaler | null>(null);

/** Côté porteur d'un geste d'enregistrement : `enCours` tant qu'un champ monté sous
 *  `SuiviDesSaisies` garde une saisie non enregistrée. */
export function useSuiviDesSaisies(): { enCours: boolean; signaler: Signaler } {
  const [cles, setCles] = useState<ReadonlySet<string>>(() => new Set());
  const signaler = useCallback<Signaler>((cle, enCours) => setCles((avant) => {
    if (avant.has(cle) === enCours) return avant;
    const apres = new Set(avant);
    if (enCours) apres.add(cle);
    else apres.delete(cle);
    return apres;
  }), []);
  return { enCours: cles.size > 0, signaler };
}

export function SuiviDesSaisies({ signaler, children }: { signaler: Signaler; children: ReactNode }) {
  return <SaisiesEnCours.Provider value={signaler}>{children}</SaisiesEnCours.Provider>;
}

/** Côté champ : signale sa saisie non enregistrée au porteur qui en suit, jusqu'au démontage. */
export function useSaisieEnCours(enCours: boolean): void {
  const signaler = useContext(SaisiesEnCours);
  const cle = useId();
  useEffect(() => {
    if (!signaler || !enCours) return undefined;
    signaler(cle, true);
    return () => signaler(cle, false);
  }, [signaler, cle, enCours]);
}

const LIVRES: RefFieldCfgUnique = { ds: 'books', single: true };

const versBrouillon = (value: Porteur | undefined): Brouillon =>
  ({ book: value?.book ?? '', page: value?.page ?? null, note: value?.note ?? '' });

const memeBrouillon = (a: Brouillon, b: Brouillon): boolean => a.book === b.book && a.page === b.page && a.note === b.note;

const folio = (page: number | null): boolean => page != null && Number.isInteger(page) && page >= 1;

/** Une réf est COMPLÈTE quand elle nomme un livre et un folio imprimé. */
const complete = (b: Brouillon): boolean => b.book !== '' && folio(b.page);

const vide = (b: Brouillon): boolean => b.book === '' && b.page == null && b.note === '';

/** La réf émise : les clés du porteur gardent leur place, `note` n'existe que non vide. */
function poserSourceRef<T extends Porteur>(value: T | undefined, b: Brouillon): T & SourceRef {
  const ref: Porteur = { ...value, book: b.book, page: b.page ?? undefined, note: b.note };
  if (!ref.note) delete ref.note;
  return ref as T & SourceRef;
}

const decrire = (value: Porteur | undefined): string =>
  (value?.book && value.page != null ? `« ${sourceRefLabel({ book: value.book, page: value.page })}${value.note ? `, ${value.note}` : ''} »` : 'sans source');

export function SourceRefField<T extends Porteur>(props: SourceRefFieldProps<T>) {
  const { identite, label, sujet, value } = props;
  const nom = (champ: string) => (sujet ? `${champ} de la source ${sujet}` : `${champ} — ${label}`);
  const [brouillon, setBrouillon] = useState<Brouillon>(() => versBrouillon(value));
  // Resynchronisation sur un AUTRE porteur, ou sur une RÉF externe nouvelle ; la réf que le champ
  // vient d'émettre (ou `undefined` d'un brouillon facultatif vide) ne l'écrase pas, ni une clé
  // du porteur (`quote`) éditée à côté.
  const [precedente, setPrecedente] = useState({ identite, value });
  const [emise, setEmise] = useState<T | undefined>(value);
  if (precedente.identite !== identite || precedente.value !== value) {
    setPrecedente({ identite, value });
    if (precedente.identite !== identite || !memeBrouillon(versBrouillon(value), versBrouillon(emise))) {
      setBrouillon(versBrouillon(value));
      setEmise(value);
    }
  }
  const poser = (patch: Partial<Brouillon>) => {
    const suivant = { ...brouillon, ...patch };
    setBrouillon(suivant);
    if (complete(suivant)) {
      const ref = poserSourceRef(value, suivant);
      setEmise(ref);
      props.onChange(ref);
    } else if (props.facultative && vide(suivant)) {
      setEmise(undefined);
      props.onChange(undefined);
    }
  };
  const incomplet = !complete(brouillon) && !(props.facultative && vide(brouillon));
  const enCours = incomplet && !memeBrouillon(brouillon, versBrouillon(value));
  useSaisieEnCours(enCours);
  const messageId = useId();
  const livreManquant = incomplet && brouillon.book === '';
  const pageManquante = incomplet && !folio(brouillon.page);
  return (
    <div className="ed-field">
      <span>{label}</span>
      <RefField
        cfg={LIVRES} label="Livre" ariaLabel={nom('Livre')} nullable={props.facultative} value={brouillon.book}
        invalide={livreManquant} describedBy={livreManquant ? messageId : undefined}
        // Facultative, « aucun » au livre = SANS source : le brouillon se vide en entier.
        onChange={(v) => {
          const book = typeof v === 'string' ? v : '';
          poser(props.facultative && book === '' ? { book, page: null, note: '' } : { book });
        }}
      />
      <label className="ed-subfield">
        Page
        <NumberField variant="nu" label={nom('Page')} vide commit="geste" value={brouillon.page} onChange={(page) => poser({ page })} invalide={pageManquante} describedBy={pageManquante ? messageId : undefined} />
      </label>
      <label className="ed-subfield">
        Note
        <input aria-label={nom('Note')} placeholder="facultatif" value={brouillon.note} onChange={(e) => poser({ note: e.target.value })} />
      </label>
      {incomplet && (
        <span id={messageId} className="hint" role="status">
          {'Source incomplète : livre et page (≥ 1) requis.'}
          {enCours && ` Cette saisie n'est pas retenue ; la source retenue reste ${decrire(value)}.`}
        </span>
      )}
    </div>
  );
}
