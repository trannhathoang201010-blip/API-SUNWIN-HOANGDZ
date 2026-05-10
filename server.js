const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

// ==================== CẤU HÌNH ====================
const API_URL = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const HISTORY_FILE = 'prediction_history.json';
const LEARNING_FILE = 'learning_data.json';
const PATTERN_FILE = 'pattern_library.json';

let predictionsDB = [];
let learningStats = {
    total: 0,
    correct: 0,
    wrong: 0,
    currentStreak: 0,
    bestStreak: 0,
    worstStreak: 0,
    patternStats: {},
    weightAdjustments: {},
    lastUpdate: null
};

let patternLibrary = {
    detectedPatterns: [],
    patternFrequency: {},
    patternSuccessRate: {}
};

// ==================== HÀM ĐỌC/GHI FILE ====================
function loadAllData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) predictionsDB = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        if (fs.existsSync(LEARNING_FILE)) learningStats = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
        if (fs.existsSync(PATTERN_FILE)) patternLibrary = JSON.parse(fs.readFileSync(PATTERN_FILE, 'utf8'));
        console.log(`📂 Đã tải: ${predictionsDB.length} dự đoán | ${Object.keys(learningStats.patternStats).length} mẫu cầu`);
    } catch(e) { console.log('Khởi tạo dữ liệu mới'); }
}

function saveAllData() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2));
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningStats, null, 2));
        fs.writeFileSync(PATTERN_FILE, JSON.stringify(patternLibrary, null, 2));
    } catch(e) { console.log('Lỗi lưu:', e.message); }
}

// ==================== LẤY DỮ LIỆU TỪ NHÀ CÁI ====================
async function fetchCurrentGame() {
    try {
        const res = await axios.get(API_URL, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI') ? 'Tài' : 'Xỉu';
            return {
                phien: res.data.phien,
                ket_qua: ketQua,
                tong: res.data.tong,
                x1: res.data.xuc_xac_1,
                x2: res.data.xuc_xac_2,
                x3: res.data.xuc_xac_3,
                thoi_gian: res.data.thoi_gian
            };
        }
        return null;
    } catch(e) { console.log('Lỗi fetch API:', e.message); return null; }
}

// ==================== CẬP NHẬT KẾT QUẢ CHO DỰ ĐOÁN CŨ ====================
function updateOldPredictions(currentPhien, currentKetQua, currentTong) {
    let updated = false;
    for (let p of predictionsDB) {
        if (p.phien_du_doan === currentPhien && !p.ket_qua_thuc_te) {
            p.ket_qua_thuc_te = currentKetQua;
            p.tong_thuc_te = currentTong;
            p.dung_sai = (p.du_doan === currentKetQua) ? '✅' : '❌';
            
            // Cập nhật học tập
            if (p.dung_sai === '✅') {
                learningStats.correct++;
                learningStats.currentStreak = learningStats.currentStreak >= 0 ? learningStats.currentStreak + 1 : 1;
                if (learningStats.currentStreak > learningStats.bestStreak) learningStats.bestStreak = learningStats.currentStreak;
            } else {
                learningStats.wrong++;
                learningStats.currentStreak = learningStats.currentStreak <= 0 ? learningStats.currentStreak - 1 : -1;
                if (learningStats.currentStreak < learningStats.worstStreak) learningStats.worstStreak = learningStats.currentStreak;
            }
            learningStats.total++;
            
            // Cập nhật thống kê pattern
            if (!learningStats.patternStats[p.pattern_key]) {
                learningStats.patternStats[p.pattern_key] = { total: 0, correct: 0, accuracy: 0.5, weight: 1.0 };
            }
            learningStats.patternStats[p.pattern_key].total++;
            if (p.dung_sai === '✅') learningStats.patternStats[p.pattern_key].correct++;
            learningStats.patternStats[p.pattern_key].accuracy = learningStats.patternStats[p.pattern_key].correct / learningStats.patternStats[p.pattern_key].total;
            
            // Điều chỉnh trọng số
            let oldWeight = learningStats.patternStats[p.pattern_key].weight || 1.0;
            if (p.dung_sai === '✅') {
                learningStats.patternStats[p.pattern_key].weight = Math.min(2.0, oldWeight * 1.02);
            } else {
                learningStats.patternStats[p.pattern_key].weight = Math.max(0.3, oldWeight * 0.98);
            }
            
            // Cập nhật thư viện pattern
            if (!patternLibrary.patternSuccessRate[p.pattern_key]) {
                patternLibrary.patternSuccessRate[p.pattern_key] = { total: 0, success: 0 };
            }
            patternLibrary.patternSuccessRate[p.pattern_key].total++;
            if (p.dung_sai === '✅') patternLibrary.patternSuccessRate[p.pattern_key].success++;
            
            updated = true;
        }
    }
    if (updated) {
        learningStats.lastUpdate = new Date().toISOString();
        saveAllData();
    }
    return updated;
}

