import type { Metadata } from 'next';
import { brand } from '@/content/brand';
import { getAlumni, getMembersByRole } from '@/lib/content';
import { siteDocs } from '@/lib/site-docs';
import { PeopleView } from '@/components/pages/ListPages';

/** People — 구성원(재학생·연구원)과 졸업생만. 지도교수 소개는 About › Professor 한 곳에 둡니다.
 *  화면은 components/pages/ListPages.tsx (관리 화면 미리보기와 같은 부품), 문구는 content/data/pages.json 의 people */
export const metadata: Metadata = {
  title: 'People',
  description: `${brand.name} 구성원 — 재학생·연구원과 졸업생. 지도교수 소개는 About 에서 확인할 수 있습니다.`,
  alternates: { canonical: '/people' },
};

export default function PeoplePage() {
  return <PeopleView docs={siteDocs} data={{ groups: getMembersByRole(), alumni: getAlumni() }} />;
}
