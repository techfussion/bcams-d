import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { ConnectionIndicator } from '@/components/common/status-indicators';
import { RefreshCw, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { isAnyCapturer } from '@/lib/permissions';

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; path?: string }[];
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user } = useAuthStore();
  const { connection, pendingEvents, lastSyncAt } = useSyncStore();
  const isCapturer = isAnyCapturer(user);

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-white flex-shrink-0">
      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-page-title leading-tight">{title}</h1>
          {subtitle && <p className="text-helper text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      {/* Right: Status + Actions */}
      <div className="flex items-center gap-4">
        {/* Workstation Sync Status: ONLY for active capture workstations (Section 23) */}
        {isCapturer && (
          <button
            onClick={useSyncStore.getState().openSyncModal}
            className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50 focus:outline-none"
            title="Open Local Workstation Sync Center"
          >
            <ConnectionIndicator status={connection} />
            {pendingEvents > 0 ? (
              <div className="flex items-center gap-1 text-warning-600 bg-warning-50 px-2 py-0.5 rounded-full border border-warning-200">
                <RefreshCw className="h-3 w-3 animate-pulse" />
                <span className="text-[11px] font-semibold">{pendingEvents} pending</span>
              </div>
            ) : (
              <span className="text-[11px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Synced
              </span>
            )}
            {lastSyncAt && (
              <div className="hidden sm:flex items-center gap-1 text-helper text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDateTime(lastSyncAt).split(' ')[1] || 'Synced'}</span>
              </div>
            )}
          </button>
        )}

        {/* Separator if both capturer status and actions exist */}
        {isCapturer && actions && <div className="h-6 w-px bg-border" />}

        {/* Actions from page */}
        {actions}
      </div>
    </header>
  );
}
