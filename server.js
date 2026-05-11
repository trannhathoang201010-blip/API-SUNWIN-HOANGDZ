const express = require('express');
const axios = require('axios');
const fs = require('fs');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 5000;

const API_URL = 'https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx';
const DB_PATH = 'cau_database.db';

// ==================== SQLITE ====================
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS learned_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_hash TEXT UNIQUE,
        pattern_sequence TEXT,
        next_result INTEGER,
        confidence REAL,
        occurrences INTEGER,
        last_seen TIMESTAMP,
        created_at TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS learning_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TIMESTAMP,
        pattern_hash TEXT,
        action TEXT,
        details TEXT
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_hash ON learned_patterns(pattern_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_confidence ON learned_patterns(confidence DESC)`);
});

// ==================== LỚP HỌC CẦU ====================
class CauLearner {
    constructor(minLen = 3, maxLen = 8) {
        this.minLen = minLen;
        this.maxLen = maxLen;
        this.history = [];
        this.isLearning = false;
        this.learnInterval = null;
        this.learnsPerSecond = 30;
    }
    
    addResult(result) { this.history.push(result); if (this.history.length > 200) this.history.shift(); }
    addResultsBatch(results) { for (let r of results) this.addResult(r); }
    _computePatternHash(pattern) { return `pattern_${pattern.join('_')}`; }
    
    async _getPatternFromDB(patternHash) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM learned_patterns WHERE pattern_hash = ?", [patternHash], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    async _savePattern(patternHash, patternSeq, nextResult, confidence) {
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO learned_patterns (pattern_hash, pattern_sequence, next_result, confidence, occurrences, last_seen, created_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(pattern_hash) DO UPDATE SET
                    occurrences = occurrences + 1,
                    confidence = (confidence + excluded.confidence) / 2,
                    last_seen = excluded.last_seen
            `, [patternHash, JSON.stringify(patternSeq), nextResult, confidence, new Date().toISOString(), new Date().toISOString()], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
    
    async _logLearningEvent(patternHash, action, details) {
        return new Promise((resolve) => {
            db.run(`INSERT INTO learning_history (timestamp, pattern_hash, action, details) VALUES (?, ?, ?, ?)`,
                [new Date().toISOString(), patternHash, action, details], () => resolve());
        });
    }
    
    async learn(maxPatterns = 50) {
        if (this.history.length < this.minLen + 1) return { learned: 0, msg: "Not enough data" };
        let patterns = [], historyList = [...this.history];
        for (let len = this.minLen; len <= Math.min(this.maxLen, historyList.length - 1); len++) {
            for (let i = 0; i <= historyList.length - len - 1; i++) {
                patterns.push({ seq: historyList.slice(i, i + len), next: historyList[i + len] });
            }
        }
        let uniqueMap = new Map();
        for (let p of patterns) {
            let hash = this._computePatternHash(p.seq);
            if (!uniqueMap.has(hash)) uniqueMap.set(hash, { seq: p.seq, next: p.next });
        }
        let uniquePatterns = Array.from(uniqueMap.values());
        let limited = uniquePatterns.slice(0, Math.min(maxPatterns, uniquePatterns.length));
        let newCount = 0, updateCount = 0;
        for (let p of limited) {
            let hash = this._computePatternHash(p.seq);
            let confidence = this._calculateConfidence(p.seq, p.next, patterns);
            let existing = await this._getPatternFromDB(hash);
            if (existing) { updateCount++; await this._logLearningEvent(hash, "UPDATE", `conf=${confidence}`); }
            else { newCount++; await this._logLearningEvent(hash, "INSERT", "new pattern"); }
            await this._savePattern(hash, p.seq, p.next, confidence);
        }
        return { learned: limited.length, new: newCount, updated: updateCount, total: await this.getTotalPatterns() };
    }
    
    _calculateConfidence(patternSeq, targetNext, allPatterns) {
        let total = 0, correct = 0;
        for (let p of allPatterns) {
            if (JSON.stringify(p.seq) === JSON.stringify(patternSeq)) { total++; if (p.next === targetNext) correct++; }
        }
        return total === 0 ? 0 : correct / total;
    }
    
    async getTotalPatterns() {
        return new Promise((resolve) => { db.get("SELECT COUNT(*) as total FROM learned_patterns", (err, row) => { resolve(row ? row.total : 0); }); });
    }
    
    async getTopPatterns(limit = 50, minConfidence = 0.6) {
        return new Promise((resolve) => {
            db.all(`SELECT pattern_hash, pattern_sequence, next_result, confidence, occurrences, last_seen FROM learned_patterns WHERE confidence >= ? ORDER BY confidence DESC, occurrences DESC LIMIT ?`, [minConfidence, limit], (err, rows) => {
                if (err) resolve([]);
                else resolve(rows.map(r => ({ pattern_hash: r.pattern_hash, pattern_sequence: JSON.parse(r.pattern_sequence), next_result: r.next_result, confidence: r.confidence, occurrences: r.occurrences, last_seen: r.last_seen })));
            });
        });
    }
    
    async getStats() {
        return new Promise((resolve) => {
            db.get("SELECT COUNT(*) as total, AVG(confidence) as avgConf, AVG(occurrences) as avgOcc FROM learned_patterns", (err, row) => {
                db.get("SELECT COUNT(*) as high FROM learned_patterns WHERE confidence >= 0.8", (err2, row2) => {
                    resolve({ total_patterns: row ? row.total : 0, avg_confidence: row ? (row.avgConf || 0).toFixed(4) : 0, avg_occurrences: row ? (row.avgOcc || 0).toFixed(2) : 0, high_quality_patterns: row2 ? row2.high : 0 });
                });
            });
        });
    }
    
    async predict(currentSeq) {
        if (currentSeq.length < this.minLen) return { prediction: null, confidence: 0, message: `Need at least ${this.minLen} results` };
        let bestMatch = null, bestConf = 0, bestHash = null, bestPattern = null;
        for (let len = Math.min(this.maxLen, currentSeq.length); len >= this.minLen; len--) {
            let searchPattern = currentSeq.slice(-len);
            let patternData = await this._getPatternFromDB(this._computePatternHash(searchPattern));
            if (patternData && patternData.confidence > bestConf) {
                bestConf = patternData.confidence;
                bestMatch = patternData.next_result;
                bestHash = patternData.pattern_hash;
                bestPattern = searchPattern;
            }
        }
        if (bestMatch !== null && bestConf >= 0.6) return { prediction: bestMatch, prediction_name: bestMatch === 1 ? 'Tài' : 'Xỉu', confidence: bestConf, matched_pattern: bestPattern, pattern_hash: bestHash, message: 'Prediction successful' };
        return { prediction: null, confidence: bestConf, message: 'No confident pattern found' };
    }
    
    startAutoLearn(learnsPerSecond = 30) {
        if (this.isLearning) return { status: "already running" };
        this.learnsPerSecond = Math.max(5, Math.min(50, learnsPerSecond));
        this.isLearning = true;
        let intervalMs = 1000 / this.learnsPerSecond;
        this.learnInterval = setInterval(async () => { if (this.history.length >= this.minLen + 1) await this.learn(this.learnsPerSecond); }, intervalMs);
        return { status: "started", learns_per_second: this.learnsPerSecond };
    }
    
    stopAutoLearn() { if (this.learnInterval) clearInterval(this.learnInterval); this.learnInterval = null; this.isLearning = false; return { status: "stopped" }; }
}

