/**
 * Salfea — общий скрипт страниц.
 *
 * Библиотеки (подключены до этого файла): GSAP, ScrollTrigger, SplitText,
 * Lenis, NumberFlow.
 * Каждая init-функция сама проверяет, есть ли её блок на странице, и молча
 * выходит, если нет — поэтому файл общий для главной, продукта и блога.
 *
 * Содержание:
 *   Плавный скролл        lenis + ScrollTrigger
 *   Общее для страниц     initGlobalParallax, initTitleRoll (перекат текста),
 *                         initNavDropdown, initMobileMenu (+ createBurger),
 *                         initMobileCallButton, initAnchorScroll,
 *                         initModals,
 *                         initFaq, initCallbackForm, initMetricCounters,
 *                         initFooterParallax (футер выезжает медленнее)
 *   Блоки главной         initLogoRoll (буквы лого в первом экране),
 *                         initMarqueeScrollDirection (лого-ролл и лента SKU),
 *                         initStickyFeatures (вертикальный слайдер,
 *                         только от 992 — ниже блок идёт обычной колонкой),
 *                         initPlantSlider (слайдер производства)
 *   Блог                  initBlogFilter (рубрики и «Показать ещё»),
 *                         initPostToc (оглавление статьи),
 *                         initPostShare (ссылки «поделиться»)
 *   Запуск                внизу файла
 *
 * Хелперы без префикса init (initCounters, initMarqueeDrag,
 * initStickyFeaturesBlock) вызываются из функций выше и отдельно не нужны.
 *
 * Конфигуратор товара живёт отдельно — js/configurator.js.
 */

gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// Плавный скролл
// ============================================================================

// Lenis крутит страницу, ScrollTrigger пересчитывается на каждый его кадр
const lenis = new Lenis();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);


// 1rem = 1px макета (html { font-size: calc(100vw / 1440) }), поэтому размер
// шрифта корня — это и есть текущий масштаб вёрстки. Нужен везде, где из JS
// задаются величины в пикселях: отступы якорей, шаг слайдера, пороги.
const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 1;


// ============================================================================
// Общее для всех страниц
// ============================================================================

// Global Parallax (osmo): элементы с data-parallax="trigger"
function initGlobalParallax() {
  const mm = gsap.matchMedia();
  mm.add(
    {
      isMobile: '(max-width:479px)',
      isMobileLandscape: '(max-width:767px)',
      isTablet: '(max-width:991px)',
      isDesktop: '(min-width:992px)'
    },
    (context) => {
      const { isMobile, isMobileLandscape, isTablet, isDesktop } = context.conditions;

      const ctx = gsap.context(() => {
        document.querySelectorAll('[data-parallax="trigger"]').forEach((trigger) => {
          const disable = trigger.getAttribute('data-parallax-disable');
          if (
            (disable === 'mobile' && isMobile) ||
            (disable === 'mobileLandscape' && isMobileLandscape) ||
            (disable === 'tablet' && isTablet) ||
            // «только на мобильном»: на десктопе у блока свой параллакс
            (disable === 'desktop' && isDesktop)
          ) {
            return;
          }

          const target = trigger.querySelector('[data-parallax="target"]') || trigger;
          const direction = trigger.getAttribute('data-parallax-direction') || 'vertical';
          const prop = direction === 'horizontal' ? 'xPercent' : 'yPercent';
          const scrubAttr = trigger.getAttribute('data-parallax-scrub');
          const scrub = scrubAttr ? parseFloat(scrubAttr) : true;
          const startAttr = trigger.getAttribute('data-parallax-start');
          const startVal = startAttr !== null ? parseFloat(startAttr) : 20;
          const endAttr = trigger.getAttribute('data-parallax-end');
          const endVal = endAttr !== null ? parseFloat(endAttr) : -20;
          const scrollStartRaw = trigger.getAttribute('data-parallax-scroll-start') || 'top bottom';
          const scrollStart = `clamp(${scrollStartRaw})`;
          const scrollEndRaw = trigger.getAttribute('data-parallax-scroll-end') || 'bottom top';
          const scrollEnd = `clamp(${scrollEndRaw})`;

          gsap.fromTo(
            target,
            { [prop]: startVal },
            {
              [prop]: endVal,
              ease: 'none',
              scrollTrigger: {
                trigger,
                start: scrollStart,
                end: scrollEnd,
                scrub
              }
            }
          );
        });
      });

      return () => ctx.revert();
    }
  );
}


// Перекат текста в кадре (приём с madewithgsap.com).
// SplitText режет надпись, каждую строку заворачивает в маску (mask: 'lines'),
// а мы кладём под кромку маски копию — строки или каждой буквы. Когда надпись
// входит в кадр, оригинал уезжает вверх и на его место встаёт копия.
// Заголовки катятся словами в кадре, цифры первого экрана — побуквенно
// вразнобой. Заголовок и описание первого экрана не анимируются: там катается
// только логотип (initLogoRoll). Стили разметки — scss/blocks/_title-roll.scss.
const TITLE_ROLL =
  '.sec-title, .blog-head__title, .post-title';
const CHAR_ROLL = '.hero-stats__value';

// Тайминг и изинг одни на все текстовые перекаты, чтобы текст на сайте
// двигался одинаково (значения авторские)
const ROLL_TIME = 1;
const ROLL_EASE = 'expo.inOut';

function initTitleRoll() {
  const wordTargets = document.querySelectorAll(TITLE_ROLL);
  const charTargets = document.querySelectorAll(CHAR_ROLL);
  const total = wordTargets.length + charTargets.length;
  if (!total || typeof SplitText === 'undefined') return;

  gsap.registerPlugin(SplitText);

  // до готовности шрифтов резать нельзя — строки лягут по запасному шрифту
  document.fonts.ready.then(() => {
    wordTargets.forEach((el) => createRoll(el, 'words'));
    charTargets.forEach((el) => createRoll(el, 'chars'));
  });
}

// Общее для всех режимов: под кромку маски кладём копию каждой части
// и считаем путь переката в процентах — тогда он не зависит от ширины окна
function prepareRoll(parts) {
  parts.forEach((part) => {
    const copy = document.createElement('span');
    copy.className = 'roll-copy';
    copy.setAttribute('aria-hidden', 'true');
    copy.innerHTML = part.innerHTML;
    part.appendChild(copy);
  });

  const first = parts[0];
  return (-100 * first.querySelector('.roll-copy').offsetTop) / first.offsetHeight;
}


