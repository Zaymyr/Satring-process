create table if not exists public.user_onboarding_states (
    owner_id uuid primary key references auth.users(id) on delete cascade,
    sample_seeded_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_user_onboarding_states_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

do $$
begin
    if not exists (
        select 1
        from pg_trigger
        where tgname = 'user_onboarding_states_updated_at'
    ) then
        create trigger user_onboarding_states_updated_at
        before update on public.user_onboarding_states
        for each row
        execute function public.set_user_onboarding_states_updated_at();
    end if;
end;
$$;

alter table if exists public.user_onboarding_states enable row level security;

create policy if not exists user_onboarding_states_select on public.user_onboarding_states
for select
using (auth.uid() = owner_id);

create policy if not exists user_onboarding_states_insert on public.user_onboarding_states
for insert
with check (auth.uid() = owner_id);

create policy if not exists user_onboarding_states_update on public.user_onboarding_states
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create or replace function public.seed_sample_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_state public.user_onboarding_states;
    v_now timestamptz := timezone('utc', now());
    v_support_department_id uuid;
    v_operations_department_id uuid;
    v_finance_department_id uuid;
    v_support_manager_role_id uuid := gen_random_uuid();
    v_support_agent_role_id uuid := gen_random_uuid();
    v_support_analyst_role_id uuid := gen_random_uuid();
    v_operations_manager_role_id uuid := gen_random_uuid();
    v_operations_coordinator_role_id uuid := gen_random_uuid();
    v_operations_technician_role_id uuid := gen_random_uuid();
    v_operations_project_lead_role_id uuid := gen_random_uuid();
    v_finance_director_role_id uuid := gen_random_uuid();
    v_finance_accountant_role_id uuid := gen_random_uuid();
    v_finance_controller_role_id uuid := gen_random_uuid();
begin
    if v_owner is null then
        raise exception 'Authentification requise' using errcode = '28000';
    end if;

    insert into public.user_onboarding_states (owner_id)
    values (v_owner)
    on conflict (owner_id) do nothing;

    select *
    into v_state
    from public.user_onboarding_states
    where owner_id = v_owner
    for update;

    if v_state.sample_seeded_at is not null then
        return jsonb_build_object('seeded', false, 'reason', 'already_seeded');
    end if;

    if exists (select 1 from public.process_snapshots where owner_id = v_owner)
        or exists (select 1 from public.departments where owner_id = v_owner) then
        update public.user_onboarding_states
        set sample_seeded_at = v_now,
            updated_at = v_now
        where owner_id = v_owner;

        return jsonb_build_object('seeded', false, 'reason', 'existing_data');
    end if;

    v_support_department_id := gen_random_uuid();
    v_operations_department_id := gen_random_uuid();
    v_finance_department_id := gen_random_uuid();

    insert into public.departments (id, owner_id, name, color, created_at, updated_at)
    values
        (v_support_department_id, v_owner, 'Service client', '#60A5FA', v_now, v_now),
        (v_operations_department_id, v_owner, 'Opérations', '#34D399', v_now, v_now),
        (v_finance_department_id, v_owner, 'Finance', '#FACC15', v_now, v_now);

    insert into public.roles (id, owner_id, department_id, name, created_at, updated_at)
    values
        (v_support_manager_role_id, v_owner, v_support_department_id, 'Responsable support', v_now, v_now),
        (v_support_agent_role_id, v_owner, v_support_department_id, 'Agent service client', v_now, v_now),
        (v_support_analyst_role_id, v_owner, v_support_department_id, 'Analyste qualité', v_now, v_now),
        (v_operations_manager_role_id, v_owner, v_operations_department_id, 'Responsable opérations', v_now, v_now),
        (v_operations_coordinator_role_id, v_owner, v_operations_department_id, 'Coordinateur terrain', v_now, v_now),
        (v_operations_technician_role_id, v_owner, v_operations_department_id, 'Technicien support', v_now, v_now),
        (v_operations_project_lead_role_id, v_owner, v_operations_department_id, 'Chef de projet', v_now, v_now),
        (v_finance_director_role_id, v_owner, v_finance_department_id, 'Directeur financier', v_now, v_now),
        (v_finance_accountant_role_id, v_owner, v_finance_department_id, 'Comptable fournisseurs', v_now, v_now),
        (v_finance_controller_role_id, v_owner, v_finance_department_id, 'Contrôleur de gestion', v_now, v_now);

    insert into public.process_snapshots (owner_id, title, steps, created_at, updated_at)
    values
        (
            v_owner,
            'Traitement d''un incident client',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Signalement reçu', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'collect-incident', 'noTargetId', null),
                jsonb_build_object('id', 'collect-incident', 'label', 'Collecter les détails de l''incident', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'qualify-severity', 'noTargetId', null),
                jsonb_build_object('id', 'qualify-severity', 'label', 'Qualifier la gravité', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'dispatch-team', 'noTargetId', 'communicate-solution'),
                jsonb_build_object('id', 'dispatch-team', 'label', 'Dépêcher l''équipe d''intervention', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_coordinator_role_id::text, 'yesTargetId', 'fix-issue', 'noTargetId', null),
                jsonb_build_object('id', 'fix-issue', 'label', 'Résoudre l''incident', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_technician_role_id::text, 'yesTargetId', 'quality-check', 'noTargetId', null),
                jsonb_build_object('id', 'quality-check', 'label', 'Vérifier la résolution', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'communicate-solution', 'noTargetId', 'dispatch-team'),
                jsonb_build_object('id', 'communicate-solution', 'label', 'Informer le client de la solution', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Incident clôturé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        ),
        (
            v_owner,
            'Validation d''une facture fournisseur',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Réception de la facture', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'receive-invoice', 'noTargetId', null),
                jsonb_build_object('id', 'receive-invoice', 'label', 'Enregistrer la facture', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_accountant_role_id::text, 'yesTargetId', 'verify-details', 'noTargetId', null),
                jsonb_build_object('id', 'verify-details', 'label', 'Contrôler les informations', 'type', 'decision', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_controller_role_id::text, 'yesTargetId', 'approve-budget', 'noTargetId', 'request-info'),
                jsonb_build_object('id', 'request-info', 'label', 'Demander des compléments au fournisseur', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'verify-details', 'noTargetId', null),
                jsonb_build_object('id', 'approve-budget', 'label', 'Valider le budget', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_director_role_id::text, 'yesTargetId', 'schedule-payment', 'noTargetId', null),
                jsonb_build_object('id', 'schedule-payment', 'label', 'Programmer le paiement', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_accountant_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Paiement confirmé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        ),
        (
            v_owner,
            'Amélioration continue du service client',
            jsonb_build_array(
                jsonb_build_object('id', 'start', 'label', 'Collecte des retours clients', 'type', 'start', 'departmentId', null, 'roleId', null, 'yesTargetId', 'collect-feedback', 'noTargetId', null),
                jsonb_build_object('id', 'collect-feedback', 'label', 'Centraliser les retours', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_agent_role_id::text, 'yesTargetId', 'analyze-trends', 'noTargetId', null),
                jsonb_build_object('id', 'analyze-trends', 'label', 'Analyser les tendances', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_analyst_role_id::text, 'yesTargetId', 'prioritize-actions', 'noTargetId', null),
                jsonb_build_object('id', 'prioritize-actions', 'label', 'Prioriser les actions', 'type', 'decision', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'design-solution', 'noTargetId', 'finish'),
                jsonb_build_object('id', 'design-solution', 'label', 'Concevoir une amélioration', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_project_lead_role_id::text, 'yesTargetId', 'budget-review', 'noTargetId', null),
                jsonb_build_object('id', 'budget-review', 'label', 'Réviser le budget', 'type', 'decision', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_controller_role_id::text, 'yesTargetId', 'validate-investment', 'noTargetId', 'revise-scope'),
                jsonb_build_object('id', 'revise-scope', 'label', 'Réajuster le périmètre', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_manager_role_id::text, 'yesTargetId', 'budget-review', 'noTargetId', null),
                jsonb_build_object('id', 'validate-investment', 'label', 'Valider l''investissement', 'type', 'action', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_director_role_id::text, 'yesTargetId', 'deploy-improvements', 'noTargetId', null),
                jsonb_build_object('id', 'deploy-improvements', 'label', 'Déployer les améliorations', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_coordinator_role_id::text, 'yesTargetId', 'communicate-updates', 'noTargetId', null),
                jsonb_build_object('id', 'communicate-updates', 'label', 'Informer les clients', 'type', 'action', 'departmentId', v_support_department_id::text, 'roleId', v_support_manager_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Cycle d''amélioration clôturé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        );

    update public.user_onboarding_states
    set sample_seeded_at = v_now,
        updated_at = v_now
    where owner_id = v_owner;

    return jsonb_build_object('seeded', true, 'reason', 'created');
end;
$$;

grant execute on function public.seed_sample_data() to authenticated;
