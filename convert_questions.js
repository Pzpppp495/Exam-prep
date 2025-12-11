import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputPath = path.resolve(__dirname, 'src/questions.json');
const questions = [];
let globalIdCounter = 1;

// Helper to add questions
function addQuestions(newQuestions, category) {
    newQuestions.forEach(q => {
        q.id = globalIdCounter++;
        q.category = category;
        questions.push(q);
    });
}

// --- Processor for Format 1: 2025党史题库.txt ---
// Format: "1、Question... A、... ---答案：A" (Single line)
function processFormat1(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        let lines = data.split('\n').filter(line => line.trim() !== '');
        
        // Skip header if present
        if (lines.length > 0 && lines[0].trim().includes('题目')) {
            lines = lines.slice(1);
        }

        const extracted = lines.map((line, index) => {
            try {
                const parts = line.split('---答案：');
                if (parts.length < 2) return null;
                
                const answer = parts[1].trim();
                const fullQuestion = parts[0].trim();
                
                const idxA = fullQuestion.indexOf('A、');
                const idxB = fullQuestion.indexOf('B、');
                const idxC = fullQuestion.indexOf('C、');
                const idxD = fullQuestion.indexOf('D、');
                
                if (idxA === -1 || idxB === -1 || idxC === -1 || idxD === -1) return null;
                
                const questionText = fullQuestion.substring(0, idxA).trim().replace(/^\d+、/, '').trim();
                const optA = fullQuestion.substring(idxA + 2, idxB).trim();
                const optB = fullQuestion.substring(idxB + 2, idxC).trim();
                const optC = fullQuestion.substring(idxC + 2, idxD).trim();
                const optD = fullQuestion.substring(idxD + 2).trim();
                
                const type = answer.length > 1 ? 'multiple' : 'single';
                
                return {
                    question: questionText,
                    options: { A: optA, B: optB, C: optC, D: optD },
                    answer: answer,
                    type: type
                };
            } catch (e) {
                return null;
            }
        }).filter(q => q !== null);
        
        console.log(`Parsed ${extracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(extracted, category);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// --- Processor for Format 2: 思想道德修养...txt & 二十届三中...txt ---
// Format: 
// 1、Question...
// A、... B、... C、... D、... (Could be on same line or multiple lines)
// 答案：A
// OR mixed: ...答案：A1169、Question...
function processFormat2(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        // Normalize newlines
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        const extracted = [];
        let currentQ = null;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check for "答案：" anywhere in the line
            const ansIndex = line.indexOf('答案：');
            
            if (ansIndex !== -1) {
                // Split line at "答案："
                const preAnswer = line.substring(0, ansIndex).trim();
                const postAnswerFull = line.substring(ansIndex + 3).trim(); // 3 is len of "答案："
                
                // 1. Content before answer is likely options or question text
                if (preAnswer) {
                    if (currentQ) {
                        // Assume it's part of options if we are in option collection mode
                        // or if it contains option markers
                        if (preAnswer.includes('A、') || (currentQ.rawOptions && currentQ.rawOptions.length > 0)) {
                            if (!currentQ.rawOptions) currentQ.rawOptions = '';
                            currentQ.rawOptions += preAnswer + ' ';
                        } else {
                            currentQ.question += ' ' + preAnswer;
                        }
                    }
                }
                
                // 2. Parse Answer
                // Expect answer characters (A-Z) followed by potential remainder
                const match = postAnswerFull.match(/^([A-Z]+)(.*)$/);
                if (match) {
                    const answer = match[1];
                    const remainder = match[2].trim();
                    
                    if (currentQ) {
                        currentQ.answer = answer;
                        currentQ.type = currentQ.answer.length > 1 ? 'multiple' : 'single';
                        extracted.push(currentQ);
                        currentQ = null;
                    }
                    
                    // 3. Process Remainder (Potential Next Question)
                    // e.g. "1198、Question..."
                    if (remainder && /^\d+、/.test(remainder)) {
                         const nextNum = parseInt(remainder.match(/^(\d+)、/)[1]);
                         const content = remainder.replace(/^\d+、/, '').trim();
                         
                         let qText = content;
                         let rOpt = '';
                         
                         const idxA = content.indexOf('A、');
                         if (idxA !== -1) {
                             qText = content.substring(0, idxA).trim();
                             rOpt = content.substring(idxA);
                         }

                         // console.log(`Found mixed question ${nextNum} after answer ${answer}`);
                        currentQ = {
                            question: qText,
                            originalNum: nextNum,
                            options: {},
                            answer: '',
                            type: 'single',
                            rawOptions: rOpt
                        };
                    }
                }
                continue; // Done with this line
            }
            
            // No "答案：" found.
            
            if (/^\d+、/.test(line)) {
                const currentNum = parseInt(line.match(/^(\d+)、/)[1]);
                const content = line.replace(/^\d+、/, '').trim();
                
                let qText = content;
                let rOpt = '';
                
                const idxA = content.indexOf('A、');
                if (idxA !== -1) {
                    qText = content.substring(0, idxA).trim();
                    rOpt = content.substring(idxA);
                }

                currentQ = {
                    question: qText,
                    originalNum: currentNum,
                    options: {},
                    answer: '',
                    type: 'single',
                    rawOptions: rOpt
                };
                continue;
            }
            
            // Content line
            if (currentQ) {
                // Heuristic for options
                if (line.includes('A、') || (currentQ.rawOptions && currentQ.rawOptions.length > 0)) {
                    if (!currentQ.rawOptions) currentQ.rawOptions = '';
                    currentQ.rawOptions += line + ' ';
                } else {
                    // Append to question text
                    currentQ.question += ' ' + line;
                }
            }
        }
        
        // Post-process extracted questions to parse options from rawOptions
        const finalExtracted = [];
        extracted.forEach(q => {
            if (q.rawOptions) {
                const text = q.rawOptions;
                
                // Robust option parsing
                const markers = ['A、', 'B、', 'C、', 'D、', 'E、']; // Added E just in case
                const indices = [];
                
                markers.forEach(m => {
                    const idx = text.indexOf(m);
                    if (idx !== -1) {
                        indices.push({ marker: m, index: idx });
                    }
                });
                
                // Sort by index to handle mixed order (e.g. D before C)
                indices.sort((a, b) => a.index - b.index);
                
                if (indices.length > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const current = indices[i];
                        const next = indices[i+1];
                        
                        const key = current.marker.replace('、', '');
                        let value;
                        
                        if (next) {
                            value = text.substring(current.index + current.marker.length, next.index).trim();
                        } else {
                            value = text.substring(current.index + current.marker.length).trim();
                        }
                        
                        q.options[key] = value;
                    }
                    
                    // We accept questions with at least 2 options (e.g. A, B)
                    // But for standard questions we prefer 4. 
                    // Given the data quality, we'll accept if we parsed any options.
                    if (Object.keys(q.options).length >= 2) {
                        delete q.rawOptions;
                        finalExtracted.push(q);
                    }
                }
            }
        });
        
        console.log(`Parsed ${finalExtracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(finalExtracted, category);
        
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// --- Processor for Format 3: 毛概题库.txt ---
// Format: 
// 1、Question ( A )...
// A、... B、... C、... D、...
function processFormat3(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        const extracted = [];
        let currentQ = null;
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            if (/^\d+、/.test(line)) {
                // New question
                if (currentQ) {
                    extracted.push(currentQ);
                }
                
                const match = line.match(/^(\d+)、/);
                const currentNum = parseInt(match[1]);
                const text = line.replace(/^(\d+)、/, '').trim();
                
                currentQ = {
                    question: text,
                    originalNum: currentNum,
                    options: {},
                    answer: '',
                    type: 'single',
                    rawOptions: ''
                };
                
                // Check if options start on this line (unlikely for this format, but possible)
                const idxA = text.indexOf('A、');
                if (idxA !== -1) {
                    currentQ.question = text.substring(0, idxA).trim();
                    currentQ.rawOptions = text.substring(idxA);
                }
                
                continue;
            }
            
            if (currentQ) {
                if (line.startsWith('A、') || line.startsWith('A.') || (currentQ.rawOptions && currentQ.rawOptions.length > 0)) {
                    if (!currentQ.rawOptions) currentQ.rawOptions = '';
                    currentQ.rawOptions += line + ' ';
                } else {
                    currentQ.question += ' ' + line;
                }
            }
        }
        // Push last
        if (currentQ) extracted.push(currentQ);
        
        // Post-process: Extract answer from question text and parse options
        const finalExtracted = [];
        extracted.forEach(q => {
            // Extract answer(s) from question text
            let answers = [];
            let newQuestionText = q.question;
            
            // Pattern 1: Standard (A) or （A） or (A、B)
            // We use a loop to handle multiple occurrences and replace them
            const regex1 = /[（\(]\s*([A-Z]+)\s*[）\)]/g;
            let match1;
            while ((match1 = regex1.exec(newQuestionText)) !== null) {
                answers.push(match1[1]);
            }
            newQuestionText = newQuestionText.replace(regex1, (m) => m.startsWith('（') ? '（）' : '()');

            // Pattern 2: Answer outside parens A() or A（）or ABCD()
            const regex2 = /([A-Z]+)\s*[（\(]\s*[）\)]/g;
            let match2;
            while ((match2 = regex2.exec(newQuestionText)) !== null) {
                answers.push(match2[1]);
            }
            newQuestionText = newQuestionText.replace(regex2, (m) => m.includes('（') ? '（）' : '()');

            // Pattern 3: Missing closing paren (A。 or (A，
            const regex3 = /[（\(]\s*([A-Z]+)\s*[。，]/g;
            let match3;
            while ((match3 = regex3.exec(newQuestionText)) !== null) {
                answers.push(match3[1]);
            }
            newQuestionText = newQuestionText.replace(regex3, (m) => {
                 const char = m.slice(-1);
                 const isChinese = m.startsWith('（');
                 return (isChinese ? '（）' : '()') + char;
            });

            q.question = newQuestionText;
            // Remove duplicates and join
            q.answer = [...new Set(answers)].join(''); 
            
            q.type = q.answer.length > 1 ? 'multiple' : 'single';
            
            if (q.rawOptions) {
                const text = q.rawOptions;
                // Robust option parsing
                const markers = ['A、', 'B、', 'C、', 'D、', 'E、', 'A.', 'B.', 'C.', 'D.', 'E.']; 
                const indices = [];
                
                markers.forEach(m => {
                    const idx = text.indexOf(m);
                    if (idx !== -1) {
                        indices.push({ marker: m, index: idx });
                    }
                });
                
                indices.sort((a, b) => a.index - b.index);
                
                if (indices.length > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const current = indices[i];
                        const next = indices[i+1];
                        
                        // Normalize key (remove 、 or .)
                        const key = current.marker.replace(/[、.]/, '');
                        let value;
                        
                        if (next) {
                            value = text.substring(current.index + current.marker.length, next.index).trim();
                        } else {
                            value = text.substring(current.index + current.marker.length).trim();
                        }
                        
                        q.options[key] = value;
                    }
                    
                    // Require at least 2 options. Allow empty answer but log warning.
                    if (Object.keys(q.options).length >= 2) {
                        if (!q.answer) {
                            // console.warn(`Warning: Question ${q.originalNum} in ${path.basename(filePath)} has no extracted answer.`);
                        }
                        delete q.rawOptions;
                        finalExtracted.push(q);
                    }
                }
            }
        });
        
        console.log(`Parsed ${finalExtracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(finalExtracted, category);
        
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// --- Processor for Format 4: 人工智能.txt ---
// Format:
// 1. (单选题)Question...
// A. ...
// 正确答案:B:Answer Content
// OR
// 18. (填空题)Question...
// 正确答案：
// (1) Answer...
function processFormat4(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        // Normalize newlines
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        
        const extracted = [];
        let currentQ = null;
        let isCollectingAnswer = false;
        let isCollectingAnalysis = false;
        const isPythonBank = /python题目/i.test(path.basename(filePath));
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (isPythonBank && /^(简答题复习|编程题复习)/.test(line)) {
                if (currentQ) {
                    if (currentQ.type === 'fill' && currentQ.answer) {
                        currentQ.answer = currentQ.answer.trim();
                    }
                    extracted.push(currentQ);
                    currentQ = null;
                }
                isCollectingAnswer = false;
                isCollectingAnalysis = false;
                continue;
            }
            
            // Check for Question start: "1. ..."
            // We assume a new question starts with a number followed by a dot
            if (/^\d+\./.test(line)) {
                const hasTypeLabel = /[(（]\s*(单|多|判断|填空|简答|程序)(选题|题)?\s*[)）]/.test(line);
                // In Python 题库，存在题内分点如 "1.可变性" 等，不应视作新题
                if (isPythonBank && currentQ && !hasTypeLabel) {
                    currentQ.question += ' ' + line;
                    continue;
                }
                // Finalize previous question if exists
                if (currentQ) {
                    // If last question was fill-in and answer is still being collected, finalize answer
                    if (currentQ.type === 'fill' && currentQ.answer) {
                         currentQ.answer = currentQ.answer.trim();
                    }
                    extracted.push(currentQ);
                }
                
                const dotIndex = line.indexOf('.');
                const currentNum = parseInt(line.substring(0, dotIndex));
                let text = line.substring(dotIndex + 1).trim();
                
                let type = 'single'; // Default
                // Detect type from label if present (handle both half and full width parens, and spaces)
                const isProgramLabel = /[(（]\s*(程序题|程序)\s*[)）]/.test(line);
                if (/[(（]\s*(填空题|填空|简答题|简答|程序题|程序)\s*[)）]/.test(text)) {
                    type = 'fill';
                } else if (/[(（]\s*(多选题|多选)\s*[)）]/.test(text)) {
                    type = 'multiple';
                } else if (/[(（]\s*(单选题|单选)\s*[)）]/.test(text)) {
                    type = 'single';
                }
                
                // Debug logging
                // if (type === 'fill') {
                //    console.log(`Detected Fill-in Question: ${currentNum}`);
                // }

                // Remove type label
                text = text.replace(/^[(（]\s*(单|多|判断|填空|简答|程序)(选题|题|选)?\s*[)）]/, '').trim();
                
                currentQ = {
                    question: text,
                    originalNum: currentNum,
                    options: {},
                    answer: '',
                    analysis: '', // Add analysis field
                    type: type, 
                    rawOptions: '',
                    program: isProgramLabel ? true : false 
                };
                isCollectingAnswer = isProgramLabel ? true : false;
                isCollectingAnalysis = false;
                continue;
            }
            
            // Check for Answer line
            if (line.startsWith('正确答案') || /^答案[:：]/.test(line)) {
                 // Check if it has content (Single line answer)
                 // Normalize colon to check content (support both "正确答案" and "答案")
                 let content = line
                    .replace(/^正确答案[:：]/, '')
                    .replace(/^答案[:：]/, '')
                    .trim();
                 
                 // Check for analysis in the same line
                 const analysisIdx = content.indexOf('答案解析');
                 if (analysisIdx !== -1) {
                     currentQ.analysis = content.substring(analysisIdx).trim();
                     content = content.substring(0, analysisIdx).trim();
                 }
 
                 if (content.length > 0) {
                      // If content indicates a code-style answer block (e.g. def answer_...)
                      if (/^def\s+answer/i.test(content)) {
                          if (currentQ) {
                              isCollectingAnswer = true;
                              isCollectingAnalysis = false;
                              currentQ.type = 'fill';
                          }
                          continue;
                      }
                      // Single line answer (Choice)
                      if (currentQ) {
                          // Format: "B:Answer" or just "B"
                          // We want to extract the letter(s)
                          const match = content.match(/^([A-Z]+)/);
                         if (match) {
                              currentQ.answer = match[1];
                              // Only overwrite type if it wasn't detected as fill-in (or if we want to correct it)
                              // But usually if it's marked as fill-in, we should respect it.
                              if (currentQ.type !== 'fill') {
                                  currentQ.type = currentQ.answer.length > 1 ? 'multiple' : 'single';
                              }
                         } else {
                               currentQ.answer = content;
                               // If it's a long answer, treat as fill in blank
                               // Heuristic: if answer is longer than 5 chars and not just letters, it's likely fill-in
                               if (content.length > 5 && !/^[A-E,]+$/.test(content)) {
                                   currentQ.type = 'fill';
                               }
                          }
                          extracted.push(currentQ);
                          currentQ = null;
                      }
                 } else {
                      // Empty content -> Multiline answer (Fill-in)
                      isCollectingAnswer = true;
                      isCollectingAnalysis = false;
                      if (currentQ) currentQ.type = 'fill';
                 }
                 continue;
            }

            if (currentQ) {
                // Support code-style answer blocks starting with def answer_*
                if (/^def\s+answer/i.test(line)) {
                    isCollectingAnswer = true;
                    isCollectingAnalysis = false;
                    currentQ.type = 'fill';
                    continue;
                }
                if (isCollectingAnswer) {
                    // Collecting fill-in answer
                    // Check for analysis start
                    const analysisIdx = line.indexOf('答案解析');
                    const analysisIdx2 = line.indexOf('解析：');
                    
                    if (analysisIdx !== -1 || analysisIdx2 !== -1) {
                         let idx = analysisIdx !== -1 ? analysisIdx : analysisIdx2;
                         const ansPart = line.substring(0, idx).trim();
                         const anaPart = line.substring(idx).trim();
                         
                         if (ansPart) currentQ.answer += (currentQ.answer ? '\n' : '') + ansPart;
                         currentQ.analysis = anaPart;
                         
                         isCollectingAnswer = false;
                         isCollectingAnalysis = true;
                    } else {
                         // For program questions, treat the first descriptive line as question
                         if (currentQ.program && (!currentQ.question || currentQ.question.trim().length === 0)) {
                             const isCodeLike = /^(class\s|def\s|from\s|import\s|for\s|while\s|if\s|print\(|return\b|\w+\s*=)/.test(line);
                             if (!isCodeLike) {
                                 currentQ.question = (line || '').trim();
                                 continue;
                             }
                         }
                         // 对程序题保留整行代码；非程序题可提取引号内文本
                         if (currentQ.program) {
                             currentQ.answer += (currentQ.answer ? '\n' : '') + line.trim();
                         } else {
                             const qm = line.match(/["“](.*?)["”]/);
                             if (qm && qm[1]) {
                                 currentQ.answer += (currentQ.answer ? '\n' : '') + qm[1].trim();
                             } else {
                                 currentQ.answer += (currentQ.answer ? '\n' : '') + line.trim();
                             }
                         }
                         // Stop collecting when reaching closing bracket of list on a line
                         // For Python 程序题，答案常在列表后还包含 print 输出，不能在此停止
                         if (!currentQ.program && /^\s*\]\s*$/.test(line)) {
                             isCollectingAnswer = false;
                         }
                    }
                } else if (isCollectingAnalysis) {
                     currentQ.analysis += '\n' + line;
                } else {
                    // Collecting question or options
                    if (/^[A-E]\./.test(line)) {
                         if (!currentQ.rawOptions) currentQ.rawOptions = '';
                         currentQ.rawOptions += line + ' ';
                    } else {
                        if (currentQ.rawOptions) {
                             currentQ.rawOptions += ' ' + line;
                        } else {
                            currentQ.question += ' ' + line;
                        }
                    }
                }
            }
        }
        
        // Push the last question
        if (currentQ) {
             if (currentQ.type === 'fill' && currentQ.answer) {
                 currentQ.answer = currentQ.answer.trim();
             }
            extracted.push(currentQ);
        }
        
        const finalExtracted = [];
        extracted.forEach(q => {
            if (q.rawOptions) {
                const text = q.rawOptions;
                const markers = ['A.', 'B.', 'C.', 'D.', 'E.'];
                const indices = [];
                
                markers.forEach(m => {
                    const idx = text.indexOf(m);
                    if (idx !== -1) {
                        indices.push({ marker: m, index: idx });
                    }
                });
                
                indices.sort((a, b) => a.index - b.index);
                
                if (indices.length > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const current = indices[i];
                        const next = indices[i+1];
                        const key = current.marker.replace('.', '');
                        let value;
                        if (next) {
                            value = text.substring(current.index + current.marker.length, next.index).trim();
                        } else {
                            value = text.substring(current.index + current.marker.length).trim();
                        }
                        q.options[key] = value;
                    }
                    delete q.rawOptions;
                    finalExtracted.push(q);
                } else {
                    // No options parsed, but maybe it's a fill-in question that wrongly had rawOptions?
                    // Or just keep it as is.
                    delete q.rawOptions;
                    finalExtracted.push(q);
                }
            } else {
                // No rawOptions (Fill-in questions usually)
                finalExtracted.push(q);
            }
        });
        
        console.log(`Parsed ${finalExtracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(finalExtracted, category);
        
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// --- Processor for Format 5: 云计算.txt ---
// Headings like "一、选择题" then numbered like "1."; answers embedded in parens, e.g. （A） or (AB)
function processFormat5(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');

        const extracted = [];
        let currentQ = null;
        let defaultType = 'single';
        let inShort = false;
        let isCollectingShortAnswer = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('二、简答题')) {
                if (currentQ) {
                    extracted.push(currentQ);
                    currentQ = null;
                }
                inShort = true;
                isCollectingShortAnswer = false;
                continue;
            }

            if (line.includes('以下为多选')) {
                defaultType = 'multiple';
                continue;
            }

            // Handle short answer lines like "1、..."
            if (inShort && /^\d+、/.test(line)) {
                if (currentQ) extracted.push(currentQ);
                const currentNum = parseInt(line.match(/^(\d+)、/)[1]);
                const text = line.replace(/^\d+、/, '').trim();
                currentQ = {
                    question: text,
                    originalNum: currentNum,
                    options: {},
                    answer: '',
                    type: 'fill',
                    rawOptions: ''
                };
                isCollectingShortAnswer = false;
                continue;
            }

            // Short answer content collection
            if (inShort && currentQ) {
                // Start of answer line
                if (/^(参考答案|答案)[:：]/.test(line)) {
                    const content = line.replace(/^(参考答案|答案)[:：]/, '').trim();
                    currentQ.answer = content;
                    isCollectingShortAnswer = true;
                    continue;
                }
                // Continuation lines until next question or section
                if (isCollectingShortAnswer) {
                    if (!/^\d+、/.test(line)) {
                        currentQ.answer += (currentQ.answer ? '\n' : '') + line;
                        continue;
                    } else {
                        // Next question encountered; finalize previous and start new
                        extracted.push(currentQ);
                        const currentNum = parseInt(line.match(/^(\d+)、/)[1]);
                        const text = line.replace(/^\d+、/, '').trim();
                        currentQ = {
                            question: text,
                            originalNum: currentNum,
                            options: {},
                            answer: '',
                            type: 'fill',
                            rawOptions: ''
                        };
                        isCollectingShortAnswer = false;
                        continue;
                    }
                }
            }

            if (/^\d+[\.．、]/.test(line)) {
                if (currentQ) {
                    extracted.push(currentQ);
                }

                const numMatch = line.match(/^(\d+)[\.．、]/);
                const currentNum = numMatch ? parseInt(numMatch[1]) : NaN;
                let text = numMatch ? line.substring(numMatch[0].length).trim() : line.trim();

                // Extract answer letters from question text parens
                const answers = [];
                const regexAns = /[（\(]\s*([A-E]+)\s*[）\)]/g;
                let m;
                while ((m = regexAns.exec(text)) !== null) {
                    answers.push(m[1].replace(/\s+/g, ''));
                }
                text = text.replace(regexAns, (s) => s.startsWith('（') ? '（）' : '()');

                const answer = answers.length ? [...new Set(answers)].join('') : '';
                const type = defaultType === 'multiple' || (answer && answer.length > 1) ? 'multiple' : 'single';

                currentQ = {
                    question: text,
                    originalNum: currentNum,
                    options: {},
                    answer: answer,
                    type: type,
                    rawOptions: ''
                };
                continue;
            }

            if (currentQ) {
                // Accumulate option lines
                if (/^(A|B|C|D|E)[．\.、]?\s*/.test(line) || /\bA[．\.、]?\s*/.test(line)) {
                    if (!currentQ.rawOptions) currentQ.rawOptions = '';
                    currentQ.rawOptions += line + ' ';
                } else if (currentQ.rawOptions) {
                    // Some options may continue without explicit marker, keep appending if already in options
                    currentQ.rawOptions += line + ' ';
                }
            }
        }

        if (currentQ) extracted.push(currentQ);

        // Parse options from rawOptions
        const finalExtracted = [];
        extracted.forEach(q => {
            if (q.rawOptions) {
                const text = q.rawOptions.replace(/\s+/g, ' ').trim();
                const matches = [];
                // Match A-E at start of word, followed by punctuation (dot/comma) OR whitespace
                const regexMarker = /(?<!\S)(A|B|C|D|E)([．\.、]\s*|\s+)/g;
                let mm;
                while ((mm = regexMarker.exec(text)) !== null) {
                    matches.push({ key: mm[1], index: mm.index, len: mm[0].length });
                }
                if (matches.length > 0) {
                    for (let i = 0; i < matches.length; i++) {
                        const cur = matches[i];
                        const next = matches[i+1];
                        const start = cur.index + cur.len;
                        const end = next ? next.index : text.length;
                        const value = text.substring(start, end).trim();
                        q.options[cur.key] = value;
                    }
                }
                delete q.rawOptions;
            }
            finalExtracted.push(q);
        });

        console.log(`Parsed ${finalExtracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(finalExtracted, category);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

// --- Processor for Format 6: 学术论文.txt ---
function processFormat6(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim());

        const extracted = [];
        let currentQ = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            // Start of a new question: "1、"
            if (/^\d+、/.test(line)) {
                if (currentQ) extracted.push(currentQ);

                const currentNum = parseInt(line.match(/^(\d+)、/)[1]);
                let text = line.replace(/^\d+、/, '').trim();

                let type = 'single';
                if (/[（\(]\s*填空题\s*[）\)]/.test(text)) {
                    type = 'fill';
                } else if (/[（\(]\s*多选题\s*[）\)]/.test(text)) {
                    type = 'multiple';
                } else if (/[（\(]\s*单选题\s*[）\)]/.test(text)) {
                    type = 'single';
                }

                // Remove type label from text if present
                text = text.replace(/^[（\(]\s*(单|多|判断|填空)(选题|题)?\s*[）\)]/, '').trim();

                currentQ = {
                    question: text,
                    originalNum: currentNum,
                    options: {},
                    answer: '',
                    type: type,
                    rawOptions: ''
                };
                continue;
            }

            // Answer line: 支持“答案：”或“答案:”
            if (/^答案[:：]/.test(line)) {
                const contentAns = line.replace(/^答案[:：]/, '').trim();
                if (currentQ) {
                    const match = contentAns.match(/^([A-Z]+)/);
                    if (match) {
                        currentQ.answer = match[1];
                        if (currentQ.type !== 'fill') {
                            currentQ.type = currentQ.answer.length > 1 ? 'multiple' : 'single';
                        }
                    } else {
                        currentQ.answer = contentAns;
                        if (currentQ.type !== 'single') currentQ.type = 'fill';
                    }
                    extracted.push(currentQ);
                    currentQ = null;
                }
                continue;
            }

            // Collect options (A. / B. / ...), allow continuous lines
            if (currentQ) {
                if (/^[A-E][\.．]/.test(line) || line.includes('A.') || line.includes('A、') || (currentQ.rawOptions && currentQ.rawOptions.length > 0)) {
                    if (!currentQ.rawOptions) currentQ.rawOptions = '';
                    currentQ.rawOptions += line + ' ';
                } else {
                    currentQ.question += ' ' + line;
                }
            }
        }

        // Push last question if still open
        if (currentQ) extracted.push(currentQ);

        // Parse options from rawOptions
        const finalExtracted = [];
        extracted.forEach(q => {
            if (q.rawOptions) {
                const text = q.rawOptions.replace(/\s+/g, ' ').trim();
                const markers = ['A.', 'B.', 'C.', 'D.', 'E.', 'A、', 'B、', 'C、', 'D、', 'E、'];
                const indices = [];

                markers.forEach(m => {
                    const idx = text.indexOf(m);
                    if (idx !== -1) {
                        indices.push({ marker: m, index: idx });
                    }
                });

                indices.sort((a, b) => a.index - b.index);

                if (indices.length > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const current = indices[i];
                        const next = indices[i+1];
                        const key = current.marker.replace(/[、.]/g, '');
                        const start = current.index + current.marker.length;
                        const end = next ? next.index : text.length;
                        const value = text.substring(start, end).trim();
                        q.options[key] = value;
                    }
                }
                delete q.rawOptions;
            }
            finalExtracted.push(q);
        });

        console.log(`Parsed ${finalExtracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(finalExtracted, category);

    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

function processWeChatPipe(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        const extracted = [];
        lines.forEach((line) => {
            if (!line.includes('|')) return;
            const parts = line.split('|').map(p => p.trim());
            if (parts.length === 6) {
                const [qText, aOpt, bOpt, cOpt, dOpt, ansRaw] = parts;
                const options = { A: aOpt, B: bOpt, C: cOpt, D: dOpt };
                let answer = ansRaw.toUpperCase();
                if (!/^[A-D]$/.test(answer)) {
                    const found = Object.entries(options).find((kv) => kv[1] === ansRaw);
                    if (found) answer = found[0];
                }
                const valid = Object.values(options).every(v => v && v.length > 0) && /^[A-D]$/.test(answer);
                if (valid) {
                    extracted.push({
                        question: qText,
                        options,
                        answer,
                        type: 'single'
                    });
                }
            } else if (parts.length === 2) {
                const [qText, ansRaw] = parts;
                const ansNorm = ansRaw.replace(/[。]/g, '').trim();
                if (ansNorm === '正确' || ansNorm === '错误') {
                    extracted.push({
                        question: qText,
                        options: { A: '正确', B: '错误' },
                        answer: ansNorm,
                        type: 'judge'
                    });
                } else if (ansNorm.length > 0) {
                    extracted.push({
                        question: qText,
                        options: {},
                        answer: ansRaw,
                        type: 'fill'
                    });
                }
            }
        });
        console.log(`Parsed ${extracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(extracted, category);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}

function processWeChatEnumerated(filePath, category) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const content = data.replace(/\r\n/g, '\n');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l !== '');
        const extracted = [];
        let mode = '';
        let i = 0;
        const singleAnswers = {1:'A',2:'B',3:'A',4:'B',5:'B',6:'C',7:'C',8:'B',9:'A',10:'A',11:'A',12:'D',13:'B',14:'A',15:'A',16:'B',17:'B',18:'A',19:'B',20:'A'};
        const fillAnswers = {1:'扫码',2:'type',3:'url',4:'navigationBarTextStyle',5:'flex',6:'onPageScroll',7:'startTime',8:'wx.getLocation',9:'wx.getBackgroundAudioManager',10:'wx.makePhoneCall',11:'app.wxss',12:'indicator-dots',13:'{{}}',14:'currentTarget.id',15:'onLoad',16:'wx.setStorageSync',17:'backgroundColor',18:'scroll-view',19:'header',20:'10'};
        const judgeAnswers = {1:'错误',2:'错误',3:'正确',4:'正确',5:'错误',6:'错误',7:'正确',8:'错误',9:'正确',10:'正确'};
        function parseOptions(text) {
            const markers = ['A.','B.','C.','D.','A、','B、','C、','D、'];
            const idx = [];
            for (const m of markers) {
                const p = text.indexOf(m);
                if (p !== -1) idx.push({ m, p });
            }
            idx.sort((a, b) => a.p - b.p);
            const o = {};
            for (let j = 0; j < idx.length; j++) {
                const key = idx[j].m.replace(/[\.、]/g, '').charAt(0);
                const start = idx[j].p + idx[j].m.length;
                const end = j + 1 < idx.length ? idx[j + 1].p : text.length;
                o[key] = text.substring(start, end).trim();
            }
            return o;
        }
        while (i < lines.length) {
            const line = lines[i];
            if (line.includes('一、单选')) { mode = 'single'; i++; continue; }
            if (line.includes('二、填空')) { mode = 'fill'; i++; continue; }
            if (line.includes('三、判断')) { mode = 'judge'; i++; continue; }
            if (mode === 'single' && /^\d+[\.\u3002]/.test(line)) {
                const num = parseInt(line.match(/^(\d+)/)[1]);
                const qText = line.replace(/^\d+[\.\u3002]\s*/, '').trim();
                let optLine = '';
                let j = i + 1;
                const segs = [];
                while (j < lines.length) {
                    const nl = lines[j];
                    if (/^\d+[\.\u3002]/.test(nl) || nl.includes('二、填空') || nl.includes('三、判断')) break;
                    if (nl.startsWith('A') || nl.startsWith('B') || nl.startsWith('C') || nl.startsWith('D') || nl.includes('A.') || nl.includes('A、') || nl.includes('B.') || nl.includes('C.') || nl.includes('D.')) {
                        segs.push(nl);
                    }
                    j++;
                }
                optLine = segs.join(' ');
                if (optLine || (line.includes('A.') || line.includes('A、'))) {
                    const options = parseOptions(optLine || line);
                    const ans = singleAnswers[num];
                    if (ans && options.A && options.B && options.C && options.D) {
                        extracted.push({ question: qText, options, answer: ans, type: 'single' });
                    }
                }
                i = optLine ? j : (i + 1);
                continue;
            }
            if (mode === 'fill' && /^\d+[\.\u3002]/.test(line)) {
                const num = parseInt(line.match(/^(\d+)/)[1]);
                const qText = line.replace(/^\d+[\.\u3002]\s*/, '').trim();
                const ans = fillAnswers[num];
                if (ans) {
                    extracted.push({ question: qText, options: {}, answer: ans, type: 'fill' });
                }
                i++;
                continue;
            }
            if (mode === 'judge' && /^\d+[\.\u3002]/.test(line)) {
                const num = parseInt(line.match(/^(\d+)/)[1]);
                const qText = line.replace(/^\d+[\.\u3002]\s*/, '').trim();
                const ans = judgeAnswers[num];
                if (ans) {
                    extracted.push({ question: qText, options: {}, answer: ans, type: 'judge' });
                }
                i++;
                continue;
            }
            i++;
        }
        console.log(`Parsed ${extracted.length} questions from ${path.basename(filePath)} as category '${category}'`);
        addQuestions(extracted, category);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
    }
}
// Main execution
console.log('Starting conversion...');

// 1. Process the first file (Format 1 - 2025党史题库.txt)
const path1 = path.resolve(__dirname, 'wenjian/2025党史题库.txt');
if (fs.existsSync(path1)) {
    processFormat1(path1, '党史题库');
} else {
    console.error(`File not found: ${path1}`);
}

// 2. Process the second file (Format 2)
const path2 = path.resolve(__dirname, 'wenjian/思想道德修养  2025年“卡尔马克思”杯理论知识竞赛-题库.txt');
if (fs.existsSync(path2)) {
    processFormat2(path2, '思想道德修养');
} else {
    console.error(`File not found: ${path2}`);
}

// 3. Process the third file (Format 2)
const path3 = path.resolve(__dirname, 'wenjian/二十届三中全会_2025年卡尔马克思杯理论知识竞赛题库.txt');
if (fs.existsSync(path3)) {
    processFormat2(path3, '二十届三中全会');
} else {
    console.error(`File not found: ${path3}`);
}

// 4. Process the fourth file (Format 2)
const path4 = path.resolve(__dirname, 'wenjian/浙江省八八战略_理论知识竞赛题库.txt');
if (fs.existsSync(path4)) {
    processFormat2(path4, '八八战略');
} else {
    console.error(`File not found: ${path4}`);
}

// 5. Process the fifth file (Format 3)
const path5 = path.resolve(__dirname, 'wenjian/毛概（打印版本） 2025年“卡尔马克思”杯理论知识竞赛-题库.txt');
if (fs.existsSync(path5)) {
    processFormat3(path5, '毛概');
} else {
    console.error(`File not found: ${path5}`);
}

// 6. Process the sixth file (Format 3 - Xi Jinping Thought)
const path6 = path.resolve(__dirname, 'wenjian/习思想 2025年“卡尔马克思”杯理论知识竞赛-题库.txt');
if (fs.existsSync(path6)) {
    processFormat3(path6, '习思想');
} else {
    console.error(`File not found: ${path6}`);
}

// 7. Process the seventh file (Format 4 - Artificial Intelligence)
const path7 = path.resolve(__dirname, 'wenjian/人工智能.txt');
if (fs.existsSync(path7)) {
    processFormat4(path7, '人工智能');
} else {
    console.error(`File not found: ${path7}`);
}

// 8. Process Cloud Computing file (Format 5)
const path8 = path.resolve(__dirname, 'wenjian/云计算.txt');
if (fs.existsSync(path8)) {
    processFormat5(path8, '云计算');
} else {
    console.error(`File not found: ${path8}`);
}

// 9. Process Scholar paper file (Format 6)
const path9 = path.resolve(__dirname, 'wenjian/学术论文.txt');
if (fs.existsSync(path9)) {
    processFormat6(path9, '学术论文');
} else {
    console.error(`File not found: ${path9}`);
}

// 10. Process WeChat Mini Program file (Pipe format)
const path10 = path.resolve(__dirname, 'wenjian/微信小程序.txt');
if (fs.existsSync(path10)) {
    processWeChatEnumerated(path10, '微信小程序');
} else {
    console.error(`File not found: ${path10}`);
}

// 11. Process Python question bank file (Format 4)
const path11 = path.resolve(__dirname, 'wenjian/python题目(1).txt');
if (fs.existsSync(path11)) {
    processFormat4(path11, 'Python题库(1)');
} else {
    console.error(`File not found: ${path11}`);
}

// Write to JSON
function normalizeJudgeTypes(arr) {
    arr.forEach(q => {
        const ans = (q.answer || '').trim();
        const opts = q.options || {};
        const hasOnlyAB = (!!opts.A || !!opts.B) && !opts.C && !opts.D && !opts.E;
        const isJudgeText = ans === '正确' || ans === '错误';
        const isABJudge = (ans === 'A' || ans === 'B') && hasOnlyAB && (
            (opts.A === '正确' && opts.B === '错误') || (opts.A === '错误' && opts.B === '正确')
        );
        if (isJudgeText || isABJudge) {
            q.type = 'judge';
            if (ans === 'A' || ans === 'B') {
                const mapAB = { A: opts.A, B: opts.B };
                if (mapAB[ans]) q.answer = mapAB[ans];
            }
            q.options = { A: '对', B: '错' };
        }
    });
}
normalizeJudgeTypes(questions);
fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2), 'utf8');
console.log(`\nTotal questions generated: ${questions.length}`);
console.log(`Saved to ${outputPath}`);
