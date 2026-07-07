// 시행(trial) 단위 이벤트 로거.
// 과업 시작~종료 사이의 클릭·화면 전환·토글을 타임스탬프와 함께 기록하고,
// 종료 시 지표(클릭 수·뎁스·소요 시간·성공 여부)로 집계한다.
//
// 측정 규칙(README에 문서화):
// - 클릭 수: 시뮬레이션 프레임 안에서 발생한 모든 클릭(오조작 포함).
//   실사용의 상호작용 비용을 그대로 재는 것이 목적이므로 최소 경로가 아니라 실제 클릭을 센다.
// - 경로 뎁스: 화면(페이지) 전환 수. 바텀시트는 '페이지 이동 없음'(제안서 3.2절)이므로
//   화면 전환으로 세지 않는다(클릭으로는 센다).

export class TrialLogger {
  constructor({ participantId, condition, taskId }) {
    this.meta = { participantId, condition, taskId };
    this.events = [];
    this.startedAt = null;
    this.endedAt = null;
    this.result = null; // 'success' | 'fail_timeout' | 'fail_giveup'
  }

  start() {
    this.startedAt = performance.now();
    this.push('task_start', {});
  }

  push(type, data) {
    if (this.result != null && type !== 'task_success' && type !== 'task_fail') return;
    this.events.push({
      type,
      ...data,
      t: this.startedAt == null ? 0 : Math.round(performance.now() - this.startedAt),
    });
  }

  logClick(target, screen) {
    this.push('click', { target, screen });
  }

  logScreen(screen) {
    this.push('screen', { screen });
  }

  logToggle(signal, value, screen) {
    this.push('toggle', { target: signal, value, screen });
  }

  end(result) {
    if (this.endedAt != null) return;
    this.endedAt = performance.now();
    this.result = result;
    this.push(result === 'success' ? 'task_success' : 'task_fail', { result });
  }

  // 집계 지표. end() 이후에 호출한다.
  metrics() {
    const clicks = this.events.filter((e) => e.type === 'click').length;
    // 첫 'screen' 이벤트는 과업 시작 시 초기 화면 렌더이므로 뎁스에서 제외한다.
    const screens = Math.max(0, this.events.filter((e) => e.type === 'screen').length - 1);
    const durationSec = (this.endedAt - this.startedAt) / 1000;
    return {
      clicks,
      screens,
      durationSec: Math.round(durationSec * 10) / 10,
      success: this.result === 'success',
      result: this.result,
    };
  }
}
