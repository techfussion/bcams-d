/**
 * Devices Page
 * 
 * Hardware terminal & mobile scanner management.
 * FR-1.1: Device onboarding and registration
 * FR-1.2: Scope binding (device-to-location/course)
 * FR-1.3: Device revocation and emergency suspension
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { DeviceStatusBadge } from '@/components/common/status-indicators';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { RegisterDeviceDialog } from '@/components/devices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { formatDateTime } from '@/lib/utils';
import { useToast } from '@/hooks';
import type { Device, DeviceStatus } from '@/types';
import {
  Monitor,
  Smartphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export function DevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    device: Device | null;
    nextStatus: DeviceStatus;
    title: string;
    description: string;
    variant: 'destructive' | 'warning' | 'default';
  }>({
    open: false,
    device: null,
    nextStatus: 'active',
    title: '',
    description: '',
    variant: 'default',
  });

  useEffect(() => {
    api.getDevices().then((data) => {
      setDevices(data);
      setIsLoading(false);
    });
  }, []);

  const handleDeviceRegistered = (newDevice: Device) => {
    setDevices([newDevice, ...devices]);
    toast({
      title: 'Device Registered',
      description: `${newDevice.name} (${newDevice.platform}) has been registered and activated.`,
      variant: 'success',
    });
  };

  const promptStatusChange = (device: Device, nextStatus: DeviceStatus) => {
    if (nextStatus === 'revoked') {
      setConfirmDialog({
        open: true,
        device,
        nextStatus: 'revoked',
        title: `Revoke Device: ${device.name}`,
        description:
          'Are you sure you want to permanently revoke this device? Revoking will immediately terminate its access token and block synchronization. This action is recorded in the institutional audit log.',
        variant: 'destructive',
      });
    } else if (nextStatus === 'suspended') {
      setConfirmDialog({
        open: true,
        device,
        nextStatus: 'suspended',
        title: `Suspend Terminal: ${device.name}`,
        description:
          'Temporarily disable attendance capture on this terminal. The device will be blocked from sending sync events until reactivated.',
        variant: 'warning',
      });
    } else {
      executeStatusChange(device.id, nextStatus);
    }
  };

  const executeStatusChange = (deviceId: string, nextStatus: DeviceStatus) => {
    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, status: nextStatus } : d))
    );

    const statusLabels: Record<DeviceStatus, string> = {
      active: 'Activated',
      suspended: 'Suspended',
      revoked: 'Revoked',
      pending: 'Pending',
      retired: 'Retired',
    };

    toast({
      title: `Device ${statusLabels[nextStatus]}`,
      description: `Device terminal status has been updated to ${nextStatus}.`,
      variant: nextStatus === 'revoked' ? 'destructive' : 'default',
    });

    setConfirmDialog((prev) => ({ ...prev, open: false, device: null }));
  };

  const columns: DataTableColumn<Device>[] = [
    {
      key: 'name',
      header: 'Device Terminal',
      sortable: true,
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted/60 p-2">
            {d.platform === 'desktop' ? (
              <Monitor className="h-4 w-4 text-primary" />
            ) : (
              <Smartphone className="h-4 w-4 text-primary" />
            )}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{d.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{d.hostname || d.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (d) => (
        <Badge variant="outline" className="capitalize text-xs font-mono">
          {d.platform}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Lifecycle State',
      render: (d) => <DeviceStatusBadge status={d.status} />,
    },
    {
      key: 'scanner',
      header: 'Biometric Sensor',
      render: (d) => (
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              d.scannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'
            }`}
          />
          <span className="text-xs font-semibold text-foreground">
            {d.scannerModel || 'Scanner'}
          </span>
          <Badge variant="outline" className="text-[10px] uppercase font-mono">
            {d.scannerTransport}
          </Badge>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Assigned Scope',
      render: (d) => <span className="text-xs text-muted-foreground">{d.assignedScope || '—'}</span>,
    },
    {
      key: 'pending',
      header: 'Pending Events',
      render: (d) =>
        d.pendingEvents > 0 ? (
          <Badge variant="warning" className="gap-1 text-xs">
            <RefreshCw className="h-3 w-3 animate-pulse" />
            {d.pendingEvents} unsynced
          </Badge>
        ) : (
          <span className="text-xs text-emerald-600 font-medium font-mono">0 pending</span>
        ),
    },
    {
      key: 'lastSync',
      header: 'Last Sync',
      render: (d) => (
        <span className="text-xs text-muted-foreground font-mono">
          {d.lastSyncAt ? formatDateTime(d.lastSyncAt).split(' ')[1] : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Lifecycle Actions',
      render: (d) => (
        <div className="flex items-center gap-1.5">
          {d.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'suspended')}
              className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
            >
              Suspend
            </Button>
          )}
          {d.status === 'suspended' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'active')}
              className="h-7 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
            >
              Activate
            </Button>
          )}
          {d.status !== 'revoked' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => promptStatusChange(d, 'revoked')}
              className="h-7 px-2 text-[11px] text-rose-700 hover:bg-rose-50 border-rose-200"
              title="FR-1.3: Revoke device and block sync"
            >
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Device Terminal Registry"
        subtitle="Manage hardware workstations, mobile tablets, biometric scanner pairings, and security revocation."
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Device
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Enrolled Terminals
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{devices.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <Monitor className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active & Synchronized
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {devices.filter((d) => d.status === 'active').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Suspended / Revoked
              </p>
              <p className="text-2xl font-bold text-rose-700 mt-1">
                {devices.filter((d) => d.status === 'suspended' || d.status === 'revoked').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={devices}
          isLoading={isLoading}
          searchPlaceholder="Search terminal by name, hostname, or scope..."
          emptyTitle="No devices registered"
          emptyDescription="No biometric terminals have been enrolled."
          selectable={true}
          selectedIds={selectedDeviceIds}
          onSelectionChange={setSelectedDeviceIds}
        />
      </div>

      {/* Register Device Dialog */}
      <RegisterDeviceDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        onSubmit={handleDeviceRegistered}
      />

      {/* Confirmation Dialog for Destructive Actions */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.nextStatus === 'revoked' ? 'Revoke Device' : 'Suspend Device'}
        onConfirm={() => {
          if (confirmDialog.device) {
            executeStatusChange(confirmDialog.device.id, confirmDialog.nextStatus);
          }
        }}
      />
    </div>
  );
}
