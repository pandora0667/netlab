import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

export interface GuidedTroubleshootingItem {
  title: string;
  detail: string;
  nextStep?: string;
  tone?: "info" | "warn" | "good";
}

interface GuidedTroubleshootingProps {
  title?: string;
  items: GuidedTroubleshootingItem[];
}

function resolveToneClasses(tone: GuidedTroubleshootingItem["tone"]) {
  if (tone === "good") {
    return {
      icon: CheckCircle2,
      accent: "text-emerald-300",
      border: "border-emerald-400/15",
      surface: "bg-emerald-400/[0.05]",
    };
  }

  if (tone === "warn") {
    return {
      icon: AlertTriangle,
      accent: "text-amber-300",
      border: "border-amber-400/15",
      surface: "bg-amber-400/[0.05]",
    };
  }

  return {
    icon: Sparkles,
    accent: "text-cyan-200",
    border: "border-cyan-400/15",
    surface: "bg-cyan-400/[0.05]",
  };
}

export function GuidedTroubleshooting({
  title = "Guided troubleshooting",
  items,
}: GuidedTroubleshootingProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="tool-surface space-y-4">
      <div className="space-y-2">
        <span className="tool-kicker">Next steps</span>
        <h2 className="tool-heading">{title}</h2>
        <p className="tool-copy">
          Use the current result state to decide what to inspect next instead of
          guessing which tool to open.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const tone = resolveToneClasses(item.tone);
          const Icon = tone.icon;

          return (
            <article
              key={`${item.title}-${item.nextStep ?? ""}`}
              className={`rounded-[1.35rem] border ${tone.border} ${tone.surface} p-4`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 ${tone.accent}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 space-y-2">
                  <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                  <p className="text-sm leading-7 text-white/64">{item.detail}</p>
                  {item.nextStep ? (
                    <p className="flex items-start gap-2 text-xs uppercase tracking-[0.18em] text-white/44">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{item.nextStep}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
