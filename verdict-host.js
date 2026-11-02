/* ═════════════════════════════════════════════════
   verdict-host.js — 입력창의 '판결 시뮬레이션' 모드 (2026-11-02)
   하는 일
   · 사건 개요 입력 → 사건 분석 → (필요하면) 추가질문 → STEP 0·A·B·C 판결문 작성 → 결과 카드까지의 흐름을 맡는다.
   · AI 호출·파이프라인은 직접 하지 않는다. K-Law 공유 엔진(hondi.net/lib/klaw-engine.js, KLawEngine)이 하고,
     이 파일은 그 이벤트를 화면에 옮기기만 한다 — klaw.hondi.net/verdict-generate.html 과 같은 엔진이다.
   · 로그인·GDC 차감은 엔진이 KAuth(+/klaw/relay)로 처리한다. 이 파일은 토큰을 만지지 않는다.
   구조: create(cfg) = 흐름(화면 없음, 테스트 대상) / domUi() = 실제 화면 그리기 / mount() = desktop.html 에 연결
   의존: hondi.net/lib/klaw-engine.js, hondi.net/auth/k-service-auth-client.js (둘 다 desktop.html 이 먼저 불러온다)
   ═════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var MIN_CHARS = 20;
  var KLAW_URL = 'https://klaw.hondi.net/verdict-generate.html';
  var STEP_LABEL = { step0: '사건 정리', stepA: '법리 분석', stepB: '판결문 작성', stepC: '검증' };
  var PH = {
    case:  '언제, 누구와, 어떤 일이 있었는지 순서대로 적어 주세요. 자세할수록 결과가 좋아집니다.',
    reply: '답변을 입력해 주세요',
    busy:  '판결문을 작성하는 중입니다…',
  };

  function errText(e) {
    if (!e) return '알 수 없는 오류가 발생했습니다.';
    if (e.code === 'ANALYSIS_EMPTY' || e.code === 'METHOD_NOT_LOADED' || e.code === 'CASE_TOO_SHORT') return e.message;
    if (/API_KEY_REQUIRED|AUTH_REQUIRED/.test(e.message || '')) return '로그인이 필요합니다.';
    return e.message || '알 수 없는 오류가 발생했습니다.';
  }

  /* ───────── 흐름 (화면은 cfg.ui 에 위임) ─────────
     cfg.getEngine() → KLawEngine 인스턴스(없으면 throw)    cfg.ui → 아래 domUi() 와 같은 메서드를 가진 객체 */
  function create(cfg) {
    var ui = cfg.ui;
    var phase = 'idle';          // idle | analyzing | asking | generating | done
    var epoch = 0;               // 모드를 나갔다 들어오면 올라간다 — 지나간 비동기 작업이 새 화면을 건드리지 못하게 한다
    var engine = null, offs = [], active = false;

    function getEngine() { if (!engine) engine = cfg.getEngine(); return engine; }
    function setPhase(p) { phase = p; if (cfg.onPhase) cfg.onPhase(p); }
    function unbind() { offs.splice(0).forEach(function (f) { try { f(); } catch (e) { /* noop */ } }); }

    function canSend(text) {
      var n = String(text || '').trim().length;
      if (phase === 'idle' || phase === 'done') return n >= MIN_CHARS;
      if (phase === 'asking') return n > 0;
      return false;
    }
    function syncSend() {
      var t = ui.readInput();
      ui.setSendEnabled(canSend(t));
      ui.setMeter(phase === 'idle' || phase === 'done' ? String(t.trim().length) : null, MIN_CHARS);
    }

    function enter() {
      active = true;
      epoch++; unbind(); setPhase('idle');
      ui.setLoginLabel(true);
      ui.unlock(PH.case);
      syncSend();
    }
    function exit() {
      if (!active) return;            // 이 모드에 들어온 적이 없으면(다른 모드 사이 전환) 건드릴 것이 없다
      active = false;
      epoch++; unbind();
      try { if (engine) { engine.abort(); engine.reset(); } } catch (e) { /* noop */ }
      setPhase('idle');
      ui.reset(); ui.setLoginLabel(false); ui.unlock(null); ui.setMeter(null, MIN_CHARS);
    }
    // 사건 개요처럼 길게 쓰는 입력 차례인가(Enter 는 줄바꿈, Ctrl/⌘+Enter 가 보내기). 추가질문 답변은 Enter 로 보낸다.
    function longForm() { return phase === 'idle' || phase === 'done'; }
    function hasWork() { return active && (phase === 'analyzing' || phase === 'asking' || phase === 'generating'); }

    async function submit() {
      var text = ui.readInput().trim();
      if (!canSend(text)) {
        if (phase === 'idle' || phase === 'done') ui.toast('사건 개요를 ' + MIN_CHARS + '자 이상 입력해 주세요.');
        return;
      }
      ui.clearInput();
      if (phase === 'asking') return answer(text);
      return startCase(text);
    }

    async function startCase(text) {
      var my = epoch, alive = function () { return my === epoch; };
      var eng;
      try { eng = getEngine(); } catch (e) { ui.error('판결 시뮬레이션 엔진을 불러오지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.'); return; }
      setPhase('analyzing'); ui.lock(PH.busy); ui.addUser(text);
      var st = ui.status('사건을 정리하는 중입니다');
      var off = eng.on('analyze:chunk', function (e) { if (alive()) st.tail(e.text); });
      offs.push(off);
      try {
        // 방법론 원문을 못 받으면 분석 비용이 나가기 전에 멈춘다
        var m = await eng.loadMethod();
        if (!alive()) return;
        if (!m.ok) { var me = new Error('방법론 원문을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); me.code = 'METHOD_NOT_LOADED'; throw me; }
        var a = await eng.analyze(text);
        if (!alive()) return;
        st.remove(); ui.brief(a.caseData);
        if (a.needsMoreInfo) ask(a.question); else await generate(false);
      } catch (e) {
        if (!alive()) return;
        st.remove(); setPhase('idle'); ui.unlock(PH.case); ui.setInput(text); syncSend();
        ui.error(errText(e), function () { ui.clearInput(); syncSend(); startCase(text); });
      } finally { off(); }
    }

    function ask(question) {
      var my = epoch;
      setPhase('asking');
      ui.ask(question, function () { if (my !== epoch) return; getEngine().skipQuestions(); ui.removeQuestions(); generate(false); });
      ui.unlock(PH.reply); syncSend();
    }

    async function answer(text) {
      var my = epoch, alive = function () { return my === epoch; };
      var eng = getEngine();
      ui.removeQuestionButtons(); ui.addUser(text); setPhase('analyzing'); ui.lock(PH.busy);
      var st = ui.status('답변을 확인하는 중입니다');
      try {
        var r = await eng.reply(text);
        if (!alive()) return;
        st.remove();
        if (r.ready) await generate(false); else ask(r.question);
      } catch (e) {
        if (!alive()) return;
        st.remove(); setPhase('asking'); ui.unlock(PH.reply); ui.setInput(text); syncSend(); ui.error(errText(e));
      }
    }

    async function generate(resume) {
      var my = epoch, alive = function () { return my === epoch; };
      var eng = getEngine();
      setPhase('generating'); ui.lock(PH.busy); unbind();
      ui.progressBegin(eng.steps, STEP_LABEL, !!resume);
      offs.push(
        eng.on('step:start', function (e) { if (alive()) ui.stepActive(e.id); }),
        eng.on('step:chunk', function (e) { if (alive()) ui.stepText(e.id, e.text); }),
        eng.on('step:done',  function (e) { if (alive()) ui.stepDone(e.id, e.text); }),
        eng.on('step:error', function (e) {
          if (!alive()) return;
          ui.stepError(e.id, e.message, function () { if (alive()) generate(true); });
        }),
        eng.on('warning', function (e) { if (alive()) ui.toast(e.message); })
      );
      try {
        var r = await eng.runVerdict({ resume: !!resume });
        if (!alive()) return;
        ui.progressEnd(!!r.ok);
        if (r.ok) { setPhase('done'); ui.result(r, KLAW_URL); ui.unlock(PH.case); syncSend(); }
        // r.ok === false 는 step:error 이벤트가 이미 화면에 이어하기 버튼을 달았다 — 입력창은 계속 잠가 둔다
      } catch (e) {
        if (!alive()) return;
        ui.progressEnd(false); setPhase('idle'); ui.unlock(PH.case); syncSend();
        ui.error(errText(e), function () { if (alive()) generate(!!resume); });
      } finally { unbind(); }
    }

    return {
      enter: enter, exit: exit, submit: submit, hasWork: hasWork, longForm: longForm, canSend: canSend, syncSend: syncSend,
      get phase() { return phase; },
    };
  }

  /* ───────── 실제 화면 (desktop.html 의 #tab-compose 마크업 위에 그린다) ───────── */
  function domUi(doc, hooks) {
    hooks = hooks || {};
    var $ = function (id) { return doc.getElementById(id); };
    var timer = null, startedAt = 0, steps = {}, runBox = null;
    var loginLabelOrig = null;

    function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function kids(parent) { Array.prototype.slice.call(arguments, 1).forEach(function (c) { if (c != null) parent.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); }); return parent; }
    function started() {
      $('cmp-landing').style.display = 'none';
      $('tab-compose').classList.add('cmp-started');
      $('cmp-thread-header').style.display = 'flex';
    }
    function put(node) { started(); $('cmp-thread').appendChild(node); if (hooks.scroll) hooks.scroll(); return node; }
    function resize() { if (hooks.autoResize) hooks.autoResize($('cmp-input')); }
    function fmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    var ui = {
      readInput: function () { return $('cmp-input').value || ''; },
      clearInput: function () { $('cmp-input').value = ''; resize(); },
      setInput: function (t) { $('cmp-input').value = t; resize(); },
      setSendEnabled: function (on) { $('cmp-send-btn').disabled = !on; },
      lock: function (ph) { var i = $('cmp-input'); i.disabled = true; if (ph) i.placeholder = ph; $('cmp-send-btn').disabled = true; },
      unlock: function (ph) { var i = $('cmp-input'); i.disabled = false; if (ph) { delete i.dataset.ph; i.placeholder = ph; } },
      // 모드 안에서는 로그인 안내 문구가 '메일 대화' 가 아니라 이 기능 이름으로 나온다(user-badge.js 가 이 속성을 읽는다)
      setLoginLabel: function (on) {
        var nodes = [$('cmp-input'), $('cmp-send-btn')];
        if (loginLabelOrig === null) loginLabelOrig = nodes[0].getAttribute('data-requires-login');
        nodes.forEach(function (n) { if (on) n.setAttribute('data-requires-login', '판결 시뮬레이션'); else if (loginLabelOrig) n.setAttribute('data-requires-login', loginLabelOrig); });
      },
      setMeter: function (count, min) {
        var m = $('cmp-verdict-meter'); if (!m) return;
        if (count == null) { m.textContent = ''; return; }
        var n = Number(count);
        m.textContent = n < min ? n + '자 입력됨, ' + min + '자 이상 필요합니다' : n + '자 입력됨';
      },
      toast: function (msg) { if (hooks.toast) hooks.toast(msg); else { var e = $('cmp-err'); e.textContent = msg; e.style.display = ''; } },

      reset: function () { clearInterval(timer); steps = {}; runBox = null; $('cmp-thread').innerHTML = ''; var e = $('cmp-err'); if (e) e.style.display = 'none'; },
      addUser: function (text) {
        var row = el('div', 'chat-bubble-row user'); row.appendChild(el('div', 'chat-bubble', text)); put(row);
      },
      status: function (text) {
        var label = el('span', null, text), tail = el('div', 'vd-tail');
        var box = el('div', 'vd-block'); kids(box, kids(el('div', 'vd-status'), el('span', 'vd-dot'), label), tail);
        put(box);
        return {
          tail: function (t) { tail.textContent = String(t || '').replace(/\s+/g, ' ').slice(-90); },
          remove: function () { if (box.parentNode) box.parentNode.removeChild(box); },
        };
      },
      brief: function (d) {
        var dl = el('dl', 'vd-brief');
        [['사건명', d.caseName || '이름 없는 사건', 'name'], ['분류', [d.type, d.level].filter(Boolean).join(' / '), ''], ['쟁점', d.dispute || '정리 중', '']].forEach(function (r) {
          dl.appendChild(el('dt', null, r[0])); dl.appendChild(el('dd', r[2], r[1]));
        });
        put(kids(el('div', 'vd-block'), dl));
      },
      ask: function (question, onSkip) {
        var skip = el('button', 'vd-ghost', '추가 정보 없이 진행'); skip.type = 'button'; skip.onclick = onSkip;
        var q = kids(el('div', 'vd-q'), el('small', null, '판결문을 쓰기 전에 하나만 더 물어볼게요'), question, kids(el('div'), skip));
        put(q);
      },
      removeQuestionButtons: function () { Array.prototype.forEach.call(doc.querySelectorAll('#cmp-thread .vd-q .vd-ghost'), function (b) { b.parentNode.removeChild(b); }); },
      removeQuestions: function () { Array.prototype.forEach.call(doc.querySelectorAll('#cmp-thread .vd-q'), function (b) { b.parentNode.removeChild(b); }); },

      progressBegin: function (stepList, labels, resume) {
        if (resume && runBox) {
          clearInterval(timer);
        } else {
          steps = {};
          var list = el('ol', 'vd-steps');
          stepList.forEach(function (s, i) {
            var mark = el('span', 'vd-mark', String(i + 1)), body = el('div');
            var li = kids(el('li', 'vd-step'), mark, kids(el('div'), kids(el('div', 'vd-step-h'), el('span', 'vd-step-name', labels[s.id] || s.tag), el('span', 'vd-step-id', s.tag)), body));
            li.setAttribute('data-s', 'wait'); steps[s.id] = { li: li, mark: mark, body: body, index: i }; list.appendChild(li);
          });
          var elapsed = el('span', 'vd-elapsed', '경과 0:00');
          runBox = kids(el('section', 'vd-block vd-run'), kids(el('div', 'vd-run-h'), el('strong', null, '판결문을 작성하는 중입니다'), elapsed),
            el('p', 'vd-note', '단계마다 AI가 직접 작성하므로 시간이 걸립니다. 이 화면을 닫지 마세요.'), list);
          runBox._elapsed = elapsed; runBox._title = runBox.querySelector('strong');
          startedAt = Date.now(); put(runBox);
        }
        timer = setInterval(function () { runBox._elapsed.textContent = '경과 ' + fmt(Math.floor((Date.now() - startedAt) / 1000)); }, 1000);
      },
      progressEnd: function (ok) { clearInterval(timer); if (ok && runBox) runBox._title.textContent = '판결문 작성을 마쳤습니다'; },
      stepActive: function (id) {
        var s = steps[id]; if (!s) return;
        s.li.setAttribute('data-s', 'active'); s.body.innerHTML = '';
        s.live = el('div', 'vd-live', '작성을 시작합니다…'); s.body.appendChild(s.live);
        if (hooks.scroll) hooks.scroll();
      },
      stepText: function (id, text) { var s = steps[id]; if (s && s.live) { s.live.textContent = text; s.live.scrollTop = s.live.scrollHeight; } },
      stepDone: function (id, text) {
        var s = steps[id]; if (!s) return;
        s.li.setAttribute('data-s', 'done'); s.mark.textContent = '✓'; s.body.innerHTML = '';
        var d = el('details'); d.appendChild(el('summary', null, '작성 내용 보기')); d.appendChild(el('pre', null, text)); s.body.appendChild(d);
      },
      stepError: function (id, message, onRetry) {
        var s = steps[id]; if (!s) return;
        s.li.setAttribute('data-s', 'error'); s.mark.textContent = '!'; s.body.innerHTML = '';
        var retry = el('button', 'vd-ghost', '이 단계부터 다시 시도'); retry.type = 'button';
        retry.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); onRetry(); };
        var box = kids(el('div', 'vd-alert'), (STEP_LABEL[id] || id) + ' 단계에서 멈췄습니다. ' + message, kids(el('div'), retry),
          el('div', 'vd-note', '앞서 끝난 단계는 다시 작성하지 않으므로 비용이 더 들지 않습니다.'));
        s.body.appendChild(box); clearInterval(timer);
      },
      error: function (msg, onRetry) {
        var box = el('div', 'vd-alert'); box.setAttribute('role', 'alert'); box.appendChild(doc.createTextNode(msg));
        if (onRetry) { var b = el('button', 'vd-ghost', '다시 시도'); b.type = 'button'; b.onclick = function () { if (box.parentNode) box.parentNode.removeChild(box); onRetry(); }; kids(box, kids(el('div'), b)); }
        put(box);
      },
      result: function (r, klawUrl) {
        var m = r.meta || {}, num = function (v) { return v == null ? '—' : v + '/10'; };
        var conf = el('dl', 'vd-conf');
        [['법리 확신도', num(m.lawConfidence)], ['사실 확신도', num(m.factConfidence)], ['종합 확신도', num(m.totalConfidence)], ['사건 복잡도', num(m.complexity)], ['결론 유형', m.conclusionType || '—']].forEach(function (c, i) {
          kids(conf, kids(el('div'), el('dt', null, c[0]), el('dd', i === 4 ? 'txt' : '', c[1])));
        });
        var copy = el('button', 'vd-btn', '전문 복사'); copy.type = 'button';
        copy.onclick = function () {
          try { root.navigator.clipboard.writeText(r.text).then(function () { ui.toast('판결문 전문을 복사했습니다.'); }, function () { ui.toast('복사하지 못했습니다. 전문 보기에서 직접 선택해 주세요.'); }); }
          catch (e) { ui.toast('복사할 수 없는 환경입니다. 전문 보기에서 직접 선택해 주세요.'); }
        };
        var more = el('a', 'vd-btn', 'K-Law에서 자세히 보기'); more.href = klawUrl; more.target = '_blank'; more.rel = 'noopener';
        var full = el('details', 'vd-full'); full.appendChild(el('summary', null, '판결문 전문 보기')); full.appendChild(el('pre', null, r.text));
        var meta = kids(el('p', 'vd-meta'), el('span', null, '사건번호 ' + r.caseNo), el('span', null, 'K-Law ' + (r.version || '')));
        var card = kids(el('article', 'vd-result'),
          kids(el('header'), el('h2', null, '참고용 가상 판결문'), meta),
          el('p', 'vd-sum', m.summary || '요약을 만들지 못했습니다. 전문을 확인해 주세요.'), conf, full,
          kids(el('div', 'vd-acts'), copy, more),
          el('div', 'vd-caution', '본 판결문은 K-Law AI 시뮬레이션 결과입니다(적용 방법론 ' + (r.version || '') + '). 법률 정보 제공 목적이며 법률 자문이 아닙니다. 실제 소송에서는 반드시 자격 있는 법률 전문가와 상담하십시오.'));
        put(card);
      },
    };
    return ui;
  }

  /* ───────── desktop.html 연결 ─────────
     desktop.html 의 _cmpSetMode / _cmpChatSend / _cmpHasWork / _cmpChatUpdateSendState 가 이 객체만 부른다. */
  var instance = null;
  function mount(doc) {
    if (instance) return instance;
    doc = doc || root.document;
    var ui = domUi(doc, {
      scroll: function () { if (typeof root._cmpScrollToBottom === 'function') root._cmpScrollToBottom(); },
      autoResize: function (el) { if (typeof root._kmailAutoResize === 'function') root._kmailAutoResize(el); },
    });
    instance = create({
      ui: ui,
      getEngine: function () {
        if (!root.KLawEngine) throw new Error('KLawEngine 없음');
        return root.KLawEngine.create({
          auth: { ensureLogin: function () { return root.KAuth.ensureLogin(); }, getToken: function () { return root.KAuth.getToken(); },
                  hasValidLogin: function () { return root.KAuth.hasValidLogin(); }, logout: function () { return root.KAuth.logout(); } },
        });
      },
    });
    return instance;
  }

  root.VerdictHost = {
    create: create, domUi: domUi, mount: mount, MIN_CHARS: MIN_CHARS, KLAW_URL: KLAW_URL, STEP_LABEL: STEP_LABEL, PH: PH,
    // desktop.html 에서 쓰는 얇은 진입점 — 아직 mount 전이면 안전하게 기본값을 돌려준다
    onMode: function (on) { if (!on && !instance) return; var v = mount(); if (on) v.enter(); else v.exit(); },
    hasWork: function () { return !!instance && instance.hasWork(); },
    syncSend: function () { if (instance) instance.syncSend(); },
    canSend: function (t) { return !!instance && instance.canSend(t); },
    longForm: function () { return !!instance && instance.longForm(); },
    submit: function () { return mount().submit(); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
