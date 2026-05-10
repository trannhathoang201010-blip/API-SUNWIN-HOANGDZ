const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const API_URL = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const LEARNING_FILE = 'learning_data.json';
const HISTORY_FILE = 'prediction_history.json';
const TELEGRAM_ID = '@tranhoang2286';

let predictionHistory = { b52: [] };
const MAX_HISTORY = 100;
const AUTO_SAVE_INTERVAL = 5000;
let lastProcessedPhien = { b52: null };

let learningData = {
  b52: {
    predictions: [],
    patternStats: {},
    totalPredictions: 0,
    correctPredictions: 0,
    patternWeights: {},
    lastUpdate: null,
    streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
    adaptiveThresholds: {},
    recentAccuracy: [],
    reversalState: { active: false, activatedAt: null, consecutiveLosses: 0, reversalCount: 0, lastReversalResult: null },
    transitionMatrix: { 'Tài->Tài': 0, 'Tài->Xỉu': 0, 'Xỉu->Tài': 0, 'Xỉu->Xỉu': 0 }
  }
};

const DEFAULT_PATTERN_WEIGHTS = {
  'cau_bet': 1.3, 'cau_dao_11': 1.2, 'cau_22': 1.15, 'cau_33': 1.2, 'cau_121': 1.1,
  'cau_123': 1.1, 'cau_321': 1.1, 'cau_nhay_coc': 1.0, 'cau_nhip_nghieng': 1.15,
  'cau_3van1': 1.2, 'cau_be_cau': 1.25, 'cau_chu_ky': 1.1, 'distribution': 0.9,
  'dice_pattern': 1.0, 'sum_trend': 1.05, 'edge_cases': 1.1, 'momentum': 1.15,
  'cau_tu_nhien': 0.8, 'dice_trend_line': 1.2, 'break_pattern': 1.3, 'fibonacci': 1.0,
  'resistance_support': 1.15, 'wave': 1.1, 'golden_ratio': 1.0, 'day_gay': 1.25,
  'cau_44': 1.2, 'cau_55': 1.25, 'cau_212': 1.1, 'cau_1221': 1.15, 'cau_2112': 1.15,
  'cau_gap': 1.1, 'cau_ziczac': 1.2, 'cau_doi': 1.15, 'cau_rong': 1.3,
  'smart_bet': 1.2, 'markov_chain': 1.35, 'moving_avg_drift': 1.2, 'sum_pressure': 1.25,
  'volatility': 1.15, 'sun_hot_cold': 1.3, 'sun_streak_break': 1.35, 'sun_balance': 1.2,
  'sun_momentum_shift': 1.25
};

const REVERSAL_THRESHOLD = 3;

function loadLearningData() {
  try { if (fs.existsSync(LEARNING_FILE)) { const d = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8')); if (d.b52) learningData = { ...learningData, ...d }; } } catch(e) {}
}

function saveLearningData() {
  try { fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2)); } catch(e) {}
}

function loadPredictionHistory() {
  try { if (fs.existsSync(HISTORY_FILE)) { const d = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); if (d.history?.b52) predictionHistory = d.history; if (d.lastProcessedPhien?.b52) lastProcessedPhien = d.lastProcessedPhien; } } catch(e) {}
}

function savePredictionHistory() {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify({ history: predictionHistory, lastProcessedPhien, lastSaved: new Date().toISOString() }, null, 2)); } catch(e) {}
}

