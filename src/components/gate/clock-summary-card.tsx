/**
 * Clock Summary Card
 * 
 * Displays aggregate gate clock metrics: on-time, late arrivals,
 * early departures, and total staff punches.
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';

interface ClockSummaryCardProps {
  totalPunches: number;
  onTimeCount: number;
  lateCount: number;
  earlyDepartureCount: number;
}

export function ClockSummaryCard({
  totalPunches,
  onTimeCount,
  lateCount,
  earlyDepartureCount,
}: ClockSummaryCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Total Clock Events
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalPunches}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
            <UserCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              On-Time Punches
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{onTimeCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Late Arrivals
            </p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{lateCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Early Departures
            </p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{earlyDepartureCount}</p>
          </div>
          <div className="h-9 w-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
