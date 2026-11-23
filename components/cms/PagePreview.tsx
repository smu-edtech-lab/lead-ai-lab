'use client';
/**
 * 페이지 미리보기 — 고치는 중인 문구로 실제 페이지(components/pages/*)를 작은 창(iframe, /admin/preview)에 그립니다.
 * 창 안은 진짜 화면 너비(데스크톱 1280px · 휴대폰 390px)로 그린 뒤 이 칸 너비에 맞춰 줄여 보여 줍니다.
 * '크게 보기'는 같은 창을 화면 가득 키웁니다(다시 불러오지 않음).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PageId } from '@/content/pages';
import { withBasePath } from '@/lib/base-path';
import { pageLabels } from '@/content/pages';
import { PREVIEW_READY, PREVIEW_RENDER, type PreviewMessage } from '@/lib/cms/preview-protocol';
import { cx } from './ui';

const WIDTH = { desktop: 1280, mobile: 390 } as const;

export function PagePreview({
  pages,
  files,
  images,
  focus,
  anchorFor,
}: {
  /** 보여 줄 수 있는 페이지 — 둘 이상이면 탭 */
  pages: PageId[];
  /** 고친 내용을 반영한 문구 묶음 파일 (경로 → JSON) */
  files: Record<string, unknown> | null;
  images: Record<string, string>;
  /** 지금 고치는 칸 묶음이 보이는 곳 — seq 가 바뀔 때마다 그곳으로 스크롤 */
  focus: { selector: string | null; seq: number };
  /** 페이지를 처음 열 때 보여 줄 곳 */
  anchorFor: (page: PageId) => string | null;
}) {
  const [page, setPage] = useState<PageId>(pages[0]);
  const [device, setDevice] = useState<keyof typeof WIDTH>('desktop');
  const [big, setBig] = useState(false);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const frame = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 다음 그리기에 실어 보낼 스크롤 위치 (없으면 그 자리 그대로) */
  const pendingScroll = useRef<string | undefined>(undefined);

  /* 칸 크기를 따라 줄임 비율을 다시 계산 — 처음에 바로 한 번 재고, 크기가 바뀔 때마다 다시 잼 */
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [big]);

  /* 창 안이 준비됐다는 신호 */
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === PREVIEW_READY) {
        pendingScroll.current = focus.selector ?? anchorFor(page) ?? '';
        setReady(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* 페이지 탭을 바꾸면 그 페이지에서 보여 줄 곳으로 */
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    pendingScroll.current = anchorFor(page) ?? '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /* 고치는 칸 묶음이 바뀌면 그곳으로 */
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (focus.selector) pendingScroll.current = focus.selector;
  }, [focus.seq, focus.selector]);

  /* 고친 내용을 창 안으로 보냄 — 글자를 칠 때마다 너무 자주 보내지 않도록 조금 모아서 */
  useEffect(() => {
    if (!ready || !files) return;
    const t = window.setTimeout(() => {
      const msg: PreviewMessage = { type: PREVIEW_RENDER, page, files, images, scroll: pendingScroll.current };
      pendingScroll.current = undefined;
      frame.current?.contentWindow?.postMessage(msg, window.location.origin);
    }, 120);
    return () => window.clearTimeout(t);
  }, [ready, files, images, page, focus.seq]);

  /* 크게 보기 — Esc 로 닫기, 뒤 화면은 스크롤하지 않음 (styles/admin.css 의 .cms-preview-big) */
  useEffect(() => {
    if (!big) return;
    const root = document.documentElement;
    root.classList.add('cms-preview-big');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      root.classList.remove('cms-preview-big');
      window.removeEventListener('keydown', onKey);
    };
  }, [big]);

  const W = WIDTH[device];
  const scale = box.w ? Math.min(1, box.w / W) : 0;
  const left = box.w > W ? Math.round((box.w - W) / 2) : 0;

  return (
    <div className={cx('cms-pprev', big && 'is-big')} role={big ? 'dialog' : undefined} aria-modal={big || undefined} aria-label={big ? '페이지 미리보기 크게 보기' : undefined}>
      <div className="cms-pprev__bar">
        {pages.length > 1 ? (
          <div className="cms-seg" role="group" aria-label="미리 볼 페이지">
            {pages.map((p) => (
              <button key={p} type="button" className={cx('cms-seg__btn', page === p && 'is-on')} aria-pressed={page === p} onClick={() => setPage(p)}>
                {pageLabels[p]}
              </button>
            ))}
          </div>
        ) : (
          <span className="cms-pprev__title">{pageLabels[page]} 페이지</span>
        )}
        <div className="cms-pprev__tools">
          <div className="cms-seg" role="group" aria-label="화면 크기">
            <button type="button" className={cx('cms-seg__btn', device === 'desktop' && 'is-on')} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>
              데스크톱
            </button>
            <button type="button" className={cx('cms-seg__btn', device === 'mobile' && 'is-on')} aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>
              휴대폰
            </button>
          </div>
          <button type="button" className="cms-btn cms-btn--ghost cms-btn--s" onClick={() => setBig((b) => !b)}>
            <span>{big ? '닫기' : '크게 보기'}</span>
          </button>
        </div>
      </div>
      <div ref={boxRef} className="cms-pprev__box">
        {!ready ? <p className="cms-pprev__loading">미리보기를 불러오는 중…</p> : null}
        <iframe
          ref={frame}
          className="cms-pprev__frame"
          src={withBasePath('/admin/preview')}
          title={`${pageLabels[page]} 페이지 미리보기`}
          style={{
            width: W,
            height: scale ? Math.ceil(box.h / scale) : box.h,
            left,
            transform: scale && scale < 1 ? `scale(${scale})` : undefined,
            visibility: ready ? 'visible' : 'hidden',
          }}
        />
      </div>
    </div>
  );
}
