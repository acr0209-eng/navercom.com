// 제안서 4.2절의 대표 과업 5종 + 성공 판정 프레디킷.
// 프레디킷은 시뮬레이션 상태만 보고 판정하므로 두 조건(A/B)에 동일하게 적용된다.

export const TASKS = [
  {
    id: 't1',
    title: "과업 1 · 특정 검색어 추천 차단",
    instruction:
      "'손목 보호대'를 검색한 뒤로 관련 쇼핑 추천이 계속 표시됩니다. " +
      "이 검색어가 추천에 사용되지 않도록 차단하세요.",
    isDone: (s) => s.signals.search_wrist === false,
  },
  {
    id: 't2',
    title: '과업 2 · 맞춤형 광고 중지',
    instruction: '내 관심사를 기반으로 한 맞춤형 광고 수신을 중지하세요.',
    isDone: (s) => s.signals.personalized_ads === false,
  },
  {
    id: 't3',
    title: "과업 3 · '최근 본 상품' 기록 삭제",
    instruction: "쇼핑에서 '최근 본 상품' 기록을 모두 삭제하세요.",
    isDone: (s) => s.recentProducts.length === 0,
  },
  {
    id: 't4',
    title: '과업 4 · 개인정보 이용내역 열람',
    instruction: '내 개인정보가 어떻게 이용되고 있는지 이용내역 화면을 찾아 열람하세요.',
    isDone: (s) => s.viewedUsageHistory === true,
  },
  {
    id: 't5',
    title: '과업 5 · AI 학습 활용 제외',
    instruction:
      '내 이용 데이터(대화)가 AI 학습에 활용되는지 확인하고, 활용되지 않도록 제외를 신청하세요.',
    isDone: (s) => s.signals.ai_training === false,
  },
];

export function getTask(id) {
  return TASKS.find((t) => t.id === id);
}
