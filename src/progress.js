// 過關進度：存在瀏覽器的 localStorage，每個模式各記「最多連續過到第幾關」。
// 讀不到、內容損毀或數字不合理，一律當作還沒過關；存不進去（例如私密瀏覽）就只記在這次開啟的記憶體裡。
window.PD = window.PD || {};

PD.Progress = (function () {
  const KEY = 'pd.progress.v1';
  let memory = null;

  function read() {
    if (memory) return memory;
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      if (data && typeof data === 'object' && data.v === 1) return data;
    } catch (e) { /* 損毀或無法讀取：當作沒有進度 */ }
    return { v: 1 };
  }

  function cleared(mode) {
    const n = read()[mode];
    return Number.isInteger(n) && n >= 0 && n <= PD.config.levels.length ? n : 0;
  }

  return {
    KEY,
    cleared,
    isCleared: (mode, number) => number <= cleared(mode),
    isUnlocked: (mode, number) => number <= cleared(mode) + 1,
    markCleared(mode, number) {
      if (number <= cleared(mode)) return;
      const data = Object.assign({}, read(), { v: 1, [mode]: number });
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        memory = null;
      } catch (e) {
        memory = data;
      }
    },
  };
})();
