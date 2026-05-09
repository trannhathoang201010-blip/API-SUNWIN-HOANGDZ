const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 8080;

// ─── THUẬT TOÁN PHÂN TÍCH CẦU CHUYÊN SÂU ────────────────────────────────────
class SunwinAdvancedPredictor {
    constructor() {
        this.MAX_HISTORY = 50;
        
        this.CAU_TYPES = {
            BET_TAI: "BỆT TÀI",
            BET_XIU: "BỆT XỈU",
            DAO_11: "CẦU ĐẢO 1-1",
            DAO_22: "CẦU ĐẢO 2-2",
            DAO_33: "CẦU ĐẢO 3-3",
            DOI_121: "CẦU 1-2-1",
            BAC_THANG: "CẦU BẬC THANG",
            SONG: "CẦU SÓNG",
            HOI: "CẦU HỒI",
            NGHIENG: "CẦU NGHIÊNG",
        };
    }

    // ─── 1. CHUYỂN ĐỔI DỮ LIỆU ────────────────────────────────────────
    convertHistory(dataArray) {
        return dataArray.map(item => ({
            phien: item.phien,
            tong: item.tong,
            result: item.tong >= 11 ? 'T' : 'X', // API trả "Tài"/"Xỉu" nhưng chuẩn là tong >= 11 = Tài
            ket_qua_text: item.tong >= 11 ? 'Tài' : 'Xỉu',
            xuc_xac: [item.xuc_xac_1, item.xuc_xac_2, item.xuc_xac_3],
            thoi_gian: item.thoi_gian
        }));
    }

    getPatternString(data, length = 30) {
        return data.slice(0, length).map(d => d.result).reverse().join('');
    }

    // ─── 2. PHÁT HIỆN CẦU BỆT ──────────────────────────────────────────
    detectBetCau(str) {
        const results = [];
        
        // Bệt dài 5+
        if (str.startsWith('TTTTT')) {
            results.push({ type: this.CAU_TYPES.BET_TAI, confidence: 95, prediction: 'T', 
                          description: 'Bệt Tài 5+ phiên', strength: 'VERY STRONG' });
        }
        if (str.startsWith('XXXXX')) {
            results.push({ type: this.CAU_TYPES.BET_XIU, confidence: 95, prediction: 'X', 
                          description: 'Bệt Xỉu 5+ phiên', strength: 'VERY STRONG' });
        }
        
        // Bệt 4
        if (str.startsWith('TTTT') && str[4] !== 'T') {
            results.push({ type: this.CAU_TYPES.BET_TAI, confidence: 85, prediction: 'T', 
                          description: 'Bệt Tài 4 phiên', strength: 'STRONG' });
        }
        if (str.startsWith('XXXX') && str[4] !== 'X') {
            results.push({ type: this.CAU_TYPES.BET_XIU, confidence: 85, prediction: 'X', 
                          description: 'Bệt Xỉu 4 phiên', strength: 'STRONG' });
        }
        
        // Bệt 3
        if (str.startsWith('TTT') && str[3] !== 'T') {
            results.push({ type: this.CAU_TYPES.BET_TAI, confidence: 70, prediction: 'T', 
                          description: 'Bệt Tài 3 phiên', strength: 'MEDIUM' });
        }
        if (str.startsWith('XXX') && str[3] !== 'X') {
            results.push({ type: this.CAU_TYPES.BET_XIU, confidence: 70, prediction: 'X', 
                          description: 'Bệt Xỉu 3 phiên', strength: 'MEDIUM' });
        }
        
        return results;
    }

    // ─── 3. PHÁT HIỆN CẦU ĐẢO ──────────────────────────────────────────
    detectDaoCau(str) {
        const results = [];
        
        // Cầu đảo 1-1
        const patterns_11 = ['TXTXTX', 'XTXTXT', 'TXTXT', 'XTXTX'];
        if (patterns_11.some(p => str.startsWith(p))) {
            const nextPred = str[0] === 'T' ? 'X' : 'T';
            results.push({ type: this.CAU_TYPES.DAO_11, confidence: 85, prediction: nextPred, 
                          description: 'Đảo 1-1 ổn định', strength: 'STRONG' });
        }
        
        // Cầu đảo 2-2
        if (str.startsWith('TTXXTT') || str.startsWith('XXTTXX')) {
            results.push({ type: this.CAU_TYPES.DAO_22, confidence: 80, prediction: str[0], 
                          description: 'Đảo 2-2', strength: 'STRONG' });
        }
        
        // Cầu đảo 3-3
        if (str.startsWith('TTTXXX') || str.startsWith('XXXTTT')) {
            results.push({ type: this.CAU_TYPES.DAO_33, confidence: 75, prediction: str[0], 
                          description: 'Đảo 3-3', strength: 'MEDIUM' });
        }
        
        // Cầu 1-2-1
        if (str.startsWith('TXXT') || str.startsWith('XTTX')) {
            results.push({ type: this.CAU_TYPES.DOI_121, confidence: 75, prediction: str[3], 
                          description: 'Nhịp 1-2-1', strength: 'MEDIUM' });
        }
        
        return results;
    }

