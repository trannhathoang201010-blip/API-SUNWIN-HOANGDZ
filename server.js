const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== API NGUỒN ====================
const API_SUNWIN_TX = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const API_HITCLUB = 'https://letting-tackle-newton-oak.trycloudflare.com/api/tx';
const API_LC79_TX = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/tx';
const API_LC79_MD5 = 'https://chance-compete-chambers-feelings.trycloudflare.com/api/txmd5';
const API_BETVIP_TX = 'https://plastic-diet-visits-opens.trycloudflare.com/api/tx';
const API_BETVIP_MD5 = 'https://plastic-diet-visits-opens.trycloudflare.com/api/txmd5';
const API_MAX789 = 'https://cage-adjustment-whose-banner.trycloudflare.com/api/tx';
const API_B52 = 'https://gold-ultra-fails-handles.trycloudflare.com/txmd5';
const API_BCR = 'https://classic-watching-cup-representatives.trycloudflare.com/api/bcr';
const API_XOCDIA88_TX = 'https://taixiu.system32-cloudfare-356783752985678522.monster/api/luckydice/GetSoiCau';
const API_XOCDIA88_MD5 = 'https://taixiumd5.system32-cloudfare-356783752985678522.monster/api/md5luckydice/GetSoiCau';

// Cache lịch sử
let predictionsDB = {
    sunwin_tx: [], hitclub: [], lc79_tx: [], lc79_md5: [],
    betvip_tx: [], betvip_md5: [], max789: [], b52: [],
    xocdia88_tx: [], xocdia88_md5: []
};

// ==================== 9 DẠNG CẦU TÀI XỈU ====================
function nhanDangCau(results) {
    if (results.length < 3) return { type: 'QUAN_SAT', action: 'THEO_XU_HUONG', message: 'Đang quan sát (cần ít nhất 3 ván)', confidence: 55 };
    
    // 1. Bệt (4+ ván giống nhau)
    let last4 = results.slice(-4);
    if (last4[0] === last4[1] && last4[1] === last4[2] && last4[2] === last4[3]) {
        let betLen = 4;
        for (let i = 4; i < results.length; i++) if (results[i] === results[0]) betLen++;
        let conf = Math.min(88, 55 + betLen * 3);
        return { type: 'BET', prediction: results[0], action: 'THEO_DUOI', message: `🔴 Cầu Bệt ${betLen} phiên ${results[0]}`, confidence: conf };
    }
    
    // 2. Đảo 1-1
    let last5 = results.slice(-5);
    let is11 = true;
    for (let i = 1; i < 5; i++) if (last5[i] === last5[i-1]) { is11 = false; break; }
    if (is11 && last5.length === 5) {
        let pred = last5[4] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'DAO_11', prediction: pred, action: 'BE_CAU', message: `🟡 Cầu 1-1 – Bẻ cầu, đặt ${pred}`, confidence: 76 };
    }
    
    // 3. Cầu 2-2
    let last6 = results.slice(-6);
    if (last6.length >= 6 && last6[0] === last6[1] && last6[2] === last6[3] && last6[4] === last6[5] && last6[0] !== last6[2]) {
        let pred = last6[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_22', prediction: pred, action: 'THEO_CAP', message: `🟢 Cầu 2-2 – Theo cặp, đặt ${pred}`, confidence: 80 };
    }
    
    // 4. Cầu 3-2-1
    if (last6.length === 6 && last6[0] === last6[1] && last6[1] === last6[2] && last6[3] === last6[4] && last6[0] !== last6[3] && last6[5] === last6[0]) {
        return { type: 'CAU_321', prediction: 'Xỉu', action: 'THEO_NHIP', message: `📊 Cầu 3-2-1 (TTTXXT) – Theo nhịp giảm dần`, confidence: 78 };
    }
    if (last6.length === 6 && last6[0] !== 'Tài' && last6[1] !== 'Tài' && last6[2] !== 'Tài' && last6[3] === 'Tài' && last6[4] === 'Tài' && last6[5] !== 'Tài') {
        return { type: 'CAU_321', prediction: 'Tài', action: 'THEO_NHIP', message: `📊 Cầu 3-2-1 (XXXTTX) – Theo nhịp giảm`, confidence: 78 };
    }
    
    // 5. Cầu 1-2-3
    if (last6.length === 6 && last6[0] !== last6[1] && last6[1] === last6[2] && last6[2] !== last6[3] && last6[3] === last6[4] && last6[4] === last6[5]) {
        return { type: 'CAU_123', prediction: 'Xỉu', action: 'THEO_TIEN', message: `📈 Cầu 1-2-3 (TXXTTT) – Vào tiền tăng dần`, confidence: 82 };
    }
    if (last6.length === 6 && last6[0] !== 'Tài' && last6[1] === 'Tài' && last6[2] === 'Tài' && last6[3] !== 'Tài' && last6[4] !== 'Tài' && last6[5] !== 'Tài') {
        return { type: 'CAU_123', prediction: 'Tài', action: 'THEO_TIEN', message: `📈 Cầu 1-2-3 (XTTXXX) – Vào tiền tăng dần`, confidence: 82 };
    }
    
    // 6. Cầu 3-3
    let last9 = results.slice(-9);
    if (last9.length >= 9 && last9[0]===last9[1] && last9[1]===last9[2] && last9[3]===last9[4] && last9[4]===last9[5] && last9[6]===last9[7] && last9[7]===last9[8] && last9[0]!==last9[3] && last9[3]!==last9[6]) {
        let pred = last9[6] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_33', prediction: pred, action: 'THAN_TRONG', message: `🟣 Cầu 3-3 (TTTXXXTTT) – Rủi ro cao`, confidence: 74 };
    }
    
    // 7. Cầu 4-2-4
    let last10 = results.slice(-10);
    if (last10.length >= 10 && last10[0]===last10[1] && last10[1]===last10[2] && last10[2]===last10[3] && last10[4]===last10[5] && last10[6]===last10[7] && last10[7]===last10[8] && last10[8]===last10[9] && last10[0]!==last10[4] && last10[4]!==last10[6]) {
        let pred = last10[6] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_424', prediction: pred, action: 'THAN_TRONG', message: `📐 Cầu 4-2-4 (TTTTXXTTTT) – Rủi ro cao`, confidence: 72 };
    }
    
    // 8. Cầu 2-1-2
    if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] === last6[4] && last6[4] !== last6[5]) {
        let pred = last6[0] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_212', prediction: pred, action: 'THAN_TRONG', message: `🔁 Cầu 2-1-2 (TTXTTX) – Chu kỳ ngắn`, confidence: 73 };
    }
    
    // 9. Zigzag (rối) – không có cầu rõ ràng
    let last3 = results.slice(-3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let pred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return { type: 'ZIGZAG', prediction: pred, action: 'THEO_XU_HUONG', message: `🌀 Cầu rối – Theo xu hướng ${tai3}T-${3-tai3}X`, confidence: 62 };
}

