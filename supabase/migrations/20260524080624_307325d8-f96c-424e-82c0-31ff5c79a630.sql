
CREATE TABLE public.costing_tra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  month date NOT NULL,
  tra_code text NOT NULL,
  selling_unit_price_eur numeric NOT NULL DEFAULT 0,
  unit_material_cost_eur numeric NOT NULL DEFAULT 0,
  panel_labour_cost_eur numeric NOT NULL DEFAULT 0,
  unit_packaging_labour_cost_eur numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, month, tra_code)
);

ALTER TABLE public.costing_tra ENABLE ROW LEVEL SECURITY;

CREATE POLICY costing_tra_select ON public.costing_tra FOR SELECT TO authenticated USING (can_access_project(project_id));
CREATE POLICY costing_tra_insert ON public.costing_tra FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));
CREATE POLICY costing_tra_update ON public.costing_tra FOR UPDATE TO authenticated USING (can_access_project(project_id));
CREATE POLICY costing_tra_delete ON public.costing_tra FOR DELETE TO authenticated USING (can_access_project(project_id));

CREATE TRIGGER costing_tra_set_updated_at BEFORE UPDATE ON public.costing_tra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_costing_tra_project_month ON public.costing_tra(project_id, month);