// mode — что именно катится:
//   'words' — заголовки: слова вразнобой внутри своей строки, строки со сдвигом
//   'chars' — короткие надписи вроде цифр первого экрана: буквы вразнобой
//   'lines' — описание первого экрана: строки целиком и разом
function createRoll(el, mode) {
  el.classList.add('title-roll');

  // Связка reduceWhiteSpace: false + выравнивание по центру собирает строки
  // неверно: сохранённые пробелы на концах строк сбивают замер, и два
  // визуальных ряда попадают в одну «строку» SplitText. Маска тогда выше
  // строки ровно вдвое, и копия переката видна прямо под оригиналом.
  // На время замера выравнивание снимаем, после сборки возвращаем: строки
  // получаются блоками, и центрирование к ним применяется уже готовым.
  const centred = /center|right/.test(getComputedStyle(el).textAlign);
  const unalign = () => { if (centred) el.style.textAlign = 'left'; };
  const realign = (self) => {
    if (!centred) return;
    el.style.textAlign = '';
    // Выравнивание, которое было на заголовке в момент замера, SplitText
    // переносит на сами строки — снимаем и там, иначе строки остаются
    // прижатыми влево, хотя у заголовка снова стоит center
    self.lines.forEach((line) => {
      line.style.textAlign = '';
      if (line.parentElement !== el) line.parentElement.style.textAlign = '';
    });
  };
  unalign();

  SplitText.create(el, {
    type: mode === 'chars' ? 'lines,words,chars' : 'lines,words',
    // имена односложные не случайно: обёртку-маску SplitText называет сам,
    // дописывая «-mask» к каждому слову класса (line → line-mask)
    linesClass: 'line',
    wordsClass: 'word',
    charsClass: 'char',
    mask: 'lines',
    // SplitText по умолчанию схлопывает любые пробелы в обычный и рвёт текст
    // по ним — неразрывные пробелы в вёрстке тогда перестают держать предлоги.
    // С reduceWhiteSpace: false «в&nbsp;рулоне» остаётся одним словом и на
    // другую строку предлог не уезжает.
    reduceWhiteSpace: false,
    autoSplit: true, // при смене ширины окна строки пересобираются
    onRevert: unalign, // пересборка после ресайза — снова замеряем без выравнивания
    onSplit(self) {
      realign(self);
      const parts = self[mode]; // chars / words / lines — имена от SplitText
      if (!parts.length) return undefined;

      const roll = { yPercent: prepareRoll(parts), duration: ROLL_TIME, ease: ROLL_EASE };
      const scrollTrigger = { trigger: el, start: 'top 80%' };

      // возврат анимации отдаём SplitText: он сам убьёт её при пересборке
      if (mode !== 'words') {
        return gsap.to(parts, {
          ...roll,
          // описание первого экрана трогается на секунду позже заголовка
          delay: mode === 'lines' ? 0.5 : 0.3,
          // буквы идут вразнобой, строки — разом
          stagger: mode === 'chars' ? { each: 0.034, from: 'random' } : 0,
          scrollTrigger
        });
      }

      // Заголовки: буквы вразнобой по всему заголовку слишком рябят, а строки
      // целиком — слишком ровно. Середина: катятся слова, случайный порядок
      // ограничен своей строкой, строки трогаются с шагом 0.12.
      const tl = gsap.timeline({ delay: 0.3, scrollTrigger });

      self.lines.forEach((line, i) => {
        tl.to(line.querySelectorAll('.word'), {
          ...roll,
          stagger: { each: 0.05, from: 'random' }
        }, i * 0.12);
      });

      return tl;
    }
  });
}


// Мобильное меню: бургер раскрывает панель во весь экран.
// Пока она открыта — страница под ней не скроллится (глушим Lenis), строки
// выезжают по очереди тем же изингом, что и остальные перекаты на сайте.
// Закрывается крестом, Esc, клику по ссылке и переходу на десктопную ширину.
// Кнопка-бургер: анимация из снипета osmo Burger Menu Button, значения и
// порядок шагов авторские. Открытие: средняя полоса схлопывается, крайние
// разъезжаются в стороны и гаснут, затем мгновенно переставляются уже
// повёрнутыми — и возвращаются в кадр готовым крестом. Закрытие — одним
// движением обратно. Смещения заданы в em и считаются от кегля кнопки
// (см. .burger в _mob-menu.scss).
function createBurger(button) {
  const lines = Array.from(button.querySelectorAll('.burger__line'));
  if (lines.length < 3) return null;
  const [line1, line2, line3] = lines;

  // CustomEase подключён не на всех страницах (на блоге его нет) — там
  // берём ближайший встроенный
  if (window.CustomEase && !CustomEase.get('button-ease')) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('button-ease', '0.5, 0.05, 0.05, 0.99');
  }
  const ease = window.CustomEase ? 'button-ease' : 'power3.inOut';

  const tl = gsap.timeline({ defaults: { overwrite: 'auto', ease, duration: 0.3 } });

  return {
    open() {
      tl.clear()
        .to(line2, { scaleX: 0, opacity: 0 })                       // средняя схлопывается
        .to(line1, { x: '-1.3em', opacity: 0 }, '<')                // верхняя уезжает влево
        .to(line3, { x: '1.3em', opacity: 0 }, '<')                 // нижняя — вправо
        .to([line1, line3], { opacity: 0, duration: 0.1 }, '<+=0.2')
        .set(line1, { rotate: -135, y: '-1.3em', scaleX: 0.9 })     // переставляем повёрнутыми
        .set(line3, { rotate: 135, y: '-1.4em', scaleX: 0.9 }, '<')
        .to(line1, { opacity: 1, x: '0em', y: '0.5em' })            // и возвращаем крестом
        .to(line3, { opacity: 1, x: '0em', y: '-0.25em' }, '<+=0.1');
    },
    close() {
      tl.clear().to(lines, {
        scaleX: 1, rotate: 0, x: '0em', y: '0em', opacity: 1,
        duration: 0.45, overwrite: 'auto'
      });
    }
  };
}


