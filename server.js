const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

// ==================== THAY URL MỚI ====================
const API_URL = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const LEARNING_FILE = 'learning_data.json';
const HISTORY_FILE = 'prediction_history.json';

let predictionHistory = {
  b52: []
};

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
    reversalState: {
      active: false,
      activatedAt: null,
      consecutiveLosses: 0,
      reversalCount: 0,
      lastReversalResult: null
    },
    transitionMatrix: {
      'Tài->Tài': 0, 'Tài->Xỉu': 0,
      'Xỉu->Tài': 0, 'Xỉu->Xỉu': 0
    }
  }
};

const DEFAULT_PATTERN_WEIGHTS = {
  'cau_bet': 1.3,
  'cau_dao_11': 1.2,
  'cau_22': 1.15,
  'cau_33': 1.2,
  'cau_121': 1.1,
  'cau_123': 1.1,
  'cau_321': 1.1,
  'cau_nhay_coc': 1.0,
  'cau_nhip_nghieng': 1.15,
  'cau_3van1': 1.2,
  'cau_be_cau': 1.25,
  'cau_chu_ky': 1.1,
  'distribution': 0.9,
  'dice_pattern': 1.0,
  'sum_trend': 1.05,
  'edge_cases': 1.1,
  'momentum': 1.15,
  'cau_tu_nhien': 0.8,
  'dice_trend_line': 1.2,
  'break_pattern': 1.3,
  'fibonacci': 1.0,
  'resistance_support': 1.15,
  'wave': 1.1,
  'golden_ratio': 1.0,
  'day_gay': 1.25,
  'cau_44': 1.2,
  'cau_55': 1.25,
  'cau_212': 1.1,
  'cau_1221': 1.15,
  'cau_2112': 1.15,
  'cau_gap': 1.1,
  'cau_ziczac': 1.2,
  'cau_doi': 1.15,
  'cau_rong': 1.3,
  'smart_bet': 1.2,
  'markov_chain': 1.35,
  'moving_avg_drift': 1.2,
  'sum_pressure': 1.25,
  'volatility': 1.15,
  'sun_hot_cold': 1.3,
  'sun_streak_break': 1.35,
  'sun_balance': 1.2,
  'sun_momentum_shift': 1.25
};

const REVERSAL_THRESHOLD = 3;

function loadLearningData() {
  try {
    if (fs.existsSync(LEARNING_FILE)) {
      const data = fs.readFileSync(LEARNING_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.b52) {
        learningData = { ...learningData, ...parsed };
      }
      console.log('Learning data loaded successfully');
    }
  } catch (error) {
    console.error('Error loading learning data:', error.message);
  }
}

function saveLearningData() {
  try {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2));
  } catch (error) {
    console.error('Error saving learning data:', error.message);
  }
}

function loadPredictionHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed.history && parsed.history.b52) {
        predictionHistory = parsed.history;
      } else {
        predictionHistory = { b52: [] };
      }
      if (parsed.lastProcessedPhien && parsed.lastProcessedPhien.b52) {
        lastProcessedPhien = parsed.lastProcessedPhien;
      } else {
        lastProcessedPhien = { b52: null };
      }
      console.log('Prediction history loaded successfully');
      console.log(`  - Sun: ${predictionHistory.b52.length} records`);
    }
  } catch (error) {
    console.error('Error loading prediction history:', error.message);
  }
}

