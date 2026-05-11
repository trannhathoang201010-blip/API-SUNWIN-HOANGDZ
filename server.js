const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== API NGUỒN ====================
const API_LC79_TX = 'https://wtx.tele68.com/v1/tx/sessions';
const API_LC79_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?cp=R&cl=R&pf=web&at=e2f4446802e76a39767a5bab32154970';
const API_HITCLUB = 'https://sun-win.onrender.com/api/history';
const API_BETVIP_MD5 = 'https://wtxmd52.macminim6.online/v1/txmd5/sessions';
const API_BETVIP_TX = 'https://wtx.macminim6.online/v1/tx/sessions';
const API_MAX789 = 'https://cage-adjustment-whose-banner.trycloudflare.com/api/tx';
const API_XOCDIA = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/xocdia';
const API_BCR = 'https://classic-watching-cup-representatives.trycloudflare.com/api/bcr';

// Cache lịch sử
let predictionsDB = {
    lc79_tx: [], lc79_md5: [], hitclub: [],
    betvip_tx: [], betvip_md5: [], max789: []
};

// ==================== LC79 DEEP ANALYTICS ENGINE - 30 THUẬT TOÁN ====================
class LC79DeepEngine {
  constructor() {
    this.performance = { wins: 0, losses: 0, streak: 0 };
    this.diceHistory = [];
    this.diceFaces = [];
    this.patterns = { cycle8: [], cycle13: [], bridge: [], extreme: [] };
    this.bayesStats = { order1: {}, order2: {}, order3: {}, order4: {}, order5: {} };
    this.algoWeights = {};
    for(let i=1; i<=30; i++) this.algoWeights[`LC79_${i}`] = 0.5;
    this.predictionCache = new Map();
  }

  learn(actual, historyArray, diceData) {
    if(!actual || historyArray.length < 2) return;
    for(let order=1; order<=5; order++) {
      if(historyArray.length > order) {
        const key = historyArray.slice(0, order).join('_');
        const stats = this.bayesStats[`order${order}`];
        if(!stats[key]) stats[key] = {TAI:0, XIU:0};
        stats[key][actual]++;
      }
    }
    if(diceData) {
      this.diceHistory.push(diceData);
      if(this.diceHistory.length > 200) this.diceHistory.shift();
      if(diceData.faces) {
        this.diceFaces.push(...diceData.faces);
        if(this.diceFaces.length > 600) this.diceFaces.splice(0, 300);
      }
    }
  }

  // 1. Bayes Order-1
  algo1_Bayes1(seq) {
    if(seq.length < 1) return null;
    const stats = this.bayesStats.order1[seq[0]];
    if(!stats) return null;
    const total = stats.TAI + stats.XIU;
    if(total < 5) return null;
    const prob = stats.TAI / total;
    return { pred: prob >= 0.5 ? 'TAI' : 'XIU', conf: Math.round(Math.max(prob, 1-prob)*100) };
  }

  // 2. Bayes Order-2
  algo2_Bayes2(seq) {
    if(seq.length < 2) return null;
    const key = `${seq[1]}_${seq[0]}`;
    const stats = this.bayesStats.order2[key];
    if(!stats) return null;
    const total = stats.TAI + stats.XIU;
    if(total < 4) return null;
    const prob = stats.TAI / total;
    return { pred: prob >= 0.5 ? 'TAI' : 'XIU', conf: Math.round(Math.max(prob, 1-prob)*100) };
  }

  // 3. Bayes Order-3
  algo3_Bayes3(seq) {
    if(seq.length < 3) return null;
    const key = `${seq[2]}_${seq[1]}_${seq[0]}`;
    const stats = this.bayesStats.order3[key];
    if(!stats) return null;
    const total = stats.TAI + stats.XIU;
    if(total < 3) return null;
    const prob = stats.TAI / total;
    return { pred: prob >= 0.5 ? 'TAI' : 'XIU', conf: Math.round(Math.max(prob, 1-prob)*100) };
  }

