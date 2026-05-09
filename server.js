const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 8080;

// ─── LƯU LỊCH SỬ ───────────────────────────────────────────────────────────
let sessionHistory = [];
const MAX_HISTORY = 50;

// ─── THUẬT TOÁN PHÂN TÍCH ──────────────────────────────────────────────────
function analyze(history) {
    // Nếu chưa có lịch sử
    if (!history || history.length === 0) {
        return {
            prediction: Math.random() > 0.5 ? 'T' : 'X',
            confidence: 50,
            pattern: 'Chưa có dữ liệu - Đợi thêm phiên',
            allPatterns: [],
            probability: { tCount: 0, xCount: 0, total: 0, tRate: '0', xRate: '0', trend: 'CHƯA ĐỦ DỮ LIỆU' },
            advice: 'CHỜ'
        };
    }

    // Nếu chỉ có 1 phiên
    if (history.length === 1) {
        const first = history[0];
        return {
            prediction: first.result === 'T' ? 'X' : 'T', // Ngược lại phiên đầu
            confidence: 40,
            pattern: 'Mới 1 phiên - Dự đoán ngược',
            allPatterns: [],
            probability: { 
                tCount: first.result === 'T' ? 1 : 0, 
                xCount: first.result === 'X' ? 1 : 0, 
                total: 1,
                tRate: first.result === 'T' ? '100' : '0',
                xRate: first.result === 'X' ? '100' : '0',
                trend: first.result === 'T' ? 'THIÊN TÀI' : 'THIÊN XỈU'
            },
            advice: 'THĂM DÒ'
        };
    }

    // Chuỗi T/X từ cũ → mới
    const str = history.map(h => h.result).join('');
    const last = history[history.length - 1];
    const lastResult = last.result;
    const lastTong = last.tong;
    
    const allResults = [];

    // === 1. KIỂM TRA BỆT ===
    if (str.endsWith('TTTTT')) {
        allResults.push({ type: 'BỆT TÀI', conf: 95, pred: 'T', desc: 'Bệt Tài 5+ phiên' });
    } else if (str.endsWith('XXXXX')) {
        allResults.push({ type: 'BỆT XỈU', conf: 95, pred: 'X', desc: 'Bệt Xỉu 5+ phiên' });
    } else if (str.endsWith('TTTT')) {
        allResults.push({ type: 'BỆT TÀI', conf: 85, pred: 'T', desc: 'Bệt Tài 4 phiên' });
    } else if (str.endsWith('XXXX')) {
        allResults.push({ type: 'BỆT XỈU', conf: 85, pred: 'X', desc: 'Bệt Xỉu 4 phiên' });
    } else if (str.endsWith('TTT')) {
        allResults.push({ type: 'BỆT TÀI', conf: 70, pred: 'T', desc: 'Bệt Tài 3 phiên' });
    } else if (str.endsWith('XXX')) {
        allResults.push({ type: 'BỆT XỈU', conf: 70, pred: 'X', desc: 'Bệt Xỉu 3 phiên' });
    }

    // === 2. CẦU ĐẢO 1-1 ===
    if (str.endsWith('TXTX') || str.endsWith('XTXT')) {
        allResults.push({ type: 'CẦU ĐẢO 1-1', conf: 85, pred: lastResult === 'T' ? 'X' : 'T', desc: 'Đảo 1-1' });
    }

    // === 3. CẦU ĐẢO 2-2 ===
    if (str.endsWith('TTXX')) {
        allResults.push({ type: 'CẦU ĐẢO 2-2', conf: 80, pred: 'T', desc: 'Đảo 2-2 (vào T)' });
    } else if (str.endsWith('XXTT')) {
        allResults.push({ type: 'CẦU ĐẢO 2-2', conf: 80, pred: 'X', desc: 'Đảo 2-2 (vào X)' });
    }

    // === 4. HỒI CẦU THEO TỔNG ===
    if (lastTong >= 17) {
        allResults.push({ type: 'HỒI CẦU', conf: 90, pred: 'X', desc: `Tổng ${lastTong} quá cao → Hồi Xỉu` });
    } else if (lastTong <= 4) {
        allResults.push({ type: 'HỒI CẦU', conf: 90, pred: 'T', desc: `Tổng ${lastTong} quá thấp → Hồi Tài` });
    } else if (lastTong >= 15) {
        allResults.push({ type: 'HỒI CẦU', conf: 75, pred: 'X', desc: `Tổng ${lastTong} cao → Khả năng Xỉu` });
    } else if (lastTong <= 5) {
        allResults.push({ type: 'HỒI CẦU', conf: 75, pred: 'T', desc: `Tổng ${lastTong} thấp → Khả năng Tài` });
    }

    // === 5. THỐNG KÊ ===
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = history.length;

    // === SẮP XẾP & CHỌN KẾT QUẢ TỐT NHẤT ===
    allResults.sort((a, b) => b.conf - a.conf);
    const best = allResults[0];

    let advice = 'THĂM DÒ';
    let finalPred = lastResult === 'T' ? 'X' : 'T'; // Mặc định đánh ngược
    let finalConf = 50;
    let finalPattern = 'Cầu loạn - Đánh ngược';
    let finalType = 'KHÔNG XÁC ĐỊNH';
    let finalStrength = 'UNKNOWN';

    if (best) {
        finalPred = best.pred;
        finalConf = best.conf;
        finalPattern = best.desc;
        finalType = best.type;
        finalStrength = best.conf >= 90 ? 'VERY STRONG' : best.conf >= 80 ? 'STRONG' : best.conf >= 70 ? 'MEDIUM' : 'LOW';
    }

    if (finalConf >= 90) advice = 'VÀO MẠNH';
    else if (finalConf >= 80) advice = 'VÀO VỪA';
    else if (finalConf >= 70) advice = 'ĐÁNH NHỎ';

    // Nếu thống kê quá lệch
    if (tCount >= total * 0.8) {
        finalPred = 'X';
        finalConf = Math.max(finalConf, 75);
        finalPattern = 'Tài quá nhiều → Sắp về Xỉu';
    } else if (xCount >= total * 0.8) {
        finalPred = 'T';
        finalConf = Math.max(finalConf, 75);
        finalPattern = 'Xỉu quá nhiều → Sắp về Tài';
    }

    return {
        prediction: finalPred,
        confidence: finalConf,
        pattern: finalPattern,
        patternType: finalType,
        strength: finalStrength,
        allPatterns: allResults.slice(0, 5),
        probability: {
            tCount, xCount, total,
            tRate: ((tCount / total) * 100).toFixed(1),
            xRate: ((xCount / total) * 100).toFixed(1),
            trend: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG'
        },
        advice
    };
}

