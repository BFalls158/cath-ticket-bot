const Discord = require('discord.js');
const mongoose = require('mongoose');
const moment = require('moment');
const winston = require('winston');
const MissingTickets = require('./Models/MissingTickets.js');
// const ApiSwgohHelp = require('api-swgoh-help')

// Configure logger settings
const logger = winston.createLogger({
  level: 'info',
});
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true,
});
logger.level = 'debug';

// Connect to mongooes instance
mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.exnfp.mongodb.net/ticket-bot?retryWrites=true&w=majority`, {
  useNewUrlParser: true,
  useCreateIndex: true,
  reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  reconnectInterval: 500, // Reconnect every 500ms
  poolSize: 10, // Maintain up to 10 socket connections
  // If not connected, return errors immediately rather than waiting for reconnect
  bufferMaxEntries: 0,
});
const db = mongoose.connection;
db.on('error', logger.error.bind(logger, 'connection error:'));
db.once('open', async () => {
  // Connect to SWGOH.HELP API
  // const swapi = new ApiSwgohHelp({
  //   "username": process.env.SWGOH_HELP_USER,
  //   "password": process.env.SWGOH_HELP_PASS,
  //   debug: true
  // })

  // try {
  //   let { result, error, warning } = await swapi.fetchPlayer({"allycode":282392964})
  //   console.log(result, error, warning)
  // } catch (error) {
  //   console.log(error)
  // }

  // Initialize Discord Bot
  const client = new Discord.Client();
  client.login(process.env.TOKEN);

  // Log Connection
  client.on('ready', () => {
    logger.info('Connected');
  });

  // Listen for messages
  client.on('message', (msg) => {
    // Set guild config
    const occurrenceDuration = 30;
    // Listen for commands starting with '&'
    const input = msg.content;
    if (input.substring(0, 1) === '&') {
      let args = input.substring(1).split(' ');
      const cmd = args[0];
      args = args.splice(1);
      const hasPermission = msg.member.hasPermission('MANAGE_MESSAGES');
      // Handle command
      if (cmd === 'add') {
        // on 'add' command
        // verify that user has required permission
        if (!hasPermission) {
          msg.channel.send('You do not have permission to do that.');
          return;
        }
        // Add user that missed ticket based on mentions
        const mentions = msg.mentions.members;
        mentions.forEach(async (member) => {
          const entry = new MissingTickets({
            _id: mongoose.Types.ObjectId(),
            username: member.user.username,
            userID: member.id,
            rUserName: msg.author.username,
            rUserID: msg.author.id,
            guild: msg.guild.id,
          });

          await entry.save()
            .then(() => {
              msg.channel.send(`User ${member.user.username} successfully recorded.`);
            })
            .catch((err) => {
              msg.channel.send(`Unable to save ${member.user.username}'s record. Please try again.`);
              logger(err);
            });
        });
      } else if (cmd === 'list') {
        // on 'list' command
        // Returns a list of memebers who've missed in the last 30 days
        MissingTickets.find({
          createdAt: {
            $lt: new Date(),
            $gte: new Date(new Date().setDate(new Date().getDate() - occurrenceDuration)),
          },
          guild: msg.guild.id,
        }, (err, res) => {
          if (err) {
            logger.log(err);
            return;
          }
          // Total the number of occurrence
          const unsortedTotals = res.reduce((acc, curr) => {
            if (typeof acc[curr.username] === 'undefined') {
              acc[curr.username] = 1;
            } else {
              acc[curr.username] += 1;
            }
            return acc;
          }, {});
          const props = Object.keys(unsortedTotals);
          const values = Object.values(unsortedTotals);
          const totals = [];
          for (let i = 0; i < props.length; i++) { // eslint-disable-line no-plusplus
            totals.push({ username: [props[i]], occurrence: values[i] });
          }
          totals.sort((a, b) => b.occurrence - a.occurrence);
          // build message
          if (totals.length === 0) {
            msg.channel.send('No occurrences found');
          } else {
            const embed = {};
            embed.title = 'Member - Times Under 600';
            embed.description = '`--------------------------------------------------`\n';
            totals.forEach((user) => {
              embed.description += `\`${user.username} - ${user.occurrence}\`\n`;
            });
            msg.channel.send({ embed });
          }
        });
      } else if (cmd === 'remove') {
        // on 'remove' command
        // verify that user has required permission
        if (!hasPermission) {
          msg.channel.send('You do not have permission to do that.');
          return;
        }
        MissingTickets.findByIdAndRemove(args[0], (err) => {
          if (!err) {
            msg.channel.send(`Occurrences for ID ${args[0]} removed.`);
          } else {
            msg.channel.send(`Cannot find occurrence with ID ${args[0]}`);
          }
        });
      } else if (cmd === 'ru' || cmd === 'removeuser') {
        if (!hasPermission) {
          msg.channel.send('You do not have permission to do that.');
          return;
        }
        args.forEach(async (username) => {
          await MissingTickets.deleteMany({
            guild: msg.guild.id,
            username,
          }, (err) => {
            if (err) {
              msg.channel.send('There was a problem communicating with the database, try again later.');
              logger.error(err);
            }
          });
        });
        msg.channel.send('User(s) and all occurrences successfully removed.');
      } else if (cmd === 'listuser' || cmd === 'lu') {
        const mentions = msg.mentions.members;
        mentions.forEach((member) => {
          MissingTickets.find(
            {
              createdAt: {
                $lt: new Date(),
                $gte: new Date(new Date().setDate(new Date().getDate() - occurrenceDuration)),
              },
              guild: msg.guild.id,
              userID: member.id,
            }, (err, res) => {
              if (err) {
                msg.channel.send('There was a problem communicating with the database, try again later.');
                logger.error(err);
                return;
              }
              if (res && res.length > 0) {
                let dates = '';
                let ids = '';
                res.forEach((result) => {
                  dates += `${moment(result.createdAt).format('MM/DD/YYYY')}\n`;
                  ids += `${result._id}\n`; // eslint-disable-line no-underscore-dangle
                });
                const embed = new Discord.RichEmbed()
                  .setTitle(`Occurrences for ${res[0].username}`)
                  .addField('Date', dates, true)
                  .addField('ID', ids, true);
                msg.channel.send({ embed });
              } else {
                msg.channel.send('Cannot find user(s)');
              }
            },
          );
        });
      } else if (cmd === 'help') {
        // on 'help' command
        const embed = new Discord.RichEmbed()
          .setTitle('Help - All commands start with "&"')
          .addField('Command', 'list\n add <@username>\n lu or listuser <@username>\n remove <occurrence ID>\n ru <username> (do NOT use an @!)\n help', true)
          .addField('Description', 'Lists deliquent users from last 30 days\nAdds user(s) to deliquent list\nList occurrences for member\nRemoves a single occurrence by ID\nRemoves a user and all occurrences\nShows this menu\n', true)
          .addField('Upcoming Features', 'Saved profiles for guild members.\n Character/Mod/Ship lookup.\n Matchup info (ala DSR Bot)', false);
        msg.channel.send({ embed });
      } else {
        msg.channel.send('Sorry, that is not a valid command.');
      }
    }
  });
});
