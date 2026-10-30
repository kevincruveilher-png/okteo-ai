# Recette v72 — résultats et contrôles de livraison

## Exécuté dans l'environnement de développement

- `npm ci` : réussi (lockfile conservé, ajout de `fake-indexeddb` pour les tests du coffre).
- `node scripts/syntax.mjs` : syntaxe des modules existants + `src/web` et `server` vérifiée.
- `npm run test:web` : 9 scénarios réussis (Node 24, SQLite réel en mémoire avec adaptateur D1, Web Crypto, faux IndexedDB et fournisseur simulé) :
  1. Hashs salés, vérification et refus d'un mauvais mot de passe.
  2. Refus sans binding DB ; pages et API protégées sans session.
  3. Bootstrap Kevin, changement obligatoire, CSRF, déconnexion, absence de secret fournisseur dans la session.
  4. Trois admins maximum, refus opérateur, désactivation et révocation des sessions.
  5. Versions communes, conflit de publication, refus de champ plan, propositions.
  6. Deux appels concurrents avec budget pour un seul : un seul appel fournisseur ; coût calculé ; conservation d'une réservation incertaine.
  7. Rejet de format futur et d'URL de ressource arbitraire ; import v1 ; identifiant de révision heure de Paris ; diff d'un élément.
  8. Chiffrement réel AES-GCM du secours et d'un PDF ; absence de texte clair en stockage ; reprise du compte propriétaire ; autre compte incapable de lire/déchiffrer.
  9. Changement d'identité de cookie détecté ; droit IA désactivé refusé.
- Suites métier hors navigateur : VMC/comparaison 15 ; équipements/détecteurs 13 ; lecture IA 12 ; bibliothèque symboles 14 ; bibliothèque règles ; murs/relevé 42 ; câblage 86 ; chantiers 176. Réussies.
- `npm run build:web` : compilation production réussie, worker serveur autonome généré, contrôle automatique d'absence de `/src/` dans le HTML et présence du worker PDF.js. Les avertissements Vite sur des modules importés statiquement et dynamiquement sont non bloquants.
- GET réel de https://okteo-ai.pages.dev/ : les deux entrées `/src/*.js` sont encore servies sur le site actuel ; erreur de publication des sources confirmée.

## Non exécuté / bloqué

`npm run check` a été lancé ; il s'arrête à la suite MAILLARD qui requiert Chromium. Le navigateur Playwright attendu n'est pas installé. Le téléchargement renvoie une archive invalide. Le Chromium système échoue au démarrage (`socket() failed: Operation not permitted`). Le navigateur piloté de l'environnement échoue aussi avant ouverture (sessions sur système de fichiers en lecture seule). **Ni MAILLARD navigateur, ni smoke, ni inspection visuelle de l'interface v72 ne sont validés ici.**

Les tests de serveur emploient SQLite avec un adaptateur D1 ; ils ne prouvent pas les limites de CPU/mémoire de Workers, la configuration D1 distante ni le comportement complet d'Edge. Le coffre est testé avec Web Crypto réel et faux IndexedDB ; cela ne remplace pas un test de persistance Edge.

Aucune vraie clé Claude n'a été utilisée, aucun coût IA n'a été engagé. Aucun déploiement Cloudflare de cette branche ni modification des réglages du compte n'a été effectué.

## Recette obligatoire sur preview avant fusion vers main

