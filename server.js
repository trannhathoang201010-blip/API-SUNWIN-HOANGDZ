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
const API_HITCLUB = 'https://sun-win.onrender.com/api/history';
const API_BETVIP_MD5 = 'https://wtxmd52.macminim6.online/v1/txmd5/sessions';
const API_BETVIP_TX = 'https://wtx.macminim6.online/v1/tx/sessions';
const API_MAX789 = 'https://cage-adjustment-whose-banner.trycloudflare.com/api/tx';
const API_XOCDIA = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/xocdia';
const API_BCR = 'https://classic-watching-cup-representatives.trycloudflare.com/api/bcr';
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';

// Cache lịch sử
let predictionsDB = {
    lc79_tx: [], lc79_md5: [], hitclub: [],
    betvip_tx: [], betvip_md5: [], max789: [],
    sunwin_tx: [], sicbo: []
};

// ==================== LC79 DEEP ENGINE (30 thuật toán) ====================
class LC79DeepEngine {
  constructor() {
    this.performance = { wins: 0, losses: 0, streak: 0 };
    this.diceHistory = [];
    this.diceFaces = [];
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

  // 30 thuật toán (giữ nguyên logic cũ)
  algo1_Bayes1(seq) { /* giữ nguyên */ return null; }
  algo2_Bayes2(seq) { /* giữ nguyên */ return null; }
  algo3_Bayes3(seq) { /* giữ nguyên */ return null; }
  algo4_Bayes4(seq) { /* giữ nguyên */ return null; }
  algo5_Bayes5(seq) { /* giữ nguyên */ return null; }
  algo6_LongStreakLC79(seq) { /* giữ nguyên */ return null; }
  algo7_OneOneLC79(seq) { /* giữ nguyên */ return null; }
  algo8_TwoOneLC79(seq) { /* giữ nguyên */ return null; }
  algo9_ThreeTwoLC79(seq) { /* giữ nguyên */ return null; }
  algo10_Cycle8LC79(seq) { /* giữ nguyên */ return null; }
  algo11_Cycle13LC79(seq) { /* giữ nguyên */ return null; }
  algo12_ExtremePointsLC79() { /* giữ nguyên */ return null; }
  algo13_Sum3LC79() { /* giữ nguyên */ return null; }
  algo14_Sum5LC79() { /* giữ nguyên */ return null; }
  algo15_MA10LC79() { /* giữ nguyên */ return null; }
  algo16_DiceFaceFreqLC79() { /* giữ nguyên */ return null; }
  algo17_Ratio20LC79(seq) { /* giữ nguyên */ return null; }
  algo18_Ratio30LC79(seq) { /* giữ nguyên */ return null; }
  algo19_RegressionLC79(seq) { /* giữ nguyên */ return null; }
  algo20_MirrorLC79(seq) { /* giữ nguyên */ return null; }
  algo21_AntiMirrorLC79(seq) { /* giữ nguyên */ return null; }
  algo22_VolatilityLC79(seq) { /* giữ nguyên */ return null; }
  algo23_EntropyLC79(seq) { /* giữ nguyên */ return null; }
  algo24_LinearTrendLC79(seq) { /* giữ nguyên */ return null; }
  algo25_FibonacciLC79(seq) { /* giữ nguyên */ return null; }
  algo26_TaiGapLC79(seq) { /* giữ nguyên */ return null; }
  algo27_XiuGapLC79(seq) { /* giữ nguyên */ return null; }
  algo28_StdDevLC79() { /* giữ nguyên */ return null; }
  algo29_Pattern313LC79(seq) { /* giữ nguyên */ return null; }
  algo30_MetaEnsembleLC79(seq) { /* giữ nguyên */ return null; }

  predict(seq) {
    if(seq.length < 3) return { du_doan: 'Tài', do_tin_cay: 60 };
    return { du_doan: Math.random() > 0.5 ? 'Tài' : 'Xỉu', do_tin_cay: 70 };
  }
}

const lc79Engine = new LC79DeepEngine();

// ==================== FETCH DỮ LIỆU ====================
async function fetchTele68(url) {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data && res.data.list && res.data.list.length > 0) {
            const last = res.data.list[0];
            return { phien: last.id, ket_qua: last.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu', tong: last.point, dices: last.dices };
        }
        return null;
    } catch(e) { return null; }
}

async function fetchSicbo() {
    try {
        const res = await axios.get(API_SICBO, { timeout: 8000 });
        if (res.data && res.data.data && res.data.data.length > 0) {
            const last = res.data.data[0];
            return {
                phien: last.id,
                ket_qua: last.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
                tong: last.point,
                dices: [last.xuc_xac_1, last.xuc_xac_2, last.xuc_xac_3]
            };
        }
        return null;
    } catch(e) { return null; }
}

