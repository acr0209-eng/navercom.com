// 시뮬레이션 앱 엔진 + 두 조건이 공유하는 피드 화면.
//
// 화면은 HTML 문자열을 반환하는 렌더 함수로 등록하고,
// 모든 상호작용은 data-action="verb:arg" 위임 핸들러로 처리한다.
// 클릭 계수는 캡처 단계에서 프레임 안의 모든 클릭을 센다(오조작 포함).

import { CONFIG } from './config.js';
import { SIGNAL_LABELS } from './sim-state.js';

export class Sim {
  constructor({ root, state, logger }) {
    this.root = root;
    this.state = state;
    this.logger = logger; // null이면 데모 모드(기록 없음)
    this.screens = {};    // id -> ({state, params}) => html
    this.titles = {};     // id -> 헤더 제목 (feed는 헤더 없음)
    this.actions = {};    // verb -> (arg, el) => void
    this.enterHooks = {}; // id -> fn, 화면 진입 시 호출 (열람형 과업 판정용)
    this.stack = [];      // 화면 스택 (back 지원)
    this.snackbarTimer = null;

    this.onAction('go', (arg) => this.go(arg));
    this.onAction('back', () => this.back());
    this.onAction('noop', () => {});

    // 프레임 안의 모든 클릭을 계수한다(배경 오조작 포함) — 실제 상호작용 비용 측정.
    this.root.addEventListener(
      'click',
      (e) => {
        const el = e.target.closest('[data-action]');
        this.logger?.logClick(el ? el.dataset.action : 'misc', this.current());
      },
      true
    );

    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const [verb, arg] = splitAction(el.dataset.action);
      const fn = this.actions[verb];
      if (fn) fn(arg, el);
    });

    this.state.onChange(() => this.rerender());
  }

  register(id, renderFn, title) {
    this.screens[id] = renderFn;
    if (title) this.titles[id] = title;
  }

  onAction(verb, fn) {
    this.actions[verb] = fn;
  }

  onEnterScreen(id, fn) {
    this.enterHooks[id] = fn;
  }

  current() {
    return this.stack[this.stack.length - 1] || null;
  }

  start(screenId) {
    this.stack = [screenId];
    this.logger?.logScreen(screenId);
    this.enterHooks[screenId]?.();
    this.render();
  }

  go(screenId) {
    this.stack.push(screenId);
    this.logger?.logScreen(screenId);
    this.enterHooks[screenId]?.();
    this.render();
  }

  back() {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.logger?.logScreen(this.current());
    this.render();
  }

  render() {
    const id = this.current();
    const body = this.screens[id]({ state: this.state, sim: this });
    const title = this.titles[id];
    const header = title
      ? `<div class="sim-header">
           <button class="sim-back" data-action="back" aria-label="뒤로">‹</button>
           <span class="sim-title">${title}</span>
         </div>`
      : '';
    this.root.innerHTML = `${header}<div class="sim-screen" data-screen="${id}">${body}</div>
      <div class="sim-overlays"></div>`;
  }

  // 상태 변경 후 현재 화면을 다시 그린다.
  // 열려 있는 오버레이(바텀시트·스낵바)는 노드를 그대로 옮겨 보존한다
  // (innerHTML 복원 방식은 스낵바 자동 숨김 타이머의 노드 참조를 끊는다).
  rerender() {
    const overlays = this.root.querySelector('.sim-overlays');
    const nodes = overlays ? Array.from(overlays.childNodes) : [];
    this.render();
    const o = this.root.querySelector('.sim-overlays');
    nodes.forEach((n) => o.appendChild(n));
  }

  overlays() {
    return this.root.querySelector('.sim-overlays');
  }

  closeOverlays() {
    const o = this.overlays();
    if (o) o.innerHTML = '';
  }

  // '적용됨 · 실행 취소' 스낵바 (제안서 3.2절 3클릭 단계: 가역성)
  showSnackbar(text, undoAction) {
    const o = this.overlays();
    if (!o) return;
    o.querySelector('.sim-snackbar')?.remove();
    const bar = document.createElement('div');
    bar.className = 'sim-snackbar';
    bar.innerHTML = `<span>${text}</span>${
      undoAction ? `<button data-action="${undoAction}">실행 취소</button>` : ''
    }`;
    o.appendChild(bar);
    clearTimeout(this.snackbarTimer);
    this.snackbarTimer = setTimeout(() => bar.remove(), CONFIG.snackbarMs);
  }

  // 조건 A의 확인 대화상자 (페이지 전환 없음 → 뎁스에 세지 않고 클릭만 계수)
  showModal(html) {
    const o = this.overlays();
    if (!o) return;
    o.innerHTML = `<div class="sim-modal-dim"></div><div class="sim-modal">${html}</div>`;
  }
}

function splitAction(action) {
  const i = action.indexOf(':');
  return i < 0 ? [action, null] : [action.slice(0, i), action.slice(i + 1)];
}

// ---------- 공용 피드 화면 ----------
// withReceipts=true 면 개인화 결과물마다 카드 하단에 영수증 진입 버튼을 붙인다(조건 B).
// 작은 코너 아이콘 대신 카드 전체 너비의 라벨 버튼을 써서 항상 같은 위치(카드 맨 아래)에서
// 눈에 띄게 노출한다 — 제안서 3.2절 0클릭 단계의 '발견가능성' 원칙.

