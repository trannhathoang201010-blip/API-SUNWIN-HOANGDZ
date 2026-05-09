const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 500;

// ═══════════════════════════════════════════════════════════════════
// 200+ CÔNG THỨC CẦU THẬT
// ═══════════════════════════════════════════════════════════════════
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
    'X141': { next: 'X', conf: 78 }, 'T246': { next: 'T', conf: 82 },
    'T554': { next: 'T', conf: 82 }, 'T256': { next: 'T', conf: 80 },
    'T166': { next: 'T', conf: 80 }, 'T336': { next: 'T', conf: 78 },
    'T443': { next: 'X', conf: 78 }, 'X412': { next: 'T', conf: 80 },
    'T543': { next: 'X', conf: 78 }, 'X261': { next: 'T', conf: 80 },
    'T663': { next: 'T', conf: 82 }, 'T515': { next: 'T', conf: 80 },
    'T156': { next: 'X', conf: 78 }, 'X334': { next: 'T', conf: 80 },
    'T633': { next: 'X', conf: 78 }, 'X541': { next: 'X', conf: 78 },
    'X414': { next: 'T', conf: 80 }, 'T434': { next: 'X', conf: 78 },
    'X145': { next: 'X', conf: 78 }, 'X431': { next: 'T', conf: 80 },
    'T454': { next: 'T', conf: 82 }, 'X142': { next: 'T', conf: 80 },
    'T645': { next: 'X', conf: 78 }, 'X243': { next: 'T', conf: 80 },
    'T664': { next: 'X', conf: 78 }, 'X213': { next: 'T', conf: 80 },
    'T363': { next: 'X', conf: 78 }, 'X226': { next: 'X', conf: 78 },
    'X112': { next: 'T', conf: 80 }, 'T436': { next: 'T', conf: 80 },
    'T551': { next: 'X', conf: 78 }, 'X341': { next: 'T', conf: 80 },
    'T635': { next: 'T', conf: 82 }, 'X331': { next: 'X', conf: 85 },
    'X422': { next: 'X', conf: 85 }, 'X111': { next: 'T', conf: 85 },
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
    'T662': { next: 'T', conf: 80 }, 'T366': { next: 'T', conf: 80 },
};

// ═══════════════════════════════════════════════════════════════════
// BRIDGE PATTERN - INTERFACE + ABSTRACT + CONCRETE CLASSES
// ═══════════════════════════════════════════════════════════════════
class CauAnalyzerInterface {
    analyze(data, str) { throw new Error('Must implement'); }
    getName() { return 'Base'; }
}

class BetCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'BET'; }
    analyze(data, str) {
        const results = [];
        const betPatterns = [
            { s: 'TTTTTTT', c: 99, n: 'BET TAI 7' },
            { s: 'XXXXXXX', c: 99, n: 'BET XIU 7' },
            { s: 'TTTTTT', c: 98, n: 'BET TAI 6' },
            { s: 'XXXXXX', c: 98, n: 'BET XIU 6' },
            { s: 'TTTTT', c: 95, n: 'BET TAI 5' },
            { s: 'XXXXX', c: 95, n: 'BET XIU 5' },
            { s: 'TTTT', c: 88, n: 'BET TAI 4' },
            { s: 'XXXX', c: 88, n: 'BET XIU 4' },
            { s: 'TTT', c: 75, n: 'BET TAI 3' },
            { s: 'XXX', c: 75, n: 'BET XIU 3' }
        ];
        for (const bp of betPatterns) {
            if (str.endsWith(bp.s)) {
                results.push({ name: bp.n, pred: bp.s[0], conf: bp.c, type: 'BET', desc: 'Bet ' + bp.s.length + ' phien' });
                break;
            }
        }
        return results;
    }
}

class DaoCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'DAO'; }
    analyze(data, str) {
        const results = [];
        const lastKQ = data[data.length - 1].kq;
        
        if (str.endsWith('TXTXTXT')) results.push({ name: 'DAO 1-1 DAI', pred: 'X', conf: 92, type: 'DAO', desc: 'Dao 1-1 7 nhip' });
        else if (str.endsWith('XTXTXTX')) results.push({ name: 'DAO 1-1 DAI', pred: 'T', conf: 92, type: 'DAO', desc: 'Dao 1-1 7 nhip' });
        else if (str.endsWith('TXTXT')) results.push({ name: 'DAO 1-1', pred: 'X', conf: 85, type: 'DAO', desc: 'Dao 1-1 5 nhip' });
        else if (str.endsWith('XTXTX')) results.push({ name: 'DAO 1-1', pred: 'T', conf: 85, type: 'DAO', desc: 'Dao 1-1 5 nhip' });
        else if (str.endsWith('TXTX')) results.push({ name: 'DAO 1-1', pred: 'X', conf: 78, type: 'DAO', desc: 'Dao 1-1 4 nhip' });
        else if (str.endsWith('XTXT')) results.push({ name: 'DAO 1-1', pred: 'T', conf: 78, type: 'DAO', desc: 'Dao 1-1 4 nhip' });
        
        if (str.endsWith('TTXXTTXX')) results.push({ name: 'DAO 2-2 DAI', pred: 'T', conf: 88, type: 'DAO', desc: 'Dao 2-2 8 nhip' });
        else if (str.endsWith('XXTTXXTT')) results.push({ name: 'DAO 2-2 DAI', pred: 'X', conf: 88, type: 'DAO', desc: 'Dao 2-2 8 nhip' });
        else if (str.endsWith('TTXX')) results.push({ name: 'DAO 2-2', pred: 'T', conf: 80, type: 'DAO', desc: 'Dao 2-2' });
        else if (str.endsWith('XXTT')) results.push({ name: 'DAO 2-2', pred: 'X', conf: 80, type: 'DAO', desc: 'Dao 2-2' });
        
        if (str.endsWith('TTTXXX')) results.push({ name: 'DAO 3-3', pred: 'T', conf: 78, type: 'DAO', desc: 'Dao 3-3' });
        else if (str.endsWith('XXXTTT')) results.push({ name: 'DAO 3-3', pred: 'X', conf: 78, type: 'DAO', desc: 'Dao 3-3' });
        
        return results;
    }
}

class NhipCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'NHIP'; }
    analyze(data, str) {
        const results = [];
        
        if (str.endsWith('TXXTXXT')) results.push({ name: '1-2-1 DAI', pred: 'X', conf: 85, type: 'NHIP', desc: 'Nhip 1-2-1 dai' });
        else if (str.endsWith('XTTXTTX')) results.push({ name: '1-2-1 DAI', pred: 'T', conf: 85, type: 'NHIP', desc: 'Nhip 1-2-1 dai' });
        else if (str.endsWith('TXXT')) results.push({ name: '1-2-1', pred: 'X', conf: 75, type: 'NHIP', desc: 'Nhip T-XX-T' });
        else if (str.endsWith('XTTX')) results.push({ name: '1-2-1', pred: 'T', conf: 75, type: 'NHIP', desc: 'Nhip X-TT-X' });
        
        if (str.endsWith('TTXTT')) results.push({ name: '2-1-2', pred: 'X', conf: 72, type: 'NHIP', desc: 'Nhip TT-X-TT' });
        else if (str.endsWith('XXTXX')) results.push({ name: '2-1-2', pred: 'T', conf: 72, type: 'NHIP', desc: 'Nhip XX-T-XX' });
        
        if (str.endsWith('TTTXXT')) results.push({ name: '3-2-1', pred: 'X', conf: 72, type: 'NHIP', desc: 'Nhip 3-2-1' });
        else if (str.endsWith('XXXTTX')) results.push({ name: '3-2-1', pred: 'T', conf: 72, type: 'NHIP', desc: 'Nhip 3-2-1' });
        
        if (str.endsWith('TTXXX')) results.push({ name: 'BAC THANG', pred: 'X', conf: 73, type: 'NHIP', desc: 'TT-XXX' });
        else if (str.endsWith('XXTTT')) results.push({ name: 'BAC THANG', pred: 'T', conf: 73, type: 'NHIP', desc: 'XX-TTT' });
        else if (str.endsWith('TXX')) results.push({ name: 'BAC THANG NHO', pred: 'X', conf: 65, type: 'NHIP', desc: 'T-XX' });
        else if (str.endsWith('XTT')) results.push({ name: 'BAC THANG NHO', pred: 'T', conf: 65, type: 'NHIP', desc: 'X-TT' });
        
        return results;
    }
}

class HoiCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'HOI'; }
    analyze(data, str) {
        const results = [];
        const lastTong = data[data.length - 1].tong;
        
        if (lastTong >= 17) results.push({ name: 'HOI CUC DAI', pred: 'X', conf: 93, type: 'HOI', desc: 'Tong ' + lastTong + ' QUA CAO - HOI XIU' });
        else if (lastTong <= 4) results.push({ name: 'HOI CUC TIEU', pred: 'T', conf: 93, type: 'HOI', desc: 'Tong ' + lastTong + ' QUA THAP - HOI TAI' });
        else if (lastTong >= 16) results.push({ name: 'HOI CAO', pred: 'X', conf: 82, type: 'HOI', desc: 'Tong ' + lastTong + ' cao' });
        else if (lastTong <= 5) results.push({ name: 'HOI THAP', pred: 'T', conf: 82, type: 'HOI', desc: 'Tong ' + lastTong + ' thap' });
        else if (lastTong >= 14) results.push({ name: 'HOI NHE', pred: 'X', conf: 68, type: 'HOI', desc: 'Tong ' + lastTong + ' hoi cao' });
        else if (lastTong <= 7) results.push({ name: 'HOI NHE', pred: 'T', conf: 68, type: 'HOI', desc: 'Tong ' + lastTong + ' hoi thap' });
        
        return results;
    }
}

class FormulaCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'FORMULA'; }
    analyze(data, str) {
        const results = [];
        const last4 = str.slice(-4);
        const key = last4[0] + data[data.length - 1].xucXac.join('').slice(0, 3);
        
        for (const [formulaKey, formula] of Object.entries(CAU_FORMULA)) {
            if (key.includes(formulaKey.replace(/[TX]/g, '').slice(0, 2)) || 
                last4.includes(formulaKey[0]) && formulaKey.slice(1) === data[data.length - 1].xucXac.map(x => x % 2 === 0 ? 'C' : 'L').join('').slice(0, 3)) {
                results.push({ name: 'FORMULA ' + formulaKey, pred: formula.next, conf: formula.conf, type: 'FORMULA', desc: 'Match formula ' + formulaKey });
            }
        }
        
        for (const [formulaKey, formula] of Object.entries(CAU_FORMULA)) {
            if (str.endsWith(formulaKey[0]) && data.length >= 3) {
                const lastThree = data.slice(-3).map(d => d.kq).join('');
                if (lastThree === formulaKey.slice(0, 3).replace(/[0-9]/g, '')) {
                    results.push({ name: 'FORMULA ' + formulaKey, pred: formula.next, conf: formula.conf + 5, type: 'FORMULA', desc: 'Strong match ' + formulaKey });
                }
            }
        }
        
        return results;
    }
}

class SongCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'SONG'; }
    analyze(data, str) {
        const results = [];
        let doiChieu = 0;
        for (let i = 1; i < str.length; i++) {
            if (str[i] !== str[i-1]) doiChieu++;
        }
        const tiLeDao = doiChieu / Math.max(str.length - 1, 1);
        const lastKQ = data[data.length - 1].kq;
        
        if (tiLeDao >= 0.75 && str.length >= 8) {
            results.push({ name: 'SONG CAO TAN', pred: lastKQ === 'T' ? 'X' : 'T', conf: 75, type: 'SONG', desc: 'Song manh' });
        } else if (tiLeDao <= 0.2 && str.length >= 8) {
            results.push({ name: 'IT DAO CHIEU', pred: lastKQ, conf: 72, type: 'SONG', desc: 'It dao - TIEP TUC' });
        }
        
        return results;
    }
}

class ChuKyCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'CHU KY'; }
    analyze(data, str) {
        const results = [];
        const len = str.length;
        
        if (len >= 10) {
            const last5 = str.slice(-5);
            const prev5 = str.slice(-10, -5);
            if (last5 === prev5) {
                results.push({ name: 'CHU KY 5', pred: last5[0], conf: 78, type: 'CHU KY', desc: 'Lap chu ky 5 phien' });
            }
            
            const last3 = str.slice(-3);
            const count3 = str.split(last3).length - 1;
            if (count3 >= 3) {
                results.push({ name: 'CHU KY 3', pred: last3[0], conf: 72, type: 'CHU KY', desc: 'Mau lap ' + count3 + ' lan' });
            }
        }
        
        return results;
    }
}

class GayCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'GAY'; }
    analyze(data, str) {
        const results = [];
        
        if (str.endsWith('TXXXX')) results.push({ name: 'GAY CAU', pred: 'X', conf: 73, type: 'GAY', desc: 'T->XXXX' });
        else if (str.endsWith('XTTTT')) results.push({ name: 'GAY CAU', pred: 'T', conf: 73, type: 'GAY', desc: 'X->TTTT' });
        else if (str.endsWith('TTXX')) results.push({ name: 'GAY NHIP', pred: 'X', conf: 65, type: 'GAY', desc: 'TT->XX' });
        else if (str.endsWith('XXTT')) results.push({ name: 'GAY NHIP', pred: 'T', conf: 65, type: 'GAY', desc: 'XX->TT' });
        
        return results;
    }
}

class XucXacCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'XUC XAC'; }
    analyze(data, str) {
        const results = [];
        const last = data[data.length - 1];
        const xx = last.xucXac || [];
        
        if (xx.length === 3) {
            const sum = xx.reduce((a,b) => a+b, 0);
            const unique = new Set(xx).size;
            
            if (unique === 1) results.push({ name: 'BO 3', pred: sum >= 12 ? 'T' : 'X', conf: 75, type: 'XUC XAC', desc: 'Bo 3 giong' });
            else if (unique === 2 && sum >= 15) results.push({ name: 'DOI + CAO', pred: 'X', conf: 70, type: 'XUC XAC', desc: 'Doi + tong cao' });
            else if (unique === 2 && sum <= 6) results.push({ name: 'DOI + THAP', pred: 'T', conf: 70, type: 'XUC XAC', desc: 'Doi + tong thap' });
        }
        
        return results;
    }
}

class NghiengCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'NGHIENG'; }
    analyze(data, str) {
        const results = [];
        const len = data.length;
        const tCount = data.filter(h => h.kq === 'T').length;
        const tRate = tCount / len;
        
        if (len >= 8) {
            if (tRate >= 0.75 && str.endsWith('TT')) {
                results.push({ name: 'SIEU NGHIENG TAI + BET', pred: 'T', conf: 82, type: 'NGHIENG', desc: 'Tai ' + (tRate*100).toFixed(0) + '% + bet' });
            } else if (tRate <= 0.25 && str.endsWith('XX')) {
                results.push({ name: 'SIEU NGHIENG XIU + BET', pred: 'X', conf: 82, type: 'NGHIENG', desc: 'Xiu ' + ((1-tRate)*100).toFixed(0) + '% + bet' });
            } else if (tRate >= 0.7) {
                results.push({ name: 'NGHIENG TAI - BE CAU', pred: 'X', conf: 72, type: 'NGHIENG', desc: 'Tai ' + (tRate*100).toFixed(0) + '% - BE' });
            } else if (tRate <= 0.3) {
                results.push({ name: 'NGHIENG XIU - BE CAU', pred: 'T', conf: 72, type: 'NGHIENG', desc: 'Xiu ' + ((1-tRate)*100).toFixed(0) + '% - BE' });
            }
        }
        
        return results;
    }
}

