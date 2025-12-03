<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import questionsData from '../questions.json';

const props = defineProps({
  category: {
    type: String,
    default: '' // '' means all, or specific category name
  }
});

// Filter questions based on category prop
const filteredQuestions = computed(() => {
  if (!props.category) return questionsData;
  return questionsData.filter(q => q.category === props.category);
});

const questions = ref(filteredQuestions.value);

// Watch for category changes
watch(() => props.category, (newVal) => {
  // Reset pagination first
  currentPage.value = 1;
  jumpPage.value = 1;
  userAnswers.value = {};
  showResult.value = {};
  window.scrollTo(0, 0);

  if (!newVal) {
    questions.value = questionsData;
  } else {
    questions.value = questionsData.filter(q => q.category === newVal);
  }
});

onMounted(() => {
  window.scrollTo(0, 0);
});

const userAnswers = ref({}); // { questionId: 'A' } or { questionId: ['A', 'B'] }
const showResult = ref({}); // { questionId: boolean }

const checkAnswer = (questionId) => {
  showResult.value[questionId] = true;
};

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
    return normUser.length > 0 && normAns.includes(normUser);
  } else {
    return userAnswer === question.answer;
  }
};

const getQuestionTypeLabel = (type) => {
  return type === 'multiple' ? '(多选题)' : '(单选题)';
};

// Pagination
const currentPage = ref(1);
const pageSize = 10;
const jumpPage = ref(1);

const totalPages = computed(() => Math.ceil(questions.value.length / pageSize));

const paginatedQuestions = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  const end = start + pageSize;
  return questions.value.slice(start, end);
});

const handlePageChange = (val) => {
  currentPage.value = val;
  jumpPage.value = val; // Sync jumper input
  window.scrollTo(0, 0);
};

const handleJump = () => {
  let page = parseInt(jumpPage.value);
  if (isNaN(page)) page = 1;
  if (page < 1) page = 1;
  if (page > totalPages.value) page = totalPages.value;
  
  currentPage.value = page;
  jumpPage.value = page;
  window.scrollTo(0, 0);
};

// Watch for external page changes to update jump input
watch(currentPage, (newVal) => {
  jumpPage.value = newVal;
});
</script>

<template>
  <div class="quiz-container">
    <div class="category-info" v-if="props.category">
      <el-alert :title="`当前复习区域：${props.category} (共 ${questions.length} 题)`" type="info" :closable="false" show-icon />
    </div>

    <el-card v-for="(q, index) in paginatedQuestions" :key="q.id" class="question-card">
      <template #header>
        <div class="card-header">
          <el-tag v-if="q.type === 'multiple'" type="warning" size="small" style="margin-right: 8px;">多选</el-tag>
          <el-tag v-else-if="q.type === 'fill'" type="success" size="small" style="margin-right: 8px;">填空</el-tag>
          <el-tag v-else size="small" style="margin-right: 8px;">单选</el-tag>
          <el-tag type="info" size="small" style="margin-right: 8px;">{{ q.category }}</el-tag>
          <span>{{ (currentPage - 1) * pageSize + index + 1 }}. {{ q.question }}</span>
        </div>
      </template>
      
      <div class="options-list">
        <div v-if="q.type === 'fill'" class="fill-blank-group">
          <el-input
            v-model="userAnswers[q.id]"
            type="textarea"
            :rows="3"
            placeholder="请输入答案"
          />
        </div>

        <el-radio-group v-else-if="q.type === 'single'" v-model="userAnswers[q.id]" class="radio-group">
          <el-radio :value="'A'" size="large" class="option-item">A. {{ q.options.A }}</el-radio>
          <el-radio :value="'B'" size="large" class="option-item">B. {{ q.options.B }}</el-radio>
          <el-radio :value="'C'" size="large" class="option-item">C. {{ q.options.C }}</el-radio>
          <el-radio :value="'D'" size="large" class="option-item">D. {{ q.options.D }}</el-radio>
        </el-radio-group>

        <el-checkbox-group v-else v-model="userAnswers[q.id]" class="checkbox-group">
          <el-checkbox value="A" size="large" class="option-item">A. {{ q.options.A }}</el-checkbox>
          <el-checkbox value="B" size="large" class="option-item">B. {{ q.options.B }}</el-checkbox>
          <el-checkbox value="C" size="large" class="option-item">C. {{ q.options.C }}</el-checkbox>
          <el-checkbox value="D" size="large" class="option-item">D. {{ q.options.D }}</el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="actions">
        <el-button type="primary" @click="checkAnswer(q.id)" :disabled="!userAnswers[q.id] || (Array.isArray(userAnswers[q.id]) && userAnswers[q.id].length === 0)">
          检查答案
        </el-button>
        
        <div v-if="showResult[q.id]" class="result-display">
          <span v-if="isCorrect(q)" class="correct">✔ 回答正确</span>
          <span v-else class="incorrect">
            ❌ 回答错误 (正确答案: {{ q.answer }})
          </span>
        </div>
      </div>
    </el-card>

    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        background
        layout="total, prev, pager, next"
        :total="questions.length"
        :page-size="pageSize"
        @current-change="handlePageChange"
      />
      
      <div class="custom-jumper">
        <span>前往</span>
        <el-input-number 
          v-model="jumpPage" 
          :min="1" 
          :max="totalPages" 
          size="default" 
          class="jump-input"
          :controls="false"
          @keyup.enter="handleJump"
        />
        <span>页</span>
        <el-button type="primary" size="default" @click="handleJump">跳转</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.category-info {
  margin-bottom: 20px;
}

.question-card {
  margin-bottom: 20px;
}

.card-header {
  font-weight: bold;
  font-size: 16px;
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
}

.radio-group, .checkbox-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.option-item {
  margin-bottom: 10px;
  margin-left: 0 !important;
  width: 100%;
  white-space: normal;
  height: auto;
  padding: 10px 0;
}

/* Deep selector to fix Element Plus radio/checkbox label wrapping */
:deep(.el-radio__label), :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.5;
}

.actions {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.result-display {
  font-weight: bold;
  font-size: 16px;
}

.correct {
  color: #67C23A;
}

.incorrect {
  color: #F56C6C;
}

.pagination-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  margin-top: 30px;
  margin-bottom: 50px;
}

.custom-jumper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.jump-input {
  width: 80px;
}
</style>
