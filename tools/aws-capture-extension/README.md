# AWS Learning Capture

Load this folder once at `chrome://extensions` with **Developer mode → Load unpacked**.

- On a Udemy lesson, press `` ` `` to capture the largest visible video frame.
- In fullscreen, the full visible player is captured.
- The image is added to **http://localhost:8788 → Nhập ảnh**. If that tab is not open, the extension opens it in the background.

Chrome shows broad site access because `captureVisibleTab` requires `<all_urls>`; the extension's content script itself only runs on Udemy and the local AWS Learning page.

After editing the unpacked extension, click its reload button once at `chrome://extensions`.
