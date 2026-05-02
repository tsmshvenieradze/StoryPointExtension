// src/ui/Dropdown3.tsx — Source: D-09, D-10, UI-03; UI-SPEC §Three Dropdowns.
// Typed wrapper around azure-devops-ui Dropdown — value/onChange API hides
// the ListSelection mutation surface. FormItem provides the visible label.
import * as React from "react";
import { Dropdown } from "azure-devops-ui/Dropdown";
import { FormItem as FormItemRaw } from "azure-devops-ui/FormItem";
import { ListSelection } from "azure-devops-ui/List";
import type { IListBoxItem } from "azure-devops-ui/ListBox";
import { LEVELS, type Level } from "../calc";

// Stale-types narrowing — same pattern Phase 2 used for Page in src/entries/modal.tsx:28-30.
// FormItem's IFormItemProps does not declare `children`, but the runtime
// React.Component renders them. Type-only narrowing — no runtime change.
const FormItem = FormItemRaw as unknown as React.FC<
  React.ComponentProps<typeof FormItemRaw> & { children?: React.ReactNode }
>;

const ITEMS: IListBoxItem<{ level: Level }>[] = LEVELS.map((level) => ({
  id: level,
  text: level,
  data: { level },
}));

interface Props {
  label: string;          // visible FormItem label ("Complexity" / "Uncertainty" / "Effort")
  ariaLabel: string;      // screen-reader label ("Complexity level" / etc.)
  value: Level | undefined;
  onChange: (level: Level) => void;
  disabled?: boolean;
}

export const Dropdown3: React.FC<Props> = ({ label, ariaLabel, value, onChange, disabled }) => {
  // ListSelection is a stateful object; mount-time-only per the ListBox contract.
  const selection = React.useMemo(() => new ListSelection(), []);

  // Sync external value → selection (controlled-style).
  React.useEffect(() => {
    selection.clear();
    if (value !== undefined) {
      const idx = LEVELS.indexOf(value);
      if (idx >= 0) {
        selection.select(idx);
      }
    }
  }, [value, selection]);

  // exactOptionalPropertyTypes (tsconfig strict) rejects `boolean | undefined`
  // for a `disabled?: boolean` target. Pass the prop only when defined.
  const dropdownProps = {
    items: ITEMS,
    placeholder: "Select level…",
    selection,
    ariaLabel,
    onSelect: (_event: React.SyntheticEvent<HTMLElement>, item: IListBoxItem<{ level: Level }>) => {
      if (item?.data?.level) {
        onChange(item.data.level);
      }
    },
    ...(disabled !== undefined ? { disabled } : {}),
  };

  return (
    <FormItem label={label}>
      <Dropdown<{ level: Level }> {...dropdownProps} />
    </FormItem>
  );
};