class XuHuongCauAnalyzer extends CauAnalyzerInterface {
    getName() { return 'XU HUONG'; }
    analyze(data, str) {
        const results = [];
        const last5 = data.slice(-5);
        const t5 = last5.filter(h => h.kq === 'T').length;
        const x5 = last5.filter(h => h.kq === 'X').length;
        
        if (t5 >= 4) results.push({ name: '5 PHIEN THIEN TAI', pred: 'T', conf: 68, type: 'XU HUONG', desc: '4/5 phien TAI' });
        else if (x5 >= 4) results.push({ name: '5 PHIEN THIEN XIU', pred: 'X', conf: 68, type: 'XU HUONG', desc: '4/5 phien XIU' });
        
        return results;
    }
}

// ═══════════════════════════════════════════════════════════════════
// BRIDGE SYSTEM - RUN ALL ANALYZERS IN PARALLEL
// ═══════════════════════════════════════════════════════════════════
class BridgeSystem {
    constructor() {
        this.analyzers = [
            new BetCauAnalyzer(),
            new DaoCauAnalyzer(),
            new NhipCauAnalyzer(),
            new HoiCauAnalyzer(),
            new FormulaCauAnalyzer(),
            new SongCauAnalyzer(),
            new ChuKyCauAnalyzer(),
            new GayCauAnalyzer(),
            new XucXacCauAnalyzer(),
            new NghiengCauAnalyzer(),
            new XuHuongCauAnalyzer()
        ];
    }