    // ─── 4. PHÂN TÍCH ĐIỂM NÚT ─────────────────────────────────────────
    analyzeDiemNut(data) {
        const results = [];
        if (data.length === 0) return results;
        
        const last = data[0].tong;
        const allTongs = data.map(d => d.tong);
        const max = Math.max(...allTongs);
        const min = Math.min(...allTongs);
        
        if (last >= 17) {
            results.push({ type: this.CAU_TYPES.HOI, confidence: 90, prediction: 'X', 
                          description: `Điểm cực đại ${last} - Hồi Xỉu`, strength: 'VERY STRONG' });
        } else if (last <= 4) {
            results.push({ type: this.CAU_TYPES.HOI, confidence: 90, prediction: 'T', 
                          description: `Điểm cực tiểu ${last} - Hồi Tài`, strength: 'VERY STRONG' });
        } else if (last >= 15) {
            results.push({ type: this.CAU_TYPES.HOI, confidence: 75, prediction: 'X', 
                          description: `Điểm cao ${last} - Khả năng về Xỉu`, strength: 'MEDIUM' });
        } else if (last <= 5) {
            results.push({ type: this.CAU_TYPES.HOI, confidence: 75, prediction: 'T', 
                          description: `Điểm thấp ${last} - Khả năng về Tài`, strength: 'MEDIUM' });
        }
        
        return results;
    }

    // ─── 5. PHÂN TÍCH THỐNG KÊ ─────────────────────────────────────────
    analyzeProbability(data) {
        const total = data.length;
        const tCount = data.filter(d => d.result === 'T').length;
        const xCount = data.filter(d => d.result === 'X').length;
        
        return {
            tCount, xCount, total,
            tRate: total > 0 ? ((tCount / total) * 100).toFixed(1) : '0',
            xRate: total > 0 ? ((xCount / total) * 100).toFixed(1) : '0',
            trend: tCount > xCount ? 'THIÊN TÀI' : tCount < xCount ? 'THIÊN XỈU' : 'CÂN BẰNG'
        };
    }

    // ─── TỔNG HỢP PHÂN TÍCH ────────────────────────────────────────────
    analyze(historyData) {
        if (!historyData || historyData.length < 5) {
            return {
                prediction: 'N/A',
                confidence: 0,
                pattern: 'Cần thêm dữ liệu (tối thiểu 5 phiên)',
                advice: 'CHỜ THÊM DỮ LIỆU'
            };
        }

        const data = this.convertHistory(historyData);
        const str = this.getPatternString(data, 30);
        const allResults = [];
        
        // Chạy tất cả các thuật toán
        allResults.push(...this.detectBetCau(str));
        allResults.push(...this.detectDaoCau(str));
        allResults.push(...this.analyzeDiemNut(data));
        
        // Phân tích thống kê
        const prob = this.analyzeProbability(data);
        if (prob.trend !== 'CÂN BẰNG') {
            const trendPred = prob.trend === 'THIÊN TÀI' ? 'T' : 'X';
            allResults.push({ type: this.CAU_TYPES.NGHIENG, confidence: 65, prediction: trendPred, 
                              description: `Thiên về ${prob.trend} (${Math.max(prob.tRate, prob.xRate)}%)`, 
                              strength: 'LOW' });
        }
        
        // Sắp xếp theo confidence giảm dần
        allResults.sort((a, b) => b.confidence - a.confidence);
        
        const bestResult = allResults[0];
        
        // Lời khuyên
        let advice = 'THĂM DÒ';
        if (bestResult && bestResult.confidence >= 90) advice = 'VÀO TIỀN MẠNH';
        else if (bestResult && bestResult.confidence >= 80) advice = 'VÀO TIỀN VỪA';
        else if (bestResult && bestResult.confidence >= 70) advice = 'ĐÁNH NHỎ';
        
        return {
            prediction: bestResult ? bestResult.prediction : (Math.random() > 0.5 ? 'T' : 'X'),
            confidence: bestResult ? bestResult.confidence : 50,
            pattern: bestResult ? bestResult.description : 'Cầu loạn - Đánh nhỏ',
            patternType: bestResult ? bestResult.type : 'KHÔNG XÁC ĐỊNH',
            strength: bestResult ? bestResult.strength : 'UNKNOWN',
            allPatterns: allResults.slice(0, 5),
            probability: prob,
            advice: advice
        };
    }
}