// ==================== NHẬN DIỆN CẦU ====================
function nhanDangCau(results) {
    if (results.length < 3) return { type: 'QUAN_SAT', action: 'KHONG_CUOC', message: 'Đang quan sát (cần ít nhất 3 ván)', confidence: 0 };
    let last3 = results.slice(-3), last4 = results.slice(-4), last5 = results.slice(-5), last6 = results.slice(-6), last8 = results.slice(-8);
    if (last4[0] === last4[1] && last4[1] === last4[2] && last4[2] === last4[3]) {
        let betLen = 4; for (let i = 4; i < results.length; i++) if (results[i] === results[0]) betLen++; else break;
        return { type: 'BET', prediction: results[0], action: 'THEO_DUOI', message: `🔴 Cầu Bệt ${betLen} phiên ${results[0]} – Theo đuôi`, confidence: 70 + Math.min(15, betLen) };
    }
    let is11 = true; for (let i = 1; i < 5; i++) if (last5[i] === last5[i-1]) { is11 = false; break; }
    if (is11 && last5.length === 5) return { type: 'DAO_11', prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', action: 'BE_CAU', message: '🟡 Cầu 1-1 – Bẻ cầu, đặt ngược lại', confidence: 75 };
    if (last6.length >= 6 && last6[0] === last6[1] && last6[2] === last6[3] && last6[4] === last6[5] && last6[0] !== last6[2]) {
        let pred = last6[2] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_22', prediction: pred, action: 'THEO_CAP', message: `🟢 Cầu 2-2 – Theo cặp, đặt ${pred}`, confidence: 78 };
    }
    if (last6.length === 6 && last6[0] === last6[1] && last6[1] === last6[2] && last6[3] === last6[4] && last6[0] !== last6[3] && last6[5] === last6[0]) {
        return { type: 'CAU_321', prediction: 'Xỉu', action: 'THEO_NHIP', message: '📊 Cầu 3-2-1 – Theo nhịp giảm dần', confidence: 76 };
    }
    if (last6.length === 6 && last6[0] !== 'Tài' && last6[1] !== 'Tài' && last6[2] !== 'Tài' && last6[3] === 'Tài' && last6[4] === 'Tài' && last6[5] !== 'Tài') {
        return { type: 'CAU_321', prediction: 'Tài', action: 'THEO_NHIP', message: '📊 Cầu 3-2-1 (X X X T T X) – Theo nhịp giảm', confidence: 76 };
    }
    if (last6.length === 6 && last6[0] !== last6[1] && last6[1] === last6[2] && last6[2] !== last6[3] && last6[3] === last6[4] && last6[4] === last6[5]) {
        return { type: 'CAU_123', prediction: 'Xỉu', action: 'THEO_TIEN', message: '📈 Cầu 1-2-3 – Vào tiền tăng dần', confidence: 80 };
    }
    if (last6.length === 6 && last6[0] !== 'Tài' && last6[1] === 'Tài' && last6[2] === 'Tài' && last6[3] !== 'Tài' && last6[4] !== 'Tài' && last6[5] !== 'Tài') {
        return { type: 'CAU_123', prediction: 'Tài', action: 'THEO_TIEN', message: '📈 Cầu 1-2-3 (X T T X X X) – Vào tiền tăng dần', confidence: 80 };
    }
    if (last8.length >= 9 && last8[0]===last8[1] && last8[1]===last8[2] && last8[3]===last8[4] && last8[4]===last8[5] && last8[6]===last8[7] && last8[7]===last8[8] && last8[0]!==last8[3] && last8[3]!==last8[6]) {
        let pred = last8[6] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_33', prediction: pred, action: 'THAN_TRONG', message: '🟣 Cầu 3-3 – Rủi ro cao, chỉ đánh khi chắc chắn', confidence: 72 };
    }
    if (last8.length >= 10 && last8[0]===last8[1] && last8[1]===last8[2] && last8[2]===last8[3] && last8[4]===last8[5] && last8[6]===last8[7] && last8[7]===last8[8] && last8[8]===last8[9] && last8[0]!==last8[4] && last8[4]!==last8[6]) {
        let pred = last8[6] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_424', prediction: pred, action: 'THAN_TRONG', message: '📐 Cầu 4-2-4 (chữ A) – Rủi ro cao', confidence: 70 };
    }
    if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] === last6[4] && last6[4] !== last6[5]) {
        let pred = last6[0] === 'Tài' ? 'Xỉu' : 'Tài';
        return { type: 'CAU_212', prediction: pred, action: 'THAN_TRONG', message: '🔁 Cầu 2-1-2 – Chu kỳ ngắn', confidence: 72 };
    }
    if (results.length >= 10 && results.slice(0,5).every(r => r === results[0]) && results.slice(5,10).every(r => r === results[5]) && results[0] !== results[5]) {
        return { type: 'CAU_55', action: 'KHONG_CUOC', message: '⚠️ Cầu 5-5 (siêu bệt) – RẤT HIẾM, khuyên BỎ QUA', confidence: 50 };
    }
    return { type: 'ZIGZAG', action: 'KHONG_CUOC', message: '🌀 Cầu rối (Zigzag) – KHÔNG ĐẶT CƯỢC, chờ cầu mới', confidence: 0 };
}

