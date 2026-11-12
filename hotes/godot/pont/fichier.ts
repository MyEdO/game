/**
 * LE CHOIX D'UN FICHIER SUR LE DISQUE DU JOUEUR, par la page : la planche d'un calque de référence de l'éditeur de carte
 * (#3508, `CONTRAT.md`, section « Éditeur »), le fichier d'export d'un héros à importer au roster (#3009, méthode
 * `roster`).
 */

/** Ouvre le choix d'un fichier que `accepte` admet (l'attribut `accept` d'un champ de fichier) : un
 *  `<input type=file>` posé au document le temps du choix, marqué `data-fichier`, que la recette remplit. `rendre`
 *  reçoit le contenu du fichier en base64 et son type MIME, ou deux chaînes vides si le joueur renonce. */
export function choisirUnFichier(accepte: string, rendre: (contenu: string, type: string) => void): void {
  const champ = document.createElement('input');
  champ.type = 'file';
  champ.accept = accepte;
  champ.hidden = true;
  champ.dataset.fichier = '';
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
