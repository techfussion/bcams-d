/**
 * Devices Page
 * 
 * Device lifecycle management per SRS FR-1:
 * - FR-1.1: Register Device with institutional identity
 * - FR-1.2: Lifecycle transitions: Active, Suspended, Revoked, Retired
 * - FR-1.3: Revocation blocks further backend authentication & synchronization
 * - FR-16: Auto-update status check
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { DeviceStatusBadge, ScannerStatusIndicator } from '@/components/common/status-indicators';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { formatDateTime } from '@/lib/utils';
import type { Device, DeviceStatus, DevicePlatform, DeviceTransport } from '@/types';
import {
  Plus, Monitor, Smartphone, RefreshCw, ShieldAlert,
  ShieldCheck, Ban, CheckCircle2, AlertTriangle, ArrowUpDown
} from 'lucide-react';

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Form state
  const [deviceName, setDeviceName] = useState('');
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [assignedScope, setAssignedScope] = useState('Computer Science Lab');
  const [hostname, setHostname] = useState('DESK-CS-02');
  const [scannerModel, setScannerModel] = useState('ZK4500');
  const [scannerTransport, setScannerTransport] = useState<DeviceTransport>('usb');

  useEffect(() => {
    api.getDevices().then(data => {
      setDevices(data);
      setIsLoading(false);
    });
  }, []);

  const handleRegisterDevice = (e: React.FormEvent) => {
    e.preventDefault();
    const newDevice: Device = {
      id: `dev-${Date.now().toString().slice(-4)}`,
      name: deviceName,
      platform,
      status: 'active',
      registeredAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      assignedScope,
      hostname,
      pendingEvents: 0,
      scannerTransport,
      scannerModel,
      scannerConnected: true,
    };

    setDevices([newDevice, ...devices]);
    setIsRegisterModalOpen(false);
    setDeviceName('');
  };

  const handleUpdateStatus = (deviceId: string, nextStatus: DeviceStatus) => {
    setDevices(devices.map(d => d.id === deviceId ? { ...d, status: nextStatus } : d));
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
      render: (d) => <Badge variant="outline" className="capitalize text-xs font-mono">{d.platform}</Badge>,
    },
    {
      key: 'status',
      header: 'Lifecycle State',
      render: (d) => <DeviceStatusBadge status={d.status} />,
    },
    {
      key: 'scanner',
      header: 'Biometric Scanner',
      render: (d) => (
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${d.scannerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-xs font-semibold text-foreground">{d.scannerModel || 'Scanner'}</span>
          <Badge variant="outline" className="text-[10px] uppercase font-mono">{d.scannerTransport}</Badge>
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
      render: (d) => d.pendingEvents > 0 ? (
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
              onClick={() => handleUpdateStatus(d.id, 'suspended')}
              className="h-7 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
            >
              Suspend
            </Button>
          )}
          {d.status === 'suspended' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(d.id, 'active')}
              className="h-7 px-2 text-[11px] text-emerald-700 hover:bg-emerald-50"
            >
              Activate
            </Button>
          )}
          {d.status !== 'revoked' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateStatus(d.id, 'revoked')}
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
    <div className="flex flex-col h-full">
      <Header
        title="Device Management"
        subtitle="FR-1: Institutional capture terminals, hardware pairing, lifecycle states, and revocation"
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
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          {/* Information Notice */}
          <div className="p-4 rounded-xl border border-primary-200 bg-primary-50/60 text-xs text-primary-900 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-primary-950">
                FR-1.3 Device Security Boundary Notice
              </p>
              <p className="text-[11px] text-primary-800 mt-0.5">
                Revoked devices are cryptographically barred from the central backend. Any unsynchronized events residing on lost/revoked devices cannot be recovered (FR-1.4).
              </p>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={devices}
            isLoading={isLoading}
            searchPlaceholder="Search devices by name, scope, or hostname..."
            searchFn={(d, q) =>
              d.name.toLowerCase().includes(q) ||
              (d.hostname || '').toLowerCase().includes(q) ||
              (d.assignedScope || '').toLowerCase().includes(q)
            }
            getRowId={(d) => d.id}
            emptyTitle="No devices registered"
            emptyDescription="No attendance capture terminals registered."
            emptyAction={{ label: 'Register Device', onClick: () => setIsRegisterModalOpen(true) }}
          />
        </div>
      </div>

      {/* Register Device Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Register Device Terminal (FR-1.1)
                </h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Science Complex Gate Station"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as DevicePlatform)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="desktop">Desktop (Windows/Electron)</option>
                    <option value="mobile">Mobile (Android/React Native)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Hostname
                  </label>
                  <input
                    type="text"
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    placeholder="e.g. GATE-PC-02"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Assigned Operational Scope
                </label>
                <input
                  type="text"
                  value={assignedScope}
                  onChange={(e) => setAssignedScope(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Main Gate Entrance Turnstile"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Scanner Model
                  </label>
                  <input
                    type="text"
                    value={scannerModel}
                    onChange={(e) => setScannerModel(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="e.g. ZK4500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Transport (NFR-6.2)
                  </label>
                  <select
                    value={scannerTransport}
                    onChange={(e) => setScannerTransport(e.target.value as DeviceTransport)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="usb">Wired USB</option>
                    <option value="bluetooth">Bluetooth</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register Terminal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
