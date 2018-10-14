const mongoose = require('mongoose')

const MissingTicketsSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  username: String,
  userID: String,
  rUserName: String,
  rUserID: String,
  guild: String
}, {
  timestamps: true
})

module.exports = mongoose.model("MissingTickets", MissingTicketsSchema)