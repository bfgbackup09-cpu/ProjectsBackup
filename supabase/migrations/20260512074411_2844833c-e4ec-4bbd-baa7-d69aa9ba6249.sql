
-- ECR Status entries
CREATE TABLE public.ecr_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  cr_no TEXT NOT NULL,
  date_initiation DATE,
  released_to_bids DATE,
  offer_sent_alstom DATE,
  po_received_date DATE,
  cr_status TEXT,
  roa_remarks TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ecr_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecr_select ON public.ecr_status FOR SELECT TO authenticated USING (true);
CREATE POLICY ecr_insert ON public.ecr_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ecr_update ON public.ecr_status FOR UPDATE TO authenticated USING (true);
CREATE POLICY ecr_delete ON public.ecr_status FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_ecr_updated BEFORE UPDATE ON public.ecr_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Monthly manufacturing planned vs actual + OTD%
CREATE TABLE public.monthly_manufacturing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  month DATE NOT NULL,
  planned_qty INTEGER NOT NULL DEFAULT 0,
  actual_qty INTEGER NOT NULL DEFAULT 0,
  otd_percent NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, month)
);
ALTER TABLE public.monthly_manufacturing ENABLE ROW LEVEL SECURITY;
CREATE POLICY mm_select ON public.monthly_manufacturing FOR SELECT TO authenticated USING (true);
CREATE POLICY mm_insert ON public.monthly_manufacturing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY mm_update ON public.monthly_manufacturing FOR UPDATE TO authenticated USING (true);
CREATE POLICY mm_delete ON public.monthly_manufacturing FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_mm_updated BEFORE UPDATE ON public.monthly_manufacturing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Weekly outstanding balance
CREATE TABLE public.outstanding_balance_weekly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  week_of DATE NOT NULL,
  amount_eur NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, week_of)
);
ALTER TABLE public.outstanding_balance_weekly ENABLE ROW LEVEL SECURITY;
CREATE POLICY obw_select ON public.outstanding_balance_weekly FOR SELECT TO authenticated USING (true);
CREATE POLICY obw_insert ON public.outstanding_balance_weekly FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY obw_update ON public.outstanding_balance_weekly FOR UPDATE TO authenticated USING (true);
CREATE POLICY obw_delete ON public.outstanding_balance_weekly FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_obw_updated BEFORE UPDATE ON public.outstanding_balance_weekly FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
