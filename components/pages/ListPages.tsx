/**
 * 목록 페이지 화면 — People · Books · News · Projects · Publications.
 * 공개 페이지(app/<페이지>/page.tsx)와 관리 화면의 페이지 미리보기가 함께 씁니다.
 * 첫머리 문구는 docs(pages.json)에서, 목록은 넘겨받은 데이터에서 옵니다.
 */
import { Suspense } from 'react';
import type { Alumnus, Member, MemberRole, NewsItem, Project, Publication } from '@/content/types';
import type { HeroText } from '@/content/pages';
import type { SiteDocs } from '@/lib/site-docs';
import { PageHero, SectionHeader } from '@/components/content/Headers';
import { Reveal } from '@/components/motion/Reveal';
import { TextLink } from '@/components/ui/Button';
import { MemberGrid } from '@/components/content/People';
import { AlumniList } from '@/components/content/Alumni';
import { BookGrid } from '@/components/content/Books';
import { NewsBrowser } from '@/components/content/News';
import { ProjectShowcase } from '@/components/content/Projects';
import { PublicationsBrowser } from '@/components/content/PublicationsBrowser';

/** 하위 페이지 첫머리 — 메뉴 순번(index)·메뉴 이름(eyebrow)은 고정, 제목·국문 제목·소개 문장은 pages.json */
function Head({ index, eyebrow, t }: { index: string; eyebrow: string; t: HeroText }) {
  return <PageHero index={index} eyebrow={eyebrow} lines={t.heroLines} ko={t.heroKo} lead={t.heroLead ?? undefined} />;
}

export interface PeopleData {
  groups: { role: MemberRole; label: string; members: Member[] }[];
  alumni: Alumnus[];
}

/** People — 구성원(재학생·연구원)과 졸업생만. 지도교수 소개는 About › Professor 한 곳에 둡니다. */
export function PeopleView({ docs, data }: { docs: SiteDocs; data: PeopleData }) {
  const t = docs.pages.people;
  const { groups, alumni } = data;
  const totalMembers = groups.reduce((n, g) => n + g.members.length, 0);
  return (
    <>
      <Head index="04" eyebrow="People" t={t} />

      {/* Members — 과정별 묶음: 묶음 이름은 왼쪽 단, 카드는 오른쪽 단(3열). 인원이 한두 명인 묶음도 빈 격자처럼 보이지 않습니다(2026-11-15) */}
      <section className="lab-sec lab-sec--tight-top" aria-labelledby="people-members" id="members">
        <div className="lab-container">
          <SectionHeader
            id="people-members"
            eyebrow="Members"
            lines={t.membersTitle}
            ko={t.membersKo}
            action={
              <TextLink href="/about#professor" variant="standalone">
                Professor (About)
              </TextLink>
            }
          />
          {totalMembers ? (
            groups.map((g) => (
              <div key={g.role} className="lab-pgroup">
                <h3 className="lab-t-title-ko lab-pgroup__label">{g.label}</h3>
                <MemberGrid members={g.members} cols={3} hideRole={g.label} className="lab-pgroup__grid" />
              </div>
            ))
          ) : (
            <Reveal variant="stagger" className="lab-people-empty">
              <p className="lab-t-h4">{t.emptyTitle}</p>
              <p className="lab-t-body">{t.emptyText}</p>
            </Reveal>
          )}
        </div>
      </section>

      {/* Alumni */}
      <section className="lab-sec lab-sec--subtle" aria-labelledby="people-alumni" id="alumni">
        <div className="lab-container">
          <SectionHeader id="people-alumni" eyebrow="Alumni" lines={t.alumniTitle} ko={t.alumniKo} />
          <AlumniList items={alumni} />
        </div>
      </section>
    </>
  );
}

/** Books — 저역서만 표지 카드로 나열. 논문·학술발표는 /publications, 연구 과제는 /projects 에 둡니다. */
export function BooksView({ docs, books }: { docs: SiteDocs; books: Publication[] }) {
  return (
    <>
      <Head index="05" eyebrow="Books" t={docs.pages.books} />
      <section className="lab-sec lab-sec--tight-top lab-container" aria-label="저역서 목록">
        <BookGrid items={books} />
      </section>
    </>
  );
}

export function NewsView({ docs, items }: { docs: SiteDocs; items: NewsItem[] }) {
  return (
    <>
      <Head index="06" eyebrow="News" t={docs.pages.news} />
      <section className="lab-sec lab-sec--tight-top lab-container" aria-label="소식 목록">
        <NewsBrowser items={items} />
      </section>
    </>
  );
}

/** Projects — 연구 과제 전체 목록 (Research › Projects). 분야 상세의 관련 과제 링크(/projects#pXX)가 여기로 옵니다. */
export function ProjectsView({ docs, projects }: { docs: SiteDocs; projects: Project[] }) {
  return (
    <>
      <Head index="03" eyebrow="Projects" t={docs.pages.projects} />
      {/* ProjectShowcase 의 <ul> 이 lab-container 를 가지므로 section 에는 두지 않습니다 */}
      <section className="lab-sec lab-sec--tight-top" aria-label="연구 과제 목록">
        <ProjectShowcase items={projects} />
      </section>
    </>
  );
}

/** Publications — 논문·학술발표 아카이브 (Research › Publications / Presentations). 저역서는 /books 에 따로 둡니다. */
export function PublicationsView({ docs, items }: { docs: SiteDocs; items: Publication[] }) {
  return (
    <>
      <Head index="03" eyebrow="Publications" t={docs.pages.publications} />
      <section className="lab-sec lab-sec--tight-top lab-container" aria-label="실적 목록">
        <Suspense fallback={<PublicationsBrowser items={items} noParams />}>
          <PublicationsBrowser items={items} />
        </Suspense>
      </section>
    </>
  );
}
