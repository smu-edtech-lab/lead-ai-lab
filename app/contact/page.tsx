import type { Metadata } from 'next';
import { site } from '@/content/site';
import { brand } from '@/content/brand';
import { professor } from '@/content/profile';
import { siteDocs } from '@/lib/site-docs';
import { ContactView } from '@/components/pages/ContactView';

export const metadata: Metadata = {
  title: 'Contact',
  description: `${brand.name}(${brand.nameKo}) 연락처와 참여 안내 — ${site.university} ${site.department} ${professor.name} 교수 연구실, ${site.address.building} ${site.address.room}, ${site.phone}.`,
  alternates: { canonical: '/contact' },
};

/** Contact — 화면은 components/pages/ContactView.tsx (관리 화면 미리보기와 같은 부품), 문구는 content/data/pages.json 의 contact 등 */
export default function ContactPage() {
  return <ContactView docs={siteDocs} />;
}
