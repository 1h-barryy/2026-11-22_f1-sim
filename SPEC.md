## Little Life — Spec

A simple, playful, intuitive， AI-powered life tracker.

## The Idea

I want to build a mobile app that helps me organize some
everyday task. I mainly want it to do 2 feature: financial ledger and to do tracker.

I also want this app to feel intuitive and playful.


## Core Concept

Voice input to ai and then for ledger and to do tracker.

Ledger and To to do tracker should be on a seperate page.

### 1. Home — AI Input

TThe home screen will mainly be an AI input box.

For example, I can say "I spent $20 on groceries today" or "I need to finish my homework tomorrow," and the AI will create the corresponding record or task.

Users can confirm or edit the result before saving it.

I also want to add speech-to-text so I don't have to manually type everything.


### 2. Life Dashboard

For now, I'm thinking about two sections.

Ledger / Finance

- Track expenses
- View spending history by date
- See how much I spent this month

To-do / Planner

- Add tasks from Home and to do page
- View upcoming tasks, sorted by due date
- Check off completed tasks
- Keep track of what's finished

I like the idea of checking off tasks.

I want that interaction to feel satisfying, with animations and visual feedback.


## UX / Interaction

I want this app to feel intuitive, playful, minimal, and practical.

Ideally, users should be able to open the app and know how to use it without a tutorial.


## Acceptance Criteria

The app should have three main tabs: Home, Ledger, and To-do. Home is where the user interacts with the AI and adds things to either Ledger or To-do.

All AI parsing and speech-to-text should go through the backend. No API key should be stored in the app itself. For now, we are using USD and the local date on the phone.

### Navigation

- The app should always start on Home.
- The user can switch between the three tabs using the bottom navigation bar. The current tab should be visually clear.
- Switching between pages should be quick (within 1 second) and should not clear anything the user has already typed.

### Home

- A simple text input with a Send button and a microphone button. The placeholder should give the user an idea of what they can type.
- The user should not be able to send an empty input or send the same request multiple times while the AI is processing it.
- The user can either type or use voice input. Tapping the microphone starts recording, and tapping it again stops recording. There should be a clear visual difference when recording.
- Voice input should be converted into text that the user can edit before sending. It should not automatically submit anything.
- If the microphone is unavailable or permission is denied, the user should still be able to type or use keyboard dictation.

### AI and Confirmation

The main idea is that the user can describe something naturally without having to manually fill out a form every time.

For example:

- "I spent $20 on groceries today" should become an expense with the amount, category, and date.
- "I need to finish my homework tomorrow" should become a task with a title and a due date.

The AI should show what it understood before actually saving anything.

- The user should be able to edit everything in the confirmation card, including whether it is an expense or a task.
- Saving should add the item to the corresponding page, clear the input, and give the user some feedback.
- Canceling should close the card without saving or clearing the original input.
- If the AI cannot understand the input or the backend is unavailable, the user should still be able to manually enter the information.
- Expense categories come from a fixed list: Food, Groceries, Transport, Shopping, Bills, Fun, Other.

### Ledger

- Show the total spending for the current month at the top.
- Expenses should be grouped by date, with the most recent ones first.
- Each expense should show its category, note, and amount.
- Newly added expenses should immediately appear in the correct date group and update the monthly total.
- The user can long-press an expense to delete it after confirming.
- If there are no expenses yet, show a simple empty state that directs the user back to Home.

### To-do

- Separate unfinished and completed tasks into Upcoming and Done.
- Upcoming tasks should be organized by their due dates.
- Due dates should be easy to understand, using Today, Tomorrow, or the actual date. Overdue tasks should be visually different.
- I want checking off a task to feel satisfying. There should be a small animation, a strikethrough, and light haptic feedback before the task moves to Done (within 1 second).
- The user should also be able to uncheck a completed task.
- Similar to Ledger, the user can long-press to delete a task after confirming.
- There should be a simple empty state when there are no tasks.
- I can also add a task directly on the To-do page with a + button, without going through Home. It should use the same form as the confirmation card on Home.
- Tapping a task opens it so I can edit its title and due date, or delete it.


### Data and Security

- All expenses, tasks, and task completion states should still be there after closing and reopening the app, including force-quitting Expo Go.
- If there is a problem loading the saved data, the app should start with empty lists instead of crashing.
- API keys should only exist on the backend and should never be committed to the repository. In development, the app calls the API routes on the Expo dev server. A deployed build sets the server origin in app.json.

### Visual and Interaction

I want the app to feel intuitive, lightweight, and a little playful. It should feel more like a small everyday tool rather than a complicated productivity or financial management app.

- Keep the colors, typography, and spacing consistent across all three pages using a shared theme.
- Text should be easy to read (at least 15pt for body text).
- Make sure everything works within the iPhone's safe areas.
- Keep interactions simple and provide clear feedback when something is loading, saved, completed, or when something goes wrong.
