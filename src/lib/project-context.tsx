import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  name: string;
  customer: string | null;
  end_customer: string | null;
  oem: string | null;
  site: string | null;
  scope: string | null;
  po_fe: string | null;
  po_cab: string | null;
  trainsets: number | null;
  start_date: string | null;
  end_date: string | null;
};

interface Ctx {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
}

const ProjectCtx = createContext<Ctx>({ projects: [], activeProject: null, setActiveProjectId: () => {}, loading: true, refetch: () => {} });

export function ProjectProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("active_project_id") : null
  );

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });

  useEffect(() => {
    if (!projects.length) return;
    if (!activeId || !projects.find((p) => p.id === activeId)) {
      setActiveId(projects[0].id);
      localStorage.setItem("active_project_id", projects[0].id);
    }
  }, [projects, activeId]);

  const setActiveProjectId = (id: string) => {
    setActiveId(id);
    localStorage.setItem("active_project_id", id);
    qc.invalidateQueries();
  };

  const activeProject = projects.find((p) => p.id === activeId) ?? null;

  return (
    <ProjectCtx.Provider value={{ projects, activeProject, setActiveProjectId, loading: isLoading, refetch }}>
      {children}
    </ProjectCtx.Provider>
  );
}

export const useProject = () => useContext(ProjectCtx);
