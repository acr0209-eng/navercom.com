// 시뮬레이션 앱의 데이터 상태.
// 시행(trial)마다 fresh 상태로 초기화되어 과업 성공 판정의 기준이 된다.
// 상태 변경은 반드시 mutate()를 거쳐 리스너(성공 판정·리렌더)에 통지된다.

export function createSimState() {
  const state = {
    // 개인화에 쓰이는 데이터 신호. true = 사용 중.
    signals: {
      search_wrist: true,      // 최근 검색어 '손목 보호대' (과업 1 대상)
      shopping_click: true,    // 쇼핑 클릭 이력
      purchase_category: true, // 구매 카테고리
      personalized_ads: true,  // 맞춤형 광고 (과업 2 대상)
      location: true,          // 위치 정보 (AI 브리핑 참고)
      ai_training: true,       // 내 대화의 AI 학습 활용 (과업 5 대상)
    },
    // '최근 본 상품' 기록 (과업 3 대상)
    recentProducts: [
      { id: 'p1', name: '손목 보호대 슬림핏', price: '12,900원' },
      { id: 'p2', name: '무선 버티컬 마우스', price: '29,800원' },
      { id: 'p3', name: '모니터 받침대 원목', price: '18,500원' },
    ],
    // 개인정보 이용내역 화면 열람 여부 (과업 4 대상)
    viewedUsageHistory: false,
    // 프라이버시 센터 이력 — 영수증에서의 모든 행동이 여기 적재된다(제안서 3.2절 말미).
    privacyHistory: [
      { when: '기본 제공', text: '개인 맞춤 서비스 이용 동의 (가입 시)' },
    ],
    listeners: [],
  };

  state.onChange = (fn) => state.listeners.push(fn);
  state.mutate = (fn) => {
    fn(state);
    state.listeners.forEach((l) => l(state));
  };
  return state;
}

// 신호 id → 이용자에게 보여줄 생활 언어 라벨 (법률·기술 용어 배제, 제안서 3.2절)
export const SIGNAL_LABELS = {
  search_wrist: "최근 검색어 '손목 보호대' 2건",
  shopping_click: '쇼핑에서 클릭한 상품 1건',
  purchase_category: "구매 카테고리 '건강/의료용품' 1건",
  personalized_ads: '맞춤형 광고 (관심사 기반)',
  location: '현재 위치 (지역 정보)',
  ai_training: '내 대화의 AI 학습 활용',
};

// 신호를 끄면 무엇이 달라지는지 미리보기 문구 (제안서 3.2절: 즉각 피드백)
export const SIGNAL_PREVIEWS = {
  search_wrist: '이 신호를 끄면 손목 보호대 관련 추천이 줄어듭니다.',
  shopping_click: '이 신호를 끄면 최근 클릭 상품 기반 추천이 줄어듭니다.',
  purchase_category: '이 신호를 끄면 구매 이력 기반 추천이 줄어듭니다.',
  personalized_ads: '이 신호를 끄면 관심사 기반 광고 대신 일반 광고가 표시됩니다.',
  location: '이 신호를 끄면 지역 기반 정보가 응답에 반영되지 않습니다.',
  ai_training: '이후의 대화가 AI 모델 학습에 사용되지 않습니다.',
};
