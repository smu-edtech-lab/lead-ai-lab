/**
 * 페이지 이름 → 화면 — 관리 화면의 페이지 미리보기(/admin/preview)가 고치는 중인 문구로 실제 페이지를 그릴 때 씁니다.
 * 공개 페이지(app/*\/page.tsx)는 각자 자기 화면 부품만 불러 씁니다(페이지마다 필요한 스크립트만 받도록).
 * 목록(논문·소식 등)은 배포된 내용 그대로이고, 문구 묶음(docs)만 바뀝니다.
 */
import type { PageId } from '@/content/pages';
import type { SiteDocs } from '@/lib/site-docs';
import { getAlumni, getMembersByRole, getNews, getProjects, getPublications, getPublicationsByType } from '@/lib/content';
import { HomeView, homeData } from './HomeView';
import { AboutView } from './AboutView';
import { ContactView } from './ContactView';
import { ResearchView, researchData } from './ResearchView';
import { BooksView, NewsView, PeopleView, ProjectsView, PublicationsView } from './ListPages';

export function PageView({ page, docs }: { page: PageId; docs: SiteDocs }) {
  switch (page) {
    case 'home':
      return <HomeView docs={docs} data={homeData()} />;
    case 'about':
      return <AboutView docs={docs} />;
    case 'research':
      return <ResearchView docs={docs} pubsByArea={researchData()} />;
    case 'projects':
      return <ProjectsView docs={docs} projects={getProjects()} />;
    case 'publications':
      return <PublicationsView docs={docs} items={getPublications().filter((p) => p.type !== 'book')} />;
    case 'people':
      return <PeopleView docs={docs} data={{ groups: getMembersByRole(), alumni: getAlumni() }} />;
    case 'books':
      return <BooksView docs={docs} books={getPublicationsByType('book')} />;
    case 'news':
      return <NewsView docs={docs} items={getNews()} />;
    case 'contact':
      return <ContactView docs={docs} />;
    default:
      return null;
  }
}
