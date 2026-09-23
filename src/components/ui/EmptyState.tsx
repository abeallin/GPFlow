interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  /** One line saying what will appear here, and where it comes from. */
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="text-text-muted mb-4 [&>svg]:w-10 [&>svg]:h-10" aria-hidden="true">{icon}</div>
      <p className="text-base font-semibold text-text-primary mb-1">{title}</p>
      <p className="text-sm text-text-secondary max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
