// 결과 대시보드 렌더링: 요약 타일, 과업별 PFI 막대 비교, 집계·시행 테이블, 내보내기.

import { loadSessions, clearSessions } from './storage.js';
import { flattenTrials, aggregate, reductionByTask, overall } from './pfi.js';
import { trialsCsv, eventsCsv, download } from './export.js';
import { CONDITIONS } from './config.js';

const $ = (id) => document.getElementById(id);
const fmt = (v, suffix = '') => (v == null ? '–' : `${v}${suffix}`);

const sessions = loadSessions();

if (sessions.length === 0 || sessions.every((s) => s.trials.length === 0)) {
  $('empty').classList.remove('hidden');
} else {
  $('content').classList.remove('hidden');
  render();
}

function render() {
  const trials = flattenTrials(sessions);
  const groups = aggregate(sessions);
  const byTask = reductionByTask(groups);
  const total = overall(groups);

  $('summary-desc').textContent =
    `세션 ${sessions.length}개 · 시행 ${trials.length}건 · ` +
    `A=${CONDITIONS.A.name}, B=${CONDITIONS.B.name}`;

  // ----- 요약 타일 -----
  const tiles = [
    ['조건 A 평균 PFI', fmt(total.a), '현행 목적지형'],
    ['조건 B 평균 PFI', fmt(total.b), '제안 접점형'],
    [
      'PFI 감소율',
      total.reduction == null
        ? '–'
        : `<span class="${total.reduction >= 50 ? 'good' : ''}">${total.reduction}%</span>`,
      'KPI 목표: 50% 이상 감소',
    ],
  ];
  $('stat-row').innerHTML = tiles
    .map(
      ([label, value, note]) => `
      <div class="stat-tile">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        <div class="stat-note">${note}</div>
      </div>`
    )
    .join('');

  // ----- 과업별 PFI 막대 (가로 그룹 막대, 직접 라벨) -----
  $('pfi-bars').innerHTML = byTask
    .map(({ taskTitle, a, b, reduction }) => {
      if (!a && !b) return '';
      const bar = (g, cls) =>
        g
          ? `<div class="bar-row" data-tip="${tip(g)}">
               <span class="bar-cond">${g.condition}</span>
               <div class="bar-track"><div class="bar-fill ${cls}" style="width:${g.pfi}%"></div></div>
               <span class="bar-val">PFI ${g.pfi}</span>
             </div>`
          : '';
      const red =
        reduction == null
          ? ''
          : ` <span style="color:var(--delta-good);font-weight:700;">▼ ${reduction}%</span>`;
      return `<div class="bar-group">
        <div class="bar-title">${taskTitle}${red}</div>
        ${bar(a, 'a')}${bar(b, 'b')}
      </div>`;
    })
    .join('');

  // ----- 집계 테이블 -----
  const gHead = ['과업', '조건', 'n', '클릭 수', '뎁스', '시간(초)', '성공률(%)', 'SEQ', 'PFI'];
  $('group-table').innerHTML =
    `<thead><tr>${gHead.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
    groups
      .map(
        (g) => `<tr>
          <td>${g.taskTitle.replace(/^과업 \d+ · /, '')}</td>
          <td>${g.condition}</td><td>${g.n}</td>
          <td>${fmt(g.clicks)}</td><td>${fmt(g.screens)}</td><td>${fmt(g.durationSec)}</td>
          <td>${fmt(g.successRate)}</td><td>${fmt(g.seq)}</td><td><b>${fmt(g.pfi)}</b></td>
        </tr>`
      )
      .join('') +
    '</tbody>';

  // ----- 시행 상세 테이블 -----
  const tHead = ['참가자', '순서', '조건', '과업', '클릭', '뎁스', '시간(초)', '결과', 'SEQ', 'PFI'];
  const resultLabel = { success: '성공', fail_timeout: '시간초과', fail_giveup: '포기' };
  $('trial-table').innerHTML =
    `<thead><tr>${tHead.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
    trials
      .map(
        (t) => `<tr>
          <td>${t.participantId}</td><td>${t.order}</td><td>${t.condition}</td><td>${t.taskId}</td>
          <td>${t.clicks}</td><td>${t.screens}</td><td>${t.durationSec}</td>
          <td>${resultLabel[t.result] || t.result}</td><td>${fmt(t.seq)}</td><td>${t.pfi}</td>
        </tr>`
      )
      .join('') +
    '</tbody>';

  attachTooltips();
}

function tip(g) {
  return (
    `${g.condition} · n=${g.n} | 클릭 ${fmt(g.clicks)} · 뎁스 ${fmt(g.screens)} · ` +
    `${fmt(g.durationSec)}초 · 성공률 ${fmt(g.successRate)}% · SEQ ${fmt(g.seq)}`
  );
}

// 막대 호버 툴팁 — 지표 분해를 보여준다
function attachTooltips() {
  let tipEl = null;
  document.querySelectorAll('.bar-row[data-tip]').forEach((row) => {
    row.addEventListener('mouseenter', () => {
      tipEl = document.createElement('div');
      tipEl.className = 'viz-tooltip';
      tipEl.textContent = row.dataset.tip;
      document.body.appendChild(tipEl);
    });
    row.addEventListener('mousemove', (e) => {
      if (!tipEl) return;
      tipEl.style.left = `${Math.min(e.clientX + 12, window.innerWidth - 280)}px`;
      tipEl.style.top = `${e.clientY + 14}px`;
    });
    row.addEventListener('mouseleave', () => {
      tipEl?.remove();
      tipEl = null;
    });
  });
}

// ----- 내보내기 · 초기화 -----

$('btn-csv-trials').addEventListener('click', () =>
  download('pfi_trials.csv', trialsCsv(sessions))
);
$('btn-csv-events').addEventListener('click', () =>
  download('pfi_events.csv', eventsCsv(sessions))
);
$('btn-json').addEventListener('click', () =>
  download('pfi_raw.json', JSON.stringify(sessions, null, 2), 'application/json')
);
$('btn-clear').addEventListener('click', () => {
  if (confirm('저장된 실험 데이터를 모두 삭제할까요? 되돌릴 수 없습니다.')) {
    clearSessions();
    location.reload();
  }
});
