/**
 * Глобус в блоке доставки — cobe (12 КБ, WebGL, js/vendor/cobe.esm.js).
 *
 * Шар взят из примера на cobe.vercel.app как есть: те же настройки и тот же
 * цикл (шаг фазы + `globe.update`). Отличие одно — где живёт канвас.
 *
 * Канвас прибит к вьюпорту (`position: fixed`) и **никогда не двигается**:
 * ни на скролле, ни при чём. За секцией едет сам шар внутри канваса — через
 * `offset`. Так браузеру не приходится на каждом кадре и таскать слой WebGL,
 * и заливать в него новую текстуру; именно эта пара и рвала скролл в Safari.
 * Та же схема у всех сайтов, где Lenis соседствует с WebGL.
 *
 * Ширина канваса — коробка орбиты, высота — экран: столько нужно шару, чтобы
 * проехать вьюпорт сверху донизу. Размер шара задаём `scale`, потому что cobe
 * считает его от высоты канваса, а она у нас зависит от окна.
 */

import createGlobe from './vendor/cobe.esm.js';

// Сеть поставок: все маршруты расходятся из Бишкека.
const HOME = [42.87, 74.59]; // Бишкек, СЭЗ — отмечен крупнее остальных

// Подписи к точкам: cobe умеет их сам, но через CSS Anchor Positioning, которого
// нет в Safari, да ещё и через тот <style>, который мы отключили ради
// производительности. Поэтому считаем положение подписей сами и рисуем их на
// отдельном 2D-канвасе поверх шара — ни одной записи в DOM за кадр.
// Порядок важен: при наложении подписей побеждает та, что выше в списке.
// Европа и США не расписаны по городам — одна точка и одна подпись на регион.
const LABEL = {
  бишкек: 'Кыргызстан',
  россия: 'Россия',
  ес: 'ЕС',
  чикаго: 'США',
  астана: 'Казахстан',
  минск: 'Беларусь',
  узбекистан: 'Узбекистан',
  ереван: 'Армения',
  канада: 'Канада',
  мехико: 'Мексика',
  сан_паулу: 'Бразилия',
  буэнос_айрес: 'Аргентина',
  панама: 'Панама'
};

// Точка на страну: координаты — столица или крупнейший узел
const CITY = {
  бишкек: HOME,
  россия: [56.84, 60.6], // Екатеринбург: от Москвы подпись Беларуси перекрывалась
  минск: [53.9, 27.56],
  астана: [51.17, 71.43],
  ереван: [40.18, 44.51],
  узбекистан: [42.46, 59.61], // Нукус: Ташкент сливался с Бишкеком
  ес: [49.84, 9.9], // официальный географический центр Евросоюза
  чикаго: [41.88, -87.63],
  канада: [53.55, -113.49], // Эдмонтон: Торонто вплотную к точке США
  мехико: [19.43, -99.13],
  панама: [8.98, -79.52],
  сан_паулу: [-23.55, -46.63],
  буэнос_айрес: [-34.6, -58.38]
};

// Все маршруты идут из Бишкека: он точка отправки, остальные города — назначения
const LINKS = Object.keys(CITY)
  .filter((name) => name !== 'бишкек')
  .map((name) => ['бишкек', name]);

// Хвост, бегущий по дуге: голова уходит вперёд, хвост её догоняет, и за головой
// ничего не остаётся. Высота у каждой дуги своя, по длине маршрута, — иначе
// короткая (Астана) задиралась бы такой же петлёй, как дальняя.
const TRAIL = {
  speed: 0.3, // долей дуги в секунду
  dash: 0.9, // длина хвоста в долях дуги — почти вся дуга
  pause: 0.9, // пауза между пролётами
  stagger: 0.35, // сдвиг между маршрутами
  minHeight: 0.1,
  perRad: 0.42 // прибавка к высоте на радиан дуги
};

const MOTION = { spin: 0.3 }; // рад/с — базовое вращение в покое

