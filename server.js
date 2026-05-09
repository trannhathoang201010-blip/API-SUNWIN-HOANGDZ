const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 8080;

// ─── LƯU LỊCH SỬ ───────────────────────────────────────────────────────────
let sessionHistory = [];
const MAX_HISTORY = 100;

// ─── HÀM DỰ ĐOÁN - LUÔN TRẢ VỀ T HOẶC X ──────────────────────────────────
function duDoan(history) {
    // Nếu chưa có lịch sử -> vẫn phải dự đoán
    if (!history || history.length === 0) {
        return {
            duDoan: 'T', // Mặc định Tài nếu chưa có dữ liệu
            doTinCay: 30,
            cau: 'Chưa có dữ liệu - Tài mặc định',
            loaiCau: 'MẶC ĐỊNH',
            sucManh: 'YẾU',
            tatCaCau: [],
            thongKe: { tong: 0, tai: 0, xiu: 0, tiLeTai: '0%', tiLeXiu: '0%', xuHuong: 'CHƯA RÕ' },
            loiKhuyen: 'CHỜ THÊM DỮ LIỆU'
        };
    }

    const str = history.map(h => h.result).join('');
    const last = history[history.length - 1];
    const lastResult = last.result;
    const lastTong = last.tong;
    const allCau = [];

    // ═══════════════════════════════════
    // 1. CẦU BỆT (ƯU TIÊN CAO NHẤT)
    // ═══════════════════════════════════
    if (str.endsWith('TTTTT')) {
        allCau.push({ name: 'BỆT TÀI 5+', pred: 'T', conf: 95, type: 'BỆT', desc: 'Bệt Tài 5 phiên - VÀO TÀI TIẾP' });
    } else if (str.endsWith('XXXXX')) {
        allCau.push({ name: 'BỆT XỈU 5+', pred: 'X', conf: 95, type: 'BỆT', desc: 'Bệt Xỉu 5 phiên - VÀO XỈU TIẾP' });
    } else if (str.endsWith('TTTT')) {
        allCau.push({ name: 'BỆT TÀI 4', pred: 'T', conf: 85, type: 'BỆT', desc: 'Bệt Tài 4 phiên - VÀO TÀI' });
    } else if (str.endsWith('XXXX')) {
        allCau.push({ name: 'BỆT XỈU 4', pred: 'X', conf: 85, type: 'BỆT', desc: 'Bệt Xỉu 4 phiên - VÀO XỈU' });
    } else if (str.endsWith('TTT')) {
        allCau.push({ name: 'BỆT TÀI 3', pred: 'T', conf: 70, type: 'BỆT', desc: 'Bệt Tài 3 phiên - VÀO TÀI' });
    } else if (str.endsWith('XXX')) {
        allCau.push({ name: 'BỆT XỈU 3', pred: 'X', conf: 70, type: 'BỆT', desc: 'Bệt Xỉu 3 phiên - VÀO XỈU' });
    }

    // ═══════════════════════════════════
    // 2. CẦU ĐẢO 1-1 (T X T X)
    // ═══════════════════════════════════
    if (str.endsWith('TXTXTX') || str.endsWith('XTXTXT')) {
        allCau.push({ name: 'ĐẢO 1-1 DÀI', pred: lastResult === 'T' ? 'X' : 'T', conf: 88, type: 'ĐẢO', 
                     desc: `Đảo 1-1 dài - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    } else if (str.endsWith('TXTX') || str.endsWith('XTXT')) {
        allCau.push({ name: 'ĐẢO 1-1', pred: lastResult === 'T' ? 'X' : 'T', conf: 80, type: 'ĐẢO',
                     desc: `Đảo 1-1 - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    }

    // ═══════════════════════════════════
    // 3. CẦU ĐẢO 2-2 (TT XX TT XX)
    // ═══════════════════════════════════
    if (str.endsWith('TTXX')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO TÀI' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO XỈU' });
    }

    // ═══════════════════════════════════
    // 4. CẦU ĐẢO 3-3 (TTT XXX TTT XXX)
    // ═══════════════════════════════════
    if (str.endsWith('TTTXXX')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'T', conf: 75, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO TÀI' });
    } else if (str.endsWith('XXXTTT')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'X', conf: 75, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO XỈU' });
    }

    // ═══════════════════════════════════
    // 5. CẦU 1-2-1 (T XX T)
    // ═══════════════════════════════════
    if (str.endsWith('TXXT')) {
        allCau.push({ name: '1-2-1', pred: 'X', conf: 75, type: 'NHỊP', desc: 'Nhịp T-XX-T - VÀO XỈU' });
    } else if (str.endsWith('XTTX')) {
        allCau.push({ name: '1-2-1', pred: 'T', conf: 75, type: 'NHỊP', desc: 'Nhịp X-TT-X - VÀO TÀI' });
    }

    // ═══════════════════════════════════
    // 6. HỒI CẦU THEO TỔNG ĐIỂM
    // ═══════════════════════════════════
    if (lastTong >= 17) {
        allCau.push({ name: 'HỒI XỈU', pred: 'X', conf: 90, type: 'HỒI', desc: `Tổng ${lastTong} quá cao - VÀO XỈU` });
    } else if (lastTong <= 4) {
        allCau.push({ name: 'HỒI TÀI', pred: 'T', conf: 90, type: 'HỒI', desc: `Tổng ${lastTong} quá thấp - VÀO TÀI` });
    } else if (lastTong >= 15) {
        allCau.push({ name: 'HỒI XỈU', pred: 'X', conf: 75, type: 'HỒI', desc: `Tổng ${lastTong} cao - VÀO XỈU` });
    } else if (lastTong <= 5) {
        allCau.push({ name: 'HỒI TÀI', pred: 'T', conf: 75, type: 'HỒI', desc: `Tổng ${lastTong} thấp - VÀO TÀI` });
    }

    // ═══════════════════════════════════
    // 7. CẦU NGHIÊNG (Thống kê)
    // ═══════════════════════════════════
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = history.length;

    if (total >= 10) {
        const tRate = tCount / total;
        if (tRate >= 0.7) {
            allCau.push({ name: 'NGHIÊNG TÀI', pred: 'T', conf: 70, type: 'NGHIÊNG', desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% - VÀO TÀI` });
        } else if (tRate <= 0.3) {
            allCau.push({ name: 'NGHIÊNG XỈU', pred: 'X', conf: 70, type: 'NGHIÊNG', desc: `Nghiêng Xỉu ${((1-tRate)*100).toFixed(0)}% - VÀO XỈU` });
        }
    }

    // ═══════════════════════════════════
    // 8. CẦU SÓNG (Đảo liên tục)
    // ═══════════════════════════════════
    let doiChieu = 0;
    for (let i = 1; i < str.length; i++) {
        if (str[i] !== str[i-1]) doiChieu++;
    }
    if (doiChieu >= str.length * 0.7 && str.length >= 6) {
        allCau.push({ name: 'SÓNG', pred: lastResult === 'T' ? 'X' : 'T', conf: 65, type: 'SÓNG',
                     desc: `Sóng cao tần - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    }

    // ═══════════════════════════════════
    // 9. CẦU 2-1-2 (TT X TT)
    // ═══════════════════════════════════
    if (str.endsWith('TTXTT')) {
        allCau.push({ name: '2-1-2', pred: 'X', conf: 70, type: 'NHỊP', desc: 'Nhịp TT-X-TT - VÀO XỈU' });
    } else if (str.endsWith('XXTXX')) {
        allCau.push({ name: '2-1-2', pred: 'T', conf: 70, type: 'NHỊP', desc: 'Nhịp XX-T-XX - VÀO TÀI' });
    }

    // ═══════════════════════════════════
    // 10. CẦU 3-2-1 (TTT XX T)
    // ═══════════════════════════════════
    if (str.endsWith('TTTXXT')) {
        allCau.push({ name: '3-2-1', pred: 'X', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2-1 - VÀO XỈU' });
    } else if (str.endsWith('XXXTTX')) {
        allCau.push({ name: '3-2-1', pred: 'T', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2-1 - VÀO TÀI' });
    }

    // ═══════════════════════════════════
    // SẮP XẾP THEO ĐỘ TIN CẬY
    // ═══════════════════════════════════
    allCau.sort((a, b) => b.conf - a.conf);
    
    const best = allCau[0];

    // NẾU CÓ CẦU -> DỰ ĐOÁN THEO CẦU
    if (best) {
        let loiKhuyen = 'THĂM DÒ';
        if (best.conf >= 90) loiKhuyen = 'VÀO MẠNH TAY';
        else if (best.conf >= 80) loiKhuyen = 'VÀO VỪA TAY';
        else if (best.conf >= 70) loiKhuyen = 'ĐÁNH NHỎ';

        return {
            duDoan: best.pred,
            doTinCay: best.conf,
            cau: best.desc,
            loaiCau: best.type,
            sucManh: best.conf >= 90 ? 'RẤT MẠNH' : best.conf >= 80 ? 'MẠNH' : best.conf >= 70 ? 'VỪA' : 'YẾU',
            tatCaCau: allCau.slice(0, 5),
            thongKe: { 
                tong: total, 
                tai: tCount, 
                xiu: xCount, 
                tiLeTai: ((tCount/total)*100).toFixed(1) + '%', 
                tiLeXiu: ((xCount/total)*100).toFixed(1) + '%', 
                xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG' 
            },
            loiKhuyen
        };
    }

    // KHÔNG CÓ CẦU -> DỰA VÀO THỐNG KÊ
    if (total >= 5) {
        if (tCount > xCount * 1.5) {
            return {
                duDoan: 'X',
                doTinCay: 55,
                cau: 'Tài nhiều hơn hẳn - DỰ ĐOÁN XỈU',
                loaiCau: 'THỐNG KÊ',
                sucManh: 'YẾU',
                tatCaCau: [],
                thongKe: { tong: total, tai: tCount, xiu: xCount, tiLeTai: ((tCount/total)*100).toFixed(1) + '%', tiLeXiu: ((xCount/total)*100).toFixed(1) + '%', xuHuong: 'THIÊN TÀI' },
                loiKhuyen: 'THĂM DÒ NHẸ'
            };
        }
        if (xCount > tCount * 1.5) {
            return {
                duDoan: 'T',
                doTinCay: 55,
                cau: 'Xỉu nhiều hơn hẳn - DỰ ĐOÁN TÀI',
                loaiCau: 'THỐNG KÊ',
                sucManh: 'YẾU',
                tatCaCau: [],
                thongKe: { tong: total, tai: tCount, xiu: xCount, tiLeTai: ((tCount/total)*100).toFixed(1) + '%', tiLeXiu: ((xCount/total)*100).toFixed(1) + '%', xuHuong: 'THIÊN XỈU' },
                loiKhuyen: 'THĂM DÒ NHẸ'
            };
        }
    }

    // CUỐI CÙNG: DỰA VÀO KẾT QUẢ CUỐI
    return {
        duDoan: lastResult === 'T' ? 'X' : 'T',
        doTinCay: 45,
        cau: 'Cầu loạn - ĐÁNH NGƯỢC LẠI',
        loaiCau: 'ĐẢO NGƯỢC',
        sucManh: 'YẾU',
        tatCaCau: [],
        thongKe: { tong: total, tai: tCount, xiu: xCount, tiLeTai: ((tCount/total)*100).toFixed(1) + '%', tiLeXiu: ((xCount/total)*100).toFixed(1) + '%', xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG' },
        loiKhuyen: 'THĂM DÒ'
    };
}

// ─── API ENDPOINTS ──────────────────────────────────────────────────────────

app.get('/api/test-sunwin', async (req, res) => {
    try {
        const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = response.data;
        const tong = data.tong || 0;
        
        res.json({
            status: 'success',
            phien: data.phien,
            tong: tong,
            ket_qua: tong >= 11 ? 'TÀI' : 'XỈU',
            ky_hieu: tong >= 11 ? 'T' : 'X',
            xuc_xac: [data.xuc_xac_1, data.xuc_xac_2, data.xuc_xac_3],
            thoi_gian: data.thoi_gian
        });
    } catch (err) {
        res.json({
            status: 'error',
            message: 'API Sunwin lỗi: ' + (err.code || err.message)
        });
    }
});

app.get('/api/predict', async (req, res) => {
    let newData = null;
    
    // Gọi API Sunwin
    try {
        const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        newData = response.data;
    } catch (err) {
        // Không sao, dùng lịch sử cũ
    }

    // Thêm vào lịch sử nếu có phiên mới
    if (newData && newData.phien) {
        const tong = newData.tong || 0;
        const result = tong >= 11 ? 'T' : 'X';
        
        const exists = sessionHistory.find(s => s.phien === newData.phien);
        if (!exists) {
            sessionHistory.push({
                phien: newData.phien,
                tong: tong,
                result: result,
                xuc_xac: [newData.xuc_xac_1, newData.xuc_xac_2, newData.xuc_xac_3],
                thoi_gian: newData.thoi_gian
            });
            if (sessionHistory.length > MAX_HISTORY) {
                sessionHistory = sessionHistory.slice(-MAX_HISTORY);
            }
        }
    }

    // DỰ ĐOÁN
    const ketQua = duDoan(sessionHistory);
    const last = sessionHistory.length > 0 ? sessionHistory[sessionHistory.length - 1] : null;

    res.json({
        status: 'success',
        api: newData ? '✅ KẾT NỐI' : '⚠️ LỖI API - DÙNG LỊCH SỬ CŨ',
        
        // Phiên hiện tại
        phien_hien_tai: last ? {
            phien: last.phien,
            ket_qua: last.result === 'T' ? 'TÀI' : 'XỈU',
            ky_hieu: last.result,
            tong_diem: last.tong,
            xuc_xac: last.xuc_xac,
            thoi_gian: last.thoi_gian
        } : null,
        
        // DỰ ĐOÁN PHIÊN TIẾP THEO
        du_doan: {
            phien_tiep_theo: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
            ky_hieu: ketQua.duDoan,
            do_tin_cay: ketQua.doTinCay + '%',
            loai_cau: ketQua.loaiCau,
            cau_phat_hien: ketQua.cau,
            suc_manh_cau: ketQua.sucManh,
            loi_khuyen: ketQua.loiKhuyen
        },
        
        // Thống kê
        thong_ke: ketQua.thongKe,
        
        // Tất cả cầu phát hiện
        tat_ca_cau: ketQua.tatCaCau.map(c => ({
            ten: c.name,
            loai: c.type,
            du_doan: c.pred === 'T' ? 'TÀI' : 'XỈU',
            do_tin_cay: c.conf + '%',
            mo_ta: c.desc
        })),
        
        // Lịch sử gần đây
        lich_su: sessionHistory.slice(-10).reverse().map(s => ({
            phien: s.phien,
            ket_qua: s.result === 'T' ? 'Tài' : 'Xỉu',
            tong: s.tong,
            xuc_xac: s.xuc_xac
        }))
    });
});

app.get('/api/history', (req, res) => {
    res.json({
        tong_so_phien: sessionHistory.length,
        du_lieu: sessionHistory.slice(-20).reverse().map(s => ({
            phien: s.phien,
            ket_qua: s.result === 'T' ? 'Tài' : 'Xỉu',
            tong: s.tong,
            xuc_xac: s.xuc_xac,
            thoi_gian: s.thoi_gian
        }))
    });
});

// Dashboard
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sunwin AI DỰ ĐOÁN</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0d1117;color:#fff;padding:15px}
.container{max-width:650px;margin:0 auto}
h1{text-align:center;font-size:1.5em;margin:10px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:15px;margin:10px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.box{padding:12px;border-radius:8px;text-align:center;background:#1c2128}
.box.TAI{border:2px solid #f85149}.box.XIU{border:2px solid #3fb950}
.big{font-size:2em;font-weight:bold}
.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}
.btn{display:inline-block;padding:12px 25px;background:#238636;color:#fff;text-decoration:none;border-radius:6px;margin:5px;border:none;cursor:pointer;font-size:1em;font-weight:bold}
.btn:hover{background:#2ea043}
.btn2{background:transparent;border:1px solid #30363d}
.btn2:hover{background:#1c2128}
.tag{display:inline-block;padding:3px 10px;border-radius:4px;font-size:0.75em;margin:2px;font-weight:bold}
.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}
.tag.HỒI{background:#d2991d;color:#000}.tag.NGHIÊNG{background:#3fb950;color:#000}
.tag.SÓNG{background:#db6d28}
.loading{text-align:center;padding:30px;color:#8b949e;font-size:1.2em}
pre{background:#0d1117;padding:10px;border-radius:6px;overflow-x:auto;font-size:0.8em;max-height:250px;overflow-y:auto}
.blink{animation:blink 1s infinite}
@keyframes blink{50%{opacity:0.5}}
</style>
</head><body>
<div class="container">
<h1>🎯 SUNWIN AI DỰ ĐOÁN</h1>
<p style="text-align:center;color:#8b949e">10 LOẠI CẦU • DỰ ĐOÁN CHÍNH XÁC • KHÔNG RANDOM</p>

<div style="text-align:center;margin:15px 0">
<button class="btn blink" onclick="load()">🎲 DỰ ĐOÁN NGAY</button>
<button class="btn btn2" onclick="window.open('/api/history')">📊 Lịch Sử</button>
<button class="btn btn2" onclick="testAPI()">🔍 Test API</button>
</div>

<div id="out"><div class="loading">⏳ Đang phân tích cầu...</div></div>
</div>

<script>
async function load(){
    document.getElementById('out').innerHTML='<div class="loading">⏳ Đang gọi Sunwin & phân tích cầu...</div>';
    try{
        const r=await fetch('/api/predict');
        const d=await r.json();
        const ht=d.phien_hien_tai||{};
        const dd=d.du_doan||{};
        const tk=d.thong_ke||{};
        const cau=d.tat_ca_cau||[];
        
        document.getElementById('out').innerHTML=\`
<div class="card" style="border:1px solid #30363d">
<p style="color:#8b949e;font-size:0.85em">📡 \${d.api||'?'}</p>
<h3>📍 Phiên #\${ht.phien||'?'} <span style="font-size:0.8em;color:#8b949e">\${ht.thoi_gian||''}</span></h3>
<div class="grid2">
<div class="box \${ht.ky_hieu==='T'?'TAI':'XIU'}">
<small>KẾT QUẢ VỪA RA</small>
<div class="big \${ht.ky_hieu==='T'?'red':'green'}">\${ht.ket_qua||'?'}</div>
<small>Tổng: \${ht.tong_diem||'?'} | Xúc xắc: \${(ht.xuc_xac||[]).join(',')}</small>
</div>
<div class="box">
<small>THỐNG KÊ \${tk.tong||0} PHIÊN</small>
<div><span class="red">Tài: \${tk.tai||0} (\${tk.tiLeTai||'0%'})</span></div>
<div><span class="green">Xỉu: \${tk.xiu||0} (\${tk.tiLeXiu||'0%'})</span></div>
<small>Xu hướng: <b>\${tk.xuHuong||'?'}</b></small>
</div>
</div>
</div>

<div class="card" style="border-left:5px solid \${dd.ky_hieu==='T'?'#f85149':'#3fb950'};background:linear-gradient(135deg,#161b22 0%,#\${dd.ky_hieu==='T'?'3d1a1a':'1a3d1a'} 100%)">
<h2 style="text-align:center;margin:5px 0">🔮 DỰ ĐOÁN PHIÊN TIẾP THEO</h2>
<div class="grid3">
<div class="box \${dd.ky_hieu==='T'?'TAI':'XIU'}">
<small>DỰ ĐOÁN</small>
<div class="big \${dd.ky_hieu==='T'?'red':'green'}" style="font-size:2.5em">\${dd.phien_tiep_theo||'?'}</div>
</div>
<div class="box">
<small>ĐỘ TIN CẬY</small>
<div class="big yellow">\${dd.do_tin_cay||'?'}</div>
</div>
<div class="box">
<small>LỜI KHUYÊN</small>
<div class="big" style="font-size:1.3em">\${dd.loi_khuyen||'?'}</div>
</div>
</div>
<div style="margin-top:10px;padding:8px;background:rgba(255,255,255,0.05);border-radius:6px">
<p>📊 <b>Cầu phát hiện:</b> \${dd.cau_phat_hien||'?'}</p>
<p>🏷️ Loại cầu: <span class="tag \${dd.loai_cau||''}">\${dd.loai_cau||'?'}</span> | Sức mạnh: <b>\${dd.suc_manh_cau||'?'}</b></p>
</div>
</div>

\${cau.length>0?\`
<div class="card">
<h3>🔍 TẤT CẢ CẦU PHÁT HIỆN (\${cau.length})</h3>
\`+cau.map((c,i)=>'<p style="margin:4px 0;font-size:0.85em;padding:5px;background:rgba(255,255,255,0.02);border-radius:4px">'+(i+1)+'. <span class="tag '+c.loai+'">'+c.loai+'</span> <b>'+c.ten+'</b> → DỰ ĐOÁN <b style="color:'+(c.du_doan==='TÀI'?'#f85149':'#3fb950')+'">'+c.du_doan+'</b> ('+c.do_tin_cay+')<br><span style="color:#8b949e;font-size:0.8em">'+c.mo_ta+'</span></p>').join('')+'
</div>
\`:''}

\${d.lich_su?\`
<div class="card">
<h3>📜 10 PHIÊN GẦN NHẤT</h3>
<pre>\${d.lich_su.map(h=>'#'+h.phien+' | '+h.ket_qua+' (Tổng '+h.tong+') | Xúc xắc: '+h.xuc_xac.join(',')).join('\\n')}</pre>
</div>
\`:''}`;
    }catch(e){
        document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ Lỗi</h3><p>'+e.message+'</p></div>';
    }
}

async function testAPI(){
    document.getElementById('out').innerHTML='<div class="loading">⏳ Đang test...</div>';
    try{
        const r=await fetch('/api/test-sunwin');
        const d=await r.json();
        if(d.status==='success'){
            document.getElementById('out').innerHTML=\`
<div class="card" style="border:2px solid #3fb950">
<h3 style="color:#3fb950">✅ API SUNWIN HOẠT ĐỘNG!</h3>
<p>Phiên: <b>#\${d.phien}</b> | Tổng: <b>\${d.tong}</b> | Kết quả: <b style="color:\${d.ky_hieu==='T'?'#f85149':'#3fb950'}">\${d.ket_qua}</b></p>
<p>Xúc xắc: \${d.xuc_xac.join(', ')} | \${d.thoi_gian}</p>
<button class="btn" onclick="load()" style="margin-top:10px">🎲 DỰ ĐOÁN NGAY</button>
</div>\`;
        }else{
            document.getElementById('out').innerHTML=\`
<div class="card" style="border:1px solid #f85149">
<h3 style="color:#f85149">❌ API SUNWIN LỖI</h3>
<p>\${d.message}</p>
<button class="btn" onclick="load()" style="margin-top:10px">🔄 Thử dự đoán với lịch sử cũ</button>
</div>\`;
        }
    }catch(e){
        document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ Lỗi</h3><p>'+e.message+'</p></div>';
    }
}

// Auto load
load();
// Auto refresh mỗi 30s
setInterval(load, 30000);
</script>
</body></html>`);
});

// ─── START SERVER ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('🌟══════════════════════════════🌟');
    console.log('  🎯 SUNWIN AI - DỰ ĐOÁN TÀI XỈU');
    console.log('  🔮 KHÔNG RANDOM - CHỈ THEO CẦU');
    console.log('🌟══════════════════════════════🌟');
    console.log(`  🚀 http://localhost:${PORT}`);
    console.log(`  🎲 /api/predict  ← DỰ ĐOÁN`);
    console.log(`  📊 /api/history  ← LỊCH SỬ`);
    console.log(`  🔍 /api/test-sunwin ← TEST`);
    console.log('🌟══════════════════════════════🌟');
});
