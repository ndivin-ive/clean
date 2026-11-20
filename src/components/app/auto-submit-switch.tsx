"use client";

/** iOS-style switch that submits its form as soon as it changes (works without JS via the form's submit button). */
export function AutoSubmitSwitch({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <span className="ios-switch">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        aria-label={label}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      <i />
    </span>
  );
}
