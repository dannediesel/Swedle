# Swedle

Swedle is a full-stack web application inspired by attribute-based guessing games.  
The goal is to identify a hidden Swedish national football team player by submitting guesses and using feedback from previous attempts.

The application will be designed as an interactive multi-user system with persistent backend storage, user accounts, saved game sessions, statistics, and an admin interface for managing player data and daily challenges.

## Functional specification

### Main idea
Each day, the system selects one hidden player.  
The user guesses by entering a player name in an input field with autocomplete support.  
After each guess, the application presents feedback for a set of player attributes to help the user narrow down the correct answer.

Example attributes include:

- Club
- Shirt number
- Position
- Birth year
- Dominant foot
- Caps
- Goals

For each guess, the system indicates whether an attribute is correct, incorrect, or higher/lower when relevant with the colors green, red or yellow/orange when partially correct and arrows up and down for numerical values.

### User functionality
A registered user can:

- create an account
- log in and log out
- play the daily challenge
- search for players using autocomplete
- submit guesses
- view feedback after each guess
- view personal statistics
- view previous results
- view the leaderboard

### Admin functionality
An administrator can:

- add players
- edit player data
- remove players
- set the daily player

### MVP
The first version of the project will include:

- authentication
- one daily challenge
- autocomplete-based guess input
- attribute-based feedback after each guess
- persistent storage of guesses and sessions
- personal statistics
- leaderboard
- basic admin panel

## Technological specification

### Frontend
The frontend will be built with:

- React
- TypeScript
- Vite
- React Router

The frontend is responsible for:

- rendering the game interface
- handling user input
- displaying autocomplete suggestions
- showing guess history and feedback
- presenting statistics and leaderboard data

### Backend
The backend will be built with:

- Node.js
- Express
- TypeScript

The backend is responsible for:

- authentication
- user management
- guess validation
- session handling
- statistics calculation
- leaderboard generation
- admin functionality
- database access

### Database
The project will use:

- PostgreSQL
- Prisma ORM

Planned core entities:

- User
- Player
- DailyChallenge
- GameSession
- Guess