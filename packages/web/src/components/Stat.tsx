interface StatProps {
  icon: string;
  label: string;
  value: string;
}

export function Stat({ icon, label, value }: StatProps) {
  return (
    <div class="stat">
      <span class="stat__icon">{icon}</span>
      <span class="stat__label">{label}</span>
      <span class="stat__value">{value}</span>
    </div>
  );
}