  // 4. Bayes Order-4
  algo4_Bayes4(seq) {
    if(seq.length < 4) return null;
    const key = `${seq[3]}_${seq[2]}_${seq[1]}_${seq[0]}`;
    const stats = this.bayesStats.order4[key];
    if(!stats) return null;
    const total = stats.TAI + stats.XIU;
    if(total < 3) return null;
    const prob = stats.TAI / total;
    return { pred: prob >= 0.5 ? 'TAI' : 'XIU', conf: Math.round(Math.max(prob, 1-prob)*100) };
  }

  // 5. Bayes Order-5
  algo5_Bayes5(seq) {
    if(seq.length < 5) return null;
    const key = `${seq[4]}_${seq[3]}_${seq[2]}_${seq[1]}_${seq[0]}`;
    const stats = this.bayesStats.order5[key];
    if(!stats) return null;
    const total = stats.TAI + stats.XIU;
    if(total < 3) return null;
    const prob = stats.TAI / total;
    return { pred: prob >= 0.5 ? 'TAI' : 'XIU', conf: Math.round(Math.max(prob, 1-prob)*100) };
  }

  // 6. Bệt dài LC79 (6-12 phiên)
  algo6_LongStreakLC79(seq) {
    let streak = 1;
    const first = seq[0];
    for(let i=1; i<Math.min(seq.length, 15); i++) if(seq[i] === first) streak++; else break;
    if(streak >= 6) return { pred: first === 'TAI' ? 'XIU' : 'TAI', conf: Math.min(85, 60 + (streak-6)*3) };
    if(streak >= 4 && streak < 6) return { pred: first, conf: 62 };
    return null;
  }

  // 7. Cầu 1-1
  algo7_OneOneLC79(seq) {
    if(seq.length < 6) return null;
    let zigzag = 0;
    for(let i=1; i<6; i++) if(seq[i] !== seq[i-1]) zigzag++;
    if(zigzag >= 4) return { pred: seq[0] === 'TAI' ? 'XIU' : 'TAI', conf: 65 };
    return null;
  }

  // 8. Cầu 2-1
  algo8_TwoOneLC79(seq) {
    if(seq.length < 9) return null;
    const p1 = seq.slice(0,3).join('');
    const p2 = seq.slice(3,6).join('');
    const p3 = seq.slice(6,9).join('');
    if(p1 === p2 && p2 === p3) {
      if(p1 === 'TTX') return { pred: 'TAI', conf: 68 };
      if(p1 === 'XXT') return { pred: 'XIU', conf: 68 };
    }
    return null;
  }

  // 9. Cầu 3-2
  algo9_ThreeTwoLC79(seq) {
    if(seq.length < 10) return null;
    const pattern = seq.slice(0,5).join('');
    if(pattern === 'TTTXX' || pattern === 'XXXTT') {
      const nextPattern = seq.slice(5,10).join('');
      if(nextPattern === pattern) return { pred: pattern[0] === 'T' ? 'TAI' : 'XIU', conf: 66 };
    }
    return null;
  }

  // 10. Chu kỳ 8
  algo10_Cycle8LC79(seq) {
    if(seq.length < 16) return null;
    const cycle1 = seq.slice(0,8).join('');
    const cycle2 = seq.slice(8,16).join('');
    if(cycle1 === cycle2) return { pred: cycle1[0] === 'T' ? 'TAI' : 'XIU', conf: 72 };
    return null;
  }

  // 11. Chu kỳ 13
  algo11_Cycle13LC79(seq) {
    if(seq.length < 26) return null;
    const c1 = seq.slice(0,13).join('');
    const c2 = seq.slice(13,26).join('');
    if(c1 === c2) return { pred: c1[0] === 'T' ? 'TAI' : 'XIU', conf: 70 };
    return null;
  }

