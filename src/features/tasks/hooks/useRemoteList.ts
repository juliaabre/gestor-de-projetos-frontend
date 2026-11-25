import { useCallback, useEffect, useState } from "react";
import { getErrorMessage, isUnavailable } from "@/lib/apiError";

type State<T> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "success"; items: T[] };

export function useRemoteList<T>(loader: () => Promise<T[]>, errorFallback: string) {
  const [state, setState] = useState<State<T>>({ status: "loading" });

  const reload = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    loader()
      .then((items) => active && setState({ status: "success", items }))
      .catch((error) => {
        if (!active) return;
        setState(
          isUnavailable(error)
            ? { status: "unavailable" }
            : { status: "error", message: getErrorMessage(error, errorFallback) },
        );
      });
    return () => {
      active = false;
    };
  }, [loader, errorFallback]);

  useEffect(reload, [reload]);

  const add = useCallback((item: T, position: "start" | "end" = "end") => {
    setState((prev) => {
      const items = prev.status === "success" ? prev.items : [];
      return {
        status: "success",
        items: position === "start" ? [item, ...items] : [...items, item],
      };
    });
  }, []);

  /** Aplica uma alteração local à lista carregada (inserção, edição ou remoção). */
  const update = useCallback((fn: (items: T[]) => T[]) => {
    setState((prev) => (prev.status === "success" ? { status: "success", items: fn(prev.items) } : prev));
  }, []);

  /** Recarrega sem voltar ao estado de carregamento; falhas mantêm os dados atuais. */
  const refresh = useCallback(async () => {
    try {
      const items = await loader();
      setState({ status: "success", items });
      return true;
    } catch {
      return false;
    }
  }, [loader]);

  return { state, reload, add, update, refresh };
}
