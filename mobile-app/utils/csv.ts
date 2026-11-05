// ============================================================
// AgriSweep — CSV Export
// RFC 4180 CSV for cleaning logs and the event log.
// Web downloads a .csv file; iOS/Android open the share sheet.
// ============================================================

import { Platform, Share } from 'react-native';
import { CleaningCycle, EventLogEntry } from '../types';

type CsvCell = string | number | boolean | null;

function escapeCell(value: CsvCell): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

function isoOrNull(timestamp: number | null): string | null {
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function cleaningCyclesToCsv(cycles: CleaningCycle[]): string {
  return toCsv(
    [
      'cycle_id',
      'start_time',
      'end_time',
      'duration_s',
      'mode',
      'status',
      'scraper_activated',
      'pump_activated',
      'error_reason',
      'stages',
    ],
    cycles.map((c) => [
      c.id,
      isoOrNull(c.startTime),
      isoOrNull(c.endTime),
      c.duration !== null ? Math.round(c.duration / 100) / 10 : null,
      c.mode,
      c.status,
      c.scraperActivated,
      c.pumpActivated,
      c.errorReason,
      c.stages.map((s) => `${s.stage}:${s.status}`).join('; '),
    ])
  );
}

export function eventLogToCsv(events: EventLogEntry[]): string {
  return toCsv(
    ['event_id', 'timestamp', 'type', 'severity', 'source', 'message'],
    events.map((e) => [e.id, isoOrNull(e.timestamp), e.type, e.severity, e.source, e.message])
  );
}

export function csvFilename(prefix: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.csv`;
}

export async function exportCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: csv });
}
