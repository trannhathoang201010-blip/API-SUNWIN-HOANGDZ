const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== API NGUỒN ====================
const API_LC79_TX = 'https://wtx.tele68.com/v1/tx/lite-sessions?cp=R&cl=R&pf=web&at=b34a2ee4eb21781e25aa6f20cb401bd8';
const API_LC79_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions?cp=R&cl=R&pf=web&at=b34a2ee4eb21781e25aa6f20cb401bd8';
const API_SICBO = 'https://api.wsktnus8.net/v2/history/getLastResult?gameId=ktrng_3979&size=100&tableId=39791215743193&curPage=1';
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';

// Cache lịch sử
let predictionsDB = {
    lc79_tx: [],
    lc79_md5: [],
    sunwin_tx: []
};

// ==================== LC79 DEEP ENGINE (30 thuật toán) ====================
class LC79DeepEngine {
    constructor() {
        this.performance = { wins: 0, losses: 0, streak: 0 };
        this.diceHistory = [];
        this.diceFaces = [];
        this.bayesStats = { order1: {}, order2: {}, order3: {}, order4: {}, order5: {} };
        this.algoWeights = {};
        for (let i = 1; i <= 30; i++) this.algoWeights[`LC79_${i}`] = 0.5;
        this.predictionCache = new Map();
    }

    learn(actual, historyArray, diceData) {
        if (!actual || historyArray.length < 2) return;
        for (let order = 1; order <= 5; order++) {
            if (historyArray.length > order) {
                const key = historyArray.slice(0, order).join('_');
                const stats = this.bayesStats[`order${order}`];
                if (!stats[key]) stats[key] = { TAI: 0, XIU: 0 };
                stats[key][actual]++;
            }
        }
        if (diceData) {
            this.diceHistory.push(diceData);
            if (this.diceHistory.length > 200) this.diceHistory.shift();
            if (diceData.faces) {
                this.diceFaces.push(...diceData.faces);
                if (this.diceFaces.length > 600) this.diceFaces.splice(0, 300);
            }
        }
    }

    // Thuật toán 1: Bayes bậc 1
    algo1_Bayes1(seq) {
        if (seq.length < 2) return null;
        const last = seq[seq.length - 1];
        const stats = this.bayesStats.order1;
        const key = last;
        if (!stats[key]) return null;
        const tai = stats[key].TAI || 0;
        const xiu = stats[key].XIU || 0;
        if (tai + xiu < 3) return null;
        return tai > xiu ? 'TAI' : 'XIU';
    }

    // Thuật toán 2: Bayes bậc 2
    algo2_Bayes2(seq) {
        if (seq.length < 3) return null;
        const last2 = seq.slice(-2).join('_');
        const stats = this.bayesStats.order2;
        if (!stats[last2]) return null;
        const tai = stats[last2].TAI || 0;
        const xiu = stats[last2].XIU || 0;
        if (tai + xiu < 2) return null;
        return tai > xiu ? 'TAI' : 'XIU';
    }

    // Thuật toán 3: Bayes bậc 3
    algo3_Bayes3(seq) {
        if (seq.length < 4) return null;
        const last3 = seq.slice(-3).join('_');
        const stats = this.bayesStats.order3;
        if (!stats[last3]) return null;
        const tai = stats[last3].TAI || 0;
        const xiu = stats[last3].XIU || 0;
        if (tai + xiu < 2) return null;
        return tai > xiu ? 'TAI' : 'XIU';
    }

    // Thuật toán 4: Bayes bậc 4
    algo4_Bayes4(seq) {
        if (seq.length < 5) return null;
        const last4 = seq.slice(-4).join('_');
        const stats = this.bayesStats.order4;
        if (!stats[last4]) return null;
        const tai = stats[last4].TAI || 0;
        const xiu = stats[last4].XIU || 0;
        if (tai + xiu < 2) return null;
        return tai > xiu ? 'TAI' : 'XIU';
    }

