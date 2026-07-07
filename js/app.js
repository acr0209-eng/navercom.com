// 실험 흐름 제어: 설정 → (과업 안내 → 시뮬레이션 → SEQ) × 10 → 완료.
// 시행마다 시뮬레이션 상태·로거·Sim 엔진을 새로 만들어 과업 간 오염을 막는다.

import { CONFIG, CONDITIONS } from './config.js';
import { TASKS, getTask } from './tasks.js';
import { createSimState } from './sim-state.js';
import { TrialLogger } from './logger.js';
import { Sim } from './screens-common.js';
import { setupBaseline } from './screens-baseline.js';
import { setupReceipt } from './screens-receipt.js';
import { loadSessions, saveSession, newSessionId } from './storage.js';

const $ = (id) => document.getElementById(id);
const screens = ['setup', 'briefing', 'sim', 'seq', 'done'];
const show = (name) => screens.forEach((s) => $(`screen-${s}`).classList.toggle('hidden', s !== name));

let session = null;
let trials = [];        // [{condition, taskId}]
let trialIdx = 0;
let record = null;      // 진행 중인 시행 기록
let logger = null;
let timerInterval = null;
let trialEnded = false;
let demoMode = false;

// ---------- 설정 ----------

function orderFromChoice() {
  const v = document.querySelector('input[name="order"]:checked').value;
  if (v === 'AB') return ['A', 'B'];
  if (v === 'BA') return ['B', 'A'];
  // 자동 교대: 저장된 세션 수 기준으로 A→B / B→A를 번갈아 배정
  return loadSessions().length % 2 === 0 ? ['A', 'B'] : ['B', 'A'];
}

$('btn-start').addEventListener('click', () => {
  const pid = $('pid').value.trim() || `P${String(loadSessions().length + 1).padStart(2, '0')}`;
  const order = orderFromChoice();
  session = {
    sessionId: newSessionId(),
    participantId: pid,
    order,
    startedAt: new Date().toISOString(),
    timeLimitSec: CONFIG.taskTimeLimitSec,
    trials: [],
  };
  trials = order.flatMap((cond) => TASKS.map((t) => ({ condition: cond, taskId: t.id })));
  trialIdx = 0;
  demoMode = false;
  showBriefing();
});

// ---------- 과업 안내 ----------

function uiLabel(cond) {
  return `인터페이스 ${session.order.indexOf(cond) === 0 ? '①' : '②'}`;
}

function showBriefing() {
  const { condition, taskId } = trials[trialIdx];
  const task = getTask(taskId);
  $('briefing-progress').textContent =
    `과업 ${trialIdx + 1} / ${trials.length} · ${uiLabel(condition)}`;
  $('briefing-title').textContent = task.title;
  $('briefing-text').textContent = task.instruction;
  // 인터페이스가 바뀌는 시점(후반 5과업 시작) 안내
  $('briefing-switch').classList.toggle('hidden', trialIdx !== TASKS.length);
  show('briefing');
}

$('btn-begin-task').addEventListener('click', startTrial);

// ---------- 시행 ----------

// 시행마다 시뮬레이션 루트 노드를 새로 만들어 갈아끼운다.
// 이전 시행의 Sim이 루트에 걸어 둔 클릭 리스너·액션 핸들러가 남아
// 다음 시행을 오염시키는 것을 막는다(리스너는 노드와 함께 버려진다).
function freshSimRoot() {
  const old = $('sim-root');
  const root = document.createElement('div');
  root.id = 'sim-root';
  old.replaceWith(root);
  return root;
}

