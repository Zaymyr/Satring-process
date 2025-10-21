# Database Overview

## Schema `auth`

### Table `auth.audit_log_entries`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `u` | ✅ | `` |
| `payload` | `j` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `ip_address` | `c` | ✅ | `` |

**Primary keys**
- `audit_log_entries_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.flow_state`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `auth_code` | `t` | ✅ | `` |
| `code_challenge_method` | `a` | ✅ | `` |
| `code_challenge` | `t` | ✅ | `` |
| `provider_type` | `t` | ✅ | `` |
| `provider_access_token` | `t` | ❌ | `` |
| `provider_refresh_token` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `authentication_method` | `t` | ✅ | `` |
| `auth_code_issued_at` | `t` | ❌ | `` |

**Primary keys**
- `flow_state_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.identities`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `provider_id` | `t` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `identity_data` | `j` | ✅ | `` |
| `provider` | `t` | ✅ | `` |
| `last_sign_in_at` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `email` | `t` | ❌ | `` |
| `id` | `u` | ✅ | `` |

**Primary keys**
- `identities_pkey` on (id)

**Foreign keys**
- `identities_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.instances`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `uuid` | `u` | ❌ | `` |
| `raw_base_config` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |

**Primary keys**
- `instances_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_amr_claims`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `session_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `authentication_method` | `t` | ✅ | `` |
| `id` | `u` | ✅ | `` |

**Primary keys**
- `amr_id_pk` on (id)

**Foreign keys**
- `mfa_amr_claims_session_id_fkey`: (session_id) → auth.sessions(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_challenges`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `factor_id` | `u` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `verified_at` | `t` | ❌ | `` |
| `ip_address` | `i` | ✅ | `` |
| `otp_code` | `t` | ❌ | `` |
| `web_authn_session_data` | `j` | ❌ | `` |

**Primary keys**
- `mfa_challenges_pkey` on (id)

**Foreign keys**
- `mfa_challenges_auth_factor_id_fkey`: (factor_id) → auth.mfa_factors(id)

**RLS**: ❌ disabled

---

### Table `auth.mfa_factors`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `friendly_name` | `t` | ❌ | `` |
| `factor_type` | `a` | ✅ | `` |
| `status` | `a` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `secret` | `t` | ❌ | `` |
| `phone` | `t` | ❌ | `` |
| `last_challenged_at` | `t` | ❌ | `` |
| `web_authn_credential` | `j` | ❌ | `` |
| `web_authn_aaguid` | `u` | ❌ | `` |

**Primary keys**
- `mfa_factors_pkey` on (id)

**Foreign keys**
- `mfa_factors_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_authorizations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `authorization_id` | `t` | ✅ | `` |
| `client_id` | `u` | ✅ | `` |
| `user_id` | `u` | ❌ | `` |
| `redirect_uri` | `t` | ✅ | `` |
| `scope` | `t` | ✅ | `` |
| `state` | `t` | ❌ | `` |
| `resource` | `t` | ❌ | `` |
| `code_challenge` | `t` | ❌ | `` |
| `code_challenge_method` | `a` | ❌ | `` |
| `response_type` | `a` | ✅ | `` |
| `status` | `a` | ✅ | `` |
| `authorization_code` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `expires_at` | `t` | ✅ | `` |
| `approved_at` | `t` | ❌ | `` |

**Primary keys**
- `oauth_authorizations_pkey` on (id)

**Foreign keys**
- `oauth_authorizations_client_id_fkey`: (client_id) → auth.oauth_clients(id)
- `oauth_authorizations_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_clients`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `client_secret_hash` | `t` | ❌ | `` |
| `registration_type` | `a` | ✅ | `` |
| `redirect_uris` | `t` | ✅ | `` |
| `grant_types` | `t` | ✅ | `` |
| `client_name` | `t` | ❌ | `` |
| `client_uri` | `t` | ❌ | `` |
| `logo_uri` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |
| `client_type` | `a` | ✅ | `` |

**Primary keys**
- `oauth_clients_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.oauth_consents`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `client_id` | `u` | ✅ | `` |
| `scopes` | `t` | ✅ | `` |
| `granted_at` | `t` | ✅ | `` |
| `revoked_at` | `t` | ❌ | `` |

**Primary keys**
- `oauth_consents_pkey` on (id)

**Foreign keys**
- `oauth_consents_client_id_fkey`: (client_id) → auth.oauth_clients(id)
- `oauth_consents_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.one_time_tokens`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `token_type` | `a` | ✅ | `` |
| `token_hash` | `t` | ✅ | `` |
| `relates_to` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `one_time_tokens_pkey` on (id)

**Foreign keys**
- `one_time_tokens_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.refresh_tokens`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `b` | ✅ | `` |
| `token` | `c` | ❌ | `` |
| `user_id` | `c` | ❌ | `` |
| `revoked` | `b` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `parent` | `c` | ❌ | `` |
| `session_id` | `u` | ❌ | `` |

**Primary keys**
- `refresh_tokens_pkey` on (id)

**Foreign keys**
- `refresh_tokens_session_id_fkey`: (session_id) → auth.sessions(id)

**RLS**: ❌ disabled

---

### Table `auth.saml_providers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `entity_id` | `t` | ✅ | `` |
| `metadata_xml` | `t` | ✅ | `` |
| `metadata_url` | `t` | ❌ | `` |
| `attribute_mapping` | `j` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `name_id_format` | `t` | ❌ | `` |

