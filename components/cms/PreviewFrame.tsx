'use client';
/**
 * 페이지 미리보기 창 안쪽(/admin/preview) — 관리 화면(바깥)이 보내 준 고치는 중인 문구로 실제 페이지 화면을 그립니다.
 *
 * 바깥 → 안: { type: 'lead-cms-preview:render', page, files, images, scroll? }  (같은 주소의 바깥 창에서 온 것만 받음)
 * 안 → 바깥: { type: 'lead-cms-preview:ready' }  (그릴 준비가 됐을 때)
 * 링크·폼 보내기는 막아 두고, 움직임 효과는 끈 상태(data-motion="reduced")로 그려 글이 바로 보이게 합니다.
 */
import { Component, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import type { PageId } from '@/content/pages';
import { docsFromFiles, type SiteDocs } from '@/lib/site-docs';
import { PageView } from '@/components/pages/PageView';
import { PREVIEW_READY, PREVIEW_RENDER, type PreviewMessage } from '@/lib/cms/preview-protocol';


/** 문서 안의 "pending:<id>" 사진 값을 data URL 로 바꿈 */
function withImages<T>(v: T, images: Record<string, string>): T {
  if (typeof v === 'string') return (images[v] ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => withImages(x, images)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withImages(x, images)])) as T;
  return v;
}

/** 그리다 오류가 나면(예: 반드시 채울 칸을 비운 채 입력하는 중) 짧은 안내만 보이고, 다음 내용이 오면 다시 그려 봄 */
class Guard extends Component<{ resetKey: number; children: ReactNode }, { failed: boolean; key: number }> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  static getDerivedStateFromProps(p: { resetKey: number }, s: { failed: boolean; key: number }) {
    return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null;
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="lab-container lab-t-body" style={{ padding: 24 }}>
        지금 입력 중인 내용으로는 페이지를 그릴 수 없습니다. 반드시 채울 칸(필수)이 비어 있지 않은지 확인해 주세요.
      </p>
    );
  }
}

export function PreviewFrame() {
  const [view, setView] = useState<{ page: PageId; docs: SiteDocs; scroll?: string; n: number } | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-motion', 'reduced');
    root.classList.add('lab-preview-frame');
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const m = e.data as PreviewMessage | null;
      if (!m || m.type !== PREVIEW_RENDER) return;
      try {
        const docs = docsFromFiles(withImages(m.files, m.images ?? {}));
        setView((v) => ({ page: m.page, docs, scroll: m.scroll, n: (v?.n ?? 0) + 1 }));
        setBroken(false);
      } catch {
        setBroken(true);
      }
    };
    /* 미리보기 안에서는 다른 페이지로 가지 않음 */
    const block = (e: Event) => {
      const t = e.target as Element | null;
      if (e.type === 'submit' || t?.closest?.('a[href]')) e.preventDefault();
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', block, true);
    document.addEventListener('submit', block, true);
    if (window.parent !== window) window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', block, true);
      document.removeEventListener('submit', block, true);
    };
  }, []);

  /* 고치는 칸이 바뀌면 그 부분으로 */
  useLayoutEffect(() => {
    if (!view || view.scroll === undefined) return;
    const el = view.scroll ? document.querySelector(view.scroll) : null;
    if (el) el.scrollIntoView({ block: 'start' });
    else if (view.scroll === '') window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.n]);

  if (broken) return <p className="lab-container lab-t-body" style={{ padding: 24 }}>미리보기를 그리지 못했습니다. 입력 내용을 확인해 주세요.</p>;
  if (!view) return null;
  return (
    <div className="lab-site">
      <main id="lab-main" className="lab-main">
        <Guard resetKey={view.n}>
          <PageView page={view.page} docs={view.docs} />
        </Guard>
      </main>
    </div>
  );
}
