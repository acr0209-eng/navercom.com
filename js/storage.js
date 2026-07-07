// localStorage 기반 세션 저장소. 서버 없이 브라우저에만 기록한다.

import { CONFIG } from './config.js';

export function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.sessionId === session.sessionId);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(sessions));
}

export function clearSessions() {
  localStorage.removeItem(CONFIG.storageKey);
}

export function newSessionId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
