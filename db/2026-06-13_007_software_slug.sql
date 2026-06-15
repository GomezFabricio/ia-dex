-- 2026-06-13_007_software_slug.sql
-- PR-4 / T15 — Add a stable `slug` identity to software for upsert-by-slug seeding.
--
-- Additive and self-verifying in a single transaction:
--   1. add nullable slug column
--   2. backfill with values byte-identical to db/seed-content.json (matched by nombre,
--      so the seed's ON CONFLICT (slug) updates existing rows instead of duplicating them)
--   3. guard: abort the whole migration if any slug is null or duplicated
--   4. enforce UNIQUE + NOT NULL
-- If the backfill is incomplete the DO block raises and the transaction rolls back —
-- the column is never left half-applied.
--
-- ROLLBACK (manual, non-destructive — rows keyed by nombre are untouched):
--   alter table public.software drop constraint if exists software_slug_key;
--   alter table public.software drop column if exists slug;

alter table public.software add column if not exists slug text;

update public.software set slug = case nombre
  when 'Apache Jena' then 'apache-jena'
  when 'ChatGPT' then 'chatgpt'
  when 'CLIPS' then 'clips'
  when 'DEAP' then 'deap'
  when 'Gymnasium (ex OpenAI Gym)' then 'gymnasium'
  when 'HeuristicLab' then 'heuristiclab'
  when 'MediaPipe' then 'mediapipe'
  when 'NLTK' then 'nltk'
  when 'OpenCV' then 'opencv'
  when 'OR-Tools' then 'or-tools'
  when 'Protégé' then 'protege'
  when 'PyGAD' then 'pygad'
  when 'Rasa' then 'rasa'
  when 'scikit-learn' then 'scikit-learn'
  when 'spaCy' then 'spacy'
  when 'Stockfish' then 'stockfish'
  when 'SWI-Prolog' then 'swi-prolog'
  when 'TensorFlow' then 'tensorflow'
  when 'Tesseract OCR' then 'tesseract-ocr'
  when 'Web Speech API' then 'web-speech-api'
  when 'Weka' then 'weka'
  when 'Whisper (OpenAI)' then 'whisper'
  when 'YOLO (Ultralytics)' then 'yolo'
end
where slug is null;

do $$
begin
  if exists (select 1 from public.software where slug is null) then
    raise exception 'slug backfill incomplete: % row(s) still null',
      (select count(*) from public.software where slug is null);
  end if;
  if exists (select 1 from public.software group by slug having count(*) > 1) then
    raise exception 'duplicate slug(s) present — cannot add unique constraint';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'software_slug_key') then
    alter table public.software add constraint software_slug_key unique (slug);
  end if;
end $$;
alter table public.software alter column slug set not null;
