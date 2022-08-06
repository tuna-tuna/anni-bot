const mineflayer = require('mineflayer');
const puppeteer = require('puppeteer');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const wait = require('util').promisify(setTimeout);
require('dotenv').config();
const { MCUN, MCPW, CLIENT_ID, TOKEN } = process.env

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
        await interaction.deferReply();
        let fieldsRaw = [];
        let fieldRaw = {};
        let embedObject = {};
        const getMatch = new Promise((resolve, reject) => {
            let reopen = false;
            const bot = mineflayer.createBot({
                host: 'play.shotbow.net',
                username: MCUN,
                password: MCPW,
                auth: 'microsoft',
                version: '1.12.2'
            });
        
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
                //console.log('window opened');
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
                                let serverRaw = item.nbt.value.display.value.Name.value;
                                matchData['Server'] = formatServerName(serverRaw);
                                let matchDataCopy = {};
                                matchList.push(Object.assign(matchDataCopy, matchData));
                            }
                        });
                        //console.log(matchList);
                        bot.end();
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
                    phaseRaw = 'Before Voting';
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
            data.map((server) => {
                let name = server['Server'];
                let value = '';
                if (server['Map'].startsWith('Voting:')) {
                    value = '```' + server['Map'] + '\nPlayers: ' + server['Players'] + '\nState: ' + server['Phase'] + '```';
                } else {
                    value = '```Map:     ' + server['Map'] + '\nPlayers: ' + server['Players'] + '\nState:   ' + server['Phase'] + '```';
                }
                fieldRaw['name'] = name;
                fieldRaw['value'] = value;
                let fieldCopy = {};
                fieldsRaw.push(Object.assign(fieldCopy, fieldRaw));
            });
            embedObject = {
                title: 'Matches',
                fields: fieldsRaw
            };
        }).then(() => {
            interaction.editReply({ embeds: [embedObject] });
        });
    }
    if (interaction.commandName === 'stats') {
        await interaction.deferReply();
        const username = interaction.options.getString('mcid');
        const browser = await puppeteer.launch();
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

        await interaction.editReply({embeds: [embedObject]});
    }
});

client.login(TOKEN);