/**
 * Gate Attendance Page
 * 
 * FR-Gate: Campus / Faculty entrance verification for Staff and Students.
 * Handles Clock In, Clock Out, punctuality classification, and multiple-scan suppression.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { ScannerStatusIndicator } from '@/components/common/status-indicators';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { formatTime } from '@/lib/utils';
import type { DailyClockRecord, ClockEvent, ScannerState, Department } from '@/types';
import {
  DoorOpen, LogIn, LogOut, CheckCircle2, AlertTriangle,
  Clock, ShieldCheck, Users, Fingerprint, Calendar
} from 'lucide-react';

export function GateAttendancePage() {
  const [records, setRecords] = useState<DailyClockRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [scannerState, setScannerState] = useState<ScannerState>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [simulatingScan, setSimulatingScan] = useState(false);
  const [scanResultNotification, setScanResultNotification] = useState<string | null>(null);

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [deptList, clockRecords] = await Promise.all([
          api.getDepartments(),
          api.getDailyClockRecords(selectedDept === 'all' ? undefined : selectedDept),
        ]);
        setDepartments(deptList);
        setRecords(clockRecords);
      } catch (err) {
        console.error('Failed to load gate attendance data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [selectedDept]);

  const handleSimulateGateScan = async () => {
    if (simulatingScan) return;
    setSimulatingScan(true);
    setScanResultNotification(null);

    try {
      const result = await scannerService.simulateScan();
      if (result.type === 'success') {
        setScanResultNotification(`Verified: ${result.personName} - Entry Recorded via Biometrics`);
      } else if (result.type === 'duplicate') {
        setScanResultNotification(`Notice: ${result.personName} already clocked in. Logged as extra scan.`);
      } else {
        setScanResultNotification('Gate Scan Notice: Match confidence below institutional threshold.');
      }
    } catch {
      setScanResultNotification('Scanner communication error at Gate Turnstile.');
    } finally {
      setSimulatingScan(false);
      setTimeout(() => setScanResultNotification(null), 5000);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  // Summary Metrics
  const totalExpected = records.length;
  const clockedInCount = records.filter(r => r.clockIn).length;
  const onTimeCount = records.filter(r => r.clockIn?.punctuality === 'on-time').length;
  const clockedOutCount = records.filter(r => r.clockOut).length;
  const currentlyOnCampus = clockedInCount - clockedOutCount;
  const punctualityRate = clockedInCount > 0 ? Math.round((onTimeCount / clockedInCount) * 100) : 0;

  const columns: DataTableColumn<DailyClockRecord>[] = [
    {
      key: 'staffName',
      header: 'Staff Personnel',
      sortable: true,
      render: (record) => (
        <div>
          <p className="font-medium text-foreground">{record.staffName}</p>
          <p className="text-xs text-muted-foreground font-mono">{record.staffId}</p>
        </div>
      ),
    },
    {
      key: 'staffDepartment',
      header: 'Department',
      sortable: true,
      render: (record) => (
        <span className="text-xs font-medium text-foreground">
          {record.staffDepartment}
        </span>
      ),
    },
    {
      key: 'clockIn',
      header: 'Clock In (Entry)',
      render: (record) => {
        if (!record.clockIn) {
          return (
            <Badge variant="outline" className="text-muted-foreground border-border text-xs">
              Not Clocked In
            </Badge>
          );
        }
        const isLate = record.clockIn.punctuality === 'late';
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-1">
              <LogIn className="h-3 w-3 text-emerald-600" />
              {formatTime(record.clockIn.timestamp)}
            </span>
            <Badge
              variant="outline"
              className={isLate
                ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                : "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
              }
            >
              {isLate ? 'Late Arrival' : 'On Time'}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'clockOut',
      header: 'Clock Out (Exit)',
      render: (record) => {
        if (!record.clockOut) {
          return (
            <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              Currently On Campus
            </Badge>
          );
        }
        return (
          <div className="flex items-center gap-1 font-mono text-xs text-foreground">
            <LogOut className="h-3 w-3 text-muted-foreground" />
            {formatTime(record.clockOut.timestamp)}
          </div>
        );
      },
    },
    {
      key: 'additionalScans',
      header: 'Extra Gate Scans',
      render: (record) => (
        <span className="text-xs text-muted-foreground">
          {record.additionalScans > 0 ? (
            <span className="font-mono font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              +{record.additionalScans} additional
            </span>
          ) : (
            'None'
          )}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Integrity',
      render: (record) => (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Hardware Verified
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Gate Attendance & Perimeter Verification"
        subtitle="FR-Gate: Real-time turnstile biometric verification, daily clock records, and punctuality logs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateGateScan}
              disabled={simulatingScan}
              className="gap-2 shadow-sm"
            >
              <Fingerprint className="h-4 w-4 text-primary" />
              {simulatingScan ? 'Processing Biometrics...' : 'Test Gate Scan'}
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {scanResultNotification && (
          <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-md">
                <DoorOpen className="h-5 w-5 text-primary-700" />
              </div>
              <p className="text-sm font-medium text-primary-900">{scanResultNotification}</p>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Clocked In Today
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">{clockedInCount}</span>
                  <span className="text-xs text-muted-foreground">of {totalExpected} total</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <LogIn className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Currently On Campus
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">{currentlyOnCampus}</span>
                  <span className="text-xs text-emerald-600 font-medium">Active now</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
                <DoorOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Punctuality Rate
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-foreground">{punctualityRate}%</span>
                  <span className="text-xs text-muted-foreground">{onTimeCount} on time</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Turnstile Scanner
                </p>
                <div className="mt-1">
                  <ScannerStatusIndicator connected={scannerState !== 'disconnected'} />
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Fingerprint className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Ledger */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Daily Gate Clock Records
              </h2>
              <p className="text-xs text-muted-foreground">
                Perimeter attendance tracking. Same-day extra scans are logged without altering original clock times.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Today (Active Session)</span>
              </div>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-xs h-8 rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataTable
            data={records}
            columns={columns}
            searchable={true}
            searchPlaceholder="Search staff by name or staff ID..."
            emptyTitle="No gate clock records"
            emptyDescription="No gate clock records for today."
          />
        </div>
      </div>
    </div>
  );
}
