import type { Metadata } from 'next';
import { getPublicationsByType } from '@/lib/content';
import { siteDocs } from '@/lib/site-docs';
import { BooksView } from '@/components/pages/ListPages';

/** Books — 저역서만 표지 카드로 나열. 논문·학술발표는 /publications, 연구 과제는 /projects 에 둡니다.
 *  화면은 components/pages/ListPages.tsx, 문구는 content/data/pages.json 의 books */
export const metadata: Metadata = {
  title: 'Books',
  description: '저역서 목록 — 제목·출판사·출간일 기준, 최신 출간순.',
  alternates: { canonical: '/books' },
};

export default function BooksPage() {
  return <BooksView docs={siteDocs} books={getPublicationsByType('book')} />;
}
