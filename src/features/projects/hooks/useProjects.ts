import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/apiError";
import util from "@/lib/util.json";
import { listProjects } from "../services/projectService";
import type { Project } from "../types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; projects: Project[] };

export function useProjects() {
  const [state, setState] = useState<State>({ status: "loading" });

  const reload = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    listProjects()
      .then((projects) => active && setState({ status: "success", projects }))
      .catch(
        (error) =>
          active &&
          setState({
            status: "error",
            message: getErrorMessage(error, util.projects.list.loadError),
          }),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(reload, [reload]);

  const upsert = useCallback((project: Project) => {
    setState((prev) => {
      if (prev.status !== "success") return prev;
      const exists = prev.projects.some((p) => p.id === project.id);
      return {
        status: "success",
        projects: exists
          ? prev.projects.map((p) => (p.id === project.id ? project : p))
          : [project, ...prev.projects],
      };
    });
  }, []);

  return { state, reload, upsert };
}
