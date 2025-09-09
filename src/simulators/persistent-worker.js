#!/usr/bin/env node
/**
 * 지속적인 워커 스레드 (워커 재사용용)
 * 
 * 한 번 생성되어 여러 시뮬레이션 작업을 받아 처리하는 워커
 * 캐시를 유지하면서 반복적으로 작업 수행
 */

import { parentPort, workerData } from 'worker_threads';
import { 
  createProcessingGem,
  executeGemProcessing,
  rerollProcessingOptions
} from '../utils/gemProcessing.js';
import {
  checkGoalAchieved,
  loadLocalOptionProbabilities,
  smartRerollStrategy
} from './local_util.js';

// 워커 초기화 정보
const { grade, purchaseCost, goalKey, simulationsPerBatch } = workerData;


// 단일 젬 가공 시뮬레이션 (지속 워커용)
async function simulateGemProcessingPersistent(thresholdCost) {
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
          false // 워커에서는 디버깅 출력 생략
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
      
      // 각 옵션별 계산 후 평균
      const processingCost = 900 * (1 + (gem.costModifier || 0) / 100);
      let totalCost = 0;
      let validOptions = 0;
      
      for (const option of optionsWithProb) {
        if (option.resultProbabilities?.[goalKey] && option.resultExpectedCosts?.[goalKey] !== undefined) {
          const prob = parseFloat(option.resultProbabilities[goalKey].value || 0);
          const cost = option.resultExpectedCosts[goalKey];
          
          if (prob > 0 && cost < Infinity) {
            const expectedCost = processingCost + cost + (1 - prob) * thresholdCost;
            totalCost += expectedCost;
            validOptions++;
          }
          else {
            totalCost += processingCost + thresholdCost; // Use threshold cost as fallback for invalid options
            validOptions++;
          }
        }
      }
      
      const avgExpectedCost = validOptions > 0 ? totalCost / validOptions : Infinity;

      // 포기 판단: 평균 기댓값이 임계값보다 크면 포기
      if (avgExpectedCost > thresholdCost) {
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
    console.error('지속 워커 시뮬레이션 오류:', error);
    const totalCost = purchaseCost + (gem.totalGoldSpent || 0);
    const processingAttempts = gem.processingCount || 0;
    return { success: false, totalCost, abandoned: false, processingAttempts };
  }
}

// 배치 시뮬레이션 실행
async function runBatchSimulation(thresholdCost, numSimulations) {
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
  
  const progressInterval = Math.max(1, Math.floor(numSimulations / 100)); // 1% 간격으로 진행 상황 보고
  
  for (let i = 0; i < numSimulations; i++) {
    const result = await simulateGemProcessingPersistent(thresholdCost);
    
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
    
    // 진행 상황 보고
    if (i % progressInterval === 0 || i === numSimulations - 1) {
      parentPort.postMessage({
        type: 'progress',
        completed: i === numSimulations - 1 ? numSimulations - (Math.floor(i / progressInterval) * progressInterval) : progressInterval
      });
    }
  }
  
  return {
    totalCost,
    successCount,
    abandonedCount,
    successTotalCost,
    abandonedTotalCost,
    completedTotalCost,
    totalProcessingAttempts,
    successProcessingAttempts,
    abandonedProcessingAttempts,
    completedProcessingAttempts
  };
}

// 메시지 핸들러
parentPort.on('message', async (message) => {
  try {
    if (message.type === 'simulate') {
      const { thresholdCost, numSimulations } = message;
      
      const result = await runBatchSimulation(thresholdCost, numSimulations);
      
      parentPort.postMessage({
        type: 'result',
        data: result
      });
    }
  } catch (error) {
    console.error('지속 워커 오류:', error);
    parentPort.postMessage({
      type: 'error',
      error: error.message
    });
  }
});

// 워커 준비 완료 신호
parentPort.postMessage({
  type: 'ready'
});