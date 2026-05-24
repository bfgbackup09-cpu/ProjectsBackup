CREATE TABLE public.one_pager_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  month date NOT NULL,
  total_po_value_eur numeric NOT NULL DEFAULT 0,
  invoiced_value_eur numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, month)
);

ALTER TABLE public.one_pager_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opf_select" ON public.one_pager_financials FOR SELECT TO authenticated USING (true);
CREATE POLICY "opf_insert" ON public.one_pager_financials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "opf_update" ON public.one_pager_financials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "opf_delete" ON public.one_pager_financials FOR DELETE TO authenticated USING (true);

CREATE TRIGGER opf_set_updated_at BEFORE UPDATE ON public.one_pager_financials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();