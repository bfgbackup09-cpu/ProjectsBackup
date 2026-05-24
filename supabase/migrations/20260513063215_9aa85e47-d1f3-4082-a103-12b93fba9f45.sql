
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Project ownership
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.set_project_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_project_owner ON public.projects;
CREATE TRIGGER trg_set_project_owner BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_owner();

CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.created_by = auth.uid()
  )
$$;

-- 3. Replace permissive policies
-- projects
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- helper to apply project-scoped policies
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'panels','deliveries','costing_entries','monthly_plans','daily_production',
    'one_pager_financials','one_pager_updates','ecr_status',
    'monthly_manufacturing','outstanding_balance_weekly'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    -- some tables had short names like ecr_select etc; drop by lookup
  END LOOP;
END $$;

-- Drop short-named legacy policies explicitly
DROP POLICY IF EXISTS ecr_select ON public.ecr_status;
DROP POLICY IF EXISTS ecr_insert ON public.ecr_status;
DROP POLICY IF EXISTS ecr_update ON public.ecr_status;
DROP POLICY IF EXISTS ecr_delete ON public.ecr_status;
DROP POLICY IF EXISTS mm_select ON public.monthly_manufacturing;
DROP POLICY IF EXISTS mm_insert ON public.monthly_manufacturing;
DROP POLICY IF EXISTS mm_update ON public.monthly_manufacturing;
DROP POLICY IF EXISTS mm_delete ON public.monthly_manufacturing;
DROP POLICY IF EXISTS obw_select ON public.outstanding_balance_weekly;
DROP POLICY IF EXISTS obw_insert ON public.outstanding_balance_weekly;
DROP POLICY IF EXISTS obw_update ON public.outstanding_balance_weekly;
DROP POLICY IF EXISTS obw_delete ON public.outstanding_balance_weekly;
DROP POLICY IF EXISTS opf_select ON public.one_pager_financials;
DROP POLICY IF EXISTS opf_insert ON public.one_pager_financials;
DROP POLICY IF EXISTS opf_update ON public.one_pager_financials;
DROP POLICY IF EXISTS opf_delete ON public.one_pager_financials;

-- Create new project-scoped policies for each
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'panels','deliveries','costing_entries','monthly_plans','daily_production',
    'one_pager_financials','one_pager_updates','ecr_status',
    'monthly_manufacturing','outstanding_balance_weekly'
  ]) LOOP
    EXECUTE format($f$CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.can_access_project(project_id))$f$, t, t);
    EXECUTE format($f$CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_access_project(project_id))$f$, t, t);
    EXECUTE format($f$CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.can_access_project(project_id))$f$, t, t);
    EXECUTE format($f$CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (public.can_access_project(project_id))$f$, t, t);
  END LOOP;
END $$;

-- Auto-assign 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill: give existing users 'user' role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT DO NOTHING;
