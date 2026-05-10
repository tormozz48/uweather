interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div class="error-card">
      <span class="error-card__icon">😕</span>
      <p class="error-card__message">{message}</p>
      <button type="button" class="error-card__retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
