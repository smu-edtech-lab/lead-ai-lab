/**
 * Home 화면 — 공개 페이지(app/page.tsx)와 관리 화면의 페이지 미리보기가 함께 씁니다.
 * 문구는 docs(content/data/pages.json 의 home·brand.json·site.json·profile.json)에서, 목록은 넘겨받은 데이터에서 옵니다.
 */
import { Fragment } from 'react';
import type { Member, NewsItem, Project, Publication } from '@/content/types';
import { wordmarkParts } from '@/content/brand';
import { site as siteConfig } from '@/content/site';
import { getLatestNews, getMembers, getProjects, getSelectedPublications } from '@/lib/content';
import type { SiteDocs } from '@/lib/site-docs';
import { Hero, SectionHeader } from '@/components/content/Headers';
import { Button, TextLink } from '@/components/ui/Button';
import { Reveal } from '@/components/motion/Reveal';
import { FullBleed, Marquee, ScrollText } from '@/components/motion/Kinetic';
import { ResearchGrid } from '@/components/content/Research';
import { ResearchFeed } from '@/components/content/ResearchFeed';
import { MemberGrid } from '@/components/content/People';
import { NewsCard } from '@/components/content/News';

export interface HomeData {
  projects: Project[];
  pubs: Publication[];
  news: NewsItem[];
  /** Home 의 구성원 미리보기 — 비어 있으면 섹션이 나오지 않습니다 (content/site.ts 의 homeShowPeople) */
  people: Member[];
}

/** Home 의 목록 데이터 — 공개 페이지와 미리보기가 같은 규칙으로 고름 */
export function homeData(): HomeData {
  return {
    projects: getProjects().slice(0, 2),
    pubs: getSelectedPublications(5),
    news: getLatestNews(3),
    // Home 의 구성원 미리보기는 site.homeShowPeople 이 true 일 때만(2026-11-22 연구실 요청으로 숨김 — 구성원은 People 페이지에서만 소개).
    // 지도교수 카드는 Home 에 두지 않음(About › Professor 로 충분, 2026-11-06 요청)
    people: siteConfig.homeShowPeople ? getMembers().slice(0, 4) : [],
  };
}

