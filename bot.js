const Discord = require('discord.js')
const logger = require('winston')
const mongoose = require('mongoose')
const MissingTickets = require('./Models/MissingTickets.js')


// Configure logger settings
logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console, {
    colorize: true
})
logger.level = 'debug'
// Connect to mongooes instance
mongoose.connect(`mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@ds227373.mlab.com:27373/ticket-bot`, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  reconnectTries: Number.MAX_VALUE, // Never stop trying to reconnect
  reconnectInterval: 500, // Reconnect every 500ms
  poolSize: 10, // Maintain up to 10 socket connections
  // If not connected, return errors immediately rather than waiting for reconnect
  bufferMaxEntries: 0
})
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {

  // Initialize Discord Bot
  const client = new Discord.Client()
  client.login(process.env.TOKEN)

  // Log Connection
  client.on('ready', (evt) => {
    logger.info('Connected')
  })

  // Listen for messages
  client.on('message', (msg) => {

    // Listen for commands starting with '&'
    let input = msg.content
    if (input.substring(0, 1) == '&') {
      var args = input.substring(1).split(' ')
      const cmd = args[0]
      args = args.splice(1)
      // Handle command
      switch(cmd) {
        case 'add':
          // Add user that missed ticket based on mentions
          let mentions = msg.mentions.members
          mentions.forEach(async member => {
            const entry = new MissingTickets({
              _id: mongoose.Types.ObjectId(),
              username: member.user.username,
              userID: member.id,
              rUserName: msg.author.username,
              rUserID: msg.author.id,
              guild: msg.guild.id
            })

            await entry.save()
              .then(result => {
                msg.channel.send(`User ${member.user.username} successfully recorded.`)
              })
              .catch(err => {
                msg.channel.send(`Unable to save ${member.user.username}'s record. Please try again.`)
                logger(err)
              })
          })
        break

        case 'list':
          // Returns a list of memebers who've missed in the last 30 days
          MissingTickets.find({
            "createdAt" : { 
              $lt: new Date(), 
              $gte: new Date(new Date().setDate(new Date().getDate()-30))
            },
            "guild": msg.guild.id
          }, function (err, res) {
            if (err) return console.log(err)
            // Total the number of occurances
            let unsortedTotals = res.reduce((acc, curr) => {
              if (typeof acc[curr.username] == 'undefined') {
                acc[curr.username] = 1
              } else {
                acc[curr.username] += 1
              }
              return acc
            }, {})
            const props = Object.keys(unsortedTotals)
            const values = Object.values(unsortedTotals)
            let totals = []
            for (let i = 0; i < props.length; i++) {
              totals.push({username: [props[i]], occurances: values[i]})
            }
            totals.sort((a, b) => {
              return b.occurances - a.occurances
            })
            // build message
            let embed = {}
            embed.title = 'Member - Times Under 600'
            embed.description = '`--------------------------------------------------`\n'
            totals.forEach(user => {
              embed.description += `\`${user.username} - ${user.occurances}\`\n`
            })
            msg.channel.send({embed})
          })
        break

        case 'remove':
          msg.channel.send('This feature isn\'t avaialble yet. Check back soon.')
        break

        case 'help':
          let embed = {}
          embed.title = 'Available Commands:'
          embed.description = '`list - Lists deliquent users from last 30 days`\n'
          embed.description += '`add <@username> - Adds user(s) to deliquent list`\n'
          embed.description += '`remove <@username>` - Currently does nothing, but it will soon.\n'
          embed.description += '`help - Shows this menu`'
          msg.channel.send({embed})
        break

        default:
          msg.channel.send('Sorry, that is not a valid command.')
        break
      }
    }
  })
})