// ─── API ENDPOINTS ──────────────────────────────────────────────────────────

// Endpoint chính: Gọi Sunwin + Phân tích
app.get('/api/predict', async (req, res) => {
    try {
        // Gọi API Sunwin
        const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
            timeout: 10000
        });
        
        const raw = response.data;
        
        // Parse kết quả: Dựa vào tổng điểm, không dùng text vì có thể lỗi unicode
        const tong = raw.tong || 0;
        const result = tong >= 11 ? 'T' : 'X';   // T = Tài, X = Xỉu
        const resultText = tong >= 11 ? 'Tài' : 'Xỉu';

        // Thêm vào lịch sử nếu phiên mới
        const exists = sessionHistory.find(s => s.phien === raw.phien);
        if (!exists) {
            sessionHistory.push({
                phien: raw.phien,
                tong: tong,
                result: result,
                xuc_xac: [raw.xuc_xac_1, raw.xuc_xac_2, raw.xuc_xac_3],
                thoi_gian: raw.thoi_gian
            });
            
            // Giới hạn lịch sử
            if (sessionHistory.length > MAX_HISTORY) {
                sessionHistory = sessionHistory.slice(-MAX_HISTORY);
            }
        }

        // Phân tích
        const prediction = analyze(sessionHistory);

        // Trả kết quả
        res.json({
            status: "success",
            current: {
                phien: raw.phien,
                ket_qua: resultText,
                ky_hieu: result,
                tong: tong,
                xuc_xac: [raw.xuc_xac_1, raw.xuc_xac_2, raw.xuc_xac_3],
                thoi_gian: raw.thoi_gian
            },
            prediction: {
                next_bet: prediction.prediction === 'T' ? 'TÀI' : 'XỈU',
                ky_hieu: prediction.prediction,
                confidence: prediction.confidence + '%',
                pattern: prediction.pattern,
                type: prediction.patternType,
                strength: prediction.strength,
                advice: prediction.advice
            },
            stats: {
                stored: sessionHistory.length,
                ...prediction.probability
            },
            recent: sessionHistory.slice(-10).reverse().map(s => ({
                phien: s.phien,
                result: s.result === 'T' ? 'Tài' : 'Xỉu',
                tong: s.tong,
                xuc_xac: s.xuc_xac
            }))
        });

    } catch (error) {
        // Nếu có lịch sử cũ, vẫn phân tích được
        if (sessionHistory.length > 0) {
            const prediction = analyze(sessionHistory);
            return res.json({
                status: "warning",
                message: "Không lấy được phiên mới từ Sunwin, dùng lịch sử cũ",
                prediction: {
                    next_bet: prediction.prediction === 'T' ? 'TÀI' : 'XỈU',
                    ky_hieu: prediction.prediction,
                    confidence: prediction.confidence + '%',
                    pattern: prediction.pattern,
                    advice: prediction.advice
                },
                stored_sessions: sessionHistory.length
            });
        }

        res.status(500).json({
            status: "error",
            message: "Không kết nối được Sunwin và chưa có lịch sử",
            error: error.message
        });
    }
});

// Xem lịch sử
app.get('/api/history', (req, res) => {
    res.json({
        total: sessionHistory.length,
        data: sessionHistory.slice(-20).reverse().map(s => ({
            phien: s.phien,
            result: s.result === 'T' ? 'Tài' : 'Xỉu',
            ky_hieu: s.result,
            tong: s.tong,
            xuc_xac: s.xuc_xac,
            thoi_gian: s.thoi_gian
        }))
    });
});

