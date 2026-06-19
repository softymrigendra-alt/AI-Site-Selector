import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OnlineIndicator() {
  const { isOnline, justReconnected } = useOnlineStatus();

  // When online and not just reconnected, render nothing
  if (isOnline && !justReconnected) return null;

  return (
    <div
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all"
      style={{
        backgroundColor: justReconnected ? '#F0FDF4' : '#FEF2F2',
        color: justReconnected ? '#16A34A' : '#DC2626',
        border: `1px solid ${justReconnected ? '#86EFAC' : '#FCA5A5'}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: justReconnected ? '#16A34A' : '#DC2626' }}
      />
      {justReconnected ? 'Back online' : 'Offline'}
    </div>
  );
}
