const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 200;

function phanTich(history) {
    const len = history.length;
    
    if (len === 0) {
        return {
            duDoan: 'TAI', kyHieu: 'T', doTinCay: 30, tiLe: '30%',
            cau: 'Chua co du lieu', loai: 'MAC DINH', sucManh: 'YEU',
            loiKhuyen: 'DOI DU LIEU'
        };
    }

    const str = history.map(h => h.kq).join('');
    const last = history[len - 1];
    const lastKQ = last.kq;
    const lastTong = last.tong;
    const all = [];

    // BET
    if (str.endsWith('TTTTT')) {
        all.push({ name: 'BET TAI 5', pred: 'T', conf: 95, type: 'BET' });
    } else if (str.endsWith('XXXXX')) {
        all.push({ name: 'BET XIU 5', pred: 'X', conf: 95, type: 'BET' });
    } else if (str.endsWith('TTTT')) {
        all.push({ name: 'BET TAI 4', pred: 'T', conf: 88, type: 'BET' });
    } else if (str.endsWith('XXXX')) {
        all.push({ name: 'BET XIU 4', pred: 'X', conf: 88, type: 'BET' });
    } else if (str.endsWith('TTT')) {
        all.push({ name: 'BET TAI 3', pred: 'T', conf: 75, type: 'BET' });
    } else if (str.endsWith('XXX')) {
        all.push({ name: 'BET XIU 3', pred: 'X', conf: 75, type: 'BET' });
    }

    // DAO 1-1
    if (str.endsWith('TXTX') || str.endsWith('XTXT')) {
        all.push({ name: 'DAO 1-1', pred: lastKQ === 'T' ? 'X' : 'T', conf: 80, type: 'DAO' });
    }

    // DAO 2-2
    if (str.endsWith('TTXX')) {
        all.push({ name: 'DAO 2-2', pred: 'T', conf: 80, type: 'DAO' });
    } else if (str.endsWith('XXTT')) {
        all.push({ name: 'DAO 2-2', pred: 'X', conf: 80, type: 'DAO' });
    }

    // HOI
    if (lastTong >= 17) {
        all.push({ name: 'HOI XIU', pred: 'X', conf: 92, type: 'HOI' });
    } else if (lastTong <= 4) {
        all.push({ name: 'HOI TAI', pred: 'T', conf: 92, type: 'HOI' });
    } else if (lastTong >= 15) {
        all.push({ name: 'HOI XIU', pred: 'X', conf: 78, type: 'HOI' });
    } else if (lastTong <= 5) {
        all.push({ name: 'HOI TAI', pred: 'T', conf: 78, type: 'HOI' });
    }

    // NHIP 1-2-1
    if (str.endsWith('TXXT')) {
        all.push({ name: 'NHIP 1-2-1', pred: 'X', conf: 75, type: 'NHIP' });
    } else if (str.endsWith('XTTX')) {
        all.push({ name: 'NHIP 1-2-1', pred: 'T', conf: 75, type: 'NHIP' });
    }

    // THONG KE
    const tCount = history.filter(h => h.kq === 'T').length;
    const xCount = history.filter(h => h.kq === 'X').length;

    if (len >= 8) {
        const tRate = tCount / len;
        if (tRate >= 0.7) {
            if (str.endsWith('TTT')) {
                all.push({ name: 'NGHIENG TAI + BET', pred: 'T', conf: 75, type: 'NGHIENG' });
            } else {
                all.push({ name: 'NGHIENG TAI - BE', pred: 'X', conf: 62, type: 'NGHIENG' });
            }
        } else if (tRate <= 0.3) {
            if (str.endsWith('XXX')) {
                all.push({ name: 'NGHIENG XIU + BET', pred: 'X', conf: 75, type: 'NGHIENG' });
            } else {
                all.push({ name: 'NGHIENG XIU - BE', pred: 'T', conf: 62, type: 'NGHIENG' });
            }
        }
    }

    all.sort((a, b) => b.conf - a.conf);
    const best = all[0];

    const thongKe = {
        tong: len, tai: tCount, xiu: xCount,
        tiLeTai: ((tCount/len)*100).toFixed(1) + '%',
        tiLeXiu: ((xCount/len)*100).toFixed(1) + '%',
        xuHuong: tCount > xCount ? 'THIEN TAI' : xCount > tCount ? 'THIEN XIU' : 'CAN BANG'
    };

    if (best) {
        return {
            duDoan: best.pred === 'T' ? 'TAI' : 'XIU',
            kyHieu: best.pred,
            doTinCay: best.conf,
            tiLe: best.conf + '%',
            cau: best.name,
            loai: best.type,
            sucManh: best.conf >= 90 ? 'RAT MANH' : best.conf >= 75 ? 'MANH' : 'VUA',
            loiKhuyen: best.conf >= 90 ? 'VAO MANH' : best.conf >= 75 ? 'VAO VUA' : 'THAM DO',
            tatCa: all.slice(0, 5),
            thongKe: thongKe
        };
    }

    return {
        duDoan: lastKQ === 'T' ? 'XIU' : 'TAI',
        kyHieu: lastKQ === 'T' ? 'X' : 'T',
        doTinCay: 50, tiLe: '50%',
        cau: 'DANH NGUOC', loai: 'DAO NGUOC', sucManh: 'YEU',
        loiKhuyen: 'THAM DO', tatCa: [], thongKe: thongKe
    };
}

function checkDD(phien, kq) {
    const p = predictionLog.find(x => x.phienDD === phien && x.kqThuc === null);
    if (p) {
        p.kqThuc = kq;
        p.dung = p.duDoan === kq;
    }
}

// TRANG CHU - HTML TRA VE TRUC TIEP
app.get('/', function(req, res) {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:650px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:10px 0;color:#f6d365}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149}.box.XIU{border:2px solid #3fb950}.big{font-size:1.8em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:.9em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BET{background:#da3633}.tag.DAO{background:#1f6feb}.tag.NHIP{background:#8957e5}.tag.HOI{background:#d2991d;color:#000}.tag.NGHIENG{background:#3fb950;color:#000}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI</h1><p style="text-align:center;color:#8b949e;font-size:.8em">DU DOAN TAI XIU</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DU DOAN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SU</a></div><div id="out"><div class="loading">⏳ Dang tai...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Dang phan tich...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.current||{};var dd=d.prediction||{};var tk=d.stats||{};var cau=d.patterns||[];var log=d.pred_log||[];var html="";html+=\'<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center>📌 DU DOAN PHIEN TIEP THEO</h3><div class=grid3><div class=box><small>PHIEN</small><div class="big yellow">#\'+dd.phien_du_doan+\'</div></div><div class="box \'+(dd.ky_hieu=="T"?"TAI":"XIU")+\'"><small>DU DOAN</small><div class=big style=font-size:2.5em;color:\'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+dd.du_doan+\'</div></div><div class=box><small>TI LE THANG</small><div class="big yellow">\'+dd.ti_le_thang+\'</div></div></div><p style=margin-top:8px>📊 <b>\'+dd.cau+\'</b> <span class="tag \'+dd.loai_cau+\'">\'+dd.loai_cau+\'</span> | 💡 <b>\'+dd.loi_khuyen+\'</b></p></div>\';html+=\'<div class=card><h3>📍 PHIEN TRUOC: #\'+p.phien_truoc+\'</h3><div class=grid2><div class="box \'+(p.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KET QUA</small><div class=big style=color:\'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+p.ket_qua+\'</div><small>Tong: \'+p.tong+\'</small></div><div class=box><small>XUC XAC</small><div class=big>\'+(p.xuc_xac||[]).join(" - ")+\'</div></div></div></div>\';html+=\'<div class=card><h3>📈 THONG KE \'+tk.tong_phien+\' PHIEN</h3><div class=grid2><div class=box><small>TAI</small><div class="big red">\'+tk.tai+\'</div><small>\'+tk.ti_le_tai+\'</small></div><div class=box><small>XIU</small><div class="big green">\'+tk.xiu+\'</div><small>\'+tk.ti_le_xiu+\'</small></div></div><p>Xu huong: <b>\'+tk.xu_huong+\'</b> | Du doan dung: <b>\'+tk.ti_le_dung+\'</b></p></div>\';if(cau.length>0){html+=\'<div class=card><h3>🔍 CAU PHAT HIEN</h3>\';for(var i=0;i<cau.length;i++){var c=cau[i];html+=\'<p style=margin:3px 0;font-size:.8em;padding:4px">\'+(i+1)+\'. <span class="tag \'+c.type+\'">\'+c.type+\'</span> <b>\'+c.name+\'</b> → <b style=color:\'+(c.predict=="TAI"?"#f85149":"#3fb950")+\'>\'+c.predict+\'</b> (\'+c.conf+\')</p>\'}html+=\'</div>\'}if(log.length>0){html+=\'<div class=card><h3>📋 LICH SU DU DOAN</h3><pre>\';for(var j=0;j<log.length;j++){var l=log[j];var tt=l.dung===true?"✅ DUNG":l.dung===false?"❌ SAI":"⏳ CHO";html+=\'#\'+l.phien+\' | DD: \'+l.du_doan+\' | KQ: \'+(l.ket_qua||"DOI")+\' | \'+tt+\' | \'+l.ti_le+\'\\n\'}html+=\'</pre></div>\'}if(d.recent){html+=\'<div class=card><h3>📜 15 PHIEN GAN NHAT</h3><pre>\';for(var k=0;k<d.recent.length;k++){var h=d.recent[k];html+=\'#\'+h.phien+\' | \'+h.ket_qua+\' (\'+h.tong+\') | \'+h.xuc_xac.join(",")+\'\\n\'}html+=\'</pre></div>\'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML=\'<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LOI</h3><p>\'+e.message+\'</p><button class=btn onclick=load()>🔄 THU LAI</button></div>\'}}load();setInterval(load,30000);</script></body></html>');
});

