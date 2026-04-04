<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c1a2ce94-c302-48d8-b502-1e2f8b9c533a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Developer mode (for feature testing)

- In local development (`npm run dev`), a `DEV` button is shown in the top-right header.
- Click it to open the in-app developer panel for quick battle setup, resource injection, and reward-screen testing.
- To force-enable this panel in other environments, set `VITE_ENABLE_DEVTOOLS=1`.
