-- ══════════════════════════════════════════════════════════════════
-- MindTrace · 0003 — private certificate storage
-- Idempotent. The "certificates" bucket is PRIVATE; every object lives
-- under "<user-id>/" and only that owner can read, write, or delete it.
-- ══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  false,
  5242880,  -- 5 MB
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf'];

-- Owner-scoped access: first path segment must equal the user's id.
-- (create policy if not exists is unavailable; guard each manually.)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_read'
  ) then
    create policy certs_owner_read on storage.objects for select to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_insert'
  ) then
    create policy certs_owner_insert on storage.objects for insert to authenticated
    with check (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_update'
  ) then
    create policy certs_owner_update on storage.objects for update to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'certs_owner_delete'
  ) then
    create policy certs_owner_delete on storage.objects for delete to authenticated
    using (
      bucket_id = 'certificates'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;
end $$;