// Dashboard
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sunwin AI</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui;background:#0d1117;color:#c9d1d9;padding:20px}
.container{max-width:600px;margin:0 auto}
h1{text-align:center;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:1.8em;margin:15px 0}
.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:15px;margin:10px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.box{padding:12px;border-radius:8px;text-align:center;background:#1c2128}
.box.T{border:2px solid #f85149}.box.X{border:2px solid #3fb950}
.big{font-size:2em;font-weight:bold}
.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}
.btn{display:inline-block;padding:10px 25px;background:#238636;color:#fff;text-decoration:none;border-radius:6px;margin:5px;border:none;cursor:pointer;font-size:1em}
.btn:hover{background:#2ea043}
.btn2{background:transparent;border:1px solid #30363d}
.btn2:hover{background:#1c2128}
pre{background:#0d1117;padding:10px;border-radius:6px;overflow-x:auto;font-size:.8em}
.loading{text-align:center;padding:20px;color:#8b949e}
</style>
</head><body>
<div class="container">
<h1>🎯 Sunwin Tài Xỉu AI</h1>
<div style="text-align:center;margin:15px 0">
<button class="btn" onclick="load()">🎲 DỰ ĐOÁN</button>
<button class="btn btn2" onclick="window.open('/api/history')">📊 Lịch Sử</button>
</div>
<div id="out"><div class="loading">⏳ Đang tải...</div></div>
<div class="card" style="margin-top:15px">
<h3>📐 Quy tắc:</h3>
<p>Tổng 3 xúc xắc <b>≥ 11</b> → <span class="red">TÀI (T)</span></p>
<p>Tổng 3 xúc xắc <b>≤ 10</b> → <span class="green">XỈU (X)</span></p>
</div>
</div>
<script>
async function load(){
    document.getElementById('out').innerHTML='<div class="loading">⏳ Đang gọi Sunwin...</div>';
    try{
        const r=await fetch('/api/predict');
        const d=await r.json();
        if(d.status==='success'||d.status==='warning'){
            const c=d.current||{};
            const p=d.prediction||{};
            const s=d.stats||{};
            document.getElementById('out').innerHTML=\`
<div class="card">${c.phien?'<h3>📍 Phiên #'+c.phien+'</h3>':''}
<div class="grid2">
<div class="box ${c.ky_hieu==='T'?'T':'X'}"><small>KẾT QUẢ</small><div class="big ${c.ky_hieu==='T'?'red':'green'}">${c.ket_qua||'?'}</div><small>Tổng: ${c.tong||'?'}</small></div>
<div class="box"><small>XÚC XẮC</small><div class="big">${(c.xuc_xac||[]).join('-')||'?'}</div></div>
</div></div>
<div class="card" style="border-left:4px solid ${p.ky_hieu==='T'?'#f85149':'#3fb950'}">
<h3>🔮 DỰ ĐOÁN TIẾP THEO</h3>
<div class="grid3">
<div class="box ${p.ky_hieu==='T'?'T':'X'}"><small>DỰ ĐOÁN</small><div class="big ${p.ky_hieu==='T'?'red':'green'}">${p.next_bet||'?'}</div></div>
<div class="box"><small>ĐỘ TIN</small><div class="big yellow">${p.confidence||'?'}</div></div>
<div class="box"><small>KHUYÊN</small><div class="big" style="font-size:1.2em">${p.advice||'?'}</div></div>
</div>
<p>📊 Cầu: <b>${p.pattern||'?'}</b> (${p.strength||'?'})</p>
</div>
<div class="card"><h3>📈 Thống kê ${s.stored||0} phiên</h3>
<p>Tài: ${s.tCount||0} (${s.tRate||0}%) | Xỉu: ${s.xCount||0} (${s.xRate||0}%) | Xu hướng: <b>${s.trend||'?'}</b></p></div>
${d.recent?`<div class="card"><h3>📜 Gần đây</h3><pre>${d.recent.map(h=>'#'+h.phien+' | '+h.result+' ('+h.tong+') | '+h.xuc_xac.join(',')).join('\\n')}</pre></div>`:''}`;
        }else{
            document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ Lỗi</h3><p>'+d.message+'</p></div>';
        }
    }catch(e){
        document.getElementById('out').innerHTML='<div class="card" style="border:1px solid #f85149"><h3 style="color:#f85149">❌ Lỗi</h3><p>'+e.message+'</p></div>';
    }
}
load();
setInterval(load,30000);
</script></body></html>`);
});

// ─── START SERVER ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('🌟══════════════════════════🌟');
    console.log('  🎯 SUNWIN TÀI XỈU AI');
    console.log('🌟══════════════════════════🌟');
    console.log(`  🚀 http://localhost:${PORT}`);
    console.log(`  🎲 /api/predict`);
    console.log(`  📊 /api/history`);
    console.log('  📐 Tổng >= 11 → TÀI (T)');
    console.log('  📐 Tổng <= 10 → XỈU (X)');
    console.log('🌟══════════════════════════🌟');
});
