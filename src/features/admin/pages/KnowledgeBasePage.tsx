import { useSearchParams } from "react-router-dom";
import { BookText, FileStack, ScrollText } from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import util from "@/lib/util.json";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { RulesPanel } from "../components/RulesPanel";
import { VocabularyPanel } from "../components/VocabularyPanel";

const t = util.admin;
const TABS = [
  { key: "documentos", label: t.tabs.documents, icon: FileStack },
  { key: "regras", label: t.tabs.rules, icon: ScrollText },
  { key: "vocabulario", label: t.tabs.vocabulary, icon: BookText },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** Base de conhecimento e regras de domínio da IA. Acesso restrito a administradores (ver AdminRoute). */
export function KnowledgeBasePage() {
  const { user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: TabKey = TABS.find((item) => item.key === params.get("aba"))?.key ?? "documentos";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} logout={logout} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-sm font-medium text-violet-600">{t.page.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{t.page.title}</h1>
        <p className="mt-2 text-slate-500">{t.page.description}</p>

        <div role="tablist" aria-label={t.tabs.label} className="mt-8 flex gap-1 overflow-x-auto border-b border-slate-200">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`admin-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`admin-panel-${key}`}
              onClick={() => setParams(key === "documentos" ? {} : { aba: key }, { replace: true })}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
                tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <section role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} className="mt-6">
          {tab === "documentos" && <DocumentsPanel />}
          {tab === "regras" && <RulesPanel />}
          {tab === "vocabulario" && <VocabularyPanel />}
        </section>
      </main>
    </div>
  );
}
