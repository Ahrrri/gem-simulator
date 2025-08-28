#!/usr/bin/env python3
"""
기존의 probability_table.json을 SQLite 데이터베이스로 변환하는 스크립트

2GB 크기의 JSON 파일을 효율적으로 처리하여 SQLite DB로 변환합니다.
"""

import json
import sqlite3
import sys
import os
from typing import Dict

def create_database_schema(db_path: str):
    """SQLite 데이터베이스 스키마 생성"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 젬 상태 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gem_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            willpower INTEGER NOT NULL,
            corePoint INTEGER NOT NULL,
            dealerA INTEGER NOT NULL,
            dealerB INTEGER NOT NULL,
            supportA INTEGER NOT NULL,
            supportB INTEGER NOT NULL,
            remainingAttempts INTEGER NOT NULL,
            currentRerollAttempts INTEGER NOT NULL,
            costModifier INTEGER NOT NULL,
            isFirstProcessing BOOLEAN NOT NULL,
            -- 확률들
            prob_5_5 REAL NOT NULL,
            prob_5_4 REAL NOT NULL,
            prob_4_5 REAL NOT NULL,
            prob_5_3 REAL NOT NULL,
            prob_4_4 REAL NOT NULL,
            prob_3_5 REAL NOT NULL,
            prob_sum8 REAL NOT NULL,
            prob_sum9 REAL NOT NULL,
            prob_relic REAL NOT NULL,
            prob_ancient REAL NOT NULL,
            UNIQUE(willpower, corePoint, dealerA, dealerB, supportA, supportB, 
                   remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing)
        )
    """)
    
    # 사용 가능한 옵션들 테이블
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS available_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gem_state_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            probability REAL NOT NULL,
            description TEXT NOT NULL,
            selectionProbability REAL NOT NULL,
            FOREIGN KEY (gem_state_id) REFERENCES gem_states (id)
        )
    """)
    
    # 인덱스 생성
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_willpower_corepoint 
        ON gem_states (willpower, corePoint)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_probabilities 
        ON gem_states (prob_sum8, prob_sum9, prob_relic, prob_ancient)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_attempts 
        ON gem_states (remainingAttempts, currentRerollAttempts)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_options_action 
        ON available_options (action)
    """)
    
    conn.commit()
    conn.close()
    print(f"📋 데이터베이스 스키마 생성 완료: {db_path}")

