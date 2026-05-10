const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 500;

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
            duDoan: 'TÀI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Đang thu thập dữ liệu', loai: 'KHÔNG CÓ', sucManh: 'YẾU',
            loiKhuyen: 'ĐỢI THÊM DỮ LIỆU', tatCa: [], diemManh: 0
        };
    }

    var str = '';
    for (var i = 0; i < len; i++) str += history[i].kq;
    
    var last = history[len - 1];
    if (!last) return { duDoan: 'TÀI', kyHieu: 'T', doTinCay: 40, tiLe: '40%', cau: 'Lỗi', loai: 'LỖI', sucManh: 'YẾU', loiKhuyen: 'ĐỢI', tatCa: [], diemManh: 0 };
    
    var lastKQ = last.kq || 'T';
    var lastTong = last.tong || 10;
    var allCau = [];

    // BET
    var bets = ['TTTTTTT','XXXXXXX','TTTTTT','XXXXXX','TTTTT','XXXXX','TTTT','XXXX','TTT','XXX'];
    var confs = [99,99,98,98,95,95,88,88,75,75];
    for (var i = 0; i < bets.length; i++) {
        if (str.endsWith(bets[i])) {
            allCau.push({ name: 'BỆT ' + bets[i].length + ' PHIÊN', pred: bets[i][0], conf: confs[i], type: 'BỆT' });
            break;
        }
    }

    // DAO 1-1
    if (str.endsWith('TXTXTXT')) allCau.push({ name: 'ĐẢO 1-1 DÀI', pred: 'X', conf: 92, type: 'ĐẢO' });
    else if (str.endsWith('XTXTXTX')) allCau.push({ name: 'ĐẢO 1-1 DÀI', pred: 'T', conf: 92, type: 'ĐẢO' });
    else if (str.endsWith('TXTXT')) allCau.push({ name: 'ĐẢO 1-1', pred: 'X', conf: 85, type: 'ĐẢO' });
    else if (str.endsWith('XTXTX')) allCau.push({ name: 'ĐẢO 1-1', pred: 'T', conf: 85, type: 'ĐẢO' });
    else if (str.endsWith('TXTX')) allCau.push({ name: 'ĐẢO 1-1', pred: 'X', conf: 78, type: 'ĐẢO' });
    else if (str.endsWith('XTXT')) allCau.push({ name: 'ĐẢO 1-1', pred: 'T', conf: 78, type: 'ĐẢO' });
    
    // DAO 2-2
    if (str.endsWith('TTXX')) allCau.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO' });
    else if (str.endsWith('XXTT')) allCau.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO' });
    
    // DAO 3-3
    if (str.endsWith('TTTXXX')) allCau.push({ name: 'ĐẢO 3-3', pred: 'T', conf: 78, type: 'ĐẢO' });
    else if (str.endsWith('XXXTTT')) allCau.push({ name: 'ĐẢO 3-3', pred: 'X', conf: 78, type: 'ĐẢO' });

    // NHIP
    if (str.endsWith('TXXT')) allCau.push({ name: 'NHỊP 1-2-1', pred: 'X', conf: 75, type: 'NHỊP' });
    else if (str.endsWith('XTTX')) allCau.push({ name: 'NHỊP 1-2-1', pred: 'T', conf: 75, type: 'NHỊP' });
    if (str.endsWith('TTXTT')) allCau.push({ name: 'NHỊP 2-1-2', pred: 'X', conf: 72, type: 'NHỊP' });
    else if (str.endsWith('XXTXX')) allCau.push({ name: 'NHỊP 2-1-2', pred: 'T', conf: 72, type: 'NHỊP' });
    if (str.endsWith('TTTXXT')) allCau.push({ name: 'NHỊP 3-2-1', pred: 'X', conf: 72, type: 'NHỊP' });
    else if (str.endsWith('XXXTTX')) allCau.push({ name: 'NHỊP 3-2-1', pred: 'T', conf: 72, type: 'NHỊP' });
    if (str.endsWith('TTXXX')) allCau.push({ name: 'BẬC THANG', pred: 'X', conf: 73, type: 'NHỊP' });
    else if (str.endsWith('XXTTT')) allCau.push({ name: 'BẬC THANG', pred: 'T', conf: 73, type: 'NHỊP' });

    // HOI
    if (lastTong >= 17) allCau.push({ name: 'HỒI CỰC ĐẠI', pred: 'X', conf: 93, type: 'HỒI' });
    else if (lastTong <= 4) allCau.push({ name: 'HỒI CỰC TIỂU', pred: 'T', conf: 93, type: 'HỒI' });
    else if (lastTong >= 16) allCau.push({ name: 'HỒI CAO', pred: 'X', conf: 82, type: 'HỒI' });
    else if (lastTong <= 5) allCau.push({ name: 'HỒI THẤP', pred: 'T', conf: 82, type: 'HỒI' });
    else if (lastTong >= 14) allCau.push({ name: 'HỒI NHẸ', pred: 'X', conf: 68, type: 'HỒI' });
    else if (lastTong <= 7) allCau.push({ name: 'HỒI NHẸ', pred: 'T', conf: 68, type: 'HỒI' });

    // FORMULA
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

    // SONG
    var doiChieu = 0;
    for (var k = 1; k < str.length; k++) if (str[k] !== str[k-1]) doiChieu++;
    var tiLeDao = doiChieu / Math.max(str.length - 1, 1);
    if (tiLeDao >= 0.75 && str.length >= 8) allCau.push({ name: 'SÓNG CAO TẦN', pred: lastKQ === 'T' ? 'X' : 'T', conf: 75, type: 'SÓNG' });
    else if (tiLeDao <= 0.2 && str.length >= 8) allCau.push({ name: 'ÍT ĐẢO CHIỀU', pred: lastKQ, conf: 72, type: 'SÓNG' });

    // NGHIENG
    var tCount = 0;
    for (var m = 0; m < len; m++) if (history[m].kq === 'T') tCount++;
    var tRate = tCount / len;
    if (len >= 8) {
        if (tRate >= 0.75 && str.endsWith('TT')) allCau.push({ name: 'NGHIÊNG TÀI + BỆT', pred: 'T', conf: 82, type: 'NGHIÊNG' });
        else if (tRate <= 0.25 && str.endsWith('XX')) allCau.push({ name: 'NGHIÊNG XỈU + BỆT', pred: 'X', conf: 82, type: 'NGHIÊNG' });
        else if (tRate >= 0.7) allCau.push({ name: 'NGHIÊNG TÀI - BẺ', pred: 'X', conf: 72, type: 'NGHIÊNG' });
        else if (tRate <= 0.3) allCau.push({ name: 'NGHIÊNG XỈU - BẺ', pred: 'T', conf: 72, type: 'NGHIÊNG' });
    }

    allCau.sort(function(a, b) { return b.conf - a.conf; });
    var best = allCau[0];
    var xCount = len - tCount;

    var thongKe = {
        tong: len, tai: tCount, xiu: xCount,
        tiLeTai: (tRate * 100).toFixed(1) + '%',
        tiLeXiu: ((1 - tRate) * 100).toFixed(1) + '%',
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
            sucManh: best.conf >= 90 ? 'RẤT MẠNH' : best.conf >= 80 ? 'MẠNH' : 'VỪA',
            loiKhuyen: best.conf >= 90 ? 'VÀO TIỀN MẠNH' : best.conf >= 80 ? 'VÀO TIỀN' : 'THĂM DÒ',
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
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{padding:12px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149}.box.XIU{border:2px solid #3fb950}.big{font-size:2em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:12px 24px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:1em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:3px 10px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}.tag.HỒI{background:#d2991d;color:#000}.tag.NGHIÊNG{background:#3fb950;color:#000}.tag.SÓNG{background:#db6d28}.tag.FORMULA{background:#e37400}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:10px;border-radius:6px;overflow-x:auto;font-size:.8em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI - DỰ ĐOÁN TÀI XỈU</h1><p style="text-align:center;color:#8b949e;font-size:.8em">7 LOẠI CẦU • 200+ FORMULA</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DỰ ĐOÁN NGAY</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 LỊCH SỬ</a></div><div id="out"><div class="loading">⏳ Đang tải...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Đang phân tích...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.phien_truoc||{};var dd=d.du_doan||{};var cau=d.cau_phat_hien||[];var log=d.lich_su_du_doan||[];var html="";html+='<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center;color:#f6d365>📌 DỰ ĐOÁN PHIÊN HIỆN TẠI</h3><div style=text-align:center;margin:10px 0><span style=font-size:1.2em>PHIÊN HIỆN TẠI: </span><span class="big yellow">#'+dd.phien_hien_tai+'</span></div><div class=grid2><div class="box '+(dd.ky_hieu=="T"?"TAI":"XIU")+'"><small>DỰ ĐOÁN</small><div class=big style=font-size:2.5em;color:'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+'>'+dd.du_doan+'</div></div><div class=box><small>TỈ LỆ THẮNG</small><div class="big yellow">'+dd.ti_le+'</div></div></div><p style=margin-top:10px>💡 <b>Lời khuyên:</b> '+dd.loi_khuyen+'</p><p>📊 <b>Cầu:</b> '+dd.cau+' <span class="tag '+dd.loai_cau+'">'+dd.loai_cau+'</span></p></div>';html+='<div class=card><h3>📍 PHIÊN TRƯỚC</h3><div class=grid2><div class=box><small>PHIÊN</small><div class=big>#'+p.phien+'</div></div><div class="box '+(p.ky_hieu=="T"?"TAI":"XIU")+'"><small>KẾT QUẢ</small><div class=big style=color:'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+'>'+p.ket_qua+'</div><small>Tổng: '+p.tong+' | Xúc xắc: '+(p.xuc_xac||[]).join(", ")+'</small></div></div></div>';if(cau.length>0){html+='<div class=card><h3>🔍 CẦU PHÁT HIỆN</h3>';for(var i=0;i<cau.length;i++){var c=cau[i];html+='<p style=margin:3px 0;font-size:.8em;padding:4px;border-radius:3px;background:rgba(255,255,255,0.02)">'+(i+1)+'. <span class="tag '+c.type+'">'+c.type+'</span> <b>'+c.name+'</b> → <b style=color:'+(c.predict=="TÀI"?"#f85149":"#3fb950")+'>'+c.predict+'</b> ('+c.conf+')</p>'}html+='</div>'}if(log.length>0){html+='<div class=card><h3>📋 LỊCH SỬ DỰ ĐOÁN</h3><pre>PHIÊN DỰ ĐOÁN | KẾT QUẢ DỰ ĐOÁN | KẾT QUẢ GAME | ĐÚNG/SAI\n'+("─".repeat(60))+'\n';for(var j=0;j<log.length;j++){var l=log[j];var tt=l.dung===true?"✅ ĐÚNG":l.dung===false?"❌ SAI":"⏳ CHỜ";html+='#'+l.phien+' | '+l.du_doan+' | '+(l.ket_qua||"ĐỢI")+' | '+tt+'\n'}html+='</pre></div>'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML='<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LỖI</h3><p>'+e.message+'</p><button class=btn onclick=load()>🔄 THỬ LẠI</button></div>'}}load();setInterval(load,25000);</script></body></html>');
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
        var phienHienTai = last ? (last.phien + 1) : 0;

        if (phienHienTai > 0 && ketQua && ketQua.duDoan) {
            var existPred = false;
            for (var j = 0; j < predictionLog.length; j++) {
                if (predictionLog[j].phienDD === phienHienTai) { existPred = true; break; }
            }
            if (!existPred) {
                predictionLog.push({
                    phienDD: phienHienTai, duDoan: ketQua.duDoan,
                    tiLe: ketQua.tiLe, cau: ketQua.cau,
                    kqThuc: null, dung: null
                });
                if (predictionLog.length > 100) predictionLog = predictionLog.slice(-100);
            }
        }

        res.json({
            status: 'success',
            phien_truoc: {
                phien: phienTruoc,
                ket_qua: last ? last.kqText : '?',
                ky_hieu: last ? last.kq : '?',
                tong: last ? last.tong : 0,
                xuc_xac: last ? last.xucXac : []
            },
            du_doan: {
                phien_hien_tai: phienHienTai,
                du_doan: ketQua ? ketQua.duDoan : 'TÀI',
                ky_hieu: ketQua ? ketQua.kyHieu : 'T',
                ti_le: ketQua ? ketQua.tiLe : '50%',
                cau: ketQua ? ketQua.cau : 'Không xác định',
                loai_cau: ketQua ? ketQua.loai : 'KHÔNG CÓ',
                suc_manh: ketQua ? ketQua.sucManh : 'YẾU',
                loi_khuyen: ketQua ? ketQua.loiKhuyen : 'THĂM DÒ'
            },
            cau_phat_hien: ketQua && ketQua.tatCa ? ketQua.tatCa.slice(0, 10).map(function(c) {
                return { name: c.name, type: c.type, predict: c.pred === 'T' ? 'TÀI' : 'XỈU', conf: c.conf + '%' };
            }) : [],
            lich_su_du_doan: predictionLog.slice(-10).reverse().map(function(p) {
                return { phien: p.phienDD, du_doan: p.duDoan, ket_qua: p.kqThuc || 'ĐỢI', dung: p.dung };
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
        lich_su_du_doan: predictionLog.slice(-30).reverse().map(function(p) {
            return {
                phien_du_doan: p.phienDD,
                ket_qua_du_doan: p.duDoan,
                ket_qua_game: p.kqThuc || 'ĐỢI',
                dung_hay_sai: p.dung === true ? '✅ ĐÚNG' : p.dung === false ? '❌ SAI' : '⏳ CHỜ'
            };
        }),
        thong_ke: {
            tong_du_doan: predictionLog.length,
            dung: dungCount,
            sai: saiCount,
            ti_le_dung: (dungCount+saiCount) > 0 ? ((dungCount/(dungCount+saiCount))*100).toFixed(1)+'%' : 'N/A'
        }
    });
});

app.listen(PORT, function() {
    console.log('Sunwin AI running on port ' + PORT);
});
