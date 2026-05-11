const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== API NGUỒN ====================
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const API_SUNWIN_SICBO = 'https://afterwards-motels-honors-vendors.trycloudflare.com/api/sunsicbo';
const API_HITCLUB = 'https://letting-tackle-newton-oak.trycloudflare.com/api/tx';
const API_LC79_TX = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/tx';
const API_LC79_MD5 = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/txmd5';
const API_BETVIP_TX = 'https://plastic-diet-visits-opens.trycloudflare.com/api/tx';
const API_BETVIP_MD5 = 'https://plastic-diet-visits-opens.trycloudflare.com/api/txmd5';
const API_MAX789 = 'https://cage-adjustment-whose-banner.trycloudflare.com/api/tx';
const API_B52 = 'https://gold-ultra-fails-handles.trycloudflare.com/txmd5';
const API_BCR = 'https://classic-watching-cup-representatives.trycloudflare.com/api/bcr';

// Cache lịch sử
let predictionsDB = {
    sunwin_tx: [], sunwin_sicbo: [], hitclub: [],
    lc79_tx: [], lc79_md5: [], betvip_tx: [], betvip_md5: [],
    max789: [], b52: [], bcr: {}
};

// ==================== THUẬT TOÁN TÀI XỈU (DÙNG CHUNG) ====================
function duDoanTaiXiu(history) {
    let results = history.slice(0, 20).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 2) return { du_doan: 'Tài', do_tin_cay: 55, loai_cau: 'Chưa đủ dữ liệu' };
    
    // Bệt
    let bet = 1;
    for (let i = 1; i < Math.min(results.length, 10); i++) {
        if (results[i] === results[0]) bet++;
        else break;
    }
    if (bet >= 3) {
        let conf = Math.min(88, 50 + bet * 4);
        return { du_doan: results[0], do_tin_cay: conf, loai_cau: `Bệt ${bet} phiên` };
    }
    
    // Đảo 1-1
    let dao = 1;
    for (let i = 1; i < Math.min(results.length, 12); i++) {
        if (results[i] !== results[i-1]) dao++;
        else break;
    }
    if (dao >= 4) {
        let pred = results[dao-1] === 'Tài' ? 'Xỉu' : 'Tài';
        let conf = Math.min(84, 55 + dao * 2);
        return { du_doan: pred, do_tin_cay: conf, loai_cau: `Đảo ${dao} nhịp` };
    }
    
    // Xu hướng 3 phiên
    let last3 = results.slice(0, 3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { du_doan: pred, do_tin_cay: 62, loai_cau: `Xu hướng ${tai3}T-${3-tai3}X` };
}

// ==================== FETCH DỮ LIỆU ====================
async function fetchGame(url, type) {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (type === 'sunwin_tx' && res.data?.taixiu) {
            let last = res.data.taixiu[0];
            return { phien: last.Phien, ket_qua: last.Ket_qua === 'Tài' ? 'Tài' : 'Xỉu', tong: last.Tong };
        }
        if ((type === 'taixiu_single' || type === 'lc79' || type === 'betvip' || type === 'max789') && res.data?.ket_qua) {
            let ketQua = res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI' ? 'Tài' : 'Xỉu';
            return { phien: res.data.phien, ket_qua: ketQua, tong: res.data.tong };
        }
        if (type === 'b52' && res.data?.ket_qua) {
            let ketQua = res.data.ket_qua === 'tài' ? 'Tài' : 'Xỉu';
            return { phien: res.data.phien, ket_qua: ketQua, tong: res.data.tong };
        }
        if (type === 'sicbo' && res.data?.ket_qua) {
            let ketQua = res.data.ket_qua === 'Tài' ? 'Tài' : 'Xỉu';
            return { phien: parseInt(res.data.phien.replace('#', '')), ket_qua: ketQua, tong: res.data.tong, x1: res.data.xuc_xac_1, x2: res.data.xuc_xac_2, x3: res.data.xuc_xac_3 };
        }
        if (type === 'bcr' && res.data?.data) {
            let bans = {};
            for (let ban of res.data.data) {
                if (!bans[ban.ban]) bans[ban.ban] = '';
                if (ban.results) bans[ban.ban] += ban.results;
            }
            return { bans };
        }
        return null;
    } catch(e) { return null; }
}

// ==================== SUNWIN TÀI XỈU ====================
app.get('/sunwin/tx', async (req, res) => {
    try {
        const data = await fetchGame(API_SUNWIN_TX, 'sunwin_tx');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.sunwin_tx);
        predictionsDB.sunwin_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Sunwin Tài Xỉu', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== SUNWIN SICBO (Tài Xỉu + Vị) ====================
app.get('/sunwin/sicbo', async (req, res) => {
    try {
        const data = await fetchGame(API_SUNWIN_SICBO, 'sicbo');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        
        // Phân tích vị dựa trên tổng điểm
        let tong = data.tong;
        let duDoan = tong >= 11 ? 'Tài' : 'Xỉu';
        let doTinCay = 75;
        let viGiai = [];
        
        if (tong >= 11) {
            if (tong === 11) viGiai.push('3-4-4, 2-4-5');
            else if (tong === 12) viGiai.push('3-4-5, 2-5-5, 4-4-4');
            else if (tong === 13) viGiai.push('4-4-5, 3-5-5, 3-4-6');
            else if (tong === 14) viGiai.push('4-5-5, 4-4-6, 2-6-6');
            else if (tong === 15) viGiai.push('5-5-5, 3-6-6, 4-5-6');
            else if (tong === 16) viGiai.push('5-5-6, 4-6-6');
            else if (tong === 17) viGiai.push('5-6-6');
            else if (tong === 18) viGiai.push('6-6-6');
        } else {
            if (tong === 4) viGiai.push('1-1-2');
            else if (tong === 5) viGiai.push('1-1-3, 1-2-2');
            else if (tong === 6) viGiai.push('1-1-4, 1-2-3, 2-2-2');
            else if (tong === 7) viGiai.push('1-1-5, 1-2-4, 1-3-3, 2-2-3');
            else if (tong === 8) viGiai.push('1-1-6, 1-2-5, 1-3-4, 2-2-4, 2-3-3');
            else if (tong === 9) viGiai.push('1-2-6, 1-3-5, 1-4-4, 2-2-5, 2-3-4, 3-3-3');
            else if (tong === 10) viGiai.push('1-3-6, 1-4-5, 2-2-6, 2-3-5, 2-4-4, 3-3-4');
        }
        
        res.json({
            game: 'Sunwin Sicbo',
            phien_hien_tai: data.phien + 1,
            du_doan: duDoan,
            do_tin_cay: doTinCay + '%',
            tong_diem: tong,
            vi_du_doan: viGiai.join(', '),
            ket_qua_truoc: data.ket_qua,
            id: '@tranhoang2286'
        });
    } catch(e) {
        res.json({ game: 'Sunwin Sicbo', du_doan: 'Tài', do_tin_cay: '65%', vi_du_doan: '11,12,13,14', id: '@tranhoang2286' });
    }
});

// ==================== HITCLUB ====================
app.get('/hitclub', async (req, res) => {
    try {
        const data = await fetchGame(API_HITCLUB, 'taixiu_single');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.hitclub);
        predictionsDB.hitclub.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Hitclub', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== LC79 HŨ ====================
app.get('/lc79/tx', async (req, res) => {
    try {
        const data = await fetchGame(API_LC79_TX, 'lc79');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.lc79_tx);
        predictionsDB.lc79_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'LC79 Hũ', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== LC79 MD5 ====================
app.get('/lc79/md5', async (req, res) => {
    try {
        const data = await fetchGame(API_LC79_MD5, 'lc79');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.lc79_md5);
        predictionsDB.lc79_md5.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'LC79 MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BETVIP HŨ ====================
app.get('/betvip/tx', async (req, res) => {
    try {
        const data = await fetchGame(API_BETVIP_TX, 'betvip');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_tx);
        predictionsDB.betvip_tx.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip Hũ', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BETVIP MD5 ====================
app.get('/betvip/md5', async (req, res) => {
    try {
        const data = await fetchGame(API_BETVIP_MD5, 'betvip');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.betvip_md5);
        predictionsDB.betvip_md5.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Betvip MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== MAX789 ====================
app.get('/max789', async (req, res) => {
    try {
        const data = await fetchGame(API_MAX789, 'max789');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.max789);
        predictionsDB.max789.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'Max789', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== B52 MD5 ====================
app.get('/b52', async (req, res) => {
    try {
        const data = await fetchGame(API_B52, 'b52');
        if (!data) return res.status(503).json({ error: 'Cannot fetch data' });
        let pred = duDoanTaiXiu(predictionsDB.b52);
        predictionsDB.b52.unshift({ phien_du_doan: data.phien + 1, ket_qua_thuc_te: data.ket_qua, du_doan: pred.du_doan });
        res.json({ game: 'B52 MD5', phien_hien_tai: data.phien + 1, du_doan: pred.du_doan, do_tin_cay: pred.do_tin_cay + '%', loai_cau: pred.loai_cau, ket_qua_truoc: data.ket_qua, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BCR - DANH SÁCH BÀN ====================
app.get('/bcr/bans', async (req, res) => {
    try {
        const data = await fetchGame(API_BCR, 'bcr');
        if (!data?.bans) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let banList = Object.keys(data.bans).sort();
        res.json({ success: true, total_bans: banList.length, bans: banList, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BCR - DỰ ĐOÁN 1 BÀN ====================
app.get('/bcr/ban/:banId', async (req, res) => {
    try {
        const banId = req.params.banId;
        const data = await fetchGame(API_BCR, 'bcr');
        if (!data?.bans || !data.bans[banId]) return res.status(404).json({ error: `Ban ${banId} not found` });
        
        let resultsStr = data.bans[banId];
        let lastResult = resultsStr.length > 0 ? resultsStr[resultsStr.length - 1] : '?';
        let bCount = (resultsStr.match(/B/g) || []).length;
        let pCount = (resultsStr.match(/P/g) || []).length;
        let tCount = (resultsStr.match(/T/g) || []).length;
        
        // Dự đoán Con/Cái
        let duDoanConCai = 'Con', doTinCayConCai = 60, lyDoConCai = 'Theo xu hướng';
        if (resultsStr.length >= 3) {
            let bet = 1;
            for (let i = resultsStr.length - 2; i >= 0; i--) {
                if (resultsStr[i] === lastResult) bet++;
                else break;
            }
            if (bet >= 3) {
                duDoanConCai = lastResult === 'B' ? 'Con' : 'Cái';
                doTinCayConCai = Math.min(85, 55 + bet * 4);
                lyDoConCai = `Bệt ${bet} ván ${duDoanConCai}`;
            } else {
                let dao = 1;
                for (let i = resultsStr.length - 2; i >= 0; i--) {
                    if (resultsStr[i] !== resultsStr[i+1]) dao++;
                    else break;
                }
                if (dao >= 4) {
                    duDoanConCai = lastResult === 'B' ? 'Cái' : 'Con';
                    doTinCayConCai = Math.min(82, 58 + dao * 2);
                    lyDoConCai = `Đảo ${dao} ván → ${duDoanConCai}`;
                }
            }
        }
        
        // Dự đoán Hòa
        let duDoanHoa = 'Không', doTinCayHoa = 85, lyDoHoa = 'Hòa hiếm';
        if (tCount >= 2 && resultsStr.slice(-5).includes('T')) {
            duDoanHoa = 'Có';
            doTinCayHoa = 65;
            lyDoHoa = `Hòa xuất hiện ${tCount} lần`;
        }
        
        // Dự đoán Con Đôi (BB)
        let duDoanConDoi = 'Không', doTinCayConDoi = 85, lyDoConDoi = 'Con đôi hiếm';
        if (resultsStr.slice(-2) === 'BB') {
            duDoanConDoi = 'Có';
            doTinCayConDoi = 70;
            lyDoConDoi = 'Ván trước có BB';
        }
        
        // Dự đoán Cái Đôi (PP)
        let duDoanCaiDoi = 'Không', doTinCayCaiDoi = 85, lyDoCaiDoi = 'Cái đôi hiếm';
        if (resultsStr.slice(-2) === 'PP') {
            duDoanCaiDoi = 'Có';
            doTinCayCaiDoi = 70;
            lyDoCaiDoi = 'Ván trước có PP';
        }
        
        res.json({
            game: 'BCR Sexy', ban: banId,
            du_doan_con_cai: duDoanConCai, do_tin_cay_con_cai: doTinCayConCai + '%', ly_do_con_cai: lyDoConCai,
            du_doan_hoa: duDoanHoa, do_tin_cay_hoa: doTinCayHoa + '%', ly_do_hoa: lyDoHoa,
            du_doan_con_doi: duDoanConDoi, do_tin_cay_con_doi: doTinCayConDoi + '%', ly_do_con_doi: lyDoConDoi,
            du_doan_cai_doi: duDoanCaiDoi, do_tin_cay_cai_doi: doTinCayCaiDoi + '%', ly_do_cai_doi: lyDoCaiDoi,
            thong_ke: { tong_van: resultsStr.length, con: bCount, cai: pCount, hoa: tCount },
            id: '@tranhoang2286'
        });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== BCR - TẤT CẢ BÀN ====================
app.get('/bcr/all', async (req, res) => {
    try {
        const data = await fetchGame(API_BCR, 'bcr');
        if (!data?.bans) return res.status(503).json({ error: 'Cannot fetch BCR data' });
        let all = {};
        for (let [banId, resultsStr] of Object.entries(data.bans)) {
            let lastResult = resultsStr.length > 0 ? resultsStr[resultsStr.length - 1] : '?';
            let bet = 1;
            for (let i = resultsStr.length - 2; i >= 0; i--) {
                if (resultsStr[i] === lastResult) bet++;
                else break;
            }
            let duDoan = (bet >= 3 && lastResult === 'B') ? 'Con' : ((bet >= 3 && lastResult === 'P') ? 'Cái' : (lastResult === 'B' ? 'Cái' : 'Con'));
            let doTinCay = bet >= 3 ? Math.min(85, 55 + bet * 4) : 62;
            all[banId] = { du_doan: duDoan, do_tin_cay: doTinCay + '%' };
        }
        res.json({ game: 'BCR Sexy', all_bans: all, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== LỊCH SỬ (Cho Sunwin Tài Xỉu) ====================
app.get('/sunwin/lichsu', (req, res) => {
    res.json({ game: 'Sunwin Tài Xỉu', lich_su: predictionsDB.sunwin_tx.slice(0, 20), id: '@tranhoang2286' });
});

// ==================== RESET ====================
app.post('/reset', (req, res) => {
    for (let k of Object.keys(predictionsDB)) predictionsDB[k] = [];
    res.json({ success: true, message: 'Reset all history', id: '@tranhoang2286' });
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'TỔNG HỢP API TÀI XỈU - BCR - SICBO',
        author: '@tranhoang2286',
        endpoints: {
            'Sunwin Tài Xỉu': '/sunwin/tx', 'Sunwin Sicbo': '/sunwin/sicbo', 'Hitclub': '/hitclub',
            'LC79 Hũ': '/lc79/tx', 'LC79 MD5': '/lc79/md5', 'Betvip Hũ': '/betvip/tx', 'Betvip MD5': '/betvip/md5',
            'Max789': '/max789', 'B52 MD5': '/b52', 'BCR Danh sách bàn': '/bcr/bans',
            'BCR 1 bàn': '/bcr/ban/:banId', 'BCR Tất cả': '/bcr/all', 'Lịch sử Sunwin': '/sunwin/lichsu'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER TỔNG HỢP - ${Object.keys(predictionsDB).length} GAME`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`✅ Sunwin | Hitclub | LC79 | Betvip | Max789 | B52 | BCR | Sicbo`);
});
