#!/usr/bin/env node
/**
 * 1%당 기대 비용 기반 가공 실험
 * 
 * 10만 개 젬을 준비하고, 1%당 기대 비용이 가장 낮은 젬부터
 * 한 번씩 가공하는 전략 테스트
 */

import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import cliProgress from 'cli-progress';
import { 
  createProcessingGem,
  executeGemProcessing,
  rerollProcessingOptions,
} from '../utils/gemProcessing.js';
import { PROCESSING_COST } from '../utils/gemConstants.js';

// ES 모듈에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite 데이터베이스 연결
let db = null;
const MAX_REROLL = 2;

try {
  const dbPath = path.join(__dirname, '../../probability_table_reroll_2.db');
  db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
  console.log('✅ SQLite 데이터베이스 연결 완료');
} catch (error) {
  console.error('❌ 데이터베이스 연결 실패:', error.message);
  process.exit(1);
}

/**
 * DB에서 확률과 expected cost 조회
 */
const getGemMetrics = (gem, goalKey) => {
  return new Promise((resolve, reject) => {
    const cappedReroll = Math.min(MAX_REROLL, gem.currentRerollAttempts || 0);
    const firstProcessing = gem.processingCount === 0 ? 1 : 0;
    
    // 목표에 대한 확률 컬럼 매핑
    const columnMapping = {
      'sum9+': 'prob_sum9',
      'dealer_complete': 'prob_dealer_complete',
      'support_complete': 'prob_support_complete'
    };
    const columnName = columnMapping[goalKey];
    
    // 확률과 expected cost를 한 번에 조회
    db.get(
      `SELECT gp.id, gp.${columnName} as probability,
              ec.expected_cost_to_goal as expectedCost
       FROM goal_probabilities gp
       LEFT JOIN expected_costs ec ON gp.id = ec.gem_state_id AND ec.target = ?
       WHERE gp.willpower = ? AND gp.corePoint = ? 
       AND gp.dealerA = ? AND gp.dealerB = ? 
       AND gp.supportA = ? AND gp.supportB = ? 
       AND gp.remainingAttempts = ? 
       AND gp.currentRerollAttempts = ? 
       AND gp.costModifier = ? 
       AND gp.isFirstProcessing = ?`,
      [
        goalKey,
        gem.willpower, gem.corePoint, 
        gem.dealerA || 0, gem.dealerB || 0, 
        gem.supportA || 0, gem.supportB || 0, 
        gem.remainingAttempts, cappedReroll, 
        gem.costModifier || 0, firstProcessing
      ],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row) {
          resolve({
            probability: parseFloat(row.probability || 0) * 100,
            expectedCost: parseFloat(row.expectedCost || Infinity)
          });
        } else {
          resolve({ probability: 0, expectedCost: Infinity });
        }
      }
    );
  });
};

/**
 * 목표 달성 확인
 */
const checkGoalAchieved = (gem, goalKey) => {
  if (goalKey === 'sum9+') {
    return (gem.willpower + gem.corePoint) >= 9;
  } else if (goalKey === 'dealer_complete') {
    return gem.dealerA >= 5 && gem.dealerB >= 5;
  } else if (goalKey === 'support_complete') {
    return gem.supportA >= 5 && gem.supportB >= 5;
  }
  return false;
};

/**
 * 옵션별 메트릭 계산
 */
const calculateOptionMetrics = async (gem, options, goalKey) => {
  const optionsWithMetrics = [];
  
  for (const option of options) {
    // 이 옵션을 선택했을 때의 결과 젬
    const resultGem = executeGemProcessing({ ...gem }, option.action);
    
    // 결과 젬의 메트릭 조회
    const metrics = await getGemMetrics(resultGem, goalKey);
    
    optionsWithMetrics.push({
      ...option,
      resultProbability: metrics.probability,
      resultExpectedCost: metrics.expectedCost,
      costPerPercent: metrics.probability > 0 ? 
        metrics.expectedCost / metrics.probability : Infinity
    });
  }
  
  return optionsWithMetrics;
};

/**
 * 리롤 후 예상 메트릭 계산 (간단한 추정)
 */
const estimateRerollMetrics = async (gem, goalKey) => {
  // 리롤 후 젬 상태
  const rerollGem = {
    ...gem,
    currentRerollAttempts: Math.max(0, (gem.currentRerollAttempts || 0) - 1),
  };
  
  // 리롤 후의 평균적인 메트릭 (DB에서 조회)
  const metrics = await getGemMetrics(rerollGem, goalKey);
  return {
    probability: metrics.probability,
    expectedCost: metrics.expectedCost,
    costPerPercent: metrics.probability > 0 ? 
      metrics.expectedCost / metrics.probability : Infinity
  };
};

/**
 * 1%당 기대 비용 기반 가공 실험
 */
const runCostPerPercentExperiment = async (mainType, subType, grade, goalKey, numGems = 100000) => {
  console.log('\n🔬 1%당 기대 비용 기반 가공 실험 시작');
  console.log(`목표: ${goalKey}`);
  console.log(`젬 개수: ${numGems.toLocaleString()}개`);
  console.log('전략: 1%당 기대 비용이 가장 낮은 젬부터 가공\n');
  
  // 1단계: 젬 풀 생성
  console.log('📦 젬 풀 생성 중...');
  const gemPool = [];
  const progressBar = new cliProgress.SingleBar({
    format: '진행 |{bar}| {percentage}% | {value}/{total} 젬',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(numGems, 0);
  
  for (let i = 0; i < numGems; i++) {
    const gem = createProcessingGem(mainType, subType, grade);
    gem.id = i; // 추적용 ID
    gem.processingCount = 0;
    gem.totalCost = 0;
    gem.achieved = false;
    gemPool.push(gem);
    
    if (i % 1000 === 0) {
      progressBar.update(i);
    }
  }
  progressBar.stop();
  
  // 2단계: 초기 메트릭 계산 및 최적 선택 결정
  console.log('\n📊 초기 메트릭 계산 중...');
  progressBar.start(numGems, 0);
  
  for (let i = 0; i < gemPool.length; i++) {
    const gem = gemPool[i];
    
    // 이미 달성한 경우 체크
    if (checkGoalAchieved(gem, goalKey)) {
      gem.achieved = true;
      gem.probability = 100;
      gem.expectedCost = 0;
      gem.costPerPercent = 0;
      gem.bestChoice = 'achieved';
    } else {
      // 현재 옵션들의 메트릭 계산 (25% 확률씩이므로 기대값 사용)
      const optionsWithMetrics = await calculateOptionMetrics(gem, gem.autoOptionSet, goalKey);
      
      // 옵션들의 기대값 계산 (25%씩 선택 확률)
      let avgProbability = 0;
      let avgExpectedCost = 0;
      
      for (const option of optionsWithMetrics) {
        avgProbability += option.resultProbability * 0.25;
        avgExpectedCost += option.resultExpectedCost * 0.25;
      }
      
      const processCostPerPercent = avgProbability > 0 ? avgExpectedCost / avgProbability : Infinity;
      
      gem.bestChoice = 'process';
      gem.costPerPercent = processCostPerPercent;
      gem.probability = avgProbability;
      gem.expectedCost = avgExpectedCost;
      
      // 리롤 가능한 경우 리롤 메트릭도 계산 (확률 기준으로 비교)
      if (gem.currentRerollAttempts > 0 && gem.processingCount > 0) {
        const rerollMetrics = await estimateRerollMetrics(gem, goalKey);
        // 리롤 후 확률이 현재 옵션들의 평균 확률보다 높으면 리롤
        if (rerollMetrics.probability > avgProbability) {
          gem.bestChoice = 'reroll';
          gem.costPerPercent = rerollMetrics.costPerPercent;
          gem.probability = rerollMetrics.probability;
          gem.expectedCost = rerollMetrics.expectedCost;
        }
      }
    }
    
    if (i % 100 === 0) {
      progressBar.update(i);
    }
  }
  progressBar.stop();
  
  // 3단계: 라운드별 가공 실행
  console.log('\n⚡ 라운드별 가공 시작...\n');
  
  let round = 0;
  let totalCost = 0;
  let achievedCount = gemPool.filter(g => g.achieved).length;
  const maxRounds = 20; // 최대 라운드 수 제한
  
  while (round < maxRounds && achievedCount < numGems) {
    round++;
    console.log(`\n--- 라운드 ${round} ---`);
    
    // 가공 가능한 젬 필터링 (달성하지 못했고, 가공 횟수가 남은 젬)
    const processableGems = gemPool.filter(g => 
      !g.achieved && g.remainingAttempts > 0
    );
    
    if (processableGems.length === 0) {
      console.log('⚠️ 가공 가능한 젬이 없습니다.');
      break;
    }
    
    // 1%당 비용으로 정렬 (낮은 것부터)
    processableGems.sort((a, b) => a.costPerPercent - b.costPerPercent);
    
    console.log(`가공 가능 젬: ${processableGems.length}개`);
    
    // 최고 효율 젬 상세 정보
    const bestGem = processableGems[0];
    console.log(`최고 효율 젬 #${bestGem.id}:`);
    console.log(`  상태: (${bestGem.willpower}, ${bestGem.corePoint}, ${bestGem.dealerA}, ${bestGem.dealerB}, ${bestGem.supportA}, ${bestGem.supportB}) | 가공: ${bestGem.remainingAttempts}회, 리롤: ${bestGem.currentRerollAttempts}회, 비용변동: ${bestGem.costModifier || 0}`);
    console.log(`  옵션: [${bestGem.autoOptionSet?.map(opt => opt.action).join(', ') || '없음'}]`);
    console.log(`  확률: ${bestGem.probability.toFixed(2)}%, 1%당: ${Math.round(bestGem.costPerPercent)}골드`);
    console.log(`  선택: ${bestGem.bestChoice === 'reroll' ? '리롤' : '가공'}`);
    
    // 최저 효율 젬 상세 정보
    const worstGem = processableGems[processableGems.length-1];
    console.log(`최저 효율 젬 #${worstGem.id}:`);
    console.log(`  상태: (${worstGem.willpower}, ${worstGem.corePoint}, ${worstGem.dealerA}, ${worstGem.dealerB}, ${worstGem.supportA}, ${worstGem.supportB}) | 가공: ${worstGem.remainingAttempts}회, 리롤: ${worstGem.currentRerollAttempts}회, 비용변동: ${worstGem.costModifier || 0}`);
    console.log(`  옵션: [${worstGem.autoOptionSet?.map(opt => opt.action).join(', ') || '없음'}]`);
    console.log(`  확률: ${worstGem.probability.toFixed(2)}%, 1%당: ${Math.round(worstGem.costPerPercent)}골드`);
    console.log(`  선택: ${worstGem.bestChoice === 'reroll' ? '리롤' : '가공'}`);
    
    // 각 젬에 대해 한 번씩 가공
    let roundCost = 0;
    let roundAchieved = 0;
    let roundRerolls = 0;
    
    for (const gem of processableGems) {
      // 가공 비용 계산
      const processingCost = PROCESSING_COST * (1 + (gem.costModifier || 0) / 100);
      gem.totalCost += processingCost;
      roundCost += processingCost;
      totalCost += processingCost;
      gem.processingCount++;
      
      // 최적 선택에 따라 실행
      if (gem.bestChoice === 'reroll') {
        // 리롤 실행
        const rerolledGem = rerollProcessingOptions(gem);
        Object.assign(gem, rerolledGem);
        roundRerolls++;
      } else {
        // 랜덤하게 옵션 선택 (25% 확률씩)
        if (!gem.autoOptionSet || gem.autoOptionSet.length === 0) {
          continue;
        }
        const randomOption = gem.autoOptionSet[
          Math.floor(Math.random() * gem.autoOptionSet.length)
        ];
        const processedGem = executeGemProcessing(gem, randomOption.action);
        Object.assign(gem, processedGem);
      }
      
      // 목표 달성 확인
      if (checkGoalAchieved(gem, goalKey)) {
        gem.achieved = true;
        roundAchieved++;
        achievedCount++;
      } else if (gem.remainingAttempts > 0) {
        // 다음 라운드를 위한 메트릭 재계산
        // 현재 옵션들의 메트릭 계산 (25% 확률씩이므로 기대값 사용)
        const optionsWithMetrics = await calculateOptionMetrics(gem, gem.autoOptionSet, goalKey);
        
        // 옵션들의 기대값 계산 (25%씩 선택 확률)
        let avgProbability = 0;
        let avgExpectedCost = 0;
        
        for (const option of optionsWithMetrics) {
          avgProbability += option.resultProbability * 0.25;
          avgExpectedCost += option.resultExpectedCost * 0.25;
        }
        
        const processCostPerPercent = avgProbability > 0 ? avgExpectedCost / avgProbability : Infinity;
        
        gem.bestChoice = 'process';
        gem.costPerPercent = processCostPerPercent;
        gem.probability = avgProbability;
        gem.expectedCost = avgExpectedCost;
        
        // 리롤 가능한 경우 리롤 메트릭도 계산 (확률 기준으로 비교)
        if (gem.currentRerollAttempts > 0) {
          const rerollMetrics = await estimateRerollMetrics(gem, goalKey);
          // 리롤 후 확률이 현재 옵션들의 평균 확률보다 높으면 리롤
          if (rerollMetrics.probability > avgProbability) {
            gem.bestChoice = 'reroll';
            gem.costPerPercent = rerollMetrics.costPerPercent;
            gem.probability = rerollMetrics.probability;
            gem.expectedCost = rerollMetrics.expectedCost;
          }
        }
      }
    }
    
    console.log(`라운드 비용: ${Math.round(roundCost).toLocaleString()}골드`);
    console.log(`라운드 달성: ${roundAchieved}개, 리롤: ${roundRerolls}회`);
    console.log(`누적 달성: ${achievedCount}/${numGems} (${(achievedCount/numGems*100).toFixed(2)}%)`);
  }
  
  // 4단계: 결과 분석
  console.log('\n\n📈 실험 결과 분석');
  console.log('===================');
  
  const achievedGems = gemPool.filter(g => g.achieved);
  const failedGems = gemPool.filter(g => !g.achieved);
  
  console.log(`\n✅ 성공률: ${(achievedGems.length/numGems*100).toFixed(2)}% (${achievedGems.length}/${numGems})`);
  console.log(`❌ 실패: ${failedGems.length}개`);
  
  if (achievedGems.length > 0) {
    const avgCost = achievedGems.reduce((sum, g) => sum + g.totalCost, 0) / achievedGems.length;
    const minCost = Math.min(...achievedGems.map(g => g.totalCost));
    const maxCost = Math.max(...achievedGems.map(g => g.totalCost));
    const avgAttempts = achievedGems.reduce((sum, g) => sum + g.processingCount, 0) / achievedGems.length;
    
    console.log(`\n💰 비용 분석 (성공한 젬만):`);
    console.log(`  평균: ${Math.round(avgCost).toLocaleString()}골드`);
    console.log(`  최소: ${Math.round(minCost).toLocaleString()}골드`);
    console.log(`  최대: ${Math.round(maxCost).toLocaleString()}골드`);
    console.log(`  평균 가공 횟수: ${avgAttempts.toFixed(1)}회`);
  }
  
  console.log(`\n💵 총 비용: ${Math.round(totalCost).toLocaleString()}골드`);
  console.log(`젬당 평균 비용: ${Math.round(totalCost/numGems).toLocaleString()}골드`);
  
  // 효율성 분포 분석
  const efficiencyBuckets = {
    '0-1000': 0,
    '1000-2000': 0,
    '2000-3000': 0,
    '3000-5000': 0,
    '5000+': 0
  };
  
  for (const gem of gemPool) {
    const costPerPercent = gem.costPerPercent;
    if (costPerPercent < 1000) efficiencyBuckets['0-1000']++;
    else if (costPerPercent < 2000) efficiencyBuckets['1000-2000']++;
    else if (costPerPercent < 3000) efficiencyBuckets['2000-3000']++;
    else if (costPerPercent < 5000) efficiencyBuckets['3000-5000']++;
    else efficiencyBuckets['5000+']++;
  }
  
  console.log(`\n📊 1%당 비용 분포 (최종 상태):`);
  for (const [range, count] of Object.entries(efficiencyBuckets)) {
    const percent = (count/numGems*100).toFixed(1);
    console.log(`  ${range}골드: ${count}개 (${percent}%)`);
  }
  
  return {
    totalGems: numGems,
    achievedCount: achievedGems.length,
    successRate: achievedGems.length / numGems * 100,
    totalCost,
    avgCostPerGem: totalCost / numGems,
    rounds: round
  };
};

// 메인 실행
const main = async () => {
  try {
    console.log('🎮 1%당 기대 비용 기반 가공 실험');
    console.log('=====================================');
    
    // CLI 인자 파싱
    const args = process.argv.slice(2);
    let goalKey = 'sum9+';
    let numGems = 100000;
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--goal' || args[i] === '-g') {
        goalKey = args[i + 1];
        i++;
      } else if (args[i] === '--gems' || args[i] === '-n') {
        numGems = parseInt(args[i + 1]);
        i++;
      }
    }
    
    // 실험 실행
    await runCostPerPercentExperiment('ORDER', 'STABLE', 'HEROIC', goalKey, numGems);
    
  } catch (error) {
    console.error('❌ 실험 중 오류:', error.message);
  } finally {
    if (db) {
      db.close((err) => {
        if (err) console.error('DB 연결 종료 오류:', err);
        else console.log('\n📦 데이터베이스 연결 종료');
      });
    }
  }
};

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runCostPerPercentExperiment };