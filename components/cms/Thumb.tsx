'use client';
import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';

/**
 * 목록·검토 화면의 작은 사진. src 가 data URL 이면 그대로, "/images/…" 면 사이트 주소로.
 * 사진이 없거나, 방금 저장해 아직 사이트에 배포되지 않아 불러오지 못하면 '사진 없음' 자리표시를 보여 줍니다.
 */
export function Thumb({ src, ratio = 'portrait' }: { src: string | null | undefined; label?: string; ratio?: 'portrait' | 'landscape' }) {
  const url = src ? (src.startsWith('data:') ? src : withBasePath(src)) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const show = url && failed !== url;
  return (
    <span className={`cms-thumb cms-thumb--${ratio}`} aria-hidden="true">
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailed(url)} />
      ) : (
        <span className="cms-thumb__ph">
          <svg viewBox="0 0 24 24" width="40%" height="40%" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {ratio === 'portrait' ? (
              <>
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
              </>
            ) : (
              <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="1.8" />
                <path d="m21 16-5-5-8 8" />
              </>
            )}
          </svg>
        </span>
      )}
    </span>
  );
}
