'use client';
/**
 * 관리자 화면(/admin) 진입점 — 로그인 확인 → 화면 틀 → 주소(#/…)에 맞는 화면.
 *
 *   #/                 처음 화면
 *   #/news             소식 목록        #/news/new · #/news/edit/<주소>
 *   #/members          구성원 목록      #/members/new · #/members/edit/<주소>
 *   #/alumni           졸업생 목록      #/alumni/move/<구성원 주소> (구성원 → 졸업생 옮기기)
 *   (논문·저역서·학술발표·연구 과제·지도교수 경력·연구 분야도 같은 모양: #/journals/new · #/journals/edit/<번호> …)
 *   #/brand · #/site · #/professor      연구실 정보 (한 덩어리 문서 — 목록 없이 바로 편집)
 *   #/pages            페이지 문구 목록  #/page-home · #/page-about … (페이지별 문구 편집)
 *
 * 저장소 쓰기 권한이 있는 사람(편집자)은 모두 같은 권한으로, 바뀐 내용을 확인한 뒤 바로 게시합니다.
 * GitHub 계정이 없는 사람(교수님 등)은 검토 요청 비밀번호로 들어와, 같은 화면에서 게시 대신 검토 요청을 보냅니다(lib/cms/request.ts).
 */
import { useCallback, useEffect, useState } from 'react';
import { cmsConfig, repoParts } from '@/lib/cms/config';
import { clearRequestSession, clearToken, getRequestSession, getStoredToken, takeAuthResult, type RequestSession } from '@/lib/cms/auth';
import { GitHubBackend } from '@/lib/cms/github';
import { RequestBackend } from '@/lib/cms/request';
import { collections, isCollectionId } from '@/lib/cms/collections';
import { errorMessage, isCmsError, type CmsUser, type RepoBackend } from '@/lib/cms/types';
import { CmsProvider, useCms } from './context';
import { LoginScreen } from './LoginScreen';
import { Shell } from './Shell';
import { Dashboard } from './Dashboard';
import { CollectionList, PageTextList } from './CollectionList';
import { ItemEditor } from './ItemEditor';
import { Spinner } from './ui';

type AuthState = { status: 'checking' } | { status: 'signed-out'; error?: string } | { status: 'ready'; backend: RepoBackend; user: CmsUser };

const MOCK_FLAG = 'lead-cms:mock-on';

/**
 * 체험용 가짜 저장소 — `if (개발 서버)` 블록 안에서만 불러와야 배포 빌드가 이 코드를 아예 빼고 만듭니다
 * (process.env.NODE_ENV 가 빌드 때 상수로 바뀌어 블록째 지워짐).
 */
async function loadMock() {
  if (process.env.NODE_ENV === 'development') {
    return (await import('@/lib/cms/mock')).MockBackend;
  }
  return null;
}

function noAccessMessage(login: string) {
  return `GitHub 계정 ${login} 에는 이 저장소를 고칠 권한이 없습니다. 연구실 저장소 관리자에게 GitHub 아이디를 알려 협업자(Write)로 초대받은 뒤, 초대 메일의 수락 버튼을 누르고 다시 로그인해 주세요.`;
}