async function fetchData() {
  try {
    const response = await axios.get(API_URL, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const rawData = response.data;
    if (rawData && rawData.phien) {
      const currentPhien = { Phien: parseInt(rawData.phien), Ket_qua: parseInt(rawData.tong) >= 11 ? 'Tài' : 'Xỉu', xuc_xac_1: rawData.xuc_xac_1, xuc_xac_2: rawData.xuc_xac_2, xuc_xac_3: rawData.xuc_xac_3, tong: parseInt(rawData.tong) || 0 };
      return { data: [currentPhien] };
    }
    return null;
  } catch(e) { return null; }
}

function normalizeResult(result) {
  if (result === 'Tài' || result === 'tai' || result === 'T') return 'tai';
  return 'xiu';
}

function getPatternIdFromName(name) {
  const mapping = { 'Cầu Bệt': 'cau_bet', 'Cầu Đảo 1-1': 'cau_dao_11', 'Cầu 2-2': 'cau_22', 'Cầu 3-3': 'cau_33', 'Cầu 1-2-1': 'cau_121', 'Cầu 1-2-3': 'cau_123', 'Cầu 3-2-1': 'cau_321', 'Cầu Nhảy Cóc': 'cau_nhay_coc', 'Cầu Nhịp Nghiêng': 'cau_nhip_nghieng', 'Cầu 3 Ván 1': 'cau_3van1', 'Cầu Bẻ Cầu': 'cau_be_cau', 'Cầu Chu Kỳ': 'cau_chu_ky', 'Cầu Rồng': 'cau_rong', 'Đảo Xu Hướng': 'smart_bet', 'Cầu Tự Nhiên': 'cau_tu_nhien', 'Biểu Đồ Đường': 'dice_trend_line', 'Cầu Liên Tục': 'break_pattern', 'Dây Gãy': 'day_gay' };
  for (const [k, v] of Object.entries(mapping)) { if (name.includes(k)) return v; }
  return null;
}

function initializePatternStats(type) {
  if (!learningData[type].patternWeights || Object.keys(learningData[type].patternWeights).length === 0) learningData[type].patternWeights = { ...DEFAULT_PATTERN_WEIGHTS };
  Object.keys(DEFAULT_PATTERN_WEIGHTS).forEach(p => { if (!learningData[type].patternStats[p]) learningData[type].patternStats[p] = { total: 0, correct: 0, accuracy: 0.5, recentResults: [], lastAdjustment: null }; });
}

function getPatternWeight(type, patternId) { initializePatternStats(type); return learningData[type].patternWeights[patternId] || 1.0; }

function updatePatternPerformance(type, patternId, isCorrect) {
  initializePatternStats(type);
  const stats = learningData[type].patternStats[patternId];
  if (!stats) return;
  stats.total++; if (isCorrect) stats.correct++;
  stats.recentResults.push(isCorrect ? 1 : 0); if (stats.recentResults.length > 20) stats.recentResults.shift();
  const recentAccuracy = stats.recentResults.reduce((a, b) => a + b, 0) / stats.recentResults.length;
  stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0.5;
  const oldWeight = learningData[type].patternWeights[patternId];
  let newWeight = oldWeight;
  if (stats.recentResults.length >= 5) { if (recentAccuracy > 0.6) newWeight = Math.min(2.0, oldWeight * 1.05); else if (recentAccuracy < 0.4) newWeight = Math.max(0.3, oldWeight * 0.95); }
  learningData[type].patternWeights[patternId] = newWeight;
  stats.lastAdjustment = new Date().toISOString();
}

function recordPrediction(type, phien, prediction, confidence, patterns) {
  learningData[type].predictions.unshift({ phien: phien.toString(), prediction, confidence, patterns, timestamp: new Date().toISOString(), verified: false, actual: null, isCorrect: null });
  learningData[type].totalPredictions++;
  if (learningData[type].predictions.length > 500) learningData[type].predictions = learningData[type].predictions.slice(0, 500);
  saveLearningData();
}

async function verifyPredictions(type, currentData) {
  let updated = false;
  for (const pred of learningData[type].predictions) {
    if (pred.verified) continue;
    const actualResult = currentData.find(d => d.Phien.toString() === pred.phien);
    if (actualResult) {
      pred.verified = true; pred.actual = actualResult.Ket_qua;
      const predictedNormalized = pred.prediction === 'Tài' || pred.prediction === 'tai' ? 'Tài' : 'Xỉu';
      pred.isCorrect = pred.actual === predictedNormalized;
      if (pred.isCorrect) { learningData[type].correctPredictions++; learningData[type].streakAnalysis.wins++; if (learningData[type].streakAnalysis.currentStreak >= 0) learningData[type].streakAnalysis.currentStreak++; else learningData[type].streakAnalysis.currentStreak = 1; if (learningData[type].streakAnalysis.currentStreak > learningData[type].streakAnalysis.bestStreak) learningData[type].streakAnalysis.bestStreak = learningData[type].streakAnalysis.currentStreak; }
      else { learningData[type].streakAnalysis.losses++; if (learningData[type].streakAnalysis.currentStreak <= 0) learningData[type].streakAnalysis.currentStreak--; else learningData[type].streakAnalysis.currentStreak = -1; if (learningData[type].streakAnalysis.currentStreak < learningData[type].streakAnalysis.worstStreak) learningData[type].streakAnalysis.worstStreak = learningData[type].streakAnalysis.currentStreak; }
      learningData[type].recentAccuracy.push(pred.isCorrect ? 1 : 0); if (learningData[type].recentAccuracy.length > 50) learningData[type].recentAccuracy.shift();
      if (pred.patterns?.length > 0) pred.patterns.forEach(p => { const pid = getPatternIdFromName(p); if (pid) updatePatternPerformance(type, pid, pred.isCorrect); });
      updated = true;
    }
  }
  if (updated) { learningData[type].lastUpdate = new Date().toISOString(); saveLearningData(); }
}

function getAdaptiveConfidenceBoost(type) {
  const recentAcc = learningData[type].recentAccuracy;
  if (recentAcc.length < 10) return 0;
  const accuracy = recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length;
  if (accuracy > 0.65) return 5; if (accuracy > 0.55) return 2;
  if (accuracy < 0.4) return -5; if (accuracy < 0.45) return -2;
  return 0;
}

function getSmartPredictionAdjustment(type, prediction, patterns) {
  if (learningData[type].streakAnalysis.currentStreak <= -5) return prediction === 'Tài' ? 'Xỉu' : 'Tài';
  return prediction;
}

function applyAutoReversal(type, prediction) {
  const rs = learningData[type].reversalState;
  if (learningData[type].streakAnalysis.currentStreak <= -REVERSAL_THRESHOLD && !rs.active) { rs.active = true; rs.activatedAt = new Date().toISOString(); rs.reversalCount++; }
  if (rs.active) { return { prediction: prediction === 'Tài' ? 'Xỉu' : 'Tài', reversed: true, originalPrediction: prediction }; }
  return { prediction, reversed: false };
}

function updateReversalState(type, isCorrect) {
  const rs = learningData[type].reversalState;
  if (isCorrect && rs.active) { rs.active = false; rs.lastReversalResult = 'success'; rs.consecutiveLosses = 0; }
  if (!isCorrect) rs.consecutiveLosses++; else rs.consecutiveLosses = 0;
}

function analyzeBet(results, type) {
  if (results.length < 3) return { detected: false };
  let streakType = results[0], streakLength = 1;
  for (let i = 1; i < results.length; i++) { if (results[i] === streakType) streakLength++; else break; }
  if (streakLength >= 3) {
    const weight = getPatternWeight(type, 'cau_bet');
    let shouldBreak = streakLength >= 6;
    return { detected: true, prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType, confidence: Math.round((shouldBreak ? Math.min(12, streakLength * 2) : Math.min(15, streakLength * 3)) * weight), name: `Cầu Bệt ${streakLength} phiên`, patternId: 'cau_bet' };
  }
  return { detected: false };
}

function analyzeDao11(results, type) {
  if (results.length < 4) return { detected: false };
  let altLen = 1;
  for (let i = 1; i < Math.min(results.length, 10); i++) { if (results[i] !== results[i - 1]) altLen++; else break; }
  if (altLen >= 4) {
    const weight = getPatternWeight(type, 'cau_dao_11');
    return { detected: true, prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.round(Math.min(14, altLen * 2 + 4) * weight), name: `Cầu Đảo 1-1 (${altLen} phiên)`, patternId: 'cau_dao_11' };
  }
  return { detected: false };
}

function analyze22(results, type) {
  if (results.length < 6) return { detected: false };
  let pairCount = 0, i = 0, pattern = [];
  while (i < results.length - 1 && pairCount < 4) { if (results[i] === results[i + 1]) { pattern.push(results[i]); pairCount++; i += 2; } else break; }
  if (pairCount >= 2 && pattern.every((v, idx, arr) => idx === 0 || v !== arr[idx - 1])) {
    const weight = getPatternWeight(type, 'cau_22');
    return { detected: true, prediction: pattern[pattern.length - 1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.round(Math.min(12, pairCount * 3 + 3) * weight), name: `Cầu 2-2 (${pairCount} cặp)`, patternId: 'cau_22' };
  }
  return { detected: false };
}

function analyze33(results, type) {
  if (results.length < 6) return { detected: false };
  let tripleCount = 0, i = 0, pattern = [];
  while (i < results.length - 2) { if (results[i] === results[i + 1] && results[i + 1] === results[i + 2]) { pattern.push(results[i]); tripleCount++; i += 3; } else break; }
  if (tripleCount >= 1) {
    const weight = getPatternWeight(type, 'cau_33');
    const pred = (results.length % 3 === 0) ? (pattern[pattern.length - 1] === 'Tài' ? 'Xỉu' : 'Tài') : pattern[pattern.length - 1];
    return { detected: true, prediction: pred, confidence: Math.round(Math.min(13, tripleCount * 4 + 5) * weight), name: `Cầu 3-3`, patternId: 'cau_33' };
  }
  return { detected: false };
}

function analyze121(results, type) {
  if (results.length < 4) return { detected: false };
  const p = results.slice(0, 4);
  if (p[0] !== p[1] && p[1] === p[2] && p[2] !== p[3] && p[0] === p[3]) {
    const weight = getPatternWeight(type, 'cau_121');
    return { detected: true, prediction: p[0], confidence: Math.round(10 * weight), name: 'Cầu 1-2-1', patternId: 'cau_121' };
  }
  return { detected: false };
}

function analyzeHoiCau(lastTong) {
  if (lastTong >= 17) return { pred: 'X', conf: 93, name: 'HỒI CỰC ĐẠI' };
  if (lastTong <= 4) return { pred: 'T', conf: 93, name: 'HỒI CỰC TIỂU' };
  if (lastTong >= 15) return { pred: 'X', conf: 78, name: 'HỒI CAO' };
  if (lastTong <= 5) return { pred: 'T', conf: 78, name: 'HỒI THẤP' };
  return null;
}

function analyzeNghieng(history, type) {
  const len = history.length;
  if (len < 8) return { detected: false };
  const str = history.map(h => h.kq).join('');
  const tCount = history.filter(h => h.kq === 'T').length;
  const tRate = tCount / len;
  if (tRate >= 0.75 && str.endsWith('TT')) return { detected: true, prediction: 'Tài', confidence: 82, name: 'NGHIÊNG TÀI', patternId: 'cau_nhip_nghieng' };
  if (tRate <= 0.25 && str.endsWith('XX')) return { detected: true, prediction: 'Xỉu', confidence: 82, name: 'NGHIÊNG XỈU', patternId: 'cau_nhip_nghieng' };
  if (tRate >= 0.7) return { detected: true, prediction: 'Xỉu', confidence: 72, name: 'BẺ TÀI', patternId: 'cau_nhip_nghieng' };
  if (tRate <= 0.3) return { detected: true, prediction: 'Tài', confidence: 72, name: 'BẺ XỈU', patternId: 'cau_nhip_nghieng' };
  return { detected: false };
}

function calculateAdvancedPrediction(data, type) {
  const last50 = data.slice(0, 50);
  const results = last50.map(d => d.Ket_qua);
  initializePatternStats(type);
  
  let predictions = [], factors = [], allPatterns = [];

  const bet = analyzeBet(results, type); if (bet.detected) { predictions.push({ prediction: bet.prediction, confidence: bet.confidence, priority: 10, name: bet.name }); factors.push(bet.name); allPatterns.push(bet); }
  const dao11 = analyzeDao11(results, type); if (dao11.detected) { predictions.push({ prediction: dao11.prediction, confidence: dao11.confidence, priority: 9, name: dao11.name }); factors.push(dao11.name); allPatterns.push(dao11); }
  const c22 = analyze22(results, type); if (c22.detected) { predictions.push({ prediction: c22.prediction, confidence: c22.confidence, priority: 8, name: c22.name }); factors.push(c22.name); allPatterns.push(c22); }
  const c33 = analyze33(results, type); if (c33.detected) { predictions.push({ prediction: c33.prediction, confidence: c33.confidence, priority: 8, name: c33.name }); factors.push(c33.name); allPatterns.push(c33); }
  const c121 = analyze121(results, type); if (c121.detected) { predictions.push({ prediction: c121.prediction, confidence: c121.confidence, priority: 7, name: c121.name }); factors.push(c121.name); allPatterns.push(c121); }

  const lastTong = data[0]?.tong || 10;
  const hoi = analyzeHoiCau(lastTong);
  if (hoi) { predictions.push({ prediction: hoi.pred === 'T' ? 'Tài' : 'Xỉu', confidence: hoi.conf, priority: 11, name: hoi.name }); factors.push(hoi.name); }

  const nghieng = analyzeNghieng(results.map((r, i) => ({ kq: r === 'Tài' ? 'T' : 'X' })), type);
  if (nghieng.detected) { predictions.push({ prediction: nghieng.prediction, confidence: nghieng.confidence, priority: 7, name: nghieng.name }); factors.push(nghieng.name); }

  if (predictions.length === 0) {
    const lastKQ = results[0];
    predictions.push({ prediction: lastKQ === 'Tài' ? 'Xỉu' : 'Tài', confidence: 50, priority: 1, name: 'ĐÁNH NGƯỢC' });
  }

  predictions.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
  const taiVotes = predictions.filter(p => p.prediction === 'Tài');
  const xiuVotes = predictions.filter(p => p.prediction === 'Xỉu');
  const taiScore = taiVotes.reduce((s, p) => s + p.confidence * p.priority, 0);
  const xiuScore = xiuVotes.reduce((s, p) => s + p.confidence * p.priority, 0);
  
  let finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  finalPrediction = getSmartPredictionAdjustment(type, finalPrediction, allPatterns);
  
  let baseConfidence = 50;
  predictions.slice(0, 3).forEach(p => { if (p.prediction === finalPrediction) baseConfidence += p.confidence; });
  baseConfidence += Math.round((finalPrediction === 'Tài' ? taiVotes.length : xiuVotes.length) / predictions.length * 10);
  baseConfidence += getAdaptiveConfidenceBoost(type);
  let finalConfidence = Math.max(50, Math.min(85, Math.round(baseConfidence + (Math.random() * 4 - 2))));

  const reversalResult = applyAutoReversal(type, finalPrediction);
  return { prediction: reversalResult.prediction, confidence: finalConfidence, factors, allPatterns, reversed: reversalResult.reversed };
}

function savePredictionToHistory(type, phien, prediction, confidence) {
  const record = { phien_hien_tai: phien.toString(), du_doan: normalizeResult(prediction), ti_le: `${confidence}%`, id: TELEGRAM_ID, timestamp: new Date().toISOString() };
  predictionHistory[type].unshift(record);
  if (predictionHistory[type].length > MAX_HISTORY) predictionHistory[type] = predictionHistory[type].slice(0, MAX_HISTORY);
  return record;
}

async function autoProcessPredictions() {
  try {
    const data = await fetchData();
    if (!data?.data?.length) return;
    const latestPhien = data.data[0].Phien;
    const nextPhien = latestPhien + 1;
    if (lastProcessedPhien.b52 !== nextPhien) {
      await verifyPredictions('b52', data.data);
      const result = calculateAdvancedPrediction(data.data, 'b52');
      savePredictionToHistory('b52', nextPhien, result.prediction, result.confidence);
      recordPrediction('b52', nextPhien, result.prediction, result.confidence, result.factors);
      lastProcessedPhien.b52 = nextPhien;
      console.log(`[Auto] Sun phien ${nextPhien}: ${result.prediction} (${result.confidence}%)`);
    }
    savePredictionHistory(); saveLearningData();
  } catch(e) { console.error('[Auto] Error:', e.message); }
}

function startAutoSaveTask() {
  console.log(`Auto-save started (every ${AUTO_SAVE_INTERVAL/1000}s)`);
  setTimeout(() => autoProcessPredictions(), 5000);
  setInterval(() => autoProcessPredictions(), AUTO_SAVE_INTERVAL);
}

app.get('/', (req, res) => { res.send('t.me/CuTools - Sun Prediction API - ' + TELEGRAM_ID); });

app.get('/api/predict', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data?.data?.length) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    await verifyPredictions('b52', data.data);
    const sunData = data.data;
    const latestPhien = sunData[0].Phien;
    const nextPhien = latestPhien + 1;
    const result = calculateAdvancedPrediction(sunData, 'b52');
    savePredictionToHistory('b52', nextPhien, result.prediction, result.confidence);
    recordPrediction('b52', nextPhien, result.prediction, result.confidence, result.factors);
    res.json({ status: 'success', id: TELEGRAM_ID, phien_hien_tai: nextPhien, du_doan: normalizeResult(result.prediction) === 'tai' ? 'TÀI' : 'XỈU', ti_le: `${result.confidence}%`, cau: result.factors?.[0] || 'N/A' });
  } catch(e) { res.status(500).json({ error: 'Lỗi server' }); }
});