// ==================== THUẬT TOÁN TÀI XỈU CHÍNH ====================
function duDoanTaiXiu(history) {
    let results = history.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length < 2) return { du_doan: 'Tài', do_tin_cay: 55, loai_cau: 'Chưa đủ dữ liệu', chi_tiet: 'Cần ít nhất 2 phiên để phân tích' };
    
    let cau = nhanDangCau(results);
    let du_doan = cau.prediction;
    let do_tin_cay = cau.confidence;
    let loai_cau = cau.type;
    let chi_tiet = cau.message;
    
    return { du_doan, do_tin_cay, loai_cau, chi_tiet };
}

// ==================== FETCH DỮ LIỆU ====================
async function fetchGame(url, type = 'default') {
    try {
        const res = await axios.get(url, { timeout: 8000 });
        if (type === 'xocdia' && Array.isArray(res.data) && res.data.length > 0) {
            let last = res.data[0];
            let ketQua = last.BetSide === 0 ? 'Tài' : 'Xỉu';
            return { phien: last.SessionId, ket_qua: ketQua, tong: last.DiceSum };
        }
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI' || res.data.ket_qua === 'tài') ? 'Tài' : 'Xỉu';
            let phien = res.data.phien;
            if (typeof phien === 'string' && phien.includes('#')) phien = parseInt(phien.replace('#', ''));
            return { phien, ket_qua, tong: res.data.tong || 0 };
        }
        return null;
    } catch(e) { console.log(`Fetch error ${url}:`, e.message); return null; }
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
    { route: '/b52', name: 'B52 MD5', url: API_B52, key: 'b52' },
    { route: '/xocdia88/tx', name: 'XocDia88 Tài Xỉu', url: API_XOCDIA88_TX, key: 'xocdia88_tx', type: 'xocdia' },
    { route: '/xocdia88/md5', name: 'XocDia88 MD5', url: API_XOCDIA88_MD5, key: 'xocdia88_md5', type: 'xocdia' }
];

for (let game of GAMES) {
    app.get(game.route, async (req, res) => {
        try {
            const data = await fetchGame(game.url, game.type || 'default');
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
                loai_cau: pred.loai_cau,
                chi_tiet_cau: pred.chi_tiet,
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
        
        // Phân tích cầu cho BCR
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
            thong_ke: { tong_van: allResults.length, con: bCount, cai: pCount, hoa: tCount, ty_le_con: ((bCount/allResults.length)*100).toFixed(1)+'%', ty_le_cai: ((pCount/allResults.length)*100).toFixed(1)+'%' },
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

// ==================== LỊCH SỬ & RESET ====================
app.get('/lichsu/:game', (req, res) => {
    const gameKey = req.params.game;
    if (!predictionsDB[gameKey]) return res.status(404).json({ error: 'Game not found' });
    res.json({ game: gameKey, lich_su: predictionsDB[gameKey].slice(0, 30), id: '@tranhoang2286' });
});

app.post('/reset/:game', (req, res) => {
    const gameKey = req.params.game;
    if (predictionsDB[gameKey]) predictionsDB[gameKey] = [];
    res.json({ success: true, message: `Reset ${gameKey} history`, id: '@tranhoang2286' });
});

app.get('/', (req, res) => {
    res.json({
        name: 'TỔNG HỢP API TÀI XỈU + BCR + XOCDIA88',
        author: '@tranhoang2286',
        version: 'ULTIMATE',
        so_luong_game: GAMES.length + 1,
        danh_sach_game: [...GAMES.map(g => g.route), '/bcr/bans', '/bcr/ban/:banId', '/bcr/all'],
        loai_cau_ho_tro: ['Bệt', 'Đảo 1-1', '2-2', '3-2-1', '1-2-3', '3-3', '4-2-4', '2-1-2', 'Zigzag'],
        endpoints: {
            'Sunwin Tài Xỉu': '/sunwin/tx',
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
            'BCR tất cả': '/bcr/all',
            'Lịch sử theo game': '/lichsu/:game',
            'Reset game': '/reset/:game (POST)'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SERVER TỔNG HỢP - ${GAMES.length + 1} GAME | 9 DẠNG CẦU`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`✅ Sunwin | Hitclub | LC79 | Betvip | Max789 | B52 | XocDia88 | BCR`);
    for (let game of GAMES) console.log(`   📌 ${game.route}`);
    console.log(`   📌 /bcr/bans - /bcr/ban/1 - /bcr/all`);
});
