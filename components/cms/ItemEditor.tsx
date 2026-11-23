'use client';
/**
 * 항목 편집 — 입력 폼 + 미리보기 → '확인하고 게시' 를 누르면 바뀐 칸을 보여 주고, 확인하면 바로 게시합니다.
 * 검토 요청 모드(GitHub 계정 없이 들어온 사람)는 같은 화면에서 게시 대신 '요청 보내기' — 담당자가 확인한 뒤 반영합니다.
 * 한 덩어리 문서(연구실 정보·페이지 문구, collections.ts 의 single)는 목록 없이 이 화면이 바로 열리고 삭제가 없습니다.
 * previewPages 가 있는 정의는 카드 대신 실제 페이지를 미리보기로 그리고(PagePreview), 고치는 칸 묶음이 있는 곳으로 따라갑니다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_GROUP, collections, itemKeyOf, itemsOf, keyOf, moveTargets, nextKey, toPublicPath, toRepoPath, type CollectionId, type FieldDef, type Item } from '@/lib/cms/collections';
import { dataUrl } from '@/lib/cms/encoding';
import { applyOps, findItem, mergeItem, normalizeItem, sameValue, type Conflict, type Op } from '@/lib/cms/ops';
import { DOC_PATHS } from '@/lib/site-docs';
import { withBasePath } from '@/lib/base-path';
import { validateItem, type FieldErrors } from '@/lib/cms/validate';
import { imageFileName, prepareImage, type PreparedImage } from '@/lib/cms/image';
import { errorMessage, isCmsError } from '@/lib/cms/types';
import { useCms } from './context';
import { FieldControl, type FieldEnv } from './fields';
import { ItemPreview } from './Preview';
import { PagePreview } from './PagePreview';
import { ChangeTable, countChanges } from './ChangeTable';
import { Badge, Btn, Dialog, Notice, josa, timeAgo } from './ui';

const DRAFT_PREFIX = 'lead-cms:draft:';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** 이 항목 전용으로 CMS 가 올린 사진인지 ("/images/people/<주소>-xxxx.jpg" 또는 "<주소>.jpg") */
function ownedImage(path: unknown, dir: string, key: string): path is string {
  if (typeof path !== 'string' || !key) return false;
  const esc = key.replace(/[-]/g, '\\-');
  return new RegExp(`^/images/${dir}/${esc}(-[a-z0-9]+)?\\.(jpg|jpeg|png|webp)$`).test(path);
}

/** 게시 전 확인 창에 띄울 내용 — 이 ops 를 그대로 게시합니다 */
interface Pending {
  ops: Op[];
  item: Item;
  images: Record<string, string>;
}

const hasValue = (v: unknown) => v !== null && v !== undefined && v !== '' && v !== false && !(Array.isArray(v) && v.length === 0);

/** 옮기지 않는 칸을 안내할 때 쓰는 짧은 값 — 고르는 칸·한 줄 칸만 괄호로 보여 줌 */
function shortValue(f: FieldDef, v: unknown): string {
  if (f.type === 'select') return ` (${f.options?.find((o) => o.value === v)?.label ?? String(v)})`;
  if (f.type === 'text' && typeof v === 'string') return ` (${v.length > 24 ? `${v.slice(0, 23)}…` : v})`;
  if (f.type === 'tags' && Array.isArray(v)) return ` (${v.join(', ')})`;
  return '';
}

/**
 * itemKey: 고칠 항목의 키(null 이면 새 항목).
 * moveFrom: 다른 메뉴에서 옮겨 오는 항목의 키 (구성원 → 졸업생, collections.ts 의 moveFrom) — 새 항목처럼 채운 폼을 보여 주고,
 *           게시하면 원래 항목 삭제 + 같은 주소로 이 메뉴에 추가를 한 번에 커밋합니다.
 */
