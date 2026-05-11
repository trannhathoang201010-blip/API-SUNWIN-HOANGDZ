const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== API NGUỒN (GIỮ NGUYÊN LINK CỦA MÀY) ====================
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const API_HITCLUB = 'https://letting-tackle-newton-oak.trycloudflare.com/api/tx';
const API_LC79_TX = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/tx';
const API_LC79_MD5 = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/txmd5';
const API_BETVIP_TX = 'https://plastic-diet-visits-opens.trycloudflare.com/api/tx';
const API_BETVIP_MD5 = 'https://plastic-diet-visits-opens.trycloudflare.com/api/txmd5';
const API_MAX789 = 'https://cage-adjustment-whose-banner.trycloudflare.com/api/tx';
const API_B52 = 'https://gold-ultra-fails-handles.trycloudflare.com/txmd5';
const API_BCR = 'https://classic-watching-cup-representatives.trycloudflare.com/api/bcr';
const API_SUNWIN_SICBO = 'https://afterwards-motels-honors-vendors.trycloudflare.com/api/sunsicbo';
const API_XOCDIA88_TX = 'https://taixiu.system32-cloudfare-356783752985678522.monster/api/luckydice/GetSoiCau';
const API_XOCDIA88_MD5 = 'https://taixiumd5.system32-cloudfare-356783752985678522.monster/api/md5luckydice/GetSoiCau';

// Cache lịch sử
let predictionsDB = {
    sunwin_tx: [], hitclub: [], lc79_tx: [], lc79_md5: [],
    betvip_tx: [], betvip_md5: [], max789: [], b52: []
};

// ==================== 9 DẠNG CẦU TÀI XỈU ====================
function nhanDangCau(results) {
    if (results.length < 3) return { prediction: 'Tài', confidence: 55, message: 'Đang quan sát (cần ít nhất 3 ván)' };
    
    let last4 = results.slice(-4);
    if (last4[0] === last4[1] && last4[1] === last4[2] && last4[2] === last4[3]) {
        let betLen = 4;
        for (let i = 4; i < results.length; i++) if (results[i] === results[0]) betLen++;
        let conf = Math.min(88, 55 + betLen * 3);
        return { prediction: results[0], confidence: conf, message: `🔴 Bệt ${betLen} phiên ${results[0]}` };
    }
    
    let last5 = results.slice(-5);
    let is11 = true;
    for (let i = 1; i < 5; i++) if (last5[i] === last5[i-1]) { is11 = false; break; }
    if (is11) {
        let pred = last5[4] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 76, message: `🟡 Cầu 1-1 – Bẻ cầu, đặt ${pred}` };
    }
    
    let last6 = results.slice(-6);
    if (last6.length >= 6 && last6[0] === last6[1] && last6[2] === last6[3] && last6[4] === last6[5] && last6[0] !== last6[2]) {
        let pred = last6[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { prediction: pred, confidence: 80, message: `🟢 Cầu 2-2 – Theo cặp, đặt ${pred}` };
    }
    
    let last3 = results.slice(-3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { prediction: pred, confidence: 62, message: `📊 Xu hướng ${tai3}T-${3-tai3}X` };
}

function duDoanTaiXiu(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 2) return { du_doan: 'Tài', do_tin_cay: 55, loai_cau: 'Chưa đủ dữ liệu' };
    let cau = nhanDangCau(results);
    return { du_doan: cau.prediction, do_tin_cay: cau.confidence, loai_cau: cau.message };
}

