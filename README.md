# EchoTalk - Offline Shadowing Practice

![EchoTalk App Screenshot](https://user-images.githubusercontent.com/alisolphp/echotalk/public/screenshots/demo1.png) EchoTalk is a modern, privacy-focused, offline-first Progressive Web App (PWA) designed to help language learners improve their pronunciation and fluency through the shadowing technique. It's built to work entirely in the browser, meaning your data never leaves your device.

## ✨ Features

* **Offline-First:** Works completely offline after the first visit. No internet connection required.
* **Two Practice Modes:**
    * **Skip Mode:** Listen, repeat to yourself, and move to the next phrase at your own pace.
    * **Check Mode:** Use your device's microphone to get a similarity score on your pronunciation.
* **Voice Recording:** Record your practice sessions locally and compare your pronunciation against the bot's audio.
* **Karaoke-Style Highlighting:** Words are highlighted in real-time as they are spoken, making it easy to follow along.
* **Custom Content:** Practice with built-in random samples or paste in your own text.
* **Playback Control:** Re-listen to phrases at a slower speed to catch difficult pronunciations.
* **Instant Word Lookup:** Click on any word to look up its meaning in a new tab.
* **Auto-Save Progress:** Your current sentence, position, and settings are saved automatically.
* **100% Client-Side:** All processing and data storage happens locally in your browser, ensuring complete privacy.

## 🛠️ Tech Stack

* **Build Tool:** [Vite](https://vitejs.dev/)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **UI Libraries:** [jQuery](https://jquery.com/) & [Bootstrap](https://getbootstrap.com/)
* **PWA:** `vite-plugin-pwa`
* **Browser APIs:**
    * Web Speech API (for Text-to-Speech)
    * MediaStream Recording API (for voice recording)
    * IndexedDB API (for storing audio recordings)
    * Web Storage API (for saving user state)

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js (v18.x or later recommended)
* npm or yarn

### Local Development

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/alisolphp/echotalk.git](https://github.com/alisolphp/echotalk.git)
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd echotalk
    ```
3.  **Install dependencies:**
    ```sh
    npm install
    ```
4.  **Run the development server:**
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## 🐳 Running with Docker

You can also run the application in a containerized environment using Docker.

1.  **Build and run the container:**
    ```sh
    docker-compose up -d
    ```
2.  The application will be accessible at `http://localhost:8080`.

To stop the container, run:
```sh
docker-compose down