  // 12. Điểm cực đoan
  algo12_ExtremePointsLC79() {
    if(this.diceHistory.length < 5) return null;
    const last5 = this.diceHistory.slice(-5);
    const extremeCount = last5.filter(d => d.tong <= 4 || d.tong >= 17).length;
    if(extremeCount >= 2) {
      const last = last5[last5.length-1].tong;
      if(last <= 4) return { pred: 'TAI', conf: 70 };
      if(last >= 17) return { pred: 'XIU', conf: 70 };
    }
    return null;
  }

  // 13. Tổng 3 phiên
  algo13_Sum3LC79() {
    if(this.diceHistory.length < 3) return null;
    const sum3 = this.diceHistory.slice(-3).reduce((a,b) => a+b.tong, 0);
    if(sum3 > 38) return { pred: 'XIU', conf: 65 };
    if(sum3 < 25) return { pred: 'TAI', conf: 65 };
    return null;
  }

  // 14. Tổng 5 phiên
  algo14_Sum5LC79() {
    if(this.diceHistory.length < 5) return null;
    const sum5 = this.diceHistory.slice(-5).reduce((a,b) => a+b.tong, 0);
    if(sum5 > 60) return { pred: 'XIU', conf: 62 };
    if(sum5 < 45) return { pred: 'TAI', conf: 62 };
    return null;
  }

  // 15. Trung bình trượt 10 phiên
  algo15_MA10LC79() {
    if(this.diceHistory.length < 15) return null;
    const ma5 = this.diceHistory.slice(-5).reduce((a,b) => a+b.tong, 0) / 5;
    const ma10 = this.diceHistory.slice(-10).reduce((a,b) => a+b.tong, 0) / 10;
    if(ma5 > ma10 + 1.2) return { pred: 'XIU', conf: 60 };
    if(ma5 < ma10 - 1.2) return { pred: 'TAI', conf: 60 };
    return null;
  }

  // 16. Tần suất mặt xúc xắc
  algo16_DiceFaceFreqLC79() {
    if(this.diceFaces.length < 30) return null;
    const freq = Array(7).fill(0);
    this.diceFaces.slice(-60).forEach(f => { if(f>=1 && f<=6) freq[f]++; });
    const maxFace = freq.indexOf(Math.max(...freq.slice(1)));
    if(maxFace <= 3) return { pred: 'XIU', conf: 56 };
    if(maxFace >= 4) return { pred: 'TAI', conf: 56 };
    return null;
  }

  // 17. Phân phối 20 phiên
  algo17_Ratio20LC79(seq) {
    if(seq.length < 20) return null;
    const taiCount = seq.slice(0,20).filter(x => x === 'TAI').length;
    if(taiCount >= 14) return { pred: 'XIU', conf: 68 };
    if(taiCount <= 6) return { pred: 'TAI', conf: 68 };
    return null;
  }

  // 18. Phân phối 30 phiên
  algo18_Ratio30LC79(seq) {
    if(seq.length < 30) return null;
    const taiCount = seq.slice(0,30).filter(x => x === 'TAI').length;
    if(taiCount >= 19) return { pred: 'XIU', conf: 64 };
    if(taiCount <= 11) return { pred: 'TAI', conf: 64 };
    return null;
  }

  // 19. Hồi quy trung bình
  algo19_RegressionLC79(seq) {
    if(seq.length < 40) return null;
    const last40 = seq.slice(0,40);
    const taiCount = last40.filter(x => x === 'TAI').length;
    const deviation = taiCount - 20;
    if(Math.abs(deviation) >= 6) return { pred: deviation > 0 ? 'XIU' : 'TAI', conf: Math.min(72, 55 + Math.abs(deviation)*1.5) };
    return null;
  }

