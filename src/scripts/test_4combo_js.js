#!/usr/bin/env node
/**
 * JavaScript의 4combo 확률 계산 테스트
 * src/data/gemProcessing.js의 확률표를 그대로 사용
 */

import { PROCESSING_POSSIBILITIES } from '../utils/gemConstants.js';

// combinations 함수 (local-simulator.js에서 복사)
function* combinations(arr, k) {
    if (k === 0) {
        yield [];
    } else if (k === arr.length) {
        yield arr.slice();
    } else if (k < arr.length) {
        const [first, ...rest] = arr;
        for (const combo of combinations(rest, k - 1)) {
            yield [first, ...combo];
        }
        for (const combo of combinations(rest, k)) {
            yield combo;
        }
    }
}

// permutations 함수 (local-simulator.js에서 복사)
function* permutations(arr) {
    if (arr.length <= 1) {
        yield arr.slice();
    } else {
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            for (const perm of permutations(rest)) {
                yield [arr[i], ...perm];
            }
        }
    }
}

// calculate4ComboProbability 함수 (local-simulator.js에서 복사)
function calculate4ComboProbability(comboIndices, allWeights) {
    let comboTotalProb = 0.0;
    
    // 4개를 뽑는 모든 순서 고려
    for (const perm of permutations(comboIndices)) {
        let permProb = 1.0;
        const remainingWeights = [...allWeights];
        let remainingTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
        
        // 순서대로 뽑을 확률 계산
        for (const idx of perm) {
            if (remainingTotal <= 0 || remainingWeights[idx] <= 0) {
                permProb = 0;
                break;
            }
            
            // 현재 옵션을 뽑을 확률
            permProb *= remainingWeights[idx] / remainingTotal;
            
            // 뽑힌 옵션은 제거 (복원 추출이 아님)
            remainingTotal -= remainingWeights[idx];
            remainingWeights[idx] = 0;
        }
        
        comboTotalProb += permProb;
    }
    
    return comboTotalProb;
}

// getAvailableOptions 함수
function getAvailableOptions(gem) {
    const options = [];
    for (const [action, config] of Object.entries(PROCESSING_POSSIBILITIES)) {
        if (typeof config.condition === 'function' && config.condition(gem)) {
            options.push({
                action,
                probability: config.probability
            });
        }
    }
    return options;
}

