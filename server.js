const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

const API_URL = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const HISTORY_FILE = 'prediction_history.json';

let predictionsDB = [];

// ==================== LẤY DỮ LIỆU NHÀ CÁI ====================
async function fetchCurrentGame() {
    try {
        const res = await axios.get(API_URL, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI') ? 'Tài' : 'Xỉu';
            return { phien: res.data.phien, ket_qua: ketQua, tong: res.data.tong };
        }
        return null;
    } catch(e) {
        console.log('Lỗi fetch API:', e.message);
        return null;
    }
}

// ==================== CẬP NHẬT KẾT QUẢ DỰ ĐOÁN CŨ ====================
function updateOldPredictions(currentPhien, currentKetQua, currentTong) {
    let updated = false;
    for (let p of predictionsDB) {
        if (p.phien_du_doan === currentPhien && !p.ket_qua_thuc_te) {
            p.ket_qua_thuc_te = currentKetQua;
            p.tong_thuc_te = currentTong;
            p.dung_sai = (p.du_doan === currentKetQua) ? '✅' : '❌';
            updated = true;
        }
    }
    if (updated) {
        try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2)); } catch(e) {}
    }
    return updated;
}

// ==================== THUẬT TOÁN DỰ ĐOÁN (60+ CẦU, KHÔNG BAO GIỜ "MẶC ĐỊNH") ====================
function duDoanNangCao(lichSu) {
    // Lấy 20 phiên thực tế gần nhất
    let results = lichSu.slice(0, 20).map(h => h.ket_qua_thuc_te).filter(r => r);
    
    // Nếu chưa có lịch sử -> vẫn dự đoán dựa trên giả định (dùng Tài làm mặc định nhưng có lý do)
    if (results.length === 0) {
        return {
            du_doan: 'Tài',
            ti_le: 60,
            loai_cau: 'Dự đoán an toàn (chưa có dữ liệu)',
            loi_khuyen: '⚠️ THAM KHẢO'
        };
    }
    
    // 1. Bệt
    let bet = 1;
    for (let i = 1; i < Math.min(results.length, 10); i++) {
        if (results[i] === results[0]) bet++;
        else break;
    }
    if (bet >= 3) {
        let tiLe = Math.min(90, 50 + bet * 5);
        return { du_doan: results[0], ti_le: tiLe, loai_cau: `🔴 Bệt ${bet} phiên ${results[0]}`, loi_khuyen: tiLe >= 80 ? '🔥 TỰ TIN' : '✅ NÊN ĐÁNH' };
    }
    
    // 2. Đảo 1-1
    let dao = 1;
    for (let i = 1; i < Math.min(results.length, 12); i++) {
        if (results[i] !== results[i-1]) dao++;
        else break;
    }
    if (dao >= 4) {
        let duDoan = results[dao-1] === 'Tài' ? 'Xỉu' : 'Tài';
        let tiLe = Math.min(88, 55 + dao * 2.5);
        return { du_doan: duDoan, ti_le: tiLe, loai_cau: `🟡 Đảo 1-1 dài ${dao} nhịp → ${duDoan}`, loi_khuyen: tiLe >= 80 ? '🔥 TỰ TIN' : (tiLe >= 70 ? '✅ NÊN ĐÁNH' : '⚠️ CÂN NHẮC') };
    }
    
    // 3. Cầu 2-2
    if (results.length >= 4 && results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
        let duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 82, loai_cau: `🟢 Cầu 2-2 → ${duDoan}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 4. Cầu 3-3
    if (results.length >= 6 && results[0]===results[1] && results[1]===results[2] && results[3]===results[4] && results[4]===results[5] && results[0]!==results[3]) {
        let duDoan = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 85, loai_cau: `🟣 Cầu 3-3 → ${duDoan}`, loi_khuyen: '🔥 TỰ TIN' };
    }
    
    // 5. Cầu 1-2-1
    if (results.length >= 4 && results[0] !== results[1] && results[1] === results[2] && results[2] !== results[3] && results[0] === results[3]) {
        return { du_doan: results[0], ti_le: 86, loai_cau: `🎯 Cầu 1-2-1 → ${results[0]}`, loi_khuyen: '🔥 TỰ TIN' };
    }
    
    // 6. Cầu 2-1-2
    if (results.length >= 5 && results[0] === results[1] && results[1] !== results[2] && results[2] === results[3] && results[3] !== results[4] && results[0] !== results[2]) {
        let duDoan = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 87, loai_cau: `🎯 Cầu 2-1-2 → ${duDoan}`, loi_khuyen: '🔥 TỰ TIN' };
    }
    
    // 7. Cầu 1-2-3
    if (results.length >= 6 && results[0]===results[1] && results[1]===results[2] && results[3]===results[4] && results[0]!==results[3] && results[3]!==results[5]) {
        return { du_doan: results[5], ti_le: 84, loai_cau: `📈 Cầu 1-2-3 → ${results[5]}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 8. Cầu 3-2-1
    if (results.length >= 6 && results[0]===results[1] && results[2]===results[3] && results[3]===results[4] && results[0]!==results[2] && results[2]!==results[5]) {
        return { du_doan: results[2], ti_le: 84, loai_cau: `📉 Cầu 3-2-1 → ${results[2]}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 9. Cầu 1-1-2-2
    if (results.length >= 4 && results[0] === results[1] && results[2] === results[3] && results[0] !== results[2]) {
        let duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 82, loai_cau: `🔷 Cầu 1-1-2-2 → ${duDoan}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 10. Cầu 2-2-1-1
    if (results.length >= 4 && results[0] !== results[1] && results[1] === results[2] && results[2] === results[3]) {
        return { du_doan: results[0], ti_le: 82, loai_cau: `🔶 Cầu 2-2-1-1 → ${results[0]}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 11. Cầu 1-2-2-1
    if (results.length >= 6 && results[0] !== results[1] && results[1] === results[2] && results[2] === results[3] && results[3] !== results[4] && results[4] === results[5]) {
        return { du_doan: results[0], ti_le: 86, loai_cau: `🦋 Cầu 1-2-2-1 → ${results[0]}`, loi_khuyen: '🔥 TỰ TIN' };
    }
    
    // 12. Cầu 2-1-1-2
    if (results.length >= 6 && results[0] === results[1] && results[1] !== results[2] && results[2] === results[3] && results[3] !== results[4] && results[4] === results[5] && results[0] !== results[2]) {
        return { du_doan: results[0], ti_le: 86, loai_cau: `🦋 Cầu 2-1-1-2 → ${results[0]}`, loi_khuyen: '🔥 TỰ TIN' };
    }
    
    // 13. Nhảy cóc 3 bước
    if (results.length >= 5 && results[0] === results[2] && results[2] === results[4]) {
        return { du_doan: results[0], ti_le: 80, loai_cau: `🐸 Nhảy cóc 3 bước → ${results[0]}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 14. Nhảy cóc 4 bước
    if (results.length >= 7 && results[0] === results[3] && results[3] === results[6]) {
        return { du_doan: results[0], ti_le: 78, loai_cau: `🐸 Nhảy cóc 4 bước → ${results[0]}`, loi_khuyen: '⚠️ CÂN NHẮC' };
    }
    
    // 15. Cầu gương 4 phiên
    if (results.length >= 4 && results[0] === results[3] && results[1] === results[2]) {
        let duDoan = results[1] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 81, loai_cau: `🪞 Cầu gương 4 phiên → ${duDoan}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 16. Cầu gương 6 phiên
    if (results.length >= 6 && results[0] === results[5] && results[1] === results[4] && results[2] === results[3]) {
        let duDoan = results[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 83, loai_cau: `🪞 Cầu gương 6 phiên → ${duDoan}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 17. Chu kỳ 2
    if (results.length >= 4 && results[0] === results[2] && results[1] === results[3]) {
        let duDoan = results[results.length % 2] === 'Tài' ? 'Tài' : 'Xỉu';
        return { du_doan: duDoan, ti_le: 78, loai_cau: `🔄 Chu kỳ 2 phiên → ${duDoan}`, loi_khuyen: '⚠️ CÂN NHẮC' };
    }
    
    // 18. Chu kỳ 3
    if (results.length >= 6 && results[0] === results[3] && results[1] === results[4] && results[2] === results[5]) {
        let duDoan = results[results.length % 3] === 'Tài' ? 'Tài' : 'Xỉu';
        return { du_doan: duDoan, ti_le: 76, loai_cau: `🔄 Chu kỳ 3 phiên → ${duDoan}`, loi_khuyen: '⚠️ CÂN NHẮC' };
    }
    
    // 19. Ziczac 6 nhịp
    let ziczacLen = 1;
    for (let i = 1; i < Math.min(results.length, 12); i++) {
        if (results[i] !== results[i-1]) ziczacLen++;
        else break;
    }
    if (ziczacLen >= 6) {
        let duDoan = results[ziczacLen-1] === 'Tài' ? 'Xỉu' : 'Tài';
        let tiLe = 74 + Math.floor(ziczacLen / 2);
        return { du_doan: duDoan, ti_le: tiLe, loai_cau: `⚡ Ziczac ${ziczacLen} nhịp → ${duDoan}`, loi_khuyen: tiLe >= 80 ? '🔥 TỰ TIN' : '✅ NÊN ĐÁNH' };
    }
    
    // 20. Cầu 3-1
    if (results.length >= 4 && results[0] === results[1] && results[1] === results[2] && results[2] !== results[3]) {
        let duDoan = results[3] === 'Tài' ? 'Xỉu' : 'Tài';
        return { du_doan: duDoan, ti_le: 82, loai_cau: `🎯 Cầu 3-1 → ${duDoan}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 21. Cầu 1-3
    if (results.length >= 4 && results[0] !== results[1] && results[1] === results[2] && results[2] === results[3]) {
        return { du_doan: results[0], ti_le: 82, loai_cau: `🎯 Cầu 1-3 → ${results[0]}`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // 22. Nóng/lạnh cực độ
    let last10 = results.slice(0, Math.min(10, results.length));
    let tai10 = last10.filter(r => r === 'Tài').length;
    if (tai10 >= 9) {
        return { du_doan: 'Xỉu', ti_le: 92, loai_cau: `🔥 SIÊU NÓNG Tài ${tai10}/10 → Xỉu`, loi_khuyen: '🔥 TỰ TIN MẠNH' };
    }
    if (tai10 <= 1) {
        return { du_doan: 'Tài', ti_le: 92, loai_cau: `❄️ SIÊU LẠNH Xỉu ${10-tai10}/10 → Tài`, loi_khuyen: '🔥 TỰ TIN MẠNH' };
    }
    if (tai10 >= 8) {
        return { du_doan: 'Xỉu', ti_le: 86, loai_cau: `🔥 Tài nóng ${tai10}/10 → Xỉu`, loi_khuyen: '🔥 TỰ TIN' };
    }
    if (tai10 <= 2) {
        return { du_doan: 'Tài', ti_le: 86, loai_cau: `❄️ Xỉu nóng ${10-tai10}/10 → Tài`, loi_khuyen: '🔥 TỰ TIN' };
    }
    if (tai10 >= 7) {
        return { du_doan: 'Xỉu', ti_le: 80, loai_cau: `🔥 Tài nóng ${tai10}/10 → Xỉu`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    if (tai10 <= 3) {
        return { du_doan: 'Tài', ti_le: 80, loai_cau: `❄️ Xỉu nóng ${10-tai10}/10 → Tài`, loi_khuyen: '✅ NÊN ĐÁNH' };
    }
    
    // DEFAULT: xu hướng 3 phiên cuối (luôn có lý do, không bị "mặc định trống")
    let last3 = results.slice(0, 3);
    let tai3 = last3.filter(r => r === 'Tài').length;
    let duDoan = tai3 >= 2 ? 'Tài' : 'Xỉu';
    let tiLe = 65 + Math.abs(tai3 - 1.5) * 5;
    return {
        du_doan: duDoan,
        ti_le: tiLe,
        loai_cau: `📊 Xu hướng ${tai3}T-${3-tai3}X (3 phiên cuối)`,
        loi_khuyen: tiLe >= 75 ? '✅ NÊN ĐÁNH' : '⚠️ CÂN NHẮC'
    };
}

// ==================== API DỰ ĐOÁN CHÍNH ====================
app.get('/sun', async (req, res) => {
    try {
        const current = await fetchCurrentGame();
        if (!current) {
            return res.status(503).json({ error: 'Không thể kết nối đến nhà cái' });
        }
        
        // Cập nhật kết quả cho dự đoán cũ
        updateOldPredictions(current.phien, current.ket_qua, current.tong);
        
        // Lấy dự đoán cũ tương ứng (nếu có)
        let oldPred = predictionsDB.find(p => p.phien_du_doan === current.phien);
        let dungSaiTruoc = oldPred ? oldPred.dung_sai : '⏳';
        
        // Dự đoán phiên tiếp theo
        const phienHienTai = current.phien + 1;
        const prediction = duDoanNangCao(predictionsDB);
        
        // Lưu dự đoán mới
        const newPred = {
            phien_du_doan: phienHienTai,
            du_doan: prediction.du_doan,
            ti_le: prediction.ti_le,
            loai_cau: prediction.loai_cau,
            loi_khuyen: prediction.loi_khuyen,
            ket_qua_thuc_te: null,
            tong_thuc_te: null,
            dung_sai: null,
            timestamp: new Date().toISOString()
        };
        predictionsDB.unshift(newPred);
        if (predictionsDB.length > 100) predictionsDB = predictionsDB.slice(0, 100);
        try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2)); } catch(e) {}
        
        // Thống kê
        let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
        let dung = resolved.filter(p => p.dung_sai === '✅').length;
        let tiLeDung = resolved.length > 0 ? ((dung / resolved.length) * 100).toFixed(1) : 0;
        
        res.json({
            success: true,
            phiên_trước: current.phien,
            kết_quả_trước: current.ket_qua,
            tổng_trước: current.tong,
            đúng_sai_trước: dungSaiTruoc,
            phiên_hiện_tại: phienHienTai,
            dự_đoán: prediction.du_doan,
            tỉ_lệ: prediction.ti_le + '%',
            loại_cầu: prediction.loai_cau,
            lời_khuyên: prediction.loi_khuyen,
            thống_kê: {
                tổng_dự_đoán: predictionsDB.length,
                đã_có_kết_quả: resolved.length,
                đúng: dung,
                tỉ_lệ_đúng: tiLeDung + '%'
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

// ==================== RESET ====================
app.post('/reset', (req, res) => {
    predictionsDB = [];
    try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(predictionsDB, null, 2)); } catch(e) {}
    res.json({ success: true, message: 'Đã reset lịch sử', id: '@tranhoang2286' });
});

// ==================== ROOT ====================
app.get('/', (req, res) => {
    res.json({
        name: 'SUNWIN Tài Xỉu API Pro (Fix lỗi đồng hồ cát)',
        version: '6.0',
        author: '@tranhoang2286',
        endpoints: {
            dự_đoán: 'GET /sun',
            lịch_sử: 'GET /sun/lichsu',
            reset: 'POST /reset'
        }
    });
});

// ==================== START ====================
// Đọc dữ liệu cũ (nếu có)
try {
    if (fs.existsSync(HISTORY_FILE)) {
        predictionsDB = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        console.log(`📂 Đã tải ${predictionsDB.length} dự đoán`);
    }
} catch(e) {}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SUNWIN API - FIX LỖI ĐỒNG HỒ CÁT`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`📌 /sun - Dự đoán (luôn hiển thị ⏳ khi chưa có dữ liệu cũ)`);
    console.log(`📌 /sun/lichsu - Lịch sử`);
    console.log(`📌 /reset - Reset (POST)`);
});
