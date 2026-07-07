// 조건 B — 제안 접점형 통제 레이어 '내 정보 영수증'.
// 제안서 3.2절의 3클릭 흐름:
//   0클릭: 개인화 결과물마다 영수증 진입 버튼(카드 하단 전체 너비, 상시 노출)
//   1클릭: 바텀시트로 영수증 열림, 페이지 이동 없음 (근접성·인지부하)
//   2클릭: 신호 토글 OFF + "끄면 이렇게 달라집니다" 미리보기 (즉각 피드백)
//   3클릭: '적용됨 · 실행 취소' 스낵바 5초 (가역성)
// 대칭성 원칙(3.4절): 켜기/끄기 동일 토글·동일 단계, 만류 문구 없음.
// 모든 행동은 프라이버시 센터 이력에 적재된다(3.2절 말미).

import { renderFeed, renderUsageHistory } from './screens-common.js';
import { SIGNAL_LABELS, SIGNAL_PREVIEWS } from './sim-state.js';

export function setupReceipt(sim) {
  const { state } = sim;
  let openSheet = null;      // 현재 열린 바텀시트 id
  let deletedRecent = null;  // '기록 삭제' 실행 취소용 백업
  let showExplain = false;   // AI 시트의 '설명 요청' 패널

  sim.register('feed', ({ state }) => renderFeed({ state, withReceipts: true }));
  sim.register('usage-history', ({ state }) => renderUsageHistory({ state }), '프라이버시 센터 · 이용내역');
  sim.onEnterScreen('usage-history', () => {
    if (!state.viewedUsageHistory) state.mutate((s) => (s.viewedUsageHistory = true));
  });

  // ----- 바텀시트 렌더 -----

  // 상태를 토글 모양 해석에만 맡기지 않고 '사용 중'/'꺼짐' 텍스트 뱃지로도 명시한다.
  // 행 전체가 터치 영역 — 토글의 작은 스위치를 정확히 누르지 않아도 어디를 눌러도 토글된다.
  const signalRow = (id) => `
    <div class="sig-row" data-action="rtoggle:${id}" role="switch"
      aria-checked="${state.signals[id]}" aria-label="${SIGNAL_LABELS[id]}">
      <div class="sig-info">
        <div class="sig-top">
          <span class="sig-label">${SIGNAL_LABELS[id]}</span>
          <span class="sig-state ${state.signals[id] ? 'on' : 'off'}">${
            state.signals[id] ? '사용 중' : '꺼짐'
          }</span>
        </div>
        <small class="sig-preview">${
          state.signals[id] ? SIGNAL_PREVIEWS[id] : '✓ 사용이 중지되었습니다'
        }</small>
      </div>
      <button class="toggle ${state.signals[id] ? 'on' : ''}" data-action="rtoggle:${id}"
        aria-pressed="${state.signals[id]}" aria-label="${SIGNAL_LABELS[id]} 사용"></button>
    </div>`;

  const sheetFooter = `
    <div class="sheet-footer">
      <small>확인·차단 이력은 프라이버시 센터에 자동 기록됩니다</small>
      <button class="sheet-link" data-action="go-usage">전체 이용내역 보기 ›</button>
    </div>`;

  const SHEETS = {
    reco: () => `
      <div class="sheet-head"><b>이 추천의 영수증</b><button class="sheet-close" data-action="close-sheet">✕</button></div>
      <p class="sheet-sub">이 추천에 사용된 내 데이터</p>
      ${signalRow('search_wrist')}
      ${signalRow('shopping_click')}
      ${signalRow('purchase_category')}
      ${sheetFooter}`,
    ad: () => `
      <div class="sheet-head"><b>이 광고의 영수증</b><button class="sheet-close" data-action="close-sheet">✕</button></div>
      <p class="sheet-sub">이 광고에 사용된 내 데이터</p>
      ${signalRow('personalized_ads')}
      ${signalRow('search_wrist')}
      ${sheetFooter}`,
    recent: () => `
      <div class="sheet-head"><b>최근 본 상품의 영수증</b><button class="sheet-close" data-action="close-sheet">✕</button></div>
      <p class="sheet-sub">쇼핑에서 본 상품 ${state.recentProducts.length}건이 저장되어 있습니다</p>
      ${signalRow('shopping_click')}
      ${
        state.recentProducts.length > 0
          ? `<button class="sheet-action-btn" data-action="del-recent">최근 본 상품 기록 삭제</button>`
          : `<p class="sheet-done">✓ 기록이 삭제되었습니다</p>`
      }
      ${sheetFooter}`,
    ai: () => `
      <div class="sheet-head"><b>이 답변의 영수증</b><button class="sheet-close" data-action="close-sheet">✕</button></div>
      <p class="sheet-sub">이 답변에 참고된 내 정보</p>
      ${signalRow('location')}
      ${signalRow('search_wrist')}
      <div class="sheet-divider"></div>
      ${signalRow('ai_training')}
      <button class="sheet-link explain" data-action="explain">이 결과에 대한 설명 요청 ›</button>
      ${
        showExplain
          ? `<div class="explain-panel">이 답변은 회원님의 질문과 위에 표시된 신호를 참고해
             자동으로 생성되었습니다. 자동화된 결정에 대한 설명 요구·거부는
             개인정보 보호법 제37조의2의 취지에 따라 이 화면에서 처리됩니다.</div>`
          : ''
      }
      ${sheetFooter}`,
  };

  function renderSheet() {
    const o = sim.overlays();
    if (!o) return;
    let wrap = o.querySelector('.sim-sheet-wrap');
    if (openSheet == null) {
      wrap?.remove();
      return;
    }
    // 등장 애니메이션은 최초 열림에만 — 토글 등 상태 변경에 따른 재렌더에는 재생하지 않는다.
    const isNew = !wrap;
    if (isNew) {
      wrap = document.createElement('div');
      wrap.className = 'sim-sheet-wrap';
      o.prepend(wrap);
    }
    wrap.innerHTML = `
      <div class="sheet-dim" data-action="close-sheet"></div>
      <div class="sim-sheet${isNew ? ' enter' : ''}" role="dialog" aria-label="내 정보 영수증">${SHEETS[openSheet]()}</div>`;
  }

  // 상태가 바뀌면 열려 있는 시트도 새 상태로 다시 그린다.
  state.onChange(() => renderSheet());

  const addHistory = (text) =>
    state.mutate((s) => s.privacyHistory.unshift({ when: '방금 전', text }));

  // ----- 액션 -----

  sim.onAction('sheet', (id) => {
    openSheet = id;
    showExplain = false;
    renderSheet();
  });

  sim.onAction('close-sheet', () => {
    openSheet = null;
    renderSheet();
  });

  sim.onAction('rtoggle', (id) => {
    const next = !state.signals[id];
    sim.logger?.logToggle(id, next, sim.current());
    state.mutate((s) => (s.signals[id] = next));
    addHistory(next ? `영수증에서 신호 사용 재개 — ${SIGNAL_LABELS[id]}` : `영수증에서 신호 사용 중지 — ${SIGNAL_LABELS[id]}`);
    sim.showSnackbar('적용됨', `undo-signal:${id}`);
  });

  sim.onAction('undo-signal', (id) => {
    state.mutate((s) => (s.signals[id] = !s.signals[id]));
    addHistory(`실행 취소 — ${SIGNAL_LABELS[id]}`);
    sim.overlays()?.querySelector('.sim-snackbar')?.remove();
  });

  sim.onAction('del-recent', () => {
    deletedRecent = state.recentProducts.slice();
    state.mutate((s) => (s.recentProducts = []));
    addHistory('영수증에서 최근 본 상품 기록 삭제');
    sim.showSnackbar('삭제됨', 'undo-recent');
  });

  sim.onAction('undo-recent', () => {
    if (deletedRecent) state.mutate((s) => (s.recentProducts = deletedRecent));
    deletedRecent = null;
    addHistory('실행 취소 — 최근 본 상품 기록 복구');
    sim.overlays()?.querySelector('.sim-snackbar')?.remove();
  });

  sim.onAction('go-usage', () => {
    openSheet = null;
    renderSheet();
    sim.go('usage-history');
  });

  sim.onAction('explain', () => {
    showExplain = true;
    renderSheet();
  });
}
