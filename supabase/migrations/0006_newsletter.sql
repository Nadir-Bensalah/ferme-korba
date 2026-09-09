-- Lettre d'information : une adresse par ligne, inscrite depuis le pied de page.
-- Personne ne lit la table depuis le site : seule la fonction d'inscription est
-- ouverte à anon, et elle refuse le doublon sans le dire.

create table if not exists public.newsletter (
  email text primary key,
  lang text not null default 'fr' check (lang in ('fr', 'ar')),
  created_at timestamptz not null default now()
);
comment on table public.newsletter is 'Adresses inscrites à la lettre d''information, depuis le pied de page du site.';

alter table public.newsletter enable row level security;
revoke all on public.newsletter from anon, authenticated;
grant select, delete on public.newsletter to authenticated;

drop policy if exists newsletter_admin_read on public.newsletter;
create policy newsletter_admin_read on public.newsletter for select to authenticated using (public.is_admin());
drop policy if exists newsletter_admin_delete on public.newsletter;
create policy newsletter_admin_delete on public.newsletter for delete to authenticated using (public.is_admin());

create or replace function public.subscribe_newsletter(p_email text, p_lang text default 'fr')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' or length(v_email) > 120 then
    raise exception 'invalid';
  end if;
  if p_lang not in ('fr', 'ar') then
    p_lang := 'fr';
  end if;
  insert into public.newsletter (email, lang) values (v_email, p_lang)
  on conflict (email) do nothing;
end;
$$;
revoke all on function public.subscribe_newsletter(text, text) from public;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
