/**
 * 검토 요청 모드 — GitHub 계정 없이 비밀번호로 들어온 사람(교수님 등)용 저장소 연결.
 *
 * - 읽기: 로그인 중계 서버(cms-auth/worker.js)가 GitHub App 으로 대신 읽어 줍니다 (공개 저장소 내용).
 * - 쓰기: 저장소를 직접 고치지 않습니다. 편집자와 같은 방식으로 바뀐 파일을 만든 뒤 중계 서버에 보내면,
 *         중계 서버가 Pull Request(검토 요청)를 만들어 담당자에게 알립니다. 담당자가 GitHub 에서 확인하고 Merge 해야 사이트에 반영됩니다.
 *         메모만 보낸 요청(관리 화면에서 고칠 수 없는 배치·디자인·문구 등)은 Issue 로 만듭니다.
 */
import { areaOptions, collections, itemsOf, keyOf, type FieldDef, type Item } from './collections';
import type { ProjectRef } from './engine';
import { GitHubBackend } from './github';
import { josa } from './josa';
import { describeOp, isDataOp, sameValue, type Op } from './ops';
import { CmsError, type CmsUser, type DeployInfo, type FileChange, type PullInfo, type RequestInfo, type RequestInput, type RequestResult } from './types';

/** 중계 서버가 요청 제목 앞에 붙이는 말 — 보낸 요청 목록을 고를 때 씀 */
export const REQUEST_TITLE_PREFIX = '[검토 요청]';

interface GhIssue {
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  user: { type: string } | null;
  pull_request?: { merged_at: string | null };
}

export class RequestBackend extends GitHubBackend {
  constructor(
    private session: string,
    private authUrl: string,
    owner: string,
    repo: string,
    branch: string,
    private displayName: string,
  ) {
    super(session, owner, repo, branch, `${authUrl}/request/gh`);
  }

  async getUser(): Promise<CmsUser> {
    return { login: 'request', id: 0, name: this.displayName, avatarUrl: '', role: 'requester' };
  }

  /** 검토 요청은 바로 배포되지 않으므로 위쪽 막대에 반영 상태를 보이지 않음 */
  async latestDeploy(): Promise<DeployInfo | null> {
    return null;
  }

  private readOnly(): never {
    throw new CmsError('forbidden', '검토 요청 모드에서는 저장소를 직접 고칠 수 없습니다.');
  }
  async createCommit(): Promise<string> {
    return this.readOnly();
  }
  async setBranch(): Promise<void> {
    return this.readOnly();
  }
  async deleteBranch(): Promise<void> {
    return this.readOnly();
  }
  async createPull(): Promise<PullInfo> {
    return this.readOnly();
  }
  async mergePull(): Promise<void> {
    return this.readOnly();
  }

