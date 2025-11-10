-- Add color column to roles and enforce format
alter table if exists public.roles
  add column if not exists color text not null default '#C7D2FE';

update public.roles
set color = upper(color)
where color is not null and color <> upper(color);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.roles'::regclass
      and conname = 'roles_color_check'
  ) then
    alter table public.roles
      add constraint roles_color_check check (color ~ '^#[0-9A-F]{6}$');
  end if;
end;
$$;

alter table if exists public.roles
  alter column color set default '#C7D2FE';

-- Refresh the onboarding seed data to include role colors
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

    insert into public.roles (id, owner_id, department_id, name, color, created_at, updated_at)
    values
        (v_support_manager_role_id, v_owner, v_support_department_id, 'Responsable support', '#2563EB', v_now, v_now),
        (v_support_agent_role_id, v_owner, v_support_department_id, 'Agent service client', '#38BDF8', v_now, v_now),
        (v_support_analyst_role_id, v_owner, v_support_department_id, 'Analyste qualité', '#0EA5E9', v_now, v_now),
        (v_operations_manager_role_id, v_owner, v_operations_department_id, 'Responsable opérations', '#16A34A', v_now, v_now),
        (v_operations_coordinator_role_id, v_owner, v_operations_department_id, 'Coordinateur terrain', '#22C55E', v_now, v_now),
        (v_operations_technician_role_id, v_owner, v_operations_department_id, 'Technicien support', '#059669', v_now, v_now),
        (v_operations_project_lead_role_id, v_owner, v_operations_department_id, 'Chef de projet', '#10B981', v_now, v_now),
        (v_finance_director_role_id, v_owner, v_finance_department_id, 'Directeur financier', '#F97316', v_now, v_now),
        (v_finance_accountant_role_id, v_owner, v_finance_department_id, 'Comptable fournisseurs', '#F59E0B', v_now, v_now),
        (v_finance_controller_role_id, v_owner, v_finance_department_id, 'Contrôleur de gestion', '#D97706', v_now, v_now);

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
                jsonb_build_object('id', 'budget-review', 'label', 'Réviser le budget', 'type', 'decision', 'departmentId', v_finance_department_id::text, 'roleId', v_finance_director_role_id::text, 'yesTargetId', 'implement-solution', 'noTargetId', 'design-solution'),
                jsonb_build_object('id', 'implement-solution', 'label', 'Mettre en œuvre l''amélioration', 'type', 'action', 'departmentId', v_operations_department_id::text, 'roleId', v_operations_coordinator_role_id::text, 'yesTargetId', 'finish', 'noTargetId', null),
                jsonb_build_object('id', 'finish', 'label', 'Cycle terminé', 'type', 'finish', 'departmentId', null, 'roleId', null, 'yesTargetId', null, 'noTargetId', null)
            ),
            v_now,
            v_now
        );

    update public.user_onboarding_states
    set sample_seeded_at = v_now,
        updated_at = v_now
    where owner_id = v_owner;

    return jsonb_build_object('seeded', true);
end;
$$;
