export function formatCurrency(value = 0) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function toDateObject(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

export function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = toDateObject(timestamp);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function isSameDay(value, comparison = new Date()) {
  const left = toDateObject(value);
  const right = toDateObject(comparison);
  if (!left || !right) return false;
  return left.toDateString() === right.toDateString();
}

export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function calculateBillSummary(items, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const total = subtotal - Number(discount || 0);
  return { subtotal, total };
}

export function computeLedgerSummary(entries) {
  let income = 0;
  let expense = 0;
  entries.forEach((entry) => {
    if (entry.type === "income") income += Number(entry.amount || 0);
    if (entry.type === "expense") expense += Number(entry.amount || 0);
  });
  return {
    opening: 0,
    income,
    expense,
    closing: income - expense,
  };
}