// ==================== TÍCH HỢP CHÍNH ====================
let predictionsDB = [];
let session = { vondau: 1000000, von_hien_tai: 1000000, muc_cuoc_mac_dinh: 25000, thang: 0, thua: 0, chuoi_thua: 0, chuoi_thang: 0, trang_thai: "QUAN_SAT" };
let cauLearner = new CauLearner(3, 8);
cauLearner.startAutoLearn(30);

async function fetchCurrentGame() {
    try {
        const res = await axios.get(API_URL, { timeout: 8000 });
        if (res.data && res.data.ket_qua) {
            let ketQua = (res.data.ket_qua === 'Tài' || res.data.ket_qua === 'TAI') ? 'Tài' : 'Xỉu';
            return { phien: res.data.phien, ket_qua: ketQua, tong: res.data.tong, numeric: ketQua === 'Tài' ? 1 : 0 };
        }
        return null;
    } catch(e) { return null; }
}

app.get('/sun', async (req, res) => {
    try {
        const current = await fetchCurrentGame();
        if (!current) return res.status(503).json({ error: 'Cannot connect to game API' });
        
        cauLearner.addResult(current.numeric);
        
        // ✅ CẬP NHẬT KẾT QUẢ CHO DỰ ĐOÁN CŨ (chỉ cập nhật 1 lần duy nhất)
        let oldPred = predictionsDB.find(p => p.phien_du_doan === current.phien);
        if (oldPred && !oldPred.ket_qua_thuc_te) {
            oldPred.ket_qua_thuc_te = current.ket_qua;
            oldPred.dung_sai = (oldPred.du_doan === current.ket_qua) ? '✅' : '❌';
            if (oldPred.dung_sai === '✅') { session.thang++; session.chuoi_thang++; session.chuoi_thua = 0; }
            else { session.thua++; session.chuoi_thua++; session.chuoi_thang = 0; }
        }
        
        // Lấy lịch sử kết quả thực tế
        let numericHistory = predictionsDB.filter(p => p.ket_qua_thuc_te).slice(0, 30).map(p => p.ket_qua_thuc_te === 'Tài' ? 1 : 0);
        let cau = nhanDangCau(numericHistory.map(v => v === 1 ? 'Tài' : 'Xỉu'));
        
        // AI dự đoán
        let aiPrediction = numericHistory.length >= 3 ? await cauLearner.predict(numericHistory) : { prediction: null, confidence: 0 };
        
        let finalPrediction = '', finalConfidence = 0, phanTich = '';
        if (aiPrediction.prediction !== null && aiPrediction.confidence >= 0.65) {
            finalPrediction = aiPrediction.prediction === 1 ? 'Tài' : 'Xỉu';
            finalConfidence = Math.floor(aiPrediction.confidence * 100);
            phanTich = `🧠 AI học pattern [${aiPrediction.matched_pattern?.join(', ')}] ➜ ${finalPrediction} (${finalConfidence}%)`;
        } else if (cau.action !== 'KHONG_CUOC') {
            finalPrediction = cau.prediction;
            finalConfidence = cau.confidence;
            phanTich = cau.message;
        } else {
            finalPrediction = numericHistory.length ? (numericHistory[numericHistory.length-1] === 1 ? 'Tài' : 'Xỉu') : 'Tài';
            finalConfidence = 60;
            phanTich = cau.message;
        }
        
        // Quản lý vốn
        let mucCuoc = 0, loiKhuyen = '', trangThai = session.trang_thai;
        if (session.chuoi_thua >= 5) { trangThai = 'DUNG_30P'; loiKhuyen = '⛔ Thua 5 liên tiếp! DỪNG 30 PHÚT.'; mucCuoc = 0; }
        else if ((session.vondau - session.von_hien_tai) / session.vondau >= 0.3) { trangThai = 'KET_THUC_PHIEN'; loiKhuyen = '💸 Thua 30% vốn! KẾT THÚC PHIÊN.'; mucCuoc = 0; }
        else if (session.chuoi_thang >= 5) { trangThai = 'DUNG_10P'; loiKhuyen = '🎉 Thắng 5 liên tiếp! NGHỈ 10 PHÚT.'; mucCuoc = 0; }
        else { mucCuoc = Math.min(Math.floor(session.muc_cuoc_mac_dinh), Math.floor(session.von_hien_tai * 0.03)); if (mucCuoc < 10000) mucCuoc = 10000; loiKhuyen = `✅ Đặt ${mucCuoc.toLocaleString()}đ`; trangThai = 'DANG_CHAY'; }
        
        // ✅ CHỈ LƯU DỰ ĐOÁN MỚI NẾU CHƯA CÓ
        let phienHienTai = current.phien + 1;
        let existingPred = predictionsDB.find(p => p.phien_du_doan === phienHienTai);
        if (!existingPred && mucCuoc > 0) {
            predictionsDB.unshift({
                phien_du_doan: phienHienTai,
                du_doan: finalPrediction,
                muc_cuoc_thuc_te: mucCuoc,
                ket_qua_thuc_te: null,
                dung_sai: null,
                timestamp: new Date().toISOString()
            });
            if (predictionsDB.length > 100) predictionsDB = predictionsDB.slice(0,100);
        }
        
        session.trang_thai = trangThai;
        
        let resolved = predictionsDB.filter(p => p.ket_qua_thuc_te);
        let dung = resolved.filter(p => p.dung_sai === '✅').length;
        let topPatterns = await cauLearner.getTopPatterns(5);
        
        res.json({
            success: true,
            phiên_trước: current.phien,
            kết_quả_trước: current.ket_qua,
            phân_tích_cầu: phanTich,
            dự_đoán: finalPrediction,
            độ_tin_cậy: finalConfidence + '%',
            phiên_hiện_tại: phienHienTai,
            AI_pattern: aiPrediction.prediction !== null ? { matched: aiPrediction.matched_pattern, confidence: (aiPrediction.confidence*100).toFixed(1)+'%' } : 'Chưa có',
            quản_lý_vốn: { trạng_thái: trangThai, lời_khuyên: loiKhuyen, mức_cược: mucCuoc.toLocaleString()+'đ', vốn_hiện_tại: session.von_hien_tai.toLocaleString()+'đ', chuỗi_thắng: session.chuoi_thang, chuỗi_thua: session.chuoi_thua },
            thống_kê: { tổng_dự_đoán: predictionsDB.length, đã_có_kết_quả: resolved.length, đúng: dung, tỉ_lệ_đúng: resolved.length ? ((dung/resolved.length)*100).toFixed(1)+'%' : '0%' },
            top_patterns: topPatterns.map(p => ({ pattern: p.pattern_sequence.map(v=>v===1?'T':'X').join(''), next: p.next_result===1?'Tài':'Xỉu', confidence: (p.confidence*100).toFixed(1)+'%', đã_gặp: p.occurrences+' lần' })),
            id: '@tranhoang2286'
        });
    } catch(err) { console.error(err); res.status(500).json({ error: 'Server error: ' + err.message }); }
});

