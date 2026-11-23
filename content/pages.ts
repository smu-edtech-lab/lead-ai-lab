/**
 * 페이지 문구 — content/data/pages.json 의 모양.
 * 각 페이지의 제목·소개 문장·섹션 제목·버튼 이름이며, 관리 화면(/admin ‘페이지 문구’)에서 페이지별로 고칩니다.
 * 제목(…Title, heroLines)은 한 줄에 하나씩 적은 목록입니다. null 인 소개 문장은 화면에서 생략합니다(Research 는 자동 문장).
 * 여러 페이지에 함께 나오는 문구(연구실 이름·슬로건·소개문)는 brand.json 에 있습니다.
 */
import data from './data/pages.json';

export interface FaqItem {
  title: string;
  content: string;
}

/** 하위 페이지 첫머리(PageHero) — 영문 제목 줄, 국문 제목, 소개 문장 */
export interface HeroText {
  heroLines: string[];
  heroKo: string;
  heroLead: string | null;
}

export interface HomeText {
  heroPrimary: string;
  heroSecondary: string;
  heroCaption: string;
  visionLabel: string;
  visionStatement: string;
  visionLink: string;
  keywords: string[];
  researchTitle: string[];
  researchKo: string;
  researchDescription: string;
  researchLink: string;
  pubsTitle: string[];
  pubsKo: string;
  pubsDescription: string;
  pubsLink: string;
  projectsTitle: string[];
  projectsKo: string;
  projectsDescription: string;
  projectsLink: string;
  peopleTitle: string[];
  peopleKo: string;
  peopleLink: string;
  newsTitle: string[];
  newsKo: string;
  newsLink: string;
}

export interface AboutText {
  heroLines: string[];
  overviewTitle: string;
  overviewKo: string;
  overviewStatement: string;
  visionTitle: string;
  visionKo: string;
  visionStatement: string;
  joinTitle: string;
  joinKo: string;
  joinLead: string;
  joinPrimary: string;
  joinSecondary: string;
}

export interface PeopleText extends HeroText {
  membersTitle: string[];
  membersKo: string;
  emptyTitle: string;
  emptyText: string;
  alumniTitle: string[];
  alumniKo: string;
}

export interface ContactText extends HeroText {
  formTitle: string;
  formNote: string;
  joinTitle: string;
  joinKo: string;
  faq: FaqItem[];
}

export interface PagesText {
  home: HomeText;
  about: AboutText;
  research: HeroText;
  projects: HeroText;
  publications: HeroText;
  people: PeopleText;
  books: HeroText;
  news: HeroText;
  contact: ContactText;
}

export type PageId = keyof PagesText;

export const pages = data as unknown as PagesText;

/** 페이지 이름 (관리 화면 미리보기 탭) */
export const pageLabels: Record<PageId, string> = {
  home: 'Home',
  about: 'About',
  research: 'Research',
  projects: 'Projects',
  publications: 'Publications',
  people: 'People',
  books: 'Books',
  news: 'News',
  contact: 'Contact',
};