  // 20. Mirror Pattern
  algo20_MirrorLC79(seq) {
    if(seq.length < 8) return null;
    const p1 = seq.slice(0,4);
    const p2 = seq.slice(4,8);
    if(p1.join('') === p2.join('')) return { pred: p1[0] === 'TAI' ? 'XIU' : 'TAI', conf: 62 };
    return null;
  }

  // 21. Anti-Mirror
  algo21_AntiMirrorLC79(seq) {
    if(seq.length < 8) return null;
    const p1 = seq.slice(0,4);
    const p2 = seq.slice(4,8);
    const isAnti = p1.every((v,i) => v !== p2[i]);
    if(isAnti) return { pred: p1[0], conf: 60 };
    return null;
  }

  // 22. Volatility
  algo22_VolatilityLC79(seq) {
    if(seq.length < 15) return null;
    let changes = 0;
    for(let i=1; i<15; i++) if(seq[i] !== seq[i-1]) changes++;
    const vol = changes / 14;
    if(vol > 0.65) return { pred: seq[0] === 'TAI' ? 'XIU' : 'TAI', conf: 58 };
    if(vol < 0.3) return { pred: seq[0], conf: 58 };
    return null;
  }

  // 23. Shannon Entropy
  algo23_EntropyLC79(seq) {
    if(seq.length < 25) return null;
    const p = seq.slice(0,25).filter(x => x === 'TAI').length / 25;
    if(p === 0 || p === 1) return null;
    const entropy = -p * Math.log2(p) - (1-p) * Math.log2(1-p);
    if(entropy < 0.75) return { pred: p > 0.5 ? 'TAI' : 'XIU', conf: 60 };
    if(entropy > 0.95) return { pred: p > 0.5 ? 'XIU' : 'TAI', conf: 55 };
    return null;
  }

  // 24. Linear Trend 12 phiên
  algo24_LinearTrendLC79(seq) {
    if(seq.length < 12) return null;
    const vals = seq.slice(0,12).map(x => x === 'TAI' ? 1 : 0);
    let sumX=0, sumY=0, sumXY=0, sumX2=0;
    for(let i=0; i<12; i++) {
      sumX += i; sumY += vals[i]; sumXY += i*vals[i]; sumX2 += i*i;
    }
    const slope = (12*sumXY - sumX*sumY) / (12*sumX2 - sumX*sumX);
    if(slope > 0.12) return { pred: 'TAI', conf: 60 };
    if(slope < -0.12) return { pred: 'XIU', conf: 60 };
    return null;
  }

  // 25. Fibonacci Retracement
  algo25_FibonacciLC79(seq) {
    if(seq.length < 10) return null;
    let reversals = 0;
    for(let i=1; i<10; i++) if(seq[i] !== seq[i-1]) reversals++;
    if(reversals === 3 || reversals === 6) return { pred: seq[0], conf: 56 };
    if(reversals === 4 || reversals === 7) return { pred: seq[0] === 'TAI' ? 'XIU' : 'TAI', conf: 56 };
    return null;
  }

  // 26. Khoảng cách Tài
  algo26_TaiGapLC79(seq) {
    if(seq.length < 20) return null;
    const gaps = [];
    let lastTai = -1;
    for(let i=0; i<seq.length; i++) {
      if(seq[i] === 'TAI') {
        if(lastTai !== -1) gaps.push(i - lastTai);
        lastTai = i;
      }
    }
    if(gaps.length < 4) return null;
    const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
    const last = gaps[gaps.length-1];
    if(last > avg * 1.4) return { pred: 'TAI', conf: 62 };
    return null;
  }

  // 27. Khoảng cách Xỉu
  algo27_XiuGapLC79(seq) {
    if(seq.length < 20) return null;
    const gaps = [];
    let lastXiu = -1;
    for(let i=0; i<seq.length; i++) {
      if(seq[i] === 'XIU') {
        if(lastXiu !== -1) gaps.push(i - lastXiu);
        lastXiu = i;
      }
    }
    if(gaps.length < 4) return null;
    const avg = gaps.reduce((a,b) => a+b, 0) / gaps.length;
    const last = gaps[gaps.length-1];
    if(last > avg * 1.4) return { pred: 'XIU', conf: 62 };
    return null;
  }