1. **Déploiement** : appliquer `docs/deploiement-web-v72.md` avec D1 Preview séparé ; vérifier que HTML, worker PDF et assets proviennent de `dist`. Visite anonyme : redirection connexion, API 401. DB absent : 503, jamais accès public implicite.
2. **Comptes** : bootstrap Kevin, mot de passe obligatoire, création de deux admins et de deux opérateurs ; quatrième admin refusé. Deux postes distincts simultanés. Opérateur : API admin 403 même en requête manuelle. Désactivation et reset : anciennes sessions refusées. Expiration : travail ouvert exportable.
3. **PDF réel** : PDF de chantier non sensible ≤30 pages, vignettes, choix de page, mise à l'échelle, worker sans 404 ni import nu. Ajouter un deuxième niveau. Tester PDF protégé/corrompu, >50 Mo, >30 pages. L'erreur doit rester compréhensible.
4. **Secours** : modifier, attendre la date d'enregistrement chiffré, fermer/reprendre, comparer le dessin et les fonds. Déconnexion puis autre opérateur sur le même profil : aucune donnée visible/déchiffrable. Deuxième onglet du même compte : bloqué avant édition. Saturation du stockage : erreur visible et export proposé. Écarter/nettoyer auparavant les anciens secours non chiffrés après export.
5. **Claude** : tester un petit appel, inspecter DevTools (aucune clé entreprise). Contrôle du modèle réel, tokens et coûts. Limite globale puis individuelle à zéro. Deux appels concurrents avec crédit pour un seul. Panne et timeout : dessin/export toujours disponibles ; réserve incertaine conservée. Collage d'une analyse : aucun appel payant.
6. **Exports** : export intermédiaire vers dossier local ; finalisation avec anomalies et commentaire ; deux dossiers séparés, aucun ZIP, PDF source présent. Copie vers second poste, importer le dossier puis modifier : même dessin, sources, paramètres, journal et filiation. Altérer `chantier.okteo` : contrôle d'intégrité en échec. Import d'une révision ancienne connue : avertissement. Import v1 : avertissement de règles/historique puis reprise contrôlée.
7. **Rapport Thibaut** : comparer la trace des règles avec l'onglet Étude, les différences avec les corrections manuelles effectuées et les anomalies avec le contrôle ; vérifier auteur et horodatages. Tester plusieurs niveaux et analyses collées. Aucun dossier rapport envoyé au serveur.
8. **Bibliothèque** : publication admin, historique, restauration ; opérateur propose une correction, admin traite ; aucun plan dans ces formulaires. Publication depuis deux sessions : deuxième parent périmé refusé. Chantier déjà ouvert/importé conserve sa référence ; adoption explicite journalisée.
9. **Coupure** : attendre « ressources hors ligne prêtes », couper le réseau ; dessiner, modifier, produire un export et un PDF sans avoir préalablement ouvert le module d'impression. Ne pas recharger : le premier démarrage hors ligne n'est pas demandé. Rétablir la connexion.
10. **Mise à jour** : déployer une preview suivante en laissant un chantier ouvert ; notification sans perte ni rechargement imposé ; exporter, enregistrer le secours, recharger explicitement. Vérifier la compatibilité du dossier précédent.
11. **SharePoint** : exporter vers un dossier Windows synchronisé OneDrive ; attendre l'icône de synchronisation terminée ; importer depuis l'autre PC. Ne pas faire la recette sur des dossiers de production actifs.
12. **Absence de stockage métier** : inspecter schéma/contenu D1 et logs Workers ; ni PDF, ni corps d'analyse, ni dessin, ni rapport. Ne pas activer de journalisation des corps de requête dans un proxy ou une passerelle.

## Limites connues à conserver dans la transmission

- La recette navigateur et Cloudflare final est nécessaire avant déploiement entreprise ; cette branche n'est pas annoncée comme opérationnelle en production.
- Aucun registre central des chantiers/révisions ; l'avertissement d'ancien import est local au compte/navigateur.
- Le coffre protège les données nouvelles, pas les anciens secours v71 en clair ni un poste laissé connecté.
- Bibliothèque : paramètres et descriptions sont versionnés ; les changements du moteur JS demandent une MAJ logicielle, pas une modification de texte de règle.
- Journal de fichier portable modifiable, non signé et non infalsifiable ; changements antérieurs à v72 absents.
- Les différences IA/BE sont structurelles, pas une attribution automatique des erreurs métier.
- Coûts calculés/réservés distincts de la facture fournisseur ; les appels incertains nécessitent vérification.
- Allowlist IP, récupération e-mail et intégration SharePoint directe non implémentées conformément aux décisions.
