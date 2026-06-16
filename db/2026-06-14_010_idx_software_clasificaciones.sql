-- Performance index for M2M junction lookups by clasificacion_si_id
-- Part of si-taxonomy migration (Slice 2)
-- Apply manually after Slice 3 UI is verified
create index if not exists idx_software_clasificaciones_clasif
  on public.software_clasificaciones(clasificacion_si_id);
