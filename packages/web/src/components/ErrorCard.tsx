interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="error-card">
      <span className="error-card__icon">😕</span>
      <p className="error-card__message">{message}</p>
      <button type="button" className="error-card__retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
