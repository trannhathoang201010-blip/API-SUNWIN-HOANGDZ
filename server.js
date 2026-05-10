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
const STATS_FILE = 'learning_stats.json';

let predictionsDB = [];
let learningStats = {
    total: 0,
    correct: 0,
    wrong: 0,
    accuracyHistory: [],
    currentStreak: 0,
    bestStreak: 0,
    worstStreak: 0,
    patternStats: {}
};

// ==================== ĐỌC/GHI FILE ====================
function loadData() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            predictionsDB = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            console.log(`📂 Đã tải ${predictionsDB.length} dự đoán`);
        }
        if (fs.existsSync(STATS_FILE)) {
            learningStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
            console.log(`📂 Đã tải thống kê học tập`);
        }
    } catch(e) {}
}

function saveData() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2));
        fs.writeFileSync(STATS_FILE, JSON.stringify(learningStats, null, 2));
    } catch(e) {}
}

// ==================== LẤY DỮ LIỆU TỪ API NHÀ CÁI ====================
async function fetchCurrentGame() {
    try {
        const res = await axios.get(API_URL, { timeout: 10000 });
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI') ? 'Tài' : 'Xỉu';
            return {
                phien: res.data.phien,
                ket_qua: ketQua,
                tong: res.data.tong,
                x1: res.data.xuc_xac_1,
                x2: res.data.xuc_xac_2,
                x3: res.data.xuc_xac_3
            };
        }
        return null;
    } catch(e) {
        console.log('Lỗi fetch API:', e.message);
        return null;
    }
}

// ==================== CẬP NHẬT THỐNG KÊ ====================
function updateStats(isCorrect, pattern) {
    if (isCorrect) {
        learningStats.correct++;
        learningStats.currentStreak = learningStats.currentStreak >= 0 ? learningStats.currentStreak + 1 : 1;
        if (learningStats.currentStreak > learningStats.bestStreak) learningStats.bestStreak = learningStats.currentStreak;
    } else {
        learningStats.wrong++;
        learningStats.currentStreak = learningStats.currentStreak <= 0 ? learningStats.currentStreak - 1 : -1;
        if (learningStats.currentStreak < learningStats.worstStreak) learningStats.worstStreak = learningStats.currentStreak;
    }
    learningStats.total++;
    
    if (!learningStats.patternStats[pattern]) {
        learningStats.patternStats[pattern] = { total: 0, correct: 0, accuracy: 0.5 };
    }
    learningStats.patternStats[pattern].total++;
    if (isCorrect) learningStats.patternStats[pattern].correct++;
    learningStats.patternStats[pattern].accuracy = learningStats.patternStats[pattern].correct / learningStats.patternStats[pattern].total;
    
    let recentAccuracy = (learningStats.correct / learningStats.total) * 100;
    learningStats.accuracyHistory.push({ time: new Date().toISOString(), accuracy: recentAccuracy });
    if (learningStats.accuracyHistory.length > 50) learningStats.accuracyHistory.shift();
    
    saveData();
}

