/**
 * LEAD AI Lab 관리자 화면 — GitHub 로그인 중계 서버 (Cloudflare Workers)
 *
 * GitHub Pages 에는 서버가 없어서, "GitHub로 로그인" 의 마지막 단계(로그인 코드 → 토큰 교환)에 필요한
 * 비밀값(client secret)을 둘 곳이 없습니다. 이 작은 서버가 그 교환 한 가지만 대신 합니다.
 * 데이터베이스·저장 공간이 없고, 받은 토큰을 저장하지도 않습니다.
 *
 *   관리자 화면 → /login?return=<관리자 화면 주소> → GitHub 로그인·허용 → /callback → 관리자 화면#cms_token=…
 *
 * 환경 변수 (Cloudflare 대시보드 › Workers › 이 Worker › Settings › Variables and Secrets)
 *   GITHUB_CLIENT_ID       GitHub App 의 Client ID
 *   GITHUB_CLIENT_SECRET   GitHub App 의 Client secret  ← 반드시 "Secret" 형식으로
 *   ALLOWED_RETURN_URLS    토큰을 돌려보내도 되는 관리자 화면 주소(쉼표로 구분)
 *                          예: https://smu-edtech-lab.github.io/lead-ai-lab/admin,http://localhost:3000/admin
 *
 * ── 검토 요청 (GitHub 계정 없이 고치기) ──────────────────────────────────────────────
 * 비밀번호로 들어온 사람(교수님 등)은 저장소를 직접 고치지 못합니다. 고친 내용은 이 서버가 GitHub App 으로
 * Pull Request(검토 요청)를 만들어 담당자에게 알리고, 담당자가 GitHub 에서 확인한 뒤 Merge 해야 사이트에 반영됩니다.
 * 메모만 보낸 요청은 Issue 로 만듭니다. 아래 값이 모두 있어야 켜집니다(하나라도 없으면 로그인 화면에 나오지 않음).
 *
 *   CMS_REPO                "소유자/저장소" 예: smu-edtech-lab/lead-ai-lab
 *   GITHUB_APP_ID           GitHub App 의 App ID (숫자)
 *   GITHUB_APP_PRIVATE_KEY  GitHub App 의 private key — 내려받은 .pem 파일 내용 전체  ← Secret
 *   REQUEST_PASSCODE        검토 요청 비밀번호 (12자 이상)  ← Secret
 *   REQUEST_NAME            요청한 사람으로 표시할 이름 (선택, 예: 이현우 교수님)
 *   REQUEST_REVIEWERS       알림을 받을 GitHub 아이디 (선택, 쉼표로 구분)
 *   CMS_BRANCH              게시 브랜치 (선택, 기본 main)
 *
 *   POST /request/login   {passcode}  → {token, name, expiresIn}   (8시간 쓰는 입장권)
 *   GET  /request/status              → {enabled}
 *   GET  /request/gh/repos/<저장소>/… → 저장소 읽기만 대신 함 (공개 저장소라 누구나 볼 수 있는 내용)
 *   POST /request/blob    <사진 base64 글자>  → {sha}   (사진을 먼저 올려 두기 — 아래 changes 에 blobSha 로)
 *   POST /request/submit  {base, title, lines, details, memo, changes} → {kind: pull|issue, number, url}
 *
 * 설정 방법 전체: docs/CMS-설정-안내.md
 */

const COOKIE = 'lead_cms_auth';

function normalize(u) {
  return u.replace(/\/+$/, '').replace(/\.html$/, '');
}

/** 허용 목록에 있는 관리자 화면 주소면 그 주소(# 없이)를, 아니면 null */
function allowedReturn(env, value) {
  const allowed = String(env.ALLOWED_RETURN_URLS || '')
    .split(',')
    .map((s) => normalize(s.trim()))
    .filter(Boolean);
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null;
    const target = normalize(`${u.origin}${u.pathname}`);
    return allowed.includes(target) ? `${u.origin}${u.pathname}` : null;
  } catch {
    return null;
  }
}

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const baseHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };

