import type { Metadata } from 'next';
import { brand } from '@/content/brand';
import { researchAreas } from '@/content/research-areas';
import { siteDocs } from '@/lib/site-docs';
import { ResearchView, researchData } from '@/components/pages/ResearchView';

export const metadata: Metadata = {
  title: 'Research Areas',
  description: `${brand.name} 주요 연구 분야 — ${researchAreas.map((a) => a.ko).join(', ')}. 분야별 설명과 관련 연구.`,
  alternates: { canonical: '/research' },
};

/**
 * Research(= Research Areas) — 다섯 가지 주요 연구 분야의 설명과, 분야별 관련 연구만 보여 줍니다(2026-11-09 요청).
 * 연구 과제 전체(/projects)와 논문·학술발표 전체(/publications)는 상단 Research 하위 메뉴에서 바로 갑니다.
 * 화면은 components/pages/ResearchView.tsx (관리 화면 미리보기와 같은 부품)
 */
export default function ResearchPage() {
  return <ResearchView docs={siteDocs} pubsByArea={researchData()} />;
}
