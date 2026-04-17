
const form     = document.getElementById('search-form');
const input    = document.getElementById('word-input');
const loader   = document.getElementById('loader');
const errorMsg = document.getElementById('error-msg');
const results  = document.getElementById('results');

function showLoader()   { loader.style.display = 'block'; }
function hideLoader()   { loader.style.display = 'none';  }
function clearResults() { results.innerHTML = ''; results.style.display = 'none'; }
function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = 'block'; }
function clearError()   { errorMsg.style.display = 'none'; errorMsg.textContent = ''; }

async function fetchWord(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Word not found');
  return response.json();
}

function getPhoneticInfo(data) {
  let phonetic = '', audioUrl = '';
  for (const entry of data) {
    for (const ph of (entry.phonetics || [])) {
      if (!phonetic && ph.text)  phonetic = ph.text;
      if (!audioUrl && ph.audio) audioUrl = ph.audio;
    }
    if (!phonetic && entry.phonetic) phonetic = entry.phonetic;
    if (phonetic && audioUrl) break;
  }
  return { phonetic, audioUrl };
}

function getAllSynonyms(data) {
  const set = new Set();
  for (const entry of data) {
    for (const meaning of (entry.meanings || [])) {
      for (const def of (meaning.definitions || [])) {
        (def.synonyms || []).forEach(s => set.add(s));
      }
      (meaning.synonyms || []).forEach(s => set.add(s));
    }
  }
  return [...set].slice(0, 20);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderResults(data) {
  clearResults();
  results.style.display = 'flex';

  const word = data[0].word;
  const { phonetic, audioUrl } = getPhoneticInfo(data);
  const synonyms = getAllSynonyms(data);
  const sources  = [...new Set(data.flatMap(d => d.sourceUrls || []))];

  // Word Hero
  const hero = document.createElement('div');
  hero.className = 'word-hero';
  hero.innerHTML = `
    <div>
      <div class="word-title">${escapeHtml(word)}</div>
      ${phonetic ? `<div class="phonetic">${escapeHtml(phonetic)}</div>` : ''}
    </div>
    ${audioUrl ? `
    <button class="audio-btn" aria-label="Play pronunciation" title="Play pronunciation">
      <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
    </button>` : ''}
  `;

  if (audioUrl) {
    const audioEl = new Audio(audioUrl);
    hero.querySelector('.audio-btn').addEventListener('click', () => audioEl.play());
  }
  results.appendChild(hero);

  // Meaning Cards
  const allMeanings = data.flatMap(entry => entry.meanings || []);
  const seen = new Set();
  for (const meaning of allMeanings) {
    const pos = meaning.partOfSpeech || 'general';
    if (seen.has(pos)) continue;
    seen.add(pos);

    const card = document.createElement('div');
    card.className = 'meaning-card';
    const defs = (meaning.definitions || []).slice(0, 5);

    card.innerHTML = `
      <span class="part-of-speech">${escapeHtml(pos)}</span>
      <ol class="def-list">
        ${defs.map((d, i) => `
          <li class="def-item">
            <span class="def-num">${i + 1}.</span>
            <div class="def-text">
              ${escapeHtml(d.definition)}
              ${d.example ? `<em class="def-example">"${escapeHtml(d.example)}"</em>` : ''}
            </div>
          </li>
        `).join('')}
      </ol>
    `;
    results.appendChild(card);
  }

  // Synonyms
  if (synonyms.length) {
    const synCard = document.createElement('div');
    synCard.className = 'synonyms-card';
    synCard.innerHTML = `
      <p class="section-label">Synonyms</p>
      <div class="tags" aria-label="Synonyms">
        ${synonyms.map(s => `<span class="tag" tabindex="0" role="button">${escapeHtml(s)}</span>`).join('')}
      </div>
    `;
    synCard.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', () => {
        input.value = tag.textContent;
        doSearch(tag.textContent);
      });
      tag.addEventListener('keydown', e => { if (e.key === 'Enter') tag.click(); });
    });
    results.appendChild(synCard);
  }

  // Sources
  if (sources.length) {
    const srcDiv = document.createElement('div');
    srcDiv.className = 'source-row';
    srcDiv.innerHTML = `<span>Source:</span>
      ${sources.map(u => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a>`).join(', ')}`;
    results.appendChild(srcDiv);
  }
}

async function doSearch(word) {
  word = word.trim();
  if (!word) {
    clearError();
    showError('Please enter a word before searching.');
    return;
  }
  clearError();
  clearResults();
  showLoader();
  try {
    const data = await fetchWord(word);
    renderResults(data);
  } catch (err) {
    showError(`❌ "${word}" was not found. Please check your spelling and try again.`);
  } finally {
    hideLoader();
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  doSearch(input.value);
});