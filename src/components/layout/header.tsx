/**
 * BCAMS Application Header
 * 
 * Top bar with page title, sync status, role switcher (dev), and notifications area.
 */
import React from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { ConnectionIndicator, ScannerStatusIndicator } from '@/components/common/status-indicators';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, RefreshCw, Clock } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { UserRole } from '@/types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; path?: string }[];
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { connection, pendingEvents, lastSyncAt } = useSyncStore();

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
        {/* Sync info & interactive center trigger */}
        <button
          onClick={useSyncStore.getState().openSyncModal}
          className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50 focus:outline-none"
          title="Open Sync & Clock Integrity Center"
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

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* Notifications placeholder */}
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {pendingEvents > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-medium">
              {pendingEvents}
            </span>
          )}
        </Button>

        {/* Actions from page */}
        {actions}
      </div>
    </header>
  );
}
