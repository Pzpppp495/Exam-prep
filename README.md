# awa

一个使用 `Vue 3 + Vite` 构建并集成 `Capacitor` 的项目。

## 环境要求

- Node `>=20.19.0`

## 快速开始

- 安装依赖：`npm install`
- 启动开发：`npm run dev`

## 构建与预览

- 生产构建：`npm run build`
- 本地预览：`npm run preview`

## Android 打包（Capacitor）

- 构建前端：`npm run build`
- 同步到 Android：`npx cap sync android`
- 打开 Android 工程：`npx cap open android`
- 命令行打包（Windows）：`cd android && .\gradlew.bat assembleDebug`

## 题库转换

- 将 `wenjian/*.txt` 转换为 `src/questions.json`：在项目根目录运行 `node convert_questions.js`

## 目录提示

- `src/components`：包含 `Exam.vue`、`Quiz.vue`
- `dist`：生产构建输出
- `android`：Android 项目（Capacitor）
