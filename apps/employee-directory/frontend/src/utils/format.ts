const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMAT.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_TIME_FORMAT.format(date);
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD"
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch (err) {
    // Fallback to simple formatting if Intl fails for an unknown currency.
    return value.toFixed(2);
  }
}

export function formatStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(
      (segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
    )
    .join(" ");
}

