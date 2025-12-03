<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import questionsData from '../questions.json';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps({
  questionCount: {
    type: Number,
    default: 30
  }
});

const emit = defineEmits(['finish']);

const isConfiguring = ref(true);
const categoryConfig = ref({});
const examQuestions = ref([]);
const userAnswers = ref({});
const isSubmitted = ref(false);
const examResult = ref({
  score: 0,
  total: 0,
  correctCount: 0,
  wrongCount: 0
});

// Compute available categories and their question counts
const categoryStats = computed(() => {
  const stats = {};
  questionsData.forEach(q => {
    if (!stats[q.category]) {
      stats[q.category] = { count: 0, name: q.category };
    }
    stats[q.category].count++;
  });
  return Object.values(stats);
});

// Total selected questions count
const totalSelected = computed(() => {
  return Object.values(categoryConfig.value).reduce((sum, count) => sum + (count || 0), 0);
});

// Initialize configuration
const initConfig = () => {
  const config = {};
  categoryStats.value.forEach(cat => {
    config[cat.name] = cat.name === '云计算' ? Math.min(10, cat.count) : 0;
  });
  categoryConfig.value = config;
  isConfiguring.value = true;
  isSubmitted.value = false;
};

const startExam = () => {
  if (totalSelected.value === 0) {
    ElMessage.warning('请至少选择一道题目！');
    return;
  }

  let selectedQuestions = [];
  
  // Iterate config and select questions
  Object.entries(categoryConfig.value).forEach(([catName, count]) => {
    if (count > 0) {
        const catQuestions = questionsData.filter(q => q.category === catName);
        // Shuffle
        const shuffled = [...catQuestions].sort(() => 0.5 - Math.random());
        // Pick
        selectedQuestions = selectedQuestions.concat(shuffled.slice(0, count));
    }
  });

  // Shuffle the final mix
  selectedQuestions.sort(() => 0.5 - Math.random());

  examQuestions.value = selectedQuestions.map((q, index) => ({
    ...q,
    examIndex: index + 1
  }));
  
  userAnswers.value = {};
  isSubmitted.value = false;
  examResult.value = { score: 0, total: 0, correctCount: 0, wrongCount: 0 };
  isConfiguring.value = false;
  
  nextTick(() => {
    window.scrollTo(0, 0);
  });
};

onMounted(() => {
  initConfig();
});

const isCorrect = (question) => {
  const userAnswer = userAnswers.value[question.id];
  if (!userAnswer) return false;

  if (question.type === 'multiple') {
    if (!Array.isArray(userAnswer)) return false;
    const sortedUserAnswer = [...userAnswer].sort().join('');
    const sortedCorrectAnswer = question.answer.split('').sort().join('');
    return sortedUserAnswer === sortedCorrectAnswer;
  } else if (question.type === 'fill') {
      if (typeof userAnswer !== 'string') return false;
      const normUser = userAnswer.trim().toLowerCase();
      const normAns = question.answer.toLowerCase();
      // Basic containment check
      return normUser.length > 0 && normAns.includes(normUser);
  } else {
    return userAnswer === question.answer;
  }
};

const submitExam = () => {
  ElMessageBox.confirm(
    '确定要提交试卷吗？提交后将不能修改答案。',
    '提示',
    {
      confirmButtonText: '确定提交',
      cancelButtonText: '继续答题',
      type: 'warning',
    }
  ).then(() => {
    calculateScore();
    isSubmitted.value = true;
    window.scrollTo(0, 0);
    ElMessage.success('试卷已提交！');
  }).catch(() => {});
};

const calculateScore = () => {
  let correct = 0;
  examQuestions.value.forEach(q => {
    if (isCorrect(q)) {
      correct++;
    }
  });
  
  examResult.value = {
    score: Math.round((correct / examQuestions.value.length) * 100),
    total: examQuestions.value.length,
    correctCount: correct,
    wrongCount: examQuestions.value.length - correct
  };
};

