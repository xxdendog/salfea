/**
 * Дев-панель подбора глобуса. Грузится только по `?dev` — в обычной сборке
 * этот файл даже не скачивается (динамический import в js/globe.js).
 *
 * Крутит всё вживую: цвета, яркость и плотность точек, дуги, наклон, скорость
 * вращения и разгон от скролла. Кнопка внизу копирует готовый кусок кода —
 * его остаётся вставить в js/globe.js вместо текущих значений.
 */

const hex = (rgb) =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

// Принимаем и #abc, и abcdef, и с решёткой, и без
const normalize = (value) => {
  const v = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) return '#' + v.split('').map((ch) => ch + ch).join('');
  if (/^[0-9a-f]{6}$/i.test(v)) return '#' + v;
  return null;
};

const rgb = (value) => [
  parseInt(value.slice(1, 3), 16) / 255,
  parseInt(value.slice(3, 5), 16) / 255,
  parseInt(value.slice(5, 7), 16) / 255
];

const CSS = `
.globe-dev {
  position: fixed; right: 16px; top: 16px; z-index: 9999;
  width: 300px; max-height: calc(100vh - 32px); overflow: auto;
  padding: 14px; border-radius: 10px;
  background: rgba(12, 16, 32, 0.92); color: #fff;
  font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.globe-dev h4 { margin: 0 0 10px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; opacity: .6; }
.globe-dev label { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.globe-dev label span { flex: 1; }
.globe-dev label b { width: 54px; text-align: right; font-weight: 400; opacity: .75; }
.globe-dev input[type=range] { width: 110px; }
.globe-dev input[type=color] { width: 30px; height: 22px; padding: 0; border: 0; background: none; }
.globe-dev input.hex {
  width: 78px; padding: 3px 6px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.35);
  color: #fff; font: inherit; text-transform: lowercase;
}
.globe-dev input.hex:focus { outline: none; border-color: #2d5bff; }
.globe-dev .note { margin: 0 0 10px; font-size: 11px; line-height: 1.35; opacity: .55; }
.globe-dev hr { border: 0; border-top: 1px solid rgba(255,255,255,.15); margin: 10px 0; }
.globe-dev button {
  width: 100%; margin-top: 4px; padding: 7px; border: 0; border-radius: 6px;
  background: #2d5bff; color: #fff; font: inherit; cursor: pointer;
}
.globe-dev button.is--ghost { background: rgba(255,255,255,.12); margin-top: 6px; }
.globe-dev textarea {
  width: 100%; height: 120px; margin-top: 8px; padding: 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.4); color: #fff;
  font: 11px/1.35 ui-monospace, Menlo, Consolas, monospace; display: none;
}
.globe-dev textarea.is--on { display: block; }
`;

export function initGlobePanel(api) {
  const { globe, VIEW, MOTION, SCROLL, DOT, TRAIL, LABELS, ORBIT, buildMarkers } = api;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'globe-dev';
  document.body.appendChild(panel);

  const rows = [];

  const add = (html) => {
    const el = document.createElement('div');
    el.innerHTML = html;
    panel.appendChild(el.firstElementChild);
    return panel.lastElementChild;
  };

  // --- цвет -----------------------------------------------------------------
  const color = (name, key) => {
    const row = add(
      `<label><span>${name}</span>` +
        `<input type="text" class="hex" spellcheck="false" value="${hex(VIEW[key])}">` +
        `<input type="color" value="${hex(VIEW[key])}"></label>`
    );
    const text = row.querySelector('.hex');
    const picker = row.querySelector('[type=color]');

    const apply = (value) => {
      VIEW[key] = rgb(value);
      globe.update({ [key]: VIEW[key] });
    };

    picker.addEventListener('input', () => {
      text.value = picker.value;
      apply(picker.value);
    });

    // можно вписать или вставить hex руками — применяем, как только он валиден
    text.addEventListener('input', () => {
      const value = normalize(text.value);
      if (!value) return;
      picker.value = value;
      apply(value);
    });

    text.addEventListener('blur', () => (text.value = hex(VIEW[key])));
    rows.push(() => {
      text.value = hex(VIEW[key]);
      picker.value = hex(VIEW[key]);
    });
  };

  // --- число ----------------------------------------------------------------
  const range = (name, get, set, min, max, step) => {
    const row = add(
      `<label><span>${name}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${get()}"><b>${get()}</b></label>`
    );
    const input = row.querySelector('input');
    const out = row.querySelector('b');
    input.addEventListener('input', () => {
      set(parseFloat(input.value));
      out.textContent = input.value;
    });
    rows.push(() => {
      input.value = get();
      out.textContent = get();
    });
  };

  const upd = (key) => (v) => {
    VIEW[key] = v;
    globe.update({ [key]: v });
  };

  add('<h4>Шар</h4>');
  add('<p class="note">«Тёмный шар» переключает, что ярче — точки суши или сам шар. Цвет точек задаётся отдельно (это наша правка шейдера cobe).</p>');
  color('Цвет шара', 'baseColor');
  color('Цвет точек суши', 'landColor');
  color('Свечение', 'glowColor');
  range('Сила цвета точек', () => VIEW.landMix, upd('landMix'), 0, 1, 0.05);
  range('Яркость суши', () => VIEW.mapBrightness, upd('mapBrightness'), 0, 20, 0.5);
  range('Яркость океана', () => VIEW.mapBaseBrightness, upd('mapBaseBrightness'), 0, 1, 0.01);
  range('Плотность точек', () => VIEW.mapSamples, upd('mapSamples'), 1000, 40000, 500);
  // dark в cobe — не тень, а инверсия карты: при 0 точки суши темнее шара,
  // при 1 наоборот, шар тёмный, а точки светятся
  range('Тёмный шар', () => VIEW.dark, upd('dark'), 0, 1, 0.05);
  range('Свет', () => VIEW.diffuse, upd('diffuse'), 0, 3, 0.05);
  range('Наклон', () => VIEW.theta, upd('theta'), -0.8, 0.8, 0.02);

  add('<hr>');
  add('<h4>Точки и дуги</h4>');
  color('Цвет точек', 'markerColor');
  color('Цвет дуг', 'arcColor');
  range('Толщина дуг', () => VIEW.arcWidth, upd('arcWidth'), 0.1, 2, 0.05);
  range('Высота дуг', () => VIEW.arcHeight, upd('arcHeight'), 0.05, 0.6, 0.01);
  range('Подъём точек', () => VIEW.markerElevation, upd('markerElevation'), 0, 0.2, 0.005);

  const dots = (key) => (v) => {
    DOT[key] = v;
    globe.update({ markers: buildMarkers() });
  };
  range('Размер Бишкека', () => DOT.origin, dots('origin'), 0, 0.12, 0.002);
  range('Размер городов', () => DOT.city, dots('city'), 0, 0.12, 0.002);

  add('<hr>');
  add('<h4>Подписи стран</h4>');
  range('Граница ухода', () => LABELS.edge, (v) => (LABELS.edge = v), 0.5, 1, 0.01);
  range('Появление и уход, с', () => LABELS.time, (v) => (LABELS.time = v), 0.1, 1.5, 0.05);

  add('<hr>');
  add('<h4>Орбита</h4>');
  range('Круг, град/с', () => ORBIT.ring, (v) => (ORBIT.ring = v), 0, 40, 0.5);
  range('Стрелки, град/с', () => ORBIT.arrows, (v) => (ORBIT.arrows = v), 0, 40, 0.5);
  range('Стрелки, усиление', () => ORBIT.arrowRush, (v) => (ORBIT.arrowRush = v), 1, 8, 0.1);

  add('<hr>');
  add('<h4>Хвосты маршрутов</h4>');
  range('Скорость полёта', () => TRAIL.speed, (v) => (TRAIL.speed = v), 0.1, 2, 0.05);
  range('Длина хвоста', () => TRAIL.dash, (v) => (TRAIL.dash = v), 0.05, 1, 0.01);
  range('Пауза', () => TRAIL.pause, (v) => (TRAIL.pause = v), 0, 4, 0.1);
  range('Разбежка маршрутов', () => TRAIL.stagger, (v) => (TRAIL.stagger = v), 0, 2, 0.05);

  add('<hr>');
  add('<h4>Движение</h4>');
  range('Вращение', () => MOTION.spin, (v) => (MOTION.spin = v), 0, 1.5, 0.02);
  range('Разгон, потолок', () => SCROLL.max, (v) => (SCROLL.max = v), 0, 4, 0.1);
  range('Разгон, сила', () => SCROLL.boost, (v) => (SCROLL.boost = v), 0, 0.003, 0.0001);

  add('<hr>');
  const out = add('<textarea readonly></textarea>');
  const copy = add('<button type="button">Скопировать настройки</button>');
  const hide = add('<button type="button" class="is--ghost">Спрятать панель</button>');

  const snippet = () =>
    `const VIEW = {\n` +
    `  theta: ${VIEW.theta},\n  dark: ${VIEW.dark},\n  diffuse: ${VIEW.diffuse},\n` +
    `  mapSamples: ${VIEW.mapSamples},\n  mapBrightness: ${VIEW.mapBrightness},\n` +
    `  mapBaseBrightness: ${VIEW.mapBaseBrightness},\n` +
    `  baseColor: [${VIEW.baseColor.map((v) => +v.toFixed(3))}],\n` +
    `  markerColor: [${VIEW.markerColor.map((v) => +v.toFixed(3))}],\n` +
    `  glowColor: [${VIEW.glowColor.map((v) => +v.toFixed(3))}],\n` +
    `  arcColor: [${VIEW.arcColor.map((v) => +v.toFixed(3))}],\n` +
    `  markerElevation: ${VIEW.markerElevation},\n  arcWidth: ${VIEW.arcWidth},\n` +
    `  arcHeight: ${VIEW.arcHeight}\n};\n\n` +
    `const DOT = { origin: ${DOT.origin}, city: ${DOT.city} };\n` +
    `const MOTION = { spin: ${MOTION.spin} };\n` +
    `SCROLL.max = ${SCROLL.max}; SCROLL.boost = ${SCROLL.boost};`;

  copy.addEventListener('click', () => {
    out.value = snippet();
    out.classList.add('is--on');
    out.select();
    navigator.clipboard?.writeText(out.value).catch(() => {});
    copy.textContent = 'Скопировано — вставить в js/globe.js';
    setTimeout(() => (copy.textContent = 'Скопировать настройки'), 2000);
  });

  hide.addEventListener('click', () => panel.remove());

  return { panel, snippet };
}
