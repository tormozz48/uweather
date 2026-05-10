import { SkeletonCard } from './SkeletonCard.js';

export function LoadingSection() {
  return (
    <div class="loading-section">
      <SkeletonCard />
      <p class="loading-section__hint">
        Consulting 3 weather services and generating a custom image… this takes 15–30 seconds.
      </p>
    </div>
  );
}
