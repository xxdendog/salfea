/**
 * Конфигуратор товара — только страница продукта (product.html).
 *
 * Подключается после main.js: использует lenis из него, а также
 * GSAP Observer (перетаскивание сцены), CustomEase и NumberFlow (одометр цифр).
 */

// Snowflake Effect (osmo): снежинки сыплются внутри переданной коробки.
// Каждая — копия шаблона [data-snowflake]: падает сверху вниз за 8–12 с,
// по пути качается из стороны в сторону и чуть поворачивается, к концу
// пути гаснет. Сила снега (0–10) задаётся атрибутом data-strength и решает,
// сколько снежинок в секунду появляется и сколько их держится на экране.
// Возвращает ручки start/stop: снег идёт, только пока его слайд открыт,
// а секция на экране — иначе твины крутились бы впустую. На старте экран
// засевается снежинками, которые уже в пути: у каждой свой случайный
// прогресс падения, поэтому слайд открывается при идущем снеге, а не
// с пустой картинкой, куда только начинают сыпаться первые снежинки сверху.
const SNOW = {
  fall: [8, 12],      // сколько секунд летит снежинка
  scale: [0.3, 1.2],
  opacity: [0.2, 1],
  sway: [12, 60],     // размах покачивания в пикселях
  swayTime: [1.6, 3.8],
  turn: [-28, 28],
  turnTime: [2.2, 5]
};

function initSnowflake(container) {
  if (!container) return null;
  const template = container.querySelector('[data-snowflake]');
  if (!template) return null;

  const strength = gsap.utils.clamp(0, 10, parseInt(container.dataset.strength, 10) || 0);
  const rate = gsap.utils.mapRange(0, 10, 0.15, 5, strength);      // снежинок в секунду
  const limit = Math.round(gsap.utils.mapRange(0, 10, 12, 180, strength));
  const seed = Math.round(gsap.utils.mapRange(0, 10, 6, 60, strength));

  let running = false;
  let alive = 0;
  let next = null;

  // head — какую долю пути снежинка уже пролетела к моменту появления.
  // 0 у обычных: они входят сверху. У засеянных на старте — случайная,
  // поэтому слайд открывается при полном снеге, а не при пустом экране.
  const drop = (head = 0) => {
    if (!running || alive >= limit) return;

    const flake = template.cloneNode(true);
    flake.classList.remove('hidden');
    flake.style.willChange = 'transform, opacity';

    // Качание выбираем до колонки: на сколько снежинка уедет вбок, на столько
    // же отступаем от краёв, иначе у кромок снег был бы реже
    const sway = gsap.utils.random(...SNOW.sway, 0.1) * (0.6 + strength / 20);
    const pad = Math.min(20, (sway / (container.clientWidth || 1)) * 100);
    flake.style.left = `${gsap.utils.random(pad, 100 - pad, 0.1)}%`;
    flake.style.opacity = gsap.utils.random(...SNOW.opacity, 0.001);

    container.appendChild(flake);
    alive++;

    const h = container.clientHeight || window.innerHeight;
    const time = gsap.utils.random(...SNOW.fall, 0.001);
    const turn = gsap.utils.random(-12, 12, 0.1);
    const swayTime = gsap.utils.random(...SNOW.swayTime, 0.001);
    const turnTime = gsap.utils.random(...SNOW.turnTime, 0.001);
    const tweens = [];

    const done = () => {
      tweens.forEach((t) => t && t.kill());
      flake.remove();
      alive--;
    };

    const fall = gsap.fromTo(
      flake,
      { y: -gsap.utils.random(30, Math.min(180, h * 0.25), 1), xPercent: -50, scale: gsap.utils.random(...SNOW.scale, 0.001), rotate: turn },
      { y: h + gsap.utils.random(30, Math.min(220, h * 0.35), 1), ease: 'none', duration: time, onComplete: done }
    );
    const swayTween = gsap.fromTo(
      flake,
      { x: sway },
      { x: -sway, ease: 'sine.inOut', duration: swayTime, repeat: Math.max(1, Math.floor(time / swayTime)), yoyo: true }
    );
    const turnTween = gsap.fromTo(
      flake,
      { rotate: turn },
      { rotate: gsap.utils.random(...SNOW.turn, 0.1), ease: 'sine.inOut', duration: turnTime, repeat: Math.max(1, Math.floor(time / turnTime)), yoyo: true }
    );
    // Гаснет за секунду до конца пути. У засеянной снежинки путь уже начат,
    // поэтому до затухания остаётся меньше времени
    const left = time * (1 - head);
    const fade = gsap.to(flake, { opacity: 0, duration: 1, ease: 'power1.out', delay: Math.max(0, left - 1) });
    tweens.push(fall, swayTween, turnTween, fade);

    if (head) {
      fall.progress(head);
      // качание и поворот зациклены — им нужен свой случайный момент,
      // иначе весь засеянный снег качался бы в одну сторону разом
      swayTween.totalProgress(gsap.utils.random(0, 1, 0.001));
      turnTween.totalProgress(gsap.utils.random(0, 1, 0.001));
    }
  };

  const schedule = () => {
    if (!running) return;
    const gap = 1 / rate;
    next = gsap.delayedCall(gsap.utils.random(gap * 0.6, gap * 1.4, 0.001), () => {
      drop();
      schedule();
    });
  };

  return {
    start() {
      if (running) return;
      running = true;
      // засев — сразу, не по таймеру: снежинки распределены по всей высоте
      // (прогресс 0…0.9), так что снег виден с первого кадра
      for (let i = 0; i < seed; i++) drop(gsap.utils.random(0, 0.9, 0.001));
      schedule();
    },
    stop() {
      if (!running) return;
      running = false;
      if (next) next.kill();
      // шаблон оставляем, снятые копии убираем
      container.querySelectorAll('[data-snowflake]:not(.hidden)').forEach((el) => {
        gsap.killTweensOf(el);
        el.remove();
      });
      alive = 0;
    }
  };
}


