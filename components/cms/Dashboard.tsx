'use client';
/** 처음 화면 — 게시 순서 안내, 메뉴별 카드(개수·사이트에서 나오는 곳), 최근 게시 기록, 올리기 전 주의 */
import { useEffect, useState } from 'react';
import { collectionGroups, collectionItems } from '@/lib/cms/collections';
import type { ChangeInfo } from '@/lib/cms/types';
import { useCms } from './context';
import { Btn, timeAgo } from './ui';

const STEPS = [
  { title: '메뉴 고르기', text: '메뉴나 아래 카드에서 고칠 곳을 고릅니다.' },
  { title: '고치기', text: '칸을 채우면 미리보기가 바로 바뀝니다.' },
  { title: '확인하고 게시', text: '바뀌는 칸을 한 번 더 보여 드립니다.' },
  { title: '1~2분 뒤 반영', text: '위쪽 막대에서 반영 상태를 볼 수 있습니다.' },
];

/** 최근 게시 — 데이터 파일을 바꾼 최근 커밋 */
function RecentChanges() {
  const { backend, snapshot } = useCms();
  const [list, setList] = useState<ChangeInfo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const head = snapshot?.head;

  useEffect(() => {
    let alive = true;
    backend
      .recentChanges(6)
      .then((r) => {
        if (!alive) return;
        setList(r);
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [backend, head]);

  return (
    <section className="cms-panel cms-recent" aria-labelledby="cms-recent-title">
      <h2 id="cms-recent-title" className="cms-h2">
        최근 게시
      </h2>
      {failed ? (
        <p className="cms-help">게시 기록을 불러오지 못했습니다.</p>
      ) : !list ? (
        <p className="cms-help">불러오는 중…</p>
      ) : list.length === 0 ? (
        <p className="cms-help">아직 게시한 내용이 없습니다.</p>
      ) : (
        <ul className="cms-recent__list" role="list">
          {list.map((c, i) => {
            const title = c.title.replace(/^\[CMS\]\s*/, '');
            return (
              <li key={`${c.at}-${i}`} className="cms-recent__row">
                {c.url ? (
                  <a className="cms-recent__title" href={c.url} target="_blank" rel="noreferrer noopener" title="GitHub 에서 바뀐 내용 보기">
                    {title}
                  </a>
                ) : (
                  <span className="cms-recent__title">{title}</span>
                )}
                <span className="cms-recent__meta">
                  {c.who} · {timeAgo(c.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {backend.webUrl ? (
        <p className="cms-help">
          모든 기록은{' '}
          <a href={`${backend.webUrl}/commits/${backend.branch}`} target="_blank" rel="noreferrer noopener">
            GitHub 변경 기록 ↗
          </a>
          에서 볼 수 있고, 잘못 올린 게시도 되돌릴 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}

export function Dashboard() {
  const { user, snapshot, navigate } = useCms();
  return (
    <div className="cms-page">
      <header className="cms-page__head">
        <h1 className="cms-h1">{user.name}님, 안녕하세요</h1>
        <p className="cms-lead">무엇을 고칠지 고르세요. 게시하기 전에 바뀌는 칸을 한 번 더 확인하니, 편하게 고쳐도 됩니다.</p>
      </header>

      <ol className="cms-steps" aria-label="게시 순서">
        {STEPS.map((s, i) => (
          <li key={s.title} className="cms-steps__item">
            <span className="cms-steps__num" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <strong className="cms-steps__title">{s.title}</strong>
              <span className="cms-steps__text">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      {collectionGroups.map((g) => (
        <section key={g.title} className="cms-section" aria-label={g.title}>
          <h2 className="cms-grouptitle">{g.title}</h2>
          <ul className="cms-cards" role="list">
            {g.items.map((c) => {
              const n = snapshot ? collectionItems(snapshot.files[c.file], c).length : 0;
              return (
                <li key={c.id} className="cms-card">
                  <div className="cms-card__head">
                    <h3 className="cms-h2">
                      <a
                        className="cms-card__link"
                        href={`#/${c.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(c.id);
                        }}
                      >
                        {c.label}
                      </a>
                    </h3>
                    <span className="cms-card__count">{n}개</span>
                  </div>
                  <p className="cms-card__where">
                    <span className="cms-visually-hidden">공개 사이트에서 나오는 곳: </span>
                    {c.where}
                  </p>
                  <div className="cms-row">
                    <Btn variant="secondary" size="s" onClick={() => navigate(c.id)}>
                      목록 보기
                    </Btn>
                    <Btn variant="ghost" size="s" onClick={() => navigate(`${c.id}/new`)}>
                      + {c.itemLabel} 추가
                    </Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="cms-dash__bottom">
        <RecentChanges />
        <section className="cms-panel cms-guide" aria-labelledby="cms-guide-title">
          <h2 id="cms-guide-title" className="cms-h2">
            올리기 전에 꼭 확인하세요
          </h2>
          <ul>
            <li>
              저장소가 <strong>공개</strong>라서 올린 글과 사진은 사이트에 보이지 않는 부분까지 누구나 볼 수 있습니다.
            </li>
            <li>
              지운 글·사진도 <strong>변경 기록에는 남습니다</strong>. 본인이 게시에 동의한 사진과 정보만 올려 주세요.
            </li>
            <li>연락처·학번·원본 자료·내부 메모는 올리지 않습니다.</li>
            <li>논문·저역서·학술발표는 원문 표기 그대로 적고, 확인되지 않은 DOI·저자는 비워 둡니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
