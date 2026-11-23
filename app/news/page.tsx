import type { Metadata } from 'next';
import { getNews } from '@/lib/content';
import { siteDocs } from '@/lib/site-docs';
import { NewsView } from '@/components/pages/ListPages';

/** News — 화면은 components/pages/ListPages.tsx, 문구는 content/data/pages.json 의 news */
export const metadata: Metadata = {
  title: 'News',
  description: '연구실 공지, 학술대회, 연구 성과, 구성원 소식.',
  alternates: { canonical: '/news' },
};

export default function NewsPage() {
  return <NewsView docs={siteDocs} items={getNews()} />;
}