def convert_json_to_database(json_path: str, db_path: str):
    """JSON 파일을 SQLite 데이터베이스로 변환"""
    print(f"🔄 JSON to DB 변환 시작...")
    print(f"입력: {json_path}")
    print(f"출력: {db_path}")
    
    # 파일 크기 확인
    file_size_mb = os.path.getsize(json_path) / 1024 / 1024
    print(f"📁 JSON 파일 크기: {file_size_mb:.1f} MB")
    
    # JSON 로드 (큰 파일이므로 메모리 사용량 주의)
    print("📖 JSON 파일 로딩 중...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            table = json.load(f)
    except MemoryError:
        print("❌ 메모리 부족! 파일이 너무 큽니다.")
        return False
    except Exception as e:
        print(f"❌ JSON 로딩 실패: {e}")
        return False
    
    print(f"✅ JSON 로딩 완료: {len(table)}개 상태")
    
    # 데이터베이스 연결
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 배치 처리를 위한 설정
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")
    cursor.execute("PRAGMA temp_store = MEMORY")
    cursor.execute("PRAGMA mmap_size = 268435456")  # 256MB
    
    total_states = len(table)
    processed = 0
    batch_size = 1000
    
    print(f"💾 데이터베이스에 저장 중...")
    
    # 배치 단위로 처리
    for i, (state_key, state_data) in enumerate(table.items()):
        try:
            # 상태 키 파싱
            parts = state_key.split(',')
            if len(parts) != 10:
                print(f"⚠️ 잘못된 키 형식 스킵: {state_key}")
                continue
                
            wp, cp, dealerA, dealerB, supportA, supportB, attempts, reroll, cost, isFirst = map(int, parts)
            isFirstProcessing = bool(isFirst)
            
            probabilities = state_data.get('probabilities', {})
            available_options = state_data.get('availableOptions', [])
            
            # 젬 상태 저장
            cursor.execute("""
                INSERT OR REPLACE INTO gem_states (
                    willpower, corePoint, dealerA, dealerB, supportA, supportB,
                    remainingAttempts, currentRerollAttempts, costModifier, isFirstProcessing,
                    prob_5_5, prob_5_4, prob_4_5, prob_5_3, prob_4_4, prob_3_5,
                    prob_sum8, prob_sum9, prob_relic, prob_ancient
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                wp, cp, dealerA, dealerB, supportA, supportB,
                attempts, reroll, cost, isFirstProcessing,
                probabilities.get('5/5', 0.0),
                probabilities.get('5/4', 0.0),
                probabilities.get('4/5', 0.0),
                probabilities.get('5/3', 0.0),
                probabilities.get('4/4', 0.0),
                probabilities.get('3/5', 0.0),
                probabilities.get('sum8+', 0.0),
                probabilities.get('sum9+', 0.0),
                probabilities.get('relic+', 0.0),
                probabilities.get('ancient+', 0.0)
            ))
            
            gem_state_id = cursor.lastrowid
            
            # 사용 가능한 옵션들 저장
            for option in available_options:
                cursor.execute("""
                    INSERT INTO available_options (
                        gem_state_id, action, probability, description, selectionProbability
                    ) VALUES (?, ?, ?, ?, ?)
                """, (
                    gem_state_id,
                    option.get('action', ''),
                    option.get('probability', 0.0),
                    option.get('description', ''),
                    option.get('selectionProbability', 0.0)
                ))
            
            processed += 1
            
            # 진행 상황 출력 및 배치 커밋
            if processed % batch_size == 0:
                conn.commit()
                progress = processed / total_states * 100
                print(f"진행: {processed:>6d}/{total_states} ({progress:5.1f}%)")
                
        except Exception as e:
            print(f"⚠️ 상태 처리 실패 ({state_key}): {e}")
            continue
    
    # 최종 커밋
    conn.commit()
    
    # 통계 출력
    cursor.execute("SELECT COUNT(*) FROM gem_states")
    total_gem_states = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM available_options") 
    total_options = cursor.fetchone()[0]
    
    conn.close()
    
    # 파일 크기 확인
    db_size_mb = os.path.getsize(db_path) / 1024 / 1024
    
    print(f"\n✅ 변환 완료!")
    print(f"📊 젬 상태: {total_gem_states:,}개")
    print(f"🎛️  옵션: {total_options:,}개")
    print(f"💾 DB 크기: {db_size_mb:.1f} MB")
    print(f"📉 압축률: {db_size_mb/file_size_mb*100:.1f}% (원본 대비)")
    
    return True

def query_database_examples(db_path: str):
    """데이터베이스 쿼리 예제들"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("\n📊 데이터베이스 쿼리 예제들:")
    
    # 1. 가장 높은 ancient+ 확률을 가진 상태들
    cursor.execute("""
        SELECT willpower, corePoint, dealerA, dealerB, supportA, supportB, 
               remainingAttempts, prob_ancient
        FROM gem_states 
        WHERE prob_ancient > 0.8
        ORDER BY prob_ancient DESC 
        LIMIT 10
    """)
    
    print("\n🏆 Ancient+ 확률 0.8 이상인 상위 10개 상태:")
    results = cursor.fetchall()
    if results:
        for row in results:
            wp, cp, dA, dB, sA, sB, att, prob = row
            print(f"  {wp}/{cp} [{dA},{dB},{sA},{sB}] 시도:{att} → {prob:.3f}")
    else:
        print("  해당하는 상태가 없습니다.")
    
    # 2. 특정 조건의 통계
    cursor.execute("""
        SELECT 
            COUNT(*) as total_states,
            AVG(prob_sum8) as avg_sum8,
            AVG(prob_sum9) as avg_sum9,
            AVG(prob_relic) as avg_relic,
            AVG(prob_ancient) as avg_ancient,
            MAX(prob_ancient) as max_ancient
        FROM gem_states 
        WHERE remainingAttempts >= 5
    """)
    
    result = cursor.fetchone()
    print(f"\n📈 남은 시도 5+ 상태들의 통계:")
    print(f"  총 상태 수: {result[0]:,}")
    print(f"  Sum8+ 평균: {result[1]:.3f}")
    print(f"  Sum9+ 평균: {result[2]:.3f}")
    print(f"  Relic+ 평균: {result[3]:.3f}")
    print(f"  Ancient+ 평균: {result[4]:.3f}")
    print(f"  Ancient+ 최고: {result[5]:.3f}")
    
    # 3. 옵션별 통계
    cursor.execute("""
        SELECT action, 
               COUNT(*) as frequency,
               AVG(selectionProbability) as avg_selection_prob,
               AVG(probability) as avg_base_prob
        FROM available_options 
        WHERE action LIKE '%_+%' OR action LIKE '%_-%'
        GROUP BY action
        ORDER BY frequency DESC
        LIMIT 10
    """)
    
    print(f"\n🎛️  가장 빈번한 옵션들 (상위 10개):")
    for row in cursor.fetchall():
        action, freq, avg_sel, avg_base = row
        print(f"  {action:<15} {freq:>6,}회 (선택률:{avg_sel:.3f}, 기본:{avg_base:.3f})")
    
    conn.close()

def main():
    if len(sys.argv) < 2:
        print("사용법: python json_to_db.py <json_file> [db_file]")
        print("예: python json_to_db.py probability_table.json probability_table.db")
        return
    
    json_file = sys.argv[1]
    db_file = sys.argv[2] if len(sys.argv) > 2 else json_file.replace('.json', '.db')
    
    # 파일 존재 확인
    if not os.path.exists(json_file):
        print(f"❌ JSON 파일을 찾을 수 없습니다: {json_file}")
        return
    
    # 기존 DB 파일 제거 (덮어쓰기)
    if os.path.exists(db_file):
        os.remove(db_file)
        print(f"🗑️  기존 DB 파일 제거: {db_file}")
    
    # 스키마 생성
    create_database_schema(db_file)
    
    # 변환 실행
    success = convert_json_to_database(json_file, db_file)
    
    if success:
        # 예제 쿼리 실행
        query_database_examples(db_file)
        
        print(f"\n🚀 사용법:")
        print(f"sqlite3 {db_file}")
        print(f"SELECT * FROM gem_states WHERE prob_relic > 0.9 LIMIT 5;")
        print(f".schema")
        print(f".quit")

if __name__ == "__main__":
    main()