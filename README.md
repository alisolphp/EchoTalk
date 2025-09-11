# EchoTalk – Offline Shadowing Practice 🗣️

![Build](https://img.shields.io/github/actions/workflow/status/alisolphp/EchoTalk/.github/workflows/deploy.yml?branch=main&label=build&logo=github)
![Deploy](https://img.shields.io/github/deployments/alisolphp/EchoTalk/github-pages?label=pages&logo=githubpages)
![License](https://img.shields.io/github/license/alisolphp/EchoTalk)
![PWA](https://img.shields.io/badge/PWA-ready-green)
CoveragePercentPlaceholder <!-- COVERAGE_BADGE_LINE -->

EchoTalk is a **privacy-first, offline language training tool** that helps you master the **Shadowing** technique for improving pronunciation, fluency, and confidence. It works as a **Progressive Web App (PWA)**, requires no server, and keeps all your recordings securely on your device.

🔗 Live Demo: [**(alisolphp.github.io/EchoTalk)**](https://alisol.ir/Projects/EchoTalk)

🔗 Mirror Server: [**(alisol.ir/EchoTalk)**](https://alisol.ir/EchoTalk)

<img src="public/screenshots/echotalk-screenshots.gif" width="370" alt="EchoTalk Demo">

---

## ✨ Features

### 🧠 Smart Training & Learning Modes

* **Skip-Only, Check, and Auto-Skip modes** for flexible practice styles.
* **Auto Repetition & Auto Speed** that adapt dynamically to your progress.
* **Intelligent sentence splitting** that avoids meaningless one-word segments.
* **Repetition counters** so you always know how many loops are left.

### 🎨 Modern UI/UX

* **Multi-language support**: English, Dutch, Polish, Portuguese, Russian, Turkish, and more.
* **Word-level interaction**: click a word to open tools for meaning, pronunciation, and AI-powered analysis.
* **Practice streak tracker** with calendar view and motivational messages.
* **History & recordings**: review all your past practices and replay your recordings.
* **Seamless flows**: restart or switch sentences easily, plus celebration animations after sessions.
* **Live recording visualizer** for instant feedback.

### ♿ Accessibility

* Adjustable **TTS speed** (slow → furious).
* **Keyboard-only navigation** for mouse-free practice.
* **Screen reader friendly** with live progress announcements.
* **Reduced motion mode** for comfortable interaction.

### 📝 Rich Content & Integrations

* **Personalized sample sentences** by language, level, and category.
* **Google Translate & AI integrations** for deep analysis, grammar help, vocabulary expansion, and creative exercises.
* **Fast AI analysis** of your recordings for pronunciation accuracy, plus detailed **offline prompts** for Gemini/ChatGPT.

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
| src/app.ts | 72.6 | 71.79 | 80.95 | 72.6 |
| src/types.ts | 100 | 100 | 100 | 100 |
| src/services/ai.service.ts | 97.43 | 90.38 | 100 | 97.43 |
| src/services/audio.service.ts | 72.41 | 88.31 | 80 | 72.41 |
| src/services/data.service.ts | 84.83 | 78.48 | 78.26 | 84.83 |
| src/services/practice.service.ts | 63.3 | 73.43 | 72.72 | 63.3 |
| src/services/prompts.service.ts | 100 | 100 | 100 | 100 |
| src/services/ui.service.ts | 84.28 | 89.06 | 80.76 | 84.28 |
| src/services/util.service.ts | 90 | 86 | 100 | 90 |
| src/utils/string.extensions.ts | 100 | 100 | 100 | 100 |
| All files | 78.32 | 82.35 | 83.22 | 78.32 |
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

Next up:

* [ ] **STT integration** for real-time pronunciation scoring
* [ ] **Export tools** for recordings
* [ ] **Smarter sentence segmentation** with AI assistance
* [ ] **Gamification** (badges, levels, rewards)
* [ ] **Community sharing features**

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
