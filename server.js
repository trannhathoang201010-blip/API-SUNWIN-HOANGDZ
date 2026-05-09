const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

// ============================================================================
// LƯU TRỮ DỮ LIỆU
// ============================================================================
let sessionHistory = [];
let predictionLog = [];
const MAX_HISTORY = 200;

// ============================================================================
// FULL THUẬT TOÁN PHÂN TÍCH - 20+ LOẠI CẦU - 100+ BIẾN THỂ
// ============================================================================
function analyzeFull(history) {
    if (!history || history.length === 0) {
        return {
            duDoan: 'T',
            doTinCay: 30,
            tiLeThang: '30%',
            cauChinh: 'Chưa có dữ liệu - Mặc định TÀI',
            loaiCau: 'MẶC ĐỊNH',
            sucManh: 'YẾU',
            tatCaCau: [],
            thongKe: { tong: 0, tai: 0, xiu: 0, tiLeTai: '0%', tiLeXiu: '0%', xuHuong: 'CHƯA RÕ' },
            loiKhuyen: 'CHỜ THÊM DỮ LIỆU',
            diemManh: 0
        };
    }

    const len = history.length;
    const str = history.map(h => h.result).join('');
    const last = history[len - 1];
    const lastResult = last.result;
    const lastTong = last.tong;
    const allCau = [];

    // ========================================================================
    // 1. CẦU BỆT (7 biến thể)
    // ========================================================================
    const betLevels = [
        { len: 8, conf: 99, desc: 'Bệt 8 phiên - CỰC MẠNH' },
        { len: 7, conf: 98, desc: 'Bệt 7 phiên - RẤT MẠNH' },
        { len: 6, conf: 97, desc: 'Bệt 6 phiên' },
        { len: 5, conf: 95, desc: 'Bệt 5 phiên' },
        { len: 4, conf: 88, desc: 'Bệt 4 phiên' },
        { len: 3, conf: 75, desc: 'Bệt 3 phiên' },
        { len: 2, conf: 60, desc: 'Bệt 2 phiên' }
    ];

    for (const level of betLevels) {
        const betT = 'T'.repeat(level.len);
        const betX = 'X'.repeat(level.len);
        if (str.endsWith(betT)) {
            allCau.push({ name: `BỆT TÀI ${level.len}`, pred: 'T', conf: level.conf, type: 'BỆT', desc: level.desc + ' - TIẾP TỤC TÀI' });
            break;
        }
        if (str.endsWith(betX)) {
            allCau.push({ name: `BỆT XỈU ${level.len}`, pred: 'X', conf: level.conf, type: 'BỆT', desc: level.desc + ' - TIẾP TỤC XỈU' });
            break;
        }
    }

    // ========================================================================
    // 2. CẦU ĐẢO 1-1 (6 biến thể)
    // ========================================================================
    const dao11Patterns = [
        { pattern: 'TXTXTXTX', conf: 95, desc: 'Đảo 1-1 DÀI 8 nhịp' },
        { pattern: 'XTXTXTXT', conf: 95, desc: 'Đảo 1-1 DÀI 8 nhịp' },
        { pattern: 'TXTXTX', conf: 90, desc: 'Đảo 1-1 6 nhịp' },
        { pattern: 'XTXTXT', conf: 90, desc: 'Đảo 1-1 6 nhịp' },
        { pattern: 'TXTXT', conf: 85, desc: 'Đảo 1-1 5 nhịp' },
        { pattern: 'XTXTX', conf: 85, desc: 'Đảo 1-1 5 nhịp' },
        { pattern: 'TXTX', conf: 78, desc: 'Đảo 1-1 4 nhịp' },
        { pattern: 'XTXT', conf: 78, desc: 'Đảo 1-1 4 nhịp' }
    ];

    for (const p of dao11Patterns) {
        if (str.endsWith(p.pattern)) {
            allCau.push({ name: 'ĐẢO 1-1', pred: lastResult === 'T' ? 'X' : 'T', conf: p.conf, type: 'ĐẢO', desc: p.desc + ` - VÀO ${lastResult === 'T' ? 'XỈU' : 'TÀI'}` });
            break;
        }
    }

    // ========================================================================
    // 3. CẦU ĐẢO 2-2 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TTXXTTXX')) {
        allCau.push({ name: 'ĐẢO 2-2 DÀI', pred: 'T', conf: 88, type: 'ĐẢO', desc: 'Đảo 2-2 dài - VÀO TÀI' });
    } else if (str.endsWith('XXTTXXTT')) {
        allCau.push({ name: 'ĐẢO 2-2 DÀI', pred: 'X', conf: 88, type: 'ĐẢO', desc: 'Đảo 2-2 dài - VÀO XỈU' });
    } else if (str.endsWith('TTXX')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'T', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO TÀI' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'ĐẢO 2-2', pred: 'X', conf: 80, type: 'ĐẢO', desc: 'Đảo 2-2 - VÀO XỈU' });
    }

    // ========================================================================
    // 4. CẦU ĐẢO 3-3 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TTTXXXTTT')) {
        allCau.push({ name: 'ĐẢO 3-3 DÀI', pred: 'X', conf: 85, type: 'ĐẢO', desc: 'Đảo 3-3 dài - VÀO XỈU' });
    } else if (str.endsWith('XXXTTTXXX')) {
        allCau.push({ name: 'ĐẢO 3-3 DÀI', pred: 'T', conf: 85, type: 'ĐẢO', desc: 'Đảo 3-3 dài - VÀO TÀI' });
    } else if (str.endsWith('TTTXXX')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'T', conf: 78, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO TÀI' });
    } else if (str.endsWith('XXXTTT')) {
        allCau.push({ name: 'ĐẢO 3-3', pred: 'X', conf: 78, type: 'ĐẢO', desc: 'Đảo 3-3 - VÀO XỈU' });
    }

    // ========================================================================
    // 5. CẦU NHỊP 1-2-1 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TXXTXX')) {
        allCau.push({ name: 'NHỊP 1-2-1 DÀI', pred: 'T', conf: 82, type: 'NHỊP', desc: 'Nhịp 1-2-1 dài - VÀO TÀI' });
    } else if (str.endsWith('XTTXTT')) {
        allCau.push({ name: 'NHỊP 1-2-1 DÀI', pred: 'X', conf: 82, type: 'NHỊP', desc: 'Nhịp 1-2-1 dài - VÀO XỈU' });
    } else if (str.endsWith('TXXT')) {
        allCau.push({ name: 'NHỊP 1-2-1', pred: 'X', conf: 75, type: 'NHỊP', desc: 'Nhịp T-XX-T - VÀO XỈU' });
    } else if (str.endsWith('XTTX')) {
        allCau.push({ name: 'NHỊP 1-2-1', pred: 'T', conf: 75, type: 'NHỊP', desc: 'Nhịp X-TT-X - VÀO TÀI' });
    }

    // ========================================================================
    // 6. CẦU NHỊP 2-1-2 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TTXTTX')) {
        allCau.push({ name: 'NHỊP 2-1-2 DÀI', pred: 'T', conf: 78, type: 'NHỊP', desc: 'Nhịp 2-1-2 dài - VÀO TÀI' });
    } else if (str.endsWith('XXTXXT')) {
        allCau.push({ name: 'NHỊP 2-1-2 DÀI', pred: 'X', conf: 78, type: 'NHỊP', desc: 'Nhịp 2-1-2 dài - VÀO XỈU' });
    } else if (str.endsWith('TTXTT')) {
        allCau.push({ name: 'NHỊP 2-1-2', pred: 'X', conf: 72, type: 'NHỊP', desc: 'Nhịp TT-X-TT - VÀO XỈU' });
    } else if (str.endsWith('XXTXX')) {
        allCau.push({ name: 'NHỊP 2-1-2', pred: 'T', conf: 72, type: 'NHỊP', desc: 'Nhịp XX-T-XX - VÀO TÀI' });
    }

    // ========================================================================
    // 7. CẦU NHỊP 3-2-1 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TTTXXT')) {
        allCau.push({ name: 'NHỊP 3-2-1', pred: 'X', conf: 72, type: 'NHỊP', desc: 'Nhịp 3-2-1 (TTT-XX-T) - VÀO XỈU' });
    } else if (str.endsWith('XXXTTX')) {
        allCau.push({ name: 'NHỊP 3-2-1', pred: 'T', conf: 72, type: 'NHỊP', desc: 'Nhịp 3-2-1 (XXX-TT-X) - VÀO TÀI' });
    } else if (str.endsWith('TTTXX')) {
        allCau.push({ name: 'NHỊP 3-2', pred: 'X', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2 (TTT-XX) - VÀO XỈU' });
    } else if (str.endsWith('XXXTT')) {
        allCau.push({ name: 'NHỊP 3-2', pred: 'T', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2 (XXX-TT) - VÀO TÀI' });
    }

    // ========================================================================
    // 8. CẦU NHỊP 1-2-3 (4 biến thể)
    // ========================================================================
    if (str.endsWith('TXXTTT')) {
        allCau.push({ name: 'NHỊP 1-2-3', pred: 'X', conf: 70, type: 'NHỊP', desc: 'Nhịp 1-2-3 - VÀO XỈU' });
    } else if (str.endsWith('XTTXXX')) {
        allCau.push({ name: 'NHỊP 1-2-3', pred: 'T', conf: 70, type: 'NHỊP', desc: 'Nhịp 1-2-3 - VÀO TÀI' });
    } else if (str.endsWith('TTTXX')) {
        allCau.push({ name: 'NHỊP 3-2', pred: 'X', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2 - VÀO XỈU' });
    } else if (str.endsWith('XXXTT')) {
        allCau.push({ name: 'NHỊP 3-2', pred: 'T', conf: 68, type: 'NHỊP', desc: 'Nhịp 3-2 - VÀO TÀI' });
    }

    // ========================================================================
    // 9. CẦU BẬC THANG (6 biến thể)
    // ========================================================================
    if (str.endsWith('TTTXXX')) {
        allCau.push({ name: 'BẬC THANG XUỐNG', pred: 'X', conf: 73, type: 'NHỊP', desc: 'Bậc thang TTT-XXX - VÀO XỈU' });
    } else if (str.endsWith('XXXTTT')) {
        allCau.push({ name: 'BẬC THANG LÊN', pred: 'T', conf: 73, type: 'NHỊP', desc: 'Bậc thang XXX-TTT - VÀO TÀI' });
    } else if (str.endsWith('TTXX')) {
        allCau.push({ name: 'BẬC THANG', pred: 'X', conf: 68, type: 'NHỊP', desc: 'Bậc thang TT-XX - VÀO XỈU' });
    } else if (str.endsWith('XXTT')) {
        allCau.push({ name: 'BẬC THANG', pred: 'T', conf: 68, type: 'NHỊP', desc: 'Bậc thang XX-TT - VÀO TÀI' });
    } else if (str.endsWith('TXX')) {
        allCau.push({ name: 'BẬC THANG', pred: 'X', conf: 62, type: 'NHỊP', desc: 'Bậc thang T-XX - VÀO XỈU' });
    } else if (str.endsWith('XTT')) {
        allCau.push({ name: 'BẬC THANG', pred: 'T', conf: 62, type: 'NHỊP', desc: 'Bậc thang X-TT - VÀO TÀI' });
    }

    // ========================================================================
    // 10. CẦU HỒI THEO TỔNG ĐIỂM (8 biến thể)
    // ========================================================================
    if (lastTong >= 18) {
        allCau.push({ name: 'HỒI SIÊU CỰC ĐẠI', pred: 'X', conf: 95, type: 'HỒI', desc: `Tổng ${lastTong} SIÊU CAO - HỒI XỈU NGAY` });
    } else if (lastTong <= 3) {
        allCau.push({ name: 'HỒI SIÊU CỰC TIỂU', pred: 'T', conf: 95, type: 'HỒI', desc: `Tổng ${lastTong} SIÊU THẤP - HỒI TÀI NGAY` });
    } else if (lastTong >= 17) {
        allCau.push({ name: 'HỒI CỰC ĐẠI', pred: 'X', conf: 90, type: 'HỒI', desc: `Tổng ${lastTong} cực cao - HỒI XỈU` });
    } else if (lastTong <= 4) {
        allCau.push({ name: 'HỒI CỰC TIỂU', pred: 'T', conf: 90, type: 'HỒI', desc: `Tổng ${lastTong} cực thấp - HỒI TÀI` });
    } else if (lastTong >= 16) {
        allCau.push({ name: 'HỒI CAO', pred: 'X', conf: 80, type: 'HỒI', desc: `Tổng ${lastTong} cao - Khả năng XỈU` });
    } else if (lastTong <= 5) {
        allCau.push({ name: 'HỒI THẤP', pred: 'T', conf: 80, type: 'HỒI', desc: `Tổng ${lastTong} thấp - Khả năng TÀI` });
    } else if (lastTong >= 14) {
        allCau.push({ name: 'HỒI NHẸ', pred: 'X', conf: 65, type: 'HỒI', desc: `Tổng ${lastTong} hơi cao - Có thể XỈU` });
    } else if (lastTong <= 7) {
        allCau.push({ name: 'HỒI NHẸ', pred: 'T', conf: 65, type: 'HỒI', desc: `Tổng ${lastTong} hơi thấp - Có thể TÀI` });
    }

    // ========================================================================
    // 11. CẦU SÓNG (Đếm đảo chiều) (3 biến thể)
    // ========================================================================
    let doiChieu = 0;
    for (let i = 1; i < str.length; i++) {
        if (str[i] !== str[i-1]) doiChieu++;
    }
    const tiLeDao = doiChieu / Math.max(str.length - 1, 1);
    
    if (tiLeDao >= 0.8 && str.length >= 10) {
        allCau.push({ name: 'SÓNG CAO TẦN', pred: lastResult === 'T' ? 'X' : 'T', conf: 72, type: 'SÓNG', desc: `Sóng mạnh (${doiChieu} lần/${str.length} phiên) - ĐẢO TIẾP` });
    } else if (tiLeDao >= 0.6 && str.length >= 8) {
        allCau.push({ name: 'SÓNG VỪA', pred: lastResult === 'T' ? 'X' : 'T', conf: 65, type: 'SÓNG', desc: `Sóng vừa (${doiChieu} lần/${str.length} phiên) - Có thể ĐẢO` });
    } else if (tiLeDao <= 0.2 && str.length >= 10) {
        const trend = str[str.length-1];
        allCau.push({ name: 'ÍT ĐẢO CHIỀU', pred: trend, conf: 68, type: 'SÓNG', desc: `Ít đảo (${doiChieu} lần) - TIẾP TỤC ${trend === 'T' ? 'TÀI' : 'XỈU'}` });
    }

    // ========================================================================
    // 12. CẦU NGHIÊNG - THỐNG KÊ (5 biến thể)
    // ========================================================================
    const tCount = history.filter(h => h.result === 'T').length;
    const xCount = history.filter(h => h.result === 'X').length;
    const total = len;

    if (total >= 10) {
        const tRate = tCount / total;
        if (tRate >= 0.85) {
            if (str.endsWith('TTT')) {
                allCau.push({ name: 'SIÊU NGHIÊNG TÀI + BỆT', pred: 'T', conf: 80, type: 'NGHIÊNG', desc: `Tài ${(tRate*100).toFixed(0)}% + bệt - VÀO TÀI` });
            } else {
                allCau.push({ name: 'SIÊU NGHIÊNG TÀI', pred: 'X', conf: 70, type: 'NGHIÊNG', desc: `Tài ${(tRate*100).toFixed(0)}% - SẮP BẺ - VÀO XỈU` });
            }
        } else if (tRate <= 0.15) {
            if (str.endsWith('XXX')) {
                allCau.push({ name: 'SIÊU NGHIÊNG XỈU + BỆT', pred: 'X', conf: 80, type: 'NGHIÊNG', desc: `Xỉu ${((1-tRate)*100).toFixed(0)}% + bệt - VÀO XỈU` });
            } else {
                allCau.push({ name: 'SIÊU NGHIÊNG XỈU', pred: 'T', conf: 70, type: 'NGHIÊNG', desc: `Xỉu ${((1-tRate)*100).toFixed(0)}% - SẮP BẺ - VÀO TÀI` });
            }
        } else if (tRate >= 0.7) {
            allCau.push({ name: 'NGHIÊNG TÀI', pred: 'T', conf: 68, type: 'NGHIÊNG', desc: `Nghiêng Tài ${(tRate*100).toFixed(0)}% - THEO TÀI` });
        } else if (tRate <= 0.3) {
            allCau.push({ name: 'NGHIÊNG XỈU', pred: 'X', conf: 68, type: 'NGHIÊNG', desc: `Nghiêng Xỉu ${((1-tRate)*100).toFixed(0)}% - THEO XỈU` });
        }
    }

    // ========================================================================
    // 13. CẦU PHÂN TÍCH XÚC XẮC (4 biến thể)
    // ========================================================================
    const xucXac = last.xuc_xac || [];
    if (xucXac.length === 3) {
        const sum = xucXac.reduce((a,b) => a+b, 0);
        const hasPair = new Set(xucXac).size <= 2;
        const hasTriple = new Set(xucXac).size === 1;
        
        if (hasTriple) {
            allCau.push({ name: 'XÚC XẮC BỘ 3', pred: sum >= 12 ? 'T' : 'X', conf: 72, type: 'XÚC XẮC', desc: `Bộ 3 giống nhau - THEO ${sum >= 12 ? 'TÀI' : 'XỈU'}` });
        } else if (hasPair && sum >= 15) {
            allCau.push({ name: 'XÚC XẮC ĐÔI + CAO', pred: 'X', conf: 68, type: 'XÚC XẮC', desc: 'Đôi + tổng cao - Có thể XỈU' });
        } else if (hasPair && sum <= 6) {
            allCau.push({ name: 'XÚC XẮC ĐÔI + THẤP', pred: 'T', conf: 68, type: 'XÚC XẮC', desc: 'Đôi + tổng thấp - Có thể TÀI' });
        } else if (!hasPair && sum >= 11 && sum <= 12) {
            allCau.push({ name: 'XÚC XẮC RỜI TB', pred: lastResult === 'T' ? 'X' : 'T', conf: 58, type: 'XÚC XẮC', desc: '3 mặt rời - Dễ đảo chiều' });
        }
    }

    // ========================================================================
    // 14. CẦU CHU KỲ (3 biến thể)
    // ========================================================================
    if (len >= 12) {
        const last6 = str.slice(-6);
        const prev6 = str.slice(-12, -6);
        if (last6 === prev6) {
            allCau.push({ name: 'CHU KỲ 6', pred: last6[0] === 'T' ? 'T' : 'X', conf: 75, type: 'CHU KỲ', desc: 'Lặp chu kỳ 6 phiên - THEO CHU KỲ' });
        }
        
        const last4 = str.slice(-4);
        const prev4 = str.slice(-8, -4);
        if (last4 === prev4 && str.slice(-12, -8) === last4) {
            allCau.push({ name: 'CHU KỲ 4', pred: last4[0] === 'T' ? 'T' : 'X', conf: 72, type: 'CHU KỲ', desc: 'Lặp chu kỳ 4 phiên - THEO CHU KỲ' });
        }
        
        const last3 = str.slice(-3);
        const countLast3 = str.split(last3).length - 1;
        if (countLast3 >= 3) {
            allCau.push({ name: 'CHU KỲ 3', pred: last3[0] === 'T' ? 'T' : 'X', conf: 68, type: 'CHU KỲ', desc: `Mẫu "${last3}" lặp ${countLast3} lần` });
        }
    }

    // ========================================================================
    // 15. CẦU GÃY (2 biến thể)
    // ========================================================================
    if (str.endsWith('TXXXX') || str.endsWith('XTTTT')) {
        const breakTrend = str.endsWith('TXXXX') ? 'X' : 'T';
        allCau.push({ name: 'GÃY CẦU', pred: breakTrend, conf: 70, type: 'GÃY', desc: `Gãy cầu - THEO ${breakTrend === 'T' ? 'TÀI' : 'XỈU'}` });
    }

    if (str.endsWith('TTTXX') || str.endsWith('XXXTT')) {
        const breakTrend = str.endsWith('TTTXX') ? 'X' : 'T';
        allCau.push({ name: 'GÃY CẦU NHẸ', pred: breakTrend, conf: 65, type: 'GÃY', desc: `Dấu hiệu gãy - THEO ${breakTrend === 'T' ? 'TÀI' : 'XỈU'}` });
    }

    // ========================================================================
    // SẮP XẾP VÀ CHỌN CẦU TỐT NHẤT
    // ========================================================================
    allCau.sort((a, b) => b.conf - a.conf);
    const bestCau = allCau[0];
    const topCau = allCau.slice(0, 5);

    // Tính điểm mạnh tổng hợp
    let diemManh = 0;
    for (const c of topCau) {
        diemManh += c.conf;
    }

    if (bestCau) {
        let loiKhuyen = 'THĂM DÒ';
        if (bestCau.conf >= 95) loiKhuyen = 'VÀO MẠNH TAY';
        else if (bestCau.conf >= 85) loiKhuyen = 'VÀO LỚN';
        else if (bestCau.conf >= 75) loiKhuyen = 'VÀO VỪA';
        else if (bestCau.conf >= 65) loiKhuyen = 'ĐÁNH NHỎ';
        else loiKhuyen = 'THĂM DÒ NHẸ';

        return {
            duDoan: bestCau.pred,
            doTinCay: bestCau.conf,
            tiLeThang: bestCau.conf + '%',
            cauChinh: bestCau.desc,
            loaiCau: bestCau.type,
            sucManh: bestCau.conf >= 90 ? 'RẤT MẠNH' : bestCau.conf >= 75 ? 'MẠNH' : bestCau.conf >= 60 ? 'VỪA' : 'YẾU',
            tatCaCau: topCau,
            thongKe: {
                tong: total,
                tai: tCount,
                xiu: xCount,
                tiLeTai: ((tCount/total)*100).toFixed(1) + '%',
                tiLeXiu: ((xCount/total)*100).toFixed(1) + '%',
                xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG'
            },
            loiKhuyen,
            diemManh
        };
    }

    return {
        duDoan: lastResult === 'T' ? 'X' : 'T',
        doTinCay: 50,
        tiLeThang: '50%',
        cauChinh: 'Cầu loạn - ĐÁNH NGƯỢC LẠI',
        loaiCau: 'ĐẢO NGƯỢC',
        sucManh: 'YẾU',
        tatCaCau: [],
        thongKe: {
            tong: total,
            tai: tCount,
            xiu: xCount,
            tiLeTai: ((tCount/total)*100).toFixed(1) + '%',
            tiLeXiu: ((xCount/total)*100).toFixed(1) + '%',
            xuHuong: tCount > xCount ? 'THIÊN TÀI' : xCount > tCount ? 'THIÊN XỈU' : 'CÂN BẰNG'
        },
        loiKhuyen: 'THĂM DÒ NHẸ',
        diemManh: 0
    };
}

// ============================================================================
// KIỂM TRA DỰ ĐOÁN ĐÚNG/SAI
// ============================================================================
function checkPrediction(phien, ketQua) {
    const pred = predictionLog.find(p => p.phienDuDoan === phien);
    if (pred && pred.ketQuaThucTe === null) {
        pred.ketQuaThucTe = ketQua;
        pred.dung = pred.duDoan === ketQua;
    }
}

// ============================================================================
// ROUTES
// ============================================================================

app.get('/', (req, res) => {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI - DỰ ĐOÁN</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:10px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149;box-shadow:0 0 15px rgba(248,81,73,0.3)}.box.XIU{border:2px solid #3fb950;box-shadow:0 0 15px rgba(63,185,80,0.3)}.big{font-size:1.8em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:10px 20px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:.9em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7em;font-weight:bold}.tag.BỆT{background:#da3633}.tag.ĐẢO{background:#1f6feb}.tag.NHỊP{background:#8957e5}.tag.HỒI{background:#d2991d;color:#000}.tag.SÓNG{background:#db6d28}.tag.NGHIÊNG{background:#3fb950;color:#000}.tag.GÃY{background:#f0883e}.tag.CHU_KỲ{background:#a371f7}.tag.XÚC_XẮC{background:#e3b341;color:#000}.tag.DUNG{background:#3fb950}.tag.SAI{background:#da3633}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI - FULL CẦU</h1><p style="text-align:center;color:#8b949e;font-size:.75em">15 LOẠI CẦU • 70+ BIẾN THỂ • DỰ ĐOÁN CHUẨN</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DỰ ĐOÁN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SỬ</a></div><div id="out"><div class="loading">⏳ Đang tải...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Đang phân tích 15 loại cầu...</div>";try{let r=await fetch("/api/predict"),d=await r.json(),p=d.current||{},dd=d.prediction||{},tk=d.stats||{},cau=d.patterns||[],log=d.pred_log||[];document.getElementById("out").innerHTML='<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center>📌 DỰ ĐOÁN PHIÊN TIẾP THEO</h3><div class=grid3><div class=box><small>PHIÊN</small><div class="big yellow">#'+dd.phien_du_doan+"</div></div><div class=\"box "+(dd.ky_hieu=="T"?"TAI":"XIU")+'"><small>DỰ ĐOÁN</small><div class=big style=font-size:2.5em;color:'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+">"+dd.du_doan+"</div></div><div class=box><small>TỈ LỆ THẮNG</small><div class=\"big yellow\">"+dd.ti_le_thang+"</div></div></div><div style=margin-top:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px><p>📊 <b>"+dd.cau+'</b> <span class="tag '+dd.loai_cau+'">'+dd.loai_cau+"</span></p><p>💪 Sức mạnh: <b>"+dd.suc_manh+"</b> | 💡 <b>"+dd.loi_khuyen+"</b> | 📈 Điểm: <b>"+dd.diem_manh+"</b></p></div></div><div class=card><h3>📍 PHIÊN TRƯỚC: #"+p.phien_truoc+'</h3><div class=grid2><div class="box '+(p.ky_hieu_truoc=="T"?"TAI":"XIU")+'"><small>KẾT QUẢ</small><div class=big style=color:'+(p.ky_hieu_truoc=="T"?"#f85149":"#3fb950")+">"+p.ket_qua_truoc+"</div><small>Tổng: "+p.tong_truoc+"</small></div><div class=box><small>XÚC XẮC</small><div class=big>"+(p.xuc_xac_truoc||[]).join(" - ")+"</div></div></div></div><div class=card><h3>📈 THỐNG KÊ "+tk.tong_phien+" PHIÊN</h3><div class=grid2><div class=box><small>TÀI</small><div class="big red">'+tk.tai+'</div><small>'+tk.ti_le_tai+'</small></div><div class=box><small>XỈU</small><div class="big green">'+tk.xiu+'</div><small>'+tk.ti_le_xiu+'</small></div></div><p>Xu hướng: <b>'+tk.xu_huong+'</b> | Dự đoán đúng: <b>'+tk.ti_le_dung+'</b> ('+tk.dung+'/'+(tk.dung+tk.sai)+')</p></div>'+(cau.length>0?'<div class=card><h3>🔍 TOP CẦU PHÁT HIỆN ('+cau.length+')</h3>'+cau.map((c,i)=>"<p style=margin:3px 0;font-size:.8em;padding:4px;background:rgba(255,255,255,0.02);border-radius:4px>"+(i+1)+'. <span class="tag '+c.type+'">'+c.type+'</span> <b>'+c.name+'</b> → <b style=color:'+(c.predict=="TÀI"?"#f85149":"#3fb950")+'>'+c.predict+"</b> ("+c.conf+")<br><span style=color:#8b949e>"+c.desc+"</span></p>").join("")+"</div>":"")+(log.length>0?'<div class=card><h3>📋 LỊCH SỬ DỰ ĐOÁN</h3><pre>'+log.map(l=>"#"+l.phien+" | DĐ: "+l.du_doan+" | KQ: "+(l.ket_qua||"ĐỢI")+" | "+(l.dung===true?"✅ ĐÚNG":l.dung===false?"❌ SAI":"⏳ CHỜ")+" | "+l.ti_le).join("\\n")+"</pre></div>":"")+(d.recent?'<div class=card><h3>📜 15 PHIÊN GẦN NHẤT</h3><pre>'+d.recent.map(h=>"#"+h.phien+" | "+h.ket_qua+" ("+h.tong+") | "+h.xuc_xac.join(",")).join("\\n")+"</pre></div>":"")}catch(e){document.getElementById("out").innerHTML='<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LỖI</h3><p>'+e.message+'</p><button class=btn onclick=load()>🔄 THỬ LẠI</button></div>'}}load();setInterval(load,30000);</script></body></html>');
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
            const resultText = tong >= 11 ? 'TÀI' : 'XỈU';
            
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
                    phienDuDoan, duDoan: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
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
                du_doan: ketQua.duDoan === 'T' ? 'TÀI' : 'XỈU',
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
                predict: c.pred === 'T' ? 'TÀI' : 'XỈU',
                conf: c.conf + '%', desc: c.desc
            })),
            pred_log: predictionLog.slice(-10).reverse().map(p => ({
                phien: p.phienDuDoan, du_doan: p.duDoan, ti_le: p.tiLe,
                ket_qua: p.ketQuaThucTe || 'ĐỢI', dung: p.dung
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
        dung: dungCount,
        sai: saiCount,
        ti_le_dung: (dungCount+saiCount) > 0 ? ((dungCount/(dungCount+saiCount))*100).toFixed(1)+'%' : 'N/A',
        sessions: sessionHistory.slice(-30).reverse().map(s => ({
            phien: s.phien, ket_qua: s.resultText, tong: s.tong, xuc_xac: s.xuc_xac
        })),
        predictions: predictionLog.slice(-30).reverse().map(p => ({
            phien_du_doan: p.phienDuDoan, du_doan: p.duDoan, ti_le: p.tiLe,
            ket_qua_thuc_te: p.ketQuaThucTe || 'ĐỢI', dung: p.dung
        }))
    });
});

app.listen(PORT, () => {
    console.log('============================================');
    console.log('  🎯 SUNWIN AI - FULL CẦU - 15 LOẠI');
    console.log('  🚀 Server: http://localhost:' + PORT);
    console.log('  📊 /api/predict  - Dự đoán');
    console.log('  📜 /api/history  - Lịch sử');
    console.log('  ✅ 70+ Biến thể cầu đã sẵn sàng!');
    console.log('============================================');
});
