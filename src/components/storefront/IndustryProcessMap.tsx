import {
  Activity,
  ArrowLeftRight,
  Boxes,
  Cog,
  Droplets,
  Flame,
  Gauge,
  Layers,
  Package,
  Ruler,
  ScanLine,
  Settings,
  ShieldCheck,
  Truck,
  Wind,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INDUSTRY_EXPERIENCE } from "../../data/industryExperience";
import type { IndustryPageSlug, IndustryStageContent } from "../../data/industryPageDetails";

type Props = {
  industry: IndustryPageSlug;
  stages: readonly IndustryStageContent[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

const STAGE_ICONS: Record<IndustryPageSlug, LucideIcon[]> = {
  ceramic: [Boxes, Settings, Gauge, Wind, Layers, Flame, ScanLine, Package],
  textile: [Layers, Cog, Activity, Wind, Droplets, Package],
  packaging: [Boxes, Settings, Layers, ScanLine, Cog, Package, ArrowLeftRight, Truck],
  food: [Boxes, Droplets, Flame, Gauge, Package, ScanLine, Truck],
  machinery: [Ruler, Settings, Cog, Wrench, ArrowLeftRight, Activity, ShieldCheck],
  rubber: [Boxes, Settings, Gauge, Flame, Wind, Package],
};

export function IndustryProcessMap({ industry, stages, activeIndex, onSelect }: Props) {
  const experience = INDUSTRY_EXPERIENCE[industry];
  const icons = STAGE_ICONS[industry];
  const activeStage = stages[activeIndex] || stages[0];

  if (!stages.length) return null;

  return (
    <section
      className={"ipt-process-map ipt-process-map--" + experience.layout}
      aria-label={"نقشه مراحل تولید؛ " + experience.title}
      data-layout={experience.layout}
    >
      <header className="ipt-process-map__header">
        <div className="ipt-process-map__heading">
          <span className="ipt-process-map__eyebrow">{experience.kicker}</span>
          <h3>{experience.title}</h3>
          <p>{experience.description}</p>
        </div>
        <div className="ipt-process-map__count" aria-label={stages.length + " ایستگاه تولید"}>
          <strong>{stages.length.toLocaleString("fa-IR")}</strong>
          <span>ایستگاه</span>
        </div>
      </header>

      <div className="ipt-process-map__canvas">
        <div className="ipt-process-map__guide" aria-hidden="true" />
        <div className="ipt-stage-tabs" role="tablist" aria-label="انتخاب ایستگاه خط تولید">
          {stages.map((stage, index) => {
            const Icon = icons[index % icons.length];
            const selected = activeIndex === index;
            return (
              <button
                key={stage.title}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="ipt-stage-panel"
                aria-label={"نمایش جزئیات " + stage.title}
                data-stage-title={stage.title}
                onClick={() => onSelect(index)}
                className={"ipt-process-node" + (selected ? " is-active" : "")}
              >
                <span className="ipt-process-node__top">
                  <span className="ipt-process-node__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ipt-process-node__icon"><Icon size={18} strokeWidth={1.8} /></span>
                </span>
                <span className="ipt-process-node__copy">
                  <strong>{stage.title}</strong>
                  <small>{stage.subtitle}</small>
                </span>
                <span className="ipt-process-node__state">{selected ? "مرحله انتخاب‌شده" : "مشاهده جزئیات"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="ipt-process-map__footer">
        <span>نمای شماتیک مسیر فرایند؛ نه نقشه اجرایی کارخانه</span>
        {activeStage && (
          <strong>
            ایستگاه {String(activeIndex + 1).padStart(2, "0")} / {stages.length.toLocaleString("fa-IR")} · {activeStage.title}
          </strong>
        )}
      </footer>
    </section>
  );
}