function initMobileMenu() {
  const header = document.querySelector('.header');
  const toggle = document.querySelector('[data-mob-toggle]');
  const menu = document.querySelector('[data-mob-menu]');
  if (!header || !toggle || !menu) return;

  const burger = createBurger(toggle);
  const rows = Array.from(menu.querySelectorAll('[data-mob-link]'));
  let open = false;

  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    header.classList.toggle('is--menu', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    if (burger) (open ? burger.open : burger.close)();

    if (open) {
      lenis.stop();
      // как содержимое попапа: блоки догоняют край шторки, кривая мягкая
      gsap.fromTo(rows,
        { yPercent: 25, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.9, ease: 'power2.out', stagger: 0.07, delay: 0.18 });
    } else {
      lenis.start();
      gsap.killTweensOf(rows);
      gsap.set(rows, { clearProps: 'all' });
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  rows.forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });
  // вернулись на десктопную ширину — панели там нет, состояние надо сбросить
  window.matchMedia('(min-width: 992px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}


// Кнопка-телефон в шапке: на десктопе открывает окно «Контакты», на телефоне —
// сразу форму заявки. Контакты на мобильном и так лежат в меню целиком,
// поэтому второе окно с ними дублирует меню, а форма — следующий шаг.
// Цель читается в момент клика (initModals берёт её из атрибута), поэтому
// достаточно переписать атрибут при смене ширины.
function initMobileCallButton() {
  const btn = document.querySelector('.header-contact[data-modal-open]');
  if (!btn) return;

  const wide = window.matchMedia('(min-width: 992px)');
  const desktopTarget = btn.getAttribute('data-modal-open');

  const apply = () => {
    btn.setAttribute('data-modal-open', wide.matches ? desktopTarget : '#modal-callback');
  };

  apply();
  wide.addEventListener('change', apply);
}


// Выпадающее меню «Продукты» в шапке (osmo Multilevel Navigation):
// открывается по наведению и по клику, закрывается уходом мыши, Esc,
// кликом мимо и наведением на соседний пункт. Пока открыто — шапка тёмная.
function initNavDropdown() {
  const header = document.querySelector('.header');
  const toggle = header && header.querySelector('[data-dropdown-toggle]');
  const panel = header && header.querySelector('[data-dropdown-panel]');
  if (!toggle || !panel) return;

  const links = Array.from(panel.querySelectorAll('a'));

  const setOpen = (open) => {
    toggle.dataset.dropdownToggle = open ? 'open' : 'closed';
    toggle.setAttribute('aria-expanded', String(open));
    panel.setAttribute('aria-hidden', String(!open));
    panel.classList.toggle('is--open', open);
    header.classList.toggle('is--open', open);
  };

  setOpen(false);
  toggle.setAttribute('aria-haspopup', 'true');

  toggle.addEventListener('mouseenter', () => setOpen(true));
  // панель лежит внутри .header, поэтому уход мыши из шапки закрывает и её
  header.addEventListener('mouseleave', () => setOpen(false));

  // наведение на любой другой пункт меню закрывает панель
  header.querySelectorAll('.header-nav a, .header-actions a').forEach((el) => {
    el.addEventListener('mouseenter', () => setOpen(false));
  });

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    const open = toggle.dataset.dropdownToggle !== 'open';
    setOpen(open);
    if (open && links[0]) links[0].focus();
  });

  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !panel.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || toggle.dataset.dropdownToggle !== 'open') return;
    setOpen(false);
    toggle.focus();
  });

  // стрелками вверх/вниз ходим по карточкам
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = links.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? i + 1 : i - 1 + links.length;
    links[next % links.length].focus();
  });
}

// Плавный скролл к якорям через Lenis.
// data-anchor-offset сдвигает точку остановки — заголовкам в статье нужен
// запас, иначе якорь встаёт ровно под шапку и уезжает за неё.
function initAnchorScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      // значение пишем в единицах макета (1 = 1px на 1440), умножение на rem()
      // тянет запас вместе с вёрсткой
      lenis.scrollTo(target, { offset: Number(link.dataset.anchorOffset || 0) * rem() });
    });
  });
}


// Модалки: [data-modal-open="#id"] открывает, [data-modal-close] и Esc закрывают
function initModals() {
  let current = null;

  const open = (selector) => {
    const modal = document.querySelector(selector);
    if (!modal) return;
    current = modal;
    modal.classList.add('is--open');
    lenis.stop();
  };

  // Закрытие — шторка уезжает в обратную сторону: на время анимации вешаем
  // is--closing, окно остаётся видимым, и только потом снимаем оба класса
  const close = () => {
    if (!current) return;
    const modal = current;
    current = null;
    lenis.start();
    // is--open снимаем сразу — именно он держит окно раскрытым; is--closing
    // оставляем на время анимации, он не даёт окну пропасть раньше времени
    modal.classList.add('is--closing');
    modal.classList.remove('is--open');
    setTimeout(() => modal.classList.remove('is--closing'), 800);
  };

  document.querySelectorAll('[data-modal-open]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      open(btn.getAttribute('data-modal-open'));
    });
  });

  document.querySelectorAll('.modal [data-modal-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}


// FAQ-аккордеон: открытым может быть один вопрос, анимация через max-height
function initFaq() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const head = item.querySelector('.faq-item__head');
    const body = item.querySelector('.faq-item__body');
    if (!head || !body) return;

    head.addEventListener('click', () => {
      const isOpen = item.classList.contains('is--open');

      // закрываем соседей
      item.parentElement.querySelectorAll('.faq-item.is--open').forEach((other) => {
        other.classList.remove('is--open');
        other.querySelector('.faq-item__body').style.maxHeight = '';
        other.querySelector('.faq-item__head').setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is--open');
        body.style.maxHeight = body.scrollHeight + 'px';
        head.setAttribute('aria-expanded', 'true');
      }
    });
  });
}


// Формы обратной связи (в секции и в попапе): валидация и состояния.
// Бэкенда пока нет — данные никуда не отправляются.
function initCallbackForm() {
  const validators = {
    name: (v) => v.trim().length > 1,
    email: (v) => /^\S+@\S+\.\S+$/.test(v.trim()),
    phone: (v) => (v.match(/\d/g) || []).length >= 9
  };

  const getFieldWrap = (input) => input.closest('.form-field, .form-check');

  document.querySelectorAll('form[data-callback]').forEach((form) => {
    const status = form.querySelector('.callback-form__status');

    function validateInput(input) {
      const wrap = getFieldWrap(input);
      let valid = true;
      if (input.required) {
        valid = input.type === 'checkbox'
          ? input.checked
          : (validators[input.name] ? validators[input.name](input.value) : input.value.trim() !== '');
      }
      wrap.classList.toggle('is--error', !valid);
      return valid;
    }

    const inputs = form.querySelectorAll('input, textarea');

    inputs.forEach((input) => {
      const clear = () => getFieldWrap(input).classList.remove('is--error');
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
      if (input.type !== 'checkbox') {
        input.addEventListener('blur', () => {
          if (input.value.trim() !== '') validateInput(input);
        });
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let firstInvalid = null;
      inputs.forEach((input) => {
        if (!validateInput(input) && !firstInvalid) firstInvalid = input;
      });

      if (firstInvalid) {
        status.classList.remove('is--visible');
        firstInvalid.focus();
        return;
      }

      // Здесь будет отправка на бэкенд
      form.reset();
      status.textContent = 'Заявка отправлена! Менеджер свяжется с вами в течение рабочего дня.';
      status.classList.add('is--visible');
    });
  });
}


// Лента, которую можно тянуть мышкой (data-marquee-drag).
// Во время перетаскивания двигаем время самой бесконечной анимации — лента
// не рвётся и не теряет позицию. На отпускании даём разгон через timeScale,
// и он плавно гаснет до обычной скорости — это и есть инерция.
function initMarqueeDrag(marquee, animation, loopWidth) {
  const duration = animation.duration();
  let dragging = false;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0; // px/мс, нужна для броска
  let moved = 0;

  const shift = (dx) => {
    let time = animation.totalTime() - (dx / loopWidth) * duration;
    if (time < 0) time += Math.ceil(-time / duration) * duration; // не уходим в минус
    animation.totalTime(time);
  };

  marquee.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = 0;
    velocity = 0;
    lastX = e.clientX;
    lastTime = performance.now();
    animation.pause();
    marquee.setPointerCapture(e.pointerId);
    marquee.classList.add('is--dragging');
  });

  marquee.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    velocity = dx / (now - lastTime || 16);
    moved += Math.abs(dx);
    lastX = e.clientX;
    lastTime = now;
    shift(dx);
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    marquee.classList.remove('is--dragging');
    animation.play();

    // скорость броска в единицах timeScale + плавное возвращение к обычной
    const base = Math.sign(animation.timeScale()) || -1;
    const boost = gsap.utils.clamp(-40, 40, (-velocity * duration * 1000) / loopWidth);
    animation.timeScale(base + boost);
    gsap.to(animation, { timeScale: base, duration: 1.2, ease: 'power3.out', overwrite: true });
  };

  marquee.addEventListener('pointerup', release);
  marquee.addEventListener('pointercancel', release);

  // после протяжки карточку не открываем
  marquee.addEventListener('click', (e) => {
    if (moved > 8) e.preventDefault();
  }, true);

  // иначе картинки внутри ссылок перехватывают перетаскивание
  marquee.addEventListener('dragstart', (e) => e.preventDefault());
}


