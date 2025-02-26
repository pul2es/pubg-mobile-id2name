# PUBG Mobile Player Info API

A convenient service for searching and storing PUBG Mobile player information by ID.

![PUBG Mobile Player API](https://imgur.com/placeholder/400/200)

## Features

- Search for PUBG Mobile player information by ID
- Automatically store player information in a local database
- View information about previously searched players
- User-friendly and simple interface
- API access to search results

## Installation

To run the project, follow these steps:

1. Clone the repository:
```bash
git clone https://github.com/your-github-username/pubg-mobile-player-info.git
cd pubg-mobile-player-info
```

2. Install the required libraries:
```bash
npm install
```

3. Start the server:
```bash
node app.js
```

4. Open in your browser:
```
http://localhost:3000
```

## Usage

### Through the web interface
- Enter the player ID and click the "Search" button
- Player information will be displayed and automatically saved in the local database
- You can search again for players from the saved list

### Using the API

#### Get player information
```
GET /api/player/:id
```

Example:
```
GET /api/player/5678912345
```

#### Get a list of all saved players
```
GET /api/players
```

#### Delete a player
```
DELETE /api/player/:id
```

## Authentication

The project includes a simple authentication mechanism for API requests. You can add an authentication key when making API requests:

```
GET /api/player/:id/:authKey
GET /api/players/:authKey
DELETE /api/player/:id/:authKey
```

Default authentication key: `4C445AF6BC4B387F162CF83316EE4`

## Technologies

The project uses the following technologies:

- Node.js
- Express.js - for API and server
- Puppeteer - for scraping data from websites
- SQLite - local database
- HTML/CSS/JavaScript - for the user interface

## Development

The project can be developed in the following directions:

- Adding new features
- Bug fixes
- Code optimization
- Performance improvements

## License

MIT