  /** 중계 서버에 보내고 JSON 응답을 받음 — 401 은 입장 시간 만료 */
  private async post<T>(path: string, body: string, contentType: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.authUrl}${path}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${this.session}`, 'Content-Type': contentType },
        body,
      });
    } catch (e) {
      throw new CmsError('network', '로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.', e);
    }
    const data = (await res.json().catch(() => ({}))) as T & { message?: string };
    if (res.status === 401) throw new CmsError('unauthorized', data.message || '입장 시간이 지났습니다. 비밀번호로 다시 들어와 주세요.');
    if (!res.ok) throw new CmsError(res.status === 400 ? 'validation' : 'unknown', data.message || `요청을 보내지 못했습니다 (${res.status}).`);
    return data;
  }

  async submitRequest(input: RequestInput): Promise<RequestResult> {
    // 사진은 먼저 하나씩 올려 두고(큰 사진을 요청 본문에 넣지 않도록) 요청에는 올려 둔 파일 표시(blob sha)만 넣음
    const changes: FileChange[] = [];
    for (const c of input.changes) {
      if ('base64' in c) {
        const { sha } = await this.post<{ sha?: string }>('/request/blob', c.base64.replace(/\s/g, ''), 'text/plain');
        if (!sha) throw new CmsError('unknown', `사진을 올리지 못했습니다: ${c.path}`);
        changes.push({ path: c.path, blobSha: sha });
      } else changes.push(c);
    }
    const data = await this.post<Partial<RequestResult>>('/request/submit', JSON.stringify({ ...input, changes }), 'application/json');
    if (!data.kind) throw new CmsError('unknown', '요청을 보내지 못했습니다.');
    return { kind: data.kind, number: data.number ?? 0, url: data.url ?? '' };
  }

  async myRequests(limit: number): Promise<RequestInfo[]> {
    const r = await this.req<GhIssue[]>('GET', `${this.base}/issues?state=all&sort=created&direction=desc&per_page=50`);
    return r
      .filter((i) => i.title.startsWith(REQUEST_TITLE_PREFIX) && i.user?.type === 'Bot')
      .slice(0, limit)
      .map((i) => ({
        title: i.title.slice(REQUEST_TITLE_PREFIX.length).trim(),
        kind: i.pull_request ? 'pull' : 'issue',
        state: i.pull_request?.merged_at ? 'merged' : i.state === 'open' ? 'open' : 'closed',
        at: i.created_at,
        url: i.html_url,
      }));
  }
}

/* ------------------------------------------------------ 요청 글의 바뀐 칸 표 */

/** Markdown 표 칸에 넣을 글 — 줄바꿈·| 를 표가 깨지지 않게 바꾸고 너무 길면 자름 */
function cell(s: string): string {
  const t = s.length > 400 ? `${s.slice(0, 399)}…` : s;
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>') || '(없음)';
}

function plainValue(f: FieldDef, v: unknown, projects: ProjectRef[]): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return '';
  switch (f.type) {
    case 'select':
      return f.options?.find((o) => o.value === v)?.label ?? String(v);
    case 'areas':
      return (v as string[]).map((a) => areaOptions.find((o) => o.value === a)?.label ?? a).join(', ');
    case 'tags':
      return (v as string[]).join(', ');
    case 'paragraphs':
      return (v as string[]).join('\n\n');
    case 'checkbox':
      return v === true ? '예' : '아니오';
    case 'list':
      return (v as Item[])
        .map((r) => {
          const p = r.projectId ? projects.find((x) => x.id === r.projectId) : null;
          const head = p ? `[연구실 과제] ${p.title} (${p.period})` : [r.period, r.title].filter(Boolean).join(' · ');
          const line = [head, r.role, r.detail].filter(Boolean).join(' · ');
          return r.hidden === true ? `${line} — 사이트에 표시 안 함` : line;
        })
        .join('\n');
    default:
      return String(v);
  }
}

/** 요청 글에 넣을 바뀐 칸 표 — 담당자가 GitHub 에서 JSON 대신 이 표로 확인 */
export function requestDetails(ops: Op[], files: Record<string, unknown>, projects: ProjectRef[]): string {
  const out: string[] = [];
  for (const op of ops.filter(isDataOp)) {
    const def = collections[op.collection];
    out.push(`#### ${describeOp(op)}`, '');
    if (op.kind === 'delete') {
      out.push(`이 ${josa(def.itemLabel, '을', '를')} 사이트에서 지웁니다.`, '');
      continue;
    }
    if (op.kind === 'order') {
      const all = itemsOf(files[def.file], def.arrayKey);
      const titles = op.keys.map((k) => all.find((x) => keyOf(x) === k)).filter((x): x is Item => !!x).map((x) => def.title(x));
      out.push('새 순서:', '', ...titles.map((t, i) => `${i + 1}. ${cell(t)}`), '');
      continue;
    }
    const rows = [{ name: def.keyField, label: def.keyField === 'slug' ? '사이트 주소' : '번호', type: 'text' } as FieldDef, ...def.fields]
      .map((f) => ({ f, old: plainValue(f, op.before?.[f.name], projects), now: plainValue(f, op.item[f.name], projects), same: sameValue(op.before?.[f.name] ?? null, op.item[f.name] ?? null) }))
      .filter((r) => !r.same && !(op.before && r.f.name === def.keyField));
    if (!rows.length) {
      out.push('바뀐 칸이 없습니다.', '');
      continue;
    }
    if (op.before) out.push('| 칸 | 지금 사이트 | 바꿀 내용 |', '|---|---|---|', ...rows.map((r) => `| ${r.f.label} | ${cell(r.old)} | ${cell(r.now)} |`), '');
    else out.push('| 칸 | 새로 올릴 내용 |', '|---|---|', ...rows.map((r) => `| ${r.f.label} | ${cell(r.now)} |`), '');
  }
  const fileOps = ops.filter((op) => !isDataOp(op));
  if (fileOps.length) out.push('#### 사진 파일', '', ...fileOps.map((op) => `- ${describeOp(op)}`), '');
  return out.join('\n');
}
