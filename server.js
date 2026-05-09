const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX_HISTORY = 200;

function analyzeFull(history) {
    if (!history || history.length === 0) {
        return {
            duDoan: 'T', doTinCay: 30, tiLeThang: '30%',
            cauChinh: 'Chua co du lieu - Mac dinh TAI',
            loaiCau: 'MAC DINH', sucManh: 'YEU', tatCaCau: [],
            thongKe: { tong: 0, tai: 0, xiu: 0, tiLeTai: '0%', tiLeXiu: '0%', xuHuong: 'CHUA RO' },
            loiKhuyen: 'CHO THEM DU LIEU', diemManh: 0
        };
    }

    const str = history.map(h => h.result).join('');
    const last = history[history.length - 1];
    const lastResult = last.result;
    const lastTong = last.tong;
    const allCau = [];

    // 1. BET
    if (str.endsWith('TTTTT')) {
        allCau.push({ name: 'BET TAI 5', pred: 'T', conf: 95, type: 'BET', desc: 'Bet Tai 5 phien - VAO TAI' });
    } else if (str.endsWith('XXXXX')) {
        allCau.push({ name: 'BET XIU 5', pred: 'X', conf: 95, type: 'BET', desc: 'Bet Xiu 5 phien - VAO XIU' });
    } else if (str.endsWith('TTTT')) {
        allCau.push({ name: 'BET TAI 4', pred: 'T', conf: 88, type: 'BET', desc: 'Bet Tai 4 phien - VAO TAI' });
    } else if (str.endsWith('XXXX')) {
        allCau.push({ name: 'BET XIU 4', pred: 'X', conf: 88, type: 'BET', desc: 'Bet Xiu 4 phien - VAO XIU' });
    } else if (str.endsWith('TTT')) {
        allCau.push({ name: 'BET TAI 3', pred: 'T', conf: 75, type: 'BET', desc: 'Bet Tai 3 phien - VAO TAI' });
    } else if (str.endsWith('XXX')) {
        allCau.push({ name: 'BET XIU 3', pred: 'X', conf: 75, type: 'BET', desc: 'Bet Xiu 3 phien - VAO XIU' });
    }

    // 2. DAO 1-1
    if (str.endsWith('TXTXTX') || str.endsWith('XTXTXT')) {
        allCau.push({ name: 'DAO 1-1 DAI', pred: lastResult === 'T' ? 'X' : 'T', conf: 90, type: 'DAO', desc: 'Dao 1-1 dai' });
    } else if (str.endsWith('TXTX') || str.endsWith('XTXT')) {
        allCau.push({ name: 'DAO 1-1', pred: lastResult === 'T' ? 'X' : 'T', conf: 80, type: 'DAO', desc: 'Dao 1-1' });
    }

    // 3. DAO 2-2
    if (str.endsWith('TTXX')) {
        allCau.push({ name: 'DAO 2-2', pred: 'T', conf: 80, type: 'DAO', desc: 'Dao 2-2 - VAO TAI' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'DAO 2-2', pred: 'X', conf: 80, type: 'DAO', desc: 'Dao 2-2 - VAO XIU' });
    }

    // 4. HOI CAU
    if (lastTong >= 17) {
        allCau.push({ name: 'HOI CUC DAI', pred: 'X', conf: 92, type: 'HOI', desc: 'Tong ' + lastTong + ' cuc cao - HOI XIU' });
    } else if (lastTong <= 4) {
        allCau.push({ name: 'HOI CUC TIEU', pred: 'T', conf: 92, type: 'HOI', desc: 'Tong ' + lastTong + ' cuc thap - HOI TAI' });
    } else if (lastTong >= 15) {
        allCau.push({ name: 'HOI CAO', pred: 'X', conf: 78, type: 'HOI', desc: 'Tong ' + lastTong + ' cao - VAO XIU' });
    } else if (lastTong <= 5) {
        allCau.push({ name: 'HOI THAP', pred: 'T', conf: 78, type: 'HOI', desc: 'Tong ' + lastTong + ' thap - VAO TAI' });
    }

    // 5. NHIP 1-2-1
    if (str.endsWith('TXXT')) {
        allCau.push({ name: 'NHIP 1-2-1', pred: 'X', conf: 75, type: 'NHIP', desc: 'Nhip T-XX-T - VAO XIU' });
    } else if (str.endsWith('XTTX')) {
        allCau.push({ name: 'NHIP 1-2-1', pred: 'T', conf: 75, type: 'NHIP', desc: 'Nhip X-TT-X - VAO TAI' });
    }

    // 6. THONG KE
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = history.length;

    if (total >= 8) {
        const tRate = tCount / total;
        if (tRate >= 0.7) {
            if (str.endsWith('TTT')) {
                allCau.push({ name: 'NGHIENG TAI + BET', pred: 'T', conf: 75, type: 'NGHIENG', desc: 'Nghieng Tai ' + (tRate*100).toFixed(0) + '% + dang bet - VAO TAI' });
            } else {
                allCau.push({ name: 'NGHIENG TAI - BE', pred: 'X', conf: 62, type: 'NGHIENG', desc: 'Nghieng Tai ' + (tRate*100).toFixed(0) + '% - Be cau - VAO XIU' });
            }
        } else if (tRate <= 0.3) {
            if (str.endsWith('XXX')) {
                allCau.push({ name: 'NGHIENG XIU + BET', pred: 'X', conf: 75, type: 'NGHIENG', desc: 'Nghieng Xiu ' + ((1-tRate)*100).toFixed(0) + '% + dang bet - VAO XIU' });
            } else {
                allCau.push({ name: 'NGHIENG XIU - BE', pred: 'T', conf: 62, type: 'NGHIENG', desc: 'Nghieng Xiu ' + ((1-tRate)*100).toFixed(0) + '% - Be cau - VAO TAI' });
            }
        }
    }

    allCau.sort((a, b) => b.conf - a.conf);
    const best = allCau[0];

    if (best) {
        return {
            duDoan: best.pred, doTinCay: best.conf, tiLeThang: best.conf + '%',
            cauChinh: best.desc, loaiCau: best.type,
            sucManh: best.conf >= 90 ? 'RAT MANH' : best.conf >= 75 ? 'MANH' : 'VUA',
            tatCaCau: allCau.slice(0, 5),
            thongKe: { tong: total, tai: tCount, xiu: xCount, tiLeTai: ((tCount/total)*100).toFixed(1)+'%', tiLeXiu: ((xCount/total)*100).toFixed(1)+'%', xuHuong: tCount > xCount ? 'THIEN TAI' : xCount > tCount ? 'THIEN XIU' : 'CAN BANG' },
            loiKhuyen: best.conf >= 90 ? 'VAO MANH' : best.conf >= 75 ? 'VAO VUA' : 'THAM DO',
            diemManh: best.conf
        };
    }

    return {
        duDoan: lastResult === 'T' ? 'X' : 'T', doTinCay: 50, tiLeThang: '50%',
        cauChinh: 'Cau loan - DANH NGUOC', loaiCau: 'DAO NGUOC', sucManh: 'YEU', tatCaCau: [],
        thongKe: { tong: total, tai: tCount, xiu: xCount, tiLeTai: ((tCount/total)*100).toFixed(1)+'%', tiLeXiu: ((xCount/total)*100).toFixed(1)+'%', xuHuong: tCount > xCount ? 'THIEN TAI' : 'CAN BANG' },
        loiKhuyen: 'THAM DO', diemManh: 0
    };
}

