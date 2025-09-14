# To-Do List : Implémentation du Backend SadTrans avec Supabase

Ce document sert de feuille de route pour la création du backend de la plateforme SadTrans en utilisant Supabase. L'objectif principal est de remplacer l'API mock actuelle par une infrastructure backend robuste, sécurisée et évolutive, tout en respectant **scrupuleusement** le format des données existant, notamment le formatage personnalisé des identifiants (ID).

---

### Étape 1 : Configuration du Projet Supabase

1.  **Créer le Projet** :
    *   Créez un nouveau projet sur [supabase.com](https://supabase.com).
    *   Dans les paramètres du projet, récupérez l'**URL du projet** et la clé **API `anon`**.
    *   Stockez ces clés de manière sécurisée dans des variables d'environnement pour votre projet frontend (par exemple, dans un fichier `.env`).
      ```
      VITE_SUPABASE_URL=VOTRE_URL_PROJET
      VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON
      ```

2.  **Installer le Client Supabase** :
    *   Ajoutez le client Supabase à votre projet frontend :
      ```bash
      npm install @supabase/supabase-js
      ```

3.  **Initialiser le Client** :
    *   Créez un nouveau service `services/supabase.service.ts` pour initialiser et exporter une instance unique du client Supabase. Ce service remplacera à terme `api.service.ts`.

---

### Étape 2 : Création des Schémas de Table

Utilisez l'éditeur SQL dans le tableau de bord de Supabase pour exécuter les scripts suivants. L'ordre est important pour respecter les contraintes de clés étrangères.

#### 2.1. Créer les Types `ENUM`

Pour garantir la cohérence des données, créez d'abord les types énumérés.

```sql
-- Types pour la table 'users'
CREATE TYPE user_role AS ENUM ('agent', 'partner', 'admin_general', 'sous_admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'inactive');

-- Types pour la table 'transactions'
CREATE TYPE transaction_status_enum AS ENUM ('Validé', 'Rejeté', 'En attente de validation', 'Assignée');

-- Types pour les contrats
CREATE TYPE contract_status AS ENUM ('active', 'draft', 'expired');
CREATE TYPE contract_exception_target AS ENUM ('service', 'category');

-- ... Créez les autres ENUMs nécessaires pour `order_status`, `card_status`, etc.
```

> **Note de Senior Dev** : Le statut de transaction a été normalisé. Au lieu de stocker `"Assignée à Sam SubAdmin"`, nous utilisons un statut `Assignée` et le champ `assigned_to` (déjà présent dans le modèle) contiendra l'ID du sous-administrateur. Le texte complet sera reconstruit dans le frontend.

#### 2.2. Créer les Tables

Pour chaque table, le champ `id` sera de type `TEXT` et défini comme clé primaire.

*   **Table `partners`** (à créer avant `users` et `contracts`)
    ```sql
    CREATE TABLE partners (
      id TEXT PRIMARY KEY, -- ex: 'partner_1'
      name TEXT NOT NULL,
      partner_manager_id TEXT, -- Sera mis à jour après la création de l'utilisateur partenaire
      agency_name TEXT,
      contact_person JSONB NOT NULL,
      id_card_image_url TEXT,
      ifu TEXT,
      rccm TEXT,
      address TEXT
    );
    ```

*   **Table `users`**
    ```sql
    CREATE TABLE users (
      id TEXT PRIMARY KEY, -- ex: 'user_agent_1'
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      email TEXT UNIQUE NOT NULL,
      role user_role NOT NULL,
      avatar_seed TEXT,
      status user_status DEFAULT 'active',
      partner_id TEXT REFERENCES partners(id),
      solde NUMERIC(15, 2) DEFAULT 0.00,
      commissions_mois_estimees NUMERIC(15, 2) DEFAULT 0.00,
      commissions_dues NUMERIC(15, 2) DEFAULT 0.00,
      solde_revenus NUMERIC(15, 2) DEFAULT 0.00,
      phone TEXT,
      agency_name TEXT,
      id_card_number TEXT,
      ifu TEXT,
      rccm TEXT,
      address TEXT,
      id_card_image_url TEXT
    );
    -- Mettre à jour la clé étrangère dans 'partners'
    ALTER TABLE partners ADD CONSTRAINT fk_partner_manager FOREIGN KEY (partner_manager_id) REFERENCES users(id);
    ```

*   **Table `operation_types`**
    ```sql
    CREATE TABLE operation_types (
        id TEXT PRIMARY KEY, -- ex: 'op_activation_carte'
        name TEXT NOT NULL,
        description TEXT,
        impacts_balance BOOLEAN DEFAULT false,
        status TEXT,
        category TEXT,
        fee_application TEXT,
        fields JSONB, -- Stocke le tableau de OperationTypeField
        commission_config JSONB -- Stocke la CommissionConfig
    );
    ```

*   **Table `transactions`**
    ```sql
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY, -- ex: 'TRN001'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      agent_id TEXT REFERENCES users(id) NOT NULL,
      op_type_id TEXT REFERENCES operation_types(id) NOT NULL,
      data JSONB,
      montant_principal NUMERIC(15, 2) NOT NULL,
      frais NUMERIC(15, 2) DEFAULT 0.00,
      montant_total NUMERIC(15, 2) NOT NULL,
      statut transaction_status_enum NOT NULL,
      preuve_url TEXT,
      commission_societe NUMERIC(15, 2) DEFAULT 0.00,
      commission_partenaire NUMERIC(15, 2) DEFAULT 0.00,
      validateur_id TEXT REFERENCES users(id),
      motif_rejet TEXT,
      assigned_to TEXT REFERENCES users(id)
    );
    ```

*   **Continuer pour toutes les autres tables** : Appliquez la même logique pour `agent_recharge_requests`, `recharge_payment_methods`, `card_types`, `cards`, `orders`, `commission_profiles`, et `contracts`. Utilisez le type `JSONB` pour stocker des tableaux d'objets ou des objets complexes.

---

### Étape 3 : Gérer les ID Personnalisés avec des Triggers

Pour garantir que les ID comme `TRN001` sont générés automatiquement et de manière fiable, nous utiliserons des fonctions et des triggers PostgreSQL.

*   **Exemple pour la table `transactions`** :
    1.  Créez une séquence :
        ```sql
        CREATE SEQUENCE transactions_id_seq;
        ```
    2.  Créez une fonction qui génère l'ID formaté :
        ```sql
        CREATE OR REPLACE FUNCTION generate_transaction_id()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Si l'ID n'est pas déjà fourni, en générer un nouveau.
          IF NEW.id IS NULL THEN
            NEW.id := 'TRN' || LPAD(nextval('transactions_id_seq')::TEXT, 6, '0');
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        ```
    3.  Créez un trigger qui appelle cette fonction avant chaque insertion :
        ```sql
        CREATE TRIGGER before_insert_transaction
        BEFORE INSERT ON transactions
        FOR EACH ROW
        EXECUTE FUNCTION generate_transaction_id();
        ```
*   **Appliquer ce pattern** pour les autres tables nécessitant un formatage d'ID (ex: `orders`, `agent_recharge_requests`). Pour les tables comme `users` ou `partners`, l'ID (`user_agent_1`) devra probablement être généré côté client/Edge Function avant l'insertion, car il dépend du rôle et d'un autre identifiant.

---

### Étape 4 : Sécurité et Accès aux Données (Row Level Security - RLS)

Activez RLS sur chaque table et définissez des politiques d'accès. C'est essentiel pour la sécurité dans une application multi-locataires.

*   **Activer RLS sur une table** :
    ```sql
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ```
*   **Exemples de politiques pour la table `transactions`** :
    *   **Les agents ne peuvent voir/modifier que leurs propres transactions :**
        ```sql
        CREATE POLICY "Agents can manage their own transactions"
        ON transactions FOR ALL
        USING (auth.uid() = (SELECT id FROM users WHERE id = agent_id AND email = auth.email())); -- Assumant que l'ID utilisateur dans `auth.users` correspond à l'email. Une table `profiles` liant `auth.uid()` à `users.id` est une meilleure pratique.
        ```
    *   **Les partenaires peuvent voir les transactions de leurs agents :**
        ```sql
        CREATE POLICY "Partners can view their agents transactions"
        ON transactions FOR SELECT
        USING (
          (SELECT partner_id FROM users WHERE email = auth.email()) = (SELECT partner_id FROM users WHERE id = agent_id)
        );
        ```
    *   **Les administrateurs peuvent tout faire :**
        ```sql
        CREATE POLICY "Admins have full access"
        ON transactions FOR ALL
        USING ((SELECT role FROM users WHERE email = auth.email()) IN ('admin_general', 'sous_admin'));
        ```

---

### Étape 5 : Logique Métier avec les Edge Functions

La logique complexe (calculs, opérations atomiques) doit être déplacée du frontend vers des **Supabase Edge Functions** pour plus de sécurité et de performance.

1.  **Fonction `create-transaction`** :
    *   Reçoit l'ID de l'agent, le type d'opération et les données du formulaire.
    *   Effectue les validations de sécurité (ex: vérifier que l'agent a le solde suffisant).
    *   **Calcule les frais et commissions** en se basant sur le contrat du partenaire.
    *   Insère la transaction dans la base de données.
    *   Si l'opération impacte le solde, met à jour le solde de l'agent de manière atomique.
    *   Retourne la transaction créée.

2.  **Fonction `approve-recharge`** :
    *   Reçoit l'ID de la demande de recharge.
    *   Valide que l'utilisateur est un administrateur.
    *   Met à jour le statut de la demande.
    *   Augmente le solde de l'agent.

---

### Étape 6 : Stockage des Fichiers (Supabase Storage)

1.  **Créer des "Buckets"** :
    *   `transaction-proofs` pour les preuves de transaction (public ou avec accès signé).
    *   `kyc-documents` pour les pièces d'identité (privé, accessible uniquement aux administrateurs).

2.  **Définir les Politiques de Sécurité des Buckets** :
    *   Exemple pour `kyc-documents` : "Seuls les utilisateurs avec le rôle `admin_general` peuvent lire les fichiers".

3.  **Mettre à jour le Frontend** pour utiliser `supabase.storage.from('...').upload()` au lieu de stocker des images en base64 dans la base de données. Stockez uniquement l'URL du fichier.

---

### Étape 7 : Journalisation des Actions (Audit Trail) - **NOUVEAU**

Pour une traçabilité complète, une table d'audit est essentielle.

#### 7.1. Créer la Table `audit_logs`

```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL, -- Ex: 'VALIDATE_TRANSACTION', 'CREATE_USER', 'REJECT_RECHARGE'
  entity_type TEXT, -- Ex: 'transaction', 'user', 'partner'
  entity_id TEXT, -- Ex: 'TRN001', 'user_agent_1'
  details JSONB
);
```

#### 7.2. Activer RLS et Définir les Politiques

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Les administrateurs peuvent lire tous les logs.
CREATE POLICY "Admins can read all audit logs"
ON audit_logs FOR SELECT
USING ((SELECT role FROM users WHERE email = auth.email()) IN ('admin_general', 'sous_admin'));

-- Tous les utilisateurs authentifiés peuvent insérer des logs (essentiel pour les Edge Functions).
CREATE POLICY "Authenticated users can insert logs"
ON audit_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

#### 7.3. Intégration dans les Edge Functions

Modifiez vos Edge Functions pour enregistrer les actions. Par exemple, dans la fonction `approve-recharge` :

```typescript
// À l'intérieur de votre Edge Function, après avoir validé l'action
// et récupéré l'ID de l'utilisateur qui fait l'appel...

await supabase.from('audit_logs').insert({
  user_id: adminUserId,
  action: 'APPROVE_RECHARGE',
  entity_type: 'agent_recharge_request',
  entity_id: requestId,
  details: {
    approved_amount: amount,
    agent_id: agentId
  }
});
```

---

### Étape 8 : Remplacer l'API Mock

1.  **Refactoriser `DataService` et `ApiService`** :
    *   Remplacez progressivement chaque appel mock (ex: `api.getUsers()`) par un appel réel au client Supabase (ex: `supabase.from('users').select('*')`).
    *   Utilisez le `DataService` comme couche de cache pour éviter les appels répétés à Supabase pour des données statiques (comme les types d'opérations).

2.  **Utiliser les Edge Functions** : Pour les opérations complexes (création de transaction, validation), appelez vos Edge Functions via `supabase.functions.invoke('function-name', { ... })`.
