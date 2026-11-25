import { useEffect } from "react";
import util from "@/lib/util.json";

/** Atualiza o título da aba, que também é anunciado por leitores de tela. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${util.brand.name}` : util.brand.name;
  }, [title]);
}
