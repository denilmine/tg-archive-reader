# tg-archive-reader

A local web interface for viewing exported Telegram chats from ZIP archives. Works entirely in the browser without sending any data to a server.

## Features

* **Privacy:** Local archive extraction and parsing using JSZip. Your data never leaves your device.
* **Media Support:** Correctly displays photos, videos, round video messages, voice messages (via a custom built-in audio player), files, and animated stickers (.tgs).
* **Performance Optimization:** Uses `content-visibility` for DOM elements and groups consecutive messages to ensure smooth scrolling even in large chats.
* **UI/UX:** Responsive design inspired by native clients, featuring light and dark themes, a fullscreen media viewer (Lightbox), and a sidebar with chat info and a media gallery.
* **Multilingual:** Built-in support for English, Russian, Ukrainian, and Polish.

## Archive Requirements

A standard chat history export from Telegram Desktop is required:
1. Open the target chat -> Menu (three dots) -> **Export chat history**.
2. Make sure the **HTML** format is selected (a folder structure is required, not a single file).
3. Check the boxes for photos, videos, and other files as needed.
4. Compress the exported folder containing `messages.html` into a **.zip** archive.

## Installation and Usage

This project does not require a build process or any package managers (Node.js/npm).

1. Clone the repository:
   ```bash
   git clone [https://github.com/denilmine/tg-archive-reader.git](https://github.com/denilmine/tg-archive-reader.git)
2. Open the index.html file in any modern web browser.
3. Drag and drop your .zip archive into the drop zone on the page.
