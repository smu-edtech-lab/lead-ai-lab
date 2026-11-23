/**
 * 사이트 문구 묶음 — 페이지 문구·연구실 이름과 소개·소속과 연락처·지도교수·경력·연구 분야.
 *
 * 공개 페이지(빌드할 때)와 관리 화면의 페이지 미리보기(고치는 중인 내용)가 같은 화면 부품(components/pages/*)을
 * 같은 모양의 묶음으로 그리도록, 데이터 파일(JSON) → 화면용 묶음 변환을 이 한 곳에 둡니다.
 */
import pagesData from '@/content/data/pages.json';
import brandData from '@/content/data/brand.json';
import siteData from '@/content/data/site.json';
import profileData from '@/content/data/profile.json';
import careerData from '@/content/data/career.json';
import areasData from '@/content/data/research-areas.json';
import type { Brand } from '@/content/brand';
import type { PagesText } from '@/content/pages';
import type { Professor } from '@/content/profile';
import { siteInfo, type SiteData, type SiteInfo } from '@/content/site';
import type { CareerEntry, ResearchArea } from '@/content/types';

/** 묶음을 이루는 데이터 파일 (관리 화면 미리보기가 이 파일들만 미리보기 창에 넘김) */
export const DOC_FILES = {
  pages: 'content/data/pages.json',
  brand: 'content/data/brand.json',
  site: 'content/data/site.json',
  profile: 'content/data/profile.json',
  career: 'content/data/career.json',
  areas: 'content/data/research-areas.json',
} as const;

export const DOC_PATHS: string[] = Object.values(DOC_FILES);

export interface SiteDocs {
  pages: PagesText;
  brand: Brand;
  site: SiteInfo;
  professor: Professor;
  /** 지도교수 경력 — 시작 시점이 늦은 것부터 */
  career: CareerEntry[];
  areas: ResearchArea[];
}

const itemsOf = <T,>(data: unknown): T[] => {
  const arr = (data as { items?: unknown } | null)?.items;
  return Array.isArray(arr) ? (arr as T[]) : [];
};

/** 경력 정렬 — 시작 시점이 늦은 것부터 (lib/content getCareer 와 같은 순서) */
export function sortCareer(items: CareerEntry[]): CareerEntry[] {
  return items.slice().sort((a, b) => String(b.start ?? '').localeCompare(String(a.start ?? '')));
}

/** Research 첫머리 소개 문장을 비워 두었을 때 쓰는 자동 문장 — 분야 이름이 바뀌면 함께 바뀜 */
export function researchAutoLead(areas: ResearchArea[]): string {
  return `${areas.map((a) => a.ko).join(', ')} — 다섯 가지 연구 분야를 중심으로 학습과 교육의 문제를 탐구하고, 연구 과제와 논문으로 그 결과를 공유합니다.`;
}

/** 데이터 파일(경로 → JSON) → 화면용 묶음 */
export function docsFromFiles(files: Record<string, unknown>): SiteDocs {
  return {
    pages: files[DOC_FILES.pages] as PagesText,
    brand: files[DOC_FILES.brand] as Brand,
    site: siteInfo(files[DOC_FILES.site] as SiteData),
    professor: files[DOC_FILES.profile] as Professor,
    career: sortCareer(itemsOf<CareerEntry>(files[DOC_FILES.career])),
    areas: itemsOf<ResearchArea>(files[DOC_FILES.areas]),
  };
}

/** 빌드할 때의 파일 내용 */
export const builtFiles: Record<string, unknown> = {
  [DOC_FILES.pages]: pagesData,
  [DOC_FILES.brand]: brandData,
  [DOC_FILES.site]: siteData,
  [DOC_FILES.profile]: profileData,
  [DOC_FILES.career]: careerData,
  [DOC_FILES.areas]: areasData,
};

/** 공개 페이지가 쓰는 묶음 (빌드할 때의 내용) */
export const siteDocs: SiteDocs = docsFromFiles(builtFiles);
