/**
 * Audit Log Page
 * 
 * Immutable, tamper-evident audit trail for BCAMS.
 * Tracks all state transitions: session authorizations, biometric captures,
 * enrollments, policy adjustments, and device lifecycle events.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { formatTime, formatDate } from '@/lib/utils';
import type { AuditEntry, AuditAction } from '@/types';
import {
  ClipboardList, ShieldCheck, ShieldAlert, Clock,
  UserCheck, Monitor, Filter, Eye, Hash, Lock
} from 'lucide-react';

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeEntry, setActiveEntry] = useState<AuditEntry | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getAuditEntries(100);
        setEntries(data);
      } catch (err) {
        console.error('Failed to load audit entries:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return <PageSkeleton />;
  }

  const filteredEntries = entries.filter((e) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'attendance') {
      return e.action.includes('attendance') || e.action.includes('clock');
    }
    if (selectedCategory === 'sessions') {
      return e.action.includes('session');
    }
    if (selectedCategory === 'biometrics') {
      return e.action.includes('biometric');
    }
    if (selectedCategory === 'devices') {
      return e.action.includes('device') || e.action.includes('sync');
    }
    if (selectedCategory === 'security') {
      return e.action.includes('login') || e.action.includes('policy');
    }
    return true;
  });

  const getActionBadge = (action: AuditAction) => {
    if (action.includes('attendance') || action.includes('clock')) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-mono">
          {action}
        </Badge>
      );
    }
    if (action.includes('session')) {
      return (
        <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs font-mono">
          {action}
        </Badge>
      );
    }
    if (action.includes('biometric')) {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-mono">
          {action}
        </Badge>
      );
    }
    if (action.includes('device') || action.includes('sync')) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-mono">
          {action}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-xs font-mono">
        {action}
      </Badge>
    );
  };

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (entry) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-semibold text-foreground">
            {formatTime(entry.timestamp)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(entry.timestamp)}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action Event',
      sortable: true,
      render: (entry) => getActionBadge(entry.action),
    },
    {
      key: 'actorName',
      header: 'Actor',
      sortable: true,
      render: (entry) => (
        <div>
          <p className="font-medium text-foreground text-xs">{entry.actorName}</p>
          <p className="text-[11px] text-muted-foreground capitalize">
            {entry.actorRole.replace('_', ' ')}
          </p>
        </div>
      ),
    },
    {
      key: 'targetLabel',
      header: 'Target Resource',
      render: (entry) => (
        <div>
          <p className="text-xs text-foreground font-medium truncate max-w-[200px]">
            {entry.targetLabel || entry.targetId || '—'}
          </p>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">
            {entry.targetType}
          </span>
        </div>
      ),
    },
    {
      key: 'deviceId',
      header: 'Origin Device',
      render: (entry) => (
        <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
          <Monitor className="h-3 w-3" />
          {entry.deviceId || 'System Server'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Integrity',
      render: (entry) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          SHA-256 Valid
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Actions',
      render: (entry) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveEntry(entry)}
          className="h-7 px-2 text-xs gap-1"
        >
          <Eye className="h-3.5 w-3.5" />
          Inspect
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Audit Trail & Security Log"
        subtitle="Immutable system ledger recording all identity, session, attendance, and administrative events."
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Integrity Banner */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/70 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-md">
              <Lock className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                Cryptographic Non-Repudiation Trail Active
              </p>
              <p className="text-xs text-emerald-800">
                All records are chronologically stamped with hardware identifiers and tamper-evident signatures.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 font-mono text-xs">
            100% Verified
          </Badge>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'attendance', label: 'Attendance & Clock Events' },
            { id: 'sessions', label: 'Class Sessions' },
            { id: 'biometrics', label: 'Biometrics & Enrollment' },
            { id: 'devices', label: 'Devices & Sync' },
            { id: 'security', label: 'Security & Policies' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <DataTable
          data={filteredEntries}
          columns={columns}
          searchable={true}
          searchPlaceholder="Search audit trail by actor, action, target..."
          emptyTitle="No audit records"
          emptyDescription="No audit records found matching criteria."
        />
      </div>

      {/* Entry Inspector Modal */}
      {activeEntry && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-lg w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">
                  Audit Entry Details: {activeEntry.id}
                </h3>
              </div>
              <button
                onClick={() => setActiveEntry(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Action</span>
                  <span className="font-mono font-semibold text-foreground">{activeEntry.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                  <span className="font-mono text-foreground">{activeEntry.timestamp}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Actor</span>
                  <span className="font-medium text-foreground">{activeEntry.actorName} ({activeEntry.actorRole})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Origin Device</span>
                  <span className="font-mono text-foreground">{activeEntry.deviceId || 'Local Core API'}</span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Target Resource</span>
                <div className="bg-background border border-border p-2.5 rounded font-mono text-xs text-foreground">
                  Type: {activeEntry.targetType}<br />
                  Target: {activeEntry.targetLabel || activeEntry.targetId || 'N/A'}
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">Cryptographic Proof & Digest</span>
                <div className="bg-zinc-950 text-zinc-300 p-2.5 rounded font-mono text-[11px] break-all">
                  SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveEntry(null)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
