const mineflayer = require('mineflayer');
const fs = require('fs');
const { default: axios } = require('axios');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed } = require('discord.js');
const { exec } = require('child_process');
const wait = require('util').promisify(setTimeout);
require('dotenv').config();
const { MCUN, MCPW, TOKEN, BROWSERLESS_TOKEN } = process.env

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

let isWorking = false;

client.once('ready', async () => {
    const data = [
        {
            name: 'matches',
            description: 'View Current Matches',
        },
        {
            name: 'stats',
            description: 'View Player\'s stats',
            options: [{
                type: 3,
                name: 'mcid',
                description: 'Enter mcid.',
                required: true
            }]
        },
        {
            name: 'namemc',
            description: 'View Player\'s name history',
            options: [{
                type: 3,
                name: 'mcid',
                description: 'Enter mcid.',
                required: true
            }]
        },
        {
            name: 'players',
            description: 'View Current Players',
        },
        {
            name: 'vote',
            description: 'Vote for map in certain vote',
            options: [{
                type: 3,
                name: 'slot',
                description: 'Enter slot number (1~9).',
                required: true
            },
            {
                type: 3,
                name: 'map',
                description: 'Enter map name',
                required: true
            }]
        }
    ];
    await client.application.commands.set(data);
    console.log('Ready');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) {
        return; 
    }
    if (interaction.commandName === 'matches') {
        if (isWorking === true) {
            await interaction.reply('Bot is busy now! Try again later!');
        } else {
            await interaction.deferReply();
            let fieldsRaw = [];
            let fieldRaw = {};
            let embedObject = {};
            const bot = mineflayer.createBot({
                host: 'play.shotbow.net',
                username: MCUN,
                password: MCPW,
                auth: 'microsoft',
                version: '1.12.2',
                viewDistance: 'tiny'
            });
            const getMatch = new Promise((resolve, reject) => {
                let reopen = false;
                isWorking = true;

                // for debug
                bot.on('kicked', console.log)
        
                bot.on('spawn', async () => {
                    setTimeout(() => {
                        reopen = false;
                        bot.setQuickBarSlot(0);
                        bot.activateItem();
                        wait(500);
                        bot.deactivateItem();
                    }, 1000);
                    console.log('spawn');
                });
        
                bot.on('windowOpen', async (window) => {
                    //console.log('window opened, 1');
                    //console.log(window.title);
                    if (window.title === '{"text":"Server Selector"}') {
                        //console.log('clicking');
                        connectAnni();
                    } else if (window.title === '{"text":"§7|§0Select Server§7|"}') {
                        if (reopen === false) {
                            reopen = true;
                            bot.closeWindow(window);
                            bot.simpleClick.rightMouse(22);
                        } else {
                            let matchList = [];
                            let matchData = {};
                            //console.log('opened anni vote menu');
                            //console.log(window.slots);
                            window.slots.map((item) => {
                                if (item !== null && item.slot < 9) {
                                    if (item.displayName === 'Lime Dye') {
                                        matchData['Joinablility'] = 'All';
                                    } else if (item.displayName === 'Light Blue Dye') {
                                        matchData['Joinablility'] = 'Premium';
                                    } else if (item.displayName === 'Gray Dye') {
                                        matchData['Joinablility'] = 'None';
                                    }
                                    let mapRaw = item.nbt.value.display.value.Lore.value.value[0];
                                    matchData['Map'] = formatMapText(mapRaw);
                                    matchData['Players'] = item.nbt.value.display.value.Lore.value.value[1];
                                    let phaseRaw = item.nbt.value.display.value.Lore.value.value[2];
                                    matchData['Phase'] = formatPhaseText(phaseRaw);
                                    if (matchData['Phase'] === 'Waiting For Players...' || matchData['Phase'].startsWith('Starts in')) {
                                        matchData['Voting'] = true;
                                    } else {
                                        matchData['Voting'] = false;
                                    }
                                    let serverRaw = item.nbt.value.display.value.Name.value;
                                    matchData['Server'] = formatServerName(serverRaw);
                                    matchData['SlotNum'] = item.slot;
                                    let matchDataCopy = {};
                                    matchList.push(Object.assign(matchDataCopy, matchData));
                                }
                            });
                            //console.log(matchList);
                            bot.end();
                            isWorking = false;
                            resolve(matchList);
                        }
                    }
                    bot.closeWindow(window);
                });
            
                function connectAnni() {
                    bot.simpleClick.leftMouse(5);
                }
        
                function formatPhaseText(phaseRaw) {
                    if (phaseRaw.startsWith('§ePhase')) {   // after Phase 3
                        phaseRaw = phaseRaw.replace('§e', '');
                    } else if (phaseRaw.startsWith('§bPhase 3')) {  // Phase 3
                        phaseRaw = phaseRaw.replace('§r (§bPremium§r join privilege)', '').replace('§b', '');
                    } else if (phaseRaw.startsWith('§aPhase')) { // before Phase 3
                        phaseRaw = phaseRaw.replace('§a', '');
                    } else if (phaseRaw === '§aPre game') { // before vote
                        phaseRaw = 'Waiting For Players...';
                    } else if (phaseRaw.startsWith('§aStarts in')) {
                        phaseRaw = phaseRaw.replace('§a', '') + ' seconds';
                    } else if (phaseRaw === '§eEnding') {
                        phaseRaw = 'Ending';
                    }
                    return phaseRaw;
                }
        
                function formatMapText(mapRaw) {
                    if (mapRaw.startsWith('Map:')) {
                        mapRaw = mapRaw.replace('Map: ', '');
                    } // add voting?
                    return mapRaw;
                }
        
                function formatServerName(serverRaw) {
                    serverRaw = serverRaw.replace('§r§n', '');
                    return serverRaw;
                }
            }).then((data) => {
                //console.log(data);
                let voteNum = 1;
                const row = new ActionRowBuilder();
                data.map((server) => {
                    let name = server['Server'];
                    let value = '';
                    if (server['Map'].startsWith('Voting:')) {
                        value = '```' + server['Map'] + '\nPlayers: ' + server['Players'] + '\nState: ' + server['Phase'] + '```';
                    } else {
                        value = '```Map:     ' + server['Map'] + '\nPlayers: ' + server['Players'] + '\nState:   ' + server['Phase'] + '```';
                    }
                    fieldRaw['name'] = voteNum + ' - ' + name;
                    fieldRaw['value'] = value;
                    let fieldCopy = {};
                    fieldsRaw.push(Object.assign(fieldCopy, fieldRaw));
                    if (server['Joinablility'] === 'All') {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId('Vote' + voteNum)
                                .setLabel(voteNum.toString())
                                .setStyle(ButtonStyle.Primary)
                        );
                    } else {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId('Vote' + voteNum)
                                .setLabel(voteNum.toString())
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    }
                    voteNum++;
                });
                embedObject = {
                    title: 'Matches',
                    fields: fieldsRaw
                };
                interaction.editReply({ embeds: [embedObject], components: [row] });
            });
                
                /*.then((data) => {
                console.log(data);
                let loopstate = true;
                const getDetail = new Promise((resolve, reject) => {
                    data.map((vote) => {
                        if (vote['Joinablility'] === 'All') {
                            bot.on('windowOpen', (window) => {
                                console.log('window opened, 2');
                                bot.simpleClick.leftMouse(vote['SlotNum']);
                            });

                            bot.once('spawn', () => {
                                console.log('spawn, 2');
                                bot.chat('/team v');
                                setTimeout(() => {
                                    bot.chat('/al');
                                    loopstate = false;
                                }, 1000);
                            });

                            bot.on('message', (message) => {
                                console.log(message.toAnsi());
                            })
                        
                            bot.simpleClick.leftMouse(22);
                            loopstate = true;
                            while(loopstate){}
                        }
                    });
                })
            })*/
        }
    }

    if (interaction.commandName === 'stats') {
        await interaction.deferReply();
        const username = interaction.options.getString('mcid');

        data = {
            url: "https://shotbow.net/forum/stats/annihilation/" + username,
            elements: [
                {
                    selector: "td.gamestats-playertable-avatar>img"
                },
                {
                    selector: "td.gamestats-playertable-time"
                },
                {
                    selector: "td.gamestats-playertable-WL>strong"
                },
                {
                    selector: "td.gamestats-playertable-stat-total"
                }
            ],
            gotoOptions: {
                timeout: 10000,
                waitUntil: "networkidle0"
            }
        };
        await axios.post('https://chrome.browserless.io/scrape?token=' + BROWSERLESS_TOKEN, data).then((res) => {
            let headurl = 'https:' + res.data['data'][0]['results'][0]['attributes'][2]['value'];
            let playtime = res.data['data'][1]['results'][0]['html'];
            let winlose = res.data['data'][2]['results'][0]['html'];
            let bowkills = res.data['data'][3]['results'][1]['html'];
            let meleekills = res.data['data'][3]['results'][2]['html'];
            let nexusdmg = res.data['data'][3]['results'][3]['html'];
            let oremined = res.data['data'][3]['results'][4]['html'];

            const formattedPT = playtime.replace('Time Played:\n', '').replace('\n', '');
            const playTimeList = formattedPT.match(/[0-9]+/g);
            const playTimeHours = parseInt(playTimeList[0]) * 24 + parseInt(playTimeList[1]);

            const winloseList = winlose.match(/[0-9]+/g);
            const winrate = Math.round((parseInt(winloseList[0]) / (parseInt(winloseList[0]) + parseInt(winloseList[1]))) * 1000) / 10;

            const url = 'https://shotbow.net/forum/stats/annihilation/' + username;

            const embedObject = new EmbedBuilder()
            .setTitle('Annihilation Stats')
            .setAuthor({ name: username + '\'s Stats', url: url })
            .setThumbnail(headurl)
            .addFields(
                { name: 'PlayTime', value: playTimeHours.toString() + ' hours' },
                { name: 'Win - Lose', value: winlose.replace(':', ' - ') + '\nWin Rate: ' + winrate + '%' },
                { name: 'Kills', value: 'Melee Kills: ' + meleekills + '\nBow Kills: ' + bowkills },
                { name: 'Other Stats', value: 'Nexus Damages: ' + nexusdmg + '\nOres Mined: ' + oremined }
            )
            .setFooter({ text: 'Info from Shotbow.net', iconURL: 'https://shotbow.net/forum/styles/fusiongamer/xenforo/avatars/avatar_l.png' });
            interaction.editReply({embeds: [embedObject]});
        });

        /*
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        const url = 'https://shotbow.net/forum/stats/annihilation/' + username;
        await page.goto(url, { waitUntil: 'networkidle0' });
        data = await page.evaluate(() => {
            let headurl = document.querySelector('td.gamestats-playertable-avatar>img').src;
            let playtime = document.querySelector('td.gamestats-playertable-time').innerHTML;
            let winlose = document.querySelector('td.gamestats-playertable-WL>strong').innerHTML;
            let statsel = document.querySelectorAll('td.gamestats-playertable-stat-total');
            let stats = [];
            statsel.forEach((element) => {
                stats.push(element.innerHTML);
            });
            return [headurl, playtime, winlose, stats];
        });
        // stats: 'Total', bow kills, melee kills, nexus damage, ore mined        
        await browser.close();

        const formattedPT = data[1].replace('Time Played:\n', '').replace('\n', '');
        const playTimeList = formattedPT.match(/[0-9]+/g);
        const playTimeHours = parseInt(playTimeList[0]) * 24 + parseInt(playTimeList[1]);

        const winloseList = data[2].match(/[0-9]+/g);
        const winrate = Math.round((parseInt(winloseList[0]) / (parseInt(winloseList[0]) + parseInt(winloseList[1]))) * 1000) / 10;

        const embedObject = new EmbedBuilder()
            .setTitle('Annihilation Stats')
            .setAuthor({ name: username + '\'s Stats', url: url })
            .setThumbnail(data[0])
            .addFields(
                { name: 'PlayTime', value: playTimeHours.toString() + ' hours' },
                { name: 'Win - Lose', value: data[2].replace(':', ' - ') + '\nWin Rate: ' + winrate + '%' },
                { name: 'Kills', value: 'Melee Kills: ' + data[3][2] + '\nBow Kills: ' + data[3][1] },
                { name: 'Other Stats', value: 'Nexus Damages: ' + data[3][3] + '\nOres Mined: ' + data[3][4] }
            )
            .setFooter({ text: 'Info from Shotbow.net', iconURL: 'https://shotbow.net/forum/styles/fusiongamer/xenforo/avatars/avatar_l.png' });
        */
    }

    if (interaction.commandName === 'namemc') {
        await interaction.deferReply();
        let username = interaction.options.getString('mcid');
        let embedString = '```';
        let embedObject;
        axios.post('https://api.mojang.com/profiles/minecraft', [username]).then((rawUUIDData) => {
            if (Object.keys(rawUUIDData.data).length === 0) {
                interaction.editReply({ content: 'Invalid MCID!' });
            } else {
                const uuid = rawUUIDData.data[0]["id"];
                username = rawUUIDData.data[0]["name"];
                axios.get('https://api.mojang.com/user/profiles/' + uuid + '/names').then((rawNameHistoryData) => {
                    for (let i = 0; i < rawNameHistoryData.data.length; i++) {
                        let mcid = rawNameHistoryData.data[i]['name'];
                        embedString += mcid;
                        embedString = insertSpace(embedString, 3);
                        let dateraw = rawNameHistoryData.data[i]['changedToAt'];
                        if (dateraw !== undefined) {
                            let date = new Date(dateraw);
                            embedString += ('Changed At ' + date.getFullYear().toString() + '/' + date.getMonth().toString() + '/' + date.getDay().toString());
                        } else {
                            embedString += 'Original MCID';
                        }
                        embedString += '\n';
                    }
                    embedString += '```';
                    embedObject = new EmbedBuilder()
                        //.setTitle('Name History')
                        .setAuthor({ name: username + '\'s Name History', url: 'https://ja.namemc.com/profile/' + uuid })
                        .setThumbnail('https://crafatar.com/avatars/' + uuid)
                        .addFields({ name: 'History', value: embedString });
                }).then(() => {
                    interaction.editReply({ embeds: [embedObject] });
                });
            }
        });
        const insertSpace = (str, num) => {
            for (let i = 0; i < num; i++) {
                str += ' ';
            }
            return str;
        }
    }

    if (interaction.commandName === 'players') {
        await interaction.deferReply();
        axios.get('https://shotbow.net/serverList.json').then((res) => {
            const allplayers = res.data['all'];
            const anni = res.data['annihilation'];
            const minez = res.data['minez'];
            const smash = res.data['smash'];
            const lobby = res.data['lobby'];
            const slaughter = res.data['slaughter'];

            const embedString = '```' + `Overall: ${allplayers}\nLobby: ${lobby}\nAnnihilation: ${anni}\nMineZ: ${minez}\nSmash: ${smash}\nSlaughter: ${slaughter}` + '```';

            const embedObject = new EmbedBuilder()
                .setAuthor({ name: 'Players on Shotbow', url: 'https://shotbow.net/serverList.json', iconURL: 'https://shotbow.net/forum/styles/fusiongamer/xenforo/avatars/avatar_l.png' })
                .addFields({ name: '\u200B', value: embedString });
            
            interaction.editReply({ embeds: [embedObject] });
        });
    }

    if (interaction.commandName === 'vote') {
        if (isWorking === true) {
            await interaction.reply('Bot is busy now! Try again later!');
        } else if (isWorking === false) {
            await interaction.deferReply();
            isWorking = true;
            const slotnum = parseInt(interaction.options.getString('slot')) - 1;
            const mapName = interaction.options.getString('map');
            /*taskString = `send /al\nwait 25\nuseitem\nwait 5\ninventory c drop ${slotnum}\nwait 50\nsend /vote ${mapName}\nwait 50\nexit`;
            fs.writeFile('./MCC/tasks.txt', taskString, (err) => {
                if (err) {
                    console.log(err);
                    interaction.editReply('Error occurred while voting for map.');
                } else {
                    if (process.platform === 'win32') {
                        exec('run.bat', (error, stdout, stderr) => {
                            if (error) {
                                console.log(error);
                                console.log(stderr);
                                interaction.editReply('Error occurred while voting for map.');
                            } else {
                                interaction.editReply('Done');
                                console.log(stdout);
                            }
                        });
                    } else if (process.platform === 'linux') {
                        exec('run.sh', (error, stdout, stderr) => {
                            if (error) {
                                console.log(error);
                                console.log(stderr);
                                interaction.editReply('Error occurred while voting for map.');
                            } else {
                                interaction.editReply('Done');
                                console.log(stdout);
                            }
                        });
                    }
                }
                isWorking = false;
            });*/
            const bot = mineflayer.createBot({
                host: 'play.shotbow.net',
                username: MCUN,
                password: MCPW,
                auth: 'microsoft',
                version: '1.12.2',
                viewDistance: 'tiny'
            });
            const getMatch = new Promise((resolve, reject) => {
                let isConnected = false;
                const voteText = '/vote ' + mapName;
                
                // for debug
                bot.on('kicked', (reason, loggedIn) => {
                    if (reason === '{"text":"Too many players joining at once! Try again in a few seconds."}') {
                        bot.end();
                        resolve('Busy');
                    }
                })
        
                bot.on('spawn', async () => {
                    setTimeout(() => {
                        bot.chat(voteText);
                        if (isConnected === false) {
                            if (bot.spawnPoint.x === 80 && bot.spawnPoint.y === 80 && bot.spawnPoint.z === 9) {
                                bot.chat('/al');
                            } else if (bot.spawnPoint.x === -1140 && bot.spawnPoint.y === 74 && bot.spawnPoint.z === -3213) {
                                bot.setQuickBarSlot(0);
                                bot.activateItem();
                                wait(500);
                                bot.deactivateItem();
                            }
                        }
                    }, 1500);
                    console.log('spawn');
                });

                bot.on('message', message => {
                    const chattext = message.getText();
                    console.log(chattext);
                    if (chattext.includes('There is no active vote right now.') === true) {
                        bot.end();
                        resolve('NoVote');
                    }
                    if (chattext.includes('Disconnected: You may only join games that are in progress if you were playing and got disconnected.') === true) {
                        bot.end();
                        resolve('Error');
                    }
                    if (chattext.includes('Unable to connect to ANNILOBBY_') === true) {
                        bot.end();
                        resolve('Error');
                    }
                })
        
                bot.on('windowOpen', (window) => {
                    console.log('window opened');
                    if (window.title === '{"text":"§7|§0Select Server§7|"}') {
                        bot.clickWindow(slotnum, 0, 0);
                        isConnected = true;
                    }
                    bot.closeWindow(window);
                });
            }).then((data) => {
                isWorking = false;
                if (data === 'Success') {
                    interaction.editReply({ content: 'Done' });
                } else if (data === 'NoVote') {
                    interaction.editReply({ content: 'No vote available for this match!' });
                } else if (data === 'Busy') {
                    interaction.editReply({ content: 'Server is busy now! Try again in a moment please!' });
                } else if (data === 'Error') {
                    interaction.editReply({ content: 'Something went wrong! Try again later!' });
                }
            });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    // TODO disable the button after pressed
    if (interaction.customId.startsWith('Vote')) {
        await interaction.deferReply();
        const slotnum = parseInt(interaction.customId.replace('Vote', ''));
        isWorking = true;
        const bot = mineflayer.createBot({
            host: 'play.shotbow.net',
            username: MCUN,
            password: MCPW,
            auth: 'microsoft',
            version: '1.12.2',
            viewDistance: 'tiny'
        });
        const getMatch = new Promise((resolve, reject) => {
            let isConnected = false;
            let playersInfo = [];
            let mapName = '';
            let nexus = {
                red: '',
                blue: '',
                yellow: '',
                green: ''
            };
            let state;
    
            // for debug
            bot.on('kicked', (reason, loggedIn) => {
                if (reason === '{"text":"Too many players joining at once! Try again in a few seconds."}') {
                    bot.end();
                    resolve('Busy');
                }
            })
    
            bot.on('spawn', async () => {
                setTimeout(() => {
                    bot.chat('/team v');
                    //console.dir(bot.scoreboard, {depth: null});
                    if (isConnected === false) {
                        if (bot.spawnPoint.x === 80 && bot.spawnPoint.y === 80 && bot.spawnPoint.z === 9) {
                            bot.chat('/al');
                        } else if (bot.spawnPoint.x === -1140 && bot.spawnPoint.y === 74 && bot.spawnPoint.z === -3213) {
                            bot.setQuickBarSlot(0);
                            bot.activateItem();
                            wait(500);
                            bot.deactivateItem();
                        }
                    }
                }, 1500);
                console.log('spawn');
            });

            bot.once('bossBarUpdated', (bossbar) => {
                state = bossbar.title.extra[0].text;
            });
    
            bot.on('message', message => {
                //console.log(message.getText());
                let chattext = message.getText();
                let players = {};
                if (/^Team\s(Red|Blue|Yellow|Green)\shas\s[0-9]{1,2}\sonline/.test(chattext)) {
                    if (chattext.startsWith('Team Red has ')) {
                        // queued
                        if (/^Team\sRed\shas\s[0-9]{1,2}\sonline,\sand\s[0-9]{1,2}\squeued\splayers/.test(chattext)) {
                            chattext = chattext.replace('Team Red has ', '').replace(' online', '').replace(' and ', '').replace(' queued players', '');
                            const playerinfo = chattext.split(',');
                            players = {
                                team: 'Red',
                                queued: true,
                                players: playerinfo[0],
                                queuedPlayers: playerinfo[1]
                            }
                        } else {
                            chattext = chattext.replace('Team Red has ', '').replace(' online players', '');
                            players = {
                                team: 'Red',
                                queued: false,
                                players: chattext
                            }
                        }
                    } else if (chattext.startsWith('Team Blue has ')) {
                        // queued
                        if (/^Team\sBlue\shas\s[0-9]{1,2}\sonline,\sand\s[0-9]{1,2}\squeued\splayers/.test(chattext)) {
                            chattext = chattext.replace('Team Blue has ', '').replace(' online', '').replace(' and ', '').replace(' queued players', '');
                            const playerinfo = chattext.split(',');
                            players = {
                                team: 'Blue',
                                queued: true,
                                players: playerinfo[0],
                                queuedPlayers: playerinfo[1]
                            }
                        } else {
                            chattext = chattext.replace('Team Blue has ', '').replace(' online players', '');
                            players = {
                                team: 'Blue',
                                queued: false,
                                players: chattext
                            }
                        }
                    } else if (chattext.startsWith('Team Green has ')) {
                        // queued
                        if (/^Team\sGreen\shas\s[0-9]{1,2}\sonline,\sand\s[0-9]{1,2}\squeued\splayers/.test(chattext)) {
                            chattext = chattext.replace('Team Green has ', '').replace(' online', '').replace(' and ', '').replace(' queued players', '');
                            const playerinfo = chattext.split(',');
                            players = {
                                team: 'Green',
                                queued: true,
                                players: playerinfo[0],
                                queuedPlayers: playerinfo[1]
                            }
                        } else {
                            chattext = chattext.replace('Team Green has ', '').replace(' online players', '');
                            players = {
                                team: 'Green',
                                queued: false,
                                players: chattext
                            }
                        }
                    } else if (chattext.startsWith('Team Yellow has ')) {
                        // queued
                        if (/^Team\sYellow\shas\s[0-9]{1,2}\sonline,\sand\s[0-9]{1,2}\squeued\splayers/.test(chattext)) {
                            chattext = chattext.replace('Team Yellow has ', '').replace(' online', '').replace(' and ', '').replace(' queued players', '');
                            const playerinfo = chattext.split(',');
                            players = {
                                team: 'Yellow',
                                queued: true,
                                players: playerinfo[0],
                                queuedPlayers: playerinfo[1]
                            }
                        } else {
                            chattext = chattext.replace('Team Yellow has ', '').replace(' online players', '');
                            players = {
                                team: 'Yellow',
                                queued: false,
                                players: chattext
                            }
                        }
                    }
                    let playerscopy = {};
                    playersInfo.push(Object.assign(playerscopy, players));
    
                    // scoreboard things
                    for (let index = 8; index >= 0; index--) {
                        const indexstr = '§' + index.toString() + '§r';
                        const element = bot.scoreboards.anninexus.itemsMap[indexstr].displayName;
                        if (index === 3 || index === 4 || index === 5 || index === 6) {    // nexus
                            let team = element.json.color;
                            element.extra.map((chatelement) => {
                                if ('extra' in chatelement.json) {
                                    if (/^[0-9]{1,3}/.test(chatelement.json.extra[0].text)) {
                                        nexus[team] = chatelement.json.extra[0].text;
                                    }
                                } else if (/^[0-9]{1,3}/.test(chatelement.json.text)) {
                                    nexus[team] = chatelement.json.text;
                                }
                            })
                        }
                    }
                }
                if (chattext.includes('/Team join (name)') === true) {
                    bot.end();
                    resolve([playersInfo, nexus, state]);
                }
                if (chattext.includes('Disconnected: You may only join games that are in progress if you were playing and got disconnected.') === true) {
                    bot.end();
                    resolve('Error');
                }
                if (chattext.includes('Unable to connect to ANNILOBBY_') === true) {
                    bot.end();
                    resolve('Error');
                }
            })
    
            bot.on('windowOpen', (window) => {
                console.log('window opened');
                if (window.title === '{"text":"§7|§0Select Server§7|"}') {
                    console.log('Click Window');
                    console.log(slotnum);
                    bot.clickWindow(slotnum - 1, 0, 0);
                    isConnected = true;
                    //bot.end();
                }
                bot.closeWindow(window);
            });
        }).then((data) => {
            isWorking = false;
            if (typeof (data) === 'string') {
                if (data === 'Busy') {
                    interaction.editReply({ content: 'Server is busy now.' });
                } else {
                    interaction.editReply({ content: 'Error!' });
                }
            } else {
                console.log(data);
                const oldEmbed = interaction.message.embeds[0].data.fields[slotnum - 1];
                const info = oldEmbed.value.split('\n');
                let mapName;
                let beforeVote = false;
                if (info[0].startsWith('```Map:')) {
                    mapName = info[0].replace('```Map:     ', '');
                } else {
                    mapName = info[0].replace('```Voting:', '');
                    beforeVote = true;
                }
                const voteName = oldEmbed.name.replace(slotnum + ' - ', '');
                const players = info[1];
                const gamestate = data[2];
                console.log(data[0]);
                // Players List
                let redPlayers;
                let bluePlayers;
                let greenPlayers;
                let yellowPlayers;
                data[0].map((teamv) => {
                    if (teamv['team'] === 'Red') {
                        if (teamv['queued'] === true) {
                            redPlayers = ':red_square: Red Players: ' + teamv['players'] + ' players(' + teamv['queuedPlayers'] + ' players queued)';
                        } else {
                            redPlayers = ':red_square: Red Players: ' + teamv['players'] + ' players';
                        }
                    }
                    if (teamv['team'] === 'Blue') {
                        if (teamv['queued'] === true) {
                            bluePlayers = ':blue_square: Blue Players: ' + teamv['players'] + ' players(' + teamv['queuedPlayers'] + ' players queued)';
                        } else {
                            bluePlayers = ':blue_square: Blue Players: ' + teamv['players'] + ' players';
                        }
                    }
                    if (teamv['team'] === 'Green') {
                        if (teamv['queued'] === true) {
                            greenPlayers = ':green_square: Green Players: ' + teamv['players'] + ' players(' + teamv['queuedPlayers'] + ' players queued)';
                        } else {
                            greenPlayers = ':green_square: Green Players: ' + teamv['players'] + ' players';
                        }
                    }
                    if (teamv['team'] === 'Yellow') {
                        if (teamv['queued'] === true) {
                            yellowPlayers = ':yellow_square: Yellow Players: ' + teamv['players'] + ' players(' + teamv['queuedPlayers'] + ' players queued)';
                        } else {
                            yellowPlayers = ':yellow_square: Yellow Players: ' + teamv['players'] + ' players';
                        }
                    }
                });
                const playersStr = redPlayers + '\n' + bluePlayers + '\n' + greenPlayers + '\n' + yellowPlayers;
                const embedObject = new EmbedBuilder()
                    .setTitle(voteName)
                    .setDescription('Map: ' + mapName + '\n' + players + '\nCurrent Game State: ' + gamestate)
                    .addFields({
                        name: 'Players',
                        value: playersStr
                    });
                if (beforeVote === false) {
                    embedObject.addFields(
                        {
                            name: 'Nexus',
                            value: ':red_square: Red Nexus: ' + data[1]['red'] + '\n:blue_square: Blue Nexus: ' + data[1]['blue'] + '\n:green_square: Green Nexus: ' + data[1]['green'] + '\n:yellow_square: Yellow Nexus: ' + data[1]['yellow']
                        }
                    )
                }
                interaction.editReply({ embeds: [embedObject] });
            }
        });
    }
});

client.login(TOKEN);