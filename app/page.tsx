import type { Metadata } from 'next';
import { site } from '@/content/site';
import { brand } from '@/content/brand';
import { professor } from '@/content/profile';
import { siteDocs } from '@/lib/site-docs';
import { HomeView, homeData } from '@/components/pages/HomeView';

export const metadata: Metadata = {
  title: { absolute: `${brand.name} — ${brand.nameKo} · ${site.university} ${site.department} ${professor.name} 교수 연구실` },
  description: site.description,
  alternates: { canonical: '/' },
};

/** Home — 화면은 components/pages/HomeView.tsx (관리 화면 미리보기와 같은 부품), 문구는 content/data/pages.json 의 home */
export default function HomePage() {
  return <HomeView docs={siteDocs} data={homeData()} />;
}