// Цифры рейтинга (NumberFlow): когда полоса входит в кадр, значения
// прокручиваются одометром от нуля к реальным. Модуль подключён в разметке,
// кастомный элемент может определиться позже — тогда настраиваем повторно.
// Полоса показателей одна на блоки «рейтинг» и «производство» (общий
// компонент .metrics), но запуск у каждой свой: блоки стоят в разных местах
// страницы и в кадр попадают в разное время.
function initMetricCounters() {
  document.querySelectorAll('.metrics').forEach(initCounters);
}

// Одна механика на все счётчики: значения стартуют с data-from (или нуля)
// и при входе полосы в кадр прокручиваются одометром к data-count
// group — одна полоса показателей: и цифры, и триггер берём внутри неё,
// иначе соседняя полоса на другом конце страницы заводится вместе с этой
function initCounters(group) {
  const flows = Array.from(group.querySelectorAll('[data-count]'));
  if (!flows.length) return;

  let fired = false;

  const setup = (el) => {
    const digits = Number(el.dataset.digits || 0);
    // Разрядность фиксируем по большему из старта и цели: иначе элемент
    // по мере набора разрядов расширяется и цифры едут сбоку.
    const intLen = (v) => String(Math.trunc(Math.abs(parseFloat(v) || 0))).length;
    const pad = Math.max(intLen(el.dataset.count), intLen(el.dataset.from));
    // дробные держим на en-US, иначе 4.9 показывается как 4,9
    el.locales = digits ? 'en-US' : 'ru-RU';
    el.format = {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      minimumIntegerDigits: pad,
      useGrouping: false // в макете число слитно: 5270, а не 5 270
    };
    el.transformTiming = { duration: 2200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    el.spinTiming = { duration: 2200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    el.opacityTiming = { duration: 400, easing: 'ease-out' };
    // Направление одно на всё число и совпадает со знаком изменения: растём —
    // крутим вверх, уменьшаемся — вниз (9 → 8 … → 1, а не 9 → 0 → 1).
    // При trend: 0 компонент выбирает направление для каждой цифры сам,
    // и разряды едут вразнобой.
    el.trend = parseFloat(el.dataset.count) >= Number(el.dataset.from || 0) ? 1 : -1;
    // стартовое значение: у «#1» крутим сверху, от 21 — иначе с нуля
    setValue(el, Number(el.dataset.from || 0));
  };

  const setValue = (el, value) => {
    if (typeof el.update === 'function') el.update(value);
    else el.textContent = String(value);
  };

  // карточки трогаются одна за другой, иначе всё проскакивает разом
  const run = () => {
    fired = true;
    flows.forEach((el, i) => {
      gsap.delayedCall(i * 0.18, () => setValue(el, parseFloat(el.dataset.count)));
    });
  };

  flows.forEach(setup);

  if (window.customElements && !customElements.get('number-flow')) {
    customElements.whenDefined('number-flow').then(() => {
      flows.forEach(setup);
      if (fired) run();
    });
  }

  ScrollTrigger.create({
    trigger: group,
    start: 'top 80%',
    once: true,
    onEnter: run
  });
}


// Логотип в ленте первого экрана: знак и буквы перекатываются после загрузки —
// уезжают вверх, и на их место встают такие же копии, лежащие под маской.
// Настройки как у референса (madewithgsap): порядок случайный, шаг 34 мс,
// expo.inOut. Все копии ленты анимируем одним твином, иначе каталось бы
// вразнобой. Заголовок и описание первого экрана не анимируются.
const LOGO_ROLL = { delay: 0.3, step: 0.034 };

function initLogoRoll() {
  const parts = document.querySelectorAll('.logo-letter');
  if (!parts.length) return;

  const start = () => {
    // Лента состоит из пяти одинаковых копий. Фильтровать по видимости
    // бесполезно: пока идёт перекат, лента едет и в кадр въезжают копии,
    // которые на старте были за краем. Поэтому катим все, но задержку берём
    // не от элемента, а от места фигуры внутри своего блока — знак и шесть
    // букв. Копии одной буквы едут синхронно, разбежка короткая (7 шагов).
    const slots = 7;
    const order = gsap.utils.shuffle(Array.from({ length: slots }, (v, i) => i));
    const slotOf = (el) => {
      const item = el.closest('.marquee-item');
      return item ? Array.from(item.querySelectorAll('.logo-letter')).indexOf(el) : 0;
    };

    gsap.to(parts, {
      // высота одной копии лежит в data-roll — у группы их две, bbox не годится
      y: (i, el) => -Number(el.dataset.roll),
      duration: ROLL_TIME,
      ease: ROLL_EASE,
      delay: LOGO_ROLL.delay,
      stagger: (i, el) => order[slotOf(el) % slots] * LOGO_ROLL.step
    });
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}


// Footer Parallax Effect (osmo): футер выезжает медленнее
// страницы и на подходе притемнён. Ход — от «верх обёртки коснулся низа экрана»
// до «верх обёртки у верха экрана»; clamp держит точки внутри страницы, поэтому
// на самом низу анимация всегда доходит до конца.
function initFooterParallax() {
  document.querySelectorAll('[data-footer-parallax]').forEach((el) => {
    const inner = el.querySelector('[data-footer-parallax-inner]');
    const dark = el.querySelector('[data-footer-parallax-dark]');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'clamp(top bottom)',
        end: 'clamp(top top)',
        scrub: true
      }
    });

    if (inner) tl.from(inner, { yPercent: -25, ease: 'linear' });
    if (dark) tl.from(dark, { opacity: 0.5, ease: 'linear' }, '<');
  });
}


