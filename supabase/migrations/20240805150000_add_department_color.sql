alter table if exists public.departments
  add column if not exists color text not null default '#C7D2FE';

update public.departments
set color = upper(color)
where color ~ '^#[0-9a-f]{6}$' and color <> upper(color);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'departments_color_check'
      and conrelid = 'public.departments'::regclass
  ) then
    alter table public.departments
      add constraint departments_color_check check (color ~ '^#[0-9A-F]{6}$');
  end if;
end
$$;
