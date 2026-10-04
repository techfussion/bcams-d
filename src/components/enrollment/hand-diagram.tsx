/**
 * Biometric Hand Diagram Component
 * 
 * Reusable visual selector for left and right hands with 10 finger positions.
 * Displays quality scores, capturing states, and activation threshold indicators.
 */
import React from 'react';
import type { FingerPosition } from '@/types';
import { Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FingerEnrollmentState {
  position: FingerPosition;
  enrolled: boolean;
  quality?: number;
  templateId?: string;
  enrolledAt?: string;
}

export const FINGER_LABELS: Record<FingerPosition, string> = {
  left_thumb: 'Left Thumb',
  left_index: 'Left Index',
  left_middle: 'Left Middle',
  left_ring: 'Left Ring',
  left_little: 'Left Little',
  right_thumb: 'Right Thumb',
  right_index: 'Right Index',
  right_middle: 'Right Middle',
  right_ring: 'Right Ring',
  right_little: 'Right Little',
};

interface HandDiagramProps {
  enrollments: FingerEnrollmentState[];
  scanningFinger: FingerPosition | null;
  onSelectFinger: (pos: FingerPosition) => void;
  disabled?: boolean;
}

export function HandDiagram({
  enrollments,
  scanningFinger,
  onSelectFinger,
  disabled = false,
}: HandDiagramProps) {
  const leftFingers: FingerPosition[] = [
    'left_little',
    'left_ring',
    'left_middle',
    'left_index',
    'left_thumb',
  ];

  const rightFingers: FingerPosition[] = [
    'right_thumb',
    'right_index',
    'right_middle',
    'right_ring',
    'right_little',
  ];

  const renderFinger = (pos: FingerPosition) => {
    const item = enrollments.find((f) => f.position === pos);
    const enrolled = item?.enrolled;
    const isScanning = scanningFinger === pos;

    return (
      <button
        key={pos}
        type="button"
        onClick={() => onSelectFinger(pos)}
        disabled={disabled || isScanning}
        className={cn(
          'flex flex-col items-center justify-between p-2 rounded-xl border transition-all h-24 text-center group cursor-pointer',
          enrolled
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs'
            : 'border-border bg-background hover:border-primary hover:bg-primary-50/40 text-muted-foreground',
          isScanning && 'border-primary ring-2 ring-primary/40 animate-pulse bg-primary-50/30'
        )}
        title={
          enrolled
            ? `${FINGER_LABELS[pos]}: Enrolled (${item?.quality}% quality). Click to re-scan.`
            : `${FINGER_LABELS[pos]}: Not enrolled. Click to capture.`
        }
      >
        <span className="text-[10px] font-semibold block leading-tight">
          {FINGER_LABELS[pos].replace(/(Left|Right)\s/, '')}
        </span>
        <Fingerprint
          className={cn(
            'h-6 w-6 my-1 transition-transform group-hover:scale-110',
            enrolled ? 'text-emerald-600' : 'text-muted-foreground'
          )}
        />
        {enrolled ? (
          <span className="text-[10px] font-mono text-emerald-700 font-bold">
            {item?.quality}%
          </span>
        ) : (
          <span className="text-[9px] text-muted-foreground uppercase font-medium">
            Scan
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Hand */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-center text-muted-foreground">
          Left Hand (Fingers 1–5)
        </h4>
        <div className="grid grid-cols-5 gap-2">{leftFingers.map(renderFinger)}</div>
      </div>

      {/* Right Hand */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-center text-muted-foreground">
          Right Hand (Fingers 6–10)
        </h4>
        <div className="grid grid-cols-5 gap-2">{rightFingers.map(renderFinger)}</div>
      </div>
    </div>
  );
}
