# EchoTalk – Offline Shadowing Practice 🗣️

EchoTalk is a browser-based language training tool designed for offline shadowing practice. It uses TTS, audio recording, and sentence review to help learners improve pronunciation and fluency.

![EchoTalk App Screenshot](https://user-images.githubusercontent.com/alisolphp/echotalk/public/screenshots/demo1.png)

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
- TypeScript
- PWA
- MediaRecorder API
- IndexedDB
- Web Speech API (TTS)
- Vitest (unit testing)

---

## 🧪 Tests

Includes unit tests for key logic:
- `calculateWordSimilarity`
- `init` and fallback handling

---

## 📦 Installation

```bash
git clone https://github.com/your-username/EchoTalk.git
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

## 🧑‍💻 Contributing

Contributions are welcome! You can:
- Report bugs
- Suggest new features
- Improve code or documentation

To contribute, fork the repo and submit a pull request.

---

## ⚠️ Limitations

- No STT (speech-to-text) yet
- Audio format support depends on browser
- Optimized for Chrome

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE).