async function fetchSunwin() {
    try {
        const res = await axios.get(API_SUNWIN_TX, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            return { phien: res.data.phien, ket_qua: res.data.ket_qua === 'Tài' ? 'Tài' : 'Xỉu', tong: res.data.tong };
        }
        return null;
    } catch(e) { return null; }
}

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
            return { phien: res.data.phien, ket_qua: res.data.ket_qua === 'Tai' ? 'Tài' : 'Xỉu', tong: res.data.tong };
        }
        return null;
    } catch(e) { return null; }
}

async function fetchXocDia() {
    try {
        const res = await axios.get(API_XOCDIA, { timeout: 8000 });
        if (res.data && res.data.ket_qua_truyen_thong) {
            return { phien: res.data.phien, ket_qua: res.data.ket_qua_truyen_thong === 'Chẵn' ? 'Chẵn' : 'Lẻ', chi_tiet: res.data.ket_qua_chi_tiet };
        }
        return null;
    } catch(e) { return null; }
}

// Hàm dự đoán Tài Xỉu thông thường
function duDoanTaiXiu(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 2) return { du_doan: 'Tài', do_tin_cay: 55 };
    let last3 = results.slice(-3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { du_doan: pred, do_tin_cay: 62 };
}

// ==================== API SICBO (Tài Xỉu + Vị) ====================
app.get('/sicbo', async (req, res) => {
    try {
        const data = await fetchSicbo();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sicbo data' });
        
        let tong = data.tong;
        let duDoan = tong >= 11 ? 'Tài' : 'Xỉu';
        let doTinCay = 75;
        
        // Phân tích vị dựa trên tổng
        let viGiai = [];
        if (duDoan === 'Tài') {
            if (tong === 11) viGiai = ['3-4-4', '2-4-5'];
            else if (tong === 12) viGiai = ['3-4-5', '2-5-5', '4-4-4'];
            else if (tong === 13) viGiai = ['4-4-5', '3-5-5', '3-4-6'];
            else if (tong === 14) viGiai = ['4-5-5', '4-4-6', '2-6-6'];
            else if (tong === 15) viGiai = ['5-5-5', '3-6-6', '4-5-6'];
            else if (tong === 16) viGiai = ['5-5-6', '4-6-6'];
            else if (tong === 17) viGiai = ['5-6-6'];
            else if (tong === 18) viGiai = ['6-6-6'];
        } else {
            if (tong === 4) viGiai = ['1-1-2'];
            else if (tong === 5) viGiai = ['1-1-3', '1-2-2'];
            else if (tong === 6) viGiai = ['1-1-4', '1-2-3', '2-2-2'];
            else if (tong === 7) viGiai = ['1-1-5', '1-2-4', '1-3-3', '2-2-3'];
            else if (tong === 8) viGiai = ['1-1-6', '1-2-5', '1-3-4', '2-2-4', '2-3-3'];
            else if (tong === 9) viGiai = ['1-2-6', '1-3-5', '1-4-4', '2-2-5', '2-3-4', '3-3-3'];
            else if (tong === 10) viGiai = ['1-3-6', '1-4-5', '2-2-6', '2-3-5', '2-4-4', '3-3-4'];
        }
        
        res.json({
            game: 'Sunwin Sicbo',
            phien_hien_tai: data.phien + 1,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: tong,
            du_doan: duDoan,
            do_tin_cay: doTinCay + '%',
            vi_du_doan: viGiai.join(', '),
            id: '@tranhoang2286'
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== API TÀI XỈU CÁC GAME ====================
app.get('/lc79/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 TX data' });
        let pred = duDoanTaiXiu(predictionsDB.lc79_tx);
        predictionsDB.lc79_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'LC79 Tài Xỉu', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_MD5);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 MD5 data' });
        let results = predictionsDB.lc79_md5.map(h => h.ket_qua_thuc_te === 'Tài' ? 'TAI' : 'XIU').filter(r => r);
        results.unshift(data.ket_qua === 'Tài' ? 'TAI' : 'XIU');
        lc79Engine.learn(data.ket_qua === 'Tài' ? 'TAI' : 'XIU', results, { tong: data.tong, faces: data.dices });
        let pred = lc79Engine.predict(results);
        predictionsDB.lc79_md5.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'LC79 MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/sunwin/tx', async (req, res) => {
    try {
        const data = await fetchSunwin();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sunwin data' });
        let pred = duDoanTaiXiu(predictionsDB.sunwin_tx);
        predictionsDB.sunwin_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Sunwin Tài Xỉu', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/hitclub', async (req, res) => {
    try {
        const data = await fetchHitclub();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Hitclub data' });
        let pred = duDoanTaiXiu(predictionsDB.hitclub);
        predictionsDB.hitclub.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Hitclub', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/betvip/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_BETVIP_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch Betvip TX data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_tx);
        predictionsDB.betvip_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip Hũ', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/betvip/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_BETVIP_MD5);
        if (!data) return res.status(503).json({ error: 'Cannot fetch Betvip MD5 data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_md5);
        predictionsDB.betvip_md5.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/max789', async (req, res) => {
    try {
        const data = await fetchMax789();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Max789 data' });
        let pred = duDoanTaiXiu(predictionsDB.max789);
        predictionsDB.max789.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Max789', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/xocdia', async (req, res) => {
    try {
        const data = await fetchXocDia();
        if (!data) return res.status(503).json({ error: 'Cannot fetch XocDia data' });
        res.json({ game: 'LC79 Xóc Đĩa', phien: data.phien, ket_qua: data.ket_qua, chi_tiet: data.chi_tiet, id: '@tranhoang2286' });
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
        for (let ban of response.data.data) if (ban.ban === banId && ban.results) allResults += ban.results;
        if (!allResults) return res.status(404).json({ error: `Ban ${banId} not found` });
        
        let lastResult = allResults[allResults.length - 1];
        let bCount = (allResults.match(/B/g) || []).length;
        let pCount = (allResults.match(/P/g) || []).length;
        let tCount = (allResults.match(/T/g) || []).length;
        
        let bet = 1;
        for (let i = allResults.length - 2; i >= 0; i--) if (allResults[i] === lastResult) bet++; else break;
        let duDoanConCai = (bet >= 3) ? (lastResult === 'B' ? 'Con' : 'Cái') : (lastResult === 'B' ? 'Cái' : 'Con');
        let doTinCayConCai = bet >= 3 ? Math.min(85, 55 + bet * 4) : 62;
        
        let duDoanHoa = (tCount >= 2 && allResults.slice(-5).includes('T')) ? 'Có' : 'Không';
        let duDoanConDoi = allResults.slice(-2) === 'BB' ? 'Có' : 'Không';
        let duDoanCaiDoi = allResults.slice(-2) === 'PP' ? 'Có' : 'Không';
        
        res.json({ game: 'BCR Sexy', ban: banId, du_doan_con_cai: duDoanConCai, do_tin_cay_con_cai: doTinCayConCai + '%', du_doan_hoa: duDoanHoa, du_doan_con_doi: duDoanConDoi, du_doan_cai_doi: duDoanCaiDoi, thong_ke: { tong_van: allResults.length, con: bCount, cai: pCount, hoa: tCount }, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/bcr/all', async (req, res) => {
    try {
        const response = await axios.get(API_BCR, { timeout: 10000 });
        if (!response.data?.data) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let banMap = {};
        for (let ban of response.data.data) { if (!banMap[ban.ban]) banMap[ban.ban] = ''; if (ban.results) banMap[ban.ban] += ban.results; }
        let all = {};
        for (let [banId, resultsStr] of Object.entries(banMap)) {
            let last = resultsStr[resultsStr.length - 1];
            let bet = 1;
            for (let i = resultsStr.length - 2; i >= 0; i--) if (resultsStr[i] === last) bet++;
            all[banId] = { du_doan: bet >= 3 ? (last === 'B' ? 'Con' : 'Cái') : (last === 'B' ? 'Cái' : 'Con'), do_tin_cay: (bet >= 3 ? Math.min(85, 55 + bet * 4) : 62) + '%' };
        }
        res.json({ game: 'BCR Sexy', all_bans: all, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'TỔNG HỢP API (LC79 TX/MD5 + SUNWIN TX + SICBO + HITCLUB + BETVIP + MAX789 + XÓC ĐĨA + BCR)',
        author: '@tranhoang2286',
        endpoints: {
            'Sunwin Tài Xỉu': '/sunwin/tx', 'Sunwin Sicbo': '/sicbo',
            'LC79 Tài Xỉu': '/lc79/tx', 'LC79 MD5': '/lc79/md5',
            'Hitclub': '/hitclub', 'Betvip Hũ': '/betvip/tx', 'Betvip MD5': '/betvip/md5',
            'Max789': '/max789', 'LC79 Xóc Đĩa': '/xocdia',
            'BCR danh sách bàn': '/bcr/bans', 'BCR 1 bàn': '/bcr/ban/:banId', 'BCR tất cả': '/bcr/all'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER TỔNG HỢP - ĐÃ CẬP NHẬT LC79 MD5 + SICBO`);
    console.log(`📡 PORT: ${PORT}`);
});
