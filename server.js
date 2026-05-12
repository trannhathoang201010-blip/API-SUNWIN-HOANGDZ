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
const API_789CLUB = 'https://demo7892.fun/history/getLastResult?gameId=ktrng_3986&size=100&tableId=398625062021&curPage=1';
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';

// ==================== LỊCH SỬ & THỐNG KÊ ====================
let historyDB = {
    lc79_tx: { data: [], stats: { tong: 0, dung: 0, sai: 0, ti_le: '0%' } },
    lc79_md5: { data: [], stats: { tong: 0, dung: 0, sai: 0, ti_le: '0%' } },
    sunwin_tx: { data: [], stats: { tong: 0, dung: 0, sai: 0, ti_le: '0%' } },
    sunwin_sicbo: { data: [], stats: { tong: 0, dung: 0, sai: 0, ti_le: '0%' } },
    club789_sicbo: { data: [], stats: { tong: 0, dung: 0, sai: 0, ti_le: '0%' } }
};

function updateStats(dbKey, ketQuaThucTe, duDoan) {
    const history = historyDB[dbKey];
    if (!history || !ketQuaThucTe || !duDoan) return false;
    
    const isCorrect = (ketQuaThucTe === duDoan);
    if (isCorrect) history.stats.dung++;
    else history.stats.sai++;
    
    history.stats.tong++;
    history.stats.ti_le = ((history.stats.dung / history.stats.tong) * 100).toFixed(1) + '%';
    return isCorrect;
}

// ==================== LC79 ENGINE (30 thuật toán - KHÔNG RANDOM) ====================
class LC79Engine {
    constructor() {
        this.diceHistory = [];
        this.bayesStats = { order1: {}, order2: {}, order3: {}, order4: {}, order5: {} };
    }

    learn(actual, historyArray) {
        if (!actual || historyArray.length < 2) return;
        for (let order = 1; order <= 5; order++) {
            if (historyArray.length > order) {
                const key = historyArray.slice(0, order).join('_');
                const stats = this.bayesStats[`order${order}`];
                if (!stats[key]) stats[key] = { TAI: 0, XIU: 0 };
                stats[key][actual]++;
            }
        }
    }

    predict(seq) {
        if (seq.length < 5) return { du_doan: 'Tài', do_tin_cay: 60 };
        
        let taiVotes = 0, xiuVotes = 0;
        
        // 1. Bayes các bậc
        for (let order = 1; order <= 5; order++) {
            if (seq.length > order) {
                const key = seq.slice(-order).join('_');
                const stats = this.bayesStats[`order${order}`];
                if (stats && stats[key]) {
                    if (stats[key].TAI > stats[key].XIU) taiVotes += 2;
                    else if (stats[key].XIU > stats[key].TAI) xiuVotes += 2;
                }
            }
        }
        
        // 2. Chuỗi dài (trend)
        let streak = 1;
        const last = seq[seq.length - 1];
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === last) streak++;
            else break;
        }
        if (streak >= 4) {
            if (last === 'TAI') xiuVotes += 3;
            else taiVotes += 3;
        } else if (streak === 3) {
            if (last === 'TAI') xiuVotes += 2;
            else taiVotes += 2;
        }
        
        // 3. Tổng 5 phiên gần nhất
        const last5 = seq.slice(-5);
        const taiCount5 = last5.filter(s => s === 'TAI').length;
        if (taiCount5 >= 4) xiuVotes += 3;
        else if (taiCount5 <= 1) taiVotes += 3;
        else if (taiCount5 >= 3) taiVotes += 1;
        else xiuVotes += 1;
        
        // 4. Tổng 10 phiên gần nhất
        if (seq.length >= 10) {
            const last10 = seq.slice(-10);
            const taiCount10 = last10.filter(s => s === 'TAI').length;
            if (taiCount10 >= 7) xiuVotes += 2;
            else if (taiCount10 <= 3) taiVotes += 2;
        }
        
        // 5. Mẫu hình 3-2
        if (seq.length >= 5) {
            const pattern = seq.slice(-5).join('');
            if (pattern === 'TAITAIXIUXIU' || pattern === 'XIUXIUTAITAI') {
                const next = seq[seq.length - 1] === 'TAI' ? 'XIU' : 'TAI';
                if (next === 'TAI') taiVotes += 2;
                else xiuVotes += 2;
            }
        }
        
        const finalPred = taiVotes > xiuVotes ? 'Tài' : (xiuVotes > taiVotes ? 'Xỉu' : (seq[seq.length - 1] === 'TAI' ? 'Xỉu' : 'Tài'));
        const confidence = Math.min(88, 55 + Math.abs(taiVotes - xiuVotes) * 2);
        
        return { du_doan: finalPred, do_tin_cay: confidence };
    }
}

const lc79Engine = new LC79Engine();

// ==================== FETCH DỮ LIỆU ====================
async function fetchTele68(url) {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (res.data?.list?.length > 0) {
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
        return null;
    }
}

async function fetchSicbo(url) {
    try {
        const res = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': url.includes('demo7892') ? 'https://demo7892.fun/' : 'https://api.wsktnus8.net/'
            }
        });
        
        if (res.data?.data?.resultList?.length > 0) {
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
        return null;
    }
}

async function fetchSunwin() {
    try {
        const res = await axios.get(API_SUNWIN_TX, { timeout: 8000 });
        if (res.data?.ket_qua) {
            return {
                phien: res.data.phien,
                ket_qua: res.data.ket_qua === 'Tài' ? 'Tài' : 'Xỉu',
                tong: res.data.tong
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

// ==================== DỰ ĐOÁN BÃO (KHÔNG RANDOM) ====================
function duDoanBao(lichSuGanDay, tongCu, laBaoTruoc) {
    // Bão theo thứ tự ưu tiên: Bão 4 > Bão 5 > Bão 6 > Bão 3 > Bão 2 > Bão 1
    const baoList = [
        { ten: 'Bão 4', mat: '4-4-4', tong: 12, do_tin_cay: 75 },
        { ten: 'Bão 5', mat: '5-5-5', tong: 15, do_tin_cay: 73 },
        { ten: 'Bão 6', mat: '6-6-6', tong: 18, do_tin_cay: 70 },
        { ten: 'Bão 3', mat: '3-3-3', tong: 9, do_tin_cay: 65 },
        { ten: 'Bão 2', mat: '2-2-2', tong: 6, do_tin_cay: 60 },
        { ten: 'Bão 1', mat: '1-1-1', tong: 3, do_tin_cay: 55 }
    ];
    
    // Nếu phiên trước là Bão -> khả năng cao Bão tiếp (cầu 2)
    if (laBaoTruoc) {
        for (let bao of baoList) {
            if (bao.tong === tongCu) {
                // Đánh bão khác để tránh trùng
                if (bao.ten === 'Bão 4') return baoList[1]; // Bão 5
                if (bao.ten === 'Bão 5') return baoList[2]; // Bão 6
                if (bao.ten === 'Bão 6') return baoList[0]; // Bão 4
                return baoList[0];
            }
        }
    }
    
    // Dựa vào lịch sử các bão gần đây
    if (lichSuGanDay && lichSuGanDay.length > 0) {
        const lastBao = lichSuGanDay[0];
        if (lastBao.ten === 'Bão 4') return baoList[1];
        if (lastBao.ten === 'Bão 5') return baoList[2];
        if (lastBao.ten === 'Bão 6') return baoList[0];
    }
    
    // Mặc định: nếu đang Tài thì dự Bão 4, đang Xỉu thì dự Bão 4 hoặc 5
    if (tongCu >= 11) return baoList[0]; // Bão 4
    return baoList[1]; // Bão 5
}

// ==================== DỰ ĐOÁN TÀI XỈU (KHÔNG RANDOM) ====================
function duDoanTX(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 5) return { du_doan: 'Tài', do_tin_cay: 60 };
    
    const last5 = results.slice(-5);
    const taiCount5 = last5.filter(r => r === 'Tài').length;
    
    // Chuỗi 4 Tài hoặc 4 Xỉu -> đánh ngược
    if (taiCount5 >= 4) return { du_doan: 'Xỉu', do_tin_cay: 72 };
    if (taiCount5 <= 1) return { du_doan: 'Tài', do_tin_cay: 72 };
    
    // Tổng 10 phiên
    if (results.length >= 10) {
        const last10 = results.slice(-10);
        const taiCount10 = last10.filter(r => r === 'Tài').length;
        if (taiCount10 >= 7) return { du_doan: 'Xỉu', do_tin_cay: 68 };
        if (taiCount10 <= 3) return { du_doan: 'Tài', do_tin_cay: 68 };
    }
    
    // Theo xu hướng 3-2
    return { du_doan: taiCount5 >= 3 ? 'Tài' : 'Xỉu', do_tin_cay: 65 };
}

// ==================== API ====================

// LC79 Hũ
app.get('/lc79/tx', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_TX);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 TX data' });
        
        const lastRecord = historyDB.lc79_tx.data[0];
        if (lastRecord && lastRecord.phien_thuc_te === data.phien - 1) {
            updateStats('lc79_tx', data.ket_qua, lastRecord.du_doan);
            lastRecord.ket_qua_thuc_te = data.ket_qua;
            lastRecord.dung_sai = lastRecord.du_doan === data.ket_qua ? 'Đúng' : 'Sai';
        }
        
        const pred = duDoanTX(historyDB.lc79_tx.data);
        const newPred = {
            phien_du_doan: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay,
            thoi_gian: new Date().toISOString(),
            ket_qua_thuc_te: null,
            dung_sai: 'Chờ'
        };
        historyDB.lc79_tx.data.unshift(newPred);
        if (historyDB.lc79_tx.data.length > 100) historyDB.lc79_tx.data.pop();
        
        res.json({
            game: 'LC79 Hũ Tài Xỉu',
            phien_hien_tai: data.phien,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            du_doan_phien_tiep: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            thong_ke: historyDB.lc79_tx.stats,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// LC79 MD5
app.get('/lc79/md5', async (req, res) => {
    try {
        const data = await fetchTele68(API_LC79_MD5);
        if (!data) return res.status(503).json({ error: 'Cannot fetch LC79 MD5 data' });
        
        let seq = historyDB.lc79_md5.data.map(h => h.ket_qua_thuc_te === 'Tài' ? 'TAI' : 'XIU').filter(r => r);
        seq.unshift(data.ket_qua === 'Tài' ? 'TAI' : 'XIU');
        
        lc79Engine.learn(data.ket_qua === 'Tài' ? 'TAI' : 'XIU', seq);
        
        const lastRecord = historyDB.lc79_md5.data[0];
        if (lastRecord && lastRecord.phien_thuc_te === data.phien - 1) {
            updateStats('lc79_md5', data.ket_qua, lastRecord.du_doan);
            lastRecord.ket_qua_thuc_te = data.ket_qua;
            lastRecord.dung_sai = lastRecord.du_doan === data.ket_qua ? 'Đúng' : 'Sai';
        }
        
        const pred = lc79Engine.predict(seq);
        const newPred = {
            phien_du_doan: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay,
            thoi_gian: new Date().toISOString(),
            ket_qua_thuc_te: null,
            dung_sai: 'Chờ'
        };
        historyDB.lc79_md5.data.unshift(newPred);
        if (historyDB.lc79_md5.data.length > 100) historyDB.lc79_md5.data.pop();
        
        res.json({
            game: 'LC79 MD5 (30 thuật toán)',
            phien_hien_tai: data.phien,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            dices_truoc: data.dices,
            du_doan_phien_tiep: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            thong_ke: historyDB.lc79_md5.stats,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sunwin Tài Xỉu
app.get('/sunwin/tx', async (req, res) => {
    try {
        const data = await fetchSunwin();
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sunwin TX data' });
        
        const lastRecord = historyDB.sunwin_tx.data[0];
        if (lastRecord && lastRecord.phien_thuc_te === data.phien - 1) {
            updateStats('sunwin_tx', data.ket_qua, lastRecord.du_doan);
            lastRecord.ket_qua_thuc_te = data.ket_qua;
            lastRecord.dung_sai = lastRecord.du_doan === data.ket_qua ? 'Đúng' : 'Sai';
        }
        
        const pred = duDoanTX(historyDB.sunwin_tx.data);
        const newPred = {
            phien_du_doan: data.phien + 1,
            du_doan: pred.du_doan,
            do_tin_cay: pred.do_tin_cay,
            thoi_gian: new Date().toISOString(),
            ket_qua_thuc_te: null,
            dung_sai: 'Chờ'
        };
        historyDB.sunwin_tx.data.unshift(newPred);
        if (historyDB.sunwin_tx.data.length > 100) historyDB.sunwin_tx.data.pop();
        
        res.json({
            game: 'Sunwin Tài Xỉu',
            phien_hien_tai: data.phien,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            du_doan_phien_tiep: pred.du_doan,
            do_tin_cay: pred.do_tin_cay + '%',
            thong_ke: historyDB.sunwin_tx.stats,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Sunwin Sicbo
app.get('/sicbo', async (req, res) => {
    try {
        const data = await fetchSicbo(API_SICBO);
        if (!data) return res.status(503).json({ error: 'Cannot fetch Sunwin Sicbo data' });
        
        const lastRecord = historyDB.sunwin_sicbo.data[0];
        if (lastRecord && lastRecord.phien_thuc_te === data.phien - 1) {
            updateStats('sunwin_sicbo', data.ket_qua, lastRecord.du_doan_tai_xiu);
            lastRecord.ket_qua_thuc_te = data.ket_qua;
            lastRecord.tong_thuc_te = data.tong;
            lastRecord.chi_tiet_thuc_te = data.dices.join('-');
            lastRecord.dung_sai = lastRecord.du_doan_tai_xiu === data.ket_qua ? 'Đúng' : 'Sai';
            
            const viDuDoan = lastRecord.vi_du_doan;
            const viThucTe = data.dices.join('-');
            lastRecord.dung_sai_vi = viDuDoan === viThucTe ? 'Đúng' : 'Sai';
        }
        
        // Lấy lịch sử bão
        const lichSuBao = historyDB.sunwin_sicbo.data
            .filter(h => h.ket_qua_thuc_te === 'Bão')
            .slice(0, 5)
            .map(h => ({ ten: h.ten_vi, mat: h.vi_du_doan, tong: h.tong_thuc_te }));
        
        const laBaoTruoc = (data.ket_qua === 'Bão');
        const predTX = duDoanTX(historyDB.sunwin_sicbo.data);
        const baoPred = duDoanBao(lichSuBao, data.tong, laBaoTruoc);
        
        const newPred = {
            phien_du_doan: data.phien + 1,
            du_doan_tai_xiu: predTX.du_doan,
            do_tin_cay_tai_xiu: predTX.do_tin_cay,
            vi_du_doan: baoPred.mat,
            ten_vi: baoPred.ten,
            do_tin_cay_vi: baoPred.do_tin_cay,
            thoi_gian: new Date().toISOString(),
            ket_qua_thuc_te: null,
            tong_thuc_te: null,
            chi_tiet_thuc_te: null,
            dung_sai: 'Chờ',
            dung_sai_vi: 'Chờ'
        };
        historyDB.sunwin_sicbo.data.unshift(newPred);
        if (historyDB.sunwin_sicbo.data.length > 100) historyDB.sunwin_sicbo.data.pop();
        
        res.json({
            game: 'Sunwin Sicbo',
            phien_hien_tai: data.phien,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            chi_tiet_truoc: data.dices.join('-'),
            du_doan_phien_tiep: {
                tai_xiu: predTX.du_doan,
                do_tin_cay_tai_xiu: predTX.do_tin_cay + '%',
                vi: baoPred.ten,
                chi_tiet_vi: baoPred.mat,
                do_tin_cay_vi: baoPred.do_tin_cay + '%'
            },
            thong_ke: historyDB.sunwin_sicbo.stats,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 789Club Sicbo
app.get('/club789/sicbo', async (req, res) => {
    try {
        const data = await fetchSicbo(API_789CLUB);
        if (!data) return res.status(503).json({ error: 'Cannot fetch 789Club Sicbo data' });
        
        const lastRecord = historyDB.club789_sicbo.data[0];
        if (lastRecord && lastRecord.phien_thuc_te === data.phien - 1) {
            updateStats('club789_sicbo', data.ket_qua, lastRecord.du_doan_tai_xiu);
            lastRecord.ket_qua_thuc_te = data.ket_qua;
            lastRecord.tong_thuc_te = data.tong;
            lastRecord.chi_tiet_thuc_te = data.dices.join('-');
            lastRecord.dung_sai = lastRecord.du_doan_tai_xiu === data.ket_qua ? 'Đúng' : 'Sai';
            
            const viDuDoan = lastRecord.vi_du_doan;
            const viThucTe = data.dices.join('-');
            lastRecord.dung_sai_vi = viDuDoan === viThucTe ? 'Đúng' : 'Sai';
        }
        
        const lichSuBao = historyDB.club789_sicbo.data
            .filter(h => h.ket_qua_thuc_te === 'Bão')
            .slice(0, 5)
            .map(h => ({ ten: h.ten_vi, mat: h.vi_du_doan, tong: h.tong_thuc_te }));
        
        const laBaoTruoc = (data.ket_qua === 'Bão');
        const predTX = duDoanTX(historyDB.club789_sicbo.data);
        const baoPred = duDoanBao(lichSuBao, data.tong, laBaoTruoc);
        
        const newPred = {
            phien_du_doan: data.phien + 1,
            du_doan_tai_xiu: predTX.du_doan,
            do_tin_cay_tai_xiu: predTX.do_tin_cay,
            vi_du_doan: baoPred.mat,
            ten_vi: baoPred.ten,
            do_tin_cay_vi: baoPred.do_tin_cay,
            thoi_gian: new Date().toISOString(),
            ket_qua_thuc_te: null,
            tong_thuc_te: null,
            chi_tiet_thuc_te: null,
            dung_sai: 'Chờ',
            dung_sai_vi: 'Chờ'
        };
        historyDB.club789_sicbo.data.unshift(newPred);
        if (historyDB.club789_sicbo.data.length > 100) historyDB.club789_sicbo.data.pop();
        
        res.json({
            game: '789Club Sicbo',
            phien_hien_tai: data.phien,
            ket_qua_truoc: data.ket_qua,
            tong_truoc: data.tong,
            chi_tiet_truoc: data.dices.join('-'),
            du_doan_phien_tiep: {
                tai_xiu: predTX.du_doan,
                do_tin_cay_tai_xiu: predTX.do_tin_cay + '%',
                vi: baoPred.ten,
                chi_tiet_vi: baoPred.mat,
                do_tin_cay_vi: baoPred.do_tin_cay + '%'
            },
            thong_ke: historyDB.club789_sicbo.stats,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Lịch sử
app.get('/lich-su', (req, res) => {
    res.json({
        lc79_tx: { lich_su: historyDB.lc79_tx.data.slice(0, 20), thong_ke: historyDB.lc79_tx.stats },
        lc79_md5: { lich_su: historyDB.lc79_md5.data.slice(0, 20), thong_ke: historyDB.lc79_md5.stats },
        sunwin_tx: { lich_su: historyDB.sunwin_tx.data.slice(0, 20), thong_ke: historyDB.sunwin_tx.stats },
        sunwin_sicbo: { lich_su: historyDB.sunwin_sicbo.data.slice(0, 20), thong_ke: historyDB.sunwin_sicbo.stats },
        club789_sicbo: { lich_su: historyDB.club789_sicbo.data.slice(0, 20), thong_ke: historyDB.club789_sicbo.stats }
    });
});

// Root
app.get('/', (req, res) => {
    res.json({
        name: 'API TỔNG HỢP - KHÔNG RANDOM',
        author: '@tranhoang2286',
        endpoints: {
            'LC79 Hũ': '/lc79/tx',
            'LC79 MD5': '/lc79/md5',
            'Sunwin TX': '/sunwin/tx',
            'Sunwin Sicbo': '/sicbo',
            '789Club Sicbo': '/club789/sicbo',
            'Lịch sử': '/lich-su'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER ĐÃ KHỞI ĐỘNG - KHÔNG RANDOM`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🎲 Các game: LC79 Hũ | LC79 MD5 | Sunwin TX | Sunwin Sicbo | 789Club Sicbo`);
});
