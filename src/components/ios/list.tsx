import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Chevron } from "./icons";

/** Inset grouped list section (header, rows, footer). */
export function Group({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ios-group">
      {header ? <h2 className="ios-group-header">{header}</h2> : null}
      <div className="ios-list">{children}</div>
      {footer ? <p className="ios-group-footer">{footer}</p> : null}
    </section>
  );
}

type RowProps = {
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  lead?: ReactNode;
};

function RowInner({
  title,
  sub,
  value,
  lead,
  chevron,
}: RowProps & { chevron?: boolean }) {
  return (
    <>
      {lead}
      <span className="ios-row-main">
        <span>{title}</span>
        {sub ? <span className="ios-row-sub">{sub}</span> : null}
      </span>
      {value ? <span className="ios-row-value">{value}</span> : null}
      {chevron ? <Chevron /> : null}
    </>
  );
}

export function Row(props: RowProps & { href?: string }) {
  if (props.href)
    return (
      <Link className="ios-row" href={props.href}>
        <RowInner {...props} chevron />
      </Link>
    );
  return (
    <div className="ios-row">
      <RowInner {...props} />
    </div>
  );
}

export function LargeTitle({
  title,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="ios-large-title">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
