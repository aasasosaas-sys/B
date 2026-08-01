// Gist-based Ranking Integration (ブラウザ側実装)
// 保存: localStorage に gist-id / gist-token を保存します。
// 使い方:
//  - Gist設定で Gist ID と（書き込みする場合は）Personal Access Token を入力 -> 「設定を保存する」ボタン
//  - 「更新」ボタンで fetchOnlineRanking() を呼ぶ
//  - 「自分の記録を送信」ボタンで submitScoreToGist() を呼ぶ

const GIST_API_BASE = 'https://api.github.com/gists';

function loadGistSettingsToUI() {
  try {
    const id = localStorage.getItem('ranking_gist_id') || '';
    const token = localStorage.getItem('ranking_gist_token') || '';
    const idInput = document.getElementById('gist-id-input');
    const tokenInput = document.getElementById('gist-token-input');
    if (idInput) idInput.value = id;
    if (tokenInput) tokenInput.value = token;
    const status = document.getElementById('gist-status-text');
    if (status) status.textContent = id ? 'Gist ID設定済み' : 'Gist ID未設定';
  } catch (e) {
    console.error('loadGistSettingsToUI', e);
  }
}

function saveGistSettings() {
  const idEl = document.getElementById('gist-id-input');
  const tokenEl = document.getElementById('gist-token-input');
  if (!idEl) return alert('Gist ID 入力欄が見つかりません');
  const id = idEl.value.trim();
  const token = tokenEl ? tokenEl.value.trim() : '';
  if (!id) return alert('Gist ID を入力してください。');
  localStorage.setItem('ranking_gist_id', id);
  if (token) localStorage.setItem('ranking_gist_token', token);
  const status = document.getElementById('gist-status-text');
  if (status) status.textContent = 'Gist ID設定済み';
  if (typeof hideGistConfigModal === 'function') hideGistConfigModal();
  fetchOnlineRanking();
}

function getStoredGistId() {
  return localStorage.getItem('ranking_gist_id') || (document.getElementById('gist-id-input')?.value || '').trim();
}
function getStoredGistToken() {
  return localStorage.getItem('ranking_gist_token') || (document.getElementById('gist-token-input')?.value || '').trim();
}

async function fetchOnlineRanking() {
  const gistId = getStoredGistId();
  const container = document.getElementById('ranking-list-container');
  if (!container) return;
  if (!gistId) {
    container.innerHTML = '<div class="text-xs text-rose-400">Gist ID が設定されていません。Gist設定を確認してください。</div>';
    return;
  }
  container.innerHTML = '<div class="text-center text-xs text-slate-400 py-6">読み込み中…</div>';
  try {
    const res = await fetch(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`);
    if (!res.ok) throw new Error(`Gist取得エラー: ${res.status}`);
    const gist = await res.json();
    const file = gist.files && gist.files['ranking.json'];
    if (!file || !file.content) {
      container.innerHTML = '<div class="text-xs text-rose-400">ranking.json が見つかりません。</div>';
      return;
    }
    let parsed = {};
    try { parsed = JSON.parse(file.content); } catch (e) { parsed = {}; }
    renderRankingList(parsed.entries || []);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="text-xs text-rose-400">取得失敗: ${escapeHtml(err.message)}</div>`;
  }
}

function renderRankingList(entries) {
  const container = document.getElementById('ranking-list-container');
  if (!container) return;
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400">まだ記録がありません。</div>';
    return;
  }
  entries.sort((a,b) => (b.score||0) - (a.score||0));
  container.innerHTML = '';
  entries.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'p-3 bg-slate-800/60 border border-slate-700 rounded-xl flex items-center justify-between';
    el.innerHTML = `
      <div>
        <div class="text-sm font-bold text-amber-300">${i+1}. ${escapeHtml(e.name || '---')}</div>
        <div class="text-[11px] text-slate-400">${escapeHtml(e.stage ? `Stage ${e.stage}` : '')} ${e.atk ? ` • ATK ${escapeHtml(String(e.atk))}` : ''}</div>
      </div>
      <div class="text-right">
        <div class="text-lg font-black text-rose-400">${Number(e.score||0).toLocaleString()}</div>
        <div class="text-[11px] text-slate-400">${e.time ? escapeHtml(new Date(e.time).toLocaleString()) : ''}</div>
      </div>
    `;
    container.appendChild(el);
  });
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// スコア送信: name で既存エントリを上書き（スコアは高い方を優先する挙動）
async function submitScoreToGist() {
  const gistId = getStoredGistId();
  const token = getStoredGistToken();
  if (!gistId) { alert('Gist ID を設定してください。'); return; }
  if (!token) {
    alert('書き込みには Personal Access Token が必要です（gist スコープ）。Gist設定で入力してください。');
    return;
  }

  // プレイヤーデータ取得（UI の要素名に合わせて取得）
  const playerName = (document.getElementById('dash-player-name')?.textContent || document.getElementById('ranking-my-name')?.textContent || '名無し').trim();
  // スコアはアプリ側で管理している可能性があるため window.currentScore を優先
  const scoreFromWindow = typeof window.currentScore === 'number' ? window.currentScore : null;
  let score = scoreFromWindow;
  if (score === null) {
    const scoreText = document.getElementById('score-display')?.textContent || '';
    const digits = scoreText.replace(/[^\d]/g, '');
    score = digits ? Number(digits) : 0;
  }
  const stage = Number(document.getElementById('enemy-stage')?.textContent || 0);
  const atk = Number(document.getElementById('player-atk-display')?.textContent || 0);

  const newEntry = {
    name: playerName || '名無し',
    score: Number(score || 0),
    stage: Number(stage || 0),
    atk: Number(atk || 0),
    time: new Date().toISOString()
  };

  try {
    // 最新を取得してマージ
    const getRes = await fetch(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`);
    if (!getRes.ok) throw new Error(`Gist取得失敗: ${getRes.status}`);
    const gist = await getRes.json();
    let entries = [];
    const file = gist.files && gist.files['ranking.json'];
    if (file && file.content) {
      try { entries = JSON.parse(file.content).entries || []; } catch(e) { entries = []; }
    }

    const idx = entries.findIndex(x => (x.name || '').trim() === newEntry.name.trim());
    if (idx >= 0) {
      if ((newEntry.score || 0) > (entries[idx].score || 0)) {
        entries[idx] = newEntry;
      } else {
        // スコアが下回る場合は上書きしない（方針により変更可）
      }
    } else {
      entries.push(newEntry);
    }

    entries.sort((a,b) => (b.score||0) - (a.score||0));
    entries = entries.slice(0, 200); // 保存上限（任意）

    const patchRes = await fetch(`${GIST_API_BASE}/${encodeURIComponent(gistId)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'ranking.json': {
            content: JSON.stringify({ entries }, null, 2)
          }
        }
      })
    });

    if (!patchRes.ok) {
      const txt = await patchRes.text();
      throw new Error(`更新失敗: ${patchRes.status} ${txt}`);
    }

    alert('スコアを送信しました。ランキングを更新します。');
    fetchOnlineRanking();
  } catch (err) {
    console.error(err);
    alert('ランキング送信に失敗しました: ' + (err.message || err));
  }
}

// 初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadGistSettingsToUI();
    // fetchOnlineRanking(); // 自動読み込みするならコメントを外す
  });
} else {
  loadGistSettingsToUI();
}
