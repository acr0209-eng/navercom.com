// 조건 A — 현행 목적지형(destination) 흐름 시뮬레이션.
// 현행 서비스의 마찰 요인을 재현한다:
// 깊은 메뉴 뎁스, 제각각인 명칭('맞춤형 광고'/'콘텐츠 개인화'/'관심 키워드'),
// 과업과 무관한 메뉴 항목, 만류형 확인 문구, 완료 피드백 부재.

import { renderFeed, renderUsageHistory } from './screens-common.js';

export function setupBaseline(sim) {
  const { state } = sim;
  let editingRecent = false;   // '최근 본 상품' 편집 모드
  let dummyPersonalize = true; // 콘텐츠 개인화 마스터 토글(과업과 무관한 미끼)
  let decoyKeywords = ['버티컬 마우스', '원목 가구', '재활 스트레칭']; // 과업 외 키워드도 실제로 삭제되게
  // 검색기록 — '손목 보호대' 기록을 지우는 것도 과업 1의 정당한 대체 경로다
  // (실제 서비스의 심리 모델과 일치). 남은 손목 보호대 기록이 0이 되면 신호가 꺼진다.
  let wristSearches = [
    { id: 'w1', text: '손목 보호대', when: '7.1' },
    { id: 'w2', text: '손목 보호대 추천', when: '6.30' },
  ];
  let decoySearches = [
    { id: 'd1', text: '버티컬 마우스 손목', when: '6.29' },
    { id: 'd2', text: '손목 스트레칭 방법', when: '6.28' },
  ];

  const list = (items) =>
    `<ul class="menu-list">${items
      .map(
        ([label, action, sub]) =>
          `<li><button class="menu-item" data-action="${action}">
             <span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="chev">›</span>
           </button></li>`
      )
      .join('')}</ul>`;

  const stub = (text) => () =>
    `<div class="stub"><div class="stub-icon">⚙️</div><p>${text}</p>
     <p class="stub-sub">데모에서는 이 메뉴의 세부 기능을 제공하지 않아요.</p></div>`;

  // ----- 피드(영수증 아이콘 없음) -----
  sim.register('feed', ({ state }) => renderFeed({ state, withReceipts: false }));

  // ----- 전체 메뉴 -----
  sim.register(
    'menu',
    () =>
      list([
        ['MY페이지', 'go:stub-my'],
        ['이벤트·혜택', 'go:stub-event'],
        ['알림', 'go:stub-notif'],
        ['설정', 'go:settings'],
        ['고객센터', 'go:stub-cs'],
        ['공지사항', 'go:stub-notice'],
      ]),
    '전체 메뉴'
  );

  // ----- 설정 트리 -----
  sim.register(
    'settings',
    () =>
      list([
        ['계정 정보', 'go:stub-account'],
        ['알림 설정', 'go:stub-notif'],
        ['화면 스타일', 'go:stub-display'],
        ['서비스 설정', 'go:settings-service'],
        ['개인정보 보호', 'go:privacy'],
        ['AI 서비스', 'go:ai-services'],
        ['실험실', 'go:stub-labs'],
        ['버전 정보', 'go:stub-version'],
      ]),
    '설정'
  );

  sim.register(
    'settings-service',
    () =>
      list([
        ['검색어 자동완성', 'go:stub-autocomplete'],
        ['검색 결과 필터', 'go:stub-filter'],
        ['콘텐츠 개인화', 'go:personalization'],
        ['동영상 자동재생', 'go:stub-autoplay'],
        ['글꼴 크기', 'go:stub-font'],
      ]),
    '서비스 설정'
  );

  sim.register(
    'personalization',
    () => `
      <div class="setting-page">
        <div class="setting-row">
          <div><b>개인화 추천 사용</b><small>회원님의 활동을 바탕으로 콘텐츠를 추천합니다</small></div>
          <button class="toggle ${dummyPersonalize ? 'on' : ''}" data-action="dummy-personalize"
            aria-pressed="${dummyPersonalize}"></button>
        </div>
        ${list([['관심 키워드 관리', 'go:interests', '추천에 사용되는 키워드를 관리합니다']])}
      </div>`,
    '콘텐츠 개인화'
  );

  sim.register(
    'interests',
    ({ state }) => `
      <div class="setting-page">
        <p class="setting-desc">추천에 사용 중인 관심 키워드입니다.</p>
        <ul class="menu-list">
          ${
            state.signals.search_wrist
              ? `<li class="kw-row"><span>손목 보호대</span>
                 <button class="kw-del" data-action="ask-del-keyword">삭제</button></li>`
              : ''
          }
          ${decoyKeywords
            .map(
              (k) =>
                `<li class="kw-row"><span>${k}</span>
                 <button class="kw-del" data-action="del-decoy:${k}">삭제</button></li>`
            )
            .join('')}
        </ul>
      </div>`,
    '관심 키워드 관리'
  );

  sim.register(
    'privacy',
    () =>
      list([
        ['개인정보 처리방침', 'go:stub-policy'],
        ['광고 설정', 'go:ad-settings'],
        ['검색기록 관리', 'go:search-history'],
        ['위치정보 이용', 'go:location-info'],
        ['프라이버시 센터', 'go:privacy-center'],
      ]),
    '개인정보 보호'
  );

  // ----- 검색기록 관리 (과업 1 대체 경로) -----
  // 실제 서비스처럼 개별 기록 삭제·전체 삭제가 동작하고,
  // '손목 보호대' 기록을 모두 지우면 해당 검색어 신호도 꺼진다.
  sim.register(
    'search-history',
    () => {
      const rows = [...(state.signals.search_wrist ? wristSearches : []), ...decoySearches];
      return `
      <div class="setting-page">
        <div class="edit-bar">
          <span>최근 검색어 ${rows.length}건</span>
          ${rows.length ? `<button class="txt-btn danger" data-action="ask-clear-search">전체 삭제</button>` : ''}
        </div>
        ${
          rows.length === 0
            ? '<p class="empty">저장된 검색기록이 없습니다.</p>'
            : `<ul class="menu-list">${rows
                .map(
                  (r) =>
                    `<li class="kw-row"><span>🔍 ${r.text}<small>${r.when}</small></span>
                     <button class="kw-del" data-action="del-search:${r.id}">삭제</button></li>`
                )
                .join('')}</ul>`
        }
      </div>`;
    },
    '검색기록 관리'
  );

  // ----- 위치정보 이용 (실제 동작하는 토글) -----
  sim.register(
    'location-info',
    ({ state }) => `
      <div class="setting-page">
        <p class="setting-desc">위치정보는 지역 기반 검색 결과와 AI 응답에 활용됩니다.</p>
        <div class="setting-row">
          <div><b>위치정보 이용</b><small>${state.signals.location ? '사용 중' : '사용 안 함'}</small></div>
          <button class="toggle ${state.signals.location ? 'on' : ''}" data-action="toggle-location"
            aria-pressed="${state.signals.location}"></button>
        </div>
      </div>`,
    '위치정보 이용'
  );

  sim.register(
    'ad-settings',
    () =>
      list([
        ['광고 알림 수신', 'go:stub-ad-push'],
        ['맞춤형 광고 설정', 'go:ad-custom'],
        ['광고 식별자 재설정', 'go:stub-ad-id'],
      ]),
    '광고 설정'
  );

  sim.register(
    'ad-custom',
    ({ state }) => `
      <div class="setting-page">
        <p class="setting-desc">관심사를 기반으로 회원님께 더 관련성 높은 광고를 표시합니다.</p>
        <div class="setting-row">
          <div><b>맞춤형 광고</b><small>${state.signals.personalized_ads ? '사용 중' : '사용 안 함'}</small></div>
          <button class="toggle ${state.signals.personalized_ads ? 'on' : ''}"
            data-action="${state.signals.personalized_ads ? 'ask-ad-off' : 'noop'}"
            aria-pressed="${state.signals.personalized_ads}"></button>
        </div>
      </div>`,
    '맞춤형 광고 설정'
  );

  sim.register('privacy-center', () =>
    list([
      ['개인정보 처리 현황', 'go:stub-processing'],
      ['개인정보 이용내역 조회', 'go:usage-history'],
      ['권리 행사 안내', 'go:stub-rights'],
      ['내 데이터 다운로드', 'go:stub-download'],
    ]),
    '프라이버시 센터'
  );

  sim.register('usage-history', ({ state }) => renderUsageHistory({ state }), '개인정보 이용내역');
  sim.onEnterScreen('usage-history', () => {
    if (!state.viewedUsageHistory) state.mutate((s) => (s.viewedUsageHistory = true));
  });

  // ----- 쇼핑 트리 (과업 3) -----
  sim.register(
    'shopping-home',
    () => `
      <div class="setting-page">
        <div class="shop-banner">🛒 오늘의 쇼핑 특가</div>
        ${list([
          ['카테고리', 'go:stub-category'],
          ['베스트', 'go:stub-best'],
          ['MY쇼핑', 'go:shopping-my'],
        ])}
      </div>`,
    '쇼핑'
  );

  sim.register(
    'shopping-my',
    () =>
      list([
        ['주문 내역', 'go:stub-orders'],
        ['찜한 상품', 'go:stub-wish'],
        ['최근 본 상품', 'go:recent-products'],
        ['리뷰 관리', 'go:stub-review'],
      ]),
    'MY쇼핑'
  );

  sim.register(
    'recent-products',
    ({ state }) => `
      <div class="setting-page">
        <div class="edit-bar">
          <span>${state.recentProducts.length}개의 상품</span>
          ${
            state.recentProducts.length === 0
              ? ''
              : editingRecent
                ? `<button class="txt-btn danger" data-action="ask-del-recent">전체 삭제</button>`
                : `<button class="txt-btn" data-action="edit-recent">편집</button>`
          }
        </div>
        ${
          state.recentProducts.length === 0
            ? '<p class="empty">최근 본 상품이 없습니다.</p>'
            : `<ul class="menu-list">${state.recentProducts
                .map(
                  (p) =>
                    `<li class="kw-row"><span>📦 ${p.name}<small>${p.price}</small></span></li>`
                )
                .join('')}</ul>`
        }
      </div>`,
    '최근 본 상품'
  );

  // ----- AI 트리 (과업 5) -----
  sim.register(
    'ai-services',
    () =>
      list([
        ['AI 브리핑 설정', 'go:ai-briefing'],
        ['음성 비서', 'go:stub-ai-voice'],
        ['AI 데이터 관리', 'go:ai-data'],
      ]),
    'AI 서비스'
  );

  // AI 브리핑 설정 — 잘못 들어와도 실제 화면처럼 보이고, 데이터 관리로 건너갈 수 있다.
  sim.register(
    'ai-briefing',
    () => `
      <div class="setting-page">
        <div class="setting-row">
          <div><b>AI 브리핑 표시</b><small>검색 결과 상단에 AI 요약을 표시합니다</small></div>
          <button class="toggle ${dummyPersonalize ? 'on' : ''}" data-action="dummy-personalize"
            aria-pressed="${dummyPersonalize}"></button>
        </div>
        ${list([['AI 데이터 관리', 'go:ai-data', '대화 데이터의 학습 활용을 관리합니다']])}
      </div>`,
    'AI 브리핑 설정'
  );

  sim.register(
    'ai-data',
    ({ state }) => `
      <div class="setting-page">
        <p class="setting-desc">AI 서비스 품질 향상을 위해 이용 데이터가 활용될 수 있습니다.</p>
        <div class="setting-row">
          <div><b>대화 데이터 학습 활용</b>
          <small>${state.signals.ai_training ? '동의함 (활용 중)' : '제외됨 (활용 안 함)'}</small></div>
        </div>
        ${
          state.signals.ai_training
            ? list([['학습 활용 제외 신청', 'go:ai-optout']])
            : '<p class="setting-desc">제외 신청이 완료되었습니다.</p>'
        }
      </div>`,
    'AI 데이터 관리'
  );

  sim.register(
    'ai-optout',
    () => `
      <div class="setting-page">
        <p class="setting-desc">제외 신청 시 이후의 대화 데이터는 AI 모델 학습에 사용되지 않습니다.
        처리에는 영업일 기준 최대 30일이 소요될 수 있습니다.</p>
        <button class="primary-btn" data-action="ask-ai-optout">제외 신청하기</button>
      </div>`,
    '학습 활용 제외 신청'
  );

  // ----- 무관한 미끼 화면들 -----
  const stubs = {
    'stub-my': 'MY페이지', 'stub-event': '이벤트·혜택', 'stub-notif': '알림 설정',
    'stub-cs': '고객센터', 'stub-notice': '공지사항', 'stub-account': '계정 정보',
    'stub-display': '화면 스타일', 'stub-labs': '실험실', 'stub-version': '버전 정보',
    'stub-autocomplete': '검색어 자동완성', 'stub-filter': '검색 결과 필터',
    'stub-autoplay': '동영상 자동재생', 'stub-font': '글꼴 크기',
    'stub-policy': '개인정보 처리방침', 'stub-ad-push': '광고 알림 수신',
    'stub-ad-id': '광고 식별자 재설정', 'stub-processing': '개인정보 처리 현황',
    'stub-rights': '권리 행사 안내', 'stub-download': '내 데이터 다운로드',
    'stub-category': '카테고리', 'stub-best': '베스트', 'stub-orders': '주문 내역',
    'stub-wish': '찜한 상품', 'stub-review': '리뷰 관리', 'stub-ai-voice': '음성 비서',
  };
  Object.entries(stubs).forEach(([id, title]) => sim.register(id, stub(title), title));

  // ----- 액션: 만류형 확인 대화상자를 거치는 현행 흐름 -----
  sim.onAction('dummy-personalize', () => {
    dummyPersonalize = !dummyPersonalize;
    sim.render();
  });

  sim.onAction('edit-recent', () => {
    editingRecent = true;
    sim.render();
  });

  sim.onAction('ask-del-keyword', () =>
    sim.showModal(`
      <p>키워드를 삭제하면 관련 추천의 정확도가 낮아질 수 있습니다.<br>그래도 삭제하시겠어요?</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">유지하기</button>
        <button class="modal-do" data-action="confirm-del-keyword">삭제</button>
      </div>`)
  );

  // 과업과 무관한 키워드의 삭제도 실제로 동작 — 죽은 버튼이 없도록 한다.
  sim.onAction('del-decoy', (name) =>
    sim.showModal(`
      <p>'${name}' 키워드를 삭제하면 관련 추천의 정확도가 낮아질 수 있습니다.<br>그래도 삭제하시겠어요?</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">유지하기</button>
        <button class="modal-do" data-action="confirm-del-decoy:${name}">삭제</button>
      </div>`)
  );
  sim.onAction('confirm-del-decoy', (name) => {
    decoyKeywords = decoyKeywords.filter((k) => k !== name);
    sim.closeOverlays();
    sim.render();
  });
  sim.onAction('confirm-del-keyword', () => {
    sim.closeOverlays();
    sim.logger?.logToggle('search_wrist', false, sim.current());
    state.mutate((s) => (s.signals.search_wrist = false));
  });

  // ----- 검색기록 관리: 개별 삭제는 즉시, 전체 삭제만 확인을 거친다(현행 관행) -----
  sim.onAction('del-search', (id) => {
    decoySearches = decoySearches.filter((r) => r.id !== id);
    const before = wristSearches.length;
    wristSearches = wristSearches.filter((r) => r.id !== id);
    if (before > 0 && wristSearches.length === 0 && state.signals.search_wrist) {
      // '손목 보호대' 기록을 모두 지움 → 검색어 신호 차단 (과업 1 대체 경로)
      sim.logger?.logToggle('search_wrist', false, sim.current());
      state.mutate((s) => (s.signals.search_wrist = false));
    } else {
      sim.render();
    }
  });

  sim.onAction('ask-clear-search', () =>
    sim.showModal(`
      <p>검색기록을 모두 삭제할까요?<br>삭제한 기록은 복구할 수 없습니다.</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">취소</button>
        <button class="modal-do" data-action="confirm-clear-search">삭제</button>
      </div>`)
  );
  sim.onAction('confirm-clear-search', () => {
    sim.closeOverlays();
    wristSearches = [];
    decoySearches = [];
    if (state.signals.search_wrist) {
      sim.logger?.logToggle('search_wrist', false, sim.current());
      state.mutate((s) => (s.signals.search_wrist = false));
    } else {
      sim.render();
    }
  });

  sim.onAction('toggle-location', () => {
    const next = !state.signals.location;
    sim.logger?.logToggle('location', next, sim.current());
    state.mutate((s) => (s.signals.location = next));
  });

  sim.onAction('ask-ad-off', () =>
    sim.showModal(`
      <p>맞춤형 광고를 끄면 회원님께 덜 유용한 광고가 표시될 수 있습니다.<br>그래도 끄시겠어요?</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">혜택 유지하기</button>
        <button class="modal-do" data-action="confirm-ad-off">끄기</button>
      </div>`)
  );
  sim.onAction('confirm-ad-off', () => {
    sim.closeOverlays();
    sim.logger?.logToggle('personalized_ads', false, sim.current());
    state.mutate((s) => (s.signals.personalized_ads = false));
  });

  sim.onAction('ask-del-recent', () =>
    sim.showModal(`
      <p>최근 본 상품을 모두 삭제할까요?<br>삭제한 기록은 복구할 수 없습니다.</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">취소</button>
        <button class="modal-do" data-action="confirm-del-recent">삭제</button>
      </div>`)
  );
  sim.onAction('confirm-del-recent', () => {
    sim.closeOverlays();
    sim.logger?.logToggle('recent_products_cleared', true, sim.current());
    state.mutate((s) => (s.recentProducts = []));
  });

  sim.onAction('ask-ai-optout', () =>
    sim.showModal(`
      <p>학습 활용을 제외하면 맞춤 응답의 품질이 낮아질 수 있습니다.<br>신청하시겠어요?</p>
      <div class="modal-btns">
        <button class="modal-keep" data-action="close-modal">취소</button>
        <button class="modal-do" data-action="confirm-ai-optout">신청</button>
      </div>`)
  );
  sim.onAction('confirm-ai-optout', () => {
    sim.closeOverlays();
    sim.logger?.logToggle('ai_training', false, sim.current());
    state.mutate((s) => (s.signals.ai_training = false));
    sim.back(); // ai-data 화면으로 복귀해 '제외됨' 상태를 보여준다
  });

  sim.onAction('close-modal', () => sim.closeOverlays());
}
