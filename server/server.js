#!/usr/bin/env node
/**
 * SQLite API 서버 for Gem Simulator
 * 1GB probability_table.db 파일을 백엔드에서 처리
 */

import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// SQLite 데이터베이스 연결
let db = null;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 데이터베이스 초기화
function initDatabase() {
  return new Promise((resolve, reject) => {
    // probability_table.db는 프로젝트 루트에 있다고 가정
    const dbPath = join(__dirname, '../probability_table_reroll_7.db');
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ SQLite 연결 실패:', err.message);
        reject(err);
      } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
        
        // 데이터베이스 정보 확인
        db.get("SELECT COUNT(*) as count FROM goal_probabilities", (err, row) => {
          if (err) {
            console.error('테이블 확인 실패:', err.message);
          } else {
            console.log(`📊 젬 상태 개수: ${row.count.toLocaleString()}개`);
          }
        });
        
        resolve();
      }
    });
  });
}

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 데이터베이스 통계
app.get('/api/stats', (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_states
    FROM goal_probabilities
  `;
  
  db.get(query, [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row);
    }
  });
});

// 젬 상태별 확률 조회 (percentile 포함)
// 압축된 형식 사용: s=2_1_1_2_0_0_6_2_100_0
app.get('/api/gem-probabilities', (req, res) => {
  if (!req.query.s) {
    return res.status(400).json({ error: 'Missing required parameter: s' });
  }
  
  const values = req.query.s.split('_').map(Number);
  const [willpower, corePoint, dealerA, dealerB, supportA, supportB,
         remainingAttempts, currentRerollAttempts = 0, costModifier = 0, isFirstProcessing = 0] = values;
  
  const query = `
    SELECT id, prob_5_5, prob_5_4, prob_4_5, prob_5_3, prob_4_4, prob_3_5,
           prob_sum8, prob_sum9, prob_relic, prob_ancient, 
           prob_dealer_complete, prob_support_complete
    FROM goal_probabilities 
    WHERE willpower = ? AND corePoint = ? 
      AND dealerA = ? AND dealerB = ? AND supportA = ? AND supportB = ?
      AND remainingAttempts = ? AND currentRerollAttempts = ?
      AND costModifier = ? AND isFirstProcessing = ?
  `;
  
  const params = [
    parseInt(willpower) || 0,
    parseInt(corePoint) || 0,
    parseInt(dealerA) || 0,
    parseInt(dealerB) || 0,
    parseInt(supportA) || 0,
    parseInt(supportB) || 0,
    parseInt(remainingAttempts) || 0,
    parseInt(currentRerollAttempts) || 0,
    parseInt(costModifier) || 0,
    parseInt(isFirstProcessing) || 0
  ];
  
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      // percentile 데이터도 가져오기
      const percentileQuery = `
        SELECT target, percentile, value
        FROM goal_probability_distributions
        WHERE gem_state_id = ?
        ORDER BY target, percentile
      `;
      
      db.all(percentileQuery, [row.id], (err2, percentileRows) => {
        if (err2) {
          res.status(500).json({ error: err2.message });
        } else {
          // percentile 데이터를 구조화
          const percentiles = {};
          if (percentileRows) {
            for (const pRow of percentileRows) {
              if (!percentiles[pRow.target]) {
                percentiles[pRow.target] = {};
              }
              percentiles[pRow.target][pRow.percentile] = pRow.value;
            }
          }
          
          // available_options 데이터도 가져오기
          const optionsQuery = `
            SELECT action, probability, description, selectionProbability
            FROM available_options 
            WHERE gem_state_id = ?
            ORDER BY selectionProbability DESC
          `;
          
          db.all(optionsQuery, [row.id], (err3, optionRows) => {
            if (err3) {
              res.status(500).json({ error: err3.message });
            } else {
              // expected_costs 데이터도 가져오기
              const costsQuery = `
                SELECT target, expected_cost_to_goal
                FROM expected_costs
                WHERE gem_state_id = ?
              `;
              
              db.all(costsQuery, [row.id], (err4, costRows) => {
                if (err4) {
                  res.status(500).json({ error: err4.message });
                } else {
                  // expected costs를 구조화
                  const expectedCosts = {};
                  if (costRows) {
                    for (const cRow of costRows) {
                      expectedCosts[cRow.target] = cRow.expected_cost_to_goal;
                    }
                  }
                  
                  // id 필드 제거하고 percentiles, availableOptions, expectedCosts 추가
                  const { id, ...probabilities } = row;
                  res.json({
                    ...probabilities,
                    percentiles,
                    availableOptions: optionRows || [],
                    expectedCosts
                  });
                }
              });
            }
          });
        }
      });
    } else {
      res.json(null);
    }
  });
});


// 커스텀 SQL 쿼리 (제한된 SELECT만 허용)
app.post('/api/query', (req, res) => {
  const { sql, params = [] } = req.body;
  
  // 보안: SELECT 쿼리만 허용
  if (!sql.trim().toLowerCase().startsWith('select')) {
    return res.status(400).json({ error: 'Only SELECT queries are allowed' });
  }
  
  // 위험한 키워드 차단
  const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create'];
  const lowerSql = sql.toLowerCase();
  for (const keyword of dangerousKeywords) {
    if (lowerSql.includes(keyword)) {
      return res.status(400).json({ error: `Keyword '${keyword}' is not allowed` });
    }
  }
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 사용 가능한 옵션들 조회
app.get('/api/available-options/:gemStateId', (req, res) => {
  const gemStateId = parseInt(req.params.gemStateId);
  
  const query = `
    SELECT action, probability, description, selectionProbability
    FROM available_options 
    WHERE gem_state_id = ?
    ORDER BY selectionProbability DESC
  `;
  
  db.all(query, [gemStateId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 서버 시작
async function startServer() {
  try {
    await initDatabase();
    
    // SSL 인증서 경로 설정
    const sslPath = process.env.SSL_PATH || '/etc/letsencrypt/live/ahrrri.iptime.org';
    const useSSL = process.env.USE_SSL === 'true';
    
    if (useSSL) {
      try {
        const options = {
          key: fs.readFileSync(`${sslPath}/privkey.pem`),
          cert: fs.readFileSync(`${sslPath}/fullchain.pem`)
        };
        
        https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
          console.log(`🔒 HTTPS 서버가 포트 ${PORT}에서 실행 중입니다 (모든 인터페이스)`);
          console.log(`📡 API 엔드포인트: https://ahrrri.iptime.org:${PORT}`);
          console.log(`   GET  /health - 헬스 체크`);
          console.log(`   GET  /api/stats - 데이터베이스 통계 (총 상태 수)`);
          console.log(`   GET  /api/gem-probabilities - 젬 상태별 확률`);
          console.log(`   POST /api/query - 커스텀 쿼리`);
          console.log(`   GET  /api/available-options/:id - 사용 가능한 옵션들`);
        });
      } catch (error) {
        console.error('❌ SSL 인증서를 읽을 수 없습니다:', error.message);
        console.log('HTTP 서버로 fallback합니다...');
        startHttpServer();
      }
    } else {
      startHttpServer();
    }
    
    function startHttpServer() {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 HTTP 서버가 포트 ${PORT}에서 실행 중입니다 (모든 인터페이스)`);
        console.log(`📡 API 엔드포인트: http://ahrrri.iptime.org:${PORT}`);
        console.log(`   GET  /health - 헬스 체크`);
        console.log(`   GET  /api/stats - 데이터베이스 통계 (총 상태 수)`);
        console.log(`   GET  /api/gem-probabilities - 젬 상태별 확률`);
        console.log(`   POST /api/query - 커스텀 쿼리`);
        console.log(`   GET  /api/available-options/:id - 사용 가능한 옵션들`);
      });
    }
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...');
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('데이터베이스 종료 중 오류:', err.message);
      } else {
        console.log('데이터베이스 연결이 종료되었습니다.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

startServer();