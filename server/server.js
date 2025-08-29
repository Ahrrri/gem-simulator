#!/usr/bin/env node
/**
 * SQLite API 서버 for Gem Simulator
 * 1GB probability_table.db 파일을 백엔드에서 처리
 */

import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
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
    const dbPath = join(__dirname, '../probability_table.db');
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ SQLite 연결 실패:', err.message);
        reject(err);
      } else {
        console.log('✅ SQLite 데이터베이스 연결 성공');
        
        // 데이터베이스 정보 확인
        db.get("SELECT COUNT(*) as count FROM gem_states", (err, row) => {
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
  const minAttempts = parseInt(req.query.minAttempts) || 3;
  
  const query = `
    SELECT 
      COUNT(*) as total_states,
      AVG(prob_sum8) as avg_sum8,
      AVG(prob_sum9) as avg_sum9,
      AVG(prob_relic) as avg_relic,
      AVG(prob_ancient) as avg_ancient,
      MAX(prob_ancient) as max_ancient
    FROM gem_states 
    WHERE remainingAttempts >= ?
  `;
  
  db.get(query, [minAttempts], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row);
    }
  });
});

// 젬 상태별 확률 조회
app.get('/api/gem-probabilities', (req, res) => {
  const {
    willpower, corePoint, dealerA, dealerB, supportA, supportB,
    remainingAttempts, currentRerollAttempts = 0, costModifier = 0, isFirstProcessing = 0
  } = req.query;
  
  const query = `
    SELECT prob_5_5, prob_5_4, prob_4_5, prob_5_3, prob_4_4, prob_3_5,
           prob_sum8, prob_sum9, prob_relic, prob_ancient
    FROM gem_states 
    WHERE willpower = ? AND corePoint = ? 
      AND dealerA = ? AND dealerB = ? AND supportA = ? AND supportB = ?
      AND remainingAttempts = ? AND currentRerollAttempts = ?
      AND costModifier = ? AND isFirstProcessing = ?
  `;
  
  const params = [
    willpower, corePoint, dealerA, dealerB, supportA, supportB,
    remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing
  ];
  
  db.get(query, params, (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(row || null);
    }
  });
});

// 높은 확률 상태들 조회
app.get('/api/high-probability', (req, res) => {
  const target = req.query.target || 'prob_ancient';
  const minProb = parseFloat(req.query.minProb) || 0.8;
  const limit = parseInt(req.query.limit) || 10;
  
  // SQL injection 방지를 위한 컬럼명 검증
  const allowedTargets = ['prob_5_5', 'prob_5_4', 'prob_4_5', 'prob_5_3', 'prob_4_4', 'prob_3_5', 'prob_sum8', 'prob_sum9', 'prob_relic', 'prob_ancient'];
  if (!allowedTargets.includes(target)) {
    return res.status(400).json({ error: 'Invalid target column' });
  }
  
  const query = `
    SELECT willpower, corePoint, dealerA, dealerB, supportA, supportB,
           remainingAttempts, currentRerollAttempts, ${target}
    FROM gem_states 
    WHERE ${target} >= ?
    ORDER BY ${target} DESC 
    LIMIT ?
  `;
  
  db.all(query, [minProb, limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
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
    
    app.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다`);
      console.log(`📡 API 엔드포인트:`);
      console.log(`   GET  /health - 헬스 체크`);
      console.log(`   GET  /api/stats - 데이터베이스 통계`);
      console.log(`   GET  /api/gem-probabilities - 젬 상태별 확률`);
      console.log(`   GET  /api/high-probability - 높은 확률 상태들`);
      console.log(`   POST /api/query - 커스텀 쿼리`);
      console.log(`   GET  /api/available-options/:id - 사용 가능한 옵션들`);
    });
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