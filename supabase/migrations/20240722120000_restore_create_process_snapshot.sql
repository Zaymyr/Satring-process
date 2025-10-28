-- Restore the create_process_snapshot function to ensure it exists for process creation
set search_path = public;

drop function if exists public.create_process_snapshot(jsonb);

create or replace function public.create_process_snapshot(payload jsonb)
returns public.process_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_steps jsonb := coalesce(payload -> 'steps', '[]'::jsonb);
    v_title text := coalesce(nullif(trim(payload ->> 'title'), ''), 'Étapes du processus');
    v_result public.process_snapshots;
begin
    if v_owner is null then
        raise exception 'Authentification requise' using errcode = '28000';
    end if;

    if jsonb_typeof(v_steps) <> 'array' then
        raise exception 'Le format des étapes est invalide' using errcode = '22P02';
    end if;

    if jsonb_array_length(v_steps) < 2 then
        raise exception 'Au moins deux étapes sont nécessaires' using errcode = '22023';
    end if;

    insert into public.process_snapshots (owner_id, steps, title)
    values (v_owner, v_steps, v_title)
    returning * into v_result;

    return v_result;
end;
$$;

grant execute on function public.create_process_snapshot(jsonb) to authenticated;
