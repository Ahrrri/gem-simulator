#!/usr/bin/env node
/**
 * 여러 리롤 DB 파일들 간의 확률 차이를 비교하는 스크립트
 * 사용법: node compare-reroll-dbs.js
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import chalk from 'chalk';

// 비교할 DB 파일들
const DB_FILES = [
  './probability_table_reroll_2.db',
  './probability_table_reroll_3.db',
  './probability_table_reroll_4.db',
  './probability_table_reroll_5.db',
  './probability_table_reroll_6.db',
  // './probability_table_reroll_7.db',
];

// 비교할 목표들
const TARGETS = [
  { key: 'prob_5_5', label: '5/5' },
  { key: 'prob_sum8', label: 'sum8+' },
  { key: 'prob_sum9', label: 'sum9+' },
  { key: 'prob_relic', label: 'relic+' },
  { key: 'prob_ancient', label: 'ancient+' },
  { key: 'prob_dealer_complete', label: 'dealer_complete' },
  { key: 'prob_support_complete', label: 'support_complete' }
];

/**
 * 데이터베이스 쿼리를 Promise로 변환
 */
function queryDatabase(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function queryAllDatabase(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * 특정 젬 상태에 대한 확률 조회
 */
async function getProbabilities(dbPath, gemState) {
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  
  try {
    const columns = TARGETS.map(t => t.key).join(', ');
    const sql = `
      SELECT ${columns}
      FROM gem_states 
      WHERE willpower = ? AND corePoint = ? 
        AND dealerA = ? AND dealerB = ? 
        AND supportA = ? AND supportB = ? 
        AND remainingAttempts = ? 
        AND currentRerollAttempts = ? 
        AND costModifier = ? 
        AND isFirstProcessing = ?
    `;
    
    const result = await queryDatabase(db, sql, [
      gemState.willpower,
      gemState.corePoint,
      gemState.dealerA,
      gemState.dealerB,
      gemState.supportA,
      gemState.supportB,
      gemState.remainingAttempts,
      gemState.currentRerollAttempts,
      gemState.costModifier,
      gemState.isFirstProcessing ? 1 : 0
    ]);
    
    return result;
  } finally {
    db.close();
  }
}

/**
 * 여러 DB에서 확률 비교
 */
async function compareGemState(gemState) {
  console.log(chalk.cyan('\n=== 젬 상태 ==='));
  console.log(`willpower: ${gemState.willpower}, corePoint: ${gemState.corePoint}`);
  console.log(`dealerA: ${gemState.dealerA}, dealerB: ${gemState.dealerB}`);
  console.log(`supportA: ${gemState.supportA}, supportB: ${gemState.supportB}`);
  console.log(`remainingAttempts: ${gemState.remainingAttempts}, currentRerollAttempts: ${gemState.currentRerollAttempts}`);
  console.log(`costModifier: ${gemState.costModifier}, isFirstProcessing: ${gemState.isFirstProcessing}`);
  console.log();
  
  // 각 DB에서 확률 가져오기
  const results = [];
  for (const dbPath of DB_FILES) {
    try {
      const probs = await getProbabilities(dbPath, gemState);
      if (probs) {
        // 파일명에서 리롤 횟수 추출
        const rerollCount = parseInt(dbPath.match(/reroll_(\d+)/)[1]);
        results.push({ rerollCount, probs, dbPath });
      } else {
        console.log(chalk.yellow(`${dbPath}: 데이터 없음`));
      }
    } catch (err) {
      console.error(chalk.red(`${dbPath} 오류: ${err.message}`));
    }
  }
  
  if (results.length === 0) {
    console.log(chalk.red('비교할 데이터가 없습니다.'));
    return;
  }
  
  // 결과를 표로 출력
  console.log(chalk.green('\n=== 확률 비교 (%) ==='));
  
  // 헤더 출력
  const header = ['목표', ...results.map(r => `reroll_${r.rerollCount}`)];
  console.log(header.map((h, i) => {
    const width = i === 0 ? 18 : 12;
    return chalk.bold(h.padEnd(width));
  }).join(''));
  console.log('-'.repeat(18 + results.length * 12));
  
  // 각 목표별로 확률 비교
  for (const target of TARGETS) {
    const row = [target.label.padEnd(18)];
    
    let prevValue = null;
    for (let i = 0; i < results.length; i++) {
      const value = results[i].probs[target.key];
      const percent = (value * 100).toFixed(6);
      
      // 이전 값과 비교하여 변화 표시
      let display = percent.padStart(10);
      
      row.push(display + '  ');
      prevValue = value;
    }
    
    console.log(row.join(''));
  }
  
  // 차이 분석
  if (results.length >= 2) {
    console.log(chalk.cyan('\n=== 변화 분석 ==='));
    
    for (let i = 1; i < results.length; i++) {
      const prev = results[i-1];
      const curr = results[i];
      
      console.log(chalk.bold(`\nreroll_${prev.rerollCount} → reroll_${curr.rerollCount}:`));
      
      for (const target of TARGETS) {
        const prevVal = prev.probs[target.key] * 100;
        const currVal = curr.probs[target.key] * 100;
        const diff = currVal - prevVal;
        
        if (Math.abs(diff) > 0.0001) { // 0.01% 이상 차이가 있는 경우만 표시
          const sign = diff > 0 ? '+' : '';
          const color = diff > 0 ? chalk.green : chalk.red;
          console.log(`  ${target.label.padEnd(18)}: ${prevVal.toFixed(6)}% → ${currVal.toFixed(6)}% (${color(sign + diff.toFixed(6))}%)`);
        }
      }
    }
  }
}


/**
 * 메인 함수
 */
async function main() {
  console.log(chalk.bold.cyan('🎲 리롤 DB 비교 도구'));
  console.log(chalk.gray('=====================================\n'));
  
  // DB 파일 존재 확인
  console.log(chalk.cyan('비교할 DB 파일들:'));
  for (const dbPath of DB_FILES) {
    console.log(`  - ${dbPath}`);
  }
  
  // 1. 특정 예제 상태들 비교
  const exampleStates = [
    // 초기 상태 (리롤 횟수가 많은 경우)
    {
      willpower: 1, corePoint: 1,
      dealerA: 1, dealerB: 1, supportA: 0, supportB: 0,
      remainingAttempts: 9, currentRerollAttempts: 2,
      costModifier: 0, isFirstProcessing: true
    }
  ];
  
  for (const state of exampleStates) {
    await compareGemState(state);
  }
  
  // 2. 전체 통계
  console.log(chalk.cyan('\n=== 전체 통계 ==='));
  
  for (const dbPath of DB_FILES) {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    try {
      const stats = await queryDatabase(db, `
        SELECT COUNT(*) as total
        FROM gem_states
      `);
      
      const rerollCount = parseInt(dbPath.match(/reroll_(\d+)/)[1]);
      console.log(chalk.bold(`\nreroll_${rerollCount}:`));
      console.log(`  총 상태 수: ${stats.total}`);
    } finally {
      db.close();
    }
  }
  
  console.log(chalk.green('\n✨ 비교 완료!'));
}

// 실행
main().catch(console.error);