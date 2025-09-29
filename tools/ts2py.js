#!/usr/bin/env node

/**
 * TypeScript → Python 변환 스크립트
 * shared/ 폴더의 TypeScript 파일들을 python/ 폴더로 변환
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === 변환 규칙들 ===
class TypeScriptToPythonConverter {
  constructor() {
    this.imports = new Set();
    this.currentFile = '';
  }

  // 메인 변환 함수
  convertFile(inputPath, outputPath) {
    console.log(`Converting ${inputPath} → ${outputPath}`);

    const tsContent = fs.readFileSync(inputPath, 'utf-8');
    const pyContent = this.convertContent(tsContent, path.basename(inputPath));

    // 출력 디렉토리 생성
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, pyContent, 'utf-8');
    console.log(`✅ Converted successfully`);
  }

  // 메인 변환 로직
  convertContent(tsContent, fileName) {
    this.currentFile = fileName;
    this.imports.clear();

    let pyContent = tsContent;

    // 1. 주석 변환 (/** */ → """)
    pyContent = this.convertComments(pyContent);

    // 2. Import 구문 변환
    pyContent = this.convertImports(pyContent);

    // 3. 타입 정의 변환
    pyContent = this.convertTypes(pyContent);

    // 4. 함수 변환
    pyContent = this.convertFunctions(pyContent);

    // 5. 상수/객체 변환
    pyContent = this.convertConstants(pyContent);

    // 6. 기본 문법 변환
    pyContent = this.convertBasicSyntax(pyContent);

    // 7. 헤더 추가
    pyContent = this.addPythonHeader(pyContent);

    return pyContent;
  }

  // 주석 변환
  convertComments(content) {
    // /** ... */ → """..."""
    content = content.replace(/\/\*\*([\s\S]*?)\*\//g, (match, inner) => {
      const cleaned = inner
        .replace(/^\s*\*/gm, '') // 각 줄 시작의 * 제거
        .replace(/^\s+/gm, '') // 앞쪽 공백 제거
        .trim();
      return `"""\n${cleaned}\n"""`;
    });

    // // 주석 → # 주석
    content = content.replace(/^\s*\/\/\s?/gm, '# ');

    return content;
  }

  // Import 구문 변환
  convertImports(content) {
    // TypeScript import → Python import
    content = content.replace(/import\s+type\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g,
      (match, imports, module) => {
        // 타입 import는 제거 (Python에서는 불필요)
        return '# Type imports removed for Python compatibility';
      });

    content = content.replace(/import\s*{([^}]+)}\s*from\s*['"]([^'"]+)['"]/g,
      (match, imports, module) => {
        const pythonModule = module.replace('./', '').replace(/\.ts$/, '');
        const importList = imports.split(',').map(imp => imp.trim()).join(', ');
        this.imports.add(`from .${pythonModule} import ${importList}`);
        return `# from .${pythonModule} import ${importList}`;
      });

    return content;
  }

  // 타입 정의 변환
  convertTypes(content) {
    // interface → dataclass
    content = content.replace(/export\s+interface\s+(\w+)\s*{([^}]+)}/g,
      (match, name, body) => {
        const fields = body
          .split(';')
          .map(field => field.trim())
          .filter(field => field && !field.startsWith('//'))
          .map(field => {
            const [key, type] = field.split(':').map(s => s.trim());
            const cleanKey = key?.replace('readonly', '').trim();
            const isOptional = cleanKey?.includes('?');
            const fieldName = cleanKey?.replace('?', '');

            if (!fieldName) return null;

            // TypeScript 타입 → Python 타입 힌트
            const pythonType = this.convertTypeHint(type);

            if (isOptional) {
              return `    ${fieldName}: Optional[${pythonType}] = None`;
            } else {
              return `    ${fieldName}: ${pythonType}`;
            }
          })
          .filter(Boolean)
          .join('\n');

        this.imports.add('from dataclasses import dataclass');
        this.imports.add('from typing import Optional, Dict, List, Callable, Union');

        return `@dataclass
class ${name}:
${fields}`;
      });

    // type aliases 변환
    content = content.replace(/export\s+type\s+(\w+)\s*=\s*([^;]+);/g,
      (match, name, definition) => {
        return `# Type alias: ${name} = ${definition}`;
      });

    return content;
  }

  // TypeScript 타입 → Python 타입 힌트
  convertTypeHint(tsType) {
    if (!tsType) return 'Any';

    const typeMap = {
      'number': 'int',
      'string': 'str',
      'boolean': 'bool',
      'any': 'Any',
      'void': 'None'
    };

    let cleanType = tsType.replace(/\s*\|\s*undefined/g, '');

    return typeMap[cleanType] || cleanType;
  }

  // 함수 변환
  convertFunctions(content) {
    // Arrow functions → Python functions
    content = content.replace(
      /export\s+const\s+(\w+)\s*=\s*\(([^)]*)\):\s*(\w+)\s*=>\s*{([^}]+)}/g,
      (match, name, params, returnType, body) => {
        const pythonParams = this.convertParameters(params);
        const pythonBody = this.convertFunctionBody(body);
        const pythonReturnType = this.convertTypeHint(returnType);

        return `def ${this.toSnakeCase(name)}(${pythonParams}) -> ${pythonReturnType}:
    """${name}"""${pythonBody}`;
      }
    );

    // 한 줄 arrow functions
    content = content.replace(
      /export\s+const\s+(\w+)\s*=\s*\(([^)]*)\):\s*(\w+)\s*=>\s*([^;]+);/g,
      (match, name, params, returnType, body) => {
        const pythonParams = this.convertParameters(params);
        const pythonBody = this.convertExpression(body);
        const pythonReturnType = this.convertTypeHint(returnType);

        return `def ${this.toSnakeCase(name)}(${pythonParams}) -> ${pythonReturnType}:
    """${name}"""
    return ${pythonBody}`;
      }
    );

    return content;
  }

  // 함수 매개변수 변환
  convertParameters(params) {
    if (!params.trim()) return '';

    return params
      .split(',')
      .map(param => {
        const [name, type] = param.split(':').map(s => s.trim());
        const pythonType = this.convertTypeHint(type);
        return `${name}: ${pythonType}`;
      })
      .join(', ');
  }

  // 함수 본문 변환
  convertFunctionBody(body) {
    let pythonBody = this.convertBasicSyntax(body.trim());

    // return 문 처리
    if (!pythonBody.includes('return')) {
      pythonBody = `return ${pythonBody}`;
    }

    // 들여쓰기 추가
    return '\n    ' + pythonBody.replace(/\n/g, '\n    ');
  }

  // 상수/객체 변환
  convertConstants(content) {
    // export const OBJECT = { ... } as const
    content = content.replace(
      /export\s+const\s+(\w+)\s*=\s*{([^}]+)}\s*as\s+const(?:\s+satisfies[^;]*)?;/g,
      (match, name, body) => {
        const pythonBody = this.convertObjectBody(body);
        return `${name} = {${pythonBody}\n}`;
      }
    );

    // export const SIMPLE = value
    content = content.replace(
      /export\s+const\s+(\w+)\s*=\s*([^;]+);/g,
      (match, name, value) => {
        const pythonValue = this.convertExpression(value);
        return `${name} = ${pythonValue}`;
      }
    );

    return content;
  }

  // 객체 본문 변환
  convertObjectBody(body) {
    return body
      .split(',')
      .map(item => {
        const trimmed = item.trim();
        if (!trimmed) return '';

        if (trimmed.includes(':')) {
          const [key, value] = trimmed.split(':').map(s => s.trim());
          const pythonKey = key.replace(/['"]/g, '');
          const pythonValue = this.convertExpression(value);
          return `\n    "${pythonKey}": ${pythonValue}`;
        }
        return '';
      })
      .filter(Boolean)
      .join(',');
  }

  // 기본 문법 변환
  convertBasicSyntax(content) {
    // 논리 연산자
    content = content.replace(/&&/g, ' and ');
    content = content.replace(/\|\|/g, ' or ');
    content = content.replace(/!/g, 'not ');

    // 함수 호출을 snake_case로
    content = content.replace(/(\w+)([A-Z]\w*)/g, (match, prefix, suffix) => {
      if (match.includes('(') || match.match(/^[A-Z]/)) {
        return match; // 생성자나 상수는 그대로
      }
      return this.toSnakeCase(match);
    });

    // 함수 호출 변환
    content = content.replace(/(\w+)\(([^)]*)\)/g, (match, func, args) => {
      const snakeFunc = this.toSnakeCase(func);
      return `${snakeFunc}(${args})`;
    });

    // 타입 assertion 제거
    content = content.replace(/\s+as\s+\w+/g, '');
    content = content.replace(/\s+satisfies[^;,}]+/g, '');

    return content;
  }

  // 표현식 변환
  convertExpression(expr) {
    let pythonExpr = this.convertBasicSyntax(expr);

    // 특수 처리
    pythonExpr = pythonExpr.replace(/true/g, 'True');
    pythonExpr = pythonExpr.replace(/false/g, 'False');
    pythonExpr = pythonExpr.replace(/null/g, 'None');
    pythonExpr = pythonExpr.replace(/undefined/g, 'None');

    return pythonExpr;
  }

  // camelCase → snake_case
  toSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  // Python 헤더 추가
  addPythonHeader(content) {
    const headerLines = [
      '"""',
      'Generated from TypeScript source',
      '⚠️  DO NOT EDIT - This file is auto-generated',
      '🔄 Run tools/ts2py.js to regenerate',
      '"""',
      ''
    ];

    // Import 문들 추가
    if (this.imports.size > 0) {
      headerLines.push(...Array.from(this.imports));
      headerLines.push('');
    }

    return headerLines.join('\n') + content;
  }
}

// === 메인 실행 ===
function main() {
  const converter = new TypeScriptToPythonConverter();
  const sharedDir = path.join(__dirname, '../shared');
  const pythonDir = path.join(__dirname, '../python');

  // 변환할 파일들
  const files = [
    { input: 'types.ts', output: 'models.py' },
    { input: 'constants.ts', output: 'constants.py' },
    { input: 'targets.ts', output: 'targets.py' }
  ];

  for (const { input, output } of files) {
    const inputPath = path.join(sharedDir, input);
    const outputPath = path.join(pythonDir, output);

    if (fs.existsSync(inputPath)) {
      try {
        converter.convertFile(inputPath, outputPath);
      } catch (error) {
        console.error(`❌ Error converting ${input}:`, error.message);
      }
    } else {
      console.warn(`⚠️  Input file not found: ${inputPath}`);
    }
  }

  console.log('🎉 Conversion completed!');
}

// 스크립트로 실행된 경우
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { TypeScriptToPythonConverter };