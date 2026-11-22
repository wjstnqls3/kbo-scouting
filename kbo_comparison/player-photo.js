const KBOPlayerPhoto = (() => {
  const photoRoot = 'https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle';
  const photoUrl = (id, year) => `${photoRoot}/${year}/${id}.jpg`;
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
      image = `<img src="${photoUrl(id, year)}" alt="" decoding="async" data-photo-id="${id}"${Number.isFinite(fallback) ? ` data-photo-fallback="${fallback}"` : ''}>`;
    }
    return `<span class="player-portrait" aria-hidden="true">${image}</span>`;
  }

  document.addEventListener('load', event => {
    const image = event.target;
    if (image.dataset?.photoId) image.setAttribute('data-photo-loaded', '');
  }, true);
  document.addEventListener('error', event => {
    const image = event.target;
    const {photoId, photoFallback} = image.dataset || {};
    if (!photoId || !photoFallback) return;
    image.removeAttribute('data-photo-fallback');
    image.src = photoUrl(photoId, photoFallback);
  }, true);

  return {markup};
})();