    // Thuật toán 5: Bayes bậc 5
    algo5_Bayes5(seq) {
        if (seq.length < 6) return null;
        const last5 = seq.slice(-5).join('_');
        const stats = this.bayesStats.order5;
        if (!stats[last5]) return null;
        const tai = stats[last5].TAI || 0;
        const xiu = stats[last5].XIU || 0;
        if (tai + xiu < 2) return null;
        return tai > xiu ? 'TAI' : 'XIU';
    }

    // Thuật toán 6: Theo dõi chuỗi dài
    algo6_LongStreakLC79(seq) {
        if (seq.length < 3) return null;
        let streak = 1;
        const last = seq[seq.length - 1];
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === last) streak++;
            else break;
        }
        if (streak >= 3) return last === 'TAI' ? 'XIU' : 'TAI';
        return null;
    }

    // Thuật toán 7: 1-1
    algo7_OneOneLC79(seq) {
        if (seq.length < 4) return null;
        if (seq[seq.length - 1] === seq[seq.length - 3] &&
            seq[seq.length - 2] === seq[seq.length - 4]) {
            return seq[seq.length - 1] === 'TAI' ? 'XIU' : 'TAI';
        }
        return null;
    }

    // Thuật toán 8: 2-1
    algo8_TwoOneLC79(seq) {
        if (seq.length < 5) return null;
        if (seq[seq.length - 1] === seq[seq.length - 3] &&
            seq[seq.length - 2] === seq[seq.length - 4] &&
            seq[seq.length - 3] !== seq[seq.length - 4]) {
            return seq[seq.length - 1];
        }
        return null;
    }

    // Thuật toán 9: 3-2
    algo9_ThreeTwoLC79(seq) {
        if (seq.length < 6) return null;
        const last5 = seq.slice(-5);
        const pattern = last5.join('');
        if (pattern === 'TAITAIXIUXIUTAI' || pattern === 'XIUXIUTAITAIXIU') {
            return last5[4] === 'TAI' ? 'XIU' : 'TAI';
        }
        return null;
    }

    // Thuật toán 10: Chu kỳ 8
    algo10_Cycle8LC79(seq) {
        if (seq.length < 16) return null;
        if (seq[seq.length - 8] === seq[seq.length - 1]) {
            return seq[seq.length - 9];
        }
        return null;
    }

    // Thuật toán 11: Chu kỳ 13
    algo11_Cycle13LC79(seq) {
        if (seq.length < 26) return null;
        if (seq[seq.length - 13] === seq[seq.length - 1]) {
            return seq[seq.length - 14];
        }
        return null;
    }

    // Thuật toán 12: Điểm cực trị
    algo12_ExtremePointsLC79() {
        if (this.diceHistory.length < 20) return null;
        const recent = this.diceHistory.slice(-10);
        const taiCount = recent.filter(d => d.tong >= 11).length;
        const xiuCount = recent.filter(d => d.tong <= 10).length;
        if (taiCount >= 8) return 'XIU';
        if (xiuCount >= 8) return 'TAI';
        return null;
    }

    // Thuật toán 13: Tổng 3 phiên
    algo13_Sum3LC79(seq) {
        if (seq.length < 3) return null;
        const last3 = seq.slice(-3);
        const taiCount = last3.filter(s => s === 'TAI').length;
        if (taiCount >= 2) return 'XIU';
        if (taiCount <= 1) return 'TAI';
        return null;
    }

    // Thuật toán 14: Tổng 5 phiên
    algo14_Sum5LC79(seq) {
        if (seq.length < 5) return null;
        const last5 = seq.slice(-5);
        const taiCount = last5.filter(s => s === 'TAI').length;
        if (taiCount >= 3) return 'XIU';
        if (taiCount <= 2) return 'TAI';
        return null;
    }

    // Thuật toán 15: Trung bình 10
    algo15_MA10LC79(seq) {
        if (seq.length < 10) return null;
        const last10 = seq.slice(-10);
        const taiCount = last10.filter(s => s === 'TAI').length;
        if (taiCount >= 6) return 'XIU';
        if (taiCount <= 4) return 'TAI';
        return null;
    }

    // Thuật toán 16: Tần suất mặt xúc xắc
    algo16_DiceFaceFreqLC79() {
        if (this.diceFaces.length < 100) return null;
        const freq = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        for (let face of this.diceFaces.slice(-100)) freq[face]++;
        const avg = 100 / 6;
        let lowFaces = 0;
        for (let i = 1; i <= 6; i++) if (freq[i] < avg - 5) lowFaces++;
        if (lowFaces >= 3) return 'TAI';
        return null;
    }

    // Thuật toán 17: Tỷ lệ 20 phiên
    algo17_Ratio20LC79(seq) {
        if (seq.length < 20) return null;
        const last20 = seq.slice(-20);
        const taiCount = last20.filter(s => s === 'TAI').length;
        const ratio = taiCount / 20;
        if (ratio >= 0.65) return 'XIU';
        if (ratio <= 0.35) return 'TAI';
        return null;
    }

    // Thuật toán 18: Tỷ lệ 30 phiên
    algo18_Ratio30LC79(seq) {
        if (seq.length < 30) return null;
        const last30 = seq.slice(-30);
        const taiCount = last30.filter(s => s === 'TAI').length;
        const ratio = taiCount / 30;
        if (ratio >= 0.7) return 'XIU';
        if (ratio <= 0.3) return 'TAI';
        return null;
    }

    // Thuật toán 19: Hồi quy tuyến tính
    algo19_RegressionLC79(seq) {
        if (seq.length < 15) return null;
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            const val = seq[seq.length - 10 + i] === 'TAI' ? 1 : 0;
            sum += val * (i - 4.5);
        }
        return sum > 0 ? 'TAI' : 'XIU';
    }

    // Thuật toán 20: Gương
    algo20_MirrorLC79(seq) {
        if (seq.length < 10) return null;
        let matches = 0;
        for (let i = 0; i < 5; i++) {
            if (seq[seq.length - 1 - i] === seq[seq.length - 6 - i]) matches++;
        }
        if (matches >= 4) return seq[seq.length - 6] === 'TAI' ? 'XIU' : 'TAI';
        return null;
    }

    // Thuật toán 21: Anti-gương
    algo21_AntiMirrorLC79(seq) {
        if (seq.length < 10) return null;
        let opposite = 0;
        for (let i = 0; i < 5; i++) {
            if (seq[seq.length - 1 - i] !== seq[seq.length - 6 - i]) opposite++;
        }
        if (opposite >= 4) return seq[seq.length - 6];
        return null;
    }

    // Thuật toán 22: Biến động
    algo22_VolatilityLC79(seq) {
        if (seq.length < 20) return null;
        let changes = 0;
        for (let i = seq.length - 10; i < seq.length - 1; i++) {
            if (seq[i] !== seq[i + 1]) changes++;
        }
        if (changes >= 7) return seq[seq.length - 1] === 'TAI' ? 'XIU' : 'TAI';
        return null;
    }

    // Thuật toán 23: Entropy
    algo23_EntropyLC79(seq) {
        if (seq.length < 20) return null;
        const last20 = seq.slice(-20);
        const taiCount = last20.filter(s => s === 'TAI').length;
        const pTai = taiCount / 20;
        if (pTai > 0.45 && pTai < 0.55) {
            return seq[seq.length - 1] === 'TAI' ? 'XIU' : 'TAI';
        }
        return null;
    }

    // Thuật toán 24: Xu hướng tuyến tính
    algo24_LinearTrendLC79(seq) {
        if (seq.length < 15) return null;
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += (seq[seq.length - 10 + i] === 'TAI' ? 1 : 0);
        }
        if (sum >= 7) return 'XIU';
        if (sum <= 3) return 'TAI';
        return null;
    }

    // Thuật toán 25: Fibonacci
    algo25_FibonacciLC79(seq) {
        const fibs = [1, 1, 2, 3, 5, 8, 13];
        for (let fib of fibs) {
            if (seq.length > fib && seq[seq.length - fib] === seq[seq.length - 1]) {
                return seq[seq.length - fib - 1];
            }
        }
        return null;
    }

    // Thuật toán 26: Khoảng cách Tài
    algo26_TaiGapLC79(seq) {
        let lastTaiIndex = -1;
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === 'TAI') {
                lastTaiIndex = i;
                break;
            }
        }
        if (lastTaiIndex !== -1 && seq.length - lastTaiIndex >= 5) {
            return 'TAI';
        }
        return null;
    }

    // Thuật toán 27: Khoảng cách Xỉu
    algo27_XiuGapLC79(seq) {
        let lastXiuIndex = -1;
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === 'XIU') {
                lastXiuIndex = i;
                break;
            }
        }
        if (lastXiuIndex !== -1 && seq.length - lastXiuIndex >= 5) {
            return 'XIU';
        }
        return null;
    }

    // Thuật toán 28: Độ lệch chuẩn
    algo28_StdDevLC79() {
        if (this.diceHistory.length < 30) return null;
        const recent = this.diceHistory.slice(-30);
        const tongs = recent.map(d => d.tong);
        const avg = tongs.reduce((a, b) => a + b, 0) / 30;
        const variance = tongs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 30;
        const stdDev = Math.sqrt(variance);
        if (stdDev > 4) return 'TAI';
        if (stdDev < 2.5) return 'XIU';
        return null;
    }

    // Thuật toán 29: Pattern 3-1-3
    algo29_Pattern313LC79(seq) {
        if (seq.length < 7) return null;
        if (seq[seq.length - 4] === seq[seq.length - 6] &&
            seq[seq.length - 2] === seq[seq.length - 4] &&
            seq[seq.length - 1] !== seq[seq.length - 2]) {
            return seq[seq.length - 2];
        }
        return null;
    }

    // Thuật toán 30: Meta Ensemble
    algo30_MetaEnsembleLC79(seq) {
        let votes = { TAI: 0, XIU: 0 };
        for (let i = 1; i <= 29; i++) {
            const algoFunc = this[`algo${i}_LC79`];
            if (typeof algoFunc === 'function') {
                const result = algoFunc.call(this, seq);
                if (result === 'TAI') votes.TAI++;
                if (result === 'XIU') votes.XIU++;
            }
        }
        if (votes.TAI > votes.XIU && votes.TAI - votes.XIU >= 3) return 'TAI';
        if (votes.XIU > votes.TAI && votes.XIU - votes.TAI >= 3) return 'XIU';
        return null;
    }

    // Tổng hợp dự đoán
    predict(seq) {
        if (seq.length < 5) return { du_doan: 'Tài', do_tin_cay: 60 };
        
        let taiVotes = 0, xiuVotes = 0;
        let validAlgos = 0;
        
        for (let i = 1; i <= 30; i++) {
            const algoFunc = this[`algo${i}_LC79`];
            if (typeof algoFunc === 'function') {
                const result = algoFunc.call(this, seq);
                if (result === 'TAI') { taiVotes++; validAlgos++; }
                if (result === 'XIU') { xiuVotes++; validAlgos++; }
            }
        }
        
        let finalPred = taiVotes > xiuVotes ? 'Tài' : 'Xỉu';
        let confidence = Math.max(55, Math.min(92, 55 + Math.abs(taiVotes - xiuVotes) * 2));
        
        if (validAlgos < 5) {
            finalPred = seq[seq.length - 1] === 'TAI' ? 'Xỉu' : 'Tài';
            confidence = 60;
        }
        
        return { du_doan: finalPred, do_tin_cay: confidence };
    }
}

