'use client';
/** 항목 목록 — 추가·편집으로 가고, 구성원·연구 분야는 순서를 바꿔 저장합니다. 페이지 문구 목록(PageTextList)도 여기 */
import { useMemo, useState } from 'react';
import { collectionItems, collections, keyOf, pageTextList, type CollectionId, type Item } from '@/lib/cms/collections';
import { isCmsError } from '@/lib/cms/types';
import type { Op } from '@/lib/cms/ops';
import { useCms } from './context';
import { Thumb } from './Thumb';
import { Badge, Btn, Notice } from './ui';

export function CollectionList({ collection }: { collection: CollectionId }) {
  const def = collections[collection];
  const { snapshot, navigate, notify, fail, reload, setDirty, submitOps, requestMode: rm } = useCms();
  const items = useMemo(() => {
    const list = collectionItems(snapshot?.files[def.file], def);
    return def.orderable || !def.sort ? list : list.slice().sort(def.sort);
  }, [snapshot, def]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  /* 항목이 많은 목록(논문 등)은 제목·저자·게재지로 찾기 — 순서를 바꾸는 중에는 찾기를 쓰지 않음 */
  const searchable = items.length > 12 && !def.orderable;
  const needle = q.trim().toLowerCase();
  const filtered = searchable && needle ? items.filter((it) => [def.title(it), def.meta(it), it.authors, keyOf(it)].join(' ').toLowerCase().includes(needle)) : items;
  const shown: Item[] = order ? order.map((k) => items.find((x) => keyOf(x) === k)).filter((x): x is Item => !!x) : filtered;

  /* 묶음(구성원: 과정별)으로 나눠 보여 줌 — 어느 묶음에도 안 맞는 항목은 '기타' */
  const defGroups = def.listGroups;
  const groupOf = (it: Item) => (defGroups ? defGroups.findIndex((g) => g.test(it)) : -1);
  const sections: { label: string | null; rows: Item[] }[] = defGroups
    ? [...defGroups.map((g, gi) => ({ label: g.label, rows: shown.filter((it) => groupOf(it) === gi) })), { label: '기타', rows: shown.filter((it) => groupOf(it) === -1) }].filter((g) => g.rows.length > 0)
    : [{ label: null, rows: shown }];

  /** 같은 묶음 안에서 바로 위·아래 항목과 자리를 바꿈 */
  const move = (key: string, d: -1 | 1) => {
    const keys = (order ?? items.map(keyOf)).slice();
    const byKey = (k: string) => items.find((x) => keyOf(x) === k);
    const me = byKey(key);
    if (!me) return;
    const same = keys.filter((k) => {
      const it = byKey(k);
      return it ? groupOf(it) === groupOf(me) : false;
    });
    const other = same[same.indexOf(key) + d];
    if (!other) return;
    const i = keys.indexOf(key);
    const j = keys.indexOf(other);
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setOrder(keys);
    setDirty(true);
  };

  const saveOrder = async (force = false) => {
    if (!order) return;
    setSaving(true);
    const ops: Op[] = [{ kind: 'order', collection, keys: order }];
    try {
      const r = await submitOps(ops, { force });
      notify(r.mode === 'request' ? '순서 변경 요청을 보냈습니다. 담당자가 확인하면 사이트에 반영됩니다.' : '순서를 게시했습니다. 1~2분 뒤 사이트에 반영됩니다.');
      setDirty(false);
      setOrder(null);
      await reload();
    } catch (e) {
      if (isCmsError(e, 'conflict')) notify('저장 중 다른 변경과 겹쳤습니다. 다시 시도해 주세요.', 'error');
      else fail(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cms-page">
      <header className="cms-page__head cms-page__head--row">
        <div>
          <h1 className="cms-h1">{def.label}</h1>
          <p className="cms-lead">{def.description}</p>
        </div>
        {def.canCreate !== false ? (
          <Btn variant="primary" onClick={() => navigate(`${collection}/new`)}>
            + {def.itemLabel} 추가
          </Btn>
        ) : null}
      </header>

      {order ? (
        <Notice
          tone="warn"
          title="순서를 바꿨습니다"
          actions={
            <>
              <Btn
                variant="ghost"
                onClick={() => {
                  setOrder(null);
                  setDirty(false);
                }}
              >
                되돌리기
              </Btn>
              <Btn variant="primary" busy={saving} onClick={() => void saveOrder()}>
                {rm ? '이 순서로 요청 보내기' : '이 순서로 게시'}
              </Btn>
            </>
          }
        >
          {def.orderNote ?? '사이트에 이 순서대로 나옵니다.'} {rm ? '요청을 보내면 담당자가 확인한 뒤 반영합니다.' : '게시해야 사이트에 반영됩니다.'}
        </Notice>
      ) : null}

      {searchable ? (
        <div className="cms-search">
          <label className="cms-visually-hidden" htmlFor="cms-list-q">
            {def.label} 찾기
          </label>
          <input id="cms-list-q" className="cms-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${def.label} ${items.length}건에서 제목·저자·게재지·번호로 찾기`} />
          {needle ? <span className="cms-search__count">{filtered.length}건</span> : null}
        </div>
      ) : null}

      {shown.length === 0 && needle ? (
        <p className="cms-empty">‘{q.trim()}’ 와(과) 맞는 {def.itemLabel}이(가) 없습니다.</p>
      ) : shown.length === 0 ? (
        <div className="cms-empty">
          <p>아직 {def.itemLabel}이(가) 없습니다.</p>
          {def.canCreate !== false ? (
            <Btn variant="secondary" onClick={() => navigate(`${collection}/new`)}>
              첫 {def.itemLabel} 추가하기
            </Btn>
          ) : null}
        </div>
      ) : (
        <>
          {def.orderable && !order && sections.some((g) => g.rows.length > 1) ? (
            <p className="cms-help cms-list__hint">
              {def.orderHint ?? '오른쪽 ↑ ↓ 로 순서를 바꾼 뒤 ‘이 순서로 게시’를 누르면 사이트의 순서가 바뀝니다.'}
              {rm ? ' (검토 요청 모드에서는 ‘이 순서로 요청 보내기’)' : ''}
            </p>
          ) : null}
          {sections.map((sec) => (
            <section key={sec.label ?? 'all'} className="cms-listgroup" aria-label={sec.label ?? undefined}>
              {sec.label ? (
                <h2 className="cms-listgroup__title">
                  {sec.label} <span className="cms-listgroup__count">{sec.rows.length}</span>
                </h2>
              ) : null}
              <ul className="cms-list" role="list">
                {sec.rows.map((item, i) => {
                  const key = keyOf(item);
                  const title = def.title(item);
                  return (
                    <li key={key || i} className="cms-list__row">
                      <a
                        className="cms-list__main"
                        href={`#/${collection}/edit/${encodeURIComponent(key)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`${collection}/edit/${encodeURIComponent(key)}`);
                        }}
                      >
                        {def.listThumb === 'none' ? (
                          <span className="cms-list__key">{key}</span>
                        ) : (
                          <Thumb src={def.thumb(item)} label={title} ratio={def.listThumb ?? 'portrait'} />
                        )}
                        <span className="cms-list__text">
                          <span className="cms-list__title">
                            {title}
                            {item.isSample ? <Badge tone="sample">예시</Badge> : null}
                          </span>
                          <span className="cms-list__meta">{def.meta(item)}</span>
                        </span>
                        <span className="cms-list__go" aria-hidden="true">
                          고치기 →
                        </span>
                      </a>
                      {def.orderable ? (
                        <span className="cms-list__order">
                          <button type="button" className="cms-iconbtn" onClick={() => move(key, -1)} disabled={i === 0} aria-label={`${title} 위로`} title="위로">
                            ↑
                          </button>
                          <button type="button" className="cms-iconbtn" onClick={() => move(key, 1)} disabled={i === sec.rows.length - 1} aria-label={`${title} 아래로`} title="아래로">
                            ↓
                          </button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/** 페이지 문구 목록 — 페이지마다 제목·소개 문장·섹션 제목을 고치는 화면으로 (#/page-…) */
export function PageTextList() {
  const { navigate } = useCms();
  return (
    <div className="cms-page">
      <header className="cms-page__head">
        <h1 className="cms-h1">페이지 문구</h1>
        <p className="cms-lead">
          페이지마다 제목·소개 문장·섹션 제목·버튼 이름을 고칩니다. 고치는 동안 오른쪽에 실제 페이지가 미리보기로 보입니다. 여러 페이지에 함께 나오는 연구실 이름·슬로건·소개 문단과 연락처는 ‘연구실 정보’에서 고칩니다.
        </p>
      </header>
      <ul className="cms-list" role="list">
        {pageTextList.map((def) => (
          <li key={def.id} className="cms-list__row">
            <a
              className="cms-list__main"
              href={`#/${def.id}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(def.id);
              }}
            >
              <span className="cms-list__key">{def.publicPath('')}</span>
              <span className="cms-list__text">
                <span className="cms-list__title">{def.label}</span>
                <span className="cms-list__meta">{def.where}</span>
              </span>
              <span className="cms-list__go" aria-hidden="true">
                고치기 →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