// Конфигуратор продукта: переключение слайдов (кнопки цвета + свайп по сцене)
// и слайдеры характеристик (стрелки + перетаскивание ручки)
function initConfigurator() {
  const root = document.querySelector('[data-configurator]');
  if (!root) return;

  // --- Слайдшоу по osmo Parallax Image Gallery (без тумбнейлов) ---
  // slide едет на ±100%, inner — навстречу на 50% (эффект шторки с параллаксом)
  const switches = Array.from(root.querySelectorAll('[data-cfg-switch]'));
  const slides = Array.from(root.querySelectorAll('[data-cfg-slide]'));
  const inners = Array.from(root.querySelectorAll('[data-cfg-slide-inner]'));
  const stage = root.querySelector('[data-configurator-stage]');
  const length = slides.length;
  const DURATION = 0.9;

  if (window.CustomEase && !CustomEase.get('slideshow-wipe')) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('slideshow-wipe', '0.6, 0.08, 0.02, 0.99');
  }
  const EASE = window.CustomEase ? 'slideshow-wipe' : 'power3.inOut';

  let current = parseInt(root.getAttribute('data-slide'), 10) || 0;
  let animating = false;
  let observer = null;

  slides[current].classList.add('is--current');
  switches.forEach((b, n) => {
    b.classList.toggle('is--active', n === current);
    b.setAttribute('aria-selected', n === current ? 'true' : 'false');
  });

  // Снег живёт на своём слайде: сыплется, только пока этот слайд открыт
  // и секция на экране. Номер слайда берём у самого контейнера, чтобы
  // не держать его числом в двух местах.
  const snowBox = root.querySelector('[data-snowflake-container]');
  const snow = initSnowflake(snowBox);
  const snowSlide = snowBox ? slides.indexOf(snowBox.closest('[data-cfg-slide]')) : -1;
  let snowOnScreen = true;
  const syncSnow = () => {
    if (!snow) return;
    if (snowOnScreen && current === snowSlide) snow.start();
    else snow.stop();
  };
  if (snow) {
    const seen = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { snowOnScreen = self.isActive; syncSnow(); }
    });
    snowOnScreen = seen.isActive;
    syncSnow();
  }

  // При смене слайда страница доскролливает так, чтобы низ блока совпал с низом
  // экрана — тем же easing и за то же время, что и переход слайдов
  const wipeEase = (t) => {
    // cubic-bezier(0.6, 0.08, 0.02, 0.99) — как CustomEase 'slideshow-wipe'
    const p1x = 0.6, p1y = 0.08, p2x = 0.02, p2y = 0.99;
    const bez = (a, b, s) => 3 * a * (1 - s) * (1 - s) * s + 3 * b * (1 - s) * s * s + s * s * s;
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 24; i++) { s = (lo + hi) / 2; if (bez(p1x, p2x, s) < t) lo = s; else hi = s; }
    return bez(p1y, p2y, s);
  };
  const scrollToBottomOfBlock = () => {
    const rect = root.getBoundingClientRect();
    const target = window.scrollY + rect.bottom - window.innerHeight;
    if (Math.abs(target - window.scrollY) < 2) return;
    lenis.scrollTo(Math.max(0, target), { duration: DURATION, easing: wipeEase });
  };

  function navigate(direction, targetIndex = null) {
    if (animating) return;
    const previous = current;
    current = targetIndex !== null
      ? targetIndex
      : direction === 1
        ? (current < length - 1 ? current + 1 : 0)
        : (current > 0 ? current - 1 : length - 1);
    if (current === previous) return;

    animating = true;
    if (observer) observer.disable();
    scrollToBottomOfBlock();

    const currentSlide = slides[previous];
    const currentInner = inners[previous];
    const upcomingSlide = slides[current];
    const upcomingInner = inners[current];

    gsap.timeline({
      defaults: { duration: DURATION, ease: EASE },
      onStart: () => {
        upcomingSlide.classList.add('is--current');
        root.setAttribute('data-slide', String(current));
        switches.forEach((b, n) => {
          b.classList.toggle('is--active', n === current);
          b.setAttribute('aria-selected', n === current ? 'true' : 'false');
        });
        syncSnow();
      },
      onComplete: () => {
        currentSlide.classList.remove('is--current');
        animating = false;
        setTimeout(() => { if (observer) observer.enable(); }, DURATION * 1000);
      }
    })
      .to(currentSlide, { xPercent: -direction * 100 }, 0)
      .to(currentInner, { xPercent: direction * 50 }, 0)
      .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
      .fromTo(upcomingInner, { xPercent: -direction * 50 }, { xPercent: 0 }, 0);
  }

  function setSlide(i) {
    if (i === current || animating) return;
    navigate(i > current ? 1 : -1, i);
  }

  switches.forEach((b) => {
    b.addEventListener('click', () => setSlide(parseInt(b.getAttribute('data-cfg-switch'), 10)));
  });

  // Grab по картинке (мышь/тач) — GSAP Observer как в снипете, но без wheel:
  // слайд меняется только по кнопкам цвета и по перетаскиванию, не от скролла
  if (stage && window.Observer) {
    gsap.registerPlugin(Observer);
    observer = Observer.create({
      target: stage,
      type: 'touch,pointer',
      onLeft: () => { if (!animating) navigate(1); },
      onRight: () => { if (!animating) navigate(-1); },
      onPress: () => stage.classList.add('is--grabbing'),
      onRelease: () => stage.classList.remove('is--grabbing'),
      tolerance: 10,
      preventDefault: true
    });
  }

  // Рулон реагирует на оба слайдера общим масштабом (по всем осям):
  // среднее положение двух ручек → 0.94..1.06. Переменная — на корне секции,
  // её читают все три рулона
  const sliderT = { h: 0.5, v: 0.5 };
  const applyRollScale = () => {
    const s = 0.94 + ((sliderT.h + sliderT.v) / 2) * 0.12;
    root.style.setProperty('--roll-s', s.toFixed(4));
  };

  // Слайдеры: непрерывный прогресс t∈[0,1] → CSS-переменная --t (позиция ручки
  // и линий) + отображаемое целое значение. Ручка едет только пока зажата кнопка.
  root.querySelectorAll('[data-cfg-slider]').forEach((slider) => {
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    const format = slider.dataset.format;
    const isSize = slider.classList.contains('cfg-slider--v'); // слайдер размера

    // Цифры — NumberFlow (одометр): у «размера» два элемента через «x»
    const flows = Array.from(slider.querySelectorAll('[data-cfg-flow]'));
    const track = slider.querySelector('[data-cfg-track]');
    // Ось перетаскивания берём у самого трека, а не у класса слайдера: на
    // мобильной ширине слайдер размера разворачивается в горизонтальный,
    // и привязка к классу оставила бы перетаскивание на вертикальной оси.
    const isVertical = () => track.offsetHeight > track.offsetWidth;
    const knob = slider.querySelector('[data-cfg-knob]');

    let t = (parseFloat(slider.dataset.value) - min) / (max - min);
    let lastValue = null;

    // Тайминги NumberFlow: короткий, чтобы успевать за drag, с мягким spin
    const setupFlow = (el) => {
      el.transformTiming = { duration: 500, easing: 'linear(0, 0.0036 0.98%, 0.0185 2.06%, 0.0723 4.75%, 0.1568 8.06%, 0.4127 16.79%, 0.5013 20.72%, 0.5735 24.86%, 0.6234 28.35%, 0.6708 32.16%, 0.7135 36.28%, 0.7511 40.68%, 0.7833 45.36%, 0.8104 50.28%, 0.8324 55.4%, 0.85 60.66%, 0.8632 66%, 0.8813 76.62%, 0.8898 86.83%, 0.8934 100%)' };
      el.spinTiming = { duration: 550, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
      el.opacityTiming = { duration: 250, easing: 'ease-out' };
      el.trend = 0; // вверх при росте, вниз при уменьшении
    };
    flows.forEach(setupFlow);

    // Размер листа: не квадрат, а «ширина × длина» — длина растёт быстрее ширины
    // (реальные форматы: 15x17 → 20x20 → 25x28 → 30x35), обе цифры крутятся независимо
    const sizePair = (v) => {
      const width = v;
      const length = Math.round(v + (v - 20) * 0.5 + (v < 20 ? 2 : 0));
      return [width, Math.max(width, length)];
    };

    const render = () => {
      const value = Math.round(min + t * (max - min));
      if (value !== lastValue) {
        const values = format === 'size' ? sizePair(value) : [value];
        flows.forEach((el, i) => {
          const v = values[Math.min(i, values.length - 1)];
          if (typeof el.update === 'function') el.update(v); else el.textContent = String(v);
        });
        lastValue = value;
      }
      track.style.setProperty('--t', String(t));
      slider.dataset.value = String(value);
      sliderT[isSize ? 'v' : 'h'] = t;
      applyRollScale();
    };

    // Если кастомный элемент ещё не определён (модуль грузится) — дорисуем, когда появится
    if (window.customElements && !customElements.get('number-flow')) {
      customElements.whenDefined('number-flow').then(() => {
        flows.forEach(setupFlow);
        lastValue = null;
        render();
      });
    }

    const setT = (nt) => {
      t = Math.min(1, Math.max(0, nt));
      render();
    };

    // Стрелки: небольшой шаг по прогрессу
    const ARROW_STEP = 0.05;
    slider.querySelector('[data-cfg-dec]').addEventListener('click', () => setT(t - ARROW_STEP));
    slider.querySelector('[data-cfg-inc]').addEventListener('click', () => setT(t + ARROW_STEP));

    // Drag: только после pointerdown на ручке. Ручка не прыгает к курсору —
    // движение считается относительно точки захвата (без рывка при клике)
    let dragging = false;
    let grabOffset = 0; // смещение точки захвата от «идеальной» позиции ручки при t
    const knobHalf = () => (isVertical() ? knob.offsetHeight : knob.offsetWidth) / 2;
    const arrowSize = () => track.querySelector('.cfg-slider__arrow').offsetWidth;

    const posFromEvent = (e, rect) => (isVertical() ? rect.bottom - e.clientY : e.clientX - rect.left);
    const rangeOf = (rect) => (isVertical() ? rect.height : rect.width) - arrowSize() * 2 - knobHalf() * 2;

    const onMove = (e) => {
      if (!dragging) return;
      const rect = track.getBoundingClientRect();
      const pos = posFromEvent(e, rect) - grabOffset;
      setT((pos - arrowSize() - knobHalf()) / rangeOf(rect));
    };

    // move/up слушаем на document: ручка идёт строго за курсором,
    // даже если он выскочил за пределы кнопки
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      knob.classList.remove('is--dragging');
      track.classList.remove('is--dragging');
      root.classList.remove('is--sliding');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', stop);
      document.removeEventListener('pointercancel', stop);
    };
    knob.addEventListener('pointerdown', (e) => {
      dragging = true;
      knob.classList.add('is--dragging');
      track.classList.add('is--dragging');
      root.classList.add('is--sliding');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', stop);
      document.addEventListener('pointercancel', stop);
      // запоминаем, где именно взяли ручку — чтобы она не дёрнулась под курсор
      const rect = track.getBoundingClientRect();
      const ideal = arrowSize() + knobHalf() + t * rangeOf(rect);
      grabOffset = posFromEvent(e, rect) - ideal;
      e.preventDefault();
      e.stopPropagation();
    });
    // события слайдера не должны запускать свайп сцены
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());

    render();
  });
}

document.addEventListener('DOMContentLoaded', initConfigurator);
