#!/usr/bin/env node
/**
 * 로컬 DB 기반 최적 젬 가공 포기 전략 계산기
 * 
 * 고정점 반복법을 사용해서 최적의 포기 임계값을 찾는다.
 * 
 * 알고리즘:
 * 1. 초기 임계비용 = (젬구매비용 + 평균가공비용) / 초기성공확률
 * 2. N번 시뮬레이션: autoOptionSet을 고려한 포기 판단
 * 3. 시뮬레이션 결과로 새 평균비용 계산하여 임계비용 업데이트
 * 4. 수렴할 때까지 반복
 */

import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createProcessingGem
} from '../utils/gemProcessing.js';
import {
  GEM_PURCHASE_COSTS,
  GOALS,
  GEM_CONFIGS,
  getLocalProbabilityAndCost,
  closeDatabase,
  getCacheSize
} from './local_util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 젬 초기 상태에서 확률과 예상비용 조회 (개선된 버전)
async function getInitialGemStats(grade, goalKey = 'sum9+') {
  const gem = createProcessingGem('CHAOS', 'EROSION', grade);
  const result = await getLocalProbabilityAndCost(gem, goalKey);
  
  return {
    initialSuccessRate: result.probability / 100, // 퍼센트를 소수로 변환
    initialProcessingCost: result.expectedCost === Infinity ? 10000 : result.expectedCost
  };
}

// 워커 풀 생성
async function createWorkerPool(grade, purchaseCost, goalKey) {
  const numCores = os.cpus().length;
  
  console.log(`🏗️  워커 풀 생성: ${numCores}개 워커`);
  
  const workers = [];
  
  for (let i = 0; i < numCores; i++) {
    const worker = new Worker(path.join(__dirname, 'persistent-worker.js'), {
      workerData: {
        grade,
        purchaseCost,
        goalKey,
        simulationsPerBatch: 0 // 적응형이므로 나중에 동적으로 할당
      }
    });
    
    workers.push({ worker });
  }
  
  return workers;
}

