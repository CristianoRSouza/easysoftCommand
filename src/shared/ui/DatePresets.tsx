import {
  DATE_PRESETS,
  DATE_PRESET_LABEL,
  matchingPreset,
  presetRange,
} from "@/shared/domain/date-presets";
import type { DateRange } from "@/shared/domain/paging";

/**
 * Atalhos de período.
 *
 * O botão fica marcado quando o período em uso é exatamente o dele. Digitar
 * as mesmas datas à mão também acende o atalho — é o mesmo período, e fingir
 * que não é confundiria quem acabou de escolher.
 */
export function DatePresets({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const atual = matchingPreset(range);

  return (
    <div className="flex flex-wrap gap-2">
      {DATE_PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(presetRange(preset))}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            atual === preset
              ? "bg-gradient-primary font-medium text-primary-foreground"
              : "border border-border hover:bg-secondary"
          }`}
        >
          {DATE_PRESET_LABEL[preset]}
        </button>
      ))}
    </div>
  );
}