export function CmsApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  const startGitHub = useCallback(async (token: string) => {
    const parts = repoParts();
    if (!parts) {
      setAuth({ status: 'signed-out', error: 'CMS 저장소 설정(NEXT_PUBLIC_CMS_REPO)이 없습니다. 배포 설정을 확인해 주세요.' });
      return;
    }
    setAuth({ status: 'checking' });
    try {
      const backend = new GitHubBackend(token, parts.owner, parts.name, cmsConfig.branch);
      const user = await backend.getUser();
      if (user.role === 'none') {
        clearToken();
        setAuth({ status: 'signed-out', error: noAccessMessage(user.login) });
        return;
      }
      setAuth({ status: 'ready', backend, user });
    } catch (e) {
      clearToken();
      setAuth({ status: 'signed-out', error: isCmsError(e, 'unauthorized') ? '로그인이 만료되었거나 토큰이 올바르지 않습니다. 다시 로그인해 주세요.' : errorMessage(e) });
    }
  }, []);

  const startRequest = useCallback(async (s: RequestSession) => {
    const parts = repoParts();
    if (!parts || !cmsConfig.authUrl) {
      clearRequestSession();
      setAuth({ status: 'signed-out', error: 'CMS 저장소·중계 서버 설정이 없습니다. 배포 설정을 확인해 주세요.' });
      return;
    }
    const backend = new RequestBackend(s.token, cmsConfig.authUrl, parts.owner, parts.name, cmsConfig.branch, s.name);
    setAuth({ status: 'ready', backend, user: await backend.getUser() });
  }, []);

  const startMock = useCallback(async (requester = false) => {
    const MockBackend = await loadMock();
    if (!MockBackend) return;
    window.sessionStorage.setItem(MOCK_FLAG, requester ? 'request' : '1');
    const backend = new MockBackend({ requester });
    setAuth({ status: 'ready', backend, user: await backend.getUser() });
  }, []);

  const resetMock = useCallback(async () => {
    (await loadMock())?.reset();
  }, []);

  useEffect(() => {
    const { token, error } = takeAuthResult();
    if (error) {
      setAuth({ status: 'signed-out', error: `GitHub 로그인이 완료되지 않았습니다: ${error}` });
      return;
    }
    const mock = process.env.NODE_ENV === 'development' ? window.sessionStorage.getItem(MOCK_FLAG) : null;
    if (mock === '1' || mock === 'request') {
      void startMock(mock === 'request');
      return;
    }
    if (token) {
      void startGitHub(token);
      return;
    }
    const rs = getRequestSession();
    if (rs) {
      void startRequest(rs);
      return;
    }
    const t = getStoredToken();
    if (t) void startGitHub(t);
    else setAuth({ status: 'signed-out' });
  }, [startGitHub, startMock, startRequest]);

  const signOut = useCallback((message?: string) => {
    clearToken();
    clearRequestSession();
    try {
      window.sessionStorage.removeItem(MOCK_FLAG);
    } catch {
      /* 무시 */
    }
    setAuth({ status: 'signed-out', error: message });
  }, []);

  if (auth.status === 'checking') {
    return (
      <div className="cms cms--center">
        <Spinner label="로그인 정보를 확인하는 중…" />
      </div>
    );
  }
  if (auth.status === 'signed-out') {
    return (
      <LoginScreen
        error={auth.error}
        onToken={(t) => {
          void startGitHub(t);
        }}
        onRequest={(s) => {
          void startRequest(s);
        }}
        onMock={cmsConfig.mockEnabled ? (requester) => void startMock(requester) : undefined}
      />
    );
  }
  return (
    <CmsProvider key={`${auth.backend.kind}:${auth.user.login}`} backend={auth.backend} user={auth.user} onExpired={(m) => signOut(m)}>
      <Shell
        onSignOut={() => signOut()}
        onResetMock={
          auth.backend.kind === 'mock'
            ? () => {
                void resetMock().then(() => startMock(auth.user.role === 'requester'));
              }
            : undefined
        }
      >
        <Router />
      </Shell>
    </CmsProvider>
  );
}

function Router() {
  const { route } = useCms();
  const [first, second, third] = route;
  if (first === 'pages') return <PageTextList />;
  if (first && isCollectionId(first)) {
    const def = collections[first];
    if (def.single) return <ItemEditor collection={first} itemKey={def.single.key} key={first} />;
    if (second === 'new' && def.canCreate !== false) return <ItemEditor collection={first} itemKey={null} key={`${first}:new`} />;
    if (second === 'edit' && third) return <ItemEditor collection={first} itemKey={third} key={`${first}:${third}`} />;
    if (second === 'move' && third && collections[first].moveFrom) return <ItemEditor collection={first} itemKey={null} moveFrom={third} key={`${first}:move:${third}`} />;
    return <CollectionList collection={first} key={first} />;
  }
  return <Dashboard />;
}
