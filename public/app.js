const editor = document.getElementById('editor');
const optimizeBtn = document.getElementById('optimizeBtn');
const statusText = document.getElementById('status');
const inlineSuggestionBox = document.getElementById('inlineSuggestion');
const acceptSuggestionBtn = document.getElementById('acceptSuggestionBtn');
const dismissSuggestionBtn = document.getElementById('dismissSuggestionBtn');

let inlineSuggestion = '';
let suggestionRequestTimer;
let suggestionRequestId = 0;

function setStatus(message) {
  statusText.textContent = message;
}

function setInlineSuggestion(text) {
  inlineSuggestion = text || '';
  inlineSuggestionBox.textContent = inlineSuggestion || 'Şu an öneri yok.';
  acceptSuggestionBtn.disabled = !inlineSuggestion;
}

async function requestAI(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payloadError = await response.json().catch(() => ({}));
    throw new Error(payloadError.error || 'AI isteği başarısız oldu.');
  }

  return response.json();
}

function insertAtCursor(text) {
  const end = editor.selectionEnd;
  const current = editor.value;

  editor.value = `${current.slice(0, end)}${text}${current.slice(end)}`;

  const caret = end + text.length;
  editor.selectionStart = caret;
  editor.selectionEnd = caret;
  editor.focus();
}

function applyInlineSuggestion() {
  if (!inlineSuggestion) {
    return;
  }

  insertAtCursor(inlineSuggestion);
  setInlineSuggestion('');
  setStatus('Öneri eklendi.');
}

async function fetchInlineSuggestion() {
  const code = editor.value;
  const cursor = editor.selectionEnd;

  if (!code.trim() || editor.selectionStart !== editor.selectionEnd) {
    setInlineSuggestion('');
    return;
  }

  const currentRequest = ++suggestionRequestId;

  try {
    const { suggestion } = await requestAI('/api/inline-suggest', { code, cursor });

    if (currentRequest !== suggestionRequestId) {
      return;
    }

    setInlineSuggestion(suggestion);
    if (suggestion) {
      setStatus('Sağ panelde AI satır önerisi hazır. Tab ile ekleyebilirsiniz.');
    }
  } catch (error) {
    if (currentRequest === suggestionRequestId) {
      setInlineSuggestion('');
      setStatus(`Hata: ${error.message}`);
    }
  }
}

function scheduleInlineSuggestion() {
  clearTimeout(suggestionRequestTimer);
  suggestionRequestTimer = setTimeout(fetchInlineSuggestion, 650);
}

editor.addEventListener('input', scheduleInlineSuggestion);
editor.addEventListener('click', scheduleInlineSuggestion);

editor.addEventListener('keydown', async (event) => {
  if (event.key === 'Tab' && inlineSuggestion) {
    event.preventDefault();
    applyInlineSuggestion();
    return;
  }

  if (!(event.altKey && event.code === 'Space')) {
    return;
  }

  event.preventDefault();

  const code = editor.value.trim();
  if (!code) {
    setStatus('Tamamlama için önce kod girin.');
    return;
  }

  try {
    setStatus('AI tamamlama hazırlanıyor...');
    const { suggestion } = await requestAI('/api/complete', { code: editor.value });
    insertAtCursor(suggestion ? `\n${suggestion}` : '');
    setStatus('Tamamlama eklendi.');
    scheduleInlineSuggestion();
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  }
});

acceptSuggestionBtn.addEventListener('click', applyInlineSuggestion);

dismissSuggestionBtn.addEventListener('click', () => {
  setInlineSuggestion('');
  setStatus('Öneri kapatıldı.');
  editor.focus();
});

optimizeBtn.addEventListener('click', async () => {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const hasSelection = start !== end;

  const codeToOptimize = hasSelection ? editor.value.slice(start, end) : editor.value;

  if (!codeToOptimize.trim()) {
    setStatus('Optimize etmek için kod veya seçim gerekli.');
    return;
  }

  optimizeBtn.disabled = true;

  try {
    setStatus('Kod optimize ediliyor...');
    const { optimizedCode } = await requestAI('/api/optimize', { code: codeToOptimize });

    if (hasSelection) {
      editor.setRangeText(optimizedCode, start, end, 'end');
    } else {
      editor.value = optimizedCode;
    }

    setStatus('Kod optimize edildi.');
    scheduleInlineSuggestion();
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  } finally {
    optimizeBtn.disabled = false;
    editor.focus();
  }
});

setInlineSuggestion('');