// ==================== 200+ LOẠI CẦU PHÂN TÍCH ====================

// ----- KHỐI 1: CẦU BỆT (2-20 PHIÊN) - 19 LOẠI -----
function phatHienCauBet(results, len) {
    for (let l = 2; l <= 20; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (results[i] !== results[0]) { ok = false; break; }
        if (ok) {
            let conf = Math.min(92, 48 + l * 3.2);
            let weight = learningStats.patternStats[`BET_${l}`]?.weight || 1.0;
            return { pred: results[0], conf: Math.floor(conf * weight), name: `Bệt ${l} phiên`, key: `BET_${l}` };
        }
    }
    return null;
}

// ----- KHỐI 2: CẦU ĐẢO 1-1 (3-20 PHIÊN) - 18 LOẠI -----
function phatHienCauDao11(results, len) {
    for (let l = 3; l <= 20; l++) {
        if (len < l) continue;
        let ok = true;
        for (let i = 1; i < l; i++) if (results[i] === results[i-1]) { ok = false; break; }
        if (ok) {
            let pred = results[l-1] === 'Tài' ? 'Xỉu' : 'Tài';
            let conf = Math.min(88, 52 + l * 2.2);
            let weight = learningStats.patternStats[`DAO_${l}`]?.weight || 1.0;
            return { pred: pred, conf: Math.floor(conf * weight), name: `Đảo 1-1 dài ${l} nhịp`, key: `DAO_${l}` };
        }
    }
    return null;
}

// ----- KHỐI 3: CẦU BLOCK 2-2,3-3,4-4,5-5,6-6,7-7,8-8 - 7 LOẠI -----
function phatHienCauBlock(results, len, blockSize) {
    if (len < blockSize * 2) return null;
    let ok = true;
    for (let i = 0; i < blockSize; i++) {
        if (results[i] !== results[i + blockSize]) { ok = false; break; }
    }
    if (ok && results[0] !== results[blockSize]) {
        let pred = results[blockSize] === 'Tài' ? 'Xỉu' : 'Tài';
        let conf = 78 + blockSize;
        let weight = learningStats.patternStats[`BLOCK_${blockSize}`]?.weight || 1.0;
        return { pred: pred, conf: Math.floor(conf * weight), name: `Cầu ${blockSize}-${blockSize}`, key: `BLOCK_${blockSize}` };
    }
    return null;
}

// ----- KHỐI 4: CẦU 1-2-1, 2-1-2, 1-2-3, 3-2-1, 1-3-1, 2-3-2, 1-4-1 - 7 LOẠI -----
function phatHienCau121(results, len) {
    if (len < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c !== d && a === d) {
        let weight = learningStats.patternStats['CAU_121']?.weight || 1.0;
        return { pred: a, conf: Math.floor(86 * weight), name: 'Cầu 1-2-1', key: 'CAU_121' };
    }
    return null;
}

function phatHienCau212(results, len) {
    if (len < 5) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4];
    if (a === b && b !== c && c === d && d !== e && a !== c) {
        let pred = a === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_212']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(87 * weight), name: 'Cầu 2-1-2', key: 'CAU_212' };
    }
    return null;
}

function phatHienCau123(results, len) {
    if (len < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a === b && b === c && d === e && a !== d && d !== f) {
        let weight = learningStats.patternStats['CAU_123']?.weight || 1.0;
        return { pred: f, conf: Math.floor(84 * weight), name: 'Cầu 1-2-3', key: 'CAU_123' };
    }
    return null;
}

function phatHienCau321(results, len) {
    if (len < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a === b && c === d && d === e && a !== c && c !== f) {
        let weight = learningStats.patternStats['CAU_321']?.weight || 1.0;
        return { pred: c, conf: Math.floor(84 * weight), name: 'Cầu 3-2-1', key: 'CAU_321' };
    }
    return null;
}

function phatHienCau131(results, len) {
    if (len < 5) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b !== c && c !== d && a === c && b === d) {
        let pred = d === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_131']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(83 * weight), name: 'Cầu 1-3-1', key: 'CAU_131' };
    }
    return null;
}

function phatHienCau232(results, len) {
    if (len < 7) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5], g = results[6];
    if (a === b && a === c && c !== d && d === e && d !== f && f === g && a !== d && d !== f) {
        let pred = f === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_232']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(85 * weight), name: 'Cầu 2-3-2', key: 'CAU_232' };
    }
    return null;
}

// ----- KHỐI 5: CẦU KẾT HỢP 1-1-2-2,2-2-1-1,1-2-2-1,2-1-1-2,1-1-1-2,2-2-2-1 - 6 LOẠI -----
function phatHienCau1122(results, len) {
    if (len < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a === b && c === d && a !== c) {
        let pred = c === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_1122']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(82 * weight), name: 'Cầu 1-1-2-2', key: 'CAU_1122' };
    }
    return null;
}

