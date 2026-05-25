# AI Diary

AI tools used: ChatGPT free / Claude free / Gemini

### [Date] - requestAnimationFrame giving wrong delta time

**What I asked the AI:** I asked why my snake moved faster on some screens than others.
**What it gave me:** It suggested using `requestAnimationFrame` but did not explain how frame timing affects movement.
**What was wrong:** My movement was tied directly to frame count, so high refresh rate monitors made the snake faster.
**How I fixed it:** I moved authoritative movement to the server tick and kept the browser render loop for drawing only.
**Time lost:** ~25 minutes

### [Date] - Bot snakes spinning in place

**What I asked the AI:** I asked for bot AI that could find food and avoid stronger snakes.
**What it gave me:** The first version snapped the bot angle directly to each target every tick.
**What was wrong:** Bots kept switching targets and rotating too sharply, which made them spin in circles.
**How I fixed it:** I added ROAM / EAT / EVADE states and rotated toward the target by only 3 degrees per tick.
**Time lost:** ~35 minutes

### [Date] - WebSocket reconnection not clearing old snake state

**What I asked the AI:** I asked how to reconnect after a game over.
**What it gave me:** It reused the same client object without clearing old snake and food data.
**What was wrong:** The canvas showed dead snakes from the previous round after reconnecting.
**How I fixed it:** I reset the client state on every `init` message and used a `respawn` event for restarting without refresh.
**Time lost:** ~30 minutes

### [Date] - Canvas coordinate system wrong after camera translation

**What I asked the AI:** I asked why the leaderboard moved around when the camera followed the snake.
**What it gave me:** It drew everything after calling `ctx.translate`.
**What was wrong:** The HUD was being drawn in world coordinates instead of screen coordinates.
**How I fixed it:** I used `ctx.save()` before translating the world and `ctx.restore()` before drawing the HUD.
**Time lost:** ~20 minutes

### [Date] - localStorage returning null on first load

**What I asked the AI:** I asked why the high score displayed as `null`.
**What it gave me:** It read directly from `localStorage.getItem('slither_highscore')`.
**What was wrong:** On the first visit there is no saved value, so `getItem` returns `null`.
**How I fixed it:** I used a fallback value of `0` and converted the saved score with `Number(...)` before comparing.
**Time lost:** ~10 minutes
