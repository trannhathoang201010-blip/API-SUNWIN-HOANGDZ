const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Lưu dữ liệu
let sessionHistory = [];
let predictionLog = [];
const MAX = 200;

// Phân tích cầu
function phanTich(history) {
    const len = history.length;
    
    if (len === 0) {
        return {
            duDoan: 'TAI',
            kyHieu: 'T',
            doTinCay: 30,
            tiLe: '30%',
            cau: 'Chua co du lieu',
            loai: 'MAC DINH',
            sucManh: 'YEU',
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

    // HOI CAU
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
        tong: len,
        tai: tCount,
        xiu: xCount,
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
        doTinCay: 50,
        tiLe: '50%',
        cau: 'DANH NGUOC',
        loai: 'DAO NGUOC',
        sucManh: 'YEU',
        loiKhuyen: 'THAM DO',
        tatCa: [],
        thongKe: thongKe
    };
}

// Check du doan dung/sai
function checkDD(phien, kq) {
    const p = predictionLog.find(x => x.phienDD === phien && x.kqThuc === null);
    if (p) {
        p.kqThuc = kq;
        p.dung = p.duDoan === kq;
    }
}

// Routes
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
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
                    phien: phien,
                    tong: tong,
                    kq: kq,
                    kqText: kqText,
                    xucXac: [newData.xuc_xac_1, newData.xuc_xac_2, newData.xuc_xac_3],
                    time: newData.thoi_gian
                });
                if (sessionHistory.length > MAX) {
                    sessionHistory = sessionHistory.slice(-MAX);
                }
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
                    phienDD: phienDD,
                    duDoan: ketQua.duDoan,
                    tiLe: ketQua.tiLe,
                    cau: ketQua.cau,
                    kqThuc: null,
                    dung: null
                });
                if (predictionLog.length > 100) {
                    predictionLog = predictionLog.slice(-100);
                }
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
                return {
                    name: c.name,
                    type: c.type,
                    predict: c.pred === 'T' ? 'TAI' : 'XIU',
                    conf: c.conf + '%'
                };
            }),
            pred_log: predictionLog.slice(-10).reverse().map(function(p) {
                return {
                    phien: p.phienDD,
                    du_doan: p.duDoan,
                    ti_le: p.tiLe,
                    ket_qua: p.kqThuc || 'DOI',
                    dung: p.dung
                };
            }),
            recent: sessionHistory.slice(-15).reverse().map(function(s) {
                return {
                    phien: s.phien,
                    ket_qua: s.kqText,
                    tong: s.tong,
                    xuc_xac: s.xucXac
                };
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
        dung: dungCount,
        sai: saiCount,
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
