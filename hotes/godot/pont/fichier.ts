/**
 * LE CHOIX D'UNE IMAGE SUR LE DISQUE DE L'AUTEUR (#3508), par la page : la planche d'un calque de référence de l'éditeur
 * de carte (`CONTRAT.md`, section « Éditeur »).
 */

/** Ouvre le choix d'une image PNG, JPEG ou WebP : un `<input type=file>` posé au document le temps du choix, marqué
 *  `data-planche`, que la recette remplit. `rendre` reçoit le contenu de l'image en base64 et son type MIME, ou deux
 *  chaînes vides si l'auteur renonce. */
export function choisirUneImage(rendre: (contenu: string, type: string) => void): void {
  const champ = document.createElement('input');
  champ.type = 'file';
  champ.accept = 'image/png,image/jpeg,image/webp';
  champ.hidden = true;
  champ.dataset.planche = '';
  document.body.append(champ);
  const finir = (contenu: string, type: string) => {
    champ.remove();
    rendre(contenu, type);
  };
  champ.addEventListener('cancel', () => finir('', ''));
  champ.addEventListener('change', () => {
    const fichier = champ.files?.[0];
    if (!fichier) return finir('', '');
    const lecteur = new FileReader();
    lecteur.addEventListener('load', () => finir(String(lecteur.result).split(',')[1], fichier.type));
    lecteur.readAsDataURL(fichier);
  });
  champ.click();
}
