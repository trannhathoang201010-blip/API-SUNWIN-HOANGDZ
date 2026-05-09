const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

// ─── LƯU LỊCH SỬ ───────────────────────────────────────────────────────────
let sessionHistory = [];
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
        allCau.push({ name: 'ĐẢO 1-1 NGẮN', pred: lastResult === 'T' ? 'X' : 'T', conf: 78, type: 'ĐẢO',
                     desc: `Đảo 1-1 - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
    }

    // ═══════════════════════════════════════
    // 3. CẦU ĐẢO 2-2
    // ═══════════════════════════════════════
    if (str.endsWith('TTXXTT')) {
        allCau.push({ name: 'ĐẢO 2-2 DÀI', pred: 'X', conf: 85, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO XỈU' });
    } else if (str.endsWith('XXTTXX')) {
        allCau.push({ name: 'ĐẢO 2-2 DÀI', pred: 'T', conf: 85, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO TÀI' });
    } else if (str.endsWith('TTXX')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO TÀI' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO XỈU' });
    }

    // ═══════════════════════════════════════
    // 4. CẦU ĐẢO 3-3
    // ═══════════════════════════════════════
    if (str.endsWith('TTTXXX')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'T', conf: 78, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO TÀI' });
    } else if (str.endsWith('XXXTTT')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'X', conf: 78, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO XỈU' });
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
    // 6. CẦU NHỊP 2-1-2
    // ═══════════════════════════════════════
    if (str.endsWith('TTXTT')) {
        allCau.push({ name: 'NHỊP 2-1-2', pred: 'X', conf: 72, type: 'NHỊP', desc: 'Nhịp 2-1-2 (TT-X-TT) - VÀO XỈU' });
    } else if (str.endsWith('XXTXX')) {
        allCau.push({ name: 'NHỊP 2-1-2', pred: 'T', conf: 72, type: 'NHỊP', desc: 'Nhịp 2-1-2 (XX-T-XX) - VÀO TÀI' });
    }

    // ═══════════════════════════════════════
    // 7. CẦU 3-2-1
    // ═══════════════════════════════════════
    if (str.endsWith('TTTXXT')) {
        allCau.push({ name: '3-2-1', pred: 'X', conf: 70, type: 'NHỊP', desc: 'Nhịp 3-2-1 - VÀO XỈU' });
    } else if (str.endsWith('XXXTTX')) {
        allCau.push({ name: '3-2-1', pred: 'T', conf: 70, type: 'NHỊP', desc: 'Nhịp 3-2-1 - VÀO TÀI' });
    }

    // ═══════════════════════════════════════
    // 8. HỒI CẦU THEO TỔNG ĐIỂM
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
    // 9. CẦU BẬC THANG
    // ═══════════════════════════════════════
    if (str.endsWith('TTXXX')) {
        allCau.push({ name: 'BẬC THANG', pred: 'X', conf: 70, type: 'NHỊP', desc: 'Bậc thang TT-XXX - VÀO XỈU' });
    } else if (str.endsWith('XXTTT')) {
        allCau.push({ name: 'BẬC THANG', pred: 'T', conf: 70, type: 'NHỊP', desc: 'Bậc thang XX-TTT - VÀO TÀI' });
    }

    // ═══════════════════════════════════════
    // 10. THỐNG KÊ NGHIÊNG
    // ═══════════════════════════════════════
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = history.length;

    if (total >= 8) {
        const tRate = tCount / total;
        if (tRate >= 0.75) {
            if (str.endsWith('TTT')) {
                allCau.push({ name: 'NGHIÊNG TÀI + BỆT', pred: 'T', conf: 75, type: 'NGHIÊNG', 
                             desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% + đang bệt - VÀO TÀI` });
            } else {
                allCau.push({ name: 'NGHIÊNG TÀI - BẺ', pred: 'X', conf: 62, type: 'NGHIÊNG', 
                             desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% - Bẻ cầu - VÀO XỈU` });
            }
        } else if (tRate <= 0.25) {
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

    // Không có cầu -> Đánh ngược
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

// ─── ROUTES ────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sunwin AI - DỰ ĐOÁN</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0d1117;color:#fff;padding:10px}
.container{max-width:650px;margin:0 auto}
h1{text-align:center;font-size:1.4em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}
.box.T{border:2px solid #f85149;box-shadow:0 0 15px rgba(248,81,73,0.3)}
.box.X{border:2px solid #3fb950;box-shadow:0 0 15px rgba(63,185,80,0.3)}
.big{font-size:1.8em;font-weight:bold}
.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}
.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:0.9em;font-weight:bold}
.btn:hover{background:#2ea043}
.btn2{background:transparent;border:1px solid #30363d}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7em;margin:1px;font-weight:bold}
.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}
.tag.HỒI{background:#d2991d;color:#000}.tag.NGHIÊNG{background:#3fb950;color:#000}
.loading{text-align:center;padding:20px;color:#8b949e}
pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:0.75em;max-height:200px;overflow-y:auto}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
</style></head><body>
<div class="container">
<h1>🎯 SUNWIN AI DỰ ĐOÁN</h1>
<p style="text-align:center;color:#8b949e;font-size:0.8em">DỰ ĐOÁN PHIÊN TIẾP THEO • 10 LOẠI CẦU</p>
<div style="text-align:center;margin:10px 0">
<button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DỰ ĐOÁN NGAY</button>
<a href="/api/predict" class="btn btn2">📊 JSON</a>
<a href="/api/history" class="btn btn2">📜 Lịch Sử</a>
</div>
<div id="out"><div class="loading">⏳ Đang gọi Sunwin & phân tích cầu...</div></div>
</div>
<script>
async function load(){
    document.getElementById('out').innerHTML='<div class="loading">⏳ Đang tải dữ liệu...</div>';
    try{
        const r=await fetch('/api/predict');
        const d=await r.json();
        const ht=d.current_session||{};
        const dd=d.prediction||{};
        const tk=d.statistics||{};
        const cau=d.detected_patterns||[];
        
        document.getElementById('out').innerHTML=\`
<div class="card">
<h3>📍 PHIÊN HIỆN TẠI: #${ht.phien||'?'} 
<span style="font-size:0.7em;color:#8b949e">${ht.thoi_gian||''}</span></h3>
<div class="grid2">
<div class="box ${ht.ky_hieu==='T'?'T':'X'}">
<small>KẾT QUẢ</small>
<div class="big ${ht.ky_hieu==='T'?'red':'green'}">${ht.ket_qua_text||'?'}</div>
<small>Tổng: ${ht.tong_diem||'?'}</small>
</div>
<div class="box">
<small>XÚC XẮC</small>
<div class="big">${(ht.xuc_xac||[]).join(' - ')||'?'}</div>
</div>
</div>
</div>

<div class="card" style="border-left:5px solid ${dd.ky_hieu==='T'?'#f85149':'#3fb950'};background:linear-gradient(135deg,#161b22,#${dd.ky_hieu==='T'?'3d1a1a':'1a3d1a'})">
<h2 style="text-align:center;margin:5px 0">🔮 DỰ ĐOÁN PHIÊN TIẾP THEO</h2>
<h3 style="text-align:center;color:#8b949e;font-size:1em">PHIÊN #${dd.phien_du_doan||'?'}</h3>
<div class="grid3">
<div class="box ${dd.ky_hieu==='T'?'T':'X'}">
<small>DỰ ĐOÁN</small>
<div class="big ${dd.ky_hieu==='T'?'red':'green'}" style="font-size:2.5em">${dd.du_doan||'?'}</div>
</div>
<div class="box">
<small>TỈ LỆ THẮNG</small>
<div class="big yellow">${dd.ti_le_thang||'?'}</div>
</div>
<div class="box">
<small>LỜI KHUYÊN</small>
<div class="big" style="font-size:1.1em">${dd.loi_khuyen||'?'}</div>
</div>
</div>
<div style="margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px">
<p>📊 <b>Cầu phát hiện:</b> ${dd.cau_phat_hien||'?'}</p>
<p>🏷️ Loại: <span class="tag ${dd.loai_cau||''}">${dd.loai_cau||'?'}</span> | Sức mạnh: <b>${dd.suc_manh||'?'}</b></p>
</div>
</div>

<div class="card">
<h3>📈 THỐNG KÊ ${tk.total_sessions||0} PHIÊN</h3>
<div class="grid2">
<div class="box"><small>TÀI</small><div class="big red">${tk.tai_count||0}</div><small>${tk.tai_rate||'0%'}</small></div>
<div class="box"><small>XỈU</small><div class="big green">${tk.xiu_count||0}</div><small>${tk.xiu_rate||'0%'}</small></div>
</div>
<p style="margin-top:6px">Xu hướng: <b>${tk.trend||'?'}</b></p>
</div>

${cau.length>0?\`
<div class="card">
<h3>🔍 TẤT CẢ CẦU PHÁT HIỆN (${cau.length})</h3>
\`+cau.map((c,i)=>'<p style="margin:3px 0;font-size:0.8em;padding:4px;background:rgba(255,255,255,0.02);border-radius:4px">'+(i+1)+'. <span class="tag '+c.type+'">'+c.type+'</span> <b>'+c.name+'</b> → <b style="color:'+(c.predict==='TÀI'?'#f85149':'#3fb950')+'">'+c.predict+'</b> ('+c.conf+')<br><span style="color:#8b949e">'+c.desc+'</span></p>').join('')+'
</div>\`:''}

${d.recent_history?\`
<div class="card">
<h3>📜 10 PHIÊN GẦN NHẤT</h3>
<pre>${d.recent_history.map(h=>'#'+h.phien+' | '+h.result+' (Tổng '+h.tong+') | Xúc xắc: '+h.xuc_xac.join(',')).join('\\n')}</pre>
</div>\`:''}`;
    }catch(e){
        document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ LỖI</h3><p>'+e.message+'</p><button class="btn" onclick="load()">🔄 THỬ LẠI</button></div>';
    }
}
load();
setInterval(load, 30000);
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
        } catch (err) {
            // Không lấy được API
        }

        // Nếu có dữ liệu mới, thêm vào lịch sử
        if (newData && newData.phien) {
            const tong = newData.tong || 0;
            const result = tong >= 11 ? 'T' : 'X';
            const resultText = tong >= 11 ? 'TÀI' : 'XỈU';
            
            const exists = sessionHistory.find(s => s.phien === newData.phien);
            if (!exists) {
                sessionHistory.push({
                    phien: newData.phien,
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
        
        // Tính phiên dự đoán = phiên hiện tại + 1
        const phienDuDoan = last ? last.phien + 1 : null;

        res.json({
            status: 'success',
            api_status: newData ? 'CONNECTED' : 'USING_CACHED_DATA',
            
            // Phiên hiện tại từ API
            current_session: last ? {
                phien: last.phien,
                ket_qua_text: last.resultText,
                ky_hieu: last.result,
                tong_diem: last.tong,
                xuc_xac: last.xuc_xac,
                thoi_gian: last.thoi_gian
            } : null,
            
            // DỰ ĐOÁN PHIÊN TIẾP THEO
            prediction: {
                phien_du_doan: phienDuDoan,
                du_doan: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
                ky_hieu: ketQua.duDoan,
                ti_le_thang: ketQua.tiLeThang,
                do_tin_cay: ketQua.doTinCay + '%',
                cau_phat_hien: ketQua.cau,
                loai_cau: ketQua.loaiCau,
                suc_manh: ketQua.sucManh,
                loi_khuyen: ketQua.loiKhuyen
            },
            
            // Thống kê
            statistics: {
                total_sessions: ketQua.thongKe.tong,
                tai_count: ketQua.thongKe.tai,
                xiu_count: ketQua.thongKe.xiu,
                tai_rate: ketQua.thongKe.tiLeTai,
                xiu_rate: ketQua.thongKe.tiLeXiu,
                trend: ketQua.thongKe.xuHuong
            },
            
            // Tất cả cầu phát hiện
            detected_patterns: ketQua.tatCaCau.map(c => ({
                name: c.name,
                type: c.type,
                predict: c.pred === 'T' ? 'TÀI' : 'XỈU',
                conf: c.conf + '%',
                desc: c.desc
            })),
            
            // Lịch sử gần đây
            recent_history: sessionHistory.slice(-10).reverse().map(s => ({
                phien: s.phien,
                result: s.resultText,
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
        total_sessions: sessionHistory.length,
        data: sessionHistory.slice(-20).reverse().map(s => ({
            phien: s.phien,
            result: s.resultText,
            ky_hieu: s.result,
            tong: s.tong,
            xuc_xac: s.xuc_xac,
            thoi_gian: s.thoi_gian
        }))
    });
});

// ─── START SERVER ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('🌟 SUNWIN AI - DỰ ĐOÁN TÀI XỈU 🌟');
    console.log('🚀 Server: http://localhost:' + PORT);
    console.log('🎲 API Dự đoán: /api/predict');
    console.log('📊 Lịch sử: /api/history');
    console.log('✅ Sẵn sàng dự đoán!');
});