app.get('/api/predict', async function(req, res) {
    try {
        let newData = null;
        try {
            const resp = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            newData = resp.data;
        } catch(e) {}

        if (newData && newData.phien) {
            var phien = parseInt(newData.phien);
            var tong = parseInt(newData.tong) || 0;
            var kq = tong >= 11 ? 'T' : 'X';
            var kqText = tong >= 11 ? 'TAI' : 'XIU';
            
            checkDD(phien, kqText);
            
            var exists = sessionHistory.find(function(s) { return s.phien === phien; });
            if (!exists) {
                sessionHistory.push({
                    phien: phien, tong: tong, kq: kq, kqText: kqText,
                    xucXac: [newData.xuc_xac_1, newData.xuc_xac_2, newData.xuc_xac_3],
                    time: newData.thoi_gian
                });
                if (sessionHistory.length > MAX) sessionHistory = sessionHistory.slice(-MAX);
            }
        }

        var ketQua = phanTich(sessionHistory);
        var last = sessionHistory.length > 0 ? sessionHistory[sessionHistory.length - 1] : null;
        var phienTruoc = last ? last.phien : 0;
        var phienDD = last ? last.phien + 1 : 0;

        if (phienDD > 0) {
            var existPred = predictionLog.find(function(p) { return p.phienDD === phienDD; });
            if (!existPred) {
                predictionLog.push({
                    phienDD: phienDD, duDoan: ketQua.duDoan,
                    tiLe: ketQua.tiLe, cau: ketQua.cau,
                    kqThuc: null, dung: null
                });
                if (predictionLog.length > 100) predictionLog = predictionLog.slice(-100);
            }
        }

        var dungCount = predictionLog.filter(function(p) { return p.dung === true; }).length;
        var saiCount = predictionLog.filter(function(p) { return p.dung === false; }).length;
        var tongDD = dungCount + saiCount;
        var tiLeDung = tongDD > 0 ? ((dungCount/tongDD)*100).toFixed(1)+'%' : 'N/A';

        res.json({
            status: 'success',
            current: {
                phien_truoc: phienTruoc,
                ket_qua: last ? last.kqText : '?',
                ky_hieu: last ? last.kq : '?',
                tong: last ? last.tong : 0,
                xuc_xac: last ? last.xucXac : [],
                time: last ? last.time : ''
            },
            prediction: {
                phien_du_doan: phienDD,
                du_doan: ketQua.duDoan,
                ky_hieu: ketQua.kyHieu,
                ti_le_thang: ketQua.tiLe,
                cau: ketQua.cau,
                loai_cau: ketQua.loai,
                suc_manh: ketQua.sucManh,
                loi_khuyen: ketQua.loiKhuyen
            },
            stats: {
                tong_phien: ketQua.thongKe.tong,
                tai: ketQua.thongKe.tai,
                xiu: ketQua.thongKe.xiu,
                ti_le_tai: ketQua.thongKe.tiLeTai,
                ti_le_xiu: ketQua.thongKe.tiLeXiu,
                xu_huong: ketQua.thongKe.xuHuong,
                tong_du_doan: tongDD,
                dung: dungCount,
                sai: saiCount,
                ti_le_dung: tiLeDung
            },
            patterns: ketQua.tatCa.map(function(c) {
                return { name: c.name, type: c.type, predict: c.pred === 'T' ? 'TAI' : 'XIU', conf: c.conf + '%' };
            }),
            pred_log: predictionLog.slice(-10).reverse().map(function(p) {
                return { phien: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua: p.kqThuc || 'DOI', dung: p.dung };
            }),
            recent: sessionHistory.slice(-15).reverse().map(function(s) {
                return { phien: s.phien, ket_qua: s.kqText, tong: s.tong, xuc_xac: s.xucXac };
            })
        });
    } catch(err) {
        res.json({ status: 'error', message: err.message });
    }
});

app.get('/api/history', function(req, res) {
    var dungCount = predictionLog.filter(function(p) { return p.dung === true; }).length;
    var saiCount = predictionLog.filter(function(p) { return p.dung === false; }).length;
    
    res.json({
        tong_phien: sessionHistory.length,
        tong_du_doan: predictionLog.length,
        dung: dungCount, sai: saiCount,
        ti_le_dung: (dungCount+saiCount) > 0 ? ((dungCount/(dungCount+saiCount))*100).toFixed(1)+'%' : 'N/A',
        sessions: sessionHistory.slice(-30).reverse().map(function(s) {
            return { phien: s.phien, ket_qua: s.kqText, tong: s.tong, xuc_xac: s.xucXac };
        }),
        predictions: predictionLog.slice(-30).reverse().map(function(p) {
            return { phien_du_doan: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua_thuc_te: p.kqThuc || 'DOI', dung: p.dung };
        })
    });
});

app.listen(PORT, function() {
    console.log('Sunwin AI running on port ' + PORT);
});
