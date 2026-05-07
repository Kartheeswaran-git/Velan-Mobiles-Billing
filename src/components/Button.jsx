export default function Button({ children, variant = "primary", block, ...props }) {
  return (
    <button
      className={`btn ${variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary"} ${block ? "btn-block" : ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