export function renderFeed({ state, withReceipts }) {
  const s = state.signals;
  const receipt = (sheetId, label) =>
    withReceipts
      ? `<button class="receipt-btn" data-action="sheet:${sheetId}">
           <span class="r-badge">🧾</span>${label}<span class="r-chev">›</span>
         </button>`
      : '';

  const recoCard1 = s.search_wrist
    ? `<div class="card reco-card">
         <div class="card-tag">쇼핑 추천</div>
         <div class="prod"><div class="thumb">🛍️</div>
           <div><div class="prod-name">손목 보호대 슬림핏 (양손용)</div>
           <div class="prod-price">12,900원 <span class="free">무료배송</span></div></div></div>
         <div class="prod"><div class="thumb">🛍️</div>
           <div><div class="prod-name">의료용 손목 압박밴드 2매</div>
           <div class="prod-price">9,800원</div></div></div>
         ${receipt('reco', '이 추천에 사용된 내 정보 보기')}
       </div>`
    : `<div class="card reco-card muted">
         <div class="card-tag">쇼핑 추천</div>
         <div class="muted-note">✓ '손목 보호대' 검색어 기반 추천이 중지되었습니다</div>
       </div>`;

  const recoCard2 = s.shopping_click
    ? `<div class="card reco-card">
         <div class="card-tag">함께 본 상품</div>
         <div class="prod"><div class="thumb">🖱️</div>
           <div><div class="prod-name">무선 버티컬 마우스 (손목 편한)</div>
           <div class="prod-price">29,800원</div></div></div>
         ${receipt('reco', '이 추천에 사용된 내 정보 보기')}
       </div>`
    : `<div class="card reco-card muted">
         <div class="card-tag">함께 본 상품</div>
         <div class="muted-note">✓ 쇼핑 클릭 기반 추천이 중지되었습니다</div>
       </div>`;

  const adCard = s.personalized_ads
    ? `<div class="card ad-card">
         <div class="card-tag">AD · 맞춤형 광고</div>
         <div class="ad-body">🎯 <b>손목 보호대 최대 40% 특가</b><br>
         <span class="ad-sub">지금 관심 있는 상품, 오늘만 이 가격</span></div>
         ${receipt('ad', '이 광고에 사용된 내 정보 보기')}
       </div>`
    : `<div class="card ad-card muted">
         <div class="card-tag">AD · 일반 광고</div>
         <div class="ad-body">🌐 <b>이번 주 브랜드 데이</b><br>
         <span class="ad-sub">맞춤형 광고가 중지되어 일반 광고가 표시됩니다</span></div>
       </div>`;

  const aiCard = `<div class="card ai-card">
      <div class="card-tag ai-tag">AI 브리핑</div>
      <div class="ai-q">“손목 통증에 좋은 스트레칭 알려줘”</div>
      <div class="ai-a">최근 검색하신 손목 보호와 관련해, 손목 굽힘근 스트레칭 3가지를 추천드려요.
      ${s.location ? '현재 계신 지역의 재활의학과 정보도 함께 참고했어요.' : ''}</div>
      ${
        s.ai_training
          ? ''
          : '<div class="muted-note in-ai">✓ 내 대화는 AI 학습에 사용되지 않습니다</div>'
      }
      ${receipt('ai', '이 답변에 참고된 내 정보 보기')}
    </div>`;

  const recent =
    state.recentProducts.length > 0
      ? `<div class="card recent-card">
           <div class="card-tag">최근 본 상품</div>
           <div class="recent-row">${state.recentProducts
             .map((p) => `<div class="recent-chip"><div class="thumb sm">📦</div>${p.name}</div>`)
             .join('')}</div>
           ${receipt('recent', '최근 본 상품에 대한 내 정보 보기')}
         </div>`
      : `<div class="card recent-card muted">
           <div class="card-tag">최근 본 상품</div>
           <div class="muted-note">✓ 최근 본 상품 기록이 삭제되었습니다</div>
         </div>`;

  return `
    <div class="feed">
      <div class="searchbar"><span class="n-logo">N</span><span class="search-hint">검색어를 입력해 주세요</span>
        <span class="search-mic">🎤</span></div>
      ${aiCard}
      ${recoCard1}
      ${adCard}
      ${recoCard2}
      ${recent}
    </div>
    <div class="tabbar">
      <button class="tab active" data-action="noop">홈</button>
      <button class="tab" data-action="go:shopping-home">쇼핑</button>
      <button class="tab" data-action="noop">클립</button>
      <button class="tab" data-action="go:menu">MY·메뉴</button>
    </div>`;
}

// 프라이버시 센터 이력 화면(두 조건 공용) — 진입 시 과업 4 충족.
export function renderUsageHistory({ state }) {
  const usedNow = Object.entries(state.signals)
    .filter(([, v]) => v)
    .map(([k]) => `<li class="hist-item"><span class="dot on"></span>${SIGNAL_LABELS[k]} <b class="st-on">사용 중</b></li>`);
  const stopped = Object.entries(state.signals)
    .filter(([, v]) => !v)
    .map(([k]) => `<li class="hist-item"><span class="dot off"></span>${SIGNAL_LABELS[k]} <b class="st-off">중지됨</b></li>`);
  const log = state.privacyHistory
    .map((h) => `<li class="hist-item log"><span class="hist-when">${h.when}</span>${h.text}</li>`)
    .join('');
  return `
    <div class="usage">
      <div class="usage-sec"><h3>내 데이터 신호 이용 현황</h3>
        <ul>${usedNow.join('')}${stopped.join('')}</ul></div>
      <div class="usage-sec"><h3>권리 행사 이력</h3>
        <ul>${log}</ul></div>
    </div>`;
}
