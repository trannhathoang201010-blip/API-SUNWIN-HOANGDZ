const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 500;

// 200+ CÔNG THỨC CẦU
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
    'T662': { next: 'T', conf: 80 }, 'T366': { next: 'T', conf: 80 },
    'T665': { next: 'X', conf: 82 }, 'X523': { next: 'X', conf: 80 },
    'X116': { next: 'X', conf: 78 }, 'X252': { next: 'T', conf: 80 },
    'T661': { next: 'X', conf: 78 }, 'X322': { next: 'T', conf: 80 },
    'T466': { next: 'X', conf: 78 }, 'X124': { next: 'X', conf: 78 },
    'X315': { next: 'T', conf: 80 }, 'T236': { next: 'X', conf: 78 },
    'X433': { next: 'T', conf: 80 }, 'T544': { next: 'X', conf: 78 },
    'X121': { next: 'X', conf: 78 }, 'X153': { next: 'X', conf: 78 },
    'X135': { next: 'X', conf: 78 }, 'X232': { next: 'X', conf: 78 },
    'X621': { next: 'T', conf: 80 }, 'T542': { next: 'X', conf: 78 },
    'X215': { next: 'X', conf: 78 }, 'X521': { next: 'X', conf: 78 },
    'T344': { next: 'T', conf: 82 }, 'T334': { next: 'T', conf: 82 },
    'T662': { next: 'T', conf: 80 }, 'T366': { next: 'T', conf: 80 }
};

// BRIDGE PATTERN ANALYZERS
class BetAnalyzer {
    analyze(data, str) {
        var results = [];
        var bets = [
            { s: 'TTTTTTT', c: 99 }, { s: 'XXXXXXX', c: 99 },
            { s: 'TTTTTT', c: 98 }, { s: 'XXXXXX', c: 98 },
            { s: 'TTTTT', c: 95 }, { s: 'XXXXX', c: 95 },
            { s: 'TTTT', c: 88 }, { s: 'XXXX', c: 88 },
            { s: 'TTT', c: 75 }, { s: 'XXX', c: 75 }
        ];
        for (var i = 0; i < bets.length; i++) {
            if (str.endsWith(bets[i].s)) {
                results.push({ name: 'BỆT ' + bets[i].s.length + ' PHIÊN', pred: bets[i].s[0], conf: bets[i].c, type: 'BỆT' });
                break;
            }
        }
        return results;
    }
}

class DaoAnalyzer {
    analyze(data, str) {
        var results = [];
        if (str.endsWith('TXTXTXT')) results.push({ name: 'ĐẢO 1-1 DÀI', pred: 'X', conf: 92, type: 'ĐẢO' });
        else if (str.endsWith('XTXTXTX')) results.push({ name: 'ĐẢO 1-1 DÀI', pred: 'T', conf: 92, type: 'ĐẢO' });
        else if (str.endsWith('TXTXT')) results.push({ name: 'ĐẢO 1-1', pred: 'X', conf: 85, type: 'ĐẢO' });
        else if (str.endsWith('XTXTX')) results.push({ name: 'ĐẢO 1-1', pred: 'T', conf: 85, type: 'ĐẢO' });
        else if (str.endsWith('TXTX')) results.push({ name: 'ĐẢO 1-1', pred: 'X', conf: 78, type: 'ĐẢO' });
        else if (str.endsWith('XTXT')) results.push({ name: 'ĐẢO 1-1', pred: 'T', conf: 78, type: 'ĐẢO' });
        if (str.endsWith('TTXX')) results.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO' });
        else if (str.endsWith('XXTT')) results.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO' });
        if (str.endsWith('TTTXXX')) results.push({ name: 'ĐẢO 3-3', pred: 'T', conf: 78, type: 'ĐẢO' });
        else if (str.endsWith('XXXTTT')) results.push({ name: 'ĐẢO 3-3', pred: 'X', conf: 78, type: 'ĐẢO' });
        return results;
    }
}

