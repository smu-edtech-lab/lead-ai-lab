import type { Metadata } from 'next';
import { site } from '@/content/site';
import { brand } from '@/content/brand';
import { professor } from '@/content/profile';
import { siteDocs } from '@/lib/site-docs';
import { AboutView } from '@/components/pages/AboutView';

export const metadata: Metadata = {
  title: 'About',
  description: `${brand.name}(${brand.nameKo}) 소개 — ${brand.meaning}. ${site.university} ${site.department} ${professor.name} 교수 연구실의 지도교수 소개, 연구실 개요, 연구 비전.`,
  alternates: { canonical: '/about' },
};

/** About — 화면은 components/pages/AboutView.tsx (관리 화면 미리보기와 같은 부품), 문구는 content/data/pages.json 의 about 등 */
export default function AboutPage() {
  return <AboutView docs={siteDocs} />;
}