// ==================== FETCH DỮ LIỆU (THÊM USER-AGENT + TIMEOUT) ====================
async function fetchGame(url) {
    try {
        const res = await axios.get(url, { 
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI' || res.data.ket_qua === 'tài') ? 'Tài' : 'Xỉu';
            let phien = res.data.phien;
            if (typeof phien === 'string' && phien.includes('#')) phien = parseInt(phien.replace('#', ''));
            return { phien, ket_qua, tong: res.data.tong || 0 };
        }
        return null;
    } catch(e) { 
        console.log(`Fetch error: ${e.message}`); 
        return null; 
    }
}

// ==================== TẠO API ĐỘNG CHO TẤT CẢ GAME ====================
const GAMES = [
    { route: '/sunwin/tx', name: 'Sunwin Tài Xỉu', url: API_SUNWIN_TX, key: 'sunwin_tx' },
    { route: '/hitclub', name: 'Hitclub', url: API_HITCLUB, key: 'hitclub' },
    { route: '/lc79/tx', name: 'LC79 Hũ', url: API_LC79_TX, key: 'lc79_tx' },
    { route: '/lc79/md5', name: 'LC79 MD5', url: API_LC79_MD5, key: 'lc79_md5' },
    { route: '/betvip/tx', name: 'Betvip Hũ', url: API_BETVIP_TX, key: 'betvip_tx' },
    { route: '/betvip/md5', name: 'Betvip MD5', url: API_BETVIP_MD5, key: 'betvip_md5' },
    { route: '/max789', name: 'Max789', url: API_MAX789, key: 'max789' },
    { route: '/b52', name: 'B52 MD5', url: API_B52, key: 'b52' }
];

for (let game of GAMES) {
    app.get(game.route, async (req, res) => {
        try {
            const data = await fetchGame(game.url);
            if (!data) return res.status(503).json({ error: `Cannot fetch ${game.name} data` });
            
            let pred = duDoanTaiXiu(predictionsDB[game.key]);
            predictionsDB[game.key].unshift({ 
                phien_du_doan: data.phien + 1, 
                ket_qua_thuc_te: data.ket_qua, 
                du_doan: pred.du_doan,
                timestamp: new Date().toISOString()
            });
            if (predictionsDB[game.key].length > 50) predictionsDB[game.key] = predictionsDB[game.key].slice(0, 50);
            
            res.json({
                game: game.name,
                phien_hien_tai: data.phien + 1,
                du_doan: pred.du_doan,
                do_tin_cay: pred.do_tin_cay + '%',
                phan_tich: pred.loai_cau,
                ket_qua_truoc: data.ket_qua,
                tong_truoc: data.tong,
                id: '@tranhoang2286'
            });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });
}

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
        
        // Phân tích cầu BCR
        let duDoanConCai = 'Con', doTinCayConCai = 60, lyDoConCai = 'Theo xu hướng';
        if (allResults.length >= 3) {
            let bet = 1;
            for (let i = allResults.length - 2; i >= 0; i--) {
                if (allResults[i] === lastResult) bet++;
                else break;
            }
            if (bet >= 3) {
                duDoanConCai = lastResult === 'B' ? 'Con' : 'Cái';
                doTinCayConCai = Math.min(85, 55 + bet * 4);
                lyDoConCai = `Bệt ${bet} ván ${duDoanConCai}`;
            } else {
                let dao = 1;
                for (let i = allResults.length - 2; i >= 0; i--) {
                    if (allResults[i] !== allResults[i+1]) dao++;
                    else break;
                }
                if (dao >= 4) {
                    duDoanConCai = lastResult === 'B' ? 'Cái' : 'Con';
                    doTinCayConCai = Math.min(82, 58 + dao * 2);
                    lyDoConCai = `Đảo ${dao} ván → ${duDoanConCai}`;
                } else if (bCount > pCount + 3) {
                    duDoanConCai = 'Cái';
                    doTinCayConCai = 70;
                    lyDoConCai = `Con đang nóng (${bCount}/${allResults.length}) → bẻ Cái`;
                } else if (pCount > bCount + 3) {
                    duDoanConCai = 'Con';
                    doTinCayConCai = 70;
                    lyDoConCai = `Cái đang nóng (${pCount}/${allResults.length}) → bẻ Con`;
                }
            }
        }
        
        let duDoanHoa = 'Không', doTinCayHoa = 85;
        if (tCount >= 2 && allResults.slice(-5).includes('T')) {
            duDoanHoa = 'Có';
            doTinCayHoa = 65;
        }
        
        let duDoanConDoi = 'Không', doTinCayConDoi = 85;
        if (allResults.slice(-2) === 'BB') { duDoanConDoi = 'Có'; doTinCayConDoi = 70; }
        
        let duDoanCaiDoi = 'Không', doTinCayCaiDoi = 85;
        if (allResults.slice(-2) === 'PP') { duDoanCaiDoi = 'Có'; doTinCayCaiDoi = 70; }
        
        res.json({
            game: 'BCR Sexy',
            ban: banId,
            du_doan_con_cai: duDoanConCai,
            do_tin_cay_con_cai: doTinCayConCai + '%',
            ly_do_con_cai: lyDoConCai,
            du_doan_hoa: duDoanHoa,
            do_tin_cay_hoa: doTinCayHoa + '%',
            du_doan_con_doi: duDoanConDoi,
            do_tin_cay_con_doi: doTinCayConDoi + '%',
            du_doan_cai_doi: duDoanCaiDoi,
            do_tin_cay_cai_doi: doTinCayCaiDoi + '%',
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
            for (let i = resultsStr.length - 2; i >= 0; i--) {
                if (resultsStr[i] === last) bet++;
                else break;
            }
            let duDoan = (bet >= 3) ? (last === 'B' ? 'Con' : 'Cái') : (last === 'B' ? 'Cái' : 'Con');
            let doTinCay = bet >= 3 ? Math.min(85, 55 + bet * 4) : 62;
            all[banId] = { du_doan: duDoan, do_tin_cay: doTinCay + '%' };
        }
        res.json({ game: 'BCR Sexy', all_bans: all, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== SUNWIN SICBO ====================
app.get('/sunwin/sicbo', async (req, res) => {
    try {
        const response = await axios.get(API_SUNWIN_SICBO, { timeout: 10000 });
        if (!response.data) return res.status(503).json({ error: 'Cannot fetch Sicbo data' });
        
        let tong = response.data.tong;
        let duDoan = tong >= 11 ? 'Tài' : 'Xỉu';
        let doTinCay = 75;
        let viGiai = [];
        
        if (tong >= 11) {
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
            phien: response.data.phien,
            du_doan: duDoan,
            do_tin_cay: doTinCay + '%',
            tong: tong,
            vi_du_doan: viGiai.join(', '),
            id: '@tranhoang2286'
        });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ==================== XOCDIA88 ====================
app.get('/xocdia88/tx', async (req, res) => {
    try {
        const response = await axios.get(API_XOCDIA88_TX, { timeout: 10000 });
        if (!response.data || !response.data.length) return res.status(503).json({ error: 'Cannot fetch XocDia88 data' });
        let last = response.data[0];
        let ketQua = last.BetSide === 0 ? 'Tài' : 'Xỉu';
        res.json({ game: 'XocDia88 Tài Xỉu', phien: last.SessionId, ket_qua: ketQua, tong: last.DiceSum, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/xocdia88/md5', async (req, res) => {
    try {
        const response = await axios.get(API_XOCDIA88_MD5, { timeout: 10000 });
        if (!response.data || !response.data.length) return res.status(503).json({ error: 'Cannot fetch XocDia88 MD5 data' });
        let last = response.data[0];
        let ketQua = last.BetSide === 0 ? 'Tài' : 'Xỉu';
        res.json({ game: 'XocDia88 MD5', phien: last.SessionId, ket_qua: ketQua, tong: last.DiceSum, id: '@tranhoang2286' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'TỔNG HỢP API TÀI XỈU - BCR - SICBO',
        author: '@tranhoang2286',
        endpoints: {
            'Sunwin Tài Xỉu': '/sunwin/tx',
            'Sunwin Sicbo': '/sunwin/sicbo',
            'Hitclub': '/hitclub',
            'LC79 Hũ': '/lc79/tx',
            'LC79 MD5': '/lc79/md5',
            'Betvip Hũ': '/betvip/tx',
            'Betvip MD5': '/betvip/md5',
            'Max789': '/max789',
            'B52 MD5': '/b52',
            'XocDia88 Tài Xỉu': '/xocdia88/tx',
            'XocDia88 MD5': '/xocdia88/md5',
            'BCR danh sách bàn': '/bcr/bans',
            'BCR 1 bàn': '/bcr/ban/:banId',
            'BCR tất cả': '/bcr/all'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER TỔNG HỢP - ${GAMES.length + 5} GAME`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`✅ Sunwin | Hitclub | LC79 | Betvip | Max789 | B52 | XocDia88 | BCR | Sicbo`);
});