// 적응형 시뮬레이션 실행 (평균이 안정될 때까지)
async function runAdaptiveSimulations(workerPool, thresholdCost, batchSize = 10000, minBatches = 10, maxBatches = 1000) {
  console.log(`🚀 적응형 시뮬레이션 시작 (배치 크기: ${batchSize.toLocaleString()})`);
  
  const cumulativeAvgs = []; // 누적 평균 저장
  const stdWindow = 10; // 표준편차 윈도우 크기
  const stdThreshold = 25; // 표준편차 임계값 (G)
  
  let totalSimulations = 0;
  let totalCost = 0;
  let successCount = 0;
  let abandonedCount = 0;
  let successTotalCost = 0;
  let abandonedTotalCost = 0;
  let completedTotalCost = 0;
  let totalProcessingAttempts = 0;
  let successProcessingAttempts = 0;
  let abandonedProcessingAttempts = 0;
  let completedProcessingAttempts = 0;
  
  for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
    // 각 워커에게 배치 할당
    const promises = [];
    const simulationsPerWorker = Math.ceil(batchSize / workerPool.length);
    
    for (const { worker } of workerPool) {
      const promise = new Promise((resolve, reject) => {
        const messageHandler = (message) => {
          if (message.type === 'result') {
            worker.off('message', messageHandler);
            worker.off('error', errorHandler);
            resolve(message.data);
          }
        };
        
        const errorHandler = (error) => {
          worker.off('message', messageHandler);
          worker.off('error', errorHandler);
          reject(error);
        };
        
        worker.on('message', messageHandler);
        worker.on('error', errorHandler);
        
        worker.postMessage({
          type: 'simulate',
          thresholdCost,
          numSimulations: simulationsPerWorker
        });
      });
      
      promises.push(promise);
    }
    
    // 배치 결과 수집
    const batchData = await Promise.all(promises);
    
    // 배치 결과 집계
    let batchTotalCost = 0;
    let batchSuccessCount = 0;
    let batchSimulations = 0;
    
    for (const result of batchData) {
      batchSimulations += result.numSimulations || simulationsPerWorker;
      batchTotalCost += result.totalCost;
      batchSuccessCount += result.successCount;
      
      // 전체 통계 업데이트
      totalCost += result.totalCost;
      successCount += result.successCount;
      abandonedCount += result.abandonedCount;
      successTotalCost += result.successTotalCost;
      abandonedTotalCost += result.abandonedTotalCost;
      completedTotalCost += result.completedTotalCost;
      totalProcessingAttempts += result.totalProcessingAttempts || 0;
      successProcessingAttempts += result.successProcessingAttempts || 0;
      abandonedProcessingAttempts += result.abandonedProcessingAttempts || 0;
      completedProcessingAttempts += result.completedProcessingAttempts || 0;
    }
    
    totalSimulations += batchSimulations;
    
    // 현재 전체 누적 평균
    const currentAvgCost = successCount > 0 ? totalCost / successCount : Infinity;
    cumulativeAvgs.push(currentAvgCost);
    
    // 윈도우 표준편차 계산 (최소 배치 수 이후)
    if (batchNum >= minBatches - 1 && cumulativeAvgs.length >= stdWindow) {
      // 최근 stdWindow개 배치의 표준편차 계산
      const windowStart = Math.max(0, cumulativeAvgs.length - stdWindow);
      const windowAvgs = cumulativeAvgs.slice(windowStart);
      
      const windowMean = windowAvgs.reduce((a, b) => a + b, 0) / windowAvgs.length;
      const variance = windowAvgs.reduce((sum, val) => sum + Math.pow(val - windowMean, 2), 0) / windowAvgs.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`📈 배치 ${batchNum + 1}: 시뮬레이션=${batchSimulations.toLocaleString()}회 (누적 ${totalSimulations.toLocaleString()}회), 평균=${Math.round(currentAvgCost).toLocaleString()}G, StdDev=${Math.round(stdDev).toLocaleString()}G, 성공률=${(successCount/totalSimulations*100).toFixed(3)}%`);
      
      // 수렴 판단: 표준편차가 임계값보다 작으면 안정적
      if (stdDev < stdThreshold && batchNum >= minBatches) {
        console.log(`\n✅ 수렴 달성! (윈도우 표준편차: ${Math.round(stdDev).toLocaleString()}G < ${stdThreshold.toLocaleString()}G)`);
        break;
      }
    } else {
      const status = cumulativeAvgs.length < stdWindow ? `윈도우 구축 중... (${cumulativeAvgs.length}/${stdWindow})` : '초기화 중...';
      console.log(`📈 배치 ${batchNum + 1}: 시뮬레이션=${batchSimulations.toLocaleString()}회 (누적 ${totalSimulations.toLocaleString()}회), 평균=${Math.round(currentAvgCost).toLocaleString()}G, 성공률=${(successCount/totalSimulations*100).toFixed(3)}% (${status})`);
    }
  }
  
  const avgCostPerSuccess = successCount > 0 ? totalCost / successCount : Infinity;
  const failedCount = totalSimulations - successCount;
  const completedCount = failedCount - abandonedCount;
  
  console.log(`\n📊 시뮬레이션 결과 (임계값: ${Math.round(thresholdCost).toLocaleString()}G):`);
  console.log(`   총 시뮬레이션: ${totalSimulations.toLocaleString()}회 (${cumulativeAvgs.length}개 배치)`);
  console.log(`   성공: ${successCount}/${totalSimulations} (${(successCount/totalSimulations*100).toFixed(2)}%)`);
  console.log(`   실패: ${failedCount}/${totalSimulations} (${(failedCount/totalSimulations*100).toFixed(2)}%)`);
  console.log(`     - 포기: ${abandonedCount} (${(abandonedCount/totalSimulations*100).toFixed(2)}%)`);
  console.log(`     - 끝까지: ${completedCount} (${(completedCount/totalSimulations*100).toFixed(2)}%)`);
  console.log(`   목표당 평균 비용: ${Math.round(avgCostPerSuccess).toLocaleString()}G`);
  
  return avgCostPerSuccess;
}

