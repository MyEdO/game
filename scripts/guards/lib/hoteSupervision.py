import ctypes
import json
import os
import signal
import sys
import time
import uuid


# https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html
# https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html
# https://man7.org/linux/man-pages/man2/wait.2.html
WALL = 0x40000000
interrompu = False


def maintenant():
    return time.time_ns() // 1000000


def interrompre(_signal, _frame):
    global interrompu
    interrompu = True


def prctl(operation, valeur):
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(operation, valeur, 0, 0, 0) != 0:
        code = ctypes.get_errno()
        raise OSError(code, "prctl: " + os.strerror(code))


def lire_json(chemin):
    with open(chemin, encoding="utf-8-sig") as fichier:
        valeur = json.load(fichier)
    if not isinstance(valeur, dict):
        raise RuntimeError("EPROTO objet requis")
    return valeur


def ecrire_json(chemin, valeur):
    temporaire = chemin + "." + uuid.uuid4().hex + ".tmp"
    try:
        with open(temporaire, "x", encoding="utf-8") as fichier:
            json.dump(valeur, fichier, separators=(",", ":"), ensure_ascii=True)
        os.rename(temporaire, chemin)
    finally:
        if os.path.exists(temporaire):
            os.unlink(temporaire)


def entier(objet, cle):
    valeur = objet.get(cle)
    if type(valeur) is not int:
        raise RuntimeError("EPROTO entier " + cle)
    return valeur


def texte(objet, cle):
    valeur = objet.get(cle)
    if not isinstance(valeur, str) or not valeur:
        raise RuntimeError("EPROTO texte " + cle)
    return valeur


class Expiration(Exception):
    pass


class Refus(Exception):
    pass


def enfants_directs():
    pids = set()
    for tache in os.listdir("/proc/self/task"):
        try:
            with open("/proc/self/task/" + tache + "/children", encoding="ascii") as fichier:
                pids.update(int(pid) for pid in fichier.read().split())
        except FileNotFoundError:
            pass
    return pids


