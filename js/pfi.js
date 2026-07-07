// PFI(권리 행사 마찰 지수) 산출 — 제안서 4.1절의 5개 지표를 합성한다.
//
// 정규화: 고정 기준(캡) 정규화. 각 지표를 0~1로 정규화한 뒤 가중합 × 100.
//   PFI = 100 × Σ w_i × min(x_i / cap_i, 1)      (낮을수록 마찰이 적다)
// 소규모 패널(시행 수 2~20)에서는 z-표준화가 불안정하므로 고정 기준을 쓴다.
// 캡·가중치는 js/config.js 에서 조정한다. 실패(성공률의 시행 단위 반영)는 0/1,
// SEQ는 (값-1)/6 으로 0~1 변환. 성공률 자체는 조건×과업 그룹 단위로 별도 집계한다.

import { CONFIG } from './config.js';
import { TASKS } from './tasks.js';

export function pfiScore({ clicks, screens, durationSec, success, seq }) {
  const { caps, weights } = CONFIG.pfi;
  const norm = {
    clicks: Math.min(clicks / caps.clicks, 1),
    screens: Math.min(screens / caps.screens, 1),
    durationSec: Math.min(durationSec / caps.durationSec, 1),
    fail: success ? 0 : 1,
    seq: seq == null ? 0.5 : (seq - 1) / 6,
  };
  const score =
    100 *
    Object.entries(weights).reduce((acc, [k, w]) => acc + w * norm[k], 0);
  return Math.round(score * 10) / 10;
}

// 세션 배열 → 시행 단위 평탄화(행마다 PFI 포함)
export function flattenTrials(sessions) {
  return sessions.flatMap((s) =>
    s.trials.map((t) => ({
      participantId: s.participantId,
      sessionId: s.sessionId,
      order: s.order.join('→'),
      condition: t.condition,
      taskId: t.taskId,
      clicks: t.clicks,
      screens: t.screens,
      durationSec: t.durationSec,
      success: t.success,
      result: t.result,
      seq: t.seq,
      pfi: pfiScore(t),
    }))
  );
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// 과업×조건 그룹 집계
export function aggregate(sessions) {
  const rows = flattenTrials(sessions);
  const groups = [];
  for (const task of TASKS) {
    for (const cond of ['A', 'B']) {
      const g = rows.filter((r) => r.taskId === task.id && r.condition === cond);
      if (g.length === 0) continue;
      groups.push({
        taskId: task.id,
        taskTitle: task.title,
        condition: cond,
        n: g.length,
        clicks: r1(mean(g.map((r) => r.clicks))),
        screens: r1(mean(g.map((r) => r.screens))),
        durationSec: r1(mean(g.map((r) => r.durationSec))),
        successRate: r1((g.filter((r) => r.success).length / g.length) * 100),
        seq: r1(mean(g.map((r) => r.seq).filter((v) => v != null))),
        pfi: r1(mean(g.map((r) => r.pfi))),
      });
    }
  }
  return groups;
}

// 과업별 A 대비 B 의 PFI 감소율(%) — 제안서 4.3절 KPI(50% 이상 감소) 대조용
export function reductionByTask(groups) {
  return TASKS.map((task) => {
    const a = groups.find((g) => g.taskId === task.id && g.condition === 'A');
    const b = groups.find((g) => g.taskId === task.id && g.condition === 'B');
    const reduction =
      a && b && a.pfi > 0 ? Math.round(((a.pfi - b.pfi) / a.pfi) * 1000) / 10 : null;
    return { taskId: task.id, taskTitle: task.title, a, b, reduction };
  });
}

// 조건별 전체 평균 PFI
export function overall(groups) {
  const per = (cond) => {
    const g = groups.filter((x) => x.condition === cond);
    return g.length ? r1(mean(g.map((x) => x.pfi))) : null;
  };
  const a = per('A');
  const b = per('B');
  const reduction = a && b && a > 0 ? Math.round(((a - b) / a) * 1000) / 10 : null;
  return { a, b, reduction };
}