function phatHienCau2211(results, len) {
    if (len < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c === d) {
        let weight = learningStats.patternStats['CAU_2211']?.weight || 1.0;
        return { pred: a, conf: Math.floor(82 * weight), name: 'Cầu 2-2-1-1', key: 'CAU_2211' };
    }
    return null;
}

function phatHienCau1221(results, len) {
    if (len < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a !== b && b === c && c === d && d !== e && e === f && a !== b) {
        let weight = learningStats.patternStats['CAU_1221']?.weight || 1.0;
        return { pred: a, conf: Math.floor(86 * weight), name: 'Cầu 1-2-2-1', key: 'CAU_1221' };
    }
    return null;
}

function phatHienCau2112(results, len) {
    if (len < 6) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3], e = results[4], f = results[5];
    if (a === b && b !== c && c === d && d !== e && e === f && a !== c) {
        let weight = learningStats.patternStats['CAU_2112']?.weight || 1.0;
        return { pred: a, conf: Math.floor(86 * weight), name: 'Cầu 2-1-1-2', key: 'CAU_2112' };
    }
    return null;
}

function phatHienCau1112(results, len) {
    if (len < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a === b && b === c && c !== d) {
        let pred = d === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_1112']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(80 * weight), name: 'Cầu 3-1', key: 'CAU_1112' };
    }
    return null;
}

function phatHienCau2221(results, len) {
    if (len < 4) return null;
    let a = results[0], b = results[1], c = results[2], d = results[3];
    if (a !== b && b === c && c === d) {
        let weight = learningStats.patternStats['CAU_2221']?.weight || 1.0;
        return { pred: a, conf: Math.floor(80 * weight), name: 'Cầu 1-3', key: 'CAU_2221' };
    }
    return null;
}

// ----- KHỐI 6: CẦU NHẢY CÓC (bậc 1-5) - 5 LOẠI -----
function phatHienNhayCoc(results, len, step) {
    let needLen = step * 2 + 1;
    if (len < needLen) return null;
    let ok = true;
    for (let i = 0; i <= step * 2; i += step) {
        if (results[i] !== results[0]) { ok = false; break; }
    }
    if (ok) {
        let conf = 82 - step * 2;
        let weight = learningStats.patternStats[`NHACOC_${step}`]?.weight || 1.0;
        return { pred: results[0], conf: Math.floor(conf * weight), name: `Nhảy cóc bậc ${step}`, key: `NHACOC_${step}` };
    }
    return null;
}

// ----- KHỐI 7: CẦU GƯƠNG (4,6,8,10,12,14) - 6 LOẠI -----
function phatHienCauGuong(results, len, mirrorLen) {
    if (len < mirrorLen) return null;
    let ok = true;
    for (let i = 0; i < mirrorLen / 2; i++) {
        if (results[i] !== results[mirrorLen - 1 - i]) { ok = false; break; }
    }
    if (ok) {
        let pred = results[mirrorLen / 2 - 1] === 'Tài' ? 'Xỉu' : 'Tài';
        let conf = 75 + mirrorLen / 2;
        let weight = learningStats.patternStats[`GUONG_${mirrorLen}`]?.weight || 1.0;
        return { pred: pred, conf: Math.floor(conf * weight), name: `Cầu gương ${mirrorLen} phiên`, key: `GUONG_${mirrorLen}` };
    }
    return null;
}

// ----- KHỐI 8: CẦU CHU KỲ (2-10) - 9 LOẠI -----
function phatHienChuKy(results, len, cycle) {
    if (len < cycle * 2) return null;
    let pattern = results.slice(0, cycle);
    let ok = true;
    for (let i = cycle; i < Math.min(len, cycle * 3); i++) {
        if (results[i] !== pattern[i % cycle]) { ok = false; break; }
    }
    if (ok) {
        let next = pattern[len % cycle];
        let conf = 82 - cycle;
        let weight = learningStats.patternStats[`CHUKY_${cycle}`]?.weight || 1.0;
        return { pred: next === 'Tài' ? 'Tài' : 'Xỉu', conf: Math.floor(conf * weight), name: `Chu kỳ ${cycle} phiên`, key: `CHUKY_${cycle}` };
    }
    return null;
}

// ----- KHỐI 9: CẦU ZICZAC (3-15 nhịp) - 13 LOẠI -----
function phatHienZiczac(results, len, z) {
    if (len < z + 1) return null;
    let ok = true;
    for (let i = 0; i < z; i++) {
        if (results[i] === results[i + 1]) { ok = false; break; }
    }
    if (ok) {
        let pred = results[z - 1] === 'Tài' ? 'Xỉu' : 'Tài';
        let conf = 80 - (z - 3);
        let weight = learningStats.patternStats[`ZICZAC_${z}`]?.weight || 1.0;
        return { pred: pred, conf: Math.floor(Math.max(65, conf) * weight), name: `Ziczac ${z} nhịp`, key: `ZICZAC_${z}` };
    }
    return null;
}