export function ItemEditor({ collection, itemKey, moveFrom = null }: { collection: CollectionId; itemKey: string | null; moveFrom?: string | null }) {
  const def = collections[collection];
  const { snapshot, navigate, notify, fail, reload, setDirty, submitOps, requestMode: rm } = useCms();
  const move = moveFrom && def.moveFrom ? def.moveFrom : null;
  const srcDef = move ? collections[move.collection] : null;
  const isMove = move !== null;
  const isNew = itemKey === null;
  /** 한 덩어리 문서 (연구실 정보·페이지 문구) — 목록·삭제·주소 칸이 없음 */
  const isSingle = !!def.single;
  /** 돌아갈 곳 — 페이지 문구는 페이지 목록, 다른 한 덩어리 문서는 처음 화면, 나머지는 목록 */
  const backPath = isSingle ? (def.group === PAGE_GROUP ? 'pages' : '') : collection;
  const backLabel = isSingle ? (def.group === PAGE_GROUP ? '페이지 문구' : '처음 화면') : `${def.label} 목록`;
  const draftKey = `${DRAFT_PREFIX}${collection}:${isMove ? `move:${moveFrom}` : (itemKey ?? 'new')}`;

  const [base, setBase] = useState<Item | null>(() => (itemKey && snapshot ? findItem(snapshot.files[def.file], def, itemKey) : null));
  /** 옮기기: 원래 메뉴의 항목 (게시할 때 이 내용 그대로인지 확인한 뒤 지움) */
  const [source, setSource] = useState<Item | null>(() => (srcDef && moveFrom && snapshot ? findItem(snapshot.files[srcDef.file], srcDef, moveFrom) : null));
  const [draft, setDraft] = useState<Item>(() => (base ? clone(base) : move && source ? move.convert(source) : def.defaults()));
  const [formKey, setFormKey] = useState(0);
  const [changed, setChanged] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [images, setImages] = useState<Record<string, PreparedImage>>({});
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState<null | 'save' | 'delete'>(null);
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [conflict, setConflict] = useState<{ list: Conflict[]; ops: Op[]; kind: 'save' | 'delete' } | null>(null);
  const [restorable, setRestorable] = useState<{ draft: Item; at: number } | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  /** 검토 요청 모드: 담당자에게 남길 말 */
  const [memo, setMemo] = useState('');
  /** 페이지 미리보기가 따라갈 곳 — 칸 묶음을 고치기 시작하면 바뀜 */
  const [focus, setFocus] = useState<{ selector: string | null; seq: number }>({ selector: null, seq: 0 });
  const formRef = useRef<HTMLFormElement>(null);

  /* 주소(slug) — 새 항목은 손대기 전까지 이름·날짜로 자동 제안 */
  const takenKeys = useMemo(() => {
    const s = new Set<string>();
    for (const k of def.uniqueAcross) for (const it of itemsOf(snapshot?.files[def.file], k)) s.add(keyOf(it));
    if (itemKey) s.delete(itemKey);
    if (moveFrom) s.delete(moveFrom); // 옮기면 원래 항목은 지워지므로 같은 주소를 씀
    return s;
  }, [snapshot, def, itemKey, moveFrom]);

  const suggestion = useMemo(() => {
    const raw = def.suggestKey(draft);
    if (!takenKeys.has(raw)) return raw;
    let n = 2;
    while (takenKeys.has(`${raw}-${n}`)) n++;
    return `${raw}-${n}`;
  }, [def, draft, takenKeys]);
  /* 번호(id)로 구분하는 항목은 새로 만들 때 다음 번호를 미리 보여 주고, 게시할 때 확정(그새 누가 썼으면 다음 번호) */
  const KF = def.keyField;
  const autoKey = !!def.autoKey;
  const predictedKey = useMemo(() => (autoKey && isNew ? nextKey(def, snapshot?.files[def.file]) : ''), [autoKey, isNew, def, snapshot]);
  /** 이 항목의 키 — 주소(slug) 또는 번호(id). 한 덩어리 문서는 정해 둔 key */
  const slug = isMove ? (moveFrom as string) : !isNew ? (itemKey as string) : autoKey ? predictedKey : slugTouched ? str(draft.slug) : suggestion;
  /** 저장할 모양에 키를 넣음 — 한 덩어리 문서는 주소·번호 칸이 없어 그대로 */
  const withKey = (d: Item): Item => (isSingle ? d : { ...d, [KF]: slug });

  const projectIds = useMemo(() => (snapshot?.projects.length ? new Set(snapshot.projects.map((p) => p.id)) : null), [snapshot]);

  /** 저장할 모양으로 정리 (사진은 게시할 때 실제 파일 이름을 정함) */
  const finalize = (forSave: boolean) => {
    const replaced: Item = withKey(draft);
    const puts: Op[] = [];
    for (const f of def.fields) {
      if (f.type !== 'image' || !f.image) continue;
      const v = replaced[f.name];
      if (typeof v === 'string' && v.startsWith('pending:') && images[v]) {
        const path = `/images/${f.image.dir}/${forSave ? imageFileName(slug) : `${slug || 'new'}-preview.jpg`}`;
        replaced[f.name] = path;
        if (forSave) puts.push({ kind: 'putFile', path: toRepoPath(path), base64: images[v].base64 });
      }
    }
    const item = normalizeItem(def, replaced, base);
    const removals: Op[] = [];
    // 사진을 바꿨으면 예전 사진 파일을 지움 — 옮기기에서는 원래 항목의 사진이 예전 사진
    const origin = base ?? (isMove ? source : null);
    if (origin) {
      for (const f of def.fields) {
        if (f.type !== 'image' || !f.image) continue;
        const old = origin[f.name];
        if (old !== item[f.name] && ownedImage(old, f.image.dir, itemKeyOf(def, origin))) removals.push({ kind: 'deleteFile', path: toRepoPath(old) });
      }
    }
    return { item, puts, removals };
  };

  const errors: FieldErrors = useMemo(
    () => validateItem(def, finalize(false).item, { takenKeys, projectIds, isNew }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, slug, images, takenKeys, projectIds],
  );
  /* 페이지 미리보기 — 문구 묶음 파일에 지금 고친 내용을 적용해 창 안으로 보냄 */
  const previewFiles = useMemo(() => {
    if (!def.previewPages || !snapshot) return null;
    const files: Record<string, unknown> = {};
    for (const path of DOC_PATHS) files[path] = clone(snapshot.files[path]);
    try {
      applyOps(files, [{ kind: 'upsert', collection, key: slug || 'new', item: normalizeItem(def, withKey(draft), base), before: base }]);
    } catch {
      /* 아직 다 채우지 않은 새 항목 등 — 저장소 내용 그대로 보여 줌 */
    }
    return files;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, snapshot, draft, slug, base]);
  const shownErrors = showErrors ? errors : {};
  const errorCount = Object.keys(errors).length;

  /* 수정 중 표시 + 이 브라우저에 자동 임시 저장(사진 제외) */
  useEffect(() => {
    setDirty(changed);
  }, [changed, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  useEffect(() => {
    const raw = storage()?.getItem(draftKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { draft: Item; at: number };
      if (saved?.draft && !sameValue(saved.draft, base ?? (move && source ? move.convert(source) : def.defaults()))) setRestorable(saved);
    } catch {
      storage()?.removeItem(draftKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!changed) return;
    const t = window.setTimeout(() => {
      const keep: Item = withKey(draft);
      for (const f of def.fields) if (f.type === 'image' && typeof keep[f.name] === 'string' && (keep[f.name] as string).startsWith('pending:')) keep[f.name] = base?.[f.name] ?? null;
      try {
        storage()?.setItem(draftKey, JSON.stringify({ draft: keep, at: Date.now() }));
      } catch {
        /* 저장 공간 부족 등 — 무시 */
      }
    }, 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, slug, changed, draftKey, def, base, KF]);

  const clearDraft = () => storage()?.removeItem(draftKey);

  const setField = (name: string, value: unknown) => {
    setDraft((d) => ({ ...d, [name]: value }));
    setChanged(true);
  };

  const env: FieldEnv = {
    projects: snapshot?.projects ?? [],
    images: Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.dataUrl])),
    imageBusy,
    pickImage: async (field: FieldDef, file: File) => {
      if (!field.image) return;
      setImageBusy(field.name);
      try {
        const prepared = await prepareImage(file, field.image);
        const id = `pending:${Date.now().toString(36)}`;
        setImages((m) => ({ ...m, [id]: prepared }));
        setField(field.name, id);
      } catch (e) {
        notify(errorMessage(e), 'error');
      } finally {
        setImageBusy(null);
      }
    },
  };

  const focusFirstError = () => {
    window.setTimeout(() => {
      const el = formRef.current?.querySelector<HTMLElement>('.has-error input, .has-error textarea, .has-error select');
      el?.focus();
    }, 0);
  };

  /** '확인하고 게시' — 입력을 검사하고, 게시할 내용을 확인 창으로 보여 줌 */
  const openConfirm = () => {
    setShowErrors(true);
    if (errorCount) {
      notify(`입력 내용을 확인해 주세요 — ${Object.values(errors)[0]}`, 'error');
      focusFirstError();
      return;
    }
    const { item, puts, removals } = finalize(true);
    const ops: Op[] = [
      // 옮기기: 원래 항목을 먼저 지우고(그새 바뀌었으면 충돌로 알림) 같은 주소로 추가
      ...(move && source ? [{ kind: 'delete', collection: move.collection, key: keyOf(source), before: source } as Op] : []),
      { kind: 'upsert', collection, key: str(item[KF]), item, before: base },
      ...puts,
      ...removals,
    ];
    const imgs: Record<string, string> = {};
    for (const op of puts) if (op.kind === 'putFile' && op.base64) imgs[toPublicPath(op.path)] = dataUrl(op.base64, op.path);
    setConfirming({ ops, item, images: imgs });
  };

  const publish = async (ops: Op[], kind: 'save' | 'delete', force = false) => {
    setSaving(kind);
    setConflict(null);
    try {
      const r = await submitOps(ops, { force, memo });
      if (r.mode === 'request') {
        notify(kind === 'delete' ? '삭제 요청을 보냈습니다. 담당자가 확인하면 사이트에서 지워집니다.' : '검토 요청을 보냈습니다. 담당자가 확인하면 사이트에 반영됩니다.');
      } else {
        const done = kind === 'delete' ? '삭제했습니다' : isMove ? `${josa(def.itemLabel, '으로', '로')} 옮겼습니다` : '게시했습니다';
        notify(`${done}. 1~2분 뒤 사이트에 반영됩니다.${r.viaPull ? ` (보호 규칙에 따라 #${r.viaPull} 로 반영)` : ''}`);
      }
      setMemo('');
      clearDraft();
      setChanged(false);
      setDirty(false);
      setConfirming(null);
      await reload();
      navigate(backPath);
    } catch (e) {
      setConfirming(null);
      if (isCmsError(e, 'conflict')) setConflict({ list: (e.detail as Conflict[]) ?? [], ops, kind });
      else if (isCmsError(e, 'validation')) notify(errorMessage(e), 'error');
      else fail(e);
    } finally {
      setSaving(null);
    }
  };

  /** 이 항목 전용 사진 파일 (삭제할 때 함께 지움) */
  const ownedFiles = base ? def.fields.filter((f) => f.type === 'image' && f.image && ownedImage(base[f.name], f.image.dir, itemKeyOf(def, base))).map((f) => base[f.name] as string) : [];
  const canDelete = !isNew && !isSingle && def.canDelete !== false;

  const remove = () => {
    if (!base) return;
    setAskDelete(false);
    const ops: Op[] = [{ kind: 'delete', collection, key: keyOf(base), before: base }];
    for (const path of ownedFiles) ops.push({ kind: 'deleteFile', path: toRepoPath(path) });
    void publish(ops, 'delete');
  };

  const loadLatest = (c: Conflict) => {
    if (move && c.collection === move.collection) {
      // 옮기기 중 원래 항목이 바뀜 — 바뀐 내용을 다시 옮겨 채우되, 내가 고친 칸(학위·졸업 연도 등)은 그대로 둠
      if (c.current && source) {
        const prev = move.convert(source);
        const fresh = move.convert(c.current);
        setDraft((d) => mergeItem(prev, fresh, d).merged);
      }
      setSource(c.current);
      setConflict(null);
      setFormKey((k) => k + 1);
      notify('최신 정보를 반영했습니다. 내가 고친 칸은 그대로 두었으니 확인한 뒤 다시 게시해 주세요.', 'info');
      return;
    }
    setBase(c.current);
    setDraft(c.current ? clone(c.current) : def.defaults());
    setImages({});
    setChanged(false);
    setConflict(null);
    clearDraft();
    setFormKey((k) => k + 1);
    notify('저장소의 최신 내용을 불러왔습니다. 필요한 수정을 다시 해 주세요.', 'info');
  };

  if (itemKey && !base && !conflict) {
    return (
      <div className="cms-page">
        <Notice tone="warn" title={isSingle ? `${def.itemLabel} 파일을 읽지 못했습니다` : '이 항목을 찾을 수 없습니다'} actions={<Btn onClick={() => navigate(backPath)}>{josa(backLabel, '으로', '로')}</Btn>}>
          {isSingle ? `저장소의 ${def.file} 파일이 없거나 모양이 바뀌었을 수 있습니다. 담당자에게 알려 주세요.` : '이미 삭제되었거나 주소가 바뀌었을 수 있습니다.'}
        </Notice>
      </div>
    );
  }

  if (move && srcDef && !source && !conflict) {
    return (
      <div className="cms-page">
        <Notice
          tone="warn"
          title={`옮길 ${josa(srcDef.itemLabel, '을', '를')} 찾을 수 없습니다`}
          actions={
            <>
              <Btn onClick={() => navigate(move.collection)}>{srcDef.label} 목록으로</Btn>
              <Btn onClick={() => navigate(collection)}>{def.label} 목록으로</Btn>
            </>
          }
        >
          이미 옮겼거나 삭제되었을 수 있습니다.
        </Notice>
      </div>
    );
  }

  const previewItem = normalizeItem(def, withKey(draft), base);
  const changeCount = confirming ? countChanges(def, base, confirming.item) : 0;

  /* 옮기기 안내 — 그대로 옮기는 칸과, 이 메뉴에 없어 버리는 칸 */
  const carried = move && srcDef && source ? def.fields.filter((f) => srcDef.fields.some((s) => s.name === f.name) && hasValue(source[f.name])).map((f) => f.label) : [];
  const dropped = move && srcDef && source ? srcDef.fields.filter((f) => !def.fields.some((t) => t.name === f.name) && hasValue(source[f.name])).map((f) => `${f.label}${shortValue(f, source[f.name])}`) : [];
  const sourcePath = move ? `${move.collection}/edit/${moveFrom}` : '';
  /* 이 항목을 다른 메뉴로 옮기는 버튼 (구성원 편집 화면의 '졸업생으로 옮기기') */
  const targets = !isNew ? moveTargets(collection) : [];

  /* 소제목(section) 단위로 칸 묶기 — 묶음의 첫 칸에 anchor 가 있으면 그 묶음을 고칠 때 페이지 미리보기가 그곳으로 감 */
  const groups: { title: string | null; anchor: string | null; fields: FieldDef[] }[] = [];
  for (const f of def.fields) {
    if (f.section || groups.length === 0) groups.push({ title: f.section ?? null, anchor: f.anchor ?? null, fields: [] });
    groups[groups.length - 1].fields.push(f);
  }
  const follow = (selector: string | null) => {
    if (selector && selector !== focus.selector) setFocus((x) => ({ selector, seq: x.seq + 1 }));
  };

  const clashLabels = (c: Conflict) => c.fields.map((n) => def.fields.find((f) => f.name === n)?.label ?? n).join(', ');

  /* 긴 폼(구성원·졸업생)은 위쪽에 바로 가기 — 목록 칸이 있는 묶음은 목록 칸마다, 아니면 소제목 */
  const jumps = groups.flatMap((g, gi) => {
    const lists = g.fields.filter((f) => f.type === 'list');
    if (lists.length && !g.anchor) return lists.map((f) => ({ id: `cms-f-${f.name}-wrap`, label: f.label, anchor: null as string | null }));
    return g.title ? [{ id: `cms-sec-${gi}`, label: g.title, anchor: g.anchor }] : [];
  });
  const jumpTo = (id: string, anchor: string | null) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    follow(anchor);
  };

  const anchorFor = (page: Parameters<NonNullable<typeof def.previewAnchor>>[0]) => def.previewAnchor?.(page, previewItem) ?? null;
  const pagePreview = !!def.previewPages;

  /* 새 항목의 주소·번호 칸 — 자동으로 채워 두므로 첫 묶음 맨 아래에 둠 (이미 있는 항목은 제목 아래에 주소가 보임) */
  const keyField =
    !isNew || isMove ? null : autoKey ? (
      <div className="cms-field">
        <span className="cms-label">
          번호 <span className="cms-auto">자동</span>
        </span>
        <p className="cms-static">{slug}</p>
        <p className="cms-help">
          게시할 때 자동으로 정해집니다 ({def.autoKey?.prefix} 번호 중 가장 큰 번호 + 1). 그사이 다른 사람이 먼저 추가하면 다음 번호가 붙습니다.
        </p>
      </div>
    ) : (
      <div className={`cms-field${shownErrors.slug ? ' has-error' : ''}`}>
        <label className="cms-label" htmlFor="cms-f-slug">
          사이트 주소 <span className="cms-auto">자동 제안</span>
        </label>
        <div className="cms-prefixed">
          <span className="cms-prefixed__pre" aria-hidden="true">
            {def.publicPath('')}
          </span>
          <input
            id="cms-f-slug"
            className="cms-input"
            value={slug}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) => {
              setSlugTouched(true);
              setField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
            }}
            aria-invalid={shownErrors.slug ? true : undefined}
            aria-describedby="cms-f-slug-help"
          />
        </div>
        <p className="cms-help" id="cms-f-slug-help">
          자동으로 만들어 두었으니 보통은 그대로 두면 됩니다. 바꾸려면 영문 소문자·숫자·하이픈(-)만 쓰고, 게시한 뒤에는 바꿀 수 없습니다.
        </p>
        {shownErrors.slug ? <p className="cms-error">{shownErrors.slug}</p> : null}
      </div>
    );

  return (
    <div className="cms-page cms-editor">
      <header className={targets.length ? 'cms-page__head cms-page__head--row' : 'cms-page__head'}>
        <div>
          {move && srcDef && source ? (
            <a
              className="cms-back"
              href={`#/${sourcePath}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(sourcePath);
              }}
            >
              ← {srcDef.itemLabel} 「{srcDef.title(source)}」
            </a>
          ) : (
            <a
              className="cms-back"
              href={`#/${backPath}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(backPath);
              }}
            >
              ← {backLabel}
            </a>
          )}
          <h1 className="cms-h1">
            {move ? move.buttonLabel : isSingle ? def.itemLabel : isNew ? `${def.itemLabel} 추가` : def.title(base ?? draft)}
            {(base ?? source)?.isSample ? <Badge tone="sample">예시</Badge> : null}
          </h1>
          {move && srcDef && source ? (
            <p className="cms-lead">
              {srcDef.itemLabel} 「{srcDef.title(source)}」 → {def.itemLabel} · 사이트 주소 <code>{def.publicPath(slug)}</code> 그대로
            </p>
          ) : isSingle ? (
            <p className="cms-lead">
              {def.description}{' '}
              <a href={withBasePath(def.publicPath(slug))} target="_blank" rel="noreferrer noopener">
                사이트에서 보기 ↗
              </a>
            </p>
          ) : !isNew ? (
            <p className="cms-lead">
              {autoKey ? `번호 ${slug} · ` : ''}사이트 주소 <code>{def.publicPath(slug)}</code>
            </p>
          ) : null}
        </div>
        {targets.length ? (
          <div className="cms-row">
            {targets.map((t) => (
              <Btn key={t.id} variant="secondary" disabled={saving !== null} onClick={() => navigate(`${t.id}/move/${itemKey}`)}>
                {t.moveFrom?.buttonLabel}
              </Btn>
            ))}
          </div>
        ) : null}
      </header>

      {jumps.length >= 4 ? (
        <nav className="cms-jump" aria-label="이 화면 바로 가기">
          <span className="cms-jump__label">바로 가기</span>
          {jumps.map((j) => (
            <button key={j.id} type="button" className="cms-jump__link" onClick={() => jumpTo(j.id, j.anchor)}>
              {j.label}
            </button>
          ))}
        </nav>
      ) : null}

      {move && srcDef && source ? (
        <Notice tone="info" title={`게시하면 ${srcDef.label} 목록에서 빠지고 ${def.label} 목록에 들어갑니다`}>
          <p className="cms-notice__p">
            {carried.length ? `${josa(carried.join(', '), '은', '는')} 그대로 옮겨 채워 두었습니다. ` : ''}
            {move.hint}
          </p>
          {dropped.length ? (
            <p className="cms-notice__p">
              {def.itemLabel} 정보에는 없는 칸이라 옮기지 않습니다: {dropped.join(', ')}
            </p>
          ) : null}
        </Notice>
      ) : null}

      {restorable ? (
        <Notice
          tone="info"
          title={`${rm ? '보내지 않은' : '게시하지 않은'} 수정 내용이 있습니다 (${timeAgo(new Date(restorable.at).toISOString())})`}
          actions={
            <>
              <Btn
                variant="ghost"
                onClick={() => {
                  clearDraft();
                  setRestorable(null);
                }}
              >
                버리기
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => {
                  setDraft(restorable.draft);
                  if (isNew && str(restorable.draft.slug)) setSlugTouched(true);
                  setRestorable(null);
                  setChanged(true);
                  setFormKey((k) => k + 1);
                }}
              >
                불러오기
              </Btn>
            </>
          }
        >
          이 브라우저에 자동으로 임시 저장된 내용입니다. 새로 고른 사진은 임시 저장되지 않으니 다시 골라 주세요.
        </Notice>
      ) : null}

      {conflict ? (
        <Notice
          tone="danger"
          title={
            move && srcDef
              ? !conflict.list[0]?.current
                ? `다른 사람이 이 ${josa(srcDef.itemLabel, '을', '를')} 먼저 삭제했거나 옮겼습니다`
                : `다른 사람이 이 ${srcDef.itemLabel} 정보를 먼저 수정했습니다`
              : !conflict.list[0]?.current
                ? '다른 사람이 이 항목을 먼저 삭제했습니다'
                : conflict.list[0].fields.length
                  ? `다른 사람이 같은 칸을 먼저 수정했습니다 — ${clashLabels(conflict.list[0])}`
                  : '다른 사람이 먼저 이 항목을 수정했습니다'
          }
          actions={
            <>
              <Btn variant="ghost" onClick={() => setConflict(null)}>
                취소
              </Btn>
              {conflict.list[0] && !(move && !conflict.list[0].current) ? (
                <Btn variant="secondary" onClick={() => loadLatest(conflict.list[0])}>
                  최신 내용 불러오기
                </Btn>
              ) : null}
              <Btn variant="danger" busy={saving !== null} onClick={() => void publish(conflict.ops, conflict.kind, true)}>
                내 내용으로 덮어쓰기
              </Btn>
            </>
          }
        >
          {move
            ? conflict.list[0]?.current
              ? '‘최신 내용 불러오기’를 누르면 바뀐 정보를 다시 옮겨 채우고 내가 고친 칸은 그대로 둡니다. ‘덮어쓰기’를 누르면 다른 사람의 수정은 빼고 지금 화면의 내용으로 옮깁니다.'
              : `‘덮어쓰기’를 누르면 지금 화면의 내용으로 ${josa(def.itemLabel, '을', '를')} 추가합니다.`
            : conflict.list[0]?.current
              ? '서로 다른 칸의 수정은 자동으로 합쳐지지만, 같은 칸은 하나를 골라야 합니다. ‘최신 내용 불러오기’를 누르면 내 수정은 사라지고, ‘덮어쓰기’를 누르면 그 칸의 다른 사람 수정이 내 내용으로 바뀝니다.'
              : '‘덮어쓰기’를 누르면 내 내용으로 이 항목을 다시 만듭니다.'}
        </Notice>
      ) : null}

      <div className={pagePreview ? 'cms-editor__grid cms-editor__grid--page' : def.previewWide ? 'cms-editor__grid cms-editor__grid--stack' : 'cms-editor__grid'}>
        <form
          ref={formRef}
          id="cms-form"
          key={formKey}
          className="cms-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            openConfirm();
          }}
        >
          {groups.map((g, gi) => (
            <section key={gi} className="cms-panel" aria-labelledby={g.title ? `cms-sec-${gi}` : undefined} onFocusCapture={pagePreview ? () => follow(g.anchor) : undefined}>
              {g.title ? (
                <h2 className="cms-h2" id={`cms-sec-${gi}`}>
                  {g.title}
                </h2>
              ) : null}
              <div className="cms-fields">
                {g.fields.map((f) => (
                  <FieldControl key={f.name} field={f} value={draft[f.name]} onChange={(v) => setField(f.name, v)} errors={shownErrors} env={env} />
                ))}
                {gi === 0 ? keyField : null}
              </div>
            </section>
          ))}
        </form>

        <aside className="cms-editor__side" aria-label="미리보기">
          {pagePreview && def.previewPages ? (
            <div className="cms-sticky cms-sticky--page">
              <h2 className="cms-h3">미리보기</h2>
              <PagePreview pages={def.previewPages} files={previewFiles} images={env.images} focus={focus} anchorFor={anchorFor} />
              <p className="cms-help">실제 페이지에 지금 고친 내용을 넣어 그린 미리보기입니다. 칸을 고치면 그 부분이 보이도록 따라갑니다. {rm ? '담당자가 반영한 뒤' : '게시한 뒤'} 1~2분이 지나야 실제 사이트에 보입니다.</p>
            </div>
          ) : (
            <div className="cms-sticky">
              <h2 className="cms-h3">미리보기</h2>
              <ItemPreview collection={collection} item={previewItem} images={env.images} />
              <p className="cms-help">공개 사이트와 같은 모양으로 그린 미리보기입니다. {rm ? '담당자가 반영한 뒤' : '게시한 뒤'} 1~2분이 지나야 실제 사이트에 보입니다.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="cms-actionbar">
        <div className="cms-actionbar__inner">
          <div className="cms-actionbar__left">
            {canDelete ? (
              <Btn variant="danger" size="s" busy={saving === 'delete'} disabled={saving !== null} onClick={() => setAskDelete(true)}>
                이 {def.itemLabel} 삭제
              </Btn>
            ) : null}
          </div>
          <div className="cms-row cms-actionbar__right">
            <span className={showErrors && errorCount ? 'cms-actionbar__hint is-error' : 'cms-actionbar__hint'}>
              {showErrors && errorCount ? `확인할 칸 ${errorCount}개` : changed ? (rm ? '보내지 않은 수정이 있습니다' : '게시하지 않은 수정이 있습니다') : ''}
            </span>
            <Btn variant="ghost" onClick={() => navigate(isMove ? sourcePath : backPath)} disabled={saving !== null}>
              취소
            </Btn>
            <Btn variant="primary" type="submit" form="cms-form" busy={saving === 'save'} disabled={saving !== null || imageBusy !== null}>
              {isMove ? (rm ? '확인하고 옮기기 요청' : '확인하고 옮기기') : rm ? '확인하고 요청 보내기' : '확인하고 게시'}
            </Btn>
          </div>
        </div>
      </div>

      <Dialog
        open={confirming !== null}
        wide
        title={isMove ? `${josa(def.itemLabel, '으로', '로')} 옮길까요?` : isNew ? `새 ${josa(def.itemLabel, '을', '를')} ${rm ? '요청할까요?' : '게시할까요?'}` : '바뀐 내용을 확인해 주세요'}
        onClose={() => saving === null && setConfirming(null)}
        actions={
          <>
            <Btn variant="ghost" onClick={() => setConfirming(null)} disabled={saving !== null}>
              돌아가서 고치기
            </Btn>
            <Btn variant="primary" busy={saving === 'save'} disabled={saving !== null || changeCount === 0} onClick={() => confirming && void publish(confirming.ops, 'save')}>
              {isMove ? (rm ? '옮기기 요청 보내기' : '옮기기') : rm ? '요청 보내기' : '게시하기'}
            </Btn>
          </>
        }
      >
        {confirming ? (
          <>
            <p className="cms-lead cms-dialog__lead">
              {rm
                ? move && srcDef && source
                  ? `「${srcDef.title(source)}」 — 담당자가 확인하면 ${srcDef.label} 목록에서 빠지고, 아래 내용으로 ${def.label} 목록에 들어갑니다.`
                  : changeCount === 0
                    ? '바뀐 내용이 없어 보낼 것이 없습니다.'
                    : `${isNew ? '아래 내용으로' : `${changeCount}개 칸이 바뀝니다.`} 요청을 보내면 담당자가 확인한 뒤 사이트에 반영합니다.`
                : move && srcDef && source
                  ? `「${srcDef.title(source)}」 — ${srcDef.label} 목록에서 빠지고, 아래 내용으로 ${def.label} 목록에 들어갑니다. 1~2분 뒤 공개 사이트에 반영되고, 누가 옮겼는지 변경 기록에 남습니다.`
                  : changeCount === 0
                    ? '바뀐 내용이 없어 게시할 것이 없습니다.'
                    : `${isNew ? '아래 내용으로' : `${changeCount}개 칸이 바뀝니다.`} 게시하면 1~2분 뒤 공개 사이트에 반영되고, 누가 게시했는지 변경 기록에 남습니다.`}
            </p>
            {dropped.length ? <p className="cms-help cms-dialog__lead">옮기지 않는 칸: {dropped.join(', ')}</p> : null}
            {pagePreview ? (
              <ChangeTable def={def} before={base} after={confirming.item} projects={snapshot?.projects ?? []} images={confirming.images} request={rm} />
            ) : (
              <div className={def.previewWide ? 'cms-confirm cms-confirm--stack' : 'cms-confirm'}>
                <ChangeTable def={def} before={base} after={confirming.item} projects={snapshot?.projects ?? []} images={confirming.images} request={rm} />
                <div className="cms-confirm__preview">
                  <ItemPreview collection={collection} item={confirming.item} images={confirming.images} />
                </div>
              </div>
            )}
            {rm && changeCount > 0 ? <MemoField value={memo} onChange={setMemo} /> : null}
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={askDelete}
        title={base ? `「${def.title(base)}」 ${josa(def.itemLabel, '을', '를')} ${rm ? '삭제하도록 요청할까요?' : '삭제할까요?'}` : '삭제할까요?'}
        onClose={() => setAskDelete(false)}
        actions={
          <>
            <Btn variant="ghost" onClick={() => setAskDelete(false)}>
              취소
            </Btn>
            <Btn variant="danger" onClick={remove}>
              {rm ? '삭제 요청 보내기' : '삭제하기'}
            </Btn>
          </>
        }
      >
        <ul className="cms-dialog__list">
          <li>{rm ? '담당자가 확인하면 공개 사이트에서 사라집니다.' : '1~2분 뒤 공개 사이트에서 사라집니다.'}</li>
          {ownedFiles.length ? <li>이 {def.itemLabel}의 사진 파일도 함께 지웁니다.</li> : null}
          <li>변경 기록에는 남아서, 필요하면 담당자가 되살릴 수 있습니다.</li>
        </ul>
        {targets.length ? (
          <Notice tone="info" title="졸업했다면 삭제 대신 옮기세요">
            편집 화면 오른쪽 위의 ‘{targets[0].moveFrom?.buttonLabel}’를 쓰면 이름·사진·상세 프로필이 {targets[0].label} 목록으로 옮겨집니다.
          </Notice>
        ) : null}
        {rm ? <MemoField value={memo} onChange={setMemo} placeholder="예: 홈페이지에서 내리기로 했습니다." /> : null}
      </Dialog>
    </div>
  );
}

/** 검토 요청 모드: 담당자에게 남길 말 (요청 글 맨 위에 들어감) */
export function MemoField({ value, onChange, placeholder = '예: 날짜가 바뀌어 고쳤습니다. 사진은 다음 주에 보내 드릴게요.' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="cms-field cms-memo">
      <label className="cms-label" htmlFor="cms-req-memo">
        담당자에게 남길 말 <span className="cms-auto">선택</span>
      </label>
      <textarea id="cms-req-memo" className="cms-input cms-textarea" rows={3} maxLength={2000} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <p className="cms-help">요청 내용과 이 메모는 공개 저장소에 올라가 누구나 볼 수 있습니다. 연락처 같은 개인 정보는 적지 마세요.</p>
    </div>
  );
}