// 워커 풀 종료
async function terminateWorkerPool(workerPool) {
  console.log('🧹 워커 풀 정리 중...');
  
  for (const { worker } of workerPool) {
    await worker.terminate();
  }
}

// 최적 임계값 찾기 (고정점 반복법) - 적응형 버전
async function findOptimalThreshold(grade, purchaseCost, goalKey = 'sum9+', maxIterations = 100, tolerance = 100, batchSize = 10000) {
  // DB에서 초기 상태 조회
  const { initialSuccessRate, initialProcessingCost } = await getInitialGemStats(grade, goalKey);
  
  // 초기 임계값 계산
  let thresholdCost = (purchaseCost + initialProcessingCost) / initialSuccessRate;
  
  console.log(`\n🎯 ${grade} 젬 ${goalKey} 목표의 최적 포기 전략 계산 시작`);
  console.log(`📈 초기 임계값: ${Math.round(thresholdCost).toLocaleString()}G`);
  console.log(`💰 젬 구매비용: ${purchaseCost.toLocaleString()}G`);
  console.log(`🎲 초기 성공률: ${(initialSuccessRate * 100).toFixed(4)}%`);
  console.log(`⚙️  초기 가공비용: ${Math.round(initialProcessingCost).toLocaleString()}G`);
  console.log(`📦 배치 크기: ${batchSize.toLocaleString()} 시뮬레이션/배치`);
  
  const results = [];
  let previousThresholds = []; // 최근 임계값들 저장
  const historySize = 5; // 최근 5개 임계값 추적
  
  // 워커 재사용을 위한 워커 풀 생성
  const workerPool = await createWorkerPool(grade, purchaseCost, goalKey);
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n🔄 반복 ${iteration}/${maxIterations}`);
    
    // 적응형 시뮬레이션 실행
    const avgCost = await runAdaptiveSimulations(workerPool, thresholdCost, batchSize);
    
    if (avgCost === Infinity) {
      console.log('❌ 모든 시뮬레이션이 실패했습니다. 임계값을 높입니다.');
      thresholdCost *= 1.5;
      continue;
    }
    
    const newThreshold = avgCost;
    const change = newThreshold - thresholdCost;
    
    results.push({
      iteration,
      threshold: thresholdCost,
      avgCost,
      newThreshold,
      change
    });
    
    console.log(`🎯 새로운 임계값: ${Math.round(newThreshold).toLocaleString()}G (변화: ${change > 0 ? '+' : ''}${change.toFixed(1)}G)`);
    
    // 이전 임계값들 기록
    previousThresholds.push(newThreshold);
    if (previousThresholds.length > historySize) {
      previousThresholds.shift();
    }
    
    // 최근 임계값들의 변동 확인
    if (previousThresholds.length >= historySize) {
      const avgThreshold = previousThresholds.reduce((a, b) => a + b, 0) / previousThresholds.length;
      const variance = previousThresholds.reduce((sum, val) => sum + Math.pow(val - avgThreshold, 2), 0) / previousThresholds.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`📊 최근 ${historySize}개 임계값 평균: ${Math.round(avgThreshold).toLocaleString()}G (표준편차: ${Math.round(stdDev).toLocaleString()}G)`);
      
      // 수렴 체크 - 표준편차가 tolerance 이하
      if (stdDev < tolerance) {
        console.log(`\n✅ 수렴 완료! (표준편차 ${Math.round(stdDev).toLocaleString()}G < ${tolerance}G)`);
        thresholdCost = avgThreshold; // 평균값 사용
        break;
      }
    }
    
    thresholdCost = newThreshold;
  }
  
  // 결과 출력
  console.log(`\n📊 최종 결과:`);
  console.log(`🎯 최적 임계값: ${Math.round(thresholdCost).toLocaleString()}G`);
  console.log(`💸 예상 평균비용: ${Math.round(results[results.length-1].avgCost).toLocaleString()}G`);
  
  if (results.length > 10) {
    console.log(`\n📈 수렴 과정 (최근 10개):`);
    results.slice(-10).forEach(r => {
      console.log(`   반복 ${r.iteration}: ${Math.round(r.threshold).toLocaleString()}G → ${Math.round(r.newThreshold).toLocaleString()}G`);
    });
  } else {
    console.log(`\n📈 수렴 과정:`);
    results.forEach(r => {
      console.log(`   반복 ${r.iteration}: ${Math.round(r.threshold).toLocaleString()}G → ${Math.round(r.newThreshold).toLocaleString()}G`);
    });
  }
  
  // 워커 풀 정리
  await terminateWorkerPool(workerPool);
  
  return { 
    optimalThreshold: thresholdCost, 
    expectedCost: results[results.length-1].avgCost,
    iterations: results.length 
  };
}

// 메인 함수
async function main() {
  try {
    console.log('🚀 최적 젬 가공 전략 계산기 (적응형 버전)');
    console.log('=' .repeat(50));
    
    // 명령행 인자 파싱
    const args = process.argv.slice(2);
    const grade = args[0] ? args[0].toUpperCase() : 'RARE'; // 기본값 RARE
    const goalKey = args[1] ? args[1] : 'sum9+'; // 기본값 sum9+
    let purchaseCost = args[2] ? parseInt(args[2]) : null; // 구매 비용
    const batchSize = args[3] ? parseInt(args[3]) : 10000; // 배치 크기 (기본값 10000)
    
    // 젬 등급 유효성 검사
    if (!GEM_CONFIGS[grade]) {
      console.error(`❌ 지원하지 않는 젬 등급: ${grade}`);
      console.log(`✅ 지원 등급: ${Object.keys(GEM_CONFIGS).join(', ')}`);
      return;
    }
    
    // 목표 유효성 검사
    if (!GOALS[goalKey]) {
      console.error(`❌ 지원하지 않는 목표: ${goalKey}`);
      console.log(`✅ 지원 목표: ${Object.keys(GOALS).join(', ')}`);
      return;
    }
    
    // 구매 비용이 지정되지 않은 경우 기본값 사용
    if (!purchaseCost) {
      const gradeKey = grade.toLowerCase();
      purchaseCost = GEM_PURCHASE_COSTS[gradeKey] || 10000;
    }
    
    console.log(`💎 젬 등급: ${grade}`);
    console.log(`🎯 목표: ${goalKey} (${GOALS[goalKey]})`);
    console.log(`💰 젬 구매 비용: ${purchaseCost.toLocaleString()}G`);
    console.log(`📦 배치 크기: ${batchSize.toLocaleString()}회/배치`);
    console.log(`⚡ 처리 방식: 적응형 멀티코어 병렬 (${os.cpus().length}코어)`);
    console.log(`📊 수렴 기준: 누적 평균이 안정될 때까지 지속(배치 단위로 체크)`);
    
    // 선택된 젬 등급과 목표로 분석
    const result = await findOptimalThreshold(grade, purchaseCost, goalKey, 100, 100, batchSize);
    
    console.log('\n' + '='.repeat(50));
    console.log('🏆 최종 권장 전략:');
    console.log(`${grade} 젬 ${goalKey} 목표: 예상비용/확률이 ${Math.round(result.optimalThreshold).toLocaleString()}G를 초과하면 포기`);
    console.log(`예상 평균 비용: ${Math.round(result.expectedCost).toLocaleString()}G`);
    console.log(`총 반복 횟수: ${result.iterations}회`);
    console.log(`캐시 크기: ${getCacheSize().toLocaleString()}개 항목`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    closeDatabase();
  }
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { findOptimalThreshold, getInitialGemStats };