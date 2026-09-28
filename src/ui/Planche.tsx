import { useLayoutEffect, useRef, type ReactNode, type UIEvent } from 'react';
import { Modal } from './Modal';

/**
 * PLANCHE — lecteur passif en deux colonnes (fiche de personnage, feuille de navire) : `Modal`
 * `taille="planche"` sous voile de référence, croix en tête ; à gauche la colonne `aside` (présence
 * permanente, sous le nom de ce qu'elle montre, que la planche pose en tête de colonne ; en tête de
 * planche avec la bande de groupe : #1829), à droite les onglets `tabs` au-dessus du corps d'onglet `children`. Défileurs
 * (`styles/planche.css`) : au-delà de 700px, un par colonne (l'aside s'il dépasse, le corps d'onglet) ;
 * en dessous, colonnes empilées, la planche entière et elle seule. La `memoire` de défilement par
 * onglet est une seule grandeur à toute largeur : le décalage DANS le corps d'onglet, compté depuis
 * la barre d'onglets. En dessous de 700px, la planche se restaure à la barre plus ce décalage.
 */
export function Planche({
  nom,
  kind,
  gangrene,
  onClose,
  aside,
  tabs,
  memoire,
  children,
}: {
  /** Nom de ce qu'elle montre : nom du dialogue, et titre visible (`.planche-nom`) en tête de
   *  la colonne `aside`. */
  nom: string;
  /** Nom de la couche de congédiement (`dismissStack`). */
  kind: string;
  /** Gangrène du cadre (#492), transmise à `Modal`. */
  gangrene?: 'ronge' | 'seuil';
  onClose: () => void;
  /** Colonne de gauche, sous le nom : ce qui reste à l'écran quel que soit l'onglet. */
  aside: ReactNode;
  /** Barre d'onglets (`<Tabs>`), absente pour une planche à un seul corps. */
  tabs?: ReactNode;
  /** Mémoire de défilement de l'onglet `cle`, en décalage dans le corps d'onglet : `lire` à
   *  l'ouverture et à chaque changement d'onglet, `retenir` à chaque défilement. */
  memoire?: { cle: string; lire: () => number; retenir: (top: number) => void };
  children: ReactNode;
}) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const corpsRef = useRef<HTMLDivElement>(null);
  const memoireRef = useRef(memoire);
  memoireRef.current = memoire;
  const cleVue = useRef<string>();
  /** Position de la barre d'onglets dans la planche défilante (haut de la colonne principale). */
  const barre = () => {
    const l = layoutRef.current, m = mainRef.current;
    return l && m ? m.getBoundingClientRect().top - l.getBoundingClientRect().top + l.scrollTop : 0;
  };
  useLayoutEffect(() => {
    const m = memoireRef.current;
    if (!m) return;
    const decalage = m.lire();
    const changement = cleVue.current !== undefined && cleVue.current !== m.cle;
    cleVue.current = m.cle;
    if (corpsRef.current) corpsRef.current.scrollTop = decalage;
    if (layoutRef.current && (changement || decalage > 0)) layoutRef.current.scrollTop = barre() + decalage;
  }, [memoire?.cle]);
  const retenirPlanche = (e: UIEvent<HTMLDivElement>) =>
    memoireRef.current?.retenir(Math.max(0, e.currentTarget.scrollTop - barre()));
  const retenirCorps = (e: UIEvent<HTMLDivElement>) => memoireRef.current?.retenir(e.currentTarget.scrollTop);
  return (
    <Modal label={nom} kind={kind} voile="reference" taille="planche" gangrene={gangrene} onClose={onClose} croix backdropClose>
      <div className="sheet-layout" ref={layoutRef} onScroll={retenirPlanche}>
        <aside className="sheet-aside"><h3 className="planche-nom">{nom}</h3>{aside}</aside>
        <div className="sheet-main" ref={mainRef}>
          {tabs}
          <div className="sheet-tabbody" ref={corpsRef} onScroll={retenirCorps}>{children}</div>
        </div>
      </div>
    </Modal>
  );
}
