import type { ComponentPropsWithRef } from 'react';
import control from '../FormField/control.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: readonly SelectOption[];
}

export type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'children'> & {
  /** Options under group headings (for example Direct / Indirect / Supervision categories). */
  groups: readonly SelectGroup[];
  /** Text of the empty first option. Omit it for a select that always has a value. */
  placeholder?: string;
};

/** A native `<select>` with `<optgroup>` headings, so keyboard and screen reader behavior come from the browser. */
export function Select({ groups, placeholder, className, ...rest }: SelectProps) {
  return (
    <select {...rest} className={[control.control, className].filter(Boolean).join(' ')}>
      {placeholder === undefined ? null : <option value="">{placeholder}</option>}
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
