/**
 * Inline error card — frontend.md §4.4. Border in status-error with a tinted
 * background; shows only the sanitized `error.message` from the API, never a
 * raw stack trace. Optional retry action for transient failures.
 */
export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-status-error bg-[#B91C1C1F] p-6" role="alert">
      <div className="flex items-center gap-2">
        <span className="text-status-error" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16.5v.01" />
          </svg>
        </span>
        <p className="text-body-sm font-medium text-status-error">Something went wrong</p>
      </div>
      <p className="text-body-sm text-text-secondary">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary btn-small self-start">
          Try again
        </button>
      ) : null}
    </div>
  );
}