// ============================================================================
// Блоки главной и страницы продукта
// ============================================================================

// Marquee with Scroll Direction (osmo): бесконечная строка,
// направление и скорость меняются от направления скролла
function initMarqueeScrollDirection() {
  document.querySelectorAll('[data-marquee-scroll-direction-target]').forEach((marquee) => {
    const marqueeContent = marquee.querySelector('[data-marquee-collection-target]');
    const marqueeScroll = marquee.querySelector('[data-marquee-scroll-target]');
    if (!marqueeContent || !marqueeScroll) return;

    const { marqueeSpeed: speed, marqueeDirection: direction, marqueeDuplicate: duplicate, marqueeScrollSpeed: scrollSpeed } = marquee.dataset;

    const marqueeSpeedAttr = parseFloat(speed);
    const marqueeDirectionAttr = direction === 'right' ? 1 : -1;
    const duplicateAmount = parseInt(duplicate || 0);
    const scrollSpeedAttr = parseFloat(scrollSpeed);
    const speedMultiplier = window.innerWidth < 479 ? 0.25 : window.innerWidth < 991 ? 0.5 : 1;

    let marqueeSpeed = marqueeSpeedAttr * (marqueeContent.offsetWidth / window.innerWidth) * speedMultiplier;

    marqueeScroll.style.marginLeft = `${scrollSpeedAttr * -1}%`;
    marqueeScroll.style.width = `${(scrollSpeedAttr * 2) + 100}%`;

    if (duplicateAmount > 0) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < duplicateAmount; i++) {
        fragment.appendChild(marqueeContent.cloneNode(true));
      }
      marqueeScroll.appendChild(fragment);
    }

    const marqueeItems = marquee.querySelectorAll('[data-marquee-collection-target]');
    const animation = gsap.to(marqueeItems, {
      xPercent: -100,
      repeat: -1,
      duration: marqueeSpeed,
      ease: 'linear'
    }).totalProgress(0.5);

    gsap.set(marqueeItems, { xPercent: marqueeDirectionAttr === 1 ? 100 : -100 });
    animation.timeScale(marqueeDirectionAttr);
    animation.play();

    marquee.setAttribute('data-marquee-status', 'normal');

    if ('marqueeDrag' in marquee.dataset) {
      initMarqueeDrag(marquee, animation, marqueeContent.offsetWidth);
    }

    ScrollTrigger.create({
      trigger: marquee,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const isInverted = self.direction === 1;
        const currentDirection = isInverted ? -marqueeDirectionAttr : marqueeDirectionAttr;
        animation.timeScale(currentDirection);
        marquee.setAttribute('data-marquee-status', isInverted ? 'normal' : 'inverted');
      }
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: marquee,
        start: '0% 100%',
        end: '100% 0%',
        scrub: 0
      }
    });

    const scrollStart = marqueeDirectionAttr === -1 ? scrollSpeedAttr : -scrollSpeedAttr;
    const scrollEnd = -scrollStart;

    tl.fromTo(marqueeScroll, { x: `${scrollStart}vw` }, { x: `${scrollEnd}vw`, ease: 'none' });
  });
}


// Sticky Features (osmo Sticky Features + приём с custo.io):
// секция пинится, тексты сменяются на месте, колонка картинок прокручивается скрабом
// Ниже 992 секция разворачивается в обычную колонку (текст — фото — текст —
// фото), пинить там нечего: на телефоне пин со скрабом дерётся со
// сворачивающейся адресной строкой, а колонка картинок шириной в экран
// всё равно не даёт того эффекта, ради которого пин затевался.
const STICKY_MIN = '(min-width: 992px)';

function initStickyFeatures() {
  const wide = window.matchMedia(STICKY_MIN);
  let built = false;

  // Блоков может быть несколько: на странице продукта их два
  const build = () => {
    if (built || !wide.matches) return;
    built = true;
    document.querySelectorAll('[data-features]').forEach(initStickyFeaturesBlock);
  };

  build();
  wide.addEventListener('change', build); // окно доросло до десктопа — собираем
}