export function HomeView({ docs, data }: { docs: SiteDocs; data: HomeData }) {
  const { brand, site, professor } = docs;
  const t = docs.pages.home;
  const { projects, pubs, news, people } = data;

  return (
    <>
      {/* 워드마크 타이포가 시각적 중심 — 'LEAD AI' / 'LAB.' 두 줄, AI 는 가는 굵기·보조색. 모바일에서는 줄 안에서 자연스럽게 줄바꿈 */}
      <Hero
        className="lab-hero--wm"
        lines={[`${wordmarkParts.lead} ${wordmarkParts.ai}`, wordmarkParts.lab]}
        lineNodes={[
          <Fragment key="lead-ai">
            <span className="lab-wm__lead">{wordmarkParts.lead}</span> <span className="lab-wm__ai">{wordmarkParts.ai}</span>
          </Fragment>,
          <span key="lab" className="lab-wm__lab">
            {wordmarkParts.lab}
          </span>,
        ]}
        tagline={brand.tagline}
        ko={brand.sloganKo}
        lead={brand.intro[0]}
        meta={[brand.meaning, `${site.university} ${site.department}`]}
        actions={
          <>
            <Button variant="primary" size="l" magnetic href="/research">
              {t.heroPrimary}
            </Button>
            <Button variant="secondary" size="l" icon={null} href="/contact">
              {t.heroSecondary}
            </Button>
          </>
        }
        media={{
          src: professor.photo,
          alt: professor.photoAlt,
          label: '지도교수 사진',
          ratio: '2/3',
          sizes: '(min-width: 1024px) 34vw, 70vw',
          caption: t.heroCaption,
        }}
      />

      {/* About preview — 섹션 라벨에는 번호를 붙이지 않습니다(번호는 메뉴 순번 한 가지로만 씁니다, 2026-11-15).
          LEAD 의 의미와 국문 슬로건은 바로 위 히어로에 있으므로 여기서는 되풀이하지 않습니다 */}
      <section className="lab-sec lab-vision lab-container" aria-labelledby="home-vision">
        <div className="lab-vision__meta">
          <span className="lab-t-label" id="home-vision">
            {t.visionLabel}
          </span>
        </div>
        <ScrollText className="lab-t-h1 lab-vision__text" text={t.visionStatement} />
        <div className="lab-vision__side">
          <Reveal variant="stagger">
            <p className="lab-t-body-l">{brand.intro[1]}</p>
            <TextLink href="/about" variant="standalone">
              {t.visionLink}
            </TextLink>
          </Reveal>
        </div>
      </section>

      <Marquee items={t.keywords} />

      {/* (02) Research preview — brand scene 1. 헤더는 2단 에디토리얼(라벨 → display 제목 → hairline → 국문 소제목 | 설명·CTA), 문안은 연구실 제공(2026-11-06) */}
      <FullBleed tone="brand" className="lab-sec" labelledBy="home-research">
        <div className="lab-container">
          <SectionHeader
            onBrand
            id="home-research"
            eyebrow="Research"
            lines={t.researchTitle}
            ko={t.researchKo}
            description={t.researchDescription}
            action={
              <TextLink href="/research" variant="standalone" arrow="up-right" onBrand>
                {t.researchLink}
              </TextLink>
            }
          />
          <ResearchGrid areas={docs.areas} />
        </div>
      </FullBleed>

      {/* (03) Research — 논문·연구 과제를 한 섹션에, Publications/Projects 칩으로 전환. 문구는 연구실 제공 문안(내부 관리용 표현 없음) */}
      <ResearchFeed pubs={pubs} projects={projects} text={t} />

      {/* (04) People preview — 지금은 숨김(content/site.ts 의 homeShowPeople: false, 2026-11-22 연구실 요청).
          켜면 예시(가상) 구성원도 '예시' 배지와 함께 표시(2026-11-06 결정)하고, 구성원이 하나도 없으면 섹션이 나오지 않습니다 */}
      {people.length ? (
      <section className="lab-sec lab-sec--subtle" aria-labelledby="home-people">
        <div className="lab-container">
          <SectionHeader
            id="home-people"
            eyebrow="People"
            lines={t.peopleTitle}
            ko={t.peopleKo}
            action={
              <TextLink href="/people" variant="standalone" arrow="up-right">
                {t.peopleLink}
              </TextLink>
            }
          />
          {/* 카드는 제목·국문 소제목과 같은 왼쪽 선에서 시작합니다(2026-11-15 연구실 요청). 4열 격자, 인원이 적으면 오른쪽이 비어도 그대로 둡니다 */}
          <MemberGrid members={people} />
        </div>
      </section>
      ) : null}

      {/* (05) News — 'Latest from the lab' 는 연구실 일상 소식(세미나·회식 등, 현재는 '예시' 배지 항목)만. 논문·경력에서 자동 생성한 소식은 /news 에만 */}
      <section className="lab-sec lab-sec--tight-top" aria-labelledby="home-news">
        <div className="lab-container">
          <SectionHeader
            id="home-news"
            eyebrow="News"
            lines={t.newsTitle}
            ko={t.newsKo}
            action={
              <TextLink href="/news" variant="standalone" arrow="up-right">
                {t.newsLink}
              </TextLink>
            }
          />
          {/* News 페이지와 같은 갤러리형 카드 3장(2026-11-15 연구실 요청). 사진이 없으면 날짜 타일이 표지 */}
          <Reveal variant="stagger" className="lab-newsgal">
            {news.map((n) => (
              <NewsCard key={n.slug} item={n} layout="card" />
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}
