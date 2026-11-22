/**
 * 로그인 — "GitHub로 로그인" 은 로그인 중계 서버(cms-auth/worker.js)를 거쳐 GitHub 토큰을 받아 옵니다.
 *
 *   관리자 화면 → 중계 서버 /login → GitHub 로그인·허용 → 중계 서버 /callback → 관리자 화면#cms_token=…
 *
 * 토큰은 주소의 # 뒷부분(서버로 전송되지 않음)으로 돌아오며, 받자마자 주소에서 지우고 이 탭의 sessionStorage 에만 둡니다.
 * 탭을 닫으면 사라지므로 공용 PC 에서도 안전하게 쓸 수 있습니다. GitHub App 토큰은 8시간 뒤 만료됩니다.
 */
import { cmsConfig } from './config';

const TOKEN_KEY = 'lead-cms:token';

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredToken(): string | null {
  return session()?.getItem(TOKEN_KEY) ?? null;
}

export function storeToken(token: string) {
  session()?.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  session()?.removeItem(TOKEN_KEY);
}

/** 로그인 후 돌아온 주소(#cms_token=… 또는 #cms_error=…)를 읽고 주소에서 지웁니다 */
export function takeAuthResult(): { token?: string; error?: string } {
  const hash = window.location.hash.replace(/^#/, '');
  if (!/(^|&)cms_(token|error)=/.test(hash)) return {};
  const params = new URLSearchParams(hash);
  const token = params.get('cms_token') ?? undefined;
  const error = params.get('cms_error') ?? undefined;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (token) storeToken(token);
  return { token, error };
}

/** 지금 주소(관리자 화면)로 돌아오도록 한 중계 서버 로그인 주소. 중계 서버가 설정되지 않았으면 null */
export function loginUrl(): string | null {
  if (!cmsConfig.authUrl) return null;
  const back = `${window.location.origin}${window.location.pathname}`;
  return `${cmsConfig.authUrl}/login?return=${encodeURIComponent(back)}`;
}

/* ----------------------------------------------------------------------------
 * 검토 요청 모드 — GitHub 계정 없이 비밀번호로 들어감.
 * 중계 서버가 비밀번호를 확인하고 8시간짜리 입장권을 주며, 입장권도 이 탭의 sessionStorage 에만 둡니다.
 * -------------------------------------------------------------------------- */

const REQUEST_KEY = 'lead-cms:request';

export interface RequestSession {
  token: string;
  /** 요청한 사람으로 표시할 이름 (중계 서버의 REQUEST_NAME) */
  name: string;
  /** 만료 시각 (ms) */
  exp: number;
}

export function getRequestSession(): RequestSession | null {
  const raw = session()?.getItem(REQUEST_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as RequestSession;
    if (typeof s.token === 'string' && typeof s.exp === 'number' && s.exp > Date.now() + 60 * 1000) return s;
  } catch {
    /* 아래에서 지움 */
  }
  session()?.removeItem(REQUEST_KEY);
  return null;
}

export function clearRequestSession() {
  session()?.removeItem(REQUEST_KEY);
}

/** 중계 서버에 검토 요청 기능이 켜져 있는지 (예전 중계 서버이거나 설정 전이면 false) */
export async function requestModeEnabled(): Promise<boolean> {
  if (!cmsConfig.authUrl) return false;
  try {
    const res = await fetch(`${cmsConfig.authUrl}/request/status`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

/** 비밀번호로 입장권 받기 — 틀리면 Error(사람이 읽을 문장) */
export async function requestLogin(passcode: string): Promise<RequestSession> {
  let res: Response;
  try {
    res = await fetch(`${cmsConfig.authUrl}/request/login`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
  } catch {
    throw new Error('로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.');
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string; name?: string; expiresIn?: number; message?: string };
  if (!res.ok || !data.token) throw new Error(data.message || `들어가지 못했습니다 (${res.status}).`);
  const s: RequestSession = { token: data.token, name: data.name || '검토 요청자', exp: Date.now() + (data.expiresIn ?? 8 * 3600) * 1000 };
  session()?.setItem(REQUEST_KEY, JSON.stringify(s));
  return s;
}