function initStickyFeaturesBlock(wrap) {
  const items = Array.from(wrap.querySelectorAll('[data-features-item]'));
  const visual = wrap.querySelector('[data-features-visual]');
  const track = wrap.querySelector('[data-features-track]');
  if (items.length < 2 || !visual || !track) return;

  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DURATION = rm ? 0.01 : 0.75;
  // Изинг тот же, что у перекатов букв и слов на сайте — характер общий.
  // Мягче делаем только длительностью: смена идёт на скрабе и её видно дольше.
  const SWAP_TIME = rm ? 0.01 : 1;
  const SWAP_EASE = ROLL_EASE;
  const SCROLL_AMOUNT = 0.9; // доля скролла, за которую проходят все смены текста
  const steps = items.length - 1;

  // Все тексты карточки — заголовок, подпись и описание — разрезаны на строки
  // в масках и меняются одинаково: строки уходят вверх под маску и выезжают
  // снизу на новом экране. Все разом, без разбежки; тайминг и изинг общие
  // для перекатов текста на сайте (ROLL_TIME / ROLL_EASE).
  const getTexts = (el) => Array.from(el.querySelectorAll('[data-features-text]'));
  const getLines = (el) => Array.from(el.querySelectorAll('[data-features-text] .line'));

  if (typeof SplitText !== 'undefined') {
    gsap.registerPlugin(SplitText);
    // резать до готовности шрифтов нельзя — строки лягут по запасному
    document.fonts.ready.then(() => {
      items.forEach((item) => {
        getTexts(item).forEach((text) => {
          text.classList.add('title-roll'); // маски строк — scss/blocks/_title-roll.scss
          SplitText.create(text, {
            type: 'lines,words',
            linesClass: 'line',
            wordsClass: 'word',
            mask: 'lines',
            reduceWhiteSpace: false, // иначе распадаются связки с неразрывным пробелом
            autoSplit: true
          });
        });
      });
    });
  }

  gsap.set(items[0], { autoAlpha: 1 });
  let currentIndex = 0;

  // dir: 1 — скроллим вниз (строки уходят вверх, новые приходят снизу),
  // -1 — вверх (всё наоборот)
  // Два правила против гонки при быстром скролле туда-обратно:
  //   overwrite — встречный твин убивает предыдущий на тех же строках,
  //     иначе уход и приход одной карточки едут одновременно и дёргают её;
  //   проверка в onComplete — гасим карточку, только если она так и осталась
  //     не текущей. Без неё уход, запущенный до разворота, досматривался до
  //     конца и прятал карточку, которую уже успели показать обратно —
  //     это и был пропадающий первый слайд.
  function animateOut(itemEl, dir) {
    const lines = getLines(itemEl);
    const hide = () => {
      if (items[currentIndex] !== itemEl) gsap.set(itemEl, { autoAlpha: 0 });
    };

    if (lines.length) {
      gsap.to(lines, {
        yPercent: -115 * dir,
        duration: SWAP_TIME,
        ease: SWAP_EASE,
        overwrite: true,
        onComplete: hide
      });
      return;
    }

    // запасной путь, пока строки не нарезаны (шрифты ещё грузятся)
    gsap.to(getTexts(itemEl), {
      autoAlpha: 0,
      y: -30 * dir,
      ease: ROLL_EASE,
      duration: rm ? 0.01 : 0.4,
      overwrite: true,
      onComplete: hide
    });
  }

  function animateIn(itemEl, dir) {
    gsap.set(itemEl, { autoAlpha: 1 });
    const lines = getLines(itemEl);

    if (lines.length) {
      gsap.fromTo(lines,
        { yPercent: 115 * dir },
        { yPercent: 0, duration: SWAP_TIME, ease: SWAP_EASE, overwrite: true });
      return;
    }

    gsap.fromTo(getTexts(itemEl), {
      autoAlpha: 0,
      y: 30 * dir
    }, {
      autoAlpha: 1,
      y: 0,
      ease: ROLL_EASE,
      duration: rm ? 0.01 : ROLL_TIME,
      overwrite: true
    });
  }

  function transition(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const dir = toIndex > fromIndex ? 1 : -1; // куда листаем
    const fromEl = items[fromIndex];
    const lines = getLines(fromEl);
    const targets = lines.length ? lines : getTexts(fromEl);

    // Карточку, которую пролистали, не дав ей доехать, убираем без анимации:
    // на экране она толком не была, и её уход читался бы лишним кадром.
    // Признак — она всё ещё доигрывает свой приход: уходящей карточка быть
    // не может, уходим мы всегда с текущей.
    if (gsap.isTweening(targets)) {
      gsap.killTweensOf(targets);
      gsap.set(fromEl, { autoAlpha: 0 });
    } else {
      animateOut(fromEl, dir);
    }

    animateIn(items[toIndex], dir);
  }

  // Внутренний параллакс картинок: смещение зависит от положения карточки
  // относительно центра вьюпорта (работает и внутри пина). Коэффициент равен
  // пределу — иначе на половине пути смещение упирается в кламп и картинка,
  // уже будучи на экране, стоит на месте. Невидимые карточки тоже считаем:
  // иначе при входе в кадр они прыгают с нуля на своё значение.
  const IMG_SHIFT = 8; // предел смещения картинки, % её высоты
  const parallaxImgs = Array.from(track.querySelectorAll('.features-img img'));
  function updateImgParallax() {
    const vh = window.innerHeight;
    parallaxImgs.forEach((img) => {
      const rect = img.parentElement.getBoundingClientRect();
      const centerOffset = (rect.top + rect.height / 2 - vh / 2) / vh; // -1…1
      gsap.set(img, {
        yPercent: gsap.utils.clamp(-IMG_SHIFT, IMG_SHIFT, centerOffset * -IMG_SHIFT)
      });
    });
  }
  gsap.ticker.add(updateImgParallax);

  gsap.fromTo(track, { y: 0 }, {
    y: () => -(track.offsetHeight - visual.offsetHeight),
    ease: 'none',
    scrollTrigger: {
      trigger: wrap,
      start: 'top top',
      end: () => `+=${steps * 100}%`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = Math.min(self.progress, SCROLL_AMOUNT) / SCROLL_AMOUNT;
        // round, а не floor: текст сменяется на середине слайда, то есть
        // когда колонка картинок прошла половину пути до следующей. С floor
        // смена совпадала с приездом картинки, и последний текст успевал
        // показаться только в самом конце пина.
        let idx = Math.round(p * steps);
        idx = Math.max(0, Math.min(steps, idx));
        if (idx !== currentIndex) {
          transition(currentIndex, idx);
          currentIndex = idx;
        }
      }
    }
  });

}


