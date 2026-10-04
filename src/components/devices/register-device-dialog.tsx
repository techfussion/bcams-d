/**
 * Register Device Form Dialog
 * 
 * Zod-validated modal for enrolling a new hardware terminal or mobile scanner
 * into the institutional device registry (SRS FR-1).
 */
import React, { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Device, DevicePlatform, DeviceTransport } from '@/types';
import { ShieldCheck, AlertCircle } from 'lucide-react';

const deviceSchema = z.object({
  name: z.string().min(3, 'Terminal name must be at least 3 characters'),
  platform: z.enum(['desktop', 'mobile']),
  scannerTransport: z.enum(['usb', 'bluetooth', 'none']),
  scannerModel: z.string().min(2, 'Scanner model is required'),
  assignedScope: z.string().min(2, 'Scope / Location assignment is required'),
});

interface RegisterDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (device: Device) => void;
}

export function RegisterDeviceDialog({
  open,
  onOpenChange,
  onSubmit,
}: RegisterDeviceDialogProps) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<DevicePlatform>('desktop');
  const [scannerTransport, setScannerTransport] = useState<DeviceTransport>('usb');
  const [scannerModel, setScannerModel] = useState('SecuGen Hamster Pro 20');
  const [assignedScope, setAssignedScope] = useState('Lab 3 / Department of Computer Science');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const validated = deviceSchema.parse({
        name,
        platform,
        scannerTransport,
        scannerModel,
        assignedScope,
      });

      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newDevice: Device = {
        id: `dev-${platform === 'desktop' ? 'desk' : 'mob'}-${randomSuffix}`,
        name: validated.name,
        platform: validated.platform,
        status: 'active',
        scannerConnected: validated.scannerTransport !== 'none',
        scannerModel: validated.scannerModel,
        scannerTransport: validated.scannerTransport,
        assignedScope: validated.assignedScope,
        lastSyncAt: new Date().toISOString(),
        pendingEvents: 0,
        hostname: `${platform.toUpperCase()}-${randomSuffix}`,
        registeredAt: new Date().toISOString(),
      };

      onSubmit(newDevice);
      setName('');
      onOpenChange(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[String(e.path[0])] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>Register New Terminal / Scanner</DialogTitle>
                <DialogDescription className="text-xs">
                  Authorize a new workstation or biometric handheld into the institutional network.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">
                Terminal Friendly Name *
              </label>
              <Input
                placeholder="e.g. Lab 2 Attendance Workstation"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-destructive text-[11px] mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Terminal Platform
                </label>
                <Select
                  value={platform}
                  onValueChange={(v) => setPlatform(v as DevicePlatform)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desktop">Desktop Workstation</SelectItem>
                    <SelectItem value="mobile">Mobile Handheld / Tablet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Sensor Transport
                </label>
                <Select
                  value={scannerTransport}
                  onValueChange={(v) => setScannerTransport(v as DeviceTransport)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usb">USB 2.0 / 3.0 Port</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth BLE</SelectItem>
                    <SelectItem value="none">No Attached Sensor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Biometric Sensor Model *
              </label>
              <Input
                placeholder="e.g. SecuGen Hamster Pro 20 / DigitalPersona 4500"
                value={scannerModel}
                onChange={(e) => setScannerModel(e.target.value)}
                className={errors.scannerModel ? 'border-destructive' : ''}
              />
              {errors.scannerModel && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.scannerModel}
                </p>
              )}
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Authorized Scope / Location *
              </label>
              <Input
                placeholder="e.g. Computer Science Department / Main Hall"
                value={assignedScope}
                onChange={(e) => setAssignedScope(e.target.value)}
                className={errors.assignedScope ? 'border-destructive' : ''}
              />
              {errors.assignedScope && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.assignedScope}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