// Разгон от скролла. Добавка считается от текущей скорости прокрутки, а не
// копится: встал скролл — через мгновение осталось только базовое вращение.
// Берём модуль скорости, поэтому вверх или вниз — шар всё равно ускоряется
// в свою сторону, вправо, и никогда не разворачивается.
const SCROLL = {
  boost: 0.00035, // рад/с на каждый пиксель прокрутки в секунду
  max: 0.9, // потолок добавки
  smooth: 0.12 // с — за столько добавка догоняет скорость скролла
};

// Перетаскивание мышью — только по горизонтали, крутим ту же phi
const DRAG = {
  speed: 0.00175, // рад на пиксель
  radius: 0.4, // какую часть коробки считаем шаром (413 из 552 — это 0.37)
  max: 1.5, // потолок броска, рад/с
  tau: 0.55, // за столько секунд бросок падает в e раз
  hold: 0.1 // если руку остановили, но не отпустили — скорость гаснет за это время
};
const START = 1.5 * Math.PI - (57 * Math.PI) / 180; // долгота в центре = 3π/2 − phi
const GLOBE_SIZE = 413; // диаметр шара в единицах макета, как залитая сфера
// На мобильной канве шар меньше — значение держит CSS
// (--globe-size на .delivery-globe), чтобы размер шара и коробка орбиты
// не разъезжались по двум файлам.
// Замерено чтением пикселей: диаметр шара = FILL * scale * высота канваса,
// а сдвиг от offset = offset * scale / 2 (и положительный offset двигает вниз).
const FILL = 0.8218;

// Настройки — showcase `default` с cobe.vercel.app
const VIEW = {
  theta: 0.3,
  dark: 0,
  diffuse: 1.2,
  mapSamples: 36000,
  mapBrightness: 10,
  mapBaseBrightness: 0,
  baseColor: [0.004, 0.114, 0.455],
  // Цвет точек суши. В оригинальном cobe его нет — шар красится одним
  // baseColor; мы добавили юниформ в шейдер (см. js/vendor/cobe.esm.js).
  landColor: [0.475, 0.576, 0.894], // #7993e4 — тот же акцент, что у свечения
  landMix: 1, // 0 — как в оригинале cobe, 1 — точки целиком красятся landColor
  markerColor: [0.475, 0.576, 0.89],
  glowColor: [0.475, 0.576, 0.89],
  arcColor: [0.749, 0.804, 0.961],
  markerElevation: 0.01,
  arcWidth: 0.5,
  arcHeight: 0.3
};

// Орбита вокруг шара: скорости в град/с. Стрелки идут быстрее пунктира и
// сильнее подхватывают разгон от скролла (arrowRush — множитель добавки).
const ORBIT = { ring: 6, arrows: 9, arrowRush: 2.5 };

// Подпись видна, пока точка не дошла до края шара (edge — доля радиуса),
// появляется и уходит за time секунд.
const LABELS = { edge: 0.93, time: 0.3 };

const LABEL_FONT = '500 11px "GT America LCG", system-ui, sans-serif';

// Подпись — только текст, без плашки. Для читаемости поверх точек суши под
// белым текстом рисуется его же копия на пиксель ниже, цветом фона.
const LABEL_GAP = 13; // отступ подписи от точки
const LABEL_TEXT = '255, 255, 255';
const LABEL_BACK = '4, 14, 48';

// Подписи, которые иначе налезают на соседей, уводим под точку
const LABEL_BELOW = { Беларусь: true, Армения: true, Мексика: true };

const DOT = { origin: 0.03, city: 0.03 }; // как в примере: size 0.03

