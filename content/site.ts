/**
 * 사이트 전역 설정 — 연구실 정체성·내비게이션·연락처.
 * 소속·주소·전화·이메일은 content/data/site.json 에 있고, 관리 화면(/admin ‘연구실 정보 › 소속·연락처’)에서 고칩니다.
 * 이 파일에는 화면 구조에 가까운 설정(메뉴, 문의 자동 발송 주소, Home 구성원 미리보기 표시 등)만 남깁니다.
 */

import data from './data/site.json';
import { brand, brandApproved } from './brand';

/** content/data/site.json 의 모양 — 관리 화면이 이 칸들을 고칩니다 */
export interface SiteData {
  university: string;
  universityEn: string;
  department: string;
  departmentEn: string;
  major: string;
  majorEn: string;
  building: string;
  room: string;
  /** 도로명 주소 — 문서에 없어 확인 후 입력 */
  street: string | null;
  phone: string;
  /** 문의 이메일 — Contact 문의 폼이 이 주소로 방문자의 메일 앱을 엽니다. null 이면 메일 주소 표시와 메일 보내기가 모두 숨습니다 */
  email: string | null;
  /** true 면 화면에서 주소 옆에 '예시' 배지를 붙이고, 푸터에는 주소를 싣지 않습니다 */
  emailIsSample: boolean;
}

/** "02-2287-5456" → "tel:+82-2-2287-5456" (국내 번호는 국가 번호를 붙임) */
export function telHref(phone: string): string {
  const p = phone.trim();
  return `tel:${p.startsWith('0') ? `+82-${p.slice(1)}` : p}`;
}

/** 화면에서 쓰는 소속·연락처 묶음 — 공개 페이지와 관리 화면 미리보기가 같은 함수로 만듭니다 */
export function siteInfo(d: SiteData) {
  return {
    university: d.university,
    universityEn: d.universityEn,
    department: d.department,
    departmentEn: d.departmentEn,
    major: d.major,
    majorEn: d.majorEn,
    address: { building: d.building, room: d.room, street: d.street },
    phone: d.phone,
    phoneHref: telHref(d.phone),
    email: d.email,
    emailIsSample: d.emailIsSample,
  };
}

export type SiteInfo = ReturnType<typeof siteInfo>;

const info = siteInfo(data as SiteData);

export const site = {
  /** 연구실 명칭(국문) — 브랜드 제안안(content/data/brand.json). 대학 공식 승인 전이므로 공식 기관 명칭(university/department)과 구분해 표기 */
  labName: brand.nameKo,
  /** 연구실 명칭(영문) — 브랜드 제안안 */
  labNameEn: brand.name,
  /** 브랜드가 대학의 공식 승인을 받았는지 (brand.json meta.status) */
  labNameConfirmed: brandApproved,
  brandSub: brand.meaning,
  ...info,
  /** Contact 문의 자동 발송 주소 — Google Apps Script 웹 앱 주소(https://script.google.com/macros/s/…/exec).
   *  값이 있으면 문의 폼의 보내기 버튼이 이 주소로 내용을 보내고, 스크립트(contact-mail/Code.gs)가 연구실 메일로 발송합니다.
   *  null 이면 자동 발송 없이 site.json 의 email 로 방문자의 메일 앱을 여는 방식으로 동작합니다.
   *  만드는 방법: docs/문의-자동발송-설정.md. 이 주소는 방문자 브라우저에 그대로 보이는 값이라 비밀이 아닙니다(받는 메일 주소는 스크립트 안에만 있습니다). */
  contactEndpoint: null as string | null,
  /** Home 의 People 미리보기(구성원 카드 최대 4장) 표시 여부 — 2026-11-22 연구실 요청으로 숨겼습니다.
   *  true 로 바꾸면 Home 에 다시 나옵니다. People 메뉴와 People 페이지·개인 상세 페이지·검색은 이 값과 상관없이 그대로 보입니다. */
  homeShowPeople: false as boolean,
  /** 배포 URL — 메타데이터·사이트맵에 사용. 배포 시 NEXT_PUBLIC_SITE_URL 로 덮어씀 */
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://lab.example.ac.kr',
  /** 첨부 실적 문서 기준일 */
  dataAsOf: '2026-11-05',
  description: `${brand.name}(${brand.nameKo}) — ${info.university} 교육학과 이현우 교수 연구실. ${brand.sloganKo} ${brand.intro[0]}`,
};
export interface NavChild {
  label: string;
  ko?: string;
  href: string;
}
export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavChild[];
}

/** 상단 내비게이션 — 순서 고정 (Home · About · Research · People · Books · News · Contact).
 *  About 은 지도교수 소개가 먼저(Professor › Overview › Vision), People 은 구성원·졸업생만.
 *  Research 아래에 논문(Publications)·연구 과제(Projects)·학술발표(Presentations)를 두고, 저역서(Books)는 별도 메뉴·별도 페이지(/books).
 *  Research(/research)는 다섯 분야 설명 + 분야별 관련 연구만 보여 주는 Research Areas 페이지입니다(2026-11-09).
 *  children 은 데스크톱 드롭다운과 모바일 메뉴의 하위 바로가기에 함께 쓰입니다. */
export const nav: NavItem[] = [
  { id: 'home', label: 'Home', href: '/' },
  {
    id: 'about',
    label: 'About',
    href: '/about',
    children: [
      { label: 'Professor', ko: '지도교수', href: '/about#professor' },
      { label: 'Overview', ko: '연구실 소개', href: '/about#overview' },
      { label: 'Vision', ko: '연구 비전', href: '/about#vision' },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    href: '/research',
    children: [
      { label: 'Research Areas', ko: '주요 연구 분야', href: '/research' },
      { label: 'Publications', ko: '논문', href: '/publications?type=journal' },
      { label: 'Projects', ko: '연구 과제', href: '/projects' },
      { label: 'Presentations', ko: '학술발표', href: '/publications?type=conference' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    href: '/people',
    children: [
      { label: 'Members', ko: '재학생·연구원', href: '/people#members' },
      { label: 'Alumni', ko: '졸업생', href: '/people#alumni' },
    ],
  },
  { id: 'books', label: 'Books', href: '/books' },
  { id: 'news', label: 'News', href: '/news' },
  { id: 'contact', label: 'Contact', href: '/contact' },
];

export const navLabels: Record<string, string> = Object.fromEntries(nav.map((n) => [n.id, n.label]));