function text(body, status = 200) {
  return new Response(body, { status, headers: { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' } });
}

function redirect(location, cookie) {
  const headers = new Headers({ ...baseHeaders, Location: location });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

const clearCookie = `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;

/* ================================================================ 검토 요청 */

const GH = 'https://api.github.com';
const REQUEST_HOURS = 8;
const REQUEST_BRANCH_PREFIX = 'cms-request/';
const REQUEST_TITLE_PREFIX = '[검토 요청] ';
/** 검토 요청이 고칠 수 있는 파일 — 데이터 파일과 사진만 (관리자 화면과 같은 규칙) */
const DATA_PATH = /^content\/data\/[a-z0-9-]+\.json$/;
const ASSET_PATH = /^public\/images\/(people|news|books|abstracts|projects)\/[a-z0-9][a-z0-9-]*\.(jpg|jpeg|png|webp)$/;
/** 읽기 대신 해 주는 GitHub 주소 (저장소 안, 읽기만) */
const READ_PATH = /^(git\/ref\/heads\/[A-Za-z0-9._/-]+|git\/commits\/[0-9a-f]{40}|git\/blobs\/[0-9a-f]{40}|contents\/[^?#]+|commits|issues)$/;

const enc = new TextEncoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requestEnabled(env) {
  return !!(env.CMS_REPO && env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.REQUEST_PASSCODE);
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** 관리자 화면이 있는 곳(ALLOWED_RETURN_URLS 의 출처)에서 온 요청만 브라우저가 읽을 수 있게 */
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = new Set();
  for (const s of String(env.ALLOWED_RETURN_URLS || '').split(',')) {
    try {
      allowed.add(new URL(s.trim()).origin);
    } catch {
      /* 무시 */
    }
  }
  if (!allowed.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    // 관리자 화면은 GitHub API 와 같은 머리글(Accept, X-GitHub-Api-Version)을 붙여 읽음
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, ...corsHeaders(request, env), 'Content-Type': 'application/json; charset=utf-8' } });
}

/* ---- 입장권: 비밀번호를 확인하면 8시간짜리 서명된 입장권을 줌 (비밀번호를 바꾸면 모든 입장권이 무효) */

async function sessionKey(env) {
  const material = enc.encode(`lead-cms-request|${env.REQUEST_PASSCODE}|${env.GITHUB_CLIENT_SECRET || ''}`);
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', material), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function issueSession(env) {
  const exp = Math.floor(Date.now() / 1000) + REQUEST_HOURS * 3600;
  const payload = b64url(enc.encode(JSON.stringify({ v: 1, exp })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(env), enc.encode(payload)));
  return { token: `${payload}.${b64url(sig)}`, expiresIn: REQUEST_HOURS * 3600 };
}

async function checkSession(request, env) {
  const m = /^Bearer\s+([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(request.headers.get('Authorization') || '');
  if (!m) return false;
  try {
    const ok = await crypto.subtle.verify('HMAC', await sessionKey(env), fromB64url(m[2]), enc.encode(m[1]));
    if (!ok) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(m[1])));
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

/** 비밀번호 비교 — 길이·내용과 관계없이 같은 시간이 걸리도록 해시끼리 비교 */
async function samePasscode(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x);
  const q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}

/* ---- GitHub App 으로 저장소에 접근 (App 의 private key → 1시간짜리 설치 토큰) */

/** GitHub 이 주는 PKCS#1 키("BEGIN RSA PRIVATE KEY")를 브라우저 암호 기능이 읽는 PKCS#8 로 감쌈 */
function pemToPkcs8(pem) {
  const text = String(pem).replace(/\\n/g, '\n');
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(text);
  const body = text.replace(/-----(BEGIN|END)[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  if (!pkcs1) return der;
  const len = (n) => (n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff]);
  const head = [0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00, 0x04, ...len(der.length)];
  const prefix = [0x30, ...len(head.length + der.length), ...head];
  const out = new Uint8Array(prefix.length + der.length);
  out.set(prefix, 0);
  out.set(der, prefix.length);
  return out;
}

let appKeyCache = null; // { pem, key }
let installCache = null; // { token, exp }

async function appJwt(env) {
  if (!appKeyCache || appKeyCache.pem !== env.GITHUB_APP_PRIVATE_KEY) {
    const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(env.GITHUB_APP_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    appKeyCache = { pem: env.GITHUB_APP_PRIVATE_KEY, key };
    installCache = null;
  }
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(env.GITHUB_APP_ID).trim() })));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', appKeyCache.key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

class GhError extends Error {
  constructor(status, data) {
    super(`GitHub ${status} ${(data && data.message) || ''}`.trim());
    this.status = status;
    this.data = data;
  }
}

async function gh(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lead-ai-lab-cms-auth',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = res.status === 204 ? '' : await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw new GhError(res.status, data);
  return data;
}

function repoOf(env) {
  const [owner, name] = String(env.CMS_REPO || '').trim().split('/');
  return { owner, name, full: `${owner}/${name}`, branch: String(env.CMS_BRANCH || 'main').trim() };
}

async function installationToken(env) {
  const repo = repoOf(env);
  const id = `${repo.full}|${env.GITHUB_APP_ID}|${env.GITHUB_APP_PRIVATE_KEY}`;
  if (installCache && installCache.id === id && installCache.exp - Date.now() > 5 * 60 * 1000) return installCache.token;
  const jwt = await appJwt(env);
  const inst = await gh(`/repos/${repo.full}/installation`, { token: jwt });
  const t = await gh(`/app/installations/${inst.id}/access_tokens`, { token: jwt, method: 'POST', body: { repositories: [repo.name] } });
  installCache = { id, token: t.token, exp: Date.parse(t.expires_at) };
  return t.token;
}

/* ---- 요청 내용 확인·만들기 */

const isStr = (v, max) => typeof v === 'string' && v.length <= max;

/** 다른 사람을 부르는 @아이디 가 요청 글에 섞여 알림이 가지 않도록 */
const quiet = (s) => String(s).replace(/@(?=[A-Za-z0-9-])/g, '@​');

function checkChanges(list) {
  if (!Array.isArray(list) || list.length > 40) return '바뀐 파일 목록이 올바르지 않습니다.';
  for (const c of list) {
    if (!c || typeof c.path !== 'string') return '파일 경로가 없습니다.';
    const kinds = ['text', 'base64', 'blobSha', 'remove'].filter((k) => c[k] !== undefined);
    if (kinds.length !== 1) return `파일 변경 형식이 올바르지 않습니다: ${c.path}`;
    if (c.text !== undefined) {
      if (!DATA_PATH.test(c.path) || !isStr(c.text, 3_000_000)) return `고칠 수 없는 파일입니다: ${c.path}`;
      try {
        JSON.parse(c.text);
      } catch {
        return `데이터 파일 형식이 올바르지 않습니다: ${c.path}`;
      }
    } else if (!ASSET_PATH.test(c.path)) return `고칠 수 없는 파일입니다: ${c.path}`;
    else if (c.base64 !== undefined && !isStr(c.base64, 8_000_000)) return `사진 데이터가 올바르지 않습니다: ${c.path}`;
    else if (c.blobSha !== undefined && !(typeof c.blobSha === 'string' && /^[0-9a-f]{40}$/.test(c.blobSha))) return `사진 파일 정보가 올바르지 않습니다: ${c.path}`;
    else if (c.remove !== undefined && c.remove !== true) return `파일 변경 형식이 올바르지 않습니다: ${c.path}`;
  }
  return null;
}

function stampNow() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

/** 받침에 맞는 조사 ('교수님' → '이', '조교' → '가') */
function particle(word, withFinal, withoutFinal) {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? withFinal : withoutFinal;
  return `${withFinal}(${withoutFinal})`;
}

function requestBody(env, input, kind) {
  const name = quiet(String(env.REQUEST_NAME || '').trim() || '검토 요청자');
  const reviewers = String(env.REQUEST_REVIEWERS || '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter((s) => /^[A-Za-z0-9-]{1,39}$/.test(s));
  const out = [`**${name}**${particle(name, '이', '가')} 홈페이지 관리 화면에서 보낸 검토 요청입니다.`, ''];
  if (input.memo.trim()) out.push('### 요청 메모', '', ...quiet(input.memo.trim()).split('\n').map((l) => `> ${l}`), '');
  // 바뀐 칸 표(details)가 있으면 그것으로, 없으면 한 줄 설명(lines)으로
  if (input.details.trim()) out.push('### 바뀌는 내용', '', quiet(input.details.trim()), '');
  else if (input.lines.length) out.push('### 바뀌는 내용', '', ...input.lines.map((l) => `- ${quiet(l)}`), '');
  out.push('---');
  if (kind === 'pull') {
    out.push(
      '**확인하는 방법** — 위 표나 **Files changed** 탭에서 바뀐 내용을 확인하고, 반영하려면 아래 **Merge pull request** → **Confirm** 을 누릅니다. 1~2분 뒤 사이트에 반영됩니다.',
      '반영하지 않으려면 **Close pull request** 를 누르고, 이유를 댓글로 남겨 주세요.',
    );
  } else {
    out.push('**메모로 온 요청**입니다. 관리 화면에 칸이 없는 내용(화면 배치·디자인·로고·메뉴 구성 등)이라 담당자가 직접 반영합니다. 반영한 뒤 **Close issue** 를 누릅니다.');
  }
  if (reviewers.length) out.push('', `확인 부탁드립니다: ${reviewers.map((r) => `@${r}`).join(' ')}`);
  return { body: out.join('\n'), reviewers };
}

async function submitRequest(env, input) {
  const repo = repoOf(env);
  const token = await installationToken(env);
  const hasChanges = input.changes.length > 0;
  const { body, reviewers } = requestBody(env, input, hasChanges ? 'pull' : 'issue');
  const title = `${REQUEST_TITLE_PREFIX}${input.title.replace(/^\[CMS\]\s*/, '').trim() || '내용 수정'}`.slice(0, 120);

  if (!hasChanges) {
    try {
      const issue = await gh(`/repos/${repo.full}/issues`, { token, method: 'POST', body: { title, body } });
      return { kind: 'issue', number: issue.number, url: issue.html_url };
    } catch (e) {
      if (e instanceof GhError && e.status === 403) throw new Error('메모만 보내는 요청은 GitHub App 에 Issues 권한이 있어야 받을 수 있습니다. 담당자에게 알려 주세요 (설정 안내 14장).');
      throw e;
    }
  }

  const base = await gh(`/repos/${repo.full}/git/commits/${input.base}`, { token });
  const tree = [];
  for (const c of input.changes) {
    if (c.remove) tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
    else if (c.text !== undefined) tree.push({ path: c.path, mode: '100644', type: 'blob', content: c.text });
    else if (c.base64 !== undefined) {
      const blob = await gh(`/repos/${repo.full}/git/blobs`, { token, method: 'POST', body: { content: c.base64.replace(/\s/g, ''), encoding: 'base64' } });
      tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
    } else tree.push({ path: c.path, mode: '100644', type: 'blob', sha: c.blobSha });
  }
  const t = await gh(`/repos/${repo.full}/git/trees`, { token, method: 'POST', body: { base_tree: base.tree.sha, tree } });
  const message = [title, '', ...input.lines.map((l) => `- ${l}`), '', `관리자 화면에서 검토 요청 (${String(env.REQUEST_NAME || '').trim() || '검토 요청자'})`].join('\n');
  const commit = await gh(`/repos/${repo.full}/git/commits`, { token, method: 'POST', body: { message, tree: t.sha, parents: [input.base] } });
  const branch = `${REQUEST_BRANCH_PREFIX}${stampNow()}-${randomHex(2)}`;
  await gh(`/repos/${repo.full}/git/refs`, { token, method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
  const pull = await gh(`/repos/${repo.full}/pulls`, { token, method: 'POST', body: { title, body, head: branch, base: repo.branch } });
  if (reviewers.length) {
    // 저장소 협업자가 아니면 거절되지만, 위 본문의 @아이디 로도 알림이 가므로 무시
    await gh(`/repos/${repo.full}/pulls/${pull.number}/requested_reviewers`, { token, method: 'POST', body: { reviewers } }).catch(() => undefined);
  }
  return { kind: 'pull', number: pull.number, url: pull.html_url };
}

async function handleRequest(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...baseHeaders, ...corsHeaders(request, env) } });
  if (url.pathname === '/request/status') return json(request, env, { enabled: requestEnabled(env) });
  if (!requestEnabled(env)) return json(request, env, { message: '검토 요청 기능이 아직 설정되지 않았습니다.' }, 501);

  if (url.pathname === '/request/login' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const passcode = typeof input.passcode === 'string' ? input.passcode : '';
    if (!passcode || !(await samePasscode(passcode, String(env.REQUEST_PASSCODE)))) {
      await sleep(1200); // 비밀번호를 마구 넣어 보는 것을 느리게
      return json(request, env, { message: '비밀번호가 맞지 않습니다.' }, 401);
    }
    const s = await issueSession(env);
    return json(request, env, { ...s, name: String(env.REQUEST_NAME || '').trim() || '검토 요청자' });
  }

  if (!(await checkSession(request, env))) return json(request, env, { message: '입장 시간이 지났습니다. 비밀번호로 다시 들어와 주세요.' }, 401);
  const repo = repoOf(env);

  if (url.pathname.startsWith('/request/gh/') && request.method === 'GET') {
    const path = url.pathname.slice('/request/gh'.length);
    const prefix = `/repos/${repo.full}/`;
    let rest = '';
    try {
      rest = path.toLowerCase().indexOf(prefix.toLowerCase()) === 0 ? decodeURIComponent(path.slice(prefix.length)) : '';
    } catch {
      rest = '';
    }
    if (!rest || rest.includes('..') || !READ_PATH.test(rest)) {
      return json(request, env, { message: '읽을 수 없는 주소입니다.' }, 403);
    }
    const res = await fetch(`${GH}${path}${url.search}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${await installationToken(env)}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'lead-ai-lab-cms-auth',
      },
    });
    return new Response(await res.text(), { status: res.status, headers: { ...baseHeaders, ...corsHeaders(request, env), 'Content-Type': 'application/json; charset=utf-8' } });
  }

  // 사진은 요청 본문(JSON)에 넣지 않고 먼저 따로 올림 — 큰 사진을 JSON 으로 읽고 쓰면 무료 요금제의 처리 시간 한도(요청당 약 10ms)를 넘을 수 있어서.
  // 본문은 base64 글자 그대로 받아 GitHub 에 그대로 넘기고, 돌려받은 blob sha 를 /request/submit 의 changes 에 {path, blobSha} 로 씀
  if (url.pathname === '/request/blob' && request.method === 'POST') {
    const b64 = await request.text();
    if (!b64 || b64.length > 12_000_000 || b64.includes('"') || b64.includes('\\')) return json(request, env, { message: '사진 데이터가 올바르지 않습니다.' }, 400);
    const res = await fetch(`${GH}/repos/${repo.full}/git/blobs`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${await installationToken(env)}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'lead-ai-lab-cms-auth',
        'Content-Type': 'application/json',
      },
      body: `{"content":"${b64}","encoding":"base64"}`,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.sha !== 'string') return json(request, env, { message: `사진을 올리지 못했습니다 (GitHub ${res.status} ${data.message || ''})`.trim() }, 502);
    return json(request, env, { sha: data.sha });
  }

  if (url.pathname === '/request/submit' && request.method === 'POST') {
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== 'object') return json(request, env, { message: '요청 내용을 읽을 수 없습니다.' }, 400);
    const memo = isStr(input.memo, 4000) ? input.memo : '';
    const changes = Array.isArray(input.changes) ? input.changes : [];
    if (!changes.length && !memo.trim()) return json(request, env, { message: '바뀐 내용이나 메모가 없습니다.' }, 400);
    const problem = checkChanges(changes);
    if (problem) return json(request, env, { message: problem }, 400);
    if (changes.length && !(typeof input.base === 'string' && /^[0-9a-f]{40}$/.test(input.base))) return json(request, env, { message: '기준 커밋이 올바르지 않습니다.' }, 400);
    const lines = Array.isArray(input.lines) ? input.lines.filter((l) => isStr(l, 300)).slice(0, 50) : [];
    try {
      const r = await submitRequest(env, {
        base: input.base,
        changes,
        memo,
        lines,
        title: isStr(input.title, 200) ? input.title : '',
        details: isStr(input.details, 50000) ? input.details : '',
      });
      return json(request, env, r);
    } catch (e) {
      return json(request, env, { message: e instanceof GhError ? `GitHub 에 요청을 만들지 못했습니다 (${e.message})` : String(e.message || e) }, 502);
    }
  }

  return json(request, env, { message: '알 수 없는 요청입니다.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/request/')) {
      try {
        return await handleRequest(request, env, url);
      } catch (e) {
        return json(request, env, { message: `검토 요청 서버 오류: ${String((e && e.message) || e)}` }, 500);
      }
    }

    if (url.pathname === '/login') {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return text('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.', 500);
      const back = allowedReturn(env, url.searchParams.get('return') || '');
      if (!back) return text('허용되지 않은 관리자 화면 주소입니다. Worker 의 ALLOWED_RETURN_URLS 설정을 확인해 주세요.', 400);
      const state = randomHex(16);
      const auth = new URL('https://github.com/login/oauth/authorize');
      auth.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      auth.searchParams.set('redirect_uri', `${url.origin}/callback`);
      auth.searchParams.set('state', state);
      const value = encodeURIComponent(`${state}|${back}`);
      return redirect(auth.toString(), `${COOKIE}=${value}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }

    if (url.pathname === '/callback') {
      const saved = readCookie(request, COOKIE) || '';
      const cut = saved.indexOf('|');
      const state = cut > 0 ? saved.slice(0, cut) : '';
      const back = cut > 0 ? allowedReturn(env, saved.slice(cut + 1)) : null;
      if (!state || !back || url.searchParams.get('state') !== state) {
        return text('로그인 요청이 만료되었거나 올바르지 않습니다. 관리자 화면에서 다시 로그인해 주세요.', 400);
      }
      const ghError = url.searchParams.get('error');
      if (ghError) return redirect(`${back}#cms_error=${encodeURIComponent(url.searchParams.get('error_description') || ghError)}`, clearCookie);

      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'lead-ai-lab-cms-auth' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: url.searchParams.get('code') || '',
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.access_token) {
        return redirect(`${back}#cms_error=${encodeURIComponent(data.error_description || data.error || '토큰을 받지 못했습니다')}`, clearCookie);
      }
      const extra = data.expires_in ? `&cms_expires=${encodeURIComponent(String(data.expires_in))}` : '';
      return redirect(`${back}#cms_token=${encodeURIComponent(data.access_token)}${extra}`, clearCookie);
    }

    return text('LEAD AI Lab 관리자 화면의 GitHub 로그인 중계 서버입니다.');
  },
};
