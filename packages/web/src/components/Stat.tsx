interface StatProps {
  icon: string;
  label: string;
  value: string;
}

export function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="stat">
      <span className="stat__icon">{icon}</span>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  );
}
