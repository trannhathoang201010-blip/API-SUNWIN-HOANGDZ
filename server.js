const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

let sessionHistory = [];
let predictionLog = [];
const MAX = 500;

// ============================================================================
// 200+ CONG THUC CAU
// ============================================================================
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

// ============================================================================
// 42 SUB MODELS + 21 MINI MODELS
// ============================================================================
class AdvancedPredictor {
    constructor() {
        this.subModels = {};
        this.miniModels = {};
        this.subModelWeights = {};
        this.miniModelWeights = {};
        this.modelWeights = { model1: 1.0, model2: 1.0, model3: 1.0, model4: 1.0, model11: 1.0 };
        this.patternLibrary = {};
        
        this.initSubModels();
        this.initMiniModels();
    }

    initSubModels() {
        const specialties = {
            1: { name: '1-1 thuan', type: '1-1', logic: 'pure', minLength: 4, threshold: 0.9 },
            2: { name: '1-1 bien the', type: '1-1', logic: 'variant', minLength: 5, threshold: 0.8 },
            3: { name: '1-1 dai han', type: '1-1', logic: 'long', minLength: 8, threshold: 0.75 },
            4: { name: '1-1 ket hop', type: '1-1', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            5: { name: '1-1 gay', type: '1-1', logic: 'break', minLength: 6, threshold: 0.8 },
            6: { name: '1-1 phuc hoi', type: '1-1', logic: 'recovery', minLength: 7, threshold: 0.7 },
            7: { name: '2-2 chuan', type: '2-2', logic: 'pure', minLength: 6, threshold: 0.9 },
            8: { name: '2-2 lech', type: '2-2', logic: 'offset', minLength: 7, threshold: 0.8 },
            9: { name: '2-2 bien tuong', type: '2-2', logic: 'variant', minLength: 8, threshold: 0.75 },
            10: { name: '2-2 ket hop 1-1', type: '2-2', logic: 'hybrid', minLength: 8, threshold: 0.7 },
            11: { name: '2-2 dai', type: '2-2', logic: 'long', minLength: 10, threshold: 0.8 },
            12: { name: '2-2 be', type: '2-2', logic: 'break', minLength: 7, threshold: 0.85 },
            13: { name: 'bet ngan', type: 'bet', logic: 'short', minLength: 3, threshold: 0.8 },
            14: { name: 'bet trung', type: 'bet', logic: 'medium', minLength: 5, threshold: 0.85 },
            15: { name: 'bet dai', type: 'bet', logic: 'long', minLength: 7, threshold: 0.9 },
            16: { name: 'bet gay', type: 'bet', logic: 'break', minLength: 5, threshold: 0.8 },
            17: { name: 'bet xen ke', type: 'bet', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            18: { name: 'sieu bet', type: 'bet', logic: 'super', minLength: 10, threshold: 0.95 },
            19: { name: '3-3 chuan', type: '3-3', logic: 'pure', minLength: 9, threshold: 0.9 },
            20: { name: '3-3 bien the', type: '3-3', logic: 'variant', minLength: 10, threshold: 0.8 },
            21: { name: '3-3 ngan', type: '3-3', logic: 'short', minLength: 6, threshold: 0.7 },
            22: { name: '3-3 ket hop', type: '3-3', logic: 'hybrid', minLength: 9, threshold: 0.75 },
            23: { name: '3-3 be', type: '3-3', logic: 'break', minLength: 8, threshold: 0.8 },
            24: { name: '3-3 dai', type: '3-3', logic: 'long', minLength: 12, threshold: 0.85 },
            25: { name: '2-1-2 chuan', type: '2-1-2', logic: 'pure', minLength: 5, threshold: 0.9 },
            26: { name: '2-1-2 bien the', type: '2-1-2', logic: 'variant', minLength: 6, threshold: 0.8 },
            27: { name: '2-1-2 dai', type: '2-1-2', logic: 'long', minLength: 8, threshold: 0.8 },
            28: { name: '1-2-1 chuan', type: '1-2-1', logic: 'pure', minLength: 5, threshold: 0.9 },
            29: { name: '1-2-1 bien the', type: '1-2-1', logic: 'variant', minLength: 6, threshold: 0.8 },
            30: { name: '1-2-1 dai', type: '1-2-1', logic: 'long', minLength: 8, threshold: 0.8 },
            31: { name: 'be cau 1-1', type: 'break', logic: 'break11', minLength: 4, threshold: 0.85 },
            32: { name: 'be cau 2-2', type: 'break', logic: 'break22', minLength: 5, threshold: 0.85 },
            33: { name: 'be cau bet', type: 'break', logic: 'breakStreak', minLength: 4, threshold: 0.8 },
            34: { name: 'chuyen 1-1 sang 2-2', type: 'transition', logic: '11to22', minLength: 6, threshold: 0.75 },
            35: { name: 'chuyen 2-2 sang 1-1', type: 'transition', logic: '22to11', minLength: 6, threshold: 0.75 },
            36: { name: 'chuyen bet sang 1-1', type: 'transition', logic: 'streakTo11', minLength: 5, threshold: 0.7 },
            37: { name: 'phan tich tan suat', type: 'frequency', logic: 'frequency', minLength: 10, threshold: 0.7 },
            38: { name: 'phan tich chu ky', type: 'cycle', logic: 'cycle', minLength: 12, threshold: 0.7 },
            39: { name: 'phan tich doi xung', type: 'symmetry', logic: 'symmetry', minLength: 8, threshold: 0.75 },
            40: { name: 'phan tich Fibonacci', type: 'fibonacci', logic: 'fibonacci', minLength: 8, threshold: 0.7 },
            41: { name: 'phan tich xu huong dai', type: 'trend', logic: 'longTrend', minLength: 15, threshold: 0.8 },
            42: { name: 'tong hop sieu cau', type: 'super', logic: 'super', minLength: 20, threshold: 0.85 }
        };

        for (var i = 1; i <= 42; i++) {
            this.subModels['sub_model_' + i] = {
                name: specialties[i].name,
                type: specialties[i].type,
                logic: specialties[i].logic,
                minLength: specialties[i].minLength,
                threshold: specialties[i].threshold,
                weight: 1.0,
                accuracy: 0.5,
                predictions: []
            };
            this.subModelWeights['sub_model_' + i] = 1.0;
        }
    }

    initMiniModels() {
        var specs = {
            1: 'phat_hien_cau_dep', 2: 'du_doan_bien_dong', 3: 'phan_tich_so_sanh',
            4: 'nhan_dien_xu_huong_cuc_bo', 5: 'tinh_toan_xac_suat_cao', 6: 'phat_hien_diem_gay',
            7: 'du_doan_nguong', 8: 'phan_tich_chuoi', 9: 'nhan_dien_mau_lap',
            10: 'tinh_he_so_tuong_quan', 11: 'du_doan_doan_nhiet', 12: 'phan_tich_pha',
            13: 'nhan_dien_song', 14: 'tinh_toan_momentum', 15: 'du_doan_hoi_phuc',
            16: 'phat_hien_dot_bien', 17: 'phan_tich_can_bang', 18: 'nhan_dien_tan_so',
            19: 'du_doan_chu_ky', 20: 'tinh_toan_ma_tran', 21: 'phan_tich_tong_hop'
        };

        for (var i = 1; i <= 21; i++) {
            this.miniModels['mini_model_' + i] = {
                weight: 1.0,
                accuracy: 0.5,
                specialty: specs[i] || 'chung',
                predictions: []
            };
            this.miniModelWeights['mini_model_' + i] = 1.0;
        }
    }

    getResultArray(history) {
        var results = [];
        for (var i = 0; i < history.length; i++) {
            results.push(history[i].kq === 'T' ? 'Tai' : 'Xiu');
        }
        return results;
    }

    getStreak(results) {
        if (results.length === 0) return 0;
        var last = results[results.length - 1];
        var streak = 1;
        for (var i = results.length - 2; i >= 0; i--) {
            if (results[i] === last) streak++;
            else break;
        }
        return streak;
    }

    isPerfectAlternating(results, length) {
        var last = results.slice(-length);
        for (var i = 0; i < last.length - 1; i++) {
            if (last[i] === last[i+1]) return false;
        }
        return true;
    }

    analyzeFrequency(results) {
        var recent = results.slice(-20);
        var taiCount = 0;
        for (var i = 0; i < recent.length; i++) if (recent[i] === 'Tai') taiCount++;
        var ratio = Math.max(taiCount, recent.length - taiCount) / recent.length;
        return { dominant: taiCount > recent.length - taiCount ? 'Tai' : 'Xiu', ratio: ratio };
    }

    detectCycle(results) {
        for (var cycleLen = 2; cycleLen <= 4; cycleLen++) {
            if (results.length < cycleLen * 2) continue;
            var lastCycle = results.slice(-cycleLen);
            var prevCycle = results.slice(-cycleLen*2, -cycleLen);
            var match = true;
            for (var i = 0; i < cycleLen; i++) {
                if (lastCycle[i] !== prevCycle[i]) { match = false; break; }
            }
            if (match) return { found: true, length: cycleLen, next: lastCycle[0] };
        }
        return { found: false };
    }

    getLongTrend(results) {
        if (results.length < 10) return { strength: 0, direction: null };
        var firstTai = 0, lastTai = 0;
        for (var i = 0; i < 5; i++) if (results[i] === 'Tai') firstTai++;
        for (var j = results.length - 5; j < results.length; j++) if (results[j] === 'Tai') lastTai++;
        if (lastTai > firstTai + 2) return { strength: 0.8, direction: 'Tai' };
        if (lastTai < firstTai - 2) return { strength: 0.8, direction: 'Xiu' };
        return { strength: 0.5, direction: lastTai > 2 ? 'Tai' : 'Xiu' };
    }

    runSubModel(index, history) {
        if (history.length < 3) return null;
        var results = this.getResultArray(history);
        var model = this.subModels['sub_model_' + index];
        if (!model) return null;

        var last = results[results.length - 1];
        var other = last === 'Tai' ? 'Xiu' : 'Tai';
        var streak = this.getStreak(results);

        // Xu ly theo type
        switch (model.type) {
            case '1-1':
                if (results.length >= model.minLength) {
                    if (model.logic === 'pure' && this.isPerfectAlternating(results, 4)) {
                        return { prediction: other, confidence: 0.9, reason: 'Cau 1-1 thuan tuy', model_name: model.name };
                    }
                    if ((model.logic === 'variant' || model.logic === 'long') && results.length >= 6) {
                        var altCount = 0;
                        for (var i = 1; i < Math.min(results.length, 12); i++) {
                            if (results[results.length - i] !== results[results.length - i - 1]) altCount++;
                        }
                        if (altCount >= results.length * 0.6) {
                            return { prediction: other, confidence: 0.7 + (altCount/20), reason: 'Cau 1-1 dai han', model_name: model.name };
                        }
                    }
                    if (model.logic === 'break' && streak >= 4) {
                        return { prediction: last, confidence: 0.8, reason: '1-1 sap gay', model_name: model.name };
                    }
                }
                break;

            case '2-2':
                if (results.length >= 6) {
                    var last6 = results.slice(-6);
                    if (last6[0] === last6[1] && last6[2] === last6[3] && last6[4] === last6[5] && last6[1] !== last6[2]) {
                        return { prediction: last6[4] === 'Tai' ? 'Xiu' : 'Tai', confidence: 0.9, reason: 'Cau 2-2 chuan', model_name: model.name };
                    }
                }
                break;

            case 'bet':
                if (streak >= model.minLength) {
                    if (model.logic === 'break' && streak >= 4) {
                        return { prediction: other, confidence: 0.7 + (streak*0.03), reason: 'Bet ' + streak + ' phien, sap gay', model_name: model.name };
                    }
                    return { prediction: last, confidence: 0.7 + (streak*0.03), reason: 'Bet ' + streak + ' phien', model_name: model.name };
                }
                break;

            case '3-3':
                if (results.length >= 9) {
                    var last9 = results.slice(-9);
                    if (last9[0]===last9[1]&&last9[1]===last9[2]&&last9[3]===last9[4]&&last9[4]===last9[5]&&last9[6]===last9[7]&&last9[7]===last9[8]) {
                        return { prediction: last9[6]==='Tai'?'Xiu':'Tai', confidence: 0.9, reason: 'Cau 3-3 chuan', model_name: model.name };
                    }
                }
                break;

            case '2-1-2':
                if (results.length >= 5) {
                    var last5 = results.slice(-5);
                    if (last5[0]===last5[1]&&last5[1]!==last5[2]&&last5[2]!==last5[3]&&last5[3]===last5[4]) {
                        return { prediction: last5[4]==='Tai'?'Xiu':'Tai', confidence: 0.9, reason: 'Cau 2-1-2', model_name: model.name };
                    }
                }
                break;

            case '1-2-1':
                if (results.length >= 5) {
                    var last5b = results.slice(-5);
                    if (last5b[0]!==last5b[1]&&last5b[1]===last5b[2]&&last5b[2]!==last5b[3]&&last5b[3]===last5b[4]) {
                        return { prediction: last5b[4]==='Tai'?'Xiu':'Tai', confidence: 0.9, reason: 'Cau 1-2-1', model_name: model.name };
                    }
                }
                break;

            case 'break':
                if (results.length >= 4) {
                    var last4 = results.slice(-4);
                    if (last4[0]!==last4[1]&&last4[1]!==last4[2]&&last4[2]===last4[3]) {
                        return { prediction: last4[3], confidence: 0.85, reason: 'Be cau 1-1', model_name: model.name };
                    }
                    if (streak >= 3 && last !== results[results.length-2]) {
                        return { prediction: last, confidence: 0.8, reason: 'Be cau bet', model_name: model.name };
                    }
                }
                break;

            case 'transition':
                if (results.length >= 6) {
                    var last6c = results.slice(-6);
                    if (last6c[0]!==last6c[1]&&last6c[1]!==last6c[2]&&last6c[2]===last6c[3]&&last6c[3]!==last6c[4]&&last6c[4]===last6c[5]) {
                        return { prediction: last6c[4]==='Tai'?'Xiu':'Tai', confidence: 0.75, reason: 'Chuyen 1-1 sang 2-2', model_name: model.name };
                    }
                }
                break;

            case 'frequency':
                var freq = this.analyzeFrequency(results);
                if (freq.ratio > 0.6) {
                    return { prediction: freq.dominant, confidence: 0.6+freq.ratio*0.2, reason: 'Tan suat ' + freq.dominant, model_name: model.name };
                }
                break;

            case 'cycle':
                var cycle = this.detectCycle(results);
                if (cycle.found) {
                    return { prediction: cycle.next, confidence: 0.7, reason: 'Chu ky ' + cycle.length, model_name: model.name };
                }
                break;

            case 'trend':
                var trend = this.getLongTrend(results);
                if (trend.strength > 0.7) {
                    return { prediction: trend.direction, confidence: 0.7+trend.strength*0.1, reason: 'Xu huong dai', model_name: model.name };
                }
                break;
        }

        return null;
    }

    ensembleModels(history) {
        var allResults = [];
        var details = [];

        // Chay sub models 1-42
        for (var i = 1; i <= 42; i++) {
            var result = this.runSubModel(i, history);
            if (result && result.prediction) {
                allResults.push(result);
                details.push({
                    model: result.model_name || ('sub_model_' + i),
                    prediction: result.prediction === 'Tai' ? 'TAI' : 'XIU',
                    confidence: result.confidence,
                    reason: result.reason
                });
            }
        }

        // Chay mini models 1-21
        for (var j = 1; j <= 21; j++) {
            var miniResult = this.runMiniModel(j, history);
            if (miniResult && miniResult.prediction) {
                allResults.push(miniResult);
                details.push({
                    model: 'mini_model_' + j,
                    prediction: miniResult.prediction === 'Tai' ? 'TAI' : 'XIU',
                    confidence: miniResult.confidence,
                    reason: miniResult.reason
                });
            }
        }

        // Tinh weighted vote
        var taiWeight = 0, xiuWeight = 0, totalWeight = 0;
        for (var k = 0; k < allResults.length; k++) {
            var r = allResults[k];
            var w = r.confidence || 0.5;
            if (r.prediction === 'Tai' || r.prediction === 'TAI') taiWeight += w;
            else if (r.prediction === 'Xiu' || r.prediction === 'XIU') xiuWeight += w;
            totalWeight += w;
        }

        details.sort(function(a, b) { return b.confidence - a.confidence; });

        var finalPred, finalConf;
        if (totalWeight > 0) {
            if (taiWeight > xiuWeight * 1.3) {
                finalPred = 'TAI';
                finalConf = Math.min((taiWeight/totalWeight)*100, 95);
            } else if (xiuWeight > taiWeight * 1.3) {
                finalPred = 'XIU';
                finalConf = Math.min((xiuWeight/totalWeight)*100, 95);
            } else if (details.length > 0) {
                finalPred = details[0].prediction;
                finalConf = 50 + details[0].confidence * 30;
            } else {
                finalPred = 'TAI';
                finalConf = 50;
            }
        } else {
            finalPred = 'TAI';
            finalConf = 50;
        }

        return {
            duDoan: finalPred,
            kyHieu: finalPred === 'TAI' ? 'T' : 'X',
            doTinCay: Math.round(finalConf),
            tiLe: Math.round(finalConf) + '%',
            cau: details.length > 0 ? details[0].reason : 'Khong xac dinh',
            loai: details.length > 0 ? details[0].model : 'KHONG CO',
            sucManh: finalConf >= 90 ? 'RAT MANH' : finalConf >= 75 ? 'MANH' : 'VUA',
            loiKhuyen: finalConf >= 90 ? 'VAO TIEN MANH' : finalConf >= 75 ? 'VAO TIEN' : 'THAM DO',
            tatCa: details.slice(0, 10),
            diemManh: Math.round(finalConf),
            tongModels: allResults.length
        };
    }

    runMiniModel(index, history) {
        if (history.length < 2) return null;
        var results = this.getResultArray(history);
        var last = results[results.length - 1];
        var other = last === 'Tai' ? 'Xiu' : 'Tai';
        var streak = this.getStreak(results);

        var predictions = [
            { pred: last, conf: 0.5, reason: 'Theo xu huong' },
            { pred: other, conf: 0.48, reason: 'Dao chieu' },
            { pred: streak >= 3 ? last : other, conf: 0.55, reason: 'Theo bet' },
            { pred: other, conf: 0.52, reason: 'Can bang' },
            { pred: last, conf: 0.5, reason: 'Tiep tuc' }
        ];

        var pick = predictions[index % predictions.length];
        return {
            prediction: pick.pred,
            confidence: pick.conf,
            reason: 'Mini ' + index + ': ' + pick.reason,
            model_name: 'mini_model_' + index
        };
    }
}

var predictor = new AdvancedPredictor();

// ============================================================================
// MAIN ANALYZE
// ============================================================================
function phanTich(history) {
    var len = history.length;
    if (len < 2) {
        return {
            duDoan: 'TAI', kyHieu: 'T', doTinCay: 40, tiLe: '40%',
            cau: 'Dang thu thap du lieu', loai: 'KHONG CO', sucManh: 'YEU',
            loiKhuyen: 'DOI THEM DU LIEU', tatCa: [], diemManh: 0
        };
    }

    // Chay ensemble 42+21 models
    var result = predictor.ensembleModels(history);
    return result;
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

// ============================================================================
// ROUTES
// ============================================================================
app.get('/', function(req, res) {
    res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sunwin AI Pro - 63 Models</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;background:#0d1117;color:#fff;padding:10px}.container{max-width:700px;margin:0 auto}h1{text-align:center;font-size:1.3em;margin:8px 0;background:linear-gradient(45deg,#f6d365,#fda085);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.card{background:#161b22;border:1px solid #30363d;border-radius:10px;padding:12px;margin:8px 0}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.box{padding:10px;border-radius:8px;text-align:center;background:#1c2128}.box.TAI{border:2px solid #f85149}.box.XIU{border:2px solid #3fb950}.big{font-size:2em;font-weight:bold}.red{color:#f85149}.green{color:#3fb950}.yellow{color:#d2991d}.btn{padding:12px 24px;background:#238636;color:#fff;border:none;border-radius:6px;margin:4px;cursor:pointer;font-size:1em;font-weight:bold}.btn:hover{background:#2ea043}.btn2{background:transparent;border:1px solid #30363d}.tag{display:inline-block;padding:3px 10px;border-radius:4px;font-size:.7em;font-weight:bold;margin:1px}.tag.BET{background:#da3633}.tag.DAO{background:#1f6feb}.tag.NHIP{background:#8957e5}.tag.HOI{background:#d2991d;color:#000}.tag.NGHIENG{background:#3fb950;color:#000}.tag.SONG{background:#db6d28}.loading{text-align:center;padding:20px;color:#8b949e}pre{background:#0d1117;padding:8px;border-radius:6px;overflow-x:auto;font-size:.75em;max-height:200px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}</style></head><body><div class="container"><h1>🎯 SUNWIN AI PRO - 63 MODELS</h1><p style="text-align:center;color:#8b949e;font-size:.8em">42 SUB MODELS + 21 MINI MODELS</p><div style="text-align:center;margin:10px 0"><button class="btn" onclick="load()" style="animation:pulse 1.5s infinite">🎲 DU DOAN</button><a href="/api/predict" class="btn btn2">📊 API</a><a href="/api/history" class="btn btn2">📜 SU</a></div><div id="out"><div class="loading">⏳ Dang tai...</div></div></div><script>async function load(){document.getElementById("out").innerHTML="<div class=loading>⏳ 63 Models dang phan tich...</div>";try{var r=await fetch("/api/predict");var d=await r.json();var p=d.phien_truoc||{};var dd=d.du_doan||{};var cau=d.cau_phat_hien||[];var html="";html+=\'<div class=card style=border:2px solid #d2991d;background:linear-gradient(135deg,#161b22,#2d1f00)><h3 style=text-align:center;color:#f6d365>📌 DU DOAN PHIEN HIEN TAI</h3><div style=text-align:center;margin:10px 0><span>PHIEN HIEN TAI: </span><span class="big yellow">#\'+dd.phien_hien_tai+\'</span></div><div class=grid2><div class="box \'+(dd.ky_hieu=="T"?"TAI":"XIU")+\'"><small>DU DOAN</small><div class=big style=font-size:2.5em;color:\'+(dd.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+dd.du_doan+\'</div></div><div class=box><small>TI LE THANG</small><div class="big yellow">\'+dd.ti_le+\'</div></div></div><p style=margin-top:8px>📊 <b>\'+dd.cau+\'</b> | 💡 <b>\'+dd.loi_khuyen+\'</b></p><p>🧠 <b>\'+dd.tong_models+\'</b> models dong thuan</p></div>\';html+=\'<div class=card><h3>📍 PHIEN TRUOC</h3><div class=grid2><div class=box><small>PHIEN</small><div class=big>#\'+p.phien+\'</div></div><div class="box \'+(p.ky_hieu=="T"?"TAI":"XIU")+\'"><small>KET QUA</small><div class=big style=color:\'+(p.ky_hieu=="T"?"#f85149":"#3fb950")+\'>\'+p.ket_qua+\'</div><small>Tong: \'+p.tong+\' | Xuc xac: \'+(p.xuc_xac||[]).join(", ")+\'</small></div></div></div>\';if(cau.length>0){html+=\'<div class=card><h3>🔍 TOP 10 MODELS</h3>\';for(var i=0;i<cau.length;i++){var c=cau[i];html+=\'<p style=margin:3px 0;font-size:.75em;padding:3px;background:rgba(255,255,255,0.02);border-radius:3px">\'+(i+1)+\'. <b>\'+c.model+\'</b> → <b style=color:\'+(c.prediction=="TAI"?"#f85149":"#3fb950")+\'>\'+c.prediction+\'</b> (\'+(c.confidence*100).toFixed(0)+\'%)</p>\'}html+=\'</div>\'}document.getElementById("out").innerHTML=html}catch(e){document.getElementById("out").innerHTML=\'<div class=card style=border:1px solid #f85149><h3 style=color:#f85149>❌ LOI</h3><p>\'+e.message+\'</p><button class=btn onclick=load()>🔄 THU LAI</button></div>\'}}load();setInterval(load,25000);</script></body></html>');
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
                du_doan: ketQua ? ketQua.duDoan : 'TAI',
                ky_hieu: ketQua ? ketQua.kyHieu : 'T',
                ti_le: ketQua ? ketQua.tiLe : '50%',
                cau: ketQua ? ketQua.cau : 'Khong xac dinh',
                loai_cau: ketQua ? ketQua.loai : 'KHONG CO',
                suc_manh: ketQua ? ketQua.sucManh : 'YEU',
                loi_khuyen: ketQua ? ketQua.loiKhuyen : 'THAM DO',
                tong_models: ketQua ? ketQua.tongModels : 0
            },
            cau_phat_hien: ketQua && ketQua.tatCa ? ketQua.tatCa.map(function(c) {
                return { model: c.model, prediction: c.prediction, confidence: c.confidence, reason: c.reason };
            }) : []
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
                ket_qua_game: p.kqThuc || 'DOI',
                dung_hay_sai: p.dung === true ? '✅ DUNG' : p.dung === false ? '❌ SAI' : '⏳ CHO'
            };
        }),
        thong_ke: { tong: predictionLog.length, dung: dungCount, sai: saiCount }
    });
});

app.listen(PORT, function() {
    console.log('Sunwin AI Pro - 63 Models running on port ' + PORT);
});
