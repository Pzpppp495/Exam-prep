<script setup>
import { ref, computed, onMounted } from 'vue';
import Quiz from './components/Quiz.vue';
import Exam from './components/Exam.vue';
import questionsData from './questions.json';

const activeTab = ref('practice');
const selectedCategory = ref('');

// Extract unique categories from questions
const categories = computed(() => {
  const uniqueCategories = new Set(questionsData.map(q => q.category).filter(Boolean));
  return Array.from(uniqueCategories);
});

// Theme management
const themeMode = ref('system'); // 'light' | 'dark' | 'system'
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const applyTheme = (mode) => {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme-mode', themeMode.value);
};

const syncSystemTheme = () => {
  const mode = mediaQuery.matches ? 'dark' : 'light';
  applyTheme(mode);
};

const setThemeMode = (mode) => {
  themeMode.value = mode;
  if (mode === 'system') {
    syncSystemTheme();
    mediaQuery.addEventListener('change', syncSystemTheme);
  } else {
    mediaQuery.removeEventListener('change', syncSystemTheme);
    applyTheme(mode);
  }
};

onMounted(() => {
  const saved = localStorage.getItem('theme-mode');
  if (saved === 'dark' || saved === 'light' || saved === 'system') {
    setThemeMode(saved);
  } else {
    setThemeMode('system');
  }
});

const toggleTheme = () => {
  const next = themeMode.value === 'dark' ? 'light' : 'dark';
  setThemeMode(next);
};
</script>

<template>
  <header>
    <div class="wrapper">
      <h1>不做无法实现的梦！</h1>
      <div class="header-actions">
        <el-button size="small" @click="toggleTheme" class="theme-toggle">
          {{ themeMode === 'dark' ? '深色模式' : '浅色模式' }}
        </el-button>
      </div>
    </div>
  </header>

  <main>
    <div class="nav-tabs">
      <el-radio-group v-model="activeTab" size="large">
        <el-radio-button label="practice">顺序练习</el-radio-button>
        <el-radio-button label="exam">模拟考试</el-radio-button>
      </el-radio-group>
    </div>

    <!-- Category Selection for Practice Mode -->
    <div v-if="activeTab === 'practice'" class="category-selector">
      <span class="label">选择题库：</span>
      <el-select v-model="selectedCategory" placeholder="全部题库" style="width: 240px" clearable>
        <el-option label="全部题库" value="" />
        <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
    </div>

    <div class="content-area">
      <Quiz v-if="activeTab === 'practice'" :category="selectedCategory" :key="selectedCategory" />
      <Exam v-if="activeTab === 'exam'" />
    </div>
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
  text-align: center;
  padding: 20px 0;
  background-color: var(--app-bg-secondary);
  margin-bottom: 20px;
  border-bottom: 1px solid var(--app-border);
}

h1 {
  color: var(--app-accent);
  margin: 0;
}

.wrapper {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.category-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 30px;
  gap: 10px;
}

.label {
  font-size: 14px;
  color: var(--app-text);
}

.content-area {
  min-height: 600px;
}
.theme-toggle {
  margin-left: 12px;
}
</style>

<style>
:root {
  --app-bg: #ffffff;
  --app-bg-secondary: #f5f7fa;
  --app-text: #303133;
  --app-border: #e4e7ed;
  --app-accent: #409EFF;
}

html.dark {
  --app-bg: #121212;
  --app-bg-secondary: #1E1E1E;
  --app-text: #FFFFFF;
  --app-border: #2a2a2a;
  --app-accent: #409EFF;
}

html, body, #app {
  background-color: var(--app-bg);
  color: var(--app-text);
  transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
</style>
