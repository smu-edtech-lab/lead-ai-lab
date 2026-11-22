/**
 * 연구실 홈페이지 Contact 문의 자동 발송 — Google Apps Script 웹 앱
 *
 * 홈페이지의 문의 폼이 이 스크립트로 내용을 보내면, 이 스크립트가 연구실 메일로 문의 메일을 보냅니다.
 * 설치·배포 방법: 저장소의 docs/문의-자동발송-설정.md
 *
 * 저장소의 contact-mail/Code.gs 가 원본입니다. Apps Script 편집기에는 이 내용을 그대로 붙여 넣습니다.
 * 내용을 고친 뒤에는 편집기에서 [배포 › 배포 관리 › 수정(연필) › 버전: 새 버전 › 배포]를 해야 반영됩니다. 웹 앱 주소는 그대로입니다.
 *
 * 하는 일
 *  - doPost : 문의 폼이 보낸 내용을 검사하고 메일을 보낸 뒤 { ok: true } 를 돌려줍니다. 보내지 못하면 { ok: false, error: '…' }.
 *  - doGet  : 웹 앱 주소를 브라우저로 열었을 때 { ok: true } 를 보여 줍니다(배포 확인용).
 *  - testSend : 편집기에서 직접 실행하는 시험 발송(권한 승인용).
 *
 * 지키는 것
 *  - 받는 주소는 아래 RECIPIENT(또는 스크립트를 만든 계정) 하나로 고정입니다. 문의한 사람의 주소는 '답장 받을 주소'로만 쓰고,
 *    그 주소로는 어떤 메일도 보내지 않습니다(자동 회신 없음) — 이 주소가 남에게 스팸을 보내는 통로가 되지 않게 하기 위해서입니다.
 *  - 문의 내용은 메일로만 전달하고 이 스크립트에 따로 저장하지 않습니다.
 */

/* ───────── 설정 ───────── */

/** 문의를 받을 주소. 비워 두면 이 스크립트를 만든 Google 계정의 주소로 보냅니다. 여러 명이면 쉼표로 구분합니다: 'a@x.ac.kr, b@x.ac.kr' */
var RECIPIENT = '';
/** 메일 제목 앞머리 */
var SUBJECT_PREFIX = '[연구실 문의]';
/** 받은 메일에 '보낸 사람' 이름으로 표시되는 글자 */
var SENDER_NAME = '연구실 홈페이지 문의';
/** 한 시간에 보내는 최대 건수. 넘으면 거절합니다 — 자동 프로그램이 하루 발송 한도(일반 Google 계정 100통)를 다 써 버리지 못하게 막습니다. */
var MAX_PER_HOUR = 20;
/** 화면을 연 뒤 이 시간(밀리초) 안에 제출되면 사람이 쓴 것이 아니라고 보고 거절합니다. */
var MIN_FILL_MS = 3000;

/* ───────── 웹 앱 ───────── */

var EMAIL_RE = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;

function doPost(e) {
  try {
    var data = parse_(e);
    if (!data) return reply_({ ok: false, error: 'bad_request' });

    /* 자동 프로그램 걸러내기: 사람 눈에 안 보이는 칸(website)이 채워졌거나, 화면을 열자마자 제출된 경우 */
    if (text_(data.website)) return reply_({ ok: false, error: 'rejected' });
    if (!(Number(data.elapsed) >= MIN_FILL_MS)) return reply_({ ok: false, error: 'rejected' });

    /* 입력값 검사 — 홈페이지 화면(components/forms/ContactForm.tsx)의 검사와 같은 기준 */
    var name = line_(data.name);
    var email = line_(data.email);
    var org = line_(data.org);
    var purpose = line_(data.purposeLabel) || '문의';
    var message = text_(data.message);
    if (!name || name.length > 80) return invalid_('name');
    if (email.length > 200 || !EMAIL_RE.test(email)) return invalid_('email');
    if (org.length > 120) return invalid_('org');
    if (purpose.length > 40) return invalid_('purpose');
    if (message.length < 10 || message.length > 5000) return invalid_('message');
    if (data.agree !== true) return invalid_('agree');

    /* 발송량 제한 */
    if (!underHourlyLimit_()) return reply_({ ok: false, error: 'busy' });
    if (MailApp.getRemainingDailyQuota() < 1) return reply_({ ok: false, error: 'quota' });

    var lines = ['[문의 유형] ' + purpose, '[이름] ' + name, '[이메일] ' + email];
    if (org) lines.push('[소속] ' + org);
    lines.push('', message, '', '──', '연구실 홈페이지 문의 폼에서 보낸 메일입니다. 이 메일에 답장하면 문의한 분(' + email + ')에게 갑니다.');

    MailApp.sendEmail({
      to: recipient_(),
      replyTo: email,
      name: SENDER_NAME,
      subject: SUBJECT_PREFIX + ' ' + purpose + ' — ' + name,
      body: lines.join('\n'),
    });
    return reply_({ ok: true });
  } catch (err) {
    console.error(err);
    return reply_({ ok: false, error: 'server' });
  }
}

/** 웹 앱 주소를 브라우저로 열면 보이는 응답 — 배포가 되었고 누구나 접근할 수 있는지 확인하는 용도 */
function doGet() {
  return reply_({ ok: true, service: 'contact-mail' });
}

/**
 * 편집기에서 직접 실행하는 시험 발송. 처음 실행하면 권한 승인 창이 뜹니다.
 * 받는 주소로 시험 메일 한 통을 보내고, 실행 로그에 받는 주소와 오늘 남은 발송 가능 수를 적습니다.
 */
function testSend() {
  var to = recipient_();
  MailApp.sendEmail({
    to: to,
    name: SENDER_NAME,
    subject: SUBJECT_PREFIX + ' 시험 발송',
    body: '연구실 홈페이지 문의 자동 발송 설정을 확인하는 시험 메일입니다.\n이 메일이 보이면 발송 권한과 받는 주소(' + to + ')가 맞게 설정된 것입니다.',
  });
  console.log('시험 메일을 보냈습니다. 받는 주소: ' + to + ' / 오늘 남은 발송 가능 수: ' + MailApp.getRemainingDailyQuota());
}

/* ───────── 내부 함수 (이름이 _ 로 끝나면 편집기 실행 목록에 나오지 않습니다) ───────── */

function recipient_() {
  return RECIPIENT || Session.getEffectiveUser().getEmail();
}

/** 요청 본문(JSON 글자)을 객체로. 형식이 다르거나 너무 크면 null */
function parse_(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 20000) return null;
    var data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch (err) {
    return null;
  }
}

/** 한 줄 값 — 줄바꿈·제어 문자를 빈칸으로 바꿉니다(메일 제목에 줄바꿈이 섞여 들어가지 않게) */
function line_(v) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

/** 여러 줄 값 — 줄바꿈은 살리고 앞뒤 빈칸만 정리 */
function text_(v) {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '';
}

function invalid_(field) {
  return reply_({ ok: false, error: 'invalid', field: field });
}

/** 이번 시간대에 보낸 건수가 한도 안이면 1 늘리고 true, 넘었으면 false */
function underHourlyLimit_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var cache = CacheService.getScriptCache();
    var key = 'sent-' + Math.floor(Date.now() / 3600000);
    var n = Number(cache.get(key)) || 0;
    if (n >= MAX_PER_HOUR) return false;
    cache.put(key, String(n + 1), 4000);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