const predictor = new SunwinAdvancedPredictor();

// ─── LƯU TRỮ LỊCH SỬ CÁC PHIÊN ĐÃ GỌI ────────────────────────────────────
let sessionHistory = [];
const MAX_STORED = 100;

// ─── API ENDPOINTS ──────────────────────────────────────────────────────────

// Endpoint chính: Gọi API Sunwin, lưu lịch sử và phân tích
app.get('/api/predict', async (req, res) => {
    try {
        // Gọi API Sunwin lấy phiên mới nhất
        const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        const newSession = response.data;
        
        // Kiểm tra dữ liệu hợp lệ
        if (!newSession || !newSession.phien) {
            return res.status(500).json({ 
                error: "API Sunwin trả về dữ liệu không hợp lệ",
                raw_data: newSession 
            });
        }

        // Parse kết quả Tài/Xỉu từ tổng điểm
        const tong = newSession.tong || 0;
        const ketQua = tong >= 11 ? 'T' : 'X';
        const ketQuaText = tong >= 11 ? 'Tài' : 'Xỉu';

        // Thêm vào lịch sử nếu là phiên mới
        const existingIndex = sessionHistory.findIndex(s => s.phien === newSession.phien);
        if (existingIndex === -1) {
            sessionHistory.unshift(newSession);
            if (sessionHistory.length > MAX_STORED) {
                sessionHistory = sessionHistory.slice(0, MAX_STORED);
            }
        }

        // Phân tích với toàn bộ lịch sử
        const prediction = predictor.analyze(sessionHistory);

        // Trả về kết quả
        res.json({
            status: "success",
            timestamp: new Date().toISOString(),
            current_session: {
                phien: newSession.phien,
                ket_qua: ketQuaText,
                ky_hieu: ketQua,
                tong_diem: tong,
                xuc_xac: [
                    newSession.xuc_xac_1, 
                    newSession.xuc_xac_2, 
                    newSession.xuc_xac_3
                ],
                thoi_gian: newSession.thoi_gian
            },
            prediction: {
                next_bet: prediction.prediction === 'T' ? 'TÀI' : 'XỈU',
                ky_hieu: prediction.prediction,
                confidence: `${prediction.confidence}%`,
                pattern: prediction.pattern,
                pattern_type: prediction.patternType,
                strength: prediction.strength,
                advice: prediction.advice
            },
            statistics: {
                total_sessions: sessionHistory.length,
                analyzed: prediction.probability.total,
                tai_count: prediction.probability.tCount,
                xiu_count: prediction.probability.xCount,
                tai_rate: `${prediction.probability.tRate}%`,
                xiu_rate: `${prediction.probability.xRate}%`,
                trend: prediction.probability.trend
            },
            top_patterns: prediction.allPatterns.map(p => ({
                type: p.type,
                description: p.description,
                prediction: p.prediction === 'T' ? 'TÀI' : 'XỈU',
                confidence: `${p.confidence}%`,
                strength: p.strength
            })),
            recent_history: sessionHistory.slice(0, 10).map(s => ({
                phien: s.phien,
                result: s.tong >= 11 ? 'T' : 'X',
                result_text: s.tong >= 11 ? 'Tài' : 'Xỉu',
                tong: s.tong,
                xuc_xac: [s.xuc_xac_1, s.xuc_xac_2, s.xuc_xac_3],
                thoi_gian: s.thoi_gian
            }))
        });

    } catch (error) {
        // Xử lý lỗi chi tiết
        let errorMsg = "Không thể kết nối API Sunwin";
        if (error.code === 'ECONNREFUSED') errorMsg = "API Sunwin từ chối kết nối";
        else if (error.code === 'ETIMEDOUT') errorMsg = "API Sunwin timeout (quá 10s)";
        else if (error.response) errorMsg = `API Sunwin lỗi HTTP ${error.response.status}`;
        
        res.status(500).json({ 
            status: "error", 
            message: errorMsg,
            details: error.message,
            solution: "Kiểm tra lại URL API hoặc thử gọi trực tiếp API Sunwin"
        });
    }
});

// Endpoint xem lịch sử đã lưu
app.get('/api/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({
        total_stored: sessionHistory.length,
        data: sessionHistory.slice(0, limit).map(s => ({
            phien: s.phien,
            result: s.tong >= 11 ? 'T' : 'X',
            result_text: s.tong >= 11 ? 'Tài' : 'Xỉu',
            tong: s.tong,
            xuc_xac: [s.xuc_xac_1, s.xuc_xac_2, s.xuc_xac_3],
            thoi_gian: s.thoi_gian
        }))
    });
});

// Endpoint test gọi trực tiếp API Sunwin
app.get('/api/test-sunwin', async (req, res) => {
    try {
        const response = await axios.get('https://bracket-ellen-roads-prefer.trycloudflare.com/api/tx', {
            timeout: 10000
        });
        const data = response.data;
        const tong = data.tong || 0;
        
        res.json({
            status: "success",
            raw_response: data,
            parsed: {
                phien: data.phien,
                tong: tong,
                ket_qua: tong >= 11 ? 'TÀI' : 'XỈU',
                ky_hieu: tong >= 11 ? 'T' : 'X',
                xuc_xac: [data.xuc_xac_1, data.xuc_xac_2, data.xuc_xac_3],
                thoi_gian: data.thoi_gian
            }
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
            code: error.code
        });
    }
});

// Dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🎯 Sunwin AI Predictor</title>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    background: #0d1117;
                    color: #c9d1d9;
                    padding: 20px;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    background: linear-gradient(45deg, #f6d365, #fda085);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 2em;
                    margin: 20px 0;
                }
                .card {
                    background: #161b22;
                    border: 1px solid #30363d;
                    border-radius: 12px;
                    padding: 20px;
                    margin: 15px 0;
                }
                .result-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 15px;
                    margin: 20px 0;
                }
                .result-box {
                    background: #1c2128;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                .result-box.TAI { border: 2px solid #238636; }
                .result-box.XIU { border: 2px solid #da3633; }
                .big-text {
                    font-size: 2em;
                    font-weight: bold;
                }
                .green { color: #3fb950; }
                .red { color: #f85149; }
                .yellow { color: #d2991d; }
                code {
                    background: #1c2128;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                .btn {
                    display: inline-block;
                    padding: 10px 25px;
                    background: #238636;
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 5px;
                    font-weight: bold;
                }
                .btn:hover { background: #2ea043; }
                .btn-outline {
                    background: transparent;
                    border: 1px solid #30363d;
                }
                .btn-outline:hover { background: #1c2128; }
                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #8b949e;
                }
                #result {
                    transition: all 0.3s;
                }
                pre {
                    background: #0d1117;
                    padding: 15px;
                    border-radius: 8px;
                    overflow-x: auto;
                    font-size: 0.85em;
                    border: 1px solid #30363d;
                }
                .api-info {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎯 Sunwin AI Predictor</h1>
                <p style="text-align:center;color:#8b949e;">Phân tích Tài Xỉu • Gọi API Sunwin trực tiếp</p>
                
                <div style="text-align:center;margin:20px 0;">
                    <button class="btn" onclick="predict()">🎲 DỰ ĐOÁN NGAY</button>
                    <a href="/api/test-sunwin" class="btn btn-outline" target="_blank">🔍 Test API Sunwin</a>
                    <a href="/api/history" class="btn btn-outline" target="_blank">📊 Xem Lịch Sử</a>
                </div>
                
                <div id="result"></div>
                
                <div class="card" style="margin-top:20px;">
                    <h3>📡 API Endpoints</h3>
                    <p><code>GET /api/predict</code> - Dự đoán + phân tích</p>
                    <p><code>GET /api/history</code> - Lịch sử phiên đã lưu</p>
                    <p><code>GET /api/test-sunwin</code> - Test trực tiếp API Sunwin</p>
                </div>
                
                <div class="card">
                    <h3>🎯 Quy Tắc Tài Xỉu</h3>
                    <p>• <span class="red">Tổng 3 xúc xắc >= 11</span> → <strong>Tài (T)</strong></p>
                    <p>• <span class="green">Tổng 3 xúc xắc {"<="} 10</span> → <strong>Xỉu (X)</strong></p>
                </div>
            </div>
            
            <script>
                async function predict() {
                    const resultDiv = document.getElementById('result');
                    resultDiv.innerHTML = '<div class="loading">⏳ Đang gọi API Sunwin và phân tích...</div>';
                    
                    try {
                        const response = await fetch('/api/predict');
                        const data = await response.json();
                        
                        if (data.status === 'success') {
                            const cs = data.current_session;
                            const pred = data.prediction;
                            
                            resultDiv.innerHTML = \`
                                <div class="card">
                                    <h3>📍 Phiên Hiện Tại: #\${cs.phien}</h3>
                                    <div class="result-grid">
                                        <div class="result-box \${cs.ky_hieu === 'T' ? 'TAI' : 'XIU'}">
                                            <small>KẾT QUẢ</small>
                                            <div class="big-text \${cs.ky_hieu === 'T' ? 'red' : 'green'}">\${cs.ket_qua}</div>
                                            <small>Tổng: \${cs.tong_diem}</small>
                                        </div>
                                        <div class="result-box">
                                            <small>XÚC XẮC</small>
                                            <div class="big-text">\${cs.xuc_xac.join(' - ')}</div>
                                        </div>
                                        <div class="result-box">
                                            <small>THỜI GIAN</small>
                                            <div>\${cs.thoi_gian || 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="card" style="border-left: 4px solid \${pred.ky_hieu === 'T' ? '#f85149' : '#3fb950'}">
                                    <h3>🔮 DỰ ĐOÁN PHIÊN TIẾP THEO</h3>
                                    <div class="result-grid">
                                        <div class="result-box \${pred.ky_hieu === 'T' ? 'TAI' : 'XIU'}">
                                            <small>DỰ ĐOÁN</small>
                                            <div class="big-text \${pred.ky_hieu === 'T' ? 'red' : 'green'}">\${pred.next_bet}</div>
                                        </div>
                                        <div class="result-box">
                                            <small>ĐỘ TIN CẬY</small>
                                            <div class="big-text yellow">\${pred.confidence}</div>
                                        </div>
                                        <div class="result-box">
                                            <small>LỜI KHUYÊN</small>
                                            <div class="big-text" style="font-size:1.2em;">\${pred.advice}</div>
                                        </div>
                                    </div>
                                    <p>📊 <strong>Cầu phát hiện:</strong> \${pred.pattern} (\${pred.strength})</p>
                                </div>
                                
                                <div class="card">
                                    <h3>📈 Thống Kê \${data.statistics.total_sessions} Phiên</h3>
                                    <p>Tài: \${data.statistics.tai_count} lần (\${data.statistics.tai_rate}) | 
                                       Xỉu: \${data.statistics.xiu_count} lần (\${data.statistics.xiu_rate})</p>
                                    <p>Xu hướng: <strong>\${data.statistics.trend}</strong></p>
                                </div>
                                
                                <div class="card">
                                    <h3>📜 Lịch Sử 10 Phiên Gần Nhất</h3>
                                    <pre>\${data.recent_history.map(h => 
                                        '#' + h.phien + ' | ' + h.result_text + ' (' + h.tong + ') | Xúc xắc: ' + h.xuc_xac.join(',')
                                    ).join('\\n')}</pre>
                                </div>
                            \`;
                        } else {
                            resultDiv.innerHTML = \`
                                <div class="card" style="border: 1px solid #f85149;">
                                    <h3 style="color:#f85149;">❌ Lỗi</h3>
                                    <p>\${data.message || data.error}</p>
                                    <p>\${data.solution || ''}</p>
                                </div>
                            \`;
                        }
                    } catch (error) {
                        resultDiv.innerHTML = \`
                            <div class="card" style="border: 1px solid #f85149;">
                                <h3 style="color:#f85149;">❌ Lỗi Kết Nối</h3>
                                <p>\${error.message}</p>
                            </div>
                        \`;
                    }
                }
                
                // Tự động gọi dự đoán khi load trang
                predict();
                
                // Auto refresh mỗi 30 giây
                setInterval(predict, 30000);
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log('🌟═══════════════════════════════════════🌟');
    console.log('  🎯 SUNWIN AI PREDICTOR - TÀI XỈU');
    console.log('🌟═══════════════════════════════════════🌟');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`🔗 API Dự Đoán: http://localhost:${PORT}/api/predict`);
    console.log(`📊 Lịch Sử: http://localhost:${PORT}/api/history`);
    console.log(`🔍 Test API: http://localhost:${PORT}/api/test-sunwin`);
    console.log('✅ Quy tắc: Tổng >= 11 → Tài (T) | Tổng <= 10 → Xỉu (X)');
    console.log('🌟═══════════════════════════════════════🌟');
});
