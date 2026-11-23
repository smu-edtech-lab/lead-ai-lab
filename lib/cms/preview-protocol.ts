/**
 * 페이지 미리보기 창(/admin/preview)과 관리 화면 사이의 메시지 모양.
 * 관리 화면(components/cms/PagePreview.tsx)이 화면 부품 전체를 불러오지 않도록 약속만 따로 둡니다.
 */
import type { PageId } from '@/content/pages';

export const PREVIEW_RENDER = 'lead-cms-preview:render';
export const PREVIEW_READY = 'lead-cms-preview:ready';

/** 관리 화면 → 미리보기 창 */
export interface PreviewMessage {
  type: typeof PREVIEW_RENDER;
  page: PageId;
  /** 문구 묶음 파일 (경로 → JSON) — lib/site-docs.ts 의 DOC_FILES */
  files: Record<string, unknown>;
  /** 새로 고른 사진 "pending:<id>" → data URL */
  images: Record<string, string>;
  /** 있으면 그린 뒤 이 곳(CSS 선택자)으로 스크롤, '' 이면 맨 위 */
  scroll?: string;
}
