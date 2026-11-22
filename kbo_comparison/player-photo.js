const KBOPlayerPhoto = (() => {
  const photoRoot = 'https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person';
  let seasons;

  function fallbackSeason(id, year) {
    if (!seasons) {
      seasons = new Map();
      for (const records of [battingData, pitchingData]) {
        for (const {Id, Season} of records) {
          const playerId = String(Id);
          if (!seasons.has(playerId)) seasons.set(playerId, new Set());
          seasons.get(playerId).add(Number(Season));
        }
      }
    }
    const alternatives = [...(seasons.get(id) || [])].filter(season => season !== year);
    return Math.max(...alternatives);
  }

  function markup(playerId, season) {
    const id = String(playerId);
    const year = Number(season);
    let image = '';
    if (/^\d{5}$/.test(id) && Number.isInteger(year) && year >= 1982 && year < 2100) {
      const fallback = fallbackSeason(id, year);
      const years = Number.isFinite(fallback) ? [year, fallback] : [year];
      const [source, ...alternatives] = years.flatMap(photoYear => [
        `middle/${photoYear}/${id}.jpg`,
        `kbo/${photoYear}/${id}.png`,
      ]);
      image = `<img src="${photoRoot}/${source}" alt="" decoding="async" referrerpolicy="no-referrer" data-photo-id="${id}" data-photo-alternatives="${alternatives.join(' ')}">`;
    }
    return `<span class="player-portrait" aria-hidden="true">${image}</span>`;
  }

  document.addEventListener('load', event => {
    const image = event.target;
    if (image.dataset?.photoId) image.setAttribute('data-photo-loaded', '');
  }, true);
  document.addEventListener('error', event => {
    const image = event.target;
    if (!image.dataset?.photoId) return;
    const [next, ...remaining] = image.dataset.photoAlternatives.split(' ');
    if (!next) {
      image.hidden = true;
      return;
    }
    image.dataset.photoAlternatives = remaining.join(' ');
    image.src = `${photoRoot}/${next}`;
  }, true);

  return {markup};
})();
