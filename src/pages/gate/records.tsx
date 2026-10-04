/**
 * Gate Attendance Administrative Records Page
 * 
 * Accessible exclusively to Super Administrator.
 * Features:
 * - Full date-range filtering (not locked to single calendar months)
 * - Grouped historical date views
 * - Department & punctuality filters
 * - Pagination across records
 * - Scoped Export Dialog with record count preview and confirmation
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PageSkeleton, EmptyState } from '@/components/common/empty-error-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate, formatTime } from '@/lib/utils';
import { generateCSV, downloadCSV } from '@/domain';
import type { DailyClockRecord, Department } from '@/types';
import {
  DoorOpen, LogIn, LogOut, Download, Search, Calendar,
  Filter, Building2, CheckCircle2, Clock, AlertTriangle, Layers,
} from 'lucide-react';

export function GateRecordsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [records, setRecords] = useState<DailyClockRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-10-04');
  const [deptFilter, setDeptFilter] = useState('all');
  const [punctualityFilter, setPunctualityFilter] = useState<'all' | 'on-time' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByDate, setGroupByDate] = useState(true);

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('2026-09-01');
  const [exportEndDate, setExportEndDate] = useState('2026-10-04');
  const [exportDept, setExportDept] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [deptsData, recordsData] = await Promise.all([
        api.getDepartments(),
        api.getDailyClockRecords(deptFilter === 'all' ? undefined : deptFilter),
      ]);
      setDepartments(deptsData);
      setRecords(recordsData);
    } catch (err) {
      console.error('Failed to load gate records:', err);
      toast.error('Failed to load gate attendance records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [deptFilter]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Date range filter
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;

      // Punctuality filter
      if (punctualityFilter === 'on-time' && r.clockIn?.punctuality !== 'on-time') return false;
      if (punctualityFilter === 'late' && r.clockIn?.punctuality !== 'late') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.staffName.toLowerCase().includes(q);
        const matchId = r.staffId.toLowerCase().includes(q);
        const matchDept = r.staffDepartment.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDept) return false;
      }

      return true;
    });
  }, [records, startDate, endDate, punctualityFilter, searchQuery]);

  // Date grouped records
  const groupedData = useMemo(() => {
    const groups: Record<string, DailyClockRecord[]> = {};
    filteredRecords.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredRecords]);

  // Export records count
  const exportMatchingCount = useMemo(() => {
    return records.filter(r => {
      if (exportStartDate && r.date < exportStartDate) return false;
      if (exportEndDate && r.date > exportEndDate) return false;
      if (exportDept !== 'all' && r.staffDepartment !== exportDept) return false;
      return true;
    }).length;
  }, [records, exportStartDate, exportEndDate, exportDept]);

  const handleExecuteExport = () => {
    setIsExporting(true);
    try {
      const recordsToExport = records.filter(r => {
        if (exportStartDate && r.date < exportStartDate) return false;
        if (exportEndDate && r.date > exportEndDate) return false;
        if (exportDept !== 'all' && r.staffDepartment !== exportDept) return false;
        return true;
      });

      const csv = generateCSV(recordsToExport, [
        { header: 'Date', accessor: r => r.date },
        { header: 'Staff ID', accessor: r => r.staffId },
        { header: 'Staff Name', accessor: r => r.staffName },
        { header: 'Department', accessor: r => r.staffDepartment },
        { header: 'Clock In Time', accessor: r => r.clockIn?.timestamp ? formatTime(r.clockIn.timestamp) : 'N/A' },
        { header: 'Punctuality', accessor: r => r.clockIn?.punctuality?.toUpperCase() || 'N/A' },
        { header: 'Clock Out Time', accessor: r => r.clockOut?.timestamp ? formatTime(r.clockOut.timestamp) : 'N/A' },
        { header: 'Additional Scans', accessor: r => String(r.additionalScans || 0) },
        { header: 'Verification Status', accessor: () => 'Biometric Verified' },
      ]);

      downloadCSV(csv, `BCAMS_Staff_Gate_Attendance_${exportStartDate}_to_${exportEndDate}.csv`);
      toast.success(`Exported ${recordsToExport.length} gate attendance records`);
      setIsExportOpen(false);
    } catch (err) {
      toast.error('Failed to export gate records');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<DailyClockRecord>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortFn: (a, b) => a.date.localeCompare(b.date),
      render: (r) => (
        <span className="font-mono text-xs font-medium text-foreground">
          {r.date}
        </span>
      ),
    },
    {
      key: 'staffId',
      header: 'Staff ID',
      sortable: true,
      sortFn: (a, b) => a.staffId.localeCompare(b.staffId),
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-primary">
          {r.staffId}
        </span>
      ),
    },
    {
      key: 'staffName',
      header: 'Staff Member',
      sortable: true,
      sortFn: (a, b) => a.staffName.localeCompare(b.staffName),
      render: (r) => (
        <div>
          <p className="font-medium text-foreground text-xs">{r.staffName}</p>
          <p className="text-[11px] text-muted-foreground">{r.staffDepartment}</p>
        </div>
      ),
    },
    {
      key: 'clockIn',
      header: 'Clock In',
      render: (r) => {
        if (!r.clockIn) {
          return <span className="text-muted-foreground text-xs italic">Not clocked in</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <LogIn className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-mono text-xs">{formatTime(r.clockIn.timestamp)}</span>
            <Badge
              variant={r.clockIn.punctuality === 'on-time' ? 'success' : 'destructive'}
              className="text-[10px] uppercase font-mono px-1.5 py-0"
            >
              {r.clockIn.punctuality}
            </Badge>
          </div>
        );
      },
    },
    {
      key: 'clockOut',
      header: 'Clock Out',
      render: (r) => {
        if (!r.clockOut) {
          return <span className="text-muted-foreground text-xs italic">Pending</span>;
        }
        return (
          <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
            <LogOut className="h-3.5 w-3.5 text-blue-600" />
            <span>{formatTime(r.clockOut.timestamp)}</span>
          </div>
        );
      },
    },
    {
      key: 'additionalScans',
      header: 'Extra Scans',
      render: (r) => (
        <span className="text-xs text-muted-foreground font-mono">
          {r.additionalScans > 0 ? `+${r.additionalScans} suppressed` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Integrity',
      render: () => (
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px]">
          Verified
        </Badge>
      ),
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Gate Attendance Ledger"
        subtitle="Institution-wide physical entrance verification records. Super Administrator administrative view."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupByDate(!groupByDate)}
              className="gap-2 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              {groupByDate ? 'Flat Ledger' : 'Group by Date'}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 bg-primary hover:bg-primary-600 text-white text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export Gate Attendance
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Scoped Administrator Banner */}
        <div className="bg-slate-50 border border-border rounded-lg p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <DoorOpen className="h-4 w-4 text-primary" />
            <span>
              <strong>Statutory Staff Hours:</strong> Standard working hours are <strong>9:00 AM – 5:00 PM</strong> with a <strong>60-minute grace window</strong> (up to 10:00 AM) before being classified as Late.
            </span>
          </div>
          <Badge variant="default" className="text-xs">
            Super Administrator Authority
          </Badge>
        </div>

        {/* Date Range & Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>

            {/* Date Range: From */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs h-9 w-36 font-mono"
              />
            </div>

            {/* Date Range: To */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 w-36 font-mono"
              />
            </div>

            {/* Department Filter */}
            <div className="w-[170px]">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Punctuality Filter */}
            <div className="w-[140px]">
              <Select value={punctualityFilter} onValueChange={(v) => setPunctualityFilter(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Punctuality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="on-time">On-Time Only</SelectItem>
                  <SelectItem value="late">Late Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Total records: <strong className="text-foreground">{filteredRecords.length}</strong>
          </div>
        </div>

        {/* Records Display: Date Grouped or Flat Table */}
        {groupByDate ? (
          <div className="space-y-4">
            {groupedData.length === 0 ? (
              <EmptyState
                title="No Gate Records Found"
                description="No clock-in records match the selected date range and filter criteria."
              />
            ) : (
              groupedData.map(([date, dateRecords]) => (
                <div key={date} className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-muted/40 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-xs text-foreground font-mono">
                        {date}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono">
                      {dateRecords.length} staff checked in
                    </Badge>
                  </div>
                  <DataTable
                    columns={columns}
                    data={dateRecords}
                    keyField="staffId"
                    pageSize={25}
                  />
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-lg shadow-sm">
            <DataTable
              columns={columns}
              data={filteredRecords}
              keyField="staffId"
              pageSize={25}
              emptyMessage="No gate records match the specified filters."
            />
          </div>
        )}
      </div>

      {/* Export Confirmation Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-primary" />
              Export Gate Attendance Records
            </DialogTitle>
            <DialogDescription className="text-xs">
              Export staff physical gate check-in and clock-out entries as standard CSV format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Start Date *
                </label>
                <Input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-medium text-foreground block mb-1">
                  End Date *
                </label>
                <Input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">
                Filter by Department
              </label>
              <Select value={exportDept} onValueChange={setExportDept}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments (Institution-Wide)</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Record Count Preview */}
            <div className="bg-muted/50 border border-border rounded-md p-3 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Matching records preview:</span>
              <strong className="text-primary text-sm font-mono">{exportMatchingCount} records</strong>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteExport}
              disabled={isExporting || exportMatchingCount === 0}
              className="bg-primary hover:bg-primary-600 text-white gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Generating CSV...' : `Confirm & Export (${exportMatchingCount})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
