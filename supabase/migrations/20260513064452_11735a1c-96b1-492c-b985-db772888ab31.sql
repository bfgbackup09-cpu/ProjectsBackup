
CREATE TABLE public.tracking_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX idx_tracking_columns_project ON public.tracking_columns(project_id, position);

CREATE TABLE public.tracking_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  panel_id uuid NOT NULL,
  column_id uuid NOT NULL REFERENCES public.tracking_columns(id) ON DELETE CASCADE,
  value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (panel_id, column_id)
);
CREATE INDEX idx_tracking_cells_project ON public.tracking_cells(project_id);
CREATE INDEX idx_tracking_cells_panel ON public.tracking_cells(panel_id);

ALTER TABLE public.tracking_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracking_columns_select ON public.tracking_columns FOR SELECT TO authenticated USING (can_access_project(project_id));
CREATE POLICY tracking_columns_insert ON public.tracking_columns FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));
CREATE POLICY tracking_columns_update ON public.tracking_columns FOR UPDATE TO authenticated USING (can_access_project(project_id));
CREATE POLICY tracking_columns_delete ON public.tracking_columns FOR DELETE TO authenticated USING (can_access_project(project_id));

CREATE POLICY tracking_cells_select ON public.tracking_cells FOR SELECT TO authenticated USING (can_access_project(project_id));
CREATE POLICY tracking_cells_insert ON public.tracking_cells FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));
CREATE POLICY tracking_cells_update ON public.tracking_cells FOR UPDATE TO authenticated USING (can_access_project(project_id));
CREATE POLICY tracking_cells_delete ON public.tracking_cells FOR DELETE TO authenticated USING (can_access_project(project_id));

CREATE OR REPLACE FUNCTION public.recalc_panel_produced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.panel_id, OLD.panel_id);
  UPDATE public.panels
    SET total_produced = COALESCE((SELECT SUM(value) FROM public.tracking_cells WHERE panel_id = pid), 0),
        updated_at = now()
    WHERE id = pid;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_tracking_cells_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.tracking_cells
FOR EACH ROW EXECUTE FUNCTION public.recalc_panel_produced();
