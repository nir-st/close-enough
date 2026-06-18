You are helping expand the trivia question bank for **Close Enough** — a multiplayer numeric guessing game where players submit a number and score points based on how close they are to the correct answer.

## What makes a GOOD question

- **The answer is a specific, verifiable number** — not a range, not an estimate, not "approximately"
- **The answer is surprising or non-obvious** — players should feel "wow, I didn't know that exactly" (e.g., the Hundred Years' War lasted 116 years, the Eiffel Tower has 1,665 steps)
- **Players can make a reasonable estimate** — they should be able to place the answer in a ballpark even without knowing exactly. Dead-guessing is not fun.
- **The thing being asked about is recognizable** — famous places, events, people, brands. Avoid obscure facts about things players won't have heard of.
- **The answer has enough magnitude** to create meaningful spread between guesses — ideally 3+ digits

## What makes a BAD question

- **Answer is too small** (under ~15) — guesses converge, no spread, not exciting. Exception: small numbers that are genuinely counterintuitive (e.g., Mars has 2 moons — people might guess 5-20)
- **Answer is negative** — no negative numbers for now
- **Trivially easy** — if almost everyone knows the exact answer, it's not interesting (e.g., degrees in a right angle = 90, planets in solar system = 8)
- **Rough estimate** — if the "correct" answer is itself debatable or changes frequently (follower counts, stock prices, population figures that shift year to year). Exception: stable population figures for major cities/countries are fine.
- **Question gives away the magnitude** — never say "in millions", "in billions", "in trillions" in the question text. This removes the fun of estimating scale.
- **Too obscure** — if the player has never heard of the subject (e.g., Lake Baikal, the ISS acronym without explanation), they can't even estimate
- **Simple mental math** — questions like "how many minutes in a week" or "degrees in a full circle" are boring

## Format rules

- Each question must have a single integer or decimal `correctAnswer`
- `difficulty`: `"easy"` (answer is known but requires memory), `"medium"` (requires estimation), `"hard"` (requires detailed knowledge)
- `categories`: array of strings — use existing categories where possible. Current categories: Geography, Sports, Records, Science, Entertainment, Food, Animals, Human Body, Distances, History, Business, Music, Technology, Buildings, Transportation, Language, Nature, Money, Population, Social Media, Energy, Military, Medicine, Gaming, Weather, Ages, Space, Math, Olympics
- `unit`: optional string shown after the answer (e.g., "km", "°C", "meters"). Omit if the unit is already in the question text or not applicable.
- IDs: `{category_snake_case}_{difficulty}_{n}` — use the next available number for that category+difficulty combo

## JSON format

```json
{
  "id": "space_medium_12",
  "categories": ["Space"],
  "difficulty": "medium",
  "text": "How many moons does Saturn have?",
  "correctAnswer": 146
}
```

## Workflow

1. User provides topic ideas or asks for suggestions across categories
2. Propose a numbered list of questions with answers — show before adding
3. User reviews, gives feedback (remove X, change Y, fix Z)
4. Apply all feedback, show updated list for final confirmation
5. Only add to `server/src/data/questions.json` after user confirms
6. After adding, check for and update `client/src/components/GameSettings.tsx` if any new categories were introduced
7. Run `git add` + `git commit` + `git push`