function checkPrediction(phien, ketQua) {
    const pred = predictionLog.find(p => p.phienDuDoan === phien);
    if (pred && pred.ketQuaThucTe === null) {
        pred.ketQuaThucTe = ketQua;
        pred.dung = pred.duDoan === ketQua;
    }
}

app.get('/', (req, res) => {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0d1117;color:#fff;padding:10px}.container{max-width:650px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:10px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149;box-shadow:0 0 15px rgba(248,81,73,0.3)}.box.XIU{border:2px solid #3fb950;box-shadow:0 0 15px rgba(63,185,80,0.3)}.big{font-size:1.8em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:.9em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BET{background:#da3633}.tag.DAO{background:#1f6feb}.tag.NHIP{background:#8957e5}.tag.HOI{background:#d2991d;color:#000}.tag.NGHIENG{background:#3fb950;color:#000}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI</h1><p style="text-align:center;color:#8b949e;font-size:.8em">PHIEN TRUOC → DU DOAN PHIEN TIEP THEO</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DU DOAN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SU</a></div><div id="out"><div class="loading">⏳ Dang tai...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Dang phan tich...</div>";try{let r=await fetch("/api/predict"),d=await r.json(),p=d.current||{},dd=d.prediction||{},tk=d.stats||{},cau=d.patterns||[],log=d.pred_log||[];document.getElementById("out").innerHTML='<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center>📌 DU DOAN PHIEN TIEP THEO</h3><div class=grid3><div class=box><small>PHIEN</small><div class="big yellow">#'+dd.phien_du_doan+"</div></div><div class=\"box "+(dd.ky_hieu=="T"?"TAI":"XIU")+'"><small>DU DOAN</small><div class=big style=font-size:2.5em;color:'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+">"+dd.du_doan+"</div></div><div class=box><small>TI LE THANG</small><div class=\"big yellow\">"+dd.ti_le_thang+"</div></div></div><div style=margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px><p>📊 <b>"+dd.cau+'</b> <span class="tag '+dd.loai_cau+'">'+dd.loai_cau+"</span></p><p>💪 Suc manh: <b>"+dd.suc_manh+"</b> | 💡 <b>"+dd.loi_khuyen+"</b></p></div></div><div class=card><h3>📍 PHIEN TRUOC: #"+p.phien_truoc+'</h3><div class=grid2><div class="box '+(p.ky_hieu_truoc=="T"?"TAI":"XIU")+'"><small>KET QUA</small><div class=big style=color:'+(p.ky_hieu_truoc=="T"?"#f85149":"#3fb950")+">"+p.ket_qua_truoc+"</div><small>Tong: "+p.tong_truoc+"</small></div><div class=box><small>XUC XAC</small><div class=big>"+(p.xuc_xac_truoc||[]).join(" - ")+"</div></div></div></div><div class=card><h3>📈 THONG KE "+tk.tong_phien+" PHIEN</h3><div class=grid2><div class=box><small>TAI</small><div class="big red">'+tk.tai+'</div><small>'+tk.ti_le_tai+'</small></div><div class=box><small>XIU</small><div class="big green">'+tk.xiu+'</div><small>'+tk.ti_le_xiu+'</small></div></div><p>Xu huong: <b>'+tk.xu_huong+'</b> | Du doan dung: <b>'+tk.ti_le_dung+'</b> ('+tk.dung+'/'+(tk.dung+tk.sai)+')</p></div>'+(cau.length>0?'<div class=card><h3>🔍 CAU PHAT HIEN ('+cau.length+')</h3>'+cau.map((c,i)=>"<p style=margin:3px 0;font-size:.8em;padding:4px;background:rgba(255,255,255,0.02);border-radius:4px>"+(i+1)+'. <span class="tag '+c.type+'">'+c.type+'</span> <b>'+c.name+'</b> → <b style=color:'+(c.predict=="TAI"?"#f85149":"#3fb950")+'>"+c.predict+"</b> ("+c.conf+")<br><span style=color:#8b949e>"+c.desc+"</span></p>").join("")+"</div>":"")+(log.length>0?'<div class=card><h3>📋 LICH SU DU DOAN</h3><pre>'+log.map(l=>"#"+l.phien+" | DD: "+l.du_doan+" | KQ: "+(l.ket_qua||"DOI")+" | "+(l.dung===true?"✅ DUNG":l.dung===false?"❌ SAI":"⏳ CHO")+" | "+l.ti_le).join("\\n")+"</pre></div>":"")+(d.recent?'<div class=card><h3>📜 15 PHIEN GAN NHAT</h3><pre>'+d.recent.map(h=>"#"+h.phien+" | "+h.ket_qua+" ("+h.tong+") | "+h.xuc_xac.join(",")).join("\\n")+"</pre></div>":"")}catch(e){document.getElementById("out").innerHTML='<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LOI</h3><p>'+e.message+'</p><button class=btn onclick=load()>🔄 THU LAI</button></div>'}}load();setInterval(load,30000);</script></body></html>');
});