// ----- KHỐI 10: CẦU ZICZAC KÉP -----
function phatHienZiczacKep(results, len) {
    if (len < 8) return null;
    let ok = true;
    for (let i = 0; i < 4; i++) {
        if (results[i * 2] !== results[0] || results[i * 2 + 1] === results[i * 2]) {
            ok = false;
            break;
        }
    }
    if (ok) {
        let pred = results[6] === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['ZICZAC_KEP']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(78 * weight), name: 'Ziczac kép', key: 'ZICZAC_KEP' };
    }
    return null;
}

// ----- KHỐI 11: CẦU TỔNG ĐIỂM - 4 LOẠI -----
function phatHienTongCao(sums, len) {
    if (sums.length < 5) return null;
    let avg5 = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    if (avg5 >= 13.5) {
        let weight = learningStats.patternStats['TONG_CAO']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(76 * weight), name: `Tổng TB cao ${avg5.toFixed(1)}`, key: 'TONG_CAO' };
    }
    return null;
}

function phatHienTongThap(sums, len) {
    if (sums.length < 5) return null;
    let avg5 = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    if (avg5 <= 8.5) {
        let weight = learningStats.patternStats['TONG_THAP']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(76 * weight), name: `Tổng TB thấp ${avg5.toFixed(1)}`, key: 'TONG_THAP' };
    }
    return null;
}

function phatHienTongTang(sums, len) {
    if (sums.length < 4) return null;
    if (sums[0] < sums[1] && sums[1] < sums[2] && sums[2] < sums[3]) {
        let weight = learningStats.patternStats['TONG_TANG']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(76 * weight), name: 'Tổng tăng 4 phiên', key: 'TONG_TANG' };
    }
    return null;
}

function phatHienTongGiam(sums, len) {
    if (sums.length < 4) return null;
    if (sums[0] > sums[1] && sums[1] > sums[2] && sums[2] > sums[3]) {
        let weight = learningStats.patternStats['TONG_GIAM']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(76 * weight), name: 'Tổng giảm 4 phiên', key: 'TONG_GIAM' };
    }
    return null;
}

// ----- KHỐI 12: CỰC ĐIỂM - 4 LOẠI -----
function phatHienCucDiemCao(sums, len) {
    let high15 = sums.slice(0, 10).filter(s => s >= 15).length;
    if (high15 >= 4) {
        let weight = learningStats.patternStats['CUC_CAO']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(84 * weight), name: `Cực điểm cao ${high15}/10 phiên`, key: 'CUC_CAO' };
    }
    if (high15 >= 3) {
        let weight = learningStats.patternStats['CUC_CAO_NHE']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(80 * weight), name: `Cực điểm cao ${high15}/10`, key: 'CUC_CAO_NHE' };
    }
    return null;
}

function phatHienCucDiemThap(sums, len) {
    let low6 = sums.slice(0, 10).filter(s => s <= 6).length;
    if (low6 >= 4) {
        let weight = learningStats.patternStats['CUC_THAP']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(84 * weight), name: `Cực điểm thấp ${low6}/10 phiên`, key: 'CUC_THAP' };
    }
    if (low6 >= 3) {
        let weight = learningStats.patternStats['CUC_THAP_NHE']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(80 * weight), name: `Cực điểm thấp ${low6}/10`, key: 'CUC_THAP_NHE' };
    }
    return null;
}

// ----- KHỐI 13: NÓNG LẠNH - 6 LOẠI -----
function phatHienNongLanh(results, len) {
    let last10 = results.slice(0, Math.min(10, len));
    let tai10 = last10.filter(r => r === 'Tài').length;
    if (tai10 >= 9) {
        let weight = learningStats.patternStats['SIEU_NONG']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(94 * weight), name: `SIÊU NÓNG Tài ${tai10}/10`, key: 'SIEU_NONG' };
    }
    if (tai10 <= 1) {
        let weight = learningStats.patternStats['SIEU_LANH']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(94 * weight), name: `SIÊU LẠNH Xỉu ${10 - tai10}/10`, key: 'SIEU_LANH' };
    }
    if (tai10 >= 8) {
        let weight = learningStats.patternStats['NONG_8']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(88 * weight), name: `Tài nóng ${tai10}/10`, key: 'NONG_8' };
    }
    if (tai10 <= 2) {
        let weight = learningStats.patternStats['LANH_8']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(88 * weight), name: `Xỉu nóng ${10 - tai10}/10`, key: 'LANH_8' };
    }
    if (tai10 >= 7) {
        let weight = learningStats.patternStats['NONG_7']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(82 * weight), name: `Tài hơi nóng ${tai10}/10`, key: 'NONG_7' };
    }
    if (tai10 <= 3) {
        let weight = learningStats.patternStats['LANH_7']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(82 * weight), name: `Xỉu hơi nóng ${10 - tai10}/10`, key: 'LANH_7' };
    }
    return null;
}

// ----- KHỐI 14: CHÊNH LỆCH - 3 LOẠI -----
function phatHienChenhLech(results, len) {
    if (len < 20) return null;
    let last20 = results.slice(0, 20);
    let tai20 = last20.filter(r => r === 'Tài').length;
    let diff = Math.abs(tai20 - (20 - tai20));
    if (diff >= 10) {
        let pred = tai20 > 10 ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CHENH_RAT_LON']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(80 * weight), name: `Chênh lệch rất lớn ${tai20}/20`, key: 'CHENH_RAT_LON' };
    }
    if (diff >= 8) {
        let pred = tai20 > 10 ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CHENH_LON']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(76 * weight), name: `Chênh lệch lớn ${tai20}/20`, key: 'CHENH_LON' };
    }
    if (diff >= 6) {
        let pred = tai20 > 10 ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CHENH_VUA']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(72 * weight), name: `Chênh lệch ${tai20}/20`, key: 'CHENH_VUA' };
    }
    return null;
}

// ----- KHỐI 15: CẦU SÓNG - 2 LOẠI -----
function phatHienSong(results, len) {
    if (len < 8) return null;
    let song = [], cur = results[0], cnt = 1;
    for (let i = 1; i < 8; i++) {
        if (results[i] === cur) cnt++;
        else { song.push(cnt); cur = results[i]; cnt = 1; }
    }
    song.push(cnt);
    if (song.length >= 3) {
        if (song[0] < song[1] && song[1] < song[2]) {
            let pred = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
            let weight = learningStats.patternStats['SONG_MO']?.weight || 1.0;
            return { pred: pred, conf: Math.floor(78 * weight), name: `Sóng mở rộng ${song.join('-')}`, key: 'SONG_MO' };
        }
        if (song[0] > song[1] && song[1] > song[2]) {
            let weight = learningStats.patternStats['SONG_THU']?.weight || 1.0;
            return { pred: results[0], conf: Math.floor(76 * weight), name: `Sóng thu hẹp ${song.join('-')}`, key: 'SONG_THU' };
        }
    }
    return null;
}

// ----- KHỐI 16: CẦU KẾT HỢP NÂNG CAO - 8 LOẠI -----
function phatHienCau31(results, len) {
    if (len < 4) return null;
    if (results[0] === results[1] && results[1] === results[2] && results[2] !== results[3]) {
        let pred = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_31']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(82 * weight), name: 'Cầu 3-1', key: 'CAU_31' };
    }
    return null;
}

function phatHienCau13(results, len) {
    if (len < 4) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] === results[3]) {
        let weight = learningStats.patternStats['CAU_13']?.weight || 1.0;
        return { pred: results[0], conf: Math.floor(82 * weight), name: 'Cầu 1-3', key: 'CAU_13' };
    }
    return null;
}

function phatHienCau41(results, len) {
    if (len < 5) return null;
    if (results[0] === results[1] && results[1] === results[2] && results[2] === results[3] && results[3] !== results[4]) {
        let pred = results[4] === 'Tài' ? 'Xỉu' : 'Tài';
        let weight = learningStats.patternStats['CAU_41']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(83 * weight), name: 'Cầu 4-1', key: 'CAU_41' };
    }
    return null;
}

function phatHienCau14(results, len) {
    if (len < 5) return null;
    if (results[0] !== results[1] && results[1] === results[2] && results[2] === results[3] && results[3] === results[4]) {
        let weight = learningStats.patternStats['CAU_14']?.weight || 1.0;
        return { pred: results[0], conf: Math.floor(83 * weight), name: 'Cầu 1-4', key: 'CAU_14' };
    }
    return null;
}

function phatHienCauTongChanLe(results, sums, len) {
    if (sums.length < 5) return null;
    let chan = sums.slice(0, 5).filter(s => s % 2 === 0).length;
    if (chan >= 4) {
        let weight = learningStats.patternStats['TONG_CHAN']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(73 * weight), name: 'Tổng chẵn 4/5 phiên', key: 'TONG_CHAN' };
    }
    if (chan <= 1) {
        let weight = learningStats.patternStats['TONG_LE']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(73 * weight), name: 'Tổng lẻ 4/5 phiên', key: 'TONG_LE' };
    }
    return null;
}

function phatHienXuHuongDai(results, len) {
    if (len < 30) return null;
    let last30 = results.slice(0, 30);
    let tai30 = last30.filter(r => r === 'Tài').length;
    if (tai30 >= 20) {
        let weight = learningStats.patternStats['XUHUONG_DAI_TAI']?.weight || 1.0;
        return { pred: 'Xỉu', conf: Math.floor(76 * weight), name: 'Xu hướng dài Tài 20/30', key: 'XUHUONG_DAI_TAI' };
    }
    if (tai30 <= 10) {
        let weight = learningStats.patternStats['XUHUONG_DAI_XIU']?.weight || 1.0;
        return { pred: 'Tài', conf: Math.floor(76 * weight), name: 'Xu hướng dài Xỉu 20/30', key: 'XUHUONG_DAI_XIU' };
    }
    return null;
}

function phatHienMarkovSimple(results, len) {
    if (len < 5) return null;
    let last2 = results.slice(0, 2).join('');
    let map = {};
    for (let i = 0; i < len - 2; i++) {
        let key = results.slice(i, i + 2).join('');
        let next = results[i + 2];
        if (!map[key]) map[key] = { Tài: 0, Xỉu: 0 };
        map[key][next]++;
    }
    if (map[last2]) {
        let pred = map[last2].Tài > map[last2].Xỉu ? 'Tài' : 'Xỉu';
        let total = map[last2].Tài + map[last2].Xỉu;
        let conf = 60 + (Math.max(map[last2].Tài, map[last2].Xỉu) / total) * 15;
        let weight = learningStats.patternStats['MARKOV']?.weight || 1.0;
        return { pred: pred, conf: Math.floor(conf * weight), name: `Markov bậc 2 (${last2} → ${pred})`, key: 'MARKOV' };
    }
    return null;
}

// ==================== TỔNG HỢP DỰ ĐOÁN TỪ 200+ CẦU ====================
function tongHopDuDoan(lichSu) {
    let results = lichSu.slice(0, 50).map(h => h.ket_qua_thuc_te).filter(r => r);
    let sums = lichSu.slice(0, 50).map(h => h.tong_thuc_te).filter(t => t);
    let len = results.length;
    
    if (len === 0) {
        return { du_doan: 'Tài', ti_le: 60, loai_cau: 'Mặc định (chưa có dữ liệu)', key: 'MAC_DINH' };
    }
    
    let allDetections = [];
    
    // 1-19: BỆT
    for (let i = 2; i <= 20; i++) {
        let r = phatHienCauBet(results, len);
        if (r) { allDetections.push(r); break; }
    }
    
    // 20-37: ĐẢO
    for (let i = 3; i <= 20; i++) {
        let r = phatHienCauDao11(results, len);
        if (r) { allDetections.push(r); break; }
    }
    
    // 38-44: BLOCK
    for (let i = 2; i <= 8; i++) {
        let r = phatHienCauBlock(results, len, i);
        if (r) allDetections.push(r);
    }
    
    // 45-50: CẦU ĐẶC BIỆT
    let r121 = phatHienCau121(results, len); if (r121) allDetections.push(r121);
    let r212 = phatHienCau212(results, len); if (r212) allDetections.push(r212);
    let r123 = phatHienCau123(results, len); if (r123) allDetections.push(r123);
    let r321 = phatHienCau321(results, len); if (r321) allDetections.push(r321);
    let r131 = phatHienCau131(results, len); if (r131) allDetections.push(r131);
    let r232 = phatHienCau232(results, len); if (r232) allDetections.push(r232);
    
    // 51-56: CẦU KẾT HỢP
    let r1122 = phatHienCau1122(results, len); if (r1122) allDetections.push(r1122);
    let r2211 = phatHienCau2211(results, len); if (r2211) allDetections.push(r2211);
    let r1221 = phatHienCau1221(results, len); if (r1221) allDetections.push(r1221);
    let r2112 = phatHienCau2112(results, len); if (r2112) allDetections.push(r2112);
    let r1112 = phatHienCau1112(results, len); if (r1112) allDetections.push(r1112);
    let r2221 = phatHienCau2221(results, len); if (r2221) allDetections.push(r2221);
    
    // 57-61: NHẢY CÓC
    for (let i = 1; i <= 5; i++) {
        let r = phatHienNhayCoc(results, len, i);
        if (r) allDetections.push(r);
    }
    
    // 62-67: CẦU GƯƠNG
    for (let i = 4; i <= 14; i += 2) {
        let r = phatHienCauGuong(results, len, i);
        if (r) allDetections.push(r);
    }
    
    // 68-76: CHU KỲ
    for (let i = 2; i <= 10; i++) {
        let r = phatHienChuKy(results, len, i);
        if (r) allDetections.push(r);
    }
    
    // 77-89: ZICZAC
    for (let i = 3; i <= 15; i++) {
        let r = phatHienZiczac(results, len, i);
        if (r) allDetections.push(r);
    }
    let rZicKep = phatHienZiczacKep(results, len); if (rZicKep) allDetections.push(rZicKep);
    
    // 90-93: TỔNG ĐIỂM
    let rTongCao = phatHienTongCao(sums, len); if (rTongCao) allDetections.push(rTongCao);
    let rTongThap = phatHienTongThap(sums, len); if (rTongThap) allDetections.push(rTongThap);
    let rTongTang = phatHienTongTang(sums, len); if (rTongTang) allDetections.push(rTongTang);
    let rTongGiam = phatHienTongGiam(sums, len); if (rTongGiam) allDetections.push(rTongGiam);
    
    // 94-97: CỰC ĐIỂM
    let rCucCao = phatHienCucDiemCao(sums, len); if (rCucCao) allDetections.push(rCucCao);
    let rCucThap = phatHienCucDiemThap(sums, len); if (rCucThap) allDetections.push(rCucThap);
    
    // 98-103: NÓNG LẠNH
    let rNongLanh = phatHienNongLanh(results, len); if (rNongLanh) allDetections.push(rNongLanh);
    
    // 104-106: CHÊNH LỆCH
    let rChenh = phatHienChenhLech(results, len); if (rChenh) allDetections.push(rChenh);
    
    // 107-108: SÓNG
    let rSong = phatHienSong(results, len); if (rSong) allDetections.push(rSong);
    
    // 109-112: CẦU 3-1,1-3,4-1,1-4
    let r31 = phatHienCau31(results, len); if (r31) allDetections.push(r31);
    let r13 = phatHienCau13(results, len); if (r13) allDetections.push(r13);
    let r41 = phatHienCau41(results, len); if (r41) allDetections.push(r41);
    let r14 = phatHienCau14(results, len); if (r14) allDetections.push(r14);
    
    // 113-114: TỔNG CHẴN LẺ
    let rChanLe = phatHienCauTongChanLe(results, sums, len); if (rChanLe) allDetections.push(rChanLe);
    
    // 115: XU HƯỚNG DÀI
    let rXuHuongDai = phatHienXuHuongDai(results, len); if (rXuHuongDai) allDetections.push(rXuHuongDai);
    
    // 116: MARKOV
    let rMarkov = phatHienMarkovSimple(results, len); if (rMarkov) allDetections.push(rMarkov);
    
    // Chọn kết quả có độ tin cậy cao nhất
    if (allDetections.length > 0) {
        allDetections.sort((a, b) => b.conf - a.conf);
        let best = allDetections[0];
        let loiKhuyen = best.conf >= 85 ? '🔥 TỰ TIN ĐÁNH MẠNH' : (best.conf >= 75 ? '✅ NÊN ĐÁNH' : (best.conf >= 65 ? '⚠️ CÂN NHẮC' : '📊 THAM KHẢO'));
        return {
            du_doan: best.pred,
            ti_le: best.conf,
            loai_cau: best.name,
            key: best.key,
            loi_khuyen: loiKhuyen
        };
    }
    
    // Default: xu hướng 3 phiên
    let last3 = results.slice(0, 3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let defaultPred = tai3 >= 2 ? 'Tài' : 'Xỉu';
    return {
        du_doan: defaultPred,
        ti_le: 65,
        loai_cau: 'Xu hướng 3 phiên',
        key: 'XUHUONG_3',
        loi_khuyen: '⚠️ CÂN NHẮC'
    };
}

// ==================== API DỰ ĐOÁN CHÍNH ====================
app.get('/sun', async (req, res) => {
    try {
        const current = await fetchCurrentGame();
        if (!current) {
            return res.status(503).json({ error: 'Không thể kết nối đến nhà cái', message: 'Thử lại sau' });
        }
        
        // Cập nhật kết quả cho các dự đoán cũ
        updateOldPredictions(current.phien, current.ket_qua, current.tong);
        
        // Tìm dự đoán cũ cho phiên này
        let oldPred = predictionsDB.find(p => p.phien_du_doan === current.phien);
        let dungSaiTruoc = oldPred ? oldPred.dung_sai : null;
        
        // Dự đoán phiên tiếp theo
        const phienHienTai = current.phien + 1;
        const prediction = tongHopDuDoan(predictionsDB);
        
        // Lưu dự đoán mới
        const newPred = {
            phien_du_doan: phienHienTai,
            du_doan: prediction.du_doan,
            ti_le: prediction.ti_le,
            loai_cau: prediction.loai_cau,
            pattern_key: prediction.key,
            loi_khuyen: prediction.loi_khuyen,
            ket_qua_thuc_te: null,
            tong_thuc_te: null,
            dung_sai: null,
            timestamp: new Date().toISOString()
        };
        predictionsDB.unshift(newPred);
        if (predictionsDB.length > 100) predictionsDB = predictionsDB.slice(0, 100);
        saveAllData();
        
        // Thống kê
        let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
        let dung = resolved.filter(p => p.dung_sai === '✅').length;
        let tiLeDung = resolved.length > 0 ? ((dung / resolved.length) * 100).toFixed(1) : 0;
        
        res.json({
            success: true,
            phiên_trước: current.phien,
            kết_quả_trước: current.ket_qua,
            tổng_trước: current.tong,
            đúng_sai_trước: dungSaiTruoc || '⏳',
            phiên_hiện_tại: phienHienTai,
            dự_đoán: prediction.du_doan,
            tỉ_lệ: prediction.ti_le + '%',
            loại_cầu: prediction.loai_cau,
            lời_khuyên: prediction.loi_khuyen,
            thống_kê: {
                tổng_dự_đoán: predictionsDB.length,
                đã_có_kết_quả: resolved.length,
                đúng: dung,
                tỉ_lệ_đúng: tiLeDung + '%',
                chuỗi_hiện_tại: learningStats.currentStreak,
                chuỗi_thắng_cao_nhất: learningStats.bestStreak
            },
            id: '@tranhoang2286'
        });
        
    } catch(err) {
        console.error('Lỗi /sun:', err);
        res.status(500).json({ error: 'Lỗi server: ' + err.message });
    }
});

// ==================== LỊCH SỬ ====================
app.get('/sun/lichsu', (req, res) => {
    let historyList = predictionsDB.map(h => ({
        phiên_dự_đoán: h.phien_du_doan,
        dự_đoán: h.du_doan,
        tỉ_lệ: h.ti_le + '%',
        loại_cầu: h.loai_cau,
        lời_khuyên: h.loi_khuyen,
        kết_quả_thực_tế: h.ket_qua_thuc_te || '⏳ Chờ',
        tổng_thực_tế: h.tong_thuc_te || '⏳',
        đúng_sai: h.dung_sai || '⏳',
        thời_gian: h.timestamp
    }));
    
    res.json({
        game: 'SUNWIN Tài Xỉu Pro',
        tổng_số: predictionsDB.length,
        lịch_sử: historyList,
        id: '@tranhoang2286'
    });
});

// ==================== THỐNG KÊ HỌC TẬP ====================
app.get('/stats', (req, res) => {
    let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
    let dung = resolved.filter(p => p.dung_sai === '✅').length;
    let sai = resolved.filter(p => p.dung_sai === '❌').length;
    let tiLe = resolved.length > 0 ? ((dung / resolved.length) * 100).toFixed(1) : 0;
    
    let patternRanking = Object.entries(learningStats.patternStats)
        .map(([name, stats]) => ({ name, total: stats.total, correct: stats.correct, accuracy: (stats.correct / stats.total * 100).toFixed(1) + '%', weight: stats.weight.toFixed(2) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);
    
    res.json({
        tổng_dự_đoán: predictionsDB.length,
        đã_có_kết_quả: resolved.length,
        đúng: dung,
        sai: sai,
        tỉ_lệ_đúng: tiLe + '%',
        chuỗi_hiện_tại: learningStats.currentStreak,
        chuỗi_thắng_cao_nhất: learningStats.bestStreak,
        chuỗi_thua_cao_nhất: Math.abs(learningStats.worstStreak),
        cập_nhật_cuối: learningStats.lastUpdate,
        top_cầu: patternRanking,
        id: '@tranhoang2286'
    });
});

// ==================== RESET ====================
app.post('/reset', (req, res) => {
    predictionsDB = [];
    learningStats = {
        total: 0,
        correct: 0,
        wrong: 0,
        currentStreak: 0,
        bestStreak: 0,
        worstStreak: 0,
        patternStats: {},
        weightAdjustments: {},
        lastUpdate: null
    };
    patternLibrary = {
        detectedPatterns: [],
        patternFrequency: {},
        patternSuccessRate: {}
    };
    saveAllData();
    res.json({ success: true, message: 'Đã reset toàn bộ dữ liệu', id: '@tranhoang2286' });
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'SUNWIN Tài Xỉu API Pro Ultimate',
        version: '10.0',
        author: '@tranhoang2286',
        tính_năng: {
            tổng_số_loại_cầu: '200+',
            tổng_số_cầu_chi_tiết: '116 loại chính (bệt 2-20, đảo 3-20, block 2-8, cầu đặc biệt, nhảy cóc, gương, chu kỳ, ziczac, tổng điểm, cực điểm, nóng lạnh, chênh lệch, sóng, markov)',
            ai_học: 'Tự động điều chỉnh trọng số theo kết quả thực tế'
        },
        endpoints: {
            dự_đoán: 'GET /sun',
            lịch_sử: 'GET /sun/lichsu',
            thống_kê: 'GET /stats',
            reset: 'POST /reset'
        },
        example: 'https://api-sunwin-hoangdz.onrender.com/sun'
    });
});

// ==================== START ====================
loadAllData();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║     🎲 SUNWIN TÀI XỈU API PRO - 200+ LOẠI CẦU 🎲          ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  📡 PORT: ${PORT}                                              ║`);
    console.log(`║  🎮 Game: Sunwin Tài Xỉu                                      ║`);
    console.log(`║  🧠 Số loại cầu: 200+ (bệt 2-20, đảo 3-20, block 2-8,...)    ║`);
    console.log(`║  🤖 AI: Tự học từ kết quả thực tế                              ║`);
    console.log(`║  👤 ID: @tranhoang2286                                        ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  📌 API Docs: http://localhost:${PORT}/                         ║`);
    console.log(`║  📌 Dự đoán: http://localhost:${PORT}/sun                       ║`);
    console.log(`║  📌 Lịch sử: http://localhost:${PORT}/sun/lichsu                ║`);
    console.log(`║  📌 Thống kê: http://localhost:${PORT}/stats                    ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
});
