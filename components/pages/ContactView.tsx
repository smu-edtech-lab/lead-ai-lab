/**
 * Contact 화면 — 공개 페이지(app/contact/page.tsx)와 관리 화면의 페이지 미리보기가 함께 씁니다.
 * 문구는 docs(pages.json 의 contact·brand.json·site.json)에서 옵니다.
 */
import type { SiteDocs } from '@/lib/site-docs';
import { PageHero } from '@/components/content/Headers';
import { Reveal } from '@/components/motion/Reveal';
import { Accordion } from '@/components/ui/Controls';
import { ContactForm } from '@/components/forms/ContactForm';

export function ContactView({ docs }: { docs: SiteDocs }) {
  const { brand, site } = docs;
  const t = docs.pages.contact;
  return (
    <>
      <PageHero index="07" eyebrow="Contact" lines={t.heroLines} ko={t.heroKo} lead={t.heroLead ?? undefined} />
      <section className="lab-sec lab-sec--tight-top lab-container lab-contact" aria-label="연락처와 문의">
        <div className="lab-contact__info">
          <Reveal variant="stagger" as="dl" className="lab-contact__dl">
            <div>
              <dt className="lab-t-label">Lab</dt>
              <dd className="lab-t-h4">{brand.name}</dd>
              <dd className="lab-t-caption" style={{ color: 'var(--text-tertiary)' }}>
                {brand.nameKo}
              </dd>
            </div>
            <div>
              <dt className="lab-t-label">Affiliation</dt>
              <dd className="lab-t-h4">
                {site.university} {site.department}
              </dd>
              <dd className="lab-t-caption" style={{ color: 'var(--text-tertiary)' }}>
                {site.universityEn} · {site.departmentEn} · {site.major}
              </dd>
            </div>
            <div>
              <dt className="lab-t-label">Address</dt>
              <dd className="lab-t-body-l">
                {site.address.building} {site.address.room}
              </dd>
              {site.address.street ? (
                <dd className="lab-t-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {site.address.street}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="lab-t-label">Phone</dt>
              <dd className="lab-t-h4">
                <a href={site.phoneHref}>{site.phone}</a>
              </dd>
            </div>
            {site.email ? (
              <div>
                <dt className="lab-t-label">Email</dt>
                <dd className="lab-t-body-l">
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                  {site.emailIsSample ? (
                    <span className="lab-badge lab-badge--sample" style={{ marginLeft: 8 }}>
                      예시
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </Reveal>
        </div>
        <div className="lab-contact__form">
          <h2 className="lab-t-h2">{t.formTitle}</h2>
          <p className="lab-t-body lab-contact__note">{t.formNote}</p>
          <ContactForm />
        </div>
      </section>
      <section className="lab-sec lab-sec--subtle" aria-labelledby="contact-join" id="join">
        <div className="lab-container lab-twocol">
          <div className="lab-twocol__sticky">
            <h2 id="contact-join" className="lab-t-h1">
              {t.joinTitle}
            </h2>
            <p className="lab-t-title-ko">{t.joinKo}</p>
          </div>
          <div className="lab-twocol__flow">
            <Accordion items={t.faq} defaultOpen={0} />
          </div>
        </div>
      </section>
    </>
  );
}
