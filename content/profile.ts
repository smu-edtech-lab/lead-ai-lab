import data from './data/profile.json';
import type { AreaId, EducationEntry } from './types';

/**
 * 지도교수 프로필 — 「이현우 교수 논문·실적 목록.docx」(2026-11-05) 기본 정보 기준.
 * 내용은 content/data/profile.json 에 있고, 관리 화면(/admin ‘연구실 정보 › 지도교수’)에서 고칩니다.
 * 문서에 없는 항목(영문 이름, 이메일, 학사·석사 학력, 소개문)은 비워 두었습니다.
 */
export interface Professor {
  slug: string;
  name: string;
  /** 영문 표기 — 문서에 없어 확인 후 입력 */
  nameEn: string | null;
  /** 화면 표기는 '교수'(2026-11-06 연구실 요청). 임용 직위 기록은 career.json 에 그대로 둠 */
  title: string;
  titleEn: string;
  affiliation: string;
  affiliationEn: string;
  major: string;
  education: EducationEntry[];
  office: string;
  phone: string;
  email: string | null;
  photo: string;
  photoAlt: string;
  /** 연구 관심 분야 — 연구 분야 id (research-areas.json) */
  interestAreas: AreaId[];
  /** 소개문 — 연구실이 확정 문안을 주기 전까지 null (화면에서는 소개문 단락을 생략). 임의의 문구를 만들지 않습니다 */
  bio: string | null;
  links: { label: string; href: string }[];
}

export const professor = data as unknown as Professor;
