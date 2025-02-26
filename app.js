const puppeteer = require('puppeteer');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const cors = require('cors');
const path = require('path');
const sleep = ms => new Promise(res => setTimeout(res, ms));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Authentication uchun
const AUTH_KEY = "4C445AF6BC4B387F162CF83316EE4";
const AUTH_ENABLED = true;

// Authentication middleware
function authMiddleware(req, res, next) {
  if (!AUTH_ENABLED) {
    return next();
  }
  
  const authKey = req.params.authKey || req.query.auth;
  
  if (!authKey || authKey !== AUTH_KEY) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized. Invalid or missing authentication key."
    });
  }
  
  next();
}

// Ma'lumotlar bazasini yaratish
async function setupDatabase() {
  const db = await open({
    filename: path.join(__dirname, 'player_data.db'),
    driver: sqlite3.Database
  });
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      charac_name TEXT,
      openid TEXT,
      zoneid TEXT,
      timestamp TEXT
    )
  `);
  
  return db;
}

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browserInstance;
}

function decodePlayerName(encodedName) {
  try {
    return decodeURIComponent(encodedName);
  } catch (error) {
    console.error('Error decoding player name:', error);
    return encodedName;
  }
}

async function acceptCookies(page) {
  try {
    const cookiesSelector = "#root > div > div.PopCookie_pop_mode_box__WhyPT.PopCookie_c_pop__4PD8p.undefined.PopCookie_active__UWi7E > div.PopCookie_btn_wrap_block__26ldQ > div:nth-child(1) > div > div > div > div";
    const cookiesButton = await page.$(cookiesSelector);
    
    if (cookiesButton) {
      console.log('Cookies dialog found. Accepting...');
      await cookiesButton.click();
      await page.sleep(1000);
    }
  } catch (e) {
    console.log('No cookies dialog found or already accepted');
  }
}

// reklamani yopish
async function closeAds(page) {
  const adSelectors = [
    "#root > div.App.app-wrap__relative > div.PatFacePopWrapper_visa-card-pat-face-pop__PTPdF > div > div.PatFacePopWrapper_close-btn__erWAb",
    "#root > div > div.PopGetPoints_getPoints_pop__LVJvS.PopGetPoints_active__xuX7w > div.PopGetPoints_close__L1oSl.i-midas\\:close.icon",
    "#root > div > div.PatFacePopWrapper_visa-card-pat-face-pop__PTPdF > div > div.PatFacePopWrapper_close-btn__erWAb"
  ];
  
  console.log('Reklamalarni tekshirish va yopish...');
  
  for (const selector of adSelectors) {
    try {
      const adCloseButton = await page.$(selector);
      
      if (adCloseButton) {
        console.log(`Reklama topildi: ${selector}. Yopish...`);
        await adCloseButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log(`Bu turdagi reklama topilmadi: ${selector}`);
    }
  }
  
  console.log('Reklamalarni yopish jarayoni tugadi.');
}

// player info olish
async function getPlayerInfo(playerId) {
  const db = await setupDatabase();
  
  try {
    // bazani tekshirish
    console.log(`Looking for player ID ${playerId} in local database...`);
    const localPlayer = await db.get('SELECT * FROM players WHERE id = ?', playerId);
    
    if (localPlayer) {
      console.log(`Player ID ${playerId} found in local database!`);
      return {
        success: true,
        id: localPlayer.id,
        charac_name: localPlayer.charac_name,
        openid: localPlayer.openid,
        zoneid: localPlayer.zoneid,
        timestamp: localPlayer.timestamp,
        source: 'database'
      };
    }
    
    console.log(`Player ID ${playerId} not found in local database. Searching on website...`);
    
    // websitedan olish
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    // viewport
    await page.setViewport({ width: 1366, height: 768 });
    
    // player data olish uchun getCharac so'rovini ushlash
    let playerData = null;
    page.on('response', async response => {
      if (response.url().includes('getCharac')) {
        try {
          const responseText = await response.text();
          console.log('getCharac response:', responseText);
          
          const responseData = JSON.parse(responseText);
          if (responseData.ret === 0 && responseData.info) {
            // Store player data and decode name
            playerData = responseData.info;
            
            // Decode UTF-8 encoded name
            if (playerData.charac_name) {
              playerData.charac_name = decodePlayerName(playerData.charac_name);
            }
            
            console.log('Player data retrieved from getCharac:', playerData);
          }
        } catch (e) {
          console.error('Response parsing error:', e);
        }
      }
    });
    
    // saytga kirish
    console.log('Navigating to website...');
    await page.goto('https://www.midasbuy.com/midasbuy/us/buy/pubgm', {
      waitUntil: 'domcontentloaded', //content yuklanishini kutish
      timeout: 60000
    });
    
    // Handle cookies consent
    await acceptCookies(page);
    
    // Wait for a key element that indicates the page is interactive
    console.log('Waiting for page to be interactive...');
    const bannerSelector = '.Banner_banner_wrap__vQSMq';
    await page.waitForSelector(bannerSelector, { timeout: 30000 });
    
    // Close ads
    await closeAds(page);
    
    console.log('Page loaded. Looking for ID change button...');
    
    // ID change button selectors
    const idButtonSelectors = [
      '#root > div > div.Banner_banner_wrap__vQSMq > div.Banner_x_main__EmLds > div > div.Banner_area_wrap__UCAMc > div.Banner_user_tab_box__Bp6NY > div > div > div.UserTabBox_user_head__65f05 > span',
      '#root > div.App.app-wrap__relative > div.Banner_banner_wrap__vQSMq > div.Banner_x_main__EmLds > div > div.Banner_area_wrap__UCAMc > div.Banner_user_tab_box__Bp6NY > div > div > div.UserTabBox_user_head__65f05 > span',
      '#root > div > div.Banner_banner_wrap__vQSMq > div.Banner_x_main__EmLds > div > div.Banner_area_wrap__UCAMc > div.Banner_user_tab_box__Bp6NY > div > div > div',
      '.Banner_user_tab_box__Bp6NY .UserTabBox_user_head__65f05',
      '[class*="user_head"]'
    ];
    
    // Try each button selector
    let idChangeButton = null;
    let buttonFound = false;
    
    for (const selector of idButtonSelectors) {
      try {
        console.log(`Looking for button: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        idChangeButton = await page.$(selector);
        
        if (idChangeButton) {
          console.log(`ID change button found: ${selector}`);
          buttonFound = true;
          break;
        }
      } catch (e) {
        console.log(`Button not found with selector: ${selector}`);
        continue;
      }
    }
    
    if (!buttonFound) {
      console.error('ID change button not found with selectors! Trying JavaScript click...');
      
      // Agar tugma topilmasa, JavaScript orqali bosishga harakat qilamiz
      try {
        // Tugmani turli usullar bilan topishga harakat qilish
        await page.evaluate(() => {
          // 1-usul: class nomi bo'yicha
          const switchButtons = document.querySelectorAll('.UserTabBox_switch_btn__428iM');
          if (switchButtons.length > 0) {
            switchButtons[0].click();
            return true;
          }
          
          // 2-usul: icon elementi bo'yicha
          const iconElements = document.querySelectorAll('i.i-midas\\:switch');
          if (iconElements.length > 0) {
            iconElements[0].click();
            return true;
          }
          
          // 3-usul: Barcha span elementlarini tekshirish
          const allSpans = document.querySelectorAll('span');
          for (const span of allSpans) {
            if (span.className && span.className.includes('switch_btn')) {
              span.click();
              return true;
            }
          }
          
          return false;
        });
        
        console.log('JavaScript click attempted');
        // JavaScript click dan so'ng kutish
        await page.waitForTimeout(1000);
        
        // ID input form paydo bo'lganligini tekshirish
        const popupSelector = '.BindLoginPop_pop_mode_box__rQwbx.BindLoginPop_active__xl7ac';
        const popupVisible = await page.$(popupSelector);
        
        if (popupVisible) {
          console.log('Login popup appeared after JavaScript click!');
          buttonFound = true;
        } else {
          // Screenshot olish
          await page.screenshot({ path: 'button-not-found.png' });
          console.log('Taking screenshot for debugging...');
        }
      } catch (e) {
        console.error('JavaScript click failed:', e);
      }
    }

    if (!buttonFound) {
      console.error('ID change button not found with any method!');
      await page.screenshot({ path: 'error-screenshot.png' });
      throw new Error('ID change button not found');
    }
    
    console.log('ID change button clicked or popup triggered successfully');
    
    console.log('Clicking ID change button...');
    await idChangeButton.click();
    
    // Wait for ID input form
    console.log('Waiting for ID input form...');
    const idInputSelectors = [
      '#root > div > div.BindLoginPop_pop_mode_box__rQwbx.BindLoginPop_m_pop__xNR-M.BindLoginPop_active__xl7ac > div.BindLoginPop_pop_mess__8gYyc > div.BindLoginPop_login_box__cCh9l > div.BindLoginPop_login_channel_box__n1AuR > div > div > div > input[type=text]',
      '#root > div > div.BindLoginPop_pop_mode_box__rQwbx.BindLoginPop_m_pop__xNR-M.BindLoginPop_active__xl7ac > div.BindLoginPop_pop_mess__8gYyc > div.BindLoginPop_login_box__cCh9l > div.BindLoginPop_login_channel_box__n1AuR > div > div > div',
      '.BindLoginPop_login_channel_box__n1AuR input[type=text]',
      '[class*="login_channel_box"] input'
    ];
    
    let idInput = null;
    for (const selector of idInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        idInput = await page.$(selector);
        if (idInput) {
          console.log(`ID input found: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`ID input not found with selector: ${selector}`);
        continue;
      }
    }
    
    if (!idInput) {
      await page.screenshot({ path: 'error-id-input.png' });
      throw new Error('ID input field not found');
    }
    
    // Clear existing ID
    console.log('Clearing existing ID...');
    try {
      // Usul 1: Click uchun selectAll + backspace
      await idInput.click({ clickCount: 3 }); // Barcha matnni tanlash
      await idInput.press('Backspace');
      
      // Usul 2: Agar birinchi usul ishlamasa, JavaScript bilan tozalash
      await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
        }
      }, idInputSelectors[0]);
      
      // Usul 3: Keyboard shortcuts
      await idInput.focus();
      await page.keyboard.down('Control');
      await page.keyboard.press('a'); // Ctrl+A = Select All
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      
      // Bir oz kutish
      await page.waitForTimeout(500);
      
      // Tekshirish: agar maydon bo'sh bo'lmasa, to'g'ridan-to'g'ri value o'rnatamiz
      const inputValue = await page.evaluate(el => el.value, idInput);
      if (inputValue && inputValue.length > 0) {
        console.log(`Input field still contains text: ${inputValue}, using direct setValue method...`);
        await page.evaluate((el) => { el.value = ''; }, idInput);
      }
    } catch (e) {
      console.error('Error clearing input field:', e);
    }
    
    // Enter new ID
    console.log(`Entering new ID: ${playerId}`);
    await idInput.type(playerId);
    
    // Click OK button
    console.log('Clicking OK button...');
    const okButtonSelectors = [
      '#root > div.App.app-wrap__relative > div.BindLoginPop_pop_mode_box__rQwbx.BindLoginPop_m_pop__xNR-M.BindLoginPop_active__xl7ac > div.BindLoginPop_pop_mess__8gYyc > div.BindLoginPop_login_box__cCh9l > div.BindLoginPop_btn_wrap__eiPwz > div > div',
      '#root > div > div.BindLoginPop_pop_mode_box__rQwbx.BindLoginPop_m_pop__xNR-M.BindLoginPop_active__xl7ac > div.BindLoginPop_pop_mess__8gYyc > div.BindLoginPop_login_box__cCh9l > div.BindLoginPop_btn_wrap__eiPwz > div > div > div > div',
      '.BindLoginPop_btn_wrap__eiPwz div',
      '[class*="btn_wrap"] div'
    ];
    
    let okButton = null;
    for (const selector of okButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        okButton = await page.$(selector);
        if (okButton) {
          console.log(`OK button found: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`OK button not found with selector: ${selector}`);
        continue;
      }
    }
    
    if (!okButton) {
      await page.screenshot({ path: 'error-ok-button.png' });
      throw new Error('OK button not found');
    }
    
    await okButton.click();
    
    // Wait for response
    console.log('Waiting for response...');
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
    
    // Try to get player data from page if network request failed
    if (!playerData) {
      console.log('Player data not found in network request. Trying to extract from page...');
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'player-screen.png' });
      
      // Try various selectors for player name
      const playerNameSelectors = [
        '.player-name',
        '.name',
        '.nickname',
        '.player-info .name',
        '[class*="player"] [class*="name"]',
        '[class*="nickname"]'
      ];
      
      let playerName = null;
      for (const selector of playerNameSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          const element = await page.$(selector);
          if (element) {
            playerName = await page.evaluate(el => el.textContent, element);
            if (playerName) {
              console.log(`Player name found (${selector}): ${playerName}`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      if (playerName) {
        playerData = {
          charac_name: playerName.trim() || 'Unknown',
          openid: 'unknown',
          zoneid: 'unknown'
        };
        console.log('Player data extracted from page:', playerData);
      } else {
        console.log('Player name not found.');
        await page.screenshot({ path: 'player-not-found.png' });
      }
    }
    
    // Save to database
    if (playerData) {
      console.log('Player data found. Saving to database...');
      const timestamp = new Date().toISOString();
      await db.run(
        'INSERT INTO players (id, charac_name, openid, zoneid, timestamp) VALUES (?, ?, ?, ?, ?)',
        [playerId, playerData.charac_name, playerData.openid || 'unknown', playerData.zoneid || 'unknown', timestamp]
      );
      
      await page.close();
      
      return {
        success: true,
        id: playerId,
        charac_name: playerData.charac_name,
        openid: playerData.openid || 'unknown',
        zoneid: playerData.zoneid || 'unknown',
        timestamp: timestamp,
        source: 'website'
      };
    } else {
      await page.close();
      throw new Error('Player data could not be retrieved');
    }
  } catch (error) {
    console.error('Error:', error);
    return { 
      success: false,
      error: error.message 
    };
  } finally {
    await db.close();
  }
}

// O'yinchi ma'lumotlarini olish
app.get('/api/player/:id/:authKey?', authMiddleware, async (req, res) => {
  try {
    const playerId = req.params.id;
    if (!playerId || !/^\d+$/.test(playerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID. Please provide a numeric ID.'
      });
    }
    
    console.log(`Player ma'lumotlari so'raldi: ${playerId}`);
    const playerInfo = await getPlayerInfo(playerId);
    res.json(playerInfo);
  } catch (error) {
    console.error('Request handling error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Barcha o'yinchilar ro'yxatini olish
app.get('/api/players/:authKey?', authMiddleware, async (req, res) => {
  try {
    const db = await setupDatabase();
    const players = await db.all('SELECT * FROM players ORDER BY timestamp DESC');
    await db.close();
    
    res.json({
      success: true,
      count: players.length,
      players
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      error: 'Database error'
    });
  }
});

// O'yinchini o'chirish
app.delete('/api/player/:id/:authKey?', authMiddleware, async (req, res) => {
  try {
    const playerId = req.params.id;
    if (!playerId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid player ID'
      });
    }
    
    const db = await setupDatabase();
    await db.run('DELETE FROM players WHERE id = ?', playerId);
    await db.close();
    
    res.json({
      success: true,
      message: `Player with ID ${playerId} has been deleted`
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Boshlang'ich sahifa yaratish
app.get('/', (req, res) => {
  // Agar index.html fayli mavjud bo'lmasa, uni yaratamiz
  const indexPath = path.join(__dirname, 'public', 'index.html');
  // Standart UI html kodni qaytarish
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PUBG Mobile Player Info</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: #4a76a8;
          text-align: center;
        }
        .search-container {
          display: flex;
          margin: 20px 0;
        }
        input {
          flex: 1;
          padding: 10px;
          font-size: 16px;
          border: 1px solid #ddd;
          border-radius: 4px 0 0 4px;
        }
        button {
          background: #4a76a8;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
          border-radius: 0 4px 4px 0;
        }
        button:hover {
          background: #3a5b8c;
        }
        .result {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 4px;
          margin-top: 20px;
          border: 1px solid #ddd;
          display: none;
        }
        .player-info {
          margin-top: 10px;
        }
        .loading {
          text-align: center;
          font-style: italic;
          color: #666;
          display: none;
        }
        .player-list {
          margin-top: 40px;
        }
        .player-item {
          padding: 10px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
        }
        .player-item:last-child {
          border-bottom: none;
        }
        .error {
          color: red;
          font-weight: bold;
        }
        .delete-btn {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 2px 8px;
          font-size: 12px;
          cursor: pointer;
          border-radius: 4px;
          margin-left: 10px;
        }
        .delete-btn:hover {
          background: #c0392b;
        }
      </style>
    </head>
    <body>
      <h1>PUBG Mobile Player Info API</h1>
      
      <div class="search-container">
        <input type="text" id="player-id" placeholder="Enter PUBG Mobile Player ID">
        <button id="search-button">Search</button>
      </div>
      
      <div class="loading" id="loading">
        Searching for player... This may take a moment.
      </div>
      
      <div class="result" id="result">
        <h2>Player Information</h2>
        <div id="player-info" class="player-info"></div>
      </div>
      
      <div class="player-list" id="player-list">
        <h2>Cached Players</h2>
        <div id="players-container"></div>
      </div>
      
      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const searchButton = document.getElementById('search-button');
          const playerIdInput = document.getElementById('player-id');
          const resultDiv = document.getElementById('result');
          const playerInfoDiv = document.getElementById('player-info');
          const loadingDiv = document.getElementById('loading');
          const playersContainer = document.getElementById('players-container');
          
          // Saqlangan o'yinchilar ro'yxatini olish
          fetchCachedPlayers();
          
          // Qidiruv tugmasini bosganda
          searchButton.addEventListener('click', searchPlayer);
          
          // Enter bosish orqali qidirish
          playerIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              searchPlayer();
            }
          });
          
          // O'yinchini qidirish funksiyasi
          async function searchPlayer() {
            const playerId = playerIdInput.value.trim();
            
            if (!playerId) {
              alert('Please enter a player ID');
              return;
            }
            
            if (!/^\\d+$/.test(playerId)) {
              alert('Please enter a valid numeric ID');
              return;
            }
            
            // Qidiruv boshlanganini ko'rsatish
            loadingDiv.style.display = 'block';
            resultDiv.style.display = 'none';
            
            try {
              // API so'rovi
              const response = await fetch(\`/api/player/\${playerId}\`);
              const data = await response.json();
              
              // Natijani ko'rsatish
              resultDiv.style.display = 'block';
              loadingDiv.style.display = 'none';
              
              if (data.success === false) {
                playerInfoDiv.innerHTML = \`<p class="error">Error: \${data.error}</p>\`;
              } else {
                playerInfoDiv.innerHTML = \`
                  <p><strong>Player ID:</strong> \${data.id}</p>
                  <p><strong>Nickname:</strong> \${data.charac_name}</p>
                  <p><strong>Open ID:</strong> \${data.openid}</p>
                  <p><strong>Zone ID:</strong> \${data.zoneid}</p>
                  <p><strong>Data Source:</strong> \${data.source}</p>
                  <p><strong>Timestamp:</strong> \${new Date(data.timestamp).toLocaleString()}</p>
                \`;
                
                // Ro'yxatni yangilash
                fetchCachedPlayers();
              }
            } catch (error) {
              loadingDiv.style.display = 'none';
              resultDiv.style.display = 'block';
              playerInfoDiv.innerHTML = \`<p class="error">Error: \${error.message}</p>\`;
            }
          }
          
          // Saqlangan o'yinchilar ro'yxatini olish
          async function fetchCachedPlayers() {
            try {
              const response = await fetch('/api/players');
              const data = await response.json();
              
              if (data.success) {
                playersContainer.innerHTML = '';
                
                if (data.players.length === 0) {
                  playersContainer.innerHTML = '<p>No players in cache yet.</p>';
                  return;
                }
                
                data.players.forEach(player => {
                  const playerElement = document.createElement('div');
                  playerElement.className = 'player-item';
                  playerElement.innerHTML = \`
                    <div>
                      <strong>\${player.charac_name}</strong> (ID: \${player.id})
                    </div>
                    <div>
                      \${new Date(player.timestamp).toLocaleString()}
                      <button class="search-again" data-id="\${player.id}">Search Again</button>
                      <button class="delete-btn" data-id="\${player.id}">Delete</button>
                    </div>
                  \`;
                  playersContainer.appendChild(playerElement);
                });
                
                // "Search Again" tugmalarini ishlatish
                document.querySelectorAll('.search-again').forEach(button => {
                  button.addEventListener('click', () => {
                    const id = button.getAttribute('data-id');
                    playerIdInput.value = id;
                    searchPlayer();
                  });
                });
                
                // "Delete" tugmalarini ishlatish
                document.querySelectorAll('.delete-btn').forEach(button => {
                  button.addEventListener('click', async () => {
                    const id = button.getAttribute('data-id');
                    if (confirm(\`Are you sure you want to delete player with ID: \${id}?\`)) {
                      try {
                        const response = await fetch(\`/api/player/\${id}\`, {
                          method: 'DELETE'
                        });
                        const data = await response.json();
                        if (data.success) {
                          fetchCachedPlayers(); // Refresh the list
                        } else {
                          alert(\`Error: \${data.error}\`);
                        }
                      } catch (error) {
                        alert(\`Error: \${error.message}\`);
                      }
                    }
                  });
                });
              }
            } catch (error) {
              console.error('Error fetching cached players:', error);
            }
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Serverni ishga tushirish
app.listen(PORT, () => {
  console.log(`Server ${PORT} portida ishlamoqda!`);
  console.log(`Brauzerda ko'rish uchun: http://localhost:${PORT}`);
});

// Dastur yopilayotganda browser instanceni yopish
process.on('SIGINT', async () => {
  console.log('Dastur yopilmoqda...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit();
});