function testGemState(gemValues) {
    // 젬 상태 생성
    const gem = {
        willpower: gemValues[0],
        corePoint: gemValues[1],
        dealerA: gemValues[2],
        dealerB: gemValues[3],
        supportA: gemValues[4],
        supportB: gemValues[5],
        remainingAttempts: gemValues[6],
        currentRerollAttempts: gemValues[7],
        costModifier: gemValues[8],
        isFirstProcessing: gemValues[9]
    };
    
    console.log("=".repeat(60));
    console.log("📊 JavaScript 4combo 확률 계산");
    console.log("=".repeat(60));
    console.log(`젬 상태: willpower=${gem.willpower}, corePoint=${gem.corePoint}, ` +
                `dealerA=${gem.dealerA}, dealerB=${gem.dealerB}, ` +
                `supportA=${gem.supportA}, supportB=${gem.supportB}`);
    console.log(`기타: remainingAttempts=${gem.remainingAttempts}, ` +
                `currentRerollAttempts=${gem.currentRerollAttempts}, ` +
                `costModifier=${gem.costModifier}, isFirstProcessing=${gem.isFirstProcessing}`);
    
    // 사용 가능한 옵션들 가져오기
    const options = getAvailableOptions(gem);
    console.log(`\n사용 가능한 옵션 수: ${options.length}`);
    
    if (options.length < 4) {
        console.log("⚠️  옵션이 4개 미만이므로 4combo를 만들 수 없습니다.");
        return null;
    }
    
    // 각 옵션 출력
    console.log("\n옵션 목록:");
    options.forEach((opt, i) => {
        console.log(`  [${i.toString().padStart(2)}] ${opt.action.padEnd(20)}: weight=${opt.probability.toFixed(4)}`);
    });
    
    // 가중치 배열
    const allWeights = options.map(opt => opt.probability);
    const totalWeight = allWeights.reduce((sum, w) => sum + w, 0);
    console.log(`\n총 가중치: ${totalWeight.toFixed(6)}`);
    
    // 모든 4개 조합에 대한 확률 계산
    const comboProbs = [];
    console.log("\n4개 조합 확률 계산 중...");
    
    for (const comboIndices of combinations(Array.from({length: options.length}, (_, i) => i), 4)) {
        const comboProb = calculate4ComboProbability(comboIndices, allWeights);
        comboProbs.push({
            indices: comboIndices,
            probability: comboProb,
            options: comboIndices.map(i => options[i])
        });
    }
    
    // 확률 기준으로 정렬
    comboProbs.sort((a, b) => b.probability - a.probability);
    
    // 상위 10개 조합 출력
    console.log(`\n총 ${comboProbs.length}개 조합 중 상위 10개:`);
    comboProbs.slice(0, 10).forEach((combo, i) => {
        const indices = combo.indices;
        const prob = combo.probability;
        const actions = combo.options.map(opt => opt.action);
        console.log(`  ${(i+1).toString().padStart(2)}. [${indices.map(idx => idx.toString().padStart(2)).join(', ')}] ` +
                    `P=${prob.toFixed(8)} (${(prob*100).toFixed(6)}%)`);
        console.log(`      => ${actions.join(' | ')}`);
    });
    
    // 전체 확률 합계 (검증용)
    const totalProb = comboProbs.reduce((sum, c) => sum + c.probability, 0);
    console.log(`\n전체 4combo 확률 합계: ${totalProb.toFixed(10)} (이론적으로 1이어야 함)`);
    
    // 첫 번째 조합의 상세 계산 과정 출력
    if (comboProbs.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("🔍 첫 번째 조합의 상세 계산 과정");
        console.log("=".repeat(60));
        
        const firstCombo = comboProbs[0];
        const indices = firstCombo.indices;
        console.log(`조합 indices: [${indices.join(', ')}]`);
        console.log("해당 옵션들:");
        indices.forEach(idx => {
            console.log(`  [${idx.toString().padStart(2)}] ${options[idx].action.padEnd(20)}: ${allWeights[idx].toFixed(4)}`);
        });
        
        console.log("\n각 순열(permutation)별 확률:");
        let permCount = 0;
        let totalPermProb = 0.0;
        
        for (const perm of permutations(indices)) {
            if (permCount < 5) {  // 처음 5개만 출력
                let permProb = 1.0;
                const remainingWeights = [...allWeights];
                let remainingTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
                
                console.log(`\n  순열 ${permCount + 1}: [${perm.join(', ')}]`);
                perm.forEach((idx, step) => {
                    if (remainingTotal > 0 && remainingWeights[idx] > 0) {
                        const stepProb = remainingWeights[idx] / remainingTotal;
                        permProb *= stepProb;
                        console.log(`    Step ${step + 1}: idx=${idx.toString().padStart(2)}, ` +
                                  `weight=${remainingWeights[idx].toFixed(4)}, ` +
                                  `total=${remainingTotal.toFixed(4)}, ` +
                                  `prob=${stepProb.toFixed(6)}, ` +
                                  `cumulative=${permProb.toFixed(8)}`);
                        remainingTotal -= remainingWeights[idx];
                        remainingWeights[idx] = 0;
                    } else {
                        permProb = 0;
                        console.log(`    Step ${step + 1}: 확률 0 (조건 불만족)`);
                        return; // forEach의 continue
                    }
                });
                
                console.log(`  => 이 순열의 최종 확률: ${permProb.toFixed(8)}`);
                totalPermProb += permProb;
            } else {
                // 나머지는 계산만
                let permProb = 1.0;
                const remainingWeights = [...allWeights];
                let remainingTotal = remainingWeights.reduce((sum, w) => sum + w, 0);
                
                for (const idx of perm) {
                    if (remainingTotal > 0 && remainingWeights[idx] > 0) {
                        permProb *= remainingWeights[idx] / remainingTotal;
                        remainingTotal -= remainingWeights[idx];
                        remainingWeights[idx] = 0;
                    } else {
                        permProb = 0;
                        break;
                    }
                }
                
                totalPermProb += permProb;
            }
            
            permCount++;
        }
        
        console.log(`\n총 ${permCount}개 순열의 확률 합: ${totalPermProb.toFixed(8)}`);
        console.log(`저장된 조합 확률: ${firstCombo.probability.toFixed(8)}`);
        console.log(`차이: ${Math.abs(totalPermProb - firstCombo.probability).toFixed(10)}`);
    }
    
    return comboProbs;
}

// 메인 함수
function main() {
    // 명령행 인자 또는 기본값
    let gemValues;
    if (process.argv.length > 2) {
        try {
            gemValues = JSON.parse(process.argv[2]);
        } catch (e) {
            console.error("⚠️  잘못된 입력 형식. 예: [1,3,2,0,5,0,2,1,0,false]");
            process.exit(1);
        }
    } else {
        // 기본값 사용 (사용자가 제공한 예시)
        gemValues = [2, 1, 3, 0, 1, 0, 5, 1, 0, false];
    }
    
    const result = testGemState(gemValues);
    
    if (result) {
        console.log("\n✅ JavaScript 계산 완료");
        console.log(`총 ${result.length}개 조합 계산됨`);
    }
}

main();