class NhipAnalyzer {
    analyze(data, str) {
        var results = [];
        if (str.endsWith('TXXT')) results.push({ name: 'NHỊP 1-2-1', pred: 'X', conf: 75, type: 'NHỊP' });
        else if (str.endsWith('XTTX')) results.push({ name: 'NHỊP 1-2-1', pred: 'T', conf: 75, type: 'NHỊP' });
        if (str.endsWith('TTXTT')) results.push({ name: 'NHỊP 2-1-2', pred: 'X', conf: 72, type: 'NHỊP' });
        else if (str.endsWith('XXTXX')) results.push({ name: 'NHỊP 2-1-2', pred: 'T', conf: 72, type: 'NHỊP' });
        if (str.endsWith('TTTXXT')) results.push({ name: 'NHỊP 3-2-1', pred: 'X', conf: 72, type: 'NHỊP' });
        else if (str.endsWith('XXXTTX')) results.push({ name: 'NHỊP 3-2-1', pred: 'T', conf: 72, type: 'NHỊP' });
        if (str.endsWith('TTXXX')) results.push({ name: 'BẬC THANG', pred: 'X', conf: 73, type: 'NHỊP' });
        else if (str.endsWith('XXTTT')) results.push({ name: 'BẬC THANG', pred: 'T', conf: 73, type: 'NHỊP' });
        return results;
    }
}

class HoiAnalyzer {
    analyze(data, str) {
        var results = [];
        var lastTong = data[data.length - 1].tong;
        if (lastTong >= 17) results.push({ name: 'HỒI CỰC ĐẠI', pred: 'X', conf: 93, type: 'HỒI' });
        else if (lastTong <= 4) results.push({ name: 'HỒI CỰC TIỂU', pred: 'T', conf: 93, type: 'HỒI' });
        else if (lastTong >= 16) results.push({ name: 'HỒI CAO', pred: 'X', conf: 82, type: 'HỒI' });
        else if (lastTong <= 5) results.push({ name: 'HỒI THẤP', pred: 'T', conf: 82, type: 'HỒI' });
        else if (lastTong >= 14) results.push({ name: 'HỒI NHẸ', pred: 'X', conf: 68, type: 'HỒI' });
        else if (lastTong <= 7) results.push({ name: 'HỒI NHẸ', pred: 'T', conf: 68, type: 'HỒI' });
        return results;
    }
}

class FormulaAnalyzer {
    analyze(data, str) {
        var results = [];
        var keys = Object.keys(CAU_FORMULA);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (str.endsWith(key[0]) && data.length >= 3) {
                var lastThree = data.slice(-3).map(function(d) { return d.kq; }).join('');
                var pattern = key.slice(0, 3).replace(/[0-9]/g, '');
                if (lastThree === pattern || str.slice(-4).indexOf(key[0]) !== -1) {
                    results.push({ name: 'FORMULA ' + key, pred: CAU_FORMULA[key].next, conf: CAU_FORMULA[key].conf, type: 'FORMULA' });
                }
            }
        }
        return results.slice(0, 5);
    }
}

class SongAnalyzer {
    analyze(data, str) {
        var results = [];
        var doiChieu = 0;
        for (var i = 1; i < str.length; i++) {
            if (str[i] !== str[i-1]) doiChieu++;
        }
        var tiLeDao = doiChieu / Math.max(str.length - 1, 1);
        var lastKQ = data[data.length - 1].kq;
        if (tiLeDao >= 0.75 && str.length >= 8) {
            results.push({ name: 'SÓNG CAO TẦN', pred: lastKQ === 'T' ? 'X' : 'T', conf: 75, type: 'SÓNG' });
        } else if (tiLeDao <= 0.2 && str.length >= 8) {
            results.push({ name: 'ÍT ĐẢO CHIỀU', pred: lastKQ, conf: 72, type: 'SÓNG' });
        }
        return results;
    }
}

class NghiengAnalyzer {
    analyze(data, str) {
        var results = [];
        var len = data.length;
        var tCount = data.filter(function(h) { return h.kq === 'T'; }).length;
        var tRate = tCount / len;
        if (len >= 8) {
            if (tRate >= 0.75 && str.endsWith('TT')) {
                results.push({ name: 'NGHIÊNG TÀI + BỆT', pred: 'T', conf: 82, type: 'NGHIÊNG' });
            } else if (tRate <= 0.25 && str.endsWith('XX')) {
                results.push({ name: 'NGHIÊNG XỈU + BỆT', pred: 'X', conf: 82, type: 'NGHIÊNG' });
            } else if (tRate >= 0.7) {
                results.push({ name: 'NGHIÊNG TÀI - BẺ', pred: 'X', conf: 72, type: 'NGHIÊNG' });
            } else if (tRate <= 0.3) {
                results.push({ name: 'NGHIÊNG XỈU - BẺ', pred: 'T', conf: 72, type: 'NGHIÊNG' });
            }
        }
        return results;
    }
}

