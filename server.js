const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

// ─── LƯU LỊCH SỬ + KẾT QUẢ DỰ ĐOÁN ────────────────────────────────────────
let sessionHistory = []; // Lịch sử các phiên đã ra
let predictionLog = [];  // Log dự đoán + kết quả đúng/sai
const MAX_HISTORY = 100;

// ─── FULL THUẬT TOÁN DỰ ĐOÁN ──────────────────────────────────────────────
function duDoan(history) {
    if (!history || history.length === 0) {
        return {
            duDoan: 'T',
            doTinCay: 30,
            tiLeThang: '30%',
            cau: 'Chưa có dữ liệu - Mặc định Tài',
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

    // ═══════════════════════════════════════
    // 1. CẦU BỆT
    // ═══════════════════════════════════════
    if (str.endsWith('TTTTTT')) {
        allCau.push({ name: 'BỆT TÀI 6', pred: 'T', conf: 98, type: 'BỆT', desc: 'Bệt Tài 6 phiên - TIẾP TỤC TÀI' });
    } else if (str.endsWith('XXXXXX')) {
        allCau.push({ name: 'BỆT XỈU 6', pred: 'X', conf: 98, type: 'BỆT', desc: 'Bệt Xỉu 6 phiên - TIẾP TỤC XỈU' });
    } else if (str.endsWith('TTTTT')) {
        allCau.push({ name: 'BỆT TÀI 5', pred: 'T', conf: 95, type: 'BỆT', desc: 'Bệt Tài 5 phiên - VÀO TÀI' });
    } else if (str.endsWith('XXXXX')) {
        allCau.push({ name: 'BỆT XỈU 5', pred: 'X', conf: 95, type: 'BỆT', desc: 'Bệt Xỉu 5 phiên - VÀO XỈU' });
    } else if (str.endsWith('TTTT')) {
        allCau.push({ name: 'BỆT TÀI 4', pred: 'T', conf: 88, type: 'BỆT', desc: 'Bệt Tài 4 phiên - VÀO TÀI' });
    } else if (str.endsWith('XXXX')) {
        allCau.push({ name: 'BỆT XỈU 4', pred: 'X', conf: 88, type: 'BỆT', desc: 'Bệt Xỉu 4 phiên - VÀO XỈU' });
    } else if (str.endsWith('TTT')) {
        allCau.push({ name: 'BỆT TÀI 3', pred: 'T', conf: 75, type: 'BỆT', desc: 'Bệt Tài 3 phiên - VÀO TÀI' });
    } else if (str.endsWith('XXX')) {
        allCau.push({ name: 'BỆT XỈU 3', pred: 'X', conf: 75, type: 'BỆT', desc: 'Bệt Xỉu 3 phiên - VÀO XỈU' });
    }

    // ═══════════════════════════════════════
    // 2. CẦU ĐẢO 1-1
    // ═══════════════════════════════════════
    if (str.endsWith('TXTXTX') || str.endsWith('XTXTXT')) {
        allCau.push({ name: 'ĐẢO 1-1 DÀI', pred: lastResult === 'T' ? 'X' : 'T', conf: 90, type: 'ĐẢO',
                     desc: `Đảo 1-1 dài - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    } else if (str.endsWith('TXTXT') || str.endsWith('XTXTX')) {
        allCau.push({ name: 'ĐẢO 1-1', pred: lastResult === 'T' ? 'X' : 'T', conf: 85, type: 'ĐẢO',
                     desc: `Đảo 1-1 - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    } else if (str.endsWith('TXTX') || str.endsWith('XTXT')) {
        allCau.push({ name: 'ĐẢO 1-1', pred: lastResult === 'T' ? 'X' : 'T', conf: 78, type: 'ĐẢO',
                     desc: `Đảo 1-1 - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    }

    // ═══════════════════════════════════════
    // 3. CẦU ĐẢO 2-2
    // ═══════════════════════════════════════
    if (str.endsWith('TTXX')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO TÀI' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO XỈU' });
    }

    // ═══════════════════════════════════════
    // 4. HỒI CẦU THEO TỔNG ĐIỂM
    // ═══════════════════════════════════════
    if (lastTong >= 17) {
        allCau.push({ name: 'HỒI CỰC ĐẠI', pred: 'X', conf: 92, type: 'HỒI', desc: `Tổng ${lastTong} CỰC CAO - HỒI XỈU` });
    } else if (lastTong <= 4) {
        allCau.push({ name: 'HỒI CỰC TIỂU', pred: 'T', conf: 92, type: 'HỒI', desc: `Tổng ${lastTong} CỰC THẤP - HỒI TÀI` });
    } else if (lastTong >= 15) {
        allCau.push({ name: 'HỒI CAO', pred: 'X', conf: 78, type: 'HỒI', desc: `Tổng ${lastTong} cao - VÀO XỈU` });
    } else if (lastTong <= 5) {
        allCau.push({ name: 'HỒI THẤP', pred: 'T', conf: 78, type: 'HỒI', desc: `Tổng ${lastTong} thấp - VÀO TÀI` });
    }

    // ═══════════════════════════════════════
    // 5. CẦU NHỊP 1-2-1
    // ═══════════════════════════════════════
    if (str.endsWith('TXXT')) {
        allCau.push({ name: 'NHỊP 1-2-1', pred: 'X', conf: 75, type: 'NHỊP', desc: 'Nhịp 1-2-1 (T-XX-T) - VÀO XỈU' });
    } else if (str.endsWith('XTTX')) {
        allCau.push({ name: 'NHỊP 1-2-1', pred: 'T', conf: 75, type: 'NHỊP', desc: 'Nhịp 1-2-1 (X-TT-X) - VÀO TÀI' });
    }

    // ═══════════════════════════════════════
    // 6. THỐNG KÊ NGHIÊNG
    // ═══════════════════════════════════════
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = history.length;

    if (total >= 8) {
        const tRate = tCount / total;
        if (tRate >= 0.7) {
            if (str.endsWith('TTT')) {
                allCau.push({ name: 'NGHIÊNG TÀI + BỆT', pred: 'T', conf: 75, type: 'NGHIÊNG', 
                             desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% + đang bệt - VÀO TÀI` });
            } else {
                allCau.push({ name: 'NGHIÊNG TÀI - BẺ', pred: 'X', conf: 62, type: 'NGHIÊNG', 
                             desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% - Bẻ cầu - VÀO XỈU` });
            }
        } else if (tRate <= 0.3) {
            if (str.endsWith('XXX')) {
                allCau.push({ name: 'NGHIÊNG XỈU + BỆT', pred: 'X', conf: 75, type: 'NGHIÊNG', 
                             desc: `Nghiêng Xỉu ${((1-tRate)*100).toFixed(0)}% + đang bệt - VÀO XỈU` });
            } else {
                allCau.push({ name: 'NGHIÊNG XỈU - BẺ', pred: 'T', conf: 62, type: 'NGHIÊNG', 
                             desc: `Nghiêng Xỉu ${((1-tRate)*100).toFixed(0)}% - Bẻ cầu - VÀO TÀI` });
            }
        }
    }

    // ═══════════════════════════════════════
    // SẮP XẾP & CHỌN CẦU MẠNH NHẤT
    // ═══════════════════════════════════════
    allCau.sort((a, b) => b.conf - a.conf);
    const best = allCau[0];

    if (best) {
        return {
            duDoan: best.pred,
            doTinCay: best.conf,
            tiLeThang: best.conf + '%',
            cau: best.desc,
            loaiCau: best.type,
            sucManh: best.conf >= 90 ? 'RẤT MẠNH' : best.conf >= 80 ? 'MẠNH' : best.conf >= 70 ? 'VỪA' : 'YẾU',
            tatCaCau: allCau.slice(0, 5),
            thongKe: { tong: total, tai: tCount, xiu: xCount,
                      tiLeTai: ((tCount/total)*100).toFixed(1) + '%',
                      tiLeXiu: ((xCount/total)*100).toFixed(1) + '%',
                      xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG' },
            loiKhuyen: best.conf >= 90 ? 'VÀO MẠNH TAY' : best.conf >= 80 ? 'VÀO VỪA' : best.conf >= 70 ? 'ĐÁNH NHỎ' : 'THĂM DÒ'
        };
    }

    // Không có cầu
    return {
        duDoan: lastResult === 'T' ? 'X' : 'T',
        doTinCay: 50,
        tiLeThang: '50%',
        cau: 'Cầu loạn - ĐÁNH NGƯỢC LẠI',
        loaiCau: 'ĐẢO NGƯỢC',
        sucManh: 'YẾU',
        tatCaCau: [],
        thongKe: { tong: total, tai: tCount, xiu: xCount,
                  tiLeTai: ((tCount/total)*100).toFixed(1) + '%',
                  tiLeXiu: ((xCount/total)*100).toFixed(1) + '%',
                  xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG' },
        loiKhuyen: 'THĂM DÒ NHẸ'
    };
}

// ─── KIỂM TRA DỰ ĐOÁN ĐÚNG/SAI ────────────────────────────────────────────
function checkPrediction(phien, ketQuaThucTe) {
    const prediction = predictionLog.find(p => p.phien_du_doan === phien);
    if (prediction) {
        prediction.ket_qua_thuc_te = ketQuaThucTe;
        prediction.dung = prediction.du_doan === ketQuaThucTe;
    }
}

// ─── ROUTES ────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sunwin AI - DỰ ĐOÁN TÀI XỈU</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0d1117;color:#fff;padding:10px}
.container{max-width:700px;margin:0 auto}
h1{text-align:center;font-size:1.4em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px}
.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}
.box.TAI{border:2px solid #f85149;box-shadow:0 0 15px rgba(248,81,73,0.3)}
.box.XIU{border:2px solid #3fb950;box-shadow:0 0 15px rgba(63,185,80,0.3)}
.big{font-size:1.8em;font-weight:bold}
.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}
.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:0.9em;font-weight:bold}
.btn:hover{background:#2ea043}
.btn2{background:transparent;border:1px solid #30363d}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7em;margin:1px;font-weight:bold}
.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}
.tag.HỒI{background:#d2991d;color:#000}.tag.NGHIÊNG{background:#3fb950;color:#000}
.tag.DUNG{background:#3fb950;color:#000}.tag.SAI{background:#da3633}
.loading{text-align:center;padding:20px;color:#8b949e}
pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:0.75em;max-height:200px;overflow-y:auto}
.highlight{background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;margin:4px 0}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
</style></head><body>
<div class="container">
<h1>🎯 SUNWIN AI - DỰ ĐOÁN TÀI XỈU</h1>
<p style="text-align:center;color:#8b949e;font-size:0.8em">DỰ ĐOÁN PHIÊN TIẾP THEO • KIỂM TRA ĐÚNG/SAI</p>
<div style="text-align:center;margin:10px 0">
<button class="btn" onclick="loadData()" style="animation:pulse 1.5s infinite">🎲 DỰ ĐOÁN NGAY</button>
<a href="/api/predict" class="btn btn2">📊 JSON</a>
<a href="/api/history" class="btn btn2">📜 Lịch Sử</a>
</div>
<div id="out"><div class="loading">⏳ Đang gọi Sunwin...</div></div>
</div>
<script>
async function loadData(){
    document.getElementById('out').innerHTML='<div class="loading">⏳ Đang tải & phân tích...</div>';
    try{
        const r=await fetch('/api/predict');
        const d=await r.json();
        const ps=d.phien_sap_toi||{};
        const dd=d.du_doan||{};
        const tk=d.thong_ke||{};
        const cau=d.cau_phat_hien||[];
        const log=d.lich_su_du_doan||[];
        
        document.getElementById('out').innerHTML=\`
<!-- PHIÊN SẮP TỚI + DỰ ĐOÁN -->
<div class="card" style="border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)">
<h3 style="text-align:center">📌 PHIÊN SẮP TỚI DỰ ĐOÁN</h3>
<div class="grid3">
<div class="box"><small>PHIÊN DỰ ĐOÁN</small><div class="big yellow">#\${ps.phien||'?'}</div></div>
<div class="box \${dd.ky_hieu==='T'?'TAI':'XIU'}"><small>DỰ ĐOÁN</small><div class="big \${dd.ky_hieu==='T'?'red':'green'}" style="font-size:2.5em">\${dd.du_doan||'?'}</div></div>
<div class="box"><small>TỈ LỆ THẮNG</small><div class="big yellow">\${dd.ti_le_thang||'?'}</div></div>
</div>
<div class="highlight" style="margin-top:8px">
<p>📊 <b>Cầu:</b> \${dd.cau||'?'} <span class="tag \${dd.loai_cau||''}">\${dd.loai_cau||'?'}</span></p>
<p>💪 Sức mạnh: <b>\${dd.suc_manh||'?'}</b> | 💡 <b>\${dd.loi_khuyen||'?'}</b></p>
</div>
</div>

<!-- PHIÊN TRƯỚC -->
<div class="card">
<h3>📍 PHIÊN TRƯỚC: #\${ps.phien_truoc||'?'} 
<span style="font-size:0.7em;color:#8b949e">\${ps.thoi_gian||''}</span></h3>
<div class="grid2">
<div class="box \${ps.ky_hieu_truoc==='T'?'TAI':'XIU'}">
<small>KẾT QUẢ</small>
<div class="big \${ps.ky_hieu_truoc==='T'?'red':'green'}">\${ps.ket_qua_truoc||'?'}</div>
<small>Tổng: \${ps.tong_truoc||'?'}</small>
</div>
<div class="box">
<small>XÚC XẮC</small>
<div class="big">\${(ps.xuc_xac_truoc||[]).join(' - ')||'?'}</div>
</div>
</div>
</div>

<!-- THỐNG KÊ -->
<div class="card">
<h3>📈 THỐNG KÊ \${tk.tong_phien||0} PHIÊN</h3>
<div class="grid2">
<div class="box"><small>TÀI</small><div class="big red">\${tk.tai||0}</div><small>\${tk.ti_le_tai||'0%'}</small></div>
<div class="box"><small>XỈU</small><div class="big green">\${tk.xiu||0}</div><small>\${tk.ti_le_xiu||'0%'}</small></div>
</div>
<p style="margin-top:6px">Xu hướng: <b>\${tk.xu_huong||'?'}</b></p>
</div>

<!-- TẤT CẢ CẦU -->
\${cau.length>0?\`
<div class="card"><h3>🔍 CẦU PHÁT HIỆN (\${cau.length})</h3>
\`+cau.map((c,i)=>'<p style="margin:3px 0;font-size:0.8em;padding:4px;background:rgba(255,255,255,0.02);border-radius:4px">'+(i+1)+'. <span class="tag '+c.type+'">'+c.type+'</span> <b>'+c.name+'</b> → <b style="color:'+(c.predict==='TÀI'?'#f85149':'#3fb950')+'">'+c.predict+'</b> ('+c.conf+')</p>').join('')+'
</div>\`:''}

<!-- LỊCH SỬ DỰ ĐOÁN + ĐÚNG/SAI -->
\${log.length>0?\`
<div class="card"><h3>📋 LỊCH SỬ DỰ ĐOÁN - KIỂM TRA ĐÚNG/SAI</h3>
<pre>PHIÊN     | DỰ ĐOÁN | KẾT QUẢ | ĐÚNG/SAI | TỈ LỆ
\${'─'.repeat(55)}
\${log.map(l=>{
    const kq=l.ket_qua_thuc_te||'ĐỢI...';
    const ds=l.dung===true?'✅ ĐÚNG':l.dung===false?'❌ SAI':'⏳ CHỜ';
    return '#'+l.phien_du_doan+' | '+l.du_doan_text+'    | '+kq+'      | '+ds+'   | '+l.ti_le;
}).join('\\n')}</pre>
</div>\`:''}

<!-- LỊCH SỬ PHIÊN -->
<div class="card"><h3>📜 10 PHIÊN GẦN NHẤT</h3>
<pre>${(d.lich_su_phien||[]).map(h=>'#'+h.phien+' | '+h.ket_qua+' (Tổng '+h.tong+') | '+h.xuc_xac.join(',')).join('\\n')}</pre></div>`;
    }catch(e){
        document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ LỖI</h3><p>'+e.message+'</p><button class="btn" onclick="loadData()">🔄 THỬ LẠI</button></div>';
    }
}
loadData();
setInterval(loadData, 30000);
</script></body></html>`);
});

app.get('/api/predict', async (req, res) => {
    try {
        let newData = null;
        
        // Gọi API Sunwin
        try {
            const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            newData = response.data;
        } catch (err) {}

        // Nếu có phiên mới
        if (newData && newData.phien) {
            const phien = parseInt(newData.phien);
            const tong = parseInt(newData.tong) || 0;
            const result = tong >= 11 ? 'T' : 'X';
            const resultText = tong >= 11 ? 'TÀI' : 'XỈU';
            
            // Check kết quả dự đoán trước đó
            checkPrediction(phien, resultText);
            
            // Thêm vào lịch sử
            const exists = sessionHistory.find(s => s.phien === phien);
            if (!exists) {
                sessionHistory.push({
                    phien: phien,
                    tong: tong,
                    result: result,
                    resultText: resultText,
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
        const phienTruoc = last ? last.phien : null;
        const phienDuDoan = last ? last.phien + 1 : null;

        // Lưu log dự đoán
        if (phienDuDoan && ketQua.duDoan) {
            const existPred = predictionLog.find(p => p.phien_du_doan === phienDuDoan);
            if (!existPred) {
                predictionLog.push({
                    phien_du_doan: phienDuDoan,
                    phien_truoc: phienTruoc,
                    du_doan: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
                    du_doan_text: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
                    ti_le: ketQua.tiLeThang,
                    cau: ketQua.cau,
                    ket_qua_thuc_te: null,
                    dung: null
                });
                if (predictionLog.length > 50) predictionLog = predictionLog.slice(-50);
            }
        }

        // Thống kê đúng/sai
        const dungCount = predictionLog.filter(p => p.dung === true).length;
        const saiCount = predictionLog.filter(p => p.dung === false).length;
        const tongDuDoan = dungCount + saiCount;
        const tiLeDung = tongDuDoan > 0 ? ((dungCount / tongDuDoan) * 100).toFixed(1) + '%' : 'N/A';

        res.json({
            status: 'success',
            api: newData ? '✅ KẾT NỐI' : '⚠️ DÙNG CACHE',
            
            // Phiên sắp tới (dự đoán)
            phien_sap_toi: {
                phien: phienDuDoan,
                phien_truoc: phienTruoc,
                ket_qua_truoc: last ? last.resultText : '?',
                ky_hieu_truoc: last ? last.result : '?',
                tong_truoc: last ? last.tong : '?',
                xuc_xac_truoc: last ? last.xuc_xac : [],
                thoi_gian: last ? last.thoi_gian : ''
            },
            
            // Dự đoán
            du_doan: {
                du_doan: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
                ky_hieu: ketQua.duDoan,
                ti_le_thang: ketQua.tiLeThang,
                do_tin_cay: ketQua.doTinCay + '%',
                cau: ketQua.cau,
                loai_cau: ketQua.loaiCau,
                suc_manh: ketQua.sucManh,
                loi_khuyen: ketQua.loiKhuyen
            },
            
            // Thống kê
            thong_ke: {
                tong_phien: ketQua.thongKe.tong,
                tai: ketQua.thongKe.tai,
                xiu: ketQua.thongKe.xiu,
                ti_le_tai: ketQua.thongKe.tiLeTai,
                ti_le_xiu: ketQua.thongKe.tiLeXiu,
                xu_huong: ketQua.thongKe.xuHuong,
                // Thống kê dự đoán
                tong_du_doan: tongDuDoan,
                dung: dungCount,
                sai: saiCount,
                ti_le_dung: tiLeDung
            },
            
            // Cầu phát hiện
            cau_phat_hien: ketQua.tatCaCau.map(c => ({
                name: c.name,
                type: c.type,
                predict: c.pred === 'T' ? 'TÀI' : 'XỈU',
                conf: c.conf + '%',
                desc: c.desc
            })),
            
            // Lịch sử dự đoán
            lich_su_du_doan: predictionLog.slice(-10).reverse().map(p => ({
                phien_du_doan: p.phien_du_doan,
                du_doan_text: p.du_doan_text,
                ti_le: p.ti_le,
                ket_qua_thuc_te: p.ket_qua_thuc_te || 'ĐỢI',
                dung: p.dung
            })),
            
            // Lịch sử phiên
            lich_su_phien: sessionHistory.slice(-10).reverse().map(s => ({
                phien: s.phien,
                ket_qua: s.resultText,
                ky_hieu: s.result,
                tong: s.tong,
                xuc_xac: s.xuc_xac
            }))
        });
        
    } catch (error) {
        res.json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/api/history', (req, res) => {
    res.json({
        tong_phien: sessionHistory.length,
        lich_su_phien: sessionHistory.slice(-30).reverse().map(s => ({
            phien: s.phien,
            ket_qua: s.resultText,
            tong: s.tong,
            xuc_xac: s.xuc_xac,
            thoi_gian: s.thoi_gian
        })),
        lich_su_du_doan: predictionLog.slice(-20).reverse().map(p => ({
            phien_du_doan: p.phien_du_doan,
            du_doan: p.du_doan_text,
            ti_le: p.ti_le,
            ket_qua: p.ket_qua_thuc_te || 'ĐỢI',
            dung: p.dung
        }))
    });
});

// ─── START ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('🌟 SUNWIN AI - DỰ ĐOÁN TÀI XỈU');
    console.log('🚀 http://localhost:' + PORT);
    console.log('✅ Phiên trước → Dự đoán phiên tiếp theo');
    console.log('✅ Kiểm tra đúng/sai tự động');
});