export function initDeliveryGlobe() {
  const canvas = document.querySelector('[data-globe]');
  const anchor = document.querySelector('.delivery-globe');
  if (!canvas || !anchor) return;

  // Модуль выполняется раньше, чем применяются стили, и канвас в этот момент
  // нулевой — cobe тогда создаёт буфер 0x0 и ничего не рисует. Ждём размера.
  if (!canvas.getBoundingClientRect().width) {
    requestAnimationFrame(initDeliveryGlobe);
    return;
  }

  const markers = [];
  const buildMarkers = () => {
    markers.length = 0;
    Object.entries(CITY).forEach(([name, loc]) => {
      markers.push({ location: loc, size: name === 'бишкек' ? DOT.origin : DOT.city });
    });
    return markers;
  };
  buildMarkers();

  // Длина маршрута в радианах — по ней считаем высоту дуги
  const RAD = Math.PI / 180;
  // Один в один как U() внутри cobe: долгота со сдвигом на π и знак у x.
  // Своя формула отличалась знаком z — подписи вставали зеркально по долготе.
  const vec = ([lat, lng]) => {
    const a = lat * RAD;
    const b = lng * RAD - Math.PI;
    const o = Math.cos(a);
    return [-o * Math.cos(b), Math.sin(a), o * Math.sin(b)];
  };
  const routes = LINKS.map(([a, b]) => {
    const from = CITY[a];
    const to = CITY[b];
    const va = vec(from);
    const vb = vec(to);
    const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
    const ang = Math.acos(dot); // длина маршрута в радианах — по ней высота дуги
    return {
      arc: {
        from,
        to,
        height: Math.min(0.45, TRAIL.minHeight + TRAIL.perRad * ang),
        from0: 0,
        to0: 1
      }
    };
  });

  const arcs = routes.map((r) => r.arc);
  const CYCLE = (1 + TRAIL.dash) / TRAIL.speed + TRAIL.pause;

  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize);

  const globeSize = () => {
    const v = parseFloat(getComputedStyle(anchor).getPropertyValue('--globe-size'));
    return Number.isFinite(v) ? v : GLOBE_SIZE;
  };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let box = canvas.getBoundingClientRect();
  let scale = (globeSize() * rem()) / (FILL * box.height);
  let phi = START;
  let visible = false;
  let last = performance.now();
  let clock = 0;
  let boost = 0; // добавка к вращению от скролла и броска мышью
  let lastScroll = window.scrollY;
  let dragging = false;
  let dragX = 0;
  let dragTime = 0;
  let dragVel = 0; // текущая скорость руки, рад/с
  let fling = 0; // бросок после отпускания, затухает сам
  const offset = [0, 0];

  // cobe 2.0.1 на каждый update() переписывает свой <style> в <head> — даже
  // когда писать нечего, он кладёт туда одну и ту же строку ":root{}".
  // Подмена документного стиля инвалидирует стили всей страницы: Blink это
  // проглатывает, а WebKit делает полный restyle каждый кадр, и просаживается
  // вся страница целиком, включая анимации попапа (shuding/cobe#124: 77–84%
  // ядра против 5–6% с откреплённым стилем). Исправление уже в репозитории,
  // но в npm его ещё не выпустили. Подписи к точкам нам не нужны, поэтому
  // просто выносим этот <style> из документа: cobe продолжит писать в него,
  // но уже в открепленный узел и без последствий.
  const styleBefore = new Set(document.head.querySelectorAll('style'));

  const globe = createGlobe(canvas, {
    // MSAA в Safari на таком канвасе дороже, чем польза: точки и так сглажены
    // в шейдере. low-power держит MacBook на встроенной видеокарте.
    context: { antialias: false, powerPreference: 'low-power' },
    devicePixelRatio: dpr,
    width: box.width,
    height: box.height,
    phi,
    scale,
    theta: VIEW.theta,
    dark: VIEW.dark,
    diffuse: VIEW.diffuse,
    mapSamples: VIEW.mapSamples,
    mapBrightness: VIEW.mapBrightness,
    mapBaseBrightness: VIEW.mapBaseBrightness,
    baseColor: VIEW.baseColor,
    landColor: VIEW.landColor,
    landMix: VIEW.landMix,
    markerColor: VIEW.markerColor,
    glowColor: VIEW.glowColor,
    arcColor: VIEW.arcColor,
    arcWidth: VIEW.arcWidth,
    arcHeight: VIEW.arcHeight,
    markerElevation: VIEW.markerElevation,
    markers,
    arcs
  });

  document.head.querySelectorAll('style').forEach((el) => {
    if (!styleBefore.has(el)) el.remove();
  });

  // cobe заворачивает канвас в свой div (он нужен ему для подписей к точкам).
  // Этот div обычный, в потоке и с pointer-events: auto — то есть он и место
  // занимает, и ловит клики по всей странице. Нам он не нужен: гасим.
  const wrap = canvas.parentElement;
  if (wrap && wrap !== document.body) {
    wrap.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none';
  }

  // Положение коробки в документе меряем не каждый кадр, а только когда оно
  // могло измениться: getBoundingClientRect в кадре — это принудительный
  // пересчёт раскладки, а их на странице и без нас хватает.
  let anchorCenter = 0;
  const measure = () => {
    const a = anchor.getBoundingClientRect();
    anchorCenter = a.top + window.scrollY + a.height / 2;
  };

  // Шар стоит там же, где его коробка: считаем, на сколько её середина ушла
  // от середины канваса, и переводим в единицы offset.
  // Когда канвас лежит в потоке (мобильная ветка ниже), считать нечего:
  // он и есть коробка орбиты, браузер двигает его вместе со страницей.
  let inline = false;
  const place = () => {
    if (inline) return;
    const shift = anchorCenter - window.scrollY - (box.top + box.height / 2);
    offset[1] = (2 * shift) / scale;
  };

  // ---------------------------------------------------------------- подписи
  // Слой с названиями городов: отдельный 2D-канвас ровно поверх шара.
  // Рисуем в канвас, а не в DOM — 21 элемент с пересчётом стилей на кадр
  // в Safari обходится дороже, чем один clearRect с текстом.
  const labels = document.createElement('canvas');
  labels.className = 'globe-labels';
  labels.setAttribute('aria-hidden', 'true');
  canvas.parentElement.appendChild(labels);
  const ctx = labels.getContext('2d');

  // ------------------------------------------- канвас в потоке на мобильном
  // На телефоне страницу крутит сам браузер, на своём потоке, а положение шара
  // внутри прибитого к вьюпорту канваса считает JS по window.scrollY — и
  // отстаёт от страницы на кадр-другой: шар заметно плывёт за секцией.
  // Поэтому ниже 992 канвас переезжает внутрь коробки орбиты обычным
  // absolute — его двигает браузер вместе со всем остальным, и offset не нужен.
  // На десктопе оставляем как было: там канвас фиксирован не от хорошей жизни,
  // а потому что Safari рвёт скролл, когда таскает слой WebGL вместе с Lenis.
  const home = canvas.parentElement;
  const wide = window.matchMedia('(min-width: 992px)');

  const setInline = (on) => {
    if (on === inline) return;
    inline = on;
    canvas.classList.toggle('is--inline', on);
    labels.classList.toggle('is--inline', on);
    // порядок важен: канвас и подписи встают перед svg орбиты, иначе
    // пунктир и стрелки уедут под шар
    if (on) {
      anchor.prepend(labels);
      anchor.prepend(canvas);
    } else {
      home.appendChild(canvas);
      home.appendChild(labels);
    }
    offset[0] = 0;
    offset[1] = 0;
    resize();
  };

  const order = Object.keys(LABEL);
  const ring = anchor.querySelector('.delivery-globe__orbit.is--ring');
  const arrows = anchor.querySelector('.delivery-globe__orbit.is--arrows');
  let ringAngle = 0;
  let arrowAngle = 0;

  const spinOrbit = (dt, rush) => {
    ringAngle = (ringAngle + ORBIT.ring * rush * dt) % 360;
    // стрелки подхватывают разгон сильнее: добавку к единице умножаем
    const fast = 1 + (rush - 1) * ORBIT.arrowRush;
    arrowAngle = (arrowAngle + ORBIT.arrows * fast * dt) % 360;
    if (ring) ring.style.transform = 'rotate(' + ringAngle.toFixed(2) + 'deg)';
    if (arrows) arrows.style.transform = 'rotate(' + arrowAngle.toFixed(2) + 'deg)';
  };

  const points = Object.entries(CITY)
    .filter(([name]) => LABEL[name])
    .map(([name, loc]) => ({
      text: LABEL[name],
      rank: order.indexOf(name), // приоритет при наложении
      home: name === 'бишкек',
      below: !!LABEL_BELOW[LABEL[name]],
      v: vec(loc),
      want: 0, // куда стремится видимость в этом кадре
      vis: 0 // текущая видимость, догоняет want
    }));


  const sizeLabels = () => {
    labels.width = Math.round(box.width * dpr);
    labels.height = Math.round(box.height * dpr);
    labels.style.width = box.width + 'px';
    labels.style.height = box.height + 'px';
  };
  sizeLabels();

  // Та же проекция, что в шейдере cobe: поворот по phi и theta, затем перевод
  // в экранные координаты с учётом scale и offset.
  const drawLabels = (dt) => {
    const w = box.width;
    const h = box.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const ct = Math.cos(VIEW.theta);
    const st = Math.sin(VIEW.theta);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const r = 0.8 + VIEW.markerElevation;

    // 1. считаем, какой подпись хочет быть в этом кадре
    points.forEach((p) => {
      const x0 = p.v[0] * r;
      const y0 = p.v[1] * r;
      const z0 = p.v[2] * r;
      const x = cp * x0 + sp * z0;
      const y = sp * st * x0 + ct * y0 - cp * st * z0;
      const z = -sp * ct * x0 + st * y0 + cp * ct * z0;

      if (z <= 0) {
        p.want = 0; // ушла за шар — координаты оставляем прежние, чтобы догасла
        return;
      }

      // Либо видна, либо нет: пока точка не дошла до кромки — цель 1.
      // Плавность даёт шаг по времени ниже, а не спад по радиусу.
      const edge = Math.hypot(x, y) / 0.8; // 0 в центре диска, 1 на кромке
      p.want = edge < LABELS.edge ? 1 : 0;
      p.z = z;

      const nx = x * (h / w) * scale + (offset[0] * scale) / w;
      const ny = y * scale - (offset[1] * scale) / h;
      p.sx = (nx * 0.5 + 0.5) * w;
      p.sy = (0.5 - ny * 0.5) * h; // экранная позиция самой точки
    });

    // 2. Налезающие убираем — но не рывком, а обнулив цель: гасить будет шаг 3.
    // Порядок с гистерезисом: кто уже на экране, тот и удерживает место. Без
    // этого две соседние подписи вытесняют друг друга по очереди и мигают.
    const queue = points
      .slice()
      .sort((a, b) => (b.vis > 0.5) - (a.vis > 0.5) || a.rank - b.rank || b.z - a.z);

    const boxes = [];
    queue.forEach((p) => {
      if (p.want <= 0.01) return;
      // уже видимой подписи прощаем лёгкое касание, новой — наоборот, строже
      const pad = p.vis > 0.5 ? -2 : 3;
      const half = ctx.measureText(p.text).width / 2 + 4 + pad;
      const mid = p.sy + (p.below ? LABEL_GAP : -LABEL_GAP);
      const box2 = { left: p.sx - half, right: p.sx + half, top: mid - 8 - pad, bottom: mid + 8 + pad };
      const busy = boxes.some(
        (b) => box2.left < b.right && box2.right > b.left && box2.top < b.bottom && box2.bottom > b.top
      );
      if (busy) p.want = 0;
      else boxes.push(box2);
    });

    // 3. Текущая видимость догоняет цель — любое появление и исчезновение плавное.
    // Прозрачность кладём прямо в цвет, а не в globalAlpha: в паре с тенью
    // globalAlpha в Safari отрабатывает не так, как в Chromium, и подпись
    // пропадала щелчком вместо затухания.
    // Шаг постоянный, а не экспонента: подпись появляется и уходит ровно за
    // LABELS.time секунд, без длинного хвоста у нуля.
    const step = dt / LABELS.time;

    points.forEach((p) => {
      const d = p.want - p.vis;
      p.vis += Math.max(-step, Math.min(step, d));
      if (p.vis <= 0.012 || p.sx === undefined) return;

      const a = p.vis * (p.home ? 1 : 0.85);
      const y = p.sy + (p.below ? LABEL_GAP : -LABEL_GAP);
      // Подпись у самой кромки не даём обрезать краем канваса: подвигаем её
      // внутрь ровно настолько, чтобы влезла целиком. На мобильном шар почти
      // во всю ширину коробки, и запаса по бокам почти нет.
      const half = ctx.measureText(p.text).width / 2;
      const x = Math.max(half + 2, Math.min(w - half - 2, p.sx));

      ctx.fillStyle = 'rgba(' + LABEL_BACK + ', ' + (a * 0.6).toFixed(3) + ')';
      ctx.fillText(p.text, x, y + 1);
      ctx.fillStyle = 'rgba(' + LABEL_TEXT + ', ' + a.toFixed(3) + ')';
      ctx.fillText(p.text, x, y);
    });
  };

  const animate = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const y = window.scrollY;
    const dy = y - lastScroll;
    lastScroll = y;

    // Вне экрана не рисуем и разгон не копим: иначе, пока блок пролистан,
    // добавка замирает и шар на возврате дёргается.
    if (!visible) {
      boost = 0;
      return;
    }

    // Разгон от прокрутки: цель — текущая скорость скролла по модулю, добавка
    // её догоняет и так же быстро отпускает. Скролл встал — добавка ушла в ноль.
    const target = Math.min(SCROLL.max, (Math.abs(dy) / dt) * SCROLL.boost);
    boost += (target - boost) * Math.min(1, dt / SCROLL.smooth);

    // Бросок после отпускания живёт своей жизнью и гаснет. Пока рука держит
    // шар, гасим накопленную скорость, если движение остановилось, — иначе
    // «подержал и отпустил» улетало бы броском.
    if (dragging) {
      dragVel *= Math.exp(-dt / DRAG.hold);
    } else {
      fling *= Math.exp(-dt / DRAG.tau);
      phi += (MOTION.spin + boost + fling) * dt;
    }

    // Разгон множителем: ускорился шар втрое — втрое ускоряются и орбита,
    // и хвосты маршрутов. Прибавка в своих единицах у каждого из них была бы
    // незаметна, а общий множитель держит их заодно.
    // Считаем от всего, что крутит шар прямо сейчас: прокрутка страницы,
    // бросок после отпускания и рука, пока она тянет. Берём модуль — влево
    // шар иногда едет, но хвосты от этого не должны бежать назад.
    const spun = boost + Math.abs(dragging ? dragVel : fling);
    const rush = (MOTION.spin + spun) / MOTION.spin;

    // Хвосты: у каждого маршрута свой сдвиг по времени, голова бежит от
    // Бишкека к городу, хвост идёт следом, и после него дуга пустая.
    clock += dt * rush;
    arcs.length = 0;
    routes.forEach((route, i) => {
      const t = (clock - i * TRAIL.stagger + CYCLE * 10) % CYCLE;
      const head = t * TRAIL.speed;
      const tail = head - TRAIL.dash;
      if (tail >= 1) return; // пролетел — ждём следующего круга

      route.arc.from0 = Math.max(0, tail);
      route.arc.to0 = Math.min(1, head);
      if (route.arc.to0 > route.arc.from0) arcs.push(route.arc);
    });

    place();
    globe.update({ phi, offset, arcs });
    drawLabels(dt);
    spinOrbit(dt, rush);
  };

  // Один тикер на всё: Lenis уже сидит на нём (main.js) и зарегистрирован
  // раньше, значит в кадре сперва отрабатывает прокрутка, а потом рисуется шар.
  if (window.gsap && gsap.ticker) {
    gsap.ticker.add(animate);
  } else {
    const loop = () => {
      animate();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  const resize = () => {
    measure();
    box = canvas.getBoundingClientRect();
    sizeLabels();
    scale = (globeSize() * rem()) / (FILL * box.height);
    globe.update({ width: box.width, height: box.height, scale });
  };

  // Перетаскивание: горизонталь крутит шар, вертикаль не трогаем — страница
  // должна продолжать скроллиться.
  //
  // Слушаем секцию, а не коробку глобуса: коробка лежит под текстовым блоком
  // (он занимает почти всю ширину), и до неё pointerdown просто не доходит.
  // Событие всплывает до секции от кого угодно, а мы сами проверяем, попал ли
  // курсор в круг шара.
  const section = anchor.closest('section') || document;
  const inGlobe = (e) => {
    const r = anchor.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return Math.hypot(dx, dy) <= r.width * DRAG.radius;
  };

  section.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !inGlobe(e)) return;
    e.preventDefault(); // иначе тяга цепляет выделение текста
    dragging = true;
    dragX = e.clientX;
    dragTime = performance.now();
    dragVel = 0;
    fling = 0;
    section.classList.add('is--drag');
    try {
      anchor.setPointerCapture(e.pointerId);
    } catch (err) {
      /* синтетические указатели капчурить нельзя — не беда */
    }
  });

  let overGlobe = false;
  section.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      phi += dx * DRAG.speed; // вправо тянем — шар едет вправо

      // скорость руки для броска: сглаживаем, чтобы один рывок не задрал её
      const now = performance.now();
      const dt = Math.max(0.008, (now - dragTime) / 1000);
      dragTime = now;
      dragVel += ((dx * DRAG.speed) / dt - dragVel) * 0.4;
      return;
    }

    // курсор-ладошка только над самим шаром, и переключаем его лишь на смене
    const over = inGlobe(e);
    if (over !== overGlobe) {
      overGlobe = over;
      section.classList.toggle('is--grab', over);
    }
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    section.classList.remove('is--drag');
    // бросок: шар продолжает крутиться туда, куда его толкнули, и затухает
    fling = Math.max(-DRAG.max, Math.min(DRAG.max, dragVel));
  };

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // Дев-панель подбора цветов: подключается только по ?dev, в обычной
  // сборке этот файл даже не грузится.
  if (new URLSearchParams(location.search).has('dev')) {
    import('./globe-dev.js')
      .then((m) => m.initGlobePanel(window.__globe))
      .catch(() => {});
  }

  measure();
  setInline(!wide.matches);
  wide.addEventListener('change', () => setInline(!wide.matches));
  window.addEventListener('resize', resize);
  window.addEventListener('load', measure);
  // пины ScrollTrigger сдвигают секции, после пересчёта меряем заново
  if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', measure);

  // дев-хук на время отладки
  window.__globe = { globe, measure, VIEW, MOTION, SCROLL, DRAG, DOT, TRAIL, LABELS, ORBIT, buildMarkers, points, state: () => ({ phi, clock, offset: [...offset], scale, visible, boost, dragging, fling, box: [box.width, box.height], anchorCenter, live: anchor.getBoundingClientRect().top + window.scrollY + anchor.offsetHeight / 2 }) };

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      last = performance.now();
      canvas.classList.toggle('is--on', visible);
    },
    { rootMargin: '10px' }
  ).observe(anchor);
}

initDeliveryGlobe();
