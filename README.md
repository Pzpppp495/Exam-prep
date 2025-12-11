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

### APK 输出与安装

- Debug APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`
- 安装方式：将 APK 拷贝到设备直接安装，或使用 `adb install app-debug.apk`

### 生成 Release APK（可选）

- 如需发布版本，请在 Android 工程中配置签名后执行：`cd android && .\gradlew.bat assembleRelease`
- 生成的 Release APK 通常位于：`android/app/build/outputs/apk/release/`
- 注意：请勿将签名文件（`.jks`/`.keystore` 等）提交到版本库。

## 题库转换

- 将 `wenjian/*.txt` 转换为 `src/questions.json`：在项目根目录运行 `node convert_questions.js`

## 模拟考试默认抽题规则

- 默认设置：`Python题库(1)` 抽取最多 10 题（不超过实际题量），其他题库默认 0。
- 规则实现位置：`src/components/Exam.vue:48`

## 目录提示

- `src/components`：包含 `Exam.vue`、`Quiz.vue`
- `dist`：生产构建输出
- `android`：Android 项目（Capacitor）