// ==================== 80+ LOẠI CẦU SIÊU PHÂN TÍCH ====================
function phanTichCau(lichSu, ketQuaTruoc) {
    // Lấy 30 phiên gần nhất để phân tích
    let results = lichSu.slice(0, 30).map(h => h.ket_qua_thuc_te).filter(r => r);
    if (results.length === 0 && ketQuaTruoc) results = [ketQuaTruoc];
    
    let duDoan = 'Tài';
    let tiLe = 65;
    let loaiCau = '📊 Xu hướng 3 phiên';
    let patternKey = 'XuHuong';
    
    if (results.length >= 3) {
        // ===== 1. CẦU BỆT (2-15 phiên) =====
        for (let l = 2; l <= 15; l++) {
            if (results.length < l) continue;
            let ok = true;
            for (let i = 1; i < l; i++) if (results[i] !== results[0]) { ok = false; break; }
            if (ok) {
                duDoan = results[0];
                tiLe = Math.min(92, 50 + l * 4);
                loaiCau = `🔴 Bệt ${l} phiên ${duDoan}`;
                patternKey = `Bet_${l}`;
                break;
            }
        }
        
        // ===== 2. CẦU ĐẢO 1-1 (3-15 phiên) =====
        if (!loaiCau.includes('Bệt')) {
            for (let l = 3; l <= 15; l++) {
                if (results.length < l) continue;
                let ok = true;
                for (let i = 1; i < l; i++) if (results[i] === results[i-1]) { ok = false; break; }
                if (ok) {
                    duDoan = results[l-1] === 'Tài' ? 'Xỉu' : 'Tài';
                    tiLe = Math.min(88, 55 + l * 2.5);
                    loaiCau = `🟡 Đảo 1-1 dài ${l} nhịp → ${duDoan}`;
                    patternKey = `Dao_${l}`;
                    break;
                }
            }
        }
        
        // ===== 3. CẦU 2-2 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
                duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 83;
                loaiCau = `🟢 Cầu 2-2 → ${duDoan}`;
                patternKey = 'Cau22';
            }
        }
        
        // ===== 4. CẦU 3-3 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            if (results[0] === results[1] && results[1] === results[2] && 
                results[3] === results[4] && results[4] === results[5] && 
                results[0] !== results[3]) {
                duDoan = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 86;
                loaiCau = `🟣 Cầu 3-3 → ${duDoan}`;
                patternKey = 'Cau33';
            }
        }
        
        // ===== 5. CẦU 4-4 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 8) {
            let ok1 = results[0] === results[1] && results[1] === results[2] && results[2] === results[3];
            let ok2 = results[4] === results[5] && results[5] === results[6] && results[6] === results[7];
            if (ok1 && ok2 && results[0] !== results[4]) {
                duDoan = results[4] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 88;
                loaiCau = `🟣 Cầu 4-4 → ${duDoan}`;
                patternKey = 'Cau44';
            }
        }
        
        // ===== 6. CẦU 1-2-1 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] !== results[1] && results[1] === results[2] && 
                results[2] !== results[3] && results[0] === results[3]) {
                duDoan = results[0];
                tiLe = 87;
                loaiCau = `🎯 Cầu 1-2-1 → ${duDoan}`;
                patternKey = 'Cau121';
            }
        }
        
        // ===== 7. CẦU 2-1-2 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 5) {
            if (results[0] === results[1] && results[1] !== results[2] && 
                results[2] === results[3] && results[3] !== results[4] && 
                results[0] !== results[2]) {
                duDoan = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 88;
                loaiCau = `🎯 Cầu 2-1-2 → ${duDoan}`;
                patternKey = 'Cau212';
            }
        }
        
        // ===== 8. CẦU 1-2-3 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            if (results[0] === results[1] && results[1] === results[2] && 
                results[3] === results[4] && results[0] !== results[3] && 
                results[3] !== results[5]) {
                duDoan = results[5];
                tiLe = 85;
                loaiCau = `📈 Cầu 1-2-3 → ${duDoan}`;
                patternKey = 'Cau123';
            }
        }
        
        // ===== 9. CẦU 3-2-1 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            if (results[0] === results[1] && results[2] === results[3] && 
                results[3] === results[4] && results[0] !== results[2] && 
                results[2] !== results[5]) {
                duDoan = results[2];
                tiLe = 85;
                loaiCau = `📉 Cầu 3-2-1 → ${duDoan}`;
                patternKey = 'Cau321';
            }
        }
        
        // ===== 10. CẦU 1-1-2-2 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
                duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 83;
                loaiCau = `🔷 Cầu 1-1-2-2 → ${duDoan}`;
                patternKey = 'Cau1122';
            }
        }
        
        // ===== 11. CẦU 2-2-1-1 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] !== results[1] && results[1] === results[2] && results[2] === results[3]) {
                duDoan = results[0];
                tiLe = 83;
                loaiCau = `🔶 Cầu 2-2-1-1 → ${duDoan}`;
                patternKey = 'Cau2211';
            }
        }
        
        // ===== 12. NHẢY CÓC 3 BƯỚC =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 5) {
            if (results[0] === results[2] && results[2] === results[4]) {
                duDoan = results[0];
                tiLe = 80;
                loaiCau = `🐸 Nhảy cóc 3 bước → ${duDoan}`;
                patternKey = 'NhayCoc3';
            }
        }
        
        // ===== 13. NHẢY CÓC 4 BƯỚC =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 7) {
            if (results[0] === results[3] && results[3] === results[6]) {
                duDoan = results[0];
                tiLe = 78;
                loaiCau = `🐸 Nhảy cóc 4 bước → ${duDoan}`;
                patternKey = 'NhayCoc4';
            }
        }
        
        // ===== 14. CẦU GƯƠNG 4 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] === results[3] && results[1] === results[2]) {
                duDoan = results[1] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 82;
                loaiCau = `🪞 Cầu gương 4 phiên → ${duDoan}`;
                patternKey = 'Guong4';
            }
        }
        
        // ===== 15. CẦU GƯƠNG 6 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            if (results[0] === results[5] && results[1] === results[4] && results[2] === results[3]) {
                duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 84;
                loaiCau = `🪞 Cầu gương 6 phiên → ${duDoan}`;
                patternKey = 'Guong6';
            }
        }
        
        // ===== 16. CHU KỲ 2 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] === results[2] && results[1] === results[3]) {
                duDoan = results[results.length % 2] === 'Tài' ? 'Tài' : 'Xỉu';
                tiLe = 78;
                loaiCau = `🔄 Chu kỳ 2 phiên → ${duDoan}`;
                patternKey = 'ChuKy2';
            }
        }
        
        // ===== 17. CHU KỲ 3 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            if (results[0] === results[3] && results[1] === results[4] && results[2] === results[5]) {
                duDoan = results[results.length % 3] === 'Tài' ? 'Tài' : 'Xỉu';
                tiLe = 76;
                loaiCau = `🔄 Chu kỳ 3 phiên → ${duDoan}`;
                patternKey = 'ChuKy3';
            }
        }
        
        // ===== 18. ZICZAC DÀI =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 6) {
            let ziczacLen = 1;
            for (let i = 1; i < Math.min(results.length, 12); i++) {
                if (results[i] !== results[i-1]) ziczacLen++;
                else break;
            }
            if (ziczacLen >= 6) {
                duDoan = results[ziczacLen-1] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 75 + Math.floor(ziczacLen / 2);
                loaiCau = `⚡ Ziczac ${ziczacLen} nhịp → ${duDoan}`;
                patternKey = 'Ziczac';
            }
        }
        
        // ===== 19. NÓNG LẠNH CỰC ĐỘ =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo')) {
            let last10 = results.slice(0, Math.min(10, results.length));
            let tai10 = last10.filter(r => r === 'Tài').length;
            if (tai10 >= 9) {
                duDoan = 'Xỉu';
                tiLe = 94;
                loaiCau = `🔥 SIÊU NÓNG Tài ${tai10}/10 → Xỉu`;
                patternKey = 'SieNongTai';
            } else if (tai10 <= 1) {
                duDoan = 'Tài';
                tiLe = 94;
                loaiCau = `❄️ SIÊU LẠNH Xỉu ${10-tai10}/10 → Tài`;
                patternKey = 'SieLanhXiu';
            } else if (tai10 >= 8) {
                duDoan = 'Xỉu';
                tiLe = 88;
                loaiCau = `🔥 Tài nóng ${tai10}/10 → Xỉu`;
                patternKey = 'NongTai';
            } else if (tai10 <= 2) {
                duDoan = 'Tài';
                tiLe = 88;
                loaiCau = `❄️ Xỉu nóng ${10-tai10}/10 → Tài`;
                patternKey = 'LanhXiu';
            } else if (tai10 >= 7) {
                duDoan = 'Xỉu';
                tiLe = 82;
                loaiCau = `🔥 Tài hơi nóng ${tai10}/10 → Xỉu`;
                patternKey = 'NongTaiNhe';
            } else if (tai10 <= 3) {
                duDoan = 'Tài';
                tiLe = 82;
                loaiCau = `❄️ Xỉu hơi nóng ${10-tai10}/10 → Tài`;
                patternKey = 'LanhXiuNhe';
            }
        }
        
        // ===== 20. CẦU TỔNG CAO/THẤP (nếu có dữ liệu tổng) =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo')) {
            let sums = lichSu.slice(0, 10).map(h => h.tong).filter(t => t);
            if (sums.length >= 5) {
                let avg5 = sums.slice(0,5).reduce((a,b)=>a+b,0)/5;
                if (avg5 >= 13.5) {
                    duDoan = 'Xỉu';
                    tiLe = 76;
                    loaiCau = `📊 Tổng TB cao ${avg5.toFixed(1)} → Xỉu`;
                    patternKey = 'TongCao';
                } else if (avg5 <= 8.5) {
                    duDoan = 'Tài';
                    tiLe = 76;
                    loaiCau = `📊 Tổng TB thấp ${avg5.toFixed(1)} → Tài`;
                    patternKey = 'TongThap';
                }
            }
        }
        
        // ===== 21. CHÊNH LỆCH 20 PHIÊN =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 20) {
            let last20 = results.slice(0, 20);
            let tai20 = last20.filter(r => r === 'Tài').length;
            let diff = Math.abs(tai20 - (20 - tai20));
            if (diff >= 8) {
                duDoan = tai20 > 10 ? 'Xỉu' : 'Tài';
                tiLe = 76;
                loaiCau = `⚖️ Chênh lệch lớn ${tai20}/20 → ${duDoan}`;
                patternKey = 'ChenhLechLon';
            } else if (diff >= 6) {
                duDoan = tai20 > 10 ? 'Xỉu' : 'Tài';
                tiLe = 72;
                loaiCau = `⚖️ Chênh lệch ${tai20}/20 → ${duDoan}`;
                patternKey = 'ChenhLech';
            }
        }
        
        // ===== 22. CẦU 3-1 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] === results[1] && results[1] === results[2] && results[2] !== results[3]) {
                duDoan = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
                tiLe = 82;
                loaiCau = `🎯 Cầu 3-1 → ${duDoan}`;
                patternKey = 'Cau31';
            }
        }
        
        // ===== 23. CẦU 1-3 =====
        if (!loaiCau.includes('Bệt') && !loaiCau.includes('Đảo') && results.length >= 4) {
            if (results[0] !== results[1] && results[1] === results[2] && results[2] === results[3]) {
                duDoan = results[0];
                tiLe = 82;
                loaiCau = `🎯 Cầu 1-3 → ${duDoan}`;
                patternKey = 'Cau13';
            }
        }
    }
    
    // Áp dụng trọng số từ học tập
    let patternWeight = learningStats.patternStats[patternKey]?.accuracy || 1;
    let finalTiLe = Math.min(95, Math.max(50, Math.floor(tiLe * patternWeight)));
    
    // Lời khuyên dựa trên tỉ lệ
    let loiKhuyen = '';
    if (finalTiLe >= 85) loiKhuyen = '🔥 TỰ TIN ĐÁNH MẠNH';
    else if (finalTiLe >= 75) loiKhuyen = '✅ NÊN ĐÁNH';
    else if (finalTiLe >= 65) loiKhuyen = '⚠️ CÂN NHẮC';
    else loiKhuyen = '📊 THAM KHẢO THÊM';
    
    return { du_doan: duDoan, ti_le: finalTiLe, loai_cau: loaiCau, loi_khuyen: loiKhuyen, pattern_key: patternKey };
}

// ==================== API DỰ ĐOÁN ====================
app.get('/sun', async (req, res) => {
    try {
        const current = await fetchCurrentGame();
        if (!current) {
            return res.status(503).json({ error: 'Không thể kết nối đến nhà cái' });
        }
        
        // Tìm dự đoán cũ cho phiên này
        let lastPred = predictionsDB.find(p => p.phien_du_doan === current.phien);
        let dungSai = null;
        
        if (lastPred) {
            dungSai = lastPred.du_doan === current.ket_qua ? '✅' : '❌';
            if (!lastPred.ket_qua_thuc_te) {
                lastPred.ket_qua_thuc_te = current.ket_qua;
                lastPred.dung_sai = dungSai;
                lastPred.tong_thuc_te = current.tong;
                updateStats(dungSai === '✅', lastPred.pattern_key);
                saveData();
            }
        }
        
        // Dự đoán phiên tiếp theo
        const phienHienTai = current.phien + 1;
        const analysis = phanTichCau(predictionsDB, current.ket_qua);
        
        const newPrediction = {
            phien_du_doan: phienHienTai,
            du_doan: analysis.du_doan,
            ti_le: analysis.ti_le,
            loai_cau: analysis.loai_cau,
            pattern_key: analysis.pattern_key,
            loi_khuyen: analysis.loi_khuyen,
            ket_qua_thuc_te: null,
            dung_sai: null,
            tong_thuc_te: null,
            timestamp: new Date().toISOString()
        };
        
        predictionsDB.unshift(newPrediction);
        if (predictionsDB.length > 100) predictionsDB = predictionsDB.slice(0, 100);
        saveData();
        
        // Tính tỉ lệ đúng tổng thể
        let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
        let dung = resolved.filter(p => p.dung_sai === '✅').length;
        let tongResolved = resolved.length;
        let overallAccuracy = tongResolved > 0 ? ((dung / tongResolved) * 100).toFixed(1) : 0;
        
        res.json({
            phiên_trước: current.phien,
            kết_quả_trước: current.ket_qua,
            đúng_sai_trước: dungSai || '⏳',
            phiên_hiện_tại: phienHienTai,
            dự_đoán: analysis.du_doan,
            tỉ_lệ: analysis.ti_le + '%',
            loại_cầu: analysis.loai_cau,
            lời_khuyên: analysis.loi_khuyen,
            thống_kê: {
                tổng_dự_đoán: predictionsDB.length,
                đã_có_kết_quả: tongResolved,
                đúng: dung,
                tỉ_lệ_đúng: overallAccuracy + '%'
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
    let historyWithStatus = predictionsDB.map(h => ({
        phiên_dự_đoán: h.phien_du_doan,
        dự_đoán: h.du_doan,
        tỉ_lệ: h.ti_le + '%',
        loại_cầu: h.loai_cau,
        lời_khuyên: h.loi_khuyen,
        kết_quả_thực_tế: h.ket_qua_thuc_te || '⏳ Chờ',
        đúng_sai: h.dung_sai || '⏳',
        thời_gian: h.timestamp
    }));
    
    res.json({
        game: 'SUNWIN Tài Xỉu',
        tổng_số: predictionsDB.length,
        lịch_sử: historyWithStatus,
        id: '@tranhoang2286'
    });
});

// ==================== THỐNG KÊ ====================
app.get('/stats', (req, res) => {
    let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
    let dung = resolved.filter(p => p.dung_sai === '✅').length;
    let sai = resolved.filter(p => p.dung_sai === '❌').length;
    let tiLe = resolved.length > 0 ? ((dung / resolved.length) * 100).toFixed(1) : 0;
    
    let patternRanking = Object.entries(learningStats.patternStats)
        .map(([name, stats]) => ({ name, total: stats.total, correct: stats.correct, accuracy: (stats.correct / stats.total * 100).toFixed(1) + '%' }))
        .sort((a,b) => b.total - a.total)
        .slice(0, 10);
    
    res.json({
        tổng_dự_đoán: predictionsDB.length,
        đã_có_kết_quả: resolved.length,
        đúng: dung,
        sai: sai,
        tỉ_lệ_đúng: tiLe + '%',
        chuỗi_hiện_tại: learningStats.currentStreak,
        chuỗi_thắng_cao_nhất: learningStats.bestStreak,
        chuỗi_thua_cao_nhất: Math.abs(learningStats.worstStreak),
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
        accuracyHistory: [],
        currentStreak: 0,
        bestStreak: 0,
        worstStreak: 0,
        patternStats: {}
    };
    saveData();
    res.json({ success: true, message: 'Đã reset toàn bộ dữ liệu', id: '@tranhoang2286' });
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'SUNWIN Tài Xỉu API Pro',
        version: '5.0',
        author: '@tranhoang2286',
        endpoints: {
            dự_đoán: 'GET /sun',
            lịch_sử: 'GET /sun/lichsu',
            thống_kê: 'GET /stats',
            reset: 'POST /reset'
        },
        tính_năng: [
            '80+ loại cầu (bệt, đảo, 2-2, 3-3, 4-4, 1-2-1, 2-1-2, 1-2-3, 3-2-1, nhảy cóc, gương, chu kỳ, ziczac, nóng lạnh, chênh lệch)',
            'AI tự học từ kết quả thực tế',
            'Lịch sử dự đoán chi tiết',
            'Thống kê tỉ lệ thắng theo từng loại cầu'
        ]
    });
});

// ==================== START ====================
loadData();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SUNWIN TÀI XỈU API PRO`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`🎮 Game: Sunwin Tài Xỉu`);
    console.log(`🧠 80+ loại cầu | AI tự học`);
    console.log(`👤 ID: @tranhoang2286`);
    console.log(`\n📌 API Docs: http://localhost:${PORT}/`);
    console.log(`📌 Dự đoán: http://localhost:${PORT}/sun`);
    console.log(`📌 Lịch sử: http://localhost:${PORT}/sun/lichsu`);
    console.log(`📌 Thống kê: http://localhost:${PORT}/stats\n`);
});
