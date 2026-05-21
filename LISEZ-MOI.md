# Guide Alarmes NxStage - Version PWA (telephone)

Cette version est une **PWA (Progressive Web App)** : une application web qui s'installe
sur l'ecran d'accueil d'un iPhone (ou Android) comme une vraie application, et qui
fonctionne hors-ligne une fois ouverte la premiere fois.

## Test sur ce PC (Windows)

1. Double-clic sur **`lancer-serveur.bat`**
2. Ouvrir Edge, Chrome ou Firefox a l'adresse : http://localhost:8000
3. Pour simuler un iPhone : F12 (DevTools) -> icone "Toggle device toolbar"
   (Ctrl+Maj+M dans Chrome/Edge) -> choisir iPhone dans la liste

## Installer sur iPhone (Safari, meme WiFi que le PC)

### Prerequis
- iPhone et PC sur le **meme reseau WiFi**
- PC accessible en local (pare-feu Windows : autoriser Python sur le reseau prive
  si une fenetre apparait au lancement du serveur)

### Etapes
1. Sur le PC : double-clic sur **`lancer-serveur.bat`**
2. Noter l'adresse IPv4 affichee (ex : `http://192.168.1.42:8000`)
3. Sur iPhone : ouvrir **Safari** et taper cette adresse
4. La page se charge -> appuyer sur l'icone **Partager** (carre + fleche vers le haut)
5. Faire defiler -> **Sur l'ecran d'accueil**
6. Confirmer **Ajouter**

L'application apparait sur l'ecran d'accueil avec une icone bleue/rouge. Elle se
lance ensuite sans barre d'adresse, comme une vraie app.

**Important** : la premiere fois, gardez l'iPhone connecte pendant 30 secondes pour
que les fichiers se mettent en cache (service worker). Apres ca, l'app fonctionne
**hors-ligne** sans le PC.

## Permanente / acces depuis n'importe ou : heberger sur GitHub Pages (gratuit)

Si vous voulez l'app accessible **sans avoir besoin de lancer le PC** :

1. Creer un compte gratuit sur github.com
2. Creer un nouveau repository public (ex : `guide-alarmes`)
3. Glisser-deposer tous les fichiers de ce dossier dans le repo (sauf `lancer-serveur.bat`)
4. Settings du repo -> Pages -> Source : `main` branch, dossier `/ (root)`
5. Attendre 1-2 minutes, votre URL apparait : `https://<votre-pseudo>.github.io/guide-alarmes/`
6. Sur l'iPhone : Safari -> cette URL -> Partager -> Sur l'ecran d'accueil

Avantage : l'app est accessible **partout** (4G, autre WiFi), et fonctionne
toujours hors-ligne apres premier chargement.

## Donnees

- Les ~64 alarmes Fresenius sont dans `alarmes.json` (meme contenu que la version PC)
- Vos modifications/ajouts sont stockes **dans le navigateur** (localStorage),
  par appareil (les modifs faites sur l'iPhone ne se synchronisent pas avec le PC)
- Menu (icone `⋮` en bas a droite) : Reinitialiser, Exporter JSON, Importer JSON,
  A propos

## Fichiers

- `index.html` - structure de la page
- `styles.css` - mise en forme mobile-first
- `app.js` - logique JavaScript (filtres, edition, etc.)
- `alarmes.json` - donnees alarmes (FR/EN + causes + procedures)
- `manifest.json` - metadata PWA
- `service-worker.js` - cache hors-ligne
- `icons/` - icones de l'app
- `lancer-serveur.bat` - lancer le serveur de test local

## Limites

- Pas distribuable via App Store (impossible sans Mac et compte developpeur Apple a 99$/an)
- iPhone PWA : pas de notifications push, stockage limite a ~50 Mo par site
  (largement suffisant pour ce guide)
- Si vous changez `alarmes.json`, faites "Reinitialiser donnees Fresenius" dans le
  menu pour recharger la nouvelle version (sinon le localStorage masque le nouveau JSON)
