import type { Metadata } from 'next';
import { PreviewFrame } from '@/components/cms/PreviewFrame';

/**
 * 관리 화면 페이지 미리보기 창의 안쪽 — 관리 화면(/admin)이 고치는 중인 문구를 보내면 실제 페이지 화면으로 그립니다.
 * 혼자 열면 빈 화면입니다. 검색엔진에 나오지 않게 하고, 머리말·바닥글은 /admin 아래라 SiteChrome 이 숨깁니다.
 */
export const metadata: Metadata = {
  title: '미리보기',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function AdminPreviewPage() {
  return <PreviewFrame />;
}
