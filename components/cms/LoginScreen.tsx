'use client';
import { useEffect, useState } from 'react';
import { loginUrl, requestLogin, requestModeEnabled, type RequestSession } from '@/lib/cms/auth';
import { cmsConfig, guideUrl, requestGuideUrl } from '@/lib/cms/config';
import { Btn, Notice } from './ui';

export function LoginScreen({
  error,
  onToken,
  onRequest,
  onMock,
}: {
  error?: string;
  onToken: (token: string) => void;
  /** 검토 요청 비밀번호로 들어왔을 때 */
  onRequest: (s: RequestSession) => void;
  /** 체험 모드 — requester: 검토 요청 모드로 체험 */
  onMock?: (requester: boolean) => void;
}) {
  const [token, setToken] = useState('');
  /* 검토 요청(GitHub 계정 없이 들어가기) — 중계 서버에 켜져 있을 때만 보여 줌 */
  const [reqOn, setReqOn] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState('');
  useEffect(() => {
    let alive = true;
    void requestModeEnabled().then((v) => {
      if (alive) setReqOn(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  const url = typeof window !== 'undefined' ? loginUrl() : null;
  const guide = guideUrl();
  const requestGuide = requestGuideUrl();
  return (
    <div className="cms cms--center">
      <main className="cms-login" aria-labelledby="cms-login-title">
        <p className="cms-login__brand">
          LEAD AI LAB<span aria-hidden="true">.</span>
        </p>
        <h1 id="cms-login-title" className="cms-login__title">
          홈페이지 관리
        </h1>
        <p className="cms-login__lead">
          소식·구성원·졸업생, 논문·저역서·학술발표·연구 과제, 연구실 정보와 페이지 문구를 고치고, 바뀐 내용을 확인한 뒤 사이트에 게시합니다. 연구실 저장소에 초대받은 GitHub 계정으로 로그인하세요.
          {reqOn ? ' GitHub 계정이 없으면 아래 검토 요청 비밀번호로 들어갑니다.' : ''}
        </p>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {url ? (
          <a className="cms-btn cms-btn--primary cms-login__main" href={url}>
            <span>GitHub 계정으로 로그인</span>
          </a>
        ) : (
          <Notice tone="warn" title="GitHub 로그인이 아직 설정되지 않았습니다">
            로그인 중계 서버 주소(CMS_AUTH_URL)가 없습니다. 저장소의 <code>docs/CMS-설정-안내.md</code> 를 따라 설정하면 &lsquo;GitHub 계정으로 로그인&rsquo; 버튼이 생깁니다. 그 전에는 아래 토큰 로그인을 쓸 수 있습니다.
          </Notice>
        )}

        {reqOn ? (
          <section className="cms-login__request" aria-labelledby="cms-req-title">
            <h2 id="cms-req-title" className="cms-login__subtitle">
              GitHub 계정이 없다면
            </h2>
            <p className="cms-help">
              고친 내용은 바로 게시되지 않고, 홈페이지 담당자에게 검토 요청으로 갑니다. 담당자가 확인하면 사이트에 반영됩니다.
              {requestGuide ? (
                <>
                  {' '}
                  <a href={requestGuide} target="_blank" rel="noreferrer noopener">
                    검토 요청 안내 ↗
                  </a>
                </>
              ) : null}
            </p>
            <form
              className="cms-login__token"
              onSubmit={(e) => {
                e.preventDefault();
                if (!passcode || reqBusy) return;
                setReqBusy(true);
                setReqError('');
                requestLogin(passcode)
                  .then((rs) => onRequest(rs))
                  .catch((err: unknown) => {
                    setReqError(err instanceof Error ? err.message : String(err));
                    setReqBusy(false);
                  });
              }}
            >
              <label className="cms-label" htmlFor="cms-req-pass">
                검토 요청 비밀번호
              </label>
              <input
                id="cms-req-pass"
                className="cms-input"
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                aria-invalid={reqError ? true : undefined}
                aria-describedby={reqError ? 'cms-req-error' : undefined}
              />
              {reqError ? (
                <p className="cms-error" id="cms-req-error">
                  {reqError}
                </p>
              ) : null}
              <Btn type="submit" variant="secondary" busy={reqBusy} disabled={!passcode}>
                비밀번호로 들어가기
              </Btn>
            </form>
          </section>
        ) : null}

        {guide ? (
          <p className="cms-help cms-login__guide">
            처음이라면{' '}
            <a href={guide} target="_blank" rel="noreferrer noopener">
              사용 안내
            </a>
            에서 편집자로 초대받는 방법과 자주 하는 일을 먼저 확인하세요.
          </p>
        ) : null}

        <details className="cms-login__more" open={!url && !onMock}>
          <summary>토큰으로 로그인 (담당자 비상용)</summary>
          <form
            className="cms-login__token"
            onSubmit={(e) => {
              e.preventDefault();
              if (token.trim()) onToken(token.trim());
            }}
          >
            <label className="cms-label" htmlFor="cms-token">
              GitHub 개인 접근 토큰
            </label>
            <input
              id="cms-token"
              className="cms-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
            />
            <p className="cms-help">
              GitHub › Settings › Developer settings › Fine-grained tokens 에서 <strong>{cmsConfig.repo || '이 저장소'}</strong> 하나만 고르고 Contents·Pull requests 를 Read and write 로 준 토큰을 만듭니다. 토큰은 이 탭에만 보관되고 탭을 닫으면 지워집니다.
            </p>
            <Btn type="submit" variant="secondary" disabled={!token.trim()}>
              토큰으로 로그인
            </Btn>
          </form>
        </details>

        {onMock ? (
          <section className="cms-login__mock" aria-labelledby="cms-mock-title">
            <h2 id="cms-mock-title" className="cms-login__subtitle">
              체험 모드 (개발 서버 전용)
            </h2>
            <p className="cms-help">실제 저장소를 건드리지 않고 이 탭 안의 가짜 저장소로 편집·확인·게시 흐름을 시험합니다.</p>
            <div className="cms-row">
              <Btn variant="secondary" onClick={() => onMock(false)}>
                체험 모드로 들어가기
              </Btn>
              <Btn variant="ghost" onClick={() => onMock(true)}>
                검토 요청 모드로 체험
              </Btn>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
