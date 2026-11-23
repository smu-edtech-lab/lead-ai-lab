import type { Metadata } from 'next';
import { brand } from '@/content/brand';
import { getProjects } from '@/lib/content';
import { siteDocs } from '@/lib/site-docs';
import { ProjectsView } from '@/components/pages/ListPages';

/**
 * Projects — 연구 과제 전체 목록 (Research › Projects). Research 페이지는 최근 4건만 보여 주고
 * 이 페이지가 projects.json 의 전체 목록입니다(같은 ProjectShowcase 행 목록). 분야 상세의 관련 과제 링크(/projects#pXX)가 여기로 옵니다.
 * hero 설명문과 건수 표기는 연구실 요청(2026-11-06)으로 두지 않습니다(pages.json 의 projects.heroLead 가 null).
 * 화면은 components/pages/ListPages.tsx
 */
export const metadata: Metadata = {
  title: 'Projects',
  description: `${brand.name} 연구 과제 — 기간·지원 기관·연구 분야별 전체 목록.`,
  alternates: { canonical: '/projects' },
};

export default function ProjectsPage() {
  return <ProjectsView docs={siteDocs} projects={getProjects()} />;
}
