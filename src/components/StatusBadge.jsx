export default function StatusBadge({ value }) {
  const label = String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const tone =
    value === "available" || value === "income" || value === "ready" || value === "active"
      ? "success"
      : value === "sold" || value === "delivered"
        ? "info"
        : value === "expense" || value === "damaged" || value === "inactive"
          ? "danger"
          : "warning";

  return <span className={`badge ${tone}`}>{label}</span>;
}
