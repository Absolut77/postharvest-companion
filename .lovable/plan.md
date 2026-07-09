
# PostHarvest Companion — Refonte complète

On repart de zéro sur une base propre, structurée autour du **cycle de vie d'un batch** de la récolte à l'entrée en voûte. L'ancien journal de mouvements (`movements`) sera archivé (table conservée en lecture seule pour référence, mais plus utilisée par les nouvelles UI).

## 1. Architecture applicative

- **Stack** : on **garde TanStack Start + TypeScript + Tailwind + shadcn/ui + Lovable Cloud (Supabase)** déjà en place. Next.js n'est pas supporté sur Lovable ; TanStack Start couvre exactement les mêmes besoins (SSR, file-based routing, server functions).
- **Navigation principale** (sidebar) :
  1. **Batches** — liste + création
  2. **Batch détail** — vue à onglets couvrant tout le cycle
  3. **Inventaire sacs** — vue transverse de tous les sacs physiques
  4. **Voûte / Stand-by** — batches terminés
- **Une page par batch avec onglets** correspondant aux 6 étapes :
  `Récolte → Séchage → Débudage → Tri & Ensachage → Curing → Bulk Packaging → Voûte`
- Chaque onglet = un formulaire ciblé + les mesures/photos associées. L'onglet actif se déverrouille quand l'étape précédente est marquée terminée.

## 2. Modèle de données

Toutes les tables en `public`, RLS activée, accès `authenticated` (l'app est interne et déjà derrière auth).

### Cœur

- **`batches`** : `batch_id` (unique), `strain`, `plant_count`, `harvest_date`, `wet_weight_g`, `dry_weight_g` (calc.), `current_stage` (enum), `notes`, `created_by`.
- **`batch_stage_events`** : historique horodaté des transitions d'étape (`from_stage`, `to_stage`, `at`, `user`, `note`) → sert la traçabilité complète en voûte.

### Séchage & Curing (mesures récurrentes)

- **`drying_readings`** : `batch_id`, `taken_at`, `room_temp_c`, `internal_humidity`, `external_humidity`, `water_activity`, `sartorius_value`, `note`.
- **`curing_readings`** : `batch_id`, `taken_at`, `water_activity`, `humidity`, `note`.
- Calendriers/estimations = vues dérivées côté client (pas de table dédiée, pour rester simple ; ré-évaluable plus tard).

### Débudage

- **`debudding_sessions`** : `batch_id`, `started_at`, `ended_at`, `method` (`hand_trim` | `mobius`), `ease_rating` (1–5), `quality_notes`.

### Tri & Ensachage → **sacs physiques**

Le cœur de la traçabilité : **chaque sac est une ligne** avec un poids individuel.

- **`bags`** :
  - `id` (uuid), `batch_id`, `qualification` (enum : `handtrim`, `large`, `medium`, `small`, `trim`),
  - `bag_number` (numéro dans la série pour ce batch + qualif),
  - `target_weight_g` (1000 fleurs / 3000 tri sac plein / 1500 trim caisse, selon règle),
  - `actual_weight_g` (poids réel — un sac d'exception est simplement un sac dont `actual != target`),
  - `is_exception` (bool calculé/manuel),
  - `stage` (enum : `post_debudding`, `in_curing`, `bulk_packed`, `sampled`, `retained`, `shipped`, `destroyed`),
  - `photo_urls` (text[]), `notes`, timestamps.
- **`bag_events`** : audit trail par sac (`bag_id`, `event`, `at`, `delta_g`, `note`, `user`) — pour tracer prélèvements, reconditionnements, transferts.

Règle de décomposition (ex : 3083 g de Large → 3 sacs) implémentée côté serveur au moment de l'ensachage : on crée `n-1` sacs à `target_weight_g` + 1 sac d'exception avec le reste, ou l'utilisateur ajuste manuellement.

### Bulk Packaging

- **`bulk_packaging_runs`** : `batch_id`, `run_date`, `weight_out_curing_g`, `processing_loss_g` (calc.), `sample_weight_g`, `retention_weight_g`, `form_a_url`, `form_b_url`, `global_photo_urls` (text[]).
- Les sacs de 1 kg créés à ce moment sont insérés dans `bags` avec `stage = 'bulk_packed'` (le dernier étant l'exception).

### Photos & documents

- Bucket Storage privé `batch-media` (créé via tool storage) avec dossiers `{batch_id}/{stage}/…`. Les tables stockent des URLs signées ou paths relatifs.

### Enums (Postgres `CREATE TYPE`)

`batch_stage`, `qualification`, `bag_stage`, `debudding_method`.

### Vues calculées (côté client, sans table dédiée)

- **Stock net par batch × qualification** = somme `actual_weight_g` des sacs non détruits/expédiés.
- **Processing loss** = `weight_out_curing_g − Σ actual_weight_g des sacs bulk_packed`.
- **Historique complet** = `batch_stage_events` + événements des enfants (`bag_events`, readings…).

## 3. Grands écrans à livrer (dans cet ordre)

1. **Liste Batches** + création (numéro + strain + plants + poids humide).
2. **Détail batch — onglets** :
   - *Récolte* : infos batch + poids humide.
   - *Séchage* : formulaire mesure + tableau historique.
   - *Débudage* : sessions + notes qualité.
   - *Tri & Ensachage* : builder qui prend `poids sec par qualif` et génère les sacs (avec sac d'exception), plus édition sac par sac.
   - *Curing* : mesures journalières.
   - *Bulk Packaging* : run form (poids sortie curing, échantillons, rétentions), upload Form A/B et photos, génération des sacs de 1 kg.
   - *Voûte* : timeline complète read-only.
3. **Inventaire sacs** : filtres batch / qualif / stage + total g.
4. **Voûte** : batches en `stage = vault` avec accès direct à l'historique.

## 4. Import / Export

- L'ancien flux Excel (Log 2026) devient **secondaire**. Je le laisse dispo depuis un menu "Legacy" tant qu'on n'a pas confirmé qu'il n'est plus nécessaire — on peut le supprimer si tu veux.
- Un futur export CSV/Excel côté batch pourra être ajouté après validation du modèle.

## 5. Livraison en 2 temps

Vu la taille, je propose de livrer en deux itérations et de te faire valider entre les deux :

- **Étape A** : migrations + enums + tables + RLS + navigation + page **Batches** (liste/création) + onglet **Récolte** + onglet **Séchage** fonctionnels.
- **Étape B** (après validation modèle) : **Débudage**, **Tri & Ensachage** (sacs physiques + règle d'exception), **Curing**, **Bulk Packaging** (photos + Form A/B), **Voûte** + **Inventaire sacs**.

## Points à confirmer avant de lancer

1. OK pour **garder TanStack Start** (pas de migration Next.js) ?
2. OK pour **archiver l'ancienne table `movements`** et l'UI Journal/Inventaire actuelle (je les laisse dispo en "Legacy" sinon) ?
3. OK pour **livraison en 2 étapes** avec validation du modèle après l'Étape A ?
4. Poids "plein" par qualification à confirmer : **fleurs = 1000 g**, **trim en caisse = ?** (l'ancien code utilisait 1500 g, tu parles ici de "3 kg" pour les sacs de tri et "poids plus important" pour la trim — précise si possible).
