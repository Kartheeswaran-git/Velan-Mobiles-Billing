export default function Button({ children, variant = "primary", ...props }) {
  return (
    <button
      className={`btn ${variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary"}`}
      {...props}
    >
      {children}
    </button>
  );
}
