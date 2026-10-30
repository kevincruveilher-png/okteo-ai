# Oktéo AI v72 — déploiement entreprise / transmission

## État de livraison (30 octobre 2026)

Branche `feat/web-entreprise-v72`, basée sur `68c146f` (v71). La demande « go and push » autorise les travaux et leur envoi. La production n'est pas basculée tant que D1, les secrets et la recette Edge ne sont pas prêts. Aucun secret réel utilisé ni ajouté au dépôt.

**Constat vérifié sur https://okteo-ai.pages.dev/** : le HTML contient encore `<script type="module" src="/src/app.js">` et `/src/ext/main.js`. Le site sert les sources, ce qui explique l'import nu `pdfjs-dist` non résolu. Le type Pages est corroboré par l'URL ; les paramètres du tableau de bord n'ont pas pu être consultés. Aucun réglage distant n'a été changé.

## Configuration Cloudflare Pages exacte à appliquer

Dans **Workers & Pages → okteo-ai → Settings / Builds & deployments** (le libellé peut varier) :

- dépôt : `kevincruveilher-png/okteo-ai` ; préparer d'abord un **déploiement de prévisualisation** de `feat/web-entreprise-v72` ; production : `main` seulement après recette/fusion ;
- racine du projet : racine du dépôt (laisser vide si l'interface l'autorise) ;
- framework : Vite ou aucun préréglage ;
- commande de compilation : **`npm run build:web`** ; l'installation utilise `npm ci` et le lockfile ;
- dossier de sortie : **`dist`**, jamais `/`, `src` ou le dépôt complet ;
- environnement de compilation : `NODE_VERSION=22` ; aucun secret IA dans les variables préfixées `VITE_` ;
- mode serveur : **Pages Advanced mode** grâce à `dist/_worker.js` généré. Ne pas créer en parallèle des Functions qui dupliquent le routage ;
- `_routes.json` couvre `/*` : les pages, le worker PDF et les API nécessitent une session ; seuls `/login`, `/login.html`, `/login.js` sont publics ;
- l'exécution doit pouvoir utiliser Web Crypto, D1 et `AbortSignal.timeout`. Utiliser une date de compatibilité Workers récente testée (par exemple `2026-10-30`).

### Base D1 (aucun plan ni rapport)

1. Créer une base D1, par exemple `okteo-accounts`.
2. Appliquer **une fois** `migrations/0001_enterprise.sql` sur la base vide. Depuis un poste autorisé :
   ```sh
   npx wrangler d1 execute okteo-accounts --remote --file=migrations/0001_enterprise.sql
   ```
3. Dans les bindings Pages, ajouter **D1 / nom `DB`** pointant vers cette base, puis redéployer.
4. Utiliser une base **distincte en Preview**. Ne jamais tester des comptes, plafonds ou propositions sur la base de production.
5. Ne pas exécuter ce SQL à nouveau sur la même base : ce n'est pas un script de remise à zéro.

Tables : comptes (hash du mot de passe et clé du coffre personnel), sessions hachées, compteurs de tentatives, configuration, consommation/réservations, versions communes, propositions, journal des actions administratives. Aucun bucket R2, upload de plan, PDF, image de chantier, dessin ou rapport côté serveur. Les images de symboles BE de la bibliothèque commune sont de petites ressources de référence ; ne pas y déposer de plans.

### Secrets Cloudflare (valeurs jamais dans GitHub ni dans la conversation)

| Nom | Usage |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Claude de l'entreprise, ajoutée exclusivement par le Worker aux appels Anthropic |
| `BOOTSTRAP_PASSWORD` | Mot de passe provisoire aléatoire de 12 caractères minimum pour créer `KevinCruveilher`, seulement si la table des comptes est vide |