**Primary keys**
- `saml_providers_pkey` on (id)

**Foreign keys**
- `saml_providers_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.saml_relay_states`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `request_id` | `t` | ✅ | `` |
| `for_email` | `t` | ❌ | `` |
| `redirect_to` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `flow_state_id` | `u` | ❌ | `` |

**Primary keys**
- `saml_relay_states_pkey` on (id)

**Foreign keys**
- `saml_relay_states_flow_state_id_fkey`: (flow_state_id) → auth.flow_state(id)
- `saml_relay_states_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `c` | ✅ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---

### Table `auth.sessions`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `user_id` | `u` | ✅ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `factor_id` | `u` | ❌ | `` |
| `aal` | `a` | ❌ | `` |
| `not_after` | `t` | ❌ | `` |
| `refreshed_at` | `t` | ❌ | `` |
| `user_agent` | `t` | ❌ | `` |
| `ip` | `i` | ❌ | `` |
| `tag` | `t` | ❌ | `` |
| `oauth_client_id` | `u` | ❌ | `` |

**Primary keys**
- `sessions_pkey` on (id)

**Foreign keys**
- `sessions_oauth_client_id_fkey`: (oauth_client_id) → auth.oauth_clients(id)
- `sessions_user_id_fkey`: (user_id) → auth.users(id)

**RLS**: ❌ disabled

---

### Table `auth.sso_domains`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `sso_provider_id` | `u` | ✅ | `` |
| `domain` | `t` | ✅ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |

**Primary keys**
- `sso_domains_pkey` on (id)

**Foreign keys**
- `sso_domains_sso_provider_id_fkey`: (sso_provider_id) → auth.sso_providers(id)

**RLS**: ❌ disabled

---

### Table `auth.sso_providers`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `resource_id` | `t` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `disabled` | `b` | ❌ | `` |

**Primary keys**
- `sso_providers_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `auth.users`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `instance_id` | `u` | ❌ | `` |
| `id` | `u` | ✅ | `` |
| `aud` | `c` | ❌ | `` |
| `role` | `c` | ❌ | `` |
| `email` | `c` | ❌ | `` |
| `encrypted_password` | `c` | ❌ | `` |
| `email_confirmed_at` | `t` | ❌ | `` |
| `invited_at` | `t` | ❌ | `` |
| `confirmation_token` | `c` | ❌ | `` |
| `confirmation_sent_at` | `t` | ❌ | `` |
| `recovery_token` | `c` | ❌ | `` |
| `recovery_sent_at` | `t` | ❌ | `` |
| `email_change_token_new` | `c` | ❌ | `` |
| `email_change` | `c` | ❌ | `` |
| `email_change_sent_at` | `t` | ❌ | `` |
| `last_sign_in_at` | `t` | ❌ | `` |
| `raw_app_meta_data` | `j` | ❌ | `` |
| `raw_user_meta_data` | `j` | ❌ | `` |
| `is_super_admin` | `b` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `phone` | `t` | ❌ | `` |
| `phone_confirmed_at` | `t` | ❌ | `` |
| `phone_change` | `t` | ❌ | `` |
| `phone_change_token` | `c` | ❌ | `` |
| `phone_change_sent_at` | `t` | ❌ | `` |
| `confirmed_at` | `t` | ❌ | `` |
| `email_change_token_current` | `c` | ❌ | `` |
| `email_change_confirm_status` | `s` | ❌ | `` |
| `banned_until` | `t` | ❌ | `` |
| `reauthentication_token` | `c` | ❌ | `` |
| `reauthentication_sent_at` | `t` | ❌ | `` |
| `is_sso_user` | `b` | ✅ | `` |
| `deleted_at` | `t` | ❌ | `` |
| `is_anonymous` | `b` | ✅ | `` |

**Primary keys**
- `users_pkey` on (id)

**RLS**: ❌ disabled

---

## Schema `realtime`

### Table `realtime.messages`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `topic` | `t` | ✅ | `` |
| `extension` | `t` | ✅ | `` |
| `payload` | `j` | ❌ | `` |
| `event` | `t` | ❌ | `` |
| `private` | `b` | ❌ | `` |
| `updated_at` | `t` | ✅ | `` |
| `inserted_at` | `t` | ✅ | `` |
| `id` | `u` | ✅ | `` |