app.get('/api/history', async (req, res) => {
  try {
    const data = await fetchData();
    if (data?.data) await verifyPredictions('b52', data.data);
    const historyWithStatus = predictionHistory.b52.map(record => {
      const pred = learningData.b52.predictions.find(p => p.phien === record.phien_hien_tai);
      return { ...record, ket_qua_thuc_te: pred?.actual || null, status: pred?.verified ? (pred.isCorrect ? '✅ ĐÚNG' : '❌ SAI') : '⏳ CHỜ' };
    });
    res.json({ id: TELEGRAM_ID, total: historyWithStatus.length, history: historyWithStatus });
  } catch(e) { res.json({ id: TELEGRAM_ID, history: predictionHistory.b52, total: predictionHistory.b52.length }); }
});

app.get('/api/reset', (req, res) => { predictionHistory = { b52: [] }; lastProcessedPhien = { b52: null }; res.json({ status: 'success', message: 'Đã reset lịch sử!' }); });

app.get('/api/stats', (req, res) => {
  const rs = learningData.b52.reversalState || {};
  res.json({ id: TELEGRAM_ID, totalPredictions: learningData.b52.totalPredictions, correctPredictions: learningData.b52.correctPredictions, accuracy: learningData.b52.totalPredictions > 0 ? (learningData.b52.correctPredictions / learningData.b52.totalPredictions * 100).toFixed(1) + '%' : 'N/A', currentStreak: learningData.b52.streakAnalysis.currentStreak, bestStreak: learningData.b52.streakAnalysis.bestStreak, autoReversal: { active: rs.active || false, totalReversals: rs.reversalCount || 0 } });
});

loadLearningData();
loadPredictionHistory();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sun Prediction API - ${TELEGRAM_ID} - Port: ${PORT}`);
  console.log('  GET /api/predict - Dự đoán');
  console.log('  GET /api/history - Lịch sử + Đúng/Sai');
  console.log('  GET /api/reset  - Reset');
  console.log('  GET /api/stats  - Thống kê');
  startAutoSaveTask();
});