app.get('/api/predict', async (req, res) => {
    try {
        let newData = null;
        try {
            const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            newData = response.data;
        } catch (err) {}

        if (newData && newData.phien) {
            const phien = parseInt(newData.phien);
            const tong = parseInt(newData.tong) || 0;
            const result = tong >= 11 ? 'T' : 'X';
            const resultText = tong >= 11 ? 'TAI' : 'XIU';
            
            checkPrediction(phien, resultText);
            
            const exists = sessionHistory.find(s => s.phien === phien);
            if (!exists) {
                sessionHistory.push({
                    phien: phien, tong: tong, result: result, resultText: resultText,
                    xuc_xac: [newData.xuc_xac_1, newData.xuc_xac_2, newData.xuc_xac_3],
                    thoi_gian: newData.thoi_gian
                });
                if (sessionHistory.length > MAX_HISTORY) sessionHistory = sessionHistory.slice(-MAX_HISTORY);
            }
        }

        const ketQua = analyzeFull(sessionHistory);
        const last = sessionHistory.length > 0 ? sessionHistory[sessionHistory.length - 1] : null;
        const phienTruoc = last ? last.phien : 0;
        const phienDuDoan = last ? last.phien + 1 : 0;

        if (phienDuDoan > 0) {
            const existPred = predictionLog.find(p => p.phienDuDoan === phienDuDoan);
            if (!existPred) {
                predictionLog.push({
                    phienDuDoan, duDoan: ketQua.duDoan === 'T' ? 'TAI' : 'XIU',
                    tiLe: ketQua.tiLeThang, cau: ketQua.cauChinh,
                    ketQuaThucTe: null, dung: null
                });
                if (predictionLog.length > 100) predictionLog = predictionLog.slice(-100);
            }
        }

        const dungCount = predictionLog.filter(p => p.dung === true).length;
        const saiCount = predictionLog.filter(p => p.dung === false).length;
        const tongDD = dungCount + saiCount;
        const tiLeDung = tongDD > 0 ? ((dungCount/tongDD)*100).toFixed(1)+'%' : 'N/A';

        res.json({
            status: 'success',
            current: {
                phien_truoc: phienTruoc,
                ket_qua_truoc: last ? last.resultText : '?',
                ky_hieu_truoc: last ? last.result : '?',
                tong_truoc: last ? last.tong : 0,
                xuc_xac_truoc: last ? last.xuc_xac : [],
                thoi_gian: last ? last.thoi_gian : ''
            },
            prediction: {
                phien_du_doan: phienDuDoan,
                du_doan: ketQua.duDoan === 'T' ? 'TAI' : 'XIU',
                ky_hieu: ketQua.duDoan,
                ti_le_thang: ketQua.tiLeThang,
                cau: ketQua.cauChinh,
                loai_cau: ketQua.loaiCau,
                suc_manh: ketQua.sucManh,
                loi_khuyen: ketQua.loiKhuyen,
                diem_manh: ketQua.diemManh
            },
            stats: {
                tong_phien: ketQua.thongKe.tong,
                tai: ketQua.thongKe.tai,
                xiu: ketQua.thongKe.xiu,
                ti_le_tai: ketQua.thongKe.tiLeTai,
                ti_le_xiu: ketQua.thongKe.tiLeXiu,
                xu_huong: ketQua.thongKe.xuHuong,
                tong_du_doan: tongDD, dung: dungCount, sai: saiCount,
                ti_le_dung: tiLeDung
            },
            patterns: ketQua.tatCaCau.map(c => ({
                name: c.name, type: c.type,
                predict: c.pred === 'T' ? 'TAI' : 'XIU',
                conf: c.conf + '%', desc: c.desc
            })),
            pred_log: predictionLog.slice(-10).reverse().map(p => ({
                phien: p.phienDuDoan, du_doan: p.duDoan, ti_le: p.tiLe,
                ket_qua: p.ketQuaThucTe || 'DOI', dung: p.dung
            })),
            recent: sessionHistory.slice(-15).reverse().map(s => ({
                phien: s.phien, ket_qua: s.resultText, tong: s.tong, xuc_xac: s.xuc_xac
            }))
        });
    } catch (error) {
        res.json({ status: 'error', message: error.message });
    }
});

app.get('/api/history', (req, res) => {
    const dungCount = predictionLog.filter(p => p.dung === true).length;
    const saiCount = predictionLog.filter(p => p.dung === false).length;
    
    res.json({
        tong_phien: sessionHistory.length,
        tong_du_doan: predictionLog.length,
        dung: dungCount, sai: saiCount,
        ti_le_dung: (dungCount+saiCount) > 0 ? ((dungCount/(dungCount+saiCount))*100).toFixed(1)+'%' : 'N/A',
        sessions: sessionHistory.slice(-30).reverse().map(s => ({
            phien: s.phien, ket_qua: s.resultText, tong: s.tong, xuc_xac: s.xuc_xac
        })),
        predictions: predictionLog.slice(-30).reverse().map(p => ({
            phien_du_doan: p.phienDuDoan, du_doan: p.duDoan, ti_le: p.tiLe,
            ket_qua_thuc_te: p.ketQuaThucTe || 'DOI', dung: p.dung
        }))
    });
});

app.listen(PORT, () => {
    console.log('Sunwin AI running on port ' + PORT);
});
