// 데이터 무결성 검사: npm run check:data
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(path.join(root, 'content/data', p), 'utf8'));
/* public/ 기준 경로("/images/...")의 파일이 실제로 있는지 */
const publicFile = (p) => typeof p === 'string' && p.startsWith('/') && existsSync(path.join(root, 'public', p));
const AREAS = ['ai-in-education', 'learning-analytics', 'instructional-design', 'teacher-competency', 'hrd'];
const TYPES = ['journal', 'book', 'conference'];
const NEWS_CATS = ['notice', 'conference', 'publication', 'award', 'event', 'member'];
/* 상세 페이지 주소(/news/<slug>, /people/<slug>)에 쓰이므로 관리자 화면(lib/cms/collections.ts KEY_PATTERN)과 같은 규칙 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const errors = [];
const warn = [];
const assert = (cond, msg) => {
  if (!cond) errors.push(msg);
};
const unique = (arr, label) => {
  const seen = new Set();
  for (const v of arr) {
    if (seen.has(v)) errors.push(`${label}: 중복 "${v}"`);
    seen.add(v);
  }
};
const isAreaList = (areas, label) => {
  assert(Array.isArray(areas), `${label}: areas 는 배열이어야 합니다`);
  for (const a of areas || []) assert(AREAS.includes(a), `${label}: 알 수 없는 분야 "${a}"`);
};

// publications
const pubs = read('publications.json');
unique(pubs.items.map((p) => p.id), 'publications.id');
for (const t of TYPES) {
  const n = pubs.items.filter((p) => p.type === t).length;
  assert(n === pubs.counts[t], `publications: ${t} 건수 ${n} != counts.${t} ${pubs.counts[t]}`);
}
for (const p of pubs.items) {
  assert(TYPES.includes(p.type), `${p.id}: type "${p.type}"`);
  assert(typeof p.title === 'string' && p.title.trim(), `${p.id}: 제목 없음`);
  assert(typeof p.venue === 'string', `${p.id}: venue 없음`);
  assert(['professor', 'lab'].includes(p.scope), `${p.id}: scope "${p.scope}"`);
  isAreaList(p.areas, p.id);
  if (p.year === null) warn.push(`${p.id}: 연도 미상 (date="${p.date}")`);
  else assert(String(p.year) === String(p.sortKey).slice(0, 4), `${p.id}: year/sortKey 불일치`);
  if (!p.areas?.length) warn.push(`${p.id}: 분야 미분류`);
  if (p.cover && !publicFile(p.cover)) errors.push(p.id + ': cover 파일 없음 "' + p.cover + '"');
  if (p.abstractImage && !publicFile(p.abstractImage)) errors.push(p.id + ': abstractImage 파일 없음 "' + p.abstractImage + '"');
  if (p.doi && !/^10\./.test(p.doi)) errors.push(`${p.id}: DOI 형식 "${p.doi}"`);
}

// projects
const prj = read('projects.json');
unique(prj.items.map((p) => p.id), 'projects.id');
for (const p of prj.items) {
  assert(p.title && p.funder && p.period, `${p.id}: title/funder/period 누락`);
  assert(Number.isInteger(p.startYear) && Number.isInteger(p.endYear) && p.startYear <= p.endYear, `${p.id}: 연도 범위 오류`);
  assert(['ongoing', 'completed'].includes(p.status), `${p.id}: status "${p.status}"`);
  isAreaList(p.areas, p.id);
  if (p.media && !publicFile(p.media)) errors.push(p.id + ': media 파일 없음 "' + p.media + '"');
}

// career
const career = read('career.json');
unique(career.items.map((c) => c.id), 'career.id');
for (const c of career.items) {
  assert(c.role && c.org && c.start, `${c.id}: role/org/start 누락`);
  assert(c.current === (c.end === null), `${c.id}: current 와 end 불일치`);
}

// members
const members = read('members.json');
const profileLists = (p) => {
  for (const k of ['research', 'awards', 'history']) {
    if (p[k] == null) continue;
    assert(Array.isArray(p[k]) && p[k].every((e) => e && e.period && e.title), `${p.slug}: ${k} 항목은 { period, title, detail? } 형식이어야 합니다`);
  }
  for (const k of ['research', 'projects', 'awards', 'history']) {
    for (const e of Array.isArray(p[k]) ? p[k] : []) {
      if (e && 'hidden' in e) assert(typeof e.hidden === 'boolean', `${p.slug}: ${k} 의 hidden 은 true/false 여야 합니다`);
    }
  }
  if (p.projects != null) {
    assert(Array.isArray(p.projects), `${p.slug}: projects 는 배열이어야 합니다`);
    const ids = new Set(prj.items.map((x) => x.id));
    for (const e of p.projects || []) {
      if (e?.projectId) assert(ids.has(e.projectId), `${p.slug}: projects.projectId "${e.projectId}" 가 projects.json 에 없습니다`);
      else assert(e && e.period && e.title, `${p.slug}: projects 항목은 projectId 또는 { period, title } 가 있어야 합니다`);
    }
  }
};
unique([...members.members, ...members.alumni].map((m) => m.slug), 'members.slug');
for (const m of [...members.members, ...members.alumni]) assert(SLUG.test(m.slug || ''), `people "${m.slug}": 주소(slug)는 영문 소문자·숫자·하이픈만`);
for (const m of members.members) {
  assert(m.slug && m.name, 'member: slug/name 누락');
  assert(['phd', 'master', 'undergrad', 'researcher', 'other'].includes(m.role), `${m.slug}: role "${m.role}"`);
  if (m.areas) isAreaList(m.areas, m.slug);
  if (m.photo && !publicFile(m.photo)) errors.push(m.slug + ': photo 파일 없음 "' + m.photo + '"');
  profileLists(m);
  if (m.isSample) warn.push(m.slug + ": 예시 구성원 (가상 인물 — 화면에 '예시' 표시, 실제 명단 확정 후 삭제)");
}
for (const a of members.alumni) {
  assert(a.slug && a.name && Number.isInteger(a.graduatedYear), 'alumni: slug/name/graduatedYear 누락');
  assert(['phd', 'master'].includes(a.degree), `${a.slug}: degree "${a.degree}"`);
  if (a.areas) isAreaList(a.areas, a.slug);
  if (a.photo && !publicFile(a.photo)) errors.push(a.slug + ': photo 파일 없음 "' + a.photo + '"');
  profileLists(a);
  if (a.isSample) warn.push(`${a.slug}: 예시 졸업생 (가상 인물 — 화면에 '예시' 표시, 실제 명단 확정 후 삭제)`);
}

// news
const news = read('news.json');
unique(news.items.map((n) => n.slug), 'news.slug');
for (const n of news.items) {
  assert(SLUG.test(n.slug || ''), `news "${n.slug}": 주소(slug)는 영문 소문자·숫자·하이픈만`);
  assert(!String(n.slug).startsWith('pub-'), `news "${n.slug}": pub- 로 시작하는 주소는 자동 생성 소식용입니다`);
  assert(/^\d{4}(-\d{2}){0,2}$/.test(n.date), `${n.slug}: date "${n.date}" (YYYY, YYYY-MM, YYYY-MM-DD)`);
  if (n.image && !publicFile(n.image)) errors.push(n.slug + ': image 파일 없음 "' + n.image + '"');
  assert(NEWS_CATS.includes(n.category), `${n.slug}: category "${n.category}"`);
  assert(n.title, `${n.slug}: 제목 없음`);
  if (/\[예시/.test(n.title) && !n.isSample) errors.push(`${n.slug}: 예시 제목인데 isSample 이 없습니다`);
  if (n.category === 'award' && n.isSample) errors.push(`${n.slug}: 수상 소식은 예시로 두지 마세요`);
  if (n.isSample) warn.push(`${n.slug}: 예시 콘텐츠 (화면에 '예시' 표시)`);
}

// research areas — 분야 id 는 위 AREAS(그리고 content/types.ts 의 AreaId)와 같아야 합니다
const areaDoc = read('research-areas.json');
unique(areaDoc.items.map((a) => a.id), 'research-areas.id');
unique(areaDoc.items.map((a) => a.slug), 'research-areas.slug');
assert(areaDoc.items.length === AREAS.length && AREAS.every((id) => areaDoc.items.some((a) => a.id === id)), `research-areas: 분야 id 는 ${AREAS.join(', ')} 이어야 합니다 (분야를 바꾸면 이 검사와 content/types.ts 의 AreaId 도 함께)`);
for (const a of areaDoc.items) {
  assert(SLUG.test(a.slug || ''), `research-areas "${a.id}": slug 형식`);
  for (const k of ['title', 'ko', 'summary', 'description']) assert(typeof a[k] === 'string' && a[k].trim(), `research-areas "${a.id}": ${k} 없음`);
  assert(Array.isArray(a.keywords) && a.keywords.every((k) => typeof k === 'string'), `research-areas "${a.id}": keywords 는 글자 목록이어야 합니다`);
}

// 한 덩어리 문서 — 화면이 바로 읽는 칸이 빠지지 않았는지 (관리 화면 lib/cms/collections.ts 의 필수 칸과 같게)
const text = (v) => typeof v === 'string' && v.trim() !== '';
const textList = (v) => Array.isArray(v) && v.length > 0 && v.every(text);
const needText = (doc, keys, label) => {
  for (const k of keys) assert(text(doc?.[k]), `${label}: ${k} 없음`);
};
const needLines = (doc, keys, label) => {
  for (const k of keys) assert(textList(doc?.[k]), `${label}: ${k} 는 한 줄 이상인 글자 목록이어야 합니다`);
};
const optText = (doc, keys, label) => {
  for (const k of keys) assert(doc?.[k] === null || doc?.[k] === undefined || typeof doc[k] === 'string', `${label}: ${k} 는 글자 또는 null`);
};

const brandDoc = read('brand.json');
needText(brandDoc, ['name', 'nameKo', 'meaning', 'affiliation', 'tagline', 'sloganKo', 'wordmark'], 'brand');
needLines(brandDoc, ['taglineLines'], 'brand');
assert(Array.isArray(brandDoc.intro) && brandDoc.intro.length === 2 && brandDoc.intro.every(text), 'brand: intro 는 문단 두 개여야 합니다 (첫 문단 = Home 첫 화면·About 첫머리, 둘째 = Vision)');
assert(Array.isArray(brandDoc.fields) && brandDoc.fields.every(text), 'brand: fields 는 글자 목록이어야 합니다');
for (const [i, pl] of (brandDoc.pillars || []).entries()) {
  needText(pl, ['label', 'ko', 'text'], `brand.pillars[${i}]`);
  if (pl.areas != null) isAreaList(pl.areas, `brand.pillars[${i}]`);
}

const siteDoc = read('site.json');
needText(siteDoc, ['university', 'universityEn', 'department', 'departmentEn', 'major', 'majorEn', 'building', 'room', 'phone'], 'site');
optText(siteDoc, ['street', 'email'], 'site');
assert(typeof siteDoc.emailIsSample === 'boolean', 'site: emailIsSample 은 true/false');
if (siteDoc.email && /@example.(com|org|net)$/i.test(siteDoc.email) && !siteDoc.emailIsSample) errors.push('site: example 주소는 예시 주소입니다 — emailIsSample 을 true 로 두거나 실제 주소로 바꾸세요');
if (siteDoc.emailIsSample) warn.push(`site: 문의 이메일이 예시(가상) 주소입니다 (${siteDoc.email})`);

const prof = read('profile.json');
needText(prof, ['slug', 'name', 'title', 'affiliation', 'office', 'phone', 'photoAlt'], 'profile');
optText(prof, ['nameEn', 'email', 'bio', 'photo'], 'profile');
if (prof.photo && !publicFile(prof.photo)) errors.push('profile: photo 파일 없음 "' + prof.photo + '"');
isAreaList(prof.interestAreas, 'profile.interestAreas');
for (const [i, e] of (prof.education || []).entries()) needText(e, ['institution', 'degree', 'date'], `profile.education[${i}]`);

const pagesDoc = read('pages.json');
const heroPage = (id) => {
  needLines(pagesDoc[id], ['heroLines'], `pages.${id}`);
  needText(pagesDoc[id], ['heroKo'], `pages.${id}`);
  optText(pagesDoc[id], ['heroLead'], `pages.${id}`);
};
for (const id of ['research', 'projects', 'publications', 'people', 'books', 'news', 'contact']) heroPage(id);
needText(pagesDoc.home, ['heroPrimary', 'heroSecondary', 'heroCaption', 'visionLabel', 'visionStatement', 'visionLink', 'researchKo', 'researchDescription', 'researchLink', 'pubsKo', 'pubsDescription', 'pubsLink', 'projectsKo', 'projectsDescription', 'projectsLink', 'peopleKo', 'peopleLink', 'newsKo', 'newsLink'], 'pages.home');
needLines(pagesDoc.home, ['keywords', 'researchTitle', 'pubsTitle', 'projectsTitle', 'peopleTitle', 'newsTitle'], 'pages.home');
needLines(pagesDoc.about, ['heroLines'], 'pages.about');
needText(pagesDoc.about, ['overviewTitle', 'overviewKo', 'overviewStatement', 'visionTitle', 'visionKo', 'visionStatement', 'joinTitle', 'joinKo', 'joinLead', 'joinPrimary', 'joinSecondary'], 'pages.about');
needLines(pagesDoc.people, ['membersTitle', 'alumniTitle'], 'pages.people');
needText(pagesDoc.people, ['membersKo', 'emptyTitle', 'emptyText', 'alumniKo'], 'pages.people');
needText(pagesDoc.contact, ['formTitle', 'formNote', 'joinTitle', 'joinKo'], 'pages.contact');
assert(Array.isArray(pagesDoc.contact?.faq), 'pages.contact: faq 는 목록이어야 합니다');
for (const [i, q] of (pagesDoc.contact?.faq || []).entries()) needText(q, ['title', 'content'], `pages.contact.faq[${i}]`);

// lab history
const hist = read('lab-history.json');
for (const h of hist.items) assert(/^\d{4}$/.test(h.year) && h.title, 'lab-history: year/title 형식');

const total = `논문 ${pubs.counts.journal} · 저역서 ${pubs.counts.book} · 학술발표 ${pubs.counts.conference} · 프로젝트 ${prj.items.length} · 경력 ${career.items.length} · 구성원 ${members.members.length} · 졸업생 ${members.alumni.length} · 소식 ${news.items.length}`;
console.log(`[check:data] ${total}`);
for (const w of warn) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
if (errors.length) {
  console.log(`[check:data] ${errors.length} error(s)`);
  process.exit(1);
}
console.log('[check:data] OK');