// Блок 7: бесконечный слайдер фотографий производства (Swiper).
// Слайды разной ширины, свободное перетаскивание, стрелки слева внизу.
function initPlantSlider() {
  const track = document.querySelector('[data-plant-slider]');
  const list = track && track.querySelector('[data-plant-list]');
  if (!track || !list) return;

  const slides = Array.from(list.querySelectorAll('[data-plant-slide]'));
  if (!slides.length) return;

  // Ширину слайда, зазор и отступ ленты от края сетки держит CSS
  // (--slide-w / --slide-gap на .plant-slider): на мобильной канве слайд
  // другой, и дублировать его числом в JS значило бы править два места.
  const cssNum = (name, fallback) => {
    const v = parseFloat(getComputedStyle(track).getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  };
  let SLIDE = 850; // ширина слайда в единицах макета
  let GAP = 17; // зазор: второй слайд встаёт на 947 — в общую сетку блока
  const EASE = 0.1; // сглаживание инерции
  const DRAG = 1.5; // множитель перетаскивания
  const IMG_SHIFT = 0.14; // горизонтальный ход картинки, доля ширины слайда
  const IMG_SHIFT_Y = 0.06; // вертикальный ход от скролла страницы, доля высоты

  // Появление ленты: три первых слайда (это всё, что попадает в кадр)
  // выезжают из маски — ширина растёт слева направо, а фото внутри идёт
  // навстречу лёгким параллаксом. Изинг и длительность те же, что у слайдера
  // рулонов в конфигураторе, чтобы движение на сайте читалось одинаково.
  const ENTER_TIME = 1;
  const ENTER_STEP = 0.25; // пауза перед каждым следующим слайдом
  // фото едет в сторону, обратную раскрытию маски: маска открывается
  // слева направо, фото в это время подтягивается слева
  const ENTER_SHIFT = -0.1; // ход фото, доля ширины слайда

  if (window.CustomEase && !CustomEase.get('slideshow-wipe')) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('slideshow-wipe', '0.6, 0.08, 0.02, 0.99');
  }
  const ENTER_EASE = window.CustomEase ? 'slideshow-wipe' : 'power3.inOut';

  // В кадре на старте три первых слайда и правый край последнего — он по
  // модулю длины ленты встаёт слева от первого. Его тоже прячем, иначе
  // обрезок проявляется раньше остальных.
  const ENTER_SET = [slides.length - 1, 0, 1, 2];

  // Прогресс появления держим в простых объектах, а не в стилях: раскладка
  // переписывает transform картинки каждый кадр, и твин по ней бы затирался.
  const enter = slides.map((_, i) => ({ v: ENTER_SET.includes(i) ? 0 : 1 }));

  const state = { current: 0, last: 0, dragging: false, startX: 0, startAt: 0 };

  let step = 0;
  let total = 0;
  let offsetLeft = 0;

  // Левый край сетки берём у самого контейнера, а не считаем от 1440:
  // на мобильной канве ширина сетки и поля другие, а результат нужен тот же —
  // лента начинается вровень с заголовком блока
  const grid = track.closest('section') && track.closest('section').querySelector('.container');

  const measure = () => {
    const k = rem();
    SLIDE = cssNum('--slide-w', 850);
    GAP = cssNum('--slide-gap', 17);
    step = (SLIDE + GAP) * k;
    total = step * slides.length;
    // --slide-center: слайд шире экрана и стоит по его середине (мобильная
    // ветка). Обычно же лента начинается от левого края сетки, вровень
    // с заголовком блока.
    offsetLeft = cssNum('--slide-center', 0)
      ? (window.innerWidth - SLIDE * k) / 2
      : grid
        ? grid.getBoundingClientRect().left + parseFloat(getComputedStyle(grid).paddingLeft)
        : (window.innerWidth - 1440 * k) / 2 + 80 * k;
  };

  // Каждый слайд встаёт на своё место по модулю длины ленты — она бесконечна
  // в обе стороны и без склейки на стыке. Картинка внутри рамки едет от
  // положения слайда относительно центра экрана.
  const layout = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const shift = IMG_SHIFT * SLIDE * rem();

    // вертикальный параллакс от скролла: считаем положение ленты
    // относительно центра экрана, ход — доля высоты слайда
    const box = track.getBoundingClientRect();
    const py = (box.top + box.height / 2 - vh / 2) / vh; // -1…1
    const shiftY = -gsap.utils.clamp(-1, 1, py) * IMG_SHIFT_Y * box.height;
    // Запас в два шага перед лентой: слайд «перепрыгивает» вправо только
    // когда полностью ушёл за левый край. С запасом в один шаг он исчезал,
    // ещё оставаясь краем на экране.
    const before = step * 2;
    slides.forEach((slide, i) => {
      let x = (i * step - state.last + before) % total;
      if (x < 0) x += total;
      x -= before;
      const left = x + offsetLeft;
      slide.style.transform = 'translate3d(' + left + 'px, 0, 0)';

      const e = enter[i].v;
      const img = slide.querySelector('img');
      if (img) {
        const p = (left + step / 2 - vw / 2) / vw; // -1…1
        const enterX = (1 - e) * ENTER_SHIFT * SLIDE * rem();
        img.style.transform =
          'translate3d(' + (-p * shift + enterX) + 'px, ' + shiftY + 'px, 0)';
      }

      // маска: ширина рамки растёт слева направо. Скругление остаётся за
      // border-radius рамки — clip-path с ним пересекается, а не заменяет его
      const frame = slide.firstElementChild;
      if (e < 1) frame.style.clipPath = 'inset(0 ' + ((1 - e) * 100).toFixed(2) + '% 0 0)';
      else if (frame.style.clipPath) frame.style.clipPath = '';
    });
  };

  // Докатывание до сетки: после броска или прокрутки цель округляется до
  // ближайшего слайда, и лента сама доезжает до раскладки из макета
  // (первый слайд на 80, второй на 947).
  const snap = () => {
    if (!step) return;
    state.current = Math.round(state.current / step) * step;
  };

  let wheelTimer = null;

  const render = () => {
    state.last += (state.current - state.last) * EASE;
    if (Math.abs(state.current - state.last) < 0.01) state.last = state.current;
    layout();
  };

  track.addEventListener('wheel', (e) => {
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (horizontal) e.preventDefault(); // вертикальное колесо оставляем странице
    state.current += horizontal ? e.deltaX : 0;
    if (horizontal) {
      clearTimeout(wheelTimer);
      // колесо остановилось — подравниваем (на телефоне доводки нет)
      wheelTimer = setTimeout(() => { if (!freeScroll.matches) snap(); }, 140);
    }
  }, { passive: false });

  // На телефоне лента листается свободно, без доводки до слайда: пальцем
  // удобнее остановиться где угодно, а защёлкивание на каждом отпускании
  // ощущается как рывок. На десктопе доводка остаётся — там ввод дискретный
  // (колесо, стрелки), и раскладка из макета держится на ней.
  const freeScroll = window.matchMedia('(max-width: 991px)');

  // скорость руки — нужна, чтобы после отпускания лента доезжала по инерции,
  // а не вставала колом
  let dragVel = 0;
  let dragLast = 0;
  let dragTime = 0;

  track.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    state.dragging = true;
    state.startX = e.clientX;
    state.startAt = state.current;
    dragVel = 0;
    dragLast = e.clientX;
    dragTime = performance.now();
    track.setPointerCapture(e.pointerId);
    track.classList.add('is--dragging');
  });

  track.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const now = performance.now();
    const dt = now - dragTime || 16;
    dragVel = ((e.clientX - dragLast) / dt) * -1; // px/мс в координатах ленты
    dragLast = e.clientX;
    dragTime = now;
    state.current = state.startAt - (e.clientX - state.startX) * DRAG;
  });

  const release = () => {
    if (!state.dragging) return;
    state.dragging = false;
    track.classList.remove('is--dragging');

    if (freeScroll.matches) {
      // бросок: сглаживание lerp само погасит его за несколько кадров
      state.current += gsap.utils.clamp(-900, 900, dragVel * 260);
      return;
    }

    snap();
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  const prev = document.querySelector('[data-plant-prev]');
  const next = document.querySelector('[data-plant-next]');
  // кнопки всегда встают ровно на слайд, даже если лента была сдвинута
  const go = (dir) => { state.current = (Math.round(state.current / step) + dir) * step; };

  // Иконка стрелки ходит только вперёд: и наведение, и клик запускают один и тот
  // же шаг — уходящая иконка уступает место копии. Назад анимация не
  // отматывается: после хода строка мгновенно возвращается в начало, а копия
  // неотличима от оригинала, поэтому возврата не видно.
  const initNavIcon = (btn) => {
    const icons = btn && btn.querySelector('.plant-nav__icons');
    const first = icons && icons.querySelector('svg');
    if (!first) return;

    let busy = false;
    const step = () => {
      if (busy) return;
      busy = true;
      icons.classList.add('is--step');

      icons.addEventListener('transitionend', function done(e) {
        // ждём конца хода самой иконки, а не её копии
        if (e.target !== first || e.propertyName !== 'transform') return;
        icons.removeEventListener('transitionend', done);
        icons.classList.add('is--instant');
        icons.classList.remove('is--step');
        void icons.offsetWidth; // сброс применяем без перехода
        icons.classList.remove('is--instant');
        busy = false;
      });
    };

    btn.addEventListener('mouseenter', step);
    btn.addEventListener('click', step);
  };

  if (prev) prev.addEventListener('click', () => go(-1));
  if (next) next.addEventListener('click', () => go(1));
  initNavIcon(prev);
  initNavIcon(next);

  window.addEventListener('resize', () => {
    measure();
    layout();
  });

  measure();
  layout();
  gsap.ticker.add(render);

  ScrollTrigger.create({
    trigger: track,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      gsap.to(ENTER_SET.map((i) => enter[i]), {
        v: 1,
        duration: ENTER_TIME,
        ease: ENTER_EASE,
        stagger: ENTER_STEP
      });
    }
  });
}




