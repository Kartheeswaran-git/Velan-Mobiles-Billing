export default function Loader({ text = "Loading..." }) {
  return (
    <div className="panel">
      <div className="muted">{text}</div>
    </div>
  );
}
