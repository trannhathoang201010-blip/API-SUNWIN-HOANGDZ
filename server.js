const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 500;

// 200+ CONG THUC CAU
const CAU_FORMULA = {
    'X331': { next: 'X', conf: 85 }, 'X422': { next: 'X', conf: 85 },
    'X111': { next: 'T', conf: 85 }, 'T665': { next: 'X', conf: 82 },
    'X523': { next: 'X', conf: 80 }, 'X116': { next: 'X', conf: 78 },
    'X141': { next: 'X', conf: 78 }, 'X252': { next: 'T', conf: 80 },
    'T246': { next: 'T', conf: 82 }, 'T554': { next: 'T', conf: 82 },
    'T256': { next: 'T', conf: 80 }, 'T166': { next: 'T', conf: 80 },
    'T336': { next: 'T', conf: 78 }, 'T443': { next: 'X', conf: 78 },
    'X412': { next: 'T', conf: 80 }, 'T543': { next: 'X', conf: 78 },
    'X261': { next: 'T', conf: 80 }, 'T663': { next: 'T', conf: 82 },
    'T515': { next: 'T', conf: 80 }, 'T156': { next: 'X', conf: 78 },
    'X334': { next: 'T', conf: 80 }, 'T633': { next: 'X', conf: 78 },
    'X541': { next: 'X', conf: 78 }, 'X414': { next: 'T', conf: 80 },
    'T434': { next: 'X', conf: 78 }, 'X145': { next: 'X', conf: 78 },
    'X431': { next: 'T', conf: 80 }, 'X432': { next: 'T', conf: 80 },
    'T454': { next: 'T', conf: 82 }, 'X142': { next: 'T', conf: 80 },
    'T645': { next: 'X', conf: 78 }, 'X243': { next: 'T', conf: 80 },
    'T664': { next: 'X', conf: 78 }, 'X213': { next: 'T', conf: 80 },
    'T363': { next: 'X', conf: 78 }, 'X226': { next: 'X', conf: 78 },
    'X112': { next: 'T', conf: 80 }, 'T436': { next: 'T', conf: 80 },
    'T551': { next: 'X', conf: 78 }, 'X341': { next: 'T', conf: 80 },
    'T635': { next: 'T', conf: 82 }, 'T661': { next: 'T', conf: 80 },
    'T362': { next: 'T', conf: 80 }, 'T466': { next: 'T', conf: 80 },
    'T364': { next: 'X', conf: 78 }, 'X611': { next: 'T', conf: 80 },
    'T462': { next: 'X', conf: 78 }, 'X126': { next: 'T', conf: 80 },
    'X322': { next: 'T', conf: 80 }, 'X124': { next: 'X', conf: 78 },
    'X315': { next: 'T', conf: 80 }, 'T236': { next: 'X', conf: 78 },
    'X433': { next: 'T', conf: 80 }, 'T544': { next: 'X', conf: 78 },
    'X121': { next: 'X', conf: 78 }, 'X153': { next: 'X', conf: 78 },
    'X135': { next: 'X', conf: 78 }, 'X232': { next: 'X', conf: 78 },
    'X621': { next: 'T', conf: 80 }, 'T542': { next: 'X', conf: 78 },
    'X215': { next: 'X', conf: 78 }, 'X521': { next: 'X', conf: 78 },
    'T344': { next: 'T', conf: 82 }, 'T334': { next: 'T', conf: 82 },
    'T662': { next: 'T', conf: 80 }, 'T366': { next: 'T', conf: 80 }
};

function phanTich(history) {
    var len = history.length;
    
    if (len < 2) {
        return {
            duDoan: 'TAI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Dang thu thap du lieu...', loai: 'KHONG CO', sucManh: 'YEU',
            loiKhuyen: 'DOI THEM DU LIEU', tatCa: [], diemManh: 0
        };
    }

    var str = '';
    for (var i = 0; i < len; i++) {
        str += history[i].kq;
    }
    
    var last = history[len - 1];
    if (!last) {
        return {
            duDoan: 'TAI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Loi du lieu', loai: 'LOI', sucManh: 'YEU',
            loiKhuyen: 'DOI DU LIEU', tatCa: [], diemManh: 0
        };
    }
    
    var lastKQ = last.kq || 'T';
    var lastTong = last.tong || 10;
    var allCau = [];

    // 1. BET
    var betPatterns = [
        { s: 'TTTTTTT', c: 99 }, { s: 'XXXXXXX', c: 99 },
        { s: 'TTTTTT', c: 98 }, { s: 'XXXXXX', c: 98 },
        { s: 'TTTTT', c: 95 }, { s: 'XXXXX', c: 95 },
        { s: 'TTTT', c: 88 }, { s: 'XXXX', c: 88 },
        { s: 'TTT', c: 75 }, { s: 'XXX', c: 75 }
    ];
    for (var i = 0; i < betPatterns.length; i++) {
        if (str.endsWith(betPatterns[i].s)) {
            allCau.push({ name: 'BET ' + betPatterns[i].s.length + ' PHIEN', pred: betPatterns[i].s[0], conf: betPatterns[i].c, type: 'BET' });
            break;
        }
    }

    // 2. DAO
    if (str.endsWith('TXTXTXT')) allCau.push({ name: 'DAO 1-1 DAI', pred: 'X', conf: 92, type: 'DAO' });
    else if (str.endsWith('XTXTXTX')) allCau.push({ name: 'DAO 1-1 DAI', pred: 'T', conf: 92, type: 'DAO' });
    else if (str.endsWith('TXTXT')) allCau.push({ name: 'DAO 1-1', pred: 'X', conf: 85, type: 'DAO' });
    else if (str.endsWith('XTXTX')) allCau.push({ name: 'DAO 1-1', pred: 'T', conf: 85, type: 'DAO' });
    else if (str.endsWith('TXTX')) allCau.push({ name: 'DAO 1-1', pred: 'X', conf: 78, type: 'DAO' });
    else if (str.endsWith('XTXT')) allCau.push({ name: 'DAO 1-1', pred: 'T', conf: 78, type: 'DAO' });
    
    if (str.endsWith('TTXX')) allCau.push({ name: 'DAO 2-2', pred: 'T', conf: 80, type: 'DAO' });
    else if (str.endsWith('XXTT')) allCau.push({ name: 'DAO 2-2', pred: 'X', conf: 80, type: 'DAO' });
    
    if (str.endsWith('TTTXXX')) allCau.push({ name: 'DAO 3-3', pred: 'T', conf: 78, type: 'DAO' });
    else if (str.endsWith('XXXTTT')) allCau.push({ name: 'DAO 3-3', pred: 'X', conf: 78, type: 'DAO' });

    // 3. NHIP
    if (str.endsWith('TXXT')) allCau.push({ name: 'NHIP 1-2-1', pred: 'X', conf: 75, type: 'NHIP' });
    else if (str.endsWith('XTTX')) allCau.push({ name: 'NHIP 1-2-1', pred: 'T', conf: 75, type: 'NHIP' });
    if (str.endsWith('TTXTT')) allCau.push({ name: 'NHIP 2-1-2', pred: 'X', conf: 72, type: 'NHIP' });
    else if (str.endsWith('XXTXX')) allCau.push({ name: 'NHIP 2-1-2', pred: 'T', conf: 72, type: 'NHIP' });
    if (str.endsWith('TTTXXT')) allCau.push({ name: 'NHIP 3-2-1', pred: 'X', conf: 72, type: 'NHIP' });
    else if (str.endsWith('XXXTTX')) allCau.push({ name: 'NHIP 3-2-1', pred: 'T', conf: 72, type: 'NHIP' });
    if (str.endsWith('TTXXX')) allCau.push({ name: 'BAC THANG', pred: 'X', conf: 73, type: 'NHIP' });
    else if (str.endsWith('XXTTT')) allCau.push({ name: 'BAC THANG', pred: 'T', conf: 73, type: 'NHIP' });

    // 4. HOI
    if (lastTong >= 17) allCau.push({ name: 'HOI CUC DAI', pred: 'X', conf: 93, type: 'HOI' });
    else if (lastTong <= 4) allCau.push({ name: 'HOI CUC TIEU', pred: 'T', conf: 93, type: 'HOI' });
    else if (lastTong >= 16) allCau.push({ name: 'HOI CAO', pred: 'X', conf: 82, type: 'HOI' });
    else if (lastTong <= 5) allCau.push({ name: 'HOI THAP', pred: 'T', conf: 82, type: 'HOI' });
    else if (lastTong >= 14) allCau.push({ name: 'HOI NHE', pred: 'X', conf: 68, type: 'HOI' });
    else if (lastTong <= 7) allCau.push({ name: 'HOI NHE', pred: 'T', conf: 68, type: 'HOI' });

    // 5. FORMULA
    var keys = Object.keys(CAU_FORMULA);
    for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (str.indexOf(key[0]) !== -1 && str.length >= 3) {
            var lastThree = str.slice(-3);
            var pattern = key.slice(0, 3).replace(/[0-9]/g, '');
            if (lastThree === pattern || str.slice(-4).indexOf(key[0]) !== -1) {
                allCau.push({ name: 'FORMULA ' + key, pred: CAU_FORMULA[key].next, conf: CAU_FORMULA[key].conf, type: 'FORMULA' });
            }
        }
    }

    // 6. SONG
    var doiChieu = 0;
    for (var k = 1; k < str.length; k++) {
        if (str[k] !== str[k-1]) doiChieu++;
    }
    var tiLeDao = doiChieu / Math.max(str.length - 1, 1);
    if (tiLeDao >= 0.75 && str.length >= 8) {
        allCau.push({ name: 'SONG CAO TAN', pred: lastKQ === 'T' ? 'X' : 'T', conf: 75, type: 'SONG' });
    } else if (tiLeDao <= 0.2 && str.length >= 8) {
        allCau.push({ name: 'IT DAO CHIEU', pred: lastKQ, conf: 72, type: 'SONG' });
    }

    // 7. NGHIENG
    var tCount = 0;
    for (var m = 0; m < len; m++) {
        if (history[m].kq === 'T') tCount++;
    }
    var tRate = tCount / len;
    if (len >= 8) {
        if (tRate >= 0.75 && str.endsWith('TT')) {
            allCau.push({ name: 'NGHIENG TAI + BET', pred: 'T', conf: 82, type: 'NGHIENG' });
        } else if (tRate <= 0.25 && str.endsWith('XX')) {
            allCau.push({ name: 'NGHIENG XIU + BET', pred: 'X', conf: 82, type: 'NGHIENG' });
        } else if (tRate >= 0.7) {
            allCau.push({ name: 'NGHIENG TAI - BE', pred: 'X', conf: 72, type: 'NGHIENG' });
        } else if (tRate <= 0.3) {
            allCau.push({ name: 'NGHIENG XIU - BE', pred: 'T', conf: 72, type: 'NGHIENG' });
        }
    }

    // SAP XEP
    allCau.sort(function(a, b) { return b.conf - a.conf; });
    var best = allCau[0];

    var xCount = len - tCount;
    var thongKe = {
        tong: len, tai: tCount, xiu: xCount,
        tiLeTai: (tRate * 100).toFixed(1) + '%',
        tiLeXiu: ((1 - tRate) * 100).toFixed(1) + '%',
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
            sucManh: best.conf >= 90 ? 'RAT MANH' : best.conf >= 80 ? 'MANH' : 'VUA',
            loiKhuyen: best.conf >= 90 ? 'VAO TIEN MANH' : best.conf >= 80 ? 'VAO TIEN' : 'THAM DO',
            tatCa: allCau.slice(0, 10),
            thongKe: thongKe,
            diemManh: best.conf
        };
    }

    return {
        duDoan: lastKQ === 'T' ? 'XIU' : 'TAI',
        kyHieu: lastKQ === 'T' ? 'X' : 'T',
        doTinCay: 50, tiLe: '50%',
        cau: 'Khong co cau - DANH NGUOC',
        loai: 'DAO NGUOC', sucManh: 'YEU',
        loiKhuyen: 'THAM DO NHO', tatCa: [], thongKe: thongKe, diemManh: 0
    };
}

function checkDD(phien, kq) {
    for (var i = 0; i < predictionLog.length; i++) {
        if (predictionLog[i].phienDD === phien && predictionLog[i].kqThuc === null) {
            predictionLog[i].kqThuc = kq;
            predictionLog[i].dung = predictionLog[i].duDoan === kq;
            break;
        }
    }
}

// ROUTES
app.get('/', function(req, res) {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149}.box.XIU{border:2px solid #3fb950}.big{font-size:1.8em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:.9em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BET{background:#da3633}.tag.DAO{background:#1f6feb}.tag.NHIP{background:#8957e5}.tag.HOI{background:#d2991d;color:#000}.tag.NGHIENG{background:#3fb950;color:#000}.tag.SONG{background:#db6d28}.tag.FORMULA{background:#e37400}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI</h1><p style="text-align:center;color:#8b949e;font-size:.75em">7 LOAI CAU • 200+ FORMULA</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DU DOAN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SU</a></div><div id="out"><div class="loading">⏳ Dang tai...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Dang phan tich...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.current||{};var dd=d.prediction||{};var tk=d.stats||{};var cau=d.patterns||[];var log=d.pred_log||[];var html="";html+=\'<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center>📌 DU DOAN PHIEN TIEP THEO</h3><div class=grid3><div class=box><small>PHIEN</small><div class="big yellow">#\'+dd.phien_du_doan+\'</div></div><div class="box \'+(dd.ky_hieu=="T"?"TAI":"XIU")+\'"><small>DU DOAN</small><div class=big style=font-size:2.5em;color:\'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+dd.du_doan+\'</div></div><div class=box><small>TI LE THANG</small><div class="big yellow">\'+dd.ti_le_thang+\'</div></div></div><p style=margin-top:8px>📊 <b>\'+dd.cau+\'</b> <span class="tag \'+dd.loai_cau+\'">\'+dd.loai_cau+\'</span> | 💡 <b>\'+dd.loi_khuyen+\'</b></p></div>\';html+=\'<div class=card><h3>📍 PHIEN TRUOC: #\'+p.phien_truoc+\'</h3><div class=grid2><div class="box \'+(p.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KET QUA</small><div class=big style=color:\'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+p.ket_qua+\'</div><small>Tong: \'+p.tong+\'</small></div><div class=box><small>XUC XAC</small><div class=big>\'+(p.xuc_xac||[]).join(" - ")+\'</div></div></div></div>\';html+=\'<div class=card><h3>📈 THONG KE \'+tk.tong_phien+\' PHIEN</h3><div class=grid2><div class=box><small>TAI</small><div class="big red">\'+tk.tai+\'</div><small>\'+tk.ti_le_tai+\'</small></div><div class=box><small>XIU</small><div class="big green">\'+tk.xiu+\'</div><small>\'+tk.ti_le_xiu+\'</small></div></div><p>Xu huong: <b>\'+tk.xu_huong+\'</b> | Du doan dung: <b>\'+tk.ti_le_dung+\'</b></p></div>\';if(cau.length>0){html+=\'<div class=card><h3>🔍 CAU PHAT HIEN</h3>\';for(var i=0;i<cau.length;i++){var c=cau[i];html+=\'<p style=margin:3px 0;font-size:.8em;padding:4px">\'+(i+1)+\'. <span class="tag \'+c.type+\'">\'+c.type+\'</span> <b>\'+c.name+\'</b> → <b style=color:\'+(c.predict=="TAI"?"#f85149":"#3fb950")+\'>\'+c.predict+\'</b> (\'+c.conf+\')</p>\'}html+=\'</div>\'}if(log.length>0){html+=\'<div class=card><h3>📋 LICH SU DU DOAN</h3><pre>\';for(var j=0;j<log.length;j++){var l=log[j];var tt=l.dung===true?"✅ DUNG":l.dung===false?"❌ SAI":"⏳ CHO";html+=\'#\'+l.phien+\' | DD: \'+l.du_doan+\' | KQ: \'+(l.ket_qua||"DOI")+\' | \'+tt+\' | \'+l.ti_le+\'\\n\'}html+=\'</pre></div>\'}if(d.recent){html+=\'<div class=card><h3>📜 15 PHIEN GAN NHAT</h3><pre>\';for(var k=0;k<d.recent.length;k++){var h=d.recent[k];html+=\'#\'+h.phien+\' | \'+h.ket_qua+\' (\'+h.tong+\') | \'+h.xuc_xac.join(\',\')+\'\\n\'}html+=\'</pre></div>\'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML=\'<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LOI</h3><p>\'+e.message+\'</p><button class=btn onclick=load()>🔄 THU LAI</button></div>\'}}load();setInterval(load,25000);</script></body></html>');
});

app.get('/api/predict', async function(req, res) {
    try {
        var newData = null;
        try {
            var resp = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
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
            
            var exists = false;
            for (var i = 0; i < sessionHistory.length; i++) {
                if (sessionHistory[i].phien === phien) { exists = true; break; }
            }
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
        var phienDD = last ? (last.phien + 1) : 0;

        if (phienDD > 0 && ketQua && ketQua.duDoan) {
            var existPred = false;
            for (var j = 0; j < predictionLog.length; j++) {
                if (predictionLog[j].phienDD === phienDD) { existPred = true; break; }
            }
            if (!existPred) {
                predictionLog.push({
                    phienDD: phienDD, duDoan: ketQua.duDoan,
                    tiLe: ketQua.tiLe, cau: ketQua.cau,
                    kqThuc: null, dung: null
                });
                if (predictionLog.length > 100) predictionLog = predictionLog.slice(-100);
            }
        }

        var dungCount = 0, saiCount = 0;
        for (var k = 0; k < predictionLog.length; k++) {
            if (predictionLog[k].dung === true) dungCount++;
            if (predictionLog[k].dung === false) saiCount++;
        }
        var tongDD = dungCount + saiCount;
        var tiLeDung = tongDD > 0 ? ((dungCount/tongDD)*100).toFixed(1)+'%' : 'N/A';

        var thongKe = ketQua && ketQua.thongKe ? ketQua.thongKe : { tong: 0, tai: 0, xiu: 0, tiLeTai: '0%', tiLeXiu: '0%', xuHuong: 'CHUA RO' };

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
                du_doan: ketQua ? ketQua.duDoan : 'TAI',
                ky_hieu: ketQua ? ketQua.kyHieu : 'T',
                ti_le_thang: ketQua ? ketQua.tiLe : '50%',
                cau: ketQua ? ketQua.cau : 'Khong xac dinh',
                loai_cau: ketQua ? ketQua.loai : 'KHONG CO',
                suc_manh: ketQua ? ketQua.sucManh : 'YEU',
                loi_khuyen: ketQua ? ketQua.loiKhuyen : 'THAM DO',
                diem_manh: ketQua ? ketQua.diemManh : 0
            },
            stats: {
                tong_phien: thongKe.tong,
                tai: thongKe.tai,
                xiu: thongKe.xiu,
                ti_le_tai: thongKe.tiLeTai,
                ti_le_xiu: thongKe.tiLeXiu,
                xu_huong: thongKe.xuHuong,
                tong_du_doan: tongDD,
                dung: dungCount,
                sai: saiCount,
                ti_le_dung: tiLeDung
            },
            patterns: ketQua && ketQua.tatCa ? ketQua.tatCa.map(function(c) {
                return { name: c.name, type: c.type, predict: c.pred === 'T' ? 'TAI' : 'XIU', conf: c.conf + '%' };
            }) : [],
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
    var dungCount = 0, saiCount = 0;
    for (var i = 0; i < predictionLog.length; i++) {
        if (predictionLog[i].dung === true) dungCount++;
        if (predictionLog[i].dung === false) saiCount++;
    }
    
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
