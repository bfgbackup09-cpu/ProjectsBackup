-- 1. Add date / invoice / delivery columns to tracking_columns
ALTER TABLE public.tracking_columns
  ADD COLUMN IF NOT EXISTS column_date date,
  ADD COLUMN IF NOT EXISTS invoice_no text,
  ADD COLUMN IF NOT EXISTS delivery_note text;

-- 2. Daily plans table
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  plan_date date NOT NULL,
  planned_qty integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, plan_date)
);
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS daily_plans_select ON public.daily_plans;
DROP POLICY IF EXISTS daily_plans_insert ON public.daily_plans;
DROP POLICY IF EXISTS daily_plans_update ON public.daily_plans;
DROP POLICY IF EXISTS daily_plans_delete ON public.daily_plans;
CREATE POLICY daily_plans_select ON public.daily_plans FOR SELECT TO authenticated USING (can_access_project(project_id));
CREATE POLICY daily_plans_insert ON public.daily_plans FOR INSERT TO authenticated WITH CHECK (can_access_project(project_id));
CREATE POLICY daily_plans_update ON public.daily_plans FOR UPDATE TO authenticated USING (can_access_project(project_id));
CREATE POLICY daily_plans_delete ON public.daily_plans FOR DELETE TO authenticated USING (can_access_project(project_id));

-- 3. Project members (admin assigns projects to users)
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pm_select ON public.project_members;
DROP POLICY IF EXISTS pm_admin_manage ON public.project_members;
CREATE POLICY pm_select ON public.project_members FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'admin') OR user_id = auth.uid()
);
CREATE POLICY pm_admin_manage ON public.project_members FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 4. Expand can_access_project to include members
CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = auth.uid());
$$;

-- 5. Lock down projects: only admin can create/delete; everyone with access can view/update
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated USING (can_access_project(id));
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated USING (can_access_project(id));
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- 6. Recalc helpers + triggers: auto-feed daily_production & monthly_manufacturing from tracking
CREATE OR REPLACE FUNCTION public.recalc_monthly_manufacturing(_project uuid, _month date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actual int; v_planned int;
BEGIN
  SELECT COALESCE(SUM(tc.value),0) INTO v_actual
  FROM public.tracking_cells tc
  JOIN public.tracking_columns col ON col.id = tc.column_id
  WHERE tc.project_id = _project
    AND col.column_date >= _month
    AND col.column_date < (_month + interval '1 month');

  SELECT COALESCE(planned_qty,0) INTO v_planned FROM public.monthly_manufacturing
  WHERE project_id = _project AND month = _month;

  INSERT INTO public.monthly_manufacturing (project_id, month, planned_qty, actual_qty, otd_percent)
  VALUES (_project, _month, COALESCE(v_planned,0), v_actual,
          CASE WHEN COALESCE(v_planned,0) > 0 THEN ROUND((v_actual::numeric / v_planned) * 1000) / 10 ELSE 0 END)
  ON CONFLICT (project_id, month) DO UPDATE SET
    actual_qty = EXCLUDED.actual_qty,
    otd_percent = CASE WHEN public.monthly_manufacturing.planned_qty > 0
      THEN ROUND((EXCLUDED.actual_qty::numeric / public.monthly_manufacturing.planned_qty) * 1000) / 10 ELSE 0 END,
    updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.recalc_daily_from_tracking(_project uuid, _date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total int;
BEGIN
  IF _date IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(tc.value),0) INTO v_total
  FROM public.tracking_cells tc
  JOIN public.tracking_columns col ON col.id = tc.column_id
  WHERE tc.project_id = _project AND col.column_date = _date;

  INSERT INTO public.daily_production (project_id, production_date, produced_qty, notes)
  VALUES (_project, _date, v_total, 'Auto from tracking sheet')
  ON CONFLICT (project_id, production_date) DO UPDATE SET produced_qty = EXCLUDED.produced_qty;

  PERFORM public.recalc_monthly_manufacturing(_project, date_trunc('month', _date)::date);
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recalc_from_cell()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_date date; v_proj uuid; v_col uuid;
BEGIN
  v_col := COALESCE(NEW.column_id, OLD.column_id);
  v_proj := COALESCE(NEW.project_id, OLD.project_id);
  SELECT column_date INTO v_date FROM public.tracking_columns WHERE id = v_col;
  PERFORM public.recalc_daily_from_tracking(v_proj, v_date);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_tracking_cells_recalc_prod ON public.tracking_cells;
CREATE TRIGGER trg_tracking_cells_recalc_prod
AFTER INSERT OR UPDATE OR DELETE ON public.tracking_cells
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_from_cell();

CREATE OR REPLACE FUNCTION public.trg_recalc_from_column()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.column_date IS DISTINCT FROM OLD.column_date THEN
    PERFORM public.recalc_daily_from_tracking(NEW.project_id, OLD.column_date);
    PERFORM public.recalc_daily_from_tracking(NEW.project_id, NEW.column_date);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_daily_from_tracking(OLD.project_id, OLD.column_date);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_daily_from_tracking(NEW.project_id, NEW.column_date);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_tracking_cols_recalc ON public.tracking_columns;
CREATE TRIGGER trg_tracking_cols_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.tracking_columns
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_from_column();

-- 7. Auto-grant admin role to your email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN lower(NEW.email) = 'bfg@bfgplanner.com' THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- 8. If admin user already exists, promote now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'bfg@bfgplanner.com'
ON CONFLICT (user_id, role) DO NOTHING;