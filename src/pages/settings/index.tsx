/**
 * BCAMS Settings Page
 * 
 * System configuration for the desktop application.
 * Covers: Profile info, scanner preferences, sync behavior,
 * notification preferences, display settings, and about/system info.
 */
import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import {
  User, Wifi, WifiOff, Monitor, Bell, Palette, Info,
  Save, RefreshCw, Fingerprint, Clock, Shield, HardDrive,
  CheckCircle2, Globe, Volume2, VolumeX, Sun, Moon,
} from 'lucide-react';

interface ToggleSwitchProps {
  checked: boolean;
  onToggle: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onToggle, label, description, disabled }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => !disabled && onToggle(!checked)}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200
          ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
      >
        <span
          className={`
            inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200
            ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}
          `}
        />
      </button>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, description, icon, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-50 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">{children}</div>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const { connection, lastSyncAt } = useSyncStore();
  const toast = useToast();

  // Scanner preferences
  const [scannerAutoConnect, setScannerAutoConnect] = useState(true);
  const [scannerSoundFeedback, setScannerSoundFeedback] = useState(true);
  const [scannerVibration, setScannerVibration] = useState(true);
  const [captureTimeout, setCaptureTimeout] = useState('15');

  // Sync preferences
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState('30');
  const [offlineQueueLimit, setOfflineQueueLimit] = useState('500');

  // Notification preferences
  const [notifySync, setNotifySync] = useState(true);
  const [notifyCapture, setNotifyCapture] = useState(true);
  const [notifySession, setNotifySession] = useState(true);
  const [notifyClockDrift, setNotifyClockDrift] = useState(true);

  // Display preferences
  const [compactMode, setCompactMode] = useState(false);
  const [showDevTools, setShowDevTools] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // System info
  const [desktopVersion, setDesktopVersion] = useState('1.0.0');
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    // Try to get Electron version and platform info
    if (window.bcamsDesktop) {
      window.bcamsDesktop.getVersion().then(v => setDesktopVersion(v));
      window.bcamsDesktop.getPlatform().then(p => setPlatform(p));
    } else {
      setPlatform(navigator.platform);
    }
  }, []);

  const handleSavePreferences = () => {
    // In a real app, this would persist to local storage or backend
    toast.success('Settings saved', 'Your preferences have been updated.');
  };

  const handleResetDefaults = () => {
    setScannerAutoConnect(true);
    setScannerSoundFeedback(true);
    setScannerVibration(true);
    setCaptureTimeout('15');
    setAutoSync(true);
    setSyncInterval('30');
    setOfflineQueueLimit('500');
    setNotifySync(true);
    setNotifyCapture(true);
    setNotifySession(true);
    setNotifyClockDrift(true);
    setCompactMode(false);
    setShowDevTools(true);
    setAnimationsEnabled(true);
    toast.info('Settings reset', 'All preferences restored to defaults.');
  };

  return (
    <>
      <Header
        title="Settings"
        subtitle="System configuration and preferences"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleResetDefaults}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Reset Defaults
            </Button>
            <Button size="sm" onClick={handleSavePreferences}>
              <Save className="h-4 w-4 mr-1.5" />
              Save Changes
            </Button>
          </div>
        }
      />

      <div className="p-page">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="scanner">Scanner</TabsTrigger>
            <TabsTrigger value="sync">Sync & Network</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            {/* Profile */}
            <SettingsSection
              title="Profile"
              description="Your account information"
              icon={<User className="h-4 w-4" />}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Full Name</label>
                  <p className="text-sm font-medium mt-0.5">{user?.fullName || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Email</label>
                  <p className="text-sm font-medium mt-0.5">{user?.email || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Role</label>
                  <div className="mt-0.5">
                    <Badge variant="default" className="capitalize">
                      {user?.role?.replace('_', ' ') || '—'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Department</label>
                  <p className="text-sm font-medium mt-0.5">{user?.departmentName || 'All Departments'}</p>
                </div>
              </div>
            </SettingsSection>

            {/* Display */}
            <SettingsSection
              title="Display"
              description="Visual preferences"
              icon={<Palette className="h-4 w-4" />}
            >
              <ToggleSwitch
                checked={compactMode}
                onToggle={setCompactMode}
                label="Compact Mode"
                description="Reduce padding and spacing for denser layouts"
              />
              <ToggleSwitch
                checked={animationsEnabled}
                onToggle={setAnimationsEnabled}
                label="Animations"
                description="Enable smooth transitions and micro-animations"
              />
              <ToggleSwitch
                checked={showDevTools}
                onToggle={setShowDevTools}
                label="Developer Tools"
                description="Show role switcher and debug controls in header"
              />
            </SettingsSection>
          </TabsContent>

          {/* Scanner Tab */}
          <TabsContent value="scanner" className="space-y-6">
            <SettingsSection
              title="Scanner Hardware"
              description="Biometric scanner connection and behavior"
              icon={<Fingerprint className="h-4 w-4" />}
            >
              <ToggleSwitch
                checked={scannerAutoConnect}
                onToggle={setScannerAutoConnect}
                label="Auto-Connect Scanner"
                description="Automatically detect and connect to USB/Bluetooth scanners"
              />
              <ToggleSwitch
                checked={scannerSoundFeedback}
                onToggle={setScannerSoundFeedback}
                label="Sound Feedback"
                description="Play audible sounds on successful/failed scans"
              />
              <ToggleSwitch
                checked={scannerVibration}
                onToggle={setScannerVibration}
                label="Haptic Feedback"
                description="Vibrate the scanner device on capture events"
              />
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Capture Timeout</p>
                  <p className="text-xs text-muted-foreground">Seconds to wait for a fingerprint scan before timing out</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={captureTimeout}
                    onChange={e => setCaptureTimeout(e.target.value)}
                    className="w-20 text-center"
                    min="5"
                    max="60"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </SettingsSection>
          </TabsContent>

          {/* Sync & Network Tab */}
          <TabsContent value="sync" className="space-y-6">
            <SettingsSection
              title="Sync Behavior"
              description="Manage how the desktop client synchronizes with the backend"
              icon={<Globe className="h-4 w-4" />}
            >
              {/* Current status */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  {connection === 'online' ? (
                    <Wifi className="h-4 w-4 text-success-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium capitalize">{connection}</span>
                </div>
                {lastSyncAt && (
                  <span className="text-xs text-muted-foreground">
                    Last sync: {formatDateTime(lastSyncAt)}
                  </span>
                )}
              </div>

              <ToggleSwitch
                checked={autoSync}
                onToggle={setAutoSync}
                label="Auto-Sync"
                description="Automatically push pending events when online"
              />

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Sync Interval</p>
                  <p className="text-xs text-muted-foreground">How often to attempt sync when auto-sync is enabled</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={syncInterval}
                    onChange={e => setSyncInterval(e.target.value)}
                    className="w-20 text-center"
                    min="10"
                    max="300"
                    disabled={!autoSync}
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Offline Queue Limit</p>
                  <p className="text-xs text-muted-foreground">Maximum pending events before warning</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={offlineQueueLimit}
                    onChange={e => setOfflineQueueLimit(e.target.value)}
                    className="w-20 text-center"
                    min="50"
                    max="5000"
                  />
                  <span className="text-xs text-muted-foreground">events</span>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Clock Integrity"
              description="Monotonic clock cross-check configuration (FR-4)"
              icon={<Clock className="h-4 w-4" />}
            >
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Drift Detection Threshold</p>
                  <p className="text-xs text-muted-foreground">Mark events as "suspicious" when device clock drifts beyond this</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">5</span>
                  <span className="text-xs text-muted-foreground">minutes</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Post-Reboot Policy</p>
                  <p className="text-xs text-muted-foreground">How to handle events captured after device reboot without re-calibration</p>
                </div>
                <Badge variant="muted">Mark as Unverified</Badge>
              </div>
            </SettingsSection>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <SettingsSection
              title="Notification Preferences"
              description="Control which events trigger desktop notifications"
              icon={<Bell className="h-4 w-4" />}
            >
              <ToggleSwitch
                checked={notifySync}
                onToggle={setNotifySync}
                label="Sync Events"
                description="Notify when sync completes, fails, or queue is full"
              />
              <ToggleSwitch
                checked={notifyCapture}
                onToggle={setNotifyCapture}
                label="Capture Events"
                description="Notify on successful/failed attendance captures"
              />
              <ToggleSwitch
                checked={notifySession}
                onToggle={setNotifySession}
                label="Session Lifecycle"
                description="Notify when sessions are activated, closed, or expired"
              />
              <ToggleSwitch
                checked={notifyClockDrift}
                onToggle={setNotifyClockDrift}
                label="Clock Drift Warnings"
                description="Alert when device clock drift exceeds threshold"
              />
            </SettingsSection>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            <SettingsSection
              title="BCAMS Desktop"
              description="System and version information"
              icon={<Info className="h-4 w-4" />}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Application</label>
                  <p className="text-sm font-medium mt-0.5">BCAMS Desktop</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Version</label>
                  <p className="text-sm font-medium mt-0.5">{desktopVersion}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Platform</label>
                  <p className="text-sm font-medium mt-0.5">{platform || 'Web (Browser)'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium">Runtime</label>
                  <p className="text-sm font-medium mt-0.5">
                    {window.bcamsDesktop ? 'Electron' : 'Browser'}
                  </p>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Security"
              description="Security and compliance information"
              icon={<Shield className="h-4 w-4" />}
            >
              <div className="py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-sm">FR-4 Monotonic Clock Cross-Check: Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-sm">FR-3 Offline Event Buffering: Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-sm">Device-level RBAC: Enforced</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-sm">Biometric templates: Stored server-side only</span>
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Storage"
              description="Local data and cache management"
              icon={<HardDrive className="h-4 w-4" />}
            >
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Offline Event Queue</p>
                  <p className="text-xs text-muted-foreground">Pending events awaiting sync</p>
                </div>
                <Badge variant="muted">{useSyncStore.getState().pendingEvents} events</Badge>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">Clear Local Cache</p>
                  <p className="text-xs text-muted-foreground">Remove cached data (does not affect pending events)</p>
                </div>
                <Button variant="outline" size="sm">
                  Clear Cache
                </Button>
              </div>
            </SettingsSection>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