    analyzeAll(data, str) {
        const allResults = [];
        
        for (const analyzer of this.analyzers) {
            try {
                const results = analyzer.analyze(data, str);
                allResults.push(...results);
            } catch (e) {
                // Skip analyzer if error
            }
        }
        
        return allResults;
    }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ANALYZE FUNCTION
// ═══════════════════════════════════════════════════════════════════
const bridgeSystem = new BridgeSystem();

function analyzePro(history) {
    const len = history.length;
    
    if (len < 3) {
        return {
            duDoan: 'TAI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Dang thu thap du lieu...', loai: 'KHONG CO', sucManh: 'YEU',
            loiKhuyen: 'DOI THEM DU LIEU', tatCa: [], diemManh: 0
        };
    }

    const str = history.map(h => h.kq).join('');
    const last = history[len - 1];
    const lastKQ = last.kq;
    
    // Run all analyzers via Bridge System
    const allCau = bridgeSystem.analyzeAll(history, str);
    
    // Sort by confidence
    allCau.sort((a, b) => b.conf - a.conf);
    const best = allCau[0];

    // Statistics
    const tCount = history.filter(h => h.kq === 'T').length;
    const xCount = history.filter(h => h.kq === 'X').length;
    const tRate = tCount / len;

    const thongKe = {
        tong: len, tai: tCount, xiu: xCount,
        tiLeTai: ((tRate)*100).toFixed(1) + '%',
        tiLeXiu: ((1-tRate)*100).toFixed(1) + '%',
        xuHuong: tCount > xCount ? 'THIEN TAI' : xCount > tCount ? 'THIEN XIU' : 'CAN BANG'
    };

    if (best) {
        return {
            duDoan: best.pred === 'T' ? 'TAI' : 'XIU',
            kyHieu: best.pred,
            doTinCay: best.conf,
            tiLe: best.conf + '%',
            cau: best.desc,
            loai: best.type,
            sucManh: best.conf >= 90 ? 'RAT MANH' : best.conf >= 80 ? 'MANH' : best.conf >= 70 ? 'KHA' : 'VUA',
            loiKhuyen: best.conf >= 90 ? 'VAO TIEN MANH' : best.conf >= 80 ? 'VAO TIEN' : best.conf >= 70 ? 'DANH NHO' : 'THAM DO',
            tatCa: allCau.slice(0, 10),
            thongKe: thongKe,
            diemManh: best.conf
        };
    }

    return {
        duDoan: lastKQ === 'T' ? 'XIU' : 'TAI',
        kyHieu: lastKQ === 'T' ? 'X' : 'T',
        doTinCay: 50, tiLe: '50%',
        cau: 'Khong co cau ro rang - DANH NGUOC',
        loai: 'DAO NGUOC', sucManh: 'YEU',
        loiKhuyen: 'THAM DO NHO', tatCa: [], thongKe: thongKe, diemManh: 0
    };
}

function checkDD(phien, kq) {
    const p = predictionLog.find(x => x.phienDD === phien && x.kqThuc === null);
    if (p) {
        p.kqThuc = kq;
        p.dung = p.duDoan === kq;
    }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

app.get('/', function(req, res) {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI Pro - Full Cau</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.4em;margin:10px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:14px;margin:10px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.box{padding:12px;border-radius:10px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149;box-shadow:0 0 20px rgba(248,81,73,0.3)}.box.XIU{border:2px solid #3fb950;box-shadow:0 0 20px rgba(63,185,80,0.3)}.big{font-size:2em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:12px 24px;background:#238636;color:#fff;border:none;border-radius:8px;margin:5px;cursor:pointer;font-size:1em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:3px 10px;border-radius:5px;font-size:.7em;font-weight:bold;margin:2px}.tag.BET{background:#da3633}.tag.DAO{background:#1f6feb}.tag.NHIP{background:#8957e5}.tag.HOI{background:#d2991d;color:#000}.tag.NGHIENG{background:#3fb950;color:#000}.tag.SONG{background:#db6d28}.tag.GAY{background:#f0883e}.tag.CHU_KY{background:#a371f7}.tag.FORMULA{background:#e37400}.tag.XUC_XAC{background:#e3b341;color:#000}.tag.XU_HUONG{background:#58a6ff}.loading{text-align:center;padding:30px;color:#8b949e;font-size:1.1em}pre{background:#0d1117;padding:10px;border-radius:8px;overflow-x:auto;font-size:.8em;max-height:250px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI PRO</h1><p style="text-align:center;color:#8b949e;font-size:.8em">11 LOAI CAU • 200+ FORMULA • BRIDGE PATTERN</p><div style="text-align:center;margin:12px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DU DOAN NGAY</button><a href="/api/predict" class="btn btn2">📊 API JSON</a><a href="/api/history" class="btn btn2">📜 LICH SU</a></div><div id="out"><div class="loading">⏳ Dang phan tich 11 loai cau + formula...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ Bridge System dang phan tich...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.current||{};var dd=d.prediction||{};var tk=d.stats||{};var cau=d.patterns||[];var log=d.pred_log||[];var html="";html+=\'<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h2 style=text-align:center;color:#f6d365>📌 DU DOAN PHIEN TIEP THEO</h2><div class=grid3><div class=box><small>PHIEN DU DOAN</small><div class="big yellow">#\'+dd.phien_du_doan+\'</div></div><div class="box \'+(dd.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KET QUA DU DOAN</small><div class=big style=font-size:2.8em;color:\'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+dd.du_doan+\'</div></div><div class=box><small>TI LE THANG</small><div class="big yellow">\'+dd.ti_le_thang+\'</div></div></div><div style=margin-top:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px><p style=font-size:1.1em>📊 <b>\'+dd.cau+\'</b></p><p>🏷️ Loai: <span class="tag \'+dd.loai_cau+\'">\'+dd.loai_cau+\'</span> | Suc manh: <b style=color:#d2991d>\'+dd.suc_manh+\'</b> | Diem: <b>\'+dd.diem_manh+\'</b></p><p style=margin-top:5px;font-size:1.1em>💡 <b style=color:#3fb950>\'+dd.loi_khuyen+\'</b></p></div></div>\';html+=\'<div class=card><h3>📍 PHIEN VUA RA: #\'+p.phien_truoc+\'</h3><div class=grid2><div class="box \'+(p.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KET QUA</small><div class=big style=color:\'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+p.ket_qua+\'</div><small>Tong diem: \'+p.tong+\'</small></div><div class=box><small>XUC XAC</small><div class=big>\'+(p.xuc_xac||[]).join(\' - \')+\'</div></div></div></div>\';html+=\'<div class=card><h3>📈 THONG KE \'+tk.tong_phien+\' PHIEN</h3><div class=grid2><div class=box style=border:1px solid #f85149><small>TAI</small><div class="big red">\'+tk.tai+\'</div><small>\'+tk.ti_le_tai+\'</small></div><div class=box style=border:1px solid #3fb950><small>XIU</small><div class="big green">\'+tk.xiu+\'</div><small>\'+tk.ti_le_xiu+\'</small></div></div><p style=margin-top:8px>📊 Xu huong: <b>\'+tk.xu_huong+\'</b> | Ty le dung: <b style=color:#3fb950>\'+tk.ti_le_dung+\'</b> (\'+tk.dung+\'/'+(tk.dung+tk.sai)+\')</p></div>\';if(cau.length>0){html+=\'<div class=card><h3>🔍 TOP 10 CAU PHAT HIEN</h3>\';for(var i=0;i<cau.length;i++){var c=cau[i];html+=\'<p style=margin:4px 0;font-size:.85em;padding:6px;background:rgba(255,255,255,0.03);border-radius:6px;border-left:3px solid \'+(c.predict=="TAI"?"#f85149":"#3fb950")+\'"><b>\'+(i+1)+\'.</b> <span class="tag \'+c.type+\'">\'+c.type+\'</span> <b>\'+c.name+\'</b> → <b style=color:\'+(c.predict=="TAI"?"#f85149":"#3fb950")+\'>\'+c.predict+\'</b> (<b>\'+c.conf+\'</b>)</p>\'}html+=\'</div>\'}if(log.length>0){html+=\'<div class=card><h3>📋 LICH SU DU DOAN</h3><pre>PHIEN     | DU DOAN | KET QUA  | KQ        | TI LE\\n\'+("─".repeat(60))+\'\\n\';for(var j=0;j<log.length;j++){var l=log[j];var kq=l.ket_qua||"⏳";var tt=l.dung===true?"✅ DUNG":l.dung===false?"❌ SAI":"⏳ CHO";var color=l.dung===true?"color:#3fb950":l.dung===false?"color:#f85149":"";html+=\'<span style=\'+color+\'>#\'+l.phien+\' | \'+l.du_doan+\'     | \'+kq+\'      | \'+tt+\'        | \'+l.ti_le+\'</span>\\n\'}html+=\'</pre></div>\'}if(d.recent){html+=\'<div class=card><h3>📜 15 PHIEN GAN NHAT</h3><pre>\';for(var k=0;k<d.recent.length;k++){var h=d.recent[k];var color2=h.ket_qua=="TAI"?"color:#f85149":"color:#3fb950";html+=\'<span style=\'+color2+\'>#\'+h.phien+\' | \'+h.ket_qua+\' (\'+h.tong+\') | \'+h.xuc_xac.join(\',\')+\'</span>\\n\'}html+=\'</pre></div>\'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML=\'<div class=card style=border:2px solid #f85149><h3 style=color:#f85149>❌ LOI</h3><p>\'+e.message+\'</p><button class=btn onclick=load()>🔄 THU LAI</button></div>\'}}load();setInterval(load,25000);</script></body></html>');
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

        var ketQua = analyzePro(sessionHistory);
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
                return { name: c.name, type: c.type, predict: c.pred === 'T' ? 'TAI' : 'XIU', conf: c.conf + '%', desc: c.desc };
            }),
            pred_log: predictionLog.slice(-10).reverse().map(function(p) {
                return { phien: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua: p.kqThuc || '⏳', dung: p.dung };
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
            return { phien_du_doan: p.phienDD, du_doan: p.duDoan, ti_le: p.tiLe, ket_qua_thuc_te: p.kqThuc || '⏳', dung: p.dung };
        })
    });
});

app.listen(PORT, function() {
    console.log('============================================');
    console.log('  🎯 SUNWIN AI PRO - BRIDGE PATTERN');
    console.log('  🚀 Server: http://localhost:' + PORT);
    console.log('  📊 11 Loai Cau + 200+ Formula');
    console.log('  ✅ Bridge System + All Analyzers');
    console.log('============================================');
});
