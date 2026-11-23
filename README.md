# EchoTalk – Offline Shadowing Practice 🗣️

![Build](https://img.shields.io/github/actions/workflow/status/alisolphp/EchoTalk/.github/workflows/deploy.yml?branch=main&label=build&logo=github)
![Deploy](https://img.shields.io/github/deployments/alisolphp/EchoTalk/github-pages?label=pages&logo=githubpages)
![License](https://img.shields.io/github/license/alisolphp/EchoTalk?cacheSeconds=1)
![PWA](https://img.shields.io/badge/PWA-ready-green)
![Coverage](https://img.shields.io/badge/coverage-87.19%25-green) <!-- COVERAGE_BADGE_LINE -->

EchoTalk is a **privacy-first, offline language training tool** that helps you master the **Shadowing** technique for improving pronunciation, fluency, and confidence. It works as a **Progressive Web App (PWA)**, requires no server, and keeps all your recordings securely on your device.

🔗 Live Demo:
  - [**(alisolphp.github.io/EchoTalk)**](https://alisolphp.github.io/EchoTalk/)

🔗 Mirror Server: 
  - [**(echotalk.ir)**](https://echotalk.ir/EchoTalk/)

📱 Android Application (TWA):
- [**Direct Download**](https://echotalk.ir/s3/EchoTalk/EchoTalk.apk)

<img src="public/screenshots/echotalk-screenshots.gif" width="370" alt="EchoTalk Demo">

---

## ✨ Features

### 🧠 Smart Training & Learning Modes

* **Skip-Only, Check, and Auto-Skip modes** for flexible practice styles.
* **Auto Repetition & Auto Speed** that adapt dynamically to your progress.
* **Repetition counters** so you always know how many loops are left.
* **AI Personal Teacher**:
  - Get fast, targeted analysis of your **pronunciation & fluency** (word-by-word guidance).
  - Generate **context/nuance insights** and **creative practice** (variations, opposites, Q&A, fill-in-the-blank) to remember meanings better and faster.

### 📝 Rich Content
* Large ready-made sentence packs organized by **level** and **category**.
* Personalized sample sentences by language, level, and topic.
* Word-level tools: click any word for meaning/pronunciation and AI-powered analysis.

### 🤖 AI Integrations & Extensions
* Grammar help, translations, and vocabulary expansion via AI.
* Creative exercises (opposites, variations, quizzes) with ChatGPT/Gemini prompts.
* Fast AI pronunciation analysis of your recordings (offline prompts supported).

### 🎨 Modern UI/UX

* **Multi-language support**: English, Dutch, Polish, Portuguese, Russian, Turkish, and more.
* **Word-level interaction**: click a word to open tools for meaning, pronunciation, and AI-powered analysis.
* **Practice streak tracker** with calendar view and motivational messages.
* **History & recordings**: review all your past practices, replay your recordings, and delete recordings you no longer need.
* **My Sentences**: save your own sentences on your device and practice them any time.
* **Seamless flows**: restart or switch sentences easily, plus celebration animations after sessions.
* **Live recording visualizer** for instant feedback.

### ♿ Accessibility

* Adjustable **TTS speed** (slow → furious).
* **Keyboard-only navigation** for mouse-free practice.
* **Screen reader friendly** with live progress announcements.

### ⚙️ Technology & Performance

* **Works fully offline** after first load.
* **Optimized for Chrome & mobile browsers** (with fallbacks for others).
* **PWA with auto-updates** and local caching for fast startup.
* **Version & build info** displayed in-app for easy bug reporting.
* **IndexedDB storage** for recordings and practice history.
* **Service Worker caching** for instant load times.

---

## 🚀 Getting Started

1. Enter or pick a sentence (or use a personalized sample).
2. Choose your language, level, and practice mode.
3. Click **Start Practice**.
4. Enable microphone recording (optional).
5. Listen, shadow, and track your progress.

---

## 🛠️ Technologies

* [Vite](https://vitejs.dev/) + TypeScript
* [Bootstrap 5](https://getbootstrap.com/) & Bootstrap Icons
* IndexedDB for offline storage
* Web Speech API (TTS)
* MediaRecorder API
* PWA + Service Worker
* Vitest for unit testing

---

## 🧪 Tests

EchoTalk has **200+ unit tests** covering:

* Practice logic and session flow
* State management and persistence
* Audio recording and playback
* IndexedDB integration
* UI event handling and DOM updates
* Utility functions (segmentation, similarity, text cleaning)


### Coverage Summary
<!-- COVERAGE_TABLE_START -->
| File | % Stmts | % Branch | % Funcs | % Lines |
| ---- | ------- | -------- | ------- | ------- |
| src/app.ts | 83.73 | 83.45 | 96 | 83.73 |
| src/types.ts | 100 | 100 | 100 | 100 |
| src/services/ai.service.ts | 97.44 | 90.38 | 100 | 97.44 |
| src/services/audio.service.ts | 73.33 | 89.41 | 81.48 | 73.33 |
| src/services/collection.service.ts | 91.17 | 74.11 | 78.57 | 91.17 |
| src/services/data.service.ts | 87.62 | 81.41 | 82.14 | 87.62 |
| src/services/my-sentences.service.ts | 96.7 | 89.13 | 100 | 96.7 |
| src/services/practice.service.ts | 80.97 | 83.13 | 77.27 | 80.97 |
| src/services/promo.service.ts | 100 | 100 | 100 | 100 |
| src/services/prompts.service.ts | 100 | 100 | 100 | 100 |
| src/services/ui.service.ts | 87.03 | 91.42 | 81.48 | 87.03 |
| src/services/util.service.ts | 95.12 | 90.19 | 100 | 95.12 |
| src/utils/dontapply-import.ts | 92.98 | 95.95 | 100 | 92.98 |
| src/utils/html.ts | 100 | 100 | 100 | 100 |
| src/utils/my-sentences.ts | 100 | 97.87 | 100 | 100 |
| src/utils/string.extensions.ts | 100 | 100 | 100 | 100 |
| All files | 87.19 | 87.24 | 88.15 | 87.19 |
<!-- COVERAGE_TABLE_END -->

---

## 📦 Installation

```bash
git clone https://github.com/alisolphp/EchoTalk.git
cd EchoTalk
npm install
npm run dev
```

Run tests:

```bash
npx vitest run --coverage
```

Build for production:

```bash
npm run build
```

---

## ⚠️ Limitations & Browser Support

* **Built-in Speech-to-text (STT)** is not yet implemented.
* **Best performance on Chrome & Android browsers**.
* Safari and Firefox may have limited IndexedDB quota or recording issues.

---

## 🧑‍🔧 Roadmap

* ✅ Multi-language support & sentence history
* ✅ Practice streak tracker with calendar
* ✅ AI integrations for grammar, translation, and pronunciation
* ✅ Offline-first with recordings saved locally

### Next Up

* [ ] **Custom Video & Subtitle Upload**
* [ ] **YouTube API Integration**
* [ ] **Explore & browse sentences by level and category**
* [ ] **Export tools** for recordings
* [ ] **Gamification** (badges, levels, rewards)
* [ ] **Community sharing features**

### 🔮 Planned Enhancements

* [ ] **Custom Video & Subtitle Upload**
    - Users can upload their favorite movies or clips along with subtitle files.
    - Practice with content they love, in the exact accent they want to train.
    - Facial expressions and lip movements become part of the shadowing experience.

* [ ] **YouTube API Integration**
    - Let users pick and practice directly with YouTube videos.
    - Faster and easier than manual video + subtitle uploads.
    - ⚠️ Planned for the future due to API costs and potential complexity.


---

## 🧑‍💻 Contributing

Contributions are welcome! You can:

* Report bugs
* Suggest features
* Improve code or docs

Fork the repo, make your changes, and open a pull request.

---

## 📄 License

MIT License – see [LICENSE](./LICENSE).
