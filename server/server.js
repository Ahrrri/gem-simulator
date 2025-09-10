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
import { getAvailableProcessingOptions, applyGemAction } from '../src/utils/gemProcessing.js';

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

// 통합 확률 조회 - 현재 상태, 리롤, 모든 옵션의 확률을 한 번에
app.get('/api/gem-all-probabilities', (req, res) => {
  if (!req.query.s) {
    return res.status(400).json({ error: 'Missing required parameter: s' });
  }
  
  const values = req.query.s.split('_').map(Number);
  const [willpower, corePoint, dealerA, dealerB, supportA, supportB,
         remainingAttempts, currentRerollAttempts = 0, costModifier = 0, isFirstProcessing = 0] = values;
  
  const gem = {
    willpower: parseInt(willpower) || 0,
    corePoint: parseInt(corePoint) || 0,
    dealerA: parseInt(dealerA) || 0,
    dealerB: parseInt(dealerB) || 0,
    supportA: parseInt(supportA) || 0,
    supportB: parseInt(supportB) || 0,
    remainingAttempts: parseInt(remainingAttempts) || 0,
    currentRerollAttempts: parseInt(currentRerollAttempts) || 0,
    costModifier: parseInt(costModifier) || 0,
    isFirstProcessing: parseInt(isFirstProcessing) || 0
  };
  
  // 리롤 상태 계산
  function getRerollState(gemState) {
    return {
      ...gemState,
      currentRerollAttempts: Math.max(0, gemState.currentRerollAttempts - 1)
    };
  }
  
  // 가능한 옵션들 가져오기
  const availableOptions = getAvailableProcessingOptions(gem);
  
  // 모든 상태들을 수집
  const states = [];
  const stateKeys = new Set();
  
  // 현재 상태 추가
  const currentKey = `${gem.willpower}_${gem.corePoint}_${gem.dealerA}_${gem.dealerB}_${gem.supportA}_${gem.supportB}_${gem.remainingAttempts}_${gem.currentRerollAttempts}_${gem.costModifier}_${gem.isFirstProcessing}`;
  states.push({ type: 'current', gem: gem, key: currentKey });
  stateKeys.add(currentKey);
  
  // 리롤 상태 추가
  if (gem.currentRerollAttempts > 0) {
    const rerollGem = getRerollState(gem);
    const rerollKey = `${rerollGem.willpower}_${rerollGem.corePoint}_${rerollGem.dealerA}_${rerollGem.dealerB}_${rerollGem.supportA}_${rerollGem.supportB}_${rerollGem.remainingAttempts}_${rerollGem.currentRerollAttempts}_${rerollGem.costModifier}_${rerollGem.isFirstProcessing}`;
    if (!stateKeys.has(rerollKey)) {
      states.push({ type: 'reroll', gem: rerollGem, key: rerollKey });
      stateKeys.add(rerollKey);
    }
  }
  
  // 각 옵션 적용 후 상태 추가
  for (const option of availableOptions) {
    const appliedGem = applyGemAction(gem, option.action);
    const appliedKey = `${appliedGem.willpower}_${appliedGem.corePoint}_${appliedGem.dealerA}_${appliedGem.dealerB}_${appliedGem.supportA}_${appliedGem.supportB}_${appliedGem.remainingAttempts}_${appliedGem.currentRerollAttempts}_${appliedGem.costModifier}_${appliedGem.isFirstProcessing}`;
    if (!stateKeys.has(appliedKey)) {
      states.push({ type: 'option', action: option.action, gem: appliedGem, key: appliedKey });
      stateKeys.add(appliedKey);
    }
  }
  
  // 모든 상태의 확률을 한 번에 조회
  const placeholders = states.map(() => '(?,?,?,?,?,?,?,?,?,?)').join(',');
  const params = [];
  for (const state of states) {
    params.push(
      state.gem.willpower,
      state.gem.corePoint,
      state.gem.dealerA,
      state.gem.dealerB,
      state.gem.supportA,
      state.gem.supportB,
      state.gem.remainingAttempts,
      state.gem.currentRerollAttempts,
      state.gem.costModifier,
      state.gem.isFirstProcessing
    );
  }
  
  const query = `
    SELECT id, willpower, corePoint, dealerA, dealerB, supportA, supportB,
           remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing,
           prob_5_5, prob_5_4, prob_4_5, prob_5_3, prob_4_4, prob_3_5,
           prob_sum8, prob_sum9, prob_relic, prob_ancient,
           prob_dealer_complete, prob_support_complete
    FROM goal_probabilities 
    WHERE (willpower, corePoint, dealerA, dealerB, supportA, supportB, 
           remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing) 
    IN (VALUES ${placeholders})
  `;
  
  db.all(query, params, async (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      // 모든 상태의 ID 수집
      const stateIds = rows.map(row => row.id);
      
      // percentile 데이터 조회
      const percentileQuery = `
        SELECT gem_state_id, target, percentile, value
        FROM goal_probability_distributions
        WHERE gem_state_id IN (${stateIds.map(() => '?').join(',')})
        ORDER BY gem_state_id, target, percentile
      `;
      
      // expected costs 데이터 조회  
      const costsQuery = `
        SELECT gem_state_id, target, expected_cost_to_goal
        FROM expected_costs
        WHERE gem_state_id IN (${stateIds.map(() => '?').join(',')})
      `;
      
      // available options 데이터 조회
      const optionsQuery = `
        SELECT gem_state_id, action, probability, description, selectionProbability
        FROM available_options
        WHERE gem_state_id IN (${stateIds.map(() => '?').join(',')})
        ORDER BY gem_state_id, selectionProbability DESC
      `;
      
      try {
        const [percentileRows, costRows, optionRows] = await Promise.all([
          new Promise((resolve, reject) => {
            db.all(percentileQuery, stateIds, (err, rows) => err ? reject(err) : resolve(rows));
          }),
          new Promise((resolve, reject) => {
            db.all(costsQuery, stateIds, (err, rows) => err ? reject(err) : resolve(rows));
          }),
          new Promise((resolve, reject) => {
            db.all(optionsQuery, stateIds, (err, rows) => err ? reject(err) : resolve(rows));
          })
        ]);
        
        // 결과 매핑
        const result = {
          current: null,
          reroll: null,
          options: [],
          availableOptions: availableOptions
        };
        
        for (const row of rows) {
          const rowKey = `${row.willpower}_${row.corePoint}_${row.dealerA}_${row.dealerB}_${row.supportA}_${row.supportB}_${row.remainingAttempts}_${row.currentRerollAttempts}_${row.costModifier}_${row.isFirstProcessing}`;
          
          const state = states.find(s => s.key === rowKey);
          if (state) {
            // percentiles 구조화
            const percentiles = {};
            const statePercentiles = percentileRows.filter(p => p.gem_state_id === row.id);
            for (const pRow of statePercentiles) {
              if (!percentiles[pRow.target]) {
                percentiles[pRow.target] = {};
              }
              percentiles[pRow.target][pRow.percentile] = pRow.value;
            }
            
            // expected costs 구조화
            const expectedCosts = {};
            const stateCosts = costRows.filter(c => c.gem_state_id === row.id);
            for (const cRow of stateCosts) {
              expectedCosts[cRow.target] = cRow.expected_cost_to_goal;
            }
            
            // available options 구조화
            const availableOptions = optionRows.filter(o => o.gem_state_id === row.id);
            
            const probData = {
              gem: state.gem,
              probabilities: {
                prob_5_5: row.prob_5_5,
                prob_5_4: row.prob_5_4,
                prob_4_5: row.prob_4_5,
                prob_5_3: row.prob_5_3,
                prob_4_4: row.prob_4_4,
                prob_3_5: row.prob_3_5,
                prob_sum8: row.prob_sum8,
                prob_sum9: row.prob_sum9,
                prob_relic: row.prob_relic,
                prob_ancient: row.prob_ancient,
                prob_dealer_complete: row.prob_dealer_complete,
                prob_support_complete: row.prob_support_complete
              },
              percentiles,
              expectedCosts,
              availableOptions
            };
            
            if (state.type === 'current') {
              result.current = probData;
            } else if (state.type === 'reroll') {
              result.reroll = probData;
            } else if (state.type === 'option') {
              result.options.push({
                action: state.action,
                ...probData
              });
            }
          }
        }
        
        res.json(result);
      } catch (dbError) {
        res.status(500).json({ error: dbError.message });
      }
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