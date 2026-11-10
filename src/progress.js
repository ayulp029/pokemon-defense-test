// 過關進度：存在瀏覽器的 localStorage，每個模式各記「最多連續過到第幾關」，以及每一關拿過最多幾顆星。
// 讀不到、內容損毀或數字不合理，一律當作還沒過關／沒有星星；存不進去（例如私密瀏覽）就只記在這次開啟的記憶體裡。
// 內容例如 {"v":1,"solo":2,"together":1,"stars":{"solo":{"1":3,"2":1},"together":{"1":2}}}
window.PD = window.PD || {};

PD.Progress = (function () {
  const KEY = 'pd.progress.v1';
  let memory = null;

  function read() {
    if (memory) return memory;
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (data && typeof data === 'object' && !Array.isArray(data) && data.v === 1) return data;
    } catch (e) { /* 損毀或無法讀取：當作沒有進度 */ }
    return { v: 1 };
  }

  function write(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      memory = null;
    } catch (e) {
      memory = data;
    }
  }

  function cleared(mode) {
    const n = read()[mode];
    return Number.isInteger(n) && n >= 0 && n <= PD.config.levels.length ? n : 0;
  }

  // 這一模式每一關的星星表；不是物件就當作沒有
  function starTable(data, mode) {
    const all = data.stars;
    if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
    const t = all[mode];
    return t && typeof t === 'object' && !Array.isArray(t) ? t : {};
  }

  // 0＝沒有紀錄（沒過關、舊存檔或內容不合理）；1～3＝拿過最多幾顆
  function stars(mode, number) {
    if (number > cleared(mode)) return 0;
    const n = starTable(read(), mode)[number];
    return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 0;
  }

  return {
    KEY,
    cleared,
    stars,
    isCleared: (mode, number) => number <= cleared(mode),
    isUnlocked: (mode, number) => number <= cleared(mode) + 1,
    // 過關：進度只會往前；星星只保留最好的一次（回傳這次是不是新紀錄）
    markCleared(mode, number, earned) {
      const before = stars(mode, number);
      const better = Number.isInteger(earned) && earned >= 1 && earned <= 3 && earned > before;
      if (number <= cleared(mode) && !better) return false;
      const data = Object.assign({}, read(), { v: 1 });
      if (number > cleared(mode)) data[mode] = number;
      if (better) {
        const all = Object.assign({}, data.stars && typeof data.stars === 'object' && !Array.isArray(data.stars) ? data.stars : {});
        all[mode] = Object.assign({}, starTable(data, mode), { [number]: earned });
        data.stars = all;
      }
      write(data);
      return better;
    },
  };
})();