  // 28. Độ lệch chuẩn xúc xắc
  algo28_StdDevLC79() {
    if(this.diceHistory.length < 12) return null;
    const last12 = this.diceHistory.slice(-12).map(d => d.tong);
    const mean = last12.reduce((a,b) => a+b, 0) / 12;
    const variance = last12.reduce((a,b) => a + (b-mean)**2, 0) / 12;
    const std = Math.sqrt(variance);
    if(std < 3) return { pred: mean > 10.5 ? 'TAI' : 'XIU', conf: 58 };
    if(std > 7) return { pred: mean > 10.5 ? 'XIU' : 'TAI', conf: 58 };
    return null;
  }

  // 29. Pattern 3-1-3
  algo29_Pattern313LC79(seq) {
    if(seq.length < 14) return null;
    const p = seq.slice(0,7).join('');
    if(p === 'TTTXTTT') return { pred: 'XIU', conf: 66 };
    if(p === 'XXXTXXX') return { pred: 'TAI', conf: 66 };
    return null;
  }

  // 30. Meta Ensemble (tổng hợp có trọng số)
  algo30_MetaEnsembleLC79(seq) {
    const results = [];
    const methods = [
      this.algo1_Bayes1, this.algo2_Bayes2, this.algo3_Bayes3, this.algo4_Bayes4, this.algo5_Bayes5,
      this.algo6_LongStreakLC79, this.algo7_OneOneLC79, this.algo8_TwoOneLC79, this.algo9_ThreeTwoLC79,
      this.algo10_Cycle8LC79, this.algo11_Cycle13LC79, this.algo12_ExtremePointsLC79, this.algo13_Sum3LC79,
      this.algo14_Sum5LC79, this.algo15_MA10LC79, this.algo16_DiceFaceFreqLC79, this.algo17_Ratio20LC79,
      this.algo18_Ratio30LC79, this.algo19_RegressionLC79, this.algo20_MirrorLC79, this.algo21_AntiMirrorLC79,
      this.algo22_VolatilityLC79, this.algo23_EntropyLC79, this.algo24_LinearTrendLC79, this.algo25_FibonacciLC79,
      this.algo26_TaiGapLC79, this.algo27_XiuGapLC79, this.algo28_StdDevLC79, this.algo29_Pattern313LC79
    ];
    for(let i=0; i<methods.length; i++) {
      try {
        const res = methods[i].call(this, seq);
        if(res && res.pred && res.conf >= 52) results.push({...res, algo: i+1});
      } catch(e) {}
    }
    if(results.length === 0) return this.algo1_Bayes1(seq) || { pred: null, conf: 0 };
    let scoreTAI=0, scoreXIU=0;
    for(const r of results) {
      const w = this.algoWeights[`LC79_${r.algo}`] || 0.5;
      if(r.pred === 'TAI') scoreTAI += r.conf * w;
      else scoreXIU += r.conf * w;
    }
    const finalPred = scoreTAI >= scoreXIU ? 'TAI' : 'XIU';
    const conf = Math.round(Math.max(scoreTAI, scoreXIU) / (scoreTAI + scoreXIU + 0.1) * 100);
    return { pred: finalPred, conf: Math.min(92, Math.max(52, conf)), votes: results.length };
  }

  predict(seq) {
    if(seq.length < 3) return { pred: null, conf: 0 };
    const cacheKey = seq.slice(0, 10).join('');
    if(this.predictionCache.has(cacheKey)) return this.predictionCache.get(cacheKey);
    const result = this.algo30_MetaEnsembleLC79(seq);
    if(result) this.predictionCache.set(cacheKey, result);
    return { du_doan: result?.pred === 'TAI' ? 'Tài' : 'Xỉu', do_tin_cay: result?.conf || 60 };
  }