function startTrial() {
  const { condition, taskId } = trials[trialIdx];
  const task = getTask(taskId);

  const state = createSimState();
  logger = new TrialLogger({ participantId: session.participantId, condition, taskId });
  const sim = new Sim({ root: freshSimRoot(), state, logger });
  (condition === 'A' ? setupBaseline : setupReceipt)(sim);

  trialEnded = false;
  record = { condition, taskId };

  // 성공 판정: 상태가 바뀔 때마다 프레디킷 검사
  state.onChange(() => {
    if (!trialEnded && task.isDone(state)) finishTrial('success');
  });

  $('bar-task').textContent = task.title;
  $('bar-progress').textContent = `과업 ${trialIdx + 1} / ${trials.length} · ${uiLabel(condition)}`;
  $('sim-instruction').innerHTML = `<b>해야 할 일</b>${task.instruction}`;
  $('sim-instruction').classList.remove('hidden');
  $('btn-giveup').textContent = '과업 포기';

  let timeLeft = CONFIG.taskTimeLimitSec;
  renderTimer(timeLeft);
  $('bar-timer').classList.remove('hidden');
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    renderTimer(timeLeft);
    if (timeLeft <= 0) finishTrial('fail_timeout');
  }, 1000);

  show('sim');
  logger.start();
  sim.start('feed');

  // 과업이 이미 성립된 상태로 시작하는 일은 없지만 방어적으로 검사
  if (task.isDone(state)) finishTrial('success');
}

function renderTimer(sec) {
  const m = Math.floor(Math.max(sec, 0) / 60);
  const s = String(Math.max(sec, 0) % 60).padStart(2, '0');
  const el = $('bar-timer');
  el.textContent = `${m}:${s}`;
  el.classList.toggle('low', sec <= 30);
}

$('btn-giveup').addEventListener('click', () => {
  if (demoMode) return exitDemo();
  finishTrial('fail_giveup');
});

function finishTrial(result) {
  if (trialEnded) return;
  trialEnded = true;
  clearInterval(timerInterval);
  logger.end(result);
  Object.assign(record, logger.metrics(), { seq: null, events: logger.events });
  // 성공 시 즉각 피드백(스낵바·상태 변화)이 잠깐 보이도록 잠시 두었다가 SEQ로 이동.
  // 타이머는 이미 멈췄으므로 지표에는 영향이 없다.
  setTimeout(showSeq, result === 'success' ? 1200 : 400);
}

// ---------- SEQ ----------

function showSeq() {
  const banners = {
    success: ['✅', '과업 완료!'],
    fail_timeout: ['⏱️', '제한 시간이 지났습니다'],
    fail_giveup: ['⏭️', '과업을 건너뛰었습니다'],
  };
  const [icon, text] = banners[record.result];
  $('seq-icon').textContent = icon;
  $('seq-result').textContent = text;

  const scale = $('seq-scale');
  scale.innerHTML = '';
  for (let k = 1; k <= 7; k++) {
    const b = document.createElement('button');
    b.textContent = k;
    b.addEventListener('click', () => submitSeq(k), { once: true });
    scale.appendChild(b);
  }
  show('seq');
}

function submitSeq(k) {
  record.seq = k;
  session.trials.push(record);
  saveSession(session); // 시행마다 저장해 중도 이탈에도 데이터를 남긴다
  trialIdx += 1;
  if (trialIdx < trials.length) showBriefing();
  else show('done');
}

$('btn-restart').addEventListener('click', () => {
  session = null;
  $('pid').value = '';
  show('setup');
});

// ---------- 데모 모드 (측정 없음) ----------

function startDemo(condition) {
  demoMode = true;
  const state = createSimState();
  const sim = new Sim({ root: freshSimRoot(), state, logger: null });
  (condition === 'A' ? setupBaseline : setupReceipt)(sim);

  $('bar-task').textContent = `데모 모드 · ${CONDITIONS[condition].name}`;
  $('bar-progress').textContent = CONDITIONS[condition].desc;
  $('sim-instruction').classList.add('hidden');
  $('bar-timer').classList.add('hidden');
  $('btn-giveup').textContent = '데모 종료';
  show('sim');
  sim.start('feed');
}

function exitDemo() {
  demoMode = false;
  show('setup');
}

$('btn-demo-a').addEventListener('click', () => startDemo('A'));
$('btn-demo-b').addEventListener('click', () => startDemo('B'));