const scrollToQuestion = (index) => {
  const element = document.getElementById(`question-${index}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const getQuestionStatusClass = (question) => {
  if (!isSubmitted.value) {
    // In exam mode, show answered/unanswered
    const ans = userAnswers.value[question.id];
    if (ans && (Array.isArray(ans) ? ans.length > 0 : true)) {
      return 'status-answered';
    }
    return '';
  } else {
    // In result mode, show correct/wrong
    return isCorrect(question) ? 'status-correct' : 'status-wrong';
  }
};
</script>

<template>
  <div class="exam-container">
    <!-- Configuration Panel -->
    <div v-if="isConfiguring" class="config-panel">
      <el-card class="config-card">
        <template #header>
          <div class="config-header">
            <h2>考试设置</h2>
            <p class="subtitle">请设置每个题库抽取的题目数量</p>
          </div>
        </template>
        
        <div class="config-items">
          <div v-for="cat in categoryStats" :key="cat.name" class="config-item">
            <div class="cat-info">
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-total">(共 {{ cat.count }} 题)</span>
            </div>
            <el-input-number 
              v-model="categoryConfig[cat.name]" 
              :min="0" 
              :max="cat.count"
              size="large" 
            />
          </div>
        </div>

        <div class="config-footer">
          <div class="total-summary">
            本次考试共 <span class="highlight">{{ totalSelected }}</span> 题
          </div>
          <el-button type="primary" size="large" @click="startExam" class="start-btn">开始考试</el-button>
        </div>
      </el-card>
    </div>

    <!-- Exam Main Interface -->
    <div v-else class="exam-main">
      <div class="exam-header">
        <h2>模拟考试 ({{ examQuestions.length }}题)</h2>
        <div v-if="isSubmitted" class="exam-result-banner">
          <h3>考试结束</h3>
          <div class="score-info">
            <span class="score">得分: {{ examResult.score }}分</span>
            <span>(正确: {{ examResult.correctCount }} / 错误: {{ examResult.wrongCount }})</span>
          </div>
          <el-button type="primary" @click="initConfig">再考一次</el-button>
        </div>
      </div>

      <div class="questions-list">
        <el-card 
          v-for="(q, index) in examQuestions" 
          :key="q.id" 
          :id="`question-${index}`"
          class="question-card"
          :class="{ 'wrong-answer-card': isSubmitted && !isCorrect(q) }"
        >
          <template #header>
            <div class="card-header">
              <el-tag v-if="q.type === 'multiple'" type="warning" size="small" style="margin-right: 8px;">多选</el-tag>
              <el-tag v-else-if="q.type === 'fill'" type="success" size="small" style="margin-right: 8px;">填空</el-tag>
              <el-tag v-else size="small" style="margin-right: 8px;">单选</el-tag>
              <el-tag type="info" size="small" style="margin-right: 8px;">{{ q.category }}</el-tag>
              <span>{{ index + 1 }}. {{ q.question }}</span>
            </div>
          </template>
          
          <div class="options-list">
            <!-- Fill in the blank -->
            <div v-if="q.type === 'fill'" class="fill-blank-group">
                <el-input
                  v-model="userAnswers[q.id]"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入答案"
                  :disabled="isSubmitted"
                />
            </div>

            <!-- Single Choice -->
            <el-radio-group 
              v-else-if="q.type === 'single'" 
              v-model="userAnswers[q.id]" 
              class="radio-group"
              :disabled="isSubmitted"
            >
              <el-radio :value="'A'" size="large" class="option-item">A. {{ q.options.A }}</el-radio>
              <el-radio :value="'B'" size="large" class="option-item">B. {{ q.options.B }}</el-radio>
              <el-radio :value="'C'" size="large" class="option-item">C. {{ q.options.C }}</el-radio>
              <el-radio :value="'D'" size="large" class="option-item">D. {{ q.options.D }}</el-radio>
              <el-radio v-if="q.options.E" :value="'E'" size="large" class="option-item">E. {{ q.options.E }}</el-radio>
            </el-radio-group>

            <!-- Multiple Choice -->
            <el-checkbox-group 
              v-else-if="q.type === 'multiple'" 
              v-model="userAnswers[q.id]" 
              class="checkbox-group"
              :disabled="isSubmitted"
            >
              <el-checkbox value="A" size="large" class="option-item">A. {{ q.options.A }}</el-checkbox>
              <el-checkbox value="B" size="large" class="option-item">B. {{ q.options.B }}</el-checkbox>
              <el-checkbox value="C" size="large" class="option-item">C. {{ q.options.C }}</el-checkbox>
              <el-checkbox value="D" size="large" class="option-item">D. {{ q.options.D }}</el-checkbox>
              <el-checkbox v-if="q.options.E" value="E" size="large" class="option-item">E. {{ q.options.E }}</el-checkbox>
            </el-checkbox-group>
          </div>

          <div v-if="isSubmitted && !isCorrect(q)" class="answer-analysis">
            <div class="error-msg">❌ 回答错误</div>
            <div class="correct-ans">
              <span class="label">正确答案:</span>
              <div v-if="q.type === 'fill'" class="multiline-answer">{{ q.answer }}</div>
              <span v-else>{{ q.answer }}</span>
            </div>
            <div v-if="q.analysis" class="analysis-text">
                <span class="label">解析:</span> {{ q.analysis }}
            </div>
          </div>
          <div v-else-if="isSubmitted && isCorrect(q)" class="answer-analysis success">
            <div class="success-msg">✔ 回答正确</div>
            <div class="correct-ans">
              <span class="label">答案:</span>
              <div v-if="q.type === 'fill'" class="multiline-answer">{{ q.answer }}</div>
              <span v-else>{{ q.answer }}</span>
            </div>
            <div v-if="q.analysis" class="analysis-text">
                <span class="label">解析:</span> {{ q.analysis }}
            </div>
          </div>
        </el-card>
      </div>

      <div class="exam-footer" v-if="!isSubmitted">
        <el-button type="primary" size="large" @click="submitExam" class="submit-btn">提交试卷</el-button>
      </div>
    </div>

    <!-- Sidebar Navigation (Only in exam mode) -->
    <div v-if="!isConfiguring" class="exam-sidebar">
      <div class="sidebar-content">
        <h3>答题卡</h3>
        <div class="grid-nav">
          <div 
            v-for="(q, index) in examQuestions" 
            :key="q.id"
            class="nav-item"
            :class="getQuestionStatusClass(q)"
            @click="scrollToQuestion(index)"
          >
            {{ index + 1 }}
          </div>
        </div>
        <div class="sidebar-legend">
          <div v-if="!isSubmitted">
            <span class="dot answered"></span> 已答
            <span class="dot"></span> 未答
          </div>
          <div v-else>
            <span class="dot correct"></span> 正确
            <span class="dot wrong"></span> 错误
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-container {
  display: flex;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
}

.exam-main {
  flex: 1;
  min-width: 0; /* Prevent flex item from overflowing */
}

.exam-sidebar {
  width: 280px;
  flex-shrink: 0;
}

.sidebar-content {
  position: sticky;
  top: 20px;
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.grid-nav {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-top: 15px;
}

.nav-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.nav-item:hover {
  border-color: #409EFF;
  color: #409EFF;
}

.nav-item.status-answered {
  background-color: #ecf5ff;
  border-color: #409EFF;
  color: #409EFF;
}

.nav-item.status-correct {
  background-color: #f0f9eb;
  border-color: #67C23A;
  color: #67C23A;
}

.nav-item.status-wrong {
  background-color: #fef0f0;
  border-color: #F56C6C;
  color: #F56C6C;
}

.question-card {
  margin-bottom: 20px;
  scroll-margin-top: 20px; /* For smooth scroll offset */
}

.card-header {
  font-weight: bold;
  font-size: 16px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
}

.radio-group, .checkbox-group, .fill-blank-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

.option-item {
  margin-bottom: 10px;
  margin-left: 0 !important;
  width: 100%;
  white-space: normal;
  height: auto;
  padding: 10px 0;
}

:deep(.el-radio__label), :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.5;
}

.exam-footer {
  margin-top: 30px;
  text-align: center;
  padding-bottom: 50px;
}

.submit-btn {
  width: 200px;
}

.exam-result-banner {
  background-color: #f0f9eb;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 20px;
  border: 1px solid #e1f3d8;
}

.score-info {
  font-size: 18px;
  margin: 15px 0;
  color: #67C23A;
  font-weight: bold;
}

.answer-analysis {
  margin-top: 20px;
  padding: 15px;
  background-color: #fef0f0;
  border-radius: 4px;
  border-left: 4px solid #F56C6C;
}

.answer-analysis.success {
  background-color: #f0f9eb;
  border-left-color: #67C23A;
}

.error-msg {
  color: #F56C6C;
  font-weight: bold;
  margin-bottom: 8px;
}

.success-msg {
  color: #67C23A;
  font-weight: bold;
  margin-bottom: 8px;
}

.correct-ans {
  font-size: 14px;
  color: #606266;
}

.analysis-text {
  margin-top: 10px;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
}

.multiline-answer {
  white-space: pre-wrap;
  margin-top: 5px;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.5);
  padding: 8px;
  border-radius: 4px;
}

.label {
  font-weight: bold;
  margin-right: 5px;
}

.wrong-answer-card {
  border-color: #fab6b6;
}

.sidebar-legend {
  margin-top: 20px;
  font-size: 12px;
  color: #909399;
  display: flex;
  gap: 15px;
  justify-content: center;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  margin-right: 5px;
}

.dot.answered {
  background-color: #ecf5ff;
  border-color: #409EFF;
}

.dot.correct {
  background-color: #f0f9eb;
  border-color: #67C23A;
}

.dot.wrong {
  background-color: #fef0f0;
  border-color: #F56C6C;
}

.config-panel {
  max-width: 800px;
  margin: 40px auto;
}

.config-card {
  border-radius: 8px;
}

.config-header {
  text-align: center;
  padding: 10px 0;
}

.config-header h2 {
  margin: 0 0 10px 0;
  color: #303133;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.config-items {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 0;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.config-item:hover {
  background-color: #e6e8eb;
}

.cat-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cat-name {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.cat-total {
  font-size: 12px;
  color: #909399;
}

.config-footer {
  margin-top: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.total-summary {
  font-size: 18px;
  color: #606266;
}

.highlight {
  color: #409EFF;
  font-weight: bold;
  font-size: 24px;
  margin: 0 5px;
}

.start-btn {
  width: 200px;
  font-size: 18px;
}

@media (max-width: 768px) {
  .exam-container {
    flex-direction: column-reverse;
  }
  
  .exam-sidebar {
    width: 100%;
  }
  
  .sidebar-content {
    position: static;
  }
}
</style>