const lc79Engine = new LC79DeepEngine();

// ==================== FETCH DỮ LIỆU ====================
async function fetchTele68(url) {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data && res.data.list && res.data.list.length > 0) {
            const last = res.data.list[0];
            return {
                phien: last.id,
                ket_qua: last.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
                tong: last.point,
                dices: last.dices
            };
        }
        return null;
    } catch (e) {
        console.error('Tele68 fetch error:', e.message);
        return null;
    }
}

async function fetchSicbo() {
    try {
        const res = await axios.get(API_SICBO, { timeout: 8000 });
        if (res.data && res.data.data && res.data.data.resultList && res.data.data.resultList.length > 0) {
            const last = res.data.data.resultList[0];
            const tong = last.score;
            let ketQua = '';
            if (last.resultType === 3) ketQua = 'Tài';
            else if (last.resultType === 4) ketQua = 'Xỉu';
            else if (last.resultType === 11) ketQua = 'Bão';
            
            return {
                phien: parseInt(last.gameNum.replace('#', '')),
                ket_qua: ketQua,
                tong: tong,
                dices: last.facesList,
                resultType: last.resultType
            };
        }
        return null;
    } catch (e) {
        console.error('Sicbo fetch error:', e.message);
        return null;
    }
}

async function fetchSunwin() {
    try {
        const res = await axios.get(API_SUNWIN_TX, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            return {
                phien: res.data.phien,
                ket_qua: res.data.ket_qua === 'Tài' ? 'Tài' : 'Xỉu',
                tong: res.data.tong
            };
        }
        return null;
    } catch (e) {
        console.error('Sunwin fetch error:', e.message);
        return null;
    }
}

// Hàm dự đoán Tài Xỉu cơ bản
function duDoanTaiXiu(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 5) return { du_doan: 'Tài', do_tin_cay: 55 };
    
    // Đếm 5 phiên gần nhất
    let last5 = results.slice(-5);
    let taiCount = last5.filter(r => r === 'Tài').length;
    
    // Nếu Tài hoặc Xỉu ra 4/5 phiên thì đánh ngược
    if (taiCount >= 4) return { du_doan: 'Xỉu', do_tin_cay: 70 };
    if (taiCount <= 1) return { du_doan: 'Tài', do_tin_cay: 70 };
    
    // Nếu 3-2 thì đánh theo xu hướng
    return { du_doan: taiCount >= 3 ? 'Tài' : 'Xỉu', do_tin_cay: 62 };
}

// ==================== API LC79 HŨ (TÀI XỈU) ====================
app.get('/lc79/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 TX data' });
        
        let pred = duDoanTaiXiu(predictionsDB.lc79_tx);
        predictionsDB.lc79_tx.unshift({
            phien_du_doan: data.phien + 1,
            ket_qua_thuc_te: data.ket_qua,
            du_doan: pred.du_doan
        });
        if (predictionsDB.lc79_tx.length > 100) predictionsDB.lc79_tx.pop();
        
        res.json({
            game: 'LC79 Hũ Tài Xỉu',
            phien_hien_tai: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== API LC79 MD5 (30 THUẬT TOÁN) ====================
app.get('/lc79/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_MD5);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 MD5 data' });
        
        let results = predictionsDB.lc79_md5.map(h => h.ket_qua_thuc_te === 'Tài' ? 'TAI' : 'XIU').filter(r => r);
        results.unshift(data.ket_qua === 'Tài' ? 'TAI' : 'XIU');
        
        lc79Engine.learn(data.ket_qua === 'Tài' ? 'TAI' : 'XIU', results, { tong: data.tong, faces: data.dices });
        let pred = lc79Engine.predict(results);
        
        predictionsDB.lc79_md5.unshift({
            phien_du_doan: data.phien + 1,
            ket_qua_thuc_te: data.ket_qua,
            du_doan: pred.du_doan
        });
        if (predictionsDB.lc79_md5.length > 100) predictionsDB.lc79_md5.pop();
        
        res.json({
            game: 'LC79 MD5 (30 thuật toán)',
            phien_hien_tai: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            dices_truoc: data.dices,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== API SUNWIN TÀI XỈU ====================
app.get('/sunwin/tx', async (req, res) => {
    try {
        const data = await fetchSunwin();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sunwin TX data' });
        
        let pred = duDoanTaiXiu(predictionsDB.sunwin_tx);
        predictionsDB.sunwin_tx.unshift({
            phien_du_doan: data.phien + 1,
            ket_qua_thuc_te: data.ket_qua,
            du_doan: pred.du_doan
        });
        if (predictionsDB.sunwin_tx.length > 100) predictionsDB.sunwin_tx.pop();
        
        res.json({
            game: 'Sunwin Tài Xỉu',
            phien_hien_tai: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== API SUNWIN SICBO (Tài Xỉu + Vị) ====================
app.get('/sicbo', async (req, res) => {
    try {
        const data = await fetchSicbo();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sicbo data' });
        
        let duDoan = '';
        let doTinCay = 75;
        
        // Dự đoán Tài/Xỉu dựa trên lịch sử (5 phiên gần nhất)
        if (data.ket_qua === 'Tài') duDoan = 'Xỉu';
        else if (data.ket_qua === 'Xỉu') duDoan = 'Tài';
        else duDoan = 'Tài';
        
        // Phân tích vị dựa trên tổng của phiên trước
        let viGiai = [];
        let tong = data.tong;
        
        if (duDoan === 'Tài') {
            if (tong === 11) viGiai = ['3-4-4', '2-4-5'];
            else if (tong === 12) viGiai = ['3-4-5', '2-5-5', '4-4-4'];
            else if (tong === 13) viGiai = ['4-4-5', '3-5-5', '3-4-6'];
            else if (tong === 14) viGiai = ['4-5-5', '4-4-6', '2-6-6'];
            else if (tong === 15) viGiai = ['5-5-5', '3-6-6', '4-5-6'];
            else if (tong === 16) viGiai = ['5-5-6', '4-6-6'];
            else if (tong === 17) viGiai = ['5-6-6'];
            else if (tong === 18) viGiai = ['6-6-6'];
            else viGiai = ['4-4-4', '3-5-5', '2-5-6'];
        } else {
            if (tong === 4) viGiai = ['1-1-2'];
            else if (tong === 5) viGiai = ['1-1-3', '1-2-2'];
            else if (tong === 6) viGiai = ['1-1-4', '1-2-3', '2-2-2'];
            else if (tong === 7) viGiai = ['1-1-5', '1-2-4', '1-3-3', '2-2-3'];
            else if (tong === 8) viGiai = ['1-1-6', '1-2-5', '1-3-4', '2-2-4', '2-3-3'];
            else if (tong === 9) viGiai = ['1-2-6', '1-3-5', '1-4-4', '2-2-5', '2-3-4', '3-3-3'];
            else if (tong === 10) viGiai = ['1-3-6', '1-4-5', '2-2-6', '2-3-5', '2-4-4', '3-3-4'];
            else viGiai = ['1-1-2', '1-2-3', '2-3-3'];
        }
        
        res.json({
            game: 'Sunwin Sicbo (Tài Xỉu + Vị)',
            phien_hien_tai: data.phien + 1,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: tong,
            chi_tiet_xuc_xac: data.dices,
            du_doan: duDoan,
            do_tin_cay: doTinCay + '%',
            vi_du_doan: viGiai.slice(0, 3).join(', '),
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'API TỔNG HỢP - LC79 HŨ | LC79 MD5 | SUNWIN TX | SUNWIN SICBO',
        author: '@tranhoang2286',
        endpoints: {
            'LC79 Hũ Tài Xỉu': '/lc79/tx',
            'LC79 MD5 (30 thuật toán)': '/lc79/md5',
            'Sunwin Tài Xỉu': '/sunwin/tx',
            'Sunwin Sicbo (Tài Xỉu + Vị)': '/sicbo'
        },
        hướng_dẫn: 'Gọi các endpoint trên để nhận dự đoán phiên tiếp theo'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER ĐÃ KHỞI ĐỘNG`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🎲 Các game: LC79 Hũ | LC79 MD5 | Sunwin TX | Sunwin Sicbo`);
    console.log(`👤 Author: @tranhoang2286`);
});