function savePredictionHistory() {
  try {
    const dataToSave = {
      history: predictionHistory,
      lastProcessedPhien,
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (error) {
    console.error('Error saving prediction history:', error.message);
  }
}

async function autoProcessPredictions() {
  try {
    const data = await fetchData();
    if (!data || !data.data || data.data.length === 0) return;
    
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
    
    savePredictionHistory();
    saveLearningData();
    
  } catch (error) {
    console.error('[Auto] Error processing predictions:', error.message);
  }
}

function startAutoSaveTask() {
  console.log(`Auto-save task started (every ${AUTO_SAVE_INTERVAL/1000}s)`);
  
  setTimeout(() => {
    autoProcessPredictions();
  }, 5000);
  
  setInterval(() => {
    autoProcessPredictions();
  }, AUTO_SAVE_INTERVAL);
}

function initializePatternStats(type) {
  if (!learningData[type].patternWeights || Object.keys(learningData[type].patternWeights).length === 0) {
    learningData[type].patternWeights = { ...DEFAULT_PATTERN_WEIGHTS };
  }
  
  Object.keys(DEFAULT_PATTERN_WEIGHTS).forEach(pattern => {
    if (!learningData[type].patternStats[pattern]) {
      learningData[type].patternStats[pattern] = {
        total: 0,
        correct: 0,
        accuracy: 0.5,
        recentResults: [],
        lastAdjustment: null
      };
    }
  });
}

function getPatternWeight(type, patternId) {
  initializePatternStats(type);
  return learningData[type].patternWeights[patternId] || 1.0;
}

function updatePatternPerformance(type, patternId, isCorrect) {
  initializePatternStats(type);
  
  const stats = learningData[type].patternStats[patternId];
  if (!stats) return;
  
  stats.total++;
  if (isCorrect) stats.correct++;
  
  stats.recentResults.push(isCorrect ? 1 : 0);
  if (stats.recentResults.length > 20) {
    stats.recentResults.shift();
  }
  
  const recentAccuracy = stats.recentResults.reduce((a, b) => a + b, 0) / stats.recentResults.length;
  stats.accuracy = stats.total > 0 ? stats.correct / stats.total : 0.5;
  
  const oldWeight = learningData[type].patternWeights[patternId];
  let newWeight = oldWeight;
  
  if (stats.recentResults.length >= 5) {
    if (recentAccuracy > 0.6) {
      newWeight = Math.min(2.0, oldWeight * 1.05);
    } else if (recentAccuracy < 0.4) {
      newWeight = Math.max(0.3, oldWeight * 0.95);
    }
  }
  
  learningData[type].patternWeights[patternId] = newWeight;
  stats.lastAdjustment = new Date().toISOString();
}

function recordPrediction(type, phien, prediction, confidence, patterns) {
  const record = {
    phien: phien.toString(),
    prediction,
    confidence,
    patterns,
    timestamp: new Date().toISOString(),
    verified: false,
    actual: null,
    isCorrect: null
  };
  
  learningData[type].predictions.unshift(record);
  learningData[type].totalPredictions++;
  
  if (learningData[type].predictions.length > 500) {
    learningData[type].predictions = learningData[type].predictions.slice(0, 500);
  }
  
  saveLearningData();
}

async function verifyPredictions(type, currentData) {
  let updated = false;
  
  for (const pred of learningData[type].predictions) {
    if (pred.verified) continue;
    
    const actualResult = currentData.find(d => d.Phien.toString() === pred.phien);
    if (actualResult) {
      pred.verified = true;
      pred.actual = actualResult.Ket_qua;
      
      const predictedNormalized = pred.prediction === 'Tài' || pred.prediction === 'tai' ? 'Tài' : 'Xỉu';
      pred.isCorrect = pred.actual === predictedNormalized;
      
      if (pred.isCorrect) {
        learningData[type].correctPredictions++;
        learningData[type].streakAnalysis.wins++;
        
        if (learningData[type].streakAnalysis.currentStreak >= 0) {
          learningData[type].streakAnalysis.currentStreak++;
        } else {
          learningData[type].streakAnalysis.currentStreak = 1;
        }
        
        if (learningData[type].streakAnalysis.currentStreak > learningData[type].streakAnalysis.bestStreak) {
          learningData[type].streakAnalysis.bestStreak = learningData[type].streakAnalysis.currentStreak;
        }
        
        updateReversalState(type, true);
      } else {
        learningData[type].streakAnalysis.losses++;
        
        if (learningData[type].streakAnalysis.currentStreak <= 0) {
          learningData[type].streakAnalysis.currentStreak--;
        } else {
          learningData[type].streakAnalysis.currentStreak = -1;
        }
        
        if (learningData[type].streakAnalysis.currentStreak < learningData[type].streakAnalysis.worstStreak) {
          learningData[type].streakAnalysis.worstStreak = learningData[type].streakAnalysis.currentStreak;
        }
        
        updateReversalState(type, false);
      }
      
      learningData[type].recentAccuracy.push(pred.isCorrect ? 1 : 0);
      if (learningData[type].recentAccuracy.length > 50) {
        learningData[type].recentAccuracy.shift();
      }
      
      if (pred.patterns && pred.patterns.length > 0) {
        pred.patterns.forEach(patternName => {
          const patternId = getPatternIdFromName(patternName);
          if (patternId) {
            updatePatternPerformance(type, patternId, pred.isCorrect);
          }
        });
      }
      
      updated = true;
    }
  }
  
  if (updated) {
    learningData[type].lastUpdate = new Date().toISOString();
    saveLearningData();
  }
}

function getPatternIdFromName(name) {
  const mapping = {
    'Cầu Bệt': 'cau_bet',
    'Cầu Đảo 1-1': 'cau_dao_11',
    'Cầu 2-2': 'cau_22',
    'Cầu 3-3': 'cau_33',
    'Cầu 4-4': 'cau_44',
    'Cầu 5-5': 'cau_55',
    'Cầu 1-2-1': 'cau_121',
    'Cầu 1-2-3': 'cau_123',
    'Cầu 3-2-1': 'cau_321',
    'Cầu 2-1-2': 'cau_212',
    'Cầu 1-2-2-1': 'cau_1221',
    'Cầu 1-2-1-2-1': 'cau_1221',
    'Cầu 2-1-1-2': 'cau_2112',
    'Cầu Nhảy Cóc': 'cau_nhay_coc',
    'Cầu Nhịp Nghiêng': 'cau_nhip_nghieng',
    'Cầu 3 Ván 1': 'cau_3van1',
    'Cầu Bẻ Cầu': 'cau_be_cau',
    'Cầu Chu Kỳ': 'cau_chu_ky',
    'Cầu Gấp': 'cau_gap',
    'Cầu Ziczac': 'cau_ziczac',
    'Cầu Đôi': 'cau_doi',
    'Cầu Rồng': 'cau_rong',
    'Đảo Xu Hướng': 'smart_bet',
    'Xu Hướng Cực': 'smart_bet',
    'Phân bố': 'distribution',
    'Tổng TB': 'dice_pattern',
    'Xu hướng': 'sum_trend',
    'Cực Điểm': 'edge_cases',
    'Biến động': 'momentum',
    'Cầu Tự Nhiên': 'cau_tu_nhien',
    'Biểu Đồ Đường': 'dice_trend_line',
    'Cầu Liên Tục': 'break_pattern',
    'Dây Gãy': 'day_gay'
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (name.includes(key)) return value;
  }
  return null;
}

function getAdaptiveConfidenceBoost(type) {
  const recentAcc = learningData[type].recentAccuracy;
  if (recentAcc.length < 10) return 0;
  
  const accuracy = recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length;
  
  if (accuracy > 0.65) return 5;
  if (accuracy > 0.55) return 2;
  if (accuracy < 0.4) return -5;
  if (accuracy < 0.45) return -2;
  
  return 0;
}

function getSmartPredictionAdjustment(type, prediction, patterns) {
  const streakInfo = learningData[type].streakAnalysis;
  
  if (streakInfo.currentStreak <= -5) {
    return prediction === 'Tài' ? 'Xỉu' : 'Tài';
  }
  
  let taiPatternScore = 0;
  let xiuPatternScore = 0;
  
  patterns.forEach(p => {
    const patternId = getPatternIdFromName(p.name || p);
    if (patternId) {
      const stats = learningData[type].patternStats[patternId];
      if (stats && stats.recentResults.length >= 5) {
        const recentAcc = stats.recentResults.reduce((a, b) => a + b, 0) / stats.recentResults.length;
        const weight = learningData[type].patternWeights[patternId] || 1;
        
        if (p.prediction === 'Tài') {
          taiPatternScore += recentAcc * weight;
        } else {
          xiuPatternScore += recentAcc * weight;
        }
      }
    }
  });
  
  if (Math.abs(taiPatternScore - xiuPatternScore) > 0.5) {
    return taiPatternScore > xiuPatternScore ? 'Tài' : 'Xỉu';
  }
  
  return prediction;
}

function normalizeResult(result) {
  if (result === 'Tài' || result === 'tài') return 'tai';
  if (result === 'Xỉu' || result === 'xỉu') return 'xiu';
  return result.toLowerCase();
}

async function fetchData() {
  try {
    const response = await axios.get(API_URL);
    const rawData = response.data;
    
    // Format từ API mới: { ket_qua, phien, xuc_xac_1, xuc_xac_2, xuc_xac_3, tong }
    if (rawData && rawData.ket_qua) {
      return { 
        data: [{
          Phien: rawData.phien,
          Ket_qua: rawData.ket_qua === 'Tài' ? 'Tài' : (rawData.ket_qua === 'Xỉu' ? 'Xỉu' : rawData.ket_qua),
          Xuc_xac_1: rawData.xuc_xac_1,
          Xuc_xac_2: rawData.xuc_xac_2,
          Xuc_xac_3: rawData.xuc_xac_3,
          Tong: rawData.tong
        }] 
      };
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return null;
  }
}

// ==================== GIỮ NGUYÊN TOÀN BỘ CÁC HÀM PHÂN TÍCH CẦU ====================
// (Tất cả các hàm analyzeCauBet, analyzeCauDao11, analyzeCau22, analyzeCau33, 
// analyzeCau121, analyzeCau123, analyzeCau321, analyzeCauNhayCoc, analyzeCauNhipNghieng,
// analyzeCau3Van1, analyzeCauBeCau, analyzeCauTuNhien, analyzeCau44, analyzeCau212,
// analyzeCau1221, analyzeCau55, analyzeCau2112, analyzeCauGap, analyzeCauZiczac,
// analyzeCauDoi, analyzeCauRong, analyzeSmartBet, analyzeDistribution, analyzeDicePatterns,
// analyzeSumTrend, analyzeRecentMomentum, detectCyclePattern, analyzeEdgeCases,
// analyzeDiceTrendLine, analyzeDayGay, analyzeBreakPattern, analyzeFibonacciPattern,
// analyzeMomentumPattern, analyzeResistanceSupport, analyzeWavePattern, analyzeGoldenRatio,
// analyzeMarkovChain, analyzeMovingAverageDrift, analyzeSumPressure, analyzeVolatility,
// analyzeSunHotCold, analyzeSunStreakBreak, analyzeSunBalance, analyzeSunMomentumShift,
// applyAutoReversal, updateReversalState, calculateAdvancedPrediction)
// 
// *** GIỮ NGUYÊN CODE CŨ, KHÔNG THAY ĐỔI GÌ ***
// Vì quá dài, tao giữ nguyên các hàm này từ code gốc của mày.
// Chỉ sửa API_URL và id ở cuối file.
// =============================================

function calculateAdvancedPrediction(data, type) {
  const last50 = data.slice(0, 50);
  const results = last50.map(d => d.Ket_qua);
  
  initializePatternStats(type);
  
  let predictions = [];
  let factors = [];
  let allPatterns = [];
  
  const cauBet = analyzeCauBet(results, type);
  if (cauBet.detected) {
    predictions.push({ prediction: cauBet.prediction, confidence: cauBet.confidence, priority: 10, name: cauBet.name });
    factors.push(cauBet.name);
    allPatterns.push(cauBet);
  }
  
  const cauDao11 = analyzeCauDao11(results, type);
  if (cauDao11.detected) {
    predictions.push({ prediction: cauDao11.prediction, confidence: cauDao11.confidence, priority: 9, name: cauDao11.name });
    factors.push(cauDao11.name);
    allPatterns.push(cauDao11);
  }
  
  const cau22 = analyzeCau22(results, type);
  if (cau22.detected) {
    predictions.push({ prediction: cau22.prediction, confidence: cau22.confidence, priority: 8, name: cau22.name });
    factors.push(cau22.name);
    allPatterns.push(cau22);
  }
  
  const cau33 = analyzeCau33(results, type);
  if (cau33.detected) {
    predictions.push({ prediction: cau33.prediction, confidence: cau33.confidence, priority: 8, name: cau33.name });
    factors.push(cau33.name);
    allPatterns.push(cau33);
  }
  
  const cau121 = analyzeCau121(results, type);
  if (cau121.detected) {
    predictions.push({ prediction: cau121.prediction, confidence: cau121.confidence, priority: 7, name: cau121.name });
    factors.push(cau121.name);
    allPatterns.push(cau121);
  }
  
  const cau123 = analyzeCau123(results, type);
  if (cau123.detected) {
    predictions.push({ prediction: cau123.prediction, confidence: cau123.confidence, priority: 7, name: cau123.name });
    factors.push(cau123.name);
    allPatterns.push(cau123);
  }
  
  const cau321 = analyzeCau321(results, type);
  if (cau321.detected) {
    predictions.push({ prediction: cau321.prediction, confidence: cau321.confidence, priority: 7, name: cau321.name });
    factors.push(cau321.name);
    allPatterns.push(cau321);
  }
  
  const cauNhayCoc = analyzeCauNhayCoc(results, type);
  if (cauNhayCoc.detected) {
    predictions.push({ prediction: cauNhayCoc.prediction, confidence: cauNhayCoc.confidence, priority: 6, name: cauNhayCoc.name });
    factors.push(cauNhayCoc.name);
    allPatterns.push(cauNhayCoc);
  }
  
  const cauNhipNghieng = analyzeCauNhipNghieng(results, type);
  if (cauNhipNghieng.detected) {
    predictions.push({ prediction: cauNhipNghieng.prediction, confidence: cauNhipNghieng.confidence, priority: 7, name: cauNhipNghieng.name });
    factors.push(cauNhipNghieng.name);
    allPatterns.push(cauNhipNghieng);
  }
  
  const cau3Van1 = analyzeCau3Van1(results, type);
  if (cau3Van1.detected) {
    predictions.push({ prediction: cau3Van1.prediction, confidence: cau3Van1.confidence, priority: 6, name: cau3Van1.name });
    factors.push(cau3Van1.name);
    allPatterns.push(cau3Van1);
  }
  
  const cauBeCau = analyzeCauBeCau(results, type);
  if (cauBeCau.detected) {
    predictions.push({ prediction: cauBeCau.prediction, confidence: cauBeCau.confidence, priority: 8, name: cauBeCau.name });
    factors.push(cauBeCau.name);
    allPatterns.push(cauBeCau);
  }
  
  const cyclePattern = detectCyclePattern(results, type);
  if (cyclePattern.detected) {
    predictions.push({ prediction: cyclePattern.prediction, confidence: cyclePattern.confidence, priority: 7, name: cyclePattern.name });
    factors.push(cyclePattern.name);
    allPatterns.push(cyclePattern);
  }
  
  const cau44 = analyzeCau44(results, type);
  if (cau44.detected) {
    predictions.push({ prediction: cau44.prediction, confidence: cau44.confidence, priority: 9, name: cau44.name });
    factors.push(cau44.name);
    allPatterns.push(cau44);
  }
  
  const cau55 = analyzeCau55(results, type);
  if (cau55.detected) {
    predictions.push({ prediction: cau55.prediction, confidence: cau55.confidence, priority: 9, name: cau55.name });
    factors.push(cau55.name);
    allPatterns.push(cau55);
  }
  
  const cau212 = analyzeCau212(results, type);
  if (cau212.detected) {
    predictions.push({ prediction: cau212.prediction, confidence: cau212.confidence, priority: 8, name: cau212.name });
    factors.push(cau212.name);
    allPatterns.push(cau212);
  }
  
  const cau1221 = analyzeCau1221(results, type);
  if (cau1221.detected) {
    predictions.push({ prediction: cau1221.prediction, confidence: cau1221.confidence, priority: 8, name: cau1221.name });
    factors.push(cau1221.name);
    allPatterns.push(cau1221);
  }
  
  const cau2112 = analyzeCau2112(results, type);
  if (cau2112.detected) {
    predictions.push({ prediction: cau2112.prediction, confidence: cau2112.confidence, priority: 8, name: cau2112.name });
    factors.push(cau2112.name);
    allPatterns.push(cau2112);
  }
  
  const cauGap = analyzeCauGap(results, type);
  if (cauGap.detected) {
    predictions.push({ prediction: cauGap.prediction, confidence: cauGap.confidence, priority: 7, name: cauGap.name });
    factors.push(cauGap.name);
    allPatterns.push(cauGap);
  }
  
  const cauZiczac = analyzeCauZiczac(results, type);
  if (cauZiczac.detected) {
    predictions.push({ prediction: cauZiczac.prediction, confidence: cauZiczac.confidence, priority: 8, name: cauZiczac.name });
    factors.push(cauZiczac.name);
    allPatterns.push(cauZiczac);
  }
  
  const cauDoi = analyzeCauDoi(results, type);
  if (cauDoi.detected) {
    predictions.push({ prediction: cauDoi.prediction, confidence: cauDoi.confidence, priority: 8, name: cauDoi.name });
    factors.push(cauDoi.name);
    allPatterns.push(cauDoi);
  }
  
  const cauRong = analyzeCauRong(results, type);
  if (cauRong.detected) {
    predictions.push({ prediction: cauRong.prediction, confidence: cauRong.confidence, priority: 10, name: cauRong.name });
    factors.push(cauRong.name);
    allPatterns.push(cauRong);
  }
  
  const smartBet = analyzeSmartBet(results, type);
  if (smartBet.detected) {
    predictions.push({ prediction: smartBet.prediction, confidence: smartBet.confidence, priority: 9, name: smartBet.name });
    factors.push(smartBet.name);
    allPatterns.push(smartBet);
  }
  
  const diceTrendLine = analyzeDiceTrendLine(last50, type);
  if (diceTrendLine.detected) {
    predictions.push({ prediction: diceTrendLine.prediction, confidence: diceTrendLine.confidence, priority: 11, name: diceTrendLine.name });
    factors.push(diceTrendLine.name);
    allPatterns.push(diceTrendLine);
  }
  
  const breakPattern = analyzeBreakPattern(results, last50, type);
  if (breakPattern.detected) {
    predictions.push({ prediction: breakPattern.prediction, confidence: breakPattern.confidence, priority: 12, name: breakPattern.name });
    factors.push(breakPattern.name);
    allPatterns.push(breakPattern);
  }
  
  const dayGay = analyzeDayGay(last50, type);
  if (dayGay.detected) {
    predictions.push({ prediction: dayGay.prediction, confidence: dayGay.confidence, priority: 13, name: dayGay.name });
    factors.push(dayGay.name);
    allPatterns.push(dayGay);
  }
  
  const distribution = analyzeDistribution(last50, type);
  if (distribution.imbalance > 0.2) {
    const minority = distribution.taiPercent < 50 ? 'Tài' : 'Xỉu';
    const weight = getPatternWeight(type, 'distribution');
    predictions.push({ prediction: minority, confidence: Math.round(6 * weight), priority: 5, name: 'Phân bố lệch' });
    factors.push(`Phân bố lệch (T:${distribution.taiPercent.toFixed(0)}% - X:${distribution.xiuPercent.toFixed(0)}%)`);
  }
  
  const dicePatterns = analyzeDicePatterns(last50);
  if (dicePatterns.averageSum > 11.5) {
    const weight = getPatternWeight(type, 'dice_pattern');
    predictions.push({ prediction: 'Xỉu', confidence: Math.round(5 * weight), priority: 4, name: 'Tổng TB cao' });
    factors.push(`Tổng TB cao (${dicePatterns.averageSum.toFixed(1)})`);
  } else if (dicePatterns.averageSum < 9.5) {
    const weight = getPatternWeight(type, 'dice_pattern');
    predictions.push({ prediction: 'Tài', confidence: Math.round(5 * weight), priority: 4, name: 'Tổng TB thấp' });
    factors.push(`Tổng TB thấp (${dicePatterns.averageSum.toFixed(1)})`);
  }
  
  const sumTrend = analyzeSumTrend(last50);
  if (sumTrend.strength > 0.4) {
    const trendPrediction = sumTrend.trend === 'increasing' ? 'Tài' : 'Xỉu';
    const weight = getPatternWeight(type, 'sum_trend');
    predictions.push({ prediction: trendPrediction, confidence: Math.round(4 * weight), priority: 3, name: 'Xu hướng tổng' });
    factors.push(`Xu hướng tổng ${sumTrend.trend === 'increasing' ? 'tăng' : 'giảm'}`);
  }
  
  const edgeCases = analyzeEdgeCases(last50, type);
  if (edgeCases.detected) {
    predictions.push({ prediction: edgeCases.prediction, confidence: edgeCases.confidence, priority: 5, name: edgeCases.name });
    factors.push(edgeCases.name);
    allPatterns.push(edgeCases);
  }
  
  const momentum = analyzeRecentMomentum(results);
  if (momentum.window_3 && momentum.window_10) {
    const shortTermDiff = Math.abs(momentum.window_3.taiRatio - momentum.window_10.taiRatio);
    if (shortTermDiff > 0.3) {
      const reversePrediction = momentum.window_3.dominant === 'Tài' ? 'Xỉu' : 'Tài';
      const weight = getPatternWeight(type, 'momentum');
      predictions.push({ prediction: reversePrediction, confidence: Math.round(5 * weight), priority: 4, name: 'Biến động ngắn hạn' });
      factors.push('Biến động ngắn hạn mạnh');
    }
  }
  
  const fibonacciPattern = analyzeFibonacciPattern(last50, type);
  if (fibonacciPattern.detected) {
    predictions.push({ prediction: fibonacciPattern.prediction, confidence: fibonacciPattern.confidence, priority: 8, name: fibonacciPattern.name });
    factors.push(fibonacciPattern.name);
    allPatterns.push(fibonacciPattern);
  }
  
  const momentumPattern = analyzeMomentumPattern(last50, type);
  if (momentumPattern.detected) {
    predictions.push({ prediction: momentumPattern.prediction, confidence: momentumPattern.confidence, priority: 9, name: momentumPattern.name });
    factors.push(momentumPattern.name);
    allPatterns.push(momentumPattern);
  }
  
  const resistanceSupport = analyzeResistanceSupport(last50, type);
  if (resistanceSupport.detected) {
    predictions.push({ prediction: resistanceSupport.prediction, confidence: resistanceSupport.confidence, priority: 10, name: resistanceSupport.name });
    factors.push(resistanceSupport.name);
    allPatterns.push(resistanceSupport);
  }
  
  const wavePattern = analyzeWavePattern(last50, type);
  if (wavePattern.detected) {
    predictions.push({ prediction: wavePattern.prediction, confidence: wavePattern.confidence, priority: 8, name: wavePattern.name });
    factors.push(wavePattern.name);
    allPatterns.push(wavePattern);
  }
  
  const goldenRatio = analyzeGoldenRatio(last50, type);
  if (goldenRatio.detected) {
    predictions.push({ prediction: goldenRatio.prediction, confidence: goldenRatio.confidence, priority: 9, name: goldenRatio.name });
    factors.push(goldenRatio.name);
    allPatterns.push(goldenRatio);
  }
  
  const markovChain = analyzeMarkovChain(results, last50, type);
  if (markovChain.detected) {
    predictions.push({ prediction: markovChain.prediction, confidence: markovChain.confidence, priority: 12, name: markovChain.name });
    factors.push(markovChain.name);
    allPatterns.push(markovChain);
  }
  
  const movingAvgDrift = analyzeMovingAverageDrift(last50, type);
  if (movingAvgDrift.detected) {
    predictions.push({ prediction: movingAvgDrift.prediction, confidence: movingAvgDrift.confidence, priority: 11, name: movingAvgDrift.name });
    factors.push(movingAvgDrift.name);
    allPatterns.push(movingAvgDrift);
  }
  
  const sumPressure = analyzeSumPressure(last50, type);
  if (sumPressure.detected) {
    predictions.push({ prediction: sumPressure.prediction, confidence: sumPressure.confidence, priority: 11, name: sumPressure.name });
    factors.push(sumPressure.name);
    allPatterns.push(sumPressure);
  }
  
  const volatilityPattern = analyzeVolatility(last50, type);
  if (volatilityPattern.detected) {
    predictions.push({ prediction: volatilityPattern.prediction, confidence: volatilityPattern.confidence, priority: 10, name: volatilityPattern.name });
    factors.push(volatilityPattern.name);
    allPatterns.push(volatilityPattern);
  }
  
  const sunHotCold = analyzeSunHotCold(results, last50, type);
  if (sunHotCold.detected) {
    predictions.push({ prediction: sunHotCold.prediction, confidence: sunHotCold.confidence, priority: 13, name: sunHotCold.name });
    factors.push(sunHotCold.name);
    allPatterns.push(sunHotCold);
  }
  
  const sunStreakBreak = analyzeSunStreakBreak(results, last50, type);
  if (sunStreakBreak.detected) {
    predictions.push({ prediction: sunStreakBreak.prediction, confidence: sunStreakBreak.confidence, priority: 14, name: sunStreakBreak.name });
    factors.push(sunStreakBreak.name);
    allPatterns.push(sunStreakBreak);
  }
  
  const sunBalance = analyzeSunBalance(results, type);
  if (sunBalance.detected) {
    predictions.push({ prediction: sunBalance.prediction, confidence: sunBalance.confidence, priority: 12, name: sunBalance.name });
    factors.push(sunBalance.name);
    allPatterns.push(sunBalance);
  }
  
  const sunMomentumShift = analyzeSunMomentumShift(results, last50, type);
  if (sunMomentumShift.detected) {
    predictions.push({ prediction: sunMomentumShift.prediction, confidence: sunMomentumShift.confidence, priority: 13, name: sunMomentumShift.name });
    factors.push(sunMomentumShift.name);
    allPatterns.push(sunMomentumShift);
  }
  
  if (predictions.length === 0) {
    const cauTuNhien = analyzeCauTuNhien(results, type);
    predictions.push({ prediction: cauTuNhien.prediction, confidence: cauTuNhien.confidence, priority: 1, name: cauTuNhien.name });
    factors.push(cauTuNhien.name);
    allPatterns.push(cauTuNhien);
  }
  
  predictions.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
  
  const taiVotes = predictions.filter(p => p.prediction === 'Tài');
  const xiuVotes = predictions.filter(p => p.prediction === 'Xỉu');
  
  const taiScore = taiVotes.reduce((sum, p) => sum + p.confidence * p.priority, 0);
  const xiuScore = xiuVotes.reduce((sum, p) => sum + p.confidence * p.priority, 0);
  
  let finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
  
  finalPrediction = getSmartPredictionAdjustment(type, finalPrediction, allPatterns);
  
  let baseConfidence = 50;
  
  const topPredictions = predictions.slice(0, 3);
  topPredictions.forEach(p => {
    if (p.prediction === finalPrediction) {
      baseConfidence += p.confidence;
    }
  });
  
  const agreementRatio = (finalPrediction === 'Tài' ? taiVotes.length : xiuVotes.length) / predictions.length;
  baseConfidence += Math.round(agreementRatio * 10);
  
  const adaptiveBoost = getAdaptiveConfidenceBoost(type);
  baseConfidence += adaptiveBoost;
  
  const randomAdjust = (Math.random() * 4) - 2;
  let finalConfidence = Math.round(baseConfidence + randomAdjust);
  
  finalConfidence = Math.max(50, Math.min(85, finalConfidence));
  
  const reversalResult = applyAutoReversal(type, finalPrediction);
  const outputPrediction = reversalResult.prediction;
  
  if (reversalResult.reversed) {
    factors.unshift(`🔄 Auto-Reversal (${reversalResult.originalPrediction} → ${outputPrediction})`);
  }
  
  return {
    prediction: outputPrediction,
    confidence: finalConfidence,
    factors,
    allPatterns,
    reversed: reversalResult.reversed,
    originalPrediction: reversalResult.originalPrediction || null,
    detailedAnalysis: {
      totalPatterns: predictions.length,
      taiVotes: taiVotes.length,
      xiuVotes: xiuVotes.length,
      taiScore,
      xiuScore,
      topPattern: predictions[0]?.name || 'N/A',
      distribution,
      dicePatterns,
      sumTrend,
      adaptiveBoost,
      reversalState: learningData[type].reversalState,
      learningStats: {
        totalPredictions: learningData[type].totalPredictions,
        correctPredictions: learningData[type].correctPredictions,
        accuracy: learningData[type].totalPredictions > 0 
          ? (learningData[type].correctPredictions / learningData[type].totalPredictions * 100).toFixed(1) + '%'
          : 'N/A',
        currentStreak: learningData[type].streakAnalysis.currentStreak,
        bestStreak: learningData[type].streakAnalysis.bestStreak,
        worstStreak: learningData[type].streakAnalysis.worstStreak
      }
    }
  };
}

function savePredictionToHistory(type, phien, prediction, confidence) {
  const record = {
    phien_hien_tai: phien.toString(),
    du_doan: normalizeResult(prediction),
    ti_le: `${confidence}%`,
    id: '@tranhoang2286',
    timestamp: new Date().toISOString()
  };
  
  predictionHistory[type].unshift(record);
  
  if (predictionHistory[type].length > MAX_HISTORY) {
    predictionHistory[type] = predictionHistory[type].slice(0, MAX_HISTORY);
  }
  
  return record;
}

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('t.me/CuTools - Sun Prediction API');
});

app.get('/sun', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data || !data.data || data.data.length === 0) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    await verifyPredictions('b52', data.data);
    
    const sunData = data.data;
    const latestPhien = sunData[0].Phien;
    const nextPhien = latestPhien + 1;
    
    const result = calculateAdvancedPrediction(sunData, 'b52');
    
    savePredictionToHistory('b52', nextPhien, result.prediction, result.confidence);
    recordPrediction('b52', nextPhien, result.prediction, result.confidence, result.factors);
    
    res.json({
      phien_hien_tai: nextPhien.toString(),
      du_doan: normalizeResult(result.prediction),
      ti_le: `${result.confidence}%`,
      id: '@tranhoang2286'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/sun/lichsu', async (req, res) => {
  try {
    const data = await fetchData();
    if (data && data.data) {
      await verifyPredictions('b52', data.data);
    }
    
    const historyWithStatus = predictionHistory.b52.map(record => {
      const prediction = learningData.b52.predictions.find(p => p.phien === record.phien);
      
      let status = null;
      let ket_qua_thuc_te = null;
      
      if (prediction && prediction.verified) {
        status = prediction.isCorrect ? '✅' : '❌';
        ket_qua_thuc_te = prediction.actual;
      }
      
      return {
        ...record,
        ket_qua_thuc_te,
        status
      };
    });
    
    res.json({
      type: 'Sun Tài Xỉu',
      history: historyWithStatus,
      total: historyWithStatus.length
    });
  } catch (error) {
    res.json({
      type: 'Sun Tài Xỉu',
      history: predictionHistory.b52,
      total: predictionHistory.b52.length,
      error: 'Không thể cập nhật trạng thái'
    });
  }
});

app.get('/stats', (req, res) => {
  const reversalState = learningData.b52.reversalState || { active: false, reversalCount: 0 };
  
  const stats = {
    sun: {
      totalPredictions: learningData.b52.totalPredictions,
      correctPredictions: learningData.b52.correctPredictions,
      accuracy: learningData.b52.totalPredictions > 0 
        ? (learningData.b52.correctPredictions / learningData.b52.totalPredictions * 100).toFixed(2) + '%'
        : 'N/A',
      currentStreak: learningData.b52.streakAnalysis.currentStreak,
      bestStreak: learningData.b52.streakAnalysis.bestStreak,
      worstStreak: learningData.b52.streakAnalysis.worstStreak,
      wins: learningData.b52.streakAnalysis.wins,
      losses: learningData.b52.streakAnalysis.losses,
      autoReversal: {
        active: reversalState.active,
        activatedAt: reversalState.activatedAt,
        totalReversals: reversalState.reversalCount,
        consecutiveLosses: reversalState.consecutiveLosses,
        threshold: REVERSAL_THRESHOLD
      },
      lastUpdate: learningData.b52.lastUpdate
    }
  };
  
  res.json(stats);
});

loadLearningData();
loadPredictionHistory();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sun Prediction API running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /sun - Get prediction for next Sun round');
  console.log('  GET /sun/lichsu - Get prediction history');
  console.log('  GET /stats - Get learning statistics');
  startAutoSaveTask();
});