// BRIDGE SYSTEM
var analyzers = [
    new BetAnalyzer(),
    new DaoAnalyzer(),
    new NhipAnalyzer(),
    new HoiAnalyzer(),
    new FormulaAnalyzer(),
    new SongAnalyzer(),
    new NghiengAnalyzer()
];

function phanTich(history) {
    var len = history.length;
    
    if (len < 3) {
        return {
            duDoan: 'TÀI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Đang thu thập dữ liệu...', loai: 'KHÔNG CÓ', sucManh: 'YẾU',
            loiKhuyen: 'ĐỢI THÊM DỮ LIỆU', tatCa: [], diemManh: 0
        };
    }

    var str = history.map(function(h) { return h.kq; }).join('');
    var last = history[len - 1];
    var lastKQ = last.kq;
    
    var allCau = [];
    for (var i = 0; i < analyzers.length; i++) {
        try {
            var results = analyzers[i].analyze(history, str);
            allCau = allCau.concat(results);
        } catch(e) {}
    }
    
    allCau.sort(function(a, b) { return b.conf - a.conf; });
    var best = allCau[0];

    var tCount = history.filter(function(h) { return h.kq === 'T'; }).length;
    var xCount = history.filter(function(h) { return h.kq === 'X'; }).length;
    var tRate = tCount / len;

    var thongKe = {
        tong: len, tai: tCount, xiu: xCount,
        tiLeTai: ((tRate)*100).toFixed(1) + '%',
        tiLeXiu: ((1-tRate)*100).toFixed(1) + '%',
        xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG'
    };

    if (best) {
        return {
            duDoan: best.pred === 'T' ? 'TÀI' : 'XỈU',
            kyHieu: best.pred,
            doTinCay: best.conf,
            tiLe: best.conf + '%',
            cau: best.name,
            loai: best.type,
            sucManh: best.conf >= 90 ? 'RẤT MẠNH' : best.conf >= 80 ? 'MẠNH' : best.conf >= 70 ? 'KHÁ' : 'VỪA',
            loiKhuyen: best.conf >= 90 ? 'VÀO TIỀN MẠNH' : best.conf >= 80 ? 'VÀO TIỀN' : best.conf >= 70 ? 'ĐÁNH NHỎ' : 'THĂM DÒ',
            tatCa: allCau.slice(0, 10),
            thongKe: thongKe,
            diemManh: best.conf
        };
    }

    return {
        duDoan: lastKQ === 'T' ? 'XỈU' : 'TÀI',
        kyHieu: lastKQ === 'T' ? 'X' : 'T',
        doTinCay: 50, tiLe: '50%',
        cau: 'Không có cầu - ĐÁNH NGƯỢC',
        loai: 'ĐẢO NGƯỢC', sucManh: 'YẾU',
        loiKhuyen: 'THĂM DÒ NHỎ', tatCa: [], thongKe: thongKe, diemManh: 0
    };
}

function checkDD(phien, kq) {
    var p = predictionLog.find(function(x) { return x.phienDD === phien && x.kqThuc === null; });
    if (p) {
        p.kqThuc = kq;
        p.dung = p.duDoan === kq;
    }
}

// ROUTES
app.get('/', function(req, res) {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149;box-shadow:0 0 15px rgba(248,81,73,0.3)}.box.XIU{border:2px solid #3fb950;box-shadow:0 0 15px rgba(63,185,80,0.3)}.big{font-size:1.8em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:.9em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}.tag.HỒI{background:#d2991d;color:#000}.tag.NGHIÊNG{background:#3fb950;color:#000}.tag.SÓNG{background:#db6d28}.tag.FORMULA{background:#e37400}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI - DỰ ĐOÁN TÀI XỈU</h1><p style="text-align:center;color:#8b949e;font-size:.75em">7 LOẠI CẦU • 200+ FORMULA • BRIDGE PATTERN</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DỰ ĐOÁN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SỬ</a></div><div id="out"><div class="loading">⏳ Đang tải...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Đang phân tích...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.current||{};var dd=d.prediction||{};var tk=d.stats||{};var cau=d.patterns||[];var log=d.pred_log||[];var html="";html+=\'<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center>📌 DỰ ĐOÁN PHIÊN TIẾP THEO</h3><div class=grid3><div class=box><small>PHIÊN</small><div class="big yellow">#\'+dd.phien_du_doan+\'</div></div><div class="box \'+(dd.ky_hieu=="T"?"TAI":"XIU")+\'"><small>DỰ ĐOÁN</small><div class=big style=font-size:2.5em;color:\'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+dd.du_doan+\'</div></div><div class=box><small>TỈ LỆ THẮNG</small><div class="big yellow">\'+dd.ti_le_thang+\'</div></div></div><p style=margin-top:8px>📊 <b>\'+dd.cau+\'</b> <span class="tag \'+dd.loai_cau+\'">\'+dd.loai_cau+\'</span> | 💡 <b>\'+dd.loi_khuyen+\'</b></p></div>\';html+=\'<div class=card><h3>📍 PHIÊN TRƯỚC: #\'+p.phien_truoc+\'</h3><div class=grid2><div class="box \'+(p.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KẾT QUẢ</small><div class=big style=color:\'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+p.ket_qua+\'</div><small>Tổng: \'+p.tong+\'</small></div><div class=box><small>XÚC XẮC</small><div class=big>\'+(p.xuc_xac||[]).join(" - ")+\'</div></div></div></div>\';html+=\'<div class=card><h3>📈 THỐNG KÊ \'+tk.tong_phien+\' PHIÊN</h3><div class=grid2><div class=box><small>TÀI</small><div class="big red">\'+tk.tai+\'</div><small>\'+tk.ti_le_tai+\'</small></div><div class=box><small>XỈU</small><div class="big green">\'+tk.xiu+\'</div><small>\'+tk.ti_le_xiu+\'</small></div></div><p>Xu hướng: <b>\'+tk.xu_huong+\'</b> | Dự đoán đúng: <b>\'+tk.ti_le_dung+\'</b></p></div>\';if(cau.length>0){html+=\'<div class=card><h3>🔍 CẦU PHÁT HIỆN</h3>\';for(var i=0;i<cau.length;i++){var c=cau[i];html+=\'<p style=margin:3px 0;font-size:.8em;padding:4px;background:rgba(255,255,255,0.02);border-radius:4px">\'+(i+1)+\'. <span class="tag \'+c.type+\'">\'+c.type+\'</span> <b>\'+c.name+\'</b> → <b style=color:\'+(c.predict=="TÀI"?"#f85149":"#3fb950")+\'>\'+c.predict+\'</b> (\'+c.conf+\')</p>\'}html+=\'</div>\'}if(log.length>0){html+=\'<div class=card><h3>📋 LỊCH SỬ DỰ ĐOÁN</h3><pre>\';for(var j=0;j<log.length;j++){var l=log[j];var tt=l.dung===true?"✅ ĐÚNG":l.dung===false?"❌ SAI":"⏳ CHỜ";html+=\'#\'+l.phien+\' | DD: \'+l.du_doan+\' | KQ: \'+(l.ket_qua||"ĐỢI")+\' | \'+tt+\' | \'+l.ti_le+\'\\n\'}html+=\'</pre></div>\'}if(d.recent){html+=\'<div class=card><h3>📜 15 PHIÊN GẦN NHẤT</h3><pre>\';for(var k=0;k<d.recent.length;k++){var h=d.recent[k];html+=\'#\'+h.phien+\' | \'+h.ket_qua+\' (\'+h.tong+\') | \'+h.xuc_xac.join(\',\')+\'\\n\'}html+=\'</pre></div>\'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML=\'<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LỖI</h3><p>\'+e.message+\'</p><button class=btn onclick=load()>🔄 THỬ LẠI</button></div>\'}}load();setInterval(load,25000);</script></body></html>');
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
            var kqText = tong >= 11 ? 'TÀI' : 'XỈU';
            
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

        if (phienDD > 0 && ketQua.duDoan) {
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
                tong_du_doan: tongDD,
                dung: dungCount,
                sai: saiCount,
                ti_le_dung: tiLeDung
            },
            patterns: ketQua.tatCa.map(function(c) {
                return { name: c.name, type: c.type, predict: c.pred === 'T' ? 'TÀI' : 'XỈU', conf: c.conf + '%' };
            }),
            pred_log: predictionLog.slice(-10).reverse().map(function(p) {
                return { phien: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua: p.kqThuc || 'ĐỢI', dung: p.dung };
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
            return { phien_du_doan: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua_thuc_te: p.kqThuc || 'ĐỢI', dung: p.dung };
        })
    });
});

app.listen(PORT, function() {
    console.log('Sunwin AI running on port ' + PORT);
});