Configurer dans **Variables and Secrets**, avec le type secret et le bon environnement. Le premier accès crée Kevin ; son mot de passe doit être changé avant ouverture de l'application. Supprimer ensuite le secret `BOOTSTRAP_PASSWORD`. Il ne réinitialise jamais un compte existant. Aucun autre administrateur n'est inventé. Kevin crée les opérateurs et jusqu'à deux autres administrateurs. Les comptes administrateurs désactivés comptent encore dans la limite de trois ; rétrograder un ancien compte avant d'en promouvoir un autre si nécessaire.

Pas d'inscription publique, pas de récupération par e-mail. Les administrateurs peuvent attribuer un mot de passe temporaire ; sessions de la cible révoquées, changement obligatoire. Une réinitialisation conserve la clé du coffre de la cible : le secours reste déchiffrable par son compte. La perte de tous les accès administrateurs exige l'intervention technique du propriétaire Cloudflare (pas de porte dérobée utilisateur).

### Fonctionnement entreprise

- Cookie HttpOnly, Secure, SameSite=Strict ; session de huit heures, contrôle de l'état actif et des droits à chaque requête ; contrôle d'origine des mutations.
- Mots de passe PBKDF2-SHA256, sel aléatoire, 100 000 itérations (limite portable Web Crypto Workers). Mesurer le CPU de connexion sur le plan Cloudflare choisi ; ne pas supposer que l'offre gratuite convient à la production.
- Vingt tentatives par tranche de quinze minutes, par identifiant et IP hachés ; compteurs anciens purgés aux connexions. Ce contrôle simple n'est pas un WAF.
- Une seule édition du coffre d'un compte par profil navigateur à la fois (Web Locks) pour éviter l'écrasement par un second onglet. Des comptes sur des postes/profils différents travaillent simultanément. Un changement de compte dans un même profil ferme les autres espaces après écriture du secours.
- En cas d'expiration, le dessin déjà ouvert et l'export restent utilisables ; les services refusent les nouvelles actions. L'utilisateur sauvegarde/exporte puis se reconnecte.
- **L'allowlist d'IP est reportée**, conformément au périmètre validé. Ne pas confondre rate limiting de connexion et filtrage d'IP.

## Budget Claude

Plafond initial **50 USD/mois**, utilisateur **25 USD/mois**, deux appels simultanés. Réglables par admin, unités affichées en USD, hors taxes et hébergement. Mois civil Europe/Paris. Modèle par défaut `claude-sonnet-5-5` ; tarif configuré entrée 2 USD / million, sortie 10 USD / million, confirmé sur la documentation Anthropic le 30/10/2026 : https://platform.claude.com/docs/en/about-claude/pricing . Vérifier l'accès effectif au modèle avec la vraie clé avant recette IA.

Hypothèse, **pas mesure** : 30 chantiers/semaine × 52/12 ≈ 130/mois. Une analyse à 30 000 tokens d'entrée + 10 000 de sortie ≈ 0,16 USD, soit 20,80 USD/mois. Trois passages de ce volume ≈ 62,40 USD/mois. Un plafond de 50 USD est donc un point de départ ajustable et peut limiter les reprises intensives. Les images et les assistants consomment aussi des tokens.

Le Worker force le modèle configuré et n'accepte pas de clé client. Comptage préalable `/messages/count_tokens`, puis réservation atomique D1 (coût d'entrée compté + marge 10 % + sortie maximale). Un INSERT conditionnel protège simultanément le plafond global, celui du compte et la concurrence. Pas de répétition automatique d'un appel incertain.

Après réponse, coût calculé sur `usage.input_tokens`/`output_tokens`, au tarif mémorisé pour cet appel. **La facture Anthropic fait foi** ; le coût calculé n'est pas une facture récupérée. Pas de cache de prompts ni de tools payants activés. Un timeout conserve sa réservation ; un `pending` abandonné depuis plus de dix minutes devient `uncertain` au prochain appel, conserve son coût réservé et libère la place de concurrence. Les erreurs HTTP explicites du fournisseur sont marquées rejetées. Une réconciliation de réservations incertaines exige une vérification technique avec Anthropic ; pas de bouton qui libère aveuglément du crédit.

