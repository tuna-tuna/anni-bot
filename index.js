const mineflayer = require('mineflayer');
const { default: axios } = require('axios');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Embed } = require('discord.js');
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
                bot.on('kicked', (reason, loggedIn) => {
                    if (reason === '{"text":"Too many players joining at once! Try again in a few seconds."}') {
                        bot.end();
                        resolve('Busy');
                    }
                });

                bot.on('message', message => {
                    const chattext = message.getText();
                    if (chattext.includes('Disconnected: You may only join games that are in progress if you were playing and got disconnected.') === true) {
                        bot.end();
                        resolve('Error');
                    }
                    if (chattext.includes('Unable to connect to ANNILOBBY_') === true) {
                        bot.end();
                        resolve('Error');
                    }
                })
        
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
                    if (window.title === '{"text":"Server Selector"}') {
                        connectAnni();
                    } else if (window.title === '{"text":"§7|§0Select Server§7|"}') {
                        if (reopen === false) {
                            reopen = true;
                            bot.closeWindow(window);
                            bot.simpleClick.rightMouse(22);
                        } else {
                            let matchList = [];
                            let matchData = {};
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
                    }
                    return mapRaw;
                }
        
                function formatServerName(serverRaw) {
                    serverRaw = serverRaw.replace('§r§n', '');
                    return serverRaw;
                }
            }).then((data) => {
                if (typeof (data) === 'string') {
                    isWorking = false;
                    if (data === 'Busy') {
                        interaction.editReply({ content: 'Server is busy now.' });
                    } else {
                        interaction.editReply({ content: 'Error!' });
                    }
                } else {
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
                }
            });
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
                    if (chattext.includes('Voted for ' + mapName) === true) {
                        bot.end();
                        resolve('Success');
                    }
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
                });
        
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
                    interaction.editReply({ content: `Successfully voted for ${mapName}` });
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
            let teamslist = bot.teams;
            let playerlist = [];
            let redlist = [];
            let bluelist = [];
            let greenlist = [];
            let yellowlist = [];
    
            // for debug
            bot.on('kicked', (reason, loggedIn) => {
                if (reason === '{"text":"Too many players joining at once! Try again in a few seconds."}') {
                    bot.end();
                    resolve('Busy');
                }
            });
    
            bot.on('spawn', async () => {
                setTimeout(() => {
                    bot.chat('/team v');
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

                        // playerlist things
                        for (let key in bot.players) {
                            if (bot.players.hasOwnProperty(key)) {
                                if (bot.players[key]['username'] !== bot.username) {
                                    playerlist.push(bot.players[key]['username']);
                                }
                            }
                        }
                        for (let key in teamslist) {
                            if (teamslist.hasOwnProperty(key)) {
                                if (key.startsWith('team') === false) {
                                    for (let member in teamslist[key]['membersMap']) {
                                        if (key === 'Red') {
                                            redlist.push(member);
                                        } else if (key === 'Blue') {
                                            bluelist.push(member);
                                        } else if (key === 'Green') {
                                            greenlist.push(member);
                                        } else if (key === 'Yellow') {
                                            yellowlist.push(member);
                                        }
                                        playerlist = playerlist.filter(item => item !== member);
                                    }
                                }
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
                    resolve([playersInfo, nexus, state, redlist, bluelist, greenlist, yellowlist, playerlist]);
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
                let redstr = '```';
                let bluestr = '```';
                let greenstr = '```';
                let yellowstr = '```';
                let playerstr = '```';
                data[3].map((player) => {
                    redstr += player + ', '
                });
                data[4].map((player) => {
                    bluestr += player + ', '
                });
                data[5].map((player) => {
                    greenstr += player + ', '
                });
                data[6].map((player) => {
                    yellowstr += player + ', '
                });
                data[7].map((player) => {
                    playerstr += player + ', '
                });
                redstr = redstr.slice(0, -2) + '```';
                bluestr = bluestr.slice(0, -2) + '```';
                greenstr = greenstr.slice(0, -2) + '```';
                yellowstr = yellowstr.slice(0, -2) + '```';
                playerstr = playerstr.slice(0, -2) + '```';
                embedObject.addFields({
                    name: ':red_square: Red Players',
                    value: redstr
                }, {
                    name: ':blue_square: Blue Players',
                    value: bluestr
                }, {
                    name: ':green_square: Green Players',
                    value: greenstr
                }, {
                    name: ':yellow_square: Yellow Players',
                    value: yellowstr
                }, {
                    name: ':compass: Lobby Players',
                    value: playerstr
                });
                interaction.editReply({ embeds: [embedObject] });
            }
        });
    }
});

client.login(TOKEN);