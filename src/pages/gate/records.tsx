/**
 * Gate Attendance Administrative Records Page
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate, formatTime } from '@/lib/utils';
import { isSuperAdmin, isHOD } from '@/lib/permissions';
import { generateCSV, downloadCSV } from '@/domain';
import type { DailyClockRecord, Department } from '@/types';
import {
  DoorOpen, LogIn, LogOut, Download, Search,
  Building2, Clock, AlertTriangle,
} from 'lucide-react';

export function GateRecordsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { toast } = useToast();

  // Page-level authorization guard: Super Admin ONLY
  useEffect(() => {
    if (!isSuperAdmin(user)) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [records, setRecords] = useState<DailyClockRecord[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [punctualityFilter, setPunctualityFilter] = useState<'all' | 'on-time' | 'late'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('2026-09-01');
  const [exportEndDate, setExportEndDate] = useState('2026-10-04');
  const [exportDept, setExportDept] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  const isAdmin = isSuperAdmin(user);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const scopeDeptId = deptFilter === 'all' ? undefined : deptFilter;
      const [deptsData, recordsData] = await Promise.all([
        api.getDepartments(),
        api.getDailyClockRecords(scopeDeptId),
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
  }, [deptFilter, user]);

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
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, startDate, endDate, punctualityFilter, searchQuery]);

  const handleExecuteExport = async () => {
    setIsExporting(true);
    try {
      const exportSet = filteredRecords.filter(r => {
        if (exportStartDate && r.date < exportStartDate) return false;
        if (exportEndDate && r.date > exportEndDate) return false;
        return true;
      });

      const csv = generateCSV(exportSet, [
        { header: 'Date', accessor: r => r.date },
        { header: 'Staff ID', accessor: r => r.staffId },
        { header: 'Staff Name', accessor: r => r.staffName },
        { header: 'Department', accessor: r => r.staffDepartment },
        { header: 'Clock In Time', accessor: r => r.clockIn ? formatTime(r.clockIn.timestamp) : '—' },
        { header: 'Clock Out Time', accessor: r => r.clockOut ? formatTime(r.clockOut.timestamp) : '—' },
        { header: 'Punctuality', accessor: r => r.clockIn ? (r.clockIn.punctuality === 'late' ? 'Late' : 'On Time') : 'Unrecorded' },
        { header: 'Clock Integrity', accessor: r => (r.clockIn?.clockIntegrity || r.clockOut?.clockIntegrity || 'VERIFIED').toUpperCase() },
      ]);

      downloadCSV(csv, `BCAMS_Staff_Gate_Ledger_${exportStartDate}_to_${exportEndDate}`);
      toast.success(`Exported ${exportSet.length} staff gate attendance records`);
      setIsExportOpen(false);
    } catch {
      toast.error('Failed to export records');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<DailyClockRecord>[] = [
    {
      key: 'staff',
      header: 'Staff Personnel',
      sortable: true,
      sortFn: (a, b) => a.staffName.localeCompare(b.staffName),
      render: (r) => (
        <div>
          <span className="font-medium text-xs text-foreground">{r.staffName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[11px] text-muted-foreground">{r.staffId}</span>
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-border">
              {r.staffDepartment}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortFn: (a, b) => a.date.localeCompare(b.date),
      render: (r) => (
        <span className="font-mono text-xs text-foreground">
          {formatDate(r.date)}
        </span>
      ),
    },
    {
      key: 'clockIn',
      header: 'Clock In',
      render: (r) => {
        if (!r.clockIn) {
          return <span className="text-muted-foreground text-helper">—</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <LogIn className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            <div className="font-mono text-xs">
              <span className="font-semibold text-foreground">{formatTime(r.clockIn.timestamp)}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'clockOut',
      header: 'Clock Out',
      render: (r) => {
        if (!r.clockOut) {
          return <span className="text-muted-foreground text-helper">—</span>;
        }
        return (
          <div className="flex items-center gap-2">
            <LogOut className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <div className="font-mono text-xs">
              <span className="font-semibold text-foreground">{formatTime(r.clockOut.timestamp)}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'punctuality',
      header: 'Punctuality Classification',
      render: (r) => {
        if (!r.clockIn) {
          return <Badge variant="outline" className="text-[10px] text-muted-foreground">Absent</Badge>;
        }
        const isLate = r.clockIn.punctuality === 'late';
        return (
          <Badge
            variant="outline"
            className={`text-[10px] font-mono gap-1 ${isLate
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
              }`}
          >
            {isLate ? 'Late' : 'On Time'}
          </Badge>
        );
      },
    },
  ];

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Gate Attendance Ledger"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export Gate Attendance
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Date Range & Filter Toolbar */}
        <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
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
                className="text-xs h-9 w-32 font-mono"
              />
            </div>

            {/* Date Range: To */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs h-9 w-32 font-mono"
              />
            </div>

            {/* Department Filter (Super Admin ONLY) */}
            {isAdmin && (
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
            )}

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

          <div className="text-xs text-muted-foreground font-medium">
            Total records: <strong className="text-foreground">{filteredRecords.length}</strong>
          </div>
        </div>

        {/* ─── Flat Paginated Ledger (Section 17) ─────────────────────────── */}
        <div className="bg-white border border-border rounded-lg shadow-sm">
          <DataTable
            columns={columns}
            data={filteredRecords}
            keyField="staffId"
            pageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
            emptyTitle="No Gate Records Found"
            emptyMessage="No clock-in records match the selected date range and filter criteria."
          />
        </div>
      </div>

      {/* Scoped Export Modal */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Export Gate Attendance Records
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate an authoritative CSV export of staff entrance records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-muted-foreground font-medium block mb-1">From Date</label>
                <Input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
              <div>
                <label className="text-muted-foreground font-medium block mb-1">To Date</label>
                <Input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="text-muted-foreground font-medium block mb-1">Department</label>
                <Select value={exportDept} onValueChange={setExportDept}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-md text-helper space-y-1">
              <p className="font-semibold text-foreground">Export Summary</p>
              <p className="text-muted-foreground">
                Matches {filteredRecords.length} records ready for download.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsExportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleExecuteExport} disabled={isExporting} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Generating...' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
