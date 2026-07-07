// CSV / JSON 내보내기. 한글 엑셀 호환을 위해 CSV에 UTF-8 BOM을 붙인다.

import { flattenTrials } from './pfi.js';

function toCsv(rows, headers) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export function trialsCsv(sessions) {
  const rows = flattenTrials(sessions);
  const headers = [
    'participantId', 'sessionId', 'order', 'condition', 'taskId',
    'clicks', 'screens', 'durationSec', 'success', 'result', 'seq', 'pfi',
  ];
  return toCsv(rows, headers);
}

export function eventsCsv(sessions) {
  const rows = sessions.flatMap((s) =>
    s.trials.flatMap((t) =>
      (t.events || []).map((e) => ({
        participantId: s.participantId,
        condition: t.condition,
        taskId: t.taskId,
        type: e.type,
        screen: e.screen ?? '',
        target: e.target ?? '',
        value: e.value ?? '',
        tMs: e.t,
      }))
    )
  );
  const headers = ['participantId', 'condition', 'taskId', 'type', 'screen', 'target', 'value', 'tMs'];
  return toCsv(rows, headers);
}

export function download(filename, text, mime = 'text/csv') {
  const bom = mime === 'text/csv' ? '\ufeff' : '';
  const blob = new Blob([bom + text], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
