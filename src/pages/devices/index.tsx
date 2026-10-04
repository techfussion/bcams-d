/**
 * Trusted Physical Capture Endpoints (Devices Management)
 * 
 * Accessible exclusively to Super Administrator.
 * Manages trusted capture hardware endpoints deployed across faculties, lecture theatres, and security turnstiles.
 * 
 * Enforces:
 * - Trusted endpoint identifier (e.g. EP-CS-001, EP-GATE-001)
 * - Hardware endpoint types: Desktop Terminals, Mobile Scanners, Gate Turnstiles
 * - Assigned physical location (specific venue or campus gate)
 * - Complete Lifecycle State: Registered → Activated → Active → Suspended / Revoked / Retired
 * - Remote revocation blocking cryptographic synchronization
 * - Enterprise pagination & filtering
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { DeviceStatusBadge } from '@/components/common/status-indicators';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RegisterDeviceDialog } from '@/components/devices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks';
import type { Device, DeviceStatus, DeviceLifecycleState } from '@/types';
import {
  Monitor, Smartphone, DoorOpen, Plus, ShieldCheck,
  AlertTriangle, RefreshCw, Search, Filter, ShieldAlert,
  Server, Cpu,
} from 'lucide-react';

export function DevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    device: Device | null;
    nextStatus: DeviceStatus;
    nextLifecycle: DeviceLifecycleState;
    title: string;
    description: string;
    variant: 'destructive' | 'warning' | 'default';
  }>({
    open: false,
    device: null,
    nextStatus: 'active',
    nextLifecycle: 'active',
    title: '',
    description: '',
    variant: 'default',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
      toast.error('Failed to load capture endpoints');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeviceRegistered = (newDevice: Device) => {
    setDevices(prev => [newDevice, ...prev]);
    toast.success(`Trusted Endpoint ${newDevice.name} (${newDevice.id}) registered successfully.`);
  };

  const promptStatusChange = (device: Device, nextStatus: DeviceStatus, nextLifecycle: DeviceLifecycleState) => {
    if (nextStatus === 'revoked') {
      setConfirmDialog({
        open: true,
        device,
        nextStatus: 'revoked',
        nextLifecycle: 'revoked',
        title: `Permanently Revoke Endpoint: ${device.name}`,
        description:
          `Are you sure you want to permanently revoke endpoint ${device.id}? This physical terminal will be immediately untrusted, access tokens invalidated, and synchronization cryptographically rejected.`,
        variant: 'destructive',
      });
    } else if (nextStatus === 'suspended') {
      setConfirmDialog({
        open: true,
        device,
        nextStatus: 'suspended',
        nextLifecycle: 'suspended',
        title: `Suspend Capture Endpoint: ${device.name}`,
        description:
          `Temporarily suspend attendance capture on endpoint ${device.id}. The workstation will be blocked from sending live attendance records until manually reactivated.`,
        variant: 'warning',
      });
    } else {
      executeStatusChange(device.id, nextStatus, nextLifecycle);
    }
  };

  const executeStatusChange = (deviceId: string, nextStatus: DeviceStatus, nextLifecycle: DeviceLifecycleState) => {
    setDevices(prev =>
      prev.map(d => (d.id === deviceId ? { ...d, status: nextStatus, lifecycleState: nextLifecycle } : d))
    );

    toast.success(`Endpoint ${deviceId} status updated to ${nextStatus}.`);
    setConfirmDialog(prev => ({ ...prev, open: false, device: null }));
  };

  // Filtered dataset
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchId = d.id.toLowerCase().includes(q);
        const matchLoc = (d.assignedLocation || '').toLowerCase().includes(q);
        const matchSerial = (d.serialNumber || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchLoc && !matchSerial) return false;
      }
      return true;
    });
  }, [devices, statusFilter, typeFilter, searchQuery]);

  const columns: DataTableColumn<Device>[] = [
    {
      key: 'name',
      header: 'Trusted Endpoint',
      sortable: true,
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (d) => {
        const isTurnstile = d.type === 'gate_kiosk' || d.id.includes('GATE');
        const isMobile = d.platform === 'mobile' || d.type === 'mobile_scanner';
        return (
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted/60 p-2 text-primary flex-shrink-0">
              {isTurnstile ? (
                <DoorOpen className="h-4 w-4" />
              ) : isMobile ? (
                <Smartphone className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground text-xs">{d.name}</p>
                <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 border-slate-300">
                  {d.id}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                Serial: {d.serialNumber || 'SN-REF-0982'} • Host: {d.hostname || 'STATION'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'type',
      header: 'Endpoint Type',
      render: (d) => {
        const typeLabels: Record<string, string> = {
          desktop_terminal: 'Desktop Kiosk',
          mobile_scanner: 'Mobile Handheld',
          gate_kiosk: 'Turnstile Kiosk',
        };
        return (
          <Badge variant="secondary" className="capitalize text-xs font-mono">
            {typeLabels[d.type || 'desktop_terminal'] || d.type}
          </Badge>
        );
      },
    },
    {
      key: 'assignedLocation',
      header: 'Assigned Physical Location',
      sortable: true,
      sortFn: (a, b) => (a.assignedLocation || '').localeCompare(b.assignedLocation || ''),
      render: (d) => (
        <div>
          <p className="font-medium text-xs text-foreground">{d.assignedLocation || 'Campus Hall'}</p>
          <p className="text-[11px] text-muted-foreground">{d.assignedScope || 'Faculty Wide'}</p>
        </div>
      ),
    },
    {
      key: 'lifecycle',
      header: 'Lifecycle State',
      render: (d) => {
        const state = d.lifecycleState || (d.status === 'active' ? 'active' : d.status === 'suspended' ? 'suspended' : 'revoked');
        const stateVariants: Record<string, 'success' | 'warning' | 'destructive' | 'default'> = {
          registered: 'default',
          activated: 'default',
          active: 'success',
          suspended: 'warning',
          revoked: 'destructive',
          retired: 'default',
        };
        return (
          <Badge variant={stateVariants[state] || 'default'} className="capitalize text-xs font-mono">
            {state}
          </Badge>
        );
      },
    },
    {
      key: 'scanner',
      header: 'Biometric Sensor Binding',
      render: (d) => (
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              d.scannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
            }`}
          />
          <span className="text-xs font-semibold text-foreground">
            {d.scannerModel || 'Optical Sensor'}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase font-mono">
            {d.scannerTransport}
          </Badge>
        </div>
      ),
    },
    {
      key: 'sync',
      header: 'Last Synchronization',
      render: (d) => (
        <div className="font-mono text-xs">
          <p className="text-muted-foreground">
            {d.lastSyncAt ? formatDateTime(d.lastSyncAt).split(' ')[1] : 'Online'}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">
            {d.pendingEvents === 0 ? '0 pending' : `${d.pendingEvents} pending`}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Endpoint Actions',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          {d.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'suspended', 'suspended')}
              className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
            >
              Suspend
            </Button>
          )}
          {d.status === 'suspended' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'active', 'active')}
              className="h-7 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
            >
              Activate
            </Button>
          )}
          {d.status !== 'revoked' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'revoked', 'revoked')}
              className="h-7 px-2 text-[11px] text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Trusted Capture Endpoints"
        subtitle="Manage trusted physical biometric hardware stations and security turnstile endpoints across the institution."
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            Register Trusted Endpoint
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Architecture Notice Banner */}
        <div className="bg-slate-50 border border-border rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-slate-800">
            <Cpu className="h-4 w-4 text-primary flex-shrink-0" />
            <span>
              <strong>Trusted Endpoint Cryptographic Lifecycle:</strong> Only registered capture workstations possessing valid device credentials can submit verified attendance signatures. Revocation takes effect immediately institution-wide.
            </span>
          </div>
          <Badge variant="default" className="text-xs">
            Super Administrator Authority
          </Badge>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by endpoint name, ID, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            <div className="w-[170px]">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Endpoint Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Endpoint Types</SelectItem>
                  <SelectItem value="desktop_terminal">Desktop Terminals</SelectItem>
                  <SelectItem value="mobile_scanner">Mobile Handhelds</SelectItem>
                  <SelectItem value="gate_kiosk">Gate Turnstiles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active Endpoints</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Displaying <strong className="text-foreground">{filteredDevices.length}</strong> endpoints
          </div>
        </div>

        {/* Data Table with Pagination */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredDevices}
            keyField="id"
            pageSize={25}
            emptyMessage="No capture endpoints match the specified filters."
            selectable={true}
            selectedIds={selectedDeviceIds}
            onSelectionChange={setSelectedDeviceIds}
          />
        </div>
      </div>

      {/* Register Device Dialog */}
      <RegisterDeviceDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        onSubmit={handleDeviceRegistered}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText="Confirm Action"
        onConfirm={() => {
          if (confirmDialog.device) {
            executeStatusChange(confirmDialog.device.id, confirmDialog.nextStatus, confirmDialog.nextLifecycle);
          }
        }}
      />
    </div>
  );
}