// ============================================================================
// Блог
// ============================================================================

// Рубрики и «Показать ещё».
// Фильтр клиентский: все карточки уже лежат в разметке (поиск видит их все),
// кнопки только переключают классы. Выбранная рубрика уходит в ?cat=, чтобы
// ссылкой на раздел можно было поделиться; canonical при этом всегда /blog.html,
// поэтому дублей в индексе не возникает.
function initBlogFilter() {
  const bar = document.querySelector('[data-blog-cats]');
  if (!bar) return;

  const buttons = Array.from(bar.querySelectorAll('.blog-cat'));
  const cards = Array.from(document.querySelectorAll('.blog-card[data-cat]'));
  const lead = document.querySelector('[data-blog-lead]');
  const cta = document.querySelector('[data-blog-cta]');
  const more = document.querySelector('[data-blog-more]');
  const empty = document.querySelector('[data-blog-empty]');

  // хвост ленты, спрятанный до нажатия кнопки
  const tail = cards.filter((card) => card.classList.contains('is--hidden'));
  let expanded = false;
  let active = 'all';

  const apply = () => {
    const all = active === 'all';
    let shown = 0;

    cards.forEach((card) => {
      const match = all || card.dataset.cat === active;
      // внутри рубрики показываем всё сразу: прятать две-три статьи незачем
      const folded = all && !expanded && tail.includes(card);
      card.classList.toggle('is--off', !match);
      card.classList.toggle('is--hidden', folded);
      if (match && !folded) shown += 1;
    });

    // закреплённая статья и призыв к действию живут только в общей ленте
    if (lead) lead.style.display = all ? '' : 'none';
    if (cta) cta.style.display = all ? '' : 'none';
    if (more) more.style.display = all && !expanded ? '' : 'none';
    if (empty) empty.classList.toggle('is--on', shown === 0);

    buttons.forEach((btn) => btn.classList.toggle('is--on', btn.dataset.cat === active));
    ScrollTrigger.refresh();
  };

  const fromUrl = new URLSearchParams(window.location.search).get('cat');
  if (buttons.some((btn) => btn.dataset.cat === fromUrl)) active = fromUrl;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      active = btn.dataset.cat;
      const url = active === 'all'
        ? window.location.pathname
        : window.location.pathname + '?cat=' + active;
      window.history.replaceState(null, '', url);
      apply();
    });
  });

  if (more) {
    more.querySelector('button').addEventListener('click', () => {
      expanded = true;
      apply();
    });
  }

  apply();
}


// Оглавление статьи: подсвечиваем пункт того раздела, который читают сейчас.
// Слушаем обычный scroll (Lenis крутит страницу нативно) и считаем в кадре,
// а не на каждое событие.
function initPostToc() {
  const toc = document.querySelector('[data-post-toc]');
  if (!toc) return;

  const links = Array.from(toc.querySelectorAll('a'));
  const targets = links.map((link) => document.querySelector(link.getAttribute('href')));
  if (targets.some((target) => !target)) return;

  let frame = 0;

  const sync = () => {
    frame = 0;
    // граница в единицах макета: заголовок считается прочитанным, когда ушёл
    // выше линии под шапкой
    const edge = 160 * rem();
    let index = 0;
    targets.forEach((target, i) => {
      if (target.getBoundingClientRect().top <= edge) index = i;
    });
    links.forEach((link, i) => link.classList.toggle('is--on', i === index));
  };

  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(sync);
  }, { passive: true });

  sync();
}


// «Поделиться»: ссылки собираем из адреса страницы, поэтому домен нигде
// не прописан руками и статью можно переносить между окружениями.
function initPostShare() {
  const box = document.querySelector('[data-post-share]');
  if (!box) return;

  const url = window.location.href.split('#')[0];
  const heading = document.querySelector('.post-title');
  // в заголовке стоят неразрывные пробелы — в тексте ссылки они не нужны
  const title = (heading ? heading.textContent : document.title).replace(/ /g, ' ').trim();
  const pair = encodeURIComponent(title + ' ' + url);

  const links = {
    telegram: 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(title),
    whatsapp: 'https://wa.me/?text=' + pair,
    viber: 'viber://forward?text=' + pair
  };

  box.querySelectorAll('[data-share]').forEach((link) => {
    const href = links[link.dataset.share];
    if (href) link.href = href;
  });

  const copy = box.querySelector('[data-share-copy]');
  if (!copy || !navigator.clipboard) return;
  const label = copy.querySelector('span');
  const text = label.textContent;

  copy.addEventListener('click', () => {
    navigator.clipboard.writeText(url).then(() => {
      label.textContent = 'Ссылка скопирована';
      setTimeout(() => (label.textContent = text), 2000);
    }).catch(() => {});
  });
}


// ============================================================================
// Запуск
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initMarqueeScrollDirection();
  initLogoRoll();
  // Пин создаём ДО параллакс-триггеров: иначе блоки ниже фикс-секции
  // считают свои позиции без учёта добавленной пином прокрутки
  initStickyFeatures();
  initGlobalParallax();
  initTitleRoll();
  initNavDropdown();
  initMobileMenu();
  initMobileCallButton();
  initAnchorScroll();
  initCallbackForm();
  initModals();
  initFaq();
  initFooterParallax();
  initMetricCounters();
  initPlantSlider();
  initBlogFilter();
  initPostToc();
  initPostShare();

  // Пересчёт после того, как всё создано (и ещё раз после загрузки картинок)
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  window.addEventListener('load', () => ScrollTrigger.refresh());
});
