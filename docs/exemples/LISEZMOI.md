# Exemples fournis par Kévin (26/10/2026)

Références pour la suite (ne pas reproduire tel quel : Kévin veut un document pensé pour un câbleur débutant).

- `FTZ_BANDE_Boite3.pdf` : une bande de boîte faite avec FTZ / SchemBAT (boîte LI03, Joyeux Constructions).
  Couleurs différentes par circuit dans une même gaine (rouge/bleu, gris/bleu foncé), retours et navettes
  orange / marron / noir / ivoire, gaines partagées (« P15+I11+V9A »), câble 3G1,5 pour l'extérieur, liste des fils.
- `bande_preferee_Kevin.png` : la bande que Kévin préfère : chaque fil dessiné séparément jusqu'à une borne numérotée,
  seuls retours / navettes / commandes tracés dans la boîte (à angle droit vers un point numéroté), clic sur un
  circuit = les autres s'estompent. Repris dans le schéma v35 (`schemaSVG`).
- `AF26064553_PASQUIER_BLIN_PLAN_EXPE_PIEUVRE.pdf` : plan d'expédition KiTéOHM (gaines en arc de la boîte à
  l'appareil, boîtes LI01…LI06, tableau). Style repris en v35 (gaines en arc, liaisons droites).
- `../plans/PASQUIER_BLIN_plan_scanne.pdf` : plan du pavillonneur **scanné** (une image par page, aucun trait) :
  le relevé sans IA ne peut rien lire ; échelle 1/50 indiquée dans le cartouche, feuille A3.
- `AF26064553_PASQUIER_BLIN.spv` : fichier SPV pour Counter (étape « SPV », plus tard).

## Format SPV (déduit du fichier, à confirmer avec Kévin)

Une ligne par gaine, champs séparés par `;` :

| n° | exemple | sens supposé |
|---|---|---|
| 1 | `LI04 D`, `TAB`, `CETH`, `SON1` | origine : boîte + face, ou tableau / équipement |
| 2 | `ICTA16`, `ICTA20`, `ICTA_V20`, `GAINEVMC80` | gaine |
| 3 | `6.1` | longueur (m) |
| 4 | `V3A+I15(ENTREE)` | appareil(s) desservi(s) et pièce |
| 5 | `U1000R2V_3G1.5_B-M-V/J (0.40)` | câble (avec couleurs) |
| 6–7 | `B[6] R[6] V/J[6] (0.40)`, `V/J[10] (0.40)` | fils de section indiquée entre crochets (6, 10 mm²) |
| 8 | `B R V/J (0.40)` | fils 2,5 mm² |
| 9 | `BF GR V/J (0.40)` | fils 1,5 mm² (`(0.40)` = surlongueur, m ?) |
| 10–11 | `1`, `ACTIVE` | quantité, état |
| 12 | `KEO_BOITE_PAV` | type de boîte (lignes d'alimentation) |
| 13–16 | dossier, client, chantier, référence | |
| 20 | `V3A`, `LI01`, `ANT` | repère court |
| 21 | `LI04.10` | n° de gaine |
| 22 | `Bras`, `Alimentation`, `Direct`, `Free pontage`, `Bras pontage`, `Direct pontage` | type de départ |
| 24 | `1200`, `300`, `2500` | hauteur de l'appareil (mm) ? |
| 25 | `6.50` | longueur totale = longueur + 0,40 |
