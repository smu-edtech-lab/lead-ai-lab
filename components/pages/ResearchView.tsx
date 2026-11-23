/**
 * Research(= Research Areas) 화면 — 공개 페이지(app/research/page.tsx)와 관리 화면의 페이지 미리보기가 함께 씁니다.
 * 다섯 가지 주요 연구 분야의 설명과, 분야별 관련 연구만 보여 줍니다(2026-11-09 요청).
 * 문구는 docs(pages.json 의 research·research-areas.json)에서, 관련 연구 목록은 넘겨받은 데이터에서 옵니다.
 */
import type { Publication } from '@/content/types';
import { researchAutoLead, type SiteDocs } from '@/lib/site-docs';
import { researchAreas } from '@/content/research-areas';
import { getPublicationsByArea, publicationTypeLabels } from '@/lib/content';
import { PageHero } from '@/components/content/Headers';
import { Reveal } from '@/components/motion/Reveal';
import { Button } from '@/components/ui/Button';

/** 분야마다 이 페이지에 바로 보여 주는 최근 관련 연구 수 — 전체는 분야별 아카이브(/research/[slug])에 */
const RECENT = 3;

/** 분야별 관련 연구 — 공개 페이지와 미리보기가 같은 규칙으로 고름 */
export function researchData(): Record<string, Publication[]> {
  return Object.fromEntries(researchAreas.map((a) => [a.id, getPublicationsByArea(a.id)]));
}

export function ResearchView({ docs, pubsByArea }: { docs: SiteDocs; pubsByArea: Record<string, Publication[]> }) {
  const t = docs.pages.research;
  const areas = docs.areas;

  return (
    <>
      <PageHero index="03" eyebrow="Research" lines={t.heroLines} ko={t.heroKo} lead={t.heroLead ?? researchAutoLead(areas)} />

      <section className="lab-sec lab-sec--tight-top" aria-label="주요 연구 분야" id="areas">
        <div className="lab-container">
          <ol className="lab-areadoc" role="list">
            {areas.map((a) => {
              const pubs = pubsByArea[a.id] ?? [];
              const hid = `area-${a.slug}`;
              return (
                <li key={a.id} id={a.slug} className="lab-areadoc__item" aria-labelledby={hid}>
                  <Reveal variant="stagger" className="lab-areadoc__head">
                    <h2 id={hid} className="lab-t-h3 lab-areadoc__title">
                      {a.title}
                    </h2>
                    <p className="lab-t-title-ko lab-areadoc__ko">{a.ko}</p>
                  </Reveal>

                  <div className="lab-areadoc__body">
                    <Reveal variant="stagger" className="lab-areadoc__text">
                      <p className="lab-t-lead lab-areadoc__sum">{a.summary}</p>
                      <p className="lab-t-body lab-areadoc__desc">{a.description}</p>
                      <div className="lab-rcard__kw">
                        {a.keywords.map((k) => (
                          <span key={k} className="lab-tag">
                            {k}
                          </span>
                        ))}
                      </div>
                    </Reveal>

                    {/* 관련 연구 — 최근 몇 건만 가볍게(연도 · 제목 · 구분 · 게재지). 저자·DOI 등 상세와 전체 목록은 분야별 아카이브에서 */}
                    {pubs.length ? (
                      <div className="lab-areadoc__archive">
                        <p className="lab-t-label lab-areadoc__label">
                          Related research <span lang="ko">관련 연구</span>
                        </p>
                        <ul className="lab-areadoc__list" role="list">
                          {pubs.slice(0, RECENT).map((p) => (
                            <li key={p.id}>
                              <span className="lab-t-index">{p.year ?? '—'}</span>
                              <span className="lab-areadoc__work">
                                <span className="lab-areadoc__work-title">{p.title}</span>
                                <span className="lab-t-caption">
                                  {publicationTypeLabels[p.type].ko} · {p.venue}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="lab-areadoc__more">
                          <Button variant="secondary" href={`/research/${a.slug}`} icon="arrow-right">
                            {a.ko} 연구 아카이브
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}