Les seuils 80 % sont signalés dans le bandeau et dans l'administration. Pas d'analyse réelle payante effectuée pendant le développement. Les règles de conservation d'Anthropic sont distinctes de l'absence de stockage métier chez Cloudflare ; elles restent à vérifier avec le contrat de l'entreprise.

## Secours et migration du navigateur

`src/web/vault.js` remplace l'interface localStorage de l'application par une mémoire de session. L'état, le journal et les ressources PDF/image sont persistés dans IndexedDB `okteo-secure-v1`, chiffrés AES-GCM avec IV aléatoire. La clé propre au compte n'est pas persistée dans le navigateur. Elle est fournie à son compte authentifié puis importée comme CryptoKey non exportable ; supprimée de l'objet session JS. Les clés de coffre existent dans la base d'identité serveur, **aucun fichier métier n'y est envoyé**.

Écriture différée 200 ms après les changements de métadonnées, fichiers écrits dès import, signalement des échecs, dernière date/heure, reprise proposée. La fermeture brutale peut perdre la dernière fraction de seconde non écrite ; export de référence indispensable. En cas de stockage plein, ne pas quitter avant export. La suppression d'un chantier (après ouverture d'un autre) supprime données, PDF/images et journal associés. Aucun effacement silencieux après export.

**Anciens secours v71** : ils étaient en clair dans localStorage/IndexedDB `okteo`. Ils ne sont ni attribués automatiquement à Kevin ni détruits. Avant bascule, exporter les anciens chantiers en `.okteo`, puis les importer sur les comptes concernés. Après vérification des exports, effacer les anciennes données de site via Edge avant la première utilisation partagée. Leur présence historique n'est pas rendue confidentielle rétroactivement par le nouveau coffre. Les clés API personnelles de l'ancien prototype doivent être supprimées du navigateur (et révoquées si besoin) ; ne pas les recopier dans les dossiers.

## Échange sans ZIP

Page **Chantiers** : « Exporter le dossier », « Finaliser et exporter », « Ouvrir un dossier Oktéo », « Journal du chantier ». Edge PC récent recommandé.

```text
NOM_R003_2026-10-30_14h35m22_abcdefgh/
  Chantier/
    chantier.okteo
    integrite.json
    Source_rdc.pdf (si PDF disponible ; autres niveaux selon le dossier)
  Rapport_Thibaut/ (uniquement finalisation)
    Resume_Thibaut.txt
    rapport.json
```

`chantier.okteo` est un **JSON autonome, pas un ZIP**, contenant PDF/images, dessin multi-niveaux, paramètres, versions, résultats IA et historique. Les PDF sont aussi extraits à côté pour consultation. `integrite.json` contrôle SHA-256 au réimport du dossier. Un marqueur `EXPORT_INCOMPLET.txt` reste à la racine si une écriture échoue. Le hash détecte une copie altérée, ce n'est pas une signature cryptographique d'auteur.

Révisions avec compteur, heure de Paris, UUID de projet, UUID de révision et parent. Copie divergente conservée séparément ; avertissement seulement si ce même compte/navigateur connaît une révision plus récente ou divergente. Les anciens fichiers v1 restent importables, avec absence d'historique antérieur explicitée. Format inconnu/futur refusé ; application plus récente refusée. Un ancien dossier sans version de règles est signalé avant import entreprise.

Le journal contient auteur du compte, horodatage UTC, différence avant/après par chemin d'élément, changements d'identité, imports, copies, exports et changement explicite de référence. Les opérations rapprochées à l'intérieur d'un batch sont une modification groupée. Les analyses reçues sont conservées ; l'analyse acceptée initiale et le dessin obtenu servent de référence à la comparaison. Le journal dans un fichier modifiable n'est pas un registre infalsifiable. Les transformations historiques précédant v72 ne peuvent pas être reconstituées.

Finalisation : liste des anomalies de dossier et de contrôle existantes, commentaire BE facultatif, export des deux dossiers. Rapport structuré : trace du moteur d'étude (règles, décisions, blocages), version exacte des paramètres/bibliothèque, données initiales, différences structurelles, dessin final, journal. Le résumé n'affirme pas une conformité normative. Il n'y a pas d'apprentissage ni de modification automatique des règles.

**SharePoint** : synchroniser le dossier d'entreprise avec OneDrive ; sélectionner ce dossier visible dans l'Explorateur lors de l'export. OneDrive assure la synchronisation, Oktéo ne se connecte pas à Microsoft 365. Attendre la fin de synchronisation avant import sur un autre poste. Ne pas éditer simultanément un même dossier d'export : importer localement et produire une nouvelle révision.

Limites initiales : PDF ≤50 Mo et ≤30 pages (sélection d'une page par niveau, plusieurs niveaux possibles), dossier importé ≤150 Mo, requête IA ≤16 Mo et ≤180 000 tokens d'entrée, sortie ≤32 000 tokens. Un dépassement est expliqué ; aucune page >30 n'est ignorée silencieusement. Ces seuils doivent être éprouvés avec les plans réels.

## Bibliothèque commune

Compte / administration → Bibliothèque commune : édition de fiches règles, symboles BE et paramètres ; JSON avancé pour les structures complexes. Publication admin uniquement, contrôle concurrent par parent de version, auteur/date/motif, retour arrière par **nouvelle publication** d'une ancienne version. Consultation par tous ; propositions et réponse de traitement persistées séparément sans fichiers métier.

Un chantier épingle une copie de la bibliothèque et des paramètres/packs. Les nouveaux chantiers prennent la version courante. Pour un chantier existant, l'action explicite « Utiliser cette version pour ce chantier » est journalisée. Modifier une fiche descriptive ne crée pas un nouvel automatisme dans le moteur JS. Le moteur reste versionné avec l'application ; il faut donc conserver les anciennes versions Git pour reproduire strictement un ancien calcul.

## Réseau / mises à jour

Le build génère un service worker qui précharge les assets compilés, y compris PDF.js, jsPDF et les images applicatives. Pas de cache des API, comptes, HTML, plans ou rapports. L'ouverture initiale nécessite le réseau. Le bandeau indique la coupure et l'état du cache. Tant que l'application reste ouverte après préchargement, dessin et export local peuvent fonctionner sans IA/réseau. La bascule de compte et l'ouverture d'un autre chantier qui recharge la page demandent le réseau ; pas de premier lancement hors ligne promis.

Vérification périodique de `version.json`, bouton de mise à jour sans rechargement forcé, offre d'export et attente du secours avant rechargement explicite. Anciennes ressources conservées pour ne pas casser un onglet encore ouvert. Les caches de versions s'accumulent pour le moment : prévoir leur entretien après fermeture des sessions ; ne pas supprimer aveuglément une version utilisée.

## Recette et retour arrière

Voir `docs/recette-web-v72.md` pour les résultats réels et les tests restants. **Aucune validation visuelle Edge ni import PDF sur le déploiement final n'a été réalisée dans cette session.** Aucun compte Cloudflare réel, D1 distant ou secret n'a été configuré ici.

Retour arrière avant fusion : fermer la preview, main est inchangée. Après déploiement : exporter les chantiers ouverts ; sélectionner le dernier déploiement **entreprise sécurisé** compatible dans Cloudflare. Ne pas revenir au frontend public v71 comme mécanisme de sécurité. Si la v72 est le premier déploiement sécurisé et ne fonctionne pas, bloquer le site temporairement côté Cloudflare plutôt que rendre l'app publique. Sauvegarder D1 via les outils Cloudflare avant migration ; ne pas supprimer ses comptes/clé de coffres. Migration v1 additive sans transformation des anciens fichiers.

Sources techniques consultées :
- https://developers.cloudflare.com/pages/functions/advanced-mode/
- https://developers.cloudflare.com/pages/functions/middleware/
- https://platform.claude.com/docs/en/about-claude/pricing
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://learn.microsoft.com/fr-fr/sharepoint/sharepoint-sync
