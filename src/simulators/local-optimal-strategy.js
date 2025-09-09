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

import cliProgress from 'cli-progress';
import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  createProcessingGem,
  executeGemProcessing,
} from '../utils/gemProcessing.js';
import {
  GEM_PURCHASE_COSTS,
  GOALS,
  GEM_CONFIGS,
  getLocalProbabilityAndCost,
  checkGoalAchieved,
  loadLocalOptionProbabilities,
  closeDatabase,
  getCacheSize,
  smartRerollStrategy
} from './local_util.js';
import { rerollProcessingOptions } from '../utils/gemProcessing.js';

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

// 단일 젬 가공 시뮬레이션 (포기 전략 적용) - 개선된 버전
async function simulateGemProcessing(grade, thresholdCostPerPercent, purchaseCost, goalKey = 'sum9+') {
  let gem = createProcessingGem('CHAOS', 'EROSION', grade);
  let success = false;
  let abandoned = false;
  
  try {
    while (gem.remainingAttempts > 0 && !success) {
      // 목표 달성 체크
      if (checkGoalAchieved(gem, goalKey)) {
        success = true;
        break;
      }
      
      // autoOptionSet을 고려한 확률 계산
      if (!gem.autoOptionSet || gem.autoOptionSet.length === 0) {
        break; // 옵션이 없으면 종료
      }
      
      // 리롤 루프 - 더 좋은 옵션이 나올 때까지 계속 리롤
      while (true) {
        const decision = await smartRerollStrategy.shouldReroll(
          gem, 
          gem.autoOptionSet,
          goalKey,
          false // 시뮬레이션에서는 디버깅 출력 생략
        );
        
        if (!decision.reroll) {
          break; // 리롤 안 함 또는 못 함
        }
        
        // 리롤 실행 (무료)
        if (gem.currentRerollAttempts > 0) {
          const rerolledGem = rerollProcessingOptions(gem);
          if (rerolledGem) {
            gem = rerolledGem;
          } else {
            break; // 리롤 실패 시 루프 탈출
          }
        } else {
          break; // 리롤 횟수 없으면 탈출
        }
      }
      
      // 각 옵션의 확률 계산
      const optionsWithProb = await loadLocalOptionProbabilities(gem, gem.autoOptionSet);
      if (!optionsWithProb) {
        break; // 확률 계산 실패 시 종료
      }
      
      // 평균 확률과 예상 비용 계산 (각 옵션 실행 후의 결과)
      let totalProb = 0;
      let totalExpectedCost = 0;
      let validOptions = 0;
      
      for (const option of optionsWithProb) {
        if (option.resultProbabilities?.[goalKey] && option.resultExpectedCosts?.[goalKey] !== undefined) {
          const prob = parseFloat(option.resultProbabilities[goalKey].percent || 0);
          const cost = option.resultExpectedCosts[goalKey];
          
          if (prob > 0 && cost < Infinity) {
            totalProb += prob;
            totalExpectedCost += cost;
            validOptions++;
          }
        }
      }
      
      const avgProbability = validOptions > 0 ? totalProb / validOptions : 0;
      const avgExpectedCost = validOptions > 0 ? totalExpectedCost / validOptions : Infinity;
      const processingCost = 900 * (1 + (gem.costModifier || 0) / 100);

      // 포기 판단: 평균예상비용/평균확률이 임계값보다 크면 포기
      if (avgProbability > 0 && (processingCost + avgExpectedCost) / avgProbability > thresholdCostPerPercent) {
        // 포기하고 시뮬레이션 종료
        abandoned = true;
        break;
      }
      
      // autoOptionSet에서 랜덤 옵션 선택하여 가공 진행
      if (gem.autoOptionSet && gem.autoOptionSet.length > 0) {
        const randomIndex = Math.floor(Math.random() * gem.autoOptionSet.length);
        const selectedOption = gem.autoOptionSet[randomIndex];
        
        // 가공 실행 (executeGemProcessing이 자동으로 비용 누적)
        gem = executeGemProcessing(gem, selectedOption.action);
        
        // 목표 달성 체크
        if (checkGoalAchieved(gem, goalKey)) {
          success = true;
          break;
        }
      } else {
        break; // 옵션이 없으면 종료
      }
    }
    
    const totalCost = purchaseCost + (gem.totalGoldSpent || 0);
    const processingAttempts = gem.processingCount || 0;
    
    return { success, totalCost, abandoned, processingAttempts };
  } catch (error) {
    console.error('시뮬레이션 오류:', error);
    const totalCost = purchaseCost + (gem.totalGoldSpent || 0);
    const processingAttempts = gem.processingCount || 0;
    return { success: false, totalCost, abandoned: false, processingAttempts };
  }
}

// 여러 시뮬레이션 실행하여 평균 비용 계산 (단일 스레드 버전)
async function runSimulations(grade, thresholdCostPerPercent, purchaseCost, goalKey, numSimulations = 1000) {
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
  
  const progressBar = new cliProgress.SingleBar({
    format: '진행률 |{bar}| {percentage}% | {value}/{total} | 평균비용: {avgCost}G',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(numSimulations, 0, { avgCost: 0 });
  
  for (let i = 0; i < numSimulations; i++) {
    const result = await simulateGemProcessing(grade, thresholdCostPerPercent, purchaseCost, goalKey);
    
    // 성공/실패와 관계없이 모든 비용을 누적
    totalCost += result.totalCost;
    totalProcessingAttempts += result.processingAttempts;
    
    if (result.success) {
      successCount++;
      successTotalCost += result.totalCost;
      successProcessingAttempts += result.processingAttempts;
    }
    
    if (result.abandoned) {
      abandonedCount++;
      abandonedTotalCost += result.totalCost;
      abandonedProcessingAttempts += result.processingAttempts;
    } else if (!result.success) {
      // 포기하지 않고 끝까지 가공했지만 실패한 경우
      completedTotalCost += result.totalCost;
      completedProcessingAttempts += result.processingAttempts;
    }
    
    const avgCost = successCount > 0 ? Math.round(totalCost / successCount) : 0;
    progressBar.update(i + 1, { avgCost });
  }
  
  progressBar.stop();
  
  const avgCostPerSuccess = successCount > 0 ? totalCost / successCount : Infinity;
  const failedCount = numSimulations - successCount;
  const completedCount = failedCount - abandonedCount;
  
  console.log(`\n📊 시뮬레이션 결과 (임계값: ${Math.round(thresholdCostPerPercent).toLocaleString()}G/%):`);
  console.log(`   성공: ${successCount}/${totalSimulations} (${(successCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${successCount > 0 ? Math.round(successTotalCost / successCount).toLocaleString() : 0}G - 평균 가공횟수: ${successCount > 0 ? (successProcessingAttempts / successCount).toFixed(2) : 0}회`);
  console.log(`   실패: ${failedCount}/${totalSimulations} (${(failedCount/totalSimulations*100).toFixed(2)}%)`);
  console.log(`     - 포기: ${abandonedCount} (${(abandonedCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${abandonedCount > 0 ? Math.round(abandonedTotalCost / abandonedCount).toLocaleString() : 0}G - 평균 가공횟수: ${abandonedCount > 0 ? (abandonedProcessingAttempts / abandonedCount).toFixed(2) : 0}회`);
  console.log(`     - 끝까지 가공: ${completedCount} (${(completedCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${completedCount > 0 ? Math.round(completedTotalCost / completedCount).toLocaleString() : 0}G - 평균 가공횟수: ${completedCount > 0 ? (completedProcessingAttempts / completedCount).toFixed(2) : 0}회`);
  console.log(`   젬당 평균 비용 소모: ${Math.round(totalCost/totalSimulations).toLocaleString()}G`);
  console.log(`   목표당 평균 비용: ${Math.round(avgCostPerSuccess).toLocaleString()}G - 전체 평균 가공횟수: ${totalSimulations > 0 ? (totalProcessingAttempts / totalSimulations).toFixed(2) : 0}회`);
  
  return avgCostPerSuccess;
}

// 워커 풀 생성
async function createWorkerPool(grade, purchaseCost, goalKey, numSimulations) {
  const numCores = os.cpus().length;
  const simulationsPerWorker = Math.ceil(numSimulations / numCores);
  
  console.log(`🏗️  워커 풀 생성: ${numCores}개 워커 (워커당 ${simulationsPerWorker.toLocaleString()}번 시뮬레이션)`);
  
  const workers = [];
  
  for (let i = 0; i < numCores; i++) {
    const workerSimulations = i === numCores - 1 
      ? numSimulations - (i * simulationsPerWorker) 
      : simulationsPerWorker;
    
    if (workerSimulations <= 0) break;
    
    const worker = new Worker(path.join(__dirname, 'persistent-worker.js'), {
      workerData: {
        grade,
        purchaseCost,
        goalKey,
        simulationsPerBatch: workerSimulations
      }
    });
    
    workers.push({ worker, simulationsPerBatch: workerSimulations });
  }
  
  return workers;
}

// 워커 풀로 시뮬레이션 실행
async function runSimulationsWithWorkerPool(workerPool, thresholdCostPerPercent, totalSimulations) {
  console.log(`🚀 워커 풀로 병렬 처리 시작`);
  
  const progressBar = new cliProgress.SingleBar({
    format: '진행률 |{bar}| {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(totalSimulations, 0);
  
  const promises = [];
  
  for (const { worker, simulationsPerBatch } of workerPool) {
    // MaxListeners 경고 방지
    worker.setMaxListeners(20);
    
    const promise = new Promise((resolve, reject) => {
      const messageHandler = (message) => {
        if (message.type === 'progress') {
          progressBar.increment(message.completed);
        } else if (message.type === 'result') {
          // 리스너 정리
          worker.off('message', messageHandler);
          worker.off('error', errorHandler);
          resolve(message.data);
        }
      };
      
      const errorHandler = (error) => {
        // 리스너 정리
        worker.off('message', messageHandler);
        worker.off('error', errorHandler);
        reject(error);
      };
      
      worker.on('message', messageHandler);
      worker.on('error', errorHandler);
    });
    
    // 워커에게 작업 할당
    worker.postMessage({
      type: 'simulate',
      thresholdCostPerPercent,
      numSimulations: simulationsPerBatch
    });
    
    promises.push(promise);
  }
  
  try {
    const results = await Promise.all(promises);
    progressBar.stop();
    
    // 결과 집계 (기존 runSimulationsParallel과 동일)
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
    
    for (const result of results) {
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
    
    const avgCostPerSuccess = successCount > 0 ? totalCost / successCount : Infinity;
    const failedCount = totalSimulations - successCount;
    const completedCount = failedCount - abandonedCount;
    
    console.log(`\n📊 시뮬레이션 결과 (임계값: ${Math.round(thresholdCostPerPercent).toLocaleString()}G/%):`);
    console.log(`   성공: ${successCount}/${totalSimulations} (${(successCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${successCount > 0 ? Math.round(successTotalCost / successCount).toLocaleString() : 0}G - 평균 가공횟수: ${successCount > 0 ? (successProcessingAttempts / successCount).toFixed(2) : 0}회`);
    console.log(`   실패: ${failedCount}/${totalSimulations} (${(failedCount/totalSimulations*100).toFixed(2)}%)`);
    console.log(`     - 포기: ${abandonedCount} (${(abandonedCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${abandonedCount > 0 ? Math.round(abandonedTotalCost / abandonedCount).toLocaleString() : 0}G - 평균 가공횟수: ${abandonedCount > 0 ? (abandonedProcessingAttempts / abandonedCount).toFixed(2) : 0}회`);
    console.log(`     - 끝까지 가공: ${completedCount} (${(completedCount/totalSimulations*100).toFixed(2)}%) - 젬당 평균 소모: ${completedCount > 0 ? Math.round(completedTotalCost / completedCount).toLocaleString() : 0}G - 평균 가공횟수: ${completedCount > 0 ? (completedProcessingAttempts / completedCount).toFixed(2) : 0}회`);
    console.log(`   젬당 평균 비용 소모: ${Math.round(totalCost/totalSimulations).toLocaleString()}G`);
    console.log(`   목표당 평균 비용: ${Math.round(avgCostPerSuccess).toLocaleString()}G - 전체 평균 가공횟수: ${totalSimulations > 0 ? (totalProcessingAttempts / totalSimulations).toFixed(2) : 0}회`);
    
    return avgCostPerSuccess;
  } catch (error) {
    progressBar.stop();
    throw error;
  }
}

// 워커 풀 종료
async function terminateWorkerPool(workerPool) {
  console.log('🧹 워커 풀 정리 중...');
  
  for (const { worker } of workerPool) {
    await worker.terminate();
  }
}

// 최적 임계값 찾기 (고정점 반복법) - 개선된 버전
async function findOptimalThreshold(grade, purchaseCost, goalKey = 'sum9+', maxIterations = 100, tolerance = 5, useParallel = false, numSimulations = 500000) {
  // DB에서 초기 상태 조회
  const { initialSuccessRate, initialProcessingCost } = await getInitialGemStats(grade, goalKey);
  
  // 초기 임계값 계산
  let thresholdCostPerPercent = (purchaseCost + initialProcessingCost) / (initialSuccessRate * 100);
  
  console.log(`\n🎯 ${grade} 젬 ${goalKey} 목표의 최적 포기 전략 계산 시작`);
  console.log(`📈 초기 임계값: ${Math.round(thresholdCostPerPercent).toLocaleString()}G/%`);
  console.log(`💰 젬 구매비용: ${purchaseCost.toLocaleString()}G`);
  console.log(`🎲 초기 성공률: ${(initialSuccessRate * 100).toFixed(4)}%`);
  console.log(`⚙️  초기 가공비용: ${Math.round(initialProcessingCost).toLocaleString()}G`);
  
  const results = [];
  
  // 워커 재사용을 위한 워커 풀 생성 (병렬 모드일 때만)
  let workerPool = null;
  if (useParallel) {
    workerPool = await createWorkerPool(grade, purchaseCost, goalKey, numSimulations);
  }
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    console.log(`\n🔄 반복 ${iteration}/${maxIterations}`);
    
    const avgCost = useParallel 
      ? await runSimulationsWithWorkerPool(workerPool, thresholdCostPerPercent, numSimulations)
      : await runSimulations(grade, thresholdCostPerPercent, purchaseCost, goalKey, numSimulations);
    
    if (avgCost === Infinity) {
      console.log('❌ 모든 시뮬레이션이 실패했습니다. 임계값을 높입니다.');
      thresholdCostPerPercent *= 1.5;
      continue;
    }
    
    const newThreshold = avgCost / 100; // 1% 당 비용으로 변환
    const change = Math.abs(newThreshold - thresholdCostPerPercent);
    
    results.push({
      iteration,
      threshold: thresholdCostPerPercent,
      avgCost,
      newThreshold,
      change
    });
    
    console.log(`🎯 새로운 임계값: ${Math.round(newThreshold).toLocaleString()}G/% (변화: ${change.toFixed(1)}G)`);

    thresholdCostPerPercent = newThreshold;

    // 수렴 체크
    if (change < tolerance) {
      console.log(`\n✅ 수렴 완료! (변화량 < ${tolerance}G)`);
      break;
    }
    
  }
  
  // 결과 출력
  console.log(`\n📊 최종 결과:`);
  console.log(`🎯 최적 임계값: ${thresholdCostPerPercent.toLocaleString()}G/%`);
  console.log(`💸 예상 평균비용: ${results[results.length-1].avgCost.toLocaleString()}G`);
  
  console.log(`\n📈 수렴 과정:`);
  results.forEach(r => {
    console.log(`   반복 ${r.iteration}: ${r.threshold.toLocaleString()}G/% → 평균비용 ${r.avgCost.toLocaleString()}G → 새 임계값 ${r.newThreshold.toLocaleString()}G/%`);
  });
  
  // 워커 풀 정리
  if (workerPool) {
    await terminateWorkerPool(workerPool);
  }
  
  return { 
    optimalThreshold: thresholdCostPerPercent, 
    expectedCost: results[results.length-1].avgCost,
    iterations: results.length 
  };
}

// 메인 함수
async function main() {
  try {
    console.log('🚀 최적 젬 가공 전략 계산기');
    console.log('=' .repeat(50));
    
    // 명령행 인자 파싱
    const args = process.argv.slice(2);
    const grade = args[0] ? args[0].toUpperCase() : 'RARE'; // 기본값 RARE
    const goalKey = args[1] ? args[1] : 'sum9+'; // 기본값 sum9+
    let purchaseCost = args[2] ? parseInt(args[2]) : null; // 구매 비용
    const numSimulations = args[3] ? parseInt(args[3]) : 1000; // 기본값 1000번
    const useParallel = args[4] === 'parallel' || args[4] === 'p'; // 병렬 처리 옵션
    
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
    console.log(`🔄 시뮬레이션 횟수: ${numSimulations.toLocaleString()}번`);
    console.log(`⚡ 처리 방식: ${useParallel ? `멀티코어 병렬 (${os.cpus().length}코어)` : '단일 스레드'}`);
    
    // 선택된 젬 등급과 목표로 분석
    const result = await findOptimalThreshold(grade, purchaseCost, goalKey, 100, 0.1, useParallel, numSimulations);
    
    console.log('\n' + '='.repeat(50));
    console.log('🏆 최종 권장 전략:');
    console.log(`${grade} 젬 ${goalKey} 목표: 예상비용/확률이 ${result.optimalThreshold.toLocaleString()}G/%를 초과하면 포기`);
    console.log(`예상 평균 비용: ${result.expectedCost.toLocaleString()}G`);
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

export { findOptimalThreshold, simulateGemProcessing, getInitialGemStats };