const editor = document.getElementById('editor');
const optimizeBtn = document.getElementById('optimizeBtn');
const statusText = document.getElementById('status');

function setStatus(message) {
  statusText.textContent = message;
}

async function requestAI(endpoint, code) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'AI isteği başarısız oldu.');
  }

  return response.json();
}

function insertAtCursor(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const current = editor.value;

  editor.value = `${current.slice(0, end)}${text}${current.slice(end)}`;

  const caret = end + text.length;
  editor.selectionStart = caret;
  editor.selectionEnd = caret;
  editor.focus();
}

editor.addEventListener('keydown', async (event) => {
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
    const { suggestion } = await requestAI('/api/complete', editor.value);
    insertAtCursor(suggestion ? `\n${suggestion}` : '');
    setStatus('Tamamlama eklendi.');
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  }
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
    const { optimizedCode } = await requestAI('/api/optimize', codeToOptimize);

    if (hasSelection) {
      editor.setRangeText(optimizedCode, start, end, 'end');
    } else {
      editor.value = optimizedCode;
    }

    setStatus('Kod optimize edildi.');
  } catch (error) {
    setStatus(`Hata: ${error.message}`);
  } finally {
    optimizeBtn.disabled = false;
    editor.focus();
  }
});
