/**
 * About 화면 — 공개 페이지(app/about/page.tsx)와 관리 화면의 페이지 미리보기가 함께 씁니다.
 * 문구는 docs(pages.json 의 about·brand.json·site.json·profile.json·career.json·research-areas.json)에서 옵니다.
 */
import type { SiteDocs } from '@/lib/site-docs';
import { PageHero } from '@/components/content/Headers';
import { MediaFrame } from '@/components/motion/MediaFrame';
import { ScrollText } from '@/components/motion/Kinetic';
import { Reveal } from '@/components/motion/Reveal';
import { Accordion } from '@/components/ui/Controls';
import { Button, TextLink } from '@/components/ui/Button';
import { TransitionLink } from '@/components/nav/TransitionLink';
import { Phrases } from '@/components/ui/Phrases';
import { telHref } from '@/content/site';

export function AboutView({ docs }: { docs: SiteDocs }) {
  const { brand, site, professor } = docs;
  const t = docs.pages.about;
  const areas = docs.areas;
  const areaById = Object.fromEntries(areas.map((a) => [a.id, a]));
  const career = docs.career.filter((c) => !c.current);
  const current = docs.career.filter((c) => c.current);

  return (
    <>
      <PageHero index="02" eyebrow="About" lines={t.heroLines} ko={`${brand.name} — ${brand.nameKo}`} lead={brand.intro[0]} />

      {/* 01 Professor — 지도교수 소개는 이 섹션이 유일한 프로필입니다 (People 은 구성원만). */}
      <section className="lab-sec lab-container lab-prof" aria-labelledby="about-prof" id="professor">
        <MediaFrame ratio="4/5" tone="gray" src={professor.photo} alt={professor.photoAlt} className="lab-prof__img lab-prof__photo" eager sizes="(min-width: 1024px) 30vw, 100vw" />
        <div className="lab-prof__body">
          <p className="lab-t-label">Professor</p>
          <h2 id="about-prof" className="lab-t-h1">
            {professor.name}
          </h2>
          <p className="lab-t-title-ko">
            {professor.title} · {professor.affiliation}
          </p>
          {professor.bio ? <p className="lab-t-body-l">{professor.bio}</p> : null}
          <dl className="lab-dl lab-prof__dl">
            <dt>Education</dt>
            <dd>
              {professor.education.map((e) => (
                <span key={e.institution} style={{ display: 'block' }}>
                  {e.institution}, {e.degree} ({e.date})
                  <span className="lab-t-caption">{e.detail ?? e.program}</span>
                </span>
              ))}
            </dd>
            <dt>Current roles</dt>
            <dd>
              {current.map((c) => (
                <span key={c.id} style={{ display: 'block' }}>
                  {c.org} {c.role}
                  <span className="lab-t-caption">{c.period}</span>
                </span>
              ))}
            </dd>
            <dt>Career</dt>
            <dd>
              <ul className="lab-rows" style={{ marginTop: 4 }}>
                {career.map((c) => (
                  <li key={c.id}>
                    <span className="lab-rows__k">{c.period}</span>
                    <span className="lab-rows__v">
                      <span>
                        {c.org} {c.role}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
            <dt>Interests</dt>
            <dd>
              <span className="lab-rcard__kw">
                {professor.interestAreas.map((id) => {
                  const a = areaById[id];
                  return a ? (
                    <TransitionLink key={id} href={`/research/${a.slug}`} className="lab-tag" label="Research">
                      {a.title}
                    </TransitionLink>
                  ) : null;
                })}
              </span>
            </dd>
            <dt>Office</dt>
            <dd>
              {professor.office}
              <span className="lab-t-caption">
                <a href={telHref(professor.phone)} style={{ color: 'inherit' }}>
                  {professor.phone}
                </a>
              </span>
            </dd>
            {professor.email ? (
              <>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${professor.email}`}>{professor.email}</a>
                </dd>
              </>
            ) : null}
          </dl>
          <div className="lab-footer__ctas" style={{ marginTop: 8 }}>
            <Button variant="secondary" href="/publications" icon="arrow-right">
              Publications
            </Button>
            <TextLink href="/books" variant="standalone">
              Books
            </TextLink>
          </div>
        </div>
      </section>

      {/* 02 Overview */}
      <section className="lab-sec lab-sec--subtle" aria-labelledby="about-overview" id="overview">
        <div className="lab-container lab-twocol">
          <div className="lab-twocol__sticky">
            <h2 id="about-overview" className="lab-t-h1">
              {t.overviewTitle}
            </h2>
            <p className="lab-t-title-ko">{t.overviewKo}</p>
          </div>
          <div className="lab-twocol__flow">
            <ScrollText className="lab-t-h3" text={t.overviewStatement} />
            <Reveal variant="stagger">
              <dl className="lab-dl">
                <dt>Lab</dt>
                <dd>
                  {brand.name}
                  <span className="lab-t-caption">{brand.nameKo}</span>
                </dd>
                <dt>Focus</dt>
                <dd>
                  {brand.fields.join(' · ')}
                </dd>
                <dt>Affiliation</dt>
                <dd>
                  {site.university} {site.department}
                  <span className="lab-t-caption">{site.universityEn} · {site.departmentEn}</span>
                </dd>
                <dt>Field</dt>
                <dd>
                  {site.major}
                  <span className="lab-t-caption">{site.majorEn}</span>
                </dd>
                <dt>Director</dt>
                <dd>
                  {professor.name} {professor.title}
                </dd>
                <dt>Location</dt>
                <dd>
                  {site.address.building} {site.address.room}
                  <span className="lab-t-caption">{site.phone}</span>
                </dd>
              </dl>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 03 Vision */}
      <section className="lab-sec" aria-labelledby="about-vision" id="vision">
        <div className="lab-container lab-twocol">
          <div className="lab-twocol__sticky">
            <h2 id="about-vision" className="lab-t-h1">
              {t.visionTitle}
            </h2>
            <p className="lab-t-title-ko">{t.visionKo}</p>
          </div>
          <div className="lab-twocol__flow">
            <ScrollText className="lab-t-h3" text={t.visionStatement} />
            <p className="lab-t-title-ko">
              <Phrases text={brand.sloganKo} />
            </p>
            <p className="lab-t-body">{brand.intro[1]}</p>
            {/* LEAD 네 축 — 문구는 content/data/brand.json pillars. 관련 연구 분야 링크는 기존 분류를 그대로 가리킴 */}
            <Accordion
              defaultOpen={0}
              items={brand.pillars.map((pl) => ({
                title: `${pl.label} — ${pl.ko}`,
                content: (
                  <>
                    {pl.text}
                    {pl.areas?.length ? (
                      <span className="lab-t-caption" style={{ display: 'block', marginTop: 10 }}>
                        관련 연구 분야:{' '}
                        {pl.areas.map((id, i) => {
                          const a = areaById[id];
                          return a ? (
                            <span key={id}>
                              {i ? ' · ' : ''}
                              <TransitionLink href={`/research/${a.slug}`} label="Research">
                                {a.title}
                              </TransitionLink>
                            </span>
                          ) : null;
                        })}
                      </span>
                    ) : null}
                  </>
                ),
              }))}
            />
            <Reveal variant="stagger">
              <p className="lab-t-label" style={{ color: 'var(--text-tertiary)' }}>
                Research areas
              </p>
              <div className="lab-rcard__kw">
                {areas.map((a) => (
                  <TransitionLink key={a.id} href={`/research/${a.slug}`} className="lab-tag" label="Research">
                    {a.title}
                  </TransitionLink>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 04 Contact CTA */}
      <section className="lab-sec lab-sec--subtle" aria-labelledby="about-cta">
        <div className="lab-container lab-twocol">
          <div className="lab-twocol__sticky">
            <h2 id="about-cta" className="lab-t-h1">
              {t.joinTitle}
            </h2>
            <p className="lab-t-title-ko">{t.joinKo}</p>
          </div>
          <Reveal variant="stagger" className="lab-twocol__flow">
            <p className="lab-t-lead">{t.joinLead}</p>
            <div className="lab-footer__ctas">
              <Button variant="primary" size="l" magnetic href="/contact">
                {t.joinPrimary}
              </Button>
              <TextLink href="/research" variant="standalone">
                {t.joinSecondary}
              </TextLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
