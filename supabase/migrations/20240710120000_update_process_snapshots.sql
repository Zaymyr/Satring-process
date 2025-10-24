alter table if exists public.process_snapshots
  drop constraint if exists process_snapshots_owner_id_key;

create index if not exists process_snapshots_owner_id_idx on public.process_snapshots(owner_id);
create index if not exists process_snapshots_updated_at_idx on public.process_snapshots(updated_at);

create or replace function public.save_process_snapshot(payload jsonb)
returns public.process_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
    v_owner uuid := auth.uid();
    v_steps jsonb := coalesce(payload -> 'steps', '[]'::jsonb);
    v_title text := coalesce(nullif(trim(payload ->> 'title'), ''), 'Étapes du processus');
    v_id uuid := nullif(trim(payload ->> 'id'), '')::uuid;
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

    if v_id is null then
        insert into public.process_snapshots (owner_id, steps, title)
        values (v_owner, v_steps, v_title)
        returning * into v_result;
    else
        update public.process_snapshots as ps
        set
            steps = v_steps,
            title = v_title,
            updated_at = timezone('utc', now())
        where ps.id = v_id
          and ps.owner_id = v_owner
        returning ps.* into v_result;

        if not found then
            raise exception 'Process introuvable' using errcode = 'P0002';
        end if;
    end if;

    return v_result;
end;
$$;

grant execute on function public.save_process_snapshot(jsonb) to authenticated;
