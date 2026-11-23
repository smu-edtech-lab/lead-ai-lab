import data from './data/research-areas.json';
import type { ResearchArea } from './types';

/**
 * 연구 분야 — 첨부 실적(논문 62·저역서 9·학술발표 23·프로젝트 15)의 제목을 분석해 도출한 **임시 분류**입니다.
 * 내용(이름·요약·설명·키워드)은 content/data/research-areas.json 에 있고, 관리 화면(/admin ‘연구실 정보 › 연구 분야’)에서 고칩니다.
 * 연구실 공식 분야가 확정되면 provisional 을 false 로 바꾸세요.
 * id 는 publications.json / projects.json 의 areas 값과 연결됩니다(분야를 새로 만들거나 없앨 때는 types.ts 의 AreaId 도 함께).
 * 2026-11-06: 자기조절학습(self-regulated-learning)은 분야에서 빼고 해당 실적을 교수설계와 학습환경으로 합쳤으며,
 * 교원 역량과 HRD(teacher-competency-hrd)는 교사 역량(teacher-competency)과 HRD(hrd)로 나눴습니다.
 */
export const researchAreas = data.items as ResearchArea[];

export const areaById = Object.fromEntries(researchAreas.map((a) => [a.id, a])) as Record<ResearchArea['id'], ResearchArea>;
