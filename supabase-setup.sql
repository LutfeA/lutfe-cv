-- Run this once in Supabase > SQL Editor.
-- Then create ONE admin user manually in Authentication > Users.
-- Recommended: Authentication > Providers > Email > disable "Allow new users to sign up".

-- 1) Create a PUBLIC bucket named "cv" from Storage in the Supabase dashboard.
--    Keep file size limit at 15 MB or more.

-- 2) Allow everyone to VIEW/DOWNLOAD the public CV file.
create policy "Public can read CV"
on storage.objects
for select
to public
using (bucket_id = 'cv');

-- 3) Only authenticated users can upload a new CV.
create policy "Authenticated can upload CV"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cv'
  and name = 'current_cv.pdf'
);

-- 4) Only authenticated users can replace the current CV.
create policy "Authenticated can update CV"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'cv'
  and name = 'current_cv.pdf'
)
with check (
  bucket_id = 'cv'
  and name = 'current_cv.pdf'
);

-- Optional: allow authenticated admin to delete if needed later.
create policy "Authenticated can delete CV"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cv'
  and name = 'current_cv.pdf'
);