app.get('/sun/lichsu', (req, res) => {
    let historyList = predictionsDB.map(h => ({
        phiên_dự_đoán: h.phien_du_doan,
        dự_đoán: h.du_doan,
        mức_cược: h.muc_cuoc_thuc_te?.toLocaleString()+'đ',
        kết_quả_thực_tế: h.ket_qua_thuc_te || '⏳ Chờ',
        đúng_sai: h.dung_sai || '⏳',
        thời_gian: h.timestamp
    }));
    res.json({ game: 'SUNWIN Tài Xỉu', tổng_số: predictionsDB.length, lịch_sử: historyList, id: '@tranhoang2286' });
});

app.get('/sun/ai-stats', async (req, res) => {
    let stats = await cauLearner.getStats();
    let top = await cauLearner.getTopPatterns(10);
    res.json({ success: true, stats, top_patterns: top.map(p => ({ pattern: p.pattern_sequence.map(v=>v===1?'T':'X').join(''), next: p.next_result===1?'Tài':'Xỉu', confidence: (p.confidence*100).toFixed(1)+'%', occurrences: p.occurrences })), id: '@tranhoang2286' });
});

app.post('/reset', (req, res) => {
    predictionsDB = [];
    session = { vondau: 1000000, von_hien_tai: 1000000, muc_cuoc_mac_dinh: 25000, thang: 0, thua: 0, chuoi_thua: 0, chuoi_thang: 0, trang_thai: "QUAN_SAT" };
    res.json({ success: true, message: 'Reset complete', id: '@tranhoang2286' });
});

app.get('/', (req, res) => {
    res.json({ name: 'SUNWIN Tài Xỉu Pro', version: 'ULTIMATE', author: '@tranhoang2286', endpoints: { dự_đoán: 'GET /sun', lịch_sử: 'GET /sun/lichsu', AI_stats: 'GET /sun/ai-stats', reset: 'POST /reset' } });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SUNWIN API - ULTIMATE FIXED`);
    console.log(`📡 PORT: ${PORT}`);
    console.log(`✅ Không trùng phiên dự đoán`);
    console.log(`✅ Tự động cập nhật đúng/sai khi có kết quả`);
    console.log(`📌 /sun - Dự đoán tối ưu`);
});