  updateAccuracy(algo, correct) {
    const key = `LC79_${algo}`;
    this.algoWeights[key] = this.algoWeights[key] * 0.9 + (correct ? 0.1 : 0);
  }
}

// Khởi tạo engine riêng cho LC79 MD5
const lc79Engine = new LC79DeepEngine();

// ==================== FETCH DỮ LIỆU ====================
async function fetchTele68(url, isMd5 = false) {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data && res.data.list && res.data.list.length > 0) {
            const last = res.data.list[0];
            const ketQua = last.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
            return { phien: last.id, ket_qua: ketQua, tong: last.point, dices: last.dices };
        }
        return null;
    } catch(e) { return null; }
}

// ==================== API LC79 MD5 DÙNG DEEP ENGINE ====================
app.get('/lc79/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_MD5, true);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 MD5 data' });
        
        // Lấy lịch sử kết quả thực tế (đã lưu)
        let results = predictionsDB.lc79_md5.slice(0, 50).map(h => h.ket_qua_thuc_te === 'Tài' ? 'TAI' : 'XIU').filter(r => r);
        results.unshift(data.ket_qua === 'Tài' ? 'TAI' : 'XIU');
        
        // Cập nhật engine học
        lc79Engine.learn(data.ket_qua === 'Tài' ? 'TAI' : 'XIU', results, { tong: data.tong, faces: data.dices });
        
        // Dự đoán bằng deep engine
        const prediction = lc79Engine.predict(results);
        
        // Lưu lịch sử
        predictionsDB.lc79_md5.unshift({ 
            phien_du_doan: data.phien + 1, 
            ket_qua_thuc_te: data.ket_qua, 
            du_doan: prediction.du_doan,
            timestamp: new Date().toISOString()
        });
        if (predictionsDB.lc79_md5.length > 100) predictionsDB.lc79_md5 = predictionsDB.lc79_md5.slice(0, 100);
        
        res.json({
            game: 'LC79 MD5 (Deep 30 Algorithms)',
            phien_hien_tai: data.phien + 1,
            du_doan: prediction.du_doan,
            do_tin_cay: prediction.do_tin_cay + '%',
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            dice_truoc: data.dices,
            so_thuat_toan_da_dung: 30,
            id: '@tranhoang2286'
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== API KHÁC (GIỮ NGUYÊN) ====================
async function fetchHitclub() {
    try {
        const res = await axios.get(API_HITCLUB, { timeout: 8000 });
        if (res.data && res.data.taixiu && res.data.taixiu.length > 0) {
            const last = res.data.taixiu[0];
            return { phien: last.Phien, ket_qua: last.Ket_qua === 'Tài' ? 'Tài' : 'Xỉu', tong: last.Tong };
        }
        return null;
    } catch(e) { return null; }
}

async function fetchMax789() {
    try {
        const res = await axios.get(API_MAX789, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            let ketQua = res.data.ket_qua === 'Tai' ? 'Tài' : 'Xỉu';
            return { phien: res.data.phien, ket_qua: ketQua, tong: res.data.tong };
        }
        return null;
    } catch(e) { return null; }
}

async function fetchXocDia() {
    try {
        const res = await axios.get(API_XOCDIA, { timeout: 8000 });
        if (res.data && res.data.ket_qua_truyen_thong) {
            let ketQua = res.data.ket_qua_truyen_thong === 'Chẵn' ? 'Chẵn' : 'Lẻ';
            return { phien: res.data.phien, ket_qua: ketQua, chi_tiet: res.data.ket_qua_chi_tiet, xuc_xac: res.data.xuc_xac };
        }
        return null;
    } catch(e) { return null; }
}

// Hàm Tài Xỉu thông thường (dùng cho các game khác)
function duDoanTaiXiu(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 2) return { du_doan: 'Tài', do_tin_cay: 55, loai_cau: 'Chưa đủ dữ liệu' };
    let last3 = results.slice(-3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { du_doan: pred, do_tin_cay: 62, loai_cau: `Xu hướng ${tai3}T-${3-tai3}X` };
}

// API LC79 TX (dùng thuật toán thường)
app.get('/lc79/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 TX data' });
        let pred = duDoanTaiXiu(predictionsDB.lc79_tx);
        predictionsDB.lc79_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'LC79 Tài Xỉu', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, tong_truoc: data.tong, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Hitclub
app.get('/hitclub', async (req, res) => {
    try {
        const data = await fetchHitclub();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Hitclub data' });
        let pred = duDoanTaiXiu(predictionsDB.hitclub);
        predictionsDB.hitclub.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Hitclub', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Betvip TX
app.get('/betvip/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_BETVIP_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch Betvip TX data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_tx);
        predictionsDB.betvip_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip Hũ', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Betvip MD5
app.get('/betvip/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_BETVIP_MD5);
        if (!data) return res.status(503).json({ error: 'Cannot fetch Betvip MD5 data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_md5);
        predictionsDB.betvip_md5.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Max789
app.get('/max789', async (req, res) => {
    try {
        const data = await fetchMax789();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Max789 data' });
        let pred = duDoanTaiXiu(predictionsDB.max789);
        predictionsDB.max789.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Max789', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Xóc Đĩa
app.get('/xocdia', async (req, res) => {
    try {
        const data = await fetchXocDia();
        if (!data) return res.status(503).json({ error: 'Cannot fetch XocDia data' });
        let duDoan = data.ket_qua === 'Chẵn' ? 'Lẻ' : 'Chẵn';
        res.json({ game: 'LC79 Xóc Đĩa', phien_hien_tai: data.phien + 1, ket_qua_truoc: data.ket_qua, du_doan: duDoan, do_tin_cay: '65%', ly_do: 'Bẻ cầu chẵn/lẻ', chi_tiet: data.chi_tiet, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BCR ====================
app.get('/bcr/bans', async (req, res) => {
    try {
        const response = await axios.get(API_BCR, { timeout: 10000 });
        if (!response.data?.data) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let banList = [...new Set(response.data.data.map(b => b.ban))].sort();
        res.json({ success: true, bans: banList, total: banList.length, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/bcr/ban/:banId', async (req, res) => {
    try {
        const banId = req.params.banId;
        const response = await axios.get(API_BCR, { timeout: 10000 });
        if (!response.data?.data) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let allResults = '';
        for (let ban of response.data.data) {
            if (ban.ban === banId && ban.results) allResults += ban.results;
        }
        if (!allResults) return res.status(404).json({ error: `Ban ${banId} not found` });
        
        let lastResult = allResults[allResults.length - 1];
        let bCount = (allResults.match(/B/g) || []).length;
        let pCount = (allResults.match(/P/g) || []).length;
        let tCount = (allResults.match(/T/g) || []).length;
        
        let duDoanConCai = 'Con', doTinCayConCai = 60, lyDoConCai = 'Theo xu hướng';
        if (allResults.length >= 3) {
            let bet = 1;
            for (let i = allResults.length - 2; i >= 0; i--) if (allResults[i] === lastResult) bet++;
            if (bet >= 3) {
                duDoanConCai = lastResult === 'B' ? 'Con' : 'Cái';
                doTinCayConCai = Math.min(85, 55 + bet * 4);
                lyDoConCai = `Bệt ${bet} ván ${duDoanConCai}`;
            } else if (bCount > pCount + 3) {
                duDoanConCai = 'Cái';
                doTinCayConCai = 70;
                lyDoConCai = `Con nóng (${bCount}/${allResults.length}) → bẻ Cái`;
            } else if (pCount > bCount + 3) {
                duDoanConCai = 'Con';
                doTinCayConCai = 70;
                lyDoConCai = `Cái nóng (${pCount}/${allResults.length}) → bẻ Con`;
            }
        }
        
        let duDoanHoa = 'Không', doTinCayHoa = 85;
        if (tCount >= 2 && allResults.slice(-5).includes('T')) { duDoanHoa = 'Có'; doTinCayHoa = 65; }
        let duDoanConDoi = 'Không', doTinCayConDoi = 85;
        if (allResults.slice(-2) === 'BB') { duDoanConDoi = 'Có'; doTinCayConDoi = 70; }
        let duDoanCaiDoi = 'Không', doTinCayCaiDoi = 85;
        if (allResults.slice(-2) === 'PP') { duDoanCaiDoi = 'Có'; doTinCayCaiDoi = 70; }
        
        res.json({
            game: 'BCR Sexy', ban: banId,
            du_doan_con_cai: duDoanConCai, do_tin_cay_con_cai: doTinCayConCai + '%', ly_do_con_cai: lyDoConCai,
            du_doan_hoa: duDoanHoa, do_tin_cay_hoa: doTinCayHoa + '%',
            du_doan_con_doi: duDoanConDoi, do_tin_cay_con_doi: doTinCayConDoi + '%',
            du_doan_cai_doi: duDoanCaiDoi, do_tin_cay_cai_doi: doTinCayCaiDoi + '%',
            thong_ke: { tong_van: allResults.length, con: bCount, cai: pCount, hoa: tCount },
            id: '@tranhoang2286'
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/bcr/all', async (req, res) => {
    try {
        const response = await axios.get(API_BCR, { timeout: 10000 });
        if (!response.data?.data) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let banMap = {};
        for (let ban of response.data.data) {
            if (!banMap[ban.ban]) banMap[ban.ban] = '';
            if (ban.results) banMap[ban.ban] += ban.results;
        }
        let all = {};
        for (let [banId, resultsStr] of Object.entries(banMap)) {
            let last = resultsStr[resultsStr.length - 1];
            let bet = 1;
            for (let i = resultsStr.length - 2; i >= 0; i--) if (resultsStr[i] === last) bet++;
            let duDoan = (bet >= 3) ? (last === 'B' ? 'Con' : 'Cái') : (last === 'B' ? 'Cái' : 'Con');
            let doTinCay = bet >= 3 ? Math.min(85, 55 + bet * 4) : 62;
            all[banId] = { du_doan: duDoan, do_tin_cay: doTinCay + '%' };
        }
        res.json({ game: 'BCR Sexy', all_bans: all, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'TỔNG HỢP API (LC79 DEEP 30 ALGOS + HITCLUB + BETVIP + MAX789 + XÓC ĐĨA + BCR)',
        author: '@tranhoang2286',
        ghi_chu: 'LC79 MD5 sử dụng 30 thuật toán deep learning riêng biệt',
        endpoints: {
            'LC79 Tài Xỉu': '/lc79/tx',
            'LC79 MD5 (30 thuật toán)': '/lc79/md5',
            'Hitclub': '/hitclub',
            'Betvip Hũ': '/betvip/tx',
            'Betvip MD5': '/betvip/md5',
            'Max789': '/max789',
            'LC79 Xóc Đĩa': '/xocdia',
            'BCR danh sách bàn': '/bcr/bans',
            'BCR 1 bàn': '/bcr/ban/:banId',
            'BCR tất cả': '/bcr/all'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER TỔNG HỢP - LC79 DEEP ENGINE 30 ALGORITHMS`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🎲 LC79 MD5: 30 thuật toán độc quyền (Bayes 1-5, bệt dài, chu kỳ, entropy, gap, stddev, ensemble...)`);
    console.log(`✅ LC79 TX | Hitclub | Betvip | Max789 | Xóc Đĩa | BCR`);
});
