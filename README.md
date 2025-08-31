# EchoTalk – Offline Shadowing Practice 🗣️

![Build](https://img.shields.io/github/actions/workflow/status/alisolphp/EchoTalk/test.yml?label=build)
![License](https://img.shields.io/github/license/alisolphp/EchoTalk)
![PWA](https://img.shields.io/badge/PWA-ready-green)
![Coverage](https://img.shields.io/badge/coverage-82%25-green)

EchoTalk is a browser-based language training tool designed for offline shadowing practice. It uses TTS, audio recording, and sentence review to help learners improve pronunciation and fluency.

![EchoTalk App Screenshot](https://user-images.githubusercontent.com/alisolphp/EchoTalk/public/screenshots/demo1.png)

🔗 [Live Demo](https://alisol.ir/Projects/EchoTalk)

---

## ✨ Features

- Record your voice using MediaRecorder and store it in IndexedDB
- Practice with random or custom sentences
- Multiple modes: Check Mode and Skip-Only Mode
- Slow-speed audio playback for review
- Word-level highlighting and jump-to-word functionality
- Click any word to look up its meaning
- Auto-save progress and settings
- Fully offline – no server required

---

## 🚀 Getting Started

1. Enter or select a sentence
2. Choose your practice mode
3. Click "Start Practice"
4. Enable microphone (optional)
5. Listen, repeat, and review

---

## 🛠️ Technologies

- [Vite](https://vitejs.dev/)
- Vitest (unit testing)
- TypeScript
- PWA
- MediaRecorder API
- IndexedDB
- Web Speech API (TTS)

---

## 🧪 Tests

This project includes a comprehensive suite of unit tests using Vitest, achieving over 82% code coverage. The tests cover key areas of the application to ensure reliability and correctness:

- **Core Practice Logic:** Verifies answer checking in different modes (Check vs. Skip), phrase advancement, repetition handling, and session completion logic.
- **State Management:** Ensures that the application state (e.g., current sentence, user settings) is correctly loaded from `localStorage`, initialized from the UI, and saved during practice.
- **Audio and Recordings:** Tests the playback of user-recorded audio and synthesized speech, as well as the logic for displaying recordings from IndexedDB.
- **UI Interaction:** Confirms that UI elements are correctly updated and event handlers (e.g., button clicks, toggles) trigger the expected state changes.
- **Utility Functions:** Includes tests for text cleaning, phrase segmentation, and similarity calculation.

---

## 📦 Installation

```bash
git clone [https://github.com/alisolphp/EchoTalk.git](https://github.com/alisolphp/EchoTalk.git)
cd EchoTalk
npm install
npm run dev
```

To run tests before build:

```bash
npm test
```

To build for production:

```bash
npm run build
```

---

## ⚠️ Limitations & Browser Support

- **No STT (speech-to-text) yet**
  This feature is planned for future versions.
- **Audio format support depends on browser**
- **Optimized for Chrome**
  Some features (e.g. audio recording, IndexedDB quota) may not work reliably in Firefox or Safari. A warning is shown in-app for unsupported browsers.

---

## 🧑‍🔧 Roadmap

- STT integration (speech-to-text for pronunciation feedback)
- Export/delete tools for recorded audio
- Sentence segmentation improvements
- Multi-language support

---

## 🧑‍💻 Contributing

Contributions are welcome! You can:
- Report bugs
- Suggest new features
- Improve code or documentation

To contribute, fork the repo and submit a pull request.

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).