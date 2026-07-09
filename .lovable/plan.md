## Objectif

Restaurer la table `movements` à partir du fichier `Base.xlsx` fourni (feuille Log 2026), en repartant du contenu réel du journal — la base actuelle contient 733 lignes qui ne correspondent plus à la réalité, alors que le fichier n'en compte que 132 valides.

## Contenu détecté dans `Base.xlsx`

- 138 lignes brutes → **132 lignes valides** (6 lignes de notes/brouillon sans Date/Destination sont ignorées).
- Colonnes présentes (16) : `Date`, `Requester Initials`, `Strain`, `Batch/ Lot ID`, `Product type`, `Product Format`, `Quantity (G)`, `Units`, `Destination` (In/Out), `Comment #1`, `Adjustement Validation`, `Comment #2`, `Units 2`, `Unit Indicator`, `SKU`, `Aditional Comments`.
- Répartition `Comment #1` : Out of Facility 59, In from Cultivation 16, Out For Packaging 14, Back from Packaging 13, Standby for Shippment 12, Back from Sampling 10, Out for Sampling 7, In From External 1.

## Étapes

1. **Purge** : `DELETE FROM movements;` (RLS via service_role côté script d'import).
2. **Parsing** : script Node/TS local qui lit `Base.xlsx` via `xlsx` ou `duckdb` (mode `all_varchar`), convertit les dates série Excel en `YYYY-MM-DD`, ignore les lignes sans `Date` ou sans `Destination`.
3. **Mapping colonnes Excel → `movements`** :
   - `event_date` ← `Date` (serial → ISO)
   - `initials` ← `Requester Initials`
   - `strain`, `batch_id` ← `Strain`, `Batch/ Lot ID`
   - `product_type`, `product_format` ← idem
   - `quantity_g` ← `Quantity (G)`, `units` ← `Units`, `units2` ← `Units 2`
   - `direction` ← `Destination` (`Out` → `OUT`, `In` → `IN`)
   - `destination` ← valeur brute
   - `reason` ← `Comment #1` (source de la taxonomie)
   - `comment1` ← `Comment #1`, `comment2` ← `Comment #2`
   - `unit_indicator` ← `Unit Indicator`
   - `sku` ← `SKU`, `additional_comments` ← `Aditional Comments`
   - `adjustment_validation` ← `Adjustement Validation` (bool, `1` → true)
   - Champs non présents dans l'Excel : `detail`, `comment`, `destination` (aux besoin), `stamp_used`, `stamp_type`, `elevated_update` → chaînes vides / `false`.
4. **Insert en batch** (chunks de 100) via l'API Supabase.
5. **Vérifications post-import** :
   - `SELECT count(*) FROM movements;` → 132.
   - `SELECT direction, count(*) FROM movements GROUP BY 1;` → OUT ≈ 97, IN ≈ 35 (à valider).
   - Comparaison spot-check : 3 lignes IN + 3 lignes OUT (Batch, Quantité, Units) contre le fichier.
6. **Aucune modification du code applicatif** (`src/lib/bags.ts`, `movement-taxonomy.ts`, modale, routes) : la logique de décomposition en sacs se base déjà sur `Quantity (G)` + `Units` + `Comment #2`, elle refonctionnera dès que les données seront correctes.

## Détails techniques

- Import exécuté depuis le sandbox via `bun` + `@supabase/supabase-js` en utilisant les variables serveur, ou via `supabase--insert` en boucle si plus simple.
- Aucune migration de schéma nécessaire : la table `movements` conserve sa structure actuelle.
- Aucune modification de RLS.

## Hors périmètre

- Pas de changement UI/logique — seulement la restauration des données.
- Si tu veux également revenir à un état de code antérieur (avant les refactorings récents), ça se fait via l'onglet History, pas via un script.
