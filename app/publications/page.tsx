import type { Metadata } from 'next';
import { getPublications } from '@/lib/content';
import { siteDocs } from '@/lib/site-docs';
import { PublicationsView } from '@/components/pages/ListPages';

/** Publications — 논문·학술발표 아카이브 (Research › Publications / Presentations). 저역서는 /books 에 따로 둡니다.
 *  hero 설명문과 출처 안내 박스는 연구실 요청(2026-11-06)으로 두지 않습니다(pages.json 의 publications.heroLead 가 null).
 *  화면은 components/pages/ListPages.tsx */
export const metadata: Metadata = {
  title: 'Publications',
  description: '학술지 논문과 학술발표 — 연도·유형·분야별 탐색과 제목 검색. 저역서는 Books 에서.',
  alternates: { canonical: '/publications' },
};

export default function PublicationsPage() {
  return <PublicationsView docs={siteDocs} items={getPublications().filter((p) => p.type !== 'book')} />;
}
