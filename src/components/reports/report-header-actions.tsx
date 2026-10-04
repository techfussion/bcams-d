/**
 * Report Header Actions
 * 
 * Standard action toolbar buttons for exporting CSV reports and printing rosters.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';

interface ReportHeaderActionsProps {
  onPrint: () => void;
  onExportCSV: () => void;
  isExporting?: boolean;
}

export function ReportHeaderActions({
  onPrint,
  onExportCSV,
  isExporting = false,
}: ReportHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrint}
        className="gap-1.5 shadow-xs text-xs"
        type="button"
      >
        <Printer className="h-4 w-4" />
        Print Roster
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={onExportCSV}
        disabled={isExporting}
        className="gap-1.5 shadow-xs text-xs"
        type="button"
      >
        <Download className="h-4 w-4" />
        {isExporting ? 'Exporting...' : 'Export CSV Ledger'}
      </Button>
    </div>
  );
}