class Domaine:
    def __init__(self, dossier, delai):
        self.dossier = dossier
        configuration = lire_json(os.path.join(dossier, "configuration.json"))
        if entier(configuration, "version") != 1 or entier(configuration, "delaiArretMs") != delai or delai < 1:
            raise RuntimeError("EPROTO configuration")
        self.generation = texte(configuration, "generation")
        self.delai = delai
        self.erreurs = []
        self.traites = set()
        self.worker = None
        self.statut_worker = None
        for nom in ("requetes", "reponses"):
            os.makedirs(os.path.join(dossier, nom), exist_ok=True)
        sonde = os.path.join(dossier, "hardlink-" + uuid.uuid4().hex)
        with open(sonde, "x", encoding="ascii") as fichier:
            fichier.write("1")
        try:
            os.link(sonde, sonde + ".lien")
        finally:
            if os.path.exists(sonde + ".lien"):
                os.unlink(sonde + ".lien")
            os.unlink(sonde)

    def recolter(self):
        while True:
            try:
                pid, status = os.waitpid(-1, os.WNOHANG | WALL)
            except ChildProcessError:
                return
            if pid == 0:
                return
            if pid == self.worker:
                self.statut_worker = status

    def requetes(self):
        dossier = os.path.join(self.dossier, "requetes")
        for nom in sorted(os.listdir(dossier)):
            if not nom.endswith(".json") or nom in self.traites:
                continue
            self.traites.add(nom)
            identifiant = nom[:-5]
            reponse = {"version": 1, "generation": self.generation, "id": identifiant}
            try:
                requete = lire_json(os.path.join(dossier, nom))
                if (entier(requete, "version") != 1 or texte(requete, "generation") != self.generation
                        or texte(requete, "id") != identifiant):
                    raise RuntimeError("EPROTO requête")
                if maintenant() >= entier(requete, "echeance"):
                    raise Expiration("EEXPIRATION requête expirée")
                operation = texte(requete, "operation")
                if operation in ("vue", "attribuer"):
                    raise Refus(operation + " non supportée par l’hôte subreaper Linux")
                raise RuntimeError("EPROTO opération")
            except Exception as erreur:
                code = "EXPIRATION" if isinstance(erreur, Expiration) else "ENONSUPPORTE" if isinstance(erreur, Refus) else "ECONTROLE"
                reponse.update(ok=False, error={"code": code, "message": str(erreur)})
                if not isinstance(erreur, (Expiration, Refus)):
                    self.erreurs.append(str(erreur))
            ecrire_json(os.path.join(self.dossier, "reponses", nom), reponse)
            if self.erreurs or os.path.exists(os.path.join(self.dossier, "cloture.json")):
                return

    def cloture(self):
        chemin = os.path.join(self.dossier, "cloture.json")
        if not os.path.exists(chemin):
            temporaire = chemin + "." + uuid.uuid4().hex + ".tmp"
            try:
                with open(temporaire, "x", encoding="utf-8") as fichier:
                    json.dump({"version": 1, "generation": self.generation,
                               "echeance": maintenant() + self.delai}, fichier, separators=(",", ":"))
                try:
                    os.link(temporaire, chemin)
                except FileExistsError:
                    pass
            finally:
                if os.path.exists(temporaire):
                    os.unlink(temporaire)
        valeur = lire_json(chemin)
        if entier(valeur, "version") != 1 or texte(valeur, "generation") != self.generation:
            raise RuntimeError("ECLOTURE incohérente")
        echeance = entier(valeur, "echeance")
        if echeance < 1 or echeance > maintenant() + self.delai + 1000:
            raise RuntimeError("ECLOTURE échéance")
        return echeance

    def terminer(self):
        try:
            echeance = self.cloture()
        except Exception as erreur:
            self.erreurs.append(str(erreur))
            echeance = 0
        zero = False
        while True:
            for pid in enfants_directs():
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            try:
                while os.waitpid(-1, os.WNOHANG | WALL)[0] != 0:
                    pass
            except ChildProcessError:
                zero = maintenant() <= echeance
                break
            if maintenant() >= echeance:
                break
            time.sleep(0.001)
        if not zero:
            self.erreurs.append("ECLOTURE zéro absent dans échéance")
        ecrire_json(os.path.join(self.dossier, "certificat.json"),
                    {"version": 1, "generation": self.generation, "methode": "subreaper-linux",
                     "zero": zero, "echeance": echeance, "erreurs": self.erreurs})
        return 0 if zero and not self.erreurs else 70


def main():
    if len(sys.argv) != 8:
        raise RuntimeError("EPROTO arguments hôte")
    parent = int(sys.argv[1])
    node, worker, adresse, jeton, dossier = sys.argv[2:7]
    delai = int(sys.argv[7])
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, interrompre)
    prctl(36, 1)
    prctl(1, signal.SIGTERM)
    if os.getppid() != parent or interrompu:
        raise RuntimeError("EPARENT parent disparu")
    domaine = Domaine(dossier, delai)
    try:
        if os.path.exists(os.path.join(dossier, "cloture.json")):
            return domaine.terminer()
        hote_pid = os.getpid()
        enfant = os.fork()
        if enfant == 0:
            try:
                prctl(1, signal.SIGKILL)
                if os.getppid() != hote_pid:
                    os._exit(70)
                os.execv(node, [node, worker, adresse, jeton])
            except BaseException:
                os._exit(70)
        domaine.worker = enfant
        while True:
            domaine.recolter()
            if domaine.statut_worker is not None:
                if not os.WIFEXITED(domaine.statut_worker) or os.WEXITSTATUS(domaine.statut_worker) != 0:
                    domaine.erreurs.append("EWORKER statut non nul")
                break
            if (interrompu or os.getppid() != parent or domaine.erreurs
                    or os.path.exists(os.path.join(dossier, "cloture.json"))):
                break
            domaine.requetes()
            time.sleep(0.002)
    except Exception as erreur:
        domaine.erreurs.append(str(erreur))
    return domaine.terminer()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as erreur:
        print("[supervision hôte] " + str(erreur), file=sys.stderr)
        sys.exit(70)
