interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-bg-overlay animate-pulse rounded-lg ${className}`} />
  );
}