**Primary keys**
- `messages_pkey` on (id, inserted_at)

**RLS**: ❌ disabled

---

### Table `realtime.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `b` | ✅ | `` |
| `inserted_at` | `t` | ❌ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---

### Table `realtime.subscription`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `b` | ✅ | `` |
| `subscription_id` | `u` | ✅ | `` |
| `entity` | `r` | ✅ | `` |
| `filters` | `r` | ✅ | `` |
| `claims` | `j` | ✅ | `` |
| `claims_role` | `r` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `pk_subscription` on (id)

**RLS**: ❌ disabled

---

## Schema `storage`

### Table `storage.buckets`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `owner` | `u` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `public` | `b` | ❌ | `` |
| `avif_autodetection` | `b` | ❌ | `` |
| `file_size_limit` | `b` | ❌ | `` |
| `allowed_mime_types` | `t` | ❌ | `` |
| `owner_id` | `t` | ❌ | `` |
| `type` | `s` | ✅ | `` |

**Primary keys**
- `buckets_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.buckets_analytics`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `type` | `s` | ✅ | `` |
| `format` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |
| `updated_at` | `t` | ✅ | `` |

**Primary keys**
- `buckets_analytics_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `i` | ✅ | `` |
| `name` | `c` | ✅ | `` |
| `hash` | `c` | ✅ | `` |
| `executed_at` | `t` | ❌ | `` |

**Primary keys**
- `migrations_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.objects`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `bucket_id` | `t` | ❌ | `` |
| `name` | `t` | ❌ | `` |
| `owner` | `u` | ❌ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |
| `last_accessed_at` | `t` | ❌ | `` |
| `metadata` | `j` | ❌ | `` |
| `path_tokens` | `t` | ❌ | `` |
| `version` | `t` | ❌ | `` |
| `owner_id` | `t` | ❌ | `` |
| `user_metadata` | `j` | ❌ | `` |
| `level` | `i` | ❌ | `` |

**Primary keys**
- `objects_pkey` on (id)

**RLS**: ❌ disabled

---

### Table `storage.prefixes`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `bucket_id` | `t` | ✅ | `` |
| `name` | `t` | ✅ | `` |
| `level` | `i` | ✅ | `` |
| `created_at` | `t` | ❌ | `` |
| `updated_at` | `t` | ❌ | `` |

**Primary keys**
- `prefixes_pkey` on (bucket_id, level, name)

**RLS**: ❌ disabled

---

### Table `storage.s3_multipart_uploads`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `t` | ✅ | `` |
| `in_progress_size` | `b` | ✅ | `` |
| `upload_signature` | `t` | ✅ | `` |
| `bucket_id` | `t` | ✅ | `` |
| `key` | `t` | ✅ | `` |
| `version` | `t` | ✅ | `` |
| `owner_id` | `t` | ❌ | `` |
| `created_at` | `t` | ✅ | `` |
| `user_metadata` | `j` | ❌ | `` |

**Primary keys**
- `s3_multipart_uploads_pkey` on (id)

**Foreign keys**
- `s3_multipart_uploads_bucket_id_fkey`: (bucket_id) → storage.buckets(id)

**RLS**: ❌ disabled

---

### Table `storage.s3_multipart_uploads_parts`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `id` | `u` | ✅ | `` |
| `upload_id` | `t` | ✅ | `` |
| `size` | `b` | ✅ | `` |
| `part_number` | `i` | ✅ | `` |
| `bucket_id` | `t` | ✅ | `` |
| `key` | `t` | ✅ | `` |
| `etag` | `t` | ✅ | `` |
| `owner_id` | `t` | ❌ | `` |
| `version` | `t` | ✅ | `` |
| `created_at` | `t` | ✅ | `` |

**Primary keys**
- `s3_multipart_uploads_parts_pkey` on (id)

**Foreign keys**
- `s3_multipart_uploads_parts_bucket_id_fkey`: (bucket_id) → storage.buckets(id)
- `s3_multipart_uploads_parts_upload_id_fkey`: (upload_id) → storage.s3_multipart_uploads(id)

**RLS**: ❌ disabled

---

## Schema `supabase_migrations`

### Table `supabase_migrations.schema_migrations`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `version` | `t` | ✅ | `` |
| `statements` | `t` | ❌ | `` |
| `name` | `t` | ❌ | `` |

**Primary keys**
- `schema_migrations_pkey` on (version)

**RLS**: ❌ disabled

---

### Table `supabase_migrations.seed_files`

**Columns**

| name | type | not null | default |
|---|---|:---:|---|
| `path` | `t` | ✅ | `` |
| `hash` | `t` | ✅ | `` |

**Primary keys**
- `seed_files_pkey` on (path)

**RLS**: ❌ disabled